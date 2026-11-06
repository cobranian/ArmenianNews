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
//   node scripts/social-post.mjs retry --channel instagram-hy --item culture:duduk
//        Remet en file un article ABANDONNÉ (3 échecs) une fois la cause
//        réglée : efface son échec et sa marque « parti ». À pousser (PR).
//        --drop : y renoncer (ou confirmer qu'un envoi INCERTAIN est bien
//        parti) : l'article reste « parti », l'alerte disparaît.
//   node scripts/social-post.mjs mark --channel facebook-ch --item reel:duduk [--at <ISO>]
//        Inscrit au registre un élément envoyé HORS registre (un Reel d'essai de
//        `test`) : sans cela le robot le republierait. À pousser (PR).
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
  reelItems,
  supports,
  plan,
  settle,
  markPosted,
  compose,
  emptyLedger,
  MAX_ATTEMPTS,
  redact,
} from './lib/social.mjs'
import { readReels } from './lib/reels-add.mjs'
import { send, isUncertain } from './lib/social-send.mjs'
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
  const reels = await readReels(path.join(root, 'src/data/reels.json'))
  return [...cultureItems(culture), ...briefItems(briefs), ...announceItems(announces), ...reelItems(culture, reels)]
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
        const uncertain = isUncertain(e)
        console.log(`✗ social/${id} : ${item.id} — ${msg}${uncertain ? ' (INCERTAIN : peut-être publié, pas retenté)' : ''}`)
        await record({ channel: id, id: item.id, ok: false, uncertain, error: msg })
      }
    }
  }
  await Promise.all([...byChannel].map(([id, items]) => sendAll(id, items)))
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `failures=${failed}\n`)
  // Avec --results, un échec est repris par `settle` (retenté ou signalé au
  // tableau de bord) : le job reste vert, sinon chaque hoquet d'Instagram
  // rendrait l'heure rouge. Sans --results (à la main), le code dit l'échec.
  if (failed && !resultsFile) process.exitCode = 1
}

async function doSettle() {
  const file = opt('--results')
  if (!file) throw new Error('usage : settle --results <fichier> [--plan <plan.json>]')
  // Le plan : un envoi prévu sans résultat (run coupé) est noté incertain.
  let planned = []
  if (opt('--plan')) {
    try {
      const p = JSON.parse(await readFile(opt('--plan'), 'utf8'))
      if (!p.dry) planned = p.posts
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
  if (!results.length && !planned.length) return console.log('· social : aucun résultat à reporter')
  const next = settle(await readLedger(), results, new Date(), planned)
  await writeFile(LEDGER, JSON.stringify(next, null, 2) + '\n')
  const ko = results.filter((r) => !r.ok)
  for (const r of ko) {
    const f = next.channels[r.channel]?.failed?.[r.id]
    if (f?.uncertain) console.log(`? social/${r.channel} : ${r.id} — incertain, à vérifier sur le compte (tableau de bord)`)
    else console.log(`↻ social/${r.channel} : ${r.id} — échec ${f?.attempts}, ${f?.attempts >= MAX_ATTEMPTS ? 'ABANDONNÉ (voir le tableau de bord)' : 'retenté au prochain run'}`)
  }
  const lost = planned.filter((p) => !results.some((r) => r.channel === p.channel && r.id === p.item.id))
  for (const p of lost) console.log(`? social/${p.channel} : ${p.item.id} — aucun résultat (run coupé), à vérifier sur le compte`)
  console.log(`· social : ${results.length - ko.length} succès, ${ko.length} échec(s) reporté(s) au registre`)
}

async function doRetry() {
  const channel = opt('--channel')
  const id = opt('--item')
  if (!channel || !id) throw new Error('usage : retry --channel <canal> --item <id>')
  const ledger = await readLedger()
  const entry = ledger.channels?.[channel]
  if (!entry) throw new Error(`canal absent du registre : ${channel}`)
  const drop = args.includes('--drop')
  const had = Boolean(entry.failed?.[id]) || id in entry.posted
  if (entry.failed) delete entry.failed[id]
  if (entry.failed && !Object.keys(entry.failed).length) delete entry.failed
  if (drop) entry.posted[id] = entry.posted[id] ?? `abandonné ${new Date().toISOString()}`
  else delete entry.posted[id]
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
  if (!had) return console.log(`· ${channel} : ${id} n'était pas au registre (rien à faire)`)
  console.log(`· ${channel} : ${id} ${drop ? 'classé (ne repartira pas)' : 'remis en file'} — poussez src/data/social-posted.json`)
}

async function doMark() {
  const channel = opt('--channel')
  const id = opt('--item')
  if (!channel || !id) throw new Error('usage : mark --channel <canal> --item <id> [--at <ISO>]')
  const at = opt('--at') ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(at))) throw new Error(`--at : date ISO attendue, reçu « ${at} »`)
  const next = markPosted(await readLedger(), channel, id, new Date(at).toISOString())
  await writeFile(LEDGER, JSON.stringify(next, null, 2) + '\n')
  console.log(`· ${channel} : ${id} inscrit comme parti — poussez src/data/social-posted.json (PR)`)
}

async function doTest() {
  const id = opt('--channel')
  const channel = CHANNELS.find((c) => c.id === id)
  if (!channel) throw new Error(`--channel attendu parmi : ${CHANNELS.map((c) => c.id).join(', ')}`)
  const items = (await loadItems()).filter((it) => it.lang === channel.lang)
  const wanted = opt('--item')
  const item = wanted ? items.find((it) => it.id === wanted) : items.find((it) => it.kind === 'culture')
  if (!item) throw new Error(`aucun élément ${wanted ?? 'culture'} en ${channel.lang}`)
  if (item.kind === 'reel' && !supports(channel.platform, item)) throw new Error(`${item.id} : un Reel ne part que sur Facebook ou Instagram, pas sur ${channel.platform}`)
  console.log(JSON.stringify(compose(channel.platform, item), null, 2))
  if (!args.includes('--yes')) return console.log('· aperçu seulement — ajoutez --yes pour publier pour de vrai')
  const creds = credentials(channel, process.env)
  if (!creds) throw new Error(`secrets manquants : ${Object.values(channel.env).join(', ')}`)
  try {
    console.log(`✓ publié : ${await send(channel, item, creds)}`)
    if (item.kind === 'reel')
      console.log(`⚠ Reel envoyé HORS registre : sans inscription le robot le republiera.
  node scripts/social-post.mjs mark --channel ${channel.id} --item ${item.id}
  puis poussez src/data/social-posted.json par PR.`)
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

const run = { plan: doPlan, post: doPost, settle: doSettle, retry: doRetry, mark: doMark, test: doTest, check: doCheck }[cmd]
if (!run) {
  console.error('usage : social-post.mjs plan|post|settle|retry|mark|test|check …')
  process.exit(2)
}
run().catch((e) => {
  console.error(`✗ social : ${e.message}`)
  process.exit(1)
})
