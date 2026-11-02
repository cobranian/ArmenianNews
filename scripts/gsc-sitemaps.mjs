// Prévenir Google des pages nouvelles : renvoyer à la Search Console le
// sitemap de chaque vitrine dont le sitemap a changé depuis la version en
// ligne (même écart qu'IndexNow, scripts/lib/indexnow.mjs).
//
//   node scripts/gsc-sitemaps.mjs --since <dossier>   après le déploiement
//   node scripts/gsc-sitemaps.mjs --all               les deux, sans condition
//
// Secret GSC_SERVICE_ACCOUNT (clé JSON d'un compte de service ajouté comme
// utilisateur « Total » des deux propriétés Search Console ; procédure :
// docs/google-search-console.md). Absent : le pas est sauté, sans erreur.
// Ne fait JAMAIS échouer le job ; le signe d'une panne est « ✗ gsc » au log,
// et le tableau de bord de la publication le reprend.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SITES } from '../sites.config.js'
import { parseSitemap, urlsToSubmit } from './lib/indexnow.mjs'
import { parseServiceAccount, jwtAssertion, submitUrl, siteProperty, TOKEN_URL } from './lib/gsc.mjs'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }

async function token(sa) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwtAssertion(sa) }),
    signal: AbortSignal.timeout(30_000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) throw new Error(`jeton refusé : HTTP ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim())
  return body.access_token
}

async function main() {
  const sa = parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT)
  if (!sa) return console.log('· gsc : GSC_SERVICE_ACCOUNT absent — Google non prévenu (IndexNow couvre Bing, Yandex, Yahoo)')
  const since = opt('--since')
  if (!since && !args.includes('--all')) throw new Error('usage : --since <dir> | --all')

  const due = []
  for (const [id, site] of Object.entries(SITES)) {
    if (!since) { due.push([id, site]); continue }
    const after = parseSitemap(await readFile(join('dist', id, 'sitemap.xml'), 'utf8'))
    const before = parseSitemap(await readFile(join(since, `${id}.xml`), 'utf8').catch(() => ''))
    const urls = urlsToSubmit(before, after)
    if (urls.length) due.push([id, site])
    else console.log(`· gsc/${id} : rien de nouveau`)
  }
  if (!due.length) return

  const access = await token(sa)
  for (const [id, site] of due) {
    try {
      const res = await fetch(submitUrl(site.host), {
        method: 'PUT',
        headers: { authorization: `Bearer ${access}` },
        signal: AbortSignal.timeout(30_000),
      })
      if (res.ok) console.log(`✓ gsc/${id} : sitemap renvoyé à ${siteProperty(site.host)} (HTTP ${res.status})`)
      else console.log(`✗ gsc/${id} : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    } catch (e) {
      console.log(`✗ gsc/${id} : ${e.message}`)
    }
  }
}

main().catch((e) => console.log(`✗ gsc : ${e.message}`))
