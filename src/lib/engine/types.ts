export type PlayerColor = 'white' | 'black'

export type EngineScore =
  | { type: 'cp'; cp: number }
  | { type: 'mate'; mate: number }

export interface EngineAnalysis {
  /** Evaluation from White's perspective, in pawns (mate mapped to large +/-). */
  whitePovPawns: number
  bestMoveUci: string | null
  depth: number
}

export type MoveQuality =
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'game-blunder'

export interface ReviewMoveVerdict {
  quality: MoveQuality
  message: string
  tone: 'success' | 'error' | 'warning'
  lossPawns: number
  bestMoveSan: string | null
  userMoveSan: string
}
