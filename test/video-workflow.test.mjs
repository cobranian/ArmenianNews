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

test('articles-publish.yml : Shorts manquants traduits seuls, avant le contrôle final', async () => {
  const y = await read('articles-publish.yml')
  const prep = y.slice(y.indexOf('- name: Contrôler, traduire si besoin'), y.indexOf('- name: Contrôle final'))
  assert.match(prep, /culture-translate\.mjs "\$SLUG" --short-only --langs "\$TODO" --summary/)
  assert.match(prep, /modèle de secours/, 'un Short traduit par le secours retient aussi la fusion')
})
