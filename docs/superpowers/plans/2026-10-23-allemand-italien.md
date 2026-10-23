# Allemand et italien sur armenieinfo.ch — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** servir `/de/` et `/it/` sur armenieinfo.ch (24 pages au lieu de 16) : interface traduite, fil d'actualités français marqué comme tel, brève du jour de/it en tête de l'accueil, articles Culture traduits.

**Architecture:** les chaînes de/it entrent d'abord dans chaque module de traduction (sans effet tant que la langue n'existe pas). Une seule tâche « allume » ensuite les deux langues dans `sites.config.js`, d'où tout dérive (hreflang, sitemaps, prérendu, 404). Le fil réutilise le contenu `fr` grâce à une règle unique, `CONTENT_LANG`. La brève et la Culture s'étendent par leurs pipelines existants. Les traductions de/it sont **facultatives** : leur absence ne bloque jamais une publication.

**Tech Stack:** Vite + React 18, Node ≥ 20 (`node --test`), Puppeteer (prérendu, hydratation), Gemini (Culture), OpenRouter (brève), GitHub Actions, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-10-23-allemand-italien-design.md`. Lisez-la avant toute tâche. CLAUDE.md porte les pièges cités ici.

## Global Constraints

- Travail dans un **worktree isolé**, un commit (point de retour) par tâche ; fusionner plutôt que rebaser.
- Codes de langue **`de`** et **`it`**, sans région (`<html lang>`, `hreflang`, sitemaps, `LANGS`).
- Ordre : `ALL_LANGS = ['fr', 'de', 'it', 'en', 'hy', 'ru']` ; libellés `DE`, `IT` ; noms `Deutsch`, `Italiano`.
- `SITES.ch.pages` : `{ lang: 'de', path: '/de/' }`, `{ lang: 'it', path: '/it/' }`.
- Slugs (latin, sans accent, **slash final**) :
  `VIEWS` de → `''`, `radio/`, `veranstaltungen/`, `ueber-uns/` ; it → `''`, `radio/`, `eventi/`, `chi-siamo/`.
  `BRIEF_SLUGS` de → `kurzmeldungen/`, it → `notizie/`. `CULTURE_SLUGS` de → `kultur/`, it → `cultura/`.
- `OG_LOCALE` de → `de_DE`, it → `it_IT`. `LOCALES` (formatage des dates par `Intl`) de → `de-CH`, it → `it-CH`.
- `x-default` reste l'anglais. Marque « Arménie Info » sur les trois pages du .ch. Carte `og-image-ch.jpg` inchangée.
- Allemand à la suisse : **jamais `ß`**, toujours `ss`. Italien standard.
- `ARMENPRESS_LANGS` et `CIVILNET_SECTIONS` **ne reçoivent pas** de/it (une ligne de commentaire le dit à leur emplacement).
- Le `news.json` allégé du .ch doit être **octet pour octet** celui d'avant ce chantier.
- Lint : toujours 5 avertissements connus, 0 erreur. Aucun nouvel export non-composant dans un `.jsx`.
- Les traductions de/it (brève, Culture) sont de la sortie de modèle non relue : pas de modèle de secours pour la Culture, mention « Aus dem Französischen übersetzt » / « Tradotto dal francese ».

## Review Focus

1. **Une clé i18n de/it manquante** retombe en silence sur le français : le test de parité des clés (Tâche 1) doit couvrir **chaque** module de chaînes, pas seulement `STRINGS`.
2. **Un sélecteur de langue à six pastilles déborde à 360 px** (plancher tactile de 44 px sous `pointer: coarse`) : la page devient défilable horizontalement, ce qui casse la texture du fond (cf. `.shelf__title` dans CLAUDE.md). Tâche 8 : mesure `scrollWidth === clientWidth` dans les six langues.
3. **Le .org change par accident** (un slug, un hreflang ou une page en moins) : Tâche 3 vérifie que les 12 URL du .org de `npm run check` sont identiques avant et après.
4. **Une traduction Culture de/it absente fait échouer `culture-check`** et retient la PR fr/en/hy/ru : Tâche 6, test qui exige `errors` vide quand seuls `de.md`/`it.md` manquent.
5. **La brève de/it écrite en français** (le modèle lit des titres français) : le filtre d'alphabet ne le voit pas. Tâche 5 : consigne explicite et test de `buildBriefMessages`.

---

### Task 1: Chaînes de/it dans les modules de traduction, et test de parité

**Files:**
- Modify: `src/i18n.jsx` (blocs `STRINGS.de`, `STRINGS.it`, `LOCALES`)
- Modify: `src/seo.js` (`SEO`, `VIEW_SEO`, `OG_LOCALE`), `src/briefStrings.js`, `src/cultureStrings.js`, `src/rubricLabels.js`, `src/worldPlace.js` (`COUNTRIES`), `src/relativeTime.js` (`UNITS`)
- Modify: `test/radio-count.test.mjs` (`NOMBRES.de = 'Siebzehn'`, `NOMBRES.it = 'Diciassette'`, ou la forme que le texte retient)
- Create: `test/i18n-parity.test.mjs`

**Interfaces:**
- Produces: chaque table indexée par langue a des entrées `de` et `it` aux **mêmes clés que `fr`**. `CULTURE_STRINGS[l].translatedFrom` est une clé nouvelle, présente dans les six langues : `''` pour fr/en/hy/ru, `'Aus dem Französischen übersetzt'` pour de, `'Tradotto dal francese'` pour it. `STRINGS[l]['news.originalLang']` est nouvelle aussi : `'Artikel auf Französisch'` / `'Articoli in francese'`, et `''` ailleurs.

- [ ] **Step 1: Write `test/i18n-parity.test.mjs`**. Pour chaque table (`SEO`, `VIEW_SEO[view]`, `BRIEF_STRINGS`, `CULTURE_STRINGS`, `RUBRIC_LABELS`, `OG_LOCALE`) : `assert.deepEqual(Object.keys(table.de).sort(), Object.keys(table.fr).sort())`, et de même pour `it`. Pour `STRINGS`, lire `src/i18n.jsx` **comme du texte** (Node ne sait pas importer du JSX, cf. `test/img-lazy.test.mjs`) et comparer les ensembles de clés des blocs `fr`, `de` et `it`. `countryLabel(k, 'de')` et `countryLabel(k, 'it')` sont non vides pour toute clé de `COUNTRIES`. `relativeAge(iso, now, 'de')` renvoie `'3 Std.'` pour 3 h et `'2 T.'` pour 2 jours ; `relativeAge(…, 'it')` renvoie `'3 h'` et `'2 g'`. Enfin, aucune valeur de/it ne contient `ß` (`/ß/.test(...)` faux sur toutes les chaînes de).
- [ ] **Step 2: Run** `node --test test/i18n-parity.test.mjs`. Expected: FAIL (pas de bloc `de`).
- [ ] **Step 3: Écrire les blocs de/it** dans les sept modules. On traduit le **sens** du français, pas mot à mot. Les textes qui écrivent le nombre de radios en toutes lettres (`radio.subtitle`, `radio.more`, cf. `test/radio-count.test.mjs`) suivent la règle du test. Les `radio.genre.*` et autres clés de `STATION_FACTS` sont présentes. `SEO.de` et `SEO.it` décrivent le site avec leurs propres mots-clés : « Armenien Nachrichten », « notizie Armenia ».
- [ ] **Step 4: Run** `node --test test/i18n-parity.test.mjs test/radio-count.test.mjs test/relative-time.test.mjs test/rubric-i18n.test.mjs test/brief-strings.test.mjs`. Expected: PASS. Puis `npm run lint` : 0 erreur, 5 avertissements.
- [ ] **Step 5: Commit** `i18n: chaînes allemandes et italiennes (pas encore servies)`.

### Task 2: Le fil sous de/it lit le contenu français

**Files:**
- Modify: `src/newsLangs.js`, `src/newsSources.js`, `src/components/NewsBrowser.jsx`, `src/components/AboutPage.jsx` (liste de langues écrite en dur → `ALL_LANGS`), `vite.config.js` (`lightData`)
- Test: `test/news-langs.test.mjs`, `test/light-data.test.mjs`

**Interfaces:**
- Produces: `export const CONTENT_LANG = { de: 'fr', it: 'fr' }` et `export function contentLang(lang: string): string` (renvoie `CONTENT_LANG[lang] ?? lang`) dans `src/newsLangs.js`. `TAB_ORDER.de` et `TAB_ORDER.it` sont **le même tableau** que `TAB_ORDER.fr` (référence, pas copie : `TAB_ORDER.de === TAB_ORDER.fr`). `feedFor(news, id, lang)` lit `contentLang(lang)` avant `FEED_LANG`.

- [ ] **Step 1: Write the failing tests.** Dans `news-langs.test.mjs` : `TAB_ORDER.de === TAB_ORDER.fr`, `TAB_ORDER.it === TAB_ORDER.fr`, `assert.deepEqual(feedFor(news, 'armenpress', 'de'), feedFor(news, 'armenpress', 'fr'))` sur le vrai `src/data/news.json`, `contentLang('hy') === 'hy'`. Dans `light-data.test.mjs` : `JSON.stringify(newsForLangs(news, ['fr','de','it'], TAB_ORDER)) === JSON.stringify(newsForLangs(news, ['fr'], TAB_ORDER))`.
- [ ] **Step 2: Run** `node --test test/news-langs.test.mjs test/light-data.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Les deux exports ci-dessus vont dans `newsLangs.js`, avec un commentaire court du pourquoi (aucune rédaction de/it ; une copie de `TAB_ORDER.fr` divergerait). Dans `NewsBrowser.jsx`, quand `contentLang(lang) !== lang` : la section porte `lang={contentLang(lang)}` et affiche une seule fois `t('news.originalLang')` sous la tête de section. Le style suit les mentions existantes de la section (un `kicker`). `brief-select.mjs` n'a rien à changer : il passe par `TAB_ORDER` et `feedFor`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. `test/source-count.test.mjs` lit `TAB_ORDER` comme du texte : s'il compte les entrées, l'adapter pour que de/it n'ajoutent aucune rédaction.
- [ ] **Step 5: Commit** `news: de/it lisent le fil français (CONTENT_LANG)`.

### Task 3: Allumer de et it sur le .ch

**Files:**
- Modify: `sites.config.js` (`ALL_LANGS`, `LANGS`, `SITES.ch.pages`, `VIEWS`, `BRIEF_SLUGS`, `CULTURE_SLUGS`, `LANG_SWITCH_LABEL` de → `'Sprache'`, it → `'Lingua'`)
- Modify: `scripts/lib/site-meta.mjs` (`PRELOAD.de = PRELOAD.it = PRELOAD.fr`), `scripts/lib/not-found.mjs`, `scripts/lib/static-shell.mjs`, `scripts/lib/llms.mjs`, `scripts/lib/brief-script.mjs` (`EXPECTED.de = EXPECTED.it = 'Latin'`), `scripts/check-build.mjs`, `scripts/lib/agenda-guard.mjs` (si les vues y sont listées par langue)
- Modify: `firebase.json`, côté `armenie-info` : `^/de/events/?$` → `/de/veranstaltungen/`, `^/it/events/?$` → `/it/eventi/` ; côté `armenia-news-org` : `^/(de|it)(/.*)?$` → `https://armenieinfo.ch/:1:2` (même forme que la règle `/fr/` existante, à adapter à la syntaxe regex Firebase). Le bloc `headers` des deux cibles reste identique.
- Modify: `scripts/sources/armenpress.mjs`, `scripts/sources/civilnet.mjs` (commentaire : pas de de/it, voulu)
- Test: `test/sites-config.test.mjs`, `test/views.test.mjs`, `test/site-meta.test.mjs`, `test/not-found.test.mjs`, `test/brief-urls.test.mjs`, `test/culture-urls.test.mjs`, `test/lang-switch.test.mjs`, `test/llms.test.mjs`, `test/internal-links.test.mjs`

**Interfaces:**
- Consumes: les chaînes de la Tâche 1, `CONTENT_LANG` de la Tâche 2.
- Produces: `urlFor('de','agenda') === 'https://armenieinfo.ch/de/veranstaltungen/'`, `briefUrl('it') === 'https://armenieinfo.ch/it/notizie/'`, `cultureUrl('de','komitas') === 'https://armenieinfo.ch/de/kultur/komitas/'`, `viewFromPath('ch','/it/chi-siamo') === 'about'`, `siteOf('de') === 'ch'`.

- [ ] **Step 0: Avant toute modification**, `npm run build && npm run check`. Enregistrer la liste des URL du .org que `check` contrôle, dans le scratchpad, en vue du Step 5.
- [ ] **Step 1: Write the failing tests.** Les cinq égalités ci-dessus. `orderLangsFor('ch', LANGS).map(l => l.code)` vaut `['fr','de','it','en','hy','ru']` et `orderLangsFor('org', LANGS)` vaut `['en','fr','de','it','hy','ru']`. Chacune des 24 pages a `ALL_LANGS.length + 1` alternates et se cite elle-même. Une vue de/it ne cite jamais l'accueil. `X_DEFAULT === LANG_URL.en`. `test/not-found.test.mjs` : le 404 du .ch contient les liens des vues de/it. `test/llms.test.mjs` : `llms.txt` du .ch nomme `/de/` et `/it/`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL sur ces assertions.
- [ ] **Step 3: Implement** les fichiers listés. Les nombres de pages écrits en dur (16, 12…) dans `check-build.mjs`, `CLAUDE.md` et les tests deviennent des valeurs dérivées de `ALL_LANGS` et `ALL_VIEWS` partout où c'est possible. Sinon, 24 pour les pages React, 15 pour le .ch.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build && npm run check`. Expected: tout passe ; `check` contrôle 24 pages, l'assertion `LANGS`/`sites.config.js` de `build-sites.mjs` passe, et `dist/ch/de/index.html` comme `dist/ch/it/eventi/index.html` existent.
- [ ] **Step 5: Comparer les URL du .org** à celles du Step 0. Expected: les mêmes, à deux `hreflang` près sur chaque page.
- [ ] **Step 6: Commit** `site: /de/ et /it/ sur armenieinfo.ch`.

### Task 4: Brève du jour en tête de l'accueil de/it

**Files:**
- Create: `scripts/lib/brief-lead.mjs`, `src/components/BriefLead.jsx`
- Modify: `vite.config.js` (plugin `briefLead()`, module virtuel `virtual:brief-lead`, comme `cultureTeaser()`), `src/App.jsx` (rendu sur `home` quand `contentLang(lang) !== lang`, juste après le héros), `src/styles/global.css`
- Test: `test/brief-lead.test.mjs`

**Interfaces:**
- Consumes: `briefUrl(lang, date)` (Tâche 3), `BRIEF_STRINGS[lang]` (Tâche 1).
- Produces: `latestBrief(dir: string, lang: string): Promise<null | { date: string, url: string, intro: string, topics: { title: string }[] }>`. Elle lit `src/data/briefs/<lang>/*.json`, prend la date la plus récente et garde les **trois** premiers sujets. Elle renvoie `null` si le dossier est vide ou absent, et ne lève jamais. Le module virtuel exporte `{ [lang]: latestBrief | null }` pour les langues du site bâti uniquement.

- [ ] **Step 1: Write the failing test.** Sur un dossier temporaire avec `2026-10-21.json` et `2026-10-22.json`, `latestBrief` renvoie la date `2026-10-22` et au plus 3 sujets. Un dossier absent ou un JSON illisible donne `null`.
- [ ] **Step 2: Run** `node --test test/brief-lead.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `latestBrief`, le plugin et `BriefLead`. Le composant n'affiche rien si la donnée est `null`. Il montre `BRIEF_STRINGS[lang].latest`, la date **formatée par `formatDate` du contexte i18n**, l'intro, trois titres et le lien `BRIEF_STRINGS[lang].read`. Aucune valeur ne dépend de l'heure au premier rendu (piège de l'hydratation). La mise en page suit l'esthétique « Apricot Press », sous le skill frontend-design. Toute `font-family` est suivie de son `font-size-adjust`.
- [ ] **Step 4: Run** `npm test && npm run build && npm run prerender && npm run hydration-check`. Il n'existe pas encore de brève de/it : copier pour ce contrôle une brève fr dans `src/data/briefs/de/`, puis **la supprimer avant le commit**. Une brève écrite n'est jamais régénérée, et une brève de test resterait en ligne. Expected: PASS ; `grep -c 'brief-lead' dist/ch/de/index.html` ≥ 1 et `grep -c 'brief-lead' dist/ch/index.html` = 0 ; sans la copie, `/de/` se bâtit sans le bloc et sans erreur.
- [ ] **Step 5: Commit** `accueil de/it : la brève du jour en tête`.

### Task 5: Brève quotidienne en de et en it

**Files:**
- Modify: `scripts/lib/brief-generate.mjs` (`LANG_NAME`)
- Test: `test/brief-generate.test.mjs` (à créer s'il n'existe pas, sinon à étendre)

**Interfaces:**
- Consumes: `ALL_LANGS` (la boucle de `generateBriefs` couvre déjà toute langue), `selectArticles(news, 'de')`, qui rend les articles français par `TAB_ORDER`.

- [ ] **Step 1: Write the failing test.** Le contenu système de `buildBriefMessages('de', articles)` contient `allemand` et `ss` ; celui de `buildBriefMessages('it', …)` contient `italien`. Les deux contiennent une consigne qui interdit de recopier les titres sources en français (assertion sur le mot `traduis`). `selectArticles(news, 'de', now)` rend le même ensemble d'URL que `selectArticles(news, 'fr', now)`.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement.** `LANG_NAME.de = 'allemand (usage suisse : « ss », jamais « ß »)'`, `LANG_NAME.it = 'italien'`. Pour toute langue où `contentLang(lang) !== lang`, ajouter une phrase : « Les titres sources sont en français : traduis-les, n'en recopie aucun mot à mot. »
- [ ] **Step 4: Run** `npm test`, puis `npm run brief -- --force --dry`. Expected: deux brèves lisibles en allemand et en italien sur la sortie, sans fichier écrit. Lire les deux textes : pas de phrase française.
- [ ] **Step 5: Commit** `brève : allemand et italien`.

### Task 6: Culture — sources Wikipédia de/it, traduction, mention, contrôle non bloquant

**Files:**
- Modify: `scripts/lib/culture-sources.mjs` (`ENTITY_LANGS` + `de`, `it`)
- Modify: `scripts/culture-draft.mjs` (récupère dewiki et itwiki pour `meta.sources` **seulement**, hors du prompt et hors de `overlapRatio`)
- Modify: `scripts/lib/culture-prompts.mjs` (`LANG_NAME.de`, `LANG_NAME.it` ; `buildTranslateMessages({ lang, title, description, body, nameHint = null })`)
- Modify: `scripts/culture-translate.mjs` (accepte `--langs de,it` ; transmet `nameHint` = titre Wikipédia de la langue cible, pris dans `meta.sources` ; contrôle de recouvrement)
- Modify: `scripts/lib/culture-validate.mjs` (`OPTIONAL = ['de', 'it']`), `scripts/lib/culture-pages.mjs` (mention `translatedFrom` + lien vers l'article fr)
- Modify: `.github/workflows/articles-translate.yml` (un échec de/it seul ne met pas `culture-check` en échec)
- Test: `test/culture-validate.test.mjs`, `test/culture-pages.test.mjs`, `test/culture-sources.test.mjs`, `test/culture-prompts.test.mjs`

**Interfaces:**
- Consumes: `CULTURE_STRINGS[l].translatedFrom` (Tâche 1), `cultureUrl` (Tâche 3), `overlapRatio`, `OVERLAP_THRESHOLD` (`culture-overlap.mjs`), `fetchWikipedia(lang, title)`.
- Produces: `validateArticle(...)` renvoie `{ errors, notes, langs }`. Une langue de `OPTIONAL` absente, périmée ou invalide va dans `notes`, jamais dans `errors`, et ne figure pas dans `langs`. `TRANSLATED` reste l'ensemble des langues à traduire (`ALL_LANGS` sans `fr`). `export const REQUIRED = TRANSLATED.filter(l => !OPTIONAL.includes(l))`.

- [ ] **Step 1: Write the failing tests.**
  - Article fixture avec fr/en/hy/ru valides, sans `de.md` ni `it.md` : `errors` vide, `notes.length === 2`, `Object.keys(langs)` = `['fr','en','hy','ru']`.
  - `de.md` périmé (mauvais `sourceHash`) : note, pas erreur.
  - `buildTranslateMessages({ lang: 'de', nameHint: 'Komitas Vardapet', … })` mentionne `Komitas Vardapet` et `ss`.
  - La page Culture `de` d'un article contient `Aus dem Französischen übersetzt` et un lien `href` vers `cultureUrl('fr', slug)`. La page `en` ne contient pas cette mention.
  - `fetchEntity` (fixture) renvoie `sitelinks.de` et `sitelinks.it`.
- [ ] **Step 2: Run** these tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Dans `culture-translate.mjs`, après la traduction de/it : si `meta.sources` contient une source Wikipédia de la même langue, récupérer son extrait par `fetchWikipedia` et calculer `overlapRatio(t.body, [extract])`. Au-dessus de `OVERLAP_THRESHOLD`, la langue est **non écrite** (`✗ de — recouvrement x % avec Wikipédia de`) ; sinon elle est écrite. Si cet extrait ne peut pas être récupéré, la langue est écrite et une ligne `⚠️` va au résumé. Le code de sortie ne vaut 1 que si une langue de `REQUIRED` ou l'image a échoué. Dans `articles-translate.yml`, ne rien changer d'autre : `culture-check` lit désormais `notes` comme non bloquantes. `culture-check.mjs` imprime les notes sans changer son code de sortie.
- [ ] **Step 4: Run** `npm test && npm run culture:check`. Expected: PASS ; les articles existants sortent avec deux notes chacun (de/it absents) et aucune erreur.
- [ ] **Step 5: Run** `npm run build && npm run check`. Expected: pas de page `/de/kultur/<slug>/` pour un article sans `de.md`. L'index `/de/kultur/` existe et le sélecteur de langue d'un article mène à cet index (`langHrefsFor`), jamais à un 404.
- [ ] **Step 6: Commit** `culture : traductions de/it facultatives, Wikipédia de/it citée`.

### Task 7: Rattrapage des traductions de/it par PR

**Files:**
- Create: `scripts/culture-backfill.mjs` (`npm run culture:backfill`), `.github/workflows/articles-backfill.yml`
- Modify: `package.json`
- Test: `test/culture-backfill.test.mjs`

**Interfaces:**
- Consumes: `validateArticle` → `notes` (Tâche 6), `culture-translate.mjs --langs`, `fetchEntity`.
- Produces: `pendingTranslations(articles): { slug: string, langs: ('de'|'it')[] }[]`, fonction pure : la liste des articles dont une langue de `OPTIONAL` est absente ou périmée.

- [ ] **Step 1: Write the failing test.** Sur des fixtures : un article à jour en de/it n'apparaît pas ; un article sans `it.md` donne `{ slug, langs: ['it'] }` ; un `de.md` périmé donne `langs: ['de']`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.** Le script complète `meta.sources` avec dewiki et itwiki par les sitelinks du `qid` quand elles manquent. Il appelle la traduction pour chaque entrée, puis écrit un résumé Markdown. Le workflow (`workflow_dispatch` + `schedule` hebdomadaire) crée une branche `culture/backfill-AAAA-MM-JJ` et ouvre une PR assignée au propriétaire. Il publie **lui-même** le statut `culture-check` (piège 1 de CLAUDE.md). Il ne fusionne jamais, et ne s'exécute pas s'il n'y a rien à traduire. Mêmes gardes `OWNER` que les autres workflows `articles-*`, pas de modèle de secours.
- [ ] **Step 4: Run** `node scripts/culture-backfill.mjs --dry`. Expected: la liste des 10+ articles existants, chacun avec `de, it`, sans fichier écrit.
- [ ] **Step 5: Commit** `culture : rattrapage des traductions de/it par PR`.

### Task 8: Rendu — sélecteur à six langues et mobile

**Files:**
- Modify: `src/styles/global.css`, `src/components/Nav.jsx` (seulement si la mesure l'exige), `scripts/lib/static-shell.mjs` (même règle pour les pages statiques)

- [ ] **Step 1: Charger le skill `verifier-le-rendu`** et suivre sa procédure (Puppeteer, `pointer: coarse`, jour et nuit).
- [ ] **Step 2: Mesurer**, sur `npm run build && npm run prerender && npm run preview`, à 360, 390 et 1400 px, dans les six langues : `document.documentElement.scrollWidth === document.documentElement.clientWidth` ; la barre de langue tient sur une ligne ; chaque pastille mesure au moins 44 px sous `pointer: coarse`. Sur `/de/` et `/it/`, le bloc brève est visible sur le premier écran mobile après le héros, et les titres et rubriques allemands ne débordent pas. Mêmes mesures sur une page de brève et une page Culture (pages statiques).
- [ ] **Step 3: Corriger ce que la mesure montre.** Si six pastilles ne tiennent pas à 360 px, replier le sélecteur sur mobile, dans l'esthétique existante. Pas d'`overflow-x: hidden` sur `html` (CLAUDE.md).
- [ ] **Step 4: Re-mesurer**, et vérifier qu'à 1400 px le .org s'affiche comme avant. Expected: toutes les conditions du Step 2.
- [ ] **Step 5: Commit** `rendu : sélecteur à six langues`.

### Task 9: Vérification finale et CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run** `npm test && npm run lint && npm run build && npm run check && npm run prerender && npm run hydration-check`. Expected: tout passe ; `check` contrôle 24 pages ; lint à 5 avertissements ; `grep -c '<div id="root"></div>' dist/ch/de/index.html` = 0.
- [ ] **Step 2: Comparer le poids** de `dist/ch/assets/*.js` avant et après le chantier (`git stash` ou build de `main`). Expected: l'écart vient des seuls dictionnaires de/it (quelques dizaines de Ko bruts au plus).
- [ ] **Step 3: Mettre à jour CLAUDE.md**, sans l'allonger au total. Remplacer « quatre langues » par six là où c'est un fait (Projet, Internationalisation), corriger les nombres de pages (16 → 24, douze → …), le nombre de tests, et la liste des fichiers que touche l'ajout d'une langue. Ajouter un seul piège nouveau : **`CONTENT_LANG` décide aussi de ce que la brève de/it résume**. Retirer en échange un passage périmé, selon la règle du budget en tête du fichier.
- [ ] **Step 4: Commit** `docs : CLAUDE.md à six langues`.
- [ ] **Step 5: Après fusion et déploiement**, sonder la production : `curl -sI https://armenieinfo.ch/de/` → 200 ; `curl -sI https://armenieinfo.ch/de` → 301 vers `/de/` ; `curl -sI https://armenianews.org/de/` → 301 vers `https://armenieinfo.ch/de/` ; `curl -s https://armenieinfo.ch/it/ | grep -c 'hreflang='` = 7.
