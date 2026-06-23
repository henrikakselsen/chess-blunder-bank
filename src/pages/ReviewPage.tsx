import { Chess } from 'chess.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { SideToMoveBadge } from '../components/SideToMoveBadge'
import { sideToMoveFromFen } from '../lib/sideToMove'
import { db } from '../db'
import {
  getOrCreateTagByName,
  getTagIdsForMistake,
  listTagsOrdered,
  setMistakeTags,
} from '../db/tags'
import type { MistakeRow } from '../db/schema'
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
        <h1 className="text-3xl font-bold">Review</h1>
        <p className="text-base-content/80">No unreviewed blunders — nice work, or import more games.</p>
      </section>
    )
  }

  if (!current) {
    return null
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Review</h1>
      <p className="text-base-content/70 text-sm">
        Shortcuts: arrow keys or p/n = previous/next, r or Enter = mark reviewed, Esc = blur field.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(280px,1.2fr)]">
        <ReviewBoard key={current.id} fenBefore={current.fenBefore} />
        <div className="flex flex-col gap-4">
          <p>
            <strong>Eval:</strong> {current.evalBefore.toFixed(2)} → {current.evalAfter.toFixed(2)}{' '}
            {`(Δ ${(current.evalAfter - current.evalBefore).toFixed(2)} from White's perspective)`}
          </p>
          <p>
            <strong>Your move:</strong> <code className="text-primary">{current.moveSan}</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => go(-1)} disabled={idx <= 0}>
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => go(1)}
              disabled={idx >= queue.length - 1}
            >
              Next
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void toggleReviewed()}>
              Mark as reviewed
            </button>
            <button type="button" className="btn btn-error btn-sm btn-outline" onClick={() => void deleteCurrent()}>
              Delete
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
          <CommentField
            key={current.id}
            initialComment={current.comment}
            onSave={(t) => void saveComment(t)}
          />
          <div>
            <strong>Tags</strong>
            <div className="mt-2 flex flex-wrap gap-2">
              {(tags ?? []).map((t) =>
                t.id != null ? (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-base-300 bg-base-200 px-3 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedTagIds?.includes(t.id) ?? false}
                      onChange={() => void toggleTag(t.id!)}
                    />
                    {t.name}
                  </label>
                ) : null,
              )}
            </div>
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
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
                className="input input-bordered input-sm w-full max-w-xs"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Add
              </button>
            </form>
          </div>
          <p className="text-base-content/70 text-sm">
            {idx + 1} / {queue.length}
          </p>
        </div>
      </div>
    </section>
  )
}

function ReviewBoard({ fenBefore }: { fenBefore: string }) {
  const [boardFen, setBoardFen] = useState(fenBefore)
  const startOrientation = useMemo(() => sideToMoveFromFen(fenBefore), [fenBefore])
  const sideToMove = sideToMoveFromFen(boardFen)

  const resetBoard = useCallback(() => {
    setBoardFen(fenBefore)
  }, [fenBefore])

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false
      const chess = new Chess(boardFen)
      try {
        const move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        })
        if (!move) return false
      } catch {
        return false
      }
      setBoardFen(chess.fen())
      return true
    },
    [boardFen],
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <SideToMoveBadge side={sideToMove} />
      <div
        className="rounded-box border border-base-300 bg-base-100 p-4 shadow-lg"
        style={{ width: boardSize(), maxWidth: '100%' }}
      >
        <Chessboard
          options={{
            position: boardFen,
            boardOrientation: startOrientation,
            allowDragging: true,
            canDragPiece: ({ piece }) => {
              const chess = new Chess(boardFen)
              const turn = chess.turn() === 'w' ? 'w' : 'b'
              return piece.pieceType.startsWith(turn)
            },
            onPieceDrop,
          }}
        />
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={resetBoard}>
        Reset board
      </button>
    </div>
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
    <label className="form-control w-full">
      <span className="label">
        <span className="label-text">Note</span>
      </span>
      <textarea
        className="textarea textarea-bordered min-h-28 w-full"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
      />
    </label>
  )
}

function boardSize() {
  if (typeof window === 'undefined') return 480
  return Math.min(520, Math.floor(window.innerWidth - 64))
}
