import type { Tags } from '@mliebelt/pgn-types'

function getStr(tags: Tags | undefined, key: string): string {
  if (!tags) return ''
  const v = (tags as Record<string, unknown>)[key]
  if (typeof v === 'string') return v
  return ''
}

/** Stable game id when there is no Lichess Site tag (e.g. plain PGN file). */
export function stableOfflineGameId(tags: Tags | undefined, moveCount: number): string {
  const w = getStr(tags, 'White')
  const b = getStr(tags, 'Black')
  const d = getStr(tags, 'Date')
  const r = getStr(tags, 'Result')
  const key = `${w}|${b}|${d}|${r}|${moveCount}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `offline-${(h >>> 0).toString(16)}`
}
