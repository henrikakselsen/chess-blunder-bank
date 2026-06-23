function sideToMoveLabel(side: 'white' | 'black'): string {
  return side === 'white' ? 'White' : 'Black'
}

export function SideToMoveBadge({ side }: { side: 'white' | 'black' }) {
  const isWhite = side === 'white'
  return (
    <span
      className={`badge badge-lg font-medium ${
        isWhite
          ? 'border border-base-300 bg-white text-neutral'
          : 'border border-neutral bg-neutral text-white'
      }`}
    >
      {sideToMoveLabel(side)} to move
    </span>
  )
}
