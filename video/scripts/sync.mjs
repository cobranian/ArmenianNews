// Rapatrie depuis les articles Culture (../src/data/culture/<slug>/) ce dont
// les Shorts ont besoin, pour chaque article qui a un short.fr.json :
//   - les textes short.<lang>.json → src/shorts/data/<slug>.json (le format
//     que lit Remotion, sept langues par fichier ; dossier régénéré, hors git) ;
//   - la piste choisie dans short.fr.json (`music`) → music.json#BY_SLUG (les
//     slugs sans short, comme Garni, gardent leur entrée écrite à la main) ;
//   - la photo de l'article → public/photos/<slug>.jpg ;
//   - son crédit (auteur, licence, page Commons) → src/shorts/credits.json ;
//   - la liste des Shorts → src/shorts/all.ts (imports statiques : le bundler
//     de Remotion ne lit pas un dossier à l'exécution).
//
// Le texte d'un Short se corrige donc dans l'article, jamais dans src/shorts/data/.
//
//   node scripts/sync.mjs
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const culture = path.resolve(root, '../src/data/culture')
const dataDir = path.join(root, 'src/shorts/data')
const musicPath = path.join(root, 'src/shorts/music.json')
const LANGS = ['fr', 'en', 'hy', 'ru', 'de', 'it', 'es']
const TRACK_IDS = ['mazia', 'sergo', 'otar']

const slugs = (await readdir(culture, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && existsSync(path.join(culture, d.name, 'short.fr.json')))
  .map((d) => d.name)
  .sort()

// Un fait par ligne, comme les fichiers écrits à la main avant la migration :
// le diff d'un texte reste lisible.
const json = (v) => JSON.stringify(v)
const factLine = (f) => `{ ${Object.entries(f).map(([k, v]) => `${json(k)}: ${json(v)}`).join(', ')} }`
const langBlock = (s) =>
  `{\n    "facts": [\n${s.facts.map((f) => `      ${factLine(f)}`).join(',\n')}\n    ],\n` +
  ['outroTitle', 'ytTitle', 'ytLead'].map((k) => `    ${json(k)}: ${json(s[k])}`).join(',\n') +
  '\n  }'

const music = JSON.parse(await readFile(musicPath, 'utf-8'))
await rm(dataDir, { recursive: true, force: true })
await mkdir(dataDir, { recursive: true })
for (const slug of slugs) {
  const blocks = [`  "slug": ${json(slug)}`]
  for (const lang of LANGS) {
    const file = path.join(culture, slug, `short.${lang}.json`)
    if (!existsSync(file)) continue
    const short = JSON.parse(await readFile(file, 'utf-8'))
    if (lang === 'fr') {
      if (!TRACK_IDS.includes(short.music)) throw new Error(`${slug} : music « ${short.music} » inconnue (short.fr.json)`)
      music.BY_SLUG[slug] = short.music
    }
    blocks.push(`  ${json(lang)}: ${langBlock(short)}`)
  }
  await writeFile(path.join(dataDir, `${slug}.json`), `{\n${blocks.join(',\n')}\n}\n`)
}
await writeFile(musicPath, `${JSON.stringify(music, null, 2)}\n`)

await mkdir(path.join(root, 'public/photos'), { recursive: true })
const credits = {}
for (const slug of slugs) {
  const meta = JSON.parse(await readFile(path.join(culture, slug, 'meta.json'), 'utf-8'))
  if (!meta.image) throw new Error(`${slug} : l'article n'a pas d'image`)
  await copyFile(path.join(culture, slug, 'image.jpg'), path.join(root, 'public/photos', `${slug}.jpg`))
  credits[slug] = { author: meta.image.author, license: meta.image.license, commonsUrl: meta.image.commonsUrl }
}
await writeFile(path.join(root, 'src/shorts/credits.json'), `${JSON.stringify(credits, null, 2)}\n`)

const id = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
await writeFile(
  path.join(root, 'src/shorts/all.ts'),
  `// Généré par scripts/sync.mjs — ne pas éditer.\n` +
    slugs.map((s) => `import ${id(s)} from './data/${s}.json'`).join('\n') +
    `\nimport type { ShortData } from './types'\n\nexport const SHORTS: ShortData[] = [${slugs.map(id).join(', ')}] as ShortData[]\n`,
)
console.log(`${slugs.length} Shorts : ${slugs.join(', ')}`)
