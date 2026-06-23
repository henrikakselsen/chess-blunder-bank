import { db } from '../db'

/** Remove blunders, mate puzzles, and tag links for one game. */
export async function deleteGameFindings(gameId: string): Promise<void> {
  const mistakes = await db.mistakes.where('gameId').equals(gameId).toArray()
  const mistakeIds = mistakes.map((m) => m.id).filter((id): id is number => id != null)

  await db.transaction('rw', db.mistakes, db.mistakeTags, db.missedMates, async () => {
    for (const mistakeId of mistakeIds) {
      await db.mistakeTags.where('mistakeId').equals(mistakeId).delete()
    }
    await db.mistakes.where('gameId').equals(gameId).delete()
    await db.missedMates.where('gameId').equals(gameId).delete()
  })
}

/** Clear all imported games and findings; keeps tags and import history. */
export async function clearAllGameData(): Promise<void> {
  await db.transaction(
    'rw',
    db.importedGames,
    db.mistakes,
    db.mistakeTags,
    db.missedMates,
    async () => {
      await db.mistakeTags.clear()
      await db.mistakes.clear()
      await db.missedMates.clear()
      await db.importedGames.clear()
    },
  )
}
