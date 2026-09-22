# armradio proxy (Cloudflare Worker)

Public Radio of Armenia (`en.armradio.am`) is behind Cloudflare, which serves
an intermittent **403 managed challenge** to datacenter IPs — including GitHub
Actions runners. That made the hourly scraper fall back to Google News, which
lags and drops the freshest Armenia headlines.

A **Cloudflare Worker** runs inside Cloudflare's own network, so its request to
the (also-Cloudflare-fronted) origin isn't hit by that challenge. The worker
gives the scraper a stable path to the feed. `scripts/sources/armradio.mjs`
tries it first (via the `ARMRADIO_PROXY` env var) and still falls back to the
REST API → direct feed → Google News if it's unset or fails.

The worker answers two kinds of request:

| Request | Serves |
| --- | --- |
| `GET /` | the newswire headlines (REST, falling back to RSS) |
| `GET /?lang=en&path=/wp-json/wp/v2/…` | one WordPress REST call, relayed verbatim (`lang` = `en` \| `hy` \| `ru`) |

The **relay** is what the per-rubric news feed needs: the origin 403s
`/wp-json/wp/v2/categories` and `/wp-json/wp/v2/posts?categories=<id>` from CI,
and a rubric that fails is backfilled from the previous snapshot — so without
the relay every rubric silently freezes on its last good day. It is not an open
proxy: `lang` picks between three fixed hosts (`en`/`hy`/`ru`.armradio.am) and
`path` must resolve to a WordPress REST path on that host.

> **Upgrading:** a worker deployed before the relay existed ignores `?path` and
> answers every request with the headlines. Redeploy it (step 4 below) after
> pulling this change. The scraper checks that returned posts really carry the
> rubric it asked for, so a stale worker leaves rubrics empty rather than
> filling them all with the same articles — but they stay stale until you
> redeploy.

## Cron + KV: why the relay is served from a cache (September 2026)

Being inside Cloudflare's network stopped being enough. Measured on 22
September 2026 with the manual `diag` workflow (`gh workflow run diag.yml`,
curl only, ~30 s): called from a GitHub runner, `?lang=…&path=/wp-json/…`
returns the origin's **JavaScript challenge** (« Just a moment… », no
`cf-mitigated` header because the Worker only copies status and body), while
`?path=/nope` returns the Worker's own 400 and `/` returns 200 — so the Worker
is reached, and only its upstream call is refused. The very same relay URL
returns 200 from a residential IP. Cloudflare carries the visitor's identity
(IP, bot score) into orange-to-orange subrequests, and there is nothing the
Worker can put in its own request to undo that.

A **Cron Trigger has no visitor**. Every ten minutes `scheduled()` fetches the
22 REST responses the scraper asks for and stores them in a **KV namespace**
(`CACHE`, one-hour TTL); the relay answers from KV first and goes upstream only
on a miss. The response header `x-armradio-source: kv | origin` says which way
an answer came.

One-time setup, from this directory:

```bash
npx wrangler login                          # interactive, once
npx wrangler kv namespace create CACHE      # prints the namespace id
#   → paste the id into wrangler.toml ([[kv_namespaces]] … id = "…")
npx wrangler deploy
```

Deploying with the placeholder id **fails on purpose**: without KV the Worker
silently behaves as before, and ArmRadio stays frozen from the CI. To verify,
wait ten minutes (first cron), then `gh workflow run hourly.yml` and look for
`✓ armradio/en/politics (10)` — or from any machine:

```bash
curl -sI "$ARMRADIO_PROXY/?lang=hy&path=%2Fwp-json%2Fwp%2Fv2%2Fposts%3Fcategories%3D12%26per_page%3D10%26_embed%3D1" | grep x-armradio-source
```

## One-time setup (dashboard, no CLI)

1. Create a free account at <https://dash.cloudflare.com> (no domain needed).
2. **Compute (Workers)** → **Create** → **Create Worker**.
3. Name it e.g. `armradio-proxy` → **Deploy**.
4. **Edit code** → delete the sample → paste the contents of
   [`armradio-worker.js`](./armradio-worker.js) → **Deploy**.
5. Copy the Worker URL, e.g. `https://armradio-proxy.<your-subdomain>.workers.dev`.
6. Open it in a browser — you should see the armradio JSON. If you do, it works.

## Wire it into the hourly job

Add the URL as a **repository variable** named `ARMRADIO_PROXY`
(GitHub → repo **Settings** → **Secrets and variables** → **Actions** →
**Variables** → **New repository variable**), or via the CLI:

```bash
gh variable set ARMRADIO_PROXY --body "https://armradio-proxy.<your-subdomain>.workers.dev"
```

The workflow (`.github/workflows/hourly.yml`) already passes it to the scraper.
Nothing else to change. To verify, run the job manually and check the log line
`✓ armradio (… headlines via proxy)`:

```bash
gh workflow run hourly.yml
```

## Local test

```bash
ARMRADIO_PROXY="https://armradio-proxy.<your-subdomain>.workers.dev" npm run scrape
```

---

# asbarez proxy (Cloudflare Worker)

Asbarez — the LA Armenian daily — has an English edition (`asbarez.com`,
WordPress REST) and a Western Armenian one (`asbarez.am`, per-category RSS).
Both work from a residential IP but **403 datacenter ranges** via a server-side
WAF (there is no Cloudflare here — `Server: Apache`). From GitHub Actions the
hourly scraper therefore gets nothing, and `buildSources` drops the empty
source, so the Asbarez tab silently vanishes.

A **Cloudflare Worker** egresses from a Cloudflare IP the WAF does not block
(verified: all relays return 200). `scripts/sources/asbarez.mjs` routes every
scrape request through it when `ASBAREZ_PROXY` is set. Unlike armradio there is
**no direct fallback** — without the proxy the feed cannot be scraped from CI at
all — so the variable is effectively required.

The worker relays one request at a time, allowlisted per edition:

| Request | Serves |
| --- | --- |
| `GET /?ed=en&path=/wp-json/wp/v2/…` | one WordPress REST call on `asbarez.com` (JSON) |
| `GET /?ed=hy&path=/archives/category/…/feed/` | one category RSS feed on `asbarez.am` (XML) |

`ed` picks between the two fixed hosts (never the caller's string) and `path`
must resolve to the edition's allowlisted prefix (`/wp-json/wp/v2/` for `en`,
`/archives/` for `hy`). The worker sends a real Chrome UA — the origin 403s
non-browser UAs on top of the IP block.

## Deploy

```bash
cd proxy && npx wrangler deploy -c wrangler-asbarez.toml
```

Then register the Worker URL as a repository variable (the hourly workflow
already passes it to the scraper):

```bash
gh variable set ASBAREZ_PROXY --body "https://asbarez-proxy.<your-subdomain>.workers.dev"
```

Verify a relay directly (should return JSON):

```bash
curl "https://asbarez-proxy.<your-subdomain>.workers.dev/?ed=en&path=%2Fwp-json%2Fwp%2Fv2%2Fposts%3Fper_page%3D1"
```

## Local test

```bash
ASBAREZ_PROXY="https://asbarez-proxy.<your-subdomain>.workers.dev" npm run scrape
```
