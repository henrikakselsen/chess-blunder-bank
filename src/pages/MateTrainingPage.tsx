import { Chess } from 'chess.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { QueueProgress } from '../components/QueueProgress'
import { SideToMoveBadge } from '../components/SideToMoveBadge'
import { StarButton } from '../components/StarButton'
import { StatusLine } from '../components/StatusLine'
import { boardSize, boardThemeOptions } from '../components/boardTheme'
import { sideToMoveFromFen } from '../lib/sideToMove'
import { db } from '../db'
import { toggleInstructive, useInstructiveKeys } from '../db/instructive'
import type { MissedMateRow } from '../db/schema'
import { positionKey, selectInstructive } from '../lib/instructive'
import { lichessAnalysisUrl } from '../lib/lichessUrl'
import {
  clearMateTrainingSession,
  resolveInitialSession,
  rowsFromIds,
  saveMateTrainingSession,
  shuffleQueueIds,
  syncSessionWithSource,
  type MateFilter,
} from '../lib/mateTrainingSession'
import { shuffleInPlace } from '../lib/shuffle'

export function MateTrainingPage() {
  const all = useLiveQuery(() => db.missedMates.toArray(), [])
  const starred = useInstructiveKeys('mate')

  if (!all || !starred) return null
  return <MateTrainingSession items={all} starred={starred} />
}

function MateTrainingSession({
  items,
  starred,
}: {
  items: MissedMateRow[]
  starred: Set<string>
}) {
  const [filter, setFilter] = useState<MateFilter>('all')
  // Rows whose star the user changed in this "Instructive" session.
  // They stay in the queue after the user removes the star.
  const [stickyIds, setStickyIds] = useState<Set<number>>(() => new Set())

  const changeFilter = useCallback((next: MateFilter) => {
    setFilter(next)
    setStickyIds(new Set())
  }, [])

  const filtered = useMemo(() => {
    // The instructive session shows reviewed rows too, and does not change their status.
    if (filter === 'instructive') return selectInstructive(items, starred, stickyIds)
    return items.filter((m) => !m.reviewed && (filter === 'all' || m.mateIn === filter))
  }, [items, filter, starred, stickyIds])

  const toggleStar = useCallback(
    async (row: MissedMateRow) => {
      if (filter === 'instructive' && row.id != null) {
        const id = row.id
        setStickyIds((prev) => new Set(prev).add(id))
      }
      await toggleInstructive('mate', row.gameId, row.ply)
    },
    [filter],
  )

  return (
    <section className="space-y-4">
      <h1 className="font-display text-[22px] leading-none font-bold">Mate training</h1>
      <p className="max-w-prose text-sm text-base-content/70">
        Positions where the engine showed mate in 1 or 2 for you, but you played something else.
        Drag the correct move on the board. Failed positions return in a repetition round.
      </p>
      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === 'all'} onClick={() => changeFilter('all')}>
          All
        </FilterButton>
        <FilterButton active={filter === 1} onClick={() => changeFilter(1)}>
          Mate in 1
        </FilterButton>
        <FilterButton active={filter === 2} onClick={() => changeFilter(2)}>
          Mate in 2
        </FilterButton>
        <FilterButton
          active={filter === 'instructive'}
          onClick={() => changeFilter('instructive')}
        >
          ★ Instructive
        </FilterButton>
      </div>
      {filtered.length === 0 ? (
        <p className="text-base-content/70">
          {filter === 'instructive'
            ? 'No instructive mates yet. Press ★ (or i) on a puzzle to save it here.'
            : `No unreviewed missed mates${
                filter === 'all' ? '' : filter === 1 ? ' in 1' : ' in 2'
              } — import analysed games on Import.`}
        </p>
      ) : (
        <MatePuzzle
          key={filter}
          filter={filter}
          sourceQueue={filtered}
          starred={starred}
          onToggleStar={toggleStar}
        />
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

function MatePuzzle({
  filter,
  sourceQueue,
  starred,
  onToggleStar,
}: {
  filter: MateFilter
  sourceQueue: MissedMateRow[]
  starred: Set<string>
  onToggleStar: (row: MissedMateRow) => Promise<void>
}) {
  const [activeQueue, setActiveQueue] = useState(
    () => resolveInitialSession(filter, sourceQueue).activeQueue,
  )
  const [round, setRound] = useState(
    () => resolveInitialSession(filter, sourceQueue).round,
  )
  const [repeatRound, setRepeatRound] = useState(
    () => resolveInitialSession(filter, sourceQueue).repeatRound,
  )
  const [pendingRepeatIds, setPendingRepeatIds] = useState(
    () => resolveInitialSession(filter, sourceQueue).pendingRepeatIds,
  )
  const [idx, setIdx] = useState(() => resolveInitialSession(filter, sourceQueue).idx)
  const [sessionComplete, setSessionComplete] = useState(
    () => resolveInitialSession(filter, sourceQueue).sessionComplete,
  )

  const byId = useMemo(() => {
    const map = new Map<number, MissedMateRow>()
    for (const row of sourceQueue) {
      if (row.id != null) map.set(row.id, row)
    }
    return map
  }, [sourceQueue])

  const skipSourceSync = useRef(true)
  const stateRef = useRef({ activeQueue, idx, pendingRepeatIds })

  useEffect(() => {
    stateRef.current = { activeQueue, idx, pendingRepeatIds }
  }, [activeQueue, idx, pendingRepeatIds])

  useEffect(() => {
    if (skipSourceSync.current) {
      skipSourceSync.current = false
      return
    }
    const { activeQueue: prevQueue, idx: prevIdx, pendingRepeatIds: prevPending } =
      stateRef.current
    const synced = syncSessionWithSource(sourceQueue, prevQueue, prevPending, prevIdx)
    setActiveQueue(synced.activeQueue)
    setIdx(synced.idx)
    setPendingRepeatIds(synced.pendingRepeatIds)
  }, [sourceQueue])

  const pendingKey = useMemo(
    () => [...pendingRepeatIds].sort((a, b) => a - b).join(','),
    [pendingRepeatIds],
  )

  useEffect(() => {
    const ids = activeQueue
      .map((m) => m.id)
      .filter((n): n is number => n != null)
    saveMateTrainingSession(filter, {
      activeQueueIds: ids,
      idx,
      round,
      repeatRound,
      pendingRepeatIds: pendingKey ? pendingKey.split(',').map(Number) : [],
      sessionComplete,
    })
  }, [filter, activeQueue, idx, round, repeatRound, pendingKey, sessionComplete])

  const current = activeQueue[idx] ?? null

  const enqueueRepeat = useCallback((id: number) => {
    setPendingRepeatIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const startRepeatRound = useCallback(() => {
    const repeatItems = [...pendingRepeatIds]
      .map((id) => byId.get(id))
      .filter((row): row is MissedMateRow => row != null)
    shuffleInPlace(repeatItems)
    setActiveQueue(repeatItems)
    setPendingRepeatIds(new Set())
    setRound('repeat')
    setRepeatRound((n) => n + 1)
    setIdx(0)
  }, [byId, pendingRepeatIds])

  const goNext = useCallback(() => {
    if (idx < activeQueue.length - 1) {
      setIdx((i) => i + 1)
      return
    }
    if (pendingRepeatIds.size > 0) {
      startRepeatRound()
      return
    }
    setSessionComplete(true)
  }, [activeQueue.length, idx, pendingRepeatIds.size, startRepeatRound])

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1))
  }, [])

  const startNewSession = useCallback(() => {
    clearMateTrainingSession(filter)
    const ids = shuffleQueueIds(sourceQueue)
    setActiveQueue(rowsFromIds(ids, byId))
    setRound('main')
    setRepeatRound(0)
    setPendingRepeatIds(new Set())
    setIdx(0)
    setSessionComplete(false)
  }, [byId, filter, sourceQueue])

  if (sessionComplete) {
    return (
      <div className="space-y-3">
        <p className="border border-l-[3px] border-base-300 border-l-success bg-base-100 px-3 py-2.5 font-mono text-[13px]">
          All positions solved this session
          {repeatRound > 0
            ? ` (including ${repeatRound} repetition round${repeatRound > 1 ? 's' : ''})`
            : ''}
          .
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={startNewSession}>
          Start new session
        </button>
      </div>
    )
  }

  if (!current) return null

  return (
    <MatePuzzleBoard
      key={current.id}
      current={current}
      idx={idx}
      queueLength={activeQueue.length}
      queuedCount={pendingRepeatIds.size}
      starred={starred.has(positionKey(current.gameId, current.ply))}
      onToggleStar={() => void onToggleStar(current)}
      onWrongMatingMove={() => {
        if (current.id != null) enqueueRepeat(current.id)
      }}
      onPrev={goPrev}
      onNext={goNext}
    />
  )
}

function MatePuzzleBoard({
  current,
  idx,
  queueLength,
  queuedCount,
  starred,
  onToggleStar,
  onWrongMatingMove,
  onPrev,
  onNext,
}: {
  current: MissedMateRow
  idx: number
  queueLength: number
  queuedCount: number
  starred: boolean
  onToggleStar: () => void
  onWrongMatingMove: () => void
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

  const failMatingMove = useCallback(
    (message: string) => {
      onWrongMatingMove()
      setFeedback(`${message} Queued for repetition.`)
    },
    [onWrongMatingMove],
  )

  const toggleReviewed = useCallback(async () => {
    if (current.id == null) return
    const next = !current.reviewed
    await db.missedMates.update(current.id, {
      reviewed: next,
      reviewedAt: next ? Date.now() : undefined,
    })
  }, [current.id, current.reviewed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onToggleStar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToggleStar])

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare || phase !== 'play') return false

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
          failMatingMove('Not the mating move — try again.')
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
          failMatingMove('Not the right first move — try again.')
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
        failMatingMove('Not mate — try again from the start.')
        resetPosition()
        return false
      }
      setBoardFen(chess.fen())
      setPhase('done')
      setFeedback('Correct — checkmate!')
      return true
    },
    [activeLine, boardFen, current, failMatingMove, mate2Step, phase, resetPosition],
  )

  const hintMove = current.solutionLines[0]?.[mate2Step]
  const sideToMove = sideToMoveFromFen(boardFen)

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex flex-col gap-2.5" style={{ width: boardSize(), maxWidth: '100%' }}>
        <Chessboard
          options={{
            ...boardThemeOptions,
            position: boardFen,
            boardOrientation: current.myColor,
            allowDragging: phase === 'play',
            canDragPiece: ({ piece }) =>
              phase === 'play' &&
              piece.pieceType.startsWith(current.myColor === 'white' ? 'w' : 'b'),
            onPieceDrop,
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SideToMoveBadge side={sideToMove} />
          {phase === 'play' ? (
            <div className="flex gap-2">
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
            </div>
          ) : null}
        </div>
        {feedback ? (
          <StatusLine tone={phase === 'done' ? 'success' : 'error'}>{feedback}</StatusLine>
        ) : null}
        {showHint && hintMove ? (
          <StatusLine tone="neutral">
            Hint: try <code className="text-primary">{hintMove}</code>
          </StatusLine>
        ) : null}
      </div>
      <div className="panel divide-y divide-base-300">
        <div className="grid grid-cols-2 gap-4 p-4">
          <div>
            <p className="eyebrow mb-2.5">Task</p>
            <p className="font-mono text-xl leading-tight font-medium">
              <strong className="font-semibold text-primary">Mate in {current.mateIn}</strong>
              {phase === 'play' && current.mateIn === 2 && mate2Step === 1
                ? ' — deliver checkmate'
                : ''}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-2.5">You played</p>
            <p className="font-mono text-3xl leading-none font-semibold text-error">
              {current.movePlayedSan}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <button type="button" className="btn btn-outline" onClick={onPrev} disabled={idx <= 0}>
            Previous
          </button>
          <button type="button" className="btn btn-outline" onClick={onNext}>
            Next
          </button>
          <button
            type="button"
            className="btn btn-primary col-span-2 row-start-1 sm:col-span-1 sm:row-auto"
            onClick={() => void toggleReviewed()}
          >
            {current.reviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
          </button>
          <StarButton starred={starred} onClick={onToggleStar} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5 p-4 text-sm">
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
          <p className="font-mono text-[13px] text-base-content/60">
            <span className="font-semibold text-base-content">{idx + 1}</span> / {queueLength}
            {queuedCount > 0 ? ` · ${queuedCount} queued for repeat` : ''}
          </p>
          <QueueProgress index={idx} total={queueLength} />
        </div>
      </div>
    </div>
  )
}
