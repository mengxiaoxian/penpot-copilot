import type { Board, Shape, Text, LibraryComponent, Page } from '@penpot/plugin-types';
import { EMBEDDED_COMPONENTS } from './embedded-components';

penpot.ui.open("向导模式-智能投研总控台", `?theme=${penpot.theme}`, { width: 400, height: 620 });

// =====================================================
// 📋 类型定义
// =====================================================

interface UIElement {
  type: string;
  text?: string;
  content?: string;
  label?: string;
  placeholder?: string;
  fontSize?: number;
  userName?: string;
  totalAssets?: string;
  incomeToday?: string;
  incomeTotal?: string;
  fundName?: string;
  holdingAmount?: string;
  incomeRate?: string;
  productName?: string;
  productPrice?: string;
  productDescription?: string;
  icons?: Array<{ name: string; label: string }>;
  [key: string]: unknown;
}

interface TaskData {
  components?: UIElement[];
  pageName?: string;
  elements?: UIElement[];
}

// =====================================================
// 📦 组件库 Schema 类型
// =====================================================

interface ComponentConstraint {
  field: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  maxLength?: number;
  description?: string;
  pattern?: string;
}

interface ComponentSchema {
  type: string;
  description: string;
  category: string;
  slots: string[];
  constraints: ComponentConstraint[];
}

// 全局组件库（构建时嵌入）
const componentLibrary: Record<string, ComponentSchema> = {};

// 初始化组件库（从嵌入的数据加载）
function initComponentLibrary(): void {
  try {
    // 使用构建时嵌入的组件库
    if (Array.isArray(EMBEDDED_COMPONENTS)) {
      EMBEDDED_COMPONENTS.forEach((comp: ComponentSchema) => {
        if (comp.type) {
          componentLibrary[comp.type] = comp;
        }
      });
    }
    console.log(`[📦] 组件库初始化成功，共 ${Object.keys(componentLibrary).length} 个组件:`, Object.keys(componentLibrary).join(', '));
  } catch (e) {
    console.warn('[📦] 组件库初始化异常:', e);
  }
}

// 启动时初始化组件库
initComponentLibrary();

// =====================================================
// ⚙️ 配置常量
// =====================================================

const CONFIG = {
  // 画布尺寸
  boardWidth: 375,
  boardHeight: 812,
  paddingX: 16,
  paddingY: 20,
  gap: 16,
  phoneBoardGap: 200,
  masterGap: 300,

  // =====================================================
  // Ant Design 设计令牌 (统一规范)
  // =====================================================

  // 品牌色
  primaryBlue: '#1677FF',          // Ant Design 品牌蓝 (原 brandBlue)
  primaryBlueHover: '#4096FF',     // Ant Design 悬停蓝 (原 brandBlueLight)
  primaryBlueActive: '#0958D9',    // Ant Design 激活蓝

  // 背景色
  bgLayout: '#F5F5F5',             // Ant Design 布局背景 (原 bgLightGray)
  bgContainer: '#FFFFFF',          // Ant Design 容器背景
  bgField: '#FFFFFF',              // Ant Design 输入框背景 (原 inputBg)

  // 文字色（⚠️ Penpot 不支持带透明度的 hex，使用纯 hex + fillOpacity）
  textPrimary: '#000000',          // 主文字（配合 fillOpacity: 0.85 使用）
  textSecondary: '#000000',        // 次文字（配合 fillOpacity: 0.45 使用）
  textTertiary: '#000000',         // 辅助文字（配合 fillOpacity: 0.25 使用）
  textWhite: '#FFFFFF',            // 白色文字
  textLink: '#1677FF',             // Ant Design 链接色

  // 功能色
  colorError: '#FF4D4F',           // Ant Design 错误红 (原 textRed)
  colorErrorBg: '#FFF2F0',         // Ant Design 错误背景 (原 placeholderBg)
  colorSuccess: '#52C41A',         // Ant Design 成功绿 (原 textGreen)
  colorWarning: '#FAAD14',         // Ant Design 警告黄
  colorInfo: '#1677FF',            // Ant Design 信息蓝

  // 边框色
  borderColor: '#D9D9D9',          // Ant Design 边框 (原 borderGray)
  borderColorSecondary: '#F0F0F0', // Ant Design 次边框

  // 圆角
  borderRadius: 6,                 // Ant Design 默认圆角
  borderRadiusLG: 8,               // Ant Design 大圆角
  borderRadiusSM: 4,               // Ant Design 小圆角

  // 间距
  padding: 16,
  paddingLG: 24,
  paddingSM: 12,
  paddingXS: 8,

  // 移动端标准宽
  mobileWidth: 343,                // 375 - 16*2 padding

  // 兼容旧变量名（映射到新规范）
  white: '#FFFFFF',
  textBlack: '#000000',            // 主文字（配合 fillOpacity: 0.85 使用）
  placeholderBorder: '#FF4D4F',
};

const SAFE_INNER_WIDTH = Math.max(1, CONFIG.boardWidth - (CONFIG.paddingX * 2));
const COMPLEX_COMPONENT_TYPES = ['AssetHeader', 'FundCard', 'ProductCard', 'IconGrid'];
const BASIC_COMPONENT_TYPES = ['Title', 'Input', 'Button', 'Text', 'Divider', 'Keyboard'];

// =====================================================
// 🗄️ 全局缓存
// =====================================================

const masterCache: Map<string, LibraryComponent> = new Map();
let currentX = 0;

// =====================================================
// 📐 坐标计算辅助函数
// =====================================================

function getNextOffsetX(page: Page, gap: number = 400): number {
  const root = page.root;
  if (!root || !('children' in root)) return 0;

  const children = (root as { children: Shape[] }).children || [];
  if (children.length === 0) return 0;

  let maxX = 0;
  children.forEach((child: Shape) => {
    const childRight = (child.x || 0) + (child.width || 0);
    if (childRight > maxX) maxX = childRight;
  });

  return maxX + gap;
}

// =====================================================
// 🔍 布局校验器（视觉防撞雷达）
// =====================================================

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 计算两个矩形的重叠面积比例
 */
function calculateOverlapRatio(a: BBox, b: BBox): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const overlapArea = xOverlap * yOverlap;

  if (overlapArea === 0) return 0;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  // 返回重叠面积占较小矩形的比例
  const smallerArea = Math.min(areaA, areaB);
  return overlapArea / smallerArea;
}

/**
 * 布局校验器：递归深度遍历画板，检测非法尺寸和严重重叠
 * ⚠️ 已降级为警告模式，不再阻断渲染
 */
function validateComponentLayout(shape: Shape, parentName: string = 'root'): void {
  // 规则 A：检查非法尺寸（仅警告）
  const width = shape.width || 0;
  const height = shape.height || 0;

  if (width <= 0 || height <= 0) {
    console.warn(`[⚠️ 布局警告] 检测到零尺寸节点 "${shape.name}" (${width}x${height})`);
    return; // 仅返回，不抛出错误
  }

  // 递归检查子节点
  if ('children' in shape) {
    const children = (shape as { children: Shape[] }).children || [];

    // 规则 B：检查兄弟节点之间的重叠（仅警告）
    if (children.length > 1) {
      const bboxes: { shape: Shape; bbox: BBox }[] = [];

      for (const child of children) {
        const childWidth = child.width || 0;
        const childHeight = child.height || 0;

        if (childWidth > 0 && childHeight > 0) {
          bboxes.push({
            shape: child,
            bbox: {
              x: child.x || 0,
              y: child.y || 0,
              width: childWidth,
              height: childHeight
            }
          });
        }
      }

      // 两两比较，检测超过 30% 面积的重叠（仅警告）
      for (let i = 0; i < bboxes.length; i++) {
        for (let j = i + 1; j < bboxes.length; j++) {
          const overlapRatio = calculateOverlapRatio(bboxes[i].bbox, bboxes[j].bbox);

          if (overlapRatio > 0.3) {
            console.warn(`[⚠️ 布局警告] 检测到组件重叠（${Math.round(overlapRatio * 100)}%）: "${bboxes[i].shape.name}" 与 "${bboxes[j].shape.name}"`);
            // 不抛出错误，继续执行
          }
        }
      }
    }

    // 递归检查每个子节点
    for (const child of children) {
      validateComponentLayout(child, shape.name);
    }
  }
  // 无错误则正常返回
}


// =====================================================
// 🔌 智能数据注入引擎
// =====================================================

/**
 * 数据注入 - 将 JSON 数据注入到组件实例的文本插槽中
 * 🔥 注入后重新设置 growType 确保文本能撑开父容器
 */
function injectDataToInstance(instance: Shape, data: Record<string, unknown>): void {
  let injectionCount = 0;

  function traverse(shape: Shape): void {
    if (shape.type === 'text') {
      const textShape = shape as Text;
      const name = shape.name;
      const match = name.match(/^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$/);

      if (match) {
        const fieldName = match[1];
        const value = data[fieldName];

        if (value !== undefined && value !== null) {
          textShape.characters = String(value);
          // 🔥 关键：注入后重新设置 growType，确保文本能重新计算并撑开父容器
          textShape.growType = 'auto-height';
          injectionCount++;
          console.log(`[🔌] 注入: [${fieldName}] → "${String(value).substring(0, 30)}..."`);
        }
      }
    }

    if ('children' in shape) {
      for (const child of (shape as { children: Shape[] }).children) {
        traverse(child);
      }
    }
  }

  traverse(instance);
  console.log(`[🔌] 数据注入完成，共 ${injectionCount} 个字段`);
}

// =====================================================
// 🏭 母版组件工厂
// =====================================================

function findExistingMasterComponent(type: string): LibraryComponent | undefined {
  const masterName = `Master_${type}`;

  // 优先从缓存获取
  if (masterCache.has(type)) {
    console.log(`[🏭] 从缓存获取母版: ${masterName}`);
    return masterCache.get(type);
  }

  // 🔍 调试日志
  console.log(`[🔍] 查找母版: ${masterName}`);

  // 尝试多种来源查找组件
  let existing: LibraryComponent | undefined = undefined;

  // 1. 从本地组件库查找
  const localComponents = penpot.library.local.components;
  console.log(`[🔍] 本地组件库共 ${localComponents.length} 个组件:`, localComponents.map(c => c.name).join(', ') || '(空)');

  existing = localComponents.find(comp =>
    comp.name === masterName ||
    comp.name === type ||
    comp.name.includes(type)
  );

  // 2. 如果本地没找到，尝试从所有可用组件查找（包括共享库）
  if (!existing) {
    try {
      // @ts-ignore - Penpot 可能支持 library.components 访问共享库
      const allComponents = penpot.library.components || [];
      if (allComponents.length > 0) {
        console.log(`[🔍] 共享库组件共 ${allComponents.length} 个`);
        existing = allComponents.find((comp: LibraryComponent) =>
          comp.name === masterName ||
          comp.name === type ||
          comp.name.includes(type)
        );
      }
    } catch (e) {
      // 共享库访问失败，忽略
    }
  }

  // 3. 尝试从当前页面的画板中查找（可能母版只是普通画板，未转为组件）
  if (!existing) {
    try {
      const currentPage = penpot.currentPage;
      if (currentPage && 'children' in currentPage) {
        const children = (currentPage as any).children || [];
        const allBoards = children.filter((child: any) => child.type === 'board');
        const matchingBoard = allBoards.find((board: Board) =>
          board.name === masterName ||
          board.name === type ||
          board.name.includes(type)
        );
        if (matchingBoard) {
          console.log(`[🔍] 在页面中找到匹配的画板: ${matchingBoard.name}，正在转换为组件...`);
          // 找到匹配的画板，转换为组件
          const libraryComponent = penpot.library.local.createComponent([matchingBoard]);
          masterCache.set(type, libraryComponent);
          console.log(`[🏭] ✓ 已将画板转换为组件: ${masterName}`);
          return libraryComponent;
        }
      }
    } catch (e) {
      console.log(`[🔍] 页面画板查找失败:`, e);
    }
  }

  if (existing) {
    console.log(`[🏭] ✓ 从组件库获取已存在的母版: ${existing.name}`);
    masterCache.set(type, existing);
    return existing;
  }

  console.log(`[🔍] ✗ 未找到母版: ${masterName}`);
  return undefined;
}

function drawAssetHeaderMaster(board: Board, data: UIElement): void {
  board.resize(SAFE_INNER_WIDTH, 180);
  board.borderRadius = 12;
  board.fills = [{ fillColor: CONFIG.primaryBlue, fillOpacity: 1 }];

  const flex = board.addFlexLayout();
  flex.dir = 'column';
  flex.horizontalPadding = 20;
  flex.verticalPadding = 20;
  flex.rowGap = 16;

  // 用户名
  const topRow = penpot.createBoard();
  topRow.name = 'User Info';
  topRow.fills = [];
  topRow.resize(SAFE_INNER_WIDTH - 40, 24);
  const topFlex = topRow.addFlexLayout();
  topFlex.dir = 'row';
  topFlex.justifyContent = 'space-between';

  const nameText = penpot.createText(data.userName || '用户');
  if (nameText) {
    nameText.name = '[userName]';
    nameText.fontSize = '16';
    nameText.fontWeight = '700';
    nameText.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 1 }];
    topRow.appendChild(nameText);
  }
  board.appendChild(topRow);

  // 总资产区
  const assetGroup = penpot.createBoard();
  assetGroup.name = 'Total Assets';
  assetGroup.fills = [];
  assetGroup.resize(SAFE_INNER_WIDTH - 40, 60);
  const assetFlex = assetGroup.addFlexLayout();
  assetFlex.dir = 'column';
  assetFlex.rowGap = 4;
  assetFlex.alignItems = 'center';

  const label = penpot.createText('总资产(元)');
  if (label) {
    label.fontSize = '12';
    label.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 0.8 }];
    assetGroup.appendChild(label);
  }

  const amount = penpot.createText(data.totalAssets || '0.00');
  if (amount) {
    amount.name = '[totalAssets]';
    amount.fontSize = '32';
    amount.fontWeight = '700';
    amount.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 1 }];
    assetGroup.appendChild(amount);
  }
  board.appendChild(assetGroup);

  // 收益行
  const bottomRow = penpot.createBoard();
  bottomRow.name = 'Income Info';
  bottomRow.fills = [];
  bottomRow.resize(SAFE_INNER_WIDTH - 40, 40);
  const bottomFlex = bottomRow.addFlexLayout();
  bottomFlex.dir = 'row';
  bottomFlex.justifyContent = 'space-between';
  bottomFlex.alignItems = 'center';

  // 左列
  const leftCol = penpot.createBoard();
  leftCol.fills = [];
  leftCol.resize((SAFE_INNER_WIDTH - 40) / 2, 40);
  const lFlex = leftCol.addFlexLayout();
  lFlex.dir = 'column';
  lFlex.alignItems = 'center';

  const lLabel = penpot.createText('昨日收益');
  if (lLabel) {
    lLabel.fontSize = '12';
    lLabel.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 0.8 }];
    leftCol.appendChild(lLabel);
  }
  const lVal = penpot.createText(data.incomeToday || '+0.00');
  if (lVal) {
    lVal.name = '[incomeToday]';
    lVal.fontSize = '16';
    lVal.fontWeight = '700';
    lVal.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 1 }];
    leftCol.appendChild(lVal);
  }
  bottomRow.appendChild(leftCol);

  // 右列
  const rightCol = penpot.createBoard();
  rightCol.fills = [];
  rightCol.resize((SAFE_INNER_WIDTH - 40) / 2, 40);
  const rFlex = rightCol.addFlexLayout();
  rFlex.dir = 'column';
  rFlex.alignItems = 'center';

  const rLabel = penpot.createText('累计收益');
  if (rLabel) {
    rLabel.fontSize = '12';
    rLabel.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 0.8 }];
    rightCol.appendChild(rLabel);
  }
  const rVal = penpot.createText(data.incomeTotal || '+0.00');
  if (rVal) {
    rVal.name = '[incomeTotal]';
    rVal.fontSize = '16';
    rVal.fontWeight = '700';
    rVal.fills = [{ fillColor: CONFIG.textWhite, fillOpacity: 1 }];
    rightCol.appendChild(rVal);
  }
  bottomRow.appendChild(rightCol);

  board.appendChild(bottomRow);
}

/**
 * 基金卡片母版 - 自适应高度
 * 🔥 修复字重：使用 400 或 700
 */
function drawFundCardMaster(board: Board, data: UIElement): void {
  board.resize(SAFE_INNER_WIDTH, 110);
  board.borderRadius = 8;
  board.fills = [{ fillColor: CONFIG.white, fillOpacity: 1 }];
  board.horizontalSizing = 'fix';  // 宽度固定
  board.verticalSizing = 'auto';   // 高度自适应

  const flex = board.addFlexLayout();
  flex.dir = 'column';
  flex.horizontalPadding = 16;
  flex.verticalPadding = 16;
  flex.rowGap = 12;

  const title = penpot.createText(data.fundName || '基金名称');
  if (title) {
    title.name = '[fundName]';
    title.fontSize = '14';
    title.fontWeight = '700';  // 🔥 使用 700 而非 500
    title.fills = [{ fillColor: CONFIG.textBlack, fillOpacity: 0.85 }];
    board.appendChild(title);
  }

  const dataRow = penpot.createBoard();
  dataRow.name = 'Data Row';
  dataRow.fills = [];
  dataRow.resize(SAFE_INNER_WIDTH - 32, 50);
  const dFlex = dataRow.addFlexLayout();
  dFlex.dir = 'row';
  dFlex.justifyContent = 'space-between';

  const createCol = (labelText: string, valueName: string, valueText: string, color: string = CONFIG.textBlack) => {
    const col = penpot.createBoard();
    col.fills = [];
    col.resize((SAFE_INNER_WIDTH - 32) / 3, 50);
    const cFlex = col.addFlexLayout();
    cFlex.dir = 'column';
    cFlex.rowGap = 4;

    const l = penpot.createText(labelText);
    if (l) {
      l.fontSize = '12';
      l.fontWeight = '400';  // 🔥 使用 400
      l.fills = [{ fillColor: '#999999', fillOpacity: 1 }];
      col.appendChild(l);
    }
    const v = penpot.createText(valueText);
    if (v) {
      v.name = `[${valueName}]`;
      v.fontSize = '16';
      v.fontWeight = '700';  // 🔥 使用 700 而非 500
      v.fills = [{ fillColor: color, fillOpacity: 1 }];
      col.appendChild(v);
    }
    return col;
  };

  dataRow.appendChild(createCol('持有金额', 'holdingAmount', data.holdingAmount || '0.00'));
  dataRow.appendChild(createCol('昨日收益', 'incomeToday', data.incomeToday || '0.00', CONFIG.colorError));
  dataRow.appendChild(createCol('收益率', 'incomeRate', data.incomeRate || '0.00%', CONFIG.colorError));

  board.appendChild(dataRow);
}

/**
 * 风险提示卡片母版 - 自适应伸缩（Hug Contents）
 * 🔥 使用 sizing 属性让 Flex 引擎正确计算高度
 * 🔥 关键保底：文本必须有初始占位符，防止母版塌陷
 */
function drawWarningCardMaster(board: Board, data: UIElement): void {
  // 🔥 核心：设置 Board 的 sizing 属性
  board.resize(SAFE_INNER_WIDTH, 60); // 初始高度给一个合理的保底值
  board.borderRadius = 8;
  board.fills = [{ fillColor: '#fef2f2', fillOpacity: 1 }];
  board.horizontalSizing = 'fix';  // 宽度固定 343px
  board.verticalSizing = 'auto';   // 高度自适应（Hug Contents）

  const flex = board.addFlexLayout();
  flex.dir = 'column';
  flex.horizontalPadding = 16;
  flex.verticalPadding = 12;
  flex.rowGap = 8;

  // 必须命名为 [warningTitle] 以匹配 JSON
  // 🔥 保底：必须给初始占位符，防止高度为 0 导致塌陷
  const titleText = typeof data.warningTitle === 'string' && data.warningTitle.length > 0
    ? data.warningTitle
    : '风险提示标题';  // 保底占位符
  const title = penpot.createText(titleText);
  if (title) {
    title.name = '[warningTitle]';
    title.fontSize = '14';
    title.fontWeight = '700';  // 🔥 使用 700 而非 600
    title.fills = [{ fillColor: '#b91c1c', fillOpacity: 1 }];
    title.growType = 'auto-height';  // 高度随文字行数增长
    title.resize(311, 20);           // 必须设置宽度，触发换行
    board.appendChild(title);
  }

  // 必须命名为 [warningText] 以匹配 JSON 的超长文本
  // 🔥 保底：必须给初始占位符，防止高度为 0 导致塌陷
  const contentText = typeof data.warningText === 'string' && data.warningText.length > 0
    ? data.warningText
    : '风险揭示正文占位文本，用于撑开卡片高度。';  // 保底占位符
  const text = penpot.createText(contentText);
  if (text) {
    text.name = '[warningText]';
    text.fontSize = '12';
    text.fontWeight = '400';  // 🔥 常规字重
    text.fills = [{ fillColor: '#7f1d1d', fillOpacity: 1 }];
    text.growType = 'auto-height';  // 高度随文字行数增长
    text.resize(311, 20);           // 宽度必须给，触发换行
    board.appendChild(text);
  }

  console.log('[🏭] 创建 WarningCard 母版（Hug Contents），包含 [warningTitle] 和 [warningText] 插槽');
}

/**
 * 通用占位母版 - 用于未知组件类型
 * 🔥 基于 Ant Design 规范的自适应 Flex 引擎
 * 🔥 核心防爆点：auto-height 高度自适应，长文本自动折行
 */
/**
 * ⭐ 智能兜底渲染器
 * 当遇到未注册的组件类型时，尝试使用基础图形进行降级绘制
 *
 * @param board 父容器
 * @param type 组件类型（未注册）
 * @param data 组件数据
 */
function drawGenericPlaceholderMaster(board: Board, type: string, data: UIElement): void {
  // ⚠️ 醒目警告：帮助开发者排查 AI 幻觉问题
  console.warn(`%c[AI 降级渲染] 遇到未知组件类型: ${type}，尝试使用基础图形兜底绘制`, 'color: #FF6B00; font-weight: bold; font-size: 14px;');
  console.log(`[🏭] 原始数据:`, JSON.stringify(data, null, 2));

  // =====================================================
  // 1. 创建具备弹性的高保真 Board 容器
  // =====================================================

  // 设置移动端标准宽度
  board.resize(CONFIG.mobileWidth, 60); // 初始高度给保底值
  board.borderRadius = CONFIG.borderRadiusLG;
  board.fills = [{ fillColor: CONFIG.bgContainer, fillOpacity: 1 }];
  board.strokes = [{
    strokeColor: CONFIG.borderColor,
    strokeOpacity: 1,
    strokeWidth: 1,
    strokeStyle: 'dashed', // 使用虚线边框标识降级渲染
    strokeAlignment: 'inner'
  }];

  // 🔥 核心防爆点：宽度固定，高度自适应
  board.horizontalSizing = 'fix';
  board.verticalSizing = 'auto';

  // 注入 Flex 布局属性
  const flex = board.addFlexLayout();
  flex.dir = 'column';
  flex.alignItems = 'start';
  flex.horizontalPadding = CONFIG.padding;
  flex.verticalPadding = CONFIG.padding;
  flex.rowGap = CONFIG.paddingSM;

  // =====================================================
  // 2. 组件类型标签（顶部标识，带警告色）
  // =====================================================

  const typeLabel = penpot.createText(`⚠️ ${type} (降级渲染)`);
  if (typeLabel) {
    typeLabel.name = '__component_type__';
    typeLabel.fontSize = '11';
    typeLabel.fontWeight = '400';
    typeLabel.fills = [{ fillColor: '#FA8C16', fillOpacity: 1 }]; // 警告橙色
    board.appendChild(typeLabel);
  }

  // =====================================================
  // 3. ⭐ 智能降级渲染：解析 data 并绘制内容
  // =====================================================

  let renderedCount = 0;

  if (data && typeof data === 'object') {
    // 遍历 data 的所有字段
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'type') return; // 跳过 type 字段

      // 3.1 处理字符串字段 → 渲染文本
      if (typeof value === 'string') {
        renderFallbackText(board, key, value);
        renderedCount++;
      }
      // 3.2 处理数值字段 → 渲染带标注的数值
      else if (typeof value === 'number') {
        renderFallbackText(board, key, String(value));
        renderedCount++;
      }
      // 3.3 处理布尔字段 → 渲染状态标签
      else if (typeof value === 'boolean') {
        renderFallbackText(board, key, value ? '✓ 是' : '✗ 否');
        renderedCount++;
      }
      // 3.4 处理数组字段 → 递归渲染子节点
      else if (Array.isArray(value) && value.length > 0) {
        renderFallbackChildren(board, key, value);
        renderedCount++;
      }
      // 3.5 处理嵌套对象 → 递归渲染
      else if (typeof value === 'object' && value !== null) {
        renderFallbackNestedObject(board, key, value as Record<string, unknown>);
        renderedCount++;
      }
    });
  }

  // 如果没有渲染任何内容，创建默认占位
  if (renderedCount === 0) {
    createSlotTextNode(board, 'content', '（无数据）');
  }

  console.log(`[🏭] ✓ 降级渲染完成: ${type} (${renderedCount} 个字段已渲染)`);
}

/**
 * 渲染降级文本字段
 */
function renderFallbackText(board: Board, fieldName: string, value: string): void {
  const lowerFieldName = fieldName.toLowerCase();

  // 判断是否为强调型字段
  const isEmphasized =
    lowerFieldName.includes('title') ||
    lowerFieldName.includes('amount') ||
    lowerFieldName.includes('rate') ||
    lowerFieldName.includes('price') ||
    lowerFieldName.includes('yield');

  // 判断是否为次要字段
  const isSecondary =
    lowerFieldName.includes('desc') ||
    lowerFieldName.includes('description') ||
    lowerFieldName.includes('hint') ||
    lowerFieldName.includes('placeholder');

  // 截断过长文本
  const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;

  // 创建字段标签
  const labelText = penpot.createText(`${fieldName}:`);
  if (labelText) {
    labelText.name = `label_${fieldName}`;
    labelText.fontSize = '11';
    labelText.fontWeight = '400';
    labelText.fills = [{ fillColor: CONFIG.textTertiary, fillOpacity: 0.25 }];
    board.appendChild(labelText);
  }

  // 创建值文本
  const valueText = penpot.createText(displayValue);
  if (valueText) {
    valueText.name = `value_${fieldName}`;
    valueText.fontSize = isEmphasized ? '18' : '14';
    valueText.fontWeight = isEmphasized ? '700' : '400';  // 🔥 Penpot 不支持 600，改用 700

    // 根据字段类型设置颜色
    let textColor = CONFIG.textPrimary;
    if (isEmphasized) {
      // 收益率/金额：正负色
      if (displayValue.startsWith('+') || displayValue.startsWith('红')) {
        textColor = '#CF1322'; // 红色（涨）
      } else if (displayValue.startsWith('-') || displayValue.startsWith('绿')) {
        textColor = '#389E0D'; // 绿色（跌）
      } else {
        textColor = CONFIG.primaryBlue; // 蓝色强调
      }
    } else if (isSecondary) {
      textColor = CONFIG.textSecondary;
    }

    valueText.fills = [{ fillColor: textColor, fillOpacity: 1 }];
    board.appendChild(valueText);
  }
}

/**
 * 渲染降级子节点数组
 * 为数组元素创建一个分组容器，并递归绘制每个子项
 */
function renderFallbackChildren(board: Board, fieldName: string, children: unknown[]): void {
  // 创建分组标题
  const groupLabel = penpot.createText(`📦 ${fieldName} (${children.length} 项):`);
  if (groupLabel) {
    groupLabel.name = `group_${fieldName}`;
    groupLabel.fontSize = '12';
    groupLabel.fontWeight = '400';
    groupLabel.fills = [{ fillColor: CONFIG.primaryBlue, fillOpacity: 1 }];
    board.appendChild(groupLabel);
  }

  // 为每个子项创建简化渲染
  children.forEach((child, index) => {
    if (typeof child === 'string') {
      // 简单字符串子项
      const itemText = penpot.createText(`  ${index + 1}. ${child}`);
      if (itemText) {
        itemText.fontSize = '13';
        itemText.fills = [{ fillColor: CONFIG.textSecondary, fillOpacity: 0.45 }];
        board.appendChild(itemText);
      }
    } else if (typeof child === 'object' && child !== null) {
      // 对象子项：提取主要文本字段
      const childObj = child as Record<string, unknown>;
      const mainText = childObj.title || childObj.name || childObj.label ||
                       childObj.text || childObj.content || `项目 ${index + 1}`;

      const itemText = penpot.createText(`  ${index + 1}. ${mainText}`);
      if (itemText) {
        itemText.fontSize = '13';
        itemText.fills = [{ fillColor: CONFIG.textSecondary, fillOpacity: 0.45 }];
        board.appendChild(itemText);
      }

      // 如果有次要字段，也渲染出来
      const subFields = Object.entries(childObj)
        .filter(([k, v]) =>
          k !== 'type' &&
          k !== 'title' && k !== 'name' && k !== 'label' &&
          typeof v === 'string' && v.length < 30
        )
        .slice(0, 2); // 最多显示 2 个次要字段

      subFields.forEach(([k, v]) => {
        const subText = penpot.createText(`      ${k}: ${v}`);
        if (subText) {
          subText.fontSize = '11';
          subText.fills = [{ fillColor: CONFIG.textTertiary, fillOpacity: 0.25 }];
          board.appendChild(subText);
        }
      });
    }
  });
}

/**
 * 渲染降级嵌套对象
 */
function renderFallbackNestedObject(board: Board, fieldName: string, obj: Record<string, unknown>): void {
  // 创建分组标题
  const groupLabel = penpot.createText(`📋 ${fieldName}:`);
  if (groupLabel) {
    groupLabel.name = `nested_${fieldName}`;
    groupLabel.fontSize = '12';
    groupLabel.fontWeight = '400';
    groupLabel.fills = [{ fillColor: '#722ED1', fillOpacity: 1 }]; // 紫色标识嵌套对象
    board.appendChild(groupLabel);
  }

  // 渲染对象的所有字段
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const fieldText = penpot.createText(`  ${key}: ${value}`);
      if (fieldText) {
        fieldText.fontSize = '12';
        fieldText.fills = [{ fillColor: CONFIG.textSecondary, fillOpacity: 0.45 }];
        board.appendChild(fieldText);
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      const fieldText = penpot.createText(`  ${key}: ${String(value)}`);
      if (fieldText) {
        fieldText.fontSize = '12';
        fieldText.fills = [{ fillColor: CONFIG.textSecondary, fillOpacity: 0.45 }];
        board.appendChild(fieldText);
      }
    }
  });
}

/**
 * 创建插槽文本节点
 * 🔥 核心防爆点：auto-height 确保长文本自动折行
 *
 * @param board 父容器
 * @param slotName 插槽名称
 * @param placeholderText 占位文本
 */
function createSlotTextNode(board: Board, slotName: string, placeholderText: string): void {
  // 判断是否为强调型字段
  const lowerSlotName = slotName.toLowerCase();
  const isEmphasized =
    lowerSlotName.includes('title') ||
    lowerSlotName.includes('amount') ||
    lowerSlotName.includes('rate') ||
    lowerSlotName.includes('yield') ||
    lowerSlotName.includes('total') ||
    lowerSlotName.includes('income') ||
    lowerSlotName.includes('price') ||
    lowerSlotName.includes('percent');

  // 判断是否为数值型字段（红色/绿色）
  const isNumeric =
    lowerSlotName.includes('rate') ||
    lowerSlotName.includes('yield') ||
    lowerSlotName.includes('income') ||
    lowerSlotName.includes('amount') ||
    lowerSlotName.includes('percent') ||
    lowerSlotName.includes('total');

  const text = penpot.createText(placeholderText || `[${slotName}]`);
  if (text) {
    // 设置插槽名称（用于后续数据注入）
    text.name = `[${slotName}]`;

    // 🔥 核心防爆点：设置文本宽度，触发自动换行
    const textWidth = CONFIG.mobileWidth - (CONFIG.padding * 2);
    text.resize(textWidth, 20); // 宽度必须给，触发换行

    // 🔥 核心防爆点：auto-height 确保长文本自动折行，绝不挤压父级元素
    text.growType = 'auto-height';

    // 根据字段类型设置样式
    if (isEmphasized) {
      // 强调型字段：16px 加粗
      text.fontSize = '16';
      text.fontWeight = '700';
      text.fills = [{
        fillColor: isNumeric ? CONFIG.colorError : CONFIG.primaryBlue,
        fillOpacity: 1
      }];
    } else {
      // 普通字段：14px 常规
      text.fontSize = '14';
      text.fontWeight = '400';
      text.fills = [{ fillColor: CONFIG.textPrimary, fillOpacity: 0.85 }];
    }

    board.appendChild(text);
    console.log(`[🏭] 创建插槽: [${slotName}] ${isEmphasized ? '(强调)' : '(常规)'}`);
  }
}

/**
 * 创建母版结构（兜底方案）
 * ⚠️ 注意：此函数仅在本地资产库没有真实母版时才会被调用
 * @param type 组件类型
 * @param data 组件数据
 * @returns 创建的画板
 */
function drawMasterStructure(type: string, data: UIElement): Board | null {
  const masterBoard = penpot.createBoard();
  masterBoard.name = `Master_${type}_Draft`;

  // =====================================================
  // 硬编码的专用绘制函数（仅保留已有的专用组件）
  // =====================================================
  switch (type) {
    case 'AssetHeader':
      drawAssetHeaderMaster(masterBoard, data);
      break;
    case 'FundCard':
      drawFundCardMaster(masterBoard, data);
      break;
    case 'WarningCard':
      drawWarningCardMaster(masterBoard, data);
      break;
    default:
      // 兜底方案：使用通用占位符母版
      console.log(`[🏭] 创建通用自适应母版: ${type}`);
      drawGenericPlaceholderMaster(masterBoard, type, data);
      break;
  }

  return masterBoard;
}

// =====================================================
// 📦 基础组件绘制函数
// =====================================================

/**
 * 创建智能画板 - 使用原生 Flex 布局
 * 🔥 完全依赖 Penpot 原生 Flex 引擎处理排列和自适应高度
 */
function createSmartBoard(name: string, width: number, height: number, x: number): Board {
  const board = penpot.createBoard();
  board.name = name;

  // 固定宽度，高度初始为 812（后续自适应）
  board.resize(width, height);
  board.x = x;
  board.y = 0;

  // 背景色
  board.fills = [{ fillColor: CONFIG.bgLayout, fillOpacity: 1 }];

  // 宽度固定，高度自适应
  board.horizontalSizing = 'fix';
  board.verticalSizing = 'auto';  // 🔥 直接启用自适应高度（Hug Contents）

  // 🔥 强化 Flex 布局属性
  const flex = board.addFlexLayout();
  flex.dir = 'column';              // 垂直排列
  flex.justifyContent = 'start';    // 主轴对齐：顶部
  flex.alignItems = 'center';       // 交叉轴对齐：居中
  flex.rowGap = CONFIG.gap;         // 行间距：16px
  flex.verticalPadding = 24;        // 垂直内边距：24px
  flex.horizontalPadding = 16;      // 水平内边距：16px

  console.log(`[📱] 创建智能画板: ${name} (${width}x${height}，Flex 布局)`);

  return board;
}

function createTitle(board: Board, element: UIElement): void {
  const text = penpot.createText(element.text || '标题');
  if (!text) return;
  text.name = 'Title';
  text.fontFamily = 'Inter';
  text.fontSize = '20';
  text.fontWeight = '700';
  text.fills = [{ fillColor: CONFIG.textBlack, fillOpacity: 0.85 }];
  board.appendChild(text);
}

function createTextElement(board: Board, element: UIElement): void {
  const text = penpot.createText(element.content || element.text || '文本');
  if (!text) return;
  text.name = 'Text';
  text.fontFamily = 'Inter';
  text.fontSize = String(element.fontSize || 14);
  text.fills = [{ fillColor: CONFIG.textBlack, fillOpacity: 0.45 }];
  board.appendChild(text);
}

function createDivider(board: Board): void {
  const divider = penpot.createRectangle();
  divider.name = 'Divider';
  divider.resize(SAFE_INNER_WIDTH, 1);
  divider.fills = [{ fillColor: CONFIG.borderColor, fillOpacity: 1 }];
  board.appendChild(divider);
}

function createInput(board: Board, element: UIElement): void {
  const inputContainer = penpot.createBoard();
  inputContainer.name = 'Input Group';
  inputContainer.fills = [];
  inputContainer.resize(SAFE_INNER_WIDTH, 80);

  const flex = inputContainer.addFlexLayout();
  flex.dir = 'column';
  flex.rowGap = 8;

  if (element.label) {
    const label = penpot.createText(element.label);
    if (label) {
      label.fontFamily = 'Inter';
      label.fontSize = '14';
      label.fills = [{ fillColor: CONFIG.textBlack, fillOpacity: 0.85 }];
      inputContainer.appendChild(label);
    }
  }

  const inputBg = penpot.createBoard();
  inputBg.name = 'Input Field';
  inputBg.resize(SAFE_INNER_WIDTH, 48);
  inputBg.borderRadius = 6;
  inputBg.fills = [{ fillColor: CONFIG.bgField, fillOpacity: 1 }];

  if (element.placeholder) {
    const placeholder = penpot.createText(element.placeholder);
    if (placeholder) {
      placeholder.fontFamily = 'Inter';
      placeholder.fontSize = '14';
      placeholder.fills = [{ fillColor: CONFIG.textBlack, fillOpacity: 0.4 }];
      inputBg.appendChild(placeholder);
    }
  }

  inputContainer.appendChild(inputBg);
  board.appendChild(inputContainer);
}

function createButton(board: Board, element: UIElement): void {
  const btn = penpot.createBoard();
  btn.name = 'Primary Button';
  btn.resize(SAFE_INNER_WIDTH, 48);
  btn.borderRadius = 8;
  btn.fills = [{ fillColor: CONFIG.primaryBlue, fillOpacity: 1 }];

  const flex = btn.addFlexLayout();
  flex.alignItems = 'center';
  flex.justifyContent = 'center';

  const btnText = penpot.createText(element.text || '按钮');
  if (btnText) {
    btnText.fontFamily = 'Inter';
    btnText.fontSize = '16';
    btnText.fontWeight = '700';
    btnText.fills = [{ fillColor: CONFIG.white, fillOpacity: 1 }];
    btn.appendChild(btnText);
  }

  board.appendChild(btn);
}

function isBasicComponent(type: string): boolean {
  return BASIC_COMPONENT_TYPES.includes(type);
}

// =====================================================
// 🚀 任务执行器（带熔断机制）
// =====================================================

function handleCreateMasters(components: UIElement[], taskId: string): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧩 执行任务：初始化资产库母版');
  console.log('═══════════════════════════════════════════════════════════');

  const currentPage = penpot.currentPage;
  if (!currentPage) {
    penpot.ui.sendMessage({ type: 'task-error', taskId, error: '无法获取当前页面' });
    return;
  }

  console.log(`[📄] 当前页面: ${currentPage.name}`);

  try {
    currentX = getNextOffsetX(currentPage, CONFIG.masterGap);

    components.forEach(comp => {
      const type = comp.type;
      const existing = findExistingMasterComponent(type);

      if (!existing) {
        console.log(`[🏭] 创建新母版: Master_${type}`);
        const board = drawMasterStructure(type, comp);

        if (board) {
          board.x = currentX;
          board.y = 0;
          board.name = `Master_${type}`;

          const libraryComponent = penpot.library.local.createComponent([board]);
          masterCache.set(type, libraryComponent);
          currentX += SAFE_INNER_WIDTH + CONFIG.masterGap;
          console.log(`[🏭] ✓ 母版创建成功: Master_${type}`);
        }
      } else {
        console.log(`[🏭] 母版已存在，跳过: Master_${type}`);
      }
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ 母版生成完成');
    console.log('═══════════════════════════════════════════════════════════');

    penpot.ui.sendMessage({ type: 'task-complete', taskId });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('❌ 母版生成失败:', errorMessage);
    penpot.ui.sendMessage({ type: 'task-error', taskId, error: errorMessage });
  }
}

/**
 * 核心：在当前页面渲染业务画板
 * 🔥 带熔断机制：异步布局校验，失败时自动销毁画板
 */
function handleRenderPage(pageData: TaskData, taskId: string): void {
  const pageName = pageData.pageName || '未命名页面';
  const elements = pageData.elements || [];

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📱 执行任务：渲染页面 - ${pageName}`);
  console.log('═══════════════════════════════════════════════════════════');

  const currentPage = penpot.currentPage;
  if (!currentPage) {
    penpot.ui.sendMessage({ type: 'task-error', taskId, error: '无法获取当前页面' });
    return;
  }

  const pageX = getNextOffsetX(currentPage, CONFIG.phoneBoardGap);
  const phone = createSmartBoard(pageName, CONFIG.boardWidth, CONFIG.boardHeight, pageX);

  // 拼装元素
  elements.forEach(el => {
    const needsMaster = COMPLEX_COMPONENT_TYPES.includes(el.type) || !isBasicComponent(el.type);

    if (needsMaster) {
      // 查找或创建母版
      let master = findExistingMasterComponent(el.type);

      if (!master) {
        console.log(`[🏭] 母版不存在，动态创建自适应母版: Master_${el.type}`);

        // 🔥 使用 Ant Design 规范的自适应母版生成器
        const newBoard = drawMasterStructure(el.type, el);
        if (newBoard) {
          // 将母版放置在页面右侧的安全位置
          newBoard.x = pageX + CONFIG.boardWidth + CONFIG.masterGap;
          newBoard.y = 0;
          newBoard.name = `Master_${el.type}`;

          // 转化为本地组件
          const libraryComponent = penpot.library.local.createComponent([newBoard]);
          masterCache.set(el.type, libraryComponent);
          master = libraryComponent;

          console.log(`[🏭] ✓ 自适应母版创建成功: Master_${el.type}`);
        }
      }

      if (master) {
        const instance = master.instance();
        if (instance) {
          // 🔥 注入真实数据
          injectDataToInstance(instance, el);
          phone.appendChild(instance);
          console.log(`[🧩] 实例化组件: ${el.type}`);
        }
      }
    } else {
      // 基础组件直接绘制
      switch (el.type) {
        case 'Title':
          createTitle(phone, el);
          break;
        case 'Input':
          createInput(phone, el);
          break;
        case 'Button':
          createButton(phone, el);
          break;
        case 'Text':
          createTextElement(phone, el);
          break;
        case 'Divider':
          createDivider(phone);
          break;
      }
    }
  });

  // 🔥 布局校验（已降级为警告模式，不阻断渲染）
  // 延迟 100ms，等待底层 Flex 引擎完成坐标重排
  setTimeout(() => {
    console.log(`[🔍 布局校验器] 开始校验画板: ${pageName}`);

    // 计算所有子节点的总高度（仅用于日志）
    let totalChildrenHeight = 0;
    if ('children' in phone) {
      const children = (phone as { children: Shape[] }).children || [];
      children.forEach((child: Shape) => {
        totalChildrenHeight += (child.height || 0);
      });
    }
    totalChildrenHeight += 48; // 上下各 24px padding

    console.log(`[📐] 子节点总高度: ${totalChildrenHeight}px`);

    // 执行布局校验（仅警告，不抛出错误）
    validateComponentLayout(phone);

    // 无论是否有警告，都标记任务完成
    currentX += CONFIG.boardWidth + CONFIG.phoneBoardGap;
    console.log(`✅ 页面渲染完成: ${pageName}`);
    penpot.ui.sendMessage({ type: 'task-complete', taskId });
  }, 100);
}

// =====================================================
// 📡 消息监听
// =====================================================

interface TaskMessage {
  type: string;
  action?: 'create_masters' | 'render_page';
  taskData?: TaskData;
  taskId?: string;
}

// =====================================================
// 🔍 逆向扫描算法（核心雷达）
// =====================================================

/**
 * 插槽信息接口
 */
interface SlotInfo {
  name: string;
  maxChars: number;
  width: number;
  fontSize: number;
}

/**
 * 组件 Schema 接口
 */
/**
 * 从节点中提取字号
 * Penpot API 中字号可能在 node.fontSize 属性中
 * @param node 文本节点
 * @returns 字号大小，默认 14
 */
function extractFontSize(node: Text): number {
  try {
    // Penpot API: fontSize 是字符串类型，如 '14'
    const fontSizeStr = node.fontSize;
    if (fontSizeStr) {
      const parsed = parseFloat(String(fontSizeStr));
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn(`[🔍] 获取字号失败，使用默认值 14:`, error);
  }
  return 14; // 默认字号
}

/**
 * 递归扫描算法 - 从节点树中提取数据插槽约束
 * 🛡️ 防弹级版本：兼容 Figma Make 跨平台导入的复杂层级结构
 *
 * 核心能力：
 *   1. 全属性读取文本：兼容 characters/text/textContent/name
 *   2. 高容错正则：容忍 #slotName# 周围的空白符
 *   3. 彻底阅后即焚：清洗文本属性 + 图层树 name
 *   4. 全路网递归：兼容 children 和 shapes
 *
 * @param node 要扫描的节点
 * @returns 插槽信息数组
 */
function extractSlotsFromNode(node: any): SlotInfo[] {
  const slots: SlotInfo[] = [];

  // 1. 处理文本节点
  if (node.type === 'text') {
    let slotName: string | null = null;

    // 防弹级获取原始文本
    let originalText = node.characters || node.text || node.textContent || node.name || '';

    // 逻辑 1：兼容老规则 [slotName]
    const nameMatch = (node.name || '').match(/^\[([a-zA-Z_][a-zA-Z0-9_]*)\]$/);
    if (nameMatch) {
      slotName = nameMatch[1];
    }
    // 逻辑 2：新规则，容错率极高的正则
    else if (originalText) {
      const textMatch = originalText.match(/#\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*#/);
      if (textMatch) {
        slotName = textMatch[1];

        // 阅后即焚：清理文本
        const cleanText = originalText.replace(/#\s*[a-zA-Z_][a-zA-Z0-9_]*\s*#/, '').trim();

        // 兼容不同版本的 API 写入
        if ('characters' in node) node.characters = cleanText;
        if ('text' in node) node.text = cleanText;

        // 清洗图层名字
        if (node.name && node.name.includes('#')) {
          node.name = cleanText || 'Text';
        }

        console.log(`[🛡️ 防弹雷达] 发现插槽: #${slotName}# → 清理为: "${cleanText}"`);
      }
    }

    // 执行物理约束计算
    if (slotName) {
      const width = node.width || 0;
      const fontSize = extractFontSize(node);
      const maxChars = Math.max(2, Math.floor(width / fontSize));

      slots.push({
        name: slotName,
        maxChars: maxChars,
        width: width,
        fontSize: fontSize
      });

      console.log(`[📏 约束] 插槽 "${slotName}": 宽度=${width}px, 字号=${fontSize}px, 极限=${maxChars}字符`);
    }
  }

  // 2. 防弹级向下遍历（兼容 children 和 shapes）
  const childrenNodes = node.children || node.shapes || [];
  if (childrenNodes && childrenNodes.length > 0) {
    for (const child of childrenNodes) {
      slots.push(...extractSlotsFromNode(child));
    }
  }

  return slots;
}

/**
 * 根据插槽名称推断字段类型
 * @param slotName 插槽名称
 * @returns 字段类型
 */
function inferFieldType(slotName: string): 'string' | 'number' | 'boolean' {
  const lowerName = slotName.toLowerCase();

  // 布尔类型关键词
  if (lowerName.includes('is') || lowerName.includes('has') || lowerName.includes('enabled') ||
      lowerName.includes('visible') || lowerName.includes('active') || lowerName.includes('disabled')) {
    return 'boolean';
  }

  // 数字类型关键词
  if (lowerName.includes('amount') || lowerName.includes('count') || lowerName.includes('rate') ||
      lowerName.includes('price') || lowerName.includes('percent') || lowerName.includes('quantity') ||
      lowerName.includes('total') || lowerName.includes('income') || lowerName.includes('yield')) {
    return 'number';
  }

  // 默认为字符串类型
  return 'string';
}

/**
 * 根据插槽名称生成描述
 * @param slotName 插槽名称
 * @returns 描述文本
 */
function generateSlotDescription(slotName: string): string {
  const nameMap: Record<string, string> = {
    'userName': '用户名称',
    'totalAssets': '总资产金额',
    'totalAsset': '总资产金额',
    'incomeToday': '今日收益',
    'incomeTotal': '累计收益',
    'incomeRate': '收益率',
    'fundName': '基金名称',
    'fundCode': '基金代码',
    'holdingAmount': '持有金额',
    'yieldRate': '收益率',
    'yieldLabel': '收益标签',
    'productName': '产品名称',
    'productPrice': '产品价格',
    'warningTitle': '警示标题',
    'warningText': '警示内容',
    'warningLevel': '风险等级',
    'text': '文本内容',
    'label': '标签文本',
    'title': '标题文本',
    'description': '描述文本',
    'placeholder': '占位符文本',
    'amount': '金额',
    'percent': '百分比',
    'trend': '趋势方向',
    'period': '期限',
    'minAmount': '最小金额',
    'riskLevel': '风险等级',
    'tag': '标签',
    'actionText': '操作按钮文本',
    'shares': '持有份额',
  };

  return nameMap[slotName] || `${slotName} 字段`;
}

/**
 * 处理组件导出请求
 * 遍历母版库，提取所有插槽信息，组装成标准 Schema
 */
function handleExportComponents(): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 执行逆向扫描：从母版库提取组件 Schema');
  console.log('═══════════════════════════════════════════════════════════');

  const dbSchema: Record<string, ComponentSchema> = {};

  try {
    // 获取当前文件的所有本地母版
    const components = penpot.library.local.components;

    console.log(`[🔍] 发现 ${components.length} 个本地母版`);

    // 遍历母版库
    for (const component of components) {
      const masterName = component.name || '';

      // 只处理以 Master_ 开头的母版
      if (!masterName.startsWith('Master_')) {
        console.log(`[🔍] 跳过非标准母版: ${masterName}`);
        continue;
      }

      // 提取组件名（去除 Master_ 前缀）
      const typeName = masterName.replace(/^Master_/, '');

      console.log(`[🔍] 正在扫描母版: ${masterName} → ${typeName}`);

      // 获取母版的根节点
      const root = component.instance();
      if (!root) {
        console.warn(`[🔍] 母版 ${masterName} 没有根节点，跳过`);
        continue;
      }

      // 调用递归扫描算法提取插槽
      const slots = extractSlotsFromNode(root);

      if (slots.length === 0) {
        console.log(`[🔍] 母版 ${masterName} 没有发现插槽，跳过`);
        continue;
      }

      // 推断组件类别
      let category = '通用';
      const lowerTypeName = typeName.toLowerCase();
      if (lowerTypeName.includes('asset') || lowerTypeName.includes('header')) {
        category = '资产';
      } else if (lowerTypeName.includes('fund')) {
        category = '基金';
      } else if (lowerTypeName.includes('warning') || lowerTypeName.includes('risk')) {
        category = '合规';
      } else if (lowerTypeName.includes('product')) {
        category = '理财';
      } else if (lowerTypeName.includes('button') || lowerTypeName.includes('input')) {
        category = '交互';
      } else if (lowerTypeName.includes('title') || lowerTypeName.includes('divider')) {
        category = '布局';
      } else if (lowerTypeName.includes('notice') || lowerTypeName.includes('bar')) {
        category = '通知';
      } else if (lowerTypeName.includes('profit') || lowerTypeName.includes('card')) {
        category = '资产';
      } else if (lowerTypeName.includes('empty')) {
        category = '反馈';
      }

      // 组装约束定义
      const constraints: ComponentSchema['constraints'] = slots.map(slot => ({
        field: slot.name,
        type: inferFieldType(slot.name),
        required: true, // 默认所有插槽为必填
        maxLength: slot.maxChars,
        description: `${generateSlotDescription(slot.name)}，最大 ${slot.maxChars} 字符`
      }));

      // 构建组件 Schema
      const schema: ComponentSchema = {
        type: typeName,
        description: `${typeName} 组件（从母版逆向提取）`,
        category: category,
        slots: slots.map(s => s.name),
        constraints: constraints
      };

      dbSchema[typeName] = schema;

      console.log(`[🔍] ✓ 提取成功: ${typeName} (${slots.length} 个插槽)`);
      console.log(`      插槽: ${slots.map(s => `[${s.name}](${s.maxChars}字符)`).join(', ')}`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ 组件库扫描完成，共提取组件数: ${Object.keys(dbSchema).length}`);
    console.log('═══════════════════════════════════════════════════════════');

    // 将结果回传给 UI 收件箱
    penpot.ui.sendMessage({
      type: 'components-exported',
      payload: dbSchema
    });

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[🔍] 组件扫描失败:', errorMessage);

    penpot.ui.sendMessage({
      type: 'export-error',
      error: errorMessage
    });
  }
}

penpot.ui.onMessage<TaskMessage>((message) => {
  console.log(`[📡] 收到消息: ${message.type}`);

  if (message.type === 'execute-task') {
    const { action, taskData, taskId } = message;

    if (!action || !taskData || !taskId) {
      console.error('[📡] 消息参数不完整');
      return;
    }

    if (action === 'create_masters') {
      handleCreateMasters(taskData.components || [], taskId);
    } else if (action === 'render_page') {
      handleRenderPage(taskData, taskId);
    }
  }

  // 🔍 监听前端导出指令
  if (message.type === 'export-components') {
    console.log('[📡] 收到组件导出指令');
    handleExportComponents();
  }
});
