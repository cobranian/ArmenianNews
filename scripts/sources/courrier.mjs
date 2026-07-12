import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean } from '../lib/util.mjs'

const BASE = 'https://courrier.am'

// The 8 sections requested, in display order. `key` matches i18n 'sections.*'.
export const SECTIONS = [
  { key: 'actualite', slug: 'actualite' },
  { key: 'societe', slug: 'societe' },
  { key: 'economie', slug: 'economie' },
  { key: 'arts-et-culture', slug: 'arts-et-culture' },
  { key: 'francophonie', slug: 'francophonie' },
  { key: 'opinions', slug: 'opinions' },
  { key: 'region', slug: 'region' },
  { key: 'diasporas', slug: 'diasporas' },
]

// Pull the most recent `limit` articles of a section's Drupal Views grid.
// The FR and HY editions share the same slugs and grid markup — only the
// /fr vs /hy path prefix differs.
async function articlesForSection({ key, slug }, lang = 'fr', limit = 10) {
  const html = await fetchText(`${BASE}/${lang}/${slug}`)
  const $ = cheerio.load(html)

  const articles = []
  const seen = new Set()
  $('.views-bootstrap-grid-plugin-style .column').each((_, c) => {
    if (articles.length >= limit) return
    const col = $(c)
    let titleEl = col.find('.views-field-title-field-et a').first()
    if (!titleEl.length) titleEl = col.find('a').filter((_, a) => clean($(a).text())).first()

    const title = clean(titleEl.text())
    const href = titleEl.attr('href')
    if (!title || !href || seen.has(href)) return
    seen.add(href)

    const img = col.find('.views-field-field-image img').first().attr('src')
    articles.push({
      title,
      url: absUrl(href, BASE),
      image: img ? absUrl(img, BASE) : null,
    })
  })

  if (!articles.length) throw new Error(`No articles parsed for section ${slug}`)
  return { sectionKey: key, articles }
}

export async function scrapeCourrier(lang = 'fr') {
  const out = []
  for (const section of SECTIONS) {
    try {
      const sec = await articlesForSection(section, lang)
      out.push(sec)
      console.log(`  ✓ courrier/${lang}/${section.slug} (${sec.articles.length})`)
    } catch (err) {
      console.warn(`  ✗ courrier/${lang}/${section.slug}: ${err.message}`)
      out.push({ sectionKey: section.key, articles: [] })
    }
  }
  return out
}
