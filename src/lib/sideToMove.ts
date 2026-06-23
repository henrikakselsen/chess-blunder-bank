import { Chess } from 'chess.js'

export function sideToMoveFromFen(fen: string): 'white' | 'black' {
  try {
    return new Chess(fen).turn() === 'w' ? 'white' : 'black'
  } catch {
    return 'white'
  }
}
