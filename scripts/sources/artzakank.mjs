import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Artzakank / Écho des Arméniens de Suisse (artzakank-echo.ch) — a French
// WordPress site, pulled through the REST API like armenews. One difference:
// its posts carry NO featured media (featured_media is 0), so there is nothing
// under wp:featuredmedia to read. The art lives inline in the body instead, so
// we lift the first real content <img>; a text-only post falls back to a motif.
const BASE = 'https://artzakank-echo.ch'

// The two REST rubrics the site asked for, paired with their WordPress category
// slug. `key` matches i18n 'azkcats.*'.
export const ARTZAKANK_SECTIONS = [
  { key: 'armenie-artsakh', slug: 'armenie-artsakh' },
  { key: 'communaute', slug: 'communaute' },
]

// "Divers" is not a REST category — it's a hand-built page with a blog
// shortcode listing — so it is scraped from HTML (see scrapeDivers). Its
// content is archival and rarely changes; that's a property of the page.
const DIVERS_PAGE = `${BASE}/divers-p/`

function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

// A usable content image, or null. Skips WordPress smilies, emoji and
// spacer/tracking pixels.
function okImage(src) {
  const s = clean(src)
  if (!/^https?:\/\//.test(s)) return null
  if (/\/wp-includes\/images\/smilies\//.test(s)) return null
  if (/emoji|spacer|blank\.gif|pixel|1x1/i.test(s)) return null
  return safeUrl(s)
}

// First real content image in the post body; null when the body is text-only.
function firstContentImage(html) {
  if (!html) return null
  const $ = cheerio.load(html)
  for (const el of $('img').toArray()) {
    const got = okImage($(el).attr('src') || $(el).attr('data-src'))
    if (got) return got
  }
  return null
}

// WordPress permalinks embed the publish date as /YYYY/MM/DD/ — the divers page
// exposes no clean per-item date field, so we read it from the link.
function dateFromPermalink(url) {
  const m = /\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(url || '')
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// The Divers page: a blog-shortcode listing of <article class="post"> cards,
// each an <h2 class="entry-title"><a> plus a thumbnail. Parsed from HTML because
// there is no matching REST category.
async function scrapeDivers(limit) {
  const $ = cheerio.load(await fetchText(DIVERS_PAGE))
  const articles = []
  for (const el of $('article.post').toArray()) {
    const a = $(el)
    const link = a.find('h2.entry-title a').first()
    const title = decodeEntities(link.text())
    const url = safeUrl(clean(link.attr('href')))
    if (!title || !url) continue
    const img = a.find('img').first()
    articles.push({
      title,
      url,
      date: dateFromPermalink(url),
      image: okImage(img.attr('src') || img.attr('data-src')),
    })
    if (articles.length >= limit) break
  }
  return articles
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
        image: firstContentImage(p.content?.rendered),
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
export async function scrapeArtzakank(limit = 10) {
  const out = []
  for (const section of ARTZAKANK_SECTIONS) {
    const id = await categoryId(section.slug)
    if (!id) {
      console.warn(`  ✗ artzakank/${section.slug}: category not found`)
      out.push({ categoryKey: section.key, articles: [] })
      continue
    }
    try {
      const url = `${BASE}/wp-json/wp/v2/posts?categories=${id}&per_page=${limit}`
      const articles = parseRest(await fetchText(url))
      out.push({ categoryKey: section.key, articles })
      console.log(`  ✓ artzakank/${section.slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ artzakank/${section.slug}: ${err.message}`)
      out.push({ categoryKey: section.key, articles: [] })
    }
  }

  // Divers — scraped from the page's HTML, not the REST API.
  try {
    const articles = await scrapeDivers(limit)
    out.push({ categoryKey: 'divers', articles })
    console.log(`  ✓ artzakank/divers (${articles.length})`)
  } catch (err) {
    console.warn(`  ✗ artzakank/divers: ${err.message}`)
    out.push({ categoryKey: 'divers', articles: [] })
  }

  return out
}
