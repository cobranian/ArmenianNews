import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'
import { PLACE_TO_COUNTRY } from '../../src/worldPlace.js'
import {
  AGENDA_SLUG,
  BASE,
  categories,
  decodeEntities,
  imageMap,
  mediaFor,
} from './diarioarmenia.mjs'

// Les annonces de la catégorie Agenda de Diario Armenia (la communauté arménienne
// d'Argentine) deviennent des événements de l'agenda, fusionnés dans `world`
// (voir scrape.mjs). Ces annonces n'ont AUCUN champ de date : le jour et l'heure
// ne vivent que dans la phrase d'ouverture (« el sábado 28 de noviembre a las 18,
// en la sede… »). Règle non négociable : pas de date sûre, pas d'événement. Une
// date approchée (« en noviembre ») ou devinée serait publiée dans le JSON-LD
// Event, qui doit décrire la réalité.
//
// La date émise est une HEURE MURALE sans fuseau (`2026-11-08T19:00`), jamais un
// `Z`, et un jour seul (`2026-11-08`) quand le texte ne donne pas d'heure —
// comme le 23:59 d'Armenopole (startDateLd). Voir « À savoir » du CLAUDE.md.

const MONTHS = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

// « 8 de noviembre », « 1° de noviembre », « 14, 21 y 28 de noviembre » (le
// PREMIER jour de la liste), « del 3 al 16 de enero de 2027 » (le premier aussi).
const DATE_RE = new RegExp(
  '(?<!\\d)(\\d{1,2})\\s*(?:[°º]|o(?=\\s))?' +
    '(?:\\s*(?:,|\\sy|\\sal)\\s*\\d{1,2}\\s*(?:[°º]|o(?=\\s))?)*' +
    '\\s+de\\s+(' + Object.keys(MONTHS).join('|') + ')\\b(?:\\s+de\\s+(\\d{4}))?',
  'gi',
)

const pad = (n) => String(n).padStart(2, '0')

// Heure dans la fenêtre qui suit la date : « a las 19 hs », « a las 20 », « 19.30 »,
// « 12:30 hs », « 19 hs ». (?<![\d.:]) écarte « 2.000 » et les adresses.
function timeIn(window) {
  const forms = [
    /\b(?:a|desde|a partir de)\s+las\s+(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?(?!\d)/i,
    /(?<![\d.:])(\d{1,2})[:.](\d{2})(?!\d)/,
    /(?<![\d.:])(\d{1,2})\s*(?:hs|h|horas)\b/i,
  ]
  for (const re of forms) {
    const m = re.exec(window)
    if (!m) continue
    let h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h > 23 || min > 59) continue
    // « a las 8 de la noche » : 20 h, pas 8 h.
    if (h < 12 && /^\s*(?:de la (?:noche|tarde)|p\.?\s?m)/i.test(window.slice(m.index + m[0].length))) h += 12
    return `${pad(h)}:${pad(min)}`
  }
  return null
}

// Toutes les dates lisibles d'un texte, dans l'ordre : [{ date, time }].
// `ref` : le jour depuis lequel on cherche la prochaine occurrence d'un jour sans année.
function scanDates(text, ref) {
  const out = []
  const matches = [...String(text || '').matchAll(DATE_RE)]
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  matches.forEach((m, i) => {
    const day = Number(m[1])
    const month = MONTHS[m[2].toLowerCase()]
    let year = m[3] ? Number(m[3]) : start.getFullYear()
    let d = new Date(year, month, day)
    if (!m[3] && d < start) {
      year += 1
      d = new Date(year, month, day)
    }
    // 31 de febrero : le constructeur déborde sur mars, la date est fausse.
    if (d.getMonth() !== month || d.getDate() !== day) return
    const end = m.index + m[0].length
    const next = matches[i + 1] ? matches[i + 1].index : end + 80
    const time = timeIn(text.slice(end, Math.min(end + 80, next)))
    out.push({ date: `${year}-${pad(month + 1)}-${pad(day)}`, time })
  })
  return out
}

const asDate = ({ date, time }) => (time ? `${date}T${time}` : date)

// Texte → `AAAA-MM-JJTHH:MM`, `AAAA-MM-JJ` (pas d'heure) ou null. L'année est la
// PROCHAINE occurrence à partir de `now` (« 5 de enero » lu en novembre = l'an
// suivant) ; l'appelant passe la date de l'annonce, pas l'heure du scrape (voir
// parseAgendaPosts).
export function parseSpanishEventDate(text, now = new Date()) {
  const first = scanDates(text, now)[0]
  return first ? asDate(first) : null
}

// Le titre d'abord (il porte la date quand l'annonce est courte), puis le début du
// texte. Si la date vient du titre et pas son heure, l'heure se lit dans le texte,
// à côté de la MÊME date.
function eventDate(title, body, ref) {
  const head = body.slice(0, 1000)
  const t = scanDates(title, ref)[0]
  if (t) {
    if (t.time) return asDate(t)
    const same = scanDates(head, ref).find((c) => c.date === t.date && c.time)
    return asDate(same || t)
  }
  const b = scanDates(head, ref)[0]
  return b ? asDate(b) : null
}

// Un lieu n'est gardé que s'il se résout, via PLACE_TO_COUNTRY, vers un pays AUTRE
// que l'Argentine (le pays vient de `country`). « Armenia 1353 » est une rue de
// Buenos Aires : seul « en Ereván » / « en Montevideo » compte.
function foreignPlace(text) {
  const head = text.slice(0, 600)
  let place = ''
  if (/\ben\s+(?:la ciudad de\s+)?(?:Ereván|Erevan|Yereván|Yerevan)\b/i.test(head)) place = 'Erevan'
  else if (/\ben\s+(?:la ciudad de\s+)?(?:Montevideo|Uruguay)\b/i.test(head)) place = 'Uruguay'
  const country = PLACE_TO_COUNTRY[place.toLowerCase()]
  return country && country !== 'argentina' ? place : ''
}

// Articles Agenda (REST) + médias → événements. `now` est le repli de la date de
// référence ; chaque annonce se lit depuis SA date de publication : « el martes
// 27 de octubre » annoncé le 23 octobre est celui du 27 (passé le 31), pas celui
// de l'an prochain.
export function parseAgendaPosts(postsJson, mediaJson = '[]', { now = new Date() } = {}) {
  const posts = JSON.parse(postsJson)
  if (!Array.isArray(posts)) throw new Error('REST API did not return a list')
  const images = imageMap(mediaJson)
  const out = []
  for (const p of posts) {
    const title = decodeEntities(p.title?.rendered)
    const url = safeUrl(clean(p.link))
    if (!title || !url) continue
    const body = decodeEntities(p.content?.rendered)
    const posted = p.date_gmt ? new Date(`${p.date_gmt}Z`) : null
    const ref = posted && !Number.isNaN(posted.getTime()) ? posted : now
    const date = eventDate(title, body, ref)
    if (!date) continue
    out.push({
      title,
      url,
      location: foreignPlace(`${title}. ${body}`),
      date,
      rawDate: date,
      image: images.get(p.featured_media) ?? null,
      country: 'argentina',
    })
  }
  return out
}

const upcoming = (e) => new Date(e.date).getTime() > Date.now() - 86400000
const byDate = (a, b) => new Date(a.date || 0) - new Date(b.date || 0)

export async function scrapeDiarioAgenda(limit = 50) {
  const cats = await categories()
  const id = cats[AGENDA_SLUG]?.id
  if (id == null) throw new Error('catégorie agenda introuvable')
  const postsJson = await fetchText(
    `${BASE}/posts?categories=${id}&per_page=${limit}&_fields=title,link,date_gmt,featured_media,content`,
  )
  const all = JSON.parse(postsJson)
  const events = parseAgendaPosts(postsJson, await mediaFor(postsJson)).filter(upcoming).sort(byDate)
  console.log(`  ✓ diarioarmenia/agenda (${events.length} à venir, ${all.length} annonces lues)`)
  return events
}

// Fusionne dans `world` : dédoublonnage par URL (le premier vu gagne, comme dans
// armenopole) puis tri par date.
export function mergeDiarioIntoWorld(world, daEvents) {
  const seen = new Set()
  const out = []
  for (const e of [...world, ...daEvents]) {
    const id = e.url || `${e.title}|${e.date}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push(e)
  }
  return out.sort(byDate)
}

// Les événements de Diario Armenia d'un ancien instantané, resservis quand le
// scrape de l'Agenda échoue (leurs images sont déjà en /da/).
export const isDiarioEvent = (e) => /^https?:\/\/(www\.)?diarioarmenia\.org\.ar\//.test(e?.url || '')
