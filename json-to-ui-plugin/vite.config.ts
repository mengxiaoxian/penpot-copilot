import { defineConfig } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// 构建前将组件库嵌入到 plugin.ts 中
const embedComponents = () => {
  // 生成嵌入文件的函数
  const generateEmbeddedFile = () => {
    try {
      const componentsPath = resolve(__dirname, '../penpot-mcp-server/components.json')
      const componentsContent = readFileSync(componentsPath, 'utf-8')

      // 创建一个 TypeScript 文件，导出组件库
      const tsContent = `// 自动生成的组件库数据（构建时嵌入）
export const EMBEDDED_COMPONENTS = ${componentsContent} as const;
`

      const outputPath = resolve(__dirname, 'src/embedded-components.ts')
      writeFileSync(outputPath, tsContent)
      console.log('✅ 组件库已嵌入到 src/embedded-components.ts')
    } catch (e) {
      console.warn('⚠️ 组件库嵌入失败:', e)
    }
  }

  return {
    name: 'embed-components',
    // 使用 configResolved 钩子，在配置解析完成后立即执行
    configResolved() {
      generateEmbeddedFile()
    },
    // 构建时也执行
    buildStart() {
      generateEmbeddedFile()
    }
  }
}

export default defineConfig({
  plugins: [embedComponents()],
  // 关键：使用相对路径，确保在 Penpot iframe 中正确加载资源
  base: './',

  // 开发模式配置
  server: {
    port: 4400,
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    // 👇 反向代理配置 - 解决 CORS 跨域问题
    proxy: {
      // 开发模式：plugin.js 映射到 src/plugin.ts
      '/plugin.js': {
        target: 'http://localhost:4400',
        rewrite: (path) => '/src/plugin.ts'
      },
      // MiniMax 代理
      '/api/minimax': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/minimax/, '')
      },
      // DeepSeek 代理
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, '')
      },
      // OpenAI 代理
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, '')
      },
      // 通义千问 代理
      '/api/qwen': {
        target: 'https://dashscope.aliyuncs.com/compatible-mode',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qwen/, '')
      },
      // 智谱 AI 代理
      '/api/zhipu': {
        target: 'https://open.bigmodel.cn/api/paas',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zhipu/, '')
      },
      // 本地 Ollama 代理（如果需要）
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '')
      }
    }
  },
  // 预览模式配置
  preview: {
    port: 4400,
    cors: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    // 👇 预览模式也要加反向代理
    proxy: {
      // MiniMax 代理
      '/api/minimax': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/minimax/, '')
      },
      // DeepSeek 代理
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, '')
      },
      // OpenAI 代理
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, '')
      },
      // 通义千问 代理
      '/api/qwen': {
        target: 'https://dashscope.aliyuncs.com/compatible-mode',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/qwen/, '')
      },
      // 智谱 AI 代理
      '/api/zhipu': {
        target: 'https://open.bigmodel.cn/api/paas',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zhipu/, '')
      },
      // 本地 Ollama 代理
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        plugin: 'src/plugin.ts',
        index: 'index.html',
      },
      output: { entryFileNames: '[name].js' },
    },
  },
})
