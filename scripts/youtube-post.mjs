// Vide la file YouTube (src/data/youtube-queue.json) : chaque Short part AU
// PLUS UNE FOIS. Règles dans scripts/lib/youtube.mjs ; même mécanique que
// scripts/social-post.mjs, dont ce script copie les étapes.
//
//   node scripts/youtube-post.mjs plan --out <plan.json>
//        Choisit quoi envoyer (FIFO, quota du jour PT, au plus
//        MAX_UPLOADS_PER_RUN) et écrit le registre src/data/youtube-posted.json
//        — à pousser AVANT l'étape `post`.
//   node scripts/youtube-post.mjs post --plan <plan.json> --results <res.jsonl>
//        Envoie. Une ligne JSON par envoi, écrite au fil de l'eau.
//   node scripts/youtube-post.mjs settle --results <res.jsonl> --plan <plan.json>
//        Reporte les résultats : registre, culture-videos.json (vidéos
//        publiques), retrait de la file. Un échec sûr repart (3 essais).
//   node scripts/youtube-post.mjs mark <slug> <lang> <videoId>
//        Un Short envoyé à la main (Chrome), ou un envoi incertain vérifié sur
//        la chaîne : registre + culture-videos.json + retrait de la file. À
//        pousser (PR).
//   node scripts/youtube-post.mjs retry <slug>:<lang> [--drop]
//        Remet en file un envoi abandonné ; --drop y renonce. À pousser (PR).
//
// plan, post et settle ne font RIEN tant que YOUTUBE_AUTO ne vaut pas « 1 »
// (l'audit de l'API n'est pas accordé : un envoi resterait privé). mark et
// retry marchent sans. Secrets : YT_CLIENT_ID, YT_CLIENT_SECRET,
// YT_REFRESH_TOKEN_<LANG> ; une langue sans jeton est ignorée.
// --data <dossier> remplace src/data (tests).
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_LANGS } from '../sites.config.js'
import {
  planUploads,
  settleUploads,
  applyUploads,
  markUpload,
  retryUpload,
  emptyYtLedger,
  ytTokens,
  ytKey,
  zurichDay,
  MAX_ATTEMPTS,
} from './lib/youtube.mjs'
import { readQueue } from './lib/youtube-queue.mjs'
import { uploadShort, isUploadUncertain } from './lib/youtube-send.mjs'
import { redact } from './lib/social.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const DATA = path.resolve(opt('--data') ?? path.join(root, 'src/data'))
const LEDGER = path.join(DATA, 'youtube-posted.json')
const QUEUE = path.join(DATA, 'youtube-queue.json')
const VIDEOS = path.join(DATA, 'culture-videos.json')
const VALUED = new Set(['--out', '--plan', '--results', '--data'])
const positionals = args.filter((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1]))
const cmd = positionals[0]

const readJson = async (file, empty) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return empty()
    throw new Error(`${path.basename(file)} illisible (${e.message}) — rien ne sera envoyé`)
  }
}
const writeJson = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n')
const readLedger = () => readJson(LEDGER, emptyYtLedger)
const readVideos = () => readJson(VIDEOS, () => ({}))

function creds(lang) {
  const refreshToken = process.env[`YT_REFRESH_TOKEN_${lang.toUpperCase()}`]?.trim()
  const clientId = process.env.YT_CLIENT_ID?.trim()
  const clientSecret = process.env.YT_CLIENT_SECRET?.trim()
  return refreshToken && clientId && clientSecret ? { clientId, clientSecret, refreshToken } : null
}

async function doPlan() {
  const out = opt('--out')
  if (!out) throw new Error('usage : plan --out <fichier>')
  const tokens = ytTokens(process.env)
  if (!tokens.length) console.log('· youtube : aucune chaîne configurée (aucun jeton posé)')
  const r = planUploads({ queue: await readQueue(QUEUE), ledger: await readLedger(), tokens, videos: await readVideos() })
  for (const u of r.uploads) console.log(`· youtube/${u.lang} : à envoyer ${u.slug}`)
  if (!r.uploads.length) console.log('· youtube : rien à envoyer (file vide, quota du jour atteint ou en attente)')
  await writeJson(LEDGER, r.ledger)
  await writeFile(out, JSON.stringify({ uploads: r.uploads }, null, 2))
}

async function doPost() {
  const file = opt('--plan')
  const resultsFile = opt('--results')
  if (!file || !resultsFile) throw new Error('usage : post --plan <fichier> --results <fichier>')
  const { uploads } = JSON.parse(await readFile(file, 'utf8'))
  let failed = 0
  // Un par un : deux envois au plus, et un run court.
  for (const it of uploads) {
    const key = ytKey(it.slug, it.lang)
    const base = { key, slug: it.slug, lang: it.lang, title: it.title, description: it.description }
    const c = creds(it.lang)
    if (!c) {
      failed++
      console.log(`✗ youtube/${key} : jeton disparu entre le plan et l'envoi`)
      await appendFile(resultsFile, JSON.stringify({ ...base, ok: false, error: 'jeton disparu entre le plan et l’envoi' }) + '\n')
      continue
    }
    try {
      const { id, privacyStatus } = await uploadShort(it, c)
      const priv = privacyStatus !== 'public'
      if (priv) console.log(`⚠ youtube/${key} : envoyée (${id}) mais ${privacyStatus} — audit de l'API non accordé ? Gardée au registre, pas sur le site.`)
      else console.log(`✓ youtube/${key} : en ligne (${id})`)
      await appendFile(resultsFile, JSON.stringify({ ...base, ok: true, id, ...(priv ? { private: true } : {}) }) + '\n')
    } catch (e) {
      failed++
      const msg = redact(e.message, Object.values(c))
      const uncertain = isUploadUncertain(e)
      console.log(`✗ youtube/${key} : ${msg}${uncertain ? ' (INCERTAIN : peut-être en ligne, pas retenté)' : ''}`)
      await appendFile(resultsFile, JSON.stringify({ ...base, ok: false, uncertain, error: msg, ...(e.videoId ? { id: e.videoId } : {}) }) + '\n')
    }
  }
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `failures=${failed}\n`)
}

async function doSettle() {
  const file = opt('--results')
  if (!file) throw new Error('usage : settle --results <fichier> [--plan <plan.json>]')
  let planned = []
  if (opt('--plan')) {
    try {
      planned = JSON.parse(await readFile(opt('--plan'), 'utf8')).uploads ?? []
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
  }
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const results = text.split('\n').filter(Boolean).map((l) => JSON.parse(l))
  if (!results.length && !planned.length) return console.log('· youtube : aucun résultat à reporter')
  const now = new Date()
  const ledger = settleUploads(await readLedger(), results, now, planned)
  const applied = applyUploads({ queue: await readQueue(QUEUE), videos: await readVideos(), results, today: zurichDay(now) })
  await writeJson(LEDGER, ledger)
  await writeJson(QUEUE, applied.queue)
  if (applied.added.length) await writeJson(VIDEOS, applied.videos)
  for (const a of applied.added) console.log(`  + culture-videos.json : ${a}`)
  for (const w of applied.warnings) console.log(`⚠ youtube : ${w}`)
  for (const r of results.filter((x) => !x.ok)) {
    const f = ledger.failed[r.key]
    if (f?.uncertain) console.log(`? youtube/${r.key} — incertain, à vérifier sur la chaîne (mark ou retry --drop)`)
    else console.log(`↻ youtube/${r.key} — échec ${f?.attempts}, ${f?.attempts >= MAX_ATTEMPTS ? 'ABANDONNÉ (voir le tableau de bord)' : 'retenté plus tard'}`)
  }
  for (const p of planned.filter((p) => !results.some((r) => r.key === ytKey(p.slug, p.lang))))
    console.log(`? youtube/${ytKey(p.slug, p.lang)} — aucun résultat (run coupé), à vérifier sur la chaîne`)
}

async function doMark() {
  const [, slug, lang, id] = positionals
  if (!slug || !ALL_LANGS.includes(lang) || !id) throw new Error('usage : mark <slug> <lang> <videoId>')
  const key = ytKey(slug, lang)
  const now = new Date()
  // Le registre d'abord : « déjà en ligne » prime sur « absent de la file ».
  const ledger = markUpload(await readLedger(), key, id, now)
  const queue = await readQueue(QUEUE)
  if (!queue.items.some((i) => ytKey(i.slug, i.lang) === key)) throw new Error(`${key} n'est pas dans la file : utilisez npm run videos:add`)
  const applied = applyUploads({ queue, videos: await readVideos(), results: [{ key, ok: true, id }], today: zurichDay(now) })
  if (applied.warnings.length) throw new Error(applied.warnings.join(' ; '))
  await writeJson(LEDGER, ledger)
  await writeJson(QUEUE, applied.queue)
  await writeJson(VIDEOS, applied.videos)
  console.log(`· youtube/${key} : ${id} inscrit — poussez youtube-posted.json, youtube-queue.json et culture-videos.json (PR)`)
}

async function doRetry() {
  const key = positionals[1]
  if (!/^[^:\s]+:[a-z]{2}$/.test(key ?? '')) throw new Error('usage : retry <slug>:<lang> [--drop]')
  const drop = args.includes('--drop')
  const ledger = await readLedger()
  const had = key in (ledger.posted ?? {}) || key in (ledger.failed ?? {})
  await writeJson(LEDGER, retryUpload(ledger, key, { drop }))
  if (!had) return console.log(`· youtube/${key} n'était pas au registre (rien à faire)`)
  console.log(`· youtube/${key} ${drop ? 'classé (ne repartira pas)' : 'remis en file'} — poussez src/data/youtube-posted.json (PR)`)
}

const GATED = { plan: doPlan, post: doPost, settle: doSettle }
const run = { ...GATED, mark: doMark, retry: doRetry }[cmd]
if ((!cmd || GATED[cmd]) && process.env.YOUTUBE_AUTO !== '1') {
  console.log('· youtube : YOUTUBE_AUTO ≠ 1 (audit de l’API non accordé) — aucun envoi, rien écrit ; la file se vide à la main (Chrome + mark)')
  process.exit(0)
}
if (!run) {
  console.error('usage : youtube-post.mjs plan|post|settle|mark|retry …')
  process.exit(2)
}
run().catch((e) => {
  console.error(`✗ youtube : ${e.message}`)
  process.exit(1)
})
