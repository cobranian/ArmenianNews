import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  loadBriefs, cssHrefFrom, briefPageHtml, briefIndexHtml, writeBriefPages,
} from '../scripts/lib/brief-pages.mjs'
import { briefLangsByDate, longDate } from '../scripts/lib/brief-links.mjs'
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

test('sitemap : index de chaque langue, pages datées existantes seulement', () => {
  const briefs = { fr: [b('fr', '2026-10-16')], en: [], hy: [b('hy', '2026-10-16')], ru: [] }
  const org = sitemapFor('org', '2026-10-16T05:00:00Z', briefs)
  assert.ok(org.includes(`<loc>${briefUrl('en')}</loc>`))
  assert.ok(org.includes(`<loc>${briefUrl('hy', '2026-10-16')}</loc>`))
  assert.ok(!org.includes(`<loc>${briefUrl('en', '2026-10-16')}</loc>`))
  assert.ok(!org.includes('armenieinfo.ch/breve/2026-10-16/</loc>'))
  assert.ok(org.includes('<lastmod>2026-10-16T03:23:00Z</lastmod>'))
  // Sans brèves : les entrées d'index existent quand même.
  assert.ok(sitemapFor('ch', '2026-10-16T05:00:00Z').includes(`<loc>${briefUrl('fr')}</loc>`))
  for (const l of ['de', 'it']) assert.ok(sitemapFor('ch', '2026-10-16T05:00:00Z').includes(`<loc>${briefUrl(l)}</loc>`), l)
})

// --- Validation profonde : une brève corrompue à la main ne casse jamais le build.
async function loadFrom(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'briefs-'))
  await mkdir(path.join(dir, 'fr'))
  for (const [name, obj] of Object.entries(files))
    await writeFile(path.join(dir, 'fr', name), JSON.stringify(obj))
  const warns = []
  const got = await loadBriefs(dir, { warn: (m) => warns.push(m) })
  return { got, warns }
}
const goodTopic = { title: 'Bon', text: 'ok', rubric: 'politique', sources: [{ source: 'armenpress', url: 'https://a/1', title: 'A' }] }

test('loadBriefs : un sujet sans sources est retiré, le reste charge', async () => {
  const { got, warns } = await loadFrom({
    '2026-10-16.json': b('fr', '2026-10-16', { topics: [{ title: 'X', text: 'y', rubric: null }, goodTopic] }),
  })
  assert.equal(got.fr.length, 1)
  assert.equal(got.fr[0].topics.length, 1)
  assert.equal(warns.length, 0)
})

test('loadBriefs : seul sujet sans sources → fichier ignoré avec avertissement', async () => {
  const { got, warns } = await loadFrom({
    '2026-10-16.json': b('fr', '2026-10-16', { topics: [{ title: 'X', text: 'y', rubric: null }] }),
  })
  assert.equal(got.fr.length, 0)
  assert.equal(warns.length, 1)
})

test('loadBriefs : generatedAt absent ou illisible → ignoré avec avertissement', async () => {
  const noDate = b('fr', '2026-10-16'); delete noDate.generatedAt
  const { got, warns } = await loadFrom({
    '2026-10-16.json': noDate,
    '2026-10-15.json': b('fr', '2026-10-15', { generatedAt: 'pas une date' }),
  })
  assert.equal(got.fr.length, 0)
  assert.equal(warns.length, 2)
})

test('loadBriefs : URL non http(s) retirée, rubrique inconnue → null, build sans "undefined"', async () => {
  const bad = { title: 'Mauvais', text: 't', rubric: 'météo', sources: [
    { source: 'armenpress', url: 'javascript:alert(1)', title: 'J' },
    { source: 'civilnet', url: 'https://b/2', title: 'B' },
  ] }
  const onlyBad = { title: 'Pire', text: 't', rubric: null, sources: [{ source: 'armenpress', url: 'javascript:alert(1)', title: 'J' }] }
  const { got } = await loadFrom({
    '2026-10-16.json': b('fr', '2026-10-16', { topics: [bad, onlyBad] }),
  })
  assert.equal(got.fr[0].topics.length, 1)
  assert.deepEqual(got.fr[0].topics[0].sources.map((x) => x.url), ['https://b/2'])
  assert.equal(got.fr[0].topics[0].rubric, null)
  const briefs = { fr: got.fr, en: [], hy: [], ru: [] }
  const dist = await mkdtemp(path.join(tmpdir(), 'dist-'))
  await writeBriefPages(SITES.ch, dist, briefs, CSS)
  const html = await readFile(path.join(dist, 'breve', '2026-10-16', 'index.html'), 'utf-8')
  assert.ok(!html.includes('javascript:'))
  assert.ok(!html.includes('undefined'))
  assert.ok(!sitemapFor('ch', '2026-10-16T05:00:00Z', briefs).includes('undefined'))
})

test('topicsHtml : rubrique sans libellé → pas de pastille', () => {
  const brief = b('fr', '2026-10-16', { topics: [{ ...goodTopic, rubric: 'inconnue' }] })
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief, list: [brief], byDate: briefLangsByDate({ fr: [brief] }), cssHref: CSS })
  assert.ok(!html.includes('brief__rubric'))
})

test('index vide : noindex, follow ; index rempli : pas de robots', () => {
  const empty = briefIndexHtml({ siteId: 'ch', lang: 'fr', list: [], byDate: new Map(), cssHref: CSS })
  assert.ok(empty.includes('<meta name="robots" content="noindex, follow" />'))
  const list = [b('fr', '2026-10-16')]
  const full = briefIndexHtml({ siteId: 'ch', lang: 'fr', list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.ok(!full.includes('name="robots"'))
})

test('sélecteur de langue : brève du même jour si elle a paru, sinon l’index de la langue', () => {
  const briefs = { fr: [b('fr', '2026-10-16')], en: [b('en', '2026-10-16')], hy: [], ru: [] }
  const byDate = briefLangsByDate(briefs)
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief: briefs.fr[0], list: briefs.fr, byDate, cssHref: '/a.css' })
  const bar = html.slice(html.indexOf('class="lang"'))
  assert.ok(bar.includes(`href="${briefUrl('en', '2026-10-16')}" hreflang="en"`))
  assert.ok(bar.includes(`href="${briefUrl('hy')}" hreflang="hy"`), 'pas de brève hy ce jour-là')
  assert.ok(bar.includes('hreflang="fr" lang="fr" title="Français" aria-current="page"'))
})

// --- SEO (audit du 17 octobre 2026).
const h1Of = (html) => html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '')

test('page datée : le H1 nomme la page ET porte sa date', () => {
  const list = [b('fr', '2026-10-16')]
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief: list[0], list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.equal(html.split('<h1').length - 1, 1)
  const h1 = h1Of(html)
  assert.ok(h1.includes('La brève du jour'), h1)
  assert.ok(h1.includes('vendredi 16 octobre 2026'), h1)
})

test('index : ne recopie pas le texte de la dernière brève (doublon de la page datée)', () => {
  const list = [b('fr', '2026-10-16')]
  const html = briefIndexHtml({ siteId: 'ch', lang: 'fr', list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.equal(h1Of(html), 'La brève du jour')
  assert.ok(!html.includes('Texte &amp; suite.'), 'le texte des sujets reste sur la page datée')
  assert.ok(html.includes('Titre &quot;1&quot; &lt;script&gt;'), 'les titres restent, en liens')
  assert.ok(html.includes('Intro &amp; &lt;b&gt;'), 'le chapô reste')
  assert.ok(html.includes(`<a href="${briefPath('fr', '2026-10-16')}">Lire la brève complète →</a>`))
})

// Une langue absente de la table des locales ne fait pas d'erreur : Intl
// retombe sur la locale de la MACHINE qui bâtit (« vendredi » sur un poste
// français, « Friday » en CI) — la page allemande portait une date française.
test('longDate : chaque langue écrit la date dans sa propre langue', () => {
  const want = { fr: 'vendredi', de: 'Freitag', it: 'venerdì', en: 'Friday', ru: 'пятница', hy: 'հոկտեմբերի' }
  for (const [lang, day] of Object.entries(want))
    assert.match(longDate(lang, '2026-10-16'), new RegExp(day, 'i'), lang)
})
