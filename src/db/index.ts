import Dexie, { type EntityTable } from 'dexie'
import type {
  ImportBatchRow,
  ImportedGameRow,
  InstructiveMarkRow,
  MissedMateRow,
  MistakeRow,
  MistakeTagRow,
  TagRow,
} from './schema'

/** IndexedDB database (internal name unchanged so existing local data keeps working). */
export class BlunderBankDB extends Dexie {
  importedGames!: EntityTable<ImportedGameRow, 'gameId'>
  mistakes!: EntityTable<MistakeRow, 'id'>
  tags!: EntityTable<TagRow, 'id'>
  mistakeTags!: EntityTable<MistakeTagRow, 'id'>
  missedMates!: EntityTable<MissedMateRow, 'id'>
  importBatches!: EntityTable<ImportBatchRow, 'id'>
  instructiveMarks!: EntityTable<InstructiveMarkRow, 'id'>

  constructor() {
    super('chess-learning-v1')
    this.version(1).stores({
      importedGames: 'gameId, importedAt',
      mistakes: '++id, gameId, reviewed, createdAt',
      tags: '++id, &name',
      mistakeTags: '++id, [mistakeId+tagId], mistakeId, tagId',
    })
    this.version(2).stores({
      importedGames: 'gameId, importedAt',
      mistakes: '++id, gameId, reviewed, createdAt',
      tags: '++id, &name',
      mistakeTags: '++id, [mistakeId+tagId], mistakeId, tagId',
      missedMates: '++id, gameId, mateIn, reviewed, createdAt',
    })
    this.version(3).stores({
      importedGames: 'gameId, importedAt',
      mistakes: '++id, gameId, reviewed, createdAt',
      tags: '++id, &name',
      mistakeTags: '++id, [mistakeId+tagId], mistakeId, tagId',
      missedMates: '++id, gameId, mateIn, reviewed, createdAt',
      importBatches: '++id, importedAt',
    })
    this.version(4).stores({
      importedGames: 'gameId, importedAt',
      mistakes: '++id, gameId, reviewed, createdAt',
      tags: '++id, &name',
      mistakeTags: '++id, [mistakeId+tagId], mistakeId, tagId',
      missedMates: '++id, gameId, mateIn, reviewed, createdAt',
      importBatches: '++id, importedAt',
      // Not cleared by re-import or "Replace all", so stars survive.
      instructiveMarks: '++id, &[kind+gameId+ply], kind',
    })
  }
}

export const db = new BlunderBankDB()
