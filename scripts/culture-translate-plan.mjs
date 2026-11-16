#!/usr/bin/env node
/**
 * Les passages de culture-translate qu'il faut à un article (articles-publish.yml).
 *
 *   node scripts/culture-translate-plan.mjs <slug> [--check-passed]
 *
 * Une ligne d'arguments par passage (« --langs en,hy », « --short-only --langs de »),
 * rien si rien n'est à traduire. La règle est dans translationRuns
 * (lib/culture-video-plan.mjs) : un article à jour n'est jamais retraduit.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { CULTURE_SLUG } from '../sites.config.js'
import { readArticle, readVideos } from './lib/culture-load.mjs'
import { validateArticle } from './lib/culture-validate.mjs'
import { translationRuns } from './lib/culture-video-plan.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'check-passed': { type: 'boolean', default: false } } })
const [slug] = positionals
if (!slug || !CULTURE_SLUG.test(slug)) throw new Error('usage : culture-translate-plan <slug> [--check-passed]')
const videos = await readVideos(DIR)
const article = await readArticle(DIR, slug)
const result = validateArticle({ ...article, videos })
for (const args of translationRuns(result, { slug, videos, meta: article.meta, checkPassed: values['check-passed'] })) console.log(args.join(' '))
