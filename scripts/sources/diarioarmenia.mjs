import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Diario Armenia (diarioarmenia.org.ar) — le quotidien de la communauté arménienne
// d'Argentine. WordPress sans Cloudflare (mesuré le 31 octobre 2026 : ~3 articles
// par jour, 97 en octobre dont 36 de la catégorie Agenda).
//
// PIÈGE MUET : anti-hotlink. Avec un Referer étranger (armenianews.org), l'URL
// d'une image répond 200 avec une vignette PNG 200×200 ; sans Referer, la vraie
// photo. Aucune erreur, juste des cartes à vignette grise. Les images sont donc
// recopiées dans public/da/ par scrape.mjs (comme public/cc/), jamais liées.
//
// Source mono-langue : liste plate d'étagères dans news.json, hors BY_LANG.
// Même approche que soyarmenio : `_fields` + un appel `media?include=…`, pas de `_embed`.
export const BASE = 'https://www.diarioarmenia.org.ar/wp-json/wp/v2'

// La catégorie Agenda (événements de la communauté argentine) n'est JAMAIS une
// étagère du fil : la tâche agenda la lit à part.
export const AGENDA_SLUG = 'agenda'

// Étagères éditoriales (slugs réels). Mesuré le 31 octobre 2026 (articles
// d'octobre, hors Agenda) : armenia 20, azerbaiyan 11, argentina 7, cultura 3,
// opinion 3 (dernier le 16), institucionales 2, artsaj 2. Les autres
// catégories (pays, institutions, Slider/Destacado) sont trop minces ou ne
// décrivent pas un sujet.
export const SECTIONS = [
  'armenia',
  'azerbaiyan',
  'argentina',
  'cultura',
  'opinion',
  'institucionales',
  'artsaj',
]

// Étiquettes de mise en page du thème (Slider, Destacado1, Destacado 2) : elles
// regroupent des articles de tous sujets et ne sont pas des rubriques.
// Documente l'exclusion ; la liste blanche, c'est SECTIONS ci-dessus.
export function isLayoutCategory(slug) {
  return /^(slider|destacado-?\d*)$/.test(String(slug || ''))
}

export function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

export function imageMap(mediaJson) {
  const list = JSON.parse(mediaJson)
  const map = new Map()
  if (!Array.isArray(list)) return map
  for (const m of list) {
    const sizes = m.media_details?.sizes || {}
    const pick = sizes.medium_large || sizes.large || sizes.medium
    const url = safeUrl(clean(pick?.source_url || m.source_url))
    if (m.id && url) map.set(m.id, url)
  }
  return map
}

// Articles + médias → [{title, url, date, image}]. `agendaId` : un article qui
// porte cette catégorie est écarté, même s'il porte aussi Slider/Destacado.
export function parseRest(postsJson, mediaJson = '[]', { agendaId = null } = {}) {
  const posts = JSON.parse(postsJson)
  if (!Array.isArray(posts)) throw new Error('REST API did not return a list')
  const images = imageMap(mediaJson)
  return posts
    .filter((p) => agendaId == null || !(p.categories || []).includes(agendaId))
    .map((p) => {
      const title = decodeEntities(p.title?.rendered)
      const url = safeUrl(clean(p.link))
      const d = p.date_gmt ? new Date(`${p.date_gmt}Z`) : null
      if (!title || !url) return null
      return {
        title,
        url,
        date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
        image: images.get(p.featured_media) ?? null,
      }
    })
    .filter(Boolean)
}

export async function categories() {
  const cats = JSON.parse(
    await fetchText(`${BASE}/categories?per_page=100&_fields=id,slug,name`),
  )
  if (!Array.isArray(cats)) throw new Error('categories: not a list')
  return Object.fromEntries(cats.map((c) => [c.slug, { id: c.id, name: decodeEntities(c.name) }]))
}

export async function mediaFor(postsJson) {
  const ids = [...new Set(JSON.parse(postsJson).map((p) => p.featured_media).filter(Boolean))]
  if (!ids.length) return '[]'
  return fetchText(
    `${BASE}/media?include=${ids.join(',')}&per_page=${ids.length}&_fields=id,source_url,media_details`,
  )
}

// Une étagère qui échoue reste vide : scrape.mjs la remplit depuis l'instantané
// précédent (backfillSections, clé 'categoryKey').
export async function scrapeDiarioArmenia(limit = 10) {
  let cats = {}
  try {
    cats = await categories()
  } catch (err) {
    console.warn(`  ✗ diarioarmenia/categories: ${err.message}`)
  }
  const agendaId = cats[AGENDA_SLUG]?.id ?? null
  if (agendaId == null) console.warn('  ✗ diarioarmenia: catégorie agenda introuvable (filtre côté serveur sauté)')
  const out = []
  for (const slug of SECTIONS) {
    const meta = cats[slug]
    if (!meta) {
      console.warn(`  ✗ diarioarmenia/${slug}: category not found`)
      out.push({ categoryKey: slug, label: slug, articles: [] })
      continue
    }
    try {
      // categories_exclude écarte l'Agenda côté serveur ; parseRest le refait
      // (ceinture et bretelles : un paramètre ignoré ne doit pas laisser passer).
      const excl = agendaId != null ? `&categories_exclude=${agendaId}` : ''
      const postsJson = await fetchText(
        `${BASE}/posts?categories=${meta.id}${excl}&per_page=${limit}&_fields=title,link,date_gmt,featured_media,categories`,
      )
      const articles = parseRest(postsJson, await mediaFor(postsJson), { agendaId })
      out.push({ categoryKey: slug, label: meta.name, articles })
      console.log(`  ✓ diarioarmenia/${slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ diarioarmenia/${slug}: ${err.message}`)
      out.push({ categoryKey: slug, label: meta.name, articles: [] })
    }
  }
  return out
}
