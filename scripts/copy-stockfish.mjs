#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(fileURLToPath(import.meta.url), '..', '..')
const version = JSON.parse(
  fs.readFileSync(path.join(root, 'node_modules/stockfish/package.json'), 'utf8'),
).buildVersion

const srcDir = path.join(root, 'node_modules/stockfish/bin')
const destDir = path.join(root, 'public/stockfish')
const base = `stockfish-${version}-lite-single`

fs.mkdirSync(destDir, { recursive: true })
for (const ext of ['.js', '.wasm']) {
  fs.copyFileSync(path.join(srcDir, `${base}${ext}`), path.join(destDir, `${base}${ext}`))
}

console.log(`Copied ${base} to public/stockfish/`)
