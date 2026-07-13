import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Nouvelles d'Arménie (armenews.com) is a French WordPress site, so we pull each
// rubric's latest posts through the REST API — picture-ready via _embed — exactly
// like ArmRadio. The site's "Petites annonces" is an AWPCP classifieds plugin
// with no REST endpoint (and no article shape), so it is intentionally left out.
const BASE = 'https://www.armenews.com'

// The rubrics offered in the news feed, paired with their WordPress category
// slug. `key` matches i18n 'namcats.*'.
export const ARMENEWS_SECTIONS = [
  { key: 'actualites', slug: 'actualites' },
  { key: 'sport', slug: 'sport' },
  { key: 'communaute', slug: 'communaute' },
  { key: 'culture', slug: 'culture' },
  { key: 'lifestyle', slug: 'lifestyle' },
  { key: 'magazine', slug: 'magazine' },
]

function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

function embeddedImage(p) {
  const media = p._embedded?.['wp:featuredmedia']?.[0]
  if (!media) return null
  const sizes = media.media_details?.sizes || {}
  const pick = sizes.medium_large || sizes.large || sizes.medium
  return safeUrl(clean(pick?.source_url || media.source_url))
}

// WordPress REST posts → {title, url, date, image}.
function parseRest(json) {
  const posts = JSON.parse(json)
  if (!Array.isArray(posts)) throw new Error('REST API did not return a list')
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
        image: embeddedImage(p),
      }
    })
    .filter(Boolean)
}

// Resolve a rubric's numeric category id. The ?slug= filter returns the exact
// category even when the site has more than the 100-per-page listing cap.
async function categoryId(slug) {
  try {
    const cats = JSON.parse(
      await fetchText(`${BASE}/wp-json/wp/v2/categories?slug=${slug}&_fields=id`),
    )
    return Array.isArray(cats) && cats[0]?.id ? cats[0].id : null
  } catch {
    return null
  }
}

// Per-rubric articles for the news feed. A blocked/empty rubric is backfilled
// from the previous snapshot by scrape.mjs.
export async function scrapeArmenews(limit = 10) {
  const out = []
  for (const section of ARMENEWS_SECTIONS) {
    const id = await categoryId(section.slug)
    if (!id) {
      console.warn(`  ✗ armenews/${section.slug}: category not found`)
      out.push({ categoryKey: section.key, articles: [] })
      continue
    }
    try {
      const url = `${BASE}/wp-json/wp/v2/posts?categories=${id}&per_page=${limit}&_embed=1`
      const articles = parseRest(await fetchText(url))
      out.push({ categoryKey: section.key, articles })
      console.log(`  ✓ armenews/${section.slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ armenews/${section.slug}: ${err.message}`)
      out.push({ categoryKey: section.key, articles: [] })
    }
  }
  return out
}
