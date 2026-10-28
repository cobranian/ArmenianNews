// Les publications LinkedIn en attente (voir scripts/lib/linkedin-pending.mjs).
//
//   node scripts/linkedin-pending.mjs --hook     rappel pour le hook SessionStart
//                                                (silencieux s'il n'y a rien)
//   node scripts/linkedin-pending.mjs --list     textes exacts à coller, page par page
//   node scripts/linkedin-pending.mjs --mark <canal> <id>
//                                                noter une publication faite
//
// Registre LOCAL, hors git : .cache/linkedin-posted.json. Ces posts se font
// depuis ce poste ; un registre versionné obligerait à pousser sur main (donc
// à redéployer) après chaque publication.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBriefs } from './lib/brief-pages.mjs'
import { loadCulture } from './lib/culture-load.mjs'
import { briefItems, cultureItems, emptyLedger, parseKinds } from './lib/social.mjs'
import { LINKEDIN_CHANNELS, adminUrl, hookMessage, pending, postText } from './lib/linkedin-pending.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const LEDGER = path.join(root, '.cache/linkedin-posted.json')
const args = process.argv.slice(2)
const quiet = { warn() {}, log() {} }

async function readLedger() {
  try {
    return JSON.parse(await readFile(LEDGER, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return emptyLedger()
    throw e
  }
}
async function saveLedger(ledger) {
  await mkdir(path.dirname(LEDGER), { recursive: true })
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
}

async function compute() {
  const briefs = await loadBriefs(path.join(root, 'src/data/briefs'), quiet)
  const culture = await loadCulture(path.join(root, 'src/data/culture'), quiet)
  const items = [...cultureItems(culture), ...briefItems(briefs)]
  const r = pending({ items, ledger: await readLedger(), kinds: parseKinds(process.env.SOCIAL_KINDS || undefined) })
  if (r.seeded.length) await saveLedger(r.ledger)
  return r
}

try {
  if (args.includes('--hook')) {
    const msg = hookMessage((await compute()).posts)
    if (msg) console.log(msg)
  } else if (args.includes('--list')) {
    const { posts } = await compute()
    if (!posts.length) console.log('Rien à publier sur LinkedIn.')
    for (const p of posts) {
      const ch = LINKEDIN_CHANNELS.find((c) => c.id === p.channel)
      console.log(`=== ${p.channel} · ${p.item.id}\nPage : ${adminUrl(ch.siteId)}\nNoter ensuite : node scripts/linkedin-pending.mjs --mark ${p.channel} ${p.item.id}\n--- texte ---\n${postText(p.item)}\n`)
    }
  } else if (args[0] === '--mark') {
    const [, channel, id] = args
    if (!LINKEDIN_CHANNELS.some((c) => c.id === channel) || !id) throw new Error('usage : --mark <linkedin-ch|linkedin-org> <id>')
    const ledger = await readLedger()
    ledger.channels[channel] ??= { seededAt: new Date().toISOString(), posted: {} }
    ledger.channels[channel].posted[id] = new Date().toISOString()
    await saveLedger(ledger)
    console.log(`✓ ${channel} : ${id} noté comme publié`)
  } else {
    console.error('usage : linkedin-pending.mjs --hook | --list | --mark <canal> <id>')
    process.exitCode = 2
  }
} catch (e) {
  // Un hook en échec ne doit jamais gêner l'ouverture d'une session.
  if (args.includes('--hook')) console.log(`(rappel LinkedIn indisponible : ${e.message})`)
  else throw e
}
