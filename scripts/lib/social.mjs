// Publication automatique sur les réseaux : la partie PURE (aucun réseau).
// L'envoi est dans social-send.mjs, l'orchestration dans scripts/social-post.mjs.
//
// Trois règles de sécurité tiennent tout le module :
//
// 1. AU PLUS UNE FOIS. Le registre (src/data/social-posted.json) est écrit et
//    poussé AVANT l'envoi. Un run annulé au milieu (concurrency: cancel) perd
//    au pire une publication ; il n'en double jamais une. Sur un compte de
//    marque, un doublon se voit bien plus qu'un oubli.
// 2. JAMAIS D'ARCHIVE. Un canal absent du registre (nouveau, ou registre
//    effacé) est d'abord AMORCÉ : tout ce qui existe déjà y est marqué « vu »,
//    rien n'est publié. Sans cela, brancher un compte publierait d'un coup les
//    treize articles Culture et toutes les brèves.
// 3. AUCUN TEXTE LIBRE. Tout ce qui part vient de fichiers déjà en ligne
//    (titre, description, URL), assemblé par gabarit. Aucun modèle ne rédige
//    un message, et la brève (synthèse automatique non relue) n'est publiée
//    que si SOCIAL_KINDS la demande.
import { SITES, siteOf, briefUrl, cultureUrl, cultureImagePath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { longDate } from './brief-links.mjs'
import { createHmac, randomBytes } from 'node:crypto'

// Un canal = un compte sur une plateforme, pour UNE langue. Les noms sont ceux
// des secrets GitHub : un canal n'est actif que si TOUS ses secrets sont posés.
const ACCOUNTS = {
  facebook: (s) => ({ pageId: `FB_PAGE_ID_${s}`, token: `FB_PAGE_TOKEN_${s}` }),
  // Instagram passe par le jeton de la Page Facebook à laquelle il est lié.
  instagram: (s) => ({ userId: `IG_USER_ID_${s}`, token: `FB_PAGE_TOKEN_${s}` }),
  linkedin: (s) => ({ author: `LINKEDIN_AUTHOR_${s}`, token: `LINKEDIN_TOKEN_${s}` }),
  x: (s) => ({
    apiKey: `X_API_KEY_${s}`,
    apiSecret: `X_API_SECRET_${s}`,
    accessToken: `X_ACCESS_TOKEN_${s}`,
    accessSecret: `X_ACCESS_SECRET_${s}`,
  }),
  bluesky: (s) => ({ handle: `BLUESKY_HANDLE_${s}`, password: `BLUESKY_APP_PASSWORD_${s}` }),
  telegram: (s) => ({ token: `TELEGRAM_BOT_TOKEN_${s}`, chat: `TELEGRAM_CHAT_${s}` }),
}

// La langue de tête de chaque vitrine : fr pour le .ch, en pour le .org.
const SITE_LANG = { ch: 'fr', org: 'en' }

export const CHANNELS = Object.entries(SITE_LANG).flatMap(([siteId, lang]) =>
  Object.entries(ACCOUNTS).map(([platform, names]) => ({
    id: `${platform}-${siteId}`,
    platform,
    siteId,
    lang,
    env: names(siteId.toUpperCase()),
  })),
)

export function secretNames() {
  return [...new Set(CHANNELS.flatMap((c) => Object.values(c.env)))].sort()
}

// Les identifiants d'un canal, ou null s'il en manque un.
export function credentials(channel, env) {
  const out = {}
  for (const [k, name] of Object.entries(channel.env)) {
    const v = env[name]?.trim()
    if (!v) return null
    out[k] = v
  }
  return out
}

export const KINDS = ['culture', 'brief']

export function parseKinds(raw) {
  const kinds = String(raw ?? 'culture')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const bad = kinds.filter((k) => !KINDS.includes(k))
  if (bad.length) throw new Error(`SOCIAL_KINDS inconnu : ${bad.join(', ')} (attendu : ${KINDS.join(', ')})`)
  return kinds
}

// --- Ce qu'on peut publier -------------------------------------------------

const BRIEF_TOPICS = 3

export function briefItems(briefs) {
  const out = []
  for (const lang of Object.values(SITE_LANG))
    for (const b of briefs[lang] ?? [])
      out.push({
        id: `brief:${b.date}`,
        kind: 'brief',
        lang,
        date: b.date,
        url: briefUrl(lang, b.date),
        title: `${BRIEF_STRINGS[lang].title}, ${longDate(lang, b.date)}`,
        description: b.topics
          .slice(0, BRIEF_TOPICS)
          .map((t) => `• ${t.title.trim()}`)
          .join('\n'),
        image: null,
      })
  return out
}

export function cultureItems(articles) {
  const out = []
  for (const a of articles)
    for (const lang of Object.values(SITE_LANG)) {
      const t = a.langs[lang]
      if (!t) continue
      out.push({
        id: `culture:${a.slug}`,
        kind: 'culture',
        lang,
        date: a.date,
        url: cultureUrl(lang, a.slug),
        title: t.title,
        description: t.description,
        image: a.image
          ? {
              url: SITES[siteOf(lang)].host + cultureImagePath(a.slug, 'jpg'),
              width: Number(a.image.width) || 0,
              height: Number(a.image.height) || 0,
              author: a.image.author ?? null,
              license: a.image.license ?? null,
            }
          : null,
      })
    }
  return out
}

// Instagram refuse une image hors de 4:5 à 1,91:1 — et un post sans image.
export function fitsInstagram(image) {
  if (!image?.width || !image?.height) return false
  const r = image.width / image.height
  return r >= 0.8 && r <= 1.91
}

export function supports(platform, item) {
  return platform !== 'instagram' || fitsInstagram(item.image)
}

// --- Le plan ---------------------------------------------------------------

export const MAX_PER_RUN = 2
// Une brève de la veille vaut encore d'être partagée ; au-delà, c'est du passé.
const BRIEF_MAX_AGE_DAYS = 1

function ageDays(date, now) {
  return (Date.parse(now.toISOString().slice(0, 10)) - Date.parse(date)) / 86_400_000
}

export function emptyLedger() {
  return { version: 1, channels: {} }
}

// Rend { ledger, posts, seeded } sans muter le registre reçu.
export function plan({ items, channels, ledger, kinds, now = new Date(), max = MAX_PER_RUN }) {
  const next = structuredClone(ledger ?? emptyLedger())
  next.channels ??= {}
  const stamp = now.toISOString()
  const posts = []
  const seeded = []
  for (const ch of channels) {
    const mine = items.filter((it) => it.lang === ch.lang)
    const entry = next.channels[ch.id]
    if (!entry) {
      // Amorçage : TOUT ce qui existe, tous types confondus — activer la brève
      // plus tard ne doit pas non plus vider l'archive sur ce compte.
      next.channels[ch.id] = {
        seededAt: stamp,
        posted: Object.fromEntries(mine.map((it) => [it.id, 'seed'])),
      }
      seeded.push(ch.id)
      continue
    }
    const fresh = mine
      .filter((it) => !(it.id in entry.posted))
      .filter((it) => kinds.includes(it.kind))
      .filter((it) => supports(ch.platform, it))
      .filter((it) => it.kind !== 'brief' || ageDays(it.date, now) <= BRIEF_MAX_AGE_DAYS)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .slice(0, max)
    for (const it of fresh) {
      entry.posted[it.id] = stamp
      posts.push({ channel: ch.id, item: it })
    }
  }
  return { ledger: next, posts, seeded }
}

// --- Les textes ------------------------------------------------------------

const STRINGS = {
  fr: { read: 'Article complet', bio: 'lien dans la bio', image: 'Image', tags: '#Arménie #CultureArménienne' },
  en: { read: 'Full article', bio: 'link in bio', image: 'Image', tags: '#Armenia #ArmenianCulture' },
}

const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const graphemes = (s) => [...seg.segment(s)].map((x) => x.segment)

export function truncate(text, max) {
  const g = graphemes(text)
  if (g.length <= max) return text
  return g.slice(0, max - 1).join('').trimEnd() + '…'
}

// Le décompte de X : une URL vaut 23, un caractère hors des plages latines,
// arméniennes ou cyrilliques (CJK, emoji) vaut 2.
const X_URL = 23
const X_MAX = 280
function xWeight(text) {
  let n = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)
    const light =
      c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)
    n += light ? 1 : 2
  }
  return n
}

function fitX(text, budget) {
  if (xWeight(text) <= budget) return text
  const g = graphemes(text)
  while (g.length && xWeight(g.join('') + '…') > budget) g.pop()
  return g.join('').trimEnd() + '…'
}

// LinkedIn lit le champ `commentary` en « little text format » : ces
// caractères non échappés tronquent le post ou le font refuser.
export function escapeLittleText(s) {
  return s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`)
}

function credit(item, s) {
  const img = item.image
  if (!img?.author && !img?.license) return null
  return `${s.image} : ${[img.author, img.license].filter(Boolean).join(', ')}`
}

export function compose(platform, item) {
  const s = STRINGS[item.lang]
  if (!s) throw new Error(`pas de gabarit social en ${item.lang}`)
  const head = `${item.title}\n\n${item.description}`
  switch (platform) {
    case 'facebook':
      return { message: head, link: item.url }
    case 'linkedin':
      return {
        commentary: escapeLittleText(truncate(head, 2900)),
        url: item.url,
        title: truncate(item.title, 200),
        description: truncate(item.description, 250),
      }
    case 'x': {
      const budget = X_MAX - X_URL - 2
      const withDesc = `${item.title}\n\n${item.description}`
      const body = xWeight(withDesc) <= budget ? withDesc : fitX(item.title, budget)
      return { text: `${body}\n\n${item.url}` }
    }
    case 'bluesky':
      return {
        text: truncate(head, 300),
        lang: item.lang,
        embed: { uri: item.url, title: truncate(item.title, 300), description: truncate(item.description, 300) },
      }
    case 'telegram':
      return { text: `${head}\n\n${item.url}` }
    case 'instagram': {
      const link = `${s.read} : ${item.url.replace(/^https:\/\//, '')} (${s.bio})`
      const parts = [head, link, credit(item, s), s.tags].filter(Boolean)
      return { imageUrl: item.image.url, caption: truncate(parts.join('\n\n'), 2200) }
    }
    default:
      throw new Error(`plateforme inconnue : ${platform}`)
  }
}

// --- OAuth 1.0a (X) --------------------------------------------------------

const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// `params` : les paramètres de requête ou de formulaire à signer. Un corps JSON
// (l'API v2 de X) n'en fait pas partie.
export function oauth1Header({ method, url, params = {} }, creds, { nonce, timestamp } = {}) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce ?? randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  }
  const all = { ...params, ...oauth }
  const paramStr = Object.keys(all)
    .map((k) => [pct(k), pct(String(all[k]))])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const base = [method.toUpperCase(), pct(url), pct(paramStr)].join('&')
  const key = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`
  const signature = createHmac('sha1', key).update(base).digest('base64')
  const fields = { ...oauth, oauth_signature: signature }
  return (
    'OAuth ' +
    Object.keys(fields)
      .sort()
      .map((k) => `${pct(k)}="${pct(fields[k])}"`)
      .join(', ')
  )
}

// Retire toute valeur secrète d'un message avant de l'écrire au log : une
// API qui renvoie la requête dans son erreur ne doit pas publier le jeton.
export function redact(text, secrets) {
  let out = String(text)
  for (const v of secrets) if (v && v.length >= 6) out = out.split(v).join('***')
  return out
}
