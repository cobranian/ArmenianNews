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
| **Actualités** | [Armenpress](https://armenpress.am/fr) | The national news agency's latest **16 headlines per language** (fr / en / hy), as a single **Fil / Wire / Հոսք** shelf. **The default tab** — and deliberately so: `NewsBrowser` renders only the active tab, so the default source is what the prerender bakes into the raw HTML for crawlers, and Armenpress is the only source with a real French edition. Armenpress is an Inertia.js app, so its feed arrives as embedded JSON — **no CSS selectors**. Read from the homepage, not the rubric pages (those embed an empty feed and load client-side), with three spaced requests: the site rate-limits hard. |
| **Actualités** | [Le Courrier d'Erevan](https://courrier.am/fr) | The latest **10 articles per section** across the 8 sections (Actualités, Société, Économie, Arts et culture, Arménie francophone, Opinions, Région, Diasporas), each shown as a horizontal, swipeable **shelf** with ‹ › arrow controls. Cards link out to the original article. |
| **Actualités** | [Nouvelles d'Arménie](https://www.armenews.com) | The latest **10 articles per rubric** across 6 WordPress rubrics, French-only, as shelves. |
| **Actualités** | [Artzakank / Écho des Arméniens de Suisse](https://artzakank-echo.ch) | The latest **10 articles per rubric** across 2 WordPress rubrics, French-only, as shelves. |
| **Actualités** | [ArménieInfo.tv](https://armenieinfo.tv) | The latest **10 articles per rubric**, French-only, as shelves. |
| **Newswire** | [Public Radio of Armenia](https://en.armradio.am/) | English headlines as a live marquee ticker. Fetched through a **multi-tier source chain** (proxy → REST API → RSS feed → Google News) because armradio.am sits behind Cloudflare, which intermittently 403s CI datacenter IPs — see [Newswire source chain](#newswire-source-chain-armradio). |
| **Agenda** | [Armenopole](https://armenopole.com) (Switzerland + a set of world countries) + [Arméniens de Lausanne](https://armeniensdelausanne.ch) recurring classes | Two horizontal, swipeable **carousels** with ‹ › arrow controls — 🇨🇭 Suisse and 🌍 Monde — each event a date-plaqued card. Recurring Lausanne classes listed below. |
| **Don Narek** | [facebook.com/DonNarek](https://www.facebook.com/DonNarek) | A swipeable **carousel** (‹ › arrows) of the **latest 30 posts**, each a card showing **only the post's picture and its author** — no Facebook page chrome/cover. Curated by hand (see below); cards link out to the real post. |
| **Instagram** | 8 curated accounts | A swipeable **carousel** (‹ › arrows) of post tiles. The **9 latest posts** of each account are harvested by a local script (see [Refreshing the Instagram pool](#refreshing-the-instagram-pool)); which of them show, and in what order, is **re-randomised every hour** by the snapshot job. |

Each source **fails independently and degrades gracefully**: on an empty/failed
scrape, the orchestrator backfills that source from the previous snapshot
instead of blanking it, so a transient upstream failure never wipes a section.

## Develop

```bash
npm install
npm run scrape      # refresh src/data/{news,agenda,meta,instagram-feed}.json from the live sources
npm run ig-scrape   # refresh the Instagram pool (local, logged-in Chrome — never in CI)
npm run fb-scrape   # refresh the Don Narek wall (local, logged-in Chrome — never in CI; needs -- --connect)
npm run dev         # http://localhost:5173/
npm run build       # production build into dist/
npm run preview
npm run screenshot  # after build: capture the Don Narek carousel into dist/don-narek-{desktop,mobile}.png
```

`npm run scrape` refreshes **news + agenda**, and re-randomises the **Instagram
selection** (`instagram-feed.json`) from the pool. It never touches the pool
itself.

The two social walls are refreshed by **manual, local, logged-in-session steps**
— `npm run ig-scrape` (Instagram) and `npm run fb-scrape` (Don Narek) — because
both networks block CI datacenter IPs. Neither runs hourly; see below.

## Curating the social feeds

### Instagram — `src/data/instagram.json`

Instagram blocks scraping from CI, so the post **pool** is built locally by
`npm run ig-scrape` (see [Refreshing the Instagram
pool](#refreshing-the-instagram-pool)). The **account list** is hand-curated and
the scraper never touches it; each account's **posts** are harvested — currently
**8 accounts × 9 posts = 72**. The hourly job shuffles that pool into
`instagram-feed.json` (a fresh random selection + order each hour); the carousel
renders from it.

Each post is a `{url, date}` pair, the date being the post's real timestamp:

```json
{
  "handle": "armeniancuisine",
  "name": "Armenian Cuisine",
  "url": "https://www.instagram.com/armeniancuisine/",
  "posts": [
    { "url": "https://www.instagram.com/p/ABC123/", "date": "2026-07-12T04:51:48.000Z" },
    { "url": "https://www.instagram.com/reel/DEF456/", "date": "2026-07-09T18:02:11.000Z" }
  ]
}
```

**To add a post by hand** (the harvest will overwrite it on the next run, so this
is for one-offs): add a `{url, date}` entry to the matching account's `posts`
array, and *(optional, for a real photo)* save the post's image as
`src/data/ig/<shortcode>.jpg` — the shortcode is the code after `/p/`, `/reel/`
or `/tv/` (e.g. `ABC123.jpg`). It's bundled at build time, so it never hotlinks
or expires. **Without an image, the tile shows a deterministic Armenian motif**
(still on-brand) — so a permalink alone is enough.

**To add an account**, add it to the `accounts` array by hand, then re-run the
harvest to populate its posts. Note that an Instagram handle **cannot contain a
hyphen** — a handle with one (e.g. `armenian-trend`) 404s and the account is
dropped from the run.

The snapshot selects up to **30** posts per hour (`selectInstagram(30)` in
`scripts/sources/instagram.mjs`); bump that number if the pool grows well beyond
30. Accounts with no posts simply appear as a profile chip linking to Instagram.

### Facebook (Don Narek) — `src/data/facebook.json`

Facebook blocks automated scraping and the official Page Plugin drags in the
whole page shell (cover, header, Like box), so the Don Narek wall is a curated
carousel — populated by a local scraper (see [Refreshing Don
Narek](#refreshing-don-narek) below) or by hand — that shows **only each post's
picture and its author**.

**To add a post by hand:** put a new entry at the **top** of the `posts` array (newest
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

### Refreshing Don Narek

Facebook can't be scraped from CI (it requires a logged-in session and blocks
datacenter IPs), so refreshing the **post content** is a **manual local step**
— unlike news/agenda, it does *not* run hourly. `npm run fb-scrape` drives
your own logged-in Chrome to read the public profile, keeps only the posts under
Facebook's **"Other posts"** heading (skips pinned/featured), opens each post
for its full-resolution image, and rewrites `src/data/fb/*.jpg` +
`facebook.json` (newest first, capped at 30). Images are downloaded **through the
logged-in tab** (not an anonymous fetch), so Facebook's session-gated CDN
variants come back as the real photo instead of a placeholder.

```bash
# 1. Launch a dedicated Chrome with remote debugging + its own profile.
#    (Separate from your everyday Chrome — no profile-lock clash.)
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir=".cache/fb-chrome-profile" \
  https://www.facebook.com/login

# 2. Log into Facebook in that window (ONE time — the session persists in
#    .cache/, which is gitignored, so cookies never get committed).

# 3. Scrape (attaches to that Chrome via the debug port):
npm run fb-scrape -- --connect --dry   # preview what it finds, writes nothing
npm run fb-scrape -- --connect         # download images + rewrite facebook.json

# 4. Verify, then publish:
npm run build && npm run screenshot           # eyeball dist/don-narek-*.png
git add src/data/facebook.json src/data/fb/dn-*.jpg && git commit && git push
```

Notes:
- The one-time login persists across runs — later refreshes are just steps 1, 3, 4.
- Posts with no downloadable image keep the on-brand Armenian motif fallback.
- Facebook's markup is obfuscated, so the scraper is **best-effort**; if a
  redesign breaks it, the selectors in `scripts/fb-scrape.mjs` may need updating.
- `--connect` requires the debug Chrome to be running; without it the script
  launches its own (logged-out) Chrome, which Facebook redirects to a login wall.

### Refreshing the Instagram pool

The hourly job only **re-shuffles** the pool: without a harvest, the wall re-serves
the same posts forever *while looking fresh*. Re-run this every few weeks.

Instagram can't be scraped from CI (it requires a logged-in session and blocks
datacenter IPs), so — exactly like Don Narek — the harvest is a **manual local
step**. `scripts/ig-scrape.mjs` drives your own logged-in Chrome and calls
Instagram's profile-grid feed from *inside* the logged-in page: one request per
account, which keeps it under Instagram's rate limiter and yields exact
timestamps.

```bash
# 1. Launch a dedicated Chrome with remote debugging + its own profile.
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir=".cache/ig-chrome-profile" \
  https://www.instagram.com/

# 2. Log into Instagram in that window (ONE time — the session persists in
#    .cache/, which is gitignored, so cookies never get committed).

# 3. Harvest (attaches to that Chrome via the debug port):
npm run ig-scrape -- --connect --dry   # report what it finds, writes nothing
npm run ig-scrape -- --connect         # download images + rewrite the pool

# 4. Verify, then publish:
npm run scrape && npm run build
git add src/data/instagram.json src/data/instagram-feed.json src/data/ig && git commit && git push
```

It rewrites `src/data/instagram.json` with the **9 latest posts** of each account
(dated, newest first) plus their images in `src/data/ig/`, and deletes images no
post points at any more. A failing account **keeps its previous posts**; if *no*
account succeeds, nothing is written and it exits non-zero — an intact pool beats
a gutted one.

Notes:
- Without a logged-in session the script stops up front (`✗ Not logged in`)
  rather than reporting eight independent failures.
- **The wall's freshness is capped by how active the accounts actually are.** Two
  of the eight are dormant — `ig_armenia` hasn't posted since **June 2023**,
  `armeniancuisine` since **November 2025** — so their old posts show up on the
  wall and *no amount of re-harvesting will change that*: the script faithfully
  reports what the account publishes. To genuinely freshen the wall, **remove or
  replace those accounts by hand** in the `accounts` array. This is a deliberate
  editorial choice, not a bug.
- It calls the profile-grid feed (`/api/v1/feed/user/<handle>/username/`), **not**
  `web_profile_info`. The latter is the endpoint every guide online suggests, and
  it's a trap: it still answers `200` with the account's bio and post *count*, but
  its `edges` array comes back **empty** — which reads as a working call that found
  no posts, rather than as a breakage. Don't "fix" the script by switching to it.
- Instagram's markup and endpoints shift; if a run starts returning
  `unexpected payload shape`, the endpoint moved — fix it there, don't fall back
  to scraping the DOM.

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
  then REST/RSS/Google News fallbacks); the Instagram pool is harvested **locally**
  ([`npm run ig-scrape`](#refreshing-the-instagram-pool)), like Don Narek.
- GitHub Actions scheduled runs can be delayed a few minutes under load — the
  snapshot is hourly but not necessarily exactly on `:00`.
- Content (articles, posts) stays in its original language; only the interface
  chrome is translated.
