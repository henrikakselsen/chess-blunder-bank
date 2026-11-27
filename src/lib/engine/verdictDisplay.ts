import { Chess } from 'chess.js'
import type { MoveQuality } from './types'

export interface VerdictDisplay {
  /** The big word on the verdict card. */
  label: string
  /** The symbol on the card and on the board badge. */
  symbol: string
  /** One colour for the card, the square tint and the badge. */
  color: string
  /** One short sentence below the label. */
  summary: string
  /** True when the move is good enough to go on to the next position. */
  positive: boolean
}

const DISPLAY: Record<MoveQuality, VerdictDisplay> = {
  best: {
    label: 'Best',
    symbol: '✓',
    color: '#5fc58c',
    summary: 'You found the engine move.',
    positive: true,
  },
  good: {
    label: 'Good',
    symbol: '+',
    color: '#9fd27a',
    summary: 'A solid move. The engine move is a little better.',
    positive: true,
  },
  inaccuracy: {
    label: 'Inaccuracy',
    symbol: '?!',
    color: '#f0b23e',
    summary: 'Playable, but you lose some of your advantage.',
    positive: false,
  },
  mistake: {
    label: 'Mistake',
    symbol: '?',
    color: '#f08a4b',
    summary: 'This move gives your opponent a clear advantage.',
    positive: false,
  },
  blunder: {
    label: 'Blunder',
    symbol: '??',
    color: '#f0705f',
    summary: 'This move loses a lot.',
    positive: false,
  },
  'game-blunder': {
    label: 'Same as the game',
    symbol: '↺',
    color: '#f0705f',
    summary: 'This is the move you played in the game. Find a better move.',
    positive: false,
  },
}

export function verdictDisplay(quality: MoveQuality): VerdictDisplay {
  return DISPLAY[quality]
}

/** Text for the cost of a move, for example "−1.25". Empty for the best move and the game move. */
export function formatLoss(quality: MoveQuality, lossPawns: number): string {
  if (quality === 'best' || quality === 'game-blunder') return ''
  return `−${Math.max(0, lossPawns).toFixed(2)}`
}

/** The from and to squares of a SAN move in a position, or null if the move is not legal. */
export function sanToSquares(fen: string, san: string | null): { from: string; to: string } | null {
  if (!san) return null
  try {
    const move = new Chess(fen).move(san)
    return { from: move.from, to: move.to }
  } catch {
    return null
  }
}

/** A square style that tints the square in the verdict colour. */
export function tintStyle(color: string, alpha: number): { boxShadow: string } {
  const n = Number.parseInt(color.slice(1), 16)
  const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
  return { boxShadow: `inset 0 0 0 999px rgba(${rgb}, ${alpha})` }
}
