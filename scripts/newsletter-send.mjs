// Envoie le numéro hebdomadaire de chaque vitrine à Buttondown, au plus une
// fois par semaine ISO. Structure calquée sur scripts/social-post.mjs.
//
//   node scripts/newsletter-send.mjs plan --out <plan.json>
//        Compose les numéros de la semaine en cours, écarte ceux déjà partis
//        (registre src/data/newsletter-sent.json), puis ÉCRIT le registre —
//        à pousser AVANT l'étape `send` : un run annulé ensuite perd au pire
//        un numéro, il n'en double jamais.
//   node scripts/newsletter-send.mjs send --plan <plan.json>
//        Envoie le plan. Une réponse non 2xx fait échouer l'étape, corps de la
//        réponse au log.
//   --dry (sur les deux) : n'écrit rien, n'envoie rien, imprime le Markdown.
//        En `plan --dry`, l'absence de clé n'écarte pas une vitrine : c'est
//        l'aperçu local des deux numéros.
//
// Variables : BUTTONDOWN_API_KEY_CH, BUTTONDOWN_API_KEY_ORG (une vitrine sans
// clé est ignorée) et NEWSLETTER_STATUS (statut Buttondown, `draft` par défaut).
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SITES } from '../sites.config.js'
import { loadBriefs } from './lib/brief-pages.mjs'
import { loadCulture } from './lib/culture-load.mjs'
import { digestFor } from './lib/newsletter.mjs'
import { UA } from './lib/http.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REGISTRY = path.join(root, 'src/data/newsletter-sent.json')
export const BUTTONDOWN_EMAILS = 'https://api.buttondown.com/v1/emails'

const keyFor = (siteId, env = process.env) => env[`BUTTONDOWN_API_KEY_${siteId.toUpperCase()}`] || null

// Quels numéros partent : ni une semaine déjà inscrite au registre, ni une
// semaine vide (digest null), ni une vitrine sans clé.
export function planSends({ registry, digests, hasKey = (id) => Boolean(keyFor(id)), log = console.log }) {
  const sends = []
  for (const [siteId, digest] of Object.entries(digests)) {
    if (!digest) {
      log(`✗ newsletter/${siteId}: semaine vide`)
      continue
    }
    if (registry?.[siteId] === digest.week) {
      log(`· newsletter/${siteId}: ${digest.week} déjà envoyé`)
      continue
    }
    if (!hasKey(siteId)) {
      log(`✗ newsletter/${siteId}: pas de clé`)
      continue
    }
    sends.push({ siteId, digest })
  }
  return sends
}

// La requête, sans l'envoyer (testable sans réseau).
//
// Vérifié dans la doc Buttondown le 30 octobre 2026
// (https://docs.buttondown.com/api-emails-create) : l'URL, l'en-tête
// `Authorization: Token <clé>` et les champs `subject` / `body`. NON confirmé :
// le champ `status` et la valeur qui déclenche l'envoi réel (`about_to_send`
// attendu — la doc ne montre « About to send » que dans un diagramme d'états).
// D'où le défaut `draft` : le numéro est créé en brouillon, à relire et envoyer
// depuis Buttondown. Confirmez la valeur (un premier envoi vers un compte de
// test) AVANT de poser la variable de dépôt NEWSLETTER_STATUS.
export function buttondownRequest(digest, { key, status } = {}) {
  return {
    url: BUTTONDOWN_EMAILS,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
        'Content-Type': 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify({ subject: digest.subject, body: digest.body, status: status || 'draft' }),
    },
  }
}

const redact = (s, key) => (key ? String(s).split(key).join('***') : String(s))

async function readRegistry() {
  try {
    return JSON.parse(await readFile(REGISTRY, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw new Error(`registre illisible (${e.message}) — rien ne sera envoyé`)
  }
}

// Mêmes entrées que scripts/build-sites.mjs : brèves, Culture, et l'agenda
// suisse + monde (comme loadAgendaPays), sans quoi l'indexabilité des liens
// par pays serait mal comptée.
async function loadDigests(now) {
  const quiet = { warn() {}, log() {} }
  const briefs = await loadBriefs(path.join(root, 'src/data/briefs'), quiet)
  const culture = await loadCulture(path.join(root, 'src/data/culture'), quiet)
  const agenda = JSON.parse(await readFile(path.join(root, 'src/data/agenda.json'), 'utf8'))
  const events = [...(agenda.switzerland || []), ...(agenda.world || [])]
  const digests = {}
  for (const siteId of Object.keys(SITES)) {
    if (!SITES[siteId].newsletter) continue
    digests[siteId] = digestFor(siteId, { briefs, culture, events, now })
  }
  return digests
}

const preview = ({ siteId, digest }) =>
  `--- [simulation] newsletter/${siteId} · ${digest.week}\nObjet : ${digest.subject}\n\n${digest.body}\n`

async function doPlan(opt, dry) {
  const out = opt('--out')
  if (!out && !dry) throw new Error('usage : plan --out <fichier> [--dry]')
  const registry = await readRegistry()
  const sends = planSends({
    registry,
    digests: await loadDigests(new Date()),
    ...(dry ? { hasKey: () => true } : {}),
  })
  if (!sends.length) console.log('· newsletter : rien à envoyer')
  for (const s of sends) console.log(`· newsletter/${s.siteId}: à envoyer ${s.digest.week}`)
  if (dry) {
    for (const s of sends) console.log(preview(s))
    console.log('· newsletter : SIMULATION (--dry) — registre et plan non écrits')
    return
  }
  const next = { ...registry }
  for (const s of sends) next[s.siteId] = s.digest.week
  await writeFile(REGISTRY, JSON.stringify(next, null, 2) + '\n')
  await writeFile(out, JSON.stringify({ sends }, null, 2))
}

async function doSend(opt, dry) {
  const file = opt('--plan')
  if (!file) throw new Error('usage : send --plan <fichier> [--dry]')
  const { sends } = JSON.parse(await readFile(file, 'utf8'))
  const status = process.env.NEWSLETTER_STATUS || 'draft'
  let failed = 0
  for (const s of sends) {
    if (dry) {
      console.log(preview(s))
      continue
    }
    const key = keyFor(s.siteId)
    if (!key) {
      console.log(`✗ newsletter/${s.siteId}: clé disparue entre le plan et l'envoi`)
      failed++
      continue
    }
    const { url, init } = buttondownRequest(s.digest, { key, status })
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) })
      const text = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 2000)}`)
      let id = null
      try {
        id = JSON.parse(text).id ?? null
      } catch {
        /* un corps illisible sur un 2xx ne vaut pas un échec */
      }
      console.log(`✓ newsletter/${s.siteId}: ${s.digest.week} créé en « ${status} » (${id ?? 'sans identifiant'})`)
    } catch (e) {
      failed++
      console.log(`✗ newsletter/${s.siteId}: ${s.digest.week} — ${redact(e.message, key)}`)
    }
  }
  if (failed) process.exitCode = 1
}

async function main(args) {
  const opt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : null
  }
  const dry = args.includes('--dry')
  const run = { plan: doPlan, send: doSend }[args[0]]
  if (!run) {
    console.error('usage : newsletter-send.mjs plan|send … [--dry]')
    process.exit(2)
  }
  await run(opt, dry)
}

// Importé par les tests : ne rien lancer.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`✗ newsletter : ${e.message}`)
    process.exit(1)
  })
}
