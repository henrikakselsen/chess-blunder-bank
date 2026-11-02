import type { EngineScore } from './types'

export function parseUciInfoLine(line: string): {
  depth: number
  score: EngineScore | null
  pv: string[]
} | null {
  if (!line.startsWith('info ')) return null
  const parts = line.split(/\s+/)
  let depth = 0
  let score: EngineScore | null = null
  const pv: string[] = []
  let i = 1
  while (i < parts.length) {
    const token = parts[i]
    if (token === 'depth' && parts[i + 1]) {
      depth = Number.parseInt(parts[i + 1], 10) || 0
      i += 2
      continue
    }
    if (token === 'score' && parts[i + 1] && parts[i + 2]) {
      const kind = parts[i + 1]
      const value = Number.parseInt(parts[i + 2], 10)
      if (kind === 'cp' && Number.isFinite(value)) {
        score = { type: 'cp', cp: value }
      } else if (kind === 'mate' && Number.isFinite(value)) {
        score = { type: 'mate', mate: value }
      }
      i += 3
      continue
    }
    if (token === 'pv') {
      pv.push(...parts.slice(i + 1))
      break
    }
    i += 1
  }
  if (!depth && !score && pv.length === 0) return null
  return { depth, score, pv }
}

export function parseBestMoveLine(line: string): string | null {
  if (!line.startsWith('bestmove ')) return null
  const move = line.split(/\s+/)[1]
  if (!move || move === '(none)') return null
  return move
}

/** UCI score is from the side to move; convert to White POV in pawns. */
export function scoreToWhitePovPawns(score: EngineScore, sideToMove: 'w' | 'b'): number {
  if (score.type === 'cp') {
    const cpWhite = sideToMove === 'w' ? score.cp : -score.cp
    return cpWhite / 100
  }
  const mate = score.mate
  const stmPawns =
    mate > 0 ? 15 - mate * 0.01 : -15 + Math.abs(mate) * 0.01
  return sideToMove === 'w' ? stmPawns : -stmPawns
}
