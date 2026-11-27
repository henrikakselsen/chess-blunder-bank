import { describe, expect, it } from 'vitest'
import { positionKey, selectInstructive } from './instructive'

const rows = [
  { id: 1, gameId: 'a', ply: 10 },
  { id: 2, gameId: 'a', ply: 12 },
  { id: 3, gameId: 'b', ply: 10 },
]

describe('selectInstructive', () => {
  it('keeps only rows with a star', () => {
    const starred = new Set([positionKey('a', 12), positionKey('b', 10)])
    expect(selectInstructive(rows, starred, new Set()).map((r) => r.id)).toEqual([2, 3])
  })

  it('keeps a sticky row after the star is removed', () => {
    expect(selectInstructive(rows, new Set(), new Set([1])).map((r) => r.id)).toEqual([1])
  })

  it('matches on game and ply, not on the row id', () => {
    const reimported = [{ id: 99, gameId: 'a', ply: 10 }]
    expect(selectInstructive(reimported, new Set([positionKey('a', 10)]), new Set())).toHaveLength(1)
  })
})
