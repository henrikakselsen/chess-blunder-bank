import { Chess } from 'chess.js'
import type { EngineAnalysis } from './types'
import {
  parseBestMoveLine,
  parseUciInfoLine,
  scoreToWhitePovPawns,
} from './uciParse'

const MOVETIME_MS = 450
const STOCKFISH_BASE = 'stockfish-19-lite-single'

let worker: Worker | null = null
let initPromise: Promise<void> | null = null
let ready = false

let pendingInit: (() => void) | null = null
let pendingSearch: ((analysis: EngineAnalysis) => void) | null = null
let pendingReject: ((err: Error) => void) | null = null
let searchFen = ''
let bestInfo: { depth: number; whitePovPawns: number; pvUci: string[] } | null = null
let searchGeneration = 0

function stockfishAssetUrls(): { js: string; wasm: string } {
  const base = `${import.meta.env.BASE_URL}stockfish/${STOCKFISH_BASE}`
  const js = new URL(`${base}.js`, window.location.origin).href
  const wasm = new URL(`${base}.wasm`, window.location.origin).href
  return { js, wasm }
}

function createWorker(): Worker {
  const { js, wasm } = stockfishAssetUrls()
  // Stockfish 19 reads the hash as "<wasm url>[,<flag>]". Any second field
  // stops the engine from replying, so only send the wasm URL.
  const url = `${js}#${encodeURIComponent(wasm)}`
  return new Worker(url)
}

function send(cmd: string) {
  worker?.postMessage(cmd)
}

function rejectPending(err: Error) {
  if (pendingReject) {
    pendingReject(err)
    pendingReject = null
    pendingSearch = null
  }
}

function onWorkerMessage(raw: string) {
  const line = raw.trim()
  if (!line) return

  if (line === 'uciok') {
    send('isready')
    return
  }
  if (line === 'readyok') {
    if (!ready) {
      ready = true
      pendingInit?.()
      pendingInit = null
    }
    return
  }

  const info = parseUciInfoLine(line)
  if (info && info.score && searchFen) {
    const chess = new Chess(searchFen)
    const stm = chess.turn()
    const whitePovPawns = scoreToWhitePovPawns(info.score, stm)
    if (info.depth >= (bestInfo?.depth ?? 0)) {
      bestInfo = {
        depth: info.depth,
        whitePovPawns,
        pvUci: info.pv,
      }
    }
  }

  const bestUci = parseBestMoveLine(line)
  if (bestUci !== null && pendingSearch) {
    const resolve = pendingSearch
    pendingSearch = null
    pendingReject = null
    const analysis: EngineAnalysis = {
      whitePovPawns: bestInfo?.whitePovPawns ?? 0,
      bestMoveUci: bestUci,
      depth: bestInfo?.depth ?? 0,
    }
    bestInfo = null
    resolve(analysis)
  }
}

export function ensureWorker(): Promise<void> {
  if (ready) return Promise.resolve()
  if (initPromise) return initPromise

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      worker = createWorker()
      worker.onmessage = (e: MessageEvent) => {
        if (typeof e.data === 'string') onWorkerMessage(e.data)
      }
      worker.onerror = (e) => {
        rejectPending(new Error(e.message || 'Stockfish worker error'))
        reject(new Error(e.message || 'Stockfish worker error'))
      }
      pendingInit = resolve
      send('uci')
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })

  return initPromise
}

export function isStockfishReady(): boolean {
  return ready
}

export async function analyzeFen(fen: string, movetimeMs = MOVETIME_MS): Promise<EngineAnalysis> {
  await ensureWorker()
  if (!worker) throw new Error('Stockfish worker not available')

  const generation = ++searchGeneration
  if (pendingSearch) {
    send('stop')
    rejectPending(new Error('Search superseded'))
  }

  return new Promise<EngineAnalysis>((resolve, reject) => {
    pendingSearch = (analysis) => {
      if (generation !== searchGeneration) return
      resolve(analysis)
    }
    pendingReject = (err) => {
      if (generation !== searchGeneration) return
      reject(err)
    }

    searchFen = fen
    bestInfo = null
    send(`position fen ${fen}`)
    send(`go movetime ${movetimeMs}`)
  })
}

export function uciToSan(fen: string, uci: string): string | null {
  const chess = new Chess(fen)
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4] : undefined
  try {
    const move = chess.move({
      from,
      to,
      promotion: (promotion as 'q' | 'r' | 'b' | 'n') ?? 'q',
    })
    return move?.san ?? null
  } catch {
    return null
  }
}

export function applyUciMove(fen: string, uci: string): string | null {
  const chess = new Chess(fen)
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4] : undefined
  try {
    const move = chess.move({
      from,
      to,
      promotion: (promotion as 'q' | 'r' | 'b' | 'n') ?? 'q',
    })
    if (!move) return null
    return chess.fen()
  } catch {
    return null
  }
}
