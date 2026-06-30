// Daily snapshot orchestrator.
// Scrapes news + agenda and writes them into src/data/*.json.
// NOTE: instagram.json and facebook.json are *curated* (see README) and are
// intentionally NOT overwritten here.
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scrapeCourrier } from './sources/courrier.mjs'
import { scrapeArmradio } from './sources/armradio.mjs'
import { scrapeAgenda } from './sources/armenopole.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'src', 'data')

async function writeJson(name, data) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`→ wrote src/data/${name}`)
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

  console.log('Actualites (courrier.am):')
  let news = []
  try {
    news = await scrapeCourrier()
  } catch (err) {
    console.error('  courrier failed wholesale:', err.message)
  }
  if (!news.length && prevNews?.sections?.length) {
    console.warn(`  ↺ keeping ${prevNews.sections.length} previous news sections`)
    news = prevNews.sections
  } else if (prevNews?.sections?.length) {
    // Backfill any individual section that came back empty.
    const prevBySection = Object.fromEntries(
      prevNews.sections.map((s) => [s.sectionKey, s.articles || []]),
    )
    for (const sec of news) {
      if (!sec.articles?.length && prevBySection[sec.sectionKey]?.length) {
        console.warn(`  ↺ keeping ${prevBySection[sec.sectionKey].length} previous ${sec.sectionKey} articles`)
        sec.articles = prevBySection[sec.sectionKey]
      }
    }
  }

  console.log('\nArmRadio (en.armradio.am):')
  let armradio = []
  try {
    armradio = await scrapeArmradio(5)
  } catch (err) {
    console.error('  armradio failed:', err.message)
  }
  if (!armradio.length && prevNews?.armradio?.length) {
    console.warn(`  ↺ keeping ${prevNews.armradio.length} previous armradio headlines`)
    armradio = prevNews.armradio
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

  await writeJson('news.json', { generatedAt, sections: news, armradio })
  await writeJson('agenda.json', { generatedAt, ...agenda })
  await writeJson('meta.json', { generatedAt })

  console.log('\n✅ Snapshot complete.\n')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
