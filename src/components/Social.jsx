import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import fb from '../data/facebook.json'
import ig from '../data/instagram.json'
import feed from '../data/instagram-feed.json'

/* ------------------------------------------------------------------ *
 * Réseaux sociaux — one section, two strands, both on screen.
 *
 * Facebook (Don Narek) and Instagram answer the same question — "what is
 * the Armenian internet posting right now?" — so they share one section.
 * They sit as two stacked shelves, the way the Agenda stacks Switzerland
 * and the world: nothing is hidden behind a tab, you scroll and you see
 * both. Each shelf names its network in the mono eyebrow and its content
 * in the display title, because the network is the source, not the subject.
 *
 * Neither network's official embed is used: the Facebook Page Plugin drags
 * in the whole FB chrome and Instagram's embed.js refuses to hydrate behind
 * ad-blockers and region locks, both leaving blank cells. Every curated post
 * instead renders as an on-brand card that ALWAYS paints and links out to
 * the real post. Images are bundled at build time (src/data/fb/, src/data/ig/)
 * so they never hotlink or expire; a post with no image falls back to a
 * deterministic Armenian motif (./motifs.jsx).
 *
 * Cards carry no .reveal: inside a horizontally scrolling track, the cards to
 * the right of the fold never intersect the viewport, so a reveal-gated card
 * would stay invisible until swiped into view. The shelf itself reveals, which
 * is what News and Agenda do — the cards ride along.
 * ------------------------------------------------------------------ */

const FB_IMAGES = import.meta.glob('../data/fb/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const fbImg = Object.fromEntries(
  Object.entries(FB_IMAGES).map(([path, src]) => [path.split('/').pop(), src]),
)

const IG_IMAGES = import.meta.glob('../data/ig/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const igImg = Object.fromEntries(
  Object.entries(IG_IMAGES).map(([path, src]) => [
    path.split('/').pop().replace(/\.jpg$/, ''),
    src,
  ]),
)
const shortcode = (url) => url.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || null

/* Initials for the author monogram, e.g. "Don Narek" → "DN". */
function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/* A shelf title: the network above, in the wire face; what it carries below,
   in the display face. Facebook has an author, so it gets a byline. */
function StrandTitle({ network, name, by }) {
  return (
    <span className="strand">
      <span className="strand__net">{network}</span>
      <span className="strand__name">
        {name}
        {by && <em className="strand__by">{by}</em>}
      </span>
    </span>
  )
}

function FacebookCard({ post, author, view, img }) {
  const seed = hash(post.id || post.url || author)
  const theme = THEMES[seed % THEMES.length]
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken
  const by = post.author || author

  return (
    <a
      className="fb-card"
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

function InstagramCard({ url, handle, name, view, img }) {
  const seed = hash(url)
  const theme = THEMES[seed % THEMES.length]
  const isReel = /\/reel\//.test(url)
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken

  return (
    <a
      className="ig-card"
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

export function Social() {
  const { t } = useI18n()

  // Newest first; cap at the last 20 posts.
  const fbPosts = useMemo(
    () => (fb.posts || []).slice(0, 20).map((p) => ({ ...p, img: fbImg[p.image] || null })),
    [],
  )

  // Use the hourly-baked random selection; fall back to flattening the curated
  // accounts (e.g. before the first snapshot exists).
  const igPosts = useMemo(() => {
    const base =
      feed.posts && feed.posts.length
        ? feed.posts
        : ig.accounts.flatMap((acc) =>
            (acc.posts || []).map((p) => ({
              url: p.url,
              handle: acc.handle,
              name: acc.name,
            })),
          )
    return base.map((p) => ({ ...p, img: igImg[shortcode(p.url)] || null }))
  }, [])

  return (
    <section className="section" id="reseaux">
      <div className="container">
        <SectionHead
          eyebrow="Facebook · Instagram"
          title={t('social.title')}
          subtitle={t('social.subtitle')}
        />

        <div className="social">
          {/* The networks were linked to as #facebook and #instagram for months.
              Those anchors now land on their own strand, not just the section. */}
          {fbPosts.length > 0 && (
            <div className="social__strand" id="facebook">
              <Carousel
                label={t('fb.title')}
                title={
                  <StrandTitle network="Facebook" name={t('fb.title')} by={t('fb.by')} />
                }
              >
                {fbPosts.map((p) => (
                  <FacebookCard
                    key={p.id || p.url}
                    post={p}
                    author={fb.page}
                    img={p.img}
                    view={t('fb.view')}
                  />
                ))}
              </Carousel>

              <p className="fb-fallback">
                <a href={fb.url} target="_blank" rel="noopener noreferrer">
                  {t('fb.fallback')} →
                </a>
              </p>
            </div>
          )}

          {igPosts.length > 0 && (
            <div className="social__strand" id="instagram">
              <Carousel
                label="Instagram"
                title={<StrandTitle network="Instagram" name={t('ig.strand')} />}
              >
                {igPosts.map((p) => (
                  <InstagramCard
                    key={p.url}
                    url={p.url}
                    handle={p.handle}
                    name={p.name}
                    img={p.img}
                    view={t('ig.view')}
                  />
                ))}
              </Carousel>

              {/* Account chips: entry points, and a graceful fallback for
                  accounts with no harvested posts yet. */}
              <div className="ig-accounts">
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
          )}
        </div>
      </div>
    </section>
  )
}
