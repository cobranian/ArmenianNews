// Lecture sur disque des articles Culture (src/data/culture/<slug>/). Un
// article invalide est IGNORÉ avec un avertissement — voir culture-validate.
import { readdir, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { ALL_LANGS, CULTURE_SLUG } from '../../sites.config.js'
import { validateArticle, REQUIRED, ABSENT_NOTE } from './culture-validate.mjs'

export async function readArticle(dir, slug) {
  const base = path.join(dir, slug)
  const read = (f) => readFile(path.join(base, f), 'utf-8').catch(() => null)
  const has = (f) => access(path.join(base, f)).then(() => true, () => false)
  let meta = null
  const raw = await read('meta.json')
  if (raw) {
    try {
      meta = JSON.parse(raw)
    } catch {
      meta = null
    }
  }
  const texts = {}
  for (const l of ALL_LANGS) texts[l] = await read(`${l}.md`)
  return { slug, meta, texts, images: { webp: await has('image.webp'), jpg: await has('image.jpg') } }
}

async function dirNames(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
  } catch {
    return []
  }
}

export async function articleSlugs(dir) {
  return (await dirNames(dir)).filter((n) => CULTURE_SLUG.test(n))
}

// Un dossier dont le nom n'est pas un slug (« Komitas/ ») n'est jamais publié :
// sans ce signalement, l'article ne paraîtrait nulle part, sans un mot.
export async function invalidDirs(dir) {
  return (await dirNames(dir)).filter((n) => !CULTURE_SLUG.test(n))
}

export const invalidDirMessage = (name) => `culture/${name} : nom de dossier invalide (ignoré)`

// Les traductions écartées par validateArticle (absentes, périmées, illisibles
// ou porteuses d'un lien inventé) parmi les articles publiés. Le cas typique :
// fr.md retouché directement sur main → empreinte périmée → en/hy/ru
// disparaissent, et leurs URL déjà indexées répondent 404. Le build reste vert
// (spec §3.5) mais doit le dire d'une ligne qu'on ne rate pas. Seules les
// langues REQUIRED comptent : de/it facultatives manquent à presque tous les
// articles antérieurs, et ce compte ne dirait plus rien.
export function unpublishedTranslations(articles) {
  return articles.reduce((n, a) => n + REQUIRED.filter((l) => !a.langs[l]).length, 0)
}

export function unpublishedLine(articles) {
  const n = unpublishedTranslations(articles)
  return n
    ? `⚠ culture : ${n} traduction(s) non publiée(s) (périmées ou absentes) — voir les avertissements ci-dessus`
    : null
}

export async function loadCulture(dir, log = console) {
  const out = []
  for (const name of await invalidDirs(dir)) log.warn(`  ⚠ ${invalidDirMessage(name)}`)
  for (const slug of await articleSlugs(dir)) {
    const raw = await readArticle(dir, slug)
    const { errors, notes, langs } = validateArticle(raw)
    for (const e of errors) log.warn(`  ⚠ culture/${slug} : ${e}`)
    // Une de/it absente est le cas normal (deux lignes par article et par
    // heure) ; une de/it périmée ou invalide quitte une URL déjà en ligne.
    for (const n of notes) if (!n.endsWith(ABSENT_NOTE)) log.warn(`  ⚠ culture/${slug} : ${n}`)
    if (!langs.fr) continue
    out.push({
      slug,
      date: langs.fr.date,
      meta: raw.meta,
      image: raw.meta.image ?? null,
      sources: raw.meta.sources.filter((s) => typeof s?.url === 'string' && s.url.startsWith('https://')),
      langs,
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
}
