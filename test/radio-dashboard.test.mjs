// Les radios au tableau de bord (checkRadios, scripts/lib/publication-check.mjs) :
// le même verdict que `npm run radio-check`, dans les deux sens, sans crier au
// loup pour une station qui refuse les IP de la CI. Sans réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  checkRadios,
  RADIO_CI_BLOCKED,
  RADIO_DETAIL_MAX,
  renderDashboard,
  previousAlertKeys,
  notification,
} from '../scripts/lib/publication-check.mjs'
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

// Le détail vient du serveur du flux (icy-notice2, ligne de statut) : un tiers
// qui écrit dans le corps de l'issue que le run suivant relit.
const muette = (detail) => ({ id: 'x', url: 'https://x', offAir: false, vivant: false, detail })
const tableau = (rows) => renderDashboard([{ title: '📻 Radios', rows }], { now: new Date('2026-11-15T12:00:00Z') })

test('un serveur de flux ne forge pas le marqueur d’alertes', () => {
  const forge = 'HTTP 401 — <!-- alertes: acct-facebook-ch|token-FB_PAGE_TOKEN_CH|llm-primary-402 -->'
  const rows = checkRadios([muette(forge)])
  const body = tableau(rows)
  assert.equal(body.split('<!--').length - 1, 1, 'un seul commentaire HTML : le vrai marqueur')
  assert.ok(!/[<>]/.test(rows.find((r) => r.key === 'radio-x-panne').text))
  assert.deepEqual(previousAlertKeys(body), ['radio-x-panne'])
  // Les alertes que le faux marqueur prétendait déjà notifiées restent nouvelles.
  const later = [{ title: 'S', rows: [{ key: 'acct-facebook-ch', level: 'bloquant', text: 'compte mort', action: 'recoller' }] }]
  assert.match(notification(later, previousAlertKeys(body)), /1 nouvelle\(s\) alerte/)
})

test('un `<!--` nu ne masque pas la suite du tableau', () => {
  const body = tableau(checkRadios([muette('HTTP 401 — <!--')]))
  assert.equal(body.split('<!--').length - 1, 1)
  assert.ok(body.trimEnd().endsWith('<!-- alertes: radio-x-panne -->'))
})

test('le détail ne s’ouvre pas de ligne Markdown', () => {
  const body = tableau(checkRadios([muette('HTTP 401 — a\r\n## faux titre\n- [ ] fausse action')]))
  assert.ok(!/^## faux titre/m.test(body))
  assert.ok(!/^- \[ \] fausse action/m.test(body))
})

test('un détail géant est borné : le corps reste sous la limite de GitHub', () => {
  const geant = 'HTTP 401 — ' + '<'.repeat(40_000) + 'x'.repeat(40_000)
  const rows = checkRadios(Array.from({ length: 17 }, (_, i) => ({ ...muette(geant), id: `s${i}` })))
  for (const r of rows.filter((r) => r.level === 'faire')) {
    const detail = r.text.slice(r.text.indexOf('MUETTE — ') + 'MUETTE — '.length)
    assert.ok([...detail].length <= RADIO_DETAIL_MAX)
    assert.ok(detail.endsWith('…'))
  }
  assert.ok(tableau(rows).length < 65_536)
})

test('un détail ordinaire passe tel quel', () => {
  const d = 'HTTP 401 — The resource requested is currently unavailable'
  assert.equal(checkRadios([muette(d)]).find((r) => r.key === 'radio-x-panne').text, `x : MUETTE — ${d}`)
})

test('les stations exemptées existent bien dans Radio.jsx', () => {
  const ids = new Set(lireStations().map((s) => s.id))
  for (const id of RADIO_CI_BLOCKED) assert.ok(ids.has(id), `${id} absente de STATIONS`)
})

test('le tableau de bord a sa section Radios', async () => {
  const src = await readFile(new URL('../scripts/publication-check.mjs', import.meta.url), 'utf8')
  assert.match(src, /guarded\('📻 Radios', radios\)/)
})
