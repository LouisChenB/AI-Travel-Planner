import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      // 代理 DashScope 兼容模式根路径，开发环境下规避 CORS
      '/llm-proxy': {
        target: 'https://dashscope.aliyuncs.com/compatible-mode',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llm-proxy/, ''),
      },
    },
  },
})
