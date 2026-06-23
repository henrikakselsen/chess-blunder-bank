import type { MissedMateRow } from '../db/schema'
import { shuffleInPlace } from './shuffle'

export type MateFilter = 'all' | 1 | 2

const KEY_PREFIX = 'chess-blunder-bank-mate-session-v1'

export interface MateTrainingSessionState {
  version: 1
  filter: MateFilter
  activeQueueIds: number[]
  idx: number
  round: 'main' | 'repeat'
  repeatRound: number
  pendingRepeatIds: number[]
  sessionComplete: boolean
}

export interface ResolvedMateSession {
  activeQueue: MissedMateRow[]
  idx: number
  round: 'main' | 'repeat'
  repeatRound: number
  pendingRepeatIds: Set<number>
  sessionComplete: boolean
}

function storageKey(filter: MateFilter): string {
  return `${KEY_PREFIX}:${filter}`
}

function parseFilter(value: unknown): MateFilter | null {
  if (value === 'all' || value === 1 || value === 2) return value
  return null
}

function parseIdArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const ids = value.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  return ids
}

export function loadMateTrainingSession(filter: MateFilter): MateTrainingSessionState | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(storageKey(filter))
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<MateTrainingSessionState>
    if (s.version !== 1) return null
    const f = parseFilter(s.filter)
    if (f !== filter) return null
    const activeQueueIds = parseIdArray(s.activeQueueIds)
    const pendingRepeatIds = parseIdArray(s.pendingRepeatIds)
    if (!activeQueueIds || !pendingRepeatIds) return null
    if (typeof s.idx !== 'number' || !Number.isFinite(s.idx)) return null
    if (s.round !== 'main' && s.round !== 'repeat') return null
    if (typeof s.repeatRound !== 'number' || !Number.isFinite(s.repeatRound)) return null
    if (typeof s.sessionComplete !== 'boolean') return null
    return {
      version: 1,
      filter: f,
      activeQueueIds,
      idx: s.idx,
      round: s.round,
      repeatRound: s.repeatRound,
      pendingRepeatIds,
      sessionComplete: s.sessionComplete,
    }
  } catch {
    return null
  }
}

export function saveMateTrainingSession(
  filter: MateFilter,
  state: Omit<MateTrainingSessionState, 'version' | 'filter'>,
): void {
  if (typeof localStorage === 'undefined') return
  const payload: MateTrainingSessionState = { version: 1, filter, ...state }
  localStorage.setItem(storageKey(filter), JSON.stringify(payload))
}

export function clearMateTrainingSession(filter: MateFilter): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(storageKey(filter))
}

export function buildById(sourceQueue: MissedMateRow[]): Map<number, MissedMateRow> {
  const map = new Map<number, MissedMateRow>()
  for (const row of sourceQueue) {
    if (row.id != null) map.set(row.id, row)
  }
  return map
}

export function shuffleQueueIds(rows: MissedMateRow[]): number[] {
  const ids = rows.map((m) => m.id).filter((n): n is number => n != null)
  shuffleInPlace(ids)
  return ids
}

export function rowsFromIds(ids: number[], byId: Map<number, MissedMateRow>): MissedMateRow[] {
  return ids.map((id) => byId.get(id)).filter((row): row is MissedMateRow => row != null)
}

export function mergeQueueWithSource(
  activeQueueIds: number[],
  pendingRepeatIds: number[],
  sourceQueue: MissedMateRow[],
): { activeQueueIds: number[]; pendingRepeatIds: number[] } {
  const validIds = new Set(
    sourceQueue.map((m) => m.id).filter((n): n is number => n != null),
  )
  const kept = activeQueueIds.filter((id) => validIds.has(id))
  const keptSet = new Set(kept)
  const newIds = sourceQueue
    .map((m) => m.id)
    .filter((n): n is number => n != null && !keptSet.has(n))
  return {
    activeQueueIds: [...kept, ...newIds],
    pendingRepeatIds: pendingRepeatIds.filter((id) => validIds.has(id)),
  }
}

export function resolveInitialSession(
  filter: MateFilter,
  sourceQueue: MissedMateRow[],
): ResolvedMateSession {
  const byId = buildById(sourceQueue)
  const empty: ResolvedMateSession = {
    activeQueue: rowsFromIds(shuffleQueueIds(sourceQueue), byId),
    idx: 0,
    round: 'main',
    repeatRound: 0,
    pendingRepeatIds: new Set(),
    sessionComplete: false,
  }

  if (sourceQueue.length === 0) {
    return { ...empty, activeQueue: [] }
  }

  const saved = loadMateTrainingSession(filter)
  if (!saved) return empty

  const merged = mergeQueueWithSource(
    saved.activeQueueIds,
    saved.pendingRepeatIds,
    sourceQueue,
  )
  const activeQueue = rowsFromIds(merged.activeQueueIds, byId)
  if (activeQueue.length === 0) return empty

  const idx = Math.min(Math.max(0, saved.idx), activeQueue.length - 1)

  return {
    activeQueue,
    idx,
    round: saved.round,
    repeatRound: saved.repeatRound,
    pendingRepeatIds: new Set(merged.pendingRepeatIds),
    sessionComplete: saved.sessionComplete,
  }
}

export function syncSessionWithSource(
  sourceQueue: MissedMateRow[],
  activeQueue: MissedMateRow[],
  pendingRepeatIds: Set<number>,
  idx: number,
): Pick<ResolvedMateSession, 'activeQueue' | 'idx' | 'pendingRepeatIds'> {
  const byId = buildById(sourceQueue)
  const merged = mergeQueueWithSource(
    activeQueue.map((m) => m.id!).filter((n): n is number => n != null),
    [...pendingRepeatIds],
    sourceQueue,
  )
  const nextQueue = rowsFromIds(merged.activeQueueIds, byId)
  if (nextQueue.length === 0 && sourceQueue.length > 0) {
    return {
      activeQueue: rowsFromIds(shuffleQueueIds(sourceQueue), byId),
      idx: 0,
      pendingRepeatIds: new Set(),
    }
  }
  const nextIdx =
    nextQueue.length === 0 ? 0 : Math.min(idx, nextQueue.length - 1)
  return {
    activeQueue: nextQueue,
    idx: nextIdx,
    pendingRepeatIds: new Set(merged.pendingRepeatIds),
  }
}
