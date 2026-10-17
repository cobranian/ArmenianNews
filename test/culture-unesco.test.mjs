import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadUnesco, unescoSource, LIST_FR } from '../scripts/lib/culture-unesco.mjs'

test('unesco.json : 8 entrées, années 2008-2023, listes connues, URL ich.unesco.org', () => {
  const entries = Object.values(loadUnesco())
  assert.equal(entries.length, 8)
  for (const e of entries) {
    assert.ok(e.year >= 2008 && e.year <= 2023)
    assert.ok(e.list in LIST_FR)
    assert.ok(e.name)
    assert.match(e.url, /^https:\/\/ich\.unesco\.org\//)
  }
})

test('unescoSource : phrase française, liste représentative du kochari 2017', () => {
  const s = unescoSource(loadUnesco().kochari)
  assert.equal(s.kind, 'unesco')
  assert.equal(s.revision, null)
  assert.equal(s.license, 'UNESCO')
  assert.equal(s.extract, "Inscrit en 2017 sur la Liste représentative du patrimoine culturel immatériel de l'UNESCO, sous l'intitulé « Kochari, traditional group dance ».")
})
