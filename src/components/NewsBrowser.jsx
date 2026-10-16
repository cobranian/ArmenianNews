import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { Carousel } from './Carousel.jsx'
import { useSourceDrum } from './useSourceDrum.js'
import { Motif, hash, THEMES } from './motifs.jsx'
import { TAB_ORDER, shelvesFor } from '../newsSources.js'
import { groupByRubric, DEFAULT_RUBRIC } from '../rubrics.js'
import { SOURCE_NAMES } from '../newsLangs.js'

// The wsrv.nl image CDN: fetched server-side, resized, re-served with CORS.
// Sources reach it for TWO different reasons, and only the first is a blocker.
//
// 1. armenews.com serves only heavy full-size originals AND its WAF ORB-blocks
//    hotlinked images — without wsrv those cards have no picture at all.
// 2. Armenpress is reachable directly, and was hotlinked for that reason. It is
//    proxied anyway, on WEIGHT: measured 2026-08-04 in production, its 70
//    thumbnails were 623 Ko each and 40,7 Mo together — 61 % of a page that
//    downloaded 67 Mo, for cards a few hundred pixels wide. Through wsrv the
//    same image drops to ~71 Ko. Nothing about the source changed; what changed
//    is that somebody measured.
//
// A wsrv outage degrades to the deterministic Armenian motif (ArticleCard's
// onError), not to broken images — which is what makes reason 2 an acceptable
// trade on the DEFAULT, prerendered tab.
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

// Une seule horloge pour tout le navigateur d'actualités, et c'est le point :
// un intervalle par carte ferait cent minuteurs sur un onglet, pour cent
// valeurs qui changent ensemble. `now` descend en prop.
//
// Le pas est de 60 s, pas d'une heure. La demande — « fais un update chaque
// heure » — est tenue a fortiori, et le pas d'une heure aurait un défaut
// visible : une carte affichée « il y a 5 min » le resterait pendant 65
// minutes. Les secondes, elles, ne s'affichent qu'en théorie — l'instantané
// étant horaire et le build prenant quelques minutes, la dépêche la plus
// fraîche a déjà quelques minutes quand un lecteur la voit.
function useNow(step = 60000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

// One article card, sized to sit inside a shelf track (see .card in CSS).
// A card with no usable image — or one that fails to load — falls back to a
// deterministic Armenian motif so every card always paints.
function ArticleCard({ item, catLabel, showImage = true, proxy = false, armProxy = false, now }) {
  const { t, formatAge, formatDate } = useI18n()
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
      {/* Même cible que le titre juste en dessous : hors de l'arbre
          d'accessibilité et du parcours clavier, sinon chaque carte annonce
          deux fois le même lien (le premier sans texte : image en alt="").
          Lighthouse SEO comptait 70 liens sans texte distinct par accueil. */}
      <a
        className={`card__media${hasPhoto ? '' : ' card__media--motif'}`}
        href={item.url}
        rel="noopener noreferrer"
        aria-hidden="true"
        tabIndex={-1}
        style={hasPhoto ? undefined : { '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
      >
        {/* ArmRadio's CDN 403s hotlinked images when a Referer is sent, so
            suppress it — with no Referer it serves the image normally. */}
        {hasPhoto ? (
          <img
            loading="lazy"
            src={src}
            alt=""
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
        {/* « Lire la suite » × 70 sur une page : des liens au texte identique
            vers des cibles différentes. L'aria-label garde l'intitulé court
            à l'écran et donne au lecteur d'écran — et au robot — la cible. */}
        <a
          className="card__more"
          href={item.url}
          rel="noopener noreferrer"
          aria-label={item.title ? `${t('news.readmore')} — ${item.title}` : undefined}
        >
          {t('news.readmore')}
        </a>
        {/* L'âge de la dépêche, sous l'appel à l'action. C'est un <time> et non
            un <span> pour une raison concrète : `npm run prerender` cuit le DOM
            rendu dans index.html, donc la CHAÎNE relative part figée dans le
            fichier statique — « il y a 3 h » reste écrit tel quel jusqu'au
            prochain build. `dateTime` porte l'horodatage absolu, que les
            moteurs et les lecteurs d'écran lisent à la place, et qui lui ne
            périme jamais. Le texte, lui, se corrige à l'hydratation puis à
            chaque tour d'horloge (voir useNow).
            Une source sans date ne rend rien — et ce repli est SILENCIEUX,
            c'est tout le piège : la carte reste parfaite, seule l'ancienneté
            disparaît. Ce commentaire nommait naguère Courrier d'Erevan et
            ArménieInfo.tv comme les deux fils sans date ; les deux en ont
            désormais (sitemap Drupal pour l'un, page d'article pour l'autre),
            et les onze sources sont datées. Une phrase qui décrit un manque
            doit mourir avec lui, sinon elle le fait passer pour un choix. */}
        {item.date && formatAge(item.date, now) && (
          <time className="card__age" dateTime={item.date} title={formatDate(item.date)}>
            {formatAge(item.date, now)}
          </time>
        )}
      </div>
    </article>
  )
}

// Build the source groups for the current UI language. Asbarez and
// Oragark each have an English and a Western Armenian edition, so they join en/hy
// but not ru or fr. The California Courier translates Sassounian's Column into a
// category per language, so — like Armenpress — it appears in ALL four (en = its
// English news feed; fr/ru/hy = his column). CivilNet publishes a full edition in
// each of the four, so it appears in all four too.
//
// SEO note: NewsBrowser renders only the active tab, which is now the Armenia
// rubric (DEFAULT_RUBRIC): its shelves, from several sources, are what the
// prerender bakes into the HTML for crawlers. All of it is in the page's
// language, since each language only shows the sources that publish in it
// (Armenpress maps 1:1 to the UI language, so it still leads the shelves).
function buildSources(t, lang) {
  const armenpress = {
    id: 'armenpress',
    brand: SOURCE_NAMES.armenpress,
    live: true,
    images: true,
    // Sur le poids, pas sur un blocage — voir le commentaire de `wsrv`.
    proxy: true,
    cats: shelvesFor('armenpress', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`apcats.${s.categoryKey}`), articles: s.articles })),
  }
  const armradio = {
    id: 'armradio',
    brand: SOURCE_NAMES.armradio,
    live: true,
    images: true,
    armProxy: true,
    cats: shelvesFor('armradio', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`armcats.${s.categoryKey}`), articles: s.articles })),
  }
  const courrier = {
    id: 'courrier',
    brand: SOURCE_NAMES.courrier,
    live: false,
    images: true,
    cats: shelvesFor('courrier', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.sectionKey, label: t(`sections.${s.sectionKey}`), articles: s.articles })),
  }
  const armenews = {
    id: 'armenews',
    brand: SOURCE_NAMES.armenews,
    live: false,
    images: true,
    proxy: true,
    cats: shelvesFor('armenews', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`namcats.${s.categoryKey}`), articles: s.articles })),
  }
  const artzakank = {
    id: 'artzakank',
    brand: SOURCE_NAMES.artzakank,
    live: false,
    images: true,
    proxy: true,
    cats: shelvesFor('artzakank', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`azkcats.${s.categoryKey}`), articles: s.articles })),
  }
  const armenieinfotv = {
    id: 'armenieinfotv',
    brand: SOURCE_NAMES.armenieinfotv,
    live: false,
    images: true,
    proxy: true,
    cats: shelvesFor('armenieinfotv', lang)
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
    brand: SOURCE_NAMES.asbarez,
    live: false,
    images: true,
    cats: shelvesFor('asbarez', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }
  // Oragark — English + Western Armenian, one WordPress install (both editions
  // are categories on the same REST API). Like Asbarez it appears under en/hy
  // only; its category labels ride in the data. Images hotlink direct.
  const oragark = {
    id: 'oragark',
    brand: SOURCE_NAMES.oragark,
    live: false,
    images: true,
    cats: shelvesFor('oragark', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }
  // The Armenian Weekly — the ARF's English weekly out of Watertown, MA. English
  // only: no Armenian, Russian or French edition, so it is named in TAB_ORDER.en
  // alone and its feed is a flat list, not keyed by language. Its rubric names
  // ride in the data like Asbarez's and Oragark's. Images hotlink direct — no
  // hotlink protection, and medium_large lands around 77 Ko.
  const armenianweekly = {
    id: 'armenianweekly',
    brand: SOURCE_NAMES.armenianweekly,
    live: false,
    images: true,
    cats: shelvesFor('armenianweekly', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }

  // The California Courier — the only source besides Armenpress in every language.
  // Sassounian's Column is translated per language (fr/ru/hy); en shows the main
  // English news feed. One category per language, its label carried in the data.
  const californiacourier = {
    id: 'californiacourier',
    brand: SOURCE_NAMES.californiacourier,
    live: false,
    images: true,
    cats: shelvesFor('californiacourier', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }

  // CivilNet — the Yerevan independent newsroom, quadrilingue like Armenpress
  // (fr/en/hy/ru map 1:1). The four editions do not share a rubric list — fr has
  // no world or opinion desk, hy runs Human rights where the others run Society —
  // so each rubric's name rides in the data, already in its own language.
  const civilnet = {
    id: 'civilnet',
    brand: SOURCE_NAMES.civilnet,
    live: false,
    images: true,
    cats: shelvesFor('civilnet', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }

  // NEWS.am — Yerevan's largest private news group, en/hy/ru (no French
  // edition, so it is dropped under fr like ArmRadio). Ten rubrics: the modern
  // newsroom's seven plus its three legacy verticals — NEWS.am Sport, Style and
  // Medicine — which are separate sites, hence brand-named shelves among the
  // localised ones. Labels ride in the data. Images hotlink direct (no hotlink
  // protection on any of the four hosts).
  const newsam = {
    id: 'newsam',
    brand: SOURCE_NAMES.newsam,
    live: false,
    images: true,
    cats: shelvesFor('newsam', lang)
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }

  // TAB_ORDER (en tête de fichier) décide de l'ordre ET de la présence : une
  // source absente de la liste d'une langue ne s'y affiche pas. Un id inconnu
  // ou une source sans rubrique remplie tombe au filtrage — c'est ce qui rend
  // sûr de nommer ici une source qu'une langue n'a pas.
  const bySource = {
    armenpress,
    armradio,
    courrier,
    armenews,
    artzakank,
    armenieinfotv,
    asbarez,
    oragark,
    armenianweekly,
    californiacourier,
    civilnet,
    newsam,
  }
  return (TAB_ORDER[lang] || TAB_ORDER.fr)
    .map((id) => bySource[id])
    .filter((s) => s && s.cats.length)
}

export function NewsBrowser() {
  const { t, lang } = useI18n()
  // Les sources se construisent comme avant (marque, drapeaux d'image,
  // rubriques d'origine par langue) puis se recomposent en rubriques communes :
  // un onglet par rubrique, une étagère par source dans chacune. TAB_ORDER
  // décide toujours de la présence et de l'ordre des SOURCES — donc des
  // étagères —, src/rubrics.js de celui des onglets.
  const rubrics = groupByRubric(buildSources(t, lang))
  const now = useNow()
  const tabRefs = useRef({})
  const trackRef = useRef(null)
  const [activeKey, setActiveKey] = useState(DEFAULT_RUBRIC)
  // Repli sur la première rubrique non vide : une langue sans « Arménie » ne
  // doit jamais ouvrir sur un panneau vide.
  const active = rubrics.find((r) => r.key === activeKey) || rubrics[0]

  // Sous 640px, ce même tablist devient un tambour vertical (voir
  // useSourceDrum). Appelé inconditionnellement — les hooks ne se sautent pas —
  // et inerte tant que la piste n'existe pas.
  useSourceDrum({
    trackRef,
    itemRefs: tabRefs,
    ids: rubrics.map((r) => r.key),
    activeId: active?.key,
    onSettle: setActiveKey,
  })

  if (!rubrics.length) return null

  // Roving-tab entre les rubriques. Les flèches VERTICALES ne valent que dans
  // le tambour (≤640px) : sur le rail horizontal, Flèche bas doit faire
  // défiler la page, pas changer de rubrique.
  const onKeyDown = (e) => {
    const vertical =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 640px)').matches
    const i = rubrics.findIndex((r) => r.key === active.key)
    let next = null
    if (e.key === 'ArrowRight' || (vertical && e.key === 'ArrowDown'))
      next = (i + 1) % rubrics.length
    else if (e.key === 'ArrowLeft' || (vertical && e.key === 'ArrowUp'))
      next = (i - 1 + rubrics.length) % rubrics.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = rubrics.length - 1
    if (next == null) return
    e.preventDefault()
    setActiveKey(rubrics[next].key)
    tabRefs.current[rubrics[next].key]?.focus()
  }

  const panelId = `newsfeed-panel-${active.key}`

  return (
    <div className="newsfeed">
      <div className="newsfeed__tabwrap">
      <div
        className="newsfeed__tabs"
        role="tablist"
        aria-label={t('news.title')}
        ref={trackRef}
      >
        {rubrics.map((r) => {
          const isActive = r.key === active.key
          return (
            <button
              key={r.key}
              ref={(el) => (tabRefs.current[r.key] = el)}
              type="button"
              role="tab"
              id={`newsfeed-tab-${r.key}`}
              aria-selected={isActive}
              aria-controls={isActive ? panelId : undefined}
              tabIndex={isActive ? 0 : -1}
              className={`newsfeed__tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveKey(r.key)}
              onKeyDown={onKeyDown}
            >
              <span className="newsfeed__tab-brand">{t(`rubric.${r.key}`)}</span>
            </button>
          )
        })}
      </div>
      </div>

      {/* Le repère du tambour, mobile seulement (display:none au-dessus de
          640px). `aria-hidden` : aria-selected dit déjà « onglet 3 sur 9 ». */}
      <div className="newsfeed__dots" aria-hidden="true">
        {rubrics.map((r) => (
          <span
            key={r.key}
            className={`newsfeed__dot${r.key === active.key ? ' is-on' : ''}`}
          />
        ))}
      </div>

      <section
        className="newsfeed__source"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`newsfeed-tab-${active.key}`}
        key={active.key}
      >
        {active.shelves.map(({ source, articles }) => (
          <Carousel
            key={source.id}
            // Le titre est un nœud (marque + point « en direct ») : `label`
            // nomme alors les flèches, voir Carousel.jsx.
            label={source.live ? `${source.brand} — ${t('browser.live')}` : source.brand}
            title={
              <>
                {source.brand}
                {source.live && <span className="newsfeed__live-dot" aria-hidden="true" />}
              </>
            }
            reveal={false}
          >
            {articles.map((a, i) => (
              <ArticleCard
                key={a.url || i}
                item={a}
                catLabel={a.catLabel}
                showImage={source.images}
                proxy={source.proxy}
                armProxy={source.armProxy}
                now={now}
              />
            ))}
          </Carousel>
        ))}
      </section>
    </div>
  )
}
