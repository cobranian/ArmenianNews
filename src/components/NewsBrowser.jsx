import { useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import news from '../data/news.json'

// armenews.com serves only heavy full-size originals and its WAF ORB-blocks
// hotlinked images, so those go through the wsrv.nl image CDN — fetched
// server-side, resized, and re-served with CORS. Other sources hotlink directly.
const wsrv = (url, w = 640) =>
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&output=jpg&q=80`

// One article card, sized to sit inside a shelf track (see .card in CSS).
// A card with no usable image — or one that fails to load — falls back to a
// deterministic Armenian motif so every card always paints.
function ArticleCard({ item, catLabel, showImage = true, proxy = false }) {
  const { t } = useI18n()
  const [broken, setBroken] = useState(false)
  const hasPhoto = showImage && !!item.image && !broken
  const seed = hash(item.url || item.title || '')
  const theme = THEMES[seed % THEMES.length]
  return (
    <article className="card">
      <a
        className={`card__media${hasPhoto ? '' : ' card__media--motif'}`}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        style={hasPhoto ? undefined : { '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
      >
        {/* ArmRadio's CDN 403s hotlinked images when a Referer is sent, so
            suppress it — with no Referer it serves the image normally. */}
        {hasPhoto ? (
          <img
            src={proxy ? wsrv(item.image) : item.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        {catLabel && <span className="card__section">{catLabel}</span>}
      </a>
      <div className="card__body">
        <a className="card__title" href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title || t('news.empty')}
        </a>
        <a className="card__more" href={item.url} target="_blank" rel="noopener noreferrer">
          {t('news.readmore')}
        </a>
      </div>
    </article>
  )
}

// Build the source groups. Courrier d'Erevan leads, and that is load-bearing:
// NewsBrowser renders only the active tab, so the default source is the only
// news the prerender bakes into the HTML for crawlers. Courrier is French-only
// and the largest French rubric set (80 articles), so it is what a French
// query should find. ArmRadio led before and has no French edition (en/hy
// only), which shipped English headlines under lang="fr".
// Armenpress is the only *trilingual* source (fr/en/hy map 1:1); the others are
// French-only (courrier.am/hy serves the same French articles) or en/hy.
// Every rubric is its own carousel — nothing is merged, and empty rubrics are
// dropped.
function buildSources(t, lang) {
  const armLang = lang === 'hy' ? 'hy' : 'en'
  // Armenpress maps 1:1 to the UI language — the only source that does. It does
  // not lead: Courrier prerenders more French copy. Seven rubrics per language,
  // each its own shelf.
  const armenpress = {
    id: 'armenpress',
    brand: 'Armenpress',
    name: t('browser.armenpress'),
    lang: lang.toUpperCase(),
    live: true,
    images: true,
    cats: (news.armenpress?.[lang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`apcats.${s.categoryKey}`), articles: s.articles })),
  }
  const armradio = {
    id: 'armradio',
    brand: 'ArmRadio',
    name: t('browser.armradio'),
    lang: armLang.toUpperCase(),
    live: true,
    images: true,
    cats: (news.armradio?.[armLang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`armcats.${s.categoryKey}`), articles: s.articles })),
  }
  const courrier = {
    id: 'courrier',
    brand: "Courrier d'Erevan",
    name: t('browser.courrier'),
    lang: 'FR',
    live: false,
    images: true,
    cats: (news.courrier || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.sectionKey, label: t(`sections.${s.sectionKey}`), articles: s.articles })),
  }
  const armenews = {
    id: 'armenews',
    brand: "Nouvelles d'Arménie",
    name: t('browser.armenews'),
    lang: 'FR',
    live: false,
    images: true,
    proxy: true,
    cats: (news.armenews || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`namcats.${s.categoryKey}`), articles: s.articles })),
  }
  const artzakank = {
    id: 'artzakank',
    brand: 'Artzakank',
    name: t('browser.artzakank'),
    lang: 'FR',
    live: false,
    images: true,
    proxy: true,
    cats: (news.artzakank || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`azkcats.${s.categoryKey}`), articles: s.articles })),
  }
  const armenieinfotv = {
    id: 'armenieinfotv',
    brand: 'ArménieInfo.tv',
    name: t('browser.armenieinfotv'),
    lang: 'FR',
    live: false,
    images: true,
    proxy: true,
    cats: (news.armenieinfotv || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`aitcats.${s.categoryKey}`), articles: s.articles })),
  }
  return [courrier, armenpress, armradio, armenews, artzakank, armenieinfotv].filter((s) => s.cats.length)
}

export function NewsBrowser() {
  const { t, lang } = useI18n()
  const sources = buildSources(t, lang)
  const tabRefs = useRef({})
  const [activeId, setActiveId] = useState(sources[0]?.id)

  if (!sources.length) return null
  const active = sources.find((s) => s.id === activeId) || sources[0]

  // Roving-tab keyboard nav across the two source tabs.
  const onKeyDown = (e) => {
    const i = sources.findIndex((s) => s.id === active.id)
    let next = null
    if (e.key === 'ArrowRight') next = (i + 1) % sources.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + sources.length) % sources.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = sources.length - 1
    if (next == null) return
    e.preventDefault()
    setActiveId(sources[next].id)
    tabRefs.current[sources[next].id]?.focus()
  }

  const panelId = `newsfeed-panel-${active.id}`

  return (
    <div className="newsfeed">
      <div className="newsfeed__tabs" role="tablist" aria-label={t('news.title')}>
        {sources.map((src) => {
          const isActive = src.id === active.id
          return (
            <button
              key={src.id}
              ref={(el) => (tabRefs.current[src.id] = el)}
              type="button"
              role="tab"
              id={`newsfeed-tab-${src.id}`}
              aria-selected={isActive}
              aria-controls={isActive ? panelId : undefined}
              tabIndex={isActive ? 0 : -1}
              className={`newsfeed__tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveId(src.id)}
              onKeyDown={onKeyDown}
            >
              <span className="newsfeed__tab-brand">{src.brand}</span>
              {src.live && <span className="newsfeed__live-dot" aria-hidden="true" />}
              <span className="newsfeed__tab-lang">{src.lang}</span>
            </button>
          )
        })}
      </div>

      <section
        className="newsfeed__source"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`newsfeed-tab-${active.id}`}
        key={active.id}
      >
        <p className="newsfeed__intro">{active.name}</p>
        {active.cats.map((c) => (
          <Carousel key={c.key} title={c.label} reveal={false}>
            {c.articles.map((a, i) => (
              <ArticleCard
                key={a.url || i}
                item={a}
                catLabel={c.label}
                showImage={active.images}
                proxy={active.proxy}
              />
            ))}
          </Carousel>
        ))}
      </section>
    </div>
  )
}
