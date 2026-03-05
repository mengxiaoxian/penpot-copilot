/**
 * UI 侧脚本 - 智能投研总控台
 * 负责大模型调用、任务解析、向导模式执行
 */

// ==================== 类型定义 ====================

interface WizardTask {
  taskName: string;
  action: 'create_masters' | 'render_page';
  data: {
    components?: UIElement[];
    pageName?: string;
    elements?: UIElement[];
  };
}

interface WizardConfig {
  tasks: WizardTask[];
}

interface UIElement {
  type: string;
  [key: string]: unknown;
}

interface APIConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

interface RoleConfig {
  id: string;
  name: string;
  systemPrompt: string;
}

// ==================== DOM 元素引用 ====================

const configToggle = document.getElementById('configToggle') as HTMLDivElement;
const configContent = document.getElementById('configContent') as HTMLDivElement;
const apiStatusDot = document.getElementById('apiStatusDot') as HTMLSpanElement;
const apiStatusText = document.getElementById('apiStatusText') as HTMLSpanElement;

const roleSelect = document.getElementById('roleSelect') as HTMLSelectElement;
const apiBaseUrl = document.getElementById('apiBaseUrl') as HTMLInputElement;
const apiKey = document.getElementById('apiKey') as HTMLInputElement;
const modelName = document.getElementById('modelName') as HTMLInputElement;
const saveApiBtn = document.getElementById('saveApiBtn') as HTMLButtonElement;

const promptInput = document.getElementById('promptInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const loadExampleLink = document.getElementById('loadExample') as HTMLElement;

const jsonToggle = document.getElementById('jsonToggle') as HTMLDivElement;
const jsonToggleIcon = document.getElementById('jsonToggleIcon') as HTMLSpanElement;
const jsonContent = document.getElementById('jsonContent') as HTMLDivElement;
const jsonInput = document.getElementById('json-input') as HTMLTextAreaElement;
const parseBtn = document.getElementById('parse-btn') as HTMLButtonElement;

const taskList = document.getElementById('task-list') as HTMLDivElement;
const taskHint = document.getElementById('task-hint') as HTMLParagraphElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// ==================== 角色配置 ====================

const ROLES: Record<string, RoleConfig> = {
  architect: {
    id: 'architect',
    name: '后台架构师',
    systemPrompt: `你是一位经验丰富的 B 端中后台系统架构师。你的核心任务是将用户提供的【业务需求】转化为直接用于 Penpot 插件渲染的【结构化 JSON 数据】。

【业务设计原则】
1. B 端管理后台重效率与表单录入
2. 页面结构通常为：顶部大标题 -> 密集的参数输入框 -> 底部保存按钮

【极其严格的 JSON 规范】
你输出的必须是纯 JSON 格式（不要带 \`\`\`json 等 Markdown 标记）。
数据结构必须是：
{
  "pages": [
    {
      "pageName": "页面名称",
      "elements": [ /* 组件列表 */ ]
    }
  ]
}

【当前引擎支持的组件类型】
- 基础: {"type": "Title", "text": "标题"}, {"type": "Text", "content": "文本"}, {"type": "Divider"}
- 表单: {"type": "Input", "label": "字段名", "placeholder": "提示"}, {"type": "Button", "text": "按钮"}
- 金融卡片: {"type": "AssetHeader", "userName": "用户", "totalAssets": "10000", "incomeToday": "+10", "incomeTotal": "+100"}
- 基金卡片: {"type": "FundCard", "fundName": "基金名", "holdingAmount": "1000", "incomeToday": "+10", "incomeRate": "+1%"}

【你的执行动作】
阅读用户需求，直接输出合法的 JSON 字符串，不输出任何其他解释性文字。`
  },
  designer: {
    id: 'designer',
    name: 'UI 设计师',
    systemPrompt: `你是一位专业的 UI 设计师。你的任务是将用户需求转化为美观的移动端 UI 原型 JSON。

【设计原则】
1. 移动端优先，注重用户体验
2. 层次分明，重点突出
3. 合理使用金融卡片组件

【JSON 格式要求】
输出纯 JSON，不要带 Markdown 标记：
{
  "pages": [{ "pageName": "页面名", "elements": [...] }]
}

【支持的组件】
Title, Text, Divider, Input, Button, AssetHeader, FundCard

直接输出 JSON，不要解释。`
  },
  pm: {
    id: 'pm',
    name: '金融产品经理',
    systemPrompt: `你是一位资深的金融产品经理。你的任务是将金融业务需求转化为 UI 原型 JSON。

【金融设计原则】
1. 突出核心数据（收益率、总资产）
2. 红涨绿跌：收益为正用红色，收益为负用绿色
3. 金额输入场景需要键盘组件

【JSON 格式】
输出纯 JSON：
{
  "pages": [{ "pageName": "页面名", "elements": [...] }]
}

【支持的金融组件】
- AssetHeader: 个人资产头部
- FundCard: 基金持仓卡片
- ProductCard: 理财产品卡片

直接输出 JSON。`
  }
};

// ==================== 存储键 ====================

const STORAGE_KEY_API = 'penpot-wizard-api-config';

// ==================== 示例数据 ====================

const examplePrompt = `设计一个基金交易页面，要求：
1. 顶部展示用户资产信息（总资产、昨日收益、累计收益）
2. 中间是基金信息卡片（基金名称、持有金额、收益率）
3. 底部有买入金额输入框、交易密码输入框
4. 最下面是确认买入按钮`;

const exampleJson: WizardConfig = {
  tasks: [
    {
      taskName: "🧩 初始化资产库母版",
      action: "create_masters",
      data: {
        components: [
          { type: "AssetHeader", userName: "张三", totalAssets: "123,456.78", incomeToday: "+123.45", incomeTotal: "+12,345.67" },
          { type: "FundCard", fundName: "示例基金", holdingAmount: "10,000", incomeToday: "+100", incomeRate: "+1.23%" }
        ]
      }
    },
    {
      taskName: "📱 渲染页面：基金交易",
      action: "render_page",
      data: {
        pageName: "基金交易",
        elements: [
          { type: "AssetHeader", userName: "用户昵称", totalAssets: "999,999.99", incomeToday: "+888.88", incomeTotal: "+99,999.99" },
          { type: "Divider" },
          { type: "FundCard", fundName: "沪深300指数基金", holdingAmount: "50,000.00", incomeToday: "+250.00", incomeRate: "+0.5%" },
          { type: "Input", label: "买入金额", placeholder: "请输入买入金额" },
          { type: "Input", label: "交易密码", placeholder: "请输入6位数字密码" },
          { type: "Button", text: "确认买入" }
        ]
      }
    }
  ]
};

// ==================== 工具函数 ====================

function showStatus(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;

  if (type !== 'info') {
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 8000);
  }
}

function sendMessageToPlugin(message: unknown): void {
  parent.postMessage(message, '*');
}

// ==================== 配置管理 ====================

function loadAPIConfig(): APIConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_API);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('加载 API 配置失败:', e);
  }
  return { baseUrl: '', apiKey: '', modelName: '' };
}

function saveAPIConfig(config: APIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_API, JSON.stringify(config));
    updateAPIStatus(config);
    showStatus('API 配置已保存', 'success');
  } catch (e) {
    console.error('保存 API 配置失败:', e);
  }
}

function isAPIConfigured(config: APIConfig): boolean {
  return !!(config.baseUrl && config.apiKey && config.modelName);
}

function updateAPIStatus(config: APIConfig): void {
  if (isAPIConfigured(config)) {
    apiStatusDot.classList.add('configured');
    apiStatusText.textContent = config.modelName;
  } else {
    apiStatusDot.classList.remove('configured');
    apiStatusText.textContent = '未配置';
  }
}

function renderAPIConfig(): void {
  const config = loadAPIConfig();
  apiBaseUrl.value = config.baseUrl;
  apiKey.value = config.apiKey;
  modelName.value = config.modelName;
  updateAPIStatus(config);
}

// ==================== 大模型调用 ====================

async function callLLM(userPrompt: string, systemPrompt: string, config: APIConfig): Promise<string> {
  const url = `${config.baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('API 返回数据格式异常');
  }

  return data.choices[0].message.content as string;
}

/**
 * 清洗 LLM 返回的 JSON 字符串
 */
function cleanJSONString(raw: string): string {
  let cleanText = raw;

  // 剔除 <think\> 标签
  cleanText = cleanText.replace(/<think\>[\s\S]*?<\/think\>/g, '');

  // 剔除 Markdown 代码块标记
  cleanText = cleanText.replace(/```json\n?/gi, '');
  cleanText = cleanText.replace(/```\n?/g, '');
  cleanText = cleanText.trim();

  // 精准截取 JSON
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  return cleanText;
}

/**
 * 将 LLM 返回的 pages 格式转换为向导任务格式
 */
function convertPagesToWizardTasks(pages: { pageName: string; elements: UIElement[] }[]): WizardConfig {
  const tasks: WizardTask[] = [];

  // 收集所有需要的复杂组件类型
  const complexTypes = new Set<string>();
  const COMPLEX_COMPONENT_TYPES = ['AssetHeader', 'FundCard', 'ProductCard', 'IconGrid'];

  for (const page of pages) {
    for (const element of page.elements) {
      if (COMPLEX_COMPONENT_TYPES.includes(element.type) || !['Title', 'Input', 'Button', 'Text', 'Divider', 'Keyboard'].includes(element.type)) {
        complexTypes.add(element.type);
      }
    }
  }

  // 任务 1：生成母版
  if (complexTypes.size > 0) {
    const components = Array.from(complexTypes).map(type => {
      // 为每种类型创建一个示例数据
      const sampleData: UIElement = { type };
      if (type === 'AssetHeader') {
        sampleData.userName = '用户';
        sampleData.totalAssets = '0.00';
        sampleData.incomeToday = '+0.00';
        sampleData.incomeTotal = '+0.00';
      } else if (type === 'FundCard') {
        sampleData.fundName = '基金名称';
        sampleData.holdingAmount = '0.00';
        sampleData.incomeToday = '+0.00';
        sampleData.incomeRate = '+0.00%';
      }
      return sampleData;
    });

    tasks.push({
      taskName: `🧩 初始化母版 (${components.length}个组件)`,
      action: 'create_masters',
      data: { components }
    });
  }

  // 任务 2-N：渲染页面
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    tasks.push({
      taskName: `📱 渲染页面：${page.pageName || `页面 ${i + 1}`}`,
      action: 'render_page',
      data: {
        pageName: page.pageName || `页面 ${i + 1}`,
        elements: page.elements
      }
    });
  }

  return { tasks };
}

// ==================== 核心逻辑 ====================

let parsedTasks: WizardTask[] = [];

/**
 * 呼叫 AI 生成方案
 */
async function handleGenerateFromAI(): Promise<void> {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showStatus('请输入业务需求描述', 'error');
    return;
  }

  const apiConfig = loadAPIConfig();
  if (!isAPIConfigured(apiConfig)) {
    showStatus('请先配置 API（点击展开 AI 配置）', 'error');
    configContent.classList.add('open');
    return;
  }

  const role = ROLES[roleSelect.value] || ROLES.architect;

  generateBtn.disabled = true;
  generateBtn.textContent = '⏳ AI 思考中...';
  showStatus(`正在调用 ${apiConfig.modelName} 生成方案...`, 'info');

  console.log('═══════════════════════════════════════════');
  console.log('【AI 生成模式】');
  console.log('【角色】:', role.name);
  console.log('【需求】:', prompt);
  console.log('═══════════════════════════════════════════');

  try {
    // 调用大模型
    const rawResponse = await callLLM(prompt, role.systemPrompt, apiConfig);
    console.log('【LLM 原始返回】:\n', rawResponse);

    // 清洗 JSON
    const cleanedResponse = cleanJSONString(rawResponse);
    console.log('【清洗后 JSON】:\n', cleanedResponse);

    // 解析 JSON
    let jsonData;
    try {
      jsonData = JSON.parse(cleanedResponse);
    } catch {
      showStatus('AI 生成的 JSON 格式有误，请重试', 'error');
      generateBtn.disabled = false;
      generateBtn.textContent = '🚀 呼叫 AI 生成方案';
      return;
    }

    if (!jsonData.pages || !Array.isArray(jsonData.pages)) {
      showStatus('AI 生成的 JSON 缺少 pages 数组', 'error');
      generateBtn.disabled = false;
      generateBtn.textContent = '🚀 呼叫 AI 生成方案';
      return;
    }

    // 🔑 关键缝合：转换为向导任务格式
    const wizardConfig = convertPagesToWizardTasks(jsonData.pages);
    parsedTasks = wizardConfig.tasks;

    console.log('【向导任务】:', parsedTasks);

    // 渲染任务列表
    renderTaskList();

    showStatus(`✓ AI 生成成功！共 ${parsedTasks.length} 个任务，请依次执行`, 'success');
    generateBtn.disabled = false;
    generateBtn.textContent = '🚀 呼叫 AI 生成方案';

  } catch (error) {
    console.error('LLM 调用失败:', error);
    showStatus(`调用失败: ${(error as Error).message}`, 'error');
    generateBtn.disabled = false;
    generateBtn.textContent = '🚀 呼叫 AI 生成方案';
  }
}

/**
 * 解析 JSON 并生成任务按钮
 */
function parseAndRenderTasks(): void {
  const inputValue = jsonInput.value.trim();

  if (!inputValue) {
    showStatus('请输入向导模式 JSON', 'error');
    return;
  }

  let config: WizardConfig;

  try {
    config = JSON.parse(inputValue);
  } catch {
    showStatus('JSON 解析失败，请检查格式', 'error');
    return;
  }

  if (!config.tasks || !Array.isArray(config.tasks)) {
    showStatus('JSON 格式错误：需要包含 tasks 数组', 'error');
    return;
  }

  parsedTasks = config.tasks;
  renderTaskList();
  showStatus(`解析成功！共 ${parsedTasks.length} 个任务`, 'success');
}

/**
 * 渲染任务列表 UI
 */
function renderTaskList(): void {
  if (parsedTasks.length === 0) {
    taskList.innerHTML = '';
    taskHint.style.display = 'block';
    return;
  }

  taskList.innerHTML = '';
  taskHint.style.display = 'none';

  parsedTasks.forEach((task, index) => {
    const btn = document.createElement('button');
    btn.className = 'task-button';
    btn.id = `task-${index}`;

    btn.innerHTML = `
      <div class="task-info">
        <span class="task-icon">${task.action === 'create_masters' ? '🧩' : '📱'}</span>
        <span>${task.taskName}</span>
      </div>
      <span class="task-status-badge">待执行</span>
    `;

    btn.onclick = () => executeTask(task, btn, index);
    taskList.appendChild(btn);
  });
}

/**
 * 执行单个任务
 */
function executeTask(task: WizardTask, btn: HTMLButtonElement, index: number): void {
  console.log(`[任务路由] 开始执行任务 #${index + 1}: ${task.taskName}`);

  btn.classList.remove('executed', 'error');
  btn.classList.add('executing');
  const badge = btn.querySelector('.task-status-badge') as HTMLSpanElement;
  badge.textContent = '执行中...';

  sendMessageToPlugin({
    type: 'execute-task',
    action: task.action,
    taskData: task.data,
    taskId: `task-${index}`
  });
}

/**
 * 更新任务按钮状态
 */
function updateTaskStatus(taskId: string, status: 'complete' | 'error' | 'layout-error', errorMsg?: string): void {
  const btn = document.getElementById(taskId) as HTMLButtonElement;
  if (!btn) return;

  btn.classList.remove('executing');

  const badge = btn.querySelector('.task-status-badge') as HTMLSpanElement;

  if (status === 'complete') {
    btn.classList.add('executed');
    badge.textContent = '已完成';
    showStatus(`✓ 任务执行完成`, 'success');
  } else if (status === 'layout-error') {
    btn.classList.add('error');
    badge.textContent = '布局异常';
    showStatus(`⚠️ ${errorMsg || '布局空间不足（可能文案过长），已自动拦截，请调整数据后重试'}`, 'warning');
  } else {
    btn.classList.add('error');
    badge.textContent = '失败';
    showStatus(`✗ 任务执行失败: ${errorMsg || '未知错误'}`, 'error');
  }
}

// ==================== 监听来自插件的消息 ====================

window.addEventListener('message', (event) => {
  const message = event.data;

  if (!message || !message.type) return;

  if (message.type === 'task-complete') {
    updateTaskStatus(message.taskId, 'complete');
    // 同步发送完成状态到 MCP Server
    sendToMCPServer({
      type: 'task-complete',
      taskId: message.taskId
    });
  } else if (message.type === 'task-error') {
    updateTaskStatus(message.taskId, 'error', message.error);
    sendToMCPServer({
      type: 'task-error',
      taskId: message.taskId,
      message: message.error
    });
  } else if (message.type === 'layout-error') {
    // 🔥 布局异常：自动拦截
    updateTaskStatus(message.taskId, 'layout-error', message.error);
    sendToMCPServer({
      type: 'layout-error',
      taskId: message.taskId,
      message: message.error
    });
  }
});

// ==================== WebSocket 客户端（连接 MCP Server）====================

let wsClient: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
const WS_URL = 'wss://localhost:8080';

/**
 * 连接到 MCP Server
 */
function connectToMCPServer(): void {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    console.log('[WS] 已连接到 MCP Server');
    return;
  }

  console.log('[WS] 正在连接到 MCP Server:', WS_URL);

  try {
    wsClient = new WebSocket(WS_URL);

    wsClient.onopen = () => {
      console.log('[WS] ✅ 已连接到 MCP Server');
      updateWSStatus(true);
    };

    wsClient.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMCPMessage(message);
      } catch (error) {
        console.error('[WS] 解析消息失败:', error);
      }
    };

    wsClient.onclose = () => {
      console.log('[WS] 连接已关闭');
      updateWSStatus(false);
      scheduleReconnect();
    };

    wsClient.onerror = (error) => {
      console.error('[WS] 连接错误:', error);
      updateWSStatus(false);
    };
  } catch (error) {
    console.error('[WS] 创建连接失败:', error);
    scheduleReconnect();
  }
}

/**
 * 定时重连
 */
function scheduleReconnect(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
  }
  wsReconnectTimer = setTimeout(() => {
    console.log('[WS] 尝试重新连接...');
    connectToMCPServer();
  }, 5000);
}

/**
 * 发送消息到 MCP Server
 */
function sendToMCPServer(message: unknown): void {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(message));
  }
}

/**
 * 处理来自 MCP Server 的消息
 */
function handleMCPMessage(message: { type: string; payload?: unknown }): void {
  console.log('[WS] 收到 MCP 消息:', message);

  switch (message.type) {
    case 'connected':
      console.log('[WS] MCP Server 确认连接');
      break;

    case 'render-tasks':
      // 🔥 核心：接收大模型生成的渲染任务
      console.log('[WS] 收到渲染指令，开始处理...');
      handleRenderTasksFromMCP(message.payload as WizardTask[]);
      break;

    default:
      console.log('[WS] 未知消息类型:', message.type);
  }
}

/**
 * 处理来自 MCP Server 的渲染任务
 */
function handleRenderTasksFromMCP(tasks: WizardTask[]): void {
  console.log('[WS] 渲染任务数量:', tasks.length);

  // 更新任务列表
  parsedTasks = tasks;
  renderTaskList();

  showStatus(`📥 收到来自大模型的渲染指令！共 ${tasks.length} 个任务`, 'success');

  // 自动执行第一个任务
  if (tasks.length > 0) {
    setTimeout(() => {
      const firstBtn = document.getElementById('task-0') as HTMLButtonElement;
      if (firstBtn) {
        firstBtn.click();
      }
    }, 500);
  }
}

/**
 * 更新 WebSocket 连接状态显示
 */
function updateWSStatus(connected: boolean): void {
  // 更新 API 状态区域显示 WebSocket 状态
  const wsStatusText = document.getElementById('wsStatusText');
  const wsStatusDot = document.getElementById('wsStatusDot');

  if (wsStatusText && wsStatusDot) {
    if (connected) {
      wsStatusDot.classList.add('configured');
      wsStatusText.textContent = '已连接';
    } else {
      wsStatusDot.classList.remove('configured');
      wsStatusText.textContent = '未连接';
    }
  }
}

// ==================== 初始化 ====================

function init(): void {
  // 加载 API 配置
  renderAPIConfig();

  // 🔌 初始化 WebSocket 连接到 MCP Server
  connectToMCPServer();

  // 配置区折叠
  configToggle.addEventListener('click', () => {
    configContent.classList.toggle('open');
  });

  // JSON 区折叠
  jsonToggle.addEventListener('click', () => {
    jsonContent.classList.toggle('open');
    jsonToggleIcon.classList.toggle('open');
  });

  // 保存 API 配置
  saveApiBtn.addEventListener('click', () => {
    const config: APIConfig = {
      baseUrl: apiBaseUrl.value.trim().replace(/\/$/, ''),
      apiKey: apiKey.value.trim(),
      modelName: modelName.value.trim()
    };
    if (!config.baseUrl || !config.apiKey || !config.modelName) {
      showStatus('请填写完整的 API 配置', 'error');
      return;
    }
    saveAPIConfig(config);
  });

  // AI 生成按钮
  generateBtn.addEventListener('click', handleGenerateFromAI);

  // JSON 解析按钮
  parseBtn.addEventListener('click', parseAndRenderTasks);

  // 加载示例
  loadExampleLink.addEventListener('click', () => {
    promptInput.value = examplePrompt;
    showStatus('示例需求已加载', 'info');
  });

  // 快捷键
  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerateFromAI();
    }
  });

  console.log('[向导模式] 智能投研总控台已初始化');
}

init();
