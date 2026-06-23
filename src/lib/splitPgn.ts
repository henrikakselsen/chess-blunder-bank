/** Split a multi-game PGN export into individual game strings. */
export function splitPgnGames(pgnText: string): string[] {
  const trimmed = pgnText.trim()
  if (!trimmed) return []
  const parts = trimmed.split(/\n\n(?=\[Event\s)/)
  return parts.map((p) => p.trim()).filter((p) => p.length > 0)
}
