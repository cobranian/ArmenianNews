#!/usr/bin/env node
/**
 * Rattrapage des traductions Culture de/it (spec 2026-10-23, « Culture de/it »).
 *
 *   npm run culture:backfill -- [--dry] [--summary resume.md]
 *
 * Retient chaque article dont une langue de OPTIONAL est absente, périmée ou
 * invalide — un article antérieur à de/it, un français retouché depuis, ou une
 * de/it qui a échoué au passage « traduire » et que la publication ne retente
 * jamais. Pour chacun : complète meta.sources avec dewiki/itwiki (sitelinks du
 * qid, vérifiés contre lui) quand elles manquent, puis appelle
 * culture-translate --langs sur ces seules langues — même modèle, même règle,
 * aucun repli. Écrit enfin un résumé Markdown, le corps de la PR.
 *
 * --dry : la liste seulement, sans réseau ni fichier écrit.
 * Pose `pending=<n>` dans GITHUB_OUTPUT : articles-backfill.yml s'arrête à 0.
 * Le script ne commite, ne pousse et ne fusionne rien : c'est le workflow qui
 * ouvre la PR, et le propriétaire qui la fusionne.
 */
import { readFile, writeFile, appendFile, mkdtemp, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { readArticle, articleSlugs } from './lib/culture-load.mjs'
import { validateArticle, OPTIONAL } from './lib/culture-validate.mjs'
import { fetchEntity, resolveTitles, fetchTopicWikipedia } from './lib/culture-sources.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')

// Les articles à rattraper, dans l'ordre reçu. Un article sans français
// publiable (langs.fr absent) est ignoré : il n'y a rien à traduire.
export function pendingTranslations(articles) {
  const out = []
  for (const a of articles) {
    const { langs } = validateArticle(a)
    if (!langs.fr) continue
    const missing = OPTIONAL.filter((l) => !langs[l])
    if (missing.length) out.push({ slug: a.slug, langs: missing })
  }
  return out
}

const isWiki = (s) => (s?.kind ?? 'wikipedia') === 'wikipedia'

// Parmi `langs`, celles dont meta.sources ne cite aucune Wikipédia.
export function missingSourceLangs(meta, langs) {
  const sources = Array.isArray(meta?.sources) ? meta.sources : []
  return langs.filter((l) => !sources.some((s) => isWiki(s) && s.lang === l))
}

// Les champs que culture-draft écrit dans meta.sources : jamais l'extrait.
export const sourceEntry = ({ kind, lang, title, url, revision, license, postId }) =>
  ({ kind, lang, title, url, revision, license, ...(postId ? { postId } : {}) })

// Le qid du sujet : meta.json d'abord, sujets.json à défaut — les premiers
// articles (khatchkar, kochari, komitas) n'en portent pas dans meta.json.
export const articleQid = (meta, topic) => meta?.qid || topic?.qid || null

// Complète meta.sources par les sitelinks du qid. Rend les lignes du résumé :
// un sujet sans page de/it se traduit quand même, sans nom en usage.
async function completeSources(slug, langs, topics) {
  const metaPath = path.join(DIR, slug, 'meta.json')
  const meta = JSON.parse(await readFile(metaPath, 'utf-8'))
  const missing = missingSourceLangs(meta, langs)
  if (!missing.length) return []
  const topic = topics.find((t) => t.slug === slug)
  const qid = articleQid(meta, topic)
  if (!qid) return [`- ⚠️ aucun qid (meta.json ni sujets.json) : Wikipédia ${missing.join('/')} non cherchée`]
  const entity = await fetchEntity(qid)
  const { wiki, warnings } = await fetchTopicWikipedia(resolveTitles(topic, entity), qid, { langs: missing })
  const added = missing.map((l) => wiki[l]).filter(Boolean)
  if (added.length) {
    meta.sources = [...meta.sources, ...added.map(sourceEntry)]
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
  }
  return [...added.map((p) => `- ✓ source ajoutée : Wikipédia ${p.lang} « ${p.title} »`), ...warnings.map((w) => `- ⚠️ ${w}`)]
}

const run = promisify(execFile)

async function translate(slug, langs, tmp) {
  const summary = path.join(tmp, `${slug}.md`)
  let failed = false
  try {
    const r = await run(process.execPath, [path.join(root, 'scripts/culture-translate.mjs'), slug, '--langs', langs.join(','), '--summary', summary], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    })
    // Les « ✗ slug/de : … » de culture-translate partent sur stderr : au log CI.
    process.stdout.write(r.stdout)
    process.stderr.write(r.stderr)
  } catch (e) {
    // Code 1 : l'image a échoué (seule cause bloquante avec --langs de,it).
    failed = true
    process.stderr.write(String(e.stderr ?? e.message))
  }
  const text = await readFile(summary, 'utf-8').catch(() => null)
  // Les lignes « - ✓ / ✗ … » seulement : l'en-tête et le conseil final
  // (« reposez l'étiquette traduire ») ne valent pas pour cette PR.
  const lines = text ? text.split('\n').filter((l) => l.startsWith('- ')) : []
  if (!lines.length) lines.push(`- ✗ culture-translate n'a rien rapporté${failed ? ' (échec)' : ''}`)
  return lines
}

async function output(k, v) {
  console.log(`${k}=${v}`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${k}=${v}\n`)
}

async function main() {
  const { values } = parseArgs({
    options: {
      dry: { type: 'boolean', default: false },
      summary: { type: 'string', default: path.join(tmpdir(), 'culture-backfill.md') },
    },
  })
  const articles = []
  for (const slug of await articleSlugs(DIR)) articles.push(await readArticle(DIR, slug))
  const pending = pendingTranslations(articles)

  for (const p of pending) {
    const a = articles.find((x) => x.slug === p.slug)
    const src = missingSourceLangs(a.meta, p.langs)
    console.log(`${p.slug} : ${p.langs.join(', ')}${src.length ? ` (Wikipédia ${src.join('/')} à chercher)` : ''}`)
  }
  console.log(`${pending.length} article(s) à traduire en de/it`)
  await output('pending', pending.length)
  if (values.dry || !pending.length) return

  const { topics = [] } = JSON.parse(await readFile(path.join(DIR, 'sujets.json'), 'utf-8'))
  const tmp = await mkdtemp(path.join(tmpdir(), 'culture-backfill-'))
  const md = [
    '## Culture : rattrapage des traductions de/it',
    '',
    `${pending.length} article(s) dont l’allemand ou l’italien manquait, était périmé ou invalide.`,
    'Traduits du français **déjà relu et publié**, par le même modèle que le flux',
    'quotidien, sans modèle de secours. de et it sont facultatives : elles ne',
    'sont pas relues, et une langue en échec sera retentée au prochain rattrapage.',
    '',
    'Rien ne part en ligne avant que **le propriétaire fusionne** cette PR ;',
    'le robot ne la fusionne jamais.',
  ]
  try {
    for (const p of pending) {
      console.log(`→ ${p.slug} (${p.langs.join(', ')})`)
      const notes = await completeSources(p.slug, p.langs, topics)
        .catch((e) => [`- ⚠️ Wikidata indisponible (${e.message}) : traduction sans nom en usage`])
      const lines = await translate(p.slug, p.langs, tmp)
      md.push('', `### ${p.slug}`, '', ...notes, ...lines)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
  await writeFile(values.summary, `${md.join('\n')}\n`)
  console.log(`Résumé : ${values.summary}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
