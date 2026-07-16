# Trouvabilité Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre `armenieinfo.ch` trouvable sur `Arménie Info Suisse` et `actualités arméniennes Suisse` en plaçant « Suisse » dans le titre et le texte visible, et en servant le contenu des articles en HTML brut plutôt qu'en JavaScript seul.

**Architecture:** Trois changements indépendants. (1) Réécriture du `<title>` et du tagline français — pur texte. (2) Un script Puppeteer post-build qui rend la SPA et réinjecte le HTML dans `dist/index.html`, branché dans la CI en `continue-on-error` comme le screenshot existant. (3) `scripts/scrape.mjs` écrit un `<lastmod>` dans `public/sitemap.xml` à chaque snapshot.

**Tech Stack:** Vite 6, React 18, `puppeteer-core` 25 (déjà présent), Node 24, GitHub Actions, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-07-16-seo-trouvabilite-design.md`

## Global Constraints

- **Il n'y a pas de suite de tests dans ce dépôt** (`CLAUDE.md`). N'en introduisez pas : chaque tâche se vérifie en exécutant le build ou le script et en observant la sortie réelle. Les étapes de vérification ci-dessous sont les tests.
- **Le français porte tous ses accents** (é, è, à, ê, ç…) — `CLAUDE.md`.
- **Ne touchez pas au H1.** `site.title` reste `Arménie Info` dans les trois langues. Seul le **tagline français** change.
- **Ne touchez pas aux taglines `en` et `hy`.** Le ciblage « Suisse » vise une requête française.
- Valeurs exactes, copiées de la spec — à reproduire au caractère près :
  - `<title>` → `Arménie Info · Actualités arméniennes de Suisse`
  - `site.tagline` (fr) → `Un instantané horaire de la vie arménienne, de Suisse et du monde`
  - Le séparateur est `·` (U+00B7 MIDDLE DOT), pas un tiret.
- **Toute étape Puppeteer en CI est `continue-on-error: true`.** Un prérendu cassé ne doit jamais bloquer un déploiement — c'est la dégradation en douceur des scrapers, appliquée au build.
- `puppeteer-core` **ne télécharge pas de navigateur** : il faut un Chrome/Edge déjà installé. En local, `scripts/shoot.mjs` le détecte tout seul ; sinon `PUPPETEER_EXECUTABLE_PATH` force le chemin.
- Commits fréquents, un par tâche.

---

## File Structure

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `index.html` | `<title>`, `og:title`, `twitter:title` | 1 |
| `src/i18n.jsx` | `site.tagline` (fr) | 1 |
| `scripts/prerender.mjs` | **nouveau** — rend `dist/` et réinjecte le HTML | 2 |
| `package.json` | script npm `prerender` | 2 |
| `.github/workflows/hourly.yml` | étape de prérendu ; sitemap dans le commit | 2, 3 |
| `scripts/scrape.mjs` | écrit `public/sitemap.xml` | 3 |
| `public/sitemap.xml` | gagne un `lastmod` | 3 |

Les trois tâches sont **indépendantes** et peuvent être relues séparément. La tâche 2 est la seule qui porte un risque réel.

---

### Task 1: Ciblage géographique (les mots)

Aucun JavaScript, aucun build. Du texte, dans deux fichiers.

**Files:**
- Modify: `index.html` (`<title>`, `og:title`, `twitter:title`)
- Modify: `src/i18n.jsx:14` (`site.tagline`, bloc `fr` uniquement)

**Interfaces:**
- Consumes: rien.
- Produces: rien que du code consomme. La tâche 2 prérendra ce texte ; elle n'en dépend pas pour fonctionner.

- [ ] **Step 1: Constater l'état actuel**

```bash
grep -n "Արմենիա Ինֆո\|site.tagline" index.html src/i18n.jsx
```

Attendu — quatre lignes portent l'ancien titre, une par langue pour le tagline :

```
index.html:11:    <title>Arménie Info · Արմենիա Ինֆո</title>
index.html:17:    <meta property="og:title" content="Arménie Info · Արմենիա Ինֆո" />
index.html:25:    <meta name="twitter:title" content="Arménie Info · Արմենիա Ինֆո" />
src/i18n.jsx:14:    'site.tagline': "Un instantané quotidien de l'Arménie et de sa diaspora",
```

(Les numéros de ligne peuvent avoir bougé ; ce sont les chaînes qui comptent.)

- [ ] **Step 2: Réécrire le `<title>` dans `index.html`**

Remplacer :

```html
    <title>Arménie Info · Արմենիա Ինֆո</title>
```

par :

```html
    <title>Arménie Info · Actualités arméniennes de Suisse</title>
```

- [ ] **Step 3: Aligner `og:title` et `twitter:title`**

Remplacer :

```html
    <meta property="og:title" content="Arménie Info · Արմենիա Ինֆո" />
```

par :

```html
    <meta property="og:title" content="Arménie Info · Actualités arméniennes de Suisse" />
```

et remplacer :

```html
    <meta name="twitter:title" content="Arménie Info · Արմենիա Ինֆո" />
```

par :

```html
    <meta name="twitter:title" content="Arménie Info · Actualités arméniennes de Suisse" />
```

**Ne touchez pas** à `og:site_name` (`Arménie Info`) ni au JSON-LD : `alternateName: "Արմենիա Ինֆո"` doit rester — c'est là que le nom arménien survit à ce changement.

- [ ] **Step 4: Réécrire le tagline français dans `src/i18n.jsx`**

Dans le bloc `fr` **seulement** (autour de la ligne 14), remplacer :

```js
    'site.tagline': "Un instantané quotidien de l'Arménie et de sa diaspora",
```

par :

```js
    'site.tagline': 'Un instantané horaire de la vie arménienne, de Suisse et du monde',
```

Notez le passage aux guillemets simples : la nouvelle chaîne ne contient plus d'apostrophe, donc les doubles ne servent plus à rien.

Les blocs `en` (ligne ~130) et `hy` (ligne ~246) **ne changent pas**.

- [ ] **Step 5: Vérifier que rien d'autre n'a bougé**

```bash
grep -n "site.tagline" src/i18n.jsx
```

Attendu — exactement trois lignes, dont une seule modifiée :

```
14:    'site.tagline': 'Un instantané horaire de la vie arménienne, de Suisse et du monde',
130:    'site.tagline': 'A daily snapshot of Armenia and its diaspora',
246:    'site.tagline': 'Հայաստանի եւ սփյուռքի ամենօրյա պատկերը',
```

Si `en` ou `hy` ont changé, annulez et refaites.

- [ ] **Step 6: Vérifier le rendu réel**

```bash
npm run build && npm run preview
```

Ouvrir `http://localhost:4173`. Vérifier de vos yeux :
- l'onglet du navigateur affiche `Arménie Info · Actualités arméniennes de Suisse` ;
- le H1 affiche toujours **`Arménie Info`** (inchangé) ;
- la ligne sous le H1 affiche `Un instantané horaire de la vie arménienne, de Suisse et du monde`, accents compris ;
- basculer en English et en Հայերեն : les taglines y sont inchangés.

Arrêter le serveur (Ctrl+C).

- [ ] **Step 7: Lint**

```bash
npm run lint
```

Attendu : aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add index.html src/i18n.jsx
git commit -m "feat(seo): target Swiss queries in title and French tagline

Le mot « Suisse » n'était que dans la meta description. Il entre dans le
<title> et dans le texte visible sous le H1 — ce qui distingue le site de
son homonyme français armenieinfo.tv, qui possède la requête « Arménie
Info » nue. Le H1 reste la marque, non touché.

« Արմենիա Ինֆո » quitte le <title> mais survit dans og:site_name et le
JSON-LD alternateName."
```

---

### Task 2: Prérendu au build

Le cœur du plan, et la seule tâche risquée. Aujourd'hui `curl https://armenieinfo.ch/` ne renvoie que `<div id="root"></div>` : les articles n'existent que pour un crawler qui exécute le JavaScript, ce que Google fait dans une seconde passe plus lente et moins fiable.

**Files:**
- Create: `scripts/prerender.mjs`
- Modify: `package.json` (bloc `scripts`)
- Modify: `.github/workflows/hourly.yml` (une étape après le screenshot)

**Interfaces:**
- Consumes: `dist/` produit par `npm run build`. Le motif de détection Chrome est copié de `scripts/shoot.mjs:28-42`.
- Produces: `npm run prerender`, qui réécrit `dist/index.html` sur place. La tâche 3 n'en dépend pas.

**Deux pièges à connaître avant d'écrire le code :**

1. **`.reveal { opacity: 0 }`** (`src/styles/global.css:1911`). Le contenu est transparent tant que `useReveal` n'a pas ajouté `.is-visible` au scroll. Sérialiser sans corriger ça livre à Google une page invisible. Le script **doit** stamper `is-visible` sur tous les `.reveal` avant de sérialiser.
2. **Pas d'hydratation.** `src/main.jsx` utilise `createRoot`, qui **vide** le conteneur et re-rend de zéro. React ne tentera jamais de réconcilier le HTML prérendu : il n'y a donc aucun risque de mismatch, et c'est voulu. Ne le remplacez **pas** par `hydrateRoot` — ça introduirait une classe de bugs entière pour un gain nul ici.

- [ ] **Step 1: Écrire `scripts/prerender.mjs`**

Créer le fichier avec exactement ce contenu :

```js
/**
 * Bake the rendered app into dist/index.html.
 *
 * The site is a single-page app: the shipped HTML is an empty <div id="root">,
 * so the articles only exist for a crawler that runs JavaScript. Google does,
 * but on a slower second pass. This renders the page with a headless browser
 * and writes the resulting markup back into dist/index.html, so the snapshot's
 * articles are in the raw HTML on the first pass. The hourly build reruns this,
 * so the baked HTML is never staler than the snapshot it ships with.
 *
 * main.jsx uses createRoot (not hydrateRoot): React clears the container and
 * re-renders on load, so the baked markup is never reconciled and cannot
 * mismatch. That is deliberate — do not "fix" it by hydrating.
 *
 * Browser: uses puppeteer-core against an already-installed Chrome/Edge.
 * Set PUPPETEER_EXECUTABLE_PATH to override the auto-detected path.
 *
 *   npm run prerender            # after `npm run build`
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INDEX = path.join(root, 'dist', 'index.html')

// First existing browser wins; env override takes precedence.
const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean)

const executablePath = CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

if (!existsSync(INDEX)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

const server = await preview({ root, preview: { port: 4174, host: '127.0.0.1' } })
const url = server.resolvedUrls.local[0]
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle0' })

  // .reveal starts at opacity:0 and only becomes visible once useReveal's
  // IntersectionObserver fires on scroll. Serialising as-is would ship a
  // transparent page. Stamp every .reveal visible before reading the DOM.
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
  })

  const rendered = await page.$eval('#root', (el) => el.innerHTML)
  if (!rendered.trim()) throw new Error('#root rendered empty — refusing to bake a blank page')

  const html = await readFile(INDEX, 'utf-8')
  const marker = '<div id="root"></div>'
  if (!html.includes(marker)) throw new Error(`marker ${marker} not found in dist/index.html`)

  await writeFile(INDEX, html.replace(marker, `<div id="root">${rendered}</div>`), 'utf-8')
  console.log(`✓ baked ${rendered.length.toLocaleString('en-US')} chars into dist/index.html`)
} finally {
  await browser.close()
  await new Promise((res) => server.httpServer.close(res))
}
```

Points de conception à ne pas « simplifier » :
- **Port 4174**, pas 4173 : `shoot.mjs` occupe 4173, et les deux tournent à la suite dans la CI.
- **Le garde-fou `#root` vide** : sans lui, un rendu raté écrirait une page blanche par-dessus une SPA qui marchait. Mieux vaut planter.
- **Le garde-fou du marqueur** : si Vite change sa sortie, on veut une erreur bruyante, pas un remplacement silencieux qui ne fait rien.

- [ ] **Step 2: Ajouter le script npm**

Dans `package.json`, remplacer :

```json
    "screenshot": "node scripts/shoot.mjs"
```

par :

```json
    "screenshot": "node scripts/shoot.mjs",
    "prerender": "node scripts/prerender.mjs"
```

- [ ] **Step 3: Vérifier qu'il échoue proprement sans build**

```bash
rm -rf dist && npm run prerender
```

Attendu : sortie `dist/index.html not found. Run \`npm run build\` first.` et code de sortie non nul. C'est le garde-fou qui parle — il fonctionne.

- [ ] **Step 4: Le faire réussir**

```bash
npm run build && npm run prerender
```

Attendu — une ligne du genre (le nombre exact variera avec le snapshot) :

```
✓ baked 84,312 chars into dist/index.html
```

Si le nombre est proche de zéro ou si le script plante sur « refusing to bake a blank page », le rendu n'a pas eu lieu : ne contournez pas le garde-fou, trouvez pourquoi.

- [ ] **Step 5: Vérifier que le contenu est vraiment dans le HTML brut**

C'est **le test décisif de tout ce plan**. Prendre un titre d'article réel du snapshot et le chercher dans le fichier, sans navigateur.

React échappe `&` en `&amp;` dans le HTML : une comparaison naïve donnerait un faux négatif sur un titre contenant une esperluette. On dés-échappe donc avant de comparer.

```bash
node -e "const fs=require('fs');const t=JSON.parse(fs.readFileSync('src/data/news.json','utf8')).courrier[0].articles[0].title;const u=(s)=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,\"'\").replace(/&quot;/g,'\"');console.log('cherche:',t);console.log(u(fs.readFileSync('dist/index.html','utf8')).includes(t)?'✓ TROUVÉ dans le HTML brut':'✗ ABSENT')"
```

Attendu : `✓ TROUVÉ dans le HTML brut`.

Cette commande a été exécutée sur un `dist/` **non** prérendu pendant la rédaction du plan : elle répond `✗ ABSENT`. Le test sait donc échouer — c'est ce qui rend son succès signifiant.

Vérifier aussi que les `.reveal` sont visibles et pas transparents :

```bash
grep -c 'class="[^"]*reveal[^"]*is-visible' dist/index.html
```

Attendu : un nombre **supérieur à 0**. Si c'est 0, l'étape 2 du script n'a pas fait son travail et vous livrez une page à `opacity: 0`.

- [ ] **Step 6: Vérifier que le site marche toujours pour un humain**

```bash
npm run preview
```

Ouvrir `http://localhost:4173`. Le site doit s'afficher et se comporter **exactement** comme avant : bascule jour/nuit, changement de langue, carrousels, ancres. Ouvrir la console : **aucune erreur React**, en particulier aucun avertissement d'hydratation (il ne devrait pas y en avoir — `createRoot` re-rend, il n'hydrate pas).

Arrêter le serveur (Ctrl+C).

- [ ] **Step 7: Lint**

```bash
npm run lint
```

Attendu : aucune erreur.

- [ ] **Step 8: Commit du script**

```bash
git add scripts/prerender.mjs package.json
git commit -m "feat(seo): prerender the app into dist/index.html

curl on the live site returned an empty <div id=\"root\">: the articles
only existed for a crawler willing to run JS, which Google does on a
slower, less reliable second pass. Render with the Chrome that shoot.mjs
already needs, and bake the markup in.

Stamps .is-visible on every .reveal first — those start at opacity:0 and
would otherwise ship a transparent page. Bails rather than baking a blank
#root over a working SPA."
```

- [ ] **Step 9: Brancher le prérendu dans la CI**

Dans `.github/workflows/hourly.yml`, après l'étape `Screenshot Don Narek carousel into dist/` et **avant** `Deploy to Firebase Hosting`, insérer :

```yaml
      # Bake the rendered app into dist/index.html so crawlers get the
      # snapshot's articles in raw HTML instead of an empty #root.
      # Best-effort, like the screenshot: a prerender failure must never
      # block the deploy — worst case we ship the plain SPA, as before.
      - name: Prerender dist/index.html
        continue-on-error: true
        env:
          PUPPETEER_EXECUTABLE_PATH: ${{ steps.chrome.outputs.chrome-path }}
        run: npm run prerender
```

Le `id: chrome` existe déjà sur l'étape `Set up Chrome (for screenshot)` : on réutilise ce Chrome, on n'en installe pas un second.

- [ ] **Step 10: Vérifier le YAML**

```bash
node -e "const {readFileSync}=require('fs');const y=readFileSync('.github/workflows/hourly.yml','utf8');const i=y.indexOf('Prerender dist/index.html'),s=y.indexOf('Screenshot Don Narek'),d=y.indexOf('Deploy to Firebase');console.log(i>s && i<d ? '✓ ordre correct : screenshot < prerender < deploy' : '✗ mauvais ordre')"
```

Attendu : `✓ ordre correct : screenshot < prerender < deploy`.

Relire à l'œil que `continue-on-error: true` est bien présent sur la nouvelle étape.

- [ ] **Step 11: Commit de la CI**

```bash
git add .github/workflows/hourly.yml
git commit -m "ci(seo): prerender dist/index.html before deploying

Reuses the Chrome the screenshot step already installs. continue-on-error,
so a broken prerender degrades to shipping the plain SPA rather than
failing the hourly deploy — same posture as the scrapers."
```

---

### Task 3: `lastmod` dans le sitemap

`public/sitemap.xml` annonce `changefreq: hourly` sans jamais prouver un changement.

**Files:**
- Modify: `scripts/scrape.mjs` (import `join`/`writeFile` déjà présents ; ajouter un helper et un appel dans `main()`)
- Modify: `public/sitemap.xml` (gagne un `lastmod`)
- Modify: `.github/workflows/hourly.yml` (étape « Commit refreshed data »)

**Interfaces:**
- Consumes: `generatedAt` — l'horodatage ISO déjà calculé en tête de `main()` dans `scripts/scrape.mjs` et écrit dans `meta.json`.
- Produces: rien que du code consomme.

**Pourquoi le scrape et pas le build :** un push sur `main` rebuild **sans** scraper (voir `hourly.yml`). Écrire le `lastmod` au build annoncerait à Google une fraîcheur qui n'existe pas. C'est le scrape qui détient la vérité.

- [ ] **Step 1: Ajouter le helper dans `scripts/scrape.mjs`**

Juste après `writeJson` (autour de la ligne 42), ajouter :

```js
const PUBLIC_DIR = join(__dirname, '..', 'public')

// The sitemap claims changefreq: hourly — lastmod is what backs the claim.
// Written here, not at build time: a push to main rebuilds without scraping,
// and a lastmod from that build would announce a freshness that never happened.
async function writeSitemap(generatedAt) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://armenieinfo.ch/</loc>
    <lastmod>${generatedAt}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
  await writeFile(join(PUBLIC_DIR, 'sitemap.xml'), xml, 'utf-8')
  console.log('→ wrote public/sitemap.xml')
}
```

`writeFile` et `join` sont déjà importés en tête du fichier — ne les réimportez pas.

- [ ] **Step 2: L'appeler**

Dans `main()`, juste après la ligne :

```js
  await writeJson('meta.json', { generatedAt })
```

ajouter :

```js
  await writeSitemap(generatedAt)
```

- [ ] **Step 3: Lancer le scrape**

```bash
npm run scrape
```

Attendu : la sortie se termine par `→ wrote public/sitemap.xml` puis `✅ Snapshot complete.`

(Le scrape complet prend une minute et touche le réseau. Des avertissements `↺ keeping N previous …` sont normaux — c'est le backfill.)

- [ ] **Step 4: Vérifier le sitemap**

```bash
cat public/sitemap.xml
```

Attendu — un `lastmod` ISO, et il doit correspondre à `meta.json` :

```bash
node -e "const {readFileSync}=require('fs');const m=JSON.parse(readFileSync('src/data/meta.json','utf8')).generatedAt;const s=readFileSync('public/sitemap.xml','utf8');console.log(s.includes('<lastmod>'+m+'</lastmod>') ? '✓ lastmod correspond à meta.json : '+m : '✗ décalage')"
```

Attendu : `✓ lastmod correspond à meta.json : 2026-…`

- [ ] **Step 5: Vérifier que le XML est valide et survit au build**

```bash
npm run build && cat dist/sitemap.xml
```

Attendu : `dist/sitemap.xml` est identique à `public/sitemap.xml` — Vite copie `public/` tel quel.

- [ ] **Step 6: Ajouter le sitemap au commit horaire**

Dans `.github/workflows/hourly.yml`, étape « Commit refreshed data », remplacer :

```yaml
          git add src/data/news.json src/data/agenda.json src/data/meta.json src/data/instagram-feed.json
```

par :

```yaml
          git add src/data/news.json src/data/agenda.json src/data/meta.json src/data/instagram-feed.json public/sitemap.xml
```

Sans ça, le `lastmod` régénéré chaque heure ne serait jamais committé, et la CI travaillerait sur un arbre sale.

- [ ] **Step 7: Commit**

```bash
git add scripts/scrape.mjs public/sitemap.xml .github/workflows/hourly.yml
git commit -m "feat(seo): stamp lastmod into the sitemap each snapshot

The sitemap claimed changefreq: hourly without ever backing it. The scrape
writes it, not the build: a push to main rebuilds without scraping, and a
lastmod from there would announce a freshness that never happened."
```

---

## Vérification finale (après déploiement)

Ces trois tâches ne se prouvent qu'en production. Une fois `main` déployé (le workflow part au push) :

- [ ] **Le prérendu est vraiment en ligne** — le test qui compte :

```bash
curl -s https://armenieinfo.ch/ | grep -o "<title>[^<]*</title>"
curl -s https://armenieinfo.ch/ | grep -c "is-visible"
```

Attendu : le nouveau titre, et un compte `is-visible` supérieur à 0. Si le second renvoie 0, le prérendu a échoué silencieusement en CI (`continue-on-error` masque l'échec **par conception**) — allez lire les logs de l'étape « Prerender dist/index.html ».

- [ ] **Search Console** — Inspection d'URL sur `https://armenieinfo.ch/` : le HTML testé doit contenir les articles, et le titre doit être le nouveau. Puis demander une réindexation.
- [ ] **Le sitemap** — `https://armenieinfo.ch/sitemap.xml` porte un `lastmod` de l'heure courante.

**Les classements ne se vérifient pas ici.** Le rapport « Performances » de Search Console, filtré sur `Suisse`, sur **plusieurs semaines**. Personne ne doit déclarer ce travail « réussi » sur la foi d'une recherche Google faite le lendemain.

## Ce que ce plan ne fait pas

Redit ici parce que c'est le point le plus important du dossier et le plus facile à oublier une fois les commits passés : **sur `actualités arméniennes Suisse`, les liens entrants pèseront plus lourd que ces trois tâches réunies.** Un lien depuis ArmeniensDeLausanne, depuis les réseaux du site, depuis les associations arméniennes de Suisse. Ce plan prépare le terrain ; il ne gagne pas la place.

Sur `Arménie Info` nu, l'homonyme [armenieinfo.tv](https://armenieinfo.tv/) garde la requête. Ce n'est pas un échec du plan — c'est une contrainte acceptée dans la spec.
