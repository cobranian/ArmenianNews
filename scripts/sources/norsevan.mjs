import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Nor Sevan (norsevan.com) — média de la communauté arménienne d'Argentine.
// Wix derrière Cloudflare : pas de WordPress, pas d'API ; le flux RSS est la
// seule voie propre (mesuré le 31 octobre 2026 : 200 avec notre User-Agent,
// 20 billets, ~1-2 par jour). Le lastmod du sitemap est la date de MODIFICATION,
// pas de publication : la date est le pubDate du flux.
//
// Source multilingue : l'espagnol (étagères = catégories du flux) et, rarement,
// des billets en arménien occidental. Tout billet en écriture arménienne va dans
// UNE étagère `hy` et jamais sous `es`.
const FEED = 'https://www.norsevan.com/blog-feed.xml'

export const HY_SHELF = { categoryKey: 'hayeren', label: 'Նոր Սեւան — հայերէն' }

// Vrai si les lettres arméniennes dépassent la moitié des lettres du texte.
export function isArmenianText(s) {
  const letters = String(s || '').match(/\p{L}/gu) || []
  if (!letters.length) return false
  const hy = letters.filter((c) => /[\u0531-\u058F]/.test(c)).length
  return hy > letters.length / 2
}

// L'URL du flux (/v1/fit/w_700…/file.png) livre un PNG redimensionné d'environ
// 540 Ko : on garde l'original Wix, qui se sert en JPEG léger.
export function fullImage(url) {
  const u = safeUrl(clean(url))
  return u ? u.replace(/\/v1\/fit\/.*$/, '') : null
}

const slugify = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function parseFeed(xml, limit = 20) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const shelves = new Map()
  const hy = []
  $('item')
    .slice(0, limit)
    .each((_, el) => {
      const it = $(el)
      const title = clean(it.children('title').text())
      const url = safeUrl(clean(it.children('link').text()))
      if (!title || !url) return
      const d = new Date(clean(it.children('pubDate').text()))
      const art = {
        title,
        url,
        date: Number.isNaN(d.getTime()) ? null : d.toISOString(),
        image: fullImage(it.children('enclosure').attr('url')),
      }
      if (isArmenianText(`${title} ${it.children('description').text()}`)) {
        hy.push(art)
        return
      }
      // Un billet sans catégorie (vu le 31 octobre 2026) garde sa place : étagère « General ».
      const label = clean(it.children('category').first().text()) || 'General'
      const key = slugify(label)
      if (!shelves.has(key)) shelves.set(key, { categoryKey: key, label, articles: [] })
      shelves.get(key).articles.push(art)
    })
  return {
    es: [...shelves.values()],
    hy: hy.length ? [{ ...HY_SHELF, articles: hy }] : [],
  }
}

// En cas d'échec : deux listes vides, scrape.mjs backfille par langue.
export async function scrapeNorSevan(limit = 20) {
  try {
    const out = parseFeed(await fetchText(FEED), limit)
    console.log(`  ✓ norsevan (es ${out.es.reduce((n, s) => n + s.articles.length, 0)}, hy ${out.hy.reduce((n, s) => n + s.articles.length, 0)})`)
    return out
  } catch (err) {
    console.warn(`  ✗ norsevan: ${err.message}`)
    return { es: [], hy: [] }
  }
}
