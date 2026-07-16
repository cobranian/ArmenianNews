# Armenpress comme source par défaut — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `armenpress.am` (fr/en/hy) comme sixième source du fil d'actualités et la placer en **premier onglet**, pour que le contenu prérendu — donc indexé par Google — passe de l'anglais au français.

**Architecture:** Un module de source qui lit le JSON Inertia embarqué dans la page d'accueil d'Armenpress (aucun sélecteur CSS), une requête par langue avec une pause entre chacune. Les données prennent la forme multilingue d'`armradio` pour réutiliser `backfillSections` sans le modifier. `NewsBrowser` gagne un onglet, placé en tête.

**Tech Stack:** Node 24 (ESM), `cheerio` (déjà présent), `scripts/lib/http.mjs` (déjà présent), Vite 6, React 18.

**Spec:** `docs/superpowers/specs/2026-07-16-armenpress-source-design.md`

## Global Constraints

- **Il n'y a pas de suite de tests dans ce dépôt** (`CLAUDE.md`). N'en introduisez pas : chaque tâche se vérifie en exécutant le scrape ou le build et en observant la sortie réelle. Les étapes de vérification ci-dessous **sont** les tests.
- **`npm run lint` fonctionne désormais** (config plate, `eslint.config.js`). Il doit sortir avec **0 erreur**. Les **6 avertissements existants** sont connus et assumés — voir `CLAUDE.md` ; ne les « corrigez » pas.
- **Le français porte tous ses accents** (é, è, à, ê, ç…) — `CLAUDE.md`.
- **`armenpress.am` limite agressivement le débit.** Une trentaine de requêtes en un quart d'heure ont valu un 403 persistant sur tout le site depuis une IP résidentielle. **Ne bouclez jamais sur ce site pour déboguer.** Si vous recevez un 403, ce n'est probablement pas votre code — voir « Si vous êtes bloqué » dans la tâche 1.
- **Ce que l'on prélève** : titres, liens, dates et vignettes uniquement, chaque tuile renvoyant à l'article sur armenpress.am. **Jamais le texte des articles** — c'est la règle de toutes les sources du site.
- `scripts/lib/http.mjs` exporte `fetchText(url)` et envoie déjà un User-Agent de navigateur, ce qui suffit à obtenir 200 (le 403 initial venait du UA de `curl`).
- Valeurs exactes, à reproduire au caractère près :
  - libellé de la rubrique : **`Fil`** (fr) / **`Wire`** (en) / **`Հոսք`** (hy)
  - clé de rubrique : `fil`
  - clés i18n : `browser.armenpress`, `apcats.fil`
- Commits fréquents, un par tâche.

---

## File Structure

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `scripts/sources/armenpress.mjs` | **nouveau** — lit le JSON Inertia, rend les articles des 3 langues | 1 |
| `scripts/scrape.mjs` | appelle la source, backfill par langue, écrit `news.json` | 1 |
| `src/i18n.jsx` | `browser.armenpress` + `apcats.fil`, × 3 langues | 2 |
| `src/components/NewsBrowser.jsx` | sixième onglet, **placé en premier** | 2 |
| `README.md` | 4 lignes manquantes dans le tableau « Sections » | 3 |
| `CLAUDE.md` | 4 lignes manquantes dans la liste `scripts/sources/` | 3 |

La tâche 1 produit les données, la tâche 2 les affiche, la tâche 3 documente. Un relecteur peut rejeter l'une en approuvant les autres.

---

### Task 1: Le module de source et le scrape

**Files:**
- Create: `scripts/sources/armenpress.mjs`
- Modify: `scripts/scrape.mjs` (import ; bloc dans `main()` ; clé dans `writeJson('news.json', …)`)

**Interfaces:**
- Consumes: `fetchText(url)` de `../lib/http.mjs` ; `clean`, `safeUrl` de `../lib/util.mjs` (mêmes imports que `scripts/sources/armenews.mjs`) ; `backfillSections(fresh, prev, 'categoryKey')`, déjà dans `scrape.mjs`.
- Produces:
  - `scripts/sources/armenpress.mjs` → `export async function scrapeArmenpress(limit = 16)` → `Promise<{ fr: Section[], en: Section[], hy: Section[] }>` où `Section = { categoryKey: 'fil', articles: Article[] }` et `Article = { title, url, date, image }`.
  - La clé `armenpress` dans `news.json`, consommée par la tâche 2.

**Pourquoi cette signature s'écarte d'`armradio`.** `armradio` boucle sur les
langues **dans `scrape.mjs`** (`scrapeArmradioSections(10, lang)`). Ici la boucle
est **dans le module**, parce que la pause entre requêtes est une propriété
d'`armenpress.am` — pas de l'orchestrateur. Mettre le délai dans `scrape.mjs`
répandrait la politesse due à un seul site dans le code commun. Le backfill,
lui, reste par langue dans `scrape.mjs`, exactement comme `armradio`.

**Trois pièges, tous vérifiés le 2026-07-16 :**

1. **`data-page` vaut la chaîne `"app"`.** Le JSON est le **contenu** de la
   balise `<script data-page="app" type="application/json">`, pas la valeur de
   l'attribut. `$('script[data-page]').attr('data-page')` renvoie `"app"` et
   fait planter `JSON.parse`. Utilisez `.html()`.
2. **`published_at` est un timestamp Unix en secondes**, pas en millisecondes.
   Sans le `× 1000`, tous les articles datent de 1970.
3. **Les articles n'ont pas d'URL** — seulement un `article_id`. L'URL se
   construit : `https://armenpress.am/{lang}/article/{article_id}`.

- [ ] **Step 1: Écrire `scripts/sources/armenpress.mjs`**

Créer le fichier avec exactement ce contenu :

```js
import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Armenpress (armenpress.am) is Armenia's national news agency, and the only
// source here with a real French edition — which is why it leads the tab order:
// NewsBrowser renders only the active tab, so the default source is what gets
// prerendered and indexed. See docs/superpowers/specs/2026-07-16-armenpress-*.
//
// It is an Inertia.js app: every page embeds its payload as JSON. We read the
// homepage feed rather than the per-rubric pages, which embed an empty feed and
// load client-side — and because the site rate-limits hard (a residential IP
// earned a site-wide 403 after ~30 requests in 15 minutes). Three requests per
// snapshot, spaced. Do not add more without re-reading that spec.
//
// No CSS selectors: this breaks only if the payload changes shape, not on a
// redesign.
const BASE = 'https://armenpress.am'

// The UI language maps 1:1 — unlike ArmRadio, which has no French edition.
export const ARMENPRESS_LANGS = ['fr', 'en', 'hy']

// One rubric: the homepage feed is a single wire, and the hits carry no rubric
// field (their tags are location/person/organization facets).
export const ARMENPRESS_CATEGORY = 'fil'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The Inertia payload lives in the <script> body. `data-page` is the string
// "app" — reading it as the attribute yields "app" and throws in JSON.parse.
function pagePayload(html) {
  const raw = cheerio.load(html)('script[data-page]').html()
  if (!raw) throw new Error('no Inertia payload (script[data-page]) in the page')
  return JSON.parse(raw)
}

// Meilisearch hits → {title, url, date, image}. Titles and links only; the card
// sends the reader to armenpress.am.
function parseHits(hits, lang, limit) {
  return hits
    .slice(0, limit)
    .map((h) => {
      const title = clean(h.title)
      const id = h.article_id
      if (!title || !id) return null
      // published_at is Unix *seconds*; without ×1000 everything lands in 1970.
      const d = h.published_at ? new Date(h.published_at * 1000) : null
      return {
        title,
        url: `${BASE}/${lang}/article/${id}`,
        date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
        image: h.image ? safeUrl(`${BASE}${clean(h.image)}`) : null,
      }
    })
    .filter(Boolean)
}

async function scrapeLang(lang, limit) {
  const page = pagePayload(await fetchText(`${BASE}/${lang}`))
  const hits = page.props?.feed?.data?.hits
  if (!Array.isArray(hits)) throw new Error('payload has no props.feed.data.hits')
  // Serving Armenian copy under the French tab would be worse than serving
  // nothing: fail the language instead.
  const got = hits[0]?.locale
  if (got && got !== lang) throw new Error(`asked for ${lang}, payload is ${got}`)
  return parseHits(hits, lang, limit)
}

// Latest articles per language for the news feed. Each language fails on its
// own and is backfilled from the previous snapshot by scrape.mjs.
export async function scrapeArmenpress(limit = 16) {
  const out = {}
  for (const lang of ARMENPRESS_LANGS) {
    try {
      const articles = await scrapeLang(lang, limit)
      out[lang] = [{ categoryKey: ARMENPRESS_CATEGORY, articles }]
      console.log(`  ✓ armenpress/${lang} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ armenpress/${lang}: ${err.message}`)
      out[lang] = [{ categoryKey: ARMENPRESS_CATEGORY, articles: [] }]
    }
    // The site 403s aggressively. Three spaced requests, and no more.
    if (lang !== ARMENPRESS_LANGS[ARMENPRESS_LANGS.length - 1]) await sleep(1000)
  }
  return out
}
```

- [ ] **Step 2: Brancher la source dans `scripts/scrape.mjs`**

Ajouter l'import après celui d'`armenieinfotv.mjs` (ligne ~13) :

```js
import { scrapeArmenpress } from './sources/armenpress.mjs'
```

Puis, dans `main()`, **juste après** le bloc `armenieinfotv` (qui se termine par
`const armenieinfotv = backfillSections(aitvSecs, prevNews?.armenieinfotv, 'categoryKey')`)
et **avant** `console.log('\nAgenda (armenopole.com):')`, insérer :

```js
  // Armenpress — the national news agency, and the only source with a real
  // French edition. Its own module spaces the three requests: the site
  // rate-limits hard. Backfilled per language, exactly like armradio.
  console.log('\nArmenpress — armenpress.am (fr/en/hy):')
  // Seeded per language, not {}: backfillSections reads `fresh.length`, so an
  // undefined here would throw and take the whole snapshot down — every other
  // source in this file seeds [] for exactly that reason.
  let apLangs = { fr: [], en: [], hy: [] }
  try {
    apLangs = await scrapeArmenpress(16)
  } catch (err) {
    console.error('  armenpress failed wholesale:', err.message)
  }
  const armenpress = {}
  for (const lang of ['fr', 'en', 'hy']) {
    armenpress[lang] = backfillSections(apLangs[lang], prevNews?.armenpress?.[lang], 'categoryKey')
  }
```

- [ ] **Step 3: Écrire la clé dans `news.json`**

Dans `main()`, remplacer :

```js
  await writeJson('news.json', {
    generatedAt,
    courrier,
    armradio,
    armenews,
    artzakank,
    armenieinfotv,
  })
```

par :

```js
  await writeJson('news.json', {
    generatedAt,
    courrier,
    armradio,
    armenews,
    artzakank,
    armenieinfotv,
    armenpress,
  })
```

- [ ] **Step 4: Lancer le scrape**

```bash
npm run scrape
```

Attendu — un bloc Armenpress avec trois lignes :

```
Armenpress — armenpress.am (fr/en/hy):
  ✓ armenpress/fr (16)
  ✓ armenpress/en (16)
  ✓ armenpress/hy (16)
```

Le scrape complet prend une minute et touche le réseau. Des `↺ keeping N previous …` ailleurs sont **normaux** — c'est le backfill.

**Si vous êtes bloqué.** Un `✗ armenpress/fr: HTTP 403` signifie presque
certainement que l'IP est limitée, **pas** que votre code est faux. Dans ce cas :
**ne relancez pas en boucle** — vous aggraveriez le blocage. Attendez une bonne
demi-heure, puis relancez **une** fois. Si les trois langues échouent en 403 alors
que le reste du scrape passe, rapportez `DONE_WITH_CONCERNS` en décrivant ce que
vous avez vu : le backfill fait son travail et le site reste sain, mais l'étape 5
ne pourra pas être vérifiée sur des données fraîches.

- [ ] **Step 5: Vérifier que les données sont saines**

C'est le test décisif de cette tâche : il attrape les trois pièges d'un coup.

```bash
node -e "
const d=JSON.parse(require('fs').readFileSync('src/data/news.json','utf8')).armenpress;
if(!d){console.log('✗ pas de clé armenpress');process.exit(1)}
for(const lang of ['fr','en','hy']){
  const arts=(d[lang]||[]).flatMap(s=>s.articles||[]);
  const badUrl=arts.filter(a=>!/^https:\/\/armenpress\.am\/(fr|en|hy)\/article\/\d+$/.test(a.url||''));
  const badDate=arts.filter(a=>!a.date||new Date(a.date).getFullYear()<2020);
  const noTitle=arts.filter(a=>!a.title||!a.title.trim());
  console.log(lang, '| articles:', arts.length, '| url KO:', badUrl.length, '| date KO:', badDate.length, '| titre KO:', noTitle.length);
  if(arts[0]) console.log('   ', arts[0].date, '|', arts[0].title.slice(0,60));
}
"
```

Attendu : `url KO: 0`, `date KO: 0`, `titre KO: 0` pour les trois langues, et des dates **récentes** (2026). Une date en **1970** signifie que le `× 1000` manque. Le premier titre `fr` doit être **en français**, le `hy` en arménien.

- [ ] **Step 6: Vérifier que le site construit ne casse pas**

```bash
npm run build && npm run lint
```

Attendu : le build passe ; le lint sort **0 erreur** (6 avertissements connus).

- [ ] **Step 7: Restaurer les données scrapées**

`npm run scrape` a réécrit tout `src/data/`. **Ce snapshot ne doit pas partir
dans cette branche** — c'est une branche de code, et le job horaire commite les
données sur `main` de son côté.

```bash
git checkout -- src/data/ public/sitemap.xml
git status --porcelain src/data/ public/sitemap.xml
```

Attendu : **aucune sortie**.

(La tâche 2 vérifie l'affichage sur les données déjà commitées, qui n'ont pas
encore de clé `armenpress` — c'est prévu : elle relancera le scrape.)

- [ ] **Step 8: Commit**

```bash
git add scripts/sources/armenpress.mjs scripts/scrape.mjs
git commit -m "feat(news): add Armenpress as a source, fr/en/hy

Armenia's national news agency, and the only source here with a real French
edition. It is an Inertia.js app, so the homepage embeds its feed as JSON —
this source needs no CSS selectors and survives a redesign.

Reads the homepage, not the rubric pages: those embed an empty feed and load
client-side, and the site rate-limits hard enough to 403 a residential IP
site-wide after ~30 requests. Three spaced requests per snapshot.

Shaped like armradio ({fr,en,hy} of [{categoryKey, articles}]) so
backfillSections covers it unchanged."
```

---

### Task 2: L'onglet, placé en premier

C'est la tâche qui porte le gain : `NewsBrowser` ne rend que l'onglet actif, donc
l'onglet par défaut est le seul contenu que le prérendu injecte dans le HTML —
et donc le seul que Google lit sans exécuter de JS. Il sert aujourd'hui de
l'anglais sous `<html lang="fr">`.

**Files:**
- Modify: `src/i18n.jsx` (blocs `fr` ~l.97-102, `en`, `hy` — deux clés par langue)
- Modify: `src/components/NewsBrowser.jsx` (`buildSources`, l. 64-125)

**Interfaces:**
- Consumes: la clé `armenpress` de `news.json` produite par la tâche 1, de forme `{ fr: [{categoryKey:'fil', articles}], en: […], hy: […] }`.
- Produces: rien que du code consomme.

- [ ] **Step 1: Ajouter les clés i18n françaises**

Dans `src/i18n.jsx`, bloc `fr`, après `'browser.armenieinfotv': 'armenieinfo.tv',` :

```js
    'browser.armenpress': 'Armenpress',
    'apcats.fil': 'Fil',
```

- [ ] **Step 2: Ajouter les clés i18n anglaises**

Dans le bloc `en`, après la ligne `'browser.armenieinfotv': …` :

```js
    'browser.armenpress': 'Armenpress',
    'apcats.fil': 'Wire',
```

- [ ] **Step 3: Ajouter les clés i18n arméniennes**

Dans le bloc `hy`, après la ligne `'browser.armenieinfotv': …` :

```js
    'browser.armenpress': 'Արմենպրես',
    'apcats.fil': 'Հոսք',
```

- [ ] **Step 4: Vérifier les trois blocs**

```bash
grep -n "browser.armenpress\|apcats.fil" src/i18n.jsx
```

Attendu : **six** lignes — deux par langue, dans trois zones distinctes du fichier. Si vous en voyez moins, une langue a été oubliée.

- [ ] **Step 5: Déclarer la source dans `NewsBrowser.jsx`**

Dans `buildSources(t, lang)`, **avant** `const armradio = {`, insérer :

```js
  // Armenpress maps 1:1 to the UI language — the only source that does.
  // It leads the tab order deliberately: NewsBrowser renders only the active
  // tab, so the default source is the one the prerender bakes into the HTML
  // and Google reads without running JS. ArmRadio led before, and has no
  // French edition — which shipped English headlines under lang="fr".
  const armenpress = {
    id: 'armenpress',
    brand: 'Armenpress',
    name: t('browser.armenpress'),
    lang: lang.toUpperCase(),
    live: true,
    images: true,
    cats: (news.armenpress?.[lang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`apcats.${s.categoryKey}`), articles: s.articles })),
  }
```

- [ ] **Step 6: Le placer en tête de l'ordre des onglets**

Remplacer :

```js
  return [armradio, courrier, armenews, artzakank, armenieinfotv].filter((s) => s.cats.length)
```

par :

```js
  return [armenpress, armradio, courrier, armenews, artzakank, armenieinfotv].filter((s) => s.cats.length)
```

L'onglet actif par défaut est `sources[0]` (`useState(sources[0]?.id)`), et le
`.filter()` protège : si Armenpress est vide, il disparaît et ArmRadio reprend la
tête — l'ancien comportement.

- [ ] **Step 7: Mettre à jour le commentaire d'en-tête de `buildSources`**

Le commentaire au-dessus de `function buildSources` (l. 60-63) décrit l'ordre
ancien. Remplacer sa première phrase :

```js
// Build the two source groups. ArmRadio has real EN and HY editions (shown per
// the UI language); Courrier d'Erevan is French-only (courrier.am/hy serves the
// same French articles), so it stays French in every language. Every rubric is
// its own carousel — nothing is merged, and empty rubrics are dropped.
```

par :

```js
// Build the source groups. Armenpress leads: it is the only source with a real
// French edition, and the default tab is the one the prerender bakes into the
// HTML for crawlers. ArmRadio has real EN and HY editions (shown per the UI
// language); Courrier d'Erevan is French-only (courrier.am/hy serves the same
// French articles), so it stays French in every language. Every rubric is its
// own carousel — nothing is merged, and empty rubrics are dropped.
```

- [ ] **Step 8: Rafraîchir les données pour pouvoir vérifier**

Les données commitées n'ont pas de clé `armenpress` : sans scrape, l'onglet serait filtré et vous ne verriez rien.

```bash
npm run scrape
```

Attendu : trois lignes `✓ armenpress/{fr,en,hy}`. En cas de 403, voir « Si vous êtes bloqué » (tâche 1, étape 4) et rapportez-le.

- [ ] **Step 9: Le test décisif — le HTML prérendu est-il français ?**

C'est la raison d'être de toute cette tâche.

```bash
npm run build && npm run prerender
```

Puis :

```bash
node -e "
const fs=require('fs');
const u=(s)=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,\"'\").replace(/&quot;/g,'\"');
const html=u(fs.readFileSync('dist/index.html','utf8'));
const n=JSON.parse(fs.readFileSync('src/data/news.json','utf8'));
const ap=(n.armenpress?.fr||[]).flatMap(s=>s.articles||[]);
const ar=(n.armradio?.en||[]).flatMap(s=>s.articles||[]);
console.log('Armenpress FR dans le HTML brut :', ap.filter(a=>html.includes(a.title)).length+'/'+ap.length);
console.log('ArmRadio EN dans le HTML brut   :', ar.filter(a=>html.includes(a.title)).length+'/'+ar.length);
console.log('exemple prérendu :', ap.find(a=>html.includes(a.title))?.title?.slice(0,70) || '(aucun)');
"
```

Attendu :
- **Armenpress FR : 16/16** — le contenu français est désormais dans le HTML brut ;
- **ArmRadio EN : 0/70** — l'ancien onglet par défaut n'est plus rendu, donc plus prérendu. **C'est le succès, pas une régression** : c'était précisément le problème.
- L'exemple prérendu doit être un titre **en français**.

- [ ] **Step 10: Vérifier que le site marche pour un humain**

Le prérendu ne prouve pas l'interface. Piloter le site construit.

Créer `.cache/check.mjs` — le dossier `.cache/` est ignoré par git **et** par
ESLint, donc ce script jetable ne salit rien. Il réutilise `findChrome()`, le
helper que `shoot.mjs` et `prerender.mjs` partagent déjà : ne redétectez pas le
navigateur à la main.

```js
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from '../scripts/lib/chrome.mjs'

const executablePath = findChrome()
if (!executablePath) {
  console.error('No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

const server = await preview({ root: process.cwd(), preview: { port: 4181, host: '127.0.0.1' } })
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] })
const errs = []
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle0' })
  const tabs = await page.$$eval('.newsfeed__tab', (els) => els.map((e) => e.textContent.trim()))
  console.log('onglets :', tabs)
  console.log('actif   :', await page.$eval('.newsfeed__tab.is-active', (e) => e.textContent.trim()))
  console.log('erreurs :', errs.length ? errs : 'aucune')
} finally {
  await browser.close()
  await new Promise((r) => server.httpServer.close(r))
}
```

```bash
node .cache/check.mjs && rm -f .cache/check.mjs
```

Attendu : le **premier** onglet et l'onglet **actif** portent « Armenpress », et **aucune erreur**.

**N'exécutez jamais `npm run dev` ni `npm run preview` directement** — ce sont des serveurs, ils ne rendent jamais la main.

- [ ] **Step 11: Lint et restauration des données**

```bash
npm run lint
```

Attendu : **0 erreur** (6 avertissements connus).

```bash
git checkout -- src/data/ public/sitemap.xml
git status --porcelain src/data/ public/sitemap.xml
```

Attendu : **aucune sortie**.

- [ ] **Step 12: Commit**

```bash
git add src/i18n.jsx src/components/NewsBrowser.jsx
git commit -m "feat(news): lead the tab order with Armenpress

NewsBrowser renders only the active tab, so the default source is the only
one the prerender bakes into the HTML — and the only news Google reads
without running JS. That default was ArmRadio, which has no French edition:
production served 70 English headlines under <html lang=\"fr\"> on a site
targeting French queries.

Armenpress maps 1:1 to the UI language, so the prerendered feed is now
French. Measured: Armenpress FR 16/16 in raw HTML, ArmRadio EN 0/70 — the
latter is the point, not a regression.

The .filter() on empty sources still protects the order: if Armenpress comes
back empty, ArmRadio leads again, exactly as before."
```

---

### Task 3: Les quatre lignes de documentation manquantes

Le README et `CLAUDE.md` décrivent **quatre** sources (`courrier`, `armradio`,
`armenopole`, `instagram`) alors que `scripts/sources/` en contient **sept** :
`armenews`, `artzakank` et `armenieinfotv` n'y figurent nulle part. Ajouter
Armenpress seul ferait passer les listes de fausses à fausses et plus longues.

**Files:**
- Modify: `README.md` (tableau « Sections », l. 15-22)
- Modify: `CLAUDE.md` (liste `scripts/sources/`, l. 92-98)

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Step 1: Constater l'état actuel**

```bash
sed -n '15,22p' README.md | cut -c1-80
grep -n "courrier.mjs\|armradio.mjs\|armenopole.mjs\|instagram.mjs" CLAUDE.md
```

Attendu : le tableau du README liste Actualités (Courrier), Newswire (armradio), Agenda, Don Narek, Instagram ; `CLAUDE.md` liste quatre modules. Aucun ne mentionne `armenews`, `artzakank`, `armenieinfotv` ni `armenpress`.

- [ ] **Step 2: Compléter la liste de `CLAUDE.md`**

Dans la liste sous `**`scripts/sources/`**`, remplacer :

```markdown
  - `courrier.mjs` — Le Courrier d'Erevan (actualités, par rubrique).
```

par :

```markdown
  - `armenpress.mjs` — Armenpress, l'agence de presse nationale (fr/en/hy).
    Application Inertia.js : le JSON du flux est embarqué dans la page, donc
    **aucun sélecteur CSS**. Lit l'accueil et non les pages de rubrique, qui
    embarquent un flux vide — et parce que le site **limite agressivement le
    débit** (403 sur tout le site après ~30 requêtes). Trois requêtes espacées
    par snapshot ; n'en ajoutez pas.
  - `courrier.mjs` — Le Courrier d'Erevan (actualités, par rubrique).
  - `armenews.mjs` — Nouvelles d'Arménie (armenews.com), six rubriques
    WordPress, francophone.
  - `artzakank.mjs` — Artzakank / Écho des Arméniens de Suisse, francophone,
    **trois** rubriques : Arménie & Artsakh et Communauté via l'API WordPress,
    plus Divers, gratté depuis la page HTML `/divers-p/`.
  - `armenieinfotv.mjs` — armenieinfo.tv, francophone, par rubrique.
```

- [ ] **Step 3: Noter l'ordre des onglets dans `CLAUDE.md`**

Toujours dans `CLAUDE.md`, à la fin de la section « À savoir », ajouter :

```markdown
- **L'ordre des onglets du fil est porteur de sens, pas cosmétique.**
  `NewsBrowser` ne rend que l'onglet actif : la source par défaut est donc la
  seule que le prérendu injecte dans le HTML, et la seule que Google lit sans
  exécuter de JS. Armenpress est en tête parce que c'est la seule source à avoir
  une vraie édition française. Avant lui, ArmRadio (éditions `en`/`hy`
  seulement) faisait servir 70 titres **anglais** sous `<html lang="fr">`. Ne
  réordonnez pas les onglets sans mesurer ce que devient le HTML prérendu.
```

- [ ] **Step 4: Compléter le tableau du README**

Dans le tableau « Sections », remplacer la ligne commençant par `| **Actualités** | [Le Courrier d'Erevan]` par les deux lignes suivantes (la ligne Courrier est conservée telle quelle, une ligne Armenpress la précède) :

```markdown
| **Actualités** | [Armenpress](https://armenpress.am/fr) | The national news agency's latest **16 headlines per language** (fr / en / hy), as a single **Fil / Wire / Հոսք** shelf. The only **trilingual** source — the others are French-only or en/hy. Not the default tab: Courrier is French-only and five times larger, so it prerenders more French copy for crawlers. Armenpress is an Inertia.js app, so its feed arrives as embedded JSON — **no CSS selectors**. Read from the homepage, not the rubric pages (those embed an empty feed and load client-side), with three spaced requests: the site rate-limits hard. |
| **Actualités** | [Le Courrier d'Erevan](https://courrier.am/fr) | The latest **10 articles per section** across the 8 sections (Actualités, Société, Économie, Arts et culture, Arménie francophone, Opinions, Région, Diasporas), each shown as a horizontal, swipeable **shelf** with ‹ › arrow controls. Cards link out to the original article. |
| **Actualités** | [Nouvelles d'Arménie](https://www.armenews.com) | The latest **10 articles per rubric** across 6 WordPress rubrics, French-only, as shelves. |
| **Actualités** | [Artzakank / Écho des Arméniens de Suisse](https://artzakank-echo.ch) | The latest **10 articles per rubric** across **3 rubrics**, French-only, as shelves: Arménie & Artsakh and Communauté come from the WordPress REST API, Divers is scraped from the site's `/divers-p/` page. |
| **Actualités** | [ArménieInfo.tv](https://armenieinfo.tv) | The latest **10 articles per rubric**, French-only, as shelves. |
```

- [ ] **Step 5: Vérifier que les sept sources sont documentées**

```bash
for s in armenpress courrier armenews artzakank armenieinfotv armradio armenopole instagram; do
  printf "  %-16s README:%s CLAUDE:%s\n" "$s" "$(grep -ci "$s" README.md)" "$(grep -ci "$s" CLAUDE.md)"
done
```

Attendu : **aucun `0`** dans la colonne CLAUDE pour les huit modules, et aucun `0` dans README sauf éventuellement pour des variantes de nommage — vérifiez à l'œil que chaque source du dossier `scripts/sources/` apparaît bien dans les deux fichiers.

```bash
ls scripts/sources/
```

Attendu : les huit modules, tous mentionnés ci-dessus.

- [ ] **Step 6: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: list all seven news sources, not four

README and CLAUDE.md documented courrier, armradio, armenopole and instagram
while scripts/sources/ held seven modules — armenews, artzakank and
armenieinfotv appeared in neither. Adding Armenpress alone would have made
the lists longer and no less wrong.

Also records why the tab order matters: the default tab is the one the
prerender bakes into the HTML, so reordering silently changes what Google
indexes."
```

---

## Vérification finale

- [ ] **Le scrape produit les trois langues** — `npm run scrape` imprime `✓ armenpress/{fr,en,hy} (16)`.
- [ ] **Le prérendu est français** — après `npm run build && npm run prerender`, les titres français d'Armenpress sont dans `dist/index.html` et ceux d'ArmRadio n'y sont plus.
- [ ] **Le lint passe** — `npm run lint` sort 0 erreur, 6 avertissements connus.
- [ ] **Aucune donnée scrapée n'est commitée** — `git status --porcelain src/data/` est vide.

**Après déploiement** (la fusion déclenche le workflow) :

```bash
curl -s https://armenieinfo.ch/ | grep -o "is-visible" | wc -l   # attendu : 11
curl -s https://armenieinfo.ch/ | wc -c                          # attendu : ~180 Ko
```

Puis vérifier qu'un titre français d'Armenpress apparaît dans le HTML servi. **N'utilisez pas `grep -c`** : il compte les lignes, pas les occurrences (voir la spec SEO du 2026-07-16).

## ⚠️ Correction — 2026-07-16, après la revue finale

**Ce plan reposait sur une affirmation fausse** : qu'Armenpress serait la seule
source à avoir une vraie édition française. Quatre sources sont déjà
francophones — courrier (**80** articles), armenews (60), armenieinfotv (59),
artzakank (28) — contre **16** pour Armenpress.

**Courrier mène donc les onglets, pas Armenpress** : 80 articles français
prérendus au lieu de 16, en une ligne, sans nouvel hôte. Armenpress reste un
onglet pour son fil trilingue en direct, que rien d'autre ne fournit.

Le plan a aussi promis « trois requêtes espacées » alors que `fetchText` retente
2 fois par défaut : c'étaient jusqu'à **neuf** requêtes, tirées exactement quand
le site bloque déjà. Corrigé par `retries: 0`.

Les tâches ci-dessous sont conservées telles qu'exécutées ; les correctifs
vivent dans les commits `8a86963` et suivants. Voir la spec pour l'analyse
complète, y compris le levier manqué : c'est le **rendu à onglet unique** qui est
la contrainte, pas le choix de l'onglet par défaut.

## Ce que ce plan ne promet pas

Le gain reste **partiel et indirect**. Faire passer le contenu prérendu de
l'anglais au français est une vraie amélioration — c'est la première depuis la
PR #2 qui touche ce que Google lit. Mais ces titres restent des dépêches
agrégées : sur le texte d'une dépêche, Armenpress battra toujours l'agrégateur.
Ce qui vise `actualités arméniennes Suisse` demeure le titre, le tagline et
l'agenda suisse — et, plus que tout, **les liens entrants**, qu'aucun commit ne
créera.

Les **sept rubriques** ne sont pas ici, et leur retour exige d'abord un fait :
établir que `?feed=N` peuple une page de rubrique. Tant que ce fait n'est pas
établi, il n'y a rien à planifier.
