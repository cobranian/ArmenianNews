/**
 * TEMPORARY DIAGNOSTIC — not part of the snapshot pipeline.
 *
 * The Armenpress fr/en "armenia" (and "culture") rubrics freeze in the deployed
 * snapshot: from a residential IP the source shows the latest articles, but the
 * CI runner keeps storing an older set (fr/armenia frozen ~4 days behind for 24h+
 * across snapshots), even though the scrape "succeeds" with 10 articles. This is
 * invisible to backfillSections (it only rescues EMPTY sections).
 *
 * The staleness only reproduces from CI's datacenter IP, so this probe fetches
 * the same rubric FOUR ways from the runner and logs the newest article dates,
 * to learn which method (if any) sees fresh data from CI before we build a fix:
 *   plain      — node:https GET (exactly what the scraper does today)
 *   cachebust  — plain + a unique ?_=<n> query param
 *   inertia    — the Inertia JSON endpoint (X-Inertia header + version)
 *   undici     — global fetch() (the client the scraper deliberately avoids)
 *
 * It also prints the runner's public IP and the Cloudflare colo (cf-ray suffix)
 * each request lands on, to compare CI's vantage against a residential one.
 *
 * Run: `node scripts/probe-armenpress.mjs`  (locally or via the probe workflow).
 * Delete this file + .github/workflows/probe.yml once the fix is chosen.
 */
import https from 'node:https'

const HOST = 'armenpress.am'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// node:https GET → { status, headers, body }. Never throws on non-200.
function get(path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        path,
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: '*/*', ...extraHeaders },
        timeout: 20000,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      },
    )
    req.on('timeout', () => req.destroy(new Error(`timeout ${path}`)))
    req.on('error', reject)
    req.end()
  })
}

const colo = (headers) => (headers['cf-ray'] || '?').split('-')[1] || '?'

// Pull the Inertia page object out of full HTML. Armenpress puts the payload in
// the <script data-page> BODY (the attribute itself is just "app"), HTML-entity
// encoded — exactly what scripts/sources/armenpress.mjs reads via cheerio.
function payloadFromHtml(html) {
  const m = html.match(/<script[^>]*\bdata-page\b[^>]*>([\s\S]*?)<\/script>/i)
  if (!m || !m[1]) return null
  try {
    const json = m[1]
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#0?38;|&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    return JSON.parse(json)
  } catch {
    return null
  }
}

// hits → newest 2 { date, title } (published_at is Unix seconds).
function digest(hits) {
  if (!Array.isArray(hits)) return { count: 0, newest: [] }
  const rows = hits
    .filter((h) => h && h.published_at)
    .sort((a, b) => b.published_at - a.published_at)
    .slice(0, 2)
    .map((h) => ({
      date: new Date(h.published_at * 1000).toISOString().slice(0, 16),
      title: String(h.title || '').slice(0, 48),
    }))
  return { count: hits.length, newest: rows }
}

function hitsOf(pageObj) {
  return pageObj?.props?.data?.data?.hits
}

async function methodPlain(lang) {
  const r = await get(`/${lang}/articles/armenia`)
  const p = payloadFromHtml(r.body)
  return { status: r.status, colo: colo(r.headers), ...digest(hitsOf(p)) }
}

async function methodCachebust(lang) {
  const n = process.hrtime.bigint().toString()
  const r = await get(`/${lang}/articles/armenia?_=${n}`)
  const p = payloadFromHtml(r.body)
  return { status: r.status, colo: colo(r.headers), ...digest(hitsOf(p)) }
}

async function methodInertia(lang) {
  // Get the current Inertia asset version from a plain load, then request the
  // JSON endpoint. A version mismatch answers 409 (X-Inertia-Location); a match
  // answers 200 with the same page object as JSON.
  const seed = await get(`/${lang}/articles/armenia`)
  const version = payloadFromHtml(seed.body)?.version || ''
  const r = await get(`/${lang}/articles/armenia`, {
    'X-Inertia': 'true',
    'X-Inertia-Version': version,
    Accept: 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
  })
  let p = null
  if (r.status === 200) {
    try {
      p = JSON.parse(r.body)
    } catch {
      p = null
    }
  }
  return {
    status: r.status,
    colo: colo(r.headers),
    version: version.slice(0, 8),
    ...digest(hitsOf(p)),
  }
}

async function methodUndici(lang) {
  try {
    const res = await fetch(`https://${HOST}/${lang}/articles/armenia`, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
    })
    const body = res.ok ? await res.text() : ''
    const p = payloadFromHtml(body)
    return { status: res.status, colo: colo(Object.fromEntries(res.headers)), ...digest(hitsOf(p)) }
  } catch (e) {
    return { status: `ERR ${e.message}`, colo: '?', count: 0, newest: [] }
  }
}

async function publicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    return (await res.json()).ip
  } catch {
    return '(unknown)'
  }
}

function show(label, r) {
  const head = `    ${label.padEnd(10)} status=${r.status} colo=${r.colo}` +
    (r.version !== undefined ? ` ver=${r.version}` : '') +
    ` hits=${r.count}`
  console.log(head)
  for (const n of r.newest) console.log(`               ${n.date}  ${n.title}`)
}

const main = async () => {
  console.log(`\n=== Armenpress probe — runner public IP: ${await publicIp()} ===`)
  console.log('(compare newest dates per method; fr/en should match hy freshness if a method works)\n')
  for (const lang of ['fr', 'en', 'hy']) {
    console.log(`── ${lang}/armenia ──`)
    show('plain', await methodPlain(lang))
    show('cachebust', await methodCachebust(lang))
    show('inertia', await methodInertia(lang))
    show('undici', await methodUndici(lang))
    console.log('')
  }
  console.log('=== probe done ===\n')
}

main().catch((e) => {
  console.error('probe fatal:', e)
  process.exit(1)
})
