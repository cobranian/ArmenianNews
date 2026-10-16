// test/culture-links-ui.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { notFoundHtml } from '../scripts/lib/not-found.mjs'

// Node ne sait pas importer du JSX : on lit les composants comme du texte,
// comme test/brief-links-ui.test.mjs. Une section sans lien entrant ne
// reçoit ni lecteur ni PageRank interne.
const src = (f) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf-8')

for (const f of ['components/Nav.jsx', 'components/Footer.jsx']) {
  test(`${f} lie la section Culture`, async () => {
    const s = await src(f)
    assert.match(s, /culturePath\(lang\)/)
    assert.match(s, /CULTURE_STRINGS\[lang\]/)
  })
}

test('l’accueil monte le bloc « À lire »', async () => {
  const s = await src('App.jsx')
  assert.match(s, /<CultureTeaser \/>/)
  assert.match(await src('components/CultureTeaser.jsx'), /virtual:culture-teaser/)
})

test('vite.config.js déclare le module virtuel', async () => {
  const s = await readFile(new URL('../vite.config.js', import.meta.url), 'utf-8')
  assert.match(s, /cultureTeaser\(\)/)
})

test('la 404 lie la section Culture dans chaque langue de la vitrine', () => {
  const org = notFoundHtml('org')
  for (const p of ['/culture/', '/hy/culture/', '/ru/culture/']) assert.ok(org.includes(`href="${p}"`), p)
  assert.ok(notFoundHtml('ch').includes('href="/culture/"'))
})
