import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ALL_LANGS } from '../sites.config.js'

// Node ne sait pas importer du JSX : on lit `igStrands` comme du texte,
// exactement comme test/stations.test.mjs lit STATIONS et
// test/source-count.test.mjs lit TAB_ORDER.
const pool = JSON.parse(
  await readFile(new URL('../src/data/instagram.json', import.meta.url), 'utf-8'),
)
const jsx = await readFile(
  new URL('../src/components/Social.jsx', import.meta.url),
  'utf-8',
)
const i18n = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')

// Une entree d'igStrands, sur UNE ligne. Si prettier en enveloppe une, ce
// motif n'en trouve que trois et le premier test tombe — bruyamment, ce qui
// est le but : un brin muet est exactement ce qu'on refuse.
const strands = [
  ...jsx.matchAll(
    /\{\s*id:\s*'[\w-]+',\s*group:\s*'(\w+)',\s*title:\s*t\('([\w.]+)'\)\s*\}/g,
  ),
].map(([, group, key]) => ({ group, key }))

// Le repli est ecrit a deux endroits (scripts/sources/instagram.mjs et
// Social.jsx) : le test lit la meme regle, sinon il garderait autre chose que
// ce que le site affiche.
const groupOf = (acc) => acc.group || 'institutions'

test('le mur declare cinq brins', () => {
  assert.equal(strands.length, 5, 'igStrands ne declare plus cinq brins')
  assert.deepEqual(
    strands.map((s) => s.group).sort(),
    ['createurs', 'creation', 'institutions', 'personnalites', 'terre'],
  )
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Un `group` mal
// orthographie cree un cinquieme brin qu'igStrands ne rend jamais : le compte
// disparait du mur. C'est une chaine valide dans un JSON valide — ni le lint,
// ni le build, ni npm run check ne peuvent le voir.
test('aucun compte n est hors des cinq brins', () => {
  const declares = new Set(strands.map((s) => s.group))
  for (const acc of pool.accounts) {
    assert.ok(
      declares.has(groupOf(acc)),
      `@${acc.handle} porte group: '${groupOf(acc)}' — aucun brin ne le rend`,
    )
  }
})

test('aucun brin n est vide', () => {
  for (const s of strands) {
    const n = pool.accounts.filter((acc) => groupOf(acc) === s.group).length
    assert.ok(n > 0, `le brin '${s.group}' n a aucun compte — son titre serait mort`)
  }
})

// On compte les DECLARATIONS dans i18n.jsx : quatre par cle, une par bloc
// STRINGS. Trois suffiraient a l'affichage (le repli sur le francais masque le
// trou), et c'est precisement ce qu'il faut attraper — sinon le carrousel
// s'intitulerait `ig.strand.land`, cuit dans le HTML que Google indexe.
function declarations(cle) {
  return (i18n.match(new RegExp(`'${cle.replace(/\./g, '\\.')}':`, 'g')) || []).length
}

test('chaque brin a son titre dans les quatre langues', () => {
  for (const s of strands) {
    assert.equal(
      declarations(s.key),
      ALL_LANGS.length,
      `${s.key} manque dans un des quatre blocs STRINGS de src/i18n.jsx ` +
        `— le carrousel afficherait la cle elle-meme`,
    )
  }
})
