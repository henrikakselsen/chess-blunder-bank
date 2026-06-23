/**
 * Lichess encodes [%eval …] in PGN — typically pawns from White’s perspective, or mate (#±n).
 * @mliebelt/pgn-parser may put numeric centipawn/pawn evals in commentDiag.eval as a number.
 */
export function extractEvalTokenFromText(text: string): string | null {
  const m = text.match(/\[#?%eval\s+([^\]]+)\]/i)
  return m?.[1]?.trim() ?? null
}

function evalFieldToRaw(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') {
    const t = value.trim()
    return t || null
  }
  if (typeof value === 'boolean') return null
  return String(value)
}

/** Merge all comment fields from a half-move in pgn-parser output. */
export function evalRawFromPgnComments(move: {
  commentMove?: string
  commentAfter?: string
  commentDiag?: { comment?: string; eval?: unknown }
}): string | null {
  const fromDiag = evalFieldToRaw(move.commentDiag?.eval)
  if (fromDiag) return fromDiag
  const blob = [move.commentMove, move.commentAfter, move.commentDiag?.comment]
    .filter(Boolean)
    .join(' ')
  return extractEvalTokenFromText(blob)
}

/**
 * Parse a Lichess eval string to a number (positive = better for White).
 * Mate: #+3 ≈ White is winning soon, #-3 ≈ Black is winning soon (rough heuristic).
 */
export function parseEvalToNumber(raw: string): number | null {
  const t = raw.trim()
  if (t.startsWith('#')) {
    const rest = t.slice(1).trim()
    if (rest.startsWith('+')) {
      const n = Number.parseInt(rest.slice(1), 10)
      if (Number.isFinite(n)) return 15 - n * 0.01
    }
    if (rest.startsWith('-')) {
      const n = Number.parseInt(rest.slice(1), 10)
      if (Number.isFinite(n)) return -15 + n * 0.01
    }
    const plain = Number.parseInt(rest, 10)
    if (Number.isFinite(plain)) {
      return plain > 0 ? 15 - plain * 0.01 : -15 - plain * 0.01
    }
    return null
  }
  const v = Number.parseFloat(t.replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

export function getEvalFromMove(move: {
  commentMove?: string
  commentAfter?: string
  commentDiag?: { comment?: string; eval?: unknown }
}): number | null {
  const raw = evalRawFromPgnComments(move)
  if (!raw) return null
  return parseEvalToNumber(raw)
}

/** Mate depth from Lichess `#N` (White) / `#-N` (Black) when it is the given player's turn. */
export function parseMateForPlayer(
  raw: string,
  myColor: 'white' | 'black',
): { mateIn: number } | null {
  const t = raw.trim()
  if (!t.startsWith('#')) return null
  const rest = t.slice(1).trim()
  let mateIn: number | null = null
  if (rest.startsWith('-')) {
    const n = Number.parseInt(rest.slice(1), 10)
    if (Number.isFinite(n) && n > 0 && myColor === 'black') mateIn = n
  } else {
    const n = Number.parseInt(rest.replace(/^\+/, ''), 10)
    if (Number.isFinite(n) && n > 0 && myColor === 'white') mateIn = n
  }
  if (mateIn == null || mateIn > 2) return null
  return { mateIn }
}
