import { describe, expect, it } from 'vitest'
import { selectPunishingReplies } from './reviewMoveAnalysis'
import type { EngineLine } from './types'

/** Position after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Na5?? (White to move, Qxf7# is mate). */
const FEN_AFTER_NA5 = 'r1bqkbnr/pppp1ppp/8/n3p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'

function line(rank: number, whitePovPawns: number, firstMove: string): EngineLine {
  return { rank, whitePovPawns, pvUci: [firstMove], depth: 20 }
}

describe('selectPunishingReplies', () => {
  it('keeps the best line and the lines that punish by at least 1 pawn', () => {
    const replies = selectPunishingReplies(
      [line(1, 14.99, 'h5f7'), line(2, 3.5, 'c4f7'), line(3, 1.6, 'h5e5')],
      FEN_AFTER_NA5,
      0.5,
      'black',
    )
    expect(replies).toEqual([
      { from: 'h5', to: 'f7', san: 'Qxf7#', rank: 1 },
      { from: 'c4', to: 'f7', san: 'Bxf7+', rank: 2 },
      { from: 'h5', to: 'e5', san: 'Qxe5+', rank: 3 },
    ])
  })

  it('drops other lines that gain less than 1 pawn for the opponent', () => {
    const replies = selectPunishingReplies(
      [line(1, 14.99, 'h5f7'), line(2, 1.4, 'c4f7')],
      FEN_AFTER_NA5,
      0.5,
      'black',
    )
    expect(replies.map((r) => r.san)).toEqual(['Qxf7#'])
  })

  it('always keeps the best line, also when it does not punish', () => {
    const replies = selectPunishingReplies([line(1, 0.4, 'h5f7')], FEN_AFTER_NA5, 0.5, 'black')
    expect(replies.map((r) => r.rank)).toEqual([1])
  })

  it('measures the gain from the point of view of the player', () => {
    // White player: the eval goes down when Black punishes.
    const fenWhiteBlundered = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2'
    const replies = selectPunishingReplies(
      [line(1, -14.99, 'd8h4'), line(2, -0.2, 'd7d5')],
      fenWhiteBlundered,
      0,
      'white',
    )
    expect(replies.map((r) => r.san)).toEqual(['Qh4#'])
  })

  it('skips lines without a move and illegal moves', () => {
    const replies = selectPunishingReplies(
      [{ rank: 1, whitePovPawns: 5, pvUci: [], depth: 20 }, line(2, 5, 'a1a8')],
      FEN_AFTER_NA5,
      0.5,
      'black',
    )
    expect(replies).toEqual([])
  })
})
