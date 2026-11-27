import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './index'
import type { InstructiveKind } from './schema'
import { positionKey } from '../lib/instructive'

/** Live set of position keys (`gameId:ply`) with a star, for one kind. */
export function useInstructiveKeys(kind: InstructiveKind): Set<string> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.instructiveMarks.where('kind').equals(kind).toArray()
    return new Set(rows.map((r) => positionKey(r.gameId, r.ply)))
  }, [kind])
}

/** Adds the star if it is not there. Removes the star if it is there. */
export async function toggleInstructive(
  kind: InstructiveKind,
  gameId: string,
  ply: number,
): Promise<void> {
  await db.transaction('rw', db.instructiveMarks, async () => {
    const existing = await db.instructiveMarks
      .where('[kind+gameId+ply]')
      .equals([kind, gameId, ply])
      .first()
    if (existing?.id != null) {
      await db.instructiveMarks.delete(existing.id)
    } else {
      await db.instructiveMarks.add({ kind, gameId, ply, createdAt: Date.now() })
    }
  })
}

/** Removes the star, if there is one. Use it when the position is deleted. */
export async function removeInstructive(
  kind: InstructiveKind,
  gameId: string,
  ply: number,
): Promise<void> {
  await db.instructiveMarks.where('[kind+gameId+ply]').equals([kind, gameId, ply]).delete()
}
