// Classement des FILS FOURRE-TOUT dans les rubriques communes (src/rubrics.js).
//
// Les rubriques d'origine claires passent par la table ; seuls les fils
// `{ mixed }` (« Top Stories », « Actualité »…) sont classés ici, article par
// article, sur leur TITRE, par un modèle gratuit OpenRouter — au plus
// MAX_BATCH / BATCH_SIZE appels par instantané, dans le quota gratuit. Le
// résultat est mis en cache par URL (src/data/rubric-cache.json) : un article
// n'est classé qu'une fois.
//
// LE PIÈGE : tout échec (pas de clé, quota, réponse illisible, délai) envoie
// les articles non classés dans le défaut de leur fil. Le scrape continue et
// le site reste juste en apparence ; le seul signe est « ✗ classify » au log.
import { RUBRICS, RUBRIC_MAP, mixedDefault } from '../../src/rubrics.js'

// Titres par instantané, et par appel. Le lot n'est pas un détail : mesuré le
// 15 octobre 2026, le modèle gratuit dépassait le délai à CHAQUE essai sur 80
// titres (90 s, en CI comme en local) et répondait en 3 s sur 40.
export const MAX_BATCH = 120
export const BATCH_SIZE = 40
export const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free'
export const FALLBACK_MODELS = ['google/gemma-4-31b-it:free']

// La chaîne de modèles qu'OpenRouter essaie dans l'ordre. OPENROUTER_MODEL ou
// un modèle imposé la réduisent à un seul. Partagée avec la brève
// (scripts/lib/brief-generate.mjs) : un changement de modèle vaut pour les deux.
export function modelChain(forced = process.env.OPENROUTER_MODEL) {
  return forced ? [forced] : [DEFAULT_MODEL, ...FALLBACK_MODELS]
}
export const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Chaque étagère de chaque source, quelle que soit la forme du flux : une liste
// plate, ou un objet indexé par langue.
function* shelves(news) {
  for (const [source, feed] of Object.entries(news)) {
    if (source === 'generatedAt' || !feed || typeof feed !== 'object') continue
    const lists = Array.isArray(feed) ? [feed] : Object.values(feed)
    for (const list of lists)
      if (Array.isArray(list))
        for (const shelf of list) yield { source, shelf, key: shelf.categoryKey ?? shelf.sectionKey }
  }
}

// Les articles des fils mixed, avec le défaut de leur fil.
export function mixedArticles(news, map = RUBRIC_MAP) {
  const out = []
  for (const { source, shelf, key } of shelves(news)) {
    const fallback = mixedDefault(source, key, map)
    if (!fallback) continue
    for (const article of shelf.articles || []) if (article?.url) out.push({ article, fallback })
  }
  return out
}

// Les titres à classer : fils mixed, absents du cache, une fois par URL.
export function collectPending(news, cache, map = RUBRIC_MAP, max = MAX_BATCH) {
  const seen = new Set()
  const out = []
  for (const { article } of mixedArticles(news, map)) {
    if (!article.title || article.url in cache || seen.has(article.url)) continue
    seen.add(article.url)
    out.push({ url: article.url, title: article.title })
    if (out.length >= max) break
  }
  return out
}

export function buildMessages(items) {
  const list = items.map((it, i) => `${i + 1}. ${it.title.replace(/\s+/g, ' ').trim()}`).join('\n')
  const system =
    "Tu classes des titres d'actualité arménienne, chacun dans exactement une rubrique parmi : " +
    `${RUBRICS.join(', ')}. ` +
    "armenie = vie intérieure de l'Arménie et de l'Artsakh hors politique ; " +
    'politique = gouvernement, partis, élections, diplomatie ; ' +
    'economie = économie, entreprises, finances, énergie ; ' +
    "monde = actualité internationale sans lien direct avec l'Arménie ; " +
    'societe = société, faits divers, santé, éducation, droits ; ' +
    "diaspora = communautés arméniennes hors d'Arménie ; " +
    'culture = arts, patrimoine, religion, mode ; sports = sport ; ' +
    'opinion = UNIQUEMENT éditoriaux, chroniques et tribunes signés par leur auteur. ' +
    "Une déclaration ou une citation d'un responsable (titre « X : … » ou entre guillemets) est une information, pas une opinion : classe-la selon son sujet (souvent politique). " +
    'Les titres peuvent être en français, anglais, arménien ou russe. ' +
    'Réponds UNIQUEMENT par un objet JSON {"numéro": "rubrique"}, sans aucun texte autour.'
  return [
    { role: 'system', content: system },
    { role: 'user', content: list },
  ]
}

// La réponse du modèle → Map(index base 0 → rubrique). Tolère le texte et les
// clôtures autour du JSON ; ignore toute rubrique inconnue ou tout index hors
// bornes. Ne lève jamais.
export function parseReply(text, count) {
  const out = new Map()
  const m = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!m) return out
  let obj
  try {
    obj = JSON.parse(m[0])
  } catch {
    return out
  }
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    const i = Number(k) - 1
    const r = String(v).trim().toLowerCase()
    if (Number.isInteger(i) && i >= 0 && i < count && RUBRICS.includes(r)) out.set(i, r)
  }
  return out
}

// Écrit `rubric` sur chaque article des fils mixed (cache si valide, défaut du
// fil sinon) et rend le cache purgé des URL sorties du flux. MODIFIE `news`.
export function applyRubrics(news, cache, map = RUBRIC_MAP) {
  const live = new Set()
  for (const { article, fallback } of mixedArticles(news, map)) {
    live.add(article.url)
    article.rubric = RUBRICS.includes(cache[article.url]) ? cache[article.url] : fallback
  }
  return Object.fromEntries(Object.entries(cache).filter(([url]) => live.has(url)))
}

// L'appel réseau : un appel par lot de BATCH_SIZE, chacun avec son délai. Rend
// le cache enrichi de ce que le modèle a classé. NE LÈVE JAMAIS — un lot en
// échec reste à classer au prochain instantané (applyRubrics lui donne le
// défaut de son fil d'ici là), sans emporter les autres lots.
// La clé n'est jamais écrite dans le log.
export async function classifyRubrics(
  news,
  cache,
  {
    apiKey = process.env.OPENROUTER_API_KEY,
    model,
    fetchImpl = fetch,
    timeoutMs = 30000,
    log = console,
  } = {},
) {
  const next = { ...cache }
  const pending = collectPending(news, next)
  if (!pending.length) {
    log.log('  classify: aucun titre nouveau')
    return next
  }
  if (!apiKey) {
    log.warn(`  ✗ classify: OPENROUTER_API_KEY absente — ${pending.length} titres dans leur rubrique par défaut`)
    return next
  }
  // OpenRouter essaie les modèles dans l'ordre ; OPENROUTER_MODEL ou l'option
  // `model` imposent un modèle unique.
  const forced = model || process.env.OPENROUTER_MODEL
  const models = modelChain(forced)
  if (forced && !forced.endsWith(':free'))
    log.warn(`  ⚠ classify: ${forced} n'est pas un modèle :free — consomme des crédits`)
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE)
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
          models,
          temperature: 0,
          reasoning: { enabled: false },
          messages: buildMessages(batch),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const got = parseReply(body?.choices?.[0]?.message?.content, batch.length)
      for (const [i, rubric] of got) next[batch[i].url] = rubric
      const used = body?.model || models[0]
      const count = `classify: ${got.size}/${batch.length} titres classés (${used})`
      if (got.size) log.log(`  ✓ ${count}`)
      else log.warn(`  ✗ ${count} — réponse inexploitable`)
    } catch (err) {
      log.warn(`  ✗ classify: ${err.message} — ${batch.length} titres dans leur rubrique par défaut`)
    }
  }
  return next
}
