#!/usr/bin/env node
/**
 * Rédige le brouillon du jour (spec §1.1).
 *
 *   npm run culture:draft -- [--topic komitas] [--dry]
 *
 * En CI (articles.yml, chaque nuit) : --open-branches (JSON des branches de PR
 * ouvertes), --out-body (corps de la PR), --out-ideas (corps de l'issue
 * d'idées) et --ideas-open (une issue d'idées attend déjà : n'en rien générer).
 * Écrit dans $GITHUB_OUTPUT : `skipped=queue` (file de relecture pleine),
 * `slug` et `title` (brouillon écrit), `ideas=1` (idées à proposer).
 * Toute panne du modèle pendant la rédaction lève : pas de PR, relance manuelle.
 * Un sujet sans page Wikipédia fr ni en utilisable (absente, homonymie, autre
 * entité Wikidata) est sauté (« ✗ sujet … sauté ») et le suivant est essayé,
 * MAX_TRIES au plus ; si aucun n'aboutit, sortie 1.
 */
import { readFile, writeFile, mkdir, appendFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { rankTopics, availableTopics, queueFull, needsIdeas } from './lib/culture-topic.mjs'
import { articleSlugs } from './lib/culture-load.mjs'
import { chatDraft } from './lib/culture-llm.mjs'
import {
  buildDraftMessages, buildClaimsMessages, buildIdeasMessages, parseArticleJson, parseClaims, parseIdeas, findUnsupported, eventFacts,
} from './lib/culture-prompts.mjs'
import {
  fetchEntity, resolveTitles, fetchWikipedia, fetchTopicWikipedia, hseTitle, fetchHse, fetchCommonsCandidates, downloadImage,
} from './lib/culture-sources.mjs'
import { loadUnesco, unescoSource } from './lib/culture-unesco.mjs'
import { mechanicalClaims, entityTexts, splitClaims, editorialAlerts } from './lib/culture-checks.mjs'
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
    'out-ideas': { type: 'string', default: path.join(tmpdir(), 'culture-ideas.md') },
    'ideas-open': { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
  },
})

const output = async (k, v) => {
  console.log(`${k}=${v}`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/[\r\n]+/g, ' ')}\n`)
}

const LANGS = ['fr', 'en', 'hy', 'ru']
// Sujets essayés par nuit : au-delà, c'est sujets.json qu'il faut revoir.
const MAX_TRIES = 3

const sujets = JSON.parse(await readFile(path.join(DIR, 'sujets.json'), 'utf-8'))
const openBranches = values['open-branches'] ? JSON.parse(await readFile(values['open-branches'], 'utf-8')) : []

// File pleine : rien à rédiger cette nuit, et rien à proposer non plus.
if (queueFull(openBranches)) {
  console.log('File de relecture pleine : pas de brouillon cette nuit.')
  await output('skipped', 'queue')
  process.exit(0)
}

const agenda = JSON.parse(await readFile(path.join(root, 'src/data/agenda.json'), 'utf-8'))
const existing = await articleSlugs(DIR)

let tries
if (values.topic) {
  const topic = sujets.topics.find((t) => t.slug === values.topic)
  if (!topic) throw new Error(`sujet inconnu : ${values.topic}`)
  tries = [{ topic, event: null }]
} else {
  tries = rankTopics({ topics: sujets.topics, openBranches, existing, agenda, now: Date.now() }).slice(0, MAX_TRIES)
}

let pick = null
for (const t of tries) {
  const skipped = await draftArticle(t)
  if (!skipped) {
    pick = t
    break
  }
  console.warn(`✗ sujet ${t.topic.slug} sauté : ${skipped}`)
}
if (!tries.length) console.log('Aucun sujet disponible : pas de brouillon cette nuit.')
else if (!pick) {
  console.error(`✗ aucun des ${tries.length} sujet(s) essayé(s) n’a de page Wikipédia fr ni en utilisable — vérifiez leur qid dans sujets.json.`)
  process.exit(1)
}

// Le sujet qui vient d'être rédigé n'est plus disponible : sa PR va s'ouvrir.
const remaining = availableTopics(sujets.topics, {
  openBranches: pick ? [...openBranches, `culture/${pick.topic.slug}`] : openBranches,
  existing,
}).length
if (needsIdeas(remaining) && !values['ideas-open']) {
  try {
    await proposeIdeas(remaining)
  } catch (e) {
    // Un brouillon écrit ne doit pas être perdu pour une panne d'idées : sa PR
    // s'ouvre quand même, et les idées seront retentées la nuit suivante.
    if (!pick) throw e
    console.warn(`✗ ideas : ${e.message}`)
  }
}

// Rend `null` une fois le brouillon écrit, ou la raison pour laquelle le sujet
// est sauté (aucune page fr ni en utilisable) — rien n'est alors écrit.
async function draftArticle({ topic, event }) {
  if (existing.includes(topic.slug)) throw new Error(`src/data/culture/${topic.slug}/ existe déjà — rien à rédiger`)
  console.log(`Sujet : ${topic.slug} (${topic.qid})${event ? ` (événement : ${event.title}, ${event.date})` : ''}`)

  const entity = await fetchEntity(topic.qid)
  const titles = resolveTitles(topic, entity)
  const { wiki, warnings } = await fetchTopicWikipedia(titles, topic.qid, { langs: LANGS })
  if (!wiki.fr && !wiki.en) {
    const why = warnings.filter((w) => !/^Pas d’article Wikipédia en (hy|ru)\./.test(w))
    return `aucune page Wikipédia fr ni en utilisable pour ${topic.qid}${why.length ? ` (${why.join(' ; ')})` : ''}`
  }
  if (!wiki.fr) warnings.push('Pas d’article Wikipédia en français : brouillon rédigé depuis les autres langues.')

  const hTitle = hseTitle(entity)
  const hse = hTitle ? await fetchHse(hTitle).catch((e) => (warnings.push(`ՀՍՀ (Wikisource) indisponible (${e.message}).`), null)) : null
  const unescoEntry = loadUnesco()[topic.slug]
  const unesco = unescoEntry ? unescoSource(unescoEntry) : null

  const sources = [...LANGS.map((l) => wiki[l]), hse, unesco].filter(Boolean)
  const facts = entity.facts
  const candidates = await fetchCommonsCandidates({
    files: [entity.image, wiki.fr?.pageImage, wiki.en?.pageImage],
    // Le titre français seul égare Commons : « Le kochari » a rendu le plat
    // égyptien koshary. Le titre anglais + « Armenian » vise la bonne culture.
    search: `${titles.en || topic.title} Armenian`,
  }).catch((e) => (warnings.push(`Commons indisponible (${e.message}).`), []))

  const draftRes = await chatDraft({ messages: buildDraftMessages({ topic, entity, sources, facts, event }) })
  if (draftRes.fellBack) warnings.push(`Rédigé par le modèle de secours ${draftRes.model} (Gemini indisponible).`)
  const draft = parseArticleJson(draftRes.text)
  if (!draft) throw new Error(`brouillon illisible (JSON attendu) — modèle ${draftRes.model}`)
  const claimsRes = await chatDraft({ temperature: 0, messages: buildClaimsMessages(draft.body) })
  const claims = parseClaims(claimsRes.text)
  const haystack = [...sources.map((s) => s.extract), ...facts, ...eventFacts(event), ...entityTexts(entity)]
  // Réponse illisible : null, jamais présentée comme « rien à signaler ».
  const unsupported =
    claims === null ? null : splitClaims(findUnsupported([...new Set([...claims, ...mechanicalClaims(draft.body)])], haystack))
  const editorial = editorialAlerts(draft.body)
  // Le recouvrement mesure la paraphrase de Wikipédia seulement : la phrase
  // UNESCO est écrite par nous, l'ՀՍՀ est en arménien.
  const overlap = overlapRatio(draft.body, sources.filter((s) => s.kind === 'wikipedia').map((s) => s.extract))

  const meta = {
    slug: topic.slug,
    qid: topic.qid,
    sources: sources.map(({ kind, lang, title, url, revision, license }) => ({ kind, lang, title, url, revision, license })),
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
  const body = buildPrBody({ title: draft.title, frBody: draft.body, meta, unsupported, editorial, overlap, warnings })

  if (values.dry) {
    console.log(`\n${frText}\n----\n${body}`)
    return null
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
  return null
}

// Une idée n'est gardée que si son article Wikipédia existe vraiment (le modèle
// invente des titres), n'est pas une homonymie, et désigne un élément Wikidata
// absent de sujets.json — le qid, pas le titre, dit si c'est un doublon.
async function proposeIdeas(remaining) {
  console.log(`Plus que ${remaining} sujet(s) disponible(s) : génération d’idées.`)
  const { text } = await chatDraft({ messages: buildIdeasMessages(sujets.topics.map((t) => t.title)) })
  const known = new Set(sujets.topics.map((t) => t.qid))
  const kept = []
  for (const idea of parseIdeas(text)) {
    const [lang, title] = idea.wikipedia_fr ? ['fr', idea.wikipedia_fr] : ['en', idea.wikipedia_en]
    if (!title) continue
    const page = await fetchWikipedia(lang, title).catch((e) => (console.warn(`  idée écartée (${idea.title}) : ${e.message}`), null))
    if (!page?.wikidata || known.has(page.wikidata)) continue
    known.add(page.wikidata)
    kept.push({ ...idea, qid: page.wikidata, url: page.url })
  }
  if (!kept.length) {
    console.warn('✗ ideas : aucune idée vérifiable sur Wikipédia.')
    return
  }
  const issueBody = ideasIssueBody(kept)
  if (values.dry) {
    console.log(`\n----\n${issueBody}`)
    return
  }
  await writeFile(values['out-ideas'], issueBody)
  await output('ideas', '1')
}
