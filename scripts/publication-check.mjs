#!/usr/bin/env node
// Le tableau de bord de la publication (social-check.yml, deux fois par jour
// et après chaque échec d'un workflow d'articles). Prend les mesures, puis
// écrit le texte de l'issue épinglée et, s'il y a du neuf, le commentaire qui
// notifie. Ne publie RIEN, nulle part : il lit.
//
//   node scripts/publication-check.mjs --body <issue.md> --comment <comment.md> [--previous <ancien-corps.md>]
//
// Variables : GEMINI_API_KEY, OPENROUTER_API_KEY (et ARTICLES_*), les secrets
// des réseaux, SOCIAL_LIVE, GH_TOKEN et GITHUB_REPOSITORY (API GitHub).
// Chaque mesure échoue seule : une API muette devient une ligne du tableau,
// jamais un tableau absent.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { ALL_LANGS } from '../sites.config.js'
import { loadCulture } from './lib/culture-load.mjs'
import { chat, llmConfig, explain, CULTURE_FALLBACK_MODELS, OPENROUTER_BASE_URL } from './lib/culture-llm.mjs'
import { checkAccounts } from './lib/account-check.mjs'
import { parseServiceAccount, jwtAssertion, listUrl, TOKEN_URL } from './lib/gsc.mjs'
import { SITES } from '../sites.config.js'
import { ledgerFailures, redact } from './lib/social.mjs'
import { WHATSAPP_CHANNELS } from './lib/linkedin-pending.mjs'
import {
  checkModels,
  checkWorkflows,
  checkPullRequests,
  checkTranslations,
  checkSocial,
  checkManual,
  checkDeadlines,
  checkIndexing,
  lastOutcome,
  renderDashboard,
  notification,
  previousAlertKeys,
  WATCHED_WORKFLOWS,
} from './lib/publication-check.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { body: { type: 'string' }, comment: { type: 'string' }, previous: { type: 'string' } } })
if (!values.body) throw new Error('usage : publication-check --body <fichier> [--comment <fichier>] [--previous <fichier>]')
const env = process.env
const now = new Date()

// L'issue est PUBLIQUE : aucune valeur secrète n'y entre, même par le message
// d'une erreur inattendue. Toute valeur d'au moins 6 caractères d'une
// variable au nom de secret est masquée.
const SECRET_NAME = /KEY|TOKEN|PASSWORD|SECRET|HANDLE|CHAT|PAGE_ID|USER_ID|AUTHOR/
const secretValues = Object.entries(env).filter(([k]) => SECRET_NAME.test(k)).map(([, v]) => v)
const clean = (t) => redact(t, secretValues)

// Une mesure qui lève devient une ligne « à faire » : mieux vaut une alerte
// lisible qu'un tableau qui se tait.
async function guarded(title, fn) {
  try {
    return { title, rows: await fn() }
  } catch (e) {
    return { title, rows: [{ key: `crash-${title}`, level: 'faire', text: `Mesure impossible : ${e.message}`, action: 'Lire le journal du tableau de bord' }] }
  }
}

// --- Modèles : un appel minuscule à chacun (quelques jetons).
const PING = [{ role: 'user', content: 'Réponds par le seul mot : OK' }]
async function probe(cfg) {
  try {
    const r = await chat({ ...cfg, messages: PING, temperature: 0, timeoutMs: 60_000 })
    return { ok: true, model: r.model }
  } catch (e) {
    return { ok: false, status: e.status, explain: explain(e, cfg.label) }
  }
}
async function models() {
  const cfg = llmConfig(env)
  const label = /openrouter\.ai/.test(cfg.baseUrl) ? 'OpenRouter (principal)' : 'Gemini'
  const primary = { label, model: cfg.model, ...(await probe({ ...cfg, label })) }
  const fallbacks = []
  for (const model of CULTURE_FALLBACK_MODELS) {
    if (!env.OPENROUTER_API_KEY) {
      fallbacks.push({ model, ok: false, explain: 'OPENROUTER_API_KEY absente' })
      continue
    }
    fallbacks.push({ model, ...(await probe({ baseUrl: OPENROUTER_BASE_URL, model, apiKey: env.OPENROUTER_API_KEY, label: 'OpenRouter' })) })
  }
  return checkModels({ primary, fallbacks })
}

// --- GitHub
const repo = env.GITHUB_REPOSITORY || 'cobranian/ArmenianNews'
async function gh(pathname) {
  const res = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
    headers: { accept: 'application/vnd.github+json', ...(env.GH_TOKEN ? { authorization: `Bearer ${env.GH_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`GitHub ${pathname} : HTTP ${res.status}`)
  return res.json()
}
// Publication et traduction tournent sur les PR : un échec sur une PR déjà
// fusionnée ou fermée n'appelle plus aucune action (et la fusion elle-même
// déclenche un run sans job, rouge — mesuré le 2 nov. 2026, PR #124).
const PR_WORKFLOWS = new Set(['articles-publish.yml', 'articles-translate.yml'])
async function workflows(openBranches) {
  const outcomes = {}
  let lastDraftSuccess = null
  for (const file of WATCHED_WORKFLOWS) {
    let { workflow_runs: runs = [] } = await gh(`/actions/workflows/${file}/runs?per_page=15`)
    if (PR_WORKFLOWS.has(file)) runs = runs.filter((r) => openBranches.has(r.head_branch))
    // Un run en cours : a-t-il déjà un job en échec ?
    for (const r of runs.filter((x) => x.status !== 'completed').slice(0, 2)) {
      const { jobs = [] } = await gh(`/actions/runs/${r.id}/jobs`)
      r.failedJob = jobs.some((j) => j.conclusion === 'failure')
    }
    outcomes[file] = lastOutcome(runs)
    if (file === 'articles.yml') lastDraftSuccess = runs.find((r) => r.conclusion === 'success')?.created_at ?? null
  }
  return checkWorkflows(outcomes, { now, lastDraftSuccess })
}
async function articleRows() {
  const prs = (await gh('/pulls?state=open&per_page=100')).filter(
    (p) => p.head?.ref?.startsWith('culture/') && p.head?.repo?.full_name === repo,
  )
  // Le statut culture-check de la tête : la traduction finit verte même en
  // échec (continue-on-error), c'est ce statut qui dit la vérité.
  for (const p of prs) {
    const { statuses = [] } = await gh(`/commits/${p.head.sha}/status`)
    p.check = statuses.find((x) => x.context === 'culture-check') ?? null
  }
  const open = new Set(prs.map((p) => p.head.ref))
  const rows = [...checkPullRequests(prs, now), ...(await workflows(open))]
  return [...rows, ...checkTranslations(await articles(), others)]
}

// --- Données du dépôt (lues dans les mesures : une lecture qui casse devient
// une ligne, pas un tableau absent).
const quiet = { warn() {}, log() {} }
let cache = null
const articles = async () => (cache ??= await loadCulture(path.join(root, 'src/data/culture'), quiet))
const others = ALL_LANGS.filter((l) => l !== 'fr')

async function social() {
  const ledger = JSON.parse(await readFile(path.join(root, 'src/data/social-posted.json'), 'utf8'))
  const { accounts, tokens } = await checkAccounts(env, { now })
  return checkSocial({ live: env.SOCIAL_LIVE === '1', accounts, tokens, failures: ledgerFailures(ledger) })
}
// Google : une vraie connexion, en LECTURE seule (liste des sitemaps).
async function googleAccess() {
  const sa = parseServiceAccount(env.GSC_SERVICE_ACCOUNT)
  if (!sa) return null
  const tok = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwtAssertion(sa) }),
    signal: AbortSignal.timeout(30_000),
  })
  const t = await tok.json().catch(() => ({}))
  if (!t.access_token) return Object.keys(SITES).map((site) => ({ site, ok: false, error: `clé refusée par Google (HTTP ${tok.status} ${t.error ?? ''})` }))
  const out = []
  for (const [site, cfg] of Object.entries(SITES)) {
    const res = await fetch(listUrl(cfg.host), { headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(30_000) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) out.push({ site, ok: false, error: `accès refusé à la propriété (HTTP ${res.status})` })
    else out.push({ site, ok: true, lastSubmitted: (body.sitemap ?? []).map((m) => m.lastSubmitted).filter(Boolean).sort().at(-1) ?? null })
  }
  return out
}

async function manual() {
  const videos = JSON.parse(await readFile(path.join(root, 'src/data/culture-videos.json'), 'utf8'))
  return checkManual({ articles: await articles(), videos, langs: ALL_LANGS, whatsappChannels: WHATSAPP_CHANNELS.filter((c) => c.url).length })
}

const sections = [
  await guarded('🤖 Rédaction et traduction', models),
  await guarded('📰 Articles', articleRows),
  await guarded('📣 Réseaux (envoi automatique : Facebook, Instagram, Telegram, Bluesky)', social),
  await guarded('✋ Publication à la main', manual),
  await guarded('🔎 Référencement', async () => checkIndexing({ google: await googleAccess() })),
  await guarded('📅 Échéances', async () => checkDeadlines(now)),
]

for (const sec of sections) for (const r of sec.rows) {
  r.text = clean(r.text)
  if (r.action) r.action = clean(r.action)
}

const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}` : ''
await writeFile(values.body, renderDashboard(sections, { now, runUrl }))
let previous = ''
if (values.previous) previous = await readFile(values.previous, 'utf8').catch(() => '')
const note = notification(sections, previousAlertKeys(previous))
if (values.comment && note) await writeFile(values.comment, `${note}\n\n${runUrl}\n`)
for (const s of sections) for (const r of s.rows) console.log(`${r.level.padEnd(8)} ${r.text}`)
