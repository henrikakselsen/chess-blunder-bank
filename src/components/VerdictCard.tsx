import type { ReactNode } from 'react'
import { formatLoss, verdictDisplay } from '../lib/engine/verdictDisplay'
import type { ReviewMoveVerdict } from '../lib/engine/types'

const BEST_COLOR = '#5fc58c'
const THREAT_COLOR = '#f0705f'

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-selector border border-base-300 bg-base-200 px-2 py-1.5 font-mono text-[12.5px] leading-none">
      {children}
    </span>
  )
}

/** The verdict on a move: one big word, one symbol, one colour, then the facts and the actions. */
export function VerdictCard({
  verdict,
  bestShown,
  threatsShown,
  hasThreats,
  actions,
}: {
  verdict: ReviewMoveVerdict
  bestShown: boolean
  threatsShown: boolean
  hasThreats: boolean
  actions: ReactNode
}) {
  const d = verdictDisplay(verdict.quality)
  const loss = formatLoss(verdict.quality, verdict.lossPawns)
  const threat = verdict.opponentReplies.find((r) => r.rank === 1) ?? verdict.opponentReplies[0]

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="status"
        className="grid gap-2.5 rounded-box border px-4 py-3.5"
        style={{ borderColor: d.color, background: `color-mix(in oklab, ${d.color} 13%, var(--color-base-100))` }}
      >
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="grid size-12 flex-none place-items-center rounded-full font-mono text-xl font-bold text-neutral"
            style={{ background: d.color }}
          >
            {d.symbol}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[28px] leading-none font-bold" style={{ color: d.color }}>
              {d.label}
            </p>
            <p className="mt-1.5 text-sm">
              <span className="font-mono font-semibold">{verdict.userMoveSan}</span> · {d.summary}
            </p>
          </div>
        </div>
        {loss || (bestShown && verdict.bestMoveSan) || hasThreats ? (
          <div className="flex flex-wrap gap-2">
            {loss ? (
              <Chip>
                Cost <b className="font-semibold">{loss}</b> pawns
              </Chip>
            ) : null}
            {bestShown && verdict.bestMoveSan ? (
              <Chip>
                <i aria-hidden="true" className="inline-block h-[3px] w-4 rounded-full" style={{ background: BEST_COLOR }} />
                Best <b className="font-semibold" style={{ color: BEST_COLOR }}>{verdict.bestMoveSan}</b>
              </Chip>
            ) : null}
            {hasThreats ? (
              <Chip>
                <i aria-hidden="true" className="inline-block h-[3px] w-4 rounded-full" style={{ background: THREAT_COLOR }} />
                {threatsShown && threat ? (
                  <>
                    Threat <b className="font-semibold" style={{ color: THREAT_COLOR }}>{threat.san}</b>
                  </>
                ) : (
                  'Your opponent has a strong reply'
                )}
              </Chip>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}
