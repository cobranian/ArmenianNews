// La brève quotidienne : une synthèse des titres du jour qui CROISE les
// sources et renvoie à leurs articles. Une par langue et par jour d'Erevan.
//
// LE MODÈLE NE FOURNIT JAMAIS D'URL. Il reçoit des titres numérotés et répond
// par des numéros ; c'est le code qui en fait des liens, depuis les articles
// envoyés. Un numéro inconnu est ignoré. Ce n'est pas un filtre sur le texte
// (le propriétaire a choisi la publication automatique, sans garde-fou), c'est
// ce qui empêche un lien inventé de mener à un 404 ou à un site tiers.
//
// LE PIÈGE, le même que le classeur : un échec n'écrit rien et ne casse rien.
// Le passage de l'heure suivante réessaie ; le seul signe est « ✗ brief » au
// log, et une journée sans page datée.
import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { RUBRICS } from '../../src/rubrics.js'
import { ALL_LANGS } from '../../sites.config.js'
import { ENDPOINT, modelChain } from './classify-rubrics.mjs'
import { selectArticles, yerevanClock, isBriefDue, MIN_ARTICLES } from './brief-select.mjs'

export const MIN_TOPICS = 3
export const MAX_TOPICS = 7
// Un seul appel par langue et par jour : on peut attendre. Le classeur, lui,
// dépassait déjà 90 s sur 80 titres (15 octobre 2026).
export const BRIEF_TIMEOUT_MS = 180000

const LANG_NAME = {
  fr: 'français',
  en: 'anglais',
  hy: 'arménien oriental (orthographe de la République d’Arménie)',
  ru: 'russe',
}

export function buildBriefMessages(lang, articles) {
  const list = articles.map((a) => `${a.id}. [${a.source} · ${a.rubric}] ${a.title}`).join('\n')
  const system =
    "Tu rédiges la brève quotidienne d'un site d'actualité arménienne, à partir des titres du jour " +
    'de plusieurs rédactions (chaque ligne : numéro, [source · rubrique], titre). ' +
    `Écris en ${LANG_NAME[lang]}, dans un style neutre et factuel. ` +
    `Choisis entre ${MIN_TOPICS + 2} et ${MAX_TOPICS} sujets du jour, en privilégiant ceux que PLUSIEURS sources couvrent. ` +
    'Pour chaque sujet : un titre court, 2 ou 3 phrases, une rubrique parmi ' +
    `${RUBRICS.join(', ')}, et la liste des numéros des titres qui le traitent. ` +
    "N'affirme rien qui ne figure pas dans les titres ; ne cite aucune URL. " +
    'Commence par une introduction d’une ou deux phrases. ' +
    'Réponds UNIQUEMENT par un objet JSON ' +
    '{"intro": "…", "topics": [{"title": "…", "text": "…", "rubric": "…", "ids": [1, 2]}]}, sans aucun texte autour.'
  return [
    { role: 'system', content: system },
    { role: 'user', content: list },
  ]
}

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

// La réponse du modèle → { intro, topics }, ou null si elle est inexploitable.
// Tolère le texte et les clôtures autour du JSON. Ne lève jamais.
export function parseBrief(text, articles) {
  const m = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj
  try {
    obj = JSON.parse(m[0])
  } catch {
    return null
  }
  const byId = new Map(articles.map((a) => [a.id, a]))
  const topics = []
  for (const t of Array.isArray(obj?.topics) ? obj.topics : []) {
    const title = clean(t?.title)
    const body = clean(t?.text)
    if (!title || !body) continue
    const seen = new Set()
    const sources = []
    for (const raw of Array.isArray(t?.ids) ? t.ids : []) {
      const a = byId.get(Number(raw))
      if (!a || seen.has(a.url)) continue
      seen.add(a.url)
      sources.push({ source: a.source, url: a.url, title: a.title })
    }
    if (!sources.length) continue
    const r = clean(t?.rubric).toLowerCase()
    topics.push({ title, text: body, rubric: RUBRICS.includes(r) ? r : null, sources })
    if (topics.length === MAX_TOPICS) break
  }
  if (topics.length < MIN_TOPICS) return null
  return { intro: clean(obj?.intro), topics }
}

const exists = (p) => access(p).then(() => true, () => false)

// Une brève par langue due. NE LÈVE JAMAIS — chaque langue échoue seule.
// `force` ignore l'heure (CLI `npm run brief -- --force`), jamais l'existence
// du fichier : une brève publiée ne se réécrit pas.
// La clé n'est jamais écrite dans le log.
export async function generateBriefs({
  news,
  now = new Date(),
  dir,
  apiKey = process.env.OPENROUTER_API_KEY,
  model,
  fetchImpl = fetch,
  timeoutMs = BRIEF_TIMEOUT_MS,
  log = console,
  force = false,
} = {}) {
  const { date, hour } = yerevanClock(now)
  const written = []
  for (const lang of ALL_LANGS) {
    const file = path.join(dir, lang, `${date}.json`)
    try {
      const has = await exists(file)
      if (has) continue
      if (!force && !isBriefDue(now, has)) {
        log.log(`  · brief/${lang}: ${hour} h à Erevan, attend ${date} 7 h`)
        continue
      }
      const articles = selectArticles(news, lang, now)
      if (articles.length < MIN_ARTICLES) {
        log.log(`  · brief/${lang}: trop peu d'articles (${articles.length})`)
        continue
      }
      if (!apiKey) {
        log.warn(`  ✗ brief/${lang}: OPENROUTER_API_KEY absente`)
        continue
      }
      const models = modelChain(model || process.env.OPENROUTER_MODEL)
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
          temperature: 0.3,
          reasoning: { enabled: false },
          messages: buildBriefMessages(lang, articles),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const brief = parseBrief(body?.choices?.[0]?.message?.content, articles)
      if (!brief) {
        log.warn(`  ✗ brief/${lang}: réponse invalide`)
        continue
      }
      const used = body?.model || models[0]
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(
        file,
        JSON.stringify({ date, lang, generatedAt: now.toISOString(), model: used, ...brief }, null, 2) + '\n',
        'utf-8',
      )
      written.push(lang)
      log.log(`  ✓ brief/${lang}: ${brief.topics.length} sujets sur ${articles.length} titres (${used})`)
    } catch (err) {
      log.warn(`  ✗ brief/${lang}: ${err.message}`)
    }
  }
  return written
}
