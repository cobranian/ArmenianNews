// UNE validation, deux usages (spec §3.5) :
//   - culture-check (PR) : toute erreur fait échouer le contrôle ;
//   - le build : les erreurs sont des avertissements, et seules les langues
//     de `langs` sont publiées. Le déploiement horaire ne casse jamais à cause
//     d'un article.
// Une erreur est BLOQUANTE (langs vide) quand publier serait fautif : pas de
// source à citer, licence d'image refusée, fichiers image absents, français
// illisible. Une traduction absente ou périmée retire seulement sa langue.
// Une NOTE n'est jamais bloquante : elle concerne une langue facultative
// (de, it), que culture-check imprime sans échouer.
import { ALL_LANGS, CULTURE_SLUG } from '../../sites.config.js'
import { parseFrontMatter, bodyHash } from './culture-markdown.mjs'
import { isFreeLicense } from './culture-license.mjs'

// TRANSLATED : toutes les langues que culture-translate produit depuis le
// français. de et it y sont FACULTATIVES (spec 2026-10-23, « Culture de/it ») :
// une langue que personne ne relit ne retient jamais un texte relu. Absentes,
// périmées ou invalides, elles vont dans `notes`, jamais dans `errors` — ni
// culture-check ni la PR fr/en/hy/ru n'en dépendent. REQUIRED garde la règle
// d'avant.
export const OPTIONAL = ['de', 'it', 'es']
export const TRANSLATED = ALL_LANGS.filter((l) => l !== 'fr')
export const REQUIRED = TRANSLATED.filter((l) => !OPTIONAL.includes(l))
// La note d'une langue facultative simplement pas encore traduite : le cas
// normal d'un article antérieur à de/it, que le build ne répète pas au log.
export const ABSENT_NOTE = 'absent (traduction facultative)'

// Les pages Wikipédia de/it (sitelinks du qid) ne servent QU'À leur
// traduction : nom en usage et contrôle de recouvrement. Le brouillon
// français n'en a rien lu — elles ne sont donc citées que sur la page de leur
// langue, et jamais rendues au modèle qui rédige ou révise le français.
const translationOnly = (s) => (s?.kind ?? 'wikipedia') === 'wikipedia' && OPTIONAL.includes(s?.lang)
export const pageSources = (sources, lang) => sources.filter((s) => !translationOnly(s) || s.lang === lang)
export const draftSources = (sources) => sources.filter((s) => !translationOnly(s))
const DATE = /^\d{4}-\d{2}-\d{2}$/
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== ''

function parseLang(text) {
  const { data, body } = parseFrontMatter(text)
  if (!nonEmpty(data.title)) throw new Error('title vide')
  if (!nonEmpty(data.description)) throw new Error('description vide')
  if (data.description.length > 160)
    throw new Error(`description de ${data.description.length} caractères (160 au plus)`)
  if (!DATE.test(data.date ?? '')) throw new Error('date AAAA-MM-JJ attendue')
  if (!body) throw new Error('corps vide')
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    date: data.date,
    body,
    sourceHash: data.sourceHash ?? null,
    model: data.model ?? null,
  }
}

// L'événement d'agenda est rendu tel quel dans la page (lien + date) : il
// n'est retenu que s'il est sain, sinon il est tenu pour ABSENT — jamais une
// exception, puisque le build horaire écrit ces pages (un `date` numérique
// faisait lever `ev.date.slice`), jamais un href non https (`javascript:`).
export function validEvent(ev) {
  if (!ev || typeof ev !== 'object') return null
  if (!nonEmpty(ev.title)) return null
  if (typeof ev.url !== 'string' || !ev.url.startsWith('https://')) return null
  // AAAA-MM-JJ en tête : la page en tire la date longue par `slice(0, 10)`.
  if (typeof ev.date !== 'string' || !DATE.test(ev.date.slice(0, 10))) return null
  if (!Number.isFinite(new Date(ev.date).getTime())) return null
  if (ev.location != null && typeof ev.location !== 'string') return { ...ev, location: null }
  return ev
}

// Les cibles des liens Markdown `](…)` d'un corps.
export function linkTargets(body) {
  return new Set([...String(body ?? '').matchAll(/\]\(([^)\s]*)[^)]*\)/g)].map((m) => m[1]))
}

export function chosenImage(meta) {
  const c = Array.isArray(meta?.candidates) ? meta.candidates : []
  return Number.isInteger(meta?.imageChoice) ? (c[meta.imageChoice] ?? null) : null
}

export function validateArticle({ slug, meta, texts, images }) {
  if (!CULTURE_SLUG.test(slug ?? '')) return { errors: [`slug invalide : ${slug}`], notes: [], langs: {} }
  const fatal = []
  const errors = []
  if (!meta || meta.slug !== slug) fatal.push('meta.json absent, illisible ou de slug incohérent')
  const sources = Array.isArray(meta?.sources)
    ? meta.sources.filter((s) => typeof s?.url === 'string' && s.url.startsWith('https://'))
    : []
  if (!sources.length) fatal.push('meta.json : aucune source https à citer')
  const img = meta?.image ?? null
  if (img) {
    if (!isFreeLicense(img.license)) fatal.push(`licence d'image refusée : ${img.license ?? '(aucune)'}`)
    if (!nonEmpty(img.author) || !nonEmpty(img.commonsUrl)) fatal.push('image sans auteur ou sans lien Commons')
    if (!images?.webp || !images?.jpg) fatal.push('image déclarée mais image.webp / image.jpg absents')
  }
  if ((chosenImage(meta)?.commonsUrl ?? null) !== (img?.commonsUrl ?? null))
    errors.push("image changée (imageChoice) — reposez l'étiquette « traduire »")
  if (meta?.agendaEvent != null && !validEvent(meta.agendaEvent))
    errors.push('meta.json : agendaEvent invalide (ignoré)')

  let fr
  try {
    if (texts?.fr == null) throw new Error('absent')
    fr = parseLang(texts.fr)
  } catch (e) {
    fatal.push(`fr.md : ${e.message}`)
  }
  if (fatal.length) return { errors: [...fatal, ...errors], notes: [], langs: {} }

  const langs = { fr }
  const hash = bodyHash(fr.body)
  const frLinks = linkTargets(fr.body)
  const notes = []
  for (const l of TRANSLATED) {
    const optional = OPTIONAL.includes(l)
    const report = optional ? notes : errors
    if (texts?.[l] == null) {
      report.push(optional ? `${l}.md ${ABSENT_NOTE}` : `${l}.md absent — posez l'étiquette « traduire »`)
      continue
    }
    let t
    try {
      t = parseLang(texts[l])
    } catch (e) {
      report.push(`${l}.md : ${e.message}`)
      continue
    }
    if (t.sourceHash !== hash) {
      report.push(`${l}.md : traduction périmée — reposez l'étiquette « traduire »`)
      continue
    }
    // Une traduction ne publie aucun lien que le français relu ne porte pas :
    // un lien inventé par le modèle n'a été vu par personne.
    if ([...linkTargets(t.body)].some((u) => !frLinks.has(u))) {
      report.push(`${l}.md : liens absents du français relu`)
      continue
    }
    langs[l] = t
  }
  return { errors, notes, langs }
}

// La case « Faits vérifiés » cochée. Seule définition : /corrige la décoche
// avec la même (culture-pr.mjs), pour que décocher et contrôler ne divergent
// jamais. Groupes : 1 = retrait et puce, 2 = libellé.
export const FACTS_CHECKED = /^(\s*[-*] )\[[xX]\]( Faits vérifiés)/m

export function factsChecked(prBody) {
  return FACTS_CHECKED.test(String(prBody ?? ''))
}
