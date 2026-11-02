import { LICHESS_API_ORIGIN } from './lichessApi'

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

/**
 * Export URL for GET /api/games/user/{username}.
 * Uses lichess.org directly so production builds work (static hosts have no /lichess proxy).
 * The browser sends a normal User-Agent, which Lichess requires (anonymous curl without UA gets 404).
 */
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
  return `${LICHESS_API_ORIGIN}/api/games/user/${username}?${params}`
}

/** Same path via the Vite dev/preview proxy (adds app User-Agent server-side). */
export function buildLichessGamesProxyUrl(query: LichessGamesQuery): string {
  const direct = buildLichessGamesUrl(query)
  return direct.replace(LICHESS_API_ORIGIN, '/lichess')
}
