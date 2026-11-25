export type PlayerColor = 'white' | 'black'

export type EngineScore =
  | { type: 'cp'; cp: number }
  | { type: 'mate'; mate: number }

export interface EngineLine {
  /** 1-based MultiPV rank. */
  rank: number
  /** Evaluation of this line from White's perspective, in pawns. */
  whitePovPawns: number
  pvUci: string[]
  depth: number
}

export interface EngineAnalysis {
  /** Evaluation from White's perspective, in pawns (mate mapped to large +/-). */
  whitePovPawns: number
  bestMoveUci: string | null
  depth: number
  /** All MultiPV lines, sorted by rank. Has one line when MultiPV is 1. */
  lines: EngineLine[]
}

/** An opponent reply that punishes the move on the board. */
export interface OpponentReply {
  from: string
  to: string
  san: string
  rank: number
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
  /** Punishing opponent replies (mistake, blunder and game-blunder only). */
  opponentReplies: OpponentReply[]
}
