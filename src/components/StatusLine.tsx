import type { ReactNode } from 'react'

export type StatusTone = 'success' | 'error' | 'warning' | 'neutral'

const toneClass: Record<StatusTone, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
  neutral: 'border-l-base-content/40',
}

/** One line of feedback below the board. The left edge shows the tone. */
export function StatusLine({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`border border-l-[3px] border-base-300 bg-base-100 px-3 py-2.5 font-mono text-[13px] leading-snug ${toneClass[tone]}`}
    >
      {children}
    </p>
  )
}
