/**
 * PGN TimeControl (Lichess: base seconds + increment), e.g. "120+1" for 2+1.
 */

export interface ClockTimeControl {
  baseSeconds: number
  incrementSeconds: number
}

export type ParsedTimeControl =
  | { kind: 'clock'; clock: ClockTimeControl }
  | { kind: 'unlimited' }
  | { kind: 'correspondence' }
  | { kind: 'unknown' }

const CLOCK_RE = /^(\d+)\+(\d+)$/

export function parseTimeControlTag(
  raw: string | undefined,
): ParsedTimeControl {
  const tc = raw?.trim()
  if (!tc || tc === '?') return { kind: 'unknown' }
  if (tc === '-') return { kind: 'unlimited' }
  if (tc.includes('/')) return { kind: 'correspondence' }

  const m = CLOCK_RE.exec(tc)
  if (!m) return { kind: 'unknown' }

  const baseSeconds = Number.parseInt(m[1]!, 10)
  const incrementSeconds = Number.parseInt(m[2]!, 10)
  if (
    !Number.isFinite(baseSeconds) ||
    !Number.isFinite(incrementSeconds) ||
    baseSeconds < 0 ||
    incrementSeconds < 0
  ) {
    return { kind: 'unknown' }
  }

  return {
    kind: 'clock',
    clock: { baseSeconds, incrementSeconds },
  }
}

/** Estimated clock budget over 40 moves (common Lichess comparison heuristic). */
export function estimatedSecondsAt40Moves(clock: ClockTimeControl): number {
  return clock.baseSeconds + 40 * clock.incrementSeconds
}

export interface MinTimeControl {
  minutes: number
  incrementSeconds: number
}

export const defaultMinTimeControl: MinTimeControl = {
  minutes: 2,
  incrementSeconds: 1,
}

/**
 * True when the game is at least as slow as min (e.g. 2+1 includes 3+0, 5+3, not 1+0).
 */
export function meetsMinTimeControl(
  raw: string | undefined,
  min: MinTimeControl = defaultMinTimeControl,
): boolean {
  const parsed = parseTimeControlTag(raw)
  if (parsed.kind === 'unlimited' || parsed.kind === 'correspondence') {
    return true
  }
  if (parsed.kind === 'unknown') {
    return false
  }

  const minBaseSeconds = min.minutes * 60
  const minBudget = estimatedSecondsAt40Moves({
    baseSeconds: minBaseSeconds,
    incrementSeconds: min.incrementSeconds,
  })
  const gameBudget = estimatedSecondsAt40Moves(parsed.clock)

  return gameBudget >= minBudget
}
