// L'envoi vers chaque plateforme. Hôtes FIXES, écrits ici en dur : aucun
// contenu publié ne peut choisir où part une requête authentifiée.
//
// Aucun jeton dans une URL écrite au log : Telegram met le sien dans le
// chemin, d'où l'interdiction d'imprimer `url` dans les erreurs.
import { compose, oauth1Header } from './social.mjs'

// Versions d'API figées. À relever quand une plateforme retire la sienne
// (Graph : ~2 ans de vie par version ; LinkedIn : ~1 an).
export const GRAPH = 'https://graph.facebook.com/v23.0'
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

const SENDERS = {
  async facebook(p, c, f) {
    const { json: r } = await call(f, `${GRAPH}/${c.pageId}/feed`, form({ ...p, access_token: c.token }), 'facebook')
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
        `${GRAPH}/${box.id}?fields=status_code&access_token=${encodeURIComponent(c.token)}`,
        {},
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
    const record = {
      $type: 'app.bsky.feed.post',
      text: p.text,
      createdAt: new Date().toISOString(),
      langs: [p.lang],
      embed: { $type: 'app.bsky.embed.external', external: p.embed },
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

export async function send(channel, item, creds, { fetch: f = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const sender = SENDERS[channel.platform]
  if (!sender) throw new Error(`plateforme inconnue : ${channel.platform}`)
  return sender(compose(channel.platform, item), creds, f, wait)
}
