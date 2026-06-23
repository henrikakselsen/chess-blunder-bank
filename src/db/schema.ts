export interface ImportedGameRow {
  gameId: string
  importedAt: number
  /** Raw PGN for one game — stored at import. */
  pgn?: string
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

export interface MissedMateRow {
  id?: number
  gameId: string
  fenBefore: string
  mateIn: 1 | 2
  myColor: 'white' | 'black'
  movePlayedSan: string
  /** SAN sequences: mate in 1 = one move; mate in 2 = [user, opponent, mate]. */
  solutionLines: string[][]
  ply: number
  gameUrl: string
  reviewed: boolean
  reviewedAt?: number
  createdAt: number
}
