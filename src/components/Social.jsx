import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Lightbox } from './Lightbox.jsx'
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
 * The shelves stay horizontal, swipeable carousels with ‹ › arrows — desktop
 * and mobile alike. What changed: a card no longer navigates away on click.
 * It is a framed "plate" (the peintres#movses mechanic) that lifts on hover
 * and OPENS A LIGHTBOX (./Lightbox.jsx) — an enlarged view that stays on the
 * site, with ‹ › to browse the whole strand and a link out to the real post.
 * The way to Facebook / Instagram lives inside that lightbox, and the strand
 * still carries its own crawlable link (the FB-page fallback, the IG chips).
 *
 * Neither network's official embed is used: the Facebook Page Plugin drags
 * in the whole FB chrome and Instagram's embed.js refuses to hydrate behind
 * ad-blockers and region locks, both leaving blank cells. Every curated post
 * instead renders as an on-brand card that ALWAYS paints. Images are bundled
 * at build time (src/data/fb/, src/data/ig/) so they never hotlink or expire;
 * a post with no image falls back to a deterministic Armenian motif — the
 * same motif the lightbox shows, so nothing comes up blank (./motifs.jsx).
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

/* The expand glyph that wakes on hover — the plate's "click to enlarge" cue,
   and the textual "Agrandir" in the body carries the same intent for touch. */
function ZoomBadge() {
  return (
    <span className="card-zoom" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" />
      </svg>
    </span>
  )
}

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

function FacebookCard({ post, author, cta, enlarge, img, onOpen }) {
  const seed = hash(post.id || post.url || author)
  const theme = THEMES[seed % THEMES.length]
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken
  const by = post.author || author

  return (
    <button
      type="button"
      className="fb-card"
      onClick={onOpen}
      aria-label={`${enlarge} : ${by}`}
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
        <ZoomBadge />
        <span className="fb-card__corner fb-card__corner--tl" aria-hidden="true" />
        <span className="fb-card__corner fb-card__corner--br" aria-hidden="true" />
      </div>
      <div className="fb-card__body">
        <span className="fb-card__mark" aria-hidden="true">
          {initials(by)}
        </span>
        <span className="fb-card__author">{by}</span>
        <span className="fb-card__cta">
          {cta} <span aria-hidden="true">→</span>
        </span>
      </div>
    </button>
  )
}

function InstagramCard({ url, handle, name, cta, enlarge, img, onOpen }) {
  const seed = hash(url)
  const theme = THEMES[seed % THEMES.length]
  const isReel = /\/reel\//.test(url)
  const [broken, setBroken] = useState(false)
  const showPhoto = img && !broken

  return (
    <button
      type="button"
      className="ig-card"
      onClick={onOpen}
      aria-label={`${enlarge} : @${handle}`}
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
        <ZoomBadge />
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
          {cta} <span aria-hidden="true">→</span>
        </div>
      </div>
    </button>
  )
}

export function Social() {
  const { t } = useI18n()

  // Which set is enlarged, and where in it. null = closed.
  const [box, setBox] = useState(null)

  // Newest first; cap at the last 30 posts — matches WANT in scripts/fb-scrape.mjs,
  // so a slice here never silently hides posts the scraper bothered to harvest.
  const fbPosts = useMemo(
    () => (fb.posts || []).slice(0, 30).map((p) => ({ ...p, img: fbImg[p.image] || null })),
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
              group: acc.group || 'institutions',
            })),
          )
    return base.map((p) => ({ ...p, img: igImg[shortcode(p.url)] || null }))
  }, [])

  // The lightbox item for a Facebook post — its enlarged view plus the way out.
  const fbItems = useMemo(
    () =>
      fbPosts.map((p) => {
        const seed = hash(p.id || p.url || fb.page)
        const theme = THEMES[seed % THEMES.length]
        return {
          img: p.img,
          alt: p.author || fb.page,
          title: p.author || fb.page,
          sub: 'Facebook',
          href: p.url,
          cta: t('fb.view'),
          seed,
          c1: theme.c1,
          c2: theme.c2,
          ink: theme.ink,
        }
      }),
    [fbPosts, t],
  )

  // The wall reads as two strands: the places and institutions that carry
  // Armenian life, and the people who are its face. Each account declares its
  // own strand in instagram.json; anything unlabelled falls in with the former.
  const igStrands = [
    { id: 'instagram', group: 'institutions', title: t('ig.strand') },
    { id: 'instagram-visages', group: 'personnalites', title: t('ig.strand.people') },
  ]
  const inGroup = (group) => (p) => (p.group || 'institutions') === group

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
                {fbPosts.map((p, i) => (
                  <FacebookCard
                    key={p.id || p.url}
                    post={p}
                    author={fb.page}
                    img={p.img}
                    cta={t('fb.zoom')}
                    enlarge={t('social.enlarge')}
                    onOpen={() => setBox({ items: fbItems, index: i })}
                  />
                ))}
              </Carousel>

              <p className="fb-fallback">
                <a href={fb.url} rel="noopener noreferrer">
                  {t('fb.fallback')} →
                </a>
              </p>
            </div>
          )}

          {igStrands.map(({ id, group, title }) => {
            const posts = igPosts.filter(inGroup(group))
            if (!posts.length) return null
            const items = posts.map((p) => {
              const seed = hash(p.url)
              const theme = THEMES[seed % THEMES.length]
              return {
                img: p.img,
                alt: `@${p.handle} — ${p.name}`,
                title: p.name,
                sub: `Instagram · @${p.handle}`,
                href: p.url,
                cta: t('ig.view'),
                seed,
                c1: theme.c1,
                c2: theme.c2,
                ink: theme.ink,
              }
            })
            return (
            <div className="social__strand" id={id} key={id}>
              <Carousel
                label="Instagram"
                title={<StrandTitle network="Instagram" name={title} />}
              >
                {posts.map((p, i) => (
                  <InstagramCard
                    key={p.url}
                    url={p.url}
                    handle={p.handle}
                    name={p.name}
                    img={p.img}
                    cta={t('ig.zoom')}
                    enlarge={t('social.enlarge')}
                    onOpen={() => setBox({ items, index: i })}
                  />
                ))}
              </Carousel>

              {/* Account chips: entry points, and a graceful fallback for
                  accounts with no harvested posts yet. */}
              <div className="ig-accounts">
                {ig.accounts.filter((acc) => inGroup(group)(acc)).map((acc) => (
                  <a
                    key={acc.handle}
                    className="ig-chip"
                    href={acc.url}
                    rel="noopener noreferrer"
                    title={t('ig.visit')}
                  >
                    <span aria-hidden="true">◎</span> @{acc.handle}
                  </a>
                ))}
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {box && (
        <Lightbox
          items={box.items}
          startIndex={box.index}
          onClose={() => setBox(null)}
        />
      )}
    </section>
  )
}
