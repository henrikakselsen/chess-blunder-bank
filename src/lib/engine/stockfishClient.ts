import { Chess } from 'chess.js'
import type { EngineAnalysis, EngineLine } from './types'
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
let lineInfo = new Map<number, EngineLine>()
let currentMultiPv = 1
/** Number of 'go' commands that did not get a 'bestmove' yet. */
let searchesInFlight = 0
/** Callbacks that wait for the engine to finish all searches. */
let idleWaiters: (() => void)[] = []
let searchGeneration = 0

function stockfishAssetUrls(): { js: string; wasm: string } {
  const base = `${import.meta.env.BASE_URL}stockfish/${STOCKFISH_BASE}`
  const js = new URL(`${base}.js`, window.location.origin).href
  const wasm = new URL(`${base}.wasm`, window.location.origin).href
  return { js, wasm }
}

function createWorker(): Worker {
  const { js, wasm } = stockfishAssetUrls()
  // Do not add ",worker" to the hash: Stockfish then waits as a pthread helper and never starts.
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

  const bestUci = parseBestMoveLine(line)
  const isBestMoveLine = line.startsWith('bestmove ')
  if (isBestMoveLine) {
    searchesInFlight = Math.max(0, searchesInFlight - 1)
  }

  const info = parseUciInfoLine(line)
  if (info && info.score && !info.isBound && searchFen) {
    const chess = new Chess(searchFen)
    const stm = chess.turn()
    const whitePovPawns = scoreToWhitePovPawns(info.score, stm)
    const previous = lineInfo.get(info.multipv)
    if (info.depth >= (previous?.depth ?? 0)) {
      lineInfo.set(info.multipv, {
        rank: info.multipv,
        depth: info.depth,
        whitePovPawns,
        pvUci: info.pv,
      })
    }
  }

  if (isBestMoveLine && pendingSearch) {
    const resolve = pendingSearch
    pendingSearch = null
    pendingReject = null
    const lines = [...lineInfo.values()].sort((a, b) => a.rank - b.rank)
    const top = lineInfo.get(1)
    const analysis: EngineAnalysis = {
      whitePovPawns: top?.whitePovPawns ?? 0,
      bestMoveUci: bestUci,
      depth: top?.depth ?? 0,
      lines,
    }
    lineInfo = new Map()
    resolve(analysis)
  }

  if (isBestMoveLine && searchesInFlight === 0) {
    const waiters = idleWaiters
    idleWaiters = []
    for (const wake of waiters) wake()
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

export async function analyzeFen(
  fen: string,
  movetimeMs = MOVETIME_MS,
  multiPv = 1,
): Promise<EngineAnalysis> {
  await ensureWorker()
  if (!worker) throw new Error('Stockfish worker not available')

  const generation = ++searchGeneration
  if (pendingSearch) {
    send('stop')
    rejectPending(new Error('Search superseded'))
  }
  // The single-thread engine crashes when it gets 'position' and 'go' during a search,
  // and its stale output would mix with the new search. Wait until the old search ends.
  if (searchesInFlight > 0) {
    await new Promise<void>((wake) => idleWaiters.push(wake))
    if (generation !== searchGeneration) throw new Error('Search superseded')
  }

  return new Promise<EngineAnalysis>((resolve, reject) => {
    pendingSearch = (analysis) => {
      if (generation !== searchGeneration) return
      resolve(analysis)
    }
    // Always reject: a superseded search must settle, also after the generation changed.
    pendingReject = reject

    searchFen = fen
    lineInfo = new Map()
    if (multiPv !== currentMultiPv) {
      send(`setoption name MultiPV value ${multiPv}`)
      currentMultiPv = multiPv
    }
    send(`position fen ${fen}`)
    searchesInFlight += 1
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
