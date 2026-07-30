import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legacyImage, parseTimeText } from '../scripts/sources/newsam.mjs'

// Les trois verticales héritées de NEWS.am (sport / style / med) n'exposent
// aucune date lisible par une machine : pas d'attribut `datetime`, pas de
// JSON-LD, et med va jusqu'à omettre l'année. Deux dérivations comblent le
// trou, et ce sont les seules parties fragiles du module :
//
//   • l'URL de vignette, devinée depuis le mois de publication (l'RSS ne porte
//     ni <enclosure>, ni <media:content>) ;
//   • la date de med, recomposée en lisant le texte de <time> EN CHIFFRES —
//     jamais un nom de mois — pour qu'une seule règle couvre eng/arm/rus.
//
// Ces deux fonctions sont pures : elles se testent sans réseau, comme le reste
// de la suite. Sans ce test, une régression ne casserait ni le build, ni le
// lint — elle enverrait simplement des cartes au motif de repli et des dates
// silencieusement fausses.

// Erevan est à UTC+4 toute l'année (l'Arménie a abandonné l'heure d'été en
// 2012). Les deux dérivations en dépendent, dans des sens opposés : l'image
// veut le mois LOCAL, la date veut l'instant UTC.
const YEREVAN = '+04:00'

test('l’URL de vignette suit le mois de publication à Erevan', () => {
  assert.equal(
    legacyImage('sport.news.am', '168012', new Date(`2026-07-30T11:02:00${YEREVAN}`)),
    'https://sport.news.am/static/news/s/2026/07/168012.jpg',
  )
  assert.equal(
    legacyImage('style.news.am', '115371', new Date(`2026-07-30T16:18:00${YEREVAN}`)),
    'https://style.news.am/static/news/s/2026/07/115371.jpg',
  )
})

test('le mois de l’image est le mois LOCAL, pas le mois UTC', () => {
  // 1er août 02:00 à Erevan = 31 juillet 22:00 UTC. Lire l'UTC classerait
  // l'article dans le dossier de juillet et servirait un 404 — la carte
  // retomberait sur son motif sans que rien ne le signale.
  assert.equal(
    legacyImage('sport.news.am', '900001', new Date(`2026-08-01T02:00:00${YEREVAN}`)),
    'https://sport.news.am/static/news/s/2026/08/900001.jpg',
  )
  // Symétrique : 31 juillet 23:00 UTC est déjà le 1er août à Erevan.
  assert.equal(
    legacyImage('sport.news.am', '900002', new Date('2026-07-31T23:00:00Z')),
    'https://sport.news.am/static/news/s/2026/08/900002.jpg',
  )
})

test('sans identifiant ou sans date, aucune URL n’est devinée', () => {
  assert.equal(legacyImage('sport.news.am', null, new Date()), null)
  assert.equal(legacyImage('sport.news.am', '1', null), null)
})

// Le cœur du sujet : les trois langues, lues sans jamais nommer un mois.
// L'année et le mois viennent du chemin de l'image, le jour et l'heure du
// texte. « July 29 », « 29 հուլիսի » et « 29 июля » donnent tous 29.
test('la date de med se recompose dans les trois langues', () => {
  const img = '/static/news/s/2026/07/41598.jpg'
  const expected = new Date(`2026-07-29T20:34:00${YEREVAN}`).toISOString()
  assert.equal(parseTimeText('July 29, 20:34', img), expected)
  assert.equal(parseTimeText('29 հուլիսի, 20:34', img), expected)
  assert.equal(parseTimeText('29 июля, 20:34', img), expected)
})

test('l’ordre jour/heure est indifférent', () => {
  // La page d'accueil de med imprime « 20:53,  July 26 », sa page de fil
  // « July 26, 20:53 ». L'horloge est retirée AVANT de chercher le jour, donc
  // les deux se lisent pareil — sinon « 20 » passerait pour le jour.
  const img = '/static/news/s/2026/07/41576.jpg'
  const expected = new Date(`2026-07-26T20:53:00${YEREVAN}`).toISOString()
  assert.equal(parseTimeText('20:53,  July 26', img), expected)
  assert.equal(parseTimeText('July 26, 20:53', img), expected)
})

test('l’heure est lue comme une heure d’Erevan', () => {
  // 00:30 à Erevan le 1er = 20:30 UTC la veille. Traiter le texte comme de
  // l'UTC daterait l'article de quatre heures dans le futur.
  assert.equal(
    parseTimeText('July 1, 00:30', '/static/news/s/2026/07/1.jpg'),
    '2026-06-30T20:30:00.000Z',
  )
})

test('une date incomplète vaut mieux qu’une date inventée', () => {
  // Pas d'horloge, pas de jour, ou pas d'image : on renvoie null et la carte
  // part sans date, plutôt que de porter une date fausse.
  assert.equal(parseTimeText('July 29', '/static/news/s/2026/07/41598.jpg'), null)
  assert.equal(parseTimeText('20:34', '/static/news/s/2026/07/41598.jpg'), null)
  assert.equal(parseTimeText('July 29, 20:34', null), null)
  assert.equal(parseTimeText('July 29, 20:34', '/static/other/logo.png'), null)
})
