# Résumés d'articles (étape 1, invisible) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque heure, le scrape écrit un résumé IA de 3 à 4 phrases pour les nouveaux articles d'actualité, et les garde 30 jours dans une archive versionnée. Rien de visible ne change sur le site.

**Architecture:** Deux modules purs, `article-text.mjs` (télécharger + extraire le texte d'un article, toutes sources) et `article-resumes.mjs` (choisir les articles, appeler OpenRouter, vérifier, archiver), calqués sur `scripts/lib/agenda-resumes.mjs`, qui est le modèle à suivre ligne à ligne. L'étape est appelée en **dernier** dans `scripts/scrape.mjs`, ne lève jamais, et écrit des fichiers journaliers `src/data/article-resumes/AAAA-MM-JJ.json` commités par `hourly.yml`. Aucun fichier de `src/` ne les importe dans cette étape.

**Tech Stack:** Node ≥ 20 (ESM), `cheerio` (déjà en dépendance), `node:test`, OpenRouter `:free` (secret `OPENROUTER_API_KEY` existant).

**Spec:** `docs/superpowers/specs/2026-11-28-accueil-rts-design.md` (§ Données, § Ordre de livraison, étape 1). L'interface (étape 2) fera l'objet d'un second plan.

**Worktree :** `C:\Users\nareg\Documents\Claude code\ArmenianNews-accueil-rts`, branche `accueil-rts`. Vérifier `git rev-parse --show-toplevel` avant chaque commit (le dossier parent est un autre dépôt). Un commit par tâche = un point de retour.

## Global Constraints

- **Rien de visible** : aucun fichier de `src/components/`, `src/App.jsx`, `index.html`, `public/`, `sites.config.js` ne change ; aucun import de `article-resumes` dans `src/` (test de garde, Tâche 4).
- **Jamais de texte d'article stocké ni publié** : seul le résumé (et les métadonnées déjà publiques : titre, URL, image, rubrique, source, date) entre dans l'archive.
- Résumé : **3 à 4 phrases**, 200 à 800 caractères, dans la langue demandée, faits du texte seulement, noms propres tels qu'écrits.
- Langues : article de langue de contenu `fr` → résumés `fr`, `de`, `it` ; toute autre langue `L` → résumé `L` seulement (`CONTENT_LANG` de `src/newsLangs.js`).
- Archive : **30 jours** (`ARCHIVE_DAYS = 30`) comptés sur la date de l'article ; une entrée dont l'URL est encore dans `news.json` n'est jamais élaguée.
- Quota : l'étape tourne **après** classement, brève et résumés d'agenda ; `MAX_PER_SNAPSHOT = 20`, `CONCURRENCY = 3`, `BUDGET_MS = 150000`, `MAX_ATTEMPTS = 3` ; un `HTTP 429` arrête l'étape pour ce run.
- Fenêtre : seuls les articles datés de moins de **7 jours** (`WINDOW_DAYS = 7`) ou non datés sont candidats ; les plus récents d'abord.
- Logs : succès `  ✓ résumé-article: …`, toute panne `  ✗ résumé-article: …` ; la clé n'est jamais loguée.
- Les tests ne touchent jamais le réseau (fonctions `fetchPage` / `fetchImpl` injectées).
- `npm test` et `npm run lint` (0 erreur, 5 avertissements connus) passent à chaque commit.

## Review Focus

1. **Article Inertia (Armenpress, CivilNet, news.am)** : le corps n'est pas dans des `<p>` du HTML mais dans le JSON de `#app[data-page]` → l'extracteur doit le trouver (test Tâche 1 `inertia`).
2. **Page qui n'est pas un article** (redirection vers l'accueil, page de consentement, 403 Cloudflare, Asbarez bloqué) → aucun résumé, `✗` au log, jamais le résumé d'une page générique (tests Tâche 1 `trop court` et Tâche 2 `fetch en échec`).
3. **Modèle qui répond dans la mauvaise écriture** (latin dans `hy`/`ru`, français dans `de`/`it`) → la langue fautive est écartée, les autres gardées (test Tâche 2 `vetArticleResumes`).
4. **Quota épuisé en cours de run (429)** → arrêt net, les articles restants attendent le run suivant, aucun essai compté (test Tâche 2 `429`).
5. **Même URL dans plusieurs fils** (Armenpress listée dans deux rubriques, ou deux langues) → un seul appel, une seule entrée (test Tâche 2 `listArticles` dédoublonne).

---

### Task 1: Extraire le texte d'un article, toutes sources

**Files:**
- Create: `scripts/lib/article-text.mjs`
- Test: `test/article-text.test.mjs`

**Interfaces:**
- Produces:
  - `MIN_TEXT = 300`, `MAX_TEXT = 6000` (caractères).
  - `extractArticleText(html: string): string | null` — texte brut du corps, paragraphes séparés par `\n`, tronqué à `MAX_TEXT` ; `null` si moins de `MIN_TEXT`.
  - `fetchArticle(url: string): Promise<string>` — HTML de la page ; `fetchTextNode(host, path)` pour les hôtes de `NODE_HOSTS`, `fetchText(url, { redirect: 'manual' })` sinon.
  - `NODE_HOSTS: Set<string>` = `armenpress.am`, `civilnet.am`, `news.am`, `med.news.am`, `sport.news.am`, `style.news.am` (même liste que les modules sources qui utilisent `fetchTextNode` — relire `scripts/sources/newsam.mjs` pour les hôtes exacts et compléter si besoin).

- [ ] **Step 1: Write the failing tests** — `test/article-text.test.mjs`, HTML écrit en ligne dans le test (pas de fichiers de fixture) :
  - `wordpress` : `<article><div class="entry-content"><p>` × 4 paragraphes de ~120 car.`</p></div></article>` entouré de `<nav>`, `<aside>`, `<footer>` contenant du texte → le résultat contient les 4 paragraphes joints par `\n` et **aucun** texte de nav/aside/footer.
  - `inertia` : `<div id="app" data-page="…">` dont le JSON (échappé en entités HTML, comme en production) contient `{"props":{"article":{"title":"T","content":"<p>A…</p><p>B…</p>"}}}` avec A+B ≥ 300 car. → le résultat contient A et B, sans balises.
  - `fallback p` : aucune balise `article`/`main`, 5 `<p>` longs directement dans `<body>` → les 5 sont rendus ; un `<p>` de moins de 40 caractères (« Partager », « Lire aussi ») est ignoré.
  - `trop court` : une page d'accueil avec 3 `<p>` de 30 car. → `null`.
  - `tronqué` : 100 paragraphes de 200 car. → `result.length <= MAX_TEXT`.
  - `fetchArticle route` : avec des faux `fetchTextNode`/`fetchText` injectés en second paramètre (`fetchArticle(url, { fetchTextNode, fetchText })`), `https://armenpress.am/fr/article/1` appelle `fetchTextNode('armenpress.am', '/fr/article/1')` et `https://www.armenews.com/x` appelle `fetchText` avec `{ redirect: 'manual' }`.

- [ ] **Step 2: Run** `node --test test/article-text.test.mjs` — Expected: FAIL (module absent).

- [ ] **Step 3: Implement** `scripts/lib/article-text.mjs`.
  Ordre d'extraction : (1) si `#app[data-page]` existe, `JSON.parse` de l'attribut (cheerio décode les entités), puis la **plus longue** valeur chaîne contenant `<p` trouvée en parcourant l'objet → recharger cette chaîne dans cheerio et passer en (3) ; (2) sinon retirer `script, style, nav, header, footer, aside, form, figure, noscript`, puis prendre le premier conteneur présent parmi `[itemprop="articleBody"]`, `.entry-content`, `.post-content`, `.article-content`, `.article-body`, `article`, `main` ; à défaut `body` ; (3) garder les `<p>` (et `li` d'un `ul` dans le conteneur) de 40 caractères ou plus, espaces repliés, joints par `\n`. Signature de test : `fetchArticle(url, deps = { fetchTextNode, fetchText })`.

- [ ] **Step 4: Run** `node --test test/article-text.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/lib/article-text.mjs test/article-text.test.mjs
git commit -m "feat(résumés): extraire le texte d'un article, toutes sources"
```

### Task 2: Choisir, résumer, vérifier — l'étape `summarizeArticles`

**Files:**
- Create: `scripts/lib/article-resumes.mjs`
- Test: `test/article-resumes.test.mjs`

**Interfaces:**
- Consumes: `extractArticleText`, `fetchArticle` (Tâche 1) ; `feedFor`, `TAB_ORDER`, `SOURCE_NAMES`, `contentLang` (`src/newsLangs.js`) ; `parseResumeReply`, `sourceHash` (`scripts/lib/agenda-resumes.mjs`) ; `strayWords`, `allowedWords`, `frenchWords` (`scripts/lib/brief-script.mjs`) ; `ENDPOINT`, `STRONG_MODEL`, `DEFAULT_MODEL` (`scripts/lib/classify-rubrics.mjs`) ; `RESUME_MODELS` / `resumeModels()` (agenda-resumes — **même chaîne**, mesurée pour l'arménien).
- Produces (utilisés par la Tâche 3 et par le plan de l'étape 2) :
  - Constantes : `ARCHIVE_DAYS = 30`, `WINDOW_DAYS = 7`, `MAX_PER_SNAPSHOT = 20`, `CONCURRENCY = 3`, `BUDGET_MS = 150000`, `MAX_ATTEMPTS = 3`, `MIN_LEN = 200`, `MAX_LEN = 800`.
  - Type `ArchiveEntry` : `{ url, lang, source, title, image, rubric, date, hash?, attempts, checkedAt?, resumes: { [lang]: string } }` — `lang` = langue de contenu ; `rubric` = rubrique commune déjà calculée.
  - `listArticles(news): Article[]` — tous les articles de `news.json`, une entrée par URL, `{ url, lang, source, title, image, rubric, date }`, en parcourant `TAB_ORDER` des langues de contenu (`fr en hy ru es`) via `feedFor` et en aplatissant `sections[].articles`.
  - `summaryLangs(lang: string): string[]` — `fr` → `['fr','de','it']`, sinon `[lang]`.
  - `pendingArticles(articles, archive, now, max = MAX_PER_SNAPSHOT): Article[]` — candidats : jamais vus, ou incomplets avec `attempts < MAX_ATTEMPTS` ; exclus : datés de plus de `WINDOW_DAYS` jours ; tri par date décroissante (non datés en tête).
  - `buildArticleMessages(article, text, langs): Message[]` — système : « You summarise news articles for an Armenian news site. Write 3 or 4 sentences (about 300 to 600 characters) per language stating only facts present in the article: who, what, where, when. No opinion, no speculation, nothing not in the text. Keep proper names exactly as written. Write each language natively, never mixing scripts. Reply with ONE JSON object and nothing else: {…} » (clés = `langs`, noms de langue de `LANG_NAMES` de agenda-resumes) ; utilisateur : `Title: …\nSource: …\n\nArticle:\n…`.
  - `vetArticleResumes(byLang, { title, text }): { kept, rejected }` — longueur hors `[MIN_LEN, MAX_LEN]` → `'longueur'` ; `strayWords`/`frenchWords` non vides → `'alphabet'`.
  - `summarizeArticles({ articles, archive, apiKey, fetchPage, fetchImpl, now, budgetMs, max, timeoutMs, log }): Promise<Archive>` — **ne lève jamais** ; renvoie l'archive mise à jour (pas d'élagage ici : Tâche 3). Défauts : `fetchPage = fetchArticle`, `fetchImpl = fetch`.

- [ ] **Step 1: Write the failing tests** — `test/article-resumes.test.mjs`, réseau entièrement simulé :
  - `listArticles dédoublonne` : un `news` minimal où la même URL apparaît dans deux sections d'`armenpress.fr` et une autre dans `courrier` → 2 articles, `lang: 'fr'`, `source` renseignée.
  - `summaryLangs` : `fr` → `['fr','de','it']`, `hy` → `['hy']`.
  - `pendingArticles` : `now = 2026-11-28T12:00Z` ; article daté du 2026-11-15 → exclu ; article complet dans l'archive → exclu ; article avec `attempts: 3` et une langue manquante → exclu ; deux nouveaux datés 27 et 28 → le 28 d'abord ; `max: 1` → un seul.
  - `vetArticleResumes` : `{ hy: '<texte arménien 300 car. avec "successoffice">', ru: '<russe correct 300 car.>' }` → `kept` = `{ ru }`, `rejected` contient `['hy','alphabet']` ; un résumé de 100 car. → `'longueur'`.
  - `résume et archive` : `fetchPage` rend un HTML WordPress de la Tâche 1, `fetchImpl` rend `{ ok: true, json: () => ({ choices: [{ message: { content: '{"fr":"…","de":"…","it":"…"}' } }] }) }` (trois textes valides) → l'entrée a `resumes.fr/de/it`, `hash`, `attempts: 1`, et les métadonnées de l'article.
  - `fetch en échec` : `fetchPage` rejette `HTTP 403` → entrée avec `attempts: 1`, pas de `resumes`, une ligne `✗ résumé-article` dans le `log` simulé, aucune exception.
  - `429` : premier appel `{ ok: false, status: 429 }` → l'étape s'arrête (un seul appel `fetchImpl` pour 3 articles en attente, `CONCURRENCY` forcée à 1 via `max`/budget ou paramètre de test), `attempts` reste 0, log `✗ résumé-article: quota (429)`.
  - `sans clé` : `apiKey: ''` → archive inchangée, log `✗ résumé-article: OPENROUTER_API_KEY absente`.
  - `texte modifié` : entrée existante avec un autre `hash` et `resumes.fr` → `resumes` vidé puis réécrit.

- [ ] **Step 2: Run** `node --test test/article-resumes.test.mjs` — Expected: FAIL.

- [ ] **Step 3: Implement** `scripts/lib/article-resumes.mjs` en suivant `summarizeAgenda` (même file de travail à `CONCURRENCY` tâches, budget vérifié avant de prendre un article, essai compté seulement si le modèle a répondu, même en-têtes OpenRouter). Écart voulu : un `res.status === 429` pose un drapeau `quotaHit` qui fait sortir toutes les tâches. Paramètre de test `concurrency = CONCURRENCY`.

- [ ] **Step 4: Run** `node --test test/article-resumes.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/lib/article-resumes.mjs test/article-resumes.test.mjs
git commit -m "feat(résumés): choisir, résumer et vérifier les articles"
```

### Task 3: Archive journalière de 30 jours

**Files:**
- Modify: `scripts/lib/article-resumes.mjs`
- Test: `test/article-resumes.test.mjs` (ajouts)

**Interfaces:**
- Produces :
  - `shardDay(entry, now): string` — `entry.date` → `AAAA-MM-JJ` (UTC) ; non daté → jour de `now`.
  - `pruneArchive(archive, liveUrls: Set<string>, now): Archive` — garde une entrée si `liveUrls.has(url)` **ou** si sa date (à défaut `checkedAt`) date de moins de `ARCHIVE_DAYS` jours.
  - `readArchive(dir: URL): Promise<Archive>` — fusionne tous les `*.json` du dossier (dossier absent → `{}`).
  - `writeArchive(dir: URL, archive): Promise<void>` — un fichier par `shardDay`, clés triées, JSON indenté 2 espaces ; **supprime** les fichiers de jours qui n'ont plus d'entrée ; n'écrit pas un fichier dont le contenu est identique (garde le diff git minimal).

- [ ] **Step 1: Write the failing tests** :
  - `pruneArchive` : `now = 2026-11-28` ; entrée datée 2026-10-20 hors `liveUrls` → retirée ; même date mais URL vivante → gardée ; datée 2026-11-01 → gardée.
  - `writeArchive / readArchive aller-retour` (dossier temporaire `mkdtemp`) : trois entrées sur deux jours → deux fichiers `2026-11-27.json`, `2026-11-28.json` ; `readArchive` rend les trois.
  - `writeArchive supprime un jour vidé` : fichier `2026-10-01.json` présent, archive sans entrée ce jour-là → fichier supprimé.
  - `shardDay` : `date: '2026-11-27T23:30:00.000Z'` → `'2026-11-27'` ; sans date → jour de `now`.

- [ ] **Step 2: Run** `node --test test/article-resumes.test.mjs` — Expected: FAIL sur les nouveaux tests.

- [ ] **Step 3: Implement** les quatre fonctions (`node:fs/promises`).

- [ ] **Step 4: Run** `node --test test/article-resumes.test.mjs` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/lib/article-resumes.mjs test/article-resumes.test.mjs
git commit -m "feat(résumés): archive journalière de 30 jours"
```

### Task 4: Brancher l'étape dans le scrape horaire

**Files:**
- Modify: `scripts/scrape.mjs` (après le bloc « Résumés de l'agenda », ~l. 418-431)
- Modify: `.github/workflows/hourly.yml:82` (ligne `git add`)
- Create: `src/data/article-resumes/.gitkeep`
- Test: `test/article-resumes-wiring.test.mjs`

**Interfaces:**
- Consumes: `listArticles`, `summarizeArticles`, `readArchive`, `pruneArchive`, `writeArchive` (Tâches 2-3).

- [ ] **Step 1: Write the failing tests** — `test/article-resumes-wiring.test.mjs` (modèle : `test/agenda-resumes-wiring.test.mjs`) :
  - la ligne `git add src/data/news.json …` de `hourly.yml` contient `src/data/article-resumes` ;
  - dans `scripts/scrape.mjs`, l'appel `summarizeArticles(` apparaît **après** `summarizeAgenda(` (index dans le texte) ;
  - aucun fichier de `src/` (récursif, `.js/.jsx/.mjs`) ne contient `article-resumes` (étape invisible ; ce test sera assoupli par le plan de l'étape 2 pour un import **dynamique** seulement).

- [ ] **Step 2: Run** `node --test test/article-resumes-wiring.test.mjs` — Expected: FAIL.

- [ ] **Step 3: Implement** dans `scrape.mjs`, en dernier : `console.log("\nRésumés des articles:")`, `const dir = new URL('../src/data/article-resumes/', import.meta.url)`, lire l'archive, `summarizeArticles({ articles: listArticles(news), archive })`, `pruneArchive(…, new Set(articles.map(a => a.url)), new Date())`, `writeArchive`. Le tout dans un `try/catch` qui logue `✗ résumé-article: <message>` sans faire échouer le scrape. Ajouter `src/data/article-resumes` à la ligne `git add` (le `.gitkeep` empêche l'échec de `git add` sur un dossier vide). Commentaire au-dessus de l'appel, dans le style du bloc agenda : pourquoi en dernier (quota partagé) et pourquoi le `git add`.

- [ ] **Step 4: Run** `npm test` puis `npm run lint` — Expected: tout passe ; lint 0 erreur, 5 avertissements.

- [ ] **Step 5: Commit**
```bash
git add scripts/scrape.mjs .github/workflows/hourly.yml src/data/article-resumes/.gitkeep test/article-resumes-wiring.test.mjs
git commit -m "feat(résumés): étape du scrape horaire, en dernier, commitée"
```

### Task 5: Alerte de couverture dans le tableau de santé

**Files:**
- Modify: `scripts/lib/health.mjs` (après `checkClassify`)
- Modify: `scripts/health.mjs` (liste `problems`)
- Test: `test/health.test.mjs` (fichier existant — ajouter)

**Interfaces:**
- Produces: `MIN_RESUME_COVERAGE = 0.3`, `MIN_RESUME_SAMPLE = 20`, `checkArticleResumes(articles, archive, now): string[]`.

- [ ] **Step 1: Write the failing tests** — articles datés des dernières 24 h : 30 articles dont 5 avec tous leurs résumés → un problème dont le texte commence par `**résumés d'articles**` et cite `5 sur 30` et `« ✗ résumé-article » au log` ; 30 dont 20 résumés → `[]` ; 10 articles seulement (sous `MIN_RESUME_SAMPLE`) dont 0 résumé → `[]`.

- [ ] **Step 2: Run** `node --test test/health.test.mjs` — Expected: FAIL.

- [ ] **Step 3: Implement** `checkArticleResumes` (un article compte s'il a **toutes** ses `summaryLangs`) et l'appeler dans `scripts/health.mjs` avec `listArticles(news)` et `readArchive(…)`.

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add scripts/lib/health.mjs scripts/health.mjs test/health.test.mjs
git commit -m "feat(résumés): alerte si la couverture des 24 h tombe sous 30 %"
```

### Task 6: Mesure réelle, source par source, puis mise en ligne

**Files:**
- Create: `scripts/article-resumes-probe.mjs` (outil local, jamais en CI)
- Modify: `package.json` (`"resumes:probe": "node scripts/article-resumes-probe.mjs"`)
- Modify: `CLAUDE.md` (une puce dans « À savoir », voir Step 4)

- [ ] **Step 1: Write** `article-resumes-probe.mjs` : pour chaque source de `listArticles(news)`, prend 3 URL, appelle `fetchArticle` + `extractArticleText` (aucun appel au modèle par défaut ; `--model` pour résumer **une** URL), et imprime un tableau `source | essayés | texte extrait | longueur médiane | erreur`.

- [ ] **Step 2: Run** `npm run resumes:probe` depuis le poste (réseau). Expected : texte extrait pour la majorité des sources. Pour chaque source à 0/3 : corriger l'extracteur (Tâche 1, nouveau test avec un extrait du HTML réel réduit à sa structure) **ou** la consigner comme « sans résumé » dans le commentaire de tête de `article-text.mjs` (cas attendu : Asbarez, que son Worker ne laisse pas passer). Puis `OPENROUTER_API_KEY=… npm run resumes:probe -- --model <url fr>` et `-- --model <url hy>` : lire les deux sorties ; montrer le résumé fr/de/it et hy à Nareg.

- [ ] **Step 3: Run** un scrape local réduit (`node scripts/scrape.mjs` si la clé est disponible, sinon passer par le run manuel après fusion) et vérifier : fichiers `src/data/article-resumes/AAAA-MM-JJ.json` présents, entrées avec `resumes`, rien sous `src/` qui les importe, `npm run build` puis `git status` sur `dist/` sans fichier nouveau lié aux résumés.

- [ ] **Step 4:** Ajouter dans `CLAUDE.md`, « À savoir », une puce de trois lignes : « **Résumés d'articles** (`scripts/lib/article-resumes.mjs`) : passent en DERNIER sur le quota `:free` ; `src/data/article-resumes` doit rester dans le `git add` de `hourly.yml` (sinon refaits chaque heure) ; signe de panne `✗ résumé-article`. » Retirer en échange une ligne périmée si le fichier en contient une évidente (règle du budget de `CLAUDE.md`).

- [ ] **Step 5: Commit, PR, mise en ligne** — commit `chore(résumés): sonde locale et note CLAUDE.md` ; `npm test`, `npm run lint`, `npm run build`, `npm run check` passent ; ouvrir la PR « Résumés d'articles (étape 1, invisible) » vers `main` en précisant qu'**aucun changement n'est visible** ; **ne pas fusionner** : la fusion revient à Nareg. Après fusion, lancer `gh workflow run hourly.yml`, puis lire le log : `gh run view <id> --log | grep résumé-article`. Expected : `✓ résumé-article: 20 articles traités…`.
