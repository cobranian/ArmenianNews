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
| **Newswire** | [Public Radio of Armenia](https://en.armradio.am/) | English headlines as a live marquee ticker. Fetched **via Google News** (`site:en.armradio.am`) because armradio.am sits behind Cloudflare, which 403s CI datacenter IPs. |
| **Agenda** | [Armenopole](https://armenopole.com) (Switzerland + a set of world countries) + [Arméniens de Lausanne](https://armeniensdelausanne.ch) recurring classes | Chronological agenda, Switzerland first. |
| **Don Narek** | [facebook.com/DonNarek](https://www.facebook.com/DonNarek) | Official Facebook **Page Plugin** — auto-shows the latest posts (no curation). |
| **Instagram** | 9 curated accounts | A swipeable **carousel** (‹ › arrows) of curated post tiles. Which posts show, and in what order, is **re-randomised every hour** by the snapshot job. |

Each source **fails independently and degrades gracefully**: on an empty/failed
scrape, the orchestrator backfills that source from the previous snapshot
instead of blanking it, so a transient upstream failure never wipes a section.

## Develop

```bash
npm install
npm run scrape   # refresh src/data/{news,agenda,meta,instagram-feed}.json from the live sources
npm run dev      # http://localhost:5173/
npm run build    # production build into dist/
npm run preview
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

The snapshot selects up to **12** posts per hour (`selectInstagram(12)` in
`scripts/sources/instagram.mjs`); bump that number if the pool grows beyond 12.
Accounts with no permalinks simply appear as a profile chip linking to Instagram.

### Facebook — `src/data/facebook.json`

Uses the official Page Plugin, which shows the latest posts of a **public** page
automatically. Nothing to curate. If the Don Narek page is private or Meta
blocks the plugin, the section falls back to a link.

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

Vite `base` defaults to `/` (Firebase serves from the domain root); override with
`BASE_PATH=/subpath` when building for a subpath.

## Notes & caveats

- Scrapers depend on the source sites' current HTML; if a site redesigns, the
  matching scraper in `scripts/sources/` may need new selectors.
- `armradio.am` and Instagram are both blocked from CI datacenter IPs
  (Cloudflare / anti-scraping), which is why the newswire is fetched via Google
  News and the Instagram pool is curated by hand.
- GitHub Actions scheduled runs can be delayed a few minutes under load — the
  snapshot is hourly but not necessarily exactly on `:00`.
- Content (articles, posts) stays in its original language; only the interface
  chrome is translated.
