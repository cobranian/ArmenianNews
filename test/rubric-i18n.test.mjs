import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RUBRICS } from '../src/rubrics.js'
import { RUBRIC_LABELS } from '../src/rubricLabels.js'
import { ALL_LANGS } from '../sites.config.js'

// t() rend la clé elle-même si elle manque, et le prérendu cuirait
// « rubric.economie » dans le HTML : chaque rubrique doit avoir un libellé non
// vide dans chaque langue, ET i18n.jsx doit étaler chaque langue une fois.
test('chaque rubrique a son libellé dans chaque langue', () => {
  for (const l of ALL_LANGS)
    for (const r of RUBRICS) assert.ok(RUBRIC_LABELS[l]?.[r]?.trim(), `${l}.${r}`)
})

test('i18n.jsx étale les libellés de chaque langue', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  for (const l of ALL_LANGS)
    assert.equal(src.split(`...rubricStrings('${l}')`).length - 1, 1, l)
  assert.ok(!/'rubric\.[a-z]+':/.test(src), 'plus de libellé de rubrique écrit en dur')
})
