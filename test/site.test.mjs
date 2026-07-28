import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SITE_ID, orderedLangs } from '../src/site.js'
import { LANGS } from '../sites.config.js'

test("SITE_ID retombe sur 'ch' hors Vite", () => {
  // import.meta.env n'existe pas sous Node : le chaînage optionnel est ce qui
  // rend vrai le repli que le commentaire de src/site.js promet.
  assert.equal(SITE_ID, 'ch')
})

test('orderedLangs met la langue du domaine en tête', () => {
  assert.equal(orderedLangs(LANGS)[0].code, 'fr') // SITE_ID vaut 'ch' ici
})

test("orderedLangs préserve l'ordre relatif des autres langues", () => {
  // Le comparateur renvoie 0 pour toute paire sans la langue de tête : les
  // trois autres ne gardent leur ordre que grâce à la stabilité de sort.
  assert.deepEqual(
    orderedLangs(LANGS).map((l) => l.code),
    ['fr', 'en', 'hy', 'ru'],
  )
})

test("orderedLangs ne trie pas le tableau reçu sur place", () => {
  // Entrée volontairement dans le DÉSORDRE : fr en dernier, donc le tri doit
  // réellement permuter. Avec LANGS tel quel (fr déjà en tête) le tri ne fait
  // rien, et le test passerait même sans la copie — il ne prouverait rien.
  const entree = [...LANGS].reverse() // ru, hy, en, fr
  const avant = entree.map((l) => l.code)
  const sortie = orderedLangs(entree)
  assert.equal(sortie[0].code, 'fr', 'la sortie doit bien être triée')
  assert.deepEqual(
    entree.map((l) => l.code),
    avant,
    'le tableau reçu a été trié sur place — la copie [...langs] a disparu',
  )
})
