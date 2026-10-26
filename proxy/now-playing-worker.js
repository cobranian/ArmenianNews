// « Titre en cours » des radios : GET /?s=<id de station> → { title, name }.
//
// Pourquoi un Worker : le titre voyage DANS le flux (métadonnées ICY, un bloc
// tous les `icy-metaint` octets), et un <audio> ne le rend jamais à la page.
// Les adresses de statut des serveurs (/currentsong, status-json.xsl) ne
// portent presque jamais d'en-tête CORS : le navigateur ne peut pas les lire.
// Le Worker ouvre le flux avec `Icy-MetaData: 1`, lit le premier bloc, raccroche.
//
// Ce n'est PAS un proxy ouvert : seules les stations de STREAMS sont lues.
// Une station absente de STREAMS répond { title: null } — le site n'affiche
// alors rien, ce qui est le comportement voulu pour une station sans titre.
//
// Déployer :  cd proxy && npx wrangler deploy -c wrangler-now-playing.toml
// Publie https://radio-now-playing.cobranian.workers.dev

// Même liste que STATIONS (src/components/Radio.jsx), mais vers l'ORIGINE du
// flux : Mariam et Yeraz y passent par des Workers audio, inutiles ici.
// test/now-playing.test.mjs exige que chaque station y figure, ou dans
// SANS_TITRE, ET que chaque URL soit celle de Radio.jsx (ou l'UPSTREAM du
// Worker audio) : un flux déplacé d'un seul côté éteindrait le titre en silence.
export const STREAMS = {
  public: 'https://eu1.stream4cast.com/proxy/publicra/stream',
  im: 'https://eu1.stream4cast.com/proxy/aamiry02/stream',
  arevik: 'https://eu1.stream4cast.com/proxy/aamiryan/stream',
  culture: 'https://eu1.stream4cast.com/proxy/aamiry01/stream',
  mariam: 'http://bkmx.euriconsult.eu:8000/RadioMariam',
  lav: 'https://eu.stream4cast.com/proxy/lavradio/stream',
  fama: 'https://eu.stream4cast.com/proxy/rmirzakh/stream',
  yerevannights: 'https://icecast.worldweb.services/Web',
  gospel: 'https://s8.myradiostream.com:15554/listen.mp3',
  yeraz: 'http://streaming05.liveboxstream.uk:8008/stream',
  jazz: 'https://am.radioaurora.am/jz',
  vem: 'https://eu1.stream4cast.com/proxy/vemradio/stream',
  yerevanfm: 'https://eu1.stream4cast.com/proxy/arradioi/stream',
  tsayn: 'https://cast5.asurahosting.com/proxy/jean/live',
  radioa: 'https://stream.votreradiosurlenet.eu/radioa.mp3',
  aypfm: 'https://stric6.streamakaci.com/radioayp.mp3',
}

// Stations volontairement non lues, avec la raison.
export const SANS_TITRE = {
  // Répond « ICY 200 OK » (pas du HTTP : fetch() le refuse) et bloque les IP
  // de datacenter, Cloudflare compris.
  vov: 'ICY v1 + IP de datacenter refusées',
}

const ORIGINS = [
  /^https:\/\/(www\.)?armenieinfo\.ch$/,
  /^https:\/\/(www\.)?armenianews\.org$/,
  // Nos deux sites Firebase et leurs canaux de prévisualisation, pas tout *.web.app.
  /^https:\/\/(armenie-info|armenia-news-org)(--[a-z0-9-]+)?\.web\.app$/,
  /^http:\/\/localhost:\d+$/,
]

const CACHE_S = 15 // tous les auditeurs d'une station partagent une lecture

// Cache EN MÉMOIRE de l'isolat, pas l'API Cache : sur *.workers.dev (ce
// Worker n'a pas de route) caches.default n'a aucun effet — chaque auditeur
// ouvrait sa propre connexion au flux toutes les 20 s. On garde la PROMESSE :
// des requêtes simultanées pour une station attendent la même lecture. C'est
// aussi ce qui borne un appel abusif : une lecture par station et par CACHE_S
// (et par isolat), quel que soit le nombre de requêtes.
const memo = new Map() // id → { at, promise }
export function titleFor(id, url, { now = Date.now(), read = readIcyTitle } = {}) {
  const hit = memo.get(id)
  if (hit && now - hit.at < CACHE_S * 1000) return hit.promise
  const promise = Promise.resolve()
    .then(() => read(url))
    .catch(() => ({ title: null, name: null }))
  memo.set(id, { at: now, promise })
  return promise
}
const MAX_METAINT = 64 * 1024

// Bloc ICY → texte. UTF-8 d'abord ; à défaut, Windows-1252 (vieux Shoutcast).
export function decodeMeta(bytes) {
  const raw = (() => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder('windows-1252').decode(bytes)
    }
  })().replace(/\0+$/, '')
  // Le titre peut contenir une apostrophe (« Don't ») : on s'arrête au
  // guillemet suivi d'un autre champ ou de la fin, pas au premier. Le `;`
  // final et les guillemets simples ne sont pas garantis par tous les serveurs.
  const m = raw.match(/StreamTitle=(['"])([\s\S]*?)\1;?(?=\s*[A-Za-z]+=|\s*$)/)
  return m ? m[2].trim() : ''
}

// Lit le premier bloc de métadonnées d'un flux. null = pas de métadonnées.
export async function readIcyTitle(url, fetchImpl = fetch, timeoutMs = 6000) {
  const res = await fetchImpl(url, {
    headers: { 'Icy-MetaData': '1', 'User-Agent': 'radio-now-playing/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const name = res.headers.get('icy-name') || null
  const metaint = Number(res.headers.get('icy-metaint'))
  if (!res.ok || !res.body || !(metaint > 0) || metaint > MAX_METAINT) {
    await res.body?.cancel().catch(() => {})
    return { title: null, name }
  }
  const reader = res.body.getReader()
  const chunks = []
  let have = 0
  let need = metaint + 1
  try {
    while (have < need) {
      const { done, value } = await reader.read()
      if (done) return { title: null, name }
      chunks.push(value)
      have += value.length
      if (need === metaint + 1 && have >= metaint + 1) {
        const all = concat(chunks, have)
        need = metaint + 1 + all[metaint] * 16
      }
    }
    const all = concat(chunks, have)
    const title = decodeMeta(all.subarray(metaint + 1, need))
    return { title: title || null, name }
  } finally {
    reader.cancel().catch(() => {})
  }
}

function concat(chunks, len) {
  const out = new Uint8Array(len)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

function cors(origin) {
  const ok = origin && ORIGINS.some((re) => re.test(origin))
  return ok ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('origin')
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })
    if (request.method !== 'GET') return new Response('method', { status: 405 })

    const id = new URL(request.url).searchParams.get('s') || ''
    const url = STREAMS[id]
    const json = (body, maxAge) =>
      new Response(JSON.stringify(body), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${maxAge}`,
          ...cors(origin),
        },
      })
    if (!url) return json({ title: null, name: null }, 3600)

    // Le cache est indexé par station, sans l'origine : l'en-tête CORS est
    // reposé à chaque réponse.
    return json(await titleFor(id, url), CACHE_S)
  },
}
