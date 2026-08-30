import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: Vite requires a default configuration export.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4310,
    proxy: {
      '/api': 'http://127.0.0.1:4311',
      '/healthz': 'http://127.0.0.1:4311',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ['react-markdown', 'rehype-highlight', 'remark-gfm'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
