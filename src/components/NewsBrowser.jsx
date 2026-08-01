import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { Carousel } from './Carousel.jsx'
import { useSourceDrum } from './useSourceDrum.js'
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

// L'ordre des onglets, par langue. Il est ÉCRIT À LA MAIN, et c'est un
// changement : il était auparavant calculé — Armenpress épinglé, puis tri
// alphabétique de marque — pour qu'une nouvelle source se place toute seule.
// Cette propriété est perdue à dessein. Le rang porte désormais une intention
// éditoriale que l'alphabet ne sait pas exprimer : sous `fr`, les quatre fils
// proprement francophones passent devant les sources traduites ou
// multilingues ; sous `en`/`hy`, NEWS.am monte au troisième rang.
//
// CONSÉQUENCE À CONNAÎTRE : une source ajoutée sans être nommée ici
// n'apparaîtra nulle part. C'est le prix de l'ordre choisi, et c'est silencieux
// — le seul garde-fou est le décompte des rédactions annoncé par les cartes de
// liens (test/source-count.test.mjs), qui lit ce tableau.
//
// Cette liste décide aussi de la PRÉSENCE : une langue ne montre que les
// sources qui publient dans cette langue. Les fils 100 % francophones
// (Courrier, armenews, artzakank, armenieinfotv) ne paraissent donc que sous
// `fr` ; ArmRadio et NEWS.am — en/hy/ru, sans édition française — en sont
// retirés plutôt que d'y servir des titres anglais sous lang="fr".
const TAB_ORDER = {
  fr: [
    'armenpress',
    'armenieinfotv',
    'courrier',
    'armenews',
    'artzakank',
    'californiacourier',
    'civilnet',
  ],
  en: [
    'armenpress',
    'armradio',
    'newsam',
    'asbarez',
    'civilnet',
    'californiacourier',
    'oragark',
  ],
  hy: [
    'armenpress',
    'armradio',
    'newsam',
    'asbarez',
    'civilnet',
    'californiacourier',
    'oragark',
  ],
  ru: ['armenpress', 'armradio', 'newsam', 'californiacourier', 'civilnet'],
}

// Build the source groups for the current UI language. Asbarez and
// Oragark each have an English and a Western Armenian edition, so they join en/hy
// but not ru or fr. The California Courier translates Sassounian's Column into a
// category per language, so — like Armenpress — it appears in ALL four (en = its
// English news feed; fr/ru/hy = his column). CivilNet publishes a full edition in
// each of the four, so it appears in all four too.
//
// SEO note: NewsBrowser renders only the active tab, so sources[0] (now always
// Armenpress) is the one source the prerender bakes into the HTML for crawlers.
// That is deliberate and safe: Armenpress maps 1:1 to the UI language, so under
// fr it prerenders its French edition — French copy under lang="fr", which is
// what a French query should find. (Previously Courrier led to prerender the
// most French text; the language rule makes Armenpress the natural lead.)
// Every rubric is its own carousel — nothing is merged, empty rubrics dropped.
function buildSources(t, lang) {
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
  // The California Courier — the only source besides Armenpress in every language.
  // Sassounian's Column is translated per language (fr/ru/hy); en shows the main
  // English news feed. One category per language, its label carried in the data.
  const californiacourier = {
    id: 'californiacourier',
    brand: 'California Courier',
    name: t('browser.californiacourier'),
    live: false,
    images: true,
    cats: (news.californiacourier?.[lang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: s.label, articles: s.articles })),
  }

  // CivilNet — the Yerevan independent newsroom, quadrilingue like Armenpress
  // (fr/en/hy/ru map 1:1). The four editions do not share a rubric list — fr has
  // no world or opinion desk, hy runs Human rights where the others run Society —
  // so each rubric's name rides in the data, already in its own language.
  const civilnet = {
    id: 'civilnet',
    brand: 'CivilNet',
    name: t('browser.civilnet'),
    live: false,
    images: true,
    cats: (news.civilnet?.[lang] || [])
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
    brand: 'NEWS.am',
    name: t('browser.newsam'),
    live: false,
    images: true,
    cats: (news.newsam?.[lang] || [])
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
  const sources = buildSources(t, lang)
  const now = useNow()
  const tabRefs = useRef({})
  const trackRef = useRef(null)
  const [activeId, setActiveId] = useState(sources[0]?.id)
  const active = sources.find((s) => s.id === activeId) || sources[0]

  // Sous 640px, ce même tablist devient un tambour vertical : le hook y ajoute
  // la perspective et fait de l'aimantation une sélection. Il est appelé
  // inconditionnellement — les hooks ne se sautent pas — et il ne fait rien tant
  // que la piste n'existe pas, ce qui couvre le cas « aucune source ».
  useSourceDrum({
    trackRef,
    itemRefs: tabRefs,
    ids: sources.map((s) => s.id),
    activeId: active?.id,
    onSettle: setActiveId,
  })

  if (!sources.length) return null

  // Roving-tab keyboard nav across the source tabs.
  //
  // Les flèches VERTICALES ne valent que là où le tablist est vertical, c'est-à-dire
  // dans le tambour. Ailleurs elles étaient confisquées : sur un écran large, où
  // le tablist est un rail horizontal, quelqu'un qui tabulait jusqu'à un onglet
  // et pressait Flèche bas pour faire défiler la page changeait de source à la
  // place, et la page ne bougeait pas. Le besoin propre au mobile se payait sur
  // les douze pages. On interroge la même media query que le hook — plutôt que
  // de lui demander son état, qui n'est pas réactif et se périmerait au premier
  // changement de largeur.
  const onKeyDown = (e) => {
    const vertical =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 640px)').matches
    const i = sources.findIndex((s) => s.id === active.id)
    let next = null
    if (e.key === 'ArrowRight' || (vertical && e.key === 'ArrowDown'))
      next = (i + 1) % sources.length
    else if (e.key === 'ArrowLeft' || (vertical && e.key === 'ArrowUp'))
      next = (i - 1 + sources.length) % sources.length
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
      <div
        className="newsfeed__tabs"
        role="tablist"
        aria-label={t('news.title')}
        ref={trackRef}
      >
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

      {/* Le repère du tambour, mobile seulement (display:none au-dessus de
          640px). C'est le SEUL endroit où le nombre de sources est écrit — le
          rail horizontal ne le disait jamais, et c'est précisément le défaut
          qu'on répare. `aria-hidden` parce qu'il redit ce que `aria-selected`
          porte déjà : un lecteur d'écran entend « onglet 3 sur 7 » tout seul. */}
      <div className="newsfeed__dots" aria-hidden="true">
        {sources.map((s) => (
          <span
            key={s.id}
            className={`newsfeed__dot${s.id === active.id ? ' is-on' : ''}`}
          />
        ))}
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
                now={now}
              />
            ))}
          </Carousel>
        ))}
      </section>
    </div>
  )
}
