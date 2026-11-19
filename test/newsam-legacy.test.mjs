import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legacyImage } from '../scripts/sources/newsam.mjs'

// Les deux verticales héritées de NEWS.am (sport / style) n'exposent aucune
// image dans leur RSS (ni <enclosure>, ni <media:content>) : l'URL de vignette
// est devinée depuis le mois de publication. C'est une fonction pure ; sans ce
// test, une régression ne casserait ni le build ni le lint, elle enverrait
// simplement des cartes au motif de repli. (med.news.am a rejoint l'app
// Inertia de news.am le 19 nov. 2026 : sa date se lit dans le payload, plus
// dans le texte de <time>.)

// Erevan est à UTC+4 toute l'année (l'Arménie a abandonné l'heure d'été en
// 2012). L'image est rangée sous le mois LOCAL.
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
