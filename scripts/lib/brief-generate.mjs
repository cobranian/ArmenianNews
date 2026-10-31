// La brève quotidienne : une synthèse des titres du jour qui CROISE les
// sources et renvoie à leurs articles. Une par langue et par jour d'Erevan.
//
// LE MODÈLE NE FOURNIT JAMAIS D'URL. Il reçoit des titres numérotés et répond
// par des numéros ; c'est le code qui en fait des liens, depuis les articles
// envoyés. Un numéro inconnu est ignoré. Ce n'est pas un filtre sur le texte
// (le propriétaire a choisi la publication automatique, sans relecture), c'est
// ce qui empêche un lien inventé de mener à un 404 ou à un site tiers.
//
// Le SEUL filtre de texte est celui de l'alphabet (brief-script.mjs) : un sujet
// qui écrit des mots latins dans une brève arménienne ou russe — ou l'inverse —
// est écarté. Ajouté le 18 octobre 2026, après « successoffice » et
// « wagnelibentley » publiés en arménien.
//
// LE PIÈGE, le même que le classeur : un échec n'écrit rien et ne casse rien.
// Le passage de l'heure suivante réessaie ; le seul signe est « ✗ brief » au
// log, et une journée sans page datée.
import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { RUBRICS } from '../../src/rubrics.js'
import { ALL_LANGS } from '../../sites.config.js'
import { contentLang } from '../../src/newsLangs.js'
import { ENDPOINT, modelChain, STRONG_MODEL } from './classify-rubrics.mjs'
import { RUBRIC_LABELS } from '../../src/rubricLabels.js'
import { selectArticles, yerevanClock, isBriefDue, MIN_ARTICLES } from './brief-select.mjs'
import { allowedWords, strayWords, frenchWords } from './brief-script.mjs'

export const MIN_TOPICS = 3
export const MAX_TOPICS = 7
// Un seul appel par langue et par jour : on peut attendre. Le classeur, lui,
// dépassait déjà 90 s sur 80 titres (15 octobre 2026).
export const BRIEF_TIMEOUT_MS = 180000

// Ultra-550b en tête dans les six langues. hy/ru/de/it d'abord (24 oct. 2026) :
// lightning ratait la brève hy entière (« ոստիկանայինVor ») et perdait des
// sujets en ru et it. fr/en ensuite, sur les brèves du 25 octobre : ultra a
// écrit 7 sujets dans ses quatre langues, quand lightning n'en tenait que 5 en
// anglais, avec une erreur de fait (Naré « va passer en 8e » le jour de sa
// victoire) et un prénom inventé ; en fr, le 22, il faisait d'Araghchi un
// ministre arménien. Le classeur des rubriques, lui, garde lightning en tête.
export function briefModels(lang, forced = process.env.OPENROUTER_MODEL) {
  if (forced) return [forced]
  const chain = modelChain(null)
  return [STRONG_MODEL, ...chain.filter((m) => m !== STRONG_MODEL)]
}

const LANG_NAME = {
  fr: 'français',
  de: 'allemand (usage suisse : « ss », jamais « ß »)',
  it: 'italien',
  en: 'anglais',
  es: 'espagnol latino-américain neutre (ustedes, pas de voseo)',
  hy: 'arménien oriental (orthographe de la République d’Arménie)',
  ru: 'russe',
}

export function buildBriefMessages(lang, articles) {
  const list = articles.map((a) => `${a.id}. [${a.source} · ${a.rubric}] ${a.title}`).join('\n')
  const system =
    "Tu rédiges la brève quotidienne d'un site d'actualité arménienne, à partir des titres du jour " +
    'de plusieurs rédactions (chaque ligne : numéro, [source · rubrique], titre). ' +
    `Écris en ${LANG_NAME[lang]}, dans un style neutre et factuel. ` +
    // de et it lisent le fil français : sans cette phrase, le modèle recopierait
    // des titres français tels quels dans une brève censée être dans l'autre langue.
    (contentLang(lang) !== lang
      ? `Les titres sources sont en français : traduis-les, n'en recopie aucun mot à mot. ` +
        `L'introduction, chaque titre et chaque phrase de ta réponse doivent être entièrement en ${LANG_NAME[lang]} : ` +
        "pas une seule phrase en français, même si les consignes et les titres ci-dessus le sont. "
      : '') +
    `Choisis entre ${MIN_TOPICS + 2} et ${MAX_TOPICS} sujets du jour, en privilégiant ceux que PLUSIEURS sources couvrent. ` +
    'Pour chaque sujet : un titre court, 2 ou 3 phrases, une rubrique parmi ' +
    `${RUBRICS.join(', ')}, et la liste des numéros des titres qui le traitent. ` +
    "N'affirme rien qui ne figure pas dans les titres ; ne cite aucune URL. " +
    'Commence par une introduction d’une ou deux phrases. ' +
    'Réponds UNIQUEMENT par un objet JSON ' +
    '{"intro": "…", "topics": [{"title": "…", "text": "…", "rubric": "…", "ids": [1, 2]}]}, sans aucun texte autour.'
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: contentLang(lang) !== lang ? `${list}

Réponds en ${LANG_NAME[lang]}, pas en français.` : list,
    },
  ]
}

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')
const rubricKey = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Le modèle écrit souvent la rubrique TRADUITE (« Politica », « Wirtschaft ») :
// la brève « de » du 23 octobre 2026 n'avait aucune rubrique sur sept sujets.
const RUBRIC_BY_LABEL = new Map(
  Object.values(RUBRIC_LABELS).flatMap((labels) => Object.entries(labels).map(([k, l]) => [rubricKey(l), k])),
)
const toRubric = (s) => {
  const k = rubricKey(s)
  return RUBRICS.includes(k) ? k : RUBRIC_BY_LABEL.get(k) ?? null
}

// Seule une clé de RUBRICS est retirée : « Calcio: risultati » est un vrai titre.
function splitRubricPrefix(title) {
  const m = title.match(/^([^:]{2,20}?)\s*:\s*(.+)$/u)
  const key = m && rubricKey(m[1])
  if (!key || !RUBRICS.includes(key)) return { title, rubric: null }
  return { title: m[2].charAt(0).toUpperCase() + m[2].slice(1), rubric: key }
}

// La réponse du modèle → { intro, topics }, ou null si elle est inexploitable.
// Tolère le texte et les clôtures autour du JSON. Ne lève jamais.
// Avec `lang`, écarte les sujets dont l'alphabet déraille (brief-script.mjs) et
// vide une introduction fautive ; `rejected` reçoit les mots en cause, pour le log.
export function parseBrief(text, articles, lang = null, rejected = []) {
  const m = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj
  try {
    obj = JSON.parse(m[0])
  } catch {
    return null
  }
  const byId = new Map(articles.map((a) => [a.id, a]))
  // de et it lisent le fil français : leur faute propre est de répondre en français.
  const translated = Boolean(lang) && contentLang(lang) !== lang
  const topics = []
  // Sujets examinés / écartés comme français : voir la règle après la boucle.
  let examined = 0
  let french = 0
  for (const t of Array.isArray(obj?.topics) ? obj.topics : []) {
    // « Economie : … » — le modèle recopie la CLÉ de rubrique (française) en
    // tête de titre, alors que la rubrique s'affiche déjà au-dessus. On la
    // retire, et elle sert de rubrique si le modèle n'en a pas donné.
    const pre = splitRubricPrefix(clean(t?.title))
    const title = pre.title
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
    if (lang) {
      const allowed = allowedWords(sources.map((x) => x.title))
      const bad = strayWords(`${title} ${body}`, lang, allowed)
      examined++
      if (translated) {
        const fr = [...new Set([...frenchWords(title, lang, 1), ...frenchWords(`${title} ${body}`, lang)])]
        if (fr.length) french++
        bad.push(...fr)
      }
      if (bad.length) {
        rejected.push(...bad)
        continue
      }
    }
    topics.push({ title, text: body, rubric: toRubric(t?.rubric) ?? pre.rubric, sources })
    if (topics.length === MAX_TOPICS) break
  }
  if (topics.length < MIN_TOPICS) return null
  // Un modèle qui a écrit en français la moitié de ses sujets ou plus a basculé
  // de langue : ses sujets restants, trop courts pour porter deux indices, ne
  // valent pas mieux (brève « it » du 23 octobre 2026 : « Pashinian fustige la
  // Russie alors que… » passait seul). On écarte la brève entière ; elle est
  // retentée au passage suivant.
  if (translated && french * 2 >= examined) {
    rejected.push('(brève entière : moitié des sujets en français)')
    return null
  }
  let intro = clean(obj?.intro)
  if (lang && intro) {
    const allowed = allowedWords(topics.flatMap((t) => t.sources.map((x) => x.title)))
    const bad = strayWords(intro, lang, allowed)
    if (translated) bad.push(...frenchWords(intro, lang))
    if (bad.length) {
      rejected.push(...bad)
      intro = ''
    }
  }
  return { intro, topics }
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
  langNames = LANG_NAME,
} = {}) {
  const { date, hour } = yerevanClock(now)
  const written = []
  for (const lang of ALL_LANGS) {
    // Une langue sans consigne de rédaction (LANG_NAME) n'est pas encore
    // rédigée : sans ce garde, le modèle recevrait « Écris en undefined », et
    // une brève publiée ne se réécrit jamais. Dit au log, jamais en silence.
    if (!langNames[lang]) {
      log.log(`  · brief/${lang}: pas de consigne`)
      continue
    }
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
      const models = briefModels(lang, model || process.env.OPENROUTER_MODEL)
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
      const rejected = []
      const brief = parseBrief(body?.choices?.[0]?.message?.content, articles, lang, rejected)
      if (rejected.length) log.warn(`  ✗ brief/${lang}: alphabet — écarté : ${[...new Set(rejected)].slice(0, 8).join(', ')}`)
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
