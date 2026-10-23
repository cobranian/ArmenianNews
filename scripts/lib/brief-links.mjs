// Les liens entre les versions linguistiques d'une brève, partagés par
// l'en-tête HTML (site-meta.mjs) et le sitemap (sitemap.mjs) : deux
// générateurs qui divergeraient feraient ignorer le bloc par Google.
//
// LE PIÈGE : une page datée ne doit citer QUE les langues qui ont une brève ce
// jour-là. Les quatre langues ne paraissent pas forcément le même jour (modèle
// en échec, trop peu d'articles) ; un hreflang vers une page absente fait
// ignorer TOUT le bloc, silencieusement. L'index (/breve/), lui, existe
// toujours dans les quatre langues.
import { ALL_LANGS, briefUrl } from '../../sites.config.js'
import { hyLongDate } from '../../src/hyDate.js'

export function briefLangsByDate(briefs) {
  const m = new Map()
  for (const lang of ALL_LANGS)
    for (const b of briefs[lang] ?? []) m.set(b.date, [...(m.get(b.date) ?? []), lang])
  for (const [d, langs] of m) m.set(d, ALL_LANGS.filter((l) => langs.includes(l)))
  return m
}

export function briefAlternates(date, byDate) {
  const langs = date === null ? ALL_LANGS : (byDate.get(date) ?? [])
  const out = langs.map((l) => [l, briefUrl(l, date)])
  if (langs.includes('en')) out.push(['x-default', briefUrl('en', date)])
  return out
}

// La date en toutes lettres. Côté NODE seulement (build) : Intl y a l'ICU
// complet. L'arménien passe malgré tout par src/hyDate.js, comme partout dans
// le dépôt — une seule table de mois arméniens.
// de/it à la suisse, comme LOCALES (src/i18n.jsx).
const LOCALE = { fr: 'fr-FR', de: 'de-CH', it: 'it-CH', en: 'en-US', ru: 'ru-RU' }
export function longDate(lang, date) {
  const [y, m, d] = date.split('-').map(Number)
  if (lang === 'hy') return hyLongDate(new Date(y, m - 1, d))
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  )
}
