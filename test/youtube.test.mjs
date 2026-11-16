// L'envoi automatique des Shorts sur YouTube (scripts/youtube-post.mjs).
// L'invariant qui tient tout : une vidéo part AU PLUS UNE FOIS. YouTube ne
// dédoublonne pas — un doublon partirait tel quel sur la chaîne, et un
// envoi raté coûte moins qu'une vidéo en double. D'où : le registre
// (src/data/youtube-posted.json) marque l'envoi AVANT qu'il parte, un échec
// sûr (refus net) en sort et repart (3 essais), un échec ambigu (délai, 5xx
// pendant l'envoi des octets) y reste, noté `uncertain`. Aucun appel réseau
// ici : `fetch` est injecté.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  planUploads,
  settleUploads,
  applyUploads,
  markUpload,
  retryUpload,
  emptyYtLedger,
  ptDay,
  zurichDay,
  ytTokens,
  isYtAuthFailure,
  isQuotaFailure,
  MAX_UPLOADS_PER_RUN,
} from '../scripts/lib/youtube.mjs'
import { uploadShort, isUploadUncertain } from '../scripts/lib/youtube-send.mjs'
import { REEL_BASE } from '../scripts/lib/social.mjs'

const NOW = new Date('2026-11-16T20:00:00Z') // 12:00 à Los Angeles
const item = (slug, lang) => ({ slug, lang, asset: `${lang}-${slug}.mp4`, title: `Titre ${slug} ${lang} #Arménie`, description: `Chapeau ${slug}.\n\nL'article complet : https://x`, addedAt: '2026-11-15T00:00:00.000Z' })
const queueOf = (...items) => ({ version: 1, items })
const ALL = ['fr', 'en', 'hy', 'ru', 'de', 'it', 'es']
const keys = (r) => r.uploads.map((u) => `${u.slug}:${u.lang}`)

// --- Le plan -------------------------------------------------------------

test('ptDay suit l’heure d’été de Los Angeles, pas un décalage fixe', () => {
  assert.equal(ptDay('2026-11-16T07:59:00Z'), '2026-11-15') // PST, UTC−8
  assert.equal(ptDay('2026-11-16T08:00:00Z'), '2026-11-16')
  assert.equal(ptDay('2026-07-16T06:59:00Z'), '2026-07-15') // PDT, UTC−7
  assert.equal(ptDay('2026-07-16T07:00:00Z'), '2026-07-16')
  assert.equal(zurichDay('2026-11-16T23:30:00Z'), '2026-11-17')
})

test('planUploads : 8 en file, rien aujourd’hui → 6 ; 4 déjà envoyés ce jour PT → 2', () => {
  const queue = queueOf(...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => item(s, 'fr')))
  const r = planUploads({ queue, ledger: emptyYtLedger(), tokens: ALL, now: NOW, max: 10 })
  assert.deepEqual(keys(r), ['a:fr', 'b:fr', 'c:fr', 'd:fr', 'e:fr', 'f:fr'])

  const ledger = emptyYtLedger()
  // Quatre envois ce jour PT, dont un à 00:30 heure de Los Angeles (08:30Z),
  // un plan en cours (horodatage nu) et une vidéo restée privée.
  ledger.posted['w:fr'] = { at: '2026-11-16T08:30:00.000Z', id: 'aaaaaaaaaaa' }
  ledger.posted['x:fr'] = '2026-11-16T10:00:00.000Z'
  ledger.posted['y:fr'] = { at: '2026-11-16T11:00:00.000Z', id: 'bbbbbbbbbbb', private: true }
  ledger.posted['z:fr'] = { at: '2026-11-16T12:00:00.000Z', id: 'ccccccccccc' }
  // La veille PT (le 16 à 07:00Z = le 15 à 23:00 PT) : ne compte pas.
  ledger.posted['v:fr'] = { at: '2026-11-16T07:00:00.000Z', id: 'ddddddddddd' }
  ledger.posted['u:fr'] = 'abandonné 2026-11-16T12:00:00.000Z'
  const r2 = planUploads({ queue, ledger, tokens: ALL, now: NOW, max: 10 })
  assert.deepEqual(keys(r2), ['a:fr', 'b:fr'])
})

test('planUploads : au plus MAX_UPLOADS_PER_RUN par run, FIFO', () => {
  assert.equal(MAX_UPLOADS_PER_RUN, 2)
  const queue = queueOf(item('a', 'fr'), item('b', 'en'), item('c', 'hy'))
  assert.deepEqual(keys(planUploads({ queue, ledger: emptyYtLedger(), tokens: ALL, now: NOW })), ['a:fr', 'b:en'])
})

test('planUploads : une langue sans jeton est sautée, la suivante servie', () => {
  const queue = queueOf(item('a', 'hy'), item('b', 'fr'))
  const r = planUploads({ queue, ledger: emptyYtLedger(), tokens: ['fr'], now: NOW })
  assert.deepEqual(keys(r), ['b:fr'])
  assert.equal(r.ledger.posted['a:hy'], undefined)
})

test('planUploads : écrit le registre AVANT, sans muter celui reçu ; un élément au registre n’est jamais replanifié', () => {
  const queue = queueOf(item('a', 'fr'), item('b', 'fr'))
  const ledger = emptyYtLedger()
  const r = planUploads({ queue, ledger, tokens: ALL, now: NOW })
  assert.deepEqual(ledger, emptyYtLedger())
  assert.equal(r.ledger.posted['a:fr'], NOW.toISOString())
  assert.equal(r.ledger.posted['b:fr'], NOW.toISOString())
  // Run suivant, même file (l'envoi n'a pas encore été réglé) : rien.
  assert.deepEqual(keys(planUploads({ queue, ledger: r.ledger, tokens: ALL, now: new Date(+NOW + 3_600_000) })), [])
  // Incertain : reste au registre, jamais replanifié.
  const unsure = settleUploads(r.ledger, [{ key: 'a:fr', ok: false, uncertain: true, error: 'envoi : délai dépassé' }], NOW)
  assert.deepEqual(keys(planUploads({ queue, ledger: unsure, tokens: ALL, now: new Date(+NOW + 86_400_000) })), [])
})

test('planUploads : un élément déjà dans culture-videos.json n’est pas envoyé', () => {
  const queue = queueOf(item('a', 'fr'), item('b', 'fr'))
  const videos = { a: { fr: { youtube: 'qixjDSmLxfE' } } }
  assert.deepEqual(keys(planUploads({ queue, ledger: emptyYtLedger(), tokens: ALL, now: NOW, videos })), ['b:fr'])
})

test('planUploads : un échec sûr attend 50 min, s’arrête à 3 essais ; un quota épuisé arrête tout jusqu’au jour PT suivant', () => {
  const queue = queueOf(item('a', 'fr'), item('b', 'fr'))
  const l = emptyYtLedger()
  l.failed['a:fr'] = { attempts: 1, last: new Date(+NOW - 10 * 60_000).toISOString(), error: 'init : HTTP 400 invalidTitle' }
  assert.deepEqual(keys(planUploads({ queue, ledger: l, tokens: ALL, now: NOW })), ['b:fr'])
  l.failed['a:fr'] = { attempts: 3, last: '2026-11-15T00:00:00.000Z', error: 'init : HTTP 400 invalidTitle' }
  assert.deepEqual(keys(planUploads({ queue, ledger: l, tokens: ALL, now: NOW })), ['b:fr'])

  const q = emptyYtLedger()
  q.failed['a:fr'] = { attempts: 0, last: '2026-11-16T19:00:00.000Z', error: 'init : HTTP 403 quotaExceeded — quota' }
  assert.deepEqual(keys(planUploads({ queue, ledger: q, tokens: ALL, now: NOW })), [])
  // Le lendemain PT (le 17 à 08:00Z = minuit à LA) : on reprend, sans essai compté.
  assert.deepEqual(keys(planUploads({ queue, ledger: q, tokens: ALL, now: new Date('2026-11-17T08:30:00Z') })), ['a:fr', 'b:fr'])
})

test('ytTokens : une langue n’a de jeton que si l’application ET son jeton sont posés', () => {
  assert.deepEqual(ytTokens({ YT_REFRESH_TOKEN_FR: 'x' }), [])
  const env = { YT_CLIENT_ID: 'id', YT_CLIENT_SECRET: 's', YT_REFRESH_TOKEN_FR: 'x', YT_REFRESH_TOKEN_HY: ' ' }
  assert.deepEqual(ytTokens(env), ['fr'])
})

// --- Le règlement --------------------------------------------------------

const planned = () => planUploads({ queue: queueOf(item('a', 'fr'), item('b', 'en')), ledger: emptyYtLedger(), tokens: ALL, now: NOW }).ledger

test('settleUploads : 400 → failed, 1 essai, sorti du registre', () => {
  const l = settleUploads(planned(), [{ key: 'a:fr', ok: false, error: 'init : HTTP 400 invalidTitle' }], NOW)
  assert.equal(l.posted['a:fr'], undefined)
  assert.equal(l.failed['a:fr'].attempts, 1)
  const l2 = settleUploads({ ...l, posted: { ...l.posted, 'a:fr': NOW.toISOString() } }, [{ key: 'a:fr', ok: false, error: 'init : HTTP 400 x' }], NOW)
  assert.equal(l2.failed['a:fr'].attempts, 2)
})

test('settleUploads : invalid_grant → 0 essai ; quotaExceeded → 0 essai', () => {
  const l = settleUploads(planned(), [
    { key: 'a:fr', ok: false, error: 'jeton : HTTP 400 invalid_grant — Token has been expired or revoked.' },
    { key: 'b:en', ok: false, error: 'init : HTTP 403 quotaExceeded — The request cannot be completed' },
  ], NOW)
  assert.equal(l.posted['a:fr'], undefined)
  assert.equal(l.failed['a:fr'].attempts, 0)
  assert.equal(l.failed['b:en'].attempts, 0)
  assert.ok(isYtAuthFailure(l.failed['a:fr'].error))
  assert.ok(isQuotaFailure(l.failed['b:en'].error))
})

test('settleUploads : délai → reste au registre, uncertain ; run coupé sans résultat → idem', () => {
  const l = settleUploads(planned(), [{ key: 'a:fr', ok: false, uncertain: true, error: 'envoi : délai dépassé' }], NOW, [
    { slug: 'a', lang: 'fr' },
    { slug: 'b', lang: 'en' },
  ])
  assert.equal(l.posted['a:fr'], NOW.toISOString())
  assert.equal(l.failed['a:fr'].uncertain, true)
  assert.equal(l.posted['b:en'], NOW.toISOString())
  assert.equal(l.failed['b:en'].uncertain, true)
})

test('settleUploads : succès → { at, id } et l’échec passé s’efface ; privée → private: true', () => {
  const l0 = planned()
  l0.failed['a:fr'] = { attempts: 1, last: '2026-11-16T10:00:00.000Z', error: 'x' }
  const l = settleUploads(l0, [
    { key: 'a:fr', ok: true, id: 'qixjDSmLxfE' },
    { key: 'b:en', ok: true, id: 'iFGIKaDCy88', private: true },
  ], new Date(+NOW + 60_000))
  assert.deepEqual(l.posted['a:fr'], { at: NOW.toISOString(), id: 'qixjDSmLxfE' })
  assert.deepEqual(l.posted['b:en'], { at: NOW.toISOString(), id: 'iFGIKaDCy88', private: true })
  assert.equal(l.failed['a:fr'], undefined)
})

test('applyUploads : un succès public entre dans culture-videos.json et sort de la file ; privé ou échec, non', () => {
  const queue = queueOf(item('a', 'fr'), item('b', 'en'), item('c', 'hy'))
  const r = applyUploads({
    queue,
    videos: {},
    results: [
      { key: 'a:fr', slug: 'a', lang: 'fr', ok: true, id: 'qixjDSmLxfE' },
      { key: 'b:en', slug: 'b', lang: 'en', ok: true, id: 'iFGIKaDCy88', private: true },
      { key: 'c:hy', slug: 'c', lang: 'hy', ok: false, error: 'x' },
    ],
    today: '2026-11-16',
  })
  assert.deepEqual(r.videos, {
    a: { fr: { youtube: 'qixjDSmLxfE', title: 'Titre a fr', description: 'Chapeau a.', uploadDate: '2026-11-16', duration: 'PT44S' } },
  })
  assert.deepEqual(r.queue.items.map((i) => `${i.slug}:${i.lang}`), ['b:en', 'c:hy'])
  assert.deepEqual(r.added, ['a/fr'])
})

// --- mark / retry --------------------------------------------------------

test('markUpload : inscrit, refuse un id mal formé et un élément déjà en ligne', () => {
  const l = markUpload(emptyYtLedger(), 'a:fr', 'qixjDSmLxfE', NOW)
  assert.deepEqual(l.posted['a:fr'], { at: NOW.toISOString(), id: 'qixjDSmLxfE' })
  assert.throws(() => markUpload(l, 'a:fr', 'iFGIKaDCy88', NOW), /déjà/)
  assert.throws(() => markUpload(emptyYtLedger(), 'a:fr', 'trop-court', NOW), /identifiant/)
  // Un envoi incertain que l'on a vérifié sur la chaîne se règle par mark.
  const u = settleUploads(planned(), [{ key: 'a:fr', ok: false, uncertain: true, error: 'délai' }], NOW)
  const m = markUpload(u, 'a:fr', 'qixjDSmLxfE', NOW)
  assert.equal(m.failed['a:fr'], undefined)
  assert.equal(m.posted['a:fr'].id, 'qixjDSmLxfE')
})

test('retryUpload : remet en file un abandon ; --drop le classe ; refuse une vidéo en ligne', () => {
  const l = emptyYtLedger()
  l.failed['a:fr'] = { attempts: 3, last: '2026-11-15T00:00:00.000Z', error: 'x' }
  const r = retryUpload(l, 'a:fr')
  assert.equal(r.failed['a:fr'], undefined)
  assert.equal(r.posted['a:fr'], undefined)
  const d = retryUpload(l, 'a:fr', { drop: true, now: NOW })
  assert.match(d.posted['a:fr'], /^abandonné /)
  const on = markUpload(emptyYtLedger(), 'a:fr', 'qixjDSmLxfE', NOW)
  assert.throws(() => retryUpload(on, 'a:fr'), /en ligne/)
})

// --- L'envoi (fetch injecté) ---------------------------------------------

const CREDS = { clientId: 'cid', clientSecret: 'csecret', refreshToken: 'rtoken-secret' }
const VIDEO = Buffer.from('mp4-octets')
const okJson = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } })

function fakeYt({ token, init, upload, status } = {}) {
  const calls = []
  const f = async (url, opts = {}) => {
    calls.push({ url: String(url), opts })
    const u = String(url)
    if (u === 'https://oauth2.googleapis.com/token') return token ? token() : okJson({ access_token: 'atoken' })
    if (u.includes('upload_id=XYZ')) return upload ? upload() : okJson({ id: 'qixjDSmLxfE' })
    if (u.startsWith('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable'))
      return init ? init() : new Response('', { status: 200, headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=XYZ' } })
    if (u.startsWith('https://www.googleapis.com/youtube/v3/videos?part=status')) return status ? status() : okJson({ items: [{ status: { privacyStatus: 'public' } }] })
    throw new Error(`URL inattendue : ${u}`)
  }
  return { f, calls }
}
const it = item('duduk', 'hy')
const download = async (url) => {
  assert.equal(url, REEL_BASE + 'hy-duduk.mp4')
  return VIDEO
}

test('uploadShort : jeton, session resumable, octets, puis statut — sans jeton dans une URL', async () => {
  const { f, calls } = fakeYt()
  const r = await uploadShort(it, CREDS, { fetch: f, download })
  assert.deepEqual(r, { id: 'qixjDSmLxfE', privacyStatus: 'public' })
  assert.equal(calls.length, 4)
  const init = calls[1]
  assert.equal(init.opts.method, 'POST')
  assert.match(init.url, /part=snippet,status/)
  assert.equal(init.opts.headers.authorization, 'Bearer atoken')
  assert.equal(init.opts.headers['x-upload-content-length'], String(VIDEO.length))
  const meta = JSON.parse(init.opts.body)
  assert.deepEqual(meta.snippet, { title: it.title, description: it.description, defaultLanguage: 'hy', defaultAudioLanguage: 'hy', categoryId: '27' })
  assert.deepEqual(meta.status, { privacyStatus: 'public', selfDeclaredMadeForKids: false })
  const put = calls[2]
  assert.equal(put.opts.method, 'PUT')
  assert.equal(put.opts.headers['content-length'], String(VIDEO.length))
  assert.equal(put.opts.body, VIDEO)
  for (const c of calls) assert.doesNotMatch(c.url, /atoken|rtoken|csecret/)
})

test('uploadShort : vidéo verrouillée en privé (projet non audité) → privacyStatus rendu', async () => {
  const { f } = fakeYt({ status: () => okJson({ items: [{ status: { privacyStatus: 'private' } }] }) })
  assert.equal((await uploadShort(it, CREDS, { fetch: f, download })).privacyStatus, 'private')
})

async function failure(opts) {
  const { f } = fakeYt(opts)
  try {
    await uploadShort(it, CREDS, { fetch: f, download })
  } catch (e) {
    return e
  }
  assert.fail('aurait dû échouer')
}

test('uploadShort : classement des échecs', async () => {
  const grant = await failure({ token: () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }), { status: 400 }) })
  assert.ok(isYtAuthFailure(grant.message))
  assert.equal(isUploadUncertain(grant), false)
  assert.doesNotMatch(grant.message, /rtoken/)

  const quota = await failure({ init: () => new Response(JSON.stringify({ error: { code: 403, message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 }) })
  assert.ok(isQuotaFailure(quota.message))
  assert.equal(isUploadUncertain(quota), false)

  const init5xx = await failure({ init: () => new Response('boom', { status: 503 }) })
  assert.equal(isUploadUncertain(init5xx), false, 'une session sans octets ne publie rien')

  const put5xx = await failure({ upload: () => new Response('boom', { status: 503 }) })
  assert.equal(isUploadUncertain(put5xx), true)

  const put4xx = await failure({ upload: () => new Response('{}', { status: 400 }) })
  assert.equal(isUploadUncertain(put4xx), false)

  const timeout = await failure({ upload: () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) } })
  assert.equal(isUploadUncertain(timeout), true)
  assert.match(timeout.message, /délai dépassé/)

  // Envoyée, mais statut illisible : incertaine, l'id est gardé.
  const st = await failure({ status: () => new Response('boom', { status: 500 }) })
  assert.equal(isUploadUncertain(st), true)
  assert.equal(st.videoId, 'qixjDSmLxfE')
})

test('uploadShort : une session hors de googleapis.com est refusée', async () => {
  const e = await failure({ init: () => new Response('', { status: 200, headers: { location: 'https://evil.example/upload_id=XYZ' } }) })
  assert.match(e.message, /session/)
  assert.equal(isUploadUncertain(e), false)
})

// --- Le CLI --------------------------------------------------------------

const CLI = path.resolve('scripts/youtube-post.mjs')
async function dataDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'yt-'))
  await writeFile(path.join(dir, 'youtube-queue.json'), JSON.stringify(queueOf(item('a', 'fr'), item('b', 'fr'))))
  await writeFile(path.join(dir, 'culture-videos.json'), '{}\n')
  return dir
}
const run = (args, env = {}) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(YOUTUBE_AUTO|YT_)/.test(k)))
  return execFileSync(process.execPath, [CLI, ...args], { env: { ...clean, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

test('CLI : sans YOUTUBE_AUTO=1, ne fait rien et le dit', async () => {
  const dir = await dataDir()
  const before = (await readdir(dir)).sort()
  for (const args of [[], ['plan', '--out', path.join(dir, 'plan.json')], ['post', '--plan', 'x'], ['settle', '--results', 'x']]) {
    const out = run([...args, '--data', dir], { YT_CLIENT_ID: 'id', YT_CLIENT_SECRET: 's', YT_REFRESH_TOKEN_FR: 'x' })
    assert.equal(out.trim().split('\n').length, 1)
    assert.match(out, /YOUTUBE_AUTO/)
  }
  assert.deepEqual((await readdir(dir)).sort(), before, 'aucun fichier écrit')
})

test('CLI mark : registre + culture-videos.json (uploadDate du jour, PT44S) + retrait de la file, sans YOUTUBE_AUTO', async () => {
  const dir = await dataDir()
  run(['mark', 'a', 'fr', 'qixjDSmLxfE', '--data', dir])
  const ledger = JSON.parse(await readFile(path.join(dir, 'youtube-posted.json'), 'utf8'))
  assert.equal(ledger.posted['a:fr'].id, 'qixjDSmLxfE')
  const videos = JSON.parse(await readFile(path.join(dir, 'culture-videos.json'), 'utf8'))
  assert.deepEqual(videos.a.fr, { youtube: 'qixjDSmLxfE', title: 'Titre a fr', description: 'Chapeau a.', uploadDate: zurichDay(new Date()), duration: 'PT44S' })
  const queue = JSON.parse(await readFile(path.join(dir, 'youtube-queue.json'), 'utf8'))
  assert.deepEqual(queue.items.map((i) => i.slug), ['b'])
  assert.throws(() => run(['mark', 'a', 'fr', 'iFGIKaDCy88', '--data', dir], {}), /déjà/)
  assert.throws(() => run(['mark', 'b', 'fr', 'pas-bon', '--data', dir], {}))
})
