import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Arménie Info TV (armenieinfo.tv) — a French WordPress site whose public REST
// API is locked (401), so we scrape the category pages' HTML. Thumbnails are CSS
// background-images (not <img>). The site tags one article under several
// categories, so we DEDUPE by URL across categories, keeping the first
// (highest-priority) listing.
//
// DATES: the category listing carries none — no <time>, no meta, nothing. Each
// ARTICLE page does, in `<meta property="article:published_time">`, so every
// deduped article is re-fetched for it (~65 pages/hour, deduped, the same
// pattern and cost as asbarez.am's og:image scrape).
//
// This used to return `date: null` on purpose, with a comment saying the news
// browser didn't show dates. It does now: every card prints its age under the
// call to action, and a source without dates prints nothing there. That comment
// was the rationale for a gap, not a fact about the site — the dates were
// always one fetch away.
const BASE = 'https://armenieinfo.tv'

// Rubric slugs in priority order: an article shared by several rubrics shows
// under the first one listed here. `key` matches i18n 'aitcats.*'.
export const ARMENIEINFOTV_SECTIONS = [
  { key: 'armenie', slug: 'armenie' },
  { key: 'art-culture', slug: 'art-culture' },
  { key: 'artsakh', slug: 'artsakh' },
  { key: 'diaspora', slug: 'diaspora' },
  { key: 'france', slug: 'france' },
  { key: 'geopolitique', slug: 'geopolitique' },
  { key: 'politique', slug: 'politique' },
  { key: 'un-autre-regard', slug: 'un-autre-regard-par-marie-taffoureau' },
]

function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

// The thumbnail lives in a CSS background-image on .mg-post-thumb.
function bgImage(styleAttr) {
  const m = /background-image:\s*url\((['"]?)(.*?)\1\)/i.exec(styleAttr || '')
  return m ? safeUrl(clean(m[2])) : null
}

function parseCategory(html) {
  const $ = cheerio.load(html)
  const out = []
  for (const el of $('article').toArray()) {
    const a = $(el)
    const link = a.find('h4.entry-title a, .entry-title a').first()
    const title = decodeEntities(link.text())
    const url = safeUrl(clean(link.attr('href')))
    if (!title || !url) continue
    out.push({ title, url, date: null, image: bgImage(a.find('.mg-post-thumb').first().attr('style')) })
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The publication date, read off the article's own page. WordPress emits it as
// an Open Graph timestamp with a zone offset, which `new Date()` parses as-is.
// A page that fails leaves `date: null` — the card then simply prints no age,
// exactly as before. One dead permalink must not cost us the whole rubric.
async function publishedAt(url) {
  try {
    const $ = cheerio.load(await fetchText(url, { retries: 1 }))
    const raw =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="article:published_time"]').attr('content')
    if (!raw) return null
    const d = new Date(clean(raw))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

// Per-rubric articles, deduped across rubrics by URL. A blocked/empty rubric is
// backfilled from the previous snapshot by scrape.mjs.
export async function scrapeArmenieInfoTv(limit = 10) {
  const seen = new Set()
  const out = []
  for (const section of ARMENIEINFOTV_SECTIONS) {
    try {
      const all = parseCategory(await fetchText(`${BASE}/category/${section.slug}/`))
      const fresh = []
      for (const art of all) {
        if (seen.has(art.url)) continue // already shown under an earlier rubric
        seen.add(art.url)
        fresh.push(art)
        if (fresh.length >= limit) break
      }
      // Dates, one page per article. Spaced like the other per-article scrapes
      // in this repo so a rubric never hammers the site.
      for (const art of fresh) {
        art.date = await publishedAt(art.url)
        await sleep(250)
      }
      out.push({ categoryKey: section.key, articles: fresh })
      const note = all.length !== fresh.length ? ` of ${all.length}, deduped` : ''
      const dated = fresh.filter((a) => a.date).length
      console.log(`  ✓ armenieinfotv/${section.slug} (${fresh.length}${note}, ${dated} datés)`)
    } catch (err) {
      console.warn(`  ✗ armenieinfotv/${section.slug}: ${err.message}`)
      out.push({ categoryKey: section.key, articles: [] })
    }
  }
  return out
}
