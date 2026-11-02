import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appLogPlugin } from './vite-app-log-plugin'

/** Lichess returns 404 without an app-identifying User-Agent (see lichess-org/api#667). */
const LICHESS_PROXY = {
  target: 'https://lichess.org',
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/lichess/, ''),
  headers: {
    'User-Agent':
      'chess-blunder-bank/1.0 (+https://github.com/henrikakselsen/chess-blunder-bank)',
  },
}

/** `/lichess` proxy: CORS fallback in dev and User-Agent for tools that hit the proxy. */
export default defineConfig({
  plugins: [tailwindcss(), react(), appLogPlugin()],
  server: {
    proxy: {
      '/lichess': LICHESS_PROXY,
    },
  },
  preview: {
    proxy: {
      '/lichess': LICHESS_PROXY,
    },
  },
})
