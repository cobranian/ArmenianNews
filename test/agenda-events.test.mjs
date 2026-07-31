import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evenementComplet, evenementsAVenir } from '../src/agendaEvents.js'

const MAINTENANT = new Date('2050-06-15T00:00:00.000Z').getTime()
const AVENIR = '2050-06-16T00:00:00.000Z'
const PASSE = '2050-06-14T00:00:00.000Z'

const ev = (extra) => ({
  title: 'Concert',
  url: 'https://ex.org/a',
  location: 'Genève',
  date: AVENIR,
  ...extra,
})

test('un evenement complet passe, un champ manquant le disqualifie', () => {
  assert.equal(evenementComplet(ev()), true)
  for (const champ of ['title', 'url', 'date']) {
    assert.equal(evenementComplet(ev({ [champ]: undefined })), false, `${champ} absent`)
    assert.equal(evenementComplet(ev({ [champ]: null })), false, `${champ} null`)
    assert.equal(evenementComplet(ev({ [champ]: '' })), false, `${champ} vide`)
  }
})

// Le defaut vise : le scraper laisse DELIBEREMENT passer des evenements sans
// date (armenopole `upcoming`), et isoFromMonthDay rend null des qu'un libelle
// de mois change chez la source. Un tel evenement se rendait avec un <time>
// vide et comptait dans le total affiche, alors que le balisage l'omettait.
test('un evenement sans date n est ni rendu ni compte', () => {
  const liste = [ev(), ev({ url: 'https://ex.org/b', date: null }), ev({ url: 'https://ex.org/c', date: undefined })]
  const gardes = evenementsAVenir(liste, MAINTENANT)
  assert.deepEqual(
    gardes.map((e) => e.url),
    ['https://ex.org/a'],
  )
})

// LA RAISON D ETRE du filtre explicite, et elle n est pas theorique : les deux
// formes de date manquante ne se comportent PAS pareil face a une comparaison.
// `new Date(null)` vaut l epoque (0), donc `0 < maintenant` ecarte l evenement
// — par accident. `new Date(undefined)` vaut NaN, et toute comparaison sur NaN
// est fausse, donc un filtre purement temporel le LAISSE PASSER. Ce test fige
// l asymetrie : si quelqu un retire evenementComplet en jugeant la comparaison
// suffisante, c est ici que ca tombe.
test('la seule comparaison temporelle ne suffit pas : null vaut 0, undefined vaut NaN', () => {
  assert.equal(new Date(null).getTime(), 0)
  assert.ok(Number.isNaN(new Date(undefined).getTime()))
  const temporelSeul = [ev({ date: null }), ev({ date: undefined })].filter(
    (e) => !(new Date(e.date).getTime() < MAINTENANT),
  )
  assert.equal(temporelSeul.length, 1, 'un filtre temporel seul laisserait passer la forme NaN')
  assert.equal(evenementsAVenir([ev({ date: null }), ev({ date: undefined })], MAINTENANT).length, 0)
})

test('le passe est ecarte, la borne comprise', () => {
  const liste = [
    ev({ url: 'https://ex.org/passe', date: PASSE }),
    ev({ url: 'https://ex.org/pile', date: '2050-06-15T00:00:00.000Z' }),
    ev({ url: 'https://ex.org/avenir' }),
  ]
  assert.deepEqual(
    evenementsAVenir(liste, MAINTENANT).map((e) => e.url),
    ['https://ex.org/pile', 'https://ex.org/avenir'],
  )
})

// Le meme evenement est recense sur plusieurs pages pays chez armenopole : sans
// dedoublonnage, la page le listerait deux ou trois fois et le balisage aussi.
test('le dedoublonnage par URL garde la premiere occurrence', () => {
  const liste = [ev({ title: 'Premiere' }), ev({ title: 'Copie' })]
  const gardes = evenementsAVenir(liste, MAINTENANT)
  assert.equal(gardes.length, 1)
  assert.equal(gardes[0].title, 'Premiere')
})

// `maintenant` injectable : meme signature et meme raison que agendaJsonLd —
// aucun test de ce depot ne doit dependre de l horloge.
test('maintenant est injectable', () => {
  const liste = [ev({ date: PASSE })]
  assert.equal(evenementsAVenir(liste, MAINTENANT).length, 0)
  assert.equal(evenementsAVenir(liste, new Date('2050-06-13T00:00:00.000Z').getTime()).length, 1)
})
