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

// Build an ISO date from "AUG 4 19:00" style boxes (no year given).
// Infers the year as the next upcoming occurrence relative to `now`.
export function isoFromMonthDay(monthAbbr, day, time = '00:00', now = new Date()) {
  const m = monthIndex(monthAbbr)
  if (m == null) return null
  const d = parseInt(day, 10)
  if (!d) return null
  const [hh = '0', mm = '0'] = String(time).split(':')
  let year = now.getFullYear()
  let date = new Date(year, m, d, parseInt(hh, 10) || 0, parseInt(mm, 10) || 0)
  // If the event already passed by more than a month, assume next year.
  if (date.getTime() < now.getTime() - 31 * 86400000) {
    year += 1
    date = new Date(year, m, d, parseInt(hh, 10) || 0, parseInt(mm, 10) || 0)
  }
  return date.toISOString()
}

export function absUrl(href, base) {
  if (!href) return null
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

export function clean(str) {
  return (str || '').replace(/\s+/g, ' ').trim()
}
