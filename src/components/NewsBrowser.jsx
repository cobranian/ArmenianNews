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

// ArmRadio (en/hy/ru.armradio.am) 503s hotlinked images from the browser —
// Cloudflare hotlink protection — and wsrv.nl can't fetch them either. The one
// path that reaches these hosts is the armradio Cloudflare Worker (it already
// relays their REST API from inside Cloudflare). Route each card image through
// its ?img= mode; anything not a recognised armradio media URL is left as-is.
const ARMRADIO_PROXY = 'https://armradio-proxy.cobranian.workers.dev'
const armradioImg = (url) => {
  try {
    const u = new URL(url)
    const lang = u.host.match(/^(en|hy|ru)\.armradio\.am$/)?.[1]
    if (!lang || !u.pathname.startsWith('/wp-content/uploads/')) return url
    return `${ARMRADIO_PROXY}/?lang=${lang}&img=${encodeURIComponent(u.pathname + u.search)}`
  } catch {
    return url
  }
}

// One article card, sized to sit inside a shelf track (see .card in CSS).
// A card with no usable image — or one that fails to load — falls back to a
// deterministic Armenian motif so every card always paints.
function ArticleCard({ item, catLabel, showImage = true, proxy = false, armProxy = false }) {
  const { t } = useI18n()
  const [broken, setBroken] = useState(false)
  const hasPhoto = showImage && !!item.image && !broken
  const seed = hash(item.url || item.title || '')
  const theme = THEMES[seed % THEMES.length]
  const src = hasPhoto
    ? armProxy
      ? armradioImg(item.image)
      : proxy
        ? wsrv(item.image)
        : item.image
    : undefined
  return (
    <article className="card">
      <a
        className={`card__media${hasPhoto ? '' : ' card__media--motif'}`}
        href={item.url}
        rel="noopener noreferrer"
        style={hasPhoto ? undefined : { '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
      >
        {/* ArmRadio's CDN 403s hotlinked images when a Referer is sent, so
            suppress it — with no Referer it serves the image normally. */}
        {hasPhoto ? (
          <img
            src={src}
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
        <a className="card__title" href={item.url} rel="noopener noreferrer">
          {item.title || t('news.empty')}
        </a>
        <a className="card__more" href={item.url} rel="noopener noreferrer">
          {t('news.readmore')}
        </a>
      </div>
    </article>
  )
}

// Build the source groups for the current UI language. The rule: a language
// only shows the sources that actually publish in it, Armenpress pinned first,
// the rest alphabetical.
//   fr  → Armenpress, ArménieInfo.tv, Artzakank, Courrier d'Erevan, Nouvelles d'Arménie
//   en/hy → Armenpress, ArmRadio, Asbarez, Oragark
//   ru  → Armenpress, ArmRadio
// So the French-only sources (Courrier, armenews, artzakank, armenieinfotv)
// appear ONLY under fr, and ArmRadio — en/hy/ru, no French edition — is dropped
// under fr instead of borrowing English headlines beneath lang="fr". Asbarez and
// Oragark each have an English and a Western Armenian edition, so they join en/hy
// but not ru or fr.
//
// SEO note: NewsBrowser renders only the active tab, so sources[0] (now always
// Armenpress) is the one source the prerender bakes into the HTML for crawlers.
// That is deliberate and safe: Armenpress maps 1:1 to the UI language, so under
// fr it prerenders its French edition — French copy under lang="fr", which is
// what a French query should find. (Previously Courrier led to prerender the
// most French text; the language rule makes Armenpress the natural lead.)
// Every rubric is its own carousel — nothing is merged, empty rubrics dropped.
function buildSources(t, lang) {
  const isFr = lang === 'fr'
  // ArmRadio publishes en/hy/ru — never French — so armLang only matters when
  // ArmRadio is shown, i.e. outside fr, where it tracks the UI language.
  const armLang = lang === 'hy' ? 'hy' : lang === 'ru' ? 'ru' : 'en'

  const armenpress = {
    id: 'armenpress',
    brand: 'Armenpress',
    name: t('browser.armenpress'),
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
    live: true,
    images: true,
    armProxy: true,
    cats: (news.armradio?.[armLang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`armcats.${s.categoryKey}`), articles: s.articles })),
  }
  const courrier = {
    id: 'courrier',
    brand: "Courrier d'Erevan",
    name: t('browser.courrier'),
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
    live: false,
    images: true,
    proxy: true,
    cats: (news.armenieinfotv || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`aitcats.${s.categoryKey}`), articles: s.articles })),
  }
  // Asbarez publishes an English (asbarez.com) and a Western Armenian
  // (asbarez.am) edition — so, like ArmRadio, its feed is keyed by language and
  // it appears under en/hy only (no French or Russian edition). Its category
  // labels ride in the data (single-language by construction), not through t().
  // English images hotlink directly; Armenian has none and falls back to motifs.
  const asbarez = {
    id: 'asbarez',
    brand: 'Asbarez',
    name: t('browser.asbarez'),
    live: false,
    images: true,
    cats: (news.asbarez?.[lang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }
  // Oragark — English + Western Armenian, one WordPress install (both editions
  // are categories on the same REST API). Like Asbarez it appears under en/hy
  // only; its category labels ride in the data. Images hotlink direct.
  const oragark = {
    id: 'oragark',
    brand: 'Oragark',
    name: t('browser.oragark'),
    live: false,
    images: true,
    cats: (news.oragark?.[lang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }

  // Sources that publish in this language. Armenpress is in every language;
  // the French-only sources join it under fr, ArmRadio under en/hy/ru, and
  // Asbarez + Oragark under en/hy (their editions — no French or Russian one).
  const pool = isFr
    ? [armenpress, courrier, armenews, artzakank, armenieinfotv]
    : lang === 'ru'
      ? [armenpress, armradio]
      : [armenpress, armradio, asbarez, oragark]

  // Armenpress pinned first (the constant across languages); the rest sorted
  // alphabetically by brand with accents folded (é = e, so ArménieInfo.tv sorts
  // as "Armenie"). Sorting, not a hand-ordered list — a new source slots itself.
  const rest = pool
    .filter((s) => s.id !== 'armenpress')
    .sort((a, b) => a.brand.localeCompare(b.brand, 'fr', { sensitivity: 'base' }))
  return [armenpress, ...rest].filter((s) => s.cats.length)
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
      <div className="newsfeed__tabwrap">
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
              aria-label={src.live ? `${src.brand} — ${t('browser.live')}` : undefined}
              tabIndex={isActive ? 0 : -1}
              className={`newsfeed__tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveId(src.id)}
              onKeyDown={onKeyDown}
            >
              <span className="newsfeed__tab-brand">{src.brand}</span>
              {src.live && <span className="newsfeed__live-dot" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
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
                armProxy={active.armProxy}
              />
            ))}
          </Carousel>
        ))}
      </section>
    </div>
  )
}
