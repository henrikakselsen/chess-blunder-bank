import { Chess } from 'chess.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { db } from '../db'
import type { MissedMateRow } from '../db/schema'
import { lichessAnalysisUrl } from '../lib/lichessUrl'
import { shuffleInPlace } from '../lib/shuffle'

type MateFilter = 'all' | 1 | 2

export function MateTrainingPage() {
  const unreviewed = useLiveQuery(
    () => db.missedMates.filter((m) => m.reviewed === false).toArray(),
    [],
  )

  return <MateTrainingSession items={unreviewed ?? []} />
}

function MateTrainingSession({ items }: { items: MissedMateRow[] }) {
  const [filter, setFilter] = useState<MateFilter>('all')

  const filtered = useMemo(
    () => items.filter((m) => filter === 'all' || m.mateIn === filter),
    [items, filter],
  )

  const idSignature = useMemo(() => {
    const ids = filtered.map((m) => m.id).filter((n): n is number => n != null)
    ids.sort((a, b) => a - b)
    return ids.join(',')
  }, [filtered])

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Mate training</h1>
      <p className="max-w-prose text-base-content/80">
        Positions where the engine showed mate in 1 or 2 for you, but you played something else.
        Drag the correct move on the board.
      </p>
      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterButton>
        <FilterButton active={filter === 1} onClick={() => setFilter(1)}>
          Mate in 1
        </FilterButton>
        <FilterButton active={filter === 2} onClick={() => setFilter(2)}>
          Mate in 2
        </FilterButton>
      </div>
      {filtered.length === 0 ? (
        <p className="text-base-content/80">
          No unreviewed missed mates
          {filter === 'all' ? '' : filter === 1 ? ' in 1' : ' in 2'} — import analysed games on
          Import.
        </p>
      ) : (
        <MatePuzzle key={idSignature} queue={filtered} />
      )}
    </section>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function MatePuzzle({ queue: sourceQueue }: { queue: MissedMateRow[] }) {
  const queue = useMemo(() => {
    const list = [...sourceQueue]
    const ids = list.map((m) => m.id!).filter((n): n is number => n != null)
    shuffleInPlace(ids)
    const byId = new Map(list.map((m) => [m.id!, m]))
    return ids.map((id) => byId.get(id)!).filter(Boolean)
  }, [sourceQueue])

  const [idx, setIdx] = useState(0)
  const current = queue[idx] ?? null

  if (!current) return null

  return (
    <MatePuzzleBoard
      key={current.id}
      current={current}
      idx={idx}
      queueLength={queue.length}
      onPrev={() => setIdx((i) => Math.max(0, i - 1))}
      onNext={() => setIdx((i) => Math.min(queue.length - 1, i + 1))}
    />
  )
}

function MatePuzzleBoard({
  current,
  idx,
  queueLength,
  onPrev,
  onNext,
}: {
  current: MissedMateRow
  idx: number
  queueLength: number
  onPrev: () => void
  onNext: () => void
}) {
  const [boardFen, setBoardFen] = useState(current.fenBefore)
  const [phase, setPhase] = useState<'play' | 'done'>('play')
  const [mate2Step, setMate2Step] = useState(0)
  const [activeLine, setActiveLine] = useState<string[] | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  const resetPosition = useCallback(() => {
    setBoardFen(current.fenBefore)
    setPhase('play')
    setMate2Step(0)
    setActiveLine(null)
    setFeedback(null)
    setShowHint(false)
  }, [current.fenBefore])

  const toggleReviewed = useCallback(async () => {
    if (current.id == null) return
    const next = !current.reviewed
    await db.missedMates.update(current.id, {
      reviewed: next,
      reviewedAt: next ? Date.now() : undefined,
    })
  }, [current.id, current.reviewed])

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!current || !targetSquare || phase !== 'play') return false

      const chess = new Chess(boardFen)
      const myPiece = current.myColor === 'white' ? 'w' : 'b'
      if (chess.turn() !== myPiece) return false

      let move
      try {
        move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        })
      } catch {
        setFeedback('Illegal move — try again.')
        return false
      }
      if (!move) {
        setFeedback('Illegal move — try again.')
        return false
      }

      if (current.mateIn === 1) {
        const ok =
          chess.isCheckmate() ||
          current.solutionLines.some((line) => line[0] === move.san)
        if (!ok) {
          setFeedback('Not the mating move — try again.')
          return false
        }
        setBoardFen(chess.fen())
        setPhase('done')
        setFeedback('Correct — checkmate!')
        return true
      }

      if (mate2Step === 0) {
        const matchingLines = current.solutionLines.filter((l) => l[0] === move.san)
        if (matchingLines.length === 0) {
          setFeedback('Not the right first move — try again.')
          return false
        }
        const line = matchingLines[0]!
        const oppSan = line[1]
        if (!oppSan) return false
        try {
          chess.move(oppSan)
        } catch {
          return false
        }
        setBoardFen(chess.fen())
        setMate2Step(1)
        setActiveLine(line)
        setFeedback('Good — now deliver mate.')
        return true
      }

      const expectedMate = activeLine?.[2]
      const ok = chess.isCheckmate() || move.san === expectedMate
      if (!ok) {
        setFeedback('Not mate — try again from the start.')
        resetPosition()
        return false
      }
      setBoardFen(chess.fen())
      setPhase('done')
      setFeedback('Correct — checkmate!')
      return true
    },
    [activeLine, boardFen, current, mate2Step, phase, resetPosition],
  )

  const hintMove = current.solutionLines[0]?.[mate2Step]
  const sideToMove = sideToMoveFromFen(boardFen)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(280px,1.2fr)]">
      <div className="flex flex-col items-center gap-2">
        <SideToMoveBadge side={sideToMove} />
        <div
          className="rounded-box border border-base-300 bg-base-100 p-4 shadow-lg"
          style={{ width: boardSize(), maxWidth: '100%' }}
        >
          <Chessboard
            options={{
              position: boardFen,
              boardOrientation: current.myColor,
              allowDragging: phase === 'play',
              canDragPiece: ({ piece }) =>
                phase === 'play' &&
                piece.pieceType.startsWith(current.myColor === 'white' ? 'w' : 'b'),
              onPieceDrop,
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <p>
          <strong>To move:</strong> {sideToMoveLabel(sideToMove)}
        </p>
        <p>
          <strong>Mate in {current.mateIn}</strong>
          {phase === 'play' && current.mateIn === 2 && mate2Step === 1
            ? ' — deliver checkmate'
            : ''}
        </p>
        <p>
          <strong>You played:</strong>{' '}
          <code className="text-error">{current.movePlayedSan}</code>
        </p>
        {feedback ? (
          <p
            className={
              phase === 'done' ? 'text-success font-medium' : 'text-error font-medium'
            }
          >
            {feedback}
          </p>
        ) : null}
        {showHint && hintMove ? (
          <p className="text-base-content/70 text-sm">
            Hint: try <code className="text-primary">{hintMove}</code>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {phase === 'play' ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowHint(true)}
              >
                Hint
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={resetPosition}>
                Reset board
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onPrev}
            disabled={idx <= 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onNext}
            disabled={idx >= queueLength - 1}
          >
            Next
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void toggleReviewed()}>
            Mark as reviewed
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            href={lichessAnalysisUrl(current.fenBefore)}
            target="_blank"
            rel="noreferrer"
            className="link link-primary"
          >
            Open analysis on Lichess
          </a>
          {current.gameUrl ? (
            <a href={current.gameUrl} target="_blank" rel="noreferrer" className="link link-primary">
              Open game
            </a>
          ) : null}
        </div>
        <p className="text-base-content/70 text-sm">
          {idx + 1} / {queueLength}
        </p>
      </div>
    </div>
  )
}

function boardSize() {
  if (typeof window === 'undefined') return 480
  return Math.min(520, Math.floor(window.innerWidth - 64))
}

function sideToMoveFromFen(fen: string): 'white' | 'black' {
  try {
    return new Chess(fen).turn() === 'w' ? 'white' : 'black'
  } catch {
    return 'white'
  }
}

function sideToMoveLabel(side: 'white' | 'black'): string {
  return side === 'white' ? 'White' : 'Black'
}

function SideToMoveBadge({ side }: { side: 'white' | 'black' }) {
  const isWhite = side === 'white'
  return (
    <span
      className={`badge badge-lg font-medium ${
        isWhite
          ? 'border border-base-300 bg-white text-neutral'
          : 'border border-neutral bg-neutral text-white'
      }`}
    >
      {sideToMoveLabel(side)} to move
    </span>
  )
}
