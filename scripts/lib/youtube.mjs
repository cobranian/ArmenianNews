// YouTube : table des chaînes, garde d'identité, et la partie pure de l'envoi
// automatique (plan, règlement, registre). Aucun réseau.
import { RETRY_GAP_MS, MAX_ATTEMPTS } from './social.mjs'
import { entryFromMeta, addVideos } from './videos-add.mjs'

export { MAX_ATTEMPTS }

// Une chaîne de marque par langue, toutes sous le même compte Google.
export const YT_CHANNELS = {
  fr: 'UC6XuuuP2t57coFE6f4uqX9Q',
  en: 'UC6wp4LgAJIZKwCkHwbWEoXQ',
  hy: 'UCkDbtL2BscdI6iLTcjXlpHw',
  ru: 'UC7IB7SETN9YlUHShEbzAw8Q',
  de: 'UCsVZkaQ_qW8t5D3DkZl-n2A',
  it: 'UCU5wfH1iTa0lVKswZiol2eg',
  es: 'UCjvG5iFzxPKX_7u9t7-JCuQ',
}

export const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

export const ytLangs = () => Object.keys(YT_CHANNELS)

// null si la chaîne obtenue est la bonne, sinon le message d'erreur.
export function checkChannel(expected, got) {
  if (expected === got) return null
  return `Mauvaise chaîne : attendue ${expected}, obtenue ${got || '(aucune)'}. Relancez et choisissez la bonne chaîne sur l'écran de consentement.`
}

// --- L'envoi automatique : la partie PURE ----------------------------------
// L'envoi lui-même est dans youtube-send.mjs, l'orchestration dans
// scripts/youtube-post.mjs. Même règle que les réseaux (social.mjs) : AU PLUS
// UNE FOIS. YouTube ne dédoublonne pas, une vidéo en double se voit sur la
// chaîne ; un envoi perdu coûte moins.
//
// Registre src/data/youtube-posted.json : { version: 1, posted, failed }, clé
// « <slug>:<lang> ». `posted` vaut l'horodatage ISO du plan (écrit et poussé
// AVANT l'envoi), puis { at, id } une fois la vidéo en ligne — { at, id,
// private: true } si YouTube l'a verrouillée en privé (projet non audité) :
// elle reste au registre, la renvoyer ferait un doublon.

// Quota : 10 000 unités par jour et par projet, un envoi en coûte 1 600.
export const PER_DAY = 6
export const MAX_UPLOADS_PER_RUN = 2
export const YT_ID = /^[A-Za-z0-9_-]{11}$/

// Le jour de quota est le jour civil du Pacifique (minuit à Los Angeles),
// heure d'été comprise : Intl, pas un décalage fixe.
const dayIn = (timeZone) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  return (d) => f.format(new Date(d))
}
export const ptDay = dayIn('America/Los_Angeles')
// La date de mise en ligne inscrite sur le site : le jour suisse.
export const zurichDay = dayIn('Europe/Zurich')

export const emptyYtLedger = () => ({ version: 1, posted: {}, failed: {} })
export const ytKey = (slug, lang) => `${slug}:${lang}`

// Les langues dont le jeton est posé (et l'application OAuth avec).
export function ytTokens(env) {
  if (!env.YT_CLIENT_ID?.trim() || !env.YT_CLIENT_SECRET?.trim()) return []
  return ytLangs().filter((l) => env[`YT_REFRESH_TOKEN_${l.toUpperCase()}`]?.trim())
}

// Jeton refusé (révoqué, expiré, application changée) : la panne du COMPTE,
// pas de la vidéo — aucun essai compté (comme isAuthFailure des réseaux).
export function isYtAuthFailure(error) {
  return /invalid_grant|invalid_client|unauthorized_client|(jeton|session) : HTTP 401/.test(String(error ?? ''))
}
// Quota du jour épuisé : rien n'est parti, aucun essai compté, et plus aucun
// envoi avant le jour PT suivant.
export function isQuotaFailure(error) {
  return /quotaExceeded|dailyLimitExceeded|uploadLimitExceeded/.test(String(error ?? ''))
}

const ISO = /^\d{4}-\d{2}-\d{2}T/
const atOf = (v) => (typeof v === 'string' ? v : v?.at)
const attemptsOf = (f) => (f && !isYtAuthFailure(f.error) && !isQuotaFailure(f.error) ? (f.attempts ?? 0) : 0)
const langOf = (key) => key.slice(key.lastIndexOf(':') + 1)
function ripe(f, now) {
  if (!f || f.uncertain) return true
  if (isQuotaFailure(f.error) || isYtAuthFailure(f.error)) return ptDay(f.last) !== ptDay(now)
  return !(now - Date.parse(f.last) < RETRY_GAP_MS)
}

// Rend { ledger, uploads } sans muter le registre reçu. FIFO dans la file.
export function planUploads({ queue, ledger, tokens, now = new Date(), perDay = PER_DAY, max = MAX_UPLOADS_PER_RUN, videos = {} }) {
  const next = structuredClone(ledger ?? emptyYtLedger())
  next.posted ??= {}
  next.failed ??= {}
  const today = ptDay(now)
  if (Object.values(next.failed).some((f) => isQuotaFailure(f.error) && ptDay(f.last) === today)) return { ledger: next, uploads: [] }
  // Tout envoi tenté ce jour PT a consommé du quota : plan en cours, en
  // ligne, privé ou incertain. « abandonné … » n'est pas un horodatage.
  const done = Object.values(next.posted).filter((v) => ISO.test(atOf(v) ?? '') && ptDay(atOf(v)) === today).length
  const room = Math.max(0, Math.min(perDay - done, max))
  // Jeton refusé : la langue est mise de côté pour le reste du jour PT, et
  // le lendemain un SEUL de ses envois la reteste. Sans cela, deux envois
  // d'une chaîne au jeton mort (0 essai compté) prenaient les deux places de
  // chaque run, et les autres langues attendaient pour toujours.
  const authFailed = Object.entries(next.failed).filter(([, f]) => isYtAuthFailure(f.error))
  const blocked = new Set(authFailed.filter(([, f]) => ptDay(f.last) === today).map(([k]) => langOf(k)))
  const probe = new Set(authFailed.map(([k]) => langOf(k)).filter((l) => !blocked.has(l)))
  const have = new Set(tokens)
  const stamp = now.toISOString()
  const uploads = []
  for (const it of queue?.items ?? []) {
    if (uploads.length >= room) break
    const k = ytKey(it.slug, it.lang)
    if (k in next.posted || videos?.[it.slug]?.[it.lang] || !have.has(it.lang) || blocked.has(it.lang)) continue
    const f = next.failed[k]
    if (attemptsOf(f) >= MAX_ATTEMPTS || !ripe(f, now)) continue
    if (probe.has(it.lang)) blocked.add(it.lang)
    next.posted[k] = stamp
    uploads.push(it)
  }
  return { ledger: next, uploads }
}

// `results` : [{ key, ok, id?, private?, uncertain?, error? }] ; `planned` :
// les envois du plan ([{ slug, lang }]) — un envoi prévu sans résultat (run
// coupé) est incertain. Rend un NOUVEAU registre.
export function settleUploads(ledger, results, now = new Date(), planned = []) {
  const next = structuredClone(ledger ?? emptyYtLedger())
  next.posted ??= {}
  next.failed ??= {}
  const seen = new Set(results.map((r) => r.key))
  const missing = planned
    .map((p) => ytKey(p.slug, p.lang))
    .filter((k) => !seen.has(k) && k in next.posted)
    .map((key) => ({ key, ok: false, uncertain: true, error: 'aucun résultat : run interrompu pendant l’envoi' }))
  const last = now.toISOString()
  for (const r of [...results, ...missing]) {
    const at = atOf(next.posted[r.key])
    const stamp = ISO.test(at ?? '') ? at : last
    if (r.ok) {
      next.posted[r.key] = { at: stamp, id: r.id, ...(r.private ? { private: true } : {}) }
      delete next.failed[r.key]
      continue
    }
    const error = String(r.error ?? '').slice(0, 300)
    if (r.uncertain) {
      // Envoyée mais statut illisible : l'id est gardé, pour vérifier.
      if (r.id) next.posted[r.key] = { at: stamp, id: r.id }
      next.failed[r.key] = { uncertain: true, last, error, ...(r.id ? { id: r.id } : {}) }
      continue
    }
    delete next.posted[r.key]
    const attempts = isYtAuthFailure(error) || isQuotaFailure(error) ? 0 : attemptsOf(next.failed[r.key]) + 1
    next.failed[r.key] = { attempts, last, error }
  }
  return next
}

// Les vidéos PUBLIQUES entrent dans culture-videos.json (la trace de ce qui
// est en ligne) et sortent de la file. Une vidéo privée ou incertaine reste en
// file : le registre l'empêche de repartir, et son texte sert à `mark`.
// Rend { queue, videos, added, warnings } sans muter les entrées.
export function applyUploads({ queue, videos, results, today }) {
  let out = structuredClone(videos ?? {})
  const items = structuredClone(queue.items)
  const added = []
  const warnings = []
  for (const r of results.filter((x) => x.ok && !x.private)) {
    const i = items.findIndex((x) => ytKey(x.slug, x.lang) === r.key)
    const meta = i >= 0 ? items[i] : r
    const { slug, lang } = meta
    const had = out[slug]?.[lang]
    if (had && had.youtube !== r.id) warnings.push(`${slug}/${lang} : culture-videos.json a déjà ${had.youtube}, ${r.id} non inscrit`)
    else {
      const res = addVideos(out, [{ slug, lang, entry: entryFromMeta(meta, { youtube: r.id, uploadDate: today }) }])
      out = res.videos
      added.push(...res.added)
    }
    if (i >= 0) items.splice(i, 1)
  }
  return { queue: { ...queue, items }, videos: out, added, warnings }
}

// En doute : un envoi incertain (avec ou sans id) ou une vidéo restée privée.
// Elle existe peut-être déjà sur YouTube : on ne la renvoie pas, on la
// confirme (`mark`) ou on y renonce (`retry --drop`).
const inDoubt = (v, f) => Boolean(f?.uncertain || (v && typeof v === 'object' && v.private))
const online = (v, f) => Boolean(v && typeof v === 'object' && v.id && !inDoubt(v, f))

// Une vidéo envoyée à la main (Chrome), ou un envoi en doute vérifié sur la
// chaîne. Refuse un id mal formé, un élément déjà en ligne, et un id autre que
// celui déjà inscrit pour un envoi en doute.
export function markUpload(ledger, key, id, now = new Date()) {
  if (!YT_ID.test(id ?? '')) throw new Error(`identifiant YouTube invalide : « ${id} » (11 caractères attendus)`)
  const next = structuredClone(ledger ?? emptyYtLedger())
  next.posted ??= {}
  next.failed ??= {}
  const v = next.posted[key]
  const f = next.failed[key]
  if (online(v, f)) throw new Error(`${key} est déjà en ligne (${v.id})`)
  const recorded = (v && typeof v === 'object' ? v.id : null) ?? f?.id
  if (inDoubt(v, f) && recorded && recorded !== id) throw new Error(`${key} : le registre a déjà la vidéo ${recorded}, pas ${id} — vérifiez sur la chaîne`)
  next.posted[key] = { at: now.toISOString(), id }
  delete next.failed[key]
  return next
}

// Remet en file un envoi abandonné (ou y renonce, `drop`). Une vidéo en ligne
// ou en doute (incertaine, privée) ne se renvoie pas : elle existe peut-être
// déjà, ce serait un doublon — `mark` la confirme, `--drop` y renonce.
export function retryUpload(ledger, key, { drop = false, now = new Date() } = {}) {
  const next = structuredClone(ledger ?? emptyYtLedger())
  next.posted ??= {}
  next.failed ??= {}
  const v = next.posted[key]
  const f = next.failed[key]
  if (!drop && online(v, f)) throw new Error(`${key} est en ligne (${v.id}) : le renvoyer ferait un doublon`)
  if (!drop && inDoubt(v, f)) throw new Error(`${key} est peut-être déjà sur YouTube (${f?.uncertain ? 'envoi incertain' : 'vidéo privée'}) : confirmez-la par mark, ou renoncez par retry --drop`)
  delete next.failed[key]
  if (drop) next.posted[key] ??= `abandonné ${now.toISOString()}`
  else delete next.posted[key]
  return next
}
