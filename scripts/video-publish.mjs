#!/usr/bin/env node
/**
 * Les Shorts rendus d'un article : release, manifeste des Reels, file YouTube.
 *
 *   node scripts/video-publish.mjs <slug> --plan              langues à rendre (« fr,en,… », vide si aucune ;
 *                                                             vide faute de Short conforme : erreurs sur stderr, code 1)
 *   node scripts/video-publish.mjs <slug> --dir video/out [--dry]
 *
 * Les langues sont celles de validateArticle(...).shorts, moins celles déjà
 * sur YouTube ou déjà en file (culture-video-plan.mjs). Pour chacune dont <dir>/<lang>/<slug>.mp4
 * existe — render-all.mjs efface un rendu raté, un MP4 présent est donc conforme :
 *   1. envoi dans la release `reels-1` sous assetName(lang, slug), --clobber ;
 *   2. inscription dans src/data/reels.json (addReels) — APRÈS l'envoi : une
 *      entrée sans vidéo servirait un 404 à Facebook et Instagram ;
 *   3. mise en file dans src/data/youtube-queue.json (enqueue).
 * --dry : dit ce qui serait envoyé et écrit, sans appeler gh ni écrire.
 * --register-only : étapes 2 et 3 seules, les MP4 étant déjà dans la release —
 *   la reprise de video.yml quand son push sur main est refusé (repartie de
 *   main, elle refait l'inscription sans renvoyer les vidéos).
 * Le commit est l'affaire du workflow (video.yml).
 */
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { CULTURE_SLUG } from '../sites.config.js'
import { readArticle, readVideos } from './lib/culture-load.mjs'
import { validateArticle } from './lib/culture-validate.mjs'
import { planBlockers, videoLangs } from './lib/culture-video-plan.mjs'
import { addReels, assetName, readReels } from './lib/reels-add.mjs'
import { enqueue, readQueue } from './lib/youtube-queue.mjs'
import { musicLine, youtubeMeta } from './lib/youtube-meta.mjs'
import { usableShortImages } from './lib/culture-short-images.mjs'

const RELEASE = 'reels-1'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const REELS = path.join(root, 'src/data/reels.json')
const QUEUE = path.join(root, 'src/data/youtube-queue.json')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string' },
    dry: { type: 'boolean', default: false },
    plan: { type: 'boolean', default: false },
    'register-only': { type: 'boolean', default: false },
  },
})
const [slug] = positionals
if (!slug || !CULTURE_SLUG.test(slug)) throw new Error('usage : video-publish <slug> --plan | --dir <mp4s> [--dry | --register-only]')
if (!values.plan && !values.dir) throw new Error('--dir <dossier des rendus> (ou --plan)')

const videos = await readVideos(DIR)
const article = await readArticle(DIR, slug)
const result = validateArticle({ ...article, videos })
const before = await readQueue(QUEUE)
const langs = videoLangs(result, { slug, videos, queue: before })
if (values.plan) {
  console.log(langs.join(','))
  // Plan vide faute de Short conforme : les erreurs sur stderr, une par ligne,
  // et un code de sortie non nul — video.yml en fait des ::error::.
  const blockers = planBlockers(result, langs)
  for (const e of blockers) console.error(e)
  process.exit(blockers.length ? 1 : 0)
}
if (!langs.length) {
  console.log(`${slug} : aucun Short à publier (absent, non conforme, déjà en file ou sur YouTube)`)
  process.exit(0)
}

const dir = path.resolve(values.dir)
const found = []
for (const lang of langs) {
  const mp4 = path.join(dir, lang, `${slug}.mp4`)
  if (existsSync(mp4)) found.push({ lang, mp4 })
  else console.warn(`  ✗ ${slug}/${lang} : ${path.relative(root, mp4)} absent (rendu en échec ?)`)
}
if (!found.length) throw new Error(`${slug} : aucun rendu trouvé dans ${dir}/<lang>/${slug}.mp4`)

// Le Short français porte la piste ; meta.json, le crédit de la photo.
const music = musicLine(result.frShort.music)
if (!article.meta.image) throw new Error(`${slug} : l'article n'a pas d'image, pas de Short possible`)
// Toutes les photos du Short (une par fait), dans l'ordre de l'écran : la
// même liste que video/scripts/sync.mjs (usableShortImages).
const credit = [article.meta.image, ...usableShortImages(path.join(DIR, slug), article.meta).map((u) => u.entry)].map(
  ({ author, license, commonsUrl }) => ({ author, license, commonsUrl }),
)
const items = found.map(({ lang }) => ({
  slug,
  lang,
  asset: assetName(lang, slug),
  ...youtubeMeta({ slug, lang, short: result.shorts[lang], credit, music: result.frShort.music }),
}))
const { reels, added } = addReels(await readReels(REELS), items.map(({ lang, asset }) => ({ slug, lang, asset, music })))
const queue = enqueue(before, items, new Date(), { videos })
const queued = queue.items.slice(before.items.length).map((i) => `${i.slug}/${i.lang}`)

for (const f of found) console.log(`  ↑ ${path.relative(root, f.mp4)} → ${RELEASE}/${assetName(f.lang, slug)}`)
console.log(`  reels.json : ${added.length ? added.join(', ') : 'inchangé'}\n    ${music}`)
console.log(`  youtube-queue.json : ${queued.length ? queued.join(', ') : 'inchangé'}`)
if (values.dry) {
  for (const i of items) console.log(`\n--- ${i.lang} : ${i.title}\n${i.description}`)
  console.log(`\n--dry : rien envoyé, rien écrit (${found.length} Short(s))`)
  process.exit(0)
}

// La release nomme le fichier d'après son nom sur disque : copie renommée.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'video-'))
try {
  for (const f of values['register-only'] ? [] : found) {
    const copy = path.join(tmp, assetName(f.lang, slug))
    await copyFile(f.mp4, copy)
    execFileSync('gh', ['release', 'upload', RELEASE, copy, '--clobber'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] })
    console.log(`  ✓ ${assetName(f.lang, slug)}`)
  }
} finally {
  await rm(tmp, { recursive: true, force: true })
}
await writeFile(REELS, `${JSON.stringify(reels, null, 2)}\n`)
await writeFile(QUEUE, `${JSON.stringify(queue, null, 2)}\n`)
console.log(`${found.length} Short(s) ${values['register-only'] ? 'déjà dans la release' : 'envoyé(s)'} ; ${added.length} Reel(s) et ${queued.length} envoi(s) YouTube inscrits`)
