// Invariant : un événement de l'agenda argentin n'existe que si sa date est SÛRE
// (lue dans le texte, jamais devinée), en heure murale sans fuseau, et il passe
// les mêmes filtres que ceux d'Armenopole (evenementComplet, eventLd).
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSpanishEventDate, parseAgendaPosts, mergeDiarioIntoWorld } from '../scripts/sources/diarioarmenia-agenda.mjs'
import { evenementComplet, evenementsAVenir, eventLd } from '../src/agendaEvents.js'
import { worldCountryKey, placeLabel } from '../src/worldPlace.js'

const NOW = new Date('2026-10-31T12:00:00')

test('parseSpanishEventDate : jour, mois et heure', () => {
  assert.equal(parseSpanishEventDate('sábado 8 de noviembre a las 19 hs', NOW), '2026-11-08T19:00')
  assert.equal(parseSpanishEventDate('Domingo 16 de noviembre, 12:30 hs', NOW), '2026-11-16T12:30')
  assert.equal(parseSpanishEventDate('el jueves 26 de noviembre, a las 20, en el salón', NOW), '2026-11-26T20:00')
  assert.equal(parseSpanishEventDate('los sábados 14, 21 y 28 de noviembre, a las 19.30', NOW), '2026-11-14T19:30')
  assert.equal(parseSpanishEventDate('el domingo 1° de noviembre en la Catedral', NOW), '2026-11-01T23:59')
  assert.equal(parseSpanishEventDate('del 3 al 16 de enero de 2027', NOW), '2027-01-03T23:59')
  assert.equal(parseSpanishEventDate('el sábado 7 de noviembre, a partir de las 18, su aniversario', NOW), '2026-11-07T18:00')
})

test('parseSpanishEventDate : sans heure = 23:59 (convention Armenopole), année = prochaine occurrence', () => {
  assert.equal(parseSpanishEventDate('5 de enero', NOW), '2027-01-05T23:59')
  assert.equal(parseSpanishEventDate('el 15 de noviembre', NOW), '2026-11-15T23:59')
})

test("parseSpanishEventDate : l'adresse n'est pas une heure", () => {
  assert.equal(parseSpanishEventDate('el sábado 19 de diciembre en Armenia 1247, Villa Sarmiento', NOW), '2026-12-19T23:59')
  assert.equal(parseSpanishEventDate('el 20 de noviembre, 2.000 personas', NOW), '2026-11-20T23:59')
})

test('parseSpanishEventDate : pas de date sûre = null', () => {
  assert.equal(parseSpanishEventDate('Próximamente', NOW), null)
  assert.equal(parseSpanishEventDate('en noviembre', NOW), null)
  assert.equal(parseSpanishEventDate('', NOW), null)
  assert.equal(parseSpanishEventDate('el 31 de febrero', NOW), null)
  assert.equal(parseSpanishEventDate('el 12 de foo', NOW), null)
})

test('parseSpanishEventDate : jamais de Z', () => {
  for (const t of ['sábado 8 de noviembre a las 19 hs', '5 de enero', '16 de noviembre 12:30 hs'])
    assert.doesNotMatch(parseSpanishEventDate(t, NOW), /Z/)
})

const post = (id, title, text, date = '2026-10-28T20:00:00') => ({
  title: { rendered: title },
  link: `https://www.diarioarmenia.org.ar/p${id}/`,
  date_gmt: date,
  featured_media: id,
  content: { rendered: `<p>${text}</p>` },
})
const media = JSON.stringify([{ id: 1, source_url: 'https://www.diarioarmenia.org.ar/u/1.jpg' }])

test('parseAgendaPosts : sans date lisible, le post est écarté ; le reste est complet', () => {
  const posts = [
    post(1, 'Concierto', 'Será el jueves 26 de noviembre, a las 20, en el salón.'),
    post(2, 'Sin fecha', 'Se anunciará próximamente.'),
    post(3, 'Fecha en el título 5 de diciembre', 'Texto sin fecha.'),
  ]
  const ev = parseAgendaPosts(JSON.stringify(posts), media, { now: NOW })
  assert.deepEqual(ev.map((e) => e.title), ['Concierto', 'Fecha en el título 5 de diciembre'])
  for (const e of ev) {
    assert.equal(e.country, 'argentina')
    assert.ok(evenementComplet(e))
    assert.doesNotMatch(e.date, /Z/)
    assert.equal(worldCountryKey(e), 'argentina')
  }
  assert.equal(ev[0].date, '2026-11-26T20:00')
  assert.equal(ev[0].image, 'https://www.diarioarmenia.org.ar/u/1.jpg')
  assert.equal(ev[1].date, '2026-12-05T23:59')
})

test("parseAgendaPosts : l'année se lit depuis la date de l'annonce", () => {
  // Annoncé le 23 octobre pour le 27 octobre : passé le 31, et NON « l'an prochain ».
  const ev = parseAgendaPosts(JSON.stringify([post(1, 'Libro', 'el martes 27 de octubre a las 18', '2026-10-23T18:00:00')]), '[]', { now: NOW })
  assert.equal(ev[0].date, '2026-10-27T18:00')
})

test('parseAgendaPosts : lieu gardé seulement hors Argentine', () => {
  const ev = parseAgendaPosts(
    JSON.stringify([
      post(1, 'A', 'El 12 de noviembre en Ereván se celebrará un acto.'),
      post(2, 'B', 'El 13 de noviembre en Armenia 1353, Buenos Aires.'),
    ]),
    '[]',
    { now: NOW },
  )
  assert.equal(ev[0].location, 'Erevan')
  assert.equal(worldCountryKey(ev[0]), 'armenia')
  assert.equal(ev[1].location, 'Argentine')
  assert.equal(worldCountryKey(ev[1]), 'argentina')
})

test('un jour sans heure passe evenementsAVenir et eventLd', () => {
  const [e] = parseAgendaPosts(JSON.stringify([post(1, 'X', 'el 5 de enero')]), '[]', { now: NOW })
  assert.equal(e.date, '2027-01-05T23:59')
  assert.equal(evenementsAVenir([e], NOW.getTime()).length, 1)
  assert.equal(evenementsAVenir([e], NOW.getTime(), -120).length, 1)
  assert.equal(eventLd(e).startDate, '2027-01-05')
  // Google exige un lieu : le pays lui-même, déduit de la source.
  assert.equal(e.location, 'Argentine')
  assert.equal(eventLd(e).location.name, 'Argentine')
  assert.equal(eventLd(e).location['@type'], 'Place')
  assert.equal(worldCountryKey(e), 'argentina')
  assert.equal(placeLabel(e.location, 'fr'), 'Argentine')
  assert.equal(placeLabel(e.location, 'es'), 'Argentina')
  assert.equal(placeLabel(e.location, 'ru'), 'Аргентина')
  assert.equal(placeLabel(e.location, 'hy'), 'Արգենտինա')
})

test('mergeDiarioIntoWorld : dédoublonne par URL et trie', () => {
  const world = [
    { title: 'a', url: 'u1', date: '2026-12-01T10:00' },
    { title: 'b', url: 'u2', date: '2026-11-01T10:00' },
  ]
  const da = [
    { title: 'a2', url: 'u1', date: '2026-12-01T10:00' },
    { title: 'c', url: 'u3', date: '2026-11-15' },
  ]
  const out = mergeDiarioIntoWorld(world, da)
  assert.deepEqual(out.map((e) => e.url), ['u2', 'u3', 'u1'])
  assert.equal(out.find((e) => e.url === 'u1').title, 'a')
})

test("mergeDiarioIntoWorld : la copie fraîche d'un événement Diario bat l'ancienne du backfill", () => {
  const old = { title: 'old', url: 'https://www.diarioarmenia.org.ar/x/', date: '2026-11-01' }
  const fresh = { title: 'new', url: 'https://www.diarioarmenia.org.ar/x/', date: '2026-11-02' }
  const out = mergeDiarioIntoWorld([old, { title: 'a', url: 'u1', date: '2026-12-01' }], [fresh])
  assert.equal(out.length, 2)
  assert.equal(out.find((e) => e.url === fresh.url).date, '2026-11-02')
})

// Le piège qui a fait refaire /agenda/ à Los Angeles : un jour seul est lu comme
// minuit UTC, donc la veille à l'ouest de l'UTC. Toute date émise doit porter son
// heure murale, que `new Date()` lit en heure locale partout — le même jour au
// prérendu et à l'hydratation, quel que soit le fuseau du lecteur.
test("parseSpanishEventDate : toujours une heure murale, jamais un jour seul (hydratation hors d'Europe)", () => {
  for (const s of ['el domingo 1° de noviembre en la Catedral', 'sábado 8 de noviembre a las 19 hs', '5 de enero']) {
    const d = parseSpanishEventDate(s, NOW)
    assert.match(d, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.equal(new Date(d).getDate(), Number(d.slice(8, 10)))
  }
})
