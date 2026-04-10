import { useState } from 'react'
import type { AppSettings } from '../lib/settingsStorage'
import { loadSettings, saveSettings } from '../lib/settingsStorage'

export function SettingsPage() {
  const [s, setS] = useState<AppSettings>(() => loadSettings())
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    saveSettings(s)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section>
      <h1>Innstillinger</h1>
      <form onSubmit={handleSave} className="stack">
        <label className="field">
          <span>Lichess-brukernavn</span>
          <input
            value={s.lichessUsername}
            onChange={(e) =>
              setS((p) => ({ ...p, lichessUsername: e.target.value }))
            }
            placeholder="henrikakselsen"
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span>Terskel for stor tabbe (bønder)</span>
          <input
            type="number"
            step="0.1"
            min="0.5"
            value={s.evalThresholdPawns}
            onChange={(e) =>
              setS((p) => ({
                ...p,
                evalThresholdPawns: Number.parseFloat(e.target.value) || 3,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Sist brukte import-URL (mal)</span>
          <textarea
            rows={3}
            value={s.lastImportUrl}
            onChange={(e) =>
              setS((p) => ({ ...p, lastImportUrl: e.target.value }))
            }
          />
        </label>
        <button type="submit">Lagre</button>
        {saved ? <p className="ok">Lagret.</p> : null}
      </form>
    </section>
  )
}
