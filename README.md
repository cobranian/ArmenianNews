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
| **Actualités** | [CivilNet](https://civilnet.am) | The Yerevan independent newsroom, and the **third quadrilingual source** (fr / en / hy / ru map 1:1 to the UI language, like Armenpress): the latest **10 articles per rubric**, each rubric its own shelf. The four editions do **not** share a rubric list — 5 in French (no world or opinion desk), 8 in English, 7 in Armenian (Human rights where the others run Society), 6 in Russian — so each shelf title comes from the page's own payload, already in that language, and rides in the data rather than through i18n keys. Another **Inertia.js** app, so the feed arrives as embedded JSON — **no CSS selectors** — but at `props.feed.data.hits`, *not* Armenpress' `props.data.data.hits`. It hits the same trap as Armenpress otherwise: **403 to Node's `fetch`, 200 to `node:https`**, which is why that helper now lives in `scripts/lib/http.mjs` and is shared. Articles carry no slug, only an id, so cards link to `/{lang}/news/{id}` — per-edition, an English id under `/hy/` 404s. Images hotlink directly. |
| **Actualités** | [NEWS.am](https://news.am) | Yerevan's largest private news group, under **en / hy / ru** (no French edition, so it is dropped under `fr` like ArmRadio). The latest **10 articles per rubric** across **10 rubrics** — 30 pages per snapshot. The most heterogeneous source here, because NEWS.am is not one site but **four**: the modern newsroom (`news.am`, 7 rubrics — Politics, Business, Economics, Analytics, Incidents, Society, Culture) plus **three legacy verticals on their own hosts** — [NEWS.am Sport](https://sport.news.am), [NEWS.am Style](https://style.news.am) and [NEWS.am Medicine](https://med.news.am). The verticals are **not** reachable from the modern site: `/{lang}/news/sports` and `/medicine` exist there as cross-posted tags but run days behind, and `style` 404s. The modern site is another **Inertia.js** app (embedded JSON, **no CSS selectors**) reading `props.feed.data.hits` like CivilNet, and it hits the same **403-to-`fetch` / 200-to-`node:https`** trap as Armenpress and CivilNet. Unlike CivilNet, its `article_id` is **shared across editions**, so `/hy/news/{id}` serves the Armenian translation of the same story. The verticals are read from **RSS** (sport, style) and **HTML** (med) — see [NEWS.am's dead feed and two derived fields](#newsams-dead-feed-and-two-derived-fields). Images hotlink directly on all four hosts. |
| **Actualités** | [Nouvelles d'Arménie](https://www.armenews.com) | The latest **10 articles per rubric** across 6 WordPress rubrics, French-only, as shelves. |
| **Actualités** | [Artzakank / Écho des Arméniens de Suisse](https://artzakank-echo.ch) | The latest **10 articles per rubric** across **3 rubrics**, French-only, as shelves: Arménie & Artsakh and Communauté come from the WordPress REST API, Divers is scraped from the site's `/divers-p/` page. |
| **Actualités** | [ArménieInfo.tv](https://armenieinfo.tv) | The latest **10 articles per rubric**, French-only, as shelves. |
| **Newswire** | [Public Radio of Armenia](https://en.armradio.am/) | English headlines as a live marquee ticker. Fetched through a **multi-tier source chain** (proxy → REST API → RSS feed → Google News) because armradio.am sits behind Cloudflare, which intermittently 403s CI datacenter IPs — see [Newswire source chain](#newswire-source-chain-armradio). |
| **Agenda** | [Armenopole](https://armenopole.com) (Switzerland + a set of world countries) + [Arméniens de Lausanne](https://armeniensdelausanne.ch) recurring classes | Two horizontal, swipeable **carousels** with ‹ › arrow controls — 🇨🇭 Suisse and 🌍 Monde — each event a date-plaqued card. Recurring Lausanne classes listed below. |
| **Don Narek** | [facebook.com/DonNarek](https://www.facebook.com/DonNarek) | A swipeable **carousel** (‹ › arrows) of the **latest 25 posts**, each a card showing **only the post's picture and its author** — no Facebook page chrome/cover. Don Narek's own portrait **closes** the wall, as a signature. Curated by hand (see below); cards link out to the real post. |
| **Instagram** | 27 curated accounts | **Five** swipeable **carousels** (‹ › arrows) of post tiles — one strand per `group`, in display order: the creators making Armenian work today (4), the community and its institutions (9), the people who are its face (6), the studios where the work is made (4), and the land itself (4). The **9 latest posts** of each account are harvested by a local script by default (see [Refreshing the Instagram pool](#refreshing-the-instagram-pool)); which of them show, and in what order, is **re-randomised every hour** by the snapshot job, **18 per strand** (90 total), drawn **round-robin between a strand's accounts** so an account with a bigger reserve can't crowd the others off their own carousel. |

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
its source language (see [Notes](#notes--caveats)). Armenpress and CivilNet each
have a matching edition per UI language (fr/en/hy/ru); ArmRadio and NEWS.am
follow in en/hy/ru; the French-only sources stay French under any UI.

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

One codebase, one hourly snapshot, two Firebase Hosting sites — living in **two
different Firebase projects**, which is the least obvious thing about this
deployment. All of it derived from [`sites.config.js`](./sites.config.js):

| URL | Language | Firebase site | Project | Brand |
|---|---|---|---|---|
| `armenieinfo.ch/` | fr | `armenie-info` (alias `armenie-info.web.app`) | `armenie-info` | Arménie Info |
| `armenianews.org/` | en | `armenia-news-org` | `armenia-news-b146e` | Armenia News |
| `armenianews.org/hy/` | hy | `armenia-news-org` | `armenia-news-b146e` | Armenia News |
| `armenianews.org/ru/` | ru | `armenia-news-org` | `armenia-news-b146e` | Armenia News |

`firebase.json` names its entries by **`site`**, not by `target`. Hosting
targets are declared per project in `.firebaserc`, which would mean keeping two
tables in step; a site name is globally unique, so it identifies its site
unambiguously whichever project it belongs to. `.firebaserc` therefore keeps
only `projects.default`.

`npm run build` produces `dist/ch/` and `dist/org/` (with `dist/org/hy/` and
`dist/org/ru/` derived from `dist/org/index.html`); `npm run check` validates
all twelve pages — the four home pages above, plus their `/radio` and
`/agenda`/`/events` siblings (see [`sites.config.js`](./sites.config.js) →
`VIEWS`) — plus the two `sitemap.xml`/`robots.txt` pairs; `npm run
prerender` bakes the snapshot's articles into all twelve. Deploying by hand takes
two commands, because each site needs its own project **and its own
credentials**:

```bash
firebase deploy --only hosting:armenie-info         --project armenie-info
firebase deploy --only hosting:armenia-news-org   --project armenia-news-b146e
```

The hourly CI workflow loops over the same two, one at a time — see
[Deployment](#deployment-github-actions--firebase-hosting). Two reasons, not
one: a service account only has rights on its own project, so the credential
has to be reassigned each iteration rather than exported once; and Firebase
treats "content identical to what's already live" as a successful no-op per
site, so a combined deploy would make one site's real failure indistinguishable
from the other's benign no-op.

**Manual steps, in order:**

- **Cross-project deploy rights — already granted.** This is the one
  prerequisite that **breaks CI** rather than merely hurting search visibility,
  so it matters more than the SEO steps below.

  A service account only has rights on its own project by default, and the
  workflow deploys both sites unconditionally — so `armenieinfo.ch` would
  publish fine while the job still went red on the `.org`. Rather than a second
  credential, the existing `armenie-info` service account was granted **Firebase
  Hosting Admin on `armenia-news-b146e` as well** (Cloud console → that
  project's IAM → Grant access). One secret,
  `FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO`, therefore covers both.

  The workflow checks that secret is non-empty before its first deploy command,
  so a missing one fails immediately with a message naming it rather than
  surfacing later as an opaque authorization error.

  > **The trade-off, stated plainly.** One key carrying Hosting Admin on two
  > projects widens the blast radius if it leaks; two scoped keys would contain
  > it but double the upkeep. The current choice is the former. What is *not*
  > acceptable either way is the **`firebase-adminsdk` key** the Firebase
  > console offers under *Project settings → Service accounts → Generate new
  > private key*: that identity can bypass database security rules and mint auth
  > tokens for other service accounts — far beyond publishing static files. This
  > repo migrated away from it once already; the workflow comment records why.
  > A dedicated account's key lives in the **Cloud** console (IAM → Service
  > accounts → *click into the account* → Keys), not the Firebase one.

- **The Hosting sites themselves — already done.** `armenie-info` has existed
  for years; `armenia-news-org` was created in `armenia-news-b146e` for this.
  Nothing left to create.

  > **These names moved twice — trust the table above, nothing else.** A site
  > `armenianews-org` was first created in `armenie-info`, `armenia-news` being
  > unavailable there: that name was held by a separate project on the same
  > account. That project was then deleted by accident and recreated as
  > `armenia-news-b146e`, taking its Hosting site with it. Firebase reserves a
  > deleted project's site names for about 30 days, which is why the names in
  > the git history look like a series of near-misses.
  >
  > One leftover: the unused `armenianews-org` site still sits in
  > `armenie-info`. It serves nothing and can be deleted whenever convenient.
- **Search Console ownership for `armenianews.org` — DNS first, meta tag as a
  backup.** The authoritative method is a TXT record on the domain root, posted
  alongside Firebase's A records:

  ```
  Type: TXT   Name: @   Value: google-site-verification=<token>
  ```

  DNS is the better primary here for two reasons: it covers the whole domain
  including any future subdomain, and it survives a redeploy that rewrites the
  HTML. `armenieinfo.ch` was verified by meta tag years ago and keeps its own
  token in `SITES.ch.gscToken` — no reason to churn a working verification.

  Both sites now **also** emit `<meta name="google-site-verification">` from
  their `gscToken`, so the `.org` keeps its property even if the TXT record is
  ever dropped. The `.org` tag reuses its **DNS token**: Google documents
  distinct tokens per method, but on this account the `.ch`'s TXT value and its
  `content=` value are byte-for-byte the same string, so the reuse is a
  reasonable bet — and a safe one, since a tag Google doesn't recognise is inert
  and cannot undo the DNS verification. **Confirm it** under *Settings →
  Ownership verification*; if *HTML tag* is not listed as verified there, replace
  the value with the `content=` string from that panel specifically.

  A `null` `gscToken` remains valid and emits nothing at all — better no tag
  than an empty one.

  `npm run check` asserts, per page, that it carries **its own** token and **no
  foreign one**. As with the Cloudflare beacon, the second check is the one that
  matters: a neighbour's token deploys without a single error and simply never
  verifies, with no log anywhere.
- **Cloudflare Web Analytics — one token per storefront, not per repo.** Each
  site carries its own `cfBeaconToken` in `sites.config.js`, and
  `scripts/lib/site-meta.mjs` renders the beacon tag into the
  `<!--CF_BEACON-->` marker in `index.html`, per site, exactly like the `<head>`
  block. The three `.org` pages (`/`, `/hy/`, `/ru/`) all carry the `.org`
  token: the tag varies by **site**, never by language.

  It used to be a single hardcoded tag in `index.html` — a file both
  storefronts share — so `armenianews.org` was reporting into
  `armenieinfo.ch`'s dashboard, separable only by filtering on hostname.

  `npm run check` asserts two things per page: that it carries **its own**
  token, and that it carries **no foreign one**. The second is the one that
  matters — a neighbour's token measures without a single error, just into the
  wrong dashboard. A `null` token is valid and emits nothing at all; better no
  measurement than measurement filed under the wrong site.

  Neither domain is proxied through Cloudflare (both resolve to Firebase
  Hosting), so there is no zone-level automatic setup available here — the JS
  beacon is the only route, and it needs a token issued per site from
  **Analytics & Logs → Web Analytics → Add a site**. The token is not a secret:
  it ships in the public HTML and grants nothing.
- **Google Analytics 4 — one measurement ID per storefront, same trap, same
  fix.** Each site carries its own `gaMeasurementId` in `sites.config.js`, and
  `scripts/lib/site-meta.mjs` renders both tags into the `<!--GA_TAG-->` marker.
  `.ch` keeps `G-EB3W5XXSMW` (property "Arménie Info", where its history lives);
  `.org` reports to its own property, "Armenia News" (`G-N6STD6Z5CC`, created
  2026-07-29 — it starts empty, and the `.org` traffic from before that date
  stays in the `.ch` property; that break is expected, not a loss).

  It used to be hardcoded in `index.html` **and** in `public/ga-init.js` — two
  files both storefronts share — so `armenianews.org` was measured into the
  `.ch` property, `/hy/` and `/ru/` included. It showed up plainly in that
  property's *Pages and screens* report, since those two paths exist only on the
  `.org`. Three empty GA properties had been created opposite it, none of which
  ever received a single hit.

  Two invariants the build guards, because neither is visible by inspection:

  - `ga-init.js` takes the ID from a `data-ga-id` attribute, never from an
    inline `<script>` — the CSP is `script-src 'self'` with no `'unsafe-inline'`.
    It reads it through `document.currentScript`, which is only defined for a
    **classic, synchronous** script: do not add `async`, `defer` or
    `type="module"` to that tag.
  - `ga-init.js` must come **before** `gtag.js`. `gtag.js` drains the `dataLayer`
    queue the moment it runs, so if the order flips, both tags are still present
    and the first hit simply leaves without a consent state — with cookies where
    the GDPR forbids them. A presence check would not catch it; `npm run check`
    and a test assert the order.
- **After deploying (once DNS has propagated)** — submit
  `https://armenieinfo.ch/sitemap.xml` and `https://armenianews.org/sitemap.xml`
  in their respective Search Console properties (they are two separate
  properties with two separate sitemaps — submitting one does not cover the
  other). The GA4 excluded-referral entry the two sites once needed is moot now
  that each has its own property: cross-domain referral inflation was an
  artefact of sharing one.

## Develop

```bash
npm install
npm run scrape       # refresh src/data/{news,agenda,meta,instagram-feed}.json from the live sources
npm run ig-scrape    # refresh the Instagram pool (local, logged-in Chrome — never in CI)
npm run ig-select    # re-draw instagram-feed.json from the current pool, no network involved
npm run fb-scrape    # refresh the Don Narek wall (local, logged-in Chrome — never in CI; needs -- --connect)
npm run dev          # http://localhost:5173/ — the .ch showcase, French
npm test             # 162 tests: sites.config.js derivations, hreflang per view, language order, sitemaps, per-site analytics, radio station sourcing, Instagram strands
npm run lint
npm run build        # builds both showcases into dist/ch/ and dist/org/
npm run build:one    # a single Vite build into dist/ (troubleshooting only — not what ships)
npm run check        # validates the 12 built pages (lang, canonical, reciprocal hreflang) + the 2 sitemap/robots pairs
npm run prerender    # bakes all 12 pages with Puppeteer, after `npm run build`
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
**27 accounts, 576 posts** (569 distinct shortcodes: `nemrabandofficial` and
`van.nemra` are collaborators, and a COLLAB post lives on both grids under the
*same* shortcode). Most accounts hold the default **9** posts each; one,
`simonian_jewels`, is capped at **120** via a per-account `count` (see [Refreshing
the Instagram pool](#refreshing-the-instagram-pool)) — hence the pool total isn't
a round `27 × 9`. Each account declares a `group` — `institutions`,
`personnalites`, `creation`, `createurs` or `terre`, 9 / 6 / 4 / 4 / 4 accounts —
and the wall renders one carousel per strand.
The hourly job shuffles that pool into `instagram-feed.json`, picking **18 per
strand** (90 posts, a fresh random selection + order each hour) rather than 18
overall, so the biggest group can't crowd the others off their own carousel.
**Within a strand, the draw is round-robin between accounts** (one post per
account in turn) rather than a flat shuffle of the strand's whole reserve — flat
would hand out tiles in proportion to each account's post count, which is exactly
what lets `simonian_jewels`' 120-post catalogue dominate `createurs` otherwise.

Each post is a `{url, date}` pair, the date being the post's real timestamp:

```json
{
  "handle": "armeniancuisine",
  "name": "Armenian Cuisine",
  "url": "https://www.instagram.com/armeniancuisine/",
  "group": "institutions",
  "posts": [
    { "url": "https://www.instagram.com/p/ABC123/", "date": "2026-07-12T04:51:48.000Z" },
    { "url": "https://www.instagram.com/reel/DEF456/", "date": "2026-07-09T18:02:11.000Z" }
  ]
}
```

**To add a post by hand** (the harvest will overwrite it on the next run, so this
is for one-offs): add a `{url, date}` entry to the matching account's `posts`
array, and *(optional, for a real photo)* save the post's image as
`src/data/ig/<shortcode>.webp` — the shortcode is the code after `/p/`, `/reel/`
or `/tv/` (e.g. `ABC123.webp`). A `.jpg` also works: the glob in `Social.jsx`
accepts both on purpose, so a file dropped in by hand is never silently ignored.
It's bundled at build time, so it never hotlinks or expires. **Without an image,
the tile shows a deterministic Armenian motif** (still on-brand) — so a permalink
alone is enough.

**To add an account**, add it to the `accounts` array by hand — including its
`group`, which decides which of the five carousels it lands in (omit it and it
defaults to `institutions`; a value outside the five drops the account from the
wall with no warning, which `test/instagram-strands.test.mjs` catches) — then
re-run the harvest to populate its posts. Note
that an Instagram handle **cannot contain a hyphen** — a handle with one (e.g.
`armenian-trend`) 404s and the account is dropped from the run.

The snapshot selects up to **18 posts per strand** — 90 in all
(`selectInstagram(18)` in `scripts/sources/instagram.mjs`, applied per `group`);
bump that number if a strand grows well beyond 18. Accounts with no posts simply
appear as a profile chip linking to Instagram.

**Re-draw the selection after regrouping accounts, or after any harvest.**
Each post in `instagram-feed.json` carries its `group`: change an account's
strand without re-drawing and its posts still declare the old one, so a new
strand renders empty until the next hourly snapshot — a push to `main` builds
and deploys **without** scraping. Likewise, a harvest only updates the pool;
the wall itself doesn't see new posts until the selection is re-drawn.

```bash
npm run ig-select
```

This re-shuffles `instagram-feed.json` from the current pool, without touching
the network, and **keeps `generatedAt` as it was**: no snapshot happened, only
the selection changed.

### Facebook (Don Narek) — `src/data/facebook.json`

Facebook blocks automated scraping and the official Page Plugin drags in the
whole page shell (cover, header, Like box), so the Don Narek wall is a curated
carousel — populated by a local scraper (see [Refreshing Don
Narek](#refreshing-don-narek) below) or by hand — that shows **only each post's
picture and its author**.

**To add a post by hand:** put a new entry at the **top** of the `posts` array —
newest first, with Don Narek's own portrait (`dn-narek`) kept **last**, where it
signs the wall. The view renders the whole array; the only cap is `WANT` in the
scraper:

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

An up-to-date **preview of the carousel** — the `#facebook` strand itself, not
the section around it, so it stays Don Narek's picture however the wall is
ordered — is regenerated every hour by the deploy (`scripts/shoot.mjs`, driven
by `browser-actions/setup-chrome`) and published alongside the site at
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
for its full-resolution image, and rewrites `src/data/fb/*.webp` +
`facebook.json` (newest first, capped at 25, Don Narek's own portrait last). It
then **deletes every image the wall does not cite** — `Social.jsx` bundles the
whole `src/data/fb/` folder, so an orphan file ships in both `dist/` forever
without ever being shown. Images are downloaded **through the
logged-in tab** (not an anonymous fetch), so Facebook's session-gated CDN
variants come back as the real photo instead of a placeholder, then re-encoded to
WebP 800px by `scripts/lib/image.mjs` before they hit the disk.

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
git add src/data/facebook.json src/data/fb/dn-*.webp && git commit && git push
```

### Re-encoding the bundled images

Both scrapes write **WebP 800px q78** (`scripts/lib/image.mjs`). The target
covers the two sizes that actually get rendered: a tile at ~300 CSS px, and the
lightbox at `min(1040px, 94vw)` — 367 CSS px on a 390px phone, so 734px on a
retina screen.

To change the target across every image already committed — no network, they are
all on disk:

```bash
npm run reencode -- --dry               # count and weigh, write nothing
npm run reencode -- --sample /tmp/check # write elsewhere, touch nothing
npm run reencode                        # convert in place, rewrite facebook.json
npm run reencode -- --width 640 --quality 75
```

It re-encodes `.webp` files too, so it stays usable after the first migration —
but that means a second pass loses a little quality (WebP to WebP), and it can
only ever shrink: `encode()` never enlarges, so re-running at 1040 after a
migration at 800 will **not** bring back the lost pixels. Re-harvest for that.

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

**On later runs, skip steps 1–2.** Drop `--connect` and the script launches its
own visible Chrome **on that same `.cache/ig-chrome-profile`** — so the session
you logged in once is already there, and there's no debug window to start by
hand:

```bash
npm run ig-scrape -- --dry   # same dry run, self-launched Chrome
npm run ig-scrape            # same harvest
```

Use `--connect` when you already have the debug window open, or when the session
has expired and you need to log back in — that's the one thing the self-launched
run can't do for you, because it **closes** its Chrome on exit where `--connect`
merely detaches, leaving your window open to log in. Either way a dead session
stops the script up front with `✗ Not logged in`, rather than reporting
twenty-seven independent failures.

It rewrites `src/data/instagram.json` with, by default, the **9 latest posts**
of each account (dated, newest first) plus their images in `src/data/ig/`, and
deletes images no post points at any more. A failing account **keeps its
previous posts**; if *no* account succeeds, nothing is written and it exits
non-zero — an intact pool beats a gutted one. Three settings tune the harvest,
all silent when omitted:
- **`count`** on an account (an integer, or `'all'` up to a hard cap of 500)
  overrides the default of 9 — used for `simonian_jewels` (`count: 120`).
- **`exclude`** at the pool's root: shortcodes the scraper never picks, no
  matter the account.
- **`--only <handle[,handle]>`** harvests just those accounts, without
  rewriting the other 26 or re-downloading every image.

Notes:
- Without a logged-in session the script stops up front (`✗ Not logged in`)
  rather than reporting twenty-seven independent failures.
- **The wall's freshness is capped by how active the accounts actually are.** Two
  of the twenty-seven are dormant — `ig_armenia` hasn't posted since **June 2023**,
  `armeniancuisine` since **November 2025** — and two more are slow
  (`haykmiqayelyanart` since **February 2026**, `abgarart` since **March 2026**),
  so their old posts show up on the
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

## NEWS.am's dead feed and two derived fields

NEWS.am's three legacy verticals (`sport.`, `style.`, `med.news.am`) run a CMS
that predates the main site. Three things about them are worth knowing before
touching `scripts/sources/newsam.mjs`.

**med.news.am's RSS has been dead since 2013 — and it answers `200`.** All three
languages of `/{seg}/rss/news` return a well-formed feed of 100 items. They are
the site's **oldest** articles, frozen in **November 2013**, in ascending order.
Nothing in the HTTP response says so. Sport and style, on the same CMS, serve a
fresh feed sorted newest-first. So sport and style are read from RSS, and med
from its HTML feed page (`article[itemtype]` on `/{seg}/news/`).

Because that failure mode is invisible, every vertical is checked against a
**freshness guard** (`MAX_AGE_DAYS`, 60 days): if the newest article a vertical
returns is older than that, the rubric **fails** rather than publishing. It is
backfilled once from the previous snapshot and then goes visibly empty. Without
it this module would have shipped thirteen-year-old headlines as today's news.
Do not remove it to "simplify" — it is what caught the case.

**Two fields are derived, because these sites do not expose them.** Both are
covered by `test/newsam-legacy.test.mjs`, which needs no network.

- **The thumbnail.** The verticals' RSS carries no `<enclosure>`, no
  `<media:content>`, no `<media:thumbnail>` — nothing. But the legacy CMS files
  every image at a fixed path, `/static/news/s/{YYYY}/{MM}/{id}.jpg`, keyed on
  the article's **Yerevan-local** publication month. The URL is derived from the
  id and the date at no extra request. Reading the month in UTC would misfile
  anything published after 20:00 UTC and serve a 404 — the card would silently
  fall back to its Armenian motif.
- **med's date.** Its HTML has no `datetime` attribute and no JSON-LD, and its
  `<time>` **omits the year** ("July 29, 20:34"). The date is rebuilt from two
  halves: year and month from the image path, day and clock from the text read
  **numerically**. Reading digits is the point — one rule covers eng/arm/rus
  without ever parsing a month name. Both orders occur on the site ("20:53,
  July 26" on the home page, "July 26, 20:53" on the feed), so the clock is
  stripped **before** the day is looked for; otherwise "20" would read as the
  day.

**The verticals throw occasional 500s**, med most often and on a different
language each time. `fetchTextNode` retries dropped connections but rejects any
non-200 immediately — correct for the 403s it was written for, wrong for a
passing hiccup that would empty a rubric and let backfill paper over it. Hence a
**section-level retry** (3 attempts) inside this module rather than a change to
the shared helper.

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

Both showcases deploy to **Firebase Hosting**, but in **two different Firebase
projects** — see [The two domains](#the-two-domains) for the full URL → site →
project mapping. `firebase.json` names its entries by `site` (globally unique),
not by `target` (declared per project), so `.firebaserc` keeps only
`projects.default`.

The deploy step loops over the two sites one at a time, **reassigning
`GOOGLE_APPLICATION_CREDENTIALS` on each iteration**: a service account only has
rights on its own project, so the two sites cannot share one credential. Each
site's result is judged on its own output — a no-op on one must not be mistaken
for a failure on the other, or vice versa.

A guard checks both secrets are non-empty before the first deploy command. Miss
one and the run stops immediately naming it, instead of failing later on an
authorization error that says neither which secret is missing nor for which
project.

**CI configuration:**

| Name | Kind | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO` | secret | Deploy credentials for **both** showcases. The account belongs to `armenie-info` and was additionally granted Firebase Hosting Admin on `armenia-news-b146e` — see [The two domains](#the-two-domains). Hosting Admin only, on both. |
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
  under the Russian UI a reader sees **Armenpress, CivilNet, NEWS.am and the
  ArmRadio news
  tab in Russian**, while Courrier (and the other French sources) stay French —
  and Courrier still leads the tabs (RU behaves like HY). The newswire **ticker**
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
