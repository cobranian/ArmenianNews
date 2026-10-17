#!/usr/bin/env node
/**
 * Applique une consigne « /corrige » du propriétaire au fr.md d'un article.
 *
 *   node scripts/culture-revise.mjs <slug> --instruction consigne.md \
 *     --pr-body corps.md --out-body nouveau-corps.md --out-reply reponse.md
 *
 * Appelé par articles-revise.yml sur la branche de la PR. Relit les sources à
 * leur révision enregistrée, réécrit fr.md (date conservée), relance les
 * contrôles du brouillon, réécrit la section automatique du corps de PR — et
 * décoche « Faits vérifiés » : ce qui a été vérifié n'est plus ce qui est écrit.
 *
 * Commentaire qui n'est pas une commande : sortie 0, aucun appel au modèle.
 * Panne du modèle : sortie 1, fr.md inchangé, réponse avec l'erreur.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { parseReviseCommand, changedParagraphs, newAlerts, reviseReply } from './lib/culture-commands.mjs'
import { chatDraft } from './lib/culture-llm.mjs'
import {
  buildReviseMessages, buildClaimsMessages, parseArticleJson, parseClaims, findUnsupported, eventFacts,
} from './lib/culture-prompts.mjs'
import { fetchEntity, refetchSources } from './lib/culture-sources.mjs'
import { loadUnesco } from './lib/culture-unesco.mjs'
import { mechanicalClaims, entityTexts, splitClaims, editorialAlerts } from './lib/culture-checks.mjs'
import { overlapRatio } from './lib/culture-overlap.mjs'
import { parseFrontMatter, serializeFrontMatter } from './lib/culture-markdown.mjs'
import { buildAutoSection, replaceAutoSection, isChecked, uncheck } from './lib/culture-pr.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    instruction: { type: 'string' },
    'pr-body': { type: 'string' },
    'out-body': { type: 'string' },
    'out-reply': { type: 'string' },
  },
})
const [slug] = positionals
for (const k of ['instruction', 'pr-body', 'out-body', 'out-reply'])
  if (!values[k]) throw new Error(`usage : culture-revise <slug> --${k} <fichier> (manquant)`)
// Le slug devient un chemin : la branche a déjà été filtrée, on refiltre ici.
if (!/^[a-z0-9-]+$/.test(slug ?? '')) throw new Error(`slug invalide : ${slug}`)

const instruction = parseReviseCommand(await readFile(values.instruction, 'utf-8'))
if (!instruction) {
  console.log('Pas de commande /corrige avec consigne : rien à faire.')
  process.exit(0)
}

const fail = async (message) => {
  console.error(`✗ révision : ${message}`)
  await writeFile(values['out-reply'], reviseReply({ error: message }))
  process.exit(1)
}

const base = path.join(DIR, slug)
const frPath = path.join(base, 'fr.md')
const fr = parseFrontMatter(await readFile(frPath, 'utf-8'))
const meta = JSON.parse(await readFile(path.join(base, 'meta.json'), 'utf-8'))
const prBody = await readFile(values['pr-body'], 'utf-8')

const warnings = []
const entity = meta.qid
  ? await fetchEntity(meta.qid).catch((e) => (warnings.push(`Wikidata indisponible (${e.message}).`), null))
  : null
const sources = await refetchSources(meta.sources ?? [], { unesco: loadUnesco() })
const missing = (meta.sources ?? []).length - sources.length
if (missing > 0) warnings.push(`${missing} source(s) non relue(s) à leur révision : la vérification des faits est partielle.`)

let res
try {
  res = await chatDraft({
    messages: buildReviseMessages({ title: fr.data.title, description: fr.data.description, body: fr.body, instruction, entity, sources }),
  })
} catch (e) {
  await fail(e.message)
}
const revised = parseArticleJson(res.text)
if (!revised) await fail(`réponse illisible (JSON attendu) — modèle ${res.model}`)
if (res.fellBack) warnings.push(`Révisé par le modèle de secours ${res.model} (Gemini indisponible).`)

// La vérification des faits est un contrôle, pas une condition : sa panne
// donne `null` (« vérifiez tout à la main »), jamais « rien à signaler ».
let claims = null
try {
  claims = parseClaims((await chatDraft({ temperature: 0, messages: buildClaimsMessages(revised.body) })).text)
} catch (e) {
  console.warn(`✗ claims : ${e.message}`)
}
const haystack = [...sources.map((s) => s.extract), ...(entity?.facts ?? []), ...eventFacts(meta.agendaEvent), ...entityTexts(entity)]
const unsupported =
  claims === null ? null : splitClaims(findUnsupported([...new Set([...claims, ...mechanicalClaims(revised.body)])], haystack))
const editorial = editorialAlerts(revised.body)
const overlap = overlapRatio(revised.body, sources.filter((s) => s.kind === 'wikipedia').map((s) => s.extract))

// Tout le front-matter est gardé (la date d'abord) ; seuls titre et description suivent la révision.
await writeFile(frPath, serializeFrontMatter({ ...fr.data, title: revised.title, description: revised.description }, revised.body))

const auto = buildAutoSection({
  title: revised.title,
  frBody: revised.body,
  meta: { ...meta, model: `${meta.model} ; révision : ${res.model}` },
  unsupported,
  editorial,
  overlap,
  warnings,
})
const checked = isChecked(prBody)
let body = replaceAutoSection(prBody, auto)
if (checked) body = uncheck(body)
await writeFile(values['out-body'], body)
await writeFile(
  values['out-reply'],
  reviseReply({
    model: res.model,
    fellBack: res.fellBack,
    changed: changedParagraphs(fr.body, revised.body),
    alerts: newAlerts(prBody, unsupported?.facts ?? []),
    unchecked: checked,
  }),
)
console.log(`Révision de ${slug} appliquée (${res.model}).`)
