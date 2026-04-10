const KEY = 'chess-learning-settings-v1'

export interface AppSettings {
  lichessUsername: string
  evalThresholdPawns: number
  lastImportUrl: string
}

const defaults: AppSettings = {
  lichessUsername: '',
  evalThresholdPawns: 3,
  lastImportUrl:
    'https://lichess.org/api/games/user/REPLACE?tags=true&evals=true&analysed=true&clocks=false&opening=false&max=50',
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    const p = JSON.parse(raw) as Partial<AppSettings>
    return {
      lichessUsername: typeof p.lichessUsername === 'string' ? p.lichessUsername : defaults.lichessUsername,
      evalThresholdPawns:
        typeof p.evalThresholdPawns === 'number' && Number.isFinite(p.evalThresholdPawns)
          ? p.evalThresholdPawns
          : defaults.evalThresholdPawns,
      lastImportUrl: typeof p.lastImportUrl === 'string' ? p.lastImportUrl : defaults.lastImportUrl,
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
