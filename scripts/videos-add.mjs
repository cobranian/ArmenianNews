// npm run videos:add -- --lang de alphabet-armenien=b-WvRlj1DdU ani=ke_0o2hQngU
// npm run videos:add -- --lang de --ids ../armenie-video/out/youtube/ids-de.txt
//
// Ajoute des Shorts publiés à src/data/culture-videos.json (la trace de ce qui
// est en ligne), titre et description tirés des métadonnées d'envoi.
// Options : --date AAAA-MM-JJ (défaut : aujourd'hui, UTC), --meta <dossier>
// (défaut : ../armenie-video/out/youtube), --force (remplacer un autre id),
// --dry (n'écrit rien).
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { ALL_LANGS } from '../sites.config.js'
import { addVideos, entryFromMeta, parseIdLines } from './lib/videos-add.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    lang: { type: 'string' },
    ids: { type: 'string' },
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
    meta: { type: 'string', default: path.join(root, '..', 'armenie-video', 'out', 'youtube') },
    force: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
  },
})
const { lang } = values
if (!ALL_LANGS.includes(lang)) throw new Error(`--lang attendu parmi ${ALL_LANGS.join(', ')}`)

const pairs = [
  ...(values.ids ? parseIdLines(await readFile(values.ids, 'utf8')) : []),
  ...positionals.map((p) => {
    const [slug, youtube] = p.split('=')
    if (!slug || !youtube) throw new Error(`argument illisible : « ${p} » (attendu : slug=id)`)
    return { slug, youtube }
  }),
]
if (!pairs.length) throw new Error('rien à ajouter : donnez slug=id ou --ids <fichier>')

const adds = []
for (const { slug, youtube } of pairs) {
  // Une vidéo ne s'affiche que sur la page de sa langue : l'article doit exister.
  await access(path.join(root, 'src/data/culture', slug, `${lang}.md`)).catch(() => {
    throw new Error(`${slug} n'existe pas en ${lang} (src/data/culture/${slug}/${lang}.md)`)
  })
  const metaFile = path.join(values.meta, `${slug}-${lang}.json`)
  const meta = JSON.parse(await readFile(metaFile, 'utf8').catch(() => { throw new Error(`métadonnées absentes : ${metaFile}`) }))
  adds.push({ slug, lang, entry: entryFromMeta(meta, { youtube, uploadDate: values.date }) })
}

const file = path.join(root, 'src/data/culture-videos.json')
const { videos, added, skipped } = addVideos(JSON.parse(await readFile(file, 'utf8')), adds, { force: values.force })
for (const a of added) console.log(`  + ${a}`)
for (const s of skipped) console.log(`  = ${s} (déjà là)`)
if (!values.dry && added.length) await writeFile(file, JSON.stringify(videos, null, 2) + '\n')
console.log(`${added.length} ajoutée(s), ${skipped.length} déjà présente(s)${values.dry ? ' — --dry : rien écrit' : ''}`)
