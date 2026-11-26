import { describe, expect, it } from 'vitest'
import { parseBestMoveLine, parseUciInfoLine, scoreToWhitePovPawns } from './uciParse'

describe('parseUciInfoLine', () => {
  it('reads depth, multipv, centipawn score and pv', () => {
    const info = parseUciInfoLine(
      'info depth 23 seldepth 26 multipv 2 score cp -240 nodes 1653560 pv h5g5 f6e4 g5d8',
    )
    expect(info).toEqual({
      depth: 23,
      multipv: 2,
      score: { type: 'cp', cp: -240 },
      isBound: false,
      pv: ['h5g5', 'f6e4', 'g5d8'],
    })
  })

  it('reads a mate score', () => {
    const info = parseUciInfoLine('info depth 23 seldepth 2 multipv 1 score mate 1 pv h5f7')
    expect(info?.score).toEqual({ type: 'mate', mate: 1 })
  })

  it('uses multipv 1 when the line has no multipv field', () => {
    expect(parseUciInfoLine('info depth 10 score cp 15 pv e2e4')?.multipv).toBe(1)
  })

  it('marks lowerbound and upperbound scores as bounds', () => {
    expect(parseUciInfoLine('info depth 12 multipv 1 score cp 30 lowerbound pv e2e4')?.isBound).toBe(
      true,
    )
    expect(parseUciInfoLine('info depth 12 multipv 1 score cp 30 upperbound pv e2e4')?.isBound).toBe(
      true,
    )
  })

  it('returns null for a line that is not an info line', () => {
    expect(parseUciInfoLine('bestmove e2e4')).toBeNull()
  })
})

describe('parseBestMoveLine', () => {
  it('reads the best move', () => {
    expect(parseBestMoveLine('bestmove h5f3 ponder g8f6')).toBe('h5f3')
  })

  it('returns null when there is no legal move', () => {
    expect(parseBestMoveLine('bestmove (none)')).toBeNull()
  })
})

describe('scoreToWhitePovPawns', () => {
  it('keeps the sign when White is to move', () => {
    expect(scoreToWhitePovPawns({ type: 'cp', cp: 150 }, 'w')).toBe(1.5)
  })

  it('flips the sign when Black is to move', () => {
    expect(scoreToWhitePovPawns({ type: 'cp', cp: 150 }, 'b')).toBe(-1.5)
  })

  it('maps a mate for the side to move to a large positive value', () => {
    expect(scoreToWhitePovPawns({ type: 'mate', mate: 1 }, 'w')).toBeCloseTo(14.99)
    expect(scoreToWhitePovPawns({ type: 'mate', mate: 1 }, 'b')).toBeCloseTo(-14.99)
  })
})
