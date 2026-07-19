import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Oragark (Օրակարգ, oragark.com) — an ARF daily in English and Western Armenian.
// Unlike Asbarez's two separate sites, Oragark is ONE WordPress install: both
// editions are just categories on the same REST API (armenews-style, picture-
// ready via _embed). No UA filter, no Cloudflare, images hotlink direct — the
// simplest source here. Each edition renders only under its matching UI language
// (en / hy), so a section's `label` rides in the data and is shown verbatim,
// not routed through i18n's `t()` (a single-language name can't cross-render).
const BASE = 'https://www.oragark.com'

// Rubrics per edition, by WordPress category slug. `key` is the stable id used
// for backfill matching; the display `label` comes from the category's own name.
const SECTIONS = {
  en: ['featured', 'news', 'armenia', 'community'],
  hy: ['arachin-hy', 'latest-news-hy'],
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

// Resolve a rubric's numeric id and its display name in one request.
async function categoryMeta(slug) {
  try {
    const cats = JSON.parse(
      await fetchText(`${BASE}/wp-json/wp/v2/categories?slug=${slug}&_fields=id,name`),
    )
    const c = Array.isArray(cats) ? cats[0] : null
    return c?.id ? { id: c.id, name: decodeEntities(c.name) } : null
  } catch {
    return null
  }
}

async function scrapeEdition(lang, limit) {
  const out = []
  for (const slug of SECTIONS[lang]) {
    const meta = await categoryMeta(slug)
    if (!meta) {
      console.warn(`  ✗ oragark/${lang}/${slug}: category not found`)
      out.push({ categoryKey: slug, label: slug, articles: [] })
      continue
    }
    try {
      const url = `${BASE}/wp-json/wp/v2/posts?categories=${meta.id}&per_page=${limit}&_embed=1`
      const articles = parseRest(await fetchText(url))
      out.push({ categoryKey: slug, label: meta.name, articles })
      console.log(`  ✓ oragark/${lang}/${slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ oragark/${lang}/${slug}: ${err.message}`)
      out.push({ categoryKey: slug, label: meta.name, articles: [] })
    }
  }
  return out
}

// Both editions. A blocked/empty rubric is backfilled from the previous snapshot
// by scrape.mjs, per edition and per category (keyName 'categoryKey').
export async function scrapeOragark(limit = 10) {
  console.log('  — oragark.com (English):')
  const en = await scrapeEdition('en', limit)
  console.log('  — oragark.com/hy (Western Armenian):')
  const hy = await scrapeEdition('hy', limit)
  return { en, hy }
}
