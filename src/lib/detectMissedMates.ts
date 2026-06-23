import { Chess } from 'chess.js'
import type { PgnMove } from '@mliebelt/pgn-types'
import { evalRawFromPgnComments, parseMateForPlayer } from './eval'
import {
  computeMateIn1FirstMoves,
  computeMateIn2Lines,
  firstMovesFromLines,
} from './mateSolutions'

export interface DetectedMissedMate {
  fenBefore: string
  mateIn: 1 | 2
  myColor: 'white' | 'black'
  movePlayedSan: string
  solutionLines: string[][]
  ply: number
}

function sanFromPgnMove(m: PgnMove): string {
  let s = m.notation.notation
  s = s.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O')
  return s
}

export function detectMissedMatesInGame(
  mainLine: PgnMove[],
  myColor: 'white' | 'black',
): DetectedMissedMate[] {
  const chess = new Chess()
  const out: DetectedMissedMate[] = []
  let lastEvalRaw: string | null = null
  let ply = 0

  for (const move of mainLine) {
    const turn = chess.turn()
    const myTurn =
      (turn === 'w' && myColor === 'white') ||
      (turn === 'b' && myColor === 'black')

    const fenBefore = chess.fen()
    const mateHint =
      myTurn && lastEvalRaw
        ? parseMateForPlayer(lastEvalRaw, myColor)
        : null

    const san = sanFromPgnMove(move)
    const played = chess.move(san)
    if (!played) {
      throw new Error(`Could not play move "${san}" in this position.`)
    }
    ply += 1

    const evalRaw = evalRawFromPgnComments(move)
    if (evalRaw) lastEvalRaw = evalRaw

    if (!myTurn || !mateHint) continue

    const mateIn = mateHint.mateIn as 1 | 2
    if (mateIn === 1) {
      const solutions = computeMateIn1FirstMoves(fenBefore)
      if (solutions.length === 0) continue
      if (solutions.includes(san)) continue
      out.push({
        fenBefore,
        mateIn: 1,
        myColor,
        movePlayedSan: san,
        solutionLines: solutions.map((m) => [m]),
        ply,
      })
    } else {
      const lines = computeMateIn2Lines(fenBefore)
      const validFirst = firstMovesFromLines(lines)
      if (validFirst.length === 0) continue
      if (validFirst.includes(san)) continue
      out.push({
        fenBefore,
        mateIn: 2,
        myColor,
        movePlayedSan: san,
        solutionLines: lines,
        ply,
      })
    }
  }

  return out
}
