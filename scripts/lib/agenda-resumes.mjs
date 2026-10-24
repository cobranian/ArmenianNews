// Résumés des événements de l'agenda : 2-3 phrases écrites par un modèle :free
// OpenRouter, dans les six langues, à partir du texte de présentation de la
// page armenopole. Affichés dans la visionneuse (Lightbox.jsx), chargés au
// premier dépli. Conception : docs/superpowers/specs/2026-10-24-agenda-resume-design.md
//
// Ce module est PUR jusqu'à `summarizeAgenda`, qui seule touche le réseau — et
// par des fonctions injectées, pour que les tests n'en touchent aucun.
import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'
import { strayWords, allowedWords, frenchWords } from './brief-script.mjs'
import { ALL_LANGS } from '../../sites.config.js'

// Un texte source plus court ne dit rien qu'un résumé puisse reprendre.
export const MIN_SOURCE = 80

// Le texte de présentation d'une page d'événement armenopole, ou null.
// [itemprop="description"] d'abord (vérifié le 24 oct. 2026 sur plusieurs
// pays) ; repli sur le premier div de la colonne principale, où il vivait.
export function extractEventText(html) {
  const $ = cheerio.load(html)
  let el = $('[itemprop="description"]').first()
  if (!el.length) el = $('.col-md-8.col-md-pull-4').first().children('div').first()
  if (!el.length) return null
  el.find('br').replaceWith('\n')
  el.find('p, div, li, h1, h2, h3, h4').append('\n')
  const text = el
    .text()
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return text.length >= MIN_SOURCE ? text : null
}

// Empreinte du texte source : s'il change chez armenopole, le résumé est refait.
export const sourceHash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12)

// Ce qu'un résumé ne doit JAMAIS contenir : une heure, un prix, une adresse.
// Ce sont les détails qu'une traduction automatique fausse, et la visionneuse
// affiche déjà lieu, date et heure tirés des données d'armenopole. Les années,
// ordinaux et petits nombres (« 33e édition », « 2 concerts ») restent permis.
const NOT_LETTER_AFTER = '(?![\\p{L}])'
const VOIE =
  'rue|route|place|avenue|av\\.|chemin|ch\\.|boulevard|bd|st\\.|street|ave|road|rd|' +
  'strasse|straße|gasse|via|piazza|улица|ул\\.|проспект|փողոց|պողոտա'
const RULES = [
  ['heure', /(?<!\d)\d{1,2}[:h.]\d{2}(?!\d)|(?<!\d)\d{1,2}\s?(?:am|pm)(?![\p{L}])/iu],
  [
    'prix',
    /\d[\d'’ .,]*\s?(?:CHF|EUR|USD|AMD|€|\$|£|֏|₽|руб|драм|dram)|(?:CHF|EUR|USD|AMD|€|\$|£|֏|₽)\s?\d/iu,
  ],
  [
    'adresse',
    new RegExp(
      `(?<!\\d)\\d{1,4}\\s+(?:${VOIE})${NOT_LETTER_AFTER}|\\p{L}*(?:gasse|strasse|straße)\\s+\\d{1,4}(?!\\d)`,
      'iu',
    ),
  ],
]

export function forbiddenDetail(text) {
  for (const [name, re] of RULES) if (re.test(text)) return name
  return null
}

// ---------------------------------------------------------------------------
// Le modèle, sa réponse, la vérification, le cache.


export const MAX_PER_SNAPSHOT = 20
export const MAX_ATTEMPTS = 3
export const RECHECK_DAYS = 7
const MIN_LEN = 80
const MAX_LEN = 700

const LANG_NAMES = {
  fr: 'French',
  de: 'German',
  it: 'Italian',
  en: 'English',
  hy: 'Eastern Armenian, in Armenian script',
  ru: 'Russian, in Cyrillic script',
}

export function buildResumeMessages(ev, text) {
  const keys = ALL_LANGS.map((l) => `"${l}": <${LANG_NAMES[l]}>`).join(', ')
  return [
    {
      role: 'system',
      content:
        'You summarise Armenian community events for a news site. ' +
        'Write 2 or 3 sentences (about 250 to 400 characters) saying what the event is, ' +
        'who performs or organises it, and its genre or tone. ' +
        'NEVER include prices, ticket information, times or hours, street addresses, phone numbers, e-mails or links: ' +
        'the site shows date, time and place separately. ' +
        'Keep proper names (people, groups, venues, organisations) exactly as written in the source. ' +
        'Write each language natively, never mixing scripts. ' +
        `Reply with ONE JSON object and nothing else: {${keys}}.`,
    },
    {
      role: 'user',
      content: `Event: ${ev.title}\nPlace: ${ev.location || ''}\n\nSource text:\n${text}`,
    },
  ]
}

// La réponse du modèle : JSON nu, entre fences, ou entouré de texte.
export function parseResumeReply(content) {
  const s = String(content ?? '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b <= a) return {}
  let obj
  try {
    obj = JSON.parse(s.slice(a, b + 1))
  } catch {
    return {}
  }
  const out = {}
  for (const l of ALL_LANGS) {
    const v = obj?.[l]
    if (typeof v === 'string' && v.trim()) out[l] = v.trim()
  }
  return out
}

// Chaque langue est vérifiée seule : une langue fautive est écartée, les
// autres restent. Les mots du titre et du texte source sont permis dans une
// autre écriture (un interprète cité en latin dans un résumé arménien).
export function vetResumes(byLang, { title = '', text = '' } = {}) {
  const allowed = allowedWords([title, text])
  const kept = {}
  const rejected = []
  for (const [lang, s] of Object.entries(byLang)) {
    let reason = null
    if (s.length < MIN_LEN || s.length > MAX_LEN) reason = 'longueur'
    else if (strayWords(s, lang, allowed).length || frenchWords(s, lang).length) reason = 'alphabet'
    else reason = forbiddenDetail(s)
    if (reason) rejected.push([lang, reason])
    else kept[lang] = s
  }
  return { kept, rejected }
}

export const resumeLangs = (entry) => ALL_LANGS.filter((l) => entry?.[l])

// Les événements à (re)traiter, dans l'ordre : jamais vus, incomplets (moins de
// MAX_ATTEMPTS essais), puis vérifiés il y a plus de RECHECK_DAYS jours.
export function pendingEvents(events, cache, now, max = MAX_PER_SNAPSHOT) {
  const seen = new Set()
  const fresh = []
  const incomplete = []
  const stale = []
  const limit = now.getTime() - RECHECK_DAYS * 86400000
  for (const ev of events) {
    if (!ev?.url || seen.has(ev.url)) continue
    seen.add(ev.url)
    const e = cache[ev.url]
    if (!e) fresh.push(ev)
    else if (resumeLangs(e).length < ALL_LANGS.length && (e.attempts ?? 0) < MAX_ATTEMPTS) incomplete.push(ev)
    else if (!e.checkedAt || Date.parse(e.checkedAt) < limit) stale.push(ev)
  }
  return [...fresh, ...incomplete, ...stale].slice(0, max)
}

export function pruneCache(cache, events) {
  const live = new Set(events.map((e) => e.url))
  return Object.fromEntries(Object.entries(cache).filter(([url]) => live.has(url)))
}

export function resumesFor(cache, lang) {
  const out = {}
  for (const [url, e] of Object.entries(cache)) if (e?.[lang]) out[url] = e[lang]
  return out
}
