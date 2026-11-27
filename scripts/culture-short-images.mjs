// Les images d'un Short Culture (une par fait) : remplit meta.shortImages et
// télécharge short-<n>.jpg à côté de l'article (scripts/lib/culture-short-images.mjs).
//
//   node scripts/culture-short-images.mjs <slug> [--refresh] [--dry]
//
// Sans liste, elle est rassemblée depuis les articles Wikipédia du sujet ;
// avec, seules les entrées dont `file` a été remplacé à la main sont relues
// (--refresh rassemble à nouveau). --dry affiche sans rien écrire.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { syncShortImages } from './lib/culture-short-images.mjs'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/culture')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { refresh: { type: 'boolean' }, dry: { type: 'boolean' } },
})
const [slug] = positionals
if (!slug) throw new Error('usage : culture-short-images <slug> [--refresh] [--dry]')
const base = path.join(DIR, slug)
const metaPath = path.join(base, 'meta.json')
const meta = JSON.parse(await readFile(metaPath, 'utf-8'))

const target = values.dry ? await mkdtemp(path.join(os.tmpdir(), 'short-images-')) : base
const { lines, failed } = await syncShortImages(target, meta, { refresh: values.refresh })
console.log([`- image 1 : ${meta.image?.file ?? '(aucune)'} (photo de l'article)`, ...lines].join('\n'))
if (!values.dry) await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
else console.log(`--dry : meta.json inchangé, images dans ${target}`)
if (failed) process.exit(1)
