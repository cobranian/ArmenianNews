import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import ig from '../data/instagram.json'
import feed from '../data/instagram-feed.json'

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
 * an on-brand tile that ALWAYS paints and links out to the real post.
 * Which posts show, and in what order, is re-randomised hourly by the
 * snapshot job (instagram-feed.json). The motif fallback + palette live
 * in ./motifs.jsx (shared with the Don Narek carousel).
 * ------------------------------------------------------------------ */

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

  // Use the hourly-baked random selection; fall back to flattening the
  // curated accounts (e.g. before the first snapshot exists).
  const posts = useMemo(() => {
    const base =
      feed.posts && feed.posts.length
        ? feed.posts
        : ig.accounts.flatMap((acc) =>
            (acc.permalinks || []).map((url) => ({
              url,
              handle: acc.handle,
              name: acc.name,
            })),
          )
    return base.map((p) => ({ ...p, img: imgMap[shortcode(p.url)] || null }))
  }, [])

  return (
    <section className="section section--alt" id="instagram">
      <div className="container">
        <SectionHead eyebrow="Instagram" title={t('ig.title')} subtitle={t('ig.subtitle')} />

        {posts.length > 0 && (
          <Carousel label={t('ig.title')}>
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
          </Carousel>
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
