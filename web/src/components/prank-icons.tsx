// Small hand-drawn glyphs for each prank kind. Same ink weight as the scars.

const INK = "currentColor";

export function PrankIcon({ kind, className = "size-7" }: { kind: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      {kind === 0 && (
        <>
          <rect x={17} y={16} width={15} height={26} rx={3} />
          <path d="M19 16 q5.5-6 11 0" />
          <rect x={22} y={7} width={5} height={4} rx={1} />
          <path d="M14 9 l-4-2 M14 13 h-5 M14 17 l-4 2" />
        </>
      )}
      {kind === 1 && (
        <>
          <path d="M8 26 q16-20 32 0 z" />
          <path d="M4 26 h40" />
          <path d="M30 12 l6-6 M34 16 l8-4" />
        </>
      )}
      {kind === 2 && (
        <>
          <path d="M10 34 a7 7 0 0 1 2-13 a9 9 0 0 1 17-3 a7 7 0 0 1 9 9 a6 6 0 0 1-2 11 z" />
          <path d="M16 12 q-3-3 0-6 M24 10 q-3-3 0-6" />
          <circle cx={38} cy={10} r={1.6} fill={INK} />
        </>
      )}
      {kind === 3 && (
        <>
          <circle cx={24} cy={27} r={13} />
          <path d="M24 14 l-5-4 l4 .5 l1-4 l1 4 l4-.5 z" />
          <path d="M18 23 a6 5 0 0 1 5-4" />
        </>
      )}
      {kind === 4 && (
        <>
          <circle cx={15} cy={24} r={9} />
          <circle cx={34} cy={24} r={9} />
          <circle cx={17} cy={28} r={3.5} fill={INK} />
          <circle cx={31} cy={20} r={3.5} fill={INK} />
        </>
      )}
    </svg>
  );
}
