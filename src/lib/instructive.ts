/** Key for one position in a game. Stars use it, so they survive a re-import. */
export function positionKey(gameId: string, ply: number): string {
  return `${gameId}:${ply}`
}

/**
 * Rows for an "instructive" session: rows with a star, plus rows in `stickyIds`.
 * Sticky rows stay in the current session after the user removes the star.
 */
export function selectInstructive<T extends { id?: number; gameId: string; ply: number }>(
  rows: T[],
  starred: Set<string>,
  stickyIds: Set<number>,
): T[] {
  return rows.filter(
    (r) =>
      starred.has(positionKey(r.gameId, r.ply)) || (r.id != null && stickyIds.has(r.id)),
  )
}
