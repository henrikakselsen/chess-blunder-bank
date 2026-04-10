import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
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
    if (!window.confirm('Slette denne posisjonen permanent?')) return
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
      <section>
        <h1>Gjennomgang</h1>
        <p>Ingen ugjennomgåtte tabber — bra jobba, eller importer flere partier.</p>
      </section>
    )
  }

  if (!current) {
    return null
  }

  const fen = current.fenBefore

  return (
    <section>
      <h1>Gjennomgang</h1>
      <p className="muted">
        Snarveier: piltaster eller p/n = forrige/neste, r eller Enter = merk
        gjennomgått, Esc = fjern fokus fra felt.
      </p>
      <div className="review-grid">
        <div className="board-wrap">
          <div style={{ width: boardSize(), maxWidth: '100%' }}>
            <Chessboard
              options={{
                position: fen,
                allowDragging: false,
              }}
            />
          </div>
        </div>
        <div className="stack">
          <p>
            <strong>Eval:</strong> {current.evalBefore.toFixed(2)} → {current.evalAfter.toFixed(2)}{' '}
            (Δ {(current.evalAfter - current.evalBefore).toFixed(2)} fra hvits perspektiv)
          </p>
          <p>
            <strong>Trekk du spilte:</strong> <code>{current.moveSan}</code>
          </p>
          <div className="row">
            <button type="button" onClick={() => go(-1)} disabled={idx <= 0}>
              Forrige
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={idx >= queue.length - 1}
            >
              Neste
            </button>
            <button type="button" onClick={() => void toggleReviewed()}>
              Merk som gjennomgått
            </button>
            <button type="button" className="danger" onClick={() => void deleteCurrent()}>
              Slett
            </button>
          </div>
          <div className="row">
            <a href={lichessAnalysisUrl(fen)} target="_blank" rel="noreferrer">
              Åpne analyse på Lichess
            </a>
            {current.gameUrl ? (
              <a href={current.gameUrl} target="_blank" rel="noreferrer">
                Åpne parti
              </a>
            ) : null}
          </div>
          <CommentField
            key={current.id}
            initialComment={current.comment}
            onSave={(t) => void saveComment(t)}
          />
          <div>
            <strong>Tagger</strong>
            <div className="tag-grid">
              {(tags ?? []).map((t) =>
                t.id != null ? (
                  <label key={t.id} className="tag-chip">
                    <input
                      type="checkbox"
                      checked={selectedTagIds?.includes(t.id) ?? false}
                      onChange={() => void toggleTag(t.id!)}
                    />
                    {t.name}
                  </label>
                ) : null,
              )}
            </div>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const name = String(fd.get('newtag') ?? '')
                void addNewTag(name).then(() => {
                  e.currentTarget.reset()
                })
              }}
            >
              <input name="newtag" placeholder="Ny tagg" />
              <button type="submit">Legg til</button>
            </form>
          </div>
          <p className="muted">
            {idx + 1} / {queue.length}
          </p>
        </div>
      </div>
    </section>
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
    <label className="field">
      <span>Notat</span>
      <textarea
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
