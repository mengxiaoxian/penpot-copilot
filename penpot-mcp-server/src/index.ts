/**
 * Penpot MCP Server
 * 大模型与 Penpot 插件的桥梁
 *
 * 功能：
 * 1. 启动 MCP 标准服务，暴露 render_penpot_ui Tool
 * 2. 启动 WebSocket Server (端口 8080)，与 Penpot 插件通信
 * 3. 将大模型生成的 UI JSON 转发给插件进行渲染
 * 4. 渐进式披露组件库，防止上下文撑爆
 * 5. 组件字典动态同步与本地持久化
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';

// =====================================================
// 📦 组件数据库 (渐进式披露架构 + 动态同步持久化)
// =====================================================

/**
 * 组件约束定义
 */
interface ComponentConstraint {
  field: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  maxLength?: number;
  pattern?: string;
  description: string;
}

/**
 * 组件定义
 */
interface ComponentDefinition {
  type: string;
  description: string;
  category: string;
  slots: string[];
  constraints: ComponentConstraint[];
}

/**
 * 数据库文件路径
 * 组件字典将持久化到此文件
 */
const DB_PATH = path.resolve(process.cwd(), 'components.json');

/**
 * 默认组件数据库
 * 当持久化文件不存在时使用此默认值
 */
const DEFAULT_COMPONENT_DB: ComponentDefinition[] = [
  {
    type: 'Title',
    description: '用于页面模块分割的标题组件',
    category: '布局',
    slots: ['text'],
    constraints: [
      {
        field: 'text',
        type: 'string',
        required: true,
        maxLength: 15,
        description: '标题文本，最大 15 字符'
      }
    ]
  },
  {
    type: 'AssetHeader',
    description: '总资产概览卡片，展示用户资产核心数据',
    category: '资产',
    slots: ['userName', 'totalAsset', 'dailyReturn', 'dailyReturnPercent'],
    constraints: [
      {
        field: 'userName',
        type: 'string',
        required: true,
        maxLength: 10,
        description: '用户名称，最大 10 字符'
      },
      {
        field: 'totalAsset',
        type: 'string',
        required: true,
        pattern: '^[\\d,]+\\.?\\d*$',
        description: '总资产金额，支持千分位格式'
      },
      {
        field: 'dailyReturn',
        type: 'string',
        required: true,
        pattern: '^[+-]?[\\d,]+\\.?\\d*$',
        description: '日收益金额，需带正负号'
      },
      {
        field: 'dailyReturnPercent',
        type: 'string',
        required: false,
        pattern: '^[+-]?\\d+\\.?\\d*%$',
        description: '日收益率百分比'
      }
    ]
  },
  {
    type: 'FundCard',
    description: '标准化基金卡片，展示基金核心信息',
    category: '基金',
    slots: ['fundName', 'fundCode', 'yieldRate', 'yieldLabel', 'amount', 'shares'],
    constraints: [
      {
        field: 'fundName',
        type: 'string',
        required: true,
        maxLength: 12,
        description: '基金名称，最大 12 字符'
      },
      {
        field: 'fundCode',
        type: 'string',
        required: false,
        pattern: '^\\d{6}$',
        description: '基金代码，6 位数字'
      },
      {
        field: 'yieldRate',
        type: 'string',
        required: true,
        pattern: '^[+-]\\d+\\.?\\d*%$',
        description: '收益率，必须带正负号（如 +2.35% 或 -1.20%）'
      },
      {
        field: 'yieldLabel',
        type: 'string',
        required: false,
        maxLength: 8,
        description: '收益标签（如"近一月"、"持有收益"），最大 8 字符'
      },
      {
        field: 'amount',
        type: 'string',
        required: false,
        pattern: '^[\\d,]+\\.?\\d*$',
        description: '持有金额'
      },
      {
        field: 'shares',
        type: 'string',
        required: false,
        pattern: '^[\\d,]+\\.?\\d*$',
        description: '持有份额'
      }
    ]
  },
  {
    type: 'WarningCard',
    description: '风险提示合规卡片，用于展示投资风险警示',
    category: '合规',
    slots: ['warningTitle', 'warningText', 'warningLevel'],
    constraints: [
      {
        field: 'warningTitle',
        type: 'string',
        required: true,
        maxLength: 10,
        description: '警示标题，最大 10 字符'
      },
      {
        field: 'warningText',
        type: 'string',
        required: true,
        maxLength: 60,
        description: '警示内容，严禁超过 60 个字符否则极易触发排版熔断'
      },
      {
        field: 'warningLevel',
        type: 'string',
        required: false,
        pattern: '^(low|medium|high)$',
        description: '风险等级：low（低）、medium（中）、high（高）'
      }
    ]
  },
  {
    type: 'Button',
    description: '通用操作按钮',
    category: '交互',
    slots: ['text', 'type', 'disabled'],
    constraints: [
      {
        field: 'text',
        type: 'string',
        required: true,
        maxLength: 8,
        description: '按钮文本，最大 8 字符'
      },
      {
        field: 'type',
        type: 'string',
        required: false,
        pattern: '^(primary|secondary|text)$',
        description: '按钮类型：primary（主要）、secondary（次要）、text（文本）'
      },
      {
        field: 'disabled',
        type: 'boolean',
        required: false,
        description: '是否禁用'
      }
    ]
  },
  {
    type: 'Divider',
    description: '分割线组件，用于内容区块分隔',
    category: '布局',
    slots: ['style'],
    constraints: [
      {
        field: 'style',
        type: 'string',
        required: false,
        pattern: '^(solid|dashed|dotted)$',
        description: '分割线样式：solid（实线）、dashed（虚线）、dotted（点线）'
      }
    ]
  },
  {
    type: 'NoticeBar',
    description: '公告通知栏，用于重要信息提示',
    category: '通知',
    slots: ['text', 'icon', 'closable'],
    constraints: [
      {
        field: 'text',
        type: 'string',
        required: true,
        maxLength: 50,
        description: '公告文本，最大 50 字符'
      },
      {
        field: 'icon',
        type: 'string',
        required: false,
        pattern: '^(info|warning|success|error)$',
        description: '图标类型：info、warning、success、error'
      },
      {
        field: 'closable',
        type: 'boolean',
        required: false,
        description: '是否可关闭'
      }
    ]
  },
  {
    type: 'ProfitCard',
    description: '收益展示卡片，用于盈亏数据可视化',
    category: '资产',
    slots: ['label', 'amount', 'percent', 'trend'],
    constraints: [
      {
        field: 'label',
        type: 'string',
        required: true,
        maxLength: 10,
        description: '收益标签（如"累计收益"、"今日盈亏"），最大 10 字符'
      },
      {
        field: 'amount',
        type: 'string',
        required: true,
        pattern: '^[+-]?[\\d,]+\\.?\\d*$',
        description: '收益金额，带正负号'
      },
      {
        field: 'percent',
        type: 'string',
        required: false,
        pattern: '^[+-]?\\d+\\.?\\d*%$',
        description: '收益率百分比'
      },
      {
        field: 'trend',
        type: 'string',
        required: false,
        pattern: '^(up|down|flat)$',
        description: '趋势方向：up（上涨）、down（下跌）、flat（持平）'
      }
    ]
  },
  {
    type: 'ProductCard',
    description: '理财产品卡片，用于展示理财产品信息',
    category: '理财',
    slots: ['productName', 'yieldRate', 'period', 'minAmount', 'riskLevel', 'tag'],
    constraints: [
      {
        field: 'productName',
        type: 'string',
        required: true,
        maxLength: 15,
        description: '产品名称，最大 15 字符'
      },
      {
        field: 'yieldRate',
        type: 'string',
        required: true,
        pattern: '^\\d+\\.?\\d*%$',
        description: '预期年化收益率（如"3.85%"）'
      },
      {
        field: 'period',
        type: 'string',
        required: false,
        maxLength: 10,
        description: '产品期限（如"90天"、"6个月"），最大 10 字符'
      },
      {
        field: 'minAmount',
        type: 'string',
        required: false,
        pattern: '^[\\d,]+$',
        description: '起购金额'
      },
      {
        field: 'riskLevel',
        type: 'string',
        required: false,
        pattern: '^(R1|R2|R3|R4|R5)$',
        description: '风险等级：R1-R5'
      },
      {
        field: 'tag',
        type: 'string',
        required: false,
        maxLength: 6,
        description: '产品标签（如"热门"、"新品"），最大 6 字符'
      }
    ]
  },
  {
    type: 'EmptyState',
    description: '空状态占位组件，用于无数据场景',
    category: '反馈',
    slots: ['title', 'description', 'actionText'],
    constraints: [
      {
        field: 'title',
        type: 'string',
        required: true,
        maxLength: 12,
        description: '空状态标题，最大 12 字符'
      },
      {
        field: 'description',
        type: 'string',
        required: false,
        maxLength: 30,
        description: '空状态描述，最大 30 字符'
      },
      {
        field: 'actionText',
        type: 'string',
        required: false,
        maxLength: 8,
        description: '操作按钮文本，最大 8 字符'
      }
    ]
  }
];

/**
 * 组件数据库 - 动态状态
 * 可通过 WebSocket 同步指令进行热更新
 */
let COMPONENT_DB: ComponentDefinition[] = [];

/**
 * 初始化组件数据库
 * 从本地持久化文件加载，若不存在则使用默认值并创建文件
 */
function initComponentDB(): void {
  console.log('[📦 组件库] 初始化组件数据库...');
  console.log(`[📦 组件库] 持久化文件路径: ${DB_PATH}`);

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(fileContent);

      // 验证解析结果是否为有效数组
      if (Array.isArray(parsed) && parsed.length > 0) {
        COMPONENT_DB = parsed;
        console.log(`[📦 组件库] 成功从持久化文件加载 ${COMPONENT_DB.length} 个组件`);
      } else {
        console.warn('[📦 组件库] 持久化文件内容无效，使用默认组件库');
        COMPONENT_DB = [...DEFAULT_COMPONENT_DB];
        saveComponentDB();
      }
    } catch (error) {
      console.error('[📦 组件库] 解析持久化文件失败，使用默认组件库:', error);
      COMPONENT_DB = [...DEFAULT_COMPONENT_DB];
      saveComponentDB();
    }
  } else {
    console.log('[📦 组件库] 持久化文件不存在，使用默认组件库并创建文件');
    COMPONENT_DB = [...DEFAULT_COMPONENT_DB];
    saveComponentDB();
  }
}

/**
 * 保存组件数据库到持久化文件
 */
function saveComponentDB(): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(COMPONENT_DB, null, 2), 'utf-8');
    console.log(`[📦 组件库] 已保存 ${COMPONENT_DB.length} 个组件到持久化文件`);
  } catch (error) {
    console.error('[📦 组件库] 保存持久化文件失败:', error);
  }
}

/**
 * 更新组件数据库（热更新）
 * 用于接收来自 Penpot 插件的组件同步指令
 * @param newDB 新的组件数据库
 * @returns 更新结果
 */
function updateComponentDB(newDB: ComponentDefinition[]): { success: boolean; message: string; count: number } {
  try {
    // 验证新数据是否为有效数组
    if (!Array.isArray(newDB)) {
      return {
        success: false,
        message: '组件数据格式错误：必须为数组',
        count: 0
      };
    }

    // 基本验证：检查每个组件是否有必要字段
    for (const component of newDB) {
      if (!component.type || !component.description || !component.category) {
        return {
          success: false,
          message: `组件数据格式错误：缺少必要字段 (type, description, category)`,
          count: 0
        };
      }
    }

    // 更新内存中的组件数据库
    COMPONENT_DB = newDB;

    // 持久化到文件
    saveComponentDB();

    console.log(`[📦 组件库] 热更新成功，当前共 ${COMPONENT_DB.length} 个组件`);

    return {
      success: true,
      message: `组件数据库已更新，共 ${COMPONENT_DB.length} 个组件`,
      count: COMPONENT_DB.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[📦 组件库] 热更新失败:', errorMessage);
    return {
      success: false,
      message: `更新失败: ${errorMessage}`,
      count: COMPONENT_DB.length
    };
  }
}

// 在服务启动前初始化组件数据库
initComponentDB();

// =====================================================
// 🤖 Agent 分析请求队列
// =====================================================

interface AgentAnalyzeRequest {
  id: string;
  text: string;
  requestType: string;
  timestamp: Date;
  ws: WebSocket;  // 保存发起请求的 WebSocket 连接
}

const pendingAgentRequests: Map<string, AgentAnalyzeRequest> = new Map();
let requestIdCounter = 0;

/**
 * 处理来自插件的 Agent 分析请求
 */
function handleAgentAnalyzeRequest(ws: WebSocket, payload: { text: string; requestType: string }): void {
  const requestId = `agent-req-${++requestIdCounter}`;

  const request: AgentAnalyzeRequest = {
    id: requestId,
    text: payload.text,
    requestType: payload.requestType,
    timestamp: new Date(),
    ws
  };

  pendingAgentRequests.set(requestId, request);
  console.log(`[🤖] 已存储 Agent 分析请求: ${requestId}`);
  console.log(`[🤖] 当前待处理请求数: ${pendingAgentRequests.size}`);

  // 响应插件，告知请求已接收
  ws.send(JSON.stringify({
    type: 'agent-analyze-ack',
    requestId,
    message: '请求已接收，等待 Agent 处理'
  }));
}

/**
 * 获取待处理的 Agent 分析请求
 */
function getPendingAgentRequests(): AgentAnalyzeRequest[] {
  return Array.from(pendingAgentRequests.values());
}

/**
 * 完成 Agent 分析请求
 */
function completeAgentRequest(requestId: string, tasks: Task[]): boolean {
  const request = pendingAgentRequests.get(requestId);
  if (!request) {
    console.log(`[🤖] 未找到请求: ${requestId}`);
    return false;
  }

  // 发送结果给插件
  if (request.ws.readyState === WebSocket.OPEN) {
    request.ws.send(JSON.stringify({
      type: 'agent-analyze-result',
      success: true,
      tasks
    }));
  }

  // 移除已处理的请求
  pendingAgentRequests.delete(requestId);
  console.log(`[🤖] 已完成 Agent 分析请求: ${requestId}`);
  return true;
}

// =====================================================
// 📋 严格的 Schema 定义
// =====================================================

/**
 * create_masters 任务的 data 结构
 */
const CreateMastersDataSchema = z.object({
  components: z.array(z.object({
    type: z.string().describe('组件类型，如 AssetHeader, FundCard, WarningCard 等'),
    // 允许任意额外字段（组件属性）
  }).passthrough()).describe('需要创建的组件列表')
});

/**
 * render_page 任务的 data 结构
 */
const RenderPageDataSchema = z.object({
  pageName: z.string().describe('页面名称'),
  elements: z.array(z.object({
    type: z.string().describe('元素类型'),
    // 允许任意额外字段（元素属性）
  }).passthrough()).describe('页面元素列表')
});

/**
 * 单个任务的 Schema
 * 🔥 极其严格的定义，确保大模型不会发错字段
 */
const TaskSchema = z.object({
  taskId: z.string().describe('任务的唯一ID，格式如 task-0, task-1'),
  taskName: z.string().describe('任务的中文描述，如"步骤一：初始化组件母版"'),
  action: z.enum(['create_masters', 'render_page'])
    .describe('执行的核心动作：create_masters 创建母版，render_page 渲染页面'),
  data: z.union([
    CreateMastersDataSchema,
    RenderPageDataSchema
  ]).describe('动作对应的具体数据')
});

/**
 * 完整的 tasks 数组 Schema
 */
const TasksSchema = z.object({
  tasks: z.array(TaskSchema)
    .min(1, '任务列表不能为空')
    .describe('需要按顺序执行的渲染任务列表')
});

// =====================================================
// 📋 类型推导
// =====================================================

type Task = z.infer<typeof TaskSchema>;
type CreateMastersData = z.infer<typeof CreateMastersDataSchema>;
type RenderPageData = z.infer<typeof RenderPageDataSchema>;

interface PenpotMessage {
  type: string;
  payload?: unknown;
  taskId?: string;
  status?: 'success' | 'error' | 'layout-error';
  message?: string;
}

interface CachedResponse {
  timestamp: Date;
  message: PenpotMessage;
}

// =====================================================
// ⭐ Promise 管理器（用于 Tool 调用挂起与反馈）
// =====================================================

interface PendingTask {
  taskId: string;
  resolve: (result: { success: boolean; message: string; error?: string }) => void;
  reject: (error: Error) => void;
  timestamp: Date;
  timeoutId: NodeJS.Timeout;
}

class TaskPromiseManager {
  private pendingTasks: Map<string, PendingTask> = new Map();
  private readonly DEFAULT_TIMEOUT = 60000; // 默认超时 60 秒

  /**
   * 注册一个待处理的任务 Promise
   * @param taskId 任务 ID
   * @param timeout 超时时间（毫秒）
   * @returns Promise，等待前端执行结果
   */
  waitForTask(taskId: string, timeout: number = this.DEFAULT_TIMEOUT): Promise<{ success: boolean; message: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        console.warn(`[⏰ TaskPromise] 任务超时: ${taskId}`);
        resolve({
          success: false,
          message: `任务执行超时（${timeout / 1000}秒），可能前端未响应或执行时间过长`,
          error: 'TIMEOUT'
        });
      }, timeout);

      this.pendingTasks.set(taskId, {
        taskId,
        resolve,
        reject,
        timestamp: new Date(),
        timeoutId
      });

      console.log(`[⏳ TaskPromise] 等待任务结果: ${taskId}`);
    });
  }

  /**
   * 任务成功完成，解析 Promise
   */
  completeTask(taskId: string): boolean {
    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      console.log(`[TaskPromise] 未找到待处理任务: ${taskId}`);
      return false;
    }

    clearTimeout(pending.timeoutId);
    this.pendingTasks.delete(taskId);
    pending.resolve({ success: true, message: '任务执行成功' });
    console.log(`[✅ TaskPromise] 任务完成: ${taskId}`);
    return true;
  }

  /**
   * 任务执行失败，解析 Promise
   */
  failTask(taskId: string, errorMessage: string): boolean {
    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      console.log(`[TaskPromise] 未找到待处理任务: ${taskId}`);
      return false;
    }

    clearTimeout(pending.timeoutId);
    this.pendingTasks.delete(taskId);
    pending.resolve({
      success: false,
      message: errorMessage,
      error: errorMessage
    });
    console.log(`[❌ TaskPromise] 任务失败: ${taskId} - ${errorMessage}`);
    return true;
  }

  /**
   * 获取待处理任务数量
   */
  getPendingCount(): number {
    return this.pendingTasks.size;
  }

  /**
   * 清理所有待处理任务（用于关闭服务器时）
   */
  clearAll(): void {
    this.pendingTasks.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.resolve({
        success: false,
        message: '服务器关闭，任务被取消',
        error: 'SERVER_SHUTDOWN'
      });
    });
    this.pendingTasks.clear();
  }
}

// 全局 Promise 管理器实例
const taskPromiseManager = new TaskPromiseManager();

// =====================================================
// 🔌 WebSocket 连接管理器
// =====================================================

class WebSocketManager {
  private activeConnections: Set<WebSocket> = new Set();
  private responseCache: Map<string, CachedResponse> = new Map();
  private wss: WebSocketServer | null = null;

  /**
   * 启动 WebSocket Server
   */
  start(port: number): void {
    const server = http.createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress || 'unknown';
      console.log(`[🔌 WebSocket] 新客户端连接: ${clientIp}`);
      this.activeConnections.add(ws);

      ws.send(JSON.stringify({
        type: 'connected',
        message: '已连接到 Penpot MCP Server',
        componentCount: COMPONENT_DB.length
      }));

      ws.on('message', (data: RawData) => {
        try {
          const message: PenpotMessage = JSON.parse(data.toString());

          // =====================================================
          // 🔄 组件字典同步指令拦截（热更新）
          // =====================================================
          if (message.type === 'sync-components') {
            console.log('[🔄 组件同步] 收到组件同步指令');
            console.log('[🔄 组件同步] Payload:', JSON.stringify(message.payload, null, 2));

            // 处理组件同步
            const newComponents = message.payload as ComponentDefinition[];
            const result = updateComponentDB(newComponents);

            // 响应同步结果
            ws.send(JSON.stringify({
              type: 'sync-components-response',
              success: result.success,
              message: result.message,
              componentCount: result.count
            }));

            console.log(`[🔄 组件同步] 响应已发送: ${result.message}`);
            return; // 拦截完成，不再继续处理
          }

          // =====================================================
          // 🔄 组件字典请求指令（获取当前组件库）
          // =====================================================
          if (message.type === 'get-components') {
            console.log('[🔄 组件请求] 收到获取组件库指令');

            ws.send(JSON.stringify({
              type: 'get-components-response',
              components: COMPONENT_DB,
              count: COMPONENT_DB.length
            }));

            console.log(`[🔄 组件请求] 已发送 ${COMPONENT_DB.length} 个组件`);
            return; // 拦截完成，不再继续处理
          }

          // =====================================================
          // 🔄 组件字典重置指令（恢复默认组件库）
          // =====================================================
          if (message.type === 'reset-components') {
            console.log('[🔄 组件重置] 收到重置组件库指令');

            COMPONENT_DB = [...DEFAULT_COMPONENT_DB];
            saveComponentDB();

            ws.send(JSON.stringify({
              type: 'reset-components-response',
              success: true,
              message: `组件库已重置为默认值，共 ${COMPONENT_DB.length} 个组件`,
              componentCount: COMPONENT_DB.length
            }));

            console.log(`[🔄 组件重置] 已重置为 ${COMPONENT_DB.length} 个默认组件`);
            return; // 拦截完成，不再继续处理
          }

          // 继续处理其他 MCP 原生消息
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('[🔌 WebSocket] 解析消息失败:', error);
        }
      });

      ws.on('close', () => {
        console.log(`[🔌 WebSocket] 客户端断开连接`);
        this.activeConnections.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[🔌 WebSocket] 连接错误:', error.message);
        this.activeConnections.delete(ws);
      });
    });

    server.listen(port, () => {
      console.log(`[🔌 WebSocket] 服务器启动在端口 ${port}`);
      console.log(`[🔌 WebSocket] 等待 Penpot 插件连接...`);
    });
  }

  private handleClientMessage(ws: WebSocket, message: PenpotMessage): void {
    console.log(`[🔌 WebSocket] 收到消息:`, JSON.stringify(message, null, 2));

    if (message.taskId) {
      this.responseCache.set(message.taskId, {
        timestamp: new Date(),
        message
      });

      if (this.responseCache.size > 100) {
        const firstKey = this.responseCache.keys().next().value;
        if (firstKey) {
          this.responseCache.delete(firstKey);
        }
      }
    }

    switch (message.type) {
      case 'task-complete':
        console.log(`[✅] 任务完成: ${message.taskId}`);
        // ⭐ 解析 Promise，通知 Tool 任务成功
        taskPromiseManager.completeTask(message.taskId || '');
        break;
      case 'task-error':
        console.error(`[❌] 任务失败: ${message.taskId} - ${message.message}`);
        // ⭐ 解析 Promise，通知 Tool 任务失败
        taskPromiseManager.failTask(message.taskId || '', message.message || '未知错误');
        break;
      case 'layout-error':
        console.error(`[🔥] 布局校验失败: ${message.taskId} - ${message.message}`);
        // ⭐ 布局错误也视为失败
        taskPromiseManager.failTask(message.taskId || '', `布局校验失败: ${message.message}`);
        break;
      case 'agent-analyze':
        // 🔥 处理来自插件的自然语言分析请求
        console.log(`[🤖] 收到 Agent 分析请求:`, message.payload);
        handleAgentAnalyzeRequest(ws, message.payload as { text: string; requestType: string });
        break;
      case 'pong':
        console.log(`[🏓] 心跳响应`);
        break;
      default:
        console.log(`[📨] 未知消息类型: ${message.type}`);
    }
  }

  broadcast(type: string, payload: unknown): number {
    const message = JSON.stringify({ type, payload });
    let successCount = 0;

    this.activeConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        successCount++;
      }
    });

    return successCount;
  }

  getConnectionCount(): number {
    return this.activeConnections.size;
  }

  getCachedResponse(taskId: string): CachedResponse | undefined {
    return this.responseCache.get(taskId);
  }
}

// =====================================================
// 🚀 MCP Server 初始化
// =====================================================

const wsManager = new WebSocketManager();

const server = new McpServer({
  name: 'penpot-mcp-server',
  version: '1.0.0',
});

// =====================================================
// 🛠️ 注册 MCP Tools (渐进式披露架构 + 动态同步)
// =====================================================

/**
 * Tool: search_components
 * 在设计 UI 前，检索系统支持的组件大纲
 * 返回简短描述，不返回详细约束（防止上下文撑爆）
 * 🔥 始终引用全局变量 COMPONENT_DB，确保获取热更新后的最新字典
 */
server.tool(
  'search_components',
  `在设计 UI 前，检索系统支持的组件大纲。

【功能说明】
根据关键词搜索可用组件，返回组件类型和简短描述。
此工具采用"渐进式披露"设计，仅返回概要信息，避免撑爆大模型上下文。

【使用场景】
1. 设计金融 UI 前，先调用此工具了解可用组件
2. 根据业务需求（如"基金"、"风险"、"资产"）筛选组件
3. 确定要使用的组件后，再调用 get_component_schema 获取详细约束

【输入参数】
- keyword: 可选，搜索关键词（如"基金"、"风险"、"标题"）

【返回】
匹配组件的 type 和 description（不包含详细约束）`,
  {
    keyword: z.string().optional().describe('搜索关键词，如"基金"、"风险"、"标题"')
  },
  async ({ keyword }) => {
    console.log('[🔍 search_components] 搜索关键词:', keyword || '(全部)');
    console.log(`[🔍 search_components] 当前组件库数量: ${COMPONENT_DB.length}`);

    // 过滤匹配的组件 - 始终引用全局变量 COMPONENT_DB
    const matchedComponents = COMPONENT_DB.filter((component) => {
      if (!keyword) return true;

      const lowerKeyword = keyword.toLowerCase();
      const searchFields = [
        component.type.toLowerCase(),
        component.description.toLowerCase(),
        component.category.toLowerCase(),
        ...component.slots.map(s => s.toLowerCase())
      ];

      return searchFields.some(field => field.includes(lowerKeyword));
    });

    // 只返回 type 和 description（渐进式披露）
    const result = matchedComponents.map((component) => ({
      type: component.type,
      description: component.description,
      category: component.category
    }));

    console.log(`[🔍 search_components] 找到 ${result.length} 个组件`);

    return {
      content: [{
        type: 'text' as const,
        text: `📋 组件搜索结果\n\n` +
              `🔍 搜索关键词: ${keyword || '(显示全部)'}\n` +
              `📊 找到 ${result.length} 个匹配组件\n\n` +
              result.map((c, i) =>
                `${i + 1}. **${c.type}** (${c.category})\n   ${c.description}`
              ).join('\n\n') +
              `\n\n💡 提示: 使用 get_component_schema 获取组件的详细字段定义和约束。`
      }]
    };
  }
);

/**
 * Tool: get_component_schema
 * 获取组件的严格字段定义和约束
 * 在确定要使用的组件后调用，获取详细约束信息
 * 🔥 始终引用全局变量 COMPONENT_DB，确保获取热更新后的最新字典
 */
server.tool(
  'get_component_schema',
  `获取指定组件的详细字段定义和约束。

【功能说明】
在确定要使用的组件后，调用此工具获取严格的字段定义、类型限制和字数约束。
此工具返回完整约束信息，帮助大模型生成符合规范的 JSON。

【使用场景】
1. 通过 search_components 确定要使用的组件
2. 调用此工具获取组件的详细约束
3. 根据约束生成符合规范的 UI JSON

【输入参数】
- componentTypes: 必填，组件类型数组（如 ["FundCard", "WarningCard"]）

【返回】
对应组件的详细 slots 和 constraints`,
  {
    componentTypes: z.array(z.string()).min(1).describe('组件类型数组，如 ["FundCard", "WarningCard"]')
  },
  async ({ componentTypes }) => {
    console.log('[📋 get_component_schema] 查询组件:', componentTypes);
    console.log(`[📋 get_component_schema] 当前组件库数量: ${COMPONENT_DB.length}`);

    const results: ComponentDefinition[] = [];

    // 始终引用全局变量 COMPONENT_DB 进行查询
    for (const type of componentTypes) {
      const component = COMPONENT_DB.find(c => c.type === type);
      if (component) {
        results.push(component);
      }
    }

    if (results.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ 未找到匹配的组件\n\n` +
                `请求的组件类型: ${componentTypes.join(', ')}\n\n` +
                `💡 提示: 使用 search_components 查看所有可用组件。`
        }]
      };
    }

    // 格式化输出详细的约束信息
    const formattedResults = results.map((component) => {
      const constraintsText = component.constraints.map((c) => {
        let constraintStr = `   • ${c.field} (${c.type}${c.required ? ', 必填' : ', 可选'})`;
        constraintStr += `\n     描述: ${c.description}`;
        if (c.maxLength) {
          constraintStr += `\n     最大长度: ${c.maxLength}`;
        }
        if (c.pattern) {
          constraintStr += `\n     格式: ${c.pattern}`;
        }
        return constraintStr;
      }).join('\n');

      return `## ${component.type}\n\n` +
             `**类别**: ${component.category}\n` +
             `**描述**: ${component.description}\n` +
             `**字段列表**: ${component.slots.join(', ')}\n\n` +
             `**约束详情**:\n${constraintsText}`;
    }).join('\n\n---\n\n');

    console.log(`[📋 get_component_schema] 返回 ${results.length} 个组件的详细约束`);

    return {
      content: [{
        type: 'text' as const,
        text: `📐 组件 Schema 详情\n\n` +
              `查询组件: ${componentTypes.join(', ')}\n` +
              `找到 ${results.length} 个组件\n\n` +
              `---\n\n` +
              formattedResults +
              `\n\n⚠️ 重要提示:\n` +
              `• 必须严格遵守 maxLength 限制，否则会导致排版熔断\n` +
              `• pattern 字段定义了字段格式，必须使用正则匹配\n` +
              `• required 字段缺失会导致渲染失败`
      }]
    };
  }
);

/**
 * Tool: render_penpot_ui
 * ⭐ 带反馈闭环的渲染工具
 * - 发送任务后挂起等待前端执行结果
 * - 根据结果返回 success 或 error
 * - 支持超时机制
 */
server.tool(
  'render_penpot_ui',
  `将生成的 UI JSON Schema 发送给 Penpot 插件进行自动渲染。

【必须严格遵循的 Schema 结构】
每个任务必须包含以下字段：
- taskId: 任务的唯一ID（如 "task-0"）
- taskName: 任务的中文描述（如 "步骤一：初始化组件母版"）
- action: 只能是 "create_masters" 或 "render_page"
- data: 动作对应的具体数据

【create_masters 的 data 结构】
{
  "components": [
    { "type": "AssetHeader", "userName": "用户", "totalAssets": "10000" },
    { "type": "FundCard", "fundName": "基金名" }
  ]
}

【render_page 的 data 结构】
{
  "pageName": "页面名称",
  "elements": [
    { "type": "Title", "text": "标题" },
    { "type": "Button", "text": "按钮" }
  ]
}

【示例调用】
{
  "tasks": [
    {
      "taskId": "task-0",
      "taskName": "步骤一：初始化组件母版",
      "action": "create_masters",
      "data": { "components": [...] }
    },
    {
      "taskId": "task-1",
      "taskName": "步骤二：渲染首页",
      "action": "render_page",
      "data": { "pageName": "首页", "elements": [...] }
    }
  ]
}

【⚠️ 重要：错误反馈与自我修正】
此工具会等待前端执行结果并返回执行状态：
- 如果返回 {"status": "success"}，说明渲染成功
- 如果返回 {"status": "error", "message": "..."}，说明你的 JSON 格式不被宿主环境接受

当收到错误时，你必须：
1. 仔细阅读 message 中的错误描述
2. 检查是否使用了不存在的组件类型（只能使用 search_components 返回的组件）
3. 修正 JSON 格式后重新调用此工具`,
  {
    // 🔥 使用严格的 Zod Schema
    tasks: z.array(z.object({
      taskId: z.string().describe('任务的唯一ID，格式如 task-0, task-1'),
      taskName: z.string().describe('任务的中文描述，如"步骤一：初始化组件母版"'),
      action: z.enum(['create_masters', 'render_page'])
        .describe('执行的核心动作：create_masters 创建母版，render_page 渲染页面'),
      data: z.record(z.unknown())
        .describe('动作对应的具体数据。create_masters 需要 components 数组；render_page 需要 pageName 和 elements 数组')
    })).min(1).describe('需要按顺序执行的渲染任务列表')
  },
  async ({ tasks }) => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[🛠️ MCP Tool] render_penpot_ui 被调用');
    console.log('[🛠️ MCP Tool] 任务数量:', tasks.length);
    console.log('[🛠️ MCP Tool] 任务详情:', JSON.stringify(tasks, null, 2));
    console.log('═══════════════════════════════════════════════════════════');

    // 🔥 额外验证：检查每个任务的 data 结构
    for (const task of tasks) {
      if (task.action === 'create_masters') {
        const data = task.data as CreateMastersData;
        if (!data.components || !Array.isArray(data.components)) {
          return {
            content: [{
              type: 'text' as const,
              text: `❌ Schema 错误: create_masters 任务的 data 必须包含 components 数组\n\n` +
                    `收到的 data: ${JSON.stringify(task.data)}\n\n` +
                    `正确格式: { "components": [ { "type": "组件类型", ... } ] }`
            }]
          };
        }
      } else if (task.action === 'render_page') {
        const data = task.data as RenderPageData;
        if (!data.pageName || typeof data.pageName !== 'string') {
          return {
            content: [{
              type: 'text' as const,
              text: `❌ Schema 错误: render_page 任务的 data 必须包含 pageName 字符串\n\n` +
                    `收到的 data: ${JSON.stringify(task.data)}\n\n` +
                    `正确格式: { "pageName": "页面名称", "elements": [...] }`
            }]
          };
        }
        if (!data.elements || !Array.isArray(data.elements)) {
          return {
            content: [{
              type: 'text' as const,
              text: `❌ Schema 错误: render_page 任务的 data 必须包含 elements 数组\n\n` +
                    `收到的 data: ${JSON.stringify(task.data)}\n\n` +
                    `正确格式: { "pageName": "页面名称", "elements": [ { "type": "元素类型", ... } ] }`
            }]
          };
        }
      }
    }

    // 检查是否有活跃连接
    const connectionCount = wsManager.getConnectionCount();
    if (connectionCount === 0) {
      console.warn('[⚠️] 没有活跃的 Penpot 插件连接');
      return {
        content: [{
          type: 'text' as const,
          text: `{"status": "error", "message": "没有活跃的 Penpot 插件连接。请确保：\\n1. Penpot 插件已打开\\n2. 插件已连接到 WebSocket Server (ws://localhost:8080)\\n3. 连接状态显示为'🟢 已连接'", "suggestion": "请先在 Penpot 中打开插件并连接，然后重新调用此工具"}`
        }]
      };
    }

    // 广播渲染指令给所有连接的插件
    const successCount = wsManager.broadcast('render-tasks', tasks);
    console.log(`[📤] 渲染指令已发送给 ${successCount} 个客户端`);

    // ⭐ 核心改进：等待所有任务执行结果
    const taskResults: Array<{ taskId: string; success: boolean; message: string; error?: string }> = [];

    for (const task of tasks) {
      console.log(`[⏳] 等待任务 ${task.taskId} 执行结果...`);

      // 挂起等待前端反馈，超时 60 秒
      const result = await taskPromiseManager.waitForTask(task.taskId, 60000);
      taskResults.push({
        taskId: task.taskId,
        ...result
      });

      console.log(`[📨] 任务 ${task.taskId} 结果: ${result.success ? '成功' : '失败'}`);
    }

    // 统计成功/失败数量
    const successCount_result = taskResults.filter(r => r.success).length;
    const failCount = taskResults.filter(r => !r.success).length;

    console.log(`[📊] 执行统计: 成功 ${successCount_result}, 失败 ${failCount}`);

    // ⭐ 根据结果返回不同的响应
    if (failCount === 0) {
      // 全部成功
      return {
        content: [{
          type: 'text' as const,
          text: `{"status": "success", "message": "所有任务执行成功", "executed": ${tasks.length}, "details": ${JSON.stringify(taskResults.map(r => ({ taskId: r.taskId, status: "completed" })))}}`
        }]
      };
    } else if (successCount_result === 0) {
      // 全部失败
      const errorDetails = taskResults.map(r => `${r.taskId}: ${r.message}`).join('; ');
      return {
        content: [{
          type: 'text' as const,
          text: `{"status": "error", "message": "所有任务执行失败: ${errorDetails}", "suggestion": "请检查 JSON 格式，确保使用正确的组件类型，修正后重新调用此工具", "failedTasks": ${JSON.stringify(taskResults)}}`
        }]
      };
    } else {
      // 部分成功
      const failedTasks = taskResults.filter(r => !r.success);
      const errorDetails = failedTasks.map(r => `${r.taskId}: ${r.message}`).join('; ');
      return {
        content: [{
          type: 'text' as const,
          text: `{"status": "partial", "message": "部分任务执行失败: ${errorDetails}", "successCount": ${successCount_result}, "failCount": ${failCount}, "suggestion": "请根据错误信息修正失败的 tasks，然后重新调用此工具", "failedTasks": ${JSON.stringify(failedTasks)}}`
        }]
      };
    }
  }
);

/**
 * Tool: get_penpot_status
 * 获取当前连接状态
 */
server.tool(
  'get_penpot_status',
  '获取当前 Penpot 插件的连接状态和统计信息',
  {},
  async () => {
    const connectionCount = wsManager.getConnectionCount();

    return {
      content: [{
        type: 'text' as const,
        text: `📊 Penpot MCP Server 状态\n\n` +
              `🔌 WebSocket 连接数: ${connectionCount}\n` +
              `🌐 WebSocket 端口: 8080\n` +
              `${connectionCount > 0 ? '✅ 有活跃的插件连接' : '⚠️ 没有活跃连接'}\n\n` +
              `📦 组件库统计:\n` +
              `   • 总组件数: ${COMPONENT_DB.length}\n` +
              `   • 类别: ${[...new Set(COMPONENT_DB.map(c => c.category))].join(', ')}\n\n` +
              `💾 持久化状态:\n` +
              `   • 文件路径: ${DB_PATH}\n` +
              `   • 文件状态: ${fs.existsSync(DB_PATH) ? '✅ 已存在' : '❌ 不存在'}\n\n` +
              `💡 连接方式:\n` +
              `在 Penpot 插件中连接到: ws://localhost:8080`
      }]
    };
  }
);

/**
 * Tool: send_custom_message
 * 发送自定义消息给 Penpot 插件
 */
server.tool(
  'send_custom_message',
  '发送自定义 JSON 消息给所有连接的 Penpot 插件',
  {
    messageType: z.string().describe('消息类型'),
    payload: z.record(z.unknown()).describe('消息内容')
  },
  async ({ messageType, payload }) => {
    const connectionCount = wsManager.getConnectionCount();

    if (connectionCount === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `⚠️ 没有活跃的插件连接，消息无法发送`
        }]
      };
    }

    const successCount = wsManager.broadcast(messageType, payload);

    return {
      content: [{
        type: 'text' as const,
        text: `✅ 自定义消息已发送\n\n` +
              `📤 类型: ${messageType}\n` +
              `🎯 成功: ${successCount} 个客户端`
      }]
    };
  }
);

/**
 * Tool: sync_components
 * 手动同步组件库（供大模型调用）
 */
server.tool(
  'sync_components',
  `手动同步组件库到所有连接的 Penpot 插件。

【功能说明】
将当前的组件库广播给所有连接的插件，确保插件端拥有最新的组件定义。

【使用场景】
1. 组件库通过 WebSocket 更新后，需要通知所有插件
2. 多个插件连接时，需要保持组件库一致性`,
  {},
  async () => {
    const connectionCount = wsManager.getConnectionCount();

    if (connectionCount === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `⚠️ 没有活跃的插件连接，无法同步组件库`
        }]
      };
    }

    const successCount = wsManager.broadcast('component-db-update', {
      components: COMPONENT_DB,
      count: COMPONENT_DB.length
    });

    return {
      content: [{
        type: 'text' as const,
        text: `✅ 组件库同步完成\n\n` +
              `📤 发送目标: ${successCount} 个客户端\n` +
              `📊 组件数量: ${COMPONENT_DB.length}\n` +
              `📋 类别: ${[...new Set(COMPONENT_DB.map(c => c.category))].join(', ')}`
      }]
    };
  }
);

/**
 * Tool: export_components
 * 导出当前组件库为 JSON
 */
server.tool(
  'export_components',
  `导出当前组件库为 JSON 格式。

【功能说明】
返回当前组件库的完整 JSON 定义，可用于备份或分享。

【返回】
完整的组件库 JSON 数组`,
  {},
  async () => {
    return {
      content: [{
        type: 'text' as const,
        text: `📦 组件库导出\n\n` +
              `组件数量: ${COMPONENT_DB.length}\n` +
              `持久化路径: ${DB_PATH}\n\n` +
              `--- JSON 数据 ---\n\n` +
              JSON.stringify(COMPONENT_DB, null, 2)
      }]
    };
  }
);

/**
 * Tool: get_pending_requests
 * 获取待处理的自然语言分析请求
 */
server.tool(
  'get_pending_requests',
  `获取来自 Penpot 插件的待处理自然语言分析请求。

【功能说明】
当用户在插件中输入自然语言需求时，请求会被存储在队列中。
调用此工具可以获取所有待处理的请求。

【使用场景】
1. 用户在插件中输入"设计一个登录页面"
2. Agent 调用此工具获取待处理请求
3. Agent 分析需求并生成 UI JSON
4. Agent 调用 render_penpot_ui 发送渲染任务

【返回】
待处理的请求列表`,
  {},
  async () => {
    const requests = getPendingAgentRequests();

    if (requests.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `📭 当前没有待处理的请求\n\n` +
                `用户可以在 Penpot 插件的"手动输入"模式中输入自然语言需求，` +
                `然后点击"Agent 分析"按钮发送请求。`
        }]
      };
    }

    const requestList = requests.map((req, i) => {
      return `${i + 1}. **请求ID**: ${req.id}\n` +
             `   **类型**: ${req.requestType}\n` +
             `   **时间**: ${req.timestamp.toLocaleString()}\n` +
             `   **内容**: ${req.text}`;
    }).join('\n\n');

    return {
      content: [{
        type: 'text' as const,
        text: `📬 待处理请求 (${requests.length} 个)\n\n` +
              requestList +
              `\n\n💡 提示: 分析需求后，调用 render_penpot_ui 发送渲染任务。` +
              `\n⚠️ 注意: 渲染任务的 requestId 应与请求ID一致，以便插件匹配结果。`
      }]
    };
  }
);

/**
 * Tool: analyze_and_render
 * 一步完成：获取请求 -> 分析 -> 渲染
 */
server.tool(
  'analyze_and_render',
  `分析用户的自然语言需求并生成 UI 渲染任务。

【功能说明】
这是一个便捷工具，将获取待处理请求、分析需求、生成 UI 合并为一步。

【使用场景】
当有用户在插件中提交了自然语言需求时，直接调用此工具即可。

【输入参数】
- requestId: 可选，指定要处理的请求ID。如果不指定，将处理最早的请求。

【返回】
处理结果`,
  {
    requestId: z.string().optional().describe('可选，指定要处理的请求ID')
  },
  async ({ requestId }) => {
    const requests = getPendingAgentRequests();

    if (requests.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `📭 没有待处理的请求\n\n` +
                `请让用户在 Penpot 插件中输入需求并点击"Agent 分析"按钮。`
        }]
      };
    }

    // 获取要处理的请求
    const request = requestId
      ? requests.find(r => r.id === requestId)
      : requests[0];

    if (!request) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ 未找到请求: ${requestId}`
        }]
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: `📝 待分析请求\n\n` +
              `**请求ID**: ${request.id}\n` +
              `**需求内容**: ${request.text}\n\n` +
              `---\n\n` +
              `🤖 请根据上述需求，调用 render_penpot_ui 工具生成渲染任务。\n\n` +
              `💡 建议步骤:\n` +
              `1. 调用 search_components 了解可用组件\n` +
              `2. 调用 get_component_schema 获取组件约束\n` +
              `3. 调用 render_penpot_ui 发送渲染任务`
      }]
    };
  }
);

// =====================================================
// 🏁 启动服务
// =====================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 Penpot MCP Server 启动中...');
  console.log('═══════════════════════════════════════════════════════════');

  wsManager.start(8080);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log('[🚀] MCP Server 已启动 (stdio 传输)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📌 可用的 MCP Tools:');
  console.log('   • search_components - 搜索可用组件（渐进式披露）');
  console.log('   • get_component_schema - 获取组件详细约束');
  console.log('   • render_penpot_ui - 发送 UI JSON 到插件渲染（严格 Schema）');
  console.log('   • get_penpot_status - 获取连接状态');
  console.log('   • send_custom_message - 发送自定义消息');
  console.log('   • sync_components - 同步组件库到所有插件');
  console.log('   • export_components - 导出当前组件库');
  console.log('   • get_pending_requests - 获取待处理的自然语言分析请求');
  console.log('   • analyze_and_render - 分析需求并生成 UI');
  console.log('');
  console.log('📦 组件库:');
  console.log(`   总计 ${COMPONENT_DB.length} 个金融场景组件`);
  console.log(`   类别: ${[...new Set(COMPONENT_DB.map(c => c.category))].join(', ')}`);
  console.log(`   持久化路径: ${DB_PATH}`);
  console.log('');
  console.log('🔄 组件库动态同步协议 (WebSocket):');
  console.log('   • sync-components - 同步新组件库（热更新）');
  console.log('   • get-components - 获取当前组件库');
  console.log('   • reset-components - 重置为默认组件库');
  console.log('');
  console.log('📋 渐进式披露架构:');
  console.log('   1. 先调用 search_components 搜索组件大纲');
  console.log('   2. 再调用 get_component_schema 获取详细约束');
  console.log('   3. 最后调用 render_penpot_ui 执行渲染');
  console.log('');
  console.log('💡 使用方式:');
  console.log('   1. 在 Claude Desktop 或其他 MCP 客户端中配置此服务');
  console.log('   2. 在 Penpot 插件中连接到 ws://localhost:8080');
  console.log('   3. 按渐进式披露流程调用工具');
  console.log('═══════════════════════════════════════════════════════════');
}

process.on('SIGINT', () => {
  console.log('\n[🛑] 正在关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[🛑] 正在关闭服务器...');
  process.exit(0);
});

main().catch((error) => {
  console.error('[❌] 启动失败:', error);
  process.exit(1);
});
