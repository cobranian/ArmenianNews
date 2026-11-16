// Titre et description YouTube de chaque Short, à coller à la mise en ligne.
//
//   node scripts/describe.mjs [fr|en|hy|ru|de|it|es]   → youtube-meta/<slug>-<lang>.json
//
// Le texte vient de scripts/lib/youtube-meta.mjs du dépôt, le même que la CI
// met dans src/data/youtube-queue.json : crédit de la musique compris. Un Short
// déjà en ligne (culture-videos.json) garde son fichier : youtube-meta/ est
// l'historique de ce qui a été publié, le réécrire ne changerait rien sur YouTube.
// Lancer d'abord scripts/sync.mjs (src/shorts/data/ et credits.json).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { youtubeMeta } from '../../scripts/lib/youtube-meta.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lang = process.argv[2] ?? 'fr'
const read = async (f) => JSON.parse(await readFile(f, 'utf-8'))
const credits = await read(path.join(root, 'src/shorts/credits.json'))
const { BY_SLUG } = await read(path.join(root, 'src/shorts/music.json'))
const published = await read(path.join(root, '../src/data/culture-videos.json'))
const outDir = path.join(root, 'youtube-meta')
await mkdir(outDir, { recursive: true })

let n = 0
for (const f of (await readdir(path.join(root, 'src/shorts/data'))).filter((x) => x.endsWith('.json'))) {
  const data = await read(path.join(root, 'src/shorts/data', f))
  if (!data[lang] || published[data.slug]?.[lang]) continue
  const { title, description } = youtubeMeta({
    slug: data.slug,
    lang,
    short: data[lang],
    credit: credits[data.slug],
    music: BY_SLUG[data.slug] ?? 'otar',
  })
  await writeFile(path.join(outDir, `${data.slug}-${lang}.json`), `${JSON.stringify({ slug: data.slug, title, description }, null, 2)}\n`)
  n++
}
console.log(`${n} description(s) ${lang} écrite(s) dans youtube-meta/`)
