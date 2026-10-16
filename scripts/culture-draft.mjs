#!/usr/bin/env node
/**
 * Rédige le brouillon de la semaine (spec §1.1).
 *
 *   npm run culture:draft -- [--topic komitas] [--dry]
 *
 * En CI (articles.yml) : --open-branches (JSON des branches de PR ouvertes)
 * et --out-body (corps de la PR ou de l'issue). Écrit dans $GITHUB_OUTPUT :
 * `slug` et `title` (brouillon écrit), ou `issue=1` (liste vide, idées).
 * Toute panne du modèle lève : pas de PR, relance manuelle.
 */
import { readFile, writeFile, mkdir, appendFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { pickTopic } from './lib/culture-topic.mjs'
import { articleSlugs } from './lib/culture-load.mjs'
import { llmConfig, chat } from './lib/culture-llm.mjs'
import {
  buildDraftMessages, buildClaimsMessages, buildIdeasMessages, parseArticleJson, parseClaims, parseIdeas, findUnsupported,
} from './lib/culture-prompts.mjs'
import { fetchWikipedia, fetchWikidataFacts, fetchCommonsCandidates, downloadImage } from './lib/culture-sources.mjs'
import { makeImages } from './lib/culture-image.mjs'
import { overlapRatio } from './lib/culture-overlap.mjs'
import { serializeFrontMatter } from './lib/culture-markdown.mjs'
import { buildPrBody, ideasIssueBody } from './lib/culture-pr.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values } = parseArgs({
  options: {
    topic: { type: 'string' },
    'open-branches': { type: 'string' },
    'out-body': { type: 'string', default: path.join(tmpdir(), 'culture-body.md') },
    dry: { type: 'boolean', default: false },
  },
})

const output = async (k, v) => {
  console.log(`${k}=${v}`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/[\r\n]+/g, ' ')}\n`)
}

const sujets = JSON.parse(await readFile(path.join(DIR, 'sujets.json'), 'utf-8'))
const openBranches = values['open-branches'] ? JSON.parse(await readFile(values['open-branches'], 'utf-8')) : []
const agenda = JSON.parse(await readFile(path.join(root, 'src/data/agenda.json'), 'utf-8'))
const existing = await articleSlugs(DIR)
const cfg = llmConfig()

let pick
if (values.topic) {
  const topic = sujets.topics.find((t) => t.slug === values.topic)
  if (!topic) throw new Error(`sujet inconnu : ${values.topic}`)
  pick = { topic, event: null }
} else {
  pick = pickTopic({ topics: sujets.topics, openBranches, existing, agenda, now: Date.now() })
}

if (!pick) {
  console.log('Liste de sujets épuisée : génération d’idées.')
  const { text } = await chat({ ...cfg, messages: buildIdeasMessages(sujets.topics.map((t) => t.title)) })
  const issueBody = ideasIssueBody(parseIdeas(text))
  if (values.dry) {
    console.log(issueBody)
    process.exit(0)
  }
  await writeFile(values['out-body'], issueBody)
  await output('issue', '1')
  process.exit(0)
}

const { topic, event } = pick
if (existing.includes(topic.slug)) throw new Error(`src/data/culture/${topic.slug}/ existe déjà — rien à rédiger`)
console.log(`Sujet : ${topic.slug}${event ? ` (événement : ${event.title}, ${event.date})` : ''}`)

const warnings = []
const fr = topic.wikipedia.fr ? await fetchWikipedia('fr', topic.wikipedia.fr) : null
const en = topic.wikipedia.en ? await fetchWikipedia('en', topic.wikipedia.en) : null
if (!fr) warnings.push('Pas d’article Wikipédia en français : brouillon rédigé depuis l’anglais seul.')
const sources = [fr, en].filter(Boolean)
if (!sources.length) throw new Error(`aucune source Wikipédia pour ${topic.slug} — vérifiez les titres de sujets.json`)

const qid = fr?.wikidata ?? en?.wikidata
const facts = qid
  ? await fetchWikidataFacts(qid).catch((e) => (warnings.push(`Wikidata indisponible (${e.message}).`), []))
  : []
const candidates = await fetchCommonsCandidates({
  files: [fr?.pageImage, en?.pageImage],
  search: topic.title,
}).catch((e) => (warnings.push(`Commons indisponible (${e.message}).`), []))

const draftRes = await chat({ ...cfg, messages: buildDraftMessages({ topic, sources, facts, event }) })
const draft = parseArticleJson(draftRes.text)
if (!draft) throw new Error(`brouillon illisible (JSON attendu) — modèle ${draftRes.model}`)
const claimsRes = await chat({ ...cfg, temperature: 0, messages: buildClaimsMessages(draft.body) })
const claims = parseClaims(claimsRes.text)
const unsupported = claims === null ? null : findUnsupported(claims, [...sources.map((s) => s.extract), ...facts])
const overlap = overlapRatio(draft.body, sources.map((s) => s.extract))

const meta = {
  slug: topic.slug,
  sources: sources.map(({ lang, title, url, revision }) => ({ lang, title, url, revision })),
  candidates,
  imageChoice: null,
  image: null,
  agendaEvent: event ? { title: event.title, url: event.url, date: event.date, location: event.location ?? null } : null,
  overlap: Number(overlap.toFixed(3)),
  model: draftRes.model,
}

let images = null
if (candidates.length) {
  try {
    images = await makeImages(await downloadImage(candidates[0].thumbUrl))
    meta.imageChoice = 0
    meta.image = { ...candidates[0], width: images.width, height: images.height }
  } catch (e) {
    warnings.push(`Image non téléchargée (${e.message}) : la page affichera un motif.`)
  }
} else {
  warnings.push('Aucune image sous licence libre : la page affichera un motif.')
}

const date = new Date().toISOString().slice(0, 10)
const frText = serializeFrontMatter({ title: draft.title, description: draft.description, date }, draft.body)
const body = buildPrBody({ title: draft.title, meta, unsupported, overlap, warnings })

if (values.dry) {
  console.log(`\n${frText}\n----\n${body}`)
  process.exit(0)
}

const base = path.join(DIR, topic.slug)
await access(base).then(
  () => { throw new Error(`${base} existe déjà`) },
  () => {},
)
await mkdir(base, { recursive: true })
await writeFile(path.join(base, 'fr.md'), frText)
await writeFile(path.join(base, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
if (images) {
  await writeFile(path.join(base, 'image.webp'), images.webp)
  await writeFile(path.join(base, 'image.jpg'), images.jpg)
}
await writeFile(values['out-body'], body)
await output('slug', topic.slug)
await output('title', draft.title)
