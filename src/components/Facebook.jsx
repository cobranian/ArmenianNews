import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import fb from '../data/facebook.json'

/* ------------------------------------------------------------------ *
 * Don Narek — self-hosted post carousel.
 *
 * The official Facebook Page Plugin drags in the whole page chrome
 * (cover photo, "Don Narek" header, Like/facepile, the FB shell) and
 * often refuses to hydrate behind ad-blockers / region locks. Instead
 * every curated post renders as an on-brand card that ALWAYS paints and
 * shows ONLY what we want: the post's picture and the person who posted
 * it. Cards link out to the real post. See src/data/facebook.json.
 *
 * Post images live in src/data/fb/ and are bundled at build time so they
 * never hotlink or expire; a post with no image falls back to an
 * Armenian motif (shared with the Instagram wall, ./motifs.jsx).
 * ------------------------------------------------------------------ */
const IMAGES = import.meta.glob('../data/fb/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const imgMap = Object.fromEntries(
  Object.entries(IMAGES).map(([path, src]) => [path.split('/').pop(), src]),
)

/* Initials for the author monogram, e.g. "Don Narek" → "DN". */
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function PostCard({ post, author, view, img }) {
  const seed = hash(post.id || post.url || author)
  const theme = THEMES[seed % THEMES.length]
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken
  const by = post.author || author

  return (
    <a
      className="fb-card reveal"
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
    >
      <div className={`fb-card__cover${showPhoto ? ' fb-card__cover--photo' : ''}`}>
        {showPhoto ? (
          <img
            className="fb-card__photo"
            src={img}
            alt={by}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="fb-card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        <span className="fb-card__corner fb-card__corner--tl" aria-hidden="true" />
        <span className="fb-card__corner fb-card__corner--br" aria-hidden="true" />
      </div>
      <div className="fb-card__body">
        <span className="fb-card__mark" aria-hidden="true">
          {initials(by)}
        </span>
        <span className="fb-card__author">{by}</span>
        <span className="fb-card__cta">
          {view} <span aria-hidden="true">→</span>
        </span>
      </div>
    </a>
  )
}

export function Facebook() {
  const { t } = useI18n()

  // Newest first; cap at the last 20 posts.
  const posts = useMemo(
    () => (fb.posts || []).slice(0, 20).map((p) => ({ ...p, img: imgMap[p.image] || null })),
    [],
  )

  return (
    <section className="section" id="facebook">
      <div className="container">
        <SectionHead
          eyebrow="Facebook"
          title={
            <>
              <span className="fb-title__main">{t('fb.title')}</span>
              <span className="fb-title__by">{t('fb.by')}</span>
            </>
          }
          subtitle={t('fb.subtitle')}
        />

        {posts.length > 0 && (
          <Carousel label={t('fb.title')}>
            {posts.map((p) => (
              <PostCard
                key={p.id || p.url}
                post={p}
                author={fb.page}
                img={p.img}
                view={t('fb.view')}
              />
            ))}
          </Carousel>
        )}

        <p className="fb-fallback">
          <a href={fb.url} target="_blank" rel="noopener noreferrer">
            {t('fb.fallback')} →
          </a>
        </p>
      </div>
    </section>
  )
}
