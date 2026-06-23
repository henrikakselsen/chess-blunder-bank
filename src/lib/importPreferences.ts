const KEY = 'chess-blunder-bank-import-v1'
const LEGACY_SETTINGS_KEY = 'chess-blunder-bank-settings-v1'
const LEGACY_SETTINGS_KEY_OLD = 'chess-learning-settings-v1'

import type { ImportMode } from '../db/schema'

export interface ImportPreferences {
  lichessUsername: string
  evalThresholdPawns: number
  max: number
  tags: boolean
  evals: boolean
  analysed: boolean
  clocks: boolean
  opening: boolean
  lastImportMode: ImportMode
}

export const defaultImportPreferences: ImportPreferences = {
  lichessUsername: '',
  evalThresholdPawns: 3,
  max: 50,
  tags: true,
  evals: true,
  analysed: true,
  clocks: false,
  opening: false,
  lastImportMode: 'append',
}

function parseImportMode(value: unknown): ImportMode {
  if (value === 'append' || value === 'update_duplicates' || value === 'replace_all') {
    return value
  }
  return defaultImportPreferences.lastImportMode
}

function parsePrefs(raw: string): ImportPreferences | null {
  try {
    const p = JSON.parse(raw) as Partial<ImportPreferences>
    return {
      lichessUsername:
        typeof p.lichessUsername === 'string'
          ? p.lichessUsername
          : defaultImportPreferences.lichessUsername,
      evalThresholdPawns:
        typeof p.evalThresholdPawns === 'number' && Number.isFinite(p.evalThresholdPawns)
          ? p.evalThresholdPawns
          : defaultImportPreferences.evalThresholdPawns,
      max:
        typeof p.max === 'number' && Number.isFinite(p.max) && p.max > 0
          ? p.max
          : defaultImportPreferences.max,
      tags: typeof p.tags === 'boolean' ? p.tags : defaultImportPreferences.tags,
      evals: typeof p.evals === 'boolean' ? p.evals : defaultImportPreferences.evals,
      analysed:
        typeof p.analysed === 'boolean' ? p.analysed : defaultImportPreferences.analysed,
      clocks:
        typeof p.clocks === 'boolean' ? p.clocks : defaultImportPreferences.clocks,
      opening:
        typeof p.opening === 'boolean' ? p.opening : defaultImportPreferences.opening,
      lastImportMode: parseImportMode(p.lastImportMode),
    }
  } catch {
    return null
  }
}

function migrateLegacySettings(): ImportPreferences | null {
  for (const key of [LEGACY_SETTINGS_KEY, LEGACY_SETTINGS_KEY_OLD]) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const p = JSON.parse(raw) as {
      lichessUsername?: string
      evalThresholdPawns?: number
    }
    return {
      ...defaultImportPreferences,
      lichessUsername:
        typeof p.lichessUsername === 'string' ? p.lichessUsername : '',
      evalThresholdPawns:
        typeof p.evalThresholdPawns === 'number' && Number.isFinite(p.evalThresholdPawns)
          ? p.evalThresholdPawns
          : defaultImportPreferences.evalThresholdPawns,
      lastImportMode: defaultImportPreferences.lastImportMode,
    }
  }
  return null
}

export function loadImportPreferences(): ImportPreferences {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    const parsed = parsePrefs(raw)
    if (parsed) return parsed
  }
  return migrateLegacySettings() ?? { ...defaultImportPreferences }
}

export function saveImportPreferences(prefs: ImportPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}
