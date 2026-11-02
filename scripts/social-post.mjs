// Publie sur les réseaux les articles Culture (et, sur demande, la brève) déjà
// en ligne. Voir scripts/lib/social.mjs pour les règles de sécurité.
//
//   node scripts/social-post.mjs plan --out <plan.json>
//        Choisit quoi publier. En mode réel (SOCIAL_LIVE=1), écrit le registre
//        src/data/social-posted.json — à pousser AVANT l'étape `post`.
//        Sinon : simulation, le registre n'est pas touché.
//   node scripts/social-post.mjs post --plan <plan.json> [--results <res.jsonl>]
//        Envoie le plan. Une simulation n'envoie rien et imprime les textes.
//        --results : une ligne JSON par envoi, écrite AU FIL de l'eau (un run
//        coupé garde ce qui a déjà été tranché).
//   node scripts/social-post.mjs settle --results <res.jsonl>
//        Reporte les résultats dans le registre : un échec en sort et sera
//        retenté (MAX_ATTEMPTS fois), un succès efface son échec passé.
//   node --env-file=.env scripts/social-post.mjs test --channel facebook-ch [--item culture:komitas] [--yes]
//        Local : aperçu d'un message, et avec --yes, un envoi réel hors
//        registre — pour vérifier des identifiants neufs, ou publier une
//        annonce (--item annonce:lettre, src/data/social-announcements.json).
//   node scripts/social-post.mjs check [--out <fichier>]
//        Chaque compte configuré se connecte et lit son nom, sans rien
//        publier (social-check.yml, chaque jour → issue [social-down]).
//
// Variables : SOCIAL_LIVE (« 1 » pour publier), SOCIAL_KINDS (« culture » par
// défaut, « culture,brief » pour la brève), et les secrets de chaque canal
// (secretNames()). Un canal sans tous ses secrets est ignoré.
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBriefs } from './lib/brief-pages.mjs'
import { loadCulture } from './lib/culture-load.mjs'
import {
  CHANNELS,
  credentials,
  parseKinds,
  briefItems,
  announceItems,
  cultureItems,
  plan,
  settle,
  compose,
  emptyLedger,
  MAX_ATTEMPTS,
  redact,
} from './lib/social.mjs'
import { send } from './lib/social-send.mjs'
import { checkAccounts } from './lib/account-check.mjs'

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
  const announces = JSON.parse(await readFile(path.join(root, 'src/data/social-announcements.json'), 'utf8'))
  return [...cultureItems(culture), ...briefItems(briefs), ...announceItems(announces)]
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
  const resultsFile = opt('--results')
  const record = async (r) => {
    if (resultsFile && !dry) await appendFile(resultsFile, JSON.stringify(r) + '\n')
  }
  let failed = 0
  // Un compte après l'autre, mais les comptes EN PARALLÈLE : avec ~30 canaux,
  // l'envoi en série durait des minutes, et un push sur main annule le run
  // (concurrency `deploy`) alors que le registre marque déjà tout « parti ».
  const byChannel = new Map()
  for (const p of posts) byChannel.set(p.channel, [...(byChannel.get(p.channel) ?? []), p.item])
  const sendAll = async (id, items) => {
    const channel = CHANNELS.find((c) => c.id === id)
    for (const item of items) {
      if (dry) {
        console.log(`--- [simulation] ${id} · ${item.id}
${JSON.stringify(compose(channel.platform, item), null, 2)}`)
        continue
      }
      const creds = credentials(channel, process.env)
      if (!creds) {
        console.log(`✗ social/${id} : secrets disparus entre le plan et l'envoi`)
        await record({ channel: id, id: item.id, ok: false, error: 'secrets disparus entre le plan et l’envoi' })
        failed++
        continue
      }
      try {
        const ref = await send(channel, item, creds)
        console.log(`✓ social/${id} : ${item.id} publié (${ref ?? 'sans identifiant'})`)
        await record({ channel: id, id: item.id, ok: true })
      } catch (e) {
        failed++
        const msg = redact(e.message, Object.values(creds))
        console.log(`✗ social/${id} : ${item.id} — ${msg}`)
        await record({ channel: id, id: item.id, ok: false, error: msg })
      }
    }
  }
  await Promise.all([...byChannel].map(([id, items]) => sendAll(id, items)))
  if (failed) process.exitCode = 1
}

async function doSettle() {
  const file = opt('--results')
  if (!file) throw new Error('usage : settle --results <fichier>')
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const results = text.split('\n').filter(Boolean).map((l) => JSON.parse(l))
  if (!results.length) return console.log('· social : aucun résultat à reporter')
  const next = settle(await readLedger(), results)
  await writeFile(LEDGER, JSON.stringify(next, null, 2) + '\n')
  const ko = results.filter((r) => !r.ok)
  for (const r of ko) {
    const n = next.channels[r.channel]?.failed?.[r.id]?.attempts
    console.log(`↻ social/${r.channel} : ${r.id} — échec ${n}, ${n >= MAX_ATTEMPTS ? 'ABANDONNÉ (voir le tableau de bord)' : 'retenté au prochain run'}`)
  }
  console.log(`· social : ${results.length - ko.length} succès, ${ko.length} échec(s) reporté(s) au registre`)
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

// Chaque compte configuré se connecte et lit son propre nom, sans publier.
// `--out fichier` écrit la liste des échecs (Markdown) pour l'issue
// [social-down] ; `problems=N` part dans $GITHUB_OUTPUT.
async function doCheck() {
  const lines = []
  if (!activeChannels().length) console.log('· social : aucun canal configuré')
  const { accounts, tokens } = await checkAccounts(process.env)
  for (const a of accounts) {
    if (a.problem) {
      console.log(`✗ social/${a.channel} : ${a.problem}`)
      lines.push(`- **${a.channel}** : ${a.problem}`)
    } else console.log(`✓ social/${a.channel} : ${a.who}${a.warning ? ` — ⚠ ${a.warning}` : ''}`)
  }
  for (const t of tokens) {
    const label = `${t.secret} (${t.channels.length} comptes)`
    const exp = t.expiresAt ? `expire le ${t.expiresAt.toISOString().slice(0, 10)}` : 'sans échéance'
    if (t.problem) {
      console.log(`✗ clé ${label} : ${t.problem}`)
      lines.push(`- **${t.secret}** : ${t.problem}`)
    } else console.log(`✓ clé ${label} : ${exp}${t.warning ? ` — ⚠ ${t.warning}` : ''}`)
  }
  const out = opt('--out')
  if (out) await writeFile(out, lines.join('\n') + '\n')
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `problems=${lines.length}\n`)
}

const run = { plan: doPlan, post: doPost, settle: doSettle, test: doTest, check: doCheck }[cmd]
if (!run) {
  console.error('usage : social-post.mjs plan|post|settle|test|check …')
  process.exit(2)
}
run().catch((e) => {
  console.error(`✗ social : ${e.message}`)
  process.exit(1)
})
