// Migration unique (16 nov. 2026) : le texte des Shorts quitte
// video/src/shorts/data/<slug>.json (sept langues par fichier) pour vivre à
// côté de son article, src/data/culture/<slug>/short.<lang>.json.
//   - fr reçoit `music`, tirée de video/src/shorts/music.json#BY_SLUG (otar
//     par défaut, écrit en toutes lettres : plus de repli silencieux) ;
//   - chaque autre langue reçoit `sourceHash` = shortHash(fr) : elle est à jour.
//
//   node scripts/culture-short-split.mjs [dossier-source]
//
// Après elle, video/scripts/sync.mjs régénère video/src/shorts/data/ depuis
// les articles. Ne la relancez pas : elle écraserait des shorts retouchés.
import { readdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { shortHash } from './lib/culture-short.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.resolve(process.argv[2] ?? path.join(root, 'video/src/shorts/data'))
const culture = path.join(root, 'src/data/culture')
const { BY_SLUG } = JSON.parse(await readFile(path.join(root, 'video/src/shorts/music.json'), 'utf8'))
const LANGS = ['fr', 'en', 'hy', 'ru', 'de', 'it', 'es']

const pick = ({ facts, outroTitle, ytTitle, ytLead }) => ({ facts, outroTitle, ytTitle, ytLead })

let n = 0
for (const file of (await readdir(src)).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(await readFile(path.join(src, file), 'utf8'))
  const slug = data.slug ?? file.slice(0, -5)
  const dir = path.join(culture, slug)
  await access(path.join(dir, 'fr.md')) // un short sans article est une erreur, pas un oubli
  if (!data.fr) throw new Error(`${slug} : pas de short fr`)
  const fr = { ...pick(data.fr), music: BY_SLUG[slug] ?? 'otar' }
  const hash = shortHash(fr)
  for (const lang of LANGS) {
    if (!data[lang]) continue
    const short = lang === 'fr' ? fr : { ...pick(data[lang]), sourceHash: hash }
    await writeFile(path.join(dir, `short.${lang}.json`), `${JSON.stringify(short, null, 2)}\n`)
    n++
  }
}
console.log(`${n} fichiers short.<lang>.json écrits`)
