//
// Les messages envoyés au modèle et l'analyse de ses réponses. Le modèle ne
// fournit AUCUNE URL publiée : sources, liens et événement sont ajoutés par
// le code (leçon de la brève). Ses réponses sont des JSON qu'on extrait d'un
// texte éventuellement enrobé (clôtures ```json, phrase d'introduction).
export const MAX_EXTRACT = 24000

const LANG_NAME = {
  fr: 'français',
  en: 'anglais',
  hy: 'arménien oriental (orthographe de la République d’Arménie)',
  ru: 'russe',
}

const JSON_SHAPE = 'Réponds UNIQUEMENT par un objet JSON {"title": "…", "description": "… (160 caractères au plus)", "body": "… (Markdown)"}, sans aucun texte autour.'

export function buildDraftMessages({ topic, sources, facts = [], event = null }) {
  const system = [
    "Tu écris un article de fond pour la section Culture d'un site d'information arménien francophone.",
    'Règles absolues :',
    '- Utilise UNIQUEMENT les faits présents dans les SOURCES et FAITS ci-dessous. Une information absente des sources ne doit pas être écrite.',
    '- Construis ton propre plan et ton propre angle : ne suis pas l’ordre des sources et ne recopie aucune phrase.',
    '- 700 à 1000 mots, en français, avec 3 à 5 intertitres « ## ». Gras et italique permis avec parcimonie.',
    '- Ton chaleureux et fier de la culture arménienne, mais aucun superlatif que les sources ne justifient.',
    '- Génocide, Artsakh, conflits : les faits sourcés, sans commentaire ni adjectif.',
    '- Aucun lien, aucune URL dans le texte.',
    event ? '- Termine par un paragraphe qui invite à l’événement à venir indiqué.' : '',
    JSON_SHAPE,
  ]
    .filter(Boolean)
    .join('\n')
  const user = [
    `SUJET : ${topic.title}`,
    event
      ? `ÉVÉNEMENT À VENIR : « ${event.title} », le ${String(event.date).slice(0, 10)}${event.location ? `, ${event.location}` : ''}.`
      : '',
    facts.length ? `FAITS WIKIDATA :\n${facts.map((f) => `- ${f}`).join('\n')}` : '',
    ...sources.map(
      (s, i) => `SOURCE ${i + 1} — Wikipédia (${s.lang}) « ${s.title} » :\n${String(s.extract).slice(0, MAX_EXTRACT)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function buildClaimsMessages(body) {
  return [
    {
      role: 'system',
      content:
        "Liste toutes les dates, tous les nombres et tous les noms propres (personnes, lieux, œuvres, institutions) présents dans le texte, tels qu'ils y sont écrits. Réponds UNIQUEMENT par un tableau JSON de chaînes.",
    },
    { role: 'user', content: body },
  ]
}

export function buildTranslateMessages({ lang, title, description, body }) {
  return [
    {
      role: 'system',
      content: [
        `Tu traduis un article du français vers le ${LANG_NAME[lang]}.`,
        "Traduis fidèlement : n'ajoute, ne retire et ne commente rien.",
        'Garde la structure Markdown à l’identique (intertitres « ## », gras, italique, liens).',
        'Noms propres : la graphie établie dans la langue cible.',
        JSON_SHAPE,
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify({ title, description, body }) },
  ]
}

export function buildIdeasMessages(existingTitles) {
  return [
    {
      role: 'system',
      content:
        "Propose 10 sujets d'articles sur l'histoire, la culture, la danse, la musique, l'architecture ou la gastronomie arméniennes, chacun couvert par un article Wikipédia existant. Réponds UNIQUEMENT par un tableau JSON d'objets {\"title\": \"…\", \"wikipedia_fr\": \"titre exact de l'article Wikipédia français\", \"wikipedia_en\": \"titre exact de l'article Wikipédia anglais\", \"keywords\": [\"…\"]}.",
    },
    { role: 'user', content: `Sujets déjà traités ou prévus, à exclure :\n${existingTitles.map((t) => `- ${t}`).join('\n')}` },
  ]
}

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

function clip(s, max) {
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,.;:]+$/, '')}…`
}

function extract(text, open, close) {
  const s = String(text ?? '')
  const a = s.indexOf(open)
  const b = s.lastIndexOf(close)
  if (a < 0 || b <= a) return null
  try {
    return JSON.parse(s.slice(a, b + 1))
  } catch {
    return null
  }
}

export function parseArticleJson(text) {
  const o = extract(text, '{', '}')
  const title = clean(o?.title)
  const description = clean(o?.description)
  const body = typeof o?.body === 'string' ? o.body.replace(/\r\n/g, '\n').trim() : ''
  if (!title || !description || !body) return null
  return { title, description: clip(description, 160), body }
}

export function parseClaims(text) {
  const a = extract(text, '[', ']')
  // null = réponse illisible (distinct de [] = « aucun fait à vérifier »).
  if (!Array.isArray(a)) return null
  return [...new Set(a.filter((x) => typeof x === 'string').map(clean).filter((x) => x && x.length <= 80))].slice(0, 150)
}

export function parseIdeas(text) {
  const a = extract(text, '[', ']')
  if (!Array.isArray(a)) return []
  return a
    .filter((x) => clean(x?.title))
    .map((x) => ({
      title: clean(x.title),
      wikipedia_fr: clean(x.wikipedia_fr),
      wikipedia_en: clean(x.wikipedia_en),
      keywords: Array.isArray(x.keywords) ? x.keywords.map(clean).filter(Boolean) : [],
    }))
}

// Plié, et typographie unifiée des deux côtés : Wikipédia écrit « 1 200 »
// avec une espace fine insécable (U+202F) et « 1869–1935 » avec un demi-
// cadratin ; le modèle, avec une espace et un trait d'union ordinaires.
const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/gu, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Mot ou expression entière : « Ani » ne doit pas être validé par « Aniv »
// ni « partie », ni « Ere » par « Erevan ».
const wholeWord = (s) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(s)}(?=$|[^\\p{L}\\p{N}])`, 'u')

// Les éléments factuels du brouillon introuvables dans les sources : la liste
// ⚠️ en tête de PR. Un nombre doit apparaître EXACTEMENT (1869 ne valide pas
// 186) ; un nom, par chacun de ses mots de 3 lettres ou plus (plié), en mot
// entier ; une expression à plusieurs nombres (« 1 200 ») doit apparaître
// telle quelle. Un nombre accompagné de mots (« Paris 1935 ») exige le nombre
// ET chacun des mots : 1935 seul ne valide pas Paris.
export function findUnsupported(claims, sourceTexts) {
  const hay = fold(sourceTexts.join('\n'))
  return claims.filter((c) => {
    const f = fold(c).trim().replace(/[.,;:!?]+$/, '').trim()
    if (!f) return false
    if (wholeWord(f).test(hay)) return false
    const groups = f.match(/\d+/g) ?? []
    if (groups.length > 1) return true
    const words = f.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !/\d/.test(w))
    const wordsOk = words.every((w) => wholeWord(w).test(hay))
    if (groups.length === 1) return !new RegExp(`(^|\\D)${groups[0]}(\\D|$)`).test(hay) || !wordsOk
    return words.length > 0 && !wordsOk
  })
}

// L'événement de l'agenda est une source à part entière : le brouillon a le
// droit d'en citer le titre, le lieu et la date. Sans ces textes dans la botte
// de foin, « Saint-Chamond » ou « 18 octobre 2026 » sortaient en ⚠️ à chaque
// article lié à l'agenda — de fausses alertes qui noient les vraies.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export function eventFacts(event) {
  if (!event) return []
  const out = [event.title, event.location].filter((s) => typeof s === 'string' && s)
  const m = String(event.date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) out.push(`${Number(m[3])} ${MOIS[Number(m[2]) - 1]} ${m[1]}`, `${Number(m[3])} ${MOIS[Number(m[2]) - 1]}`)
  return out
}
