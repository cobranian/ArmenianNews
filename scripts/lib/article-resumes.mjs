// Résumés des articles du fil : 3 ou 4 phrases écrites par un modèle :free
// OpenRouter, dans la langue de l'article (et en de/it pour le fil français), à
// partir du texte de la page source. Même mécanique que agenda-resumes.mjs.
//
// L'archive est un objet indexé par URL. Elle ne garde JAMAIS le texte de
// l'article : seulement le résumé et des métadonnées publiques.
//
// Ce module est PUR jusqu'à `summarizeArticles`, qui seule touche le réseau —
// par des fonctions injectées, pour que les tests n'en touchent aucun.
import { strayWords, allowedWords, frenchWords } from './brief-script.mjs'
import { ENDPOINT } from './classify-rubrics.mjs'
import { LANG_NAMES, parseResumeReply, sourceHash, resumeModels } from './agenda-resumes.mjs'
import { extractArticleText, fetchArticle } from './article-text.mjs'
import { TAB_ORDER, feedFor, SOURCE_NAMES } from '../../src/newsLangs.js'
import { rubricOf } from '../../src/rubrics.js'

export const ARCHIVE_DAYS = 30
export const WINDOW_DAYS = 7
export const MAX_PER_SNAPSHOT = 20
export const CONCURRENCY = 3
export const BUDGET_MS = 150000
export const MAX_ATTEMPTS = 3
export const MIN_LEN = 200
export const MAX_LEN = 800

const CONTENT_LANGS = ['fr', 'en', 'hy', 'ru', 'es']
const DAY = 86400000

// Tous les articles de news.json, une entrée par URL, en parcourant les sources
// de chaque langue de contenu dans l'ordre de TAB_ORDER. La rubrique est celle
// de l'interface (rubricOf) : table fixe, ou `article.rubric` pour un fil mixed.
export function listArticles(news) {
  const seen = new Set()
  const out = []
  for (const lang of CONTENT_LANGS) {
    for (const source of TAB_ORDER[lang] || []) {
      for (const shelf of feedFor(news, source, lang)) {
        const key = shelf.categoryKey ?? shelf.sectionKey
        for (const a of shelf.articles || []) {
          if (!a?.url || !a.title || seen.has(a.url)) continue
          seen.add(a.url)
          out.push({
            url: a.url,
            lang,
            source,
            title: a.title,
            image: a.image ?? null,
            rubric: rubricOf(source, key, a),
            date: a.date ?? null,
          })
        }
      }
    }
  }
  return out
}

// Un article français est résumé aussi en allemand et en italien (CONTENT_LANG).
export const summaryLangs = (lang) => (lang === 'fr' ? ['fr', 'de', 'it'] : [lang])

const missingLangs = (entry, lang) => summaryLangs(lang).filter((l) => !entry?.resumes?.[l])

// Les articles à (re)traiter : jamais vus, ou incomplets avec moins de
// MAX_ATTEMPTS essais. Les plus vieux que WINDOW_DAYS sont exclus ; les plus
// récents d'abord, les non datés en tête.
export function pendingArticles(articles, archive, now, max = MAX_PER_SNAPSHOT) {
  const limit = now.getTime() - WINDOW_DAYS * DAY
  const seen = new Set()
  const todo = []
  for (const a of articles) {
    if (!a?.url || seen.has(a.url)) continue
    seen.add(a.url)
    const t = a.date ? Date.parse(a.date) : NaN
    if (Number.isFinite(t) && t < limit) continue
    const e = archive[a.url]
    if (e && !missingLangs(e, a.lang).length) continue
    if (e && (e.attempts ?? 0) >= MAX_ATTEMPTS) continue
    todo.push({ a, t: Number.isFinite(t) ? t : Infinity })
  }
  todo.sort((x, y) => y.t - x.t)
  return todo.slice(0, max).map((x) => x.a)
}

export function buildArticleMessages(article, text, langs) {
  const keys = langs.map((l) => `"${l}": <${LANG_NAMES[l]}>`).join(', ')
  return [
    {
      role: 'system',
      content:
        'You summarise news articles for an Armenian news site. ' +
        'Write 3 or 4 sentences (about 300 to 600 characters) per language stating only facts present in the article: who, what, where, when. ' +
        'No opinion, no speculation, nothing not in the text. ' +
        'Keep proper names exactly as written. ' +
        'Write each language natively, never mixing scripts. ' +
        `Reply with ONE JSON object and nothing else: {${keys}}.`,
    },
    {
      role: 'user',
      content: `Title: ${article.title}\nSource: ${SOURCE_NAMES[article.source] ?? article.source}\n\nArticle:\n${text}`,
    },
  ]
}

// Chaque langue est vérifiée seule : une langue fautive est écartée, les autres
// restent. Les mots du titre et du texte sont permis dans une autre écriture.
export function vetArticleResumes(byLang, { title = '', text = '' } = {}) {
  const allowed = allowedWords([title, text])
  const kept = {}
  const rejected = []
  for (const [lang, s] of Object.entries(byLang)) {
    let reason = null
    if (s.length < MIN_LEN || s.length > MAX_LEN) reason = 'longueur'
    else if (strayWords(s, lang, allowed).length || frenchWords(s, lang).length) reason = 'alphabet'
    if (reason) rejected.push([lang, reason])
    else kept[lang] = s
  }
  return { kept, rejected }
}

// L'étape du scrape. NE LÈVE JAMAIS : une page ou un modèle en échec laisse
// l'article sans résumé (ligne `✗ résumé-article` au log). Renvoie l'archive
// mise à jour — l'élagage est l'affaire de l'appelant. La clé n'est jamais
// loguée.
export async function summarizeArticles({
  articles,
  archive,
  apiKey = process.env.OPENROUTER_API_KEY,
  fetchPage = fetchArticle,
  fetchImpl = fetch,
  now = new Date(),
  budgetMs = BUDGET_MS,
  max = MAX_PER_SNAPSHOT,
  timeoutMs = 30000,
  concurrency = CONCURRENCY,
  log = console,
}) {
  const next = { ...(archive || {}) }
  try {
    const todo = pendingArticles(articles || [], next, now, max)
    if (!todo.length) {
      log.log('  résumé-article: aucun article à résumer')
      return next
    }
    if (!apiKey) {
      log.warn(`  ✗ résumé-article: OPENROUTER_API_KEY absente — ${todo.length} articles sans résumé`)
      return next
    }
    const start = Date.now()
    const written = {}
    let done = 0
    let idx = 0
    let overBudget = false
    let quotaHit = false

    const worker = async () => {
      while (idx < todo.length && !quotaHit) {
        if (Date.now() - start >= budgetMs) {
          overBudget = true
          return
        }
        const a = todo[idx++]
        done++
        await summarizeOne(a)
      }
    }

    const summarizeOne = async (a) => {
      const entry = { attempts: 0, resumes: {}, ...next[a.url] }
      // Métadonnées rafraîchies à chaque passage (le titre ou l'image peuvent changer).
      Object.assign(entry, {
        url: a.url, lang: a.lang, source: a.source, title: a.title, image: a.image, rubric: a.rubric, date: a.date,
      })
      entry.resumes = { ...entry.resumes }
      next[a.url] = entry
      entry.checkedAt = now.toISOString()

      let text = null
      let why = 'texte introuvable'
      try {
        text = extractArticleText(await fetchPage(a.url))
      } catch (err) {
        why = err.message
      }
      if (!text) {
        entry.attempts++
        log.warn(`  ✗ résumé-article: ${a.url} — ${why}`)
        return
      }

      // Texte nouveau ou modifié : les essais repartent de zéro, et un texte
      // modifié efface les résumés.
      const hash = sourceHash(text)
      if (entry.hash !== hash) {
        if (entry.hash) entry.resumes = {}
        entry.attempts = 0
      }
      entry.hash = hash
      const missing = missingLangs(entry, a.lang)
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
            messages: buildArticleMessages(a, text, missing),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        // Quota épuisé : inutile d'insister, et ce n'est pas un essai de l'article.
        if (res.status === 429) {
          if (!quotaHit) log.warn('  ✗ résumé-article: quota (429)')
          quotaHit = true
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        // Un essai ne compte que si le modèle a RÉPONDU.
        entry.attempts++
        const byLang = parseResumeReply(body?.choices?.[0]?.message?.content)
        if (!Object.keys(byLang).length) log.warn(`  ✗ résumé-article: réponse vide ou illisible — ${a.url}`)
        const { kept, rejected } = vetArticleResumes(byLang, { title: a.title, text })
        for (const l of missing)
          if (kept[l]) {
            entry.resumes[l] = kept[l]
            written[l] = (written[l] || 0) + 1
          }
        for (const [l, reason] of rejected) log.warn(`  ✗ résumé-article/${l}: ${reason} — ${a.url}`)
      } catch (err) {
        log.warn(`  ✗ résumé-article: ${err.message} — ${a.url}`)
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker))
    if (overBudget)
      log.warn(`  ✗ résumé-article: budget de ${Math.round(budgetMs / 1000)} s atteint, ${todo.length - done} articles reportés`)
    log.log(`  ✓ résumé-article: ${done} articles traités, langues écrites ${JSON.stringify(written)}`)
  } catch (err) {
    log.warn(`  ✗ résumé-article: ${err.message}`)
  }
  return next
}
