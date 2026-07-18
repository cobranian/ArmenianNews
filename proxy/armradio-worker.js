// Always-on proxy for Public Radio of Armenia (en/hy/ru.armradio.am).
//
// Why this exists: armradio.am sits behind Cloudflare, which serves an
// intermittent 403 "managed challenge" to datacenter IPs (GitHub Actions
// runners). A Cloudflare Worker runs *inside* Cloudflare's network, so its
// subrequests to the (also-Cloudflare-fronted) origin are not subject to that
// eyeball-IP challenge — giving the hourly scraper a stable path to the feed.
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
  async fetch(request) {
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

      const res = await fromOrigin(target, 'application/json')
      return new Response(await res.text(), {
        status: res.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      })
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
