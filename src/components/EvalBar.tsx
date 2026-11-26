import { whiteSharePercent } from './boardTheme'

/** Vertical eval bar. The fill shows the eval after the move. The amber line shows the eval before. */
export function EvalBar({
  evalBefore,
  evalAfter,
  orientation,
}: {
  evalBefore: number
  evalAfter: number
  orientation: 'white' | 'black'
}) {
  const after = whiteSharePercent(evalAfter)
  const before = whiteSharePercent(evalBefore)
  const whiteAtBottom = orientation === 'white'
  return (
    <div
      className="relative w-3.5 shrink-0 self-stretch border border-base-content/25 bg-neutral"
      role="img"
      aria-label={`Eval ${evalBefore.toFixed(2)} before your move, ${evalAfter.toFixed(2)} after`}
      title={`Eval ${evalBefore.toFixed(2)} → ${evalAfter.toFixed(2)}`}
    >
      <div
        className="absolute inset-x-0 bg-base-content"
        style={whiteAtBottom ? { bottom: 0, height: `${after}%` } : { top: 0, height: `${after}%` }}
      />
      <div
        className="absolute inset-x-0 h-0.5 bg-primary"
        style={whiteAtBottom ? { bottom: `${before}%` } : { top: `${before}%` }}
      />
    </div>
  )
}
