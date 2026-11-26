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

/**
 * IndexedDB data is stored per origin (protocol + host + port). Dev and preview
 * use one fixed port, so the data stays the same. If the port is in use, Vite
 * stops with an error and does not move to another port.
 */
const APP_PORT = 5173

/** `/lichess` proxy: CORS fallback in dev and User-Agent for tools that hit the proxy. */
export default defineConfig({
  plugins: [tailwindcss(), react(), appLogPlugin()],
  server: {
    port: APP_PORT,
    strictPort: true,
    proxy: {
      '/lichess': LICHESS_PROXY,
    },
  },
  preview: {
    port: APP_PORT,
    strictPort: true,
    proxy: {
      '/lichess': LICHESS_PROXY,
    },
  },
})
