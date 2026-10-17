// Les workflows ne s'exécutent pas en test ; on garde ici les trois règles
// dont l'oubli ne se verrait qu'en production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const FILES = ['articles.yml', 'articles-translate.yml', 'articles-check.yml', 'articles-closed.yml', 'articles-publish.yml', 'articles-revise.yml']
const read = (f) => readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')

for (const f of FILES) {
  test(`${f} : aucun secret Firebase`, async () => {
    assert.doesNotMatch(await read(f), /FIREBASE/)
  })
  test(`${f} : aucune donnée non fiable interpolée dans un run:`, async () => {
    const y = await read(f)
    const runs = [...y.matchAll(/run: \|\n((?:\s{10,}.*\n?)+)/g)].map((m) => m[1]).join('\n')
    assert.doesNotMatch(runs, /\$\{\{\s*(github\.event\.pull_request\.(title|body|head\.ref)|github\.event\.comment\.body|github\.event\.issue\.(title|body)|github\.head_ref|steps\.[^}]*outputs\.(title|branch))/)
  })
}

test('traduction : rebase avant le push (un relecteur a pu pousser entre-temps)', async () => {
  const y = await read('articles-translate.yml')
  assert.match(y, /pull --rebase origin "\$BRANCH"/)
  assert.ok(y.indexOf('pull --rebase') < y.indexOf('git push origin "HEAD:$BRANCH"'), 'rebase avant le push')
  assert.match(y, /rebase --abort/)
})

test('articles-revise.yml : OWNER et /corrige exigés dans le if', async () => {
  const y = await read('articles-revise.yml')
  const m = y.match(/^ {4}if: >-\n((?: {6}.*\n)+)/m)
  assert.ok(m, 'if: du job')
  const cond = m[1]
  assert.match(cond, /github\.event\.issue\.pull_request/)
  assert.match(cond, /github\.event\.comment\.author_association == 'OWNER'/)
  assert.match(cond, /startsWith\(github\.event\.comment\.body, '\/corrige'\)/)
  assert.doesNotMatch(cond, /\|\|/, 'aucune alternative qui contournerait la garde')
  assert.match(y, /issue_comment:\n\s+types: \[created\]/)
  assert.match(y, /cancel-in-progress: false/)
  // Le corps du commentaire n'atteint le script que par env: puis fichier.
  assert.match(y, /COMMENT: \$\{\{ github\.event\.comment\.body \}\}/)
  assert.match(y, /culture\/\*\)/, 'branche culture/ seulement')
  assert.match(y, /"OPEN"/, 'PR ouverte seulement')
})

test('articles-revise.yml : concurrence au niveau du job, pas du workflow', async () => {
  const y = await read('articles-revise.yml')
  // Au niveau du workflow, n'importe quel commentaire (job ensuite sauté par
  // le if:) entrerait dans le groupe et évincerait un /corrige en attente.
  assert.doesNotMatch(y, /^concurrency:/m)
  const job = y.slice(y.indexOf('\n  revise:\n'))
  assert.match(job, /^ {4}concurrency:\n {6}group: culture-revise-\$\{\{ github\.event\.issue\.number \}\}\n {6}cancel-in-progress: false$/m)
})

test('articles-revise.yml : la réponse part dans une dernière étape always()', async () => {
  const y = await read('articles-revise.yml')
  const last = y.slice(y.lastIndexOf('      - name:'))
  assert.match(last, /if: always\(\)/)
  assert.match(last, /gh pr comment "\$PR" --body-file "\$RUNNER_TEMP\/reply\.md"/)
  assert.ok(y.indexOf('git push origin') < y.lastIndexOf('      - name:'), 'le push précède l’étape de réponse')
})

test('articles-revise.yml : rebase avant push', async () => {
  const y = await read('articles-revise.yml')
  assert.match(y, /pull --rebase origin "\$BRANCH"/)
  assert.ok(y.indexOf('pull --rebase') < y.indexOf('git push origin "HEAD:$BRANCH"'), 'rebase avant le push')
  assert.match(y, /rebase --abort/)
})

test('culture-draft : --out-body par défaut hors du dépôt', async () => {
  const src = await readFile(new URL('../scripts/culture-draft.mjs', import.meta.url), 'utf-8')
  assert.match(src, /'out-body': \{ type: 'string', default: path\.join\(tmpdir\(\), 'culture-body\.md'\) \}/)
})

test('les robots publient le statut culture-check eux-mêmes', async () => {
  for (const f of ['articles.yml', 'articles-translate.yml', 'articles-revise.yml']) assert.match(await read(f), /statuses\/.*context=culture-check/s, f)
})

test('articles.yml : cron quotidien 0 3 * * *', async () => {
  const y = await read('articles.yml')
  assert.match(y, /cron: '0 3 \* \* \*'/)
  assert.doesNotMatch(y, /cron: '0 6 \* \* 1'/)
  assert.match(y, /^name: Culture — brouillon quotidien$/m)
})

test('articles.yml : idées seulement sans issue ouverte (--ideas-open)', async () => {
  const y = await read('articles.yml')
  assert.match(y, /gh issue list --state open --search 'in:title "Culture : idées de sujets"'/)
  assert.match(y, /--ideas-open/)
  assert.match(y, /if: steps\.draft\.outputs\.ideas == '1'/)
  assert.doesNotMatch(y, /outputs\.issue/)
  const src = await readFile(new URL('../scripts/culture-draft.mjs', import.meta.url), 'utf-8')
  assert.match(src, /'ideas-open': \{ type: 'boolean'/)
  assert.match(src, /'out-ideas': \{ type: 'string', default: path\.join\(tmpdir\(\), 'culture-ideas\.md'\) \}/)
})
