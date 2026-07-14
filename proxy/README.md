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
| `GET /?lang=en&path=/wp-json/wp/v2/…` | one WordPress REST call, relayed verbatim |

The **relay** is what the per-rubric news feed needs: the origin 403s
`/wp-json/wp/v2/categories` and `/wp-json/wp/v2/posts?categories=<id>` from CI,
and a rubric that fails is backfilled from the previous snapshot — so without
the relay every rubric silently freezes on its last good day. It is not an open
proxy: `lang` picks between two fixed hosts and `path` must resolve to a
WordPress REST path on that host.

> **Upgrading:** a worker deployed before the relay existed ignores `?path` and
> answers every request with the headlines. Redeploy it (step 4 below) after
> pulling this change. The scraper checks that returned posts really carry the
> rubric it asked for, so a stale worker leaves rubrics empty rather than
> filling them all with the same articles — but they stay stale until you
> redeploy.

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
