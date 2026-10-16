import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Node ne sait pas importer du JSX : on lit les composants comme du texte,
// comme test/img-lazy.test.mjs. Une page sans lien interne ne circule pas.
for (const f of ['Nav.jsx', 'Footer.jsx']) {
  test(`${f} lie la brève`, async () => {
    const src = await readFile(new URL(`../src/components/${f}`, import.meta.url), 'utf-8')
    assert.match(src, /briefPath\(lang\)/)
    assert.match(src, /BRIEF_STRINGS\[lang\]/)
  })
}

test('chaque font-family .brief est suivie de son font-size-adjust', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf-8')
  const block = css.slice(css.indexOf('/* === Brève quotidienne'))
  assert.ok(block.length > 100, 'bloc de la brève présent')
  const lines = block.split('\n')
  lines.forEach((l, i) => {
    const m = l.match(/font-family: var\(--font-(display|body|mono)\)/)
    if (!m) return
    const fsa = { display: 'display', body: 'body', mono: 'util' }[m[1]]
    assert.match(lines[i + 1], new RegExp(`font-size-adjust: var\\(--fsa-${fsa}\\)`), `ligne ${i}`)
  })
})
