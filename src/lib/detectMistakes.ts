import { Chess } from 'chess.js'
import type { PgnMove } from '@mliebelt/pgn-types'
import { getEvalFromMove } from './eval'

/** One detected blunder: position before your move, SAN, eval before/after (White POV). */
export interface DetectedMistake {
  fenBefore: string
  moveSan: string
  evalBefore: number
  evalAfter: number
  ply: number
}

function sanFromPgnMove(m: PgnMove): string {
  let s = m.notation.notation
  s = s.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O')
  return s
}

/** Walk the main line and collect positions where your move drops eval by at least `thresholdPawns`. */
export function detectMistakesInGame(
  mainLine: PgnMove[],
  myColor: 'white' | 'black',
  thresholdPawns: number,
): DetectedMistake[] {
  const chess = new Chess()
  const out: DetectedMistake[] = []
  let lastEval = 0
  let ply = 0

  for (const move of mainLine) {
    const turn = chess.turn()
    const myTurn =
      (turn === 'w' && myColor === 'white') ||
      (turn === 'b' && myColor === 'black')

    const fenBefore = chess.fen()
    const evalBefore = lastEval
    const san = sanFromPgnMove(move)
    const played = chess.move(san)
    if (!played) {
      throw new Error(`Could not play move "${san}" in this position.`)
    }
    ply += 1

    const evalAfter = getEvalFromMove(move)
    if (evalAfter !== null) {
      lastEval = evalAfter
    }

    if (myTurn && evalAfter !== null) {
      const delta = evalAfter - evalBefore
      const isMistake =
        myColor === 'white'
          ? delta <= -thresholdPawns
          : delta >= thresholdPawns
      if (isMistake) {
        out.push({
          fenBefore,
          moveSan: san,
          evalBefore,
          evalAfter,
          ply,
        })
      }
    }
  }

  return out
}
