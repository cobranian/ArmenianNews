// Daily snapshot orchestrator.
// Scrapes news + agenda and writes them into src/data/*.json.
// NOTE: instagram.json and facebook.json are *curated* (see README) and are
// intentionally NOT overwritten here.
import { writeFile, mkdir } from 'node:fs/promises'
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

async function main() {
  const generatedAt = new Date().toISOString()
  console.log(`\n📜 Le Mur d'Armenie — snapshot ${generatedAt}\n`)

  console.log('Actualites (courrier.am):')
  let news = []
  try {
    news = await scrapeCourrier()
  } catch (err) {
    console.error('  courrier failed wholesale:', err.message)
  }

  console.log('\nArmRadio (en.armradio.am):')
  let armradio = []
  try {
    armradio = await scrapeArmradio(5)
  } catch (err) {
    console.error('  armradio failed:', err.message)
  }

  console.log('\nAgenda (armenopole.com):')
  let agenda = { switzerland: [], world: [] }
  try {
    agenda = await scrapeAgenda()
  } catch (err) {
    console.error('  agenda failed:', err.message)
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
