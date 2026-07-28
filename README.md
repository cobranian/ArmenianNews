# Arménie Info · Armenia News · Արմենիա Ինֆո

An **hourly snapshot** of Armenian life — news, events, and social media —
served as **two showcases from one codebase**: **Arménie Info**
(armenieinfo.ch, French) and **Armenia News** (armenianews.org, English +
Armenian `/hy/` + Russian `/ru/`). Same dark *"Apricot Press"* broadsheet
aesthetic on both (volcanic basalt lit by apricot, the heraldic orange of the
Armenian flag), same **day / night** toggle. Combined, the two domains cover
four languages: **Français / English / Հայերեն / Русский** — see [The two
domains](#the-two-domains) below.

A scheduled job scrapes the sources once an hour into JSON; `npm run build`
renders that data into two static Vite + React bundles (`dist/ch/`,
`dist/org/`). No backend at runtime.

**Live:** https://armenieinfo.ch (French) · https://armenianews.org
(English / Հայերեն / Русский)

## Sections

| Section | Source | How |
|---|---|---|
| **Actualités** | [Le Courrier d'Erevan](https://courrier.am/fr) | The latest **10 articles per section** across the 8 sections (Actualités, Société, Économie, Arts et culture, Arménie francophone, Opinions, Région, Diasporas), each shown as a horizontal, swipeable **shelf** with ‹ › arrow controls. Cards link out to the original article. Not the default tab (see Armenpress) — French-only, so it only appears under the fr UI. |
| **Actualités** | [Armenpress](https://armenpress.am/fr) | The national news agency: the latest **10 articles per rubric** across **7 rubrics** (Armenia, Economy, World, Culture, Sports, Fact Check, Exclusive Projects), in **each of 4 languages** (fr / en / hy / ru) — 280 articles per snapshot, each rubric its own shelf. The only source here that is **quadrilingual**: fr/en/hy/ru map 1:1 to the UI language, and rubric names come from Armenpress' own labels (the Russian edition labels them Армения, Экономика, Мир, Культура, Спорт, Проверка фактов, Спецпроекты). The **Russian edition** ([armenpress.am/ru](https://armenpress.am/ru)) shares the exact same Inertia payload shape and rubric slugs, so it needed no new scraping logic — just `'ru'` added to `ARMENPRESS_LANGS`. **Always the default tab**, in every language: `NewsBrowser` renders only the active tab (`sources[0]`), and each of the four prerendered pages bakes in Armenpress' own edition — French copy under `lang="fr"`, English under `lang="en"`, and so on, which is what a query in that language should find. (Courrier used to lead, to prerender the most French text; the per-language source rule made Armenpress the natural, SEO-safe lead instead.) It is an Inertia.js app, so the feed arrives as embedded JSON — **no CSS selectors**. Two traps, both documented in the module: the rubric articles live at `props.data.data.hits` (the homepage path reads as empty), and the rubric pages **403 Node's `fetch`** — the module uses `node:https` deliberately. |
| **Actualités** | [Nouvelles d'Arménie](https://www.armenews.com) | The latest **10 articles per rubric** across 6 WordPress rubrics, French-only, as shelves. |
| **Actualités** | [Artzakank / Écho des Arméniens de Suisse](https://artzakank-echo.ch) | The latest **10 articles per rubric** across **3 rubrics**, French-only, as shelves: Arménie & Artsakh and Communauté come from the WordPress REST API, Divers is scraped from the site's `/divers-p/` page. |
| **Actualités** | [ArménieInfo.tv](https://armenieinfo.tv) | The latest **10 articles per rubric**, French-only, as shelves. |
| **Newswire** | [Public Radio of Armenia](https://en.armradio.am/) | English headlines as a live marquee ticker. Fetched through a **multi-tier source chain** (proxy → REST API → RSS feed → Google News) because armradio.am sits behind Cloudflare, which intermittently 403s CI datacenter IPs — see [Newswire source chain](#newswire-source-chain-armradio). |
| **Agenda** | [Armenopole](https://armenopole.com) (Switzerland + a set of world countries) + [Arméniens de Lausanne](https://armeniensdelausanne.ch) recurring classes | Two horizontal, swipeable **carousels** with ‹ › arrow controls — 🇨🇭 Suisse and 🌍 Monde — each event a date-plaqued card. Recurring Lausanne classes listed below. |
| **Don Narek** | [facebook.com/DonNarek](https://www.facebook.com/DonNarek) | A swipeable **carousel** (‹ › arrows) of the **latest 30 posts**, each a card showing **only the post's picture and its author** — no Facebook page chrome/cover. Curated by hand (see below); cards link out to the real post. |
| **Instagram** | 8 curated accounts | A swipeable **carousel** (‹ › arrows) of post tiles. The **9 latest posts** of each account are harvested by a local script (see [Refreshing the Instagram pool](#refreshing-the-instagram-pool)); which of them show, and in what order, is **re-randomised every hour** by the snapshot job. |

Each source **fails independently and degrades gracefully**: on an empty/failed
scrape, the orchestrator backfills that source from the previous snapshot
instead of blanking it, so a transient upstream failure never wipes a section.

## Language switcher

A pill in the top-right of the nav switches the interface language — one chip
per language (**FR · EN · ՀԱՅ · РУ**), rendered from the `LANGS` array (now in
[`sites.config.js`](./sites.config.js), re-exported by
[`src/i18n.jsx`](./src/i18n.jsx) for backward compatibility) in the order
`orderedLangs()` ([`src/site.js`](./src/site.js)) puts them: the current
domain's own language first, the rest in their declared order — so on the
.org's three pages the bar always reads "EN FR ՀԱՅ РУ", only the highlighted
chip moves.

**Each chip is a real link to that language's URL**
(`sites.config.js` → `LANG_URL`), not a click handler that flips React state.
The language comes **from the URL, not from `localStorage`**: each language now
has its own address (`armenieinfo.ch/`, `armenianews.org/`, `/hy/`, `/ru/`), and
`LanguageProvider` reads it once on mount via `langFromPath(SITE_ID,
location.pathname)`. Restoring a language from `localStorage` would flip a page
at mount time away from what its prerendered HTML and `<html lang>` say —
invisible to Googlebot (no `localStorage`), very real for readers. What's lost
— "the site remembers my language" — is regained by the URL itself, which
bookmarks, back-buttons and shares correctly. `localStorage` still holds the
`theme` key (day/night), just not `lang` anymore.

Only the interface **chrome** is translated — article and post content stays in
its source language (see [Notes](#notes--caveats)). Armenpress is the one source
with a matching edition per UI language (fr/en/hy/ru) and ArmRadio follows in
en/hy/ru; the French-only sources stay French under any UI.

**To add a language**, four edits, because the language now needs its own
address as well as its own strings:

1. a page for it in `sites.config.js` → `SITES[siteId].pages` (which domain
   serves it, at which path) **and** an entry in `LANGS` — `{ code, label, name }`
   (`label` is the chip text);
2. a full `STRINGS[code]` block in `src/i18n.jsx` with **exactly the same keys
   as `fr`** — a missing key silently falls back to French, so key parity is
   what matters most, plus a `LOCALES[code]` (e.g. `ru-RU`) for date formatting;
3. a `SEO[code]` block (tagline, description, keywords) and an `OG_LOCALE[code]`
   in `src/seo.js` — Node reads these to bake `<title>`, `<meta description>`
   and `hreflang` into the four static pages;
4. run `npm run build` and check the assertion in `scripts/build-sites.mjs`
   passes — it fails loudly if `sites.config.js` and `LANGS` disagree on which
   languages exist, so a language added to one but not the other cannot ship
   silently.

Each of the four pages (`dist/ch/`, `dist/org/`, `dist/org/hy/`,
`dist/org/ru/`) is prerendered **in its own language** (`npm run prerender`),
not always French — the headless render for each page starts at that page's
own URL, so its baked HTML matches its `<html lang>` and its Armenpress edition.

## The two domains

One codebase, one hourly snapshot, two Firebase Hosting **targets** in the
same project (`armenie-info`) — all of it derived from
[`sites.config.js`](./sites.config.js):

| URL | Language | Firebase target → site | Brand |
|---|---|---|---|
| `armenieinfo.ch/` | fr | `ch` → `armenie-info` (alias `armenie-info.web.app`) | Arménie Info |
| `armenianews.org/` | en | `org` → `armenianews-org` | Armenia News |
| `armenianews.org/hy/` | hy | `org` → `armenianews-org` | Armenia News |
| `armenianews.org/ru/` | ru | `org` → `armenianews-org` | Armenia News |

`npm run build` produces `dist/ch/` and `dist/org/` (with `dist/org/hy/` and
`dist/org/ru/` derived from `dist/org/index.html`); `npm run check` validates
all four pages plus the two `sitemap.xml`/`robots.txt` pairs; `npm run
prerender` bakes the snapshot's articles into all four. Deploy both targets:

```bash
firebase deploy --only hosting:ch,hosting:org
```

(the hourly CI workflow instead loops target-by-target — see
[Deployment](#deployment-github-actions--firebase-hosting) — because Firebase
treats "content identical to what's already live" as a successful no-op per
target, and a combined deploy would make one target's real failure
indistinguishable from the other's benign no-op.)

**Manual steps, in order:**

- **Create the second Firebase Hosting site — already done.** The hourly
  workflow loops `for target in ch org` unconditionally (see
  [Deployment](#deployment-github-actions--firebase-hosting)); if the
  underlying Hosting site didn't exist, every hourly run would fail on the
  `org` target forever, not just degrade SEO like a missing GSC token or
  sitemap submission does. This is the one prerequisite here that breaks CI
  rather than merely hurting search visibility.

  ```bash
  firebase hosting:sites:create armenianews-org --project armenie-info
  firebase target:apply hosting org armenianews-org --project armenie-info
  ```

  (`armenia-news` was already taken by another Firebase project, hence the
  `-org` suffix.) Done — the site exists, with its fallback URL
  `https://armenianews-org.web.app`, and `.firebaserc` already maps the `org`
  target to it.
- **Before deploying `armenianews.org` for the first time** — create its
  Google Search Console property and paste its verification token into
  `sites.config.js` → `SITES.org.gscToken`. The token is compiled straight into
  the built HTML (`<meta name="google-site-verification">`); if it's `null`,
  the tag is simply omitted, so this has to happen before the first deploy that
  matters for indexing, not after.
- **After deploying (once DNS has propagated)** — submit
  `https://armenieinfo.ch/sitemap.xml` and `https://armenianews.org/sitemap.xml`
  in their respective Search Console properties (they are two separate
  properties with two separate sitemaps — submitting one does not cover the
  other), and add `armenianews.org` to GA4's excluded referral domains list (it
  shares the same GA4 property as `armenieinfo.ch`; without the exclusion the
  two sites would attribute each other's traffic as referrals instead of
  direct/organic).

## Develop

```bash
npm install
npm run scrape       # refresh src/data/{news,agenda,meta,instagram-feed}.json from the live sources
npm run ig-scrape    # refresh the Instagram pool (local, logged-in Chrome — never in CI)
npm run fb-scrape    # refresh the Don Narek wall (local, logged-in Chrome — never in CI; needs -- --connect)
npm run dev          # http://localhost:5173/ — the .ch showcase, French
npm test             # 24 tests: sites.config.js derivations, hreflang, language order, sitemaps
npm run lint
npm run build        # builds both showcases into dist/ch/ and dist/org/
npm run build:one    # a single Vite build into dist/ (troubleshooting only — not what ships)
npm run check        # validates the 4 built pages (lang, canonical, reciprocal hreflang) + the 2 sitemap/robots pairs
npm run prerender    # bakes all 4 pages with Puppeteer, after `npm run build`
npm run preview      # preview dist/ch (what armenie-info.web.app actually serves)
npm run preview:org  # preview dist/org
npm run screenshot   # after build: capture the Don Narek carousel into dist/ch/don-narek-{desktop,mobile}.png
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
It writes into `dist/ch/` (gitignored) — the showcase `armenie-info.web.app`
itself serves, and not `dist/org/` — so hourly image churn never enters git
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
npm run build && npm run screenshot           # eyeball dist/ch/don-narek-*.png
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

- **Schedule / manual run** → tests, then scrape + commit the refreshed data +
  build (both showcases) + check + screenshot + prerender + deploy (exactly one
  snapshot per hour).
- **Push to `main`** → build + deploy only (**scrape skipped**), so a code or docs
  change ships fast without spending ~3–4 min re-scraping or leaving an extra
  snapshot commit. Want a fresh snapshot on demand? Use the manual
  `workflow_dispatch` run.

`npm test` always runs first — it's fast, touches no network, and keeps the
one invariant that must never break (`sites.config.js` and `LANGS` describing
the same languages, one URL per language). `npm run check` gates the deploy:
unlike the screenshot and prerender steps (both `continue-on-error: true`,
because a stale wall preview or an un-prerendered page is still a working
site), a failed `check` blocks the deploy entirely — publishing four broken
pages is worse than publishing nothing.

Both showcases deploy to **Firebase Hosting**, in the same project
(`armenie-info`), on two separate **targets** — see [The two
domains](#the-two-domains) for the URL → target → Firebase site mapping. The
Firebase service-account JSON is stored in the
`FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO` repo secret, and the deploy step loops
over `ch` and `org`, deploying and checking each target's result independently
(see [The two domains](#the-two-domains) for why: a no-op on one target must
not be mistaken for a failure on the other, or vice versa).

**CI configuration:**

| Name | Kind | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO` | secret | Firebase Hosting deploy credentials, scoped to Hosting Admin only. |
| `ARMRADIO_PROXY` | variable | URL of the armradio Cloudflare Worker proxy (see [Newswire source chain](#newswire-source-chain-armradio)). Optional — the scraper falls back without it. |
| `ASBAREZ_PROXY` | variable | URL of the Asbarez Cloudflare Worker proxy. **Required** from CI — both Asbarez editions 403 datacenter IPs outright, so without it the Asbarez feed comes back empty every hour (no direct fallback, unlike armradio). |

Vite `base` defaults to `/` on both showcases (each domain serves from its own
root); override with `BASE_PATH=/subpath` — mainly useful with `build:one`,
since the two production showcases always serve from their domain's root.

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
  chrome is translated. The interface is **quadrilingual** (fr / en / hy / ru);
  under the Russian UI a reader sees **Armenpress and the ArmRadio news tab in
  Russian**, while Courrier (and the other French sources) stay French — and
  Courrier still leads the tabs (RU behaves like HY). The newswire **ticker**
  stays English (it reads en.armradio.am).
- **ArmRadio in Russian (`ru.armradio.am`) is wired.** Like en/hy it sits behind
  Cloudflare and 403s the REST API even from a residential IP, so it's reachable
  only through the `ARMRADIO_PROXY` [Worker](#newswire-source-chain-armradio),
  whose `HOST_BY_LANG` now routes `en`/`hy`/`ru`. The site names its categories
  in Russian, so slugs don't resolve — its term IDs are pinned in
  `RU_CATEGORY_IDS` (`scripts/sources/armradio.mjs`), like `HY_CATEGORY_IDS`.
  **Gotcha:** after editing `HOST_BY_LANG` you must **redeploy the Worker**
  (`cd proxy && npx wrangler deploy`), or `lang=ru` returns `400 forbidden
  upstream` and every rubric silently backfills — a frozen ru wall is the only
  sign.
