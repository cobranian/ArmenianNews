// L'envoi d'un Short sur YouTube (Data API v3, envoi « resumable » en un seul
// morceau). Hôtes FIXES, écrits ici en dur ; aucun jeton dans une URL.
//
// Quatre étapes, et le classement d'un échec dépend de l'étape :
//   jeton   — oauth2.googleapis.com/token, depuis le jeton de rafraîchissement
//             de la chaîne. Rien n'est parti : échec SÛR.
//   session — POST des métadonnées, YouTube rend l'adresse de dépôt. Une
//             session sans octets ne publie rien : échec SÛR, quel qu'il soit.
//   envoi   — PUT des octets. C'est LUI qui crée la vidéo : un refus net (4xx)
//             est sûr, mais un délai, une coupure ou un 5xx peuvent survenir
//             APRÈS sa création — échec INCERTAIN, jamais retenté.
//   statut  — videos.list : la vidéo existe, son id est connu. Un échec ici
//             est incertain (id gardé, à vérifier sur la chaîne).
import { fetchReel } from './social-send.mjs'
import { REEL_BASE } from './social.mjs'

const TOKEN = 'https://oauth2.googleapis.com/token'
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos'
const API = 'https://www.googleapis.com/youtube/v3/videos'
const CALL_MS = 30_000
// Un Short de 44 s pèse quelques Mo ; 3 min, c'est une panne.
const UPLOAD_MS = 180_000

class UploadError extends Error {
  constructor(message, { stage, status, videoId } = {}) {
    super(message)
    Object.assign(this, { stage, status, videoId })
  }
}

export function isUploadUncertain(err) {
  if (err?.stage === 'statut') return true
  if (err?.stage !== 'envoi') return false
  return !(err.status >= 400 && err.status < 500)
}

// Le message d'erreur de Google : `error` est une chaîne (OAuth) ou un objet
// ({ message, errors: [{ reason }] }) ; la raison (quotaExceeded…) est gardée
// en tête, c'est elle que lisent isQuotaFailure et le tableau de bord.
function googleError(text) {
  let j = null
  try {
    j = JSON.parse(text)
  } catch {
    return text.slice(0, 200)
  }
  if (typeof j?.error === 'string') return [j.error, j.error_description].filter(Boolean).join(' — ')
  const reason = j?.error?.errors?.[0]?.reason
  return [reason, j?.error?.message].filter(Boolean).join(' — ') || text.slice(0, 200)
}

async function call(f, url, init, stage, ms = CALL_MS, videoId) {
  let res
  try {
    res = await f(url, { ...init, signal: AbortSignal.timeout(ms) })
  } catch (e) {
    throw new UploadError(`${stage} : ${e.name === 'TimeoutError' ? 'délai dépassé' : e.message}`, { stage, videoId })
  }
  if (!res.ok) throw new UploadError(`${stage} : HTTP ${res.status} ${googleError(await res.text())}`, { stage, status: res.status, videoId })
  return res
}

async function accessToken(f, { clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
  const res = await call(f, TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() }, 'jeton')
  const token = (await res.json())?.access_token
  if (!token) throw new UploadError('jeton : réponse sans access_token', { stage: 'jeton' })
  return token
}

// `item` : une entrée de la file ({ slug, lang, asset, title, description }).
// Rend { id, privacyStatus }.
export async function uploadShort(item, creds, { fetch: f = fetch, download = fetchReel } = {}) {
  // La vidéo d'abord : une release injoignable n'ouvre aucune session.
  let video
  try {
    video = await download(REEL_BASE + item.asset)
  } catch (e) {
    throw new UploadError(e.message, { stage: 'vidéo' })
  }
  const token = await accessToken(f, creds)
  const auth = { authorization: `Bearer ${token}` }
  const meta = {
    snippet: { title: item.title, description: item.description, defaultLanguage: item.lang, defaultAudioLanguage: item.lang, categoryId: '27' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  }
  const init = await call(
    f,
    `${UPLOAD}?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        ...auth,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': 'video/mp4',
        'x-upload-content-length': String(video.length),
      },
      body: JSON.stringify(meta),
    },
    'session',
  )
  // L'adresse de dépôt porte la session : elle ne sort pas de googleapis.com.
  const session = init.headers.get('location') ?? ''
  if (!session.startsWith(`${UPLOAD}?`)) throw new UploadError('session : adresse de dépôt inattendue', { stage: 'session' })
  const put = await call(
    f,
    session,
    { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(video.length) }, body: video },
    'envoi',
    UPLOAD_MS,
  )
  let id = null
  try {
    id = (await put.json())?.id
  } catch {
    id = null
  }
  if (!id) throw new UploadError('envoi : réponse sans identifiant de vidéo', { stage: 'envoi' })
  const st = await call(f, `${API}?part=status&id=${encodeURIComponent(id)}`, { headers: auth }, 'statut', CALL_MS, id)
  const privacyStatus = (await st.json().catch(() => null))?.items?.[0]?.status?.privacyStatus
  if (!privacyStatus) throw new UploadError('statut : vidéo introuvable', { stage: 'statut', videoId: id })
  return { id, privacyStatus }
}
