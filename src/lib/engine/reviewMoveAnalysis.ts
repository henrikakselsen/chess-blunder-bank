import { Chess } from 'chess.js'
import {
  buildReviewVerdict,
  classifyLossPawns,
  evalLossForPlayer,
} from './classifyMove'
import { analyzeFen, applyUciMove, uciToSan } from './stockfishClient'
import type { OpponentReply, PlayerColor, ReviewMoveVerdict } from './types'
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

  const fenAfterUser = chess.fen()

  if (isSameMoveAsSan(fenBefore, from, to, 'q', blunderSan)) {
    const rootForGameBlunder = await analyzeFen(fenBefore)
    const opponentReplies = await findPunishingReplies(
      fenAfterUser,
      rootForGameBlunder.whitePovPawns,
      player,
    )
    return buildReviewVerdict({
      quality: 'game-blunder',
      lossPawns: blunderThresholdPawns,
      bestMoveSan: null,
      userMoveSan: userMove.san,
      opponentReplies,
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

  const afterUser = await analyzeFen(fenAfterUser)
  const whiteAfterUser = afterUser.whitePovPawns

  const bestLoss = evalLossForPlayer(whiteBefore, whiteAfterBest, player)
  const userLoss = evalLossForPlayer(whiteBefore, whiteAfterUser, player)
  const lossVsBest = Math.max(0, userLoss - bestLoss)

  const quality = classifyLossPawns(lossVsBest, blunderThresholdPawns)

  const opponentReplies =
    quality === 'mistake' || quality === 'blunder'
      ? await findPunishingReplies(fenAfterUser, whiteBefore, player)
      : []

  return buildReviewVerdict({
    quality,
    lossPawns: lossVsBest,
    bestMoveSan,
    userMoveSan: userMove.san,
    opponentReplies,
  })
}

/** Search time and line count for the opponent-reply search after a bad move. */
const REPLY_MOVETIME_MS = 1500
const REPLY_MULTI_PV = 3
/** A reply other than the best one must gain at least this much for the opponent. */
const PUNISH_THRESHOLD_PAWNS = 1

/**
 * Finds the opponent's best replies after the user's move. The best reply is always kept.
 * Other replies are kept only when the opponent is at least PUNISH_THRESHOLD_PAWNS better
 * than before the user's move.
 */
async function findPunishingReplies(
  fenAfterUser: string,
  whiteBeforeUserMove: number,
  player: PlayerColor,
): Promise<OpponentReply[]> {
  let analysis
  try {
    analysis = await analyzeFen(fenAfterUser, REPLY_MOVETIME_MS, REPLY_MULTI_PV)
  } catch {
    return []
  }
  const replies: OpponentReply[] = []
  for (const line of analysis.lines) {
    const uci = line.pvUci[0]
    if (!uci) continue
    const lossForPlayer = evalLossForPlayer(whiteBeforeUserMove, line.whitePovPawns, player)
    if (line.rank > 1 && lossForPlayer < PUNISH_THRESHOLD_PAWNS) continue
    const san = uciToSan(fenAfterUser, uci)
    if (!san) continue
    replies.push({ from: uci.slice(0, 2), to: uci.slice(2, 4), san, rank: line.rank })
  }
  return replies
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
