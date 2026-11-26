import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { lichessAnalysisUrl } from '../lib/lichessUrl'
import { useMemo, useState } from 'react'
import { listTagsOrdered } from '../db/tags'

type ListTab = 'blunders' | 'mates'

export function ListPage() {
  const [tab, setTab] = useState<ListTab>('blunders')
  const mistakes = useLiveQuery(() => db.mistakes.toArray(), [])
  const missedMates = useLiveQuery(() => db.missedMates.toArray(), [])
  const tags = useLiveQuery(() => listTagsOrdered(), [])
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false)
  const [tagFilterId, setTagFilterId] = useState<number | ''>('')

  const tagLinks = useLiveQuery(
    () => {
      if (tagFilterId === '') {
        return Promise.resolve([] as { mistakeId: number; tagId: number }[])
      }
      return db.mistakeTags.where('tagId').equals(tagFilterId).toArray()
    },
    [tagFilterId],
  )

  const blunderRows = useMemo(() => {
    let m = mistakes ?? []
    if (onlyUnreviewed) {
      m = m.filter((x) => !x.reviewed)
    }
    if (tagFilterId !== '' && tagLinks) {
      const ids = new Set(tagLinks.map((l) => l.mistakeId))
      m = m.filter((x) => x.id != null && ids.has(x.id))
    }
    return m.sort((a, b) => b.createdAt - a.createdAt)
  }, [mistakes, onlyUnreviewed, tagFilterId, tagLinks])

  const mateRows = useMemo(() => {
    let m = missedMates ?? []
    if (onlyUnreviewed) {
      m = m.filter((x) => !x.reviewed)
    }
    return m.sort((a, b) => b.createdAt - a.createdAt)
  }, [missedMates, onlyUnreviewed])

  const rows = tab === 'blunders' ? blunderRows : mateRows

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h1 className="font-display text-[22px] leading-none font-bold">All positions</h1>
        <div className="join">
          <button
            type="button"
            className={`btn btn-sm join-item ${tab === 'blunders' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('blunders')}
          >
            Blunders
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${tab === 'mates' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab('mates')}
          >
            Missed mates
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={onlyUnreviewed}
            onChange={(e) => setOnlyUnreviewed(e.target.checked)}
          />
          <span>Unreviewed only</span>
        </label>
        {tab === 'blunders' ? (
          <label className="flex items-center gap-2.5">
            <span className="eyebrow">Tag</span>
            <select
              className="select select-sm w-auto min-w-40"
              value={tagFilterId === '' ? '' : String(tagFilterId)}
              onChange={(e) =>
                setTagFilterId(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">(all)</option>
              {(tags ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="panel overflow-x-auto [&_td]:whitespace-nowrap [&_th]:font-mono [&_th]:text-[11px] [&_th]:font-medium [&_th]:tracking-widest [&_th]:uppercase">
        {tab === 'blunders' ? (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Eval</th>
                <th>Move</th>
                <th>Reviewed</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {blunderRows.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs text-base-content/70">
                    {new Date(m.createdAt).toLocaleString('en-GB')}
                  </td>
                  <td className="font-mono">
                    {m.evalBefore.toFixed(2)} →{' '}
                    <span className="text-error">{m.evalAfter.toFixed(2)}</span>
                  </td>
                  <td>
                    <code className="font-mono text-sm font-semibold">{m.moveSan}</code>
                  </td>
                  <td>
                    <ReviewedBadge reviewed={m.reviewed} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {m.gameUrl ? (
                        <a href={m.gameUrl} target="_blank" rel="noreferrer" className="link link-primary">
                          Game
                        </a>
                      ) : null}
                      <a
                        href={lichessAnalysisUrl(m.fenBefore)}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-primary"
                      >
                        Analysis
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mate in</th>
                <th>You played</th>
                <th>Reviewed</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {mateRows.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs text-base-content/70">
                    {new Date(m.createdAt).toLocaleString('en-GB')}
                  </td>
                  <td className="font-mono">{m.mateIn}</td>
                  <td>
                    <code className="font-mono text-sm font-semibold">{m.movePlayedSan}</code>
                  </td>
                  <td>
                    <ReviewedBadge reviewed={m.reviewed} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {m.gameUrl ? (
                        <a href={m.gameUrl} target="_blank" rel="noreferrer" className="link link-primary">
                          Game
                        </a>
                      ) : null}
                      <a
                        href={lichessAnalysisUrl(m.fenBefore)}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-primary"
                      >
                        Analysis
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!rows.length ? (
        <p className="text-base-content/70">
          {tab === 'blunders'
            ? 'No blunders yet — import a PGN first.'
            : 'No missed mates yet — import analysed games first.'}
        </p>
      ) : null}
    </section>
  )
}

function ReviewedBadge({ reviewed }: { reviewed: boolean }) {
  return (
    <span
      className={`rounded-selector border px-2 py-0.5 font-mono text-xs ${
        reviewed ? 'border-success/40 text-success' : 'border-base-300 text-base-content/60'
      }`}
    >
      {reviewed ? 'Yes' : 'No'}
    </span>
  )
}
