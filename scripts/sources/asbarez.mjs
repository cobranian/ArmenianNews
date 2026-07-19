import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Asbarez — the Los Angeles Armenian daily — in its two real editions:
//   • English  asbarez.com  → WordPress REST API (like armenews). fetchText's
//     Chrome UA clears the site's UA filter; Node undici's default UA gets a 403.
//   • Armenian asbarez.am   → REST is 401-locked, but per-category RSS feeds are
//     open. RSS has no images, so each article's og:image is scraped separately.
// Each edition only ever renders under its matching UI language (en / hy), so a
// section's `label` is carried in the data and shown verbatim — it is not routed
// through i18n's `t()`, whose four language dictionaries could never cross-render
// a single-language category name.
const HOST_BY_ED = { en: 'asbarez.com', hy: 'asbarez.am' }

// Both editions 403 datacenter IP ranges (a server-side WAF, not Cloudflare), so
// a direct fetch works from a residential IP but not from CI — where the feed
// would silently freeze on backfill. When ASBAREZ_PROXY is set, requests route
// through a Cloudflare Worker (proxy/asbarez-worker.js) that egresses from a
// Cloudflare IP the WAF does not block. `path` is an absolute origin path (with
// its query); the worker allowlists it per edition. Article `link`s stay direct
// — readers click them from residential IPs.
const PROXY = (process.env.ASBAREZ_PROXY || '').trim()

function asbUrl(ed, path) {
  if (!PROXY) return `https://${HOST_BY_ED[ed]}${path}`
  const u = new URL(PROXY)
  u.searchParams.set('ed', ed)
  u.searchParams.set('path', path)
  return u.toString()
}

// English rubrics, paired with their WordPress category slug. The label comes
// from the category's own `name` (fetched alongside its id), so it tracks the
// source. `key` is the stable id used for backfill matching across snapshots.
const EN_SECTIONS = [
  'top-stories',
  'community',
  'arts-culture',
  'op-ed',
  'columns',
  'videos',
  'sports',
]

// Armenian rubrics: RSS feed slug → display label (Western Armenian). The fourth
// slug is Armenian letters; encodeURIComponent handles it when building the URL.
const HY_SECTIONS = [
  { slug: 'hayastan', label: 'Հայաստան' },
  { slug: 'klkhavor-loorer', label: 'Գլխաւոր Լուրեր' },
  { slug: 'kaghoutigyanken', label: 'Գաղութի Կեանքէն' },
  { slug: 'գաղութներ', label: 'Գաղութներ' },
  { slug: 'hotvadzner', label: 'Յօդուածներ' },
]

function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

// --- English: WordPress REST -----------------------------------------------
function embeddedImage(p) {
  const media = p._embedded?.['wp:featuredmedia']?.[0]
  if (!media) return null
  const sizes = media.media_details?.sizes || {}
  const pick = sizes.medium_large || sizes.large || sizes.medium
  return safeUrl(clean(pick?.source_url || media.source_url))
}

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

// Resolve a rubric's numeric id and its display name in one request.
async function categoryMeta(slug) {
  try {
    const cats = JSON.parse(
      await fetchText(asbUrl('en', `/wp-json/wp/v2/categories?slug=${slug}&_fields=id,name`)),
    )
    const c = Array.isArray(cats) ? cats[0] : null
    return c?.id ? { id: c.id, name: decodeEntities(c.name) } : null
  } catch {
    return null
  }
}

async function scrapeEnglish(limit) {
  const out = []
  for (const slug of EN_SECTIONS) {
    const meta = await categoryMeta(slug)
    if (!meta) {
      console.warn(`  ✗ asbarez.com/${slug}: category not found`)
      out.push({ categoryKey: slug, label: slug, articles: [] })
      continue
    }
    try {
      const url = asbUrl('en', `/wp-json/wp/v2/posts?categories=${meta.id}&per_page=${limit}&_embed=1`)
      const articles = parseRest(await fetchText(url))
      out.push({ categoryKey: slug, label: meta.name, articles })
      console.log(`  ✓ asbarez.com/${slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ asbarez.com/${slug}: ${err.message}`)
      out.push({ categoryKey: slug, label: meta.name, articles: [] })
    }
  }
  return out
}

// --- Armenian: per-category RSS --------------------------------------------
function parseRss(xml, limit) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const items = []
  $('item').each((_, el) => {
    if (items.length >= limit) return false
    const it = $(el)
    const title = decodeEntities(it.find('title').first().text())
    const url = safeUrl(clean(it.find('link').first().text()))
    const raw = clean(it.find('pubDate').first().text())
    const d = raw ? new Date(raw) : null
    if (!title || !url) return
    items.push({
      title,
      url,
      date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      image: null, // filled from the article's og:image below (RSS has none)
    })
  })
  return items
}

// The .am RSS carries no images, so fetch each article page (through the proxy —
// same datacenter-IP block as the feeds) and read its og:image. The images live
// on media.asbarez.am, which hotlinks fine for a residential reader, so the URL
// is stored direct like the English edition. A failed fetch leaves image null →
// the card falls back to the motif, so a single dead article never breaks a row.
// Cost: 5 rubrics × up to 10 articles ≈ 50 extra fetches/snapshot.
async function fillImage(article) {
  let path
  try {
    const u = new URL(article.url)
    path = u.pathname + u.search
  } catch {
    return
  }
  try {
    const html = await fetchText(asbUrl('hy', path))
    const $ = cheerio.load(html)
    const og =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content')
    article.image = safeUrl(clean(og)) || null
  } catch {
    /* leave image null → motif fallback */
  }
}

async function scrapeArmenian(limit) {
  const out = []
  for (const { slug, label } of HY_SECTIONS) {
    try {
      const url = asbUrl('hy', `/archives/category/${encodeURIComponent(slug)}/feed/`)
      const articles = parseRss(await fetchText(url), limit)
      // Enrich this rubric's articles with images concurrently.
      await Promise.all(articles.map(fillImage))
      const withImg = articles.filter((a) => a.image).length
      out.push({ categoryKey: slug, label, articles })
      console.log(`  ✓ asbarez.am/${slug} (${articles.length}, ${withImg} img)`)
    } catch (err) {
      console.warn(`  ✗ asbarez.am/${slug}: ${err.message}`)
      out.push({ categoryKey: slug, label, articles: [] })
    }
  }
  return out
}

// Both editions. A blocked/empty rubric is backfilled from the previous snapshot
// by scrape.mjs, per edition and per category (keyName 'categoryKey').
export async function scrapeAsbarez(limit = 10) {
  console.log('  — asbarez.com (English, REST):')
  const en = await scrapeEnglish(limit)
  console.log('  — asbarez.am (Western Armenian, RSS):')
  const hy = await scrapeArmenian(limit)
  return { en, hy }
}
