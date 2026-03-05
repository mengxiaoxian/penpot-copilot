# Penpot Copilot (Alpha) - AI to UI Generator

<div align="center">

**AI 驱动的 UI 原型生成引擎 | AI-Powered UI Prototype Generator**

*用自然语言，让 AI 帮你画原型 | Turn your words into UI designs*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)](https://github.com/mengxiaoxian/penpot-copilot)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/mengxiaoxian/penpot-copilot/pulls)

</div>

---

## 🎯 项目简介 | What is This?

**中文版：**

这是一个能让你的产品经理梦想成真的工具 —— 只需要用自然语言描述你想要的界面，AI 就会帮你生成 Penpot 原型！没错，你再也不用求设计师帮忙画低保真原型了（设计师们松了一口气）。

**English Version:**

A tool that makes your product manager dreams come true — just describe the interface you want in natural language, and AI will generate a Penpot prototype for you! Yes, you no longer need to beg designers for low-fidelity prototypes (designers breathe a sigh of relief).

---
## 🚀 The 8-Step Autonomous UI Workflow (8步 AI 自动化构建协议)

Designed by **散装勇者 (The Assembled Knight)**, this workflow bridges high-end AI generation with open-source design ecosystems, achieving complete decoupling of visual presentation and business data.
这套由**散装勇者**设计的 8 步协议，打通了顶尖 AI 生成能力与开源设计生态，实现了视觉表现与业务数据的深度解耦。

1. **Agent Definition (协议定义)**: Initiate the specialized UI Automation Agent. It outputs a "Dual-Package": Clean Drawing Prompts + Hidden JSON Mapping Dictionary. / 启动协议 Agent，输出“绘图指令+暗箱字典”的双料包。
2. **Multimodal Input (多模态输入)**: Feed the Agent with PRDs, wireframes, or screenshots to generate precise design instructions. / 通过多模态输入，让 Agent 产出高精度的设计逻辑。
3. **AI Generation (视觉生产)**: Use Figma's AI engine to generate high-fidelity components based on the "Clean Prompts". / 利用 AI 引擎，根据“纯净指令”生成高保真组件。
4. **Semantic Mapping (无痕替换)**: Apply our custom plugin to replace mock data with semantic slots (e.g., `[price]`) based on the JSON dictionary. / 通过自定义插件，将视觉稿中的假数据一键替换为语义化变量。
5. **Universal Export (跨平台导出)**: Export the sanitized assets into the standard `.penpot` exchange format. / 将处理好的资产导出为标准的 Penpot 交换格式。
6. **Master Creation (母版实例化)**: Import files into Penpot and batch-create Main Components to build the source of truth. / 在 Penpot 中导入并批量创建母版，建立唯一事实来源。
7. **Asset Scanning (资产入库)**: **[CORE]** Run `penpot-copilot` to scan, standardize, and store these assets into the Penpot Library. / **[核心]** 运行 `penpot-copilot` 插件，实现资产的自动化扫描与入库。
8. **Automated Prototyping (原型交付)**: Generate industry-compliant, interactive prototypes directly from the standardized library. / 调用标准化资产库，一键生成符合交付要求的交互原型。

---

## 🗺️ Dual-Track Roadmap (双轨演进计划)

### 🛤️ Track 1: The Automation Bridge (自动化数据桥)
* **Goal**: Eliminate manual file handling between platforms. 
* **Focus**: Building a direct API connector to sync Figma AI outputs to Penpot libraries silently.
* **目标**: 消除平台间的搬运磨损。开发直接的 API 连接器，实现资产从 AI 生成到入库的“静默同步”。

### 🛤️ Track 2: Industry-Specific Logic (行业逻辑内置)
* **Goal**: Pre-configure professional UI constraints for specific sectors (Finance, SaaS, etc.) into the Agent protocol.
* **Vision**: A system where the PM inputs a business requirement, and the "Assembled Knight" engine automatically selects the right industry-standard components.
* **目标**: 在协议中预置特定行业（如金融、SaaS 等）的专业 UI 约束。
* **愿景**: PM 仅需输入业务逻辑，“散装勇者”引擎即可自动匹配并生成行业级标准原型。

## ⚠️ 免责声明 | Disclaimer

<div align="center">

### 🚨 重要提示 | Important Notice 🚨

**中文版：**

我是一名野生产品经理（Product Manager），没有专业的系统性编码经验。本项目是用业余时间结合大模型辅助"手搓"的测试版（Alpha）。

目前代码结构可能比较"狂野"（read: 一坨屎山），核心仅验证了 **LLM JSON → Penpot 画布的渲染连通性**。必然存在 Bug，请各位开发者轻喷，欢迎提交 PR 共同完善！

**English Version:**

I'm a wild Product Manager with no professional systematic coding experience. This project is an Alpha version "hand-crafted" in my spare time with the help of LLMs.

The current code structure might be a bit "wild" (read: a pile of spaghetti), and the core only validates the **LLM JSON → Penpot canvas rendering pipeline**. Bugs are guaranteed. Please be gentle with your criticism, and PRs are warmly welcome!

</div>

---

## ✨ 功能特性 | Features

| 功能 | Feature | 描述 | Description |
|------|---------|------|-------------|
| 🗣️ 自然语言输入 | Natural Language Input | 用中文/英文描述你想要的界面 | Describe your desired interface in Chinese/English |
| 🤖 AI 智能生成 | AI-Powered Generation | 支持多种大模型（OpenAI、DeepSeek、Qwen、智谱等） | Supports multiple LLMs (OpenAI, DeepSeek, Qwen, Zhipu, etc.) |
| 🎨 Penpot 原型输出 | Penpot Prototype Output | 自动生成可编辑的 UI 原型 | Auto-generates editable UI prototypes |
| 📦 组件库系统 | Component Library System | 内置金融场景组件，支持自定义扩展 | Built-in financial components, customizable |
| 🔌 MCP 协议支持 | MCP Protocol Support | 与 Claude Desktop 等 AI 客户端无缝集成 | Seamless integration with Claude Desktop and other AI clients |

---

## 🏗️ 项目架构 | Architecture

```
penpot-copilot/
├── json-to-ui-plugin/          # Penpot 插件 | Penpot Plugin
│   ├── src/
│   │   ├── main.ts             # UI 侧脚本 | UI-side script
│   │   └── plugin.ts           # 插件核心逻辑 | Plugin core logic
│   └── vite.config.ts          # 构建配置 | Build config
│
├── penpot-mcp-server/          # MCP 服务器 | MCP Server
│   ├── src/
│   │   └── index.ts            # 服务器入口 | Server entry
│   └── components.json         # 组件库定义 | Component library
│
├── .env.example                # 环境变量示例 | Environment example
└── README.md                   # 你正在看的 | You're reading this
```

---

## 🚀 快速开始 | Quick Start

### 1️⃣ 环境准备 | Prerequisites

- Node.js >= 18.0.0
- npm 或 pnpm
- 一个支持 OpenAI API 格式的大模型 API Key

### 2️⃣ 安装依赖 | Install Dependencies

```bash
# 克隆仓库 | Clone the repo
git clone https://github.com/mengxiaoxian/penpot-copilot.git
cd penpot-copilot

# 安装插件依赖 | Install plugin dependencies
cd json-to-ui-plugin
npm install

# 安装 MCP 服务器依赖 | Install MCP server dependencies
cd ../penpot-mcp-server
npm install
```

### 3️⃣ 配置环境变量 | Configure Environment

```bash
# 复制环境变量示例 | Copy environment example
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key | Edit .env and add your API Key
```

### 4️⃣ 启动服务 | Start Services

```bash
# 终端 1：启动 MCP 服务器 | Terminal 1: Start MCP server
cd penpot-mcp-server
npm run build && npm start

# 终端 2：启动插件开发服务器 | Terminal 2: Start plugin dev server
cd json-to-ui-plugin
npm run dev
```

### 5️⃣ 在 Penpot 中使用 | Use in Penpot

1. 打开 [Penpot](https://design.penpot.app/)
2. 按 `Cmd + Option + P` (Mac) 或 `Ctrl + Alt + P` (Windows/Linux) 打开插件管理器
3. 输入插件 URL: `http://localhost:4400/manifest.json`
4. 开始用自然语言描述你的界面需求！

---

## 📦 支持的组件 | Supported Components

### 基础组件 | Basic Components

| 组件 | Component | 用途 | Usage |
|------|-----------|------|-------|
| `Title` | 标题 | 页面标题 | Page title |
| `Text` | 文本 | 普通文本内容 | Regular text content |
| `Button` | 按钮 | 操作按钮 | Action button |
| `Input` | 输入框 | 表单输入 | Form input |
| `Divider` | 分割线 | 内容分隔 | Content divider |

### 金融场景组件 | Financial Components

| 组件 | Component | 用途 | Usage |
|------|-----------|------|-------|
| `AssetHeader` | 资产头部 | 展示用户资产概览 | User asset overview |
| `FundCard` | 基金卡片 | 基金持仓信息 | Fund holding info |
| `WarningCard` | 风险提示 | 合规风险警示 | Risk warning |
| `ProductCard` | 产品卡片 | 理财产品展示 | Wealth management product |
| `ProfitCard` | 收益卡片 | 盈亏数据展示 | Profit/loss display |

---

## 🔧 高级配置 | Advanced Configuration

### Claude Desktop 集成 | Claude Desktop Integration

在 Claude Desktop 配置文件中添加：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "penpot-copilot": {
      "command": "node",
      "args": ["/path/to/penpot-copilot/penpot-mcp-server/dist/index.js"]
    }
  }
}
```

### 支持的 LLM 提供商 | Supported LLM Providers

| 提供商 | Provider | API Base URL |
|--------|----------|--------------|
| OpenAI | OpenAI | `https://api.openai.com/v1` |
| DeepSeek | DeepSeek | `https://api.deepseek.com` |
| 通义千问 | Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 智谱 AI | Zhipu | `https://open.bigmodel.cn/api/paas/v1` |
| MiniMax | MiniMax | `https://api.minimaxi.com/v1` |
| Ollama (本地) | Ollama (Local) | `http://localhost:11434/v1` |

---

## 🤝 贡献指南 | Contributing

我们非常欢迎各种形式的贡献！

**中文版：**
- 🐛 发现 Bug？[提交 Issue](https://github.com/mengxiaoxian/penpot-copilot/issues)
- 💡 有新想法？[参与讨论](https://github.com/mengxiaoxian/penpot-copilot/discussions)
- 🔧 想改代码？[提交 PR](https://github.com/mengxiaoxian/penpot-copilot/pulls)

**English Version:**
- 🐛 Found a bug? [Open an Issue](https://github.com/mengxiaoxian/penpot-copilot/issues)
- 💡 Have an idea? [Join the Discussion](https://github.com/mengxiaoxian/penpot-copilot/discussions)
- 🔧 Want to code? [Submit a PR](https://github.com/mengxiaoxian/penpot-copilot/pulls)

---

## 📄 开源协议 | License

本项目采用 [MIT License](LICENSE) 开源协议。

This project is licensed under the [MIT License](LICENSE).

---

## 👤 作者信息 | Author

<div align="center">

**IP: 散装勇者 (The Assembled Knight)**

*独立开发者 | Independent Developer*

**GitHub 维护者 | GitHub Maintainer**: [@mengxiaoxian](https://github.com/mengxiaoxian)

---

*"用 AI 解放产品经理的双手，让设计师专注于真正重要的设计工作"*

*"Free PMs' hands with AI, let designers focus on what really matters"*

</div>

---

## 🙏 致谢 | Acknowledgments

- [Penpot](https://penpot.app/) - 开源设计工具 | Open-source design tool
- [Model Context Protocol](https://github.com/modelcontextprotocol) - AI 集成协议 | AI integration protocol
- 所有贡献者和早期测试用户 | All contributors and early testers

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！⭐**

**⭐ If this project helps you, please give it a Star! ⭐**

Made with ❤️ and 🤖 by 散装勇者 (The Assembled Knight)

</div>
