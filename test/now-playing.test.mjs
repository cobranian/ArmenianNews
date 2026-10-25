import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STREAMS, SANS_TITRE, decodeMeta, readIcyTitle } from '../proxy/now-playing-worker.js'
import { NOW_PLAYING_URL, songFrom } from '../src/nowPlaying.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

const stationIds = () => {
  const bloc = read('src/components/Radio.jsx').match(/const STATIONS = \[[\s\S]*?\n\]/)
  return [...bloc[0].matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
}

// Une station ajoutée à Radio.jsx sans entrée dans le Worker n'afficherait
// jamais de titre, sans que rien ne le signale.
test('chaque station est lue par le Worker, ou écartée avec sa raison', () => {
  for (const id of stationIds()) {
    assert.ok(STREAMS[id] || SANS_TITRE[id], `station « ${id} » absente de STREAMS et de SANS_TITRE (proxy/now-playing-worker.js)`)
  }
  for (const id of [...Object.keys(STREAMS), ...Object.keys(SANS_TITRE)]) {
    assert.ok(stationIds().includes(id), `« ${id} » du Worker n'est plus une station`)
  }
})

// La CSP est dupliquée entre les deux vitrines : un connect-src oublié d'un
// côté bloque l'appel en production seulement, et la ligne ne s'affiche jamais.
test('le Worker est autorisé par connect-src sur les deux vitrines', () => {
  const host = new URL(NOW_PLAYING_URL).origin
  const csps = [...read('firebase.json').matchAll(/"value":\s*"(default-src[^"]*)"/g)].map((m) => m[1])
  assert.equal(csps.length, 2)
  for (const csp of csps) {
    const connect = csp.split(';').find((d) => d.trim().startsWith('connect-src'))
    assert.ok(connect.includes(host), `connect-src sans ${host}`)
  }
})

const enc = (s) => new TextEncoder().encode(s)

test('decodeMeta lit le titre, apostrophe comprise', () => {
  assert.equal(decodeMeta(enc("StreamTitle='Lav - Amena-Tank';\0\0\0")), 'Lav - Amena-Tank')
  assert.equal(decodeMeta(enc("StreamTitle='Don't Stop - Fleetwood';StreamUrl='';")), "Don't Stop - Fleetwood")
  assert.equal(decodeMeta(enc("StreamTitle='';")), '')
  // Windows-1252 quand ce n'est pas de l'UTF-8 valide : « é » = 0xE9.
  assert.equal(decodeMeta(new Uint8Array([...enc("StreamTitle='Caf"), 0xe9, ...enc("';")])), 'Café')
})

function fauxFlux({ metaint, meta, headers = {}, chunk = 7 }) {
  const m = enc(meta)
  const len = Math.ceil(m.length / 16)
  const block = new Uint8Array(1 + len * 16)
  block[0] = len
  block.set(m, 1)
  const all = new Uint8Array([...new Uint8Array(metaint).fill(0xff), ...block, ...new Uint8Array(500)])
  let o = 0
  const body = new ReadableStream({
    pull(c) {
      if (o >= all.length) return c.close()
      c.enqueue(all.slice(o, o + chunk))
      o += chunk
    },
  })
  const h = new Headers({ 'icy-name': 'Lav Radio', ...(metaint ? { 'icy-metaint': String(metaint) } : {}), ...headers })
  return async () => new Response(body, { headers: h })
}

test('readIcyTitle lit le premier bloc, même découpé en petits morceaux', async () => {
  const r = await readIcyTitle('x', fauxFlux({ metaint: 100, meta: "StreamTitle='A - B';" }))
  assert.deepEqual(r, { title: 'A - B', name: 'Lav Radio' })
})

test('readIcyTitle rend null sans icy-metaint, ou sur un bloc vide', async () => {
  assert.equal((await readIcyTitle('x', fauxFlux({ metaint: 0, meta: '' }))).title, null)
  assert.equal((await readIcyTitle('x', fauxFlux({ metaint: 64, meta: '' }))).title, null)
})

test('songFrom sépare artiste et titre', () => {
  assert.deepEqual(songFrom('Armenchik feat. Super Sako - Amena-Tank'), {
    artist: 'Armenchik feat. Super Sako',
    title: 'Amena-Tank',
  })
  assert.deepEqual(songFrom('Vahram Yan.Im Xaxaxutyun'), { artist: '', title: 'Vahram Yan.Im Xaxaxutyun' })
})

test('songFrom n’affiche rien quand ce n’est pas une chanson', () => {
  assert.equal(songFrom(''), null)
  assert.equal(songFrom(null), null)
  assert.equal(songFrom('  -  '), null)
  assert.equal(songFrom('Radio Mariam Armenia', { icyName: 'Radio Mariam Armenia' }), null)
  assert.equal(songFrom('RADIO MARIAM ARMENIA', { stationName: 'Radio Mariam Armenia' }), null)
  assert.equal(songFrom('RADIOTATRON 24 HOKTEMBER 2026 01 - 17-01 KHUMHAR'), null)
  assert.equal(songFrom('www.lavradio.am'), null)
  // Une année seule n'est pas une date d'émission.
  assert.ok(songFrom('Komitas - Groung 1915'))
})
