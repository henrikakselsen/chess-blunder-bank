function sideToMoveLabel(side: 'white' | 'black'): string {
  return side === 'white' ? 'White' : 'Black'
}

export function SideToMoveBadge({ side }: { side: 'white' | 'black' }) {
  const isWhite = side === 'white'
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-selector border py-1 pr-3 pl-2 text-[13px] font-semibold ${
        isWhite ? 'border-white bg-white text-neutral' : 'border-base-content/40 bg-neutral text-white'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-3.5 rounded-full border-[1.5px] ${
          isWhite ? 'border-neutral bg-white' : 'border-white bg-neutral'
        }`}
      />
      {sideToMoveLabel(side)} to move
    </span>
  )
}
