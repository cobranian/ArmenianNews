// Un plan vide de video.yml n'est pas toujours « rien à faire ». Le piège
// gardé (revue finale du 25 nov. 2026) : un article rédigé par l'ancien code,
// sans `spoken`, fusionné après SPOKEN_SINCE — validateArticle refuse son
// Short, --plan rendait '' et video.yml finissait sur un ::notice:: vert,
// l'article publié sans vidéo. Désormais --plan sort en 1 et l'étape échoue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readArticle, readVideos } from '../scripts/lib/culture-load.mjs'
import { validateArticle } from '../scripts/lib/culture-validate.mjs'
import { planBlockers, videoLangs } from '../scripts/lib/culture-video-plan.mjs'
import { SPOKEN_SINCE } from '../scripts/lib/culture-short.mjs'

const DIR = fileURLToPath(new URL('../src/data/culture/', import.meta.url))
const SLUG = 'khorovats-et-la-tradition-du-barbecue-armenien'
const load = async () => {
  const videos = await readVideos(DIR)
  delete videos[SLUG]
  return { article: await readArticle(DIR, SLUG), videos }
}

test('planBlockers : plan vide + Short refusé → les erreurs ; plan non vide ou vide légitime → []', () => {
  const errors = ['short.fr.json : fait 1 : spoken manquant', 'en.md absent — posez l\'étiquette « traduire »']
  assert.deepEqual(planBlockers({ errors }, []), ['short.fr.json : fait 1 : spoken manquant'])
  assert.deepEqual(planBlockers({ errors }, ['en']), [])
  // Absent, déjà sur YouTube, en file : des notes, jamais des erreurs.
  assert.deepEqual(planBlockers({ errors: [], notes: ['short.fr.json absent : pas de vidéo'] }, []), [])
  assert.deepEqual(planBlockers({}, []), [])
})

test('article de l’ancien code daté de SPOKEN_SINCE (Short sans spoken) : plan vide ET bloqué', async () => {
  const { article, videos } = await load()
  const fr = article.texts.fr.replace(/^date:.*$/m, `date: "${SPOKEN_SINCE}"`)
  assert.notEqual(fr, article.texts.fr)
  const result = validateArticle({ ...article, texts: { ...article.texts, fr }, videos })
  const langs = videoLangs(result, { slug: SLUG, videos, queue: null })
  assert.deepEqual(langs, [])
  assert.ok(planBlockers(result, langs).some((e) => /^short\.fr\.json : fait 1 : spoken manquant/.test(e)))
})

test('le même article à sa date d’origine : rendu normal, rien de bloqué', async () => {
  const { article, videos } = await load()
  const result = validateArticle({ ...article, videos })
  const langs = videoLangs(result, { slug: SLUG, videos, queue: null })
  assert.ok(langs.includes('fr'))
  assert.deepEqual(planBlockers(result, langs), [])
})

test('video.yml : un --plan en échec fait échouer l’étape, ses erreurs en ::error::', async () => {
  const yml = (await readFile(new URL('../.github/workflows/video.yml', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
  const step = yml.slice(yml.indexOf('- name: Langues à rendre'), yml.indexOf('- name: ffmpeg'))
  assert.match(step, /if ! LANGS="\$\(node scripts\/video-publish\.mjs "\$SLUG" --plan 2>"\$ERR"\)"; then/)
  assert.match(step, /echo "::error::\$SLUG : \$line"; done < "\$ERR"\n\s*exit 1\n\s*fi/)
  // Le plan vide légitime reste une notice.
  assert.match(step, /::notice::\$SLUG : aucun Short à rendre/)
  assert.ok(step.indexOf('exit 1') < step.indexOf('echo "langs=$LANGS"'))
})

test('video-publish.mjs --plan : code de sortie selon planBlockers', async () => {
  const src = await readFile(new URL('../scripts/video-publish.mjs', import.meta.url), 'utf-8')
  assert.match(src, /const blockers = planBlockers\(result, langs\)/)
  assert.match(src, /process\.exit\(blockers\.length \? 1 : 0\)/)
})
