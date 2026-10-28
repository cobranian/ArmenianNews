// L'envoi vers chaque plateforme. Hôtes FIXES, écrits ici en dur : aucun
// contenu publié ne peut choisir où part une requête authentifiée.
//
// Aucun jeton dans une URL écrite au log : Telegram met le sien dans le
// chemin, d'où l'interdiction d'imprimer `url` dans les erreurs.
import { compose, oauth1Header } from './social.mjs'
import { SITES } from '../../sites.config.js'

// Versions d'API figées. À relever quand une plateforme retire la sienne
// (Graph : ~2 ans de vie par version ; LinkedIn : ~1 an).
export const GRAPH = 'https://graph.facebook.com/v26.0'
export const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202509'
const X_TWEETS = 'https://api.x.com/2/tweets'
const BSKY = 'https://bsky.social/xrpc'
const TELEGRAM = 'https://api.telegram.org'

async function call(f, url, init, what) {
  const res = await f(url, { ...init, signal: AbortSignal.timeout(30_000) })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.detail ?? json?.message ?? json?.description ?? text.slice(0, 200)
    throw new Error(`${what} : HTTP ${res.status} ${msg}`)
  }
  return { res, json }
}

const form = (o) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(o).toString(),
})
const json = (o, headers = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(o),
})

// FB_PAGE_TOKEN_* peut contenir la clé de la Page OU une clé UTILISATEUR
// longue durée (c'est elle que l'Explorateur et le débogueur mettent sous les
// yeux, et la confusion a été commise à la mise en place). Publier sur une
// Page exige une clé de Page : on la dérive à chaque envoi. Une clé de Page
// reçue telle quelle se redemande elle-même ; en cas d'échec, on la garde.
async function pageToken(c, f) {
  try {
    const { json } = await call(
      f,
      `${GRAPH}/${c.pageId}?fields=access_token`,
      { headers: { authorization: `Bearer ${c.token}` } },
      'facebook/token',
    )
    return json?.access_token || c.token
  } catch {
    return c.token
  }
}

// La vignette d'une carte de lien Bluesky est un blob déposé AVANT le post.
// Bluesky refuse un blob de plus de ~1 Mo : l'image est réduite à 1200 px de
// large en JPEG. Elle ne vient que des deux vitrines — aucun contenu publié
// ne fait télécharger une adresse arbitraire. Un échec n'empêche jamais le
// post : il part sans vignette, comme avant, avec un avertissement au log.
const THUMB_HOSTS = new Set(Object.values(SITES).map((s) => new URL(s.host).host))
export async function blueskyThumb(url, jwt, f) {
  if (!url) return null
  try {
    if (!THUMB_HOSTS.has(new URL(url).host)) throw new Error(`hôte refusé : ${new URL(url).host}`)
    const res = await f(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Import différé : sans `sharp` installé, seule la vignette manque — le
    // plan et les autres réseaux tournent. Un import en tête de fichier a
    // fait planter tous les envois (28 oct. 2026, workflows sans npm ci).
    const { default: sharp } = await import('sharp')
    const img = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    const { json: r } = await call(
      f,
      `${BSKY}/com.atproto.repo.uploadBlob`,
      { method: 'POST', headers: { 'content-type': 'image/jpeg', authorization: `Bearer ${jwt}` }, body: img },
      'bluesky/vignette',
    )
    return r?.blob ?? null
  } catch (e) {
    console.log(`⚠ bluesky : vignette omise (${e.message})`)
    return null
  }
}

const SENDERS = {
  async facebook(p, c, f) {
    const token = await pageToken(c, f)
    const { json: r } = await call(f, `${GRAPH}/${c.pageId}/feed`, form({ ...p, access_token: token }), 'facebook')
    return r?.id
  },

  async instagram(p, c, f, wait) {
    const { json: box } = await call(
      f,
      `${GRAPH}/${c.userId}/media`,
      form({ image_url: p.imageUrl, caption: p.caption, access_token: c.token }),
      'instagram/media',
    )
    // Le conteneur se prépare côté Meta (téléchargement de l'image) ; le
    // publier trop tôt répond « media not ready ».
    for (let i = 0; i < 10; i++) {
      const { json: st } = await call(
        f,
        `${GRAPH}/${box.id}?fields=status_code`,
        { headers: { authorization: `Bearer ${c.token}` } },
        'instagram/status',
      )
      if (st?.status_code === 'FINISHED') break
      if (st?.status_code === 'ERROR' || st?.status_code === 'EXPIRED')
        throw new Error(`instagram : conteneur ${st.status_code}`)
      await wait(3000)
    }
    const { json: r } = await call(
      f,
      `${GRAPH}/${c.userId}/media_publish`,
      form({ creation_id: box.id, access_token: c.token }),
      'instagram/publish',
    )
    return r?.id
  },

  async linkedin(p, c, f) {
    const body = {
      author: c.author, // urn:li:organization:123 ou urn:li:person:abc
      commentary: p.commentary,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: p.url, title: p.title, description: p.description } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }
    const { res } = await call(
      f,
      'https://api.linkedin.com/rest/posts',
      json(body, {
        authorization: `Bearer ${c.token}`,
        'linkedin-version': LINKEDIN_VERSION,
        'x-restli-protocol-version': '2.0.0',
      }),
      'linkedin',
    )
    return res.headers.get('x-restli-id')
  },

  async x(p, c, f) {
    const auth = oauth1Header({ method: 'POST', url: X_TWEETS }, c)
    const { json: r } = await call(f, X_TWEETS, json({ text: p.text }, { authorization: auth }), 'x')
    return r?.data?.id
  },

  async bluesky(p, c, f) {
    const { json: s } = await call(
      f,
      `${BSKY}/com.atproto.server.createSession`,
      json({ identifier: c.handle, password: c.password }),
      'bluesky/session',
    )
    const thumb = await blueskyThumb(p.thumbUrl, s.accessJwt, f)
    const record = {
      $type: 'app.bsky.feed.post',
      text: p.text,
      createdAt: new Date().toISOString(),
      langs: [p.lang],
      embed: { $type: 'app.bsky.embed.external', external: thumb ? { ...p.embed, thumb } : p.embed },
    }
    const { json: r } = await call(
      f,
      `${BSKY}/com.atproto.repo.createRecord`,
      json({ repo: s.did, collection: 'app.bsky.feed.post', record }, { authorization: `Bearer ${s.accessJwt}` }),
      'bluesky',
    )
    return r?.uri
  },

  async telegram(p, c, f) {
    // Sans parse_mode : le texte part tel quel, aucun balisage interprété.
    const { json: r } = await call(f, `${TELEGRAM}/bot${c.token}/sendMessage`, json({ chat_id: c.chat, text: p.text }), 'telegram')
    return r?.result?.message_id
  },
}

// Vérifier un compte SANS rien publier : une lecture qui exige les mêmes
// droits que l'envoi. Une clé morte ne se voit sinon qu'au prochain article
// — parfois des jours plus tard, et le registre l'aura déjà marqué « parti »
// (FB_PAGE_TOKEN invalidé sans prévenir le 26 oct. 2026). Renvoie le nom du
// compte vu par la plateforme, ou lève avec la raison.
const VERIFIERS = {
  async facebook(c, f) {
    const token = await pageToken(c, f)
    const { json: r } = await call(f, `${GRAPH}/${c.pageId}?fields=name`, { headers: { authorization: `Bearer ${token}` } }, 'facebook')
    return r?.name
  },
  async instagram(c, f) {
    const { json: r } = await call(f, `${GRAPH}/${c.userId}?fields=username`, { headers: { authorization: `Bearer ${c.token}` } }, 'instagram')
    return r?.username && `@${r.username}`
  },
  async bluesky(c, f) {
    const { json: s } = await call(f, `${BSKY}/com.atproto.server.createSession`, json({ identifier: c.handle, password: c.password }), 'bluesky')
    return s?.handle && `@${s.handle}`
  },
  async telegram(c, f) {
    // getChat échoue si la clé est morte OU si le bot a perdu l'accès au canal.
    const { json: r } = await call(f, `${TELEGRAM}/bot${c.token}/getChat`, json({ chat_id: c.chat }), 'telegram')
    return r?.result?.title
  },
  async linkedin(c, f) {
    const { json: r } = await call(f, 'https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${c.token}` } }, 'linkedin')
    return r?.name
  },
}

export async function verify(channel, creds, { fetch: f = fetch } = {}) {
  const v = VERIFIERS[channel.platform]
  if (!v) return null // X : pas de lecture gratuite ; non vérifié
  return (await v(creds, f)) ?? '(compte sans nom)'
}

export async function send(channel, item, creds, { fetch: f = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const sender = SENDERS[channel.platform]
  if (!sender) throw new Error(`plateforme inconnue : ${channel.platform}`)
  return sender(compose(channel.platform, item), creds, f, wait)
}
