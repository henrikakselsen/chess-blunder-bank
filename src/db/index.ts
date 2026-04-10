import Dexie, { type EntityTable } from 'dexie'
import type { ImportedGameRow, MistakeRow, MistakeTagRow, TagRow } from './schema'

export class ChessLearningDB extends Dexie {
  importedGames!: EntityTable<ImportedGameRow, 'gameId'>
  mistakes!: EntityTable<MistakeRow, 'id'>
  tags!: EntityTable<TagRow, 'id'>
  mistakeTags!: EntityTable<MistakeTagRow, 'id'>

  constructor() {
    super('chess-learning-v1')
    this.version(1).stores({
      importedGames: 'gameId, importedAt',
      mistakes: '++id, gameId, reviewed, createdAt',
      tags: '++id, &name',
      mistakeTags: '++id, [mistakeId+tagId], mistakeId, tagId',
    })
  }
}

export const db = new ChessLearningDB()
