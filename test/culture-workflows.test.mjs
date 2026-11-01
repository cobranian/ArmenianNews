// Les workflows ne s'exécutent pas en test ; on garde ici les trois règles
// dont l'oubli ne se verrait qu'en production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const FILES = ['articles.yml', 'articles-translate.yml', 'articles-check.yml', 'articles-closed.yml', 'articles-publish.yml', 'articles-revise.yml', 'articles-ideas.yml', 'articles-backfill.yml']
// Fins de ligne normalisées : sous Windows (core.autocrlf), git extrait les
// workflows en CRLF, et les motifs multilignes ne verraient plus rien.
const read = async (f) =>
  (await readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

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

test('articles-ideas.yml : OWNER exigé, pas sur une PR, titre exact, /ajoute ou /rejette', async () => {
  const y = await read('articles-ideas.yml')
  const m = y.match(/^ {4}if: >-\n((?: {6}.*\n)+)/m)
  assert.ok(m, 'if: du job')
  const cond = m[1]
  assert.match(cond, /!github\.event\.issue\.pull_request &&/)
  assert.match(cond, /github\.event\.issue\.title == 'Culture : idées de sujets' &&/)
  // Dépôt public : une issue homonyme d'un tiers porterait un JSON fabriqué.
  assert.match(cond, /github\.event\.issue\.user\.login == 'github-actions\[bot\]' &&/)
  assert.match(cond, /github\.event\.comment\.author_association == 'OWNER' &&/)
  assert.match(cond, /\(startsWith\(github\.event\.comment\.body, '\/ajoute'\) \|\| startsWith\(github\.event\.comment\.body, '\/rejette'\)\)/)
  // Le seul || est celui des deux commandes, entre parenthèses : aucune
  // alternative ne contourne les gardes.
  assert.equal(cond.match(/\|\|/g).length, 1)
  assert.match(y, /issue_comment:\n\s+types: \[created\]/)
  assert.doesNotMatch(y, /^concurrency:/m, 'concurrence au niveau du job')
  assert.match(y.slice(y.indexOf('\n  ideas:\n')), /^ {4}concurrency:\n {6}group: culture-ideas\n {6}cancel-in-progress: false$/m)
  assert.match(y, /^permissions:\n {2}contents: write\n {2}issues: write\n\n/m)
  assert.match(y, /COMMENT: \$\{\{ github\.event\.comment\.body \}\}/)
  // Le corps est relu APRÈS l'attente du groupe : celui de l'événement daterait
  // d'avant le /ajoute précédent.
  assert.match(y, /gh issue view "\$ISSUE" --json body/)
  assert.match(y, /ref: main/)
})

test('articles-ideas.yml : commit sur main par la boucle rebase/push, puis issue, réponse always()', async () => {
  const y = await read('articles-ideas.yml')
  assert.match(y, /git commit -m "Culture : sujets ajoutés depuis les idées"/)
  assert.match(y, /for i in 1 2 3; do\n\s+git pull --rebase origin main && git push origin HEAD:main/)
  assert.ok(y.indexOf('git push origin HEAD:main') < y.indexOf('gh issue edit "$ISSUE" --body-file'), 'sujets.json sur main avant de réécrire l’issue')
  const last = y.slice(y.lastIndexOf('      - name:'))
  assert.match(last, /if: always\(\)/)
  assert.match(last, /gh issue comment "\$ISSUE" --body-file "\$RUNNER_TEMP\/reply\.md"/)
  assert.match(last, /gh issue close "\$ISSUE"/)
  // « issue fermée » n'est écrit qu'une fois la fermeture réussie, et la
  // réponse part après.
  assert.match(last, /if gh issue close "\$ISSUE"; then\n\s+printf '%s\\n' "Plus aucune idée en attente : issue fermée\."/)
  assert.ok(last.indexOf('gh issue close') < last.indexOf('gh issue comment'), 'fermeture avant la réponse')
  // Pas d'attente inutile après le dernier essai.
  assert.match(y, /\[ "\$i" -lt 3 \] && sleep 10/)
  assert.match(y, /👀 absent/, 'commande perdue documentée')
})

test('articles.yml : seule une issue d’idées DU ROBOT compte comme ouverte', async () => {
  const y = await read('articles.yml')
  assert.match(y, /gh issue list --state open --author app\/github-actions --search 'in:title "Culture : idées de sujets"'/)
})

test('culture-draft : --out-body par défaut hors du dépôt', async () => {
  const src = await readFile(new URL('../scripts/culture-draft.mjs', import.meta.url), 'utf-8')
  assert.match(src, /'out-body': \{ type: 'string', default: path\.join\(tmpdir\(\), 'culture-body\.md'\) \}/)
})

test('les robots publient le statut culture-check eux-mêmes', async () => {
  for (const f of ['articles.yml', 'articles-translate.yml', 'articles-revise.yml']) assert.match(await read(f), /statuses\/.*context=culture-check/s, f)
})

// La décision de publier ne doit dépendre ni du contains() du if: (qui voit
// la section du robot), ni du code de la branche relue (une branche ouverte
// avant le correctif en garde l'ancien) : elle lit le module de la BASE.
test('articles-publish.yml : la case est contrôlée par le code de la base, avant tout', async () => {
  const y = await read('articles-publish.yml')
  const gate = y.indexOf('git show FETCH_HEAD:scripts/lib/culture-checkbox.mjs')
  assert.ok(gate > 0)
  assert.match(y, /git fetch --no-tags --depth=1 origin "\$GITHUB_BASE_REF"/)
  assert.match(y, /factsChecked\(process\.env\.BODY\)/)
  assert.ok(gate < y.indexOf('npm ci'), 'avant npm ci')
  assert.ok(gate < y.indexOf('scripts/culture-check.mjs'), 'avant la traduction')
  assert.ok(gate < y.indexOf('gh pr merge'), 'avant la fusion')
  assert.doesNotMatch(y.slice(gate - 600, gate + 600), /continue-on-error/)
  // Lu seul par git show : un import le rendrait inutilisable.
  const src = await readFile(new URL('../scripts/lib/culture-checkbox.mjs', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /^\s*import\b|\bimport\s*\(|^\s*export\s+[^\n]*\bfrom\s+['"]/m)
})

test('articles.yml : cron quotidien 0 3 * * *', async () => {
  const y = await read('articles.yml')
  assert.match(y, /cron: '0 3 \* \* \*'/)
  assert.doesNotMatch(y, /cron: '0 6 \* \* 1'/)
  assert.match(y, /^name: Culture — brouillon quotidien$/m)
})

test('articles.yml : idées seulement sans issue ouverte (--ideas-open)', async () => {
  const y = await read('articles.yml')
  assert.match(y, /gh issue list --state open --author app\/github-actions --search 'in:title "Culture : idées de sujets"'/)
  assert.match(y, /--ideas-open/)
  assert.match(y, /if: steps\.draft\.outputs\.ideas == '1'/)
  assert.doesNotMatch(y, /outputs\.issue/)
  const src = await readFile(new URL('../scripts/culture-draft.mjs', import.meta.url), 'utf-8')
  assert.match(src, /'ideas-open': \{ type: 'boolean'/)
  assert.match(src, /'out-ideas': \{ type: 'string', default: path\.join\(tmpdir\(\), 'culture-ideas\.md'\) \}/)
})
