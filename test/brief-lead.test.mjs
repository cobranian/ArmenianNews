import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { latestBrief } from '../scripts/lib/brief-lead.mjs'
import { briefUrl } from '../sites.config.js'

const brief = (date, n) => ({
  date,
  lang: 'de',
  intro: `Einleitung ${date}`,
  topics: Array.from({ length: n }, (_, i) => ({ title: `Thema ${i + 1}`, text: 'Text', sources: [] })),
})

test('latestBrief : la date la plus récente, trois sujets au plus', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'brief-lead-'))
  await mkdir(path.join(root, 'de'))
  await writeFile(path.join(root, 'de', '2026-10-21.json'), JSON.stringify(brief('2026-10-21', 2)))
  await writeFile(path.join(root, 'de', '2026-10-22.json'), JSON.stringify(brief('2026-10-22', 5)))
  await writeFile(path.join(root, 'de', 'notes.txt'), 'pas une brève')
  const got = await latestBrief(root, 'de')
  assert.deepEqual(got, {
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
  const root = await mkdtemp(path.join(tmpdir(), 'brief-lead-'))
  await mkdir(path.join(root, 'de'))
  await writeFile(path.join(root, 'de', '2026-10-22.json'), '{ pas du json')
  assert.equal(await latestBrief(root, 'de'), null)
})

test('latestBrief : brève sans sujet exploitable → null', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'brief-lead-'))
  await mkdir(path.join(root, 'de'))
  await writeFile(path.join(root, 'de', '2026-10-22.json'), JSON.stringify({ intro: 'x', topics: 'non' }))
  assert.equal(await latestBrief(root, 'de'), null)
})
