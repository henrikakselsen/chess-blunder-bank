import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Bruk `/lichess/...` som base hvis nettleseren blokkerer CORS mot lichess.org */
export default defineConfig({
  plugins: [react()],
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
