// Les workflows ne s'exécutent pas en test ; on garde ici les trois règles
// dont l'oubli ne se verrait qu'en production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const FILES = ['articles.yml', 'articles-translate.yml', 'articles-check.yml', 'articles-closed.yml']
const read = (f) => readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')

for (const f of FILES) {
  test(`${f} : aucun secret Firebase`, async () => {
    assert.doesNotMatch(await read(f), /FIREBASE/)
  })
  test(`${f} : aucune donnée non fiable interpolée dans un run:`, async () => {
    const y = await read(f)
    const runs = [...y.matchAll(/run: \|\n((?:\s{10,}.*\n?)+)/g)].map((m) => m[1]).join('\n')
    assert.doesNotMatch(runs, /\$\{\{\s*(github\.event\.pull_request\.(title|body|head\.ref)|github\.head_ref|steps\.[^}]*outputs\.title)/)
  })
}

test('les robots publient le statut culture-check eux-mêmes', async () => {
  for (const f of ['articles.yml', 'articles-translate.yml']) assert.match(await read(f), /statuses\/.*context=culture-check/s, f)
})
