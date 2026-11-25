import type { MoveQuality, OpponentReply, PlayerColor, ReviewMoveVerdict } from './types'

export function evalLossForPlayer(
  whitePovBefore: number,
  whitePovAfter: number,
  player: PlayerColor,
): number {
  const delta = whitePovAfter - whitePovBefore
  return player === 'white' ? -delta : delta
}

export function classifyLossPawns(lossPawns: number, blunderThreshold: number): MoveQuality {
  if (lossPawns < 0.15) return 'best'
  if (lossPawns < 0.5) return 'good'
  if (lossPawns < 1) return 'inaccuracy'
  if (lossPawns < blunderThreshold) return 'mistake'
  return 'blunder'
}

function qualityMessage(
  quality: MoveQuality,
  lossPawns: number,
  bestMoveSan: string | null,
): { message: string; tone: 'success' | 'error' | 'warning' } {
  const loss = lossPawns.toFixed(2)
  switch (quality) {
    case 'best':
      return {
        message: bestMoveSan
          ? `Best move (${bestMoveSan}). Engine loss ≈ ${loss} pawns.`
          : `Best move. Engine loss ≈ ${loss} pawns.`,
        tone: 'success',
      }
    case 'good':
      return {
        message: `Good — small inaccuracy (≈ ${loss} pawns vs engine line).${
          bestMoveSan ? ` Best was ${bestMoveSan}.` : ''
        }`,
        tone: 'success',
      }
    case 'inaccuracy':
      return {
        message: `Inaccuracy — about ${loss} pawns worse than best.${
          bestMoveSan ? ` Try ${bestMoveSan}.` : ''
        }`,
        tone: 'warning',
      }
    case 'mistake':
      return {
        message: `Mistake — about ${loss} pawns lost vs best.${
          bestMoveSan ? ` Best was ${bestMoveSan}.` : ''
        }`,
        tone: 'error',
      }
    case 'blunder':
      return {
        message: `Blunder — about ${loss} pawns lost vs best.${
          bestMoveSan ? ` Best was ${bestMoveSan}.` : ''
        }`,
        tone: 'error',
      }
    case 'game-blunder':
      return {
        message: 'That is the blunder you played in the game — find a better move.',
        tone: 'error',
      }
  }
}

export function buildReviewVerdict(params: {
  quality: MoveQuality
  lossPawns: number
  bestMoveSan: string | null
  userMoveSan: string
  opponentReplies?: OpponentReply[]
}): ReviewMoveVerdict {
  const { message, tone } = qualityMessage(params.quality, params.lossPawns, params.bestMoveSan)
  const opponentReplies = params.opponentReplies ?? []
  return {
    quality: params.quality,
    message: message + threatText(opponentReplies),
    opponentReplies,
    tone,
    lossPawns: params.lossPawns,
    bestMoveSan: params.bestMoveSan,
    userMoveSan: params.userMoveSan,
  }
}

function threatText(replies: OpponentReply[]): string {
  if (replies.length === 0) return ''
  const [first, ...rest] = replies
  const also = rest.length > 0 ? ` (also ${rest.map((r) => r.san).join(', ')})` : ''
  return ` Threat: ${first.san}${also}.`
}
