/** Position in a queue: one tick per item, or a plain bar for a long queue. */
export function QueueProgress({ index, total }: { index: number; total: number }) {
  if (total > 40) {
    return (
      <progress
        className="progress progress-primary h-1.5 max-w-80 min-w-28 flex-1"
        value={index + 1}
        max={total}
      />
    )
  }
  return (
    <div aria-hidden="true" className="flex max-w-80 min-w-28 flex-1 gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 ${
            i < index ? 'bg-base-content/50' : i === index ? 'bg-primary' : 'bg-base-300'
          }`}
        />
      ))}
    </div>
  )
}
