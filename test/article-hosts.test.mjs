// Invariant gardé : chaque article du dernier instantané vient d'un hôte admis
// par SOURCE_HOSTS (scripts/lib/article-text.mjs). LE PIÈGE SILENCIEUX : une
// source nouvelle dont le domaine n'y est pas resterait sans résumé, et le seul
// signe serait « ✗ résumé-article: … URL refusée » au log.
// En CI le test est sauté, comme celui de RUBRIC_MAP : `npm test` précède le
// scrape dans le job horaire, et un domaine déjà commis par le scrape précédent
// le ferait échouer en tête de CHAQUE run, gelant scrapes et déploiements.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { listArticles } from '../scripts/lib/article-resumes.mjs'
import { isAllowedArticleUrl } from '../scripts/lib/article-text.mjs'

const news = JSON.parse(await readFile(new URL('../src/data/news.json', import.meta.url), 'utf-8'))

test('chaque hôte d article du snapshot est admis par SOURCE_HOSTS', {
  skip: process.env.GITHUB_ACTIONS
    ? 'sauté en CI : il gèlerait le job horaire (test avant scrape) ; voir « ✗ résumé-article: … URL refusée » au log'
    : false,
}, () => {
  const refused = [...new Set(listArticles(news).filter((a) => !isAllowedArticleUrl(a.url)).map((a) => {
    try {
      return new URL(a.url).hostname
    } catch {
      return a.url
    }
  }))]
  assert.deepEqual(refused, [], 'ajouter ces domaines à SOURCE_HOSTS (scripts/lib/article-text.mjs)')
})
