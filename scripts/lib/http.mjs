// Minimal fetch helper with a browser-like UA and retries.
import https from 'node:https'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
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
// likely reason (a TLS/HTTP fingerprint check), and both filter on User-Agent
// too, hence the browser UA below.
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
