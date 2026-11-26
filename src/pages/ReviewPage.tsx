import { Chess } from 'chess.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Arrow, PieceDropHandlerArgs } from 'react-chessboard'
import { EvalBar } from '../components/EvalBar'
import { QueueProgress } from '../components/QueueProgress'
import { SideToMoveBadge } from '../components/SideToMoveBadge'
import { StatusLine, type StatusTone } from '../components/StatusLine'
import {
  blunderArrowColor,
  blunderSquareStyle,
  boardSize,
  boardThemeOptions,
} from '../components/boardTheme'
import { sideToMoveFromFen } from '../lib/sideToMove'
import { db } from '../db'
import {
  getOrCreateTagByName,
  getTagIdsForMistake,
  listTagsOrdered,
  setMistakeTags,
} from '../db/tags'
import type { MistakeRow } from '../db/schema'
import { analyzeReviewMove } from '../lib/engine/reviewMoveAnalysis'
import { formatThreats } from '../lib/engine/classifyMove'
import type { OpponentReply } from '../lib/engine/types'
import { useStockfish } from '../lib/engine/useStockfish'
import { loadImportPreferences } from '../lib/importPreferences'
import { lichessAnalysisUrl } from '../lib/lichessUrl'
import { shuffleInPlace } from '../lib/shuffle'

export function ReviewPage() {
  const unreviewed = useLiveQuery(
    () => db.mistakes.filter((m) => m.reviewed === false).toArray(),
    [],
  )

  const idSignature = useMemo(() => {
    const ids = (unreviewed ?? []).map((m) => m.id).filter((n): n is number => n != null)
    ids.sort((a, b) => a - b)
    return ids.join(',')
  }, [unreviewed])

  return <ReviewSession key={idSignature} mistakes={unreviewed ?? []} />
}

function ReviewSession({ mistakes }: { mistakes: MistakeRow[] }) {
  const blunderThresholdPawns = useMemo(
    () => loadImportPreferences().evalThresholdPawns,
    [],
  )

  const queue = useMemo(() => {
    const list = [...mistakes]
    const ids = list.map((m) => m.id!).filter((n): n is number => n != null)
    shuffleInPlace(ids)
    const byId = new Map(list.map((m) => [m.id!, m]))
    return ids.map((id) => byId.get(id)!).filter(Boolean)
  }, [mistakes])

  const [idx, setIdx] = useState(0)
  const current = queue[idx] ?? null

  const tags = useLiveQuery(() => listTagsOrdered(), [])

  const selectedTagIds = useLiveQuery(
    () =>
      current?.id != null
        ? getTagIdsForMistake(current.id)
        : Promise.resolve([]),
    [current?.id],
  )

  const go = useCallback(
    (delta: number) => {
      setIdx((i) => {
        const next = i + delta
        if (next < 0) return 0
        if (!queue.length) return 0
        if (next >= queue.length) return queue.length - 1
        return next
      })
    },
    [queue.length],
  )

  const toggleReviewed = useCallback(async () => {
    if (!current?.id) return
    const next = !current.reviewed
    await db.mistakes.update(current.id, {
      reviewed: next,
      reviewedAt: next ? Date.now() : undefined,
    })
  }, [current])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          ;(e.target as HTMLElement).blur()
        }
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault()
        go(1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault()
        go(-1)
      }
      if (e.key === 'r' || e.key === 'Enter') {
        e.preventDefault()
        void toggleReviewed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, toggleReviewed])

  async function saveComment(text: string) {
    if (!current?.id) return
    await db.mistakes.update(current.id, { comment: text })
  }

  async function deleteCurrent() {
    if (!current?.id) return
    if (!window.confirm('Delete this position permanently?')) return
    await db.mistakeTags.where('mistakeId').equals(current.id).delete()
    await db.mistakes.delete(current.id)
  }

  async function toggleTag(tagId: number) {
    if (!current?.id) return
    const cur = new Set(await getTagIdsForMistake(current.id))
    if (cur.has(tagId)) cur.delete(tagId)
    else cur.add(tagId)
    await setMistakeTags(current.id, [...cur])
  }

  async function addNewTag(raw: string) {
    if (!current?.id) return
    const id = await getOrCreateTagByName(raw)
    const cur = await getTagIdsForMistake(current.id)
    if (!cur.includes(id)) await setMistakeTags(current.id, [...cur, id])
  }

  if (!queue.length) {
    return (
      <section className="space-y-4">
        <h1 className="font-display text-[22px] leading-none font-bold">Review</h1>
        <p className="text-base-content/70">No unreviewed blunders — nice work, or import more games.</p>
      </section>
    )
  }

  if (!current) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="font-display text-[22px] leading-none font-bold">Review</h1>
        <p className="font-mono text-[13px] text-base-content/60">
          <span className="font-semibold text-base-content">{idx + 1}</span> / {queue.length}
        </p>
        <QueueProgress index={idx} total={queue.length} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
        <ReviewBoard
          key={current.id}
          fenBefore={current.fenBefore}
          blunderSan={current.moveSan}
          blunderThresholdPawns={blunderThresholdPawns}
          evalBefore={current.evalBefore}
          evalAfter={current.evalAfter}
        />
        <div className="panel divide-y divide-base-300">
          <div className="grid grid-cols-2 gap-4 p-4">
            <div>
              <p className="eyebrow mb-2.5">Your move</p>
              <p className="font-mono text-3xl leading-none font-semibold text-error">
                {current.moveSan}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2.5">Eval</p>
              <p className="font-mono text-xl leading-tight font-medium">
                {current.evalBefore.toFixed(2)} →{' '}
                <span className="text-error">{current.evalAfter.toFixed(2)}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-base-content/60">
                {`Δ ${(current.evalAfter - current.evalBefore).toFixed(2)} from White's perspective`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-[1fr_1fr_2fr]">
            <button type="button" className="btn btn-outline" onClick={() => go(-1)} disabled={idx <= 0}>
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => go(1)}
              disabled={idx >= queue.length - 1}
            >
              Next
            </button>
            <button
              type="button"
              className="btn btn-primary col-span-2 row-start-1 sm:col-span-1 sm:row-auto"
              onClick={() => void toggleReviewed()}
            >
              Mark as reviewed
            </button>
          </div>
          <div className="p-4">
            <CommentField
              key={current.id}
              initialComment={current.comment}
              onSave={(t) => void saveComment(t)}
            />
          </div>
          <div className="p-4">
            <p className="eyebrow mb-2.5">Tags</p>
            <div className="flex flex-wrap gap-2">
              {(tags ?? []).map((t) =>
                t.id != null ? (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-selector border border-base-content/20 px-2.5 py-1.5 font-mono text-[12.5px] has-checked:border-primary has-checked:bg-primary/10"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-xs"
                      checked={selectedTagIds?.includes(t.id) ?? false}
                      onChange={() => void toggleTag(t.id!)}
                    />
                    {t.name}
                  </label>
                ) : null,
              )}
            </div>
            <form
              className="mt-3 flex max-w-xs items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const name = String(fd.get('newtag') ?? '')
                void addNewTag(name).then(() => {
                  e.currentTarget.reset()
                })
              }}
            >
              <input
                name="newtag"
                placeholder="New tag"
                aria-label="New tag"
                className="input input-sm min-w-0 flex-1"
              />
              <button type="submit" className="btn btn-outline btn-sm">
                Add
              </button>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 p-4 text-sm">
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
            <button
              type="button"
              className="btn btn-error btn-outline btn-sm ml-auto"
              onClick={() => void deleteCurrent()}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      <p className="hidden font-mono text-xs text-base-content/60 md:block">
        Shortcuts: arrow keys or p/n = previous/next, r or Enter = mark reviewed, t = show/hide threats, Esc = blur field.
      </p>
    </section>
  )
}

/** Arrow colours for opponent replies that punish the move: best reply strong, others lighter. */
const BEST_REPLY_ARROW_COLOR = 'rgb(220, 38, 38)'
const OTHER_REPLY_ARROW_COLOR = 'rgb(248, 113, 113)'

type MoveFeedback = {
  text: string
  tone: StatusTone
}

function ReviewBoard({
  fenBefore,
  blunderSan,
  blunderThresholdPawns,
  evalBefore,
  evalAfter,
}: {
  fenBefore: string
  blunderSan: string
  blunderThresholdPawns: number
  evalBefore: number
  evalAfter: number
}) {
  const engineState = useStockfish()
  const [boardFen, setBoardFen] = useState(fenBefore)
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [replies, setReplies] = useState<OpponentReply[]>([])
  const [threatsShown, setThreatsShown] = useState(false)
  const [guessFeedback, setGuessFeedback] = useState<MoveFeedback | null>(null)
  const analysisGenRef = useRef(0)
  const startOrientation = useMemo(() => sideToMoveFromFen(fenBefore), [fenBefore])
  const sideToMove = sideToMoveFromFen(boardFen)

  // Display only: the squares of the move that was the blunder in the game.
  const blunderSquares = useMemo(() => {
    try {
      const move = new Chess(fenBefore).move(blunderSan.replace(/[?!]+$/, ''))
      return { from: move.from, to: move.to }
    } catch {
      return null
    }
  }, [fenBefore, blunderSan])
  const showBlunder = blunderSquares != null && boardFen === fenBefore

  const resetBoard = useCallback(() => {
    setBoardFen(fenBefore)
    setFeedback(null)
    setReplies([])
    setThreatsShown(false)
    setGuessFeedback(null)
    setAnalyzing(false)
    analysisGenRef.current += 1
  }, [fenBefore])

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false
      if (engineState !== 'ready') {
        setFeedback({
          text:
            engineState === 'loading'
              ? 'Stockfish is still loading — wait a moment.'
              : 'Stockfish failed to load. Refresh the page and try again.',
          tone: engineState === 'loading' ? 'neutral' : 'error',
        })
        return false
      }
      if (boardFen !== fenBefore && replies.length > 0 && !threatsShown) {
        // Guess mode: the player drags an opponent piece to find a reply that punishes the move.
        // The piece always goes back, so the arrows show the threats in the same position.
        const guessBoard = new Chess(boardFen)
        try {
          guessBoard.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
        } catch {
          setGuessFeedback({ text: 'Illegal move — try again.', tone: 'error' })
          return false
        }
        const hit = replies.find((r) => r.from === sourceSquare && r.to === targetSquare)
        if (hit) {
          setGuessFeedback({ text: `Correct — ${hit.san} punishes your move.`, tone: 'success' })
          setThreatsShown(true)
        } else {
          setGuessFeedback({ text: 'Not a reply that punishes your move — try again.', tone: 'error' })
        }
        return false
      }
      if (boardFen !== fenBefore) {
        // Show this on the guess line, so that the verdict text stays.
        setGuessFeedback({
          text: 'Reset the board to try another move from the starting position.',
          tone: 'error',
        })
        return false
      }
      if (analyzing) return false

      const chess = new Chess(boardFen)
      let move
      try {
        move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        })
      } catch {
        setFeedback({ text: 'Illegal move — try again.', tone: 'error' })
        return false
      }
      if (!move) {
        setFeedback({ text: 'Illegal move — try again.', tone: 'error' })
        return false
      }

      const gen = ++analysisGenRef.current
      setReplies([])
      setThreatsShown(false)
      setGuessFeedback(null)
      setAnalyzing(true)
      setFeedback({ text: 'Analyzing with Stockfish…', tone: 'neutral' })

      void analyzeReviewMove({
        fenBefore,
        from: sourceSquare,
        to: targetSquare,
        blunderSan,
        blunderThresholdPawns,
      })
        .then((verdict) => {
          if (gen !== analysisGenRef.current) return
          setBoardFen(chess.fen())
          setFeedback({ text: verdict.message, tone: verdict.tone })
          setReplies(verdict.opponentReplies)
        })
        .catch(() => {
          if (gen !== analysisGenRef.current) return
          setFeedback({
            text: 'Analysis failed — try again or use Lichess analysis.',
            tone: 'error',
          })
        })
        .finally(() => {
          if (gen === analysisGenRef.current) setAnalyzing(false)
        })

      return false
    },
    [
      analyzing,
      blunderSan,
      blunderThresholdPawns,
      boardFen,
      engineState,
      fenBefore,
      replies,
      threatsShown,
    ],
  )

  const replyArrows = useMemo<Arrow[]>(
    () =>
      threatsShown
        ? replies.map((reply) => ({
            startSquare: reply.from,
            endSquare: reply.to,
            color: reply.rank === 1 ? BEST_REPLY_ARROW_COLOR : OTHER_REPLY_ARROW_COLOR,
          }))
        : [],
    [replies, threatsShown],
  )
  const hasThreats = replies.length > 0

  /** Shows or hides the threats. An old guess result no longer applies after this. */
  const toggleThreats = useCallback(() => {
    setThreatsShown((shown) => !shown)
    setGuessFeedback(null)
  }, [])

  useEffect(() => {
    if (!hasThreats) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 't') {
        e.preventDefault()
        toggleThreats()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasThreats, toggleThreats])

  return (
    <div className="flex flex-col gap-2.5" style={{ width: boardSize() + 24, maxWidth: '100%' }}>
      <div className="flex gap-2.5">
        <EvalBar evalBefore={evalBefore} evalAfter={evalAfter} orientation={startOrientation} />
        <div className="min-w-0 flex-1">
          <Chessboard
            options={{
              ...boardThemeOptions,
              position: boardFen,
              boardOrientation: startOrientation,
              allowDragging: engineState === 'ready' && !analyzing,
              canDragPiece: ({ piece }) => {
                const chess = new Chess(boardFen)
                const turn = chess.turn() === 'w' ? 'w' : 'b'
                return piece.pieceType.startsWith(turn)
              },
              onPieceDrop,
              arrows: showBlunder
                ? [
                    {
                      startSquare: blunderSquares.from,
                      endSquare: blunderSquares.to,
                      color: blunderArrowColor,
                    },
                  ]
                : replyArrows,
              squareStyles: showBlunder
                ? {
                    [blunderSquares.from]: blunderSquareStyle,
                    [blunderSquares.to]: blunderSquareStyle,
                  }
                : {},
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
        <SideToMoveBadge side={sideToMove} />
        <EngineStatus state={engineState} />
        {hasThreats ? (
          <button
            type="button"
            className="btn btn-error btn-outline btn-sm"
            aria-pressed={threatsShown}
            onClick={toggleThreats}
          >
            {threatsShown ? 'Hide threats' : 'Show threats'}
          </button>
        ) : null}
        <button type="button" className="btn btn-outline btn-sm" onClick={resetBoard}>
          Reset board
        </button>
      </div>
      <div className="pl-6">
        {feedback ? (
          <StatusLine tone={feedback.tone}>
            {feedback.text}
            {threatsShown && hasThreats ? ` ${formatThreats(replies)}` : ''}
          </StatusLine>
        ) : engineState === 'ready' ? (
          <StatusLine tone="neutral">
            Play your move — Stockfish will rate it against the engine line.
          </StatusLine>
        ) : null}
        {guessFeedback ? (
          <StatusLine tone={guessFeedback.tone}>{guessFeedback.text}</StatusLine>
        ) : hasThreats && !threatsShown ? (
          <StatusLine tone="neutral">
            Find a reply that punishes your move — drag one of the opponent&apos;s pieces.
          </StatusLine>
        ) : null}
      </div>
    </div>
  )
}

function EngineStatus({ state }: { state: 'loading' | 'ready' | 'error' }) {
  const dot =
    state === 'ready' ? 'bg-success' : state === 'error' ? 'bg-error' : 'animate-pulse bg-warning'
  const text =
    state === 'ready'
      ? 'Stockfish ready'
      : state === 'error'
        ? 'Stockfish could not load.'
        : 'Loading Stockfish (~1.8 MB)…'
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[11.5px] ${
        state === 'error' ? 'text-error' : 'text-base-content/60'
      }`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      {text}
    </span>
  )
}

function CommentField({
  initialComment,
  onSave,
}: {
  initialComment: string
  onSave: (t: string) => void
}) {
  const [text, setText] = useState(initialComment)
  return (
    <label className="block">
      <span className="eyebrow mb-2.5 block">Note</span>
      <textarea
        className="textarea min-h-24 w-full text-sm"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
      />
    </label>
  )
}
