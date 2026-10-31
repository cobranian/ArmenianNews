// La santé de l'instantané, lue APRÈS le scrape : ce que le backfill cache.
//
// Une source qui tombe ne vide rien : `backfillSections` ressert le dernier
// instantané, indéfiniment. Armenpress est resté figé treize jours (septembre
// 2026), le Courrier onze, tous les runs « success » — il a fallu un lecteur.
// Ce module regarde donc le RÉSULTAT, pas les erreurs : l'âge de l'article le
// plus récent de chaque source × langue, la brève du jour, l'agenda. Le job
// horaire en fait une issue GitHub (voir hourly.yml).
//
// Fonctions pures, horloge injectée : testées sans réseau (test/health.test.mjs).
import { ALL_LANGS } from '../../sites.config.js'
import { evenementsAVenir } from '../../src/agendaEvents.js'
import { yerevanClock } from './brief-select.mjs'
import { mixedArticles } from './classify-rubrics.mjs'
import { RUBRIC_MAP } from '../../src/rubrics.js'

// Silence toléré, en heures, avant qu'une source soit dite figée. Mesuré sur
// trois semaines d'instantanés (4–24 octobre 2026) : chaque seuil vaut à peu
// près 1,5 à 2 fois le plus long silence NORMAL observé, pour qu'un week-end
// calme ne déclenche rien et qu'un gel de plusieurs jours, si. Clé
// `source/langue`, ou `source` pour toutes ses langues ; `null` = jamais.
export const DEFAULT_STALE_HOURS = 96
export const STALE_HOURS = {
  // Agences : publient chaque heure (silence max mesuré : Armenpress fr 53 h, NEWS.am 25 h).
  armenpress: 72,
  'armenpress/es': 96, // aucune publication le week-end (mesuré le 31 octobre 2026)
  newsam: 48,
  // Publie par numéros : sept articles le 21 octobre 2026, rien depuis le 14 juillet.
  artzakank: null,
  armenianweekly: 120, // silence max mesuré 63 h
  asbarez: 168, // 92 h
  oragark: 240, // 131 h
  soyarmenio: 48, // ~12 articles par jour, plus long silence 23 h (mesuré le 31 octobre 2026)
  // ~3 articles par jour hors Agenda (97 en octobre dont 36 d'Agenda) : un creux de
  // week-end dépasse 48 h ; 72 h laisse une marge sans cacher un vrai gel.
  diarioarmenia: 72,
  'civilnet/fr': 288, // 168 h
  'civilnet/ru': 168, // 96 h
  californiacourier: 504, // hebdomadaire : 347 h
  'californiacourier/en': 336, // 207 h
}

export function staleHours(source, lang) {
  for (const k of [`${source}/${lang}`, source]) if (k in STALE_HOURS) return STALE_HOURS[k]
  return DEFAULT_STALE_HOURS
}

const collect = (x, out = []) => {
  if (Array.isArray(x)) x.forEach((y) => collect(y, out))
  else if (x && typeof x === 'object') {
    if (x.title && x.url) out.push(x)
    else Object.values(x).forEach((y) => collect(y, out))
  }
  return out
}

const age = (h) => (h >= 48 ? `${Math.floor(h / 24)} j` : `${Math.round(h)} h`)

// Une source est soit une liste d'étagères (une seule langue, notée « - »),
// soit un objet { langue: étagères }.
export function checkNews(news, now = new Date()) {
  const problems = []
  for (const [source, v] of Object.entries(news ?? {})) {
    if (source === 'generatedAt') continue
    const groups = Array.isArray(v) ? { '-': v } : v ?? {}
    for (const [lang, g] of Object.entries(groups)) {
      const limit = staleHours(source, lang)
      if (limit === null) continue
      const name = lang === '-' ? source : `${source}/${lang}`
      const ts = collect(g).map((a) => Date.parse(a.date)).filter(Number.isFinite)
      if (!ts.length) {
        problems.push(`**${name}** : aucun article daté`)
        continue
      }
      const h = (now.getTime() - Math.max(...ts)) / 3600e3
      if (h > limit) problems.push(`**${name}** : article le plus récent il y a ${age(h)} (seuil ${age(limit)})`)
    }
  }
  return problems
}

// La brève paraît dès 7 h à Erevan et se retente chaque heure : à midi sans
// fichier, cinq essais ont échoué.
export const BRIEF_ALERT_HOUR = 12

// `dates` : { langue: ['AAAA-MM-JJ', …] } — les fichiers présents.
export function checkBriefs(dates, now = new Date()) {
  const { date, hour } = yerevanClock(now)
  if (hour < BRIEF_ALERT_HOUR) return []
  return ALL_LANGS.filter((l) => !(dates?.[l] ?? []).includes(date)).map(
    (l) => `**brève/${l}** : pas de brève le ${date} (${hour} h à Erevan)`,
  )
}

export function checkAgenda(agenda, now = new Date()) {
  const all = [...(agenda?.switzerland ?? []), ...(agenda?.world ?? [])]
  return evenementsAVenir(all, now.getTime(), 0).length ? [] : ['**agenda** : aucun événement à venir']
}

// Le classeur en panne (clé, quota, modèles retirés) range chaque article des
// fils fourre-tout dans le défaut de son fil, sans erreur : ces articles
// restent hors de rubric-cache.json. Mesuré du 16 au 24 octobre 2026 : 0 à 11
// non classés sur 291 en temps normal (les nouveaux de l'heure), 171 le jour
// de la panne du 15.
export const MAX_UNCLASSIFIED = 40

export function checkClassify(news, cache, map = RUBRIC_MAP) {
  const all = mixedArticles(news ?? {}, map)
  const n = all.filter(({ article }) => !(article.url in (cache ?? {}))).length
  return n > MAX_UNCLASSIFIED
    ? [`**classement des rubriques** : ${n} articles sur ${all.length} non classés (« ✗ classify » au log)`]
    : []
}

// Les étapes du job en continue-on-error, par leur VRAI résultat
// (steps.<id>.outcome — l'API rend « success » pour une étape tolérée en échec).
const STEP_LABELS = {
  screenshot: '**capture Don Narek** : l’étape a échoué, les PNG de armenie-info.web.app ne sont plus rafraîchis',
}
export function checkSteps(outcomes = {}) {
  return Object.entries(STEP_LABELS).filter(([id]) => outcomes[id] === 'failure').map(([, label]) => label)
}

// Le site ne fait que remélanger le pool : seule une récolte locale
// (« npm run ig-scrape », Chrome connecté, ~30-40 min) apporte des posts
// neufs. Au-delà de trois semaines, un rappel. Sans date de récolte, silence.
export const MAX_HARVEST_DAYS = 21

export function checkHarvest(pool, now = new Date()) {
  const t = Date.parse(pool?.harvestedAt)
  if (!Number.isFinite(t)) return []
  const days = Math.floor((now.getTime() - t) / 864e5)
  return days > MAX_HARVEST_DAYS
    ? [`**mur Instagram** : dernière récolte il y a ${days} j — lancer « npm run ig-scrape » sur le poste (le site ne fait que remélanger les mêmes posts)`]
    : []
}

export function healthReport({ problems }) {
  const ok = problems.length === 0
  const markdown = ok ? 'Tout est frais.' : problems.map((p) => `- ${p}`).join('\n')
  return { ok, markdown }
}
