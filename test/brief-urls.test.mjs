import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BRIEF_SLUGS, briefUrl, briefPath, ALL_LANGS, ALL_VIEWS, VIEWS } from '../sites.config.js'

test('les adresses de la brève', () => {
  assert.equal(briefUrl('fr'), 'https://armenieinfo.ch/breve/')
  assert.equal(briefUrl('en'), 'https://armenianews.org/brief/')
  assert.equal(briefUrl('hy', '2026-10-16'), 'https://armenianews.org/hy/brief/2026-10-16/')
  assert.equal(briefPath('ru', '2026-10-16'), '/ru/brief/2026-10-16/')
  assert.equal(briefPath('fr'), '/breve/')
})

test('slash final partout (Firebase redirige la forme sans)', () => {
  for (const l of ALL_LANGS) {
    assert.match(BRIEF_SLUGS[l], /^[a-z]+\/$/)
    assert.ok(briefUrl(l, '2026-01-02').endsWith('/2026-01-02/'))
  }
})

test('date mal formée refusée', () => {
  assert.throws(() => briefUrl('fr', '16-10-2026'))
  assert.throws(() => briefUrl('xx'))
})

test('aucun slug de brève ne heurte une vue', () => {
  for (const l of ALL_LANGS)
    for (const v of ALL_VIEWS) assert.notEqual(VIEWS[v].slugs[l], BRIEF_SLUGS[l], `${l}/${v}`)
})
