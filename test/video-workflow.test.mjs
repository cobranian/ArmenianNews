// video.yml ne s'exécute pas en test : on garde ici ce dont l'oubli ne se
// verrait qu'au premier article publié — un rendu sans navigateur, une file
// jamais remplie, deux runs concurrents qui se marchent dessus, ou une
// publication d'article qui ne déclenche plus la vidéo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// CRLF normalisé : sous Windows, git extrait les workflows en CRLF.
const read = async (f) =>
  (await readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

test('video.yml : workflow_dispatch avec un slug obligatoire', async () => {
  const y = await read('video.yml')
  assert.match(y, /^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}slug:\n(?: {8}.*\n)*? {8}required: true$/m)
  assert.doesNotMatch(y, /^ {2}(push|schedule|pull_request):/m, 'aucun autre déclencheur')
})

test('video.yml : un seul run à la fois, sans annuler celui en cours', async () => {
  const y = await read('video.yml')
  assert.match(y, /^concurrency:\n {2}group: video-main\n {2}cancel-in-progress: false$/m)
  assert.match(y, /^permissions:\n {2}contents: write\n {2}actions: write$/m)
})

test('video.yml : navigateur, rendu, dépôt, dans cet ordre', async () => {
  const y = await read('video.yml')
  const steps = ['npm --prefix video ci', 'npx remotion browser ensure', 'node video/scripts/sync.mjs', 'render-all.mjs --slug', 'video-publish.mjs "$SLUG" --dir']
  for (const s of steps) assert.ok(y.includes(s), s)
  const pos = steps.map((s) => y.indexOf(s))
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'ordre des étapes')
  assert.match(y, /cache-dependency-path: \|\n\s+package-lock\.json\n\s+video\/package-lock\.json/)
})

test('video.yml : actions épinglées par SHA complet', async () => {
  const y = await read('video.yml')
  const uses = [...y.matchAll(/uses: (\S+)/g)].map((m) => m[1])
  assert.ok(uses.length >= 2)
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u)
})

test('video.yml : le slug n’atteint un run: que par env', async () => {
  const y = await read('video.yml')
  const runs = [...y.matchAll(/run: \|\n((?:\s{10,}.*\n?)+)/g)].map((m) => m[1]).join('\n')
  assert.doesNotMatch(runs, /\$\{\{\s*(inputs|github\.event\.inputs)\./)
  assert.match(y, /SLUG: \$\{\{ inputs\.slug \}\}/)
})

test('video.yml : commit sur main avec rebase (3 essais), puis déploiement ; échec signalé', async () => {
  const y = await read('video.yml')
  assert.match(y, /git add src\/data\/reels\.json src\/data\/youtube-queue\.json/)
  assert.match(y, /data: vidéos de « \$SLUG »/)
  assert.match(y, /for i in 1 2 3; do/)
  assert.ok(y.indexOf('git pull --rebase origin main') < y.indexOf('git push origin HEAD:main'))
  assert.match(y, /gh workflow run hourly\.yml --ref main/)
  const last = y.slice(y.lastIndexOf('      - name:'))
  assert.match(last, /if: failure\(\)/)
  assert.match(last, /gh workflow run social-check\.yml --ref main \|\| true/)
})

test('video.yml : rien à rendre = sortie propre, sans rendu ni commit', async () => {
  const y = await read('video.yml')
  assert.match(y, /--plan/)
  assert.match(y, /::notice::/)
  assert.match(y, /steps\.plan\.outputs\.langs != ''/)
})

for (const f of ['articles-publish.yml', 'articles-merged.yml']) {
  test(`${f} : la fusion lance video.yml sans pouvoir faire échouer la publication`, async () => {
    const y = await read(f)
    assert.match(y, /gh workflow run video\.yml --ref main -f slug="\$SLUG" \|\| true/)
    assert.match(y, /^permissions:\n(?: {2}.*\n)*? {2}actions: write$/m)
  })
}

test('articles-publish.yml : la vidéo part APRÈS la fusion', async () => {
  const y = await read('articles-publish.yml')
  assert.ok(y.indexOf('gh pr merge') < y.indexOf('gh workflow run video.yml'))
})

test('articles-publish.yml : seuls les passages du plan sont traduits, avant le contrôle final', async () => {
  const y = await read('articles-publish.yml')
  const prep = y.slice(y.indexOf('- name: Contrôler, traduire si besoin'), y.indexOf('- name: Contrôle final'))
  assert.match(prep, /culture-translate-plan\.mjs "\$SLUG" \$PASSED/)
  assert.match(prep, /culture-translate\.mjs "\$SLUG" \$args --summary/)
  // Jamais de traduction de tous les articles : chaque passage vient du plan.
  assert.doesNotMatch(prep, /culture-translate\.mjs "\$SLUG" --summary/)
  assert.match(prep, /cat "\$RUNNER_TEMP"\/summary-\*\.md > "\$RUNNER_TEMP\/summary\.md"/)
  assert.match(prep, /modèle de secours/, 'un Short traduit par le secours retient aussi la fusion')
})

test('video.yml : une langue qui échoue au rendu rougit le run, après le dépôt', async () => {
  const y = await read('video.yml')
  const render = y.slice(y.indexOf('- name: Rendre'), y.indexOf('- name: Déposer'))
  assert.match(render, /id: render/)
  assert.match(render, /failed=.*>> "\$GITHUB_OUTPUT"/, 'les échecs sont consignés')
  assert.doesNotMatch(render, /\bexit 1\b/, 'le rendu lui-même ne fait pas tomber le job')
  const sig = y.slice(y.indexOf('- name: Signaler les langues en échec'), y.indexOf('- name: Prévenir'))
  assert.match(sig, /if: always\(\) && steps\.render\.outputs\.failed != ''/)
  assert.match(sig, /::error::/)
  assert.match(sig, /exit 1/)
  assert.ok(y.indexOf('video-publish.mjs "$SLUG" --dir') < y.indexOf('- name: Signaler'), 'dépôt avant signalement')
  assert.ok(y.indexOf('- name: Signaler') < y.indexOf('- name: Prévenir'), 'signalement avant alerte')
})

// Fusion humaine malgré un statut rouge à cause d'un Short : autrefois les six
// articles relus étaient retraduits et poussés sur main sans relecture.
test('articles-merged.yml : seuls les passages du plan sont traduits, rattrapage des Shorts compris', async () => {
  const y = await read('articles-merged.yml')
  const step = y.slice(y.indexOf('- name: Traduire ce qui manque'))
  assert.match(step, /culture-check\.mjs "\$SLUG"; then PASSED=--check-passed; else PASSED=; fi/)
  assert.match(step, /culture-translate-plan\.mjs "\$SLUG" \$PASSED > "\$RUNNER_TEMP\/plan\.txt"/)
  assert.match(step, /culture-translate\.mjs "\$SLUG" \$args --summary/)
  assert.doesNotMatch(step, /culture-translate\.mjs "\$SLUG" --summary/, 'jamais de traduction de tous les articles')
  // « Rien à faire » = plan vide : un Short à rattraper (--short-only) est
  // donc traduit AVANT que video.yml ne parte.
  const nothing = step.slice(step.indexOf('if [ ! -s "$RUNNER_TEMP/plan.txt" ]'), step.indexOf('while read -r args'))
  assert.match(nothing, /rien à faire/)
  assert.ok(step.indexOf('culture-translate-plan.mjs') < step.indexOf('if [ ! -s "$RUNNER_TEMP/plan.txt" ]'))
})

// Le push refusé par un conflit (le settle horaire retire un voisin de la
// file) : trois rebases identiques échoueraient pareil. On repart de main et
// on rejoue l'inscription seule, sans renvoyer les MP4.
test('video.yml : push refusé → reset sur origin/main, inscription rejouée sans envoi', async () => {
  const y = await read('video.yml')
  const loop = y.slice(y.indexOf('for i in 1 2 3; do'), y.indexOf('done', y.indexOf('for i in 1 2 3; do')))
  const steps = ['git rebase --abort', 'git fetch origin main', 'git reset --hard origin/main', 'video-publish.mjs "$SLUG" --dir video/out --register-only', 'git add src/data/reels.json src/data/youtube-queue.json', 'git commit -m "data: vidéos de « $SLUG »"']
  const pos = steps.map((s) => loop.indexOf(s))
  for (const [i, p] of pos.entries()) assert.ok(p > loop.indexOf('git push origin HEAD:main'), steps[i])
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'ordre de la reprise')
})

test('video-publish.mjs : --register-only n’appelle jamais gh release upload', async () => {
  const src = (await readFile(new URL('../scripts/video-publish.mjs', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
  assert.match(src, /'register-only': \{ type: 'boolean', default: false \}/)
  assert.match(src, /for \(const f of values\['register-only'\] \? \[\] : found\)/)
  assert.ok(src.indexOf("values['register-only'] ? [] : found") < src.indexOf("'release', 'upload'"))
})
