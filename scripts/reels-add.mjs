// npm run reels:add -- [--lang xx] [--slug s] [--dry] [--force]
//
// Envoie les Shorts rendus (../armenie-video/out/<lang>/<slug>.mp4) dans la
// release GitHub `reels-1`, sous le nom <lang>-<slug>.mp4, puis les inscrit
// dans src/data/reels.json — le manifeste qui fait foi pour les Reels
// Facebook et Instagram (scripts/lib/reels-add.mjs). LOCAL seulement, jamais
// en CI : les vidéos ne vivent que sur ce poste.
//
// Sans --lang / --slug : toutes les langues, tous les articles qui ont leur
// MP4. L'envoi précède l'écriture : une entrée sans vidéo dans la release
// servirait un 404 aux plateformes. --dry : dit ce qui serait envoyé et
// écrit, sans appeler gh ni toucher au fichier. --force : ré-envoie (--clobber)
// chaque MP4 trouvé même si son entrée du manifeste est inchangée (Short
// re-rendu, même musique).
import { access, copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { ALL_LANGS } from '../sites.config.js'
import { addReels, assetName, readReels, toUpload } from './lib/reels-add.mjs'
import { musicCredit } from '../../armenie-video/scripts/music.mjs'

const RELEASE = 'reels-1'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({
  options: {
    lang: { type: 'string' },
    slug: { type: 'string' },
    out: { type: 'string', default: path.join(root, '..', 'armenie-video', 'out') },
    dry: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
})
if (values.lang && !ALL_LANGS.includes(values.lang)) throw new Error(`--lang attendu parmi ${ALL_LANGS.join(', ')}`)
const langs = values.lang ? [values.lang] : ALL_LANGS
const exists = (f) => access(f).then(() => true, () => false)

// Un Reel reprend l'article : il faut l'article dans la langue ET sa vidéo.
const cultureDir = path.join(root, 'src/data/culture')
const slugs = values.slug ? [values.slug] : (await readdir(cultureDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
const found = []
for (const slug of slugs)
  for (const lang of langs) {
    const mp4 = path.join(values.out, lang, `${slug}.mp4`)
    if (!(await exists(path.join(cultureDir, slug, `${lang}.md`))) || !(await exists(mp4))) continue
    found.push({ slug, lang, mp4, asset: assetName(lang, slug), music: musicCredit(slug) })
  }
if (!found.length) throw new Error(`aucun Short trouvé (${values.out}/<lang>/<slug>.mp4, avec son article)`)

const file = path.join(root, 'src/data/reels.json')
const { reels, added } = addReels(await readReels(file), found)
const todo = toUpload(found, added, values.force)
for (const f of todo) console.log(`  ↑ ${path.relative(root, f.mp4)} → ${RELEASE}/${f.asset}\n    ${f.music}`)
if (values.dry) {
  console.log(`${todo.length} Reel(s) à envoyer et inscrire — --dry : rien envoyé, rien écrit`)
  if (todo.length) console.log(JSON.stringify(reels, null, 2))
  process.exit(0)
}

const gh = (...a) => execFileSync('gh', a, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] }).toString()
if (todo.length) {
  try {
    gh('release', 'view', RELEASE)
  } catch {
    gh('release', 'create', RELEASE, '--title', 'Reels', '--notes', 'Les Shorts Culture en musique, servis aux Reels Facebook et Instagram (src/data/reels.json). Ne pas supprimer : les plateformes y lisent les vidéos.')
    console.log(`· release ${RELEASE} créée`)
  }
  // La release nomme le fichier d'après son nom sur disque : copie renommée.
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'reels-'))
  try {
    for (const f of todo) {
      const copy = path.join(tmp, f.asset)
      await copyFile(f.mp4, copy)
      gh('release', 'upload', RELEASE, copy, '--clobber')
      console.log(`  ✓ ${f.asset}`)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
  await writeFile(file, JSON.stringify(reels, null, 2) + '\n')
}
console.log(`${todo.length} Reel(s) envoyé(s) et inscrit(s) dans src/data/reels.json${todo.length ? ' — à pousser (PR)' : ''}`)
