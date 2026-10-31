// Le rattrapage hebdomadaire des traductions de/it (spec 2026-10-23, « Culture
// de/it ») : ce qu'il choisit de traduire, et les règles de son workflow, dont
// l'oubli ne se verrait qu'en production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pendingTranslations, missingSourceLangs, sourceEntry, articleQid } from '../scripts/culture-backfill.mjs'
import { serializeFrontMatter, bodyHash } from '../scripts/lib/culture-markdown.mjs'
import { meta, texts, FR_BODY } from './helpers/culture-fixture.mjs'

const tr = (l, hash = bodyHash(FR_BODY)) =>
  serializeFrontMatter({ title: `K ${l}`, description: `D ${l}`, date: '2026-10-19', sourceHash: hash, model: 'm' }, `Text ${l}.`)
const article = (slug, extra = {}) => ({
  slug, meta: meta(slug), texts: { ...texts(), ...extra }, images: { webp: true, jpg: true },
})

test('pendingTranslations : à jour → seulement es ; it absente → it ; de périmée → de', () => {
  const r = pendingTranslations([
    article('a-jour', { de: tr('de'), it: tr('it') }),
    article('sans-it', { de: tr('de') }),
    article('de-perimee', { de: tr('de', 'deadbeef'), it: tr('it') }),
  ])
  assert.deepEqual(r, [
    { slug: 'a-jour', langs: ['es'] },
    { slug: 'sans-it', langs: ['it', 'es'] },
    { slug: 'de-perimee', langs: ['de', 'es'] },
  ])
})

test('pendingTranslations : un article antérieur à de/it demande les deux', () => {
  assert.deepEqual(pendingTranslations([article('komitas')]), [{ slug: 'komitas', langs: ['de', 'it', 'es'] }])
})

// Une de.md illisible n'est pas plus publiée qu'une absente : elle est retentée.
test('pendingTranslations : une de/it invalide est retentée', () => {
  assert.deepEqual(pendingTranslations([article('k', { de: 'cassé', it: tr('it') })]), [{ slug: 'k', langs: ['de', 'es'] }])
})

// Sans français publiable, il n'y a rien à traduire : le rattrapage ne touche
// pas un article que le build écarte déjà.
test('pendingTranslations : un article sans français valide est ignoré', () => {
  assert.deepEqual(pendingTranslations([article('k', { fr: null })]), [])
  assert.deepEqual(pendingTranslations([{ ...article('k'), meta: null }]), [])
})

test('missingSourceLangs : seules les langues sans Wikipédia citée', () => {
  const m = meta('k')
  assert.deepEqual(missingSourceLangs(m, ['de', 'it']), ['de', 'it'])
  const withDe = { ...m, sources: [...m.sources, { kind: 'wikipedia', lang: 'de', title: 'Komitas', url: 'https://de.wikipedia.org/wiki/Komitas' }] }
  assert.deepEqual(missingSourceLangs(withDe, ['de', 'it']), ['it'])
  // Une source de/it non Wikipédia (UNESCO…) ne tient pas lieu de dewiki.
  const unesco = { ...m, sources: [...m.sources, { kind: 'unesco', lang: 'it', title: 'x', url: 'https://ich.unesco.org/x' }] }
  assert.deepEqual(missingSourceLangs(unesco, ['it']), ['it'])
})

// Les premiers articles n'ont pas de qid dans meta.json : sujets.json le porte.
test('articleQid : meta.json d’abord, sujets.json à défaut', () => {
  assert.equal(articleQid({ qid: 'Q1' }, { qid: 'Q2' }), 'Q1')
  assert.equal(articleQid({}, { qid: 'Q2' }), 'Q2')
  assert.equal(articleQid({}, undefined), null)
})

test('sourceEntry : les champs que culture-draft écrit, sans extrait', () => {
  const page = {
    kind: 'wikipedia', lang: 'de', title: 'Komitas', url: 'https://de.wikipedia.org/wiki/Komitas',
    revision: 7, extract: 'long texte', license: 'CC BY-SA 4.0', wikidata: 'Q1', pageImage: 'K.jpg',
  }
  assert.deepEqual(sourceEntry(page), {
    kind: 'wikipedia', lang: 'de', title: 'Komitas', url: 'https://de.wikipedia.org/wiki/Komitas', revision: 7, license: 'CC BY-SA 4.0',
  })
})

const read = async () =>
  (await readFile(new URL('../.github/workflows/articles-backfill.yml', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

test('articles-backfill.yml : hebdomadaire ou à la main, jamais sur un commentaire', async () => {
  const y = await read()
  assert.match(y, /^on:\n {2}schedule:\n {4}- cron: '[^']+'.*\n {2}workflow_dispatch: \{\}\n\n/m)
  assert.doesNotMatch(y, /issue_comment|pull_request/)
  assert.match(y, /^concurrency:\n {2}group: culture-backfill\n {2}cancel-in-progress: false$/m)
})

test('articles-backfill.yml : une PR assignée au propriétaire, jamais de fusion ni de push sur main', async () => {
  const y = await read()
  assert.match(y, /git switch -c "\$BRANCH"/)
  assert.match(y, /BRANCH="culture\/backfill-\$\(date -u \+%F\)"/)
  assert.match(y, /gh pr create --base main --head "\$BRANCH" .*--assignee "\$GITHUB_REPOSITORY_OWNER"/)
  assert.doesNotMatch(y, /gh pr merge|HEAD:main|push origin main/)
  // La case qui déclenche articles-publish.yml ne doit jamais y figurer.
  assert.doesNotMatch(y, /Faits vérifiés/)
  const src = await readFile(new URL('../scripts/culture-backfill.mjs', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /Faits vérifiés/)
})

test('articles-backfill.yml : statut culture-check publié par le robot, rien à faire = rien d’ouvert', async () => {
  const y = await read()
  assert.match(y, /statuses\/.*context=culture-check/s)
  assert.match(y, /node scripts\/culture-backfill\.mjs --dry/)
  assert.match(y, /if: steps\.list\.outputs\.pending != '0'/)
  // Un rattrapage déjà en relecture : on n'en ouvre pas un second.
  assert.match(y, /startswith\("culture\/backfill-"\)/)
  // Toutes les traductions en échec : aucun fichier changé, aucune PR.
  assert.match(y, /git diff --cached --quiet && \{ echo .*; exit 0; \}/)
})

// La branche culture/backfill-* entre dans les filtres « culture/ » des autres
// workflows : sans ces deux gardes, la fermer marquerait « rejeté » un sujet
// inexistant (job en échec), et la retoucher publierait un culture-check en
// échec sur un « article » backfill-AAAA-MM-JJ qui n'existe pas.
test('articles-closed / articles-check : une branche de rattrapage n’est pas un article', async () => {
  const wf = async (f) => (await readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
  assert.match(await wf('articles-closed.yml'), /!startsWith\(github\.head_ref, 'culture\/backfill-'\)/)
  const check = await wf('articles-check.yml')
  assert.match(check, /backfill-\*\) set -- ;;/)
  assert.match(check, /node scripts\/culture-check\.mjs "\$@"/)
})

// Une PR de fork nommée culture/backfill-* suffirait sinon à bloquer le
// rattrapage hebdomadaire indéfiniment.
test('articles-backfill.yml : seules les PR du dépôt comptent comme rattrapage ouvert', async () => {
  const y = await read()
  assert.match(y, /gh pr list [^\n]*--json headRefName,isCrossRepository /)
  assert.match(y, /select\(\.isCrossRepository == false and \(\.headRefName \| startswith\("culture\/backfill-"\)\)\)/)
})

// /corrige et l'étiquette « traduire » traiteraient sinon backfill-AAAA-MM-JJ
// comme le slug d'un article inexistant.
test('articles-revise / articles-translate : une branche de rattrapage n’est pas un article', async () => {
  const wf = async (f) => (await readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
  assert.match(await wf('articles-translate.yml'), /!startsWith\(github\.head_ref, 'culture\/backfill-'\)/)
  assert.match(await wf('articles-revise.yml'), /culture\/backfill-\*\) echo "[^"]*"; exit 0 ;;\n\s*culture\/\*\) ;;/)
})

// Reposer « traduire » retraduirait TOUTES les langues : pour un échec de/it
// seul, le bon conseil est le rattrapage hebdomadaire.
test('culture-translate : un échec de/it seul renvoie au rattrapage, pas à l’étiquette', async () => {
  const src = (await readFile(new URL('../scripts/culture-translate.mjs', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
  const optional = src.match(/else if \(optionalFailed\)\n([\s\S]*?)\nif \(values\.summary\)/)?.[1]
  assert.ok(optional, 'branche optionalFailed introuvable')
  assert.match(optional, /articles-backfill\.yml/)
  assert.match(optional, /gh workflow run articles-backfill\.yml/)
  assert.doesNotMatch(optional, /Reposez/)
  assert.match(src, /if \(failed\) lines\.push\('', 'Reposez l’étiquette \*\*traduire\*\* pour réessayer\.'\)/)
})
