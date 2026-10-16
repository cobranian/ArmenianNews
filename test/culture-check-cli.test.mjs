// test/culture-check-cli.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeArticle, texts } from './helpers/culture-fixture.mjs'

const CLI = fileURLToPath(new URL('../scripts/culture-check.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' })
const last = (r) => r.stdout.trim().split('\n').at(-1)

async function dir() {
  const d = await mkdtemp(path.join(tmpdir(), 'culture-cli-'))
  await writeFile(path.join(d, 'sujets.json'), JSON.stringify({ topics: [{ slug: 'komitas', title: 'K', wikipedia: { fr: 'K' }, keywords: [], status: 'pending' }] }))
  return d
}

test('article conforme : exit 0, résumé vert', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas')
  const r = run('--dir', d, 'komitas')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(last(r), /^✓/)
})

test('traduction manquante : exit 1, résumé ≤ 140 caractères avec la cause', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas', { t: { ...texts(), ru: null } })
  const r = run('--dir', d, 'komitas')
  assert.equal(r.status, 1)
  assert.match(last(r), /ru\.md absent/)
  assert.ok(last(r).length <= 140)
})

test('case « Faits vérifiés » : exigée seulement avec --pr-body', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas')
  const body = path.join(d, 'body.md')
  await writeFile(body, '- [ ] Faits vérifiés')
  assert.equal(run('--dir', d, '--pr-body', body, 'komitas').status, 1)
  await writeFile(body, '- [x] Faits vérifiés')
  assert.equal(run('--dir', d, '--pr-body', body, 'komitas').status, 0)
})

test('dossier au nom invalide : exit 1, cause nommée', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas')
  await mkdir(path.join(d, 'Duduk'))
  const r = run('--dir', d)
  assert.equal(r.status, 1, r.stdout)
  assert.match(r.stdout, /culture\/Duduk : nom de dossier invalide/)
})

test('sujets.json invalide : exit 1', async () => {
  const d = await dir()
  await writeFile(path.join(d, 'sujets.json'), JSON.stringify({ topics: [{ slug: 'X' }] }))
  assert.equal(run('--dir', d).status, 1)
})
