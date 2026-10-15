import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByRubric } from '../src/rubrics.js'

const map = {
  a: { eco: 'economie', biz: 'economie', mix: { mixed: 'armenie' } },
  b: { eco: 'economie', sp: 'sports' },
}
const art = (url, date, extra = {}) => ({ title: url, url, date, ...extra })
const src = (id, cats) => ({ id, brand: id.toUpperCase(), cats })

test('une etagere par source, dans l ordre des sources', () => {
  const out = groupByRubric(
    [
      src('a', [{ key: 'eco', label: 'Eco A', articles: [art('a1', '2026-10-01')] }]),
      src('b', [{ key: 'eco', label: 'Eco B', articles: [art('b1', '2026-10-02')] }]),
    ],
    { map },
  )
  assert.deepEqual(out.map((r) => r.key), ['economie'])
  assert.deepEqual(out[0].shelves.map((s) => s.source.id), ['a', 'b'])
  assert.equal(out[0].shelves[0].articles[0].catLabel, 'Eco A')
})

// Review Focus : NEWS.am range le même article sous business ET economics.
test('fusion des rubriques d origine, une seule carte par URL', () => {
  const out = groupByRubric(
    [
      src('a', [
        { key: 'eco', label: 'Eco', articles: [art('u1', '2026-10-01'), art('u2', '2026-10-03')] },
        { key: 'biz', label: 'Biz', articles: [art('u1', '2026-10-01'), art('u3', '2026-10-02')] },
      ]),
    ],
    { map },
  )
  assert.deepEqual(out[0].shelves[0].articles.map((a) => a.url), ['u2', 'u3', 'u1'])
})

test('tri par date decroissante, non dates en dernier', () => {
  const out = groupByRubric(
    [src('a', [{ key: 'eco', label: 'E', articles: [art('x', null), art('y', '2026-10-01'), art('z', '2026-10-05')] }])],
    { map },
  )
  assert.deepEqual(out[0].shelves[0].articles.map((a) => a.url), ['z', 'y', 'x'])
})

test('plafond par etagere', () => {
  const many = Array.from({ length: 20 }, (_, i) => art(`u${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`))
  const out = groupByRubric([src('a', [{ key: 'eco', label: 'E', articles: many }])], { map, cap: 12 })
  assert.equal(out[0].shelves[0].articles.length, 12)
  assert.equal(out[0].shelves[0].articles[0].url, 'u19')
})

test('un fil mixed suit le rubric de chaque article', () => {
  const out = groupByRubric(
    [src('a', [{ key: 'mix', label: 'Top', articles: [art('m1', '2026-10-01', { rubric: 'sports' }), art('m2', '2026-10-01')] }])],
    { map },
  )
  assert.deepEqual(out.map((r) => r.key), ['armenie', 'sports'])
  assert.equal(out[0].shelves[0].articles[0].url, 'm2')
  assert.equal(out[1].shelves[0].articles[0].url, 'm1')
})

test('ordre des rubriques fixe, rubriques vides absentes', () => {
  const out = groupByRubric(
    [src('b', [
      { key: 'sp', label: 'S', articles: [art('s1', '2026-10-01')] },
      { key: 'eco', label: 'E', articles: [art('e1', '2026-10-01')] },
    ])],
    { map },
  )
  assert.deepEqual(out.map((r) => r.key), ['economie', 'sports'])
})

test('article sans url ignore, source sans article absente', () => {
  const out = groupByRubric(
    [src('a', [{ key: 'eco', label: 'E', articles: [{ title: 'sans url' }] }])],
    { map },
  )
  assert.deepEqual(out, [])
})
