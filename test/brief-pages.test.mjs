import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  loadBriefs, cssHrefFrom, briefPageHtml, briefIndexHtml, writeBriefPages,
} from '../scripts/lib/brief-pages.mjs'
import { briefLangsByDate } from '../scripts/lib/brief-links.mjs'
import { sitemapFor } from '../scripts/lib/sitemap.mjs'
import { SITES, briefUrl, briefPath } from '../sites.config.js'

const b = (lang, date, extra = {}) => ({
  date, lang, generatedAt: `${date}T03:23:00Z`, model: 'm', intro: 'Intro & <b>',
  topics: [
    { title: 'Titre "1" <script>', text: 'Texte & suite.', rubric: 'politique',
      sources: [
        { source: 'armenpress', url: 'https://a/1?x=1&y=2', title: 'A' },
        { source: 'civilnet', url: 'https://b/2', title: 'B' },
      ] },
    { title: 'Deux', text: 'x', rubric: null, sources: [{ source: 'courrier', url: 'https://c/3', title: 'C' }] },
  ],
  ...extra,
})
const CSS = '/assets/index-abc.css'

test('cssHrefFrom lit la feuille hachée du HTML bâti', () => {
  assert.equal(cssHrefFrom('<link rel="stylesheet" crossorigin href="/assets/index-DpuyAKNh.css">'), '/assets/index-DpuyAKNh.css')
  assert.throws(() => cssHrefFrom('<html></html>'))
})

test('loadBriefs : tri, fichiers corrompus ignorés', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'briefs-'))
  await mkdir(path.join(dir, 'fr'))
  await writeFile(path.join(dir, 'fr', '2026-10-15.json'), JSON.stringify(b('fr', '2026-10-15')))
  await writeFile(path.join(dir, 'fr', '2026-10-16.json'), JSON.stringify(b('fr', '2026-10-16')))
  await writeFile(path.join(dir, 'fr', '2026-10-17.json'), '{ cassé')
  await writeFile(path.join(dir, 'fr', '2026-10-18.json'), JSON.stringify(b('fr', '2026-10-01')))
  const warns = []
  const got = await loadBriefs(dir, { warn: (m) => warns.push(m) })
  assert.deepEqual(got.fr.map((x) => x.date), ['2026-10-16', '2026-10-15'])
  assert.deepEqual(got.en, [])
  assert.equal(warns.length, 2)
})

test('page datée : contenu, échappement, liens, veille/lendemain', () => {
  const list = [b('fr', '2026-10-17'), b('fr', '2026-10-16'), b('fr', '2026-10-15')]
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief: list[1], list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(html.includes('<html lang="fr">'))
  assert.ok(html.includes(`<link rel="stylesheet" href="${CSS}">`))
  assert.ok(html.includes('vendredi 16 octobre 2026'))
  assert.ok(html.includes('Titre &quot;1&quot; &lt;script&gt;'))
  assert.ok(!html.includes('Titre "1" <script>'))
  assert.ok(html.includes('Intro &amp; &lt;b&gt;'))
  assert.ok(html.includes('href="https://a/1?x=1&amp;y=2"'))
  assert.ok(html.includes('>Armenpress</a>'))
  assert.ok(html.includes('>Politique<'))
  assert.ok(html.includes(`href="${briefPath('fr', '2026-10-15')}"`), 'veille')
  assert.ok(html.includes(`href="${briefPath('fr', '2026-10-17')}"`), 'lendemain')
  assert.ok(html.includes('Synthèse automatique'))
  assert.ok(html.includes('data-brief="2026-10-16"'))
})

test('sources : un nom de source n’est jamais répété, les suivantes sont numérotées', () => {
  const brief = b('fr', '2026-10-16', {
    topics: [{ title: 'T', text: 'x', rubric: null, sources: [
      { source: 'armenpress', url: 'https://a/1', title: 'Premier' },
      { source: 'armenpress', url: 'https://a/2', title: 'Second' },
      { source: 'civilnet', url: 'https://b/1', title: 'Autre' },
    ] }],
  })
  const list = [brief]
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief, list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.equal(html.split('>Armenpress</a>').length - 1, 1)
  assert.ok(html.includes('aria-label="Armenpress 2"'))
  assert.ok(/<a [^>]*>2<\/a>/.test(html))
  assert.ok(html.includes('title="Second"'))
  const i2 = html.indexOf('>2</a>')
  const iCivil = html.indexOf('>CivilNet</a>')
  assert.ok(i2 > 0 && iCivil > i2)
  assert.ok(!html.slice(0, i2).includes('Armenpress</a> · '))
  assert.ok(html.slice(i2, iCivil).includes('</a> · '))
})

test('page datée la plus ancienne : pas de veille', () => {
  const list = [b('fr', '2026-10-16'), b('fr', '2026-10-15')]
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief: list[1], list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.ok(!html.includes('← Veille'))
  assert.ok(html.includes('Lendemain →'))
})

test('index : dernière brève + archive ; vide : message d’attente', () => {
  const list = [b('en', '2026-10-16'), b('en', '2026-10-15')]
  const html = briefIndexHtml({ siteId: 'org', lang: 'en', list, byDate: briefLangsByDate({ en: list }), cssHref: CSS })
  assert.ok(html.includes(`<link rel="canonical" href="${briefUrl('en')}" />`))
  assert.ok(html.includes('Friday, October 16, 2026'))
  assert.ok(html.includes(`href="${briefPath('en', '2026-10-15')}"`))
  assert.ok(html.includes('data-brief="index"'))
  const empty = briefIndexHtml({ siteId: 'org', lang: 'ru', list: [], byDate: new Map(), cssHref: CSS })
  assert.ok(empty.includes('Первая сводка появится завтра утром.'))
  assert.ok(empty.includes('<html lang="ru">'))
})

test('writeBriefPages : chaque vitrine ne bâtit que ses langues', async () => {
  const dist = await mkdtemp(path.join(tmpdir(), 'dist-'))
  const briefs = { fr: [b('fr', '2026-10-16')], en: [b('en', '2026-10-16')], hy: [], ru: [] }
  const n = await writeBriefPages(SITES.org, dist, briefs, CSS)
  assert.equal(n, 4) // /brief/, /brief/2026-10-16/, /hy/brief/, /ru/brief/
  await readFile(path.join(dist, 'brief', '2026-10-16', 'index.html'), 'utf-8')
  await readFile(path.join(dist, 'hy', 'brief', 'index.html'), 'utf-8')
  await assert.rejects(readFile(path.join(dist, 'breve', 'index.html')))
})

test('sitemap : index des quatre langues, pages datées existantes seulement', () => {
  const briefs = { fr: [b('fr', '2026-10-16')], en: [], hy: [b('hy', '2026-10-16')], ru: [] }
  const org = sitemapFor('org', '2026-10-16T05:00:00Z', briefs)
  assert.ok(org.includes(`<loc>${briefUrl('en')}</loc>`))
  assert.ok(org.includes(`<loc>${briefUrl('hy', '2026-10-16')}</loc>`))
  assert.ok(!org.includes(`<loc>${briefUrl('en', '2026-10-16')}</loc>`))
  assert.ok(!org.includes('armenieinfo.ch/breve/2026-10-16/</loc>'))
  assert.ok(org.includes('<lastmod>2026-10-16T03:23:00Z</lastmod>'))
  // Sans brèves : les entrées d'index existent quand même.
  assert.ok(sitemapFor('ch', '2026-10-16T05:00:00Z').includes(`<loc>${briefUrl('fr')}</loc>`))
})
