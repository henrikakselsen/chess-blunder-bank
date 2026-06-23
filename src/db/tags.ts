import { db } from './index'

export async function listTagsOrdered() {
  return db.tags.orderBy('name').toArray()
}

export async function getOrCreateTagByName(raw: string): Promise<number> {
  const name = raw.trim()
  if (!name) throw new Error('Tag name cannot be empty')
  const existing = await db.tags.where('name').equals(name).first()
  if (existing?.id != null) return existing.id
  const id = await db.tags.add({ name })
  if (typeof id !== 'number') throw new Error('Could not create tag')
  return id
}

export async function getTagIdsForMistake(mistakeId: number): Promise<number[]> {
  const rows = await db.mistakeTags.where('mistakeId').equals(mistakeId).toArray()
  return rows.map((r) => r.tagId)
}

export async function setMistakeTags(mistakeId: number, tagIds: number[]): Promise<void> {
  await db.transaction('rw', db.mistakeTags, async () => {
    await db.mistakeTags.where('mistakeId').equals(mistakeId).delete()
    for (const tagId of tagIds) {
      await db.mistakeTags.add({ mistakeId, tagId })
    }
  })
}
