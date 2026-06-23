/** Lichess analysis board URL from FEN (spaces replaced with underscores). */
export function lichessAnalysisUrl(fen: string): string {
  const path = fen.trim().replace(/\s+/g, '_')
  return `https://lichess.org/analysis/${path}`
}

export function extractLichessGameId(site: string | undefined): string | null {
  if (!site) return null
  const m = site.match(/lichess\.org\/(?:embed\/)?([a-zA-Z0-9]{8})\b/i)
  return m?.[1] ?? null
}

export function normalizeLichessUsername(name: string): string {
  return name.trim().toLowerCase()
}

export interface LichessGamesQuery {
  username: string
  max: number
  tags: boolean
  evals: boolean
  analysed: boolean
  clocks: boolean
  opening: boolean
}

/** Build a fetch URL via the dev proxy (`/lichess` → lichess.org). */
export function buildLichessGamesUrl(query: LichessGamesQuery): string {
  const username = encodeURIComponent(query.username.trim())
  const params = new URLSearchParams({
    tags: String(query.tags),
    evals: String(query.evals),
    analysed: String(query.analysed),
    clocks: String(query.clocks),
    opening: String(query.opening),
    max: String(query.max),
  })
  return `/lichess/api/games/user/${username}?${params}`
}
