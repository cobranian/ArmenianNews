// Invariant : l'envoi d'un Reel ne télécharge la vidéo QUE depuis la release
// du dépôt (REEL_BASE), ne parle qu'à des hôtes Meta écrits en dur, ne met
// aucune clé dans une URL, et seul l'appel qui PUBLIE (finish côté Facebook,
// media_publish côté Instagram) rend un échec ambigu `uncertain`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, REEL_BASE } from '../scripts/lib/social.mjs'
import { send, fetchReel, isUncertain } from '../scripts/lib/social-send.mjs'

const chan = (id) => CHANNELS.find((c) => c.id === id)
const VIDEO = Buffer.from('fausse-video-mp4-0123456789')
const reel = (slug = 'duduk') => ({
  id: `reel:${slug}`,
  kind: 'reel',
  lang: 'fr',
  date: '2026-10-20',
  url: `https://armenieinfo.ch/culture/${slug}/`,
  title: `T ${slug}`,
  description: `D ${slug}`,
  image: { width: 1200, height: 868, author: 'A', license: 'CC BY-SA 4.0' },
  video: { url: REEL_BASE + `fr-${slug}.mp4`, music: '♪ Duduk' },
})
const ok = (o) => new Response(JSON.stringify(o), { status: 200 })
const noWait = async () => {}

// Un fetch factice qui enregistre chaque appel ; `route` décide de la réponse.
function fake(route) {
  const calls = []
  const f = async (url, init = {}) => {
    calls.push({ url, init })
    if (url.startsWith(REEL_BASE)) return new Response(VIDEO, { status: 200 })
    return route(url, init, calls)
  }
  return { f, calls }
}
const meta = (calls) => calls.filter((c) => !c.url.startsWith(REEL_BASE))

function fbRoute(finish = () => ok({ success: true })) {
  return (url, init) => {
    if (url.endsWith('?fields=access_token')) return ok({ access_token: 'PAGE-SECRET' })
    if (url.endsWith('/video_reels') && /upload_phase=start/.test(init.body)) return ok({ video_id: 'V1', upload_url: 'https://rupload.facebook.com/video-upload/V1' })
    if (url.startsWith('https://rupload.facebook.com/video-upload/')) return ok({ success: true })
    if (url.endsWith('/video_reels') && /upload_phase=finish/.test(init.body)) return finish()
    return new Response('{"error":{"message":"inattendu"}}', { status: 404 })
  }
}

test('(a) Facebook : token, start, upload, finish — dans cet ordre', async () => {
  const { f, calls } = fake(fbRoute())
  const id = await send(chan('facebook-ch'), reel(), { pageId: '42', token: 'USER-SECRET' }, { fetch: f, wait: noWait })
  assert.equal(id, 'V1')
  // La vidéo est téléchargée AVANT d'ouvrir une session chez Meta.
  assert.ok(calls[0].url.startsWith(REEL_BASE))
  const m = meta(calls)
  assert.equal(m.length, 4)
  assert.match(m[0].url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/42\?fields=access_token$/)
  assert.match(m[1].url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/42\/video_reels$/)
  assert.match(m[1].init.body, /upload_phase=start/)
  assert.match(m[1].init.body, /access_token=PAGE-SECRET/)
  assert.match(m[2].url, /^https:\/\/rupload\.facebook\.com\/video-upload\/v\d+\.\d+\/V1$/)
  assert.equal(m[2].init.method, 'POST')
  assert.equal(m[2].init.headers.authorization, 'OAuth PAGE-SECRET')
  assert.equal(m[2].init.headers.offset, '0')
  assert.equal(m[2].init.headers.file_size, String(VIDEO.length))
  assert.ok(Buffer.isBuffer(m[2].init.body) && m[2].init.body.equals(VIDEO))
  assert.match(m[3].url, /\/42\/video_reels$/)
  const fin = new URLSearchParams(m[3].init.body)
  assert.equal(fin.get('upload_phase'), 'finish')
  assert.equal(fin.get('video_id'), 'V1')
  assert.equal(fin.get('video_state'), 'PUBLISHED')
  assert.match(fin.get('description'), /T duduk/)
  assert.match(fin.get('description'), /♪ Duduk/)
  for (const c of calls) assert.ok(!c.url.includes('SECRET'), c.url)
})

test('(b) Facebook : 503 sur finish = uncertain, 400 sur finish = refus net', async () => {
  const run = async (status) => {
    const { f } = fake(fbRoute(() => new Response('{"error":{"message":"x"}}', { status })))
    return send(chan('facebook-ch'), reel(), { pageId: '42', token: 'U' }, { fetch: f, wait: noWait }).then(
      () => assert.fail('aurait dû échouer'),
      (e) => e,
    )
  }
  assert.equal(isUncertain(await run(503)), true)
  assert.equal(isUncertain(await run(400)), false)
})

test('(b) Facebook : un échec de start ou d’upload n’est jamais ambigu', async () => {
  for (const step of ['start', 'upload']) {
    const route = fbRoute()
    const { f } = fake((url, init) => {
      const isStep = step === 'start' ? url.endsWith('/video_reels') && /upload_phase=start/.test(init.body) : url.startsWith('https://rupload.')
      return isStep ? new Response('oops', { status: 503 }) : route(url, init)
    })
    const e = await send(chan('facebook-ch'), reel(), { pageId: '42', token: 'U' }, { fetch: f, wait: noWait }).catch((x) => x)
    assert.ok(e instanceof Error, step)
    assert.equal(isUncertain(e), false, step)
  }
})

function igRoute(statuses) {
  let n = 0
  return (url) => {
    if (/\/7\/media$/.test(url)) return ok({ id: 'C1', uri: 'https://rupload.facebook.com/ig-api-upload/v26.0/C1' })
    if (url.startsWith('https://rupload.facebook.com/ig-api-upload/')) return ok({ success: true, message: 'Upload successful.' })
    if (url.includes('/C1?fields=status_code')) return ok({ status_code: statuses[Math.min(n++, statuses.length - 1)] })
    if (/\/7\/media_publish$/.test(url)) return ok({ id: 'M1' })
    return new Response('{"error":{"message":"inattendu"}}', { status: 404 })
  }
}

test('(c) Instagram : media, upload, status ×2, publish', async () => {
  const { f, calls } = fake(igRoute(['IN_PROGRESS', 'FINISHED']))
  const waits = []
  const id = await send(chan('instagram-ch'), reel(), { userId: '7', token: 'IG-SECRET' }, { fetch: f, wait: async (ms) => waits.push(ms) })
  assert.equal(id, 'M1')
  const m = meta(calls)
  assert.deepEqual(
    m.map((c) => new URL(c.url).pathname.replace(/^\/v\d+\.\d+/, '').replace(/^\/ig-api-upload\/v\d+\.\d+/, '/upload')),
    ['/7/media', '/upload/C1', '/C1', '/C1', '/7/media_publish'],
  )
  const box = new URLSearchParams(m[0].init.body)
  assert.equal(box.get('media_type'), 'REELS')
  assert.equal(box.get('upload_type'), 'resumable')
  assert.equal(box.get('share_to_feed'), 'true')
  assert.match(box.get('caption'), /T duduk/)
  assert.equal(box.get('video_url'), null, 'la vidéo part en octets, jamais par URL')
  assert.match(m[1].url, /^https:\/\/rupload\.facebook\.com\/ig-api-upload\/v\d+\.\d+\/C1$/)
  assert.equal(m[1].init.headers.authorization, 'OAuth IG-SECRET')
  assert.equal(m[1].init.headers.offset, '0')
  assert.equal(m[1].init.headers.file_size, String(VIDEO.length))
  assert.ok(m[1].init.body.equals(VIDEO))
  assert.equal(new URLSearchParams(m[4].init.body).get('creation_id'), 'C1')
  assert.equal(waits.length, 1)
  for (const c of calls) assert.ok(!c.url.includes('SECRET'), c.url)
})

test('(c) Instagram : un conteneur ERROR lève sans publier', async () => {
  const { f, calls } = fake(igRoute(['IN_PROGRESS', 'ERROR']))
  const e = await send(chan('instagram-ch'), reel(), { userId: '7', token: 'T' }, { fetch: f, wait: noWait }).catch((x) => x)
  assert.match(e.message, /ERROR/)
  assert.equal(isUncertain(e), false)
  assert.ok(!calls.some((c) => c.url.endsWith('/media_publish')))
})

test('(c) Instagram : un Reel a droit à plus de temps qu’une image, mais pas indéfiniment', async () => {
  const { f, calls } = fake(igRoute(['IN_PROGRESS']))
  const e = await send(chan('instagram-ch'), reel(), { userId: '7', token: 'T' }, { fetch: f, wait: noWait }).catch((x) => x)
  assert.match(e.message, /pas prêt après 300 s/)
  assert.ok(!calls.some((c) => c.url.endsWith('/media_publish')))
})

test('(c) Instagram : 503 sur publish = uncertain', async () => {
  const route = igRoute(['FINISHED'])
  const { f } = fake((url, init) => (url.endsWith('/media_publish') ? new Response('x', { status: 503 }) : route(url, init)))
  const e = await send(chan('instagram-ch'), reel(), { userId: '7', token: 'T' }, { fetch: f, wait: noWait }).catch((x) => x)
  assert.equal(isUncertain(e), true)
})

test('(d) fetchReel refuse toute URL hors de la release, sans appeler fetch', async () => {
  let called = 0
  const f = async () => (called++, new Response(VIDEO))
  for (const bad of [
    'https://evil.example/x.mp4',
    'http://github.com/cobranian/ArmenianNews/releases/download/reels-1/x.mp4',
    REEL_BASE + '../../../../evil/x.mp4',
  ]) {
    const e = await fetchReel(bad, f).catch((x) => x)
    assert.ok(e instanceof Error, bad)
    assert.ok(!e.final, bad)
  }
  assert.equal(called, 0)
})

test('(e) fetchReel suit la redirection de la release vers le CDN de GitHub', async () => {
  const urls = []
  const cdn = 'https://objects.githubusercontent.com/github-production-release-asset/x?sig=abc'
  const f = async (url) => {
    urls.push(url)
    if (url.startsWith(REEL_BASE)) return new Response(null, { status: 302, headers: { location: cdn } })
    return new Response(VIDEO, { status: 200 })
  }
  const buf = await fetchReel(REEL_BASE + 'fr-duduk.mp4', f)
  assert.ok(buf.equals(VIDEO))
  assert.deepEqual(urls, [REEL_BASE + 'fr-duduk.mp4', cdn])
})

test('(e) fetchReel : un code autre que 200, ou un fichier trop lourd, est refusé', async () => {
  const e404 = await fetchReel(REEL_BASE + 'x.mp4', async () => new Response('no', { status: 404 })).catch((x) => x)
  assert.match(e404.message, /HTTP 404/)
  const huge = async () => new Response('x', { status: 200, headers: { 'content-length': String(200 * 1024 * 1024) } })
  const eBig = await fetchReel(REEL_BASE + 'x.mp4', huge).catch((x) => x)
  assert.match(eBig.message, /trop lourd/)
  // Une redirection vers http:// (en clair) n'est pas suivie.
  const toHttp = async () => new Response(null, { status: 302, headers: { location: 'http://objects.githubusercontent.com/x' } })
  assert.ok((await fetchReel(REEL_BASE + 'x.mp4', toHttp).catch((x) => x)) instanceof Error)
})
