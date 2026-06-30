// A small khachkar-inspired interlace knot used as a section divider mark.
export function KnotMark({ className }) {
  return (
    <span className={`ornament ${className || ''}`}>
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M32 6c10 6 10 14 0 20S22 32 32 38s10 14 0 20" />
          <path d="M32 6C22 12 22 20 32 26s10 6 0 12-10 14 0 20" />
          <circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none" />
          <path d="M8 32h8M48 32h8" />
          <circle cx="8" cy="32" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="56" cy="32" r="2.4" fill="currentColor" stroke="none" />
        </g>
      </svg>
    </span>
  )
}

// Mount Ararat silhouette (twin peaks: Masis + Sis) for the hero base.
export function Ararat({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 150"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M0 150 L0 96 L210 96 L430 30 L520 70 L610 18 L760 96 L905 50 L980 78
           L1130 14 L1250 70 L1320 52 L1440 96 L1440 150 Z"
      />
      <path
        fill="rgba(244,236,216,0.16)"
        d="M610 18 L640 42 L600 50 L630 70 L760 96 L905 50 L905 50 L760 96 L610 18 Z"
      />
      <path
        fill="rgba(244,236,216,0.14)"
        d="M1130 14 L1162 40 L1120 48 L1150 66 L1250 70 L1130 14 Z"
      />
    </svg>
  )
}
