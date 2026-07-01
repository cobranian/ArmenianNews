/* ------------------------------------------------------------------ *
 * Shared "illuminated" fallbacks for the social carousels.
 *
 * When a curated post has no locally-bundled image, its card still
 * ALWAYS paints: a deterministic Armenian-inspired ornament on one of
 * four palette colourways, seeded from the post URL so a given post
 * always looks the same. Used by both the Instagram wall and the
 * Don Narek (Facebook) carousel.
 * ------------------------------------------------------------------ */

export function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/* Four colourways drawn from the palette. */
export const THEMES = [
  { c1: '#6e0e1a', c2: '#9a1b2b', ink: '#e0bd6a' }, // pomegranate
  { c1: '#1c3d5a', c2: '#2a577d', ink: '#e0bd6a' }, // lapis
  { c1: '#4a0710', c2: '#6e0e1a', ink: '#e0bd6a' }, // deep wine
  { c1: '#9c7a32', c2: '#c8a04b', ink: '#4a0710' }, // gilt
]

/* Armenian-inspired ornaments, drawn on a 100×100 viewBox. */
export function Motif({ index }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (index % 5) {
    case 0: // Arevakhach — Armenian eternity wheel
      return (
        <g {...common}>
          <circle cx="50" cy="50" r="9" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path
              key={a}
              d="M50 41 C 62 35, 70 44, 62 52"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
          <circle cx="50" cy="50" r="34" strokeWidth="1.4" opacity="0.6" />
        </g>
      )
    case 1: // Khachkar cross
      return (
        <g {...common}>
          <path d="M50 16 V84 M16 50 H84" />
          <circle cx="50" cy="50" r="11" />
          {[[50, 16], [50, 84], [16, 50], [84, 50]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" />
          ))}
          <path d="M30 30 Q50 40 70 30 M30 70 Q50 60 70 70" strokeWidth="1.4" opacity="0.6" />
        </g>
      )
    case 2: // Pomegranate
      return (
        <g {...common}>
          <path d="M50 22 C 30 30, 26 58, 50 84 C 74 58, 70 30, 50 22 Z" />
          <path d="M50 16 C 46 18, 46 22, 50 22 C 54 22, 54 18, 50 16" />
          <path d="M40 48 h20 M38 60 h24 M44 38 h12" strokeWidth="1.4" opacity="0.65" />
        </g>
      )
    case 3: // Interlaced knot
      return (
        <g {...common}>
          <path d="M30 50 C30 30 70 30 70 50 C70 70 30 70 30 50 Z" />
          <path d="M50 30 C70 30 70 70 50 70 C30 70 30 30 50 30 Z" opacity="0.7" />
        </g>
      )
    default: // Eight-point star
      return (
        <g {...common}>
          <path d="M50 14 L58 42 L86 50 L58 58 L50 86 L42 58 L14 50 L42 42 Z" />
          <path
            d="M50 26 L55 45 L74 50 L55 55 L50 74 L45 55 L26 50 L45 45 Z"
            strokeWidth="1.4"
            opacity="0.6"
          />
        </g>
      )
  }
}
