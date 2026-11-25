// video.yml : la voix est synthétisée AVANT le rendu de chaque langue, et
// sync.mjs (qui efface les blocs `voice`) ne tourne qu'une fois, avant la boucle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const yml = (await readFile(new URL('../.github/workflows/video.yml', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
const step = yml.slice(yml.indexOf('- name: Rendre'), yml.indexOf('- name: Déposer'))
const loopStart = step.indexOf('for l in')
const loop = step.slice(loopStart, step.indexOf('done', loopStart))

test("Rendre : GEMINI_API_KEY dans l'env de l'étape seulement", () => {
  assert.ok(step.indexOf('env:') >= 0 && step.indexOf('env:') < step.indexOf('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}'))
  assert.ok(step.indexOf('GEMINI_API_KEY') < step.indexOf('run: |'))
  assert.equal(yml.split('secrets.GEMINI_API_KEY').length - 1, 1)
})

test('Rendre : voice.mjs avant render-all.mjs dans la même boucle', () => {
  const v = loop.indexOf('node video/scripts/voice.mjs --slug "$SLUG" --lang "$l"')
  const r = loop.indexOf('node video/scripts/render-all.mjs --slug "$SLUG" --lang "$l"')
  assert.ok(v >= 0 && r > v)
})

test('Rendre : un échec de voix saute la langue sans rendu (&& puis ||)', () => {
  assert.match(loop, /voice\.mjs[^\n]*&&\s*node video\/scripts\/render-all\.mjs[^\n]*\|\| \{[^}]*::warning::\$SLUG\/\$l : voix ou rendu en échec, langue sautée[^}]*FAILED="\$FAILED \$l"/)
})

test('Rendre : sync.mjs une seule fois, avant la boucle, jamais dedans', () => {
  assert.equal(step.split('node video/scripts/sync.mjs').length - 1, 1)
  assert.ok(step.indexOf('node video/scripts/sync.mjs') < loopStart)
  assert.doesNotMatch(loop, /sync\.mjs/)
})
