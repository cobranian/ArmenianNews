// L'envoi vers chaque plateforme. Hôtes FIXES, écrits ici en dur : aucun
// contenu publié ne peut choisir où part une requête authentifiée.
//
// Aucun jeton dans une URL écrite au log : Telegram met le sien dans le
// chemin, d'où l'interdiction d'imprimer `url` dans les erreurs.
import { compose, oauth1Header, REEL_BASE } from './social.mjs'
import { SITES } from '../../sites.config.js'

// Versions d'API figées. À relever quand une plateforme retire la sienne
// (Graph : ~2 ans de vie par version ; LinkedIn : ~1 an).
export const GRAPH = 'https://graph.facebook.com/v26.0'
export const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202509'
const X_TWEETS = 'https://api.x.com/2/tweets'
const BSKY = 'https://bsky.social/xrpc'
const TELEGRAM = 'https://api.telegram.org'
export const IG_READY_MS = 90_000
export const IG_POLL_MS = 5_000
export const IG_PUBLISH_TRIES = 4
// Une vidéo se prépare bien plus lentement qu'une image côté Meta
// (transcodage) : 5 min avant de renoncer, au même pas d'interrogation.
export const IG_REEL_READY_MS = 300_000
// Le dépôt d'une vidéo de plusieurs Mo ne tient pas dans les 30 s d'un appel
// ordinaire. 3 min couvrent un Reel de 100 Mo (REEL_MAX_BYTES) à ~5 Mbit/s,
// bien en dessous du débit d'un runner GitHub : au-delà, c'est une panne.
const UPLOAD_MS = 180_000
const REEL_MAX_BYTES = 100 * 1024 * 1024
// Hôte de dépôt des vidéos chez Meta (Facebook et Instagram), versionné comme
// le Graph.
const RUPLOAD = 'https://rupload.facebook.com'
const GRAPH_VERSION = GRAPH.slice(GRAPH.lastIndexOf('/') + 1)

// Les appels qui PUBLIENT. Une erreur y est ambiguë si elle n'est pas un refus
// net (4xx) : un délai dépassé, une coupure, un 5xx peuvent arriver APRÈS que
// la plateforme a publié. Ces échecs-là ne sont jamais retentés (un doublon
// sur un compte de marque se voit plus qu'un oubli) : `uncertain`, à vérifier
// à la main. Partout ailleurs (préparation, session, vignette), rien n'est
// encore parti : l'échec est sûr, le run suivant retente.
// Les dépôts de vidéo (`*-reel/upload`) n'y sont PAS : ils ne publient rien,
// la vidéo attend `finish` (Facebook) ou `media_publish` (Instagram).
const FINAL = new Set(['facebook', 'instagram/publish', 'facebook-reel/finish', 'instagram-reel/publish', 'bluesky', 'telegram', 'linkedin', 'x'])
export function isUncertain(err) {
  if (!err?.final) return false
  return !(err.status >= 400 && err.status < 500)
}

async function call(f, url, init, what, ms = 30_000) {
  let res
  try {
    res = await f(url, { ...init, signal: AbortSignal.timeout(ms) })
  } catch (e) {
    throw Object.assign(new Error(`${what} : ${e.name === 'TimeoutError' ? 'délai dépassé' : e.message}`), { final: FINAL.has(what) })
  }
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.detail ?? json?.message ?? json?.description ?? text.slice(0, 200)
    throw Object.assign(new Error(`${what} : HTTP ${res.status} ${msg}`), { status: res.status, final: FINAL.has(what) })
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

// Le conteneur se prépare côté Meta (téléchargement de l'image, transcodage
// d'une vidéo) ; le publier trop tôt répond « Media ID is not available ».
// Avant le 2 nov. 2026, la boucle s'arrêtait après 30 s et publiait QUAND
// MÊME : quatre posts perdus ce jour-là (duduk ×2, Sayat-Nova, tapis), alors
// que huit comptes publiaient en parallèle et chargeaient Meta. On attend donc
// FINISHED jusqu'à `readyMs`, et sans FINISHED on ne publie pas.
// Compté en essais et non en horloge : les tests injectent `wait`.
async function igReady(id, c, f, wait, { readyMs, what }) {
  for (let polls = 0; ; polls++) {
    const { json: st } = await call(
      f,
      `${GRAPH}/${id}?fields=status_code`,
      { headers: { authorization: `Bearer ${c.token}` } },
      `${what}/status`,
    )
    if (st?.status_code === 'FINISHED') return
    if (st?.status_code === 'ERROR' || st?.status_code === 'EXPIRED') throw new Error(`${what} : conteneur ${st.status_code}`)
    if (polls * IG_POLL_MS >= readyMs) throw new Error(`${what} : conteneur pas prêt après ${readyMs / 1000} s (${st?.status_code ?? 'statut inconnu'})`)
    await wait(IG_POLL_MS)
  }
}

// Même FINISHED, Meta répond parfois « not available » une ou deux secondes
// encore : le conteneur n'est pas publié, on peut réessayer sans risque de
// doublon. Seul un refus NET (4xx) se retente : `call` met le corps de la
// réponse dans le message, donc un 5xx ou une coupure APRÈS la publication
// peut lui aussi dire « not available » — celui-là reste ambigu, jamais
// retenté. Tout autre échec remonte tel quel (`what` est dans FINAL).
async function igPublish(id, c, f, wait, what) {
  for (let i = 1; ; i++) {
    try {
      const { json: r } = await call(f, `${GRAPH}/${c.userId}/media_publish`, form({ creation_id: id, access_token: c.token }), what)
      return r?.id
    } catch (e) {
      if (i >= IG_PUBLISH_TRIES || isUncertain(e) || !/not available|not ready/i.test(e.message)) throw e
      await wait(IG_POLL_MS)
    }
  }
}

// La vidéo d'un Reel ne vient QUE de la release du dépôt (REEL_BASE) : aucun
// contenu publié ne fait télécharger une adresse arbitraire. L'URL est
// normalisée avant le contrôle (un `../` sortirait sinon de la release).
// GitHub redirige vers son CDN (objects/release-assets.githubusercontent.com,
// URL signée) : la redirection est suivie à la main, en https seulement, et
// sans aucune clé — rien d'authentifié ne part vers ces hôtes.
// Un échec ici est toujours sûr : rien n'est encore parti chez Meta.
export async function fetchReel(url, f = fetch) {
  let u
  try {
    u = new URL(url).href
  } catch {
    throw new Error('reel/vidéo : URL invalide')
  }
  if (!u.startsWith(REEL_BASE)) throw new Error(`reel/vidéo : hors de la release, refusée (${new URL(u).host})`)
  let res
  for (let hops = 0; ; hops++) {
    try {
      res = await f(u, { redirect: 'manual', signal: AbortSignal.timeout(UPLOAD_MS) })
    } catch (e) {
      throw new Error(`reel/vidéo : ${e.name === 'TimeoutError' ? 'délai dépassé' : e.message}`)
    }
    if (![301, 302, 303, 307, 308].includes(res.status)) break
    if (hops >= 5) throw new Error('reel/vidéo : trop de redirections')
    const next = new URL(res.headers.get('location') ?? '', u)
    if (next.protocol !== 'https:') throw new Error('reel/vidéo : redirection hors https refusée')
    u = next.href
  }
  if (res.status !== 200) throw new Error(`reel/vidéo : HTTP ${res.status}`)
  const announced = Number(res.headers.get('content-length')) || 0
  if (announced > REEL_MAX_BYTES) throw new Error(`reel/vidéo : fichier trop lourd (${announced} octets)`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > REEL_MAX_BYTES) throw new Error(`reel/vidéo : fichier trop lourd (${buf.length} octets)`)
  if (!buf.length) throw new Error('reel/vidéo : fichier vide')
  return buf
}

// Le dépôt « resumable » de Meta : les octets en un seul envoi (offset 0), la
// clé dans l'en-tête Authorization, jamais dans l'URL. Même protocole pour
// Facebook (video-upload) et Instagram (ig-api-upload).
async function rupload(f, path, id, token, video, what) {
  const { json: r } = await call(
    f,
    `${RUPLOAD}/${path}/${GRAPH_VERSION}/${id}`,
    {
      method: 'POST',
      headers: {
        authorization: `OAuth ${token}`,
        offset: '0',
        file_size: String(video.length),
        'content-type': 'application/octet-stream',
      },
      body: video,
    },
    what,
    UPLOAD_MS,
  )
  if (r?.success === false) throw new Error(`${what} : dépôt refusé`)
}

// Les Reels (Shorts Culture en musique). La vidéo est téléchargée AVANT
// d'ouvrir quoi que ce soit chez Meta : une release injoignable ne laisse
// aucune session orpheline.
const REEL_SENDERS = {
  // Reels Publishing API des Pages : start → dépôt → finish (qui publie).
  async facebook(p, c, f) {
    const video = await fetchReel(p.videoUrl, f)
    const token = await pageToken(c, f)
    const { json: s } = await call(
      f,
      `${GRAPH}/${c.pageId}/video_reels`,
      form({ upload_phase: 'start', access_token: token }),
      'facebook-reel/start',
    )
    if (!s?.video_id) throw new Error('facebook-reel/start : pas de video_id')
    await rupload(f, 'video-upload', s.video_id, token, video, 'facebook-reel/upload')
    const { json: done } = await call(
      f,
      `${GRAPH}/${c.pageId}/video_reels`,
      form({ upload_phase: 'finish', video_id: s.video_id, video_state: 'PUBLISHED', description: p.description, access_token: token }),
      'facebook-reel/finish',
    )
    // Un 200 { success: false } est une réponse que la plateforme A DONNÉE :
    // un refus net, pas un doute (sans `final`, donc jamais `uncertain`).
    if (done?.success === false) throw new Error('facebook-reel/finish : publication refusée (success: false)')
    return s.video_id
  },

  // Content Publishing, media_type=REELS en dépôt « resumable » : conteneur →
  // dépôt → FINISHED → media_publish (qui publie).
  async instagram(p, c, f, wait) {
    const video = await fetchReel(p.videoUrl, f)
    const { json: box } = await call(
      f,
      `${GRAPH}/${c.userId}/media`,
      form({ media_type: 'REELS', upload_type: 'resumable', caption: p.caption, share_to_feed: 'true', access_token: c.token }),
      'instagram-reel/media',
    )
    if (!box?.id) throw new Error('instagram-reel/media : pas d’id de conteneur')
    await rupload(f, 'ig-api-upload', box.id, c.token, video, 'instagram-reel/upload')
    await igReady(box.id, c, f, wait, { readyMs: IG_REEL_READY_MS, what: 'instagram-reel' })
    return igPublish(box.id, c, f, wait, 'instagram-reel/publish')
  },
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
    await igReady(box.id, c, f, wait, { readyMs: IG_READY_MS, what: 'instagram' })
    return igPublish(box.id, c, f, wait, 'instagram/publish')
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
    // STRICT, contrairement à l'envoi : sans clé de Page dérivable, la clé ne
    // peut pas publier, même si elle lit encore le nom de la Page.
    const { json: t } = await call(
      f,
      `${GRAPH}/${c.pageId}?fields=access_token`,
      { headers: { authorization: `Bearer ${c.token}` } },
      'facebook/token',
    )
    const token = t?.access_token
    if (!token) throw new Error('facebook : aucune clé de Page pour cette Page (droits de l’app à réautoriser)')
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

// Ce que lire son nom ne dit PAS : la clé Facebook (une clé utilisateur, qui
// sert aussi Instagram) a-t-elle encore les droits de PUBLIER, et quand
// expire-t-elle ? Une clé qui lit la Page sans `pages_manage_posts` passait
// le contrôle quotidien et échouait au premier article. `debug_token` le dit,
// et une clé utilisateur peut s'inspecter elle-même (le propriétaire est
// développeur de l'app). Rend { expiresAt: Date|null, missing: [droits] }.
export const FB_PUBLISH_SCOPES = ['pages_manage_posts', 'instagram_content_publish']
export async function tokenHealth(token, { fetch: f = fetch } = {}) {
  const q = new URLSearchParams({ input_token: token, access_token: token })
  const { json } = await call(f, `${GRAPH}/debug_token?${q}`, {}, 'facebook/debug_token')
  const d = json?.data ?? {}
  if (d.is_valid === false) throw new Error(`facebook : clé invalide (${d.error?.message ?? 'debug_token'})`)
  const scopes = new Set(d.scopes ?? [])
  // 0 = n'expire jamais (clé de Page dérivée d'une clé longue durée).
  const exp = Number(d.expires_at) || 0
  const dataExp = Number(d.data_access_expires_at) || 0
  const soonest = [exp, dataExp].filter((t) => t > 0).sort((a, b) => a - b)[0]
  return {
    expiresAt: soonest ? new Date(soonest * 1000) : null,
    missing: FB_PUBLISH_SCOPES.filter((s) => !scopes.has(s)),
  }
}

// Le quota de publication Instagram (100 posts par 24 h glissantes et par
// compte, en 2026). Exige `instagram_content_publish` : une lecture qui
// réussit prouve aussi ce droit. Rend { used, total } ou lève.
export async function instagramQuota(c, { fetch: f = fetch } = {}) {
  const { json } = await call(
    f,
    `${GRAPH}/${c.userId}/content_publishing_limit?fields=quota_usage,config`,
    { headers: { authorization: `Bearer ${c.token}` } },
    'instagram/quota',
  )
  const d = json?.data?.[0] ?? {}
  return { used: Number(d.quota_usage) || 0, total: Number(d.config?.quota_total) || null }
}

export async function verify(channel, creds, { fetch: f = fetch } = {}) {
  const v = VERIFIERS[channel.platform]
  if (!v) return null // X : pas de lecture gratuite ; non vérifié
  return (await v(creds, f)) ?? '(compte sans nom)'
}

export async function send(channel, item, creds, { fetch: f = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const sender = (item.kind === 'reel' ? REEL_SENDERS : SENDERS)[channel.platform]
  if (!sender) throw new Error(`plateforme inconnue : ${channel.platform}`)
  return sender(compose(channel.platform, item), creds, f, wait)
}
