import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Soy Armenio (soyarmenio.com) — le quotidien en espagnol de la diaspora
// d'Amérique latine. Un WordPress derrière Cloudflare, mais notre UA (qui ne se
// dit pas « Chrome ») passe, et les images se lient en direct (mesuré le
// 31 octobre 2026 : ~12 articles par jour, plus long silence 23 h).
//
// Source mono-langue : liste plate d'étagères dans news.json, hors BY_LANG.
// Le `label` de chaque étagère vient du nom de la catégorie WordPress.
//
// Pas de `_embed` : complet il pèse 2,4 Mo pour 20 articles. On demande les
// articles avec `_fields`, puis les médias d'un seul appel `media?include=…`
// (~25 Ko pour 10 images contre ~54 Ko pour `_embed=wp:featuredmedia`).
const BASE = 'https://soyarmenio.com/wp-json/wp/v2'

// Slugs WordPress réels (les slugs diffèrent parfois du nom : « Armenia » est
// `noticias-de-armenia`, « Mundo » est `noticias-internacionales`).
export const SECTIONS = [
  'noticias-de-armenia',
  'politica',
  'diaspora-armenia',
  'cultura',
  'economia',
  'noticias-internacionales',
  'deporte',
]

function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

// id de média → URL d'image (medium_large de préférence, sinon l'original).
function imageMap(mediaJson) {
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

// Articles + médias WordPress → [{title, url, date, image}].
export function parseRest(postsJson, mediaJson = '[]') {
  const posts = JSON.parse(postsJson)
  if (!Array.isArray(posts)) throw new Error('REST API did not return a list')
  const images = imageMap(mediaJson)
  return posts
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

// Toutes les catégories en un appel : slug → {id, name}.
async function categories() {
  const cats = JSON.parse(
    await fetchText(`${BASE}/categories?per_page=100&_fields=id,slug,name`),
  )
  if (!Array.isArray(cats)) throw new Error('categories: not a list')
  return Object.fromEntries(cats.map((c) => [c.slug, { id: c.id, name: decodeEntities(c.name) }]))
}

async function mediaFor(postsJson) {
  const ids = [...new Set(JSON.parse(postsJson).map((p) => p.featured_media).filter(Boolean))]
  if (!ids.length) return '[]'
  return fetchText(
    `${BASE}/media?include=${ids.join(',')}&per_page=${ids.length}&_fields=id,source_url,media_details`,
  )
}

// Une étagère qui échoue reste vide : scrape.mjs la remplit depuis l'instantané
// précédent (backfillSections, clé 'categoryKey').
export async function scrapeSoyArmenio(limit = 10) {
  let cats = {}
  try {
    cats = await categories()
  } catch (err) {
    console.warn(`  ✗ soyarmenio/categories: ${err.message}`)
  }
  const out = []
  for (const slug of SECTIONS) {
    const meta = cats[slug]
    if (!meta) {
      console.warn(`  ✗ soyarmenio/${slug}: category not found`)
      out.push({ categoryKey: slug, label: slug, articles: [] })
      continue
    }
    try {
      const postsJson = await fetchText(
        `${BASE}/posts?categories=${meta.id}&per_page=${limit}&_fields=title,link,date_gmt,featured_media`,
      )
      const articles = parseRest(postsJson, await mediaFor(postsJson))
      out.push({ categoryKey: slug, label: meta.name, articles })
      console.log(`  ✓ soyarmenio/${slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ soyarmenio/${slug}: ${err.message}`)
      out.push({ categoryKey: slug, label: meta.name, articles: [] })
    }
  }
  return out
}
