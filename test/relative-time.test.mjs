import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageParts, relativeAge } from '../src/relativeTime.js'
import { ALL_LANGS } from '../sites.config.js'

// L'âge des dépêches est écrit à la main dans les quatre langues, pour la même
// raison que les dates arméniennes (voir hy-date.test.mjs) : `Intl` ne sait pas
// rendre `hy` dans un navigateur et y retombe sur la langue du lecteur. Une
// table écrite à la main ne casse ni le build ni le lint quand elle se trompe —
// elle affiche juste une mauvaise unité, sous cent cartes à la fois.

const S = 1000
const M = 60 * S
const H = 60 * M
const D = 24 * H
const NOW = Date.UTC(2026, 6, 30, 12, 0, 0)
const ago = (ms, lang = 'fr') => relativeAge(new Date(NOW - ms).toISOString(), NOW, lang)

test('l’unité choisie est la plus grande qui reste ≥ 1', () => {
  assert.deepEqual(ageParts(1), { n: 1, unit: 's' })
  assert.deepEqual(ageParts(59), { n: 59, unit: 's' })
  assert.deepEqual(ageParts(60), { n: 1, unit: 'min' })
  assert.deepEqual(ageParts(3599), { n: 59, unit: 'min' })
  assert.deepEqual(ageParts(3600), { n: 1, unit: 'h' })
  assert.deepEqual(ageParts(86399), { n: 23, unit: 'h' })
  assert.deepEqual(ageParts(86400), { n: 1, unit: 'd' })
  assert.deepEqual(ageParts(86400 * 9), { n: 9, unit: 'd' })
})

test('les quatre seuils se lisent en français', () => {
  assert.equal(ago(30 * S), '30 s')
  assert.equal(ago(5 * M), '5 min')
  assert.equal(ago(3 * H), '3 h')
  assert.equal(ago(2 * D), '2 j')
})

test('aucune tournure autour du nombre, dans aucune langue', () => {
  // « il y a », « ago », « առաջ », « назад » ont été retirés : sous une carte,
  // la position dit déjà que c'est un âge.
  for (const lang of ALL_LANGS) {
    assert.match(ago(3 * H, lang), /^\d+\s\S+$/, `${lang} : « ${ago(3 * H, lang)} »`)
  }
})

test('chaque langue rend son unité, dans sa propre écriture', () => {
  assert.equal(ago(3 * H, 'fr'), '3 h')
  assert.equal(ago(3 * H, 'en'), '3 h') // identique au français, et c'est normal
  assert.equal(ago(3 * H, 'hy'), '3 ժամ')
  assert.equal(ago(3 * H, 'ru'), '3 ч')

  // LE défaut à attraper est précis : `Intl.RelativeTimeFormat('hy')` ne résout
  // pas dans un navigateur et retombe sur la langue DU LECTEUR — l'arménien
  // sortirait alors en latin ou en cyrillique. On vérifie donc l'ÉCRITURE, pas
  // la distinction des quatre chaînes : fr et en partagent « h » de plein droit.
  assert.match(ago(3 * H, 'hy'), /[԰-֏]/, 'hy doit être en écriture arménienne')
  assert.match(ago(5 * M, 'hy'), /[԰-֏]/, 'hy doit être en écriture arménienne')
  assert.match(ago(3 * H, 'ru'), /[Ѐ-ӿ]/, 'ru doit être en cyrillique')
  assert.doesNotMatch(ago(3 * H, 'fr'), /[԰-֏Ѐ-ӿ]/, 'fr doit rester latin')
})

test('les quatre langues couvrent les quatre unités', () => {
  for (const lang of ALL_LANGS) {
    for (const ms of [30 * S, 5 * M, 3 * H, 2 * D]) {
      const out = ago(ms, lang)
      assert.ok(out && !out.includes('undefined'), `${lang} / ${ms}ms : « ${out} »`)
    }
  }
})

// Les sources datent dans leur propre fuseau ; quelques minutes de décalage
// d'horloge suffisent à produire une date future. « dans 4 heures » sous une
// carte d'actualité se lit comme un bug — on ramène à une seconde.
test('une date future est ramenée à une seconde, jamais rendue au futur', () => {
  const futur = new Date(NOW + 4 * H).toISOString()
  assert.equal(relativeAge(futur, NOW, 'fr'), '1 s')
  assert.equal(relativeAge(futur, NOW, 'ru'), '1 с')
})

test('une date absente ou illisible ne rend rien', () => {
  assert.equal(relativeAge(null, NOW, 'fr'), '')
  assert.equal(relativeAge(undefined, NOW, 'fr'), '')
  assert.equal(relativeAge('', NOW, 'fr'), '')
  assert.equal(relativeAge('pas une date', NOW, 'fr'), '')
})
