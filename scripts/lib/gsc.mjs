// Google Search Console : renvoyer le sitemap d'une vitrine quand il porte des
// pages nouvelles. La partie PURE ; le réseau est dans scripts/gsc-sitemaps.mjs.
//
// Pourquoi ce canal (2 nov. 2026) : Google ne lit pas IndexNow, le « ping » de
// sitemap est mort en 2023, et l'Indexing API est réservée par Google aux
// offres d'emploi et aux diffusions en direct — s'en servir pour des articles
// viole ses règles et fait révoquer la clé. `sitemaps.submit` est le seul
// geste automatique légitime : Google relit le sitemap et décide lui-même. Ce
// n'est qu'une invitation, pas une indexation garantie.
//
// Les deux propriétés sont des propriétés de DOMAINE (sc-domain:), pas de
// préfixe d'URL : l'identifiant de site s'écrit donc « sc-domain:<hôte> », et
// le sitemap s'y désigne par son URL complète.
import { createSign } from 'node:crypto'

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters'
export const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export function siteProperty(host) {
  return `sc-domain:${new URL(host).host}`
}

export function submitUrl(host) {
  const site = encodeURIComponent(siteProperty(host))
  const feed = encodeURIComponent(`${new URL(host).origin}/sitemap.xml`)
  return `https://www.googleapis.com/webmasters/v3/sites/${site}/sitemaps/${feed}`
}

// Lit la clé JSON d'un compte de service (secret GSC_SERVICE_ACCOUNT). Rend
// null si le secret est absent : le pas Google est alors sauté, sans erreur.
export function parseServiceAccount(raw) {
  if (!raw?.trim()) return null
  const sa = JSON.parse(raw)
  if (!sa.client_email || !sa.private_key) throw new Error('clé de compte de service incomplète (client_email, private_key)')
  return sa
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

// L'assertion JWT (RS256) échangée contre un jeton d'accès : sans dépendance,
// node:crypto suffit. Valable une heure.
export function jwtAssertion(sa, now = Math.floor(Date.now() / 1000)) {
  const head = b64url({ alg: 'RS256', typ: 'JWT' })
  const claims = b64url({ iss: sa.client_email, scope: GSC_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key).toString('base64url')
  return `${head}.${claims}.${sig}`
}
