// La pause de la rédaction Culture (scripts/lib/culture-pause.mjs) : le
// dernier jour est INCLUS, la reprise est le lendemain, la pause se lève
// d'elle-même, et le tableau de bord l'affiche sans en faire une alerte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { culturePaused, resumeDay, checkPause } from '../scripts/lib/culture-pause.mjs'

const P = { until: '2026-11-15', why: 'test' }

test('la pause court jusqu’au dernier jour inclus, en UTC', () => {
  assert.equal(culturePaused(new Date('2026-11-06T03:00:00Z'), P), true)
  assert.equal(culturePaused(new Date('2026-11-15T23:59:00Z'), P), true)
  assert.equal(culturePaused(new Date('2026-11-16T03:00:00Z'), P), false)
})

test('pas de date = pas de pause', () => {
  assert.equal(culturePaused(new Date('2026-11-06T03:00:00Z'), { until: null }), false)
  assert.equal(culturePaused(new Date('2026-11-06T03:00:00Z'), null), false)
})

test('reprise le lendemain, fin de mois comprise', () => {
  assert.equal(resumeDay(P), '2026-11-16')
  assert.equal(resumeDay({ until: '2026-11-30' }), '2026-12-01')
})

test('le tableau de bord affiche la pause en info, puis plus rien', () => {
  const rows = checkPause(new Date('2026-11-06T02:17:00Z'), P)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].level, 'info') // affichée, jamais notifiée
  assert.match(rows[0].text, /PAUSE jusqu'au 2026-11-15/)
  assert.match(rows[0].text, /2026-11-16/)
  assert.deepEqual(checkPause(new Date('2026-11-16T02:17:00Z'), P), [])
})

test('le brouillon et le tableau de bord lisent bien la pause', async () => {
  const draft = await readFile(new URL('../scripts/culture-draft.mjs', import.meta.url), 'utf8')
  assert.match(draft, /culturePaused\(\)/)
  assert.match(draft, /output\('skipped', 'pause'\)/)
  // Les idées de sujets ne sont PAS coupées par la pause.
  assert.doesNotMatch(draft, /paused[^\n]*proposeIdeas|proposeIdeas[^\n]*paused/)
  const board = await readFile(new URL('../scripts/publication-check.mjs', import.meta.url), 'utf8')
  assert.match(board, /checkPause\(now\)/)
})
