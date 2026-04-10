export interface ImportedGameRow {
  gameId: string
  importedAt: number
}

export interface MistakeRow {
  id?: number
  gameId: string
  fenBefore: string
  moveSan: string
  evalBefore: number
  evalAfter: number
  ply: number
  gameUrl: string
  comment: string
  reviewed: boolean
  reviewedAt?: number
  createdAt: number
}

export interface TagRow {
  id?: number
  name: string
}

export interface MistakeTagRow {
  id?: number
  mistakeId: number
  tagId: number
}
