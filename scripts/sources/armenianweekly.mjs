import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// The Armenian Weekly (armenianweekly.com) — the ARF's English-language weekly,
// published from Watertown, Massachusetts. English only: no Armenian, Russian or
// French edition, so it renders under `en` alone and returns a FLAT array of
// shelves (the courrier / armenews / artzakank shape), not a per-language map.
//
// An open WordPress REST install like oragark and californiacourier: no
// Cloudflare, `fetch` (undici) answers 200 — no need for `fetchTextNode` here —
// and the featured images hotlink direct with a foreign Referer (medium_large
// ≈ 77 Ko, so no wsrv and no proxy). Labels are the site's own category names,
// carried in the data and shown verbatim — a single-language name cannot be
// routed through the four i18n dictionaries.
//
// There IS a User-Agent rule, and it is the opposite of the usual one. Measured
// 2026-08-12 on the categories endpoint:
//
//   (curl default)  200      curl/8.0                200
//   Mozilla/5.0     403      full Chrome UA          200
//
// So it rejects a TRUNCATED browser-like UA, not non-browser clients. fetchText
// sends the full Chrome UA and is fine; the trap is the one-off probe written
// with `-H 'User-Agent: Mozilla/5.0'`, which 403s and reads as "the site blocks
// us" — and a 403 here empties all seven shelves, which backfillSections then
// covers without a word.
const BASE = 'https://armenianweekly.com'

// The seven top-level rubrics, in the order they appear on the site's own nav.
// `america-at-250` is a commemorative series, not a live desk: ten articles
// total, and it will sit at the bottom of the tab showing its real age. That is
// deliberate — the shelf tells the truth about a slow rubric.
const SECTIONS = [
  'news',
  'diaspora',
  'culture',
  'opinion',
  'columns',
  'youth',
  'america-at-250',
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

// The whole category tree, in as few requests as possible (86 terms today, so
// one page of 100 — but paginate anyway, because a second page would otherwise
// vanish without a word).
//
// Only page 1 is allowed to fail the source. WordPress answers a page past the
// last one with **400** (`rest_post_invalid_page_number`), not an empty list,
// and fetchText rejects every non-200: a tree of exactly 100, 200 or 300 terms
// would therefore throw on the page after the last full one and take all seven
// rubrics down with it — on a request whose only purpose was to confirm there
// was nothing more to read.
const PAGE_SIZE = 100
const MAX_PAGES = 5

async function allCategories() {
  const out = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    let batch
    try {
      const json = await fetchText(
        `${BASE}/wp-json/wp/v2/categories?per_page=${PAGE_SIZE}&page=${page}&_fields=id,name,slug,parent`,
      )
      batch = JSON.parse(json)
    } catch (err) {
      if (page === 1) throw err
      break
    }
    if (!Array.isArray(batch)) throw new Error('categories endpoint did not return a list')
    out.push(...batch)
    if (batch.length < PAGE_SIZE) return out
  }
  console.warn(
    `  ↯ armenianweekly: category tree read to the ${MAX_PAGES}-page cap (${out.length} terms);` +
      ' a rubric may be missing descendants',
  )
  return out
}

// A rubric's own id PLUS every descendant's.
//
// This is the difference between a fresh shelf and a stale one, and nothing
// would report the stale case. WordPress's category ARCHIVE PAGE (/news/) shows
// posts from child categories; the REST `categories` parameter does NOT. The
// Weekly files most of its daily copy under children of News — `headline`,
// `announcements`, `briefs` — so `categories=14` alone returns full shelves, of
// correctly dated, correctly illustrated articles, that are simply a week
// behind the page a reader would open. Measured 2026-08-12:
//
//   news      parent-only 2026-08-06  ·  with children 2026-08-12
//   diaspora  parent-only 2026-08-07  ·  with children 2026-08-12
//
// Resolved from the live tree rather than a hardcoded id list so that a
// subcategory added upstream joins its parent's shelf on the next snapshot
// instead of quietly draining it.
// `seen` is not defensive clutter: this walks a parent pointer supplied by a
// third party, and a term whose `parent` is itself — or any cycle — would make
// the queue grow forever. There is no timeout around a `for` loop, so the
// snapshot would hang rather than fail, which is the worse of the two.
function withDescendants(cats, rootId) {
  const ids = [rootId]
  const seen = new Set(ids)
  for (let i = 0; i < ids.length; i++) {
    for (const c of cats) {
      if (c.parent === ids[i] && !seen.has(c.id)) {
        seen.add(c.id)
        ids.push(c.id)
      }
    }
  }
  return ids
}

// Seven shelves, English only. An empty rubric is backfilled from the previous
// snapshot by scrape.mjs (keyName 'categoryKey'), which also restores its label.
export async function scrapeArmenianWeekly(limit = 10) {
  let cats = []
  try {
    cats = await allCategories()
  } catch (err) {
    console.warn(`  ✗ armenianweekly: category tree unreachable: ${err.message}`)
    return SECTIONS.map((slug) => ({ categoryKey: slug, label: slug, articles: [] }))
  }
  const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c]))

  const out = []
  for (const slug of SECTIONS) {
    const cat = bySlug[slug]
    if (!cat) {
      console.warn(`  ✗ armenianweekly/${slug}: category not found`)
      out.push({ categoryKey: slug, label: slug, articles: [] })
      continue
    }
    const label = decodeEntities(cat.name) || slug
    try {
      const ids = withDescendants(cats, cat.id)
      const url = `${BASE}/wp-json/wp/v2/posts?categories=${ids.join(',')}&per_page=${limit}&_embed=1`
      const articles = parseRest(await fetchText(url))
      out.push({ categoryKey: slug, label, articles })
      console.log(`  ✓ armenianweekly/${slug} (${articles.length}, ${ids.length} cat)`)
    } catch (err) {
      console.warn(`  ✗ armenianweekly/${slug}: ${err.message}`)
      out.push({ categoryKey: slug, label, articles: [] })
    }
  }
  return out
}
