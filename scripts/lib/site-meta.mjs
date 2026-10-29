// Génère le <head> propre à un couple (site, langue).
//
// Appelé à deux moments : par le plugin Vite pendant `vite build` (page par
// défaut de chaque site), et par scripts/build-sites.mjs pour dériver les
// autres pages à partir du HTML déjà bâti. Un seul générateur pour les deux,
// sinon les pages divergent — et une divergence dans les hreflang les fait
// silencieusement ignorer par Google.
import { readFileSync } from 'node:fs'
import { SITES, ALL_LANGS, urlFor, xDefaultFor, briefUrl, cultureUrl, cultureImagePath, agendaCountryUrl } from '../../sites.config.js'
import { AGENDA_PAYS_STRINGS } from '../../src/agendaPaysStrings.js'
import { countryLabel } from '../../src/worldPlace.js'
import { eventLd } from '../../src/agendaEvents.js'
import { SEO, VIEW_SEO, OG_LOCALE } from '../../src/seo.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'
import { briefAlternates, longDate } from './brief-links.mjs'
import { cultureAlternates } from './culture-links.mjs'
import { pageSources } from './culture-validate.mjs'
import { videoLd } from './culture-videos.mjs'

// Le manifeste des polices auto-hébergées, écrit par `npm run fonts-sync`
// (scripts/fonts-sync.mjs) : un fichier par entrée, avec famille, style,
// sous-ensemble et graisses. Lu ici pour précharger le premier écran.
// `readFileSync` plutôt qu'un import JSON : ce module est aussi chargé par
// vite.config.js, et l'attribut `with { type: 'json' }` n'y est pas garanti.
const FONTS = JSON.parse(
  readFileSync(new URL('../../src/styles/fonts.json', import.meta.url), 'utf-8'),
).fonts

// Ce qu'on PRÉCHARGE, par langue : les fichiers que le premier écran rend à
// coup sûr — le display (la marque, le sous-titre en italique) et le corps,
// dans l'écriture de la page. Deux à quatre fichiers, pas plus : précharger
// trop repousse ce qui compte. Les autres sous-ensembles (latin-ext,
// vietnamese…) restent paresseux via unicode-range, comme avant.
//
// La marque est latine sous en/ru (« Armenia News », en Fraunces italique) et
// arménienne sous hy (« Արմենիա Ինֆո ») — d'où Fraunces italique préchargée
// sous ru mais pas sous hy. Une entrée absente du manifeste fait ÉCHOUER le
// build : un preload vers un fichier inexistant serait un 404 à chaque visite.
const PRELOAD = {
  // de et it composent dans les mêmes familles latines que fr (voir plus bas).
  fr: [
    ['Fraunces', 'italic', 'latin'],
    ['Fraunces', 'normal', 'latin'],
    ['Hanken Grotesk', 'normal', 'latin'],
  ],
  en: [
    ['Fraunces', 'italic', 'latin'],
    ['Fraunces', 'normal', 'latin'],
    ['Hanken Grotesk', 'normal', 'latin'],
  ],
  hy: [
    ['Noto Serif Armenian', 'normal', 'armenian'],
    ['Noto Sans Armenian', 'normal', 'armenian'],
  ],
  ru: [
    ['Fraunces', 'italic', 'latin'],
    ['Literata', 'italic', 'cyrillic'],
    ['Literata', 'normal', 'cyrillic'],
    ['Golos Text', 'normal', 'cyrillic'],
  ],
}
PRELOAD.de = PRELOAD.fr
PRELOAD.it = PRELOAD.fr

export function fontPreloads(lang) {
  const wanted = PRELOAD[lang]
  if (!wanted) throw new Error(`pas de liste de preload pour ${lang}`)
  return wanted.map(([family, style, subset]) => {
    const hits = FONTS.filter((f) => f.family === family && f.style === style && f.subset === subset)
    // Une police statique a un fichier par graisse : on précharge la 400.
    const hit = hits.find((f) => f.weights.some((w) => /^400\b/.test(w))) ?? hits[0]
    if (!hit) {
      throw new Error(
        `police à précharger absente du manifeste : ${family} ${style} ${subset} — relancer npm run fonts-sync`,
      )
    }
    return `/fonts/${hit.file}`
  })
}

export const META_MARKER = '<!--SITE_META-->'

// Le bloc généré s'encadre de sentinelles. Elles restent dans le HTML bâti,
// ce qui permet à scripts/build-sites.mjs de dériver /hy/ et /ru/ en échangeant
// juste le contenu entre les deux — à partir du HTML SORTI de Vite, donc avec
// ses hachages d'assets. Sans elles il faudrait rejouer un build par page.
export const META_START = '<!--SITE_META:START-->'
export const META_END = '<!--SITE_META:END-->'

// Cloudflare Web Analytics. Le jeton identifie la VITRINE, pas le domaine : un
// jeton unique partagé verserait les visites des deux sites dans un seul tableau
// de bord, distinguables seulement en filtrant par hôte. D'où un jeton par site
// (`cfBeaconToken` dans sites.config.js) et ce marqueur, remplacé au build comme
// <!--SITE_META-->. Les pages /hy/ et /ru/ n'y repassent pas : elles sont
// dérivées du HTML .org déjà bâti, qui porte donc déjà le bon jeton — la balise
// ne varie pas selon la langue, seulement selon le site.
export const BEACON_MARKER = '<!--CF_BEACON-->'

// Google Analytics 4. Même raisonnement que le beacon ci-dessus, et même piège
// vécu : l'ID de mesure était écrit en dur dans index.html ET dans
// public/ga-init.js, deux fichiers que Vite copie à l'identique dans les deux
// dist/ — armenianews.org versait donc ses visites dans la propriété du .ch.
// L'ID vit maintenant dans `gaMeasurementId` (sites.config.js) et arrive ici.
//
// Comme la balise beacon, elle ne varie que par SITE : les pages /hy/ et /ru/,
// dérivées du HTML .org déjà bâti, portent déjà le bon ID.
export const GA_MARKER = '<!--GA_TAG-->'

// Échappe ce qui part dans un attribut HTML. Les chaînes viennent de nos
// propres fichiers, mais un apostrophe typographique mal placé dans une
// baseline ne doit pas pouvoir casser un attribut.
const attr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function siteGraph(site, lang) {
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${site.host}/#website`,
      url: `${site.host}/`,
      name: site.brand,
      // Les autres noms sous lesquels ce site a été ou est connu ailleurs
      // (voir sites.config.js). Sans ce pont, un domaine tout neuf envoie à
      // Google des signaux de nom contradictoires (masthead vs. JSON-LD) et
      // le laisse deviner lequel retenir.
      alternateName: site.alternateName,
      description: SEO[lang].description,
      inLanguage: site.pages.map((p) => p.lang),
      publisher: { '@id': `${site.host}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${site.host}/#organization`,
      name: site.brand,
      alternateName: site.alternateName,
      url: `${site.host}/`,
      email: site.email,
      description: SEO[lang].description,
      // Qui signe le site (sites.config.js `editor`) : ce que la page
      // « À propos » dit en clair, répété ici pour les machines.
      ...(site.editor ? { founder: { '@type': 'Person', name: site.editor } } : {}),
      // Les deux marques se déclarent l'une l'autre : c'est ce qui les présente
      // comme des sites sœurs plutôt que comme deux copies concurrentes.
      // Ses propres comptes sociaux aussi : c'est ce qui relie, pour Google,
      // la Page et le compte Instagram au site.
      sameAs: [
        ...Object.values(SITES)
          .filter((s) => s.id !== site.id)
          .map((s) => `${s.host}/`),
        ...Object.values(site.social ?? {}),
      ],
      logo: {
        '@type': 'ImageObject',
        url: `${site.host}/apple-touch-icon.png`,
        width: 180,
        height: 180,
      },
      image: `${site.host}${site.ogImage}`,
    },
  ]
  return graph
}

// Échappe "<" pour qu'aucune chaîne ne puisse fermer le <script>.
const ldScript = (graph) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')

// Le <head> commun à toutes les pages bâties : accueil, vues, brèves. Ce qui
// varie est passé en paramètres ; le reste (préchargements, Search Console,
// bloc Open Graph de six balises pour l'image, Twitter, JSON-LD) est écrit
// UNE fois — la brève ne doit pas devenir une seconde copie à tenir à jour.
function composeHead({ site, lang, url, title, description, keywords, alternates, ogType, graph, robots = null, ogImage = null }) {
  // La carte de partage suit la VITRINE, pas la langue ni la vue (voir
  // `ogImage` dans sites.config.js) — sauf un article Culture, qui porte la sienne
  // (1200×630, sRGB, sans ICC, produite par culture-image.mjs : les six balises
  // ci-dessous restent vraies).
  const image = ogImage ?? `${site.host}${site.ogImage}`

  const lines = [
    `<meta name="description" content="${attr(description)}" />`,
    ...(keywords ? [`<meta name="keywords" content="${attr(keywords)}" />`] : []),
    ...(robots ? [`<meta name="robots" content="${attr(robots)}" />`] : []),
    `<title>${attr(title)}</title>`,
    `<link rel="canonical" href="${url}" />`,
    '',
    '<!-- Versions linguistiques. Réciproques et identiques sur toutes les',
    '     pages : une page absente de son propre bloc fait ignorer tout le',
    '     bloc par Google. Générées depuis sites.config.js — ne pas éditer. -->',
    ...alternates.map(([h, href]) => `<link rel="alternate" hreflang="${h}" href="${href}" />`),
    '',
    '<!-- Polices du premier écran, préchargées PAR LANGUE (voir PRELOAD dans',
    '     scripts/lib/site-meta.mjs). `crossorigin` est obligatoire sur un',
    '     preload de police, même en même origine, sinon le fichier est',
    '     téléchargé deux fois. -->',
    ...fontPreloads(lang).map(
      (href) => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin />`,
    ),
    '',
  ]

  if (site.gscToken) {
    lines.push(
      '<!-- Vérification de propriété Google Search Console -->',
      `<meta name="google-site-verification" content="${attr(site.gscToken)}" />`,
      '',
    )
  }

  lines.push(
    '<!-- Open Graph / partage social -->',
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${attr(site.brand)}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${attr(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    // Les cinq lignes qui suivent décrivent la MÊME image. Elles sont là pour
    // l'aperçu « riche » (grande vignette au-dessus du texte) que rendent
    // WhatsApp, Facebook et Signal, par opposition à la vignette carrée posée à
    // gauche du texte. Un client bascule sur la petite carte dès qu'il doute de
    // l'image : `secure_url` et `type` lui évitent d'avoir à la télécharger pour
    // savoir qu'elle est en https et que c'est bien un JPEG, `width`/`height`
    // lui donnent le rapport 1,91:1 sans la décoder.
    //
    // Ce ne sont PAS des garanties : la mise en page finale appartient au
    // client, et WhatsApp Desktop rend volontiers la petite carte là où le
    // téléphone rend la grande, à métadonnées identiques. Voir « À savoir »
    // dans CLAUDE.md, à la carte de partage.
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:secure_url" content="${image}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${attr(title)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    ...ALL_LANGS.filter((l) => l !== lang).map(
      (l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`,
    ),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${attr(title)}" />`,
    `<meta name="twitter:description" content="${attr(description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    '',
    '<!-- Données structurées (schema.org) -->',
    `<script type="application/ld+json">${ldScript(graph)}</script>`,
  )

  const body = lines.map((l) => (l ? `    ${l}` : '')).join('\n')
  return `    ${META_START}\n${body}\n    ${META_END}`
}

export function headFor({ siteId, lang, view = 'home' }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!SEO[lang]) throw new Error(`langue sans chaînes SEO : ${lang}`)
  if (!OG_LOCALE[lang]) throw new Error(`langue sans locale Open Graph : ${lang}`)
  if (view !== 'home' && !VIEW_SEO[view]?.[lang]) {
    throw new Error(`vue ${view} sans chaînes SEO en ${lang}`)
  }

  const url = urlFor(lang, view)
  // L'accueil mène par la marque (elle est le sujet) ; une page de vue mène par
  // le mot-clé (la marque n'est pas encore cherchée, et Google tronque la fin).
  const title =
    view === 'home'
      ? `${site.brand} · ${SEO[lang].tagline}`
      : `${VIEW_SEO[view][lang].title} · ${site.brand}`
  const description =
    view === 'home' ? SEO[lang].description : VIEW_SEO[view][lang].description
  // `keywords` reste celui de l'ACCUEIL sur toute vue : ce meta n'a plus aucune
  // incidence sur le classement Google depuis 2009, donc lui composer une
  // variante par vue serait de l'entretien pour un signal mort. Décision du
  // propriétaire — le garder est un choix assumé, pas un oubli.
  const { keywords } = SEO[lang]
  // La carte de partage suit la VITRINE, pas la langue ni la vue : les pages
  // /radio du .org gardent la carte anglaise du domaine, comme son accueil.
  // C'est voulu — une carte par langue ou par vue supposerait bien plus de
  // fichiers à tenir, alors que la marque, elle, est unique par domaine. Voir
  // `ogImage` dans sites.config.js.

  return composeHead({
    site, lang, url, title, description, keywords,
    alternates: [
      ...ALL_LANGS.map((l) => [l, urlFor(l, view)]),
      ['x-default', xDefaultFor(view)],
    ],
    ogType: 'website',
    graph: siteGraph(site, lang),
  })
}

// Le fil d'Ariane d'une page hors accueil : Accueil › section › page. Les
// libellés sont ceux de la navigation visible de la langue (BRIEF_STRINGS.home,
// titres de section) ; le dernier maillon est la page elle-même.
function breadcrumb(lang, trail) {
  const items = [[BRIEF_STRINGS[lang].home, urlFor(lang, 'home')], ...trail]
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, item], i) => ({
      '@type': 'ListItem', position: i + 1, name, item,
    })),
  }
}

// Le sujet d'un article Culture, désigné par son entité Wikidata : c'est ce qui
// relie « duduk » à l'entité que connaissent Google et les moteurs IA, au lieu
// d'une chaîne de caractères à interpréter. Le qid est celui qui a servi à
// trouver les sources (meta.json) — donc le bon homonyme, vérifié au brouillon.
// `name` vient de la page Wikipédia de la langue, sinon du titre de l'article.
export function articleAbout(article, lang, fallbackName) {
  const qid = article?.meta?.qid
  if (!/^Q\d+$/.test(qid ?? '')) return null
  // meta.json antérieurs à `kind` : Wikipédia seulement (culture-sources.mjs).
  const wiki = article.sources.find((x) => (x.kind ?? 'wikipedia') === 'wikipedia' && x.lang === lang)
  return {
    '@type': 'Thing',
    '@id': `http://www.wikidata.org/entity/${qid}`,
    name: wiki?.title ?? fallbackName,
    sameAs: [`https://www.wikidata.org/wiki/${qid}`, ...(wiki ? [wiki.url] : [])],
  }
}

// L'en-tête d'une page de brève : `/breve/` (date null) ou une page datée.
// Mêmes balises que les vues, via composeHead ; ce qui change : le hreflang
// (langues présentes ce jour-là, voir brief-links.mjs), og:type article et un
// NewsArticle qui cite les URL sources.
export function briefHeadFor({ siteId, lang, date = null, brief = null, byDate, robots = null }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  const s = BRIEF_STRINGS[lang]
  if (!s) throw new Error(`pas de chaînes de brève en ${lang}`)
  const url = briefUrl(lang, date)
  const title = date
    ? `${s.title} — ${longDate(lang, date)} · ${site.brand}`
    : `${s.title} · ${site.brand}`
  const description = (date && brief?.intro) || s.description
  const graph = siteGraph(site, lang)
  if (date && brief) {
    graph.push({
      '@type': 'NewsArticle',
      '@id': `${url}#article`,
      headline: `${s.title} — ${longDate(lang, date)}`,
      description,
      url,
      mainEntityOfPage: url,
      image: `${site.host}${site.ogImage}`,
      author: { '@id': `${site.host}/#organization` },
      datePublished: brief.generatedAt,
      inLanguage: lang,
      isAccessibleForFree: true,
      publisher: { '@id': `${site.host}/#organization` },
      citation: brief.topics.flatMap((t) => t.sources.map((x) => x.url)),
    })
    graph.push(breadcrumb(lang, [[s.title, briefUrl(lang)], [longDate(lang, date), url]]))
  } else {
    graph.push(breadcrumb(lang, [[s.title, url]]))
  }
  return composeHead({
    site, lang, url, title, description,
    alternates: briefAlternates(date, byDate, lang),
    ogType: date ? 'article' : 'website',
    graph,
    robots,
  })
}

// L'en-tête d'une page Culture : l'index (`slug` null) ou un article. Mêmes
// balises que les vues et la brève, via composeHead ; hreflang limité aux
// langues présentes pour cet article (culture-links.mjs), og:type article,
// carte de partage propre à l'article quand il a une image.
export function cultureHeadFor({ siteId, lang, slug = null, article = null, bySlug, robots = null, video = null }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  const s = CULTURE_STRINGS[lang]
  if (!s) throw new Error(`pas de chaînes Culture en ${lang}`)
  const url = cultureUrl(lang, slug)
  const a = slug ? article?.langs?.[lang] : null
  if (slug && !a) throw new Error(`article ${slug} absent en ${lang}`)
  const title = a ? `${a.title} · ${site.brand}` : `${s.title} · ${site.brand}`
  const description = a ? a.description : s.description
  const ogImage = a && article.image ? `${site.host}${cultureImagePath(slug, 'jpg')}` : null
  const graph = siteGraph(site, lang)
  if (a) {
    const about = articleAbout(article, lang, a.title)
    graph.push({
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: a.title,
      description,
      url,
      mainEntityOfPage: url,
      image: ogImage ?? `${site.host}${site.ogImage}`,
      author: { '@id': `${site.host}/#organization` },
      publisher: { '@id': `${site.host}/#organization` },
      datePublished: a.date,
      inLanguage: lang,
      isAccessibleForFree: true,
      // Wikipédia de/it n'est citée que sur la page de sa langue (culture-validate).
      citation: pageSources(article.sources, lang).map((x) => x.url),
      ...(about ? { about } : {}),
      // La vidéo de l'article, dans cette langue seulement (culture-videos.mjs).
      ...(video ? { video: { '@id': `${url}#video` } } : {}),
    })
    if (video) graph.push(videoLd(video, lang, url, site))
    graph.push(breadcrumb(lang, [[s.title, cultureUrl(lang)], [a.title, url]]))
  } else {
    graph.push(breadcrumb(lang, [[s.title, url]]))
  }
  return composeHead({
    site, lang, url, title, description,
    alternates: cultureAlternates(slug, bySlug, lang),
    ogType: a ? 'article' : 'website',
    graph,
    robots,
    ogImage,
  })
}

// Les alternates d'une page pays : le même pays dans les six langues. La page
// existe dans toutes (même données, même horloge pour les deux vitrines — voir
// build-sites.mjs), donc le bloc est complet et réciproque par construction.
export function agendaPaysAlternates(key) {
  return [
    ...ALL_LANGS.map((l) => [l, agendaCountryUrl(l, key)]),
    ['x-default', agendaCountryUrl('en', key)],
  ]
}

// L'en-tête d'une page Agenda par pays (scripts/lib/agenda-pays.mjs). Le
// balisage `Event` décrit EXACTEMENT la liste affichée (`events`, déjà filtrée
// et dédoublonnée) — chaque nœud par eventLd, comme l'accueil et /agenda/.
export function agendaPaysHeadFor({ siteId, lang, key, events, robots = null }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  const s = AGENDA_PAYS_STRINGS[lang]
  if (!s) throw new Error(`pas de chaînes Agenda par pays en ${lang}`)
  const country = countryLabel(key, lang)
  const url = agendaCountryUrl(lang, key)
  const graph = siteGraph(site, lang)
  graph.push(...events.map(eventLd))
  graph.push(breadcrumb(lang, [[BRIEF_STRINGS[lang].agenda, urlFor(lang, 'agenda')], [country, url]]))
  return composeHead({
    site, lang, url,
    title: `${s.title(country)} · ${site.brand}`,
    description: s.description(country),
    alternates: agendaPaysAlternates(key),
    ogType: 'website',
    graph,
    robots,
  })
}

// La balise beacon de Cloudflare Web Analytics pour cette vitrine, ou '' si elle
// n'a pas (encore) de jeton — mieux vaut aucune mesure que des visites versées
// dans le tableau de bord de l'autre site.
//
// Le jeton est validé avant d'être écrit : il part dans un attribut délimité par
// des apostrophes, et un jeton mal collé (une apostrophe, un guillemet) ferait
// une balise d'apparence correcte que le navigateur lirait de travers. Cloudflare
// n'émet que du hexadécimal 32 caractères.
export function beaconTag(siteId) {
  const token = SITES[siteId].cfBeaconToken
  if (!token) return ''
  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new Error(`cfBeaconToken de « ${siteId} » : 32 caractères hexadécimaux attendus`)
  }
  // Le beacon n'est pas chargé en dur : /cf-init.js le charge, sauf sur un
  // navigateur écarté par `?mesure=non` (Cloudflare n'a aucun filtre côté
  // tableau de bord). Le jeton reste dans la page, sur la balise du chargeur.
  return `<script src="/cf-init.js" data-cf-beacon='{"token": "${token}"}'></script>`
}

// Les deux balises GA4 de cette vitrine, ou '' si elle n'a pas d'ID — mieux vaut
// aucune mesure que des visites versées dans la propriété de l'autre site.
//
// L'ORDRE EST LE FOND DE L'AFFAIRE : ga-init.js est synchrone et vient en
// premier, gtag.js est `async` et vient après. C'est ce qui garantit que les
// `gtag('consent', 'default', …)` sont dans la file AVANT que gtag.js ne la
// traite. Les inverser ferait partir le premier hit sans état de consentement,
// donc avec des cookies là où le RGPD les interdit — sans la moindre erreur.
//
// L'ID voyage dans un attribut `data-ga-id` plutôt que dans un `<script>` en
// ligne : la CSP de firebase.json est en `script-src 'self'` sans
// `'unsafe-inline'`, un script en ligne serait donc bloqué. ga-init.js le relit
// via `document.currentScript`.
//
// Il est validé avant d'être écrit : il part dans un attribut ET dans une URL,
// et un ID mal collé ferait une balise d'apparence correcte qui mesure dans le
// vide. Google n'émet que `G-` suivi de majuscules et de chiffres.
export function gaTag(siteId) {
  const id = SITES[siteId].gaMeasurementId
  if (!id) return ''
  if (!/^G-[A-Z0-9]{6,12}$/.test(id)) {
    throw new Error(`gaMeasurementId de « ${siteId} » : format G-XXXXXXXXXX attendu`)
  }
  return (
    `<script src="/ga-init.js" data-ga-id="${id}"></script>\n` +
    `    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`
  )
}

// Les deux mesures d'audience d'une vitrine, posées à leurs marqueurs. Sert
// au HTML source (via applyMeta) ET aux cartes de liens de pages/, que
// site-meta ne voit pas autrement : ce sont elles qu'on partage sur Facebook
// et WhatsApp, et sans balise l'origine de ce trafic était perdue — la visite
// arrivait sur l'accueil avec la carte pour seul référent.
//
// Refus, et pas un remplacement silencieux : sans ces marqueurs la page
// perdrait sa mesure d'audience sans qu'aucun build ne s'en plaigne.
export function applyAnalytics(html, siteId) {
  if (!html.includes(BEACON_MARKER)) {
    throw new Error(`marqueur ${BEACON_MARKER} absent du HTML — page sans analytics, refus`)
  }
  if (!html.includes(GA_MARKER)) {
    throw new Error(`marqueur ${GA_MARKER} absent du HTML — page sans GA4, refus`)
  }
  return html.replace(BEACON_MARKER, beaconTag(siteId)).replace(GA_MARKER, gaTag(siteId))
}

const setLang = (html, lang) => html.replace(/<html\s+lang="[^"]*"/, `<html lang="${lang}"`)

// Pour le HTML SOURCE (index.html du dépôt), qui porte les marqueurs.
export function applyMeta(html, { siteId, lang, view = 'home' }) {
  if (!html.includes(META_MARKER)) {
    throw new Error(`marqueur ${META_MARKER} absent du HTML — page sans métadonnées, refus`)
  }
  return applyAnalytics(setLang(html, lang), siteId).replace(
    META_MARKER,
    headFor({ siteId, lang, view }).trimStart(),
  )
}

// Pour le HTML DÉJÀ BÂTI, qui porte les sentinelles. Idempotent : rejouable
// autant de fois que voulu sur son propre résultat.
export function replaceMeta(html, { siteId, lang, view = 'home' }) {
  const from = html.indexOf(META_START)
  const to = html.indexOf(META_END)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(
      `sentinelles ${META_START}…${META_END} absentes — HTML non bâti par applyMeta, refus`,
    )
  }
  const head = headFor({ siteId, lang, view }).trimStart()
  return setLang(html.slice(0, from) + head + html.slice(to + META_END.length), lang)
}
