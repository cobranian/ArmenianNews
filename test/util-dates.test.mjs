import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isoFromMonthDay } from '../scripts/lib/util.mjs'

// Armenopole n'écrit que « AOÛ 30 12:30 » — le mois, le jour, l'heure MURALE
// du lieu, jamais d'année ni de fuseau. La date composée doit donc rester une
// heure murale : « 2026-08-30T12:30 », sans `Z` ni offset.
//
// Elle l'a été en UTC pendant des mois : `new Date(année, mois, jour, h, m)`
// — heure locale de la machine qui scrape, UTC sur le runner GitHub — puis
// `.toISOString()`. Résultat : 12:30 à Genève publié comme 12:30Z (= 14:30),
// et les 27 événements notés 23:59 qui basculaient au lendemain pour un
// lecteur en Suisse (le prérendu en UTC disait 31, son navigateur disait 1),
// comme dans le JSON-LD. Et la même page scrapée depuis Zurich aurait donné
// d'autres valeurs : la donnée dépendait de qui l'avait produite. Mesuré le
// 21 août 2026 sur agenda.json.
const now = new Date(2026, 7, 21, 12, 0) // 21 août 2026, midi local

test('compose une heure murale, sans fuseau', () => {
  assert.equal(isoFromMonthDay('AOÛ', '30', '12:30', now), '2026-08-30T12:30')
  assert.equal(isoFromMonthDay('AUG', '4', '19:00', now), '2026-08-04T19:00')
  assert.equal(isoFromMonthDay('sep', '5', '9:05', now), '2026-09-05T09:05')
})

test('23:59 reste 23:59 : c’est au balisage de le lire comme « toute la journée »', () => {
  assert.equal(isoFromMonthDay('AOÛ', '31', '23:59', now), '2026-08-31T23:59')
})

test('ne porte jamais de Z ni de secondes', () => {
  const s = isoFromMonthDay('DÉC', '24', '18:00', now)
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  assert.ok(!s.endsWith('Z'))
})

test('l’année est celle de la prochaine occurrence', () => {
  // Janvier vu depuis août : l'an prochain.
  assert.equal(isoFromMonthDay('JAN', '10', '20:00', now), '2027-01-10T20:00')
  // Juillet vu depuis août : passé de moins d'un mois, donc cette année encore.
  assert.equal(isoFromMonthDay('JUL', '25', '20:00', now), '2026-07-25T20:00')
  // Juin vu depuis août : passé de plus d'un mois, donc l'an prochain.
  assert.equal(isoFromMonthDay('JUN', '10', '20:00', now), '2027-06-10T20:00')
})

test('heure absente → 00:00 ; mois inconnu ou jour nul → null', () => {
  assert.equal(isoFromMonthDay('SEP', '1', undefined, now), '2026-09-01T00:00')
  assert.equal(isoFromMonthDay('XYZ', '1', '10:00', now), null)
  assert.equal(isoFromMonthDay('SEP', '0', '10:00', now), null)
})

test('la chaîne se lit comme heure locale dans tout navigateur', () => {
  // `new Date('2026-08-31T23:59')` sans offset est interprétée en heure locale
  // (ECMAScript), donc `getDate()` rend 31 à Zurich, à Erevan et à New York.
  // C'est la propriété que les pastilles de l'agenda exploitent.
  const d = new Date(isoFromMonthDay('AOÛ', '31', '23:59', now))
  assert.equal(d.getDate(), 31)
  assert.equal(d.getHours(), 23)
})
