// Envoie le numéro hebdomadaire de chaque lettre (une par langue,
// newsletterLetters() de sites.config.js) à Buttondown, au plus une fois par
// semaine ISO. Structure calquée sur scripts/social-post.mjs.
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
//        En `plan --dry`, ni l'absence de clé ni l'absence de compte
//        Buttondown (`buttondown: null`) n'écartent une vitrine : c'est
//        l'aperçu local des deux numéros, avant même que les comptes existent.
//
// Variables : BUTTONDOWN_API_KEY_<ID> par lettre — CH (fr), ORG (en), DE, IT,
// HY, RU (une lettre sans clé est ignorée) et NEWSLETTER_STATUS (statut Buttondown, `draft` par défaut).
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { newsletterLetters } from '../sites.config.js'
import { loadBriefs } from './lib/brief-pages.mjs'
import { loadCulture } from './lib/culture-load.mjs'
import { digestFor } from './lib/newsletter.mjs'
import { UA } from './lib/http.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REGISTRY = path.join(root, 'src/data/newsletter-sent.json')
export const BUTTONDOWN_EMAILS = 'https://api.buttondown.com/v1/emails'

const keyFor = (id, env = process.env) => env[`BUTTONDOWN_API_KEY_${id.toUpperCase()}`] || null
const hasAccountIn = (id) => Boolean(newsletterLetters().find((l) => l.id === id)?.buttondown)

// Quels numéros partent : ni une lettre sans compte Buttondown confirmé
// (liste `null` dans sites.config.js), ni une semaine vide (digest
// null), ni une semaine déjà inscrite au registre — ou antérieure à celle-ci :
// un registre en avance (« 2026-W46 » face au numéro W45) n'envoie pas, la
// comparaison de chaînes `AAAA-Wss` suit l'ordre des semaines —, ni une
// lettre sans clé.
export function planSends({
  registry,
  digests,
  hasKey = (id) => Boolean(keyFor(id)),
  hasAccount = hasAccountIn,
  log = console.log,
}) {
  const sends = []
  for (const [id, digest] of Object.entries(digests)) {
    if (!hasAccount(id)) {
      log(`· newsletter/${id}: en attente (pas de compte Buttondown)`)
      continue
    }
    if (!digest) {
      log(`✗ newsletter/${id}: semaine vide`)
      continue
    }
    const deja = registry?.[id]
    if (typeof deja === 'string' && deja >= digest.week) {
      log(`· newsletter/${id}: ${deja} déjà envoyé (numéro ${digest.week})`)
      continue
    }
    if (!hasKey(id)) {
      log(`✗ newsletter/${id}: pas de clé`)
      continue
    }
    // Premier numéro d'une lettre (aucune ligne au registre) : toujours en
    // brouillon, quel que soit NEWSLETTER_STATUS, pour qu'une langue nouvelle
    // soit relue une fois avant de partir seule.
    sends.push({ id, digest, first: typeof deja !== 'string' })
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

// Un 2xx ne prouve pas que Buttondown a pris le statut demandé : un champ
// `status` ignoré ou renommé créerait le numéro dans un autre état (envoyé au
// lieu de brouillon, ou l'inverse) sans la moindre erreur HTTP. Rend null si
// la réponse porte le statut demandé, sinon le message d'échec.
export function checkCreated(requested, json) {
  const got = json && typeof json === 'object' ? json.status : undefined
  if (got === requested) return null
  return `Buttondown a répondu « ${got ?? 'aucun statut'} » au lieu de « ${requested} »`
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
  for (const { id, siteId, lang } of newsletterLetters()) digests[id] = digestFor(siteId, { briefs, culture, events, now, lang })
  return digests
}

const preview = ({ id, digest }) =>
  `--- [simulation] newsletter/${id} · ${digest.week}\nObjet : ${digest.subject}\n\n${digest.body}\n`

async function doPlan(opt, dry) {
  const out = opt('--out')
  if (!out && !dry) throw new Error('usage : plan --out <fichier> [--dry]')
  const registry = await readRegistry()
  const sends = planSends({
    registry,
    digests: await loadDigests(new Date()),
    ...(dry ? { hasKey: () => true, hasAccount: () => true } : {}),
  })
  if (dry) {
    for (const { id } of newsletterLetters()) {
      if (!hasAccountIn(id)) {
        console.log(`· newsletter/${id}: en attente (pas de compte Buttondown) — aperçu quand même (--dry)`)
      }
    }
  }
  if (!sends.length) console.log('· newsletter : rien à envoyer')
  for (const s of sends) console.log(`· newsletter/${s.id}: à envoyer ${s.digest.week}`)
  if (dry) {
    for (const s of sends) console.log(preview(s))
    console.log('· newsletter : SIMULATION (--dry) — registre et plan non écrits')
    return
  }
  const next = { ...registry }
  for (const s of sends) next[s.id] = s.digest.week
  await writeFile(REGISTRY, JSON.stringify(next, null, 2) + '\n')
  await writeFile(out, JSON.stringify({ sends }, null, 2))
}

async function doSend(opt, dry) {
  const file = opt('--plan')
  if (!file) throw new Error('usage : send --plan <fichier> [--dry]')
  const { sends } = JSON.parse(await readFile(file, 'utf8'))
  const global = process.env.NEWSLETTER_STATUS || 'draft'
  let failed = 0
  for (const s of sends) {
    if (dry) {
      console.log(preview(s))
      continue
    }
    const status = s.first ? 'draft' : global
    const key = keyFor(s.id)
    if (!key) {
      console.log(`✗ newsletter/${s.id}: clé disparue entre le plan et l'envoi`)
      failed++
      continue
    }
    const { url, init } = buttondownRequest(s.digest, { key, status })
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) })
      const text = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 2000)}`)
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        /* corps illisible : checkCreated le signale (aucun statut) */
      }
      const ecart = checkCreated(status, json)
      if (ecart) {
        failed++
        console.log(`✗ newsletter/${s.id}: ${ecart}`)
        continue
      }
      const id = json?.id ?? null
      console.log(`✓ newsletter/${s.id}: ${s.digest.week} créé en « ${status} » (${id ?? 'sans identifiant'})`)
    } catch (e) {
      failed++
      console.log(`✗ newsletter/${s.id}: ${s.digest.week} — ${redact(e.message, key)}`)
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
