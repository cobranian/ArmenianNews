// HTTPS proxy for Radio Yeraz's HTTP-only Shoutcast stream.
//
// Why this exists: Radio Yeraz only publishes its stream over plain HTTP
// (http://149.255.60.194:8008/stream). The site is served over HTTPS, so the
// browser would block that stream as mixed content. A Cloudflare Worker runs
// over HTTPS and re-streams the audio with CORS, so the native <audio> player
// (and its Web Audio spectrum) can use it.
//
// The upstream is the stream server's hostname, NOT its raw IP (149.255.60.194):
// Cloudflare Workers refuse fetch() to a raw IP with "error 1003 — direct IP
// access not allowed", but the hostname on port 8008 is fine. The raw IP
// reverse-resolves to streaming05.liveboxstream.uk.
//
// It is NOT an open proxy: the upstream is fixed to Radio Yeraz.
//
// Deploy:  cd proxy && npx wrangler deploy -c wrangler-yeraz.toml
// (auth once with `npx wrangler login`). Publishes to
// https://radio-yeraz-proxy.<your-subdomain>.workers.dev

const UPSTREAM = 'http://streaming05.liveboxstream.uk:8008/stream'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': '*',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }
    // Fetch the upstream Shoutcast stream. No Icy-MetaData header, so the server
    // sends a clean audio body with no in-band metadata to corrupt playback.
    const upstream = await fetch(UPSTREAM, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; radio-yeraz-proxy/1.0)' },
    })

    // Stream the body straight through with CORS + the right audio type.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS,
        'content-type': upstream.headers.get('content-type') || 'audio/mpeg',
        'cache-control': 'no-cache, no-store, must-revalidate',
      },
    })
  },
}
