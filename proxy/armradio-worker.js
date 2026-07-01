// Always-on proxy for Public Radio of Armenia (en.armradio.am).
//
// Why this exists: en.armradio.am sits behind Cloudflare, which serves an
// intermittent 403 "managed challenge" to datacenter IPs (GitHub Actions
// runners). A Cloudflare Worker runs *inside* Cloudflare's network, so its
// subrequests to the (also-Cloudflare-fronted) origin are not subject to that
// eyeball-IP challenge — giving the hourly scraper a stable path to the feed.
//
// It is NOT an open proxy: the upstreams are fixed to armradio. It prefers the
// clean WordPress REST API (JSON) and falls back to the RSS feed (XML). The
// scraper (scripts/sources/armradio.mjs) auto-detects whichever it returns.
//
// Deploy: paste into a new Worker at dash.cloudflare.com (see proxy/README.md).

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

export default {
  async fetch() {
    // Prefer clean JSON from the REST API.
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
