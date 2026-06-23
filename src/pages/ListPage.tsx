import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { lichessAnalysisUrl } from '../lib/lichessUrl'
import { useMemo, useState } from 'react'
import { listTagsOrdered } from '../db/tags'

export function ListPage() {
  const mistakes = useLiveQuery(() => db.mistakes.toArray(), [])
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

  const rows = useMemo(() => {
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

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">All blunders</h1>
      <div className="flex flex-wrap items-end gap-4">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={onlyUnreviewed}
            onChange={(e) => setOnlyUnreviewed(e.target.checked)}
          />
          <span className="label-text">Unreviewed only</span>
        </label>
        <label className="form-control">
          <span className="label py-0">
            <span className="label-text">Tag</span>
          </span>
          <select
            className="select select-bordered select-sm min-w-40"
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
      </div>
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-zebra table-sm">
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
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.createdAt).toLocaleString('en-GB')}</td>
                <td>
                  {m.evalBefore.toFixed(2)} → {m.evalAfter.toFixed(2)}
                </td>
                <td>
                  <code className="text-sm">{m.moveSan}</code>
                </td>
                <td>{m.reviewed ? 'Yes' : 'No'}</td>
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
      </div>
      {!rows.length ? (
        <p className="text-base-content/70">No blunders yet — import a PGN first.</p>
      ) : null}
    </section>
  )
}
