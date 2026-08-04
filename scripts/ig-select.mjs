/**
 * Re-tirer la sélection Instagram sans toucher au réseau.
 *
 * `instagram-feed.json` est ce que le site lit réellement ; le pool
 * (`instagram.json`) n'est que la réserve. Changer un `group`, ajouter un compte
 * ou récolter des posts ne se voit donc PAS avant un nouveau tirage — un brin
 * dont la sélection ne porte aucun post ne se rend pas du tout (`Social.jsx`,
 * `if (!posts.length) return null`), sans erreur ni test qui tombe, jusqu'au
 * prochain instantané horaire. Et un push sur `main` bâtit et déploie sans
 * scraper.
 *
 * `npm run scrape` ferait ce tirage, mais en re-grattant toutes les sources
 * d'actualité pour changer une sélection purement locale.
 *
 *   npm run ig-select
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectInstagram } from './sources/instagram.mjs'

const FEED = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'instagram-feed.json',
)

const previous = JSON.parse(await readFile(FEED, 'utf-8'))
const posts = await selectInstagram(18)

if (!posts.length) {
  console.log('✗ tirage vide — le fichier n est pas touché.')
  process.exit(1)
}

// `generatedAt` est CONSERVÉ : un re-tirage n'est pas un instantané. Aucune
// source n'a été relue, et le bousculer annoncerait une fraîcheur qui n'a pas
// eu lieu.
await writeFile(
  FEED,
  JSON.stringify({ generatedAt: previous.generatedAt, posts }, null, 2) + '\n',
)

const parGroupe = {}
for (const p of posts) parGroupe[p.group] = (parGroupe[p.group] || 0) + 1
console.log(`\n✓ src/data/instagram-feed.json — ${posts.length} posts`)
for (const [g, n] of Object.entries(parGroupe)) console.log(`   ${g}: ${n}`)
console.log(`   generatedAt inchangé (${previous.generatedAt})`)
