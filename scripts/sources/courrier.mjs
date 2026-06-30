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

async function latestForSection({ key, slug }) {
  const html = await fetchText(`${BASE}/fr/${slug}`)
  const $ = cheerio.load(html)

  // Drupal Views grid: the first .column is the most recent article.
  const col = $('.views-bootstrap-grid-plugin-style .column').first()
  let titleEl = col.find('.views-field-title-field-et a').first()
  if (!titleEl.length) titleEl = col.find('a').filter((_, a) => clean($(a).text())).first()

  const title = clean(titleEl.text())
  const href = titleEl.attr('href')
  const img = col.find('.views-field-field-image img').first().attr('src')

  if (!title || !href) throw new Error(`No article parsed for section ${slug}`)

  return {
    sectionKey: key,
    title,
    url: absUrl(href, BASE),
    image: img ? absUrl(img, BASE) : null,
  }
}

export async function scrapeCourrier() {
  const out = []
  for (const section of SECTIONS) {
    try {
      out.push(await latestForSection(section))
      console.log(`  ✓ courrier/${section.slug}`)
    } catch (err) {
      console.warn(`  ✗ courrier/${section.slug}: ${err.message}`)
      out.push({ sectionKey: section.key, title: null, url: `${BASE}/fr/${section.slug}`, image: null })
    }
  }
  return out
}
