import { useEffect, useState } from 'react'
import { importPgnText } from '../lib/importPgn'
import { fetchPgnFromUrl } from '../lib/fetchPgn'
import { loadSettings, saveSettings } from '../lib/settingsStorage'

export function ImportPage() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)

  useEffect(() => {
    const s = loadSettings()
    setUrl(s.lastImportUrl)
  }, [])

  async function runImportFromText(pgn: string, sourceLabel: string) {
    const settings = loadSettings()
    if (!settings.lichessUsername.trim()) {
      setLog('Sett Lichess-brukernavn under Innstillinger først.')
      return
    }
    setBusy(true)
    setLog(null)
    try {
      const r = await importPgnText(
        pgn,
        settings.lichessUsername,
        settings.evalThresholdPawns,
      )
      const lines = [
        `Kilde: ${sourceLabel}`,
        `Partier sett: ${r.gamesSeen}`,
        `Hoppet over (variant): ${r.gamesSkippedVariant}`,
        `Hoppet over (ikke ditt parti): ${r.gamesSkippedNotYou}`,
        `Hoppet over (allerede importert): ${r.gamesSkippedAlreadyImported}`,
        `Nye partier importert: ${r.gamesImported}`,
        `Nye tabber lagret: ${r.mistakesAdded}`,
        ...r.errors.map((e) => `Feil: ${e}`),
      ]
      setLog(lines.join('\n'))
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleFetchUrl() {
    const settings = loadSettings()
    saveSettings({ ...settings, lastImportUrl: url })
    setBusy(true)
    setLog(null)
    try {
      const pgn = await fetchPgnFromUrl(url)
      await runImportFromText(pgn, url)
    } catch (e) {
      setBusy(false)
      setLog(
        e instanceof Error
          ? `${e.message}\n\nTips: prøv å bytte til proxy-URL som starter med /lichess/ (se README).`
          : String(e),
      )
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      void runImportFromText(text, f.name)
    }
    reader.readAsText(f)
  }

  return (
    <section>
      <h1>Importer PGN</h1>
      <p className="lead">
        Hent analyserte partier fra Lichess med{' '}
        <code>evals=true</code> og <code>analysed=true</code>. Brukernavn og
        terskel står under Innstillinger.
      </p>
      <div className="stack">
        <label className="field">
          <span>URL</span>
          <textarea
            rows={4}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void handleFetchUrl()}>
            {busy ? 'Importerer…' : 'Hent og importer'}
          </button>
          <label className="file-btn">
            Eller velg .pgn-fil
            <input type="file" accept=".pgn,text/plain" onChange={handleFile} disabled={busy} />
          </label>
        </div>
        {log ? (
          <pre className="log">{log}</pre>
        ) : null}
      </div>
    </section>
  )
}
