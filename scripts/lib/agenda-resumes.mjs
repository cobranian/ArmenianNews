// Résumés des événements de l'agenda : 2-3 phrases écrites par un modèle :free
// OpenRouter, dans les sept langues, à partir du texte de présentation de la
// page armenopole. Affichés dans la visionneuse (Lightbox.jsx), chargés au
// premier dépli. Conception : docs/superpowers/specs/2026-10-24-agenda-resume-design.md
//
// Ce module est PUR jusqu'à `summarizeAgenda`, qui seule touche le réseau — et
// par des fonctions injectées, pour que les tests n'en touchent aucun.
import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'
import { strayWords, allowedWords, frenchWords } from './brief-script.mjs'
import { ALL_LANGS } from '../../sites.config.js'
import { DEFAULT_MODEL, ENDPOINT, STRONG_MODEL } from './classify-rubrics.mjs'
import { fetchText } from './http.mjs'

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


// La chaîne de modèles des résumés, DISTINCTE de celle de la brève et du
// classement (modelChain) : le résumé doit écrire l'arménien. Mesuré le 24 oct.
// 2026 sur la même page : nemotron-3.5-lightning rend un arménien inutilisable
// (« ենvole travers », « generaciónը » — 0 résumé arménien sur 20, tous écartés
// par la garde d'alphabet) ; nemotron-3-ultra-550b un arménien et un russe
// corrects, en 14 s. Ce jour-là, nemotron-3-super-120b répondait 404 et
// gemma-4-31b 429. OPENROUTER_MODEL impose un modèle unique, comme ailleurs.
export const RESUME_MODELS = [STRONG_MODEL, DEFAULT_MODEL, 'google/gemma-4-31b-it:free']
export const resumeModels = (forced = process.env.OPENROUTER_MODEL) => (forced ? [forced] : RESUME_MODELS)

// Événements traités EN MÊME TEMPS. Un événement coûte ~15 s (page + modèle) :
// un par un, le budget n'en couvrait qu'une douzaine par heure, et 151
// événements « monde » attendaient leur résumé (24 oct. 2026). Trois appels
// simultanés restent loin des limites du compte OpenRouter ; plus, et les
// points d'accès gratuits répondent 429.
export const CONCURRENCY = 3
export const MAX_PER_SNAPSHOT = 40
export const MAX_ATTEMPTS = 3
export const RECHECK_DAYS = 7
const MIN_LEN = 80
const MAX_LEN = 700

const LANG_NAMES = {
  fr: 'French',
  de: 'German',
  it: 'Italian',
  en: 'English',
  es: 'Latin American Spanish (neutral: ustedes, no voseo)',
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

// ---------------------------------------------------------------------------
// L'étape du scrape. NE LÈVE JAMAIS : une page ou un modèle en échec laisse
// l'événement sans résumé (ligne `✗ résumé` au log), et le scrape continue.
// Renvoie le cache purgé des événements passés. La clé n'est jamais loguée.
export const BUDGET_MS = 180000

export async function summarizeAgenda({
  events,
  cache,
  apiKey = process.env.OPENROUTER_API_KEY,
  // Redirection REFUSÉE : une page d'événement retirée peut renvoyer (302) vers
  // une page générique, dont le texte serait résumé à la place de l'événement.
  // Même parade que scripts/sources/armenopole.mjs.
  fetchPage = (url) => fetchText(url, { redirect: 'manual' }),
  fetchImpl = fetch,
  now = new Date(),
  budgetMs = BUDGET_MS,
  max = MAX_PER_SNAPSHOT,
  timeoutMs = 30000,
  log = console,
}) {
  const next = pruneCache(cache || {}, events)
  const todo = pendingEvents(events, next, now, max)
  if (!todo.length) {
    log.log('  résumé: aucun événement à résumer')
    return next
  }
  if (!apiKey) {
    log.warn(`  ✗ résumé: OPENROUTER_API_KEY absente — ${todo.length} événements sans résumé`)
    return next
  }
  const start = Date.now()
  const written = Object.fromEntries(ALL_LANGS.map((l) => [l, 0]))
  let done = 0
  let next_i = 0
  let overBudget = false
  // CONCURRENCY tâches piochent dans la même file ; chacune vérifie le budget
  // AVANT de prendre un événement, jamais au milieu d'un appel.
  const worker = async () => {
    while (next_i < todo.length) {
      if (Date.now() - start >= budgetMs) {
        overBudget = true
        return
      }
      const ev = todo[next_i++]
      done++
      await summarizeOne(ev)
    }
  }
  const summarizeOne = async (ev) => {
    const entry = { attempts: 0, ...next[ev.url] }
    next[ev.url] = entry
    entry.checkedAt = now.toISOString()

    let text = null
    let why = 'texte introuvable'
    try {
      text = extractEventText(await fetchPage(ev.url))
    } catch (err) {
      why = err.message
    }
    if (!text) {
      entry.attempts++
      log.warn(`  ✗ résumé: ${ev.url} — ${why}`)
      return
    }

    // Texte nouveau (première lecture réussie, ou modifié chez armenopole) :
    // les essais repartent de zéro, et un texte modifié efface les résumés.
    const hash = sourceHash(text)
    if (entry.hash !== hash) {
      if (entry.hash) for (const l of ALL_LANGS) delete entry[l]
      entry.attempts = 0
    }
    entry.hash = hash
    const missing = ALL_LANGS.filter((l) => !entry[l])
    if (!missing.length || entry.attempts >= MAX_ATTEMPTS) return

    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://armenieinfo.ch',
          'X-Title': 'Armenie Info',
        },
        body: JSON.stringify({
          models: resumeModels(),
          temperature: 0.3,
          reasoning: { enabled: false },
          messages: buildResumeMessages(ev, text),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      // Un essai ne compte que si le modèle a RÉPONDU : une panne passagère
      // (429, 404, délai — routinière sur les modèles :free) ne doit pas priver
      // l'événement de résumé jusqu'à ce qu'il quitte l'agenda.
      entry.attempts++
      const byLang = parseResumeReply(body?.choices?.[0]?.message?.content)
      if (!Object.keys(byLang).length) log.warn(`  ✗ résumé: réponse vide ou illisible — ${ev.url}`)
      const { kept, rejected } = vetResumes(byLang, { title: ev.title, text })
      for (const l of missing) if (kept[l]) {
        entry[l] = kept[l]
        written[l]++
      }
      for (const [l, reason] of rejected) log.warn(`  ✗ résumé/${l}: ${reason} — ${ev.url}`)
    } catch (err) {
      log.warn(`  ✗ résumé: ${err.message} — ${ev.url}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))
  if (overBudget)
    log.warn(`  ✗ résumé: budget de ${Math.round(budgetMs / 1000)} s atteint, ${todo.length - done} événements reportés`)
  log.log(`  ✓ résumé: ${done} événements traités, langues écrites ${JSON.stringify(written)}`)
  return next
}

// Les langues disponibles, recalculées depuis le cache à chaque instantané —
// jamais héritées d'un événement repris par le backfill de l'agenda.
export const withResumeLangs = (events, cache) =>
  events.map((ev) => ({ ...ev, resumeLangs: resumeLangs(cache[ev.url]) }))
