// Le texte d'un Short, rangé à côté de son article :
// src/data/culture/<slug>/short.<lang>.json =
//   { facts: [{ eyebrow, title, text, big }] × 7, outroTitle, ytTitle, ytLead,
//     music (fr seul), sourceHash (hors fr : shortHash du short fr), model? }
//
// Module pur : aucun accès disque ni réseau. Le rendu (video/scripts/sync.mjs)
// recompose à partir de ces fichiers les données que lit Remotion.
import { createHash } from 'node:crypto'

export const SHORT_FACTS = 7
// Une phrase lue en six secondes sur un téléphone.
export const SHORT_MAX_TEXT = 130
// Limite d'un titre YouTube, mot-dièse compris.
export const YT_TITLE_MAX = 100
export const TRACK_IDS = ['mazia', 'sergo', 'otar']
// Repris de video/scripts/describe.mjs (title = `${ytTitle} ${HASH[lang]}`).
export const HASHTAG = { fr: '#Arménie', en: '#Armenia', hy: '#Հայաստան', ru: '#Армения', de: '#Armenien', it: '#Armenia', es: '#Armenia' }

const FACT_KEYS = ['eyebrow', 'title', 'text', 'big']
const STRING_FIELDS = ['outroTitle', 'ytTitle', 'ytLead']

// Empreinte du short fr, que chaque traduction recopie dans sourceHash : un
// short fr retouché déclare ses traductions périmées. Champs et clés des faits
// en ordre fixe, pour que l'ordre d'écriture du fichier ne change rien ;
// sourceHash et model en sont exclus (ils ne sont pas le texte).
export function shortHash(shortFr) {
  const s = shortFr ?? {}
  const canon = {
    facts: (Array.isArray(s.facts) ? s.facts : []).map((f) => Object.fromEntries(FACT_KEYS.map((k) => [k, f?.[k]]))),
    outroTitle: s.outroTitle,
    ytTitle: s.ytTitle,
    ytLead: s.ytLead,
    music: s.music,
  }
  return createHash('sha256').update(JSON.stringify(canon)).digest('hex')
}

// Un nombre s'écrit « 4 000 », « 4 000 » (espace fine), « 4,000 », « 4.000 » ou
// « 4'000 » (Suisse) selon la langue : tous valent 4000. Un séparateur n'est
// retiré que devant exactement trois chiffres : le décimal « 4,4 » reste deux nombres.
const normalizeNumbers = (s) => String(s ?? '').replace(/(\d)[ \u00a0\u202f\u2009,.'\u2019](?=\d{3}(?!\d))/g, '$1')
const numbersOf = (s) => normalizeNumbers(s).match(/\d+/g) ?? []

const URL_RE = /https?:\/\/|\bwww\./i

const isText =(v) => typeof v === 'string' && v.trim() !== ''

// Les erreurs d'un short, en clair ; [] = conforme.
export function validateShort(short, { lang, articleText } = {}) {
  if (!short || typeof short !== 'object' || Array.isArray(short)) return ['le short n’est pas un objet JSON']
  const errors = []

  const facts = short.facts
  if (!Array.isArray(facts) || facts.length !== SHORT_FACTS) {
    errors.push(`il faut ${SHORT_FACTS} faits exactement (${Array.isArray(facts) ? facts.length : 'aucun'})`)
  }
  for (const [i, f] of (Array.isArray(facts) ? facts : []).entries()) {
    const n = i + 1
    if (!f || typeof f !== 'object') {
      errors.push(`fait ${n} : pas un objet`)
      continue
    }
    for (const k of ['eyebrow', 'title', 'text']) if (!isText(f[k])) errors.push(`fait ${n} : ${k} manquant`)
    if (typeof f.text === 'string' && f.text.length > SHORT_MAX_TEXT) {
      errors.push(`fait ${n} : text de ${f.text.length} caractères (max ${SHORT_MAX_TEXT})`)
    }
    if (typeof f.big !== 'boolean') errors.push(`fait ${n} : big doit valoir true ou false`)
  }

  for (const k of STRING_FIELDS) if (!isText(short[k])) errors.push(`${k} manquant`)

  const tag = HASHTAG[lang]
  if (!tag) errors.push(`langue inconnue : ${lang}`)
  else if (isText(short.ytTitle)) {
    const len = `${short.ytTitle} ${tag}`.length
    if (len > YT_TITLE_MAX) errors.push(`ytTitle + ${tag} : ${len} caractères (max ${YT_TITLE_MAX})`)
  }

  if (lang === 'fr' && !TRACK_IDS.includes(short.music)) {
    errors.push(`music doit valoir ${TRACK_IDS.join(', ')} (${short.music ?? 'absente'})`)
  }

  // Tout nombre du short doit figurer dans l'article de la même langue.
  const known = new Set(numbersOf(articleText))
  const texts = [
    ...(Array.isArray(facts) ? facts : []).flatMap((f) => (f && typeof f === 'object' ? [f.eyebrow, f.title, f.text] : [])),
    short.ytTitle,
    short.ytLead,
  ]
  const missing = [...new Set(texts.flatMap(numbersOf))].filter((d) => !known.has(d))
  if (missing.length) errors.push(`nombres absents de l’article : ${missing.join(', ')}`)

  // Aucune URL : le prompt l'interdit, le code l'exige (texte publié sur
  // YouTube et à l'écran).
  if ([...texts, short.outroTitle].some((s) => typeof s === 'string' && URL_RE.test(s))) {
    errors.push('URL interdite dans le texte (http://, https:// ou www.)')
  }

  return errors
}

// Le short d'une traduction est-il à (re)faire ? Absent ou illisible (null),
// périmé (sourceHash ≠ `want`, l'empreinte du short fr) ou non conforme à son
// article — le même verdict que culture-check, qui lit le .md brut.
export function shortNeedsTranslation(current, { want, lang, articleText }) {
  if (!current || typeof current !== 'object') return true
  if (current.sourceHash !== want) return true
  return validateShort(current, { lang, articleText }).length > 0
}

// La réponse d'un modèle : JSON nu ou dans un bloc ```json```. null si ce
// n'est pas un objet.
export function parseShortJson(text) {
  const raw = String(text ?? '')
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates = [fenced?.[1], raw, raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)]
  for (const c of candidates) {
    if (!c || !c.trim()) continue
    try {
      const v = JSON.parse(c)
      if (v && typeof v === 'object' && !Array.isArray(v)) return v
    } catch {
      // candidat suivant
    }
  }
  return null
}
