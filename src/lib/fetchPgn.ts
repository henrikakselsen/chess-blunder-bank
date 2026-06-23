/**
 * Fetch PGN from Lichess. Use a full `https://lichess.org/...` URL or dev proxy path `/lichess/api/...`.
 */
export async function fetchPgnFromUrl(url: string): Promise<string> {
  const u = url.trim()
  const res = await fetch(u, {
    headers: { Accept: 'application/x-chess-pgn' },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  return res.text()
}
