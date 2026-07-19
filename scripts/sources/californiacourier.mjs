import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// The California Courier (thecaliforniacourier.com) — the Glendale Armenian
// weekly. One WordPress REST install (open, no UA filter, no Cloudflare), like
// oragark. Its distinctive asset: Harut Sassounian's Column is translated into
// separate, fresh, illustrated categories per language — so this is the only
// source besides Armenpress to serve all four UI languages, and the only second
// source the fr and ru editions ever get.
//
// Per-language mapping (each language shows ONE category):
//   en → mainpost          the Courier's main English news feed (incl. his
//                          English column, which has no clean fresh category of
//                          its own — the English `sas-column` stopped in 2021)
//   fr → french            Sassounian's Column, French
//   ru → russian           Sassounian's Column, Russian
//   hy → eastern-armenian  Sassounian's Column, Eastern Armenian
//
// The label is hand-set (the WordPress category names are language names —
// "French", "Russian" — or "mainpost", none usable as a carousel title) and
// rides in the data, shown only under its own language.
const BASE = 'https://www.thecaliforniacourier.com'

const SECTIONS = {
  en: { slug: 'mainpost', label: 'Latest news' },
  fr: { slug: 'french', label: 'La chronique de Harut Sassounian' },
  ru: { slug: 'russian', label: 'Колонка Арута Сасуняна' },
  hy: { slug: 'eastern-armenian', label: 'Հարություն Սասունյանի սյունակ' },
}

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

// Resolve a category slug to its numeric id (the label is hand-set, not the
// site's — see SECTIONS).
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

// One category per language, keyed by UI language. A blocked/empty language is
// backfilled from the previous snapshot by scrape.mjs (keyName 'categoryKey').
export async function scrapeCaliforniaCourier(limit = 10) {
  const out = {}
  for (const [lang, { slug, label }] of Object.entries(SECTIONS)) {
    const id = await categoryId(slug)
    if (!id) {
      console.warn(`  ✗ californiacourier/${lang}/${slug}: category not found`)
      out[lang] = [{ categoryKey: slug, label, articles: [] }]
      continue
    }
    try {
      const url = `${BASE}/wp-json/wp/v2/posts?categories=${id}&per_page=${limit}&_embed=1`
      const articles = parseRest(await fetchText(url))
      out[lang] = [{ categoryKey: slug, label, articles }]
      console.log(`  ✓ californiacourier/${lang}/${slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ californiacourier/${lang}/${slug}: ${err.message}`)
      out[lang] = [{ categoryKey: slug, label, articles: [] }]
    }
  }
  return out
}
