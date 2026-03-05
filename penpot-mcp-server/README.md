# Penpot MCP Server

MCP (Model Context Protocol) Server，作为大模型与 Penpot 插件之间的桥梁。

## 功能

- 🚀 暴露 `render_penpot_ui` Tool 给大模型调用
- 📡 通过 WebSocket 与 Penpot 插件实时通信
- 📦 支持向导模式的任务格式（create_masters + render_page）

## 安装

```bash
npm install
npm run build
```

## 启动

```bash
npm start
```

服务器将在以下端口启动：
- **MCP Server**: stdio 传输（供 Claude Desktop 等客户端使用）
- **WebSocket Server**: 端口 8080（供 Penpot 插件连接）

## 可用的 MCP Tools

### 1. `render_penpot_ui`

将生成的 UI JSON Schema 发送给 Penpot 插件进行自动渲染。

**参数**:
- `tasks`: 向导模式任务数组

**示例**:
```json
{
  "tasks": [
    {
      "action": "create_masters",
      "components": [
        { "type": "AssetHeader", "userName": "用户", "totalAssets": "10000" }
      ]
    },
    {
      "action": "render_page",
      "pageName": "首页",
      "elements": [
        { "type": "AssetHeader", "userName": "张三", "totalAssets": "99999" },
        { "type": "Button", "text": "确认" }
      ]
    }
  ]
}
```

### 2. `get_penpot_status`

获取当前 Penpot 插件的连接状态。

### 3. `send_custom_message`

发送自定义消息给 Penpot 插件。

## Claude Desktop 配置

在 Claude Desktop 配置文件中添加：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "penpot": {
      "command": "node",
      "args": ["/Users/你的用户名/penpot/penpot-mcp-server/dist/index.js"]
    }
  }
}
```

## Penpot 插件配置

1. 打开 Penpot 插件
2. 插件会自动连接到 `ws://localhost:8080`
3. 查看 UI 中的 "MCP: 已连接" 状态

## 工作流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   大模型/LLM     │────>│  MCP Server     │────>│  Penpot 插件    │
│  (Claude 等)     │     │  (端口 8080)    │     │  (WebSocket)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  调用 Tool            │  广播消息              │  执行渲染
        │  render_penpot_ui    │  render-tasks         │  返回状态
        │                       │                       │
        └───────────────────────┴───────────────────────┘
```

## 支持的组件类型

### 基础组件
- `Title` - 标题
- `Text` - 文本
- `Divider` - 分割线
- `Input` - 输入框
- `Button` - 按钮

### 金融组件
- `AssetHeader` - 资产头部
- `FundCard` - 基金卡片
- `WarningCard` - 风险提示卡片

## 开发

```bash
# 开发模式（构建并运行）
npm run dev

# 仅构建
npm run build
```

## 注意事项

1. 确保 Penpot 插件在 MCP Server 启动后打开
2. 如果连接断开，插件会自动尝试重连（每 5 秒）
3. 布局校验失败的渲染会被自动拦截并销毁画板
