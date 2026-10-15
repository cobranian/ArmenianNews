import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RUBRICS } from '../src/rubrics.js'
import { ALL_LANGS } from '../sites.config.js'

// Node ne sait pas importer du JSX : on compte les DÉCLARATIONS dans le texte,
// comme test/stations.test.mjs. t() rend la clé elle-même si elle manque, et
// le prérendu cuirait « rubric.economie » dans le HTML — d'où quatre par clé.
const i18n = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
const declarations = (cle) =>
  (i18n.match(new RegExp(`'${cle.replace(/\./g, '\\.')}':`, 'g')) || []).length

test('chaque rubrique a son libelle dans les quatre blocs STRINGS', () => {
  for (const r of RUBRICS)
    assert.equal(declarations(`rubric.${r}`), ALL_LANGS.length, `rubric.${r}`)
})
