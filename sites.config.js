// Source de vérité des deux vitrines. Tout en dérive : métadonnées HTML,
// hreflang, sitemaps, cibles Firebase, sélecteur de langue.
//
// Ce module est importé par le navigateur (src/) ET par Node (scripts/,
// vite.config.js). Il ne doit donc utiliser aucune API propre à l'un ou à
// l'autre — et surtout jamais importer src/i18n.jsx, qui l'importe déjà :
// le cycle casserait le bundle.

export const SITES = {
  ch: {
    id: 'ch',
    host: 'https://armenieinfo.ch',
    firebaseSite: 'armenie-info',
    brand: 'Arménie Info',
    email: 'contact@armenieinfo.ch',
    gscToken: 'dMoDQHq0L5w16RdNPGKom7TJZe6LNjEc7Qq4PtVjO7k',
    pages: [{ lang: 'fr', path: '/' }],
  },
  org: {
    id: 'org',
    host: 'https://armenianews.org',
    firebaseSite: 'armenia-news',
    brand: 'Armenia News',
    // Le .org n'a pas encore de boîte aux lettres propre ; on annonce celle qui
    // existe réellement plutôt qu'une adresse morte dans le JSON-LD.
    email: 'contact@armenieinfo.ch',
    gscToken: null, // à remplir dès la propriété Search Console créée
    pages: [
      { lang: 'en', path: '/' },
      { lang: 'hy', path: '/hy/' },
      { lang: 'ru', path: '/ru/' },
    ],
  },
}

// Ordre canonique des langues. Doit correspondre aux codes de LANGS.
// L'invariant est vérifié par test/sites-config.test.mjs et par une assertion
// au build (scripts/build-sites.mjs).
export const ALL_LANGS = ['fr', 'en', 'hy', 'ru']

// Supported interface languages. Content (articles, posts) stays in its
// original language; only the chrome is translated. Moved here from
// src/i18n.jsx because Node cannot parse JSX — the build scripts and tests
// run outside the browser and need this data as plain JavaScript.
export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն' },
  { code: 'ru', label: 'РУ', name: 'Русский' },
]

// lang -> URL absolue, slash final compris. Une seule table, consommée par le
// générateur de hreflang ET par le sélecteur de langue : ce que le HTML
// déclare à Google et ce que le bouton fait au clic ne peuvent pas diverger.
export const LANG_URL = Object.fromEntries(
  Object.values(SITES).flatMap((site) =>
    site.pages.map((page) => [page.lang, site.host + page.path]),
  ),
)

// La page servie à un visiteur dont aucune langue ne correspond.
export const X_DEFAULT = LANG_URL.en

export function primaryLang(siteId) {
  return SITES[siteId].pages[0].lang
}

export function siteOf(lang) {
  const hit = Object.values(SITES).find((s) => s.pages.some((p) => p.lang === lang))
  if (!hit) throw new Error(`langue sans site : ${lang}`)
  return hit.id
}

// Le chemin fait autorité ; à défaut, la langue de tête du domaine.
// Normalise le slash final pour que /hy et /hy/ se comportent pareil
// (Firebase sert les deux via cleanUrls) — et pour que /hydravion ne
// matche pas /hy.
export function langFromPath(siteId, pathname) {
  const site = SITES[siteId]
  const norm = pathname.endsWith('/') ? pathname : `${pathname}/`
  const hit = site.pages.find((p) => p.path !== '/' && norm.startsWith(p.path))
  return hit ? hit.lang : primaryLang(siteId)
}
