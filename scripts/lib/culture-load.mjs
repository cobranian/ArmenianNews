// Lecture sur disque des articles Culture (src/data/culture/<slug>/). Un
// article invalide est IGNORÉ avec un avertissement — voir culture-validate.
import { readdir, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { ALL_LANGS, CULTURE_SLUG } from '../../sites.config.js'
import { validateArticle } from './culture-validate.mjs'

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

export async function articleSlugs(dir) {
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && CULTURE_SLUG.test(e.name))
    .map((e) => e.name)
    .sort()
}

export async function loadCulture(dir, log = console) {
  const out = []
  for (const slug of await articleSlugs(dir)) {
    const raw = await readArticle(dir, slug)
    const { errors, langs } = validateArticle(raw)
    for (const e of errors) log.warn(`  ⚠ culture/${slug} : ${e}`)
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
