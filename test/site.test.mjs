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

test("orderedLangs ne modifie pas le tableau reçu", () => {
  const avant = LANGS.map((l) => l.code)
  orderedLangs(LANGS)
  assert.deepEqual(LANGS.map((l) => l.code), avant, 'LANGS a été trié sur place')
})
