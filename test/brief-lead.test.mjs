import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { latestBrief } from '../scripts/lib/brief-lead.mjs'
import { briefUrl } from '../sites.config.js'

// Une brève que brief-pages.mjs accepte (cleanBrief) : même langue et même
// date que son fichier, generatedAt lisible, sujets avec texte et source http.
const brief = (date, n, lang = 'de') => ({
  date,
  lang,
  generatedAt: `${date}T03:30:00.000Z`,
  intro: `Einleitung ${date}`,
  topics: Array.from({ length: n }, (_, i) => ({
    title: `Thema ${i + 1}`,
    text: 'Text',
    sources: [{ source: 'armenpress', url: 'https://armenpress.am/x', title: 'x' }],
  })),
})

async function dirWith(files, lang = 'de') {
  const root = await mkdtemp(path.join(tmpdir(), 'brief-lead-'))
  await mkdir(path.join(root, lang))
  for (const [name, body] of Object.entries(files))
    await writeFile(path.join(root, lang, name), typeof body === 'string' ? body : JSON.stringify(body))
  return root
}

test('latestBrief : la date la plus récente, trois sujets au plus', async () => {
  const root = await dirWith({
    '2026-10-21.json': brief('2026-10-21', 2),
    '2026-10-22.json': brief('2026-10-22', 5),
    'notes.txt': 'pas une brève',
  })
  assert.deepEqual(await latestBrief(root, 'de'), {
    date: '2026-10-22',
    url: briefUrl('de', '2026-10-22'),
    intro: 'Einleitung 2026-10-22',
    topics: [{ title: 'Thema 1' }, { title: 'Thema 2' }, { title: 'Thema 3' }],
  })
})

test('latestBrief : dossier absent ou vide → null', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'brief-lead-'))
  assert.equal(await latestBrief(root, 'it'), null)
  await mkdir(path.join(root, 'it'))
  assert.equal(await latestBrief(root, 'it'), null)
})

test('latestBrief : JSON illisible → null, sans lever', async () => {
  const root = await dirWith({ '2026-10-22.json': '{ pas du json' })
  assert.equal(await latestBrief(root, 'de'), null)
})

// Le lien du bloc vise la page datée : une brève que le constructeur de pages
// écarte ne doit jamais être retenue, sinon le lien est mort.
test('latestBrief : la plus récente est écartée par brief-pages → la précédente valide', async () => {
  const root = await dirWith({
    '2026-10-21.json': brief('2026-10-21', 2),
    '2026-10-22.json': brief('2026-10-22', 3, 'fr'),
  })
  assert.equal((await latestBrief(root, 'de')).date, '2026-10-21')
})

test('latestBrief : aucune brève que brief-pages accepterait → null', async () => {
  const sansSource = brief('2026-10-23', 2)
  sansSource.topics.forEach((t) => (t.sources = []))
  const sansGeneratedAt = { ...brief('2026-10-24', 2), generatedAt: undefined }
  const root = await dirWith({
    '2026-10-22.json': brief('2026-10-22', 3, 'fr'),
    '2026-10-23.json': sansSource,
    '2026-10-24.json': sansGeneratedAt,
    '2026-10-25.json': brief('2026-10-21', 2),
  })
  assert.equal(await latestBrief(root, 'de'), null)
})
