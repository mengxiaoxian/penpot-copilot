# JSON to UI 生成器 - Penpot 插件

一个用于从 JSON 数据自动生成 UI 原型的 Penpot 插件。

## 功能特性

- 从 JSON 数据自动生成 UI 原型
- 支持多种 UI 元素类型：Title、Input、Button、Text、Divider
- 自动流式布局排列
- 可自定义样式配置

## 项目结构

```
json-to-ui-plugin/
├── index.html          # UI 入口文件
├── package.json        # 项目依赖配置
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 构建配置
├── public/
│   ├── manifest.json   # 插件清单
│   └── icon.svg        # 插件图标
└── src/
    ├── main.ts         # UI 侧脚本
    └── plugin.ts       # 插件主线程脚本 (使用 Penpot API)
```

## 安装依赖

```bash
cd json-to-ui-plugin
npm install
```

## 本地开发

1. 启动开发服务器：

```bash
npm run dev
```

2. 服务器将在 `http://localhost:4400` 启动

3. 在 Penpot 中加载插件：
   - 打开 Penpot (https://design.penpot.app/)
   - 使用快捷键 `Ctrl + Alt + P` (Windows/Linux) 或 `Cmd + Option + P` (Mac) 打开插件管理器
   - 输入插件 manifest URL: `http://localhost:4400/manifest.json`
   - 点击安装

## 构建

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

## JSON 数据格式

```json
{
  "elements": [
    { "type": "Title", "text": "用户登录" },
    { "type": "Input", "label": "用户名", "placeholder": "请输入用户名" },
    { "type": "Input", "label": "密码", "placeholder": "请输入密码" },
    { "type": "Button", "text": "登录" },
    { "type": "Text", "content": "还没有账号？立即注册", "fontSize": 12 }
  ]
}
```

## 支持的元素类型

| 类型 | 属性 | 说明 |
|------|------|------|
| `Title` | `text` | 创建标题文本 |
| `Input` | `label`, `placeholder` | 创建输入框（含标签） |
| `Button` | `text` | 创建按钮 |
| `Text` | `content`, `fontSize` | 创建普通文本 |
| `Divider` | 无 | 创建分割线 |

## 技术栈

- **Vite** - 构建工具
- **TypeScript** - 类型安全
- **Penpot Plugin API** - 原生插件 API

## 参考资源

- [Penpot 插件 API 文档](https://penpot-plugins-api-doc.pages.dev/)
- [Penpot 插件开发指南](https://help.penpot.app/plugins/create-a-plugin/)
- [官方 Starter 模板](https://github.com/penpot/penpot-plugin-starter-template)

## 许可证

MIT
