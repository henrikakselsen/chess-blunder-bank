/**
 * Lichess bruker [%eval …] i PGN — typisk bønder fra hvits perspektiv, eller matt (#±n).
 */
export function extractEvalTokenFromText(text: string): string | null {
  const m = text.match(/\[#?%eval\s+([^\]]+)\]/i)
  return m?.[1]?.trim() ?? null
}

/** Slår sammen alle kommentarfelt fra et trekk i pgn-parser. */
export function evalRawFromPgnComments(move: {
  commentMove?: string
  commentAfter?: string
  commentDiag?: { comment?: string; eval?: string }
}): string | null {
  const fromDiag = move.commentDiag?.eval?.trim()
  if (fromDiag) return fromDiag
  const blob = [move.commentMove, move.commentAfter, move.commentDiag?.comment]
    .filter(Boolean)
    .join(' ')
  return extractEvalTokenFromText(blob)
}

/**
 * Tolker Lichess eval-streng til et tall (hvit bedre = positivt).
 * Matt: #+3 ≈ hvit vinner snart, #-3 ≈ svart vinner snart (grovt heuristisk).
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
  commentDiag?: { comment?: string; eval?: string }
}): number | null {
  const raw = evalRawFromPgnComments(move)
  if (!raw) return null
  return parseEvalToNumber(raw)
}
