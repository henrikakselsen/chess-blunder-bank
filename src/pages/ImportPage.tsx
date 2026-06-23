import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import type { ImportBatchRow, ImportMode } from '../db/schema'
import { importPgnText, type ImportProgress } from '../lib/importPgn'
import { fetchPgnFromUrl } from '../lib/fetchPgn'
import {
  defaultImportPreferences,
  loadImportPreferences,
  saveImportPreferences,
  type ImportPreferences,
} from '../lib/importPreferences'
import { buildLichessGamesUrl } from '../lib/lichessUrl'
import { captureException } from '../lib/errorLog'

const IMPORT_MODE_OPTIONS: { value: ImportMode; label: string; hint: string }[] = [
  {
    value: 'append',
    label: 'Add to existing',
    hint: 'Skip games already imported',
  },
  {
    value: 'update_duplicates',
    label: 'Update duplicates',
    hint: 'Re-scan games that appear in this import',
  },
  {
    value: 'replace_all',
    label: 'Replace all',
    hint: 'Delete all stored games and findings, then import',
  },
]

export function ImportPage() {
  const [prefs, setPrefs] = useState<ImportPreferences>(() => loadImportPreferences())
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [progress, setProgress] = useState<ImportUiProgress | null>(null)

  const importHistory = useLiveQuery(
    () => db.importBatches.orderBy('importedAt').reverse().limit(20).toArray(),
    [],
  )

  function updatePrefs(patch: Partial<ImportPreferences>) {
    setPrefs((p) => ({ ...p, ...patch }))
  }

  function importMeta(username: string) {
    return {
      username,
      maxGames: prefs.max,
      thresholdPawns: prefs.evalThresholdPawns,
    }
  }

  async function runImportFromText(pgn: string, sourceLabel: string, username: string) {
    setBusy(true)
    setLog(null)
    setProgress({ phase: 'parse', current: 0, total: 1 })
    try {
      const r = await importPgnText(pgn, username, prefs.evalThresholdPawns, {
        mode: prefs.lastImportMode,
        importMeta: importMeta(username),
        onProgress: setProgress,
      })
      const lines = [
        `Mode: ${importModeLabel(prefs.lastImportMode)}`,
        `Games seen: ${r.gamesSeen}`,
        `Skipped (non-standard variant): ${r.gamesSkippedVariant}`,
        `Skipped (not your game): ${r.gamesSkippedNotYou}`,
        `Skipped (already imported): ${r.gamesSkippedDuplicate}`,
        `New games imported: ${r.gamesImported}`,
        `Games updated: ${r.gamesUpdated}`,
        `Blunders found: ${r.mistakesAdded}`,
        `Missed mates found: ${r.matesAdded}`,
      ]
      if (r.parseFailed) lines.push('Could not parse PGN.')
      if (r.gamesFailed > 0) lines.push(`Games failed: ${r.gamesFailed}`)
      setLog(lines.join('\n'))
    } catch (e) {
      captureException('import.run', e, { extra: { sourceLabel } })
      setLog('Import failed.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function confirmReplaceAll(): boolean {
    return window.confirm(
      'This will delete all stored games, blunders, and missed mates before importing. Tags are kept. Continue?',
    )
  }

  async function handleFetchAndImport() {
    const username = prefs.lichessUsername.trim()
    if (!username) {
      setLog('Enter your Lichess username.')
      return
    }
    if (!prefs.evals || !prefs.analysed) {
      setLog('Enable both evals and analysed for blunder and mate detection.')
      return
    }
    if (prefs.lastImportMode === 'replace_all' && !confirmReplaceAll()) {
      return
    }

    saveImportPreferences(prefs)

    const url = buildLichessGamesUrl({
      username,
      max: prefs.max,
      tags: prefs.tags,
      evals: prefs.evals,
      analysed: prefs.analysed,
      clocks: prefs.clocks,
      opening: prefs.opening,
    })

    setBusy(true)
    setLog(null)
    setProgress({ phase: 'fetch', current: 0, total: 1 })
    try {
      const pgn = await fetchPgnFromUrl(url)
      setProgress({ phase: 'fetch', current: 1, total: 1 })
      await runImportFromText(pgn, url, username)
    } catch (e) {
      captureException('import.fetch', e, { extra: { url } })
      setLog('Could not fetch games from Lichess.')
      setBusy(false)
      setProgress(null)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const username = prefs.lichessUsername.trim()
    if (!username) {
      setLog('Enter your Lichess username.')
      return
    }
    if (prefs.lastImportMode === 'replace_all' && !confirmReplaceAll()) {
      e.target.value = ''
      return
    }
    saveImportPreferences(prefs)

    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      void runImportFromText(text, f.name, username)
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Import</h1>
      <p className="max-w-prose text-base-content/80">
        Fetch analysed games from Lichess. Each import scans for blunders and missed mates in one
        pass. Values are remembered in this browser.
      </p>

      <form
        className="grid max-w-lg gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handleFetchAndImport()
        }}
      >
        <label className="form-control w-full">
          <span className="label">
            <span className="label-text">Lichess username</span>
          </span>
          <input
            className="input input-bordered w-full"
            value={prefs.lichessUsername}
            onChange={(e) => updatePrefs({ lichessUsername: e.target.value })}
            placeholder="henrikakselsen"
            autoComplete="username"
            disabled={busy}
          />
        </label>

        <label className="form-control w-full">
          <span className="label">
            <span className="label-text">Max games</span>
          </span>
          <input
            className="input input-bordered w-full"
            type="number"
            min={1}
            max={200}
            value={prefs.max}
            onChange={(e) =>
              updatePrefs({
                max: Number.parseInt(e.target.value, 10) || defaultImportPreferences.max,
              })
            }
            disabled={busy}
          />
        </label>

        <label className="form-control w-full">
          <span className="label">
            <span className="label-text">Blunder threshold (pawns)</span>
          </span>
          <input
            className="input input-bordered w-full"
            type="number"
            step="0.1"
            min={0.5}
            value={prefs.evalThresholdPawns}
            onChange={(e) =>
              updatePrefs({
                evalThresholdPawns:
                  Number.parseFloat(e.target.value) || defaultImportPreferences.evalThresholdPawns,
              })
            }
            disabled={busy}
          />
        </label>

        <fieldset className="rounded-box border border-base-300 p-4">
          <legend className="label-text px-2 font-medium">Import mode</legend>
          <div className="mt-2 flex flex-col gap-3">
            {IMPORT_MODE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="importMode"
                  className="radio radio-primary radio-sm mt-1"
                  checked={prefs.lastImportMode === opt.value}
                  onChange={() => updatePrefs({ lastImportMode: opt.value })}
                  disabled={busy}
                />
                <span>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-base-content/70 block text-sm">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-box border border-base-300 p-4">
          <legend className="label-text px-2 font-medium">Lichess API options</legend>
          <div className="mt-2 flex flex-col gap-2">
            <BoolField
              label="tags"
              checked={prefs.tags}
              onChange={(tags) => updatePrefs({ tags })}
              disabled={busy}
            />
            <BoolField
              label="evals"
              checked={prefs.evals}
              onChange={(evals) => updatePrefs({ evals })}
              disabled={busy}
            />
            <BoolField
              label="analysed"
              checked={prefs.analysed}
              onChange={(analysed) => updatePrefs({ analysed })}
              disabled={busy}
            />
            <BoolField
              label="clocks"
              checked={prefs.clocks}
              onChange={(clocks) => updatePrefs({ clocks })}
              disabled={busy}
            />
            <BoolField
              label="opening"
              checked={prefs.opening}
              onChange={(opening) => updatePrefs({ opening })}
              disabled={busy}
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Importing…' : 'Import'}
          </button>
          <label className="btn btn-outline">
            Or choose a .pgn file
            <input
              type="file"
              className="hidden"
              accept=".pgn,text/plain"
              onChange={handleFile}
              disabled={busy}
            />
          </label>
        </div>
      </form>

      {busy && progress ? (
        <ImportProgressBar progress={progress} />
      ) : null}

      {log ? (
        <pre className="bg-base-300 text-base-content rounded-box whitespace-pre-wrap border border-base-100 p-4 font-mono text-sm">
          {log}
        </pre>
      ) : null}

      <ImportHistoryTable batches={importHistory ?? []} />
    </section>
  )
}

function ImportHistoryTable({ batches }: { batches: ImportBatchRow[] }) {
  if (batches.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-xl font-semibold">Import history</h2>
        <p className="text-base-content/70 text-sm">No imports yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">Import history</h2>
      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>When</th>
              <th>Mode</th>
              <th>Games</th>
              <th>Blunders</th>
              <th>Mates</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap">{formatImportDate(b.importedAt)}</td>
                <td>{importModeLabel(b.mode)}</td>
                <td>
                  {b.gamesImported}
                  {b.gamesUpdated > 0 ? ` + ${b.gamesUpdated} upd` : ''}
                  {b.gamesSkippedDuplicate > 0 ? ` (${b.gamesSkippedDuplicate} skip)` : ''}
                </td>
                <td>{b.mistakesAdded}</td>
                <td>{b.matesAdded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function importModeLabel(mode: ImportMode): string {
  switch (mode) {
    case 'append':
      return 'Add'
    case 'update_duplicates':
      return 'Update'
    case 'replace_all':
      return 'Replace all'
  }
}

function formatImportDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

type ImportUiProgress =
  | ImportProgress
  | { phase: 'fetch'; current: number; total: number }

function ImportProgressBar({ progress }: { progress: ImportUiProgress }) {
  const percent = progressPercent(progress)
  const label = progressLabel(progress)

  return (
    <div className="max-w-lg space-y-2">
      <progress
        className="progress progress-primary w-full"
        value={percent}
        max={100}
      />
      <p className="text-base-content/70 text-sm">{label}</p>
    </div>
  )
}

function progressPercent(progress: ImportUiProgress): number {
  if (progress.phase === 'fetch') {
    return progress.current >= progress.total ? 12 : 4
  }
  if (progress.phase === 'parse') {
    return progress.current >= progress.total ? 18 : 14
  }
  const total = Math.max(progress.total, 1)
  return 20 + Math.round((progress.current / total) * 80)
}

function progressLabel(progress: ImportUiProgress): string {
  if (progress.phase === 'fetch') {
    return progress.current >= progress.total
      ? 'Fetched games from Lichess'
      : 'Fetching games from Lichess…'
  }
  if (progress.phase === 'parse') {
    return progress.current >= progress.total ? 'Parsed PGN' : 'Parsing PGN…'
  }
  if (progress.total === 0) return 'Processing games…'
  return `Processing games… ${progress.current} / ${progress.total}`
}

function BoolField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        className="checkbox checkbox-primary checkbox-sm"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="font-mono text-sm">{label}</span>
    </label>
  )
}
