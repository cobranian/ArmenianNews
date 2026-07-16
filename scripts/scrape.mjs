// Daily snapshot orchestrator.
// Scrapes news + agenda and writes them into src/data/*.json. The Instagram
// post pool (instagram.json) and facebook.json are *curated* (see README) and
// are NOT overwritten — but each snapshot re-randomises which IG posts show
// (instagram-feed.json) so the wall changes hourly.
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scrapeCourrier } from './sources/courrier.mjs'
import { scrapeArmradioSections } from './sources/armradio.mjs'
import { scrapeArmenews } from './sources/armenews.mjs'
import { scrapeArtzakank } from './sources/artzakank.mjs'
import { scrapeArmenieInfoTv } from './sources/armenieinfotv.mjs'
import { scrapeArmenpress } from './sources/armenpress.mjs'
import { scrapeAgenda } from './sources/armenopole.mjs'
import { selectInstagram } from './sources/instagram.mjs'

// Backfill each empty category from the previous snapshot, so a transient
// upstream block never wipes a rubric. `keyName` is 'sectionKey' | 'categoryKey'.
function backfillSections(fresh, prev, keyName) {
  if (!prev?.length) return fresh
  if (!fresh.length) {
    console.warn(`  ↺ keeping ${prev.length} previous ${keyName} groups`)
    return prev
  }
  const prevByKey = Object.fromEntries(prev.map((s) => [s[keyName], s.articles || []]))
  for (const sec of fresh) {
    if (!sec.articles?.length && prevByKey[sec[keyName]]?.length) {
      console.warn(`  ↺ keeping ${prevByKey[sec[keyName]].length} previous ${sec[keyName]} articles`)
      sec.articles = prevByKey[sec[keyName]]
    }
  }
  return fresh
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'src', 'data')

async function writeJson(name, data) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`→ wrote src/data/${name}`)
}

const PUBLIC_DIR = join(__dirname, '..', 'public')

// The sitemap claims changefreq: hourly — lastmod is what backs the claim.
// Written here, not at build time: a push to main rebuilds without scraping,
// and a lastmod from that build would announce a freshness that never happened.
async function writeSitemap(generatedAt) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://armenieinfo.ch/</loc>
    <lastmod>${generatedAt}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
  await writeFile(join(PUBLIC_DIR, 'sitemap.xml'), xml, 'utf-8')
  console.log('→ wrote public/sitemap.xml')
}

// Read the previous snapshot so a failed/blocked source (e.g. an upstream
// Cloudflare 403 from CI) reuses its last-good data instead of wiping it.
async function readJson(name) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, name), 'utf-8'))
  } catch {
    return null
  }
}

async function main() {
  const generatedAt = new Date().toISOString()
  console.log(`\n📜 Arménie Info — snapshot ${generatedAt}\n`)

  // Last-good snapshot, used to backfill any source that comes back empty.
  const prevNews = await readJson('news.json')
  const prevAgenda = await readJson('agenda.json')
  const prevIg = await readJson('instagram-feed.json')

  // News. Courrier d'Erevan is French-only — courrier.am/hy serves the identical
  // French articles — so we scrape it once. ArmRadio has real EN and HY editions,
  // so the UI shows en for fr/en and hy for hy.
  console.log('\nCourrier — courrier.am/fr:')
  let courrierSecs = []
  try {
    courrierSecs = await scrapeCourrier('fr')
  } catch (err) {
    console.error('  courrier failed wholesale:', err.message)
  }
  const courrier = backfillSections(courrierSecs, prevNews?.courrier, 'sectionKey')

  const armradio = {}
  for (const lang of ['en', 'hy']) {
    console.log(`\nArmRadio (${lang}) — ${lang}.armradio.am:`)
    let secs = []
    try {
      secs = await scrapeArmradioSections(10, lang)
    } catch (err) {
      console.error(`  armradio/${lang} failed:`, err.message)
    }
    armradio[lang] = backfillSections(secs, prevNews?.armradio?.[lang], 'categoryKey')
  }

  // Nouvelles d'Arménie (armenews.com) — French-only, six WordPress rubrics.
  console.log('\nNouvelles d\'Arménie — armenews.com:')
  let armenewsSecs = []
  try {
    armenewsSecs = await scrapeArmenews(10)
  } catch (err) {
    console.error('  armenews failed wholesale:', err.message)
  }
  const armenews = backfillSections(armenewsSecs, prevNews?.armenews, 'categoryKey')

  // Artzakank / Écho des Arméniens de Suisse (artzakank-echo.ch) — French-only,
  // two WordPress rubrics (Arménie & Artsakh, Communauté).
  console.log('\nArtzakank — artzakank-echo.ch:')
  let artzakankSecs = []
  try {
    artzakankSecs = await scrapeArtzakank(10)
  } catch (err) {
    console.error('  artzakank failed wholesale:', err.message)
  }
  const artzakank = backfillSections(artzakankSecs, prevNews?.artzakank, 'categoryKey')

  // Arménie Info TV (armenieinfo.tv) — French, HTML-scraped (REST is locked),
  // eight rubrics, deduped across rubrics by URL.
  console.log('\nArménie Info TV — armenieinfo.tv:')
  let aitvSecs = []
  try {
    aitvSecs = await scrapeArmenieInfoTv(10)
  } catch (err) {
    console.error('  armenieinfotv failed wholesale:', err.message)
  }
  const armenieinfotv = backfillSections(aitvSecs, prevNews?.armenieinfotv, 'categoryKey')

  // Armenpress — the national news agency, and the only trilingual source here
  // (fr/en/hy map 1:1). It does not lead the news tabs: Courrier is French-only
  // and prerenders more French copy. Seven rubrics x three languages = 21 pages,
  // spaced by its own module. Backfilled per language, exactly like armradio.
  console.log('\nArmenpress — armenpress.am (fr/en/hy, 7 rubriques):')
  // Seeded per language, not {}: backfillSections reads `fresh.length`, so an
  // undefined here would throw and take the whole snapshot down — every other
  // source in this file seeds [] for exactly that reason.
  let apLangs = { fr: [], en: [], hy: [] }
  try {
    apLangs = await scrapeArmenpress(10)
  } catch (err) {
    console.error('  armenpress failed wholesale:', err.message)
  }
  const armenpress = {}
  for (const lang of ['fr', 'en', 'hy']) {
    armenpress[lang] = backfillSections(apLangs[lang], prevNews?.armenpress?.[lang], 'categoryKey')
  }

  console.log('\nAgenda (armenopole.com):')
  let agenda = { switzerland: [], world: [] }
  try {
    agenda = await scrapeAgenda()
  } catch (err) {
    console.error('  agenda failed:', err.message)
  }
  // Backfill each column independently so a half-failed scrape still recovers.
  for (const key of ['switzerland', 'world']) {
    if (!agenda[key]?.length && prevAgenda?.[key]?.length) {
      console.warn(`  ↺ keeping ${prevAgenda[key].length} previous agenda/${key} events`)
      agenda[key] = prevAgenda[key]
    }
  }

  console.log('\nInstagram (curated · re-randomised):')
  let igPosts = []
  try {
    igPosts = await selectInstagram(30)
  } catch (err) {
    console.error('  instagram failed:', err.message)
  }
  if (!igPosts.length && prevIg?.posts?.length) {
    console.warn(`  ↺ keeping ${prevIg.posts.length} previous instagram posts`)
    igPosts = prevIg.posts
  }

  await writeJson('news.json', {
    generatedAt,
    courrier,
    armradio,
    armenews,
    artzakank,
    armenieinfotv,
    armenpress,
  })
  await writeJson('agenda.json', { generatedAt, ...agenda })
  await writeJson('instagram-feed.json', { generatedAt, posts: igPosts })
  await writeJson('meta.json', { generatedAt })
  await writeSitemap(generatedAt)

  console.log('\n✅ Snapshot complete.\n')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
