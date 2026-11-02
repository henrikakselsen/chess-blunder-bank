import { Chess } from 'chess.js'
import {
  buildReviewVerdict,
  classifyLossPawns,
  evalLossForPlayer,
} from './classifyMove'
import { analyzeFen, applyUciMove, uciToSan } from './stockfishClient'
import type { PlayerColor, ReviewMoveVerdict } from './types'
import { sideToMoveFromFen } from '../sideToMove'

export async function analyzeReviewMove(params: {
  fenBefore: string
  from: string
  to: string
  blunderSan: string
  blunderThresholdPawns: number
}): Promise<ReviewMoveVerdict> {
  const { fenBefore, from, to, blunderSan, blunderThresholdPawns } = params
  const player: PlayerColor = sideToMoveFromFen(fenBefore)

  const chess = new Chess(fenBefore)
  const userMove = chess.move({ from, to, promotion: 'q' })
  if (!userMove) {
    return buildReviewVerdict({
      quality: 'blunder',
      lossPawns: blunderThresholdPawns,
      bestMoveSan: null,
      userMoveSan: '?',
    })
  }

  if (isSameMoveAsSan(fenBefore, from, to, 'q', blunderSan)) {
    return buildReviewVerdict({
      quality: 'game-blunder',
      lossPawns: blunderThresholdPawns,
      bestMoveSan: null,
      userMoveSan: userMove.san,
    })
  }

  const root = await analyzeFen(fenBefore)
  const whiteBefore = root.whitePovPawns

  let whiteAfterBest = whiteBefore
  let bestMoveSan: string | null = null
  if (root.bestMoveUci) {
    bestMoveSan = uciToSan(fenBefore, root.bestMoveUci)
    const fenAfterBest = applyUciMove(fenBefore, root.bestMoveUci)
    if (fenAfterBest) {
      const afterBest = await analyzeFen(fenAfterBest)
      whiteAfterBest = afterBest.whitePovPawns
    }
  }

  const fenAfterUser = chess.fen()
  const afterUser = await analyzeFen(fenAfterUser)
  const whiteAfterUser = afterUser.whitePovPawns

  const bestLoss = evalLossForPlayer(whiteBefore, whiteAfterBest, player)
  const userLoss = evalLossForPlayer(whiteBefore, whiteAfterUser, player)
  const lossVsBest = Math.max(0, userLoss - bestLoss)

  const quality = classifyLossPawns(lossVsBest, blunderThresholdPawns)

  return buildReviewVerdict({
    quality,
    lossPawns: lossVsBest,
    bestMoveSan,
    userMoveSan: userMove.san,
  })
}

function isSameMoveAsSan(
  fen: string,
  from: string,
  to: string,
  promotion: 'q' | 'r' | 'b' | 'n',
  san: string,
): boolean {
  const reference = new Chess(fen)
  let refMove
  try {
    refMove = reference.move(san)
  } catch {
    return false
  }
  if (!refMove) return false
  return (
    refMove.from === from &&
    refMove.to === to &&
    (refMove.promotion ?? 'q') === promotion
  )
}
