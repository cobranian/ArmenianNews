// Invariant : le numéro hebdomadaire ne dépend que de ses arguments (jamais de
// l'horloge), reste dans la langue et le domaine de sa vitrine, et un titre
// ne peut pas casser le Markdown de son lien.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isoWeek, digestFor } from '../scripts/lib/newsletter.mjs'
import { briefUrl, urlFor, agendaCountryUrl } from '../sites.config.js'

const now = new Date('2026-11-02T05:30:00Z') // lundi, semaine 45
const day = (n) => new Date(Date.UTC(2026, 10, 2 - n)).toISOString().slice(0, 10)
const brief = (date, title = `Sujet ${date}`) => ({ date, generatedAt: `${date}T06:00:00Z`, intro: 'i', topics: [{ title, text: 't', rubric: 'armenia', sources: [] }] })
const briefsOf = (lang, titles = {}) => ({ [lang]: [1, 2, 3, 4, 5, 6, 7].map((n) => brief(day(n), titles[n])) })
const article = (date = day(2)) => ({ slug: 'duduk', date, langs: { fr: { title: 'Le duduk', description: 'Un hautbois.' }, en: { title: 'The duduk', description: 'An oboe.' } } })
const events = (n = 12, offsetDays = 3) =>
  Array.from({ length: n }, (_, i) => ({
    title: `Concert ${i}`,
    url: `https://armenopole.com/c${i}.html`,
    location: 'Genève',
    country: 'switzerland',
    date: new Date(Date.UTC(2026, 10, 2 + offsetDays, 10 + (i % 8), 0)).toISOString().slice(0, 16),
  }))

test('isoWeek', () => {
  assert.equal(isoWeek(now), '2026-W45')
  assert.equal(isoWeek(new Date('2027-01-01T12:00:00Z')), '2026-W53')
})

test('semaine vide = null', () => {
  assert.equal(digestFor('ch', { briefs: { fr: [] }, culture: [], events: events(), now }), null)
})

test('numéro .ch en français', () => {
  const d = digestFor('ch', { briefs: briefsOf('fr'), culture: [article()], events: events(), now })
  assert.equal(d.week, '2026-W45')
  assert.match(d.subject, /^Arménie Info/)
  assert.equal(d.body.split(briefUrl('fr')).length - 1, 7)
  assert.ok(d.body.includes('culture/duduk/'))
  assert.equal((d.body.match(/Concert \d+/g) || []).length, 8)
  const links = d.body.match(/\]\((https:[^)]*)\)/g)
  assert.ok(links.length >= 16)
  for (const l of links) assert.ok(l.includes('utm_campaign=hebdo-2026-W45'), l)
})

test('numéro .org en anglais', () => {
  const d = digestFor('org', { briefs: briefsOf('en'), culture: [article()], events: events(), now })
  assert.match(d.subject, /^Armenia News — week of/)
  assert.ok(d.body.includes('armenianews.org'))
  assert.ok(!d.body.includes('armenieinfo.ch'))
})

test('hors fenêtre exclu', () => {
  const d = digestFor('ch', {
    briefs: { fr: [brief(day(1), 'Récente'), brief(day(8), 'Trop vieille')] },
    culture: [],
    events: [...events(1, 3), { ...events(1)[0], title: 'Loin', url: 'https://armenopole.com/loin.html', date: '2026-11-17T12:00' }],
    now,
  })
  assert.ok(d.body.includes('Récente'))
  assert.ok(!d.body.includes('Trop vieille'))
  assert.ok(!d.body.includes('Loin'))
})

test('Markdown sûr', () => {
  const d = digestFor('ch', { briefs: briefsOf('fr', { 1: 'Titre ] avec (parenthèse) et [crochet' }), culture: [], events: [], now })
  assert.ok(d.body.includes('[Titre \\] avec \\(parenthèse\\) et \\[crochet]('))
})

test('lien agenda : lieu inconnu, pays trop mince, pays assez fourni', () => {
  const ev = (i, location, country) => ({ title: `E${i}`, url: `https://armenopole.com/e${i}.html`, location, country, date: '2026-11-04T12:00' })
  const evs = [ev(1, 'Atlantis', 'atlantis'), ev(2, 'Genève', 'switzerland'), ev(3, 'Genève', 'switzerland'), ev(4, 'Genève', 'switzerland'), ev(5, 'Paris', 'france')]
  const d = digestFor('ch', { briefs: briefsOf('fr'), culture: [], events: evs, now })
  const ligne = (t) => d.body.split(/\r?\n/).find((l) => l.includes(t))
  assert.ok(ligne('E1').includes('(' + urlFor('fr', 'agenda') + '?utm'))
  assert.ok(ligne('E5').includes('(' + urlFor('fr', 'agenda') + '?utm'))
  assert.ok(ligne('E2').includes(agendaCountryUrl('fr', 'switzerland') + '?utm'))
  assert.ok(ligne('E5').includes('utm_campaign=hebdo-2026-W45'))
})

test('fenêtre : la semaine ISO précédente, lundi–dimanche, quel que soit le jour du passage', () => {
  // day(7) = lundi 26 oct., day(1) = dimanche 1er nov. ; day(0) = lundi 2 nov.
  const briefs = { fr: [brief(day(8), 'Dimanche-avant'), brief(day(7), 'Lundi-couvert'), brief(day(1), 'Dimanche-couvert'), brief(day(0), 'Lundi-courant'), brief(day(-1), 'Mardi-courant')] }
  const lundi = digestFor('ch', { briefs, culture: [], events: [], now })
  const mardi = digestFor('ch', { briefs, culture: [], events: [], now: new Date('2026-11-03T05:50:00Z') })
  const mercredi = digestFor('ch', { briefs, culture: [], events: [], now: new Date('2026-11-04T23:59:00Z') })
  for (const d of [lundi, mardi, mercredi]) {
    assert.ok(d.body.includes('Lundi-couvert') && d.body.includes('Dimanche-couvert'))
    assert.ok(!d.body.includes('Dimanche-avant') && !d.body.includes('Lundi-courant') && !d.body.includes('Mardi-courant'))
    assert.equal(d.week, '2026-W45') // clé du registre : la semaine de l'envoi
    assert.equal(d.subject, 'Arménie Info — la semaine du 26 octobre') // lundi de la semaine couverte
  }
  assert.equal(mardi.body, lundi.body)
  // Un passage du dimanche couvre encore la semaine d'avant, pas la sienne.
  const dimanche = digestFor('ch', { briefs, culture: [], events: [], now: new Date('2026-11-08T12:00:00Z') })
  assert.ok(dimanche.body.includes('Lundi-couvert') && !dimanche.body.includes('Lundi-courant'))
})

test('Markdown sûr : < > * _ et barre inverse échappés dans les titres, descriptions et événements', () => {
  const piege = 'A <b>x</b> *gras* _it_ \\'
  const attendu = 'A \\<b\\>x\\</b\\> \\*gras\\* \\_it\\_ \\\\'
  const art = { slug: 'duduk', date: day(2), langs: { fr: { title: piege, description: `Desc ${piege}` } } }
  const ev = { title: piege, url: 'https://armenopole.com/p.html', location: 'Genève', country: 'switzerland', date: '2026-11-05T12:00' }
  const d = digestFor('ch', { briefs: briefsOf('fr', { 1: piege }), culture: [art], events: [ev], now })
  assert.ok(!d.body.includes('<b>'))
  assert.equal(d.body.split(`[${attendu}](`).length - 1, 2) // brève + article
  assert.ok(d.body.includes(`\n  Desc ${attendu}`))
  assert.ok(d.body.includes(`- [${attendu} — `))
  // Les URL, elles, ne sont pas touchées (utm_source garde ses _).
  assert.ok(d.body.includes('?utm_source=newsletter&utm_medium=email'))
})
