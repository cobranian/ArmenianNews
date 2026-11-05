// Les radios au tableau de bord (checkRadios, scripts/lib/publication-check.mjs) :
// le même verdict que `npm run radio-check`, dans les deux sens, sans crier au
// loup pour une station qui refuse les IP de la CI. Sans réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { checkRadios, RADIO_CI_BLOCKED } from '../scripts/lib/publication-check.mjs'
import { lireStations } from '../scripts/radio-check.mjs'

const st = (id, vivant, offAir = false) => ({ id, url: 'https://x', offAir, vivant, detail: vivant ? '128 kbps' : 'HTTP 401' })

test('tout diffuse : une seule ligne ok, aucune alerte', () => {
  const rows = checkRadios([st('a', true), st('b', true)])
  assert.deepEqual(rows.map((r) => r.level), ['ok'])
  assert.match(rows[0].text, /^2\/2 flux diffusent/)
})

test('une station muette non marquée demande une action', () => {
  const rows = checkRadios([st('a', true), st('b', false)])
  const b = rows.find((r) => r.key === 'radio-b-panne')
  assert.equal(b.level, 'faire')
  assert.match(b.action, /offAir: true/)
  assert.match(b.action, /radio-check/)
})

test('une station marquée qui rediffuse demande de retirer le drapeau', () => {
  const rows = checkRadios([st('a', true, true)])
  const a = rows.find((r) => r.key === 'radio-a-retour')
  assert.equal(a.level, 'faire')
  assert.match(a.action, /retirer/)
})

test('marquée et muette : une info, pas une alerte', () => {
  const rows = checkRadios([st('a', false, true)])
  assert.equal(rows.find((r) => r.key === 'radio-a-offair').level, 'info')
  assert.equal(rows[0].level, 'ok')
})

test('une station qui refuse les IP de la CI ne crie pas au loup', () => {
  const rows = checkRadios([st('vov', false), st('b', true)])
  assert.equal(rows.find((r) => r.key === 'radio-vov-ci').level, 'info')
  assert.ok(!rows.some((r) => r.level === 'faire'))
})

test('les stations exemptées existent bien dans Radio.jsx', () => {
  const ids = new Set(lireStations().map((s) => s.id))
  for (const id of RADIO_CI_BLOCKED) assert.ok(ids.has(id), `${id} absente de STATIONS`)
})

test('le tableau de bord a sa section Radios', async () => {
  const src = await readFile(new URL('../scripts/publication-check.mjs', import.meta.url), 'utf8')
  assert.match(src, /guarded\('📻 Radios', radios\)/)
})
