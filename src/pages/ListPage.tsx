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
    <section>
      <h1>Alle tabber</h1>
      <div className="row filters">
        <label>
          <input
            type="checkbox"
            checked={onlyUnreviewed}
            onChange={(e) => setOnlyUnreviewed(e.target.checked)}
          />
          Kun ugjennomgåtte
        </label>
        <label>
          Tagg
          <select
            value={tagFilterId === '' ? '' : String(tagFilterId)}
            onChange={(e) =>
              setTagFilterId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">(alle)</option>
            {(tags ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Eval</th>
            <th>Trekk</th>
            <th>Gjennomgått</th>
            <th>Lenker</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.createdAt).toLocaleString('nb-NO')}</td>
              <td>
                {m.evalBefore.toFixed(2)} → {m.evalAfter.toFixed(2)}
              </td>
              <td>
                <code>{m.moveSan}</code>
              </td>
              <td>{m.reviewed ? 'Ja' : 'Nei'}</td>
              <td className="links">
                {m.gameUrl ? (
                  <a href={m.gameUrl} target="_blank" rel="noreferrer">
                    Parti
                  </a>
                ) : null}{' '}
                <a href={lichessAnalysisUrl(m.fenBefore)} target="_blank" rel="noreferrer">
                  Analyse
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p>Ingen tabber ennå — importer PGN først.</p> : null}
    </section>
  )
}
