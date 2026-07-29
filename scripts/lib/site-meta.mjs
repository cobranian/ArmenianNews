// Génère le <head> propre à un couple (site, langue).
//
// Appelé à deux moments : par le plugin Vite pendant `vite build` (page par
// défaut de chaque site), et par scripts/build-sites.mjs pour dériver /hy/ et
// /ru/ à partir du HTML déjà bâti. Un seul générateur pour les deux, sinon les
// quatre pages divergent — et une divergence dans les hreflang les fait
// silencieusement ignorer par Google.
import { SITES, LANG_URL, ALL_LANGS, X_DEFAULT } from '../../sites.config.js'
import { SEO, OG_LOCALE } from '../../src/seo.js'

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

// Échappe ce qui part dans un attribut HTML. Les chaînes viennent de nos
// propres fichiers, mais un apostrophe typographique mal placé dans une
// baseline ne doit pas pouvoir casser un attribut.
const attr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function jsonLd(site, lang) {
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
      // Les deux marques se déclarent l'une l'autre : c'est ce qui les présente
      // comme des sites sœurs plutôt que comme deux copies concurrentes.
      sameAs: Object.values(SITES)
        .filter((s) => s.id !== site.id)
        .map((s) => `${s.host}/`),
      logo: {
        '@type': 'ImageObject',
        url: `${site.host}/apple-touch-icon.png`,
        width: 180,
        height: 180,
      },
      image: `${site.host}${site.ogImage}`,
    },
  ]
  // Échappe "<" pour qu'aucune chaîne ne puisse fermer le <script>.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}

export function headFor({ siteId, lang }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!SEO[lang]) throw new Error(`langue sans chaînes SEO : ${lang}`)
  if (!OG_LOCALE[lang]) throw new Error(`langue sans locale Open Graph : ${lang}`)

  const url = LANG_URL[lang]
  const title = `${site.brand} · ${SEO[lang].tagline}`
  const { description, keywords } = SEO[lang]
  // La carte de partage suit la VITRINE, pas la langue : les trois pages du
  // .org partagent la carte anglaise. C'est voulu — une carte par langue
  // supposerait trois fichiers à tenir, alors que la marque, elle, est unique
  // par domaine. Voir `ogImage` dans sites.config.js.
  const image = `${site.host}${site.ogImage}`

  const lines = [
    `<meta name="description" content="${attr(description)}" />`,
    `<meta name="keywords" content="${attr(keywords)}" />`,
    `<title>${attr(title)}</title>`,
    `<link rel="canonical" href="${url}" />`,
    '',
    '<!-- Versions linguistiques. Réciproques et identiques sur les quatre',
    '     pages : une page absente de son propre bloc fait ignorer tout le',
    '     bloc par Google. Générées depuis sites.config.js — ne pas éditer. -->',
    ...ALL_LANGS.map(
      (l) => `<link rel="alternate" hreflang="${l}" href="${LANG_URL[l]}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${X_DEFAULT}" />`,
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
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${attr(site.brand)}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${attr(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
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
    `<script type="application/ld+json">${jsonLd(site, lang)}</script>`,
  )

  const body = lines.map((l) => (l ? `    ${l}` : '')).join('\n')
  return `    ${META_START}\n${body}\n    ${META_END}`
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
  return (
    '<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" ' +
    `data-cf-beacon='{"token": "${token}"}'></script>`
  )
}

const setLang = (html, lang) => html.replace(/<html\s+lang="[^"]*"/, `<html lang="${lang}"`)

// Pour le HTML SOURCE (index.html du dépôt), qui porte les marqueurs.
export function applyMeta(html, { siteId, lang }) {
  if (!html.includes(META_MARKER)) {
    throw new Error(`marqueur ${META_MARKER} absent du HTML — page sans métadonnées, refus`)
  }
  // Refus, et pas un remplacement silencieux : sans ce marqueur les deux
  // vitrines perdraient leur mesure d'audience sans qu'aucun build ne s'en
  // plaigne.
  if (!html.includes(BEACON_MARKER)) {
    throw new Error(`marqueur ${BEACON_MARKER} absent du HTML — page sans analytics, refus`)
  }
  return setLang(html, lang)
    .replace(META_MARKER, headFor({ siteId, lang }).trimStart())
    .replace(BEACON_MARKER, beaconTag(siteId))
}

// Pour le HTML DÉJÀ BÂTI, qui porte les sentinelles. Idempotent : rejouable
// autant de fois que voulu sur son propre résultat.
export function replaceMeta(html, { siteId, lang }) {
  const from = html.indexOf(META_START)
  const to = html.indexOf(META_END)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(
      `sentinelles ${META_START}…${META_END} absentes — HTML non bâti par applyMeta, refus`,
    )
  }
  const head = headFor({ siteId, lang }).trimStart()
  return setLang(html.slice(0, from) + head + html.slice(to + META_END.length), lang)
}
