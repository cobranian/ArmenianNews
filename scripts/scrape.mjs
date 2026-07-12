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

  await writeJson('news.json', { generatedAt, courrier, armradio })
  await writeJson('agenda.json', { generatedAt, ...agenda })
  await writeJson('instagram-feed.json', { generatedAt, posts: igPosts })
  await writeJson('meta.json', { generatedAt })

  console.log('\n✅ Snapshot complete.\n')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
