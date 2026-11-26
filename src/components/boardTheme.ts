import type { CSSProperties } from 'react'

/** Square colours for react-chessboard in the "analysis" theme. */
export const boardThemeOptions: {
  boardStyle: CSSProperties
  lightSquareStyle: CSSProperties
  darkSquareStyle: CSSProperties
  lightSquareNotationStyle: CSSProperties
  darkSquareNotationStyle: CSSProperties
} = {
  boardStyle: { borderRadius: 2, overflow: 'hidden' },
  lightSquareStyle: { backgroundColor: '#c5cfcd' },
  darkSquareStyle: { backgroundColor: '#58737c' },
  lightSquareNotationStyle: { color: '#58737c' },
  darkSquareNotationStyle: { color: '#c5cfcd' },
}

export const blunderArrowColor = '#f0705f'

export const blunderSquareStyle: CSSProperties = {
  boxShadow: 'inset 0 0 0 999px rgba(240, 178, 62, 0.5)',
}

/** White's share of the eval bar in percent, from an eval in pawns (White's perspective). */
export function whiteSharePercent(evalPawns: number): number {
  const share = 100 / (1 + Math.exp(-0.368208 * evalPawns))
  return Math.min(97, Math.max(3, share))
}

/** Board width in pixels. The value leaves space for the page gutter and the eval bar. */
export function boardSize(): number {
  if (typeof window === 'undefined') return 480
  return Math.min(520, Math.floor(window.innerWidth - 64))
}
