import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ngrams, overlapRatio, OVERLAP_THRESHOLD } from '../scripts/lib/culture-overlap.mjs'

const src = 'Komitas est né en 1869 à Kütahya dans une famille arménienne et devient prêtre puis musicologue renommé'

test('ngrams : mots pliés (casse, accents), ponctuation ignorée', () => {
  assert.deepEqual(ngrams('A, b. C', 2), ['a b', 'b c'])
  assert.deepEqual(ngrams('Été été', 2), ['ete ete'])
  assert.deepEqual(ngrams('un deux', 8), [])
})

test('copie intégrale → 1, texte propre → 0', () => {
  assert.equal(overlapRatio(src, [src]), 1)
  assert.equal(overlapRatio('Un tout autre texte qui ne doit rien à la source et parle de danse ici', [src]), 0)
})

test('paraphrase partielle → entre les deux', () => {
  const r = overlapRatio(`Introduction propre. ${src}. Conclusion propre et originale sur le sujet.`, [src])
  assert.ok(r > OVERLAP_THRESHOLD && r < 1, String(r))
})

test('arménien et russe : les lettres comptent comme des mots', () => {
  const hy = 'Կոմիտասը ծնվել է 1869 թվականին Քյոթահիայում հայկական ընտանիքում և դարձել երաժշտագետ'
  assert.equal(overlapRatio(hy, [hy]), 1)
  const ru = 'Комитас родился в 1869 году в Кютахье в армянской семье и стал музыковедом'
  assert.equal(overlapRatio(ru, [ru]), 1)
})

test('brouillon vide → 0', () => assert.equal(overlapRatio('', [src]), 0))
