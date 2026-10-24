import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Node ne sait pas importer du JSX : ces contrôles lisent les sources comme du
// texte, comme test/img-lazy.test.mjs.
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

// Une clé absente rend la clé elle-même (« lb.summary ») dans la page.
test('les deux libellés du résumé existent dans les six langues', () => {
  const src = read('../src/i18n.jsx')
  assert.equal(src.match(/'lb\.summary':/g)?.length, 6)
  assert.equal(src.match(/'lb\.summaryNote':/g)?.length, 6)
})

// Chargés à la demande : un chunk par langue, rien dans le bundle de la page.
test('les résumés sont chargés à la demande, pas embarqués', () => {
  const src = read('../src/agendaResumes.js')
  assert.match(src, /import\.meta\.glob\(/)
  assert.doesNotMatch(src, /eager:\s*true/)
})
