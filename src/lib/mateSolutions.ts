import { Chess } from 'chess.js'

/** All first moves that deliver immediate checkmate. */
export function computeMateIn1FirstMoves(fen: string): string[] {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const san of chess.moves()) {
    const trial = new Chess(fen)
    trial.move(san)
    if (trial.isCheckmate()) out.push(san)
  }
  return out
}

/**
 * Mate-in-2 lines as [yourMove, opponentReply, mateMove].
 * Only includes your first moves that force mate on every legal reply.
 */
export function computeMateIn2Lines(fen: string): string[][] {
  const chess = new Chess(fen)
  const lines: string[][] = []

  for (const first of chess.moves({ verbose: true })) {
    const afterFirst = new Chess(fen)
    afterFirst.move(first)
    if (afterFirst.isCheckmate()) continue

    const replies = afterFirst.moves({ verbose: true })
    if (replies.length === 0) continue

    let forcesMate = true
    const branchLines: string[][] = []

    for (const reply of replies) {
      const afterReply = new Chess(afterFirst.fen())
      afterReply.move(reply)
      let mateFound = false
      for (const mateMove of afterReply.moves({ verbose: true })) {
        const afterMate = new Chess(afterReply.fen())
        afterMate.move(mateMove)
        if (afterMate.isCheckmate()) {
          branchLines.push([first.san, reply.san, mateMove.san])
          mateFound = true
          break
        }
      }
      if (!mateFound) {
        forcesMate = false
        break
      }
    }

    if (forcesMate) lines.push(...branchLines)
  }

  return lines
}

export function firstMovesFromLines(lines: string[][]): string[] {
  return [...new Set(lines.map((l) => l[0]).filter(Boolean))]
}
