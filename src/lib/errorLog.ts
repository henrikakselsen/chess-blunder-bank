const STORAGE_KEY = 'chess-blunder-bank-error-log'
const MAX_ENTRIES = 200

export interface ErrorLogEntry {
  id: string
  at: string
  source: string
  message: string
  stack?: string
  gameId?: string
  extra?: Record<string, unknown>
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function readEntries(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ErrorLogEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEntries(entries: ErrorLogEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
}

function persistEntry(entry: ErrorLogEntry): void {
  const entries = readEntries()
  entries.push(entry)
  writeEntries(entries)

  if (import.meta.env.DEV) {
    void fetch('/__app_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      /* dev middleware may be unavailable outside vite */
    })
  }

  console.error(`[${entry.source}]`, entry.message, entry.gameId ?? '', entry.extra ?? '', entry.stack ?? '')
}

/** Agent-only logging — not shown in the UI. */
export function logError(entry: Omit<ErrorLogEntry, 'id' | 'at'>): void {
  persistEntry({
    id: newId(),
    at: new Date().toISOString(),
    ...entry,
  })
}

export function captureException(
  source: string,
  err: unknown,
  context?: { gameId?: string; extra?: Record<string, unknown> },
): void {
  logError({
    source,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    gameId: context?.gameId,
    extra: context?.extra,
  })
}
