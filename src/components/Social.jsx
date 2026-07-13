import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import fb from '../data/facebook.json'
import ig from '../data/instagram.json'
import feed from '../data/instagram-feed.json'

/* ------------------------------------------------------------------ *
 * Réseaux sociaux — one section, two networks.
 *
 * Facebook (Don Narek) and Instagram used to be two separate sections.
 * They answer the same question — "what is the Armenian internet posting
 * right now?" — so they now share one section and the site's existing
 * source-tab idiom (.newsfeed__*, the same rail the news browser uses).
 *
 * Neither network's official embed is used: the Facebook Page Plugin drags
 * in the whole FB chrome and Instagram's embed.js refuses to hydrate behind
 * ad-blockers and region locks, both leaving blank cells. Every curated post
 * instead renders as an on-brand card that ALWAYS paints and links out to
 * the real post. Images are bundled at build time (src/data/fb/, src/data/ig/)
 * so they never hotlink or expire; a post with no image falls back to a
 * deterministic Armenian motif (./motifs.jsx).
 *
 * Cards inside a tab panel must NOT carry .reveal: the scroll observer is
 * one-shot and runs before the inactive panel mounts, so a revealed-gated
 * card would stay invisible forever after a tab switch.
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

/* The two networks were linked to as #facebook and #instagram for months, so
   those anchors keep working: they still scroll here, and they open their own
   tab rather than dumping the reader on whichever tab happened to be active. */
const TAB_FOR_HASH = { '#facebook': 'fb', '#instagram': 'ig' }
const tabFromHash = () => TAB_FOR_HASH[window.location.hash] || 'fb'

export function Social() {
  const { t } = useI18n()
  const tabRefs = useRef({})
  const [active, setActive] = useState(tabFromHash)

  useEffect(() => {
    const onHash = () => {
      const tab = TAB_FOR_HASH[window.location.hash]
      if (tab) setActive(tab)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
            (acc.permalinks || []).map((url) => ({
              url,
              handle: acc.handle,
              name: acc.name,
            })),
          )
    return base.map((p) => ({ ...p, img: igImg[shortcode(p.url)] || null }))
  }, [])

  const tabs = [
    { id: 'fb', brand: 'Facebook', count: fbPosts.length },
    { id: 'ig', brand: 'Instagram', count: igPosts.length },
  ]

  // Roving-tab keyboard nav across the two networks.
  const onKeyDown = (e) => {
    const i = tabs.findIndex((s) => s.id === active)
    let next = null
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    setActive(tabs[next].id)
    tabRefs.current[tabs[next].id]?.focus()
  }

  const panelId = `social-panel-${active}`

  return (
    <section className="section" id="reseaux">
      <span className="social__anchor" id="facebook" aria-hidden="true" />
      <span className="social__anchor" id="instagram" aria-hidden="true" />
      <div className="container">
        <SectionHead
          eyebrow="Facebook · Instagram"
          title={t('social.title')}
          subtitle={t('social.subtitle')}
        />

        <div className="newsfeed">
          <div className="newsfeed__tabs" role="tablist" aria-label={t('social.title')}>
            {tabs.map((tab) => {
              const isActive = tab.id === active
              return (
                <button
                  key={tab.id}
                  ref={(el) => (tabRefs.current[tab.id] = el)}
                  type="button"
                  role="tab"
                  id={`social-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={isActive ? panelId : undefined}
                  tabIndex={isActive ? 0 : -1}
                  className={`newsfeed__tab ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActive(tab.id)}
                  onKeyDown={onKeyDown}
                >
                  <span className="newsfeed__tab-brand">{tab.brand}</span>
                  <span className="newsfeed__tab-lang">{tab.count}</span>
                </button>
              )
            })}
          </div>

          <section
            className="newsfeed__source"
            role="tabpanel"
            id={panelId}
            aria-labelledby={`social-tab-${active}`}
            key={active}
          >
            {active === 'fb' ? (
              <>
                {/* Facebook has an author; the section title no longer names him,
                    so the "Art arménien / par Don Narek" lockup lives here. */}
                <header className="social__panel-head">
                  <p className="social__lede">
                    <span className="social__lede-main">{t('fb.title')}</span>
                    <span className="social__lede-by">{t('fb.by')}</span>
                  </p>
                  <p className="newsfeed__intro">{t('fb.subtitle')}</p>
                </header>

                {fbPosts.length > 0 && (
                  <Carousel label={t('fb.title')} reveal={false}>
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
                )}

                <p className="fb-fallback">
                  <a href={fb.url} target="_blank" rel="noopener noreferrer">
                    {t('fb.fallback')} →
                  </a>
                </p>
              </>
            ) : (
              <>
                <header className="social__panel-head">
                  <p className="newsfeed__intro">{t('ig.subtitle')}</p>
                </header>

                {igPosts.length > 0 && (
                  <Carousel label="Instagram" reveal={false}>
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
                )}

                {/* Account chips: entry points, and a graceful fallback for
                    accounts with no curated permalinks yet. */}
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
              </>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}
