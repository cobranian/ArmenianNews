import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { ALL_LANGS, SITES, primaryLang } from '../sites.config.js'
import { fontPreloads, headFor } from '../scripts/lib/site-meta.mjs'
import { parseGoogleCss, localName, renderCss, renderManifest } from '../scripts/fonts-sync.mjs'

// Les polices sont AUTO-HÉBERGÉES depuis le 21 août 2026 (public/fonts/,
// src/styles/fonts.css, manifeste src/styles/fonts.json — tous trois écrits par
// `npm run fonts-sync`). La feuille Google était une ressource bloquante
// cross-origin : ~800 ms sur le premier rendu mobile. Ces tests gardent la
// cohérence des trois artefacts entre eux, et le fait que personne ne remette
// le <link> Google « pour une famille de plus ».

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')
const css = lire('../src/styles/fonts.css')
const manifest = JSON.parse(lire('../src/styles/fonts.json'))
const onDisk = new Set(readdirSync(new URL('../public/fonts/', import.meta.url)).filter((f) => f.endsWith('.woff2')))

test('fonts.css : chaque @font-face pointe sur un fichier présent dans public/fonts/', () => {
  const refs = [...css.matchAll(/url\(\/fonts\/([^)]+)\)/g)].map((m) => m[1])
  assert.ok(refs.length >= 60, `${refs.length} références, attendu ≥ 60 (107 blocs, 62 fichiers)`)
  for (const f of refs) assert.ok(onDisk.has(f), `fonts.css référence ${f}, absent de public/fonts/`)
})

test('fonts.css : swap et unicode-range sur chaque bloc, aucune URL Google', () => {
  const blocks = css.split('@font-face {').slice(1)
  assert.ok(blocks.length >= 100)
  for (const b of blocks) {
    assert.match(b, /font-display: swap/)
    assert.match(b, /unicode-range:/)
  }
  assert.ok(!css.includes('fonts.gstatic.com'), 'fonts.css pointe encore vers Google')
})

test('public/fonts/ : rien qui ne soit référencé, rien de vide', () => {
  const refs = new Set([...css.matchAll(/url\(\/fonts\/([^)]+)\)/g)].map((m) => m[1]))
  for (const f of onDisk) {
    assert.ok(refs.has(f), `${f} traîne dans public/fonts/ sans être référencé (relancer npm run fonts-sync)`)
    const { size } = statSync(new URL(`../public/fonts/${f}`, import.meta.url))
    assert.ok(size > 1000, `${f} fait ${size} octets`)
  }
})

test('le manifeste décrit exactement les fichiers de fonts.css', () => {
  const files = new Set(manifest.fonts.map((f) => f.file))
  assert.deepEqual([...files].sort(), [...onDisk].sort())
  for (const f of manifest.fonts) {
    assert.ok(f.family && f.style && f.subset && f.weights.length, JSON.stringify(f))
  }
})

test('index.html ne charge plus rien depuis Google Fonts, et global.css importe fonts.css', () => {
  const html = lire('../index.html')
  assert.ok(!/<link[^>]+fonts\.googleapis\.com/.test(html), 'index.html a retrouvé un <link> Google Fonts')
  assert.ok(!/<link[^>]+preconnect[^>]+fonts\./.test(html), 'preconnect Google Fonts inutile')
  assert.match(lire('../src/styles/global.css'), /@import '\.\/fonts\.css';/)
})

test('chaque langue précharge 2 à 4 fichiers qui existent, et le <head> les émet', () => {
  for (const lang of ALL_LANGS) {
    const hrefs = fontPreloads(lang)
    assert.ok(hrefs.length >= 2 && hrefs.length <= 4, `${lang} : ${hrefs.length} preloads`)
    for (const h of hrefs) assert.ok(onDisk.has(h.replace('/fonts/', '')), `${lang} précharge ${h}, absent`)
    const head = headFor({ siteId: SITES[Object.keys(SITES).find((s) => SITES[s].pages.some((p) => p.lang === lang))].id, lang })
    for (const h of hrefs) {
      assert.ok(
        head.includes(`<link rel="preload" as="font" type="font/woff2" href="${h}" crossorigin />`),
        `${lang} : preload de ${h} absent du head`,
      )
    }
  }
})

test('la marque latine est préchargée sous en/ru, l’arménienne sous hy', () => {
  const has = (lang, family) => fontPreloads(lang).some((h) => h.includes(family))
  assert.ok(has('en', 'fraunces') && has('ru', 'fraunces') && has('fr', 'fraunces'))
  assert.ok(has('hy', 'noto-serif-armenian') && !has('hy', 'fraunces'))
  assert.ok(has('ru', 'literata') && has('ru', 'golos-text'))
})

test('firebase.json met public/fonts/ en cache immuable sur les deux cibles', () => {
  const fb = JSON.parse(lire('../firebase.json'))
  for (const h of fb.hosting) {
    const rule = (h.headers ?? []).find((r) => r.source === 'fonts/**')
    assert.ok(rule, `${h.site} : pas d'en-tête pour fonts/**`)
    const cc = rule.headers.find((x) => x.key === 'Cache-Control')
    assert.match(cc.value, /immutable/)
  }
})

test('fonts-sync : analyse et rend fidèlement un bloc Google', () => {
  const sample = `/* latin */
@font-face {
  font-family: 'Fraunces';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/fraunces/v38/abc.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+2000-206F;
}
`
  const [b] = parseGoogleCss(sample)
  assert.equal(b.family, 'Fraunces')
  assert.equal(b.subset, 'latin')
  assert.equal(localName(b), 'fraunces-abc.woff2')
  const out = renderCss([b])
  assert.match(out, /src: url\(\/fonts\/fraunces-abc\.woff2\) format\('woff2'\);/)
  assert.match(out, /unicode-range: U\+0000-00FF, U\+2000-206F;/)
  const m = renderManifest([b, { ...b, weight: '600' }])
  assert.deepEqual(m.fonts, [{ family: 'Fraunces', style: 'italic', subset: 'latin', weights: ['400', '600'], file: 'fraunces-abc.woff2' }])
})

test('la page par défaut de chaque vitrine précharge dans sa langue', () => {
  for (const site of Object.values(SITES)) {
    const head = headFor({ siteId: site.id, lang: primaryLang(site.id) })
    assert.ok(head.includes('rel="preload" as="font"'), `${site.id} : aucun preload`)
  }
})
