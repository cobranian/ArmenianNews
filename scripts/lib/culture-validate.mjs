// UNE validation, deux usages (spec §3.5) :
//   - culture-check (PR) : toute erreur fait échouer le contrôle ;
//   - le build : les erreurs sont des avertissements, et seules les langues
//     de `langs` sont publiées. Le déploiement horaire ne casse jamais à cause
//     d'un article.
// Une erreur est BLOQUANTE (langs vide) quand publier serait fautif : pas de
// source à citer, licence d'image refusée, fichiers image absents, français
// illisible. Une traduction absente ou périmée retire seulement sa langue.
import { ALL_LANGS, CULTURE_SLUG } from '../../sites.config.js'
import { parseFrontMatter, bodyHash } from './culture-markdown.mjs'
import { isFreeLicense } from './culture-license.mjs'

export const TRANSLATED = ALL_LANGS.filter((l) => l !== 'fr')
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

export function chosenImage(meta) {
  const c = Array.isArray(meta?.candidates) ? meta.candidates : []
  return Number.isInteger(meta?.imageChoice) ? (c[meta.imageChoice] ?? null) : null
}

export function validateArticle({ slug, meta, texts, images }) {
  if (!CULTURE_SLUG.test(slug ?? '')) return { errors: [`slug invalide : ${slug}`], langs: {} }
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

  let fr
  try {
    if (texts?.fr == null) throw new Error('absent')
    fr = parseLang(texts.fr)
  } catch (e) {
    fatal.push(`fr.md : ${e.message}`)
  }
  if (fatal.length) return { errors: [...fatal, ...errors], langs: {} }

  const langs = { fr }
  const hash = bodyHash(fr.body)
  for (const l of TRANSLATED) {
    if (texts?.[l] == null) {
      errors.push(`${l}.md absent — posez l'étiquette « traduire »`)
      continue
    }
    let t
    try {
      t = parseLang(texts[l])
    } catch (e) {
      errors.push(`${l}.md : ${e.message}`)
      continue
    }
    if (t.sourceHash !== hash) {
      errors.push(`${l}.md : traduction périmée — reposez l'étiquette « traduire »`)
      continue
    }
    langs[l] = t
  }
  return { errors, langs }
}

export function factsChecked(prBody) {
  return /^\s*[-*] \[[xX]\] Faits vérifiés/m.test(String(prBody ?? ''))
}
