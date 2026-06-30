import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import ig from '../data/instagram.json'

/* Locally stored post previews (og:image), keyed by shortcode. Refreshed
 * by the snapshot job; bundled at build time so they never expire or hit
 * CORS/hotlink blocks. Posts without a stored image fall back to a motif. */
const IMAGES = import.meta.glob('../data/ig/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const imgMap = Object.fromEntries(
  Object.entries(IMAGES).map(([path, src]) => [
    path.split('/').pop().replace(/\.jpg$/, ''),
    src,
  ]),
)
const shortcode = (url) => url.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || null

/* ------------------------------------------------------------------ *
 * Reliable "illuminated postcard" wall.
 *
 * Instagram's official embed.js refuses to hydrate in many real-world
 * conditions (ad-blockers, region locks, rate limits) — leaving blank
 * cells. Instead of depending on it, every curated permalink renders as
 * an on-brand manuscript tile that ALWAYS paints and links out to the
 * real post. Cover art (motif + colourway) is derived deterministically
 * from the permalink, so each post keeps a stable, distinct face.
 * ------------------------------------------------------------------ */

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* Four colourways drawn from the illuminated-manuscript palette. */
const THEMES = [
  { c1: '#6e0e1a', c2: '#9a1b2b', ink: '#e0bd6a' }, // pomegranate
  { c1: '#1c3d5a', c2: '#2a577d', ink: '#e0bd6a' }, // lapis
  { c1: '#4a0710', c2: '#6e0e1a', ink: '#e0bd6a' }, // deep wine
  { c1: '#9c7a32', c2: '#c8a04b', ink: '#4a0710' }, // gilt
]

/* Armenian-inspired ornaments, drawn on a 100×100 viewBox. */
function Motif({ index }) {
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

function PostCard({ url, handle, name, view, img }) {
  const seed = hash(url)
  const theme = THEMES[seed % THEMES.length]
  const isReel = /\/reel\//.test(url)
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken

  return (
    <a
      className="ig-card reveal"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
    >
      <div className={`ig-card__cover${showPhoto ? ' ig-card__cover--photo' : ''}`}>
        {showPhoto ? (
          <img
            className="ig-card__photo"
            src={img}
            alt={`@${handle} — ${name}`}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="ig-card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        <span className="ig-card__kind">{isReel ? '▷ Reel' : '◻ Post'}</span>
        <span className="ig-card__corner ig-card__corner--tl" aria-hidden="true" />
        <span className="ig-card__corner ig-card__corner--br" aria-hidden="true" />
      </div>
      <div className="ig-card__body">
        <div className="ig-card__handle">
          <span aria-hidden="true">◎</span> @{handle}
        </div>
        <div className="ig-card__name">{name}</div>
        <div className="ig-card__cta">
          {view} <span aria-hidden="true">→</span>
        </div>
      </div>
    </a>
  )
}

export function Instagram() {
  const { t } = useI18n()

  // Flatten every curated permalink across accounts.
  const allPosts = useMemo(
    () =>
      ig.accounts.flatMap((acc) =>
        (acc.permalinks || []).map((url) => ({
          url,
          handle: acc.handle,
          name: acc.name,
          img: imgMap[shortcode(url)] || null,
        })),
      ),
    [],
  )

  const [posts, setPosts] = useState(() => shuffle(allPosts).slice(0, 9))
  const reshuffle = () => setPosts(shuffle(allPosts).slice(0, 9))

  return (
    <section className="section section--alt" id="instagram">
      <div className="container">
        <SectionHead eyebrow="Instagram" title={t('ig.title')} subtitle={t('ig.subtitle')} />

        {posts.length > 0 && (
          <>
            <div className="ig-toolbar reveal">
              <button className="btn-gold" onClick={reshuffle}>
                ✦ {t('ig.shuffle')}
              </button>
            </div>
            <div className="ig-grid">
              {posts.map((p) => (
                <PostCard
                  key={p.url}
                  url={p.url}
                  handle={p.handle}
                  name={p.name}
                  img={p.img}
                  view={t('ig.view')}
                />
              ))}
            </div>
          </>
        )}

        {/* Account chips: entry points + graceful fallback for accounts
            that have no curated permalinks yet. */}
        <div className="ig-accounts reveal">
          {ig.accounts.map((acc) => (
            <a
              key={acc.handle}
              className="ig-chip"
              href={acc.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('ig.visit')}
            >
              <span aria-hidden="true">◎</span> @{acc.handle}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
