// Publie sur les réseaux les articles Culture (et, sur demande, la brève) déjà
// en ligne. Voir scripts/lib/social.mjs pour les règles de sécurité.
//
//   node scripts/social-post.mjs plan --out <plan.json>
//        Choisit quoi publier. En mode réel (SOCIAL_LIVE=1), écrit le registre
//        src/data/social-posted.json — à pousser AVANT l'étape `post`.
//        Sinon : simulation, le registre n'est pas touché.
//   node scripts/social-post.mjs post --plan <plan.json>
//        Envoie le plan. Une simulation n'envoie rien et imprime les textes.
//   node --env-file=.env scripts/social-post.mjs test --channel facebook-ch [--item culture:komitas] [--yes]
//        Local : aperçu d'un message, et avec --yes, un envoi réel hors
//        registre — pour vérifier des identifiants neufs.
//
// Variables : SOCIAL_LIVE (« 1 » pour publier), SOCIAL_KINDS (« culture » par
// défaut, « culture,brief » pour la brève), et les secrets de chaque canal
// (secretNames()). Un canal sans tous ses secrets est ignoré.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBriefs } from './lib/brief-pages.mjs'
import { loadCulture } from './lib/culture-load.mjs'
import {
  CHANNELS,
  credentials,
  parseKinds,
  briefItems,
  cultureItems,
  plan,
  compose,
  emptyLedger,
  redact,
} from './lib/social.mjs'
import { send } from './lib/social-send.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const LEDGER = path.join(root, 'src/data/social-posted.json')
const args = process.argv.slice(2)
const cmd = args[0]
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const quiet = { warn() {}, log() {} }

async function loadItems() {
  const briefs = await loadBriefs(path.join(root, 'src/data/briefs'), quiet)
  const culture = await loadCulture(path.join(root, 'src/data/culture'), quiet)
  return [...cultureItems(culture), ...briefItems(briefs)]
}

async function readLedger() {
  try {
    return JSON.parse(await readFile(LEDGER, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return emptyLedger()
    throw new Error(`registre illisible (${e.message}) — rien ne sera publié`)
  }
}

function activeChannels() {
  return CHANNELS.filter((c) => credentials(c, process.env))
}

async function doPlan() {
  const out = opt('--out')
  if (!out) throw new Error('usage : plan --out <fichier>')
  const live = process.env.SOCIAL_LIVE === '1'
  const kinds = parseKinds(process.env.SOCIAL_KINDS || undefined)
  const channels = activeChannels()
  if (!channels.length) console.log('· social : aucun canal configuré (aucun secret posé)')
  const r = plan({ items: await loadItems(), channels, ledger: await readLedger(), kinds })
  for (const id of r.seeded) console.log(`· social/${id} : canal neuf, amorcé — rien de publié cette fois`)
  for (const p of r.posts) console.log(`· social/${p.channel} : à publier ${p.item.id} (${p.item.lang})`)
  if (!r.posts.length) console.log('· social : rien de nouveau')
  if (live) {
    await writeFile(LEDGER, JSON.stringify(r.ledger, null, 2) + '\n')
  } else console.log('· social : SIMULATION (SOCIAL_LIVE ≠ 1) — registre non modifié')
  await writeFile(out, JSON.stringify({ dry: !live, posts: r.posts }, null, 2))
}

async function doPost() {
  const file = opt('--plan')
  if (!file) throw new Error('usage : post --plan <fichier>')
  const { dry, posts } = JSON.parse(await readFile(file, 'utf8'))
  let failed = 0
  for (const { channel: id, item } of posts) {
    const channel = CHANNELS.find((c) => c.id === id)
    if (dry) {
      console.log(`--- [simulation] ${id} · ${item.id}\n${JSON.stringify(compose(channel.platform, item), null, 2)}`)
      continue
    }
    const creds = credentials(channel, process.env)
    if (!creds) {
      console.log(`✗ social/${id} : secrets disparus entre le plan et l'envoi`)
      failed++
      continue
    }
    try {
      const ref = await send(channel, item, creds)
      console.log(`✓ social/${id} : ${item.id} publié (${ref ?? 'sans identifiant'})`)
    } catch (e) {
      failed++
      console.log(`✗ social/${id} : ${item.id} — ${redact(e.message, Object.values(creds))}`)
    }
  }
  if (failed) process.exitCode = 1
}

async function doTest() {
  const id = opt('--channel')
  const channel = CHANNELS.find((c) => c.id === id)
  if (!channel) throw new Error(`--channel attendu parmi : ${CHANNELS.map((c) => c.id).join(', ')}`)
  const items = (await loadItems()).filter((it) => it.lang === channel.lang)
  const wanted = opt('--item')
  const item = wanted ? items.find((it) => it.id === wanted) : items.find((it) => it.kind === 'culture')
  if (!item) throw new Error(`aucun élément ${wanted ?? 'culture'} en ${channel.lang}`)
  console.log(JSON.stringify(compose(channel.platform, item), null, 2))
  if (!args.includes('--yes')) return console.log('· aperçu seulement — ajoutez --yes pour publier pour de vrai')
  const creds = credentials(channel, process.env)
  if (!creds) throw new Error(`secrets manquants : ${Object.values(channel.env).join(', ')}`)
  try {
    console.log(`✓ publié : ${await send(channel, item, creds)}`)
  } catch (e) {
    throw new Error(redact(e.message, Object.values(creds)))
  }
}

const run = { plan: doPlan, post: doPost, test: doTest }[cmd]
if (!run) {
  console.error('usage : social-post.mjs plan|post|test …')
  process.exit(2)
}
run().catch((e) => {
  console.error(`✗ social : ${e.message}`)
  process.exit(1)
})
