// Minimal fetch helper with a self-identifying UA and retries.
import https from 'node:https'

// The UA must NOT claim a versioned browser ("Chrome/124.0"…), and this is the
// single most expensive line of the scrapers. From 9 September 2026, Cloudflare
// answers 403 on armenpress.am, civilnet.am and every news.am host to any UA
// that says "Chrome" without Chrome's TLS fingerprint — which Node never has,
// undici or node:https alike. The same UA also drew intermittent 403s from the
// ArmRadio Worker (workers.dev sits behind Cloudflare too), from the CI's
// datacenter IPs only. A UA that claims no browser passes on all eleven hosts
// of this repo, each through the client its module uses (measured 22 September
// 2026). It does NOT lift the undici/node:https split below: with this UA,
// undici still gets 403 on the three Cloudflare hosts and node:https 200.
//
// Nothing else guards this: a browser UA passes lint, tests and build, and
// backfillSections then re-serves the previous snapshot over every 403. The
// site showed thirteen days of frozen wires before a reader noticed.
// test/http-ua.test.mjs pins the rule.
export const UA = 'Mozilla/5.0 (compatible; ArmenieInfo/1.0; +https://armenieinfo.ch)'

// Why a 4xx happened, in the error itself. « HTTP 403 for <url> » is what the
// CI log said for two weeks of ArmRadio failures, and it cannot tell a
// Cloudflare challenge (`cf-mitigated: challenge`) from an upstream WAF or a
// Worker error — three different fixes. Headers plus the first bytes of the
// body, tags stripped, are enough to tell them apart from the log alone.
async function describe(res) {
  const hdr = ['cf-mitigated', 'server', 'cf-ray']
    .map((h) => (res.headers.get(h) ? `${h}=${res.headers.get(h)}` : null))
    .filter(Boolean)
    .join(' ')
  let body = ''
  try {
    body = (await res.text())
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160)
  } catch {
    /* a body we cannot read is not worth a second failure */
  }
  return ` [${hdr}${body ? ` « ${body} »` : ''}]`
}

export async function fetchText(url, { retries = 2, timeout = 20000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr,en;q=0.8,hy;q=0.5',
        },
        signal: ctrl.signal,
        redirect: 'follow',
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}${await describe(res)}`)
      return await res.text()
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }
  throw lastErr
}

// Same GET, over node:https instead of fetch — and that difference is the whole
// point, not a style preference.
//
// Two sources here answer **403 to Node's global fetch (undici)** and **200 to
// node:https**: armenpress.am's rubric pages and every civilnet.am page. Same
// machine, same OpenSSL TLS, same HTTP/1.1, any headers — header names, casing,
// Accept*, and sec-fetch-* were ruled out one at a time on armenpress; only the
// client itself predicts the 403. Both sit behind Cloudflare, which is the most
// likely reason (a TLS/HTTP fingerprint check). They filter on User-Agent too,
// but the other way round from what one expects: a *browser* UA is what gets
// blocked (see UA above). news.am's four hosts joined them in September 2026.
//
// Moving either caller to fetchText 403s every page, and the empty result is
// then silently backfilled from the previous snapshot — it reads as "the site
// went quiet", not as a scraper failure. Do not "simplify" it away.
export function fetchTextNode(host, path, { retries = 2, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host, path, method: 'GET', headers: { 'User-Agent': UA, Accept: '*/*' }, timeout },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${path}`))
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve(body))
      },
    )
    req.on('timeout', () => req.destroy(new Error(`timeout for ${path}`)))
    req.on('error', async (err) => {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 600))
        try {
          resolve(await fetchTextNode(host, path, { retries: retries - 1, timeout }))
        } catch (e) {
          reject(e)
        }
      } else reject(err)
    })
    req.end()
  })
}
