// Rapatrie depuis ArmenianNews ce dont les Shorts ont besoin, pour chaque
// fichier de faits src/shorts/data/<slug>.json :
//   - la photo de l'article → public/photos/<slug>.jpg ;
//   - son crédit (auteur, licence, page Commons) → src/shorts/credits.json ;
//   - la liste des Shorts → src/shorts/all.ts (imports statiques : le bundler
//     de Remotion ne lit pas un dossier à l'exécution).
//
//   node scripts/sync.mjs
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const culture = path.resolve(root, '../src/data/culture')
const dataDir = path.join(root, 'src/shorts/data')

const slugs = (await readdir(dataDir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
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
