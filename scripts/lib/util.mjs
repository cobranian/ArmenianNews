// Accent-stripped, bilingual (EN/FR) month abbreviations -> month index.
// armenopole renders a mix, e.g. JUL (en) alongside AOÛ / DÉC (fr).
const MONTHS = {
  jan: 0, feb: 1, fev: 1, mar: 2, apr: 3, avr: 3, may: 4, mai: 4,
  jun: 5, jul: 6, aug: 7, aou: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function monthIndex(raw) {
  const norm = String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop accents (AOÛ -> AOU)
    .toLowerCase()
  // Disambiguate French juin/juillet which both start "jui".
  if (norm.startsWith('juil')) return 6
  if (norm.startsWith('juin')) return 5
  return MONTHS[norm.slice(0, 3)] ?? null
}

// Compose une date ISO 8601 à partir d'une boîte « AUG 4 19:00 » (sans année).
// L'année est celle de la prochaine occurrence relativement à `now`.
//
// LE RÉSULTAT EST UNE HEURE MURALE, SANS FUSEAU : « 2026-08-04T19:00 ». C'est
// la seule chose qu'Armenopole dise — l'heure du lieu, jamais l'offset — et
// c'est ce qu'un lecteur veut voir, où qu'il soit. Ne revenez pas à
// `toISOString()` : elle interprétait ces composantes dans le fuseau de la
// machine qui scrape (UTC sur le runner GitHub) et écrivait un `Z` — 12:30 à
// Genève publié comme 14:30, et les événements notés 23:59 (pas d'heure chez
// Armenopole) basculant au lendemain chez un lecteur suisse et dans le JSON-LD.
// Un scrape lancé depuis Zurich donnait d'autres valeurs que la CI : la donnée
// dépendait de qui l'avait produite. Mesuré le 21 août 2026, 27/155 événements.
//
// `new Date('2026-08-04T19:00')` (sans offset) est lue en heure LOCALE par
// tout moteur ECMAScript — donc `getDate()` rend le même jour partout, ce que
// les pastilles de l'agenda exploitent. Le balisage (src/agendaEvents.js,
// `startDateLd`) lit 23:59 comme « toute la journée » et n'émet que le jour.
export function isoFromMonthDay(monthAbbr, day, time = '00:00', now = new Date()) {
  const m = monthIndex(monthAbbr)
  if (m == null) return null
  const d = parseInt(day, 10)
  if (!d) return null
  const [hh = '0', mm = '0'] = String(time).split(':')
  const h = parseInt(hh, 10) || 0
  const mi = parseInt(mm, 10) || 0
  let year = now.getFullYear()
  let date = new Date(year, m, d, h, mi)
  // If the event already passed by more than a month, assume next year.
  if (date.getTime() < now.getTime() - 31 * 86400000) {
    year += 1
    date = new Date(year, m, d, h, mi)
  }
  // Relu en composantes LOCALES — les mêmes qui ont servi à construire la date,
  // donc indépendantes du fuseau de la machine (sauf trou d'heure d'été, sans
  // conséquence ici).
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

/* Every URL in the snapshot comes from a third-party page we do not control,
 * and lands in an <a href> / <img src> at build time. `new URL()` happily
 * preserves a `javascript:` or `data:` scheme, and React 18 renders such an
 * href with only a console warning — so a compromised source could plant a
 * stored XSS in news.json. The site's CSP (script-src 'self') blocks it, but
 * that is the last line of defence, not the first: only http(s) gets through
 * here. Anything else is dropped, and the item is skipped upstream.
 *
 * `base` is optional: RSS feeds hand us absolute links already. */
const SAFE_SCHEMES = new Set(['http:', 'https:'])

export function safeUrl(href, base) {
  if (!href) return null
  try {
    const url = new URL(href, base)
    return SAFE_SCHEMES.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export const absUrl = safeUrl

export function clean(str) {
  return (str || '').replace(/\s+/g, ' ').trim()
}
