/**
 * Consentement OAuth d'UNE chaîne YouTube, en local, une seule fois.
 *   node scripts/youtube-auth.mjs --lang hy [--set]
 * Lit YT_CLIENT_ID / YT_CLIENT_SECRET (environnement ou .env). Refuse si la
 * chaîne choisie sur l'écran de consentement n'est pas celle de la langue.
 * Le jeton n'est écrit sur aucun disque : avec --set il part dans
 * `gh secret set` par stdin, sans --set il est affiché une fois.
 */
import http from 'node:http'
import crypto from 'node:crypto'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { YT_CHANNELS, YT_SCOPES, ytLangs, checkChannel, consentOutcome } from './lib/youtube.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // pas de .env : l'environnement suffit
}

const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const lang = args[args.indexOf('--lang') + 1]
const setSecret = args.includes('--set')
if (!args.includes('--lang') || !ytLangs().includes(lang)) {
  fail(`Usage : node scripts/youtube-auth.mjs --lang <${ytLangs().join('|')}> [--set]`)
}
const { YT_CLIENT_ID: clientId, YT_CLIENT_SECRET: clientSecret } = process.env
if (!clientId || !clientSecret) fail('YT_CLIENT_ID et YT_CLIENT_SECRET sont requis (environnement ou .env).')

const state = crypto.randomBytes(16).toString('hex')

const server = http.createServer()
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const redirectUri = `http://127.0.0.1:${server.address().port}`

const consentUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: YT_SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
  state,
})

const code = new Promise((resolve, reject) => {
  server.on('request', (req, res) => {
    const u = new URL(req.url, redirectUri)
    if (u.pathname !== '/') {
      res.writeHead(404).end()
      return
    }
    // Une requête sans le bon state (onglet rouvert, sonde) ne doit pas
    // abandonner le consentement en cours : 400, et on attend encore.
    const out = consentOutcome(u.searchParams, state)
    res.writeHead(out?.code ? 200 : 400, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(out?.code ? 'Consentement reçu. Vous pouvez fermer cet onglet.' : 'Retour invalide.')
    if (out?.code) resolve(out.code)
    else if (out?.error) reject(new Error(out.error))
  })
})

console.log(`Chaîne visée : ${lang} (${YT_CHANNELS[lang]})`)
console.log('Ouvrez cette adresse si le navigateur ne s\'ouvre pas :\n' + consentUrl + '\n')
// Un échec de lancement (pas de `cmd`, hors Windows) arrive en événement
// asynchrone : sans écouteur il tuerait le processus. L'adresse est affichée.
try {
  const opener = spawn('cmd', ['/c', 'start', '', consentUrl.replace(/&/g, '^&')], { stdio: 'ignore', detached: true })
  opener.on('error', () => console.log('(navigateur non ouvert : ouvrez l\'adresse ci-dessus)'))
  opener.unref()
} catch {
  // l'adresse est affichée ci-dessus
}

let authCode
try {
  authCode = await code
} catch (e) {
  fail(`Consentement refusé : ${e.message}`)
} finally {
  server.close()
}

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }),
})
const tokens = await tokenRes.json()
if (!tokenRes.ok || !tokens.access_token) fail(`Échange du code refusé : ${tokens.error_description || tokens.error || tokenRes.status}`)
if (!tokens.refresh_token) fail('Aucun refresh_token reçu (révoquez l\'accès du compte puis recommencez).')

const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
  headers: { authorization: `Bearer ${tokens.access_token}` },
})
const ch = await chRes.json()
if (!chRes.ok) fail(`channels.list refusé : ${ch.error?.message || chRes.status}`)
const got = ch.items?.[0]?.id
const bad = checkChannel(YT_CHANNELS[lang], got)
if (bad) fail(bad)
console.log(`✓ Chaîne confirmée : ${ch.items[0].snippet.title} (${got})`)

const secretName = `YT_REFRESH_TOKEN_${lang.toUpperCase()}`
if (setSecret) {
  const r = spawnSync('gh', ['secret', 'set', secretName], { input: tokens.refresh_token, stdio: ['pipe', 'inherit', 'inherit'] })
  if (r.status !== 0) fail(`gh secret set ${secretName} a échoué.`)
  console.log(`✓ Secret ${secretName} enregistré.`)
} else {
  console.log(`\nJeton (affiché une seule fois, non conservé) :\n${tokens.refresh_token}\n`)
  console.log(`Pour l'enregistrer : ! gh secret set ${secretName}   (collez le jeton à l'invite)`)
  console.log(`Ou relancez avec --set pour l'envoyer directement.`)
}
