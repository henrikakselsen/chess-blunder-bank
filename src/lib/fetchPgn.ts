import { LICHESS_API_ORIGIN } from './lichessApi'

/**
 * Fetch PGN from Lichess (`https://lichess.org/api/...`) or dev proxy `/lichess/api/...`.
 */
export async function fetchPgnFromUrl(url: string): Promise<string> {
  const u = url.trim()
  const res = await fetch(u, {
    headers: { Accept: 'application/x-chess-pgn' },
  })
  if (!res.ok) {
    const body = (await res.text()).trim()
    const snippet = body.startsWith('{') ? body : body.slice(0, 160)
    throw new Error(formatLichessFetchError(res.status, res.statusText, snippet, u))
  }
  const text = await res.text()
  if (!text.trim()) {
    throw new Error('Lichess returned an empty PGN export (no games matched the filters).')
  }
  return text
}

function formatLichessFetchError(
  status: number,
  statusText: string,
  bodySnippet: string,
  url: string,
): string {
  const viaProxy = url.includes('/lichess/')
  const base = `HTTP ${status} ${statusText}`
  if (status === 404 && viaProxy) {
    return `${base}. The /lichess proxy is only available with npm run dev or npm run preview — not on static hosting.`
  }
  if (status === 404) {
    return `${base}. Lichess often returns 404 when the request has no identifying User-Agent; use Fetch in the app (not raw curl) or check the username.`
  }
  if (status === 429) {
    return `${base}. Lichess rate limit — wait a few seconds and try again (one export at a time). ${bodySnippet}`
  }
  if (bodySnippet) {
    return `${base}. ${bodySnippet}`
  }
  return base
}

/** Prefer direct API in the browser; fall back to dev proxy if CORS blocks the request. */
export async function fetchLichessGamesPgn(directUrl: string, proxyUrl: string): Promise<string> {
  try {
    return await fetchPgnFromUrl(directUrl)
  } catch (e) {
    if (!shouldTryLichessProxy(e, directUrl)) {
      throw e
    }
    return await fetchPgnFromUrl(proxyUrl)
  }
}

function shouldTryLichessProxy(error: unknown, directUrl: string): boolean {
  if (!directUrl.startsWith(LICHESS_API_ORIGIN)) return false
  if (!(error instanceof Error)) return false
  if (import.meta.env.PROD) return false
  const msg = error.message
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('CORS')
  )
}
