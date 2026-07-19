// Always-on proxy for Asbarez — the LA Armenian daily, two editions:
//   • asbarez.com  (English, WordPress REST)
//   • asbarez.am   (Western Armenian, per-category RSS)
//
// Why this exists: Asbarez is NOT behind Cloudflare (Server: Apache), but its
// server-side WAF still 403s datacenter IP ranges — including GitHub Actions
// runners. It works from a residential IP and fails from CI, so the hourly
// scraper gets nothing and the news tab silently empties. A Cloudflare Worker
// egresses from Cloudflare's own IPs, which the WAF does not block, giving the
// scraper a stable path. The origin ALSO filters by User-Agent (403 to Node's
// default UA), so subrequests carry a real browser UA.
//
// One relay mode:
//   GET /?ed=en&path=/wp-json/wp/v2/…          → one WordPress REST call (JSON)
//   GET /?ed=hy&path=/archives/category/…/feed/ → one category RSS feed (XML)
//
// It is NOT an open proxy: `ed` selects between two fixed hosts (never the
// caller's string), and `path` must resolve to an allowlisted prefix on that
// host, re-checked after resolution so traversal or an off-site path cannot
// walk us elsewhere.
//
// Deploy:  cd proxy && npx wrangler deploy -c wrangler-asbarez.toml

const HOST_BY_ED = {
  en: 'asbarez.com',
  hy: 'asbarez.am',
}

// The single path prefix each edition is allowed to reach.
const PREFIX_BY_ED = {
  en: '/wp-json/wp/v2/',
  hy: '/archives/',
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function fromOrigin(url, accept) {
  return fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: accept,
      'Accept-Language': 'en,hy;q=0.8,fr;q=0.5',
    },
    // Cache at the edge for 5 min so bursts don't hammer the origin.
    cf: { cacheTtl: 300, cacheEverything: true },
  })
}

// Resolve ?ed=&path= into an absolute upstream URL, or null if we won't make it.
// The allowlist is the security boundary: the host comes from a fixed table
// (never the caller's string), and the path is re-parsed and re-checked after
// resolution so traversal ("..") or an absolute/protocol-relative path cannot
// walk us off the allowed prefix.
function relayTarget(params) {
  const ed = params.get('ed') || 'en'
  const host = HOST_BY_ED[ed]
  const prefix = PREFIX_BY_ED[ed]
  const path = params.get('path')
  if (!host || !path || !path.startsWith(prefix)) return null

  let url
  try {
    url = new URL(path, `https://${host}`)
  } catch {
    return null
  }
  if (url.host !== host || !url.pathname.startsWith(prefix)) return null
  return { url: url.toString(), ed }
}

export default {
  async fetch(request) {
    const { searchParams } = new URL(request.url)
    const target = relayTarget(searchParams)
    if (!target) return new Response('forbidden upstream', { status: 400 })

    const isJson = target.ed === 'en'
    const res = await fromOrigin(
      target.url,
      isJson ? 'application/json' : 'application/rss+xml, application/xml;q=0.9',
    )
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        'content-type': isJson
          ? 'application/json; charset=utf-8'
          : 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'access-control-allow-origin': '*',
      },
    })
  },
}
