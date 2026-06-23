import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appLogPlugin } from './vite-app-log-plugin'

/** Use `/lichess/...` as base if the browser blocks CORS to lichess.org */
export default defineConfig({
  plugins: [tailwindcss(), react(), appLogPlugin()],
  server: {
    proxy: {
      '/lichess': {
        target: 'https://lichess.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lichess/, ''),
      },
    },
  },
})
