#!/usr/bin/env node
/**
 * Contrôle STRICT des articles Culture (spec §3.5) — celui des PR.
 *
 *   npm run culture:check -- [--pr-body corps.md] [slug…]
 *
 * Sans slug : tous les articles. --pr-body exige la case « Faits vérifiés ».
 * La DERNIÈRE ligne de sortie est un résumé de 140 caractères au plus : les
 * workflows la publient telle quelle comme description du statut de commit.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { readArticle, articleSlugs } from './lib/culture-load.mjs'
import { validateArticle, factsChecked } from './lib/culture-validate.mjs'
import { validateTopics } from './lib/culture-topic.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string', default: path.join(root, 'src/data/culture') },
    'pr-body': { type: 'string' },
  },
})

const errors = []
try {
  errors.push(...validateTopics(JSON.parse(await readFile(path.join(values.dir, 'sujets.json'), 'utf-8'))))
} catch (e) {
  errors.push(`sujets.json illisible : ${e.message}`)
}
const slugs = positionals.length ? positionals : await articleSlugs(values.dir)
for (const slug of slugs) {
  const { errors: errs } = validateArticle(await readArticle(values.dir, slug))
  errors.push(...errs.map((e) => `${slug} — ${e}`))
}
if (values['pr-body']) {
  const body = await readFile(values['pr-body'], 'utf-8').catch(() => '')
  if (!factsChecked(body)) errors.push('case « Faits vérifiés » non cochée dans la PR')
}

for (const e of errors) console.log(`✗ ${e}`)
const summary = errors.length
  ? `✗ ${errors.length} problème(s) : ${errors[0]}`
  : `✓ culture : ${slugs.length} article(s) conforme(s)`
console.log(summary.length > 140 ? `${summary.slice(0, 139)}…` : summary)
process.exit(errors.length ? 1 : 0)
