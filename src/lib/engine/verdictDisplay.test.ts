import { describe, expect, it } from 'vitest'
import type { MoveQuality } from './types'
import { formatLoss, sanToSquares, tintStyle, verdictDisplay } from './verdictDisplay'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ALL: MoveQuality[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder', 'game-blunder']

describe('verdictDisplay', () => {
  it('gives a label, a symbol and a colour for each quality', () => {
    for (const q of ALL) {
      const d = verdictDisplay(q)
      expect(d.label).not.toBe('')
      expect(d.symbol).not.toBe('')
      expect(d.color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('uses the standard chess symbols', () => {
    expect(verdictDisplay('inaccuracy').symbol).toBe('?!')
    expect(verdictDisplay('mistake').symbol).toBe('?')
    expect(verdictDisplay('blunder').symbol).toBe('??')
  })

  it('marks only best and good as positive', () => {
    expect(ALL.filter((q) => verdictDisplay(q).positive)).toEqual(['best', 'good'])
  })
})

describe('formatLoss', () => {
  it('shows the loss with a minus sign', () => {
    expect(formatLoss('mistake', 1.234)).toBe('−1.23')
  })

  it('is empty for the best move and the game move', () => {
    expect(formatLoss('best', 0.05)).toBe('')
    expect(formatLoss('game-blunder', 3)).toBe('')
  })

  it('does not show a negative loss', () => {
    expect(formatLoss('good', -0.2)).toBe('−0.00')
  })
})

describe('sanToSquares', () => {
  it('finds the squares of a legal move', () => {
    expect(sanToSquares(START, 'Nf3')).toEqual({ from: 'g1', to: 'f3' })
  })

  it('returns null for an illegal or missing move', () => {
    expect(sanToSquares(START, 'Nf6')).toBeNull()
    expect(sanToSquares(START, null)).toBeNull()
  })
})

describe('tintStyle', () => {
  it('makes an inset shadow in the colour', () => {
    expect(tintStyle('#f0705f', 0.5)).toEqual({
      boxShadow: 'inset 0 0 0 999px rgba(240, 112, 95, 0.5)',
    })
  })
})
