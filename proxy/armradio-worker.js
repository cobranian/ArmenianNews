// Always-on proxy for Public Radio of Armenia (en/hy/ru.armradio.am).
//
// Why this exists: armradio.am sits behind Cloudflare, which serves an
// intermittent 403 "managed challenge" to datacenter IPs (GitHub Actions
// runners). A Cloudflare Worker runs *inside* Cloudflare's network, which
// used to be enough. It no longer is: since September 2026 the origin
// challenges the Worker's subrequest too whenever the *visitor* calling the
// Worker is a datacenter IP — see the comment above `warm()`. The relay is
// therefore served from a KV cache that a Cron Trigger fills with no visitor
// in the loop.
//
// Three modes:
//   GET /                          → the newswire headlines (REST, RSS fallback)
//   GET /?lang=en&path=/wp-json/…  → one WordPress REST call, relayed verbatim
//   GET /?lang=hy&img=/wp-content/… → one media file, relayed as bytes
//
// The second mode is what the per-rubric scrape needs: it must reach
// /wp-json/wp/v2/categories and /wp-json/wp/v2/posts?categories=<id>, which the
// origin 403s from CI. The third serves the article thumbnails: the browser gets
// a 503 hotlinking *.armradio.am directly (Cloudflare hotlink protection), so the
// site routes ArmRadio card images through here — a Worker subrequest reaches the
// origin the same way the REST call does. It is NOT an open proxy — `lang`
// selects between three fixed hosts, and `path`/`img` must match a fixed prefix
// (see relayTarget / relayImage).
//
// Deploy: paste into a new Worker at dash.cloudflare.com (see proxy/README.md).

const HOST_BY_LANG = {
  en: 'en.armradio.am',
  hy: 'hy.armradio.am',
  ru: 'ru.armradio.am',
}

// WHY THERE IS A CRON AND A KV CACHE — the visitor leaks into the subrequest.
//
// When this Worker is called from a GitHub Actions runner, armradio.am's own
// Cloudflare answers the Worker's upstream fetch with a JavaScript challenge
// (« Just a moment… »); called from a residential IP, the very same relay URL
// returns 200. Measured 22 September 2026 with the `diag` workflow: the Worker
// itself is reachable from the CI (`?path=/nope` → its own 400), only the
// upstream call fails, and only for that caller. Cloudflare carries the
// visitor's identity (IP, bot score) into orange-to-orange subrequests, and a
// datacenter visitor with a non-browser UA scores as automated. Nothing in
// the request the Worker builds can change that — UA and headers are its own.
//
// A Cron Trigger has no visitor. `scheduled()` fetches the 22 REST responses
// the scraper asks for (see WARM_PATHS) every ten minutes and stores them in
// KV; the relay serves from KV first and only then goes upstream. The scraper's
// request strings must match WARM_PATHS byte for byte — hence the same
// category ids as scripts/sources/armradio.mjs (HY/RU fixed, EN resolved from
// the categories list, same slugs). KV `expirationTtl` is an hour: six missed
// crons before a rubric goes stale, and the scraper's backfill covers the rest.
const SECTION_SLUGS = ['politics', 'society', 'economics', 'analytics', 'world', 'culture', 'sport']
const HY_IDS = [12, 4, 11, 9, 5, 6, 1]
const RU_IDS = [4, 5, 8, 6, 7, 9, 1]
const CATEGORIES_PATH = '/wp-json/wp/v2/categories?per_page=100&_fields=id,slug'
const postsPath = (id) => `/wp-json/wp/v2/posts?categories=${id}&per_page=10&_embed=1`
const KV_TTL = 3600
const kvKey = (lang, path) => `${lang} ${path}`

async function warm(env) {
  const put = async (lang, path) => {
    const res = await fromOrigin(`https://${HOST_BY_LANG[lang]}${path}`, 'application/json')
    if (!res.ok) return null
    const body = await res.text()
    await env.CACHE.put(kvKey(lang, path), body, { expirationTtl: KV_TTL })
    return body
  }
  const jobs = []
  for (const [lang, ids] of [['hy', HY_IDS], ['ru', RU_IDS]]) {
    for (const id of ids) jobs.push(put(lang, postsPath(id)))
  }
  const cats = await put('en', CATEGORIES_PATH)
  if (cats) {
    const idBySlug = Object.fromEntries(JSON.parse(cats).map((c) => [c.slug, c.id]))
    for (const slug of SECTION_SLUGS) {
      if (idBySlug[slug]) jobs.push(put('en', postsPath(idBySlug[slug])))
    }
  }
  await Promise.allSettled(jobs)
}

const REST =
  'https://en.armradio.am/wp-json/wp/v2/posts?per_page=12&_fields=title,link,date_gmt'
const FEED = 'https://en.armradio.am/feed/'

async function fromOrigin(url, accept) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; armradio-proxy/1.0)',
      Accept: accept,
    },
    // Cache at the edge for 5 min so bursts don't hammer the origin.
    cf: { cacheTtl: 300, cacheEverything: true },
  })
}

// Resolve ?lang=&path= into an absolute upstream URL, or null if the request
// is not one we are willing to make. The allowlist is the security boundary:
// the host comes from a fixed table (never from the caller's string), and the
// path is re-parsed and re-checked after resolution so that traversal ("..")
// or an absolute/protocol-relative path cannot walk us off the REST API.
function relayTarget(params) {
  const host = HOST_BY_LANG[params.get('lang') || 'en']
  const path = params.get('path')
  if (!host || !path || !path.startsWith('/wp-json/wp/v2/')) return null

  let url
  try {
    url = new URL(path, `https://${host}`)
  } catch {
    return null
  }
  if (url.host !== host || !url.pathname.startsWith('/wp-json/wp/v2/')) return null
  return url.toString()
}

// Resolve ?lang=&img= into an absolute media URL, or null if we won't serve it.
// Same allowlist discipline as relayTarget: fixed host table, and the path is
// re-parsed and re-checked so traversal or an off-site path cannot escape the
// media directory.
function imageTarget(params) {
  const host = HOST_BY_LANG[params.get('lang') || 'en']
  const img = params.get('img')
  if (!host || !img || !img.startsWith('/wp-content/uploads/')) return null

  let url
  try {
    url = new URL(img, `https://${host}`)
  } catch {
    return null
  }
  if (url.host !== host || !url.pathname.startsWith('/wp-content/uploads/')) return null
  return url.toString()
}

export default {
  async scheduled(_event, env) {
    if (env.CACHE) await warm(env)
  },

  async fetch(request, env, ctx) {
    const { searchParams } = new URL(request.url)

    // Image mode — relay one media file as bytes (article thumbnails).
    if (searchParams.has('img')) {
      const target = imageTarget(searchParams)
      if (!target) return new Response('forbidden upstream', { status: 400 })

      const res = await fromOrigin(target, 'image/avif,image/webp,image/*,*/*;q=0.8')
      if (!res.ok) return new Response('upstream error', { status: res.status })
      return new Response(res.body, {
        status: 200,
        headers: {
          'content-type': res.headers.get('content-type') || 'image/jpeg',
          // Thumbnails are immutable once published; cache hard at the edge and
          // in the browser so we hit the origin at most once per image.
          'cache-control': 'public, max-age=86400, s-maxage=604800, immutable',
          'access-control-allow-origin': '*',
        },
      })
    }

    // Relay mode — one REST call, passed through as-is.
    if (searchParams.has('path')) {
      const target = relayTarget(searchParams)
      if (!target) return new Response('forbidden upstream', { status: 400 })

      const json = (body, status, source) =>
        new Response(body, {
          status,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=300',
            // Which way this answer came: `kv` (warmed by the cron, immune to
            // the visitor's bot score) or `origin`. Read it from the CI log
            // when a rubric fails — see the comment above WARM_PATHS.
            'x-armradio-source': source,
          },
        })

      const key = kvKey(searchParams.get('lang') || 'en', searchParams.get('path'))
      const hit = env?.CACHE ? await env.CACHE.get(key) : null
      if (hit) return json(hit, 200, 'kv')

      const res = await fromOrigin(target, 'application/json')
      const body = await res.text()
      if (res.ok && env?.CACHE) {
        ctx.waitUntil(env.CACHE.put(key, body, { expirationTtl: KV_TTL }))
      }
      return json(body, res.status, 'origin')
    }

    // Default mode — newswire headlines. Prefer clean JSON from the REST API.
    let res = await fromOrigin(REST, 'application/json')
    if (res.ok) {
      return new Response(await res.text(), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      })
    }
    // Fall back to the RSS feed.
    res = await fromOrigin(FEED, 'application/rss+xml, application/xml;q=0.9')
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  },
}
