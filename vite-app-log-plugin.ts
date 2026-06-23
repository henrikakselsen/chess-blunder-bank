import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** Dev-only: append client error JSON lines to `.logs/app.jsonl` for agent debugging. */
export function appLogPlugin(): Plugin {
  const logDir = path.resolve(process.cwd(), '.logs')
  const logFile = path.join(logDir, 'app.jsonl')

  return {
    name: 'app-log',
    configureServer(server) {
      server.middlewares.use('/__app_log', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            fs.mkdirSync(logDir, { recursive: true })
            fs.appendFileSync(logFile, `${body.trim()}\n`, 'utf8')
            res.statusCode = 204
            res.end()
          } catch (e) {
            res.statusCode = 500
            res.end(e instanceof Error ? e.message : 'log write failed')
          }
        })
      })
    },
  }
}
