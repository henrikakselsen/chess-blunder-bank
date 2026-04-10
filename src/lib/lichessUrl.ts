/** Lichess analysebrett fra FEN (erstatter mellomrom med understrek). */
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
