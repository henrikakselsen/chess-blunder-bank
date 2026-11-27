/** Button that adds or removes the "instructive" star on a position. Shortcut: i. */
export function StarButton({ starred, onClick }: { starred: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`btn col-span-2 sm:col-span-1 ${starred ? 'btn-warning' : 'btn-outline'}`}
      aria-pressed={starred}
      title="Save as instructive (i)"
      onClick={onClick}
    >
      {starred ? '★ Instructive' : '☆ Instructive'}
    </button>
  )
}
