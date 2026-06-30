# Le Mur d'Arménie · Հայաստանի պատը

A beautiful **daily snapshot** of Armenian life — news, events, and social media —
in the visual language of Armenian illuminated manuscripts (pomegranate, gold,
parchment). Trilingual interface: **Français / English / Հայերեն**.

A scheduled job scrapes the sources once a day into JSON; the site is a static
Vite + React app that renders those files. No backend at runtime.

## Sections

| Section | Source | How |
|---|---|---|
| **Actualités** | [Le Courrier d'Erevan](https://courrier.am/fr) | Latest article from each of the 8 sections (Actualités, Société, Économie, Arts et culture, Arménie francophone, Opinions, Région, Diasporas). Cards link out to the original article. |
| **ArmRadio strip** | [Public Radio of Armenia](https://en.armradio.am/) | Latest English headlines via RSS. |
| **Agenda** | [Armenopole](https://armenopole.com) (Switzerland + a set of world countries) + [Arméniens de Lausanne](https://armeniensdelausanne.ch) recurring classes | Chronological agenda, Switzerland first. |
| **Don Narek** | [facebook.com/DonNarek](https://www.facebook.com/DonNarek) | Official Facebook **Page Plugin** — auto-shows the latest posts (no curation). |
| **Instagram** | 8 accounts | Official **post embeds** from a curated permalink list, shuffled on each load. |

## Develop

```bash
npm install
npm run scrape   # refresh src/data/{news,agenda,meta}.json from the live sources
npm run dev      # http://localhost:5173/ArmenianNews/
npm run build    # production build into dist/
npm run preview
```

`npm run scrape` only refreshes **news + agenda**. The Instagram and Facebook
data are curated by hand (see below) and are never overwritten.

## Curating the social walls

### Instagram — `src/data/instagram.json`

Instagram blocks automated scraping and embeds require real post URLs, so the
wall renders from a curated list. To add posts:

1. Open a post on instagram.com and copy its URL
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

The wall shuffles all permalinks across every account on each load (the
"au hasard" effect) and shows up to 9 at a time. Accounts with no permalinks
yet simply appear as a profile chip linking to Instagram.

### Facebook — `src/data/facebook.json`

Uses the official Page Plugin, which shows the latest posts of a **public** page
automatically. Nothing to curate. If the Don Narek page is private or Meta
blocks the plugin, the section falls back to a link.

## Deployment (GitHub Actions → GitHub Pages)

`.github/workflows/daily.yml` runs every day at 05:00 UTC (and on manual
dispatch / push to `main`). It scrapes, commits the refreshed data, builds, and
deploys to GitHub Pages.

First-time setup:

1. Create the repo and push:
   ```bash
   git remote add origin https://github.com/cobranian/ArmenianNews.git
   git push -u origin main
   ```
2. In the repo **Settings → Pages**, set **Source = GitHub Actions**.
3. The site goes live at `https://cobranian.github.io/ArmenianNews/`.

The Vite `base` defaults to `/ArmenianNews/`. For a custom domain or user page,
set `BASE_PATH=/` when building.

## Notes & caveats

- Scrapers depend on the source sites' current HTML; if a site redesigns, the
  matching scraper in `scripts/sources/` may need new selectors. Each source
  fails independently — one broken source won't blank the whole site.
- Facebook/Instagram embeds need the target page/posts to be **public**.
- Content (articles, posts) stays in its original language; only the interface
  chrome is translated.
