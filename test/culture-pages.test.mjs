// test/culture-pages.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { cultureIndexHtml, cultureArticleHtml, writeCulturePages, readAlsoPicks } from '../scripts/lib/culture-pages.mjs'
import { loadCulture } from '../scripts/lib/culture-load.mjs'
import { cultureLangsBySlug } from '../scripts/lib/culture-links.mjs'
import { SITES } from '../sites.config.js'
import { writeArticle, texts, meta } from './helpers/culture-fixture.mjs'

const CSS = '/assets/index-abc.css'
const NOW = new Date('2026-10-19T08:00').getTime()
const silent = { warn: () => {} }

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', {
    m: meta('komitas', { agendaEvent: { title: 'Concert <Komitas>', url: 'https://e/1', date: '2026-10-25T20:00', location: 'Genève' } }),
    t: texts({ date: '2026-10-19', title: 'Komitas <script>', frBody: 'Para **gras**.\n\n## Vie\n\n<b>brut</b>' }),
  })
  await writeArticle(dir, 'duduk', {
    m: meta('duduk', { candidates: [], imageChoice: null, image: null }),
    t: { ...texts({ date: '2026-10-12', title: 'Duduk' }), ru: null },
    images: false,
  })
  return { dir, list: await loadCulture(dir, silent) }
}

test('page article : texte échappé, Markdown rendu, image créditée, sources, IA', async () => {
  const { list } = await fixture()
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[0], list, bySlug: cultureLangsBySlug(list), cssHref: CSS, now: NOW })
  assert.ok(html.includes('<html lang="fr">'))
  assert.ok(html.includes('Komitas &lt;script&gt;'))
  assert.ok(!html.includes('<script>alert'))
  assert.ok(html.includes('<strong>gras</strong>'))
  assert.ok(html.includes('<h2>Vie</h2>'))
  assert.ok(html.includes('&lt;b&gt;brut&lt;/b&gt;'))
  assert.ok(html.includes('src="/culture/komitas/image.webp"'))
  assert.ok(html.includes('CC BY-SA 4.0'))
  assert.ok(html.includes('href="https://fr.wikipedia.org/wiki/Komitas"'))
  assert.ok(html.includes('Article rédigé avec un outil d’IA'))
  assert.ok(html.includes('href="/culture/"'), 'lien Culture dans la nav')
  assert.ok(html.includes(`href="${CSS}"`))
})

test('événement : affiché s’il est à venir, masqué sinon', async () => {
  const { list } = await fixture()
  const args = { siteId: 'ch', lang: 'fr', article: list[0], list, bySlug: cultureLangsBySlug(list), cssHref: CSS }
  assert.ok(cultureArticleHtml({ ...args, now: NOW }).includes('Concert &lt;Komitas&gt;'))
  assert.ok(!cultureArticleHtml({ ...args, now: new Date('2026-11-01').getTime() }).includes('Concert'))
})

test('flèches : vers l’autre article de la langue, jamais vers soi ni hors langue', async () => {
  const { list } = await fixture()
  const bySlug = cultureLangsBySlug(list)
  const fr = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[0], list, bySlug, cssHref: CSS, now: NOW })
  // Deux articles : une seule flèche (« suivant »), sinon les deux mèneraient au même endroit.
  assert.ok(fr.includes('data-step="next" rel="next" href="/culture/duduk/"'))
  assert.ok(!fr.includes('data-step="prev"'))
  assert.ok(!fr.includes('data-step="next" rel="next" href="/culture/komitas/"'))
  assert.ok(fr.includes('<script src="/culture-keys.js" defer></script>'))
  const ru = cultureArticleHtml({ siteId: 'org', lang: 'ru', article: list[0], list, bySlug, cssHref: CSS, now: NOW })
  assert.ok(!ru.includes('culture-pager'), 'seul article en russe : pas de flèche')
})

test('flèches : boucle à l’écran, mais rel seulement sur les liens qui ne font pas le tour', async () => {
  const { list } = await fixture()
  const third = { ...list[0], slug: 'khatchkar', date: '2026-10-01' }
  const all = [...list, third]
  const bySlug = cultureLangsBySlug(all)
  const first = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: all[0], list: all, bySlug, cssHref: CSS, now: NOW })
  assert.ok(first.includes('data-step="prev" href="/culture/khatchkar/"'), 'avant le premier : le dernier, sans rel')
  assert.ok(!first.includes('rel="prev"'))
  assert.ok(first.includes('data-step="next" rel="next" href="/culture/duduk/"'))
  const last = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: third, list: all, bySlug, cssHref: CSS, now: NOW })
  assert.ok(last.includes('data-step="next" href="/culture/komitas/"'), 'après le dernier : le premier, sans rel')
  assert.ok(!last.includes('rel="next"'))
  assert.ok(last.includes('data-step="prev" rel="prev" href="/culture/duduk/"'))
})

test('« À lire aussi » : jamais soi-même ni les voisins des flèches ; rien de neuf → pas de section', async () => {
  const { list } = await fixture()
  const bySlug = cultureLangsBySlug(list)
  const fr = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[0], list, bySlug, cssHref: CSS, now: NOW })
  assert.ok(!fr.includes('culture__more'), 'deux articles : le seul autre est déjà la flèche')
  const extra = ['a', 'b', 'c'].map((slug, k) => ({ ...list[0], slug, date: `2026-09-0${k + 1}` }))
  const all = [...list, ...extra] // komitas, duduk, a, b, c — voisins de komitas : duduk et c
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: all[0], list: all, bySlug: cultureLangsBySlug(all), cssHref: CSS, now: NOW })
  const m = html.slice(html.indexOf('culture__more'))
  assert.deepEqual([...m.matchAll(/class="culture-card"><a href="\/culture\/([a-z]+)\//g)].map((x) => x[1]), ['a', 'b'])
})

test('« À lire aussi » : choisi autour de l’article, pas toujours les plus récents', () => {
  const list = Array.from({ length: 20 }, (_, k) => ({ slug: `s${k}`, langs: { fr: { title: 'T', description: 'D' } } }))
  assert.deepEqual(readAlsoPicks('fr', list[10], list).map((x) => x.slug), ['s12', 's8', 's13'])
  assert.deepEqual(readAlsoPicks('fr', list[0], list).map((x) => x.slug), ['s2', 's18', 's3'])
  assert.deepEqual(readAlsoPicks('en', list[0], list), [], 'langue absente')
})

test('sélecteur de langue : même article s’il est traduit, sinon l’index de la langue', async () => {
  const { list } = await fixture()
  const bySlug = cultureLangsBySlug(list)
  const duduk = list.find((x) => x.slug === 'duduk')
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: duduk, list, bySlug, cssHref: CSS, now: NOW })
  assert.ok(html.includes('<div class="lang" role="group" aria-label="Langue">'), 'libellé traduit')
  assert.ok(html.includes('href="https://armenianews.org/hy/culture/duduk/" hreflang="hy"'))
  assert.ok(html.includes('href="https://armenianews.org/ru/culture/" hreflang="ru"'), 'duduk absent en russe')
  assert.ok(html.includes('hreflang="fr" lang="fr" title="Français" aria-current="page"'))
  const idx = cultureIndexHtml({ siteId: 'org', lang: 'en', list, bySlug, cssHref: CSS })
  assert.ok(idx.includes('href="https://armenieinfo.ch/culture/" hreflang="fr"'))
  const bar = idx.slice(idx.indexOf('class="lang"'))
  assert.ok(bar.indexOf('hreflang="en"') < bar.indexOf('hreflang="fr"'), 'langue du domaine en tête')
})

test('page : une source ՀՍՀ et une source UNESCO sont étiquetées ; une source sans kind reste Wikipedia', async () => {
  const { list } = await fixture()
  const sources = [
    { url: 'https://fr.wikipedia.org/wiki/A', title: 'A', lang: 'fr' },
    { url: 'https://hy.wikisource.org/wiki/B', title: 'B', kind: 'hse', lang: 'hy' },
    { url: 'https://ich.unesco.org/fr/RL/c', title: 'C', kind: 'unesco' },
    { url: 'https://en.wikipedia.org/wiki/D', title: 'D', kind: 'wikipedia', lang: 'en' },
  ]
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: { ...list[0], sources }, list, bySlug: cultureLangsBySlug(list), cssHref: CSS, now: NOW })
  assert.ok(html.includes('>A</a> (Wikipedia fr)'))
  assert.ok(html.includes('>B</a> (ՀՍՀ, Wikisource)'))
  assert.ok(html.includes('>C</a> (UNESCO)'))
  assert.ok(html.includes('>D</a> (Wikipedia en)'))
  assert.ok(html.includes('Wikisource (CC BY-SA 3.0)'))
})

test('article sans image : motif, pas de <img>', async () => {
  const { list } = await fixture()
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[1], list, bySlug: cultureLangsBySlug(list), cssHref: CSS, now: NOW })
  assert.ok(html.includes('culture__figure--motif'))
  // Aucune image de CET article (la flèche vers komitas porte la sienne).
  assert.ok(!html.includes('/culture/duduk/image'))
})

test('index : cartes de la langue ; vide → noindex', async () => {
  const { list } = await fixture()
  const bySlug = cultureLangsBySlug(list)
  const fr = cultureIndexHtml({ siteId: 'ch', lang: 'fr', list, bySlug, cssHref: CSS })
  assert.ok(fr.includes('href="/culture/komitas/"') && fr.includes('href="/culture/duduk/"'))
  assert.ok(!fr.includes('noindex'))
  const vide = cultureIndexHtml({ siteId: 'org', lang: 'ru', list: [], bySlug: new Map(), cssHref: CSS })
  assert.ok(vide.includes('noindex, follow'))
})

test('writeCulturePages : langues de la vitrine seulement, images copiées', async () => {
  const { dir, list } = await fixture()
  const dist = await mkdtemp(path.join(tmpdir(), 'dist-'))
  const n = await writeCulturePages(SITES.org, dist, list, CSS, dir, NOW)
  // .org : index en/hy/ru (3) + komitas en/hy/ru (3) + duduk en/hy (2)
  assert.equal(n, 8)
  await access(path.join(dist, 'hy/culture/komitas/index.html'))
  await access(path.join(dist, 'culture/komitas/image.jpg'))
  await access(path.join(dist, 'culture/komitas/image.webp'))
  await assert.rejects(access(path.join(dist, 'ru/culture/duduk/index.html')))
  await assert.rejects(access(path.join(dist, 'culture/duduk/image.jpg')))
  const ch = await mkdtemp(path.join(tmpdir(), 'dist-'))
  // .ch : index fr/de/it (3) + komitas fr + duduk fr. de/it n'ont pas
  // (encore) d'article : leur index existe, vide, donc noindex.
  assert.equal(await writeCulturePages(SITES.ch, ch, list, CSS, dir, NOW), 5)
  assert.match(await readFile(path.join(ch, 'culture/index.html'), 'utf-8'), /<html lang="fr">/)
  const de = await readFile(path.join(ch, 'de/kultur/index.html'), 'utf-8')
  assert.match(de, /<html lang="de">/)
  assert.ok(de.includes('noindex, follow'))
  await access(path.join(ch, 'it/cultura/index.html'))
  await assert.rejects(access(path.join(ch, 'de/kultur/komitas/index.html')))
})

test('événement invalide : ignoré sans exception (date numérique, URL non https, sans titre)', async () => {
  const good = { title: 'Concert', url: 'https://e/1', date: '2026-10-25T20:00' }
  for (const bad of [
    { ...good, date: 1761418800000 },
    { ...good, url: 'javascript:alert(1)' },
    { ...good, title: '' },
    { url: good.url, date: good.date },
    { ...good, date: 'demain' },
  ]) {
    const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
    await writeArticle(dir, 'komitas', { m: meta('komitas', { agendaEvent: bad }) })
    const list = await loadCulture(dir, silent)
    const dist = await mkdtemp(path.join(tmpdir(), 'dist-'))
    assert.equal(await writeCulturePages(SITES.ch, dist, list, CSS, dir, NOW), 4, JSON.stringify(bad))
    const html = await readFile(path.join(dist, 'culture/komitas/index.html'), 'utf-8')
    assert.ok(!html.includes('culture__event'), JSON.stringify(bad))
    assert.ok(!html.includes('javascript:'))
  }
})

test('chaque font-family .culture est suivie de son font-size-adjust', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf-8')
  const start = css.indexOf('/* === Culture')
  assert.ok(start > 0, 'bloc Culture présent')
  const lines = css.slice(start).split('\n')
  lines.forEach((l, i) => {
    const m = l.match(/font-family: var\(--font-(display|body|mono)\)/)
    if (!m) return
    const fsa = { display: 'display', body: 'body', mono: 'util' }[m[1]]
    assert.match(lines[i + 1], new RegExp(`font-size-adjust: var\\(--fsa-${fsa}\\)`), `ligne ${i}`)
  })
})
