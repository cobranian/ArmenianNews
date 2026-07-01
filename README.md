# Arménie Info · Արմենիա Ինֆո

An **hourly snapshot** of Armenian life — news, events, and social media — in a
dark *"Apricot Press"* broadsheet aesthetic (volcanic basalt lit by apricot, the
heraldic orange of the Armenian flag), with a **day / night** toggle. Trilingual
interface: **Français / English / Հայերեն**.

A scheduled job scrapes the sources once an hour into JSON; the site is a static
Vite + React app that renders those files. No backend at runtime.

**Live:** https://armenie-info.web.app

## Sections

| Section | Source | How |
|---|---|---|
| **Actualités** | [Le Courrier d'Erevan](https://courrier.am/fr) | The latest **10 articles per section** across the 8 sections (Actualités, Société, Économie, Arts et culture, Arménie francophone, Opinions, Région, Diasporas), each shown as a horizontal, swipeable **shelf** with ‹ › arrow controls. Cards link out to the original article. |
| **Newswire** | [Public Radio of Armenia](https://en.armradio.am/) | English headlines as a live marquee ticker. Fetched through a **multi-tier source chain** (proxy → REST API → RSS feed → Google News) because armradio.am sits behind Cloudflare, which intermittently 403s CI datacenter IPs — see [Newswire source chain](#newswire-source-chain-armradio). |
| **Agenda** | [Armenopole](https://armenopole.com) (Switzerland + a set of world countries) + [Arméniens de Lausanne](https://armeniensdelausanne.ch) recurring classes | Two horizontal, swipeable **carousels** with ‹ › arrow controls — 🇨🇭 Suisse and 🌍 Monde — each event a date-plaqued card. Recurring Lausanne classes listed below. |
| **Don Narek** | [facebook.com/DonNarek](https://www.facebook.com/DonNarek) | A swipeable **carousel** (‹ › arrows) of the **latest 10 posts**, each a card showing **only the post's picture and its author** — no Facebook page chrome/cover. Curated by hand (see below); cards link out to the real post. |
| **Instagram** | 9 curated accounts | A swipeable **carousel** (‹ › arrows) of curated post tiles. Which posts show, and in what order, is **re-randomised every hour** by the snapshot job. |

Each source **fails independently and degrades gracefully**: on an empty/failed
scrape, the orchestrator backfills that source from the previous snapshot
instead of blanking it, so a transient upstream failure never wipes a section.

## Develop

```bash
npm install
npm run scrape      # refresh src/data/{news,agenda,meta,instagram-feed}.json from the live sources
npm run dev         # http://localhost:5173/
npm run build       # production build into dist/
npm run preview
npm run screenshot  # after build: capture the Don Narek carousel into dist/don-narek-{desktop,mobile}.png
```

`npm run scrape` refreshes **news + agenda**, and re-randomises the **Instagram
selection** (`instagram-feed.json`) from the curated pool. The Instagram post
**pool** (`instagram.json`) and Facebook data are curated by hand (see below) and
are never overwritten.

## Curating the social feeds

### Instagram — `src/data/instagram.json`

Instagram blocks automated scraping, so the post **pool** is a hand-curated list
of permalinks. The hourly job shuffles that pool into `instagram-feed.json` (a
fresh random selection + order each hour); the carousel renders from it.

**To add a post:**

1. Open the post on instagram.com and copy its URL
   (`https://www.instagram.com/p/XXXXXXX/` or `/reel/XXXXXXX/`).
2. Paste it into the matching account's `permalinks` array.

```json
{
  "handle": "armeniancuisine",
  "url": "https://www.instagram.com/armeniancuisine/",
  "permalinks": [
    "https://www.instagram.com/p/ABC123/",
    "https://www.instagram.com/reel/DEF456/"
  ]
}
```

3. *(Optional, for a real photo)* save the post's image as
   `src/data/ig/<shortcode>.jpg` — the shortcode is the code after `/p/`,
   `/reel/` or `/tv/` (e.g. `ABC123.jpg`). It's bundled at build time, so it
   never hotlinks or expires. **Without an image, the tile shows a deterministic
   Armenian motif** (still on-brand) — so a permalink alone is enough.

The snapshot selects up to **30** posts per hour (`selectInstagram(30)` in
`scripts/sources/instagram.mjs`); bump that number if the pool grows beyond 30.
Accounts with no permalinks simply appear as a profile chip linking to Instagram.

### Facebook (Don Narek) — `src/data/facebook.json`

Facebook blocks automated scraping and the official Page Plugin drags in the
whole page shell (cover, header, Like box), so the Don Narek wall is a
hand-curated carousel that shows **only each post's picture and its author**.

**To add a post:** put a new entry at the **top** of the `posts` array (newest
first — only the first 10 are shown):

```json
{ "id": "dn-11", "author": "Don Narek", "url": "https://www.facebook.com/DonNarek/posts/…", "image": "my-photo.jpg" }
```

- `id` — any stable, unique string (also seeds the fallback motif).
- `author` — the person who made the post (shown as a gilded monogram + name).
- `url` — the post permalink (the card links out to it).
- `image` *(optional)* — a file dropped in `src/data/fb/` (`.jpg/.jpeg/.png/.webp`).
  It's bundled at build time, so it never hotlinks or expires. **Without an
  image, the card shows a deterministic Armenian motif** (still on-brand) — so a
  permalink alone is enough.

An up-to-date **preview of the carousel** is regenerated every hour by the
deploy (`scripts/shoot.mjs`, driven by `browser-actions/setup-chrome`) and
published alongside the site at
[`/don-narek-desktop.png`](https://armenie-info.web.app/don-narek-desktop.png)
and [`/don-narek-mobile.png`](https://armenie-info.web.app/don-narek-mobile.png).
It writes into `dist/` (gitignored), so hourly image churn never enters git
history. Run `npm run build && npm run screenshot` to regenerate it locally.

## Newswire source chain (armradio)

`en.armradio.am` is a WordPress site behind Cloudflare, which serves an
**intermittent 403 "managed challenge"** to datacenter IPs (GitHub Actions
runners). `scripts/sources/armradio.mjs` therefore tries several sources in
order and uses the first that responds — the log prints which one won
(`✓ armradio (N headlines via <source>)`):

| Order | Source | Notes |
|---|---|---|
| 1 | **Cloudflare Worker proxy** (`ARMRADIO_PROXY`) | Always-on; runs *inside* Cloudflare's network so it isn't challenged. Optional — skipped if the env var is unset. |
| 2 | **WordPress REST API** (`/wp-json`) | Clean JSON, real permalinks. Usually 403s from CI. |
| 3 | **Direct RSS feed** (`/feed/`) | Richest, but often 403s from CI. |
| 4 | **Google News RSS** | Always reachable, but lags and drops the freshest items. |

The proxy is what makes the wire fresh **every** hour instead of only the hours
CI happens to get through. It's a small Cloudflare Worker — code and one-time
setup are in [`proxy/`](./proxy/). Once deployed, its URL is stored in the
`ARMRADIO_PROXY` **repo variable** and passed to the scrape step by the workflow.

To (re)deploy the worker after editing `proxy/armradio-worker.js`:

```bash
cd proxy
npx wrangler login      # once
npx wrangler deploy     # prints https://armradio-proxy.<subdomain>.workers.dev
```

## Deployment (GitHub Actions → Firebase Hosting)

`.github/workflows/hourly.yml` runs **every hour** on the hour (UTC), plus on
manual dispatch and on push to `main`:

- **Schedule / manual run** → scrape + commit the refreshed data + build + deploy
  (exactly one snapshot per hour).
- **Push to `main`** → build + deploy only (no snapshot), so code changes go live
  without creating an extra snapshot.

The site deploys to **Firebase Hosting** (project `armenie-info`,
https://armenie-info.web.app). The Firebase service-account JSON is stored in the
`FIREBASE_SERVICE_ACCOUNT` repo secret.

**CI configuration:**

| Name | Kind | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | secret | Firebase Hosting deploy credentials. |
| `ARMRADIO_PROXY` | variable | URL of the armradio Cloudflare Worker proxy (see [Newswire source chain](#newswire-source-chain-armradio)). Optional — the scraper falls back without it. |

Vite `base` defaults to `/` (Firebase serves from the domain root); override with
`BASE_PATH=/subpath` when building for a subpath.

## Notes & caveats

- Scrapers depend on the source sites' current HTML; if a site redesigns, the
  matching scraper in `scripts/sources/` may need new selectors.
- `armradio.am` and Instagram are both blocked from CI datacenter IPs
  (Cloudflare / anti-scraping). The newswire works around this with the
  [source chain](#newswire-source-chain-armradio) (Cloudflare Worker proxy first,
  then REST/RSS/Google News fallbacks); the Instagram pool is curated by hand.
- GitHub Actions scheduled runs can be delayed a few minutes under load — the
  snapshot is hourly but not necessarily exactly on `:00`.
- Content (articles, posts) stays in its original language; only the interface
  chrome is translated.
