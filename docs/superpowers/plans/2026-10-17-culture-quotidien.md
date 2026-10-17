# Articles Culture au quotidien — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un brouillon Culture français chaque nuit, sur le bon sujet, à partir de sources plus riches, relisible et corrigeable depuis un téléphone, sans aucun coût.

**Architecture:** On étend le circuit existant (`scripts/culture-*.mjs`, `scripts/lib/culture-*.mjs`, `.github/workflows/articles*.yml`) plutôt que de le remplacer. Les sujets portent un `qid` Wikidata qui résout les pages de chaque langue ; trois nouvelles sources (Wikipédia hy/ru, ՀՍՀ sur Wikisource, table UNESCO curée) entrent dans le prompt ; des contrôles mécaniques s'ajoutent à la liste ⚠️ ; deux nouveaux workflows `issue_comment` (`/corrige` sur une PR, `/ajoute` / `/rejette` sur l'issue d'idées) n'obéissent qu'au propriétaire.

**Tech Stack:** Node 24 ESM, `node:test`, GitHub Actions + `gh`, API MediaWiki/Wikidata, Gemini (point d'accès compatible OpenAI) + OpenRouter `:free`.

**Spec:** `docs/superpowers/specs/2026-10-17-culture-quotidien-design.md` (complète `docs/superpowers/specs/2026-10-16-articles-culture-design.md`).

## Global Constraints

- Entièrement gratuit : aucune API ni source payante.
- Sources exclues : Universalis, Britannica, Encyclopaedia Iranica, Google Books, Gemini « grounding with Google Search ». ich.unesco.org n'est **jamais** récupéré automatiquement.
- Rien ne paraît sans que le propriétaire coche « Faits vérifiés » ; cocher reste le **dernier** geste.
- Ligne éditoriale : point de vue arménien ; aucune variante culturelle azerbaïdjanaise (danse, plat, étymologie, inscription UNESCO) ; faits historiques sourcés nommant l'Azerbaïdjan permis ; ne jamais affirmer un fait faux. Le contrôle mécanique **alerte**, ne bloque jamais.
- Les traductions n'appellent **que** Gemini, jamais le repli.
- `/corrige`, `/ajoute`, `/rejette` : uniquement si `author_association == 'OWNER'`.
- Aucune donnée non fiable (corps de commentaire, titre, corps de PR/issue, `head_ref`) interpolée `${{ }}` dans un `run:` — toujours via `env:` puis fichier (règle déjà gardée par `test/culture-workflows.test.mjs`).
- Commit/fusion avec `GITHUB_TOKEN` ne déclenche aucun workflow : chaque job publie lui-même le statut `culture-check`.
- User-Agent Wikimedia : `WIKI_UA` existant (`scripts/lib/culture-sources.mjs`), jamais un UA de navigateur.
- Valeurs : cron `0 3 * * *` ; plafond de file **2** PR `culture/*` ouvertes ; idées quand moins de **7** sujets disponibles ; ~**15** idées.
- `npm test` sans réseau ; `npm run lint` reste à 0 erreur, 5 avertissements.
- Messages de commit en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Commentaire `/corrige` d'un non-propriétaire, ou `/corrige` en milieu de phrase** — ignoré sans réponse ; seul un commentaire qui *commence* par `/corrige` compte. → test dans Task 9 (`parseReviseCommand`) et Task 9 workflow (`author_association`).
2. **Relecteur qui a déjà coché la case puis demande une correction** — la révision décoche, ne publie pas, et le dit. → test `uncheck` Task 6 + assertion de workflow Task 9.
3. **`/ajoute 1 99` ou `/ajoute` sur une idée déjà ajoutée** — numéros inconnus/déjà traités signalés dans la réponse, les autres appliqués, aucun doublon de slug dans `sujets.json`. → test Task 10.
4. **Sujet dont l'entité n'a pas d'article hy/ru ni d'entrée ՀՍՀ** — brouillon rédigé quand même depuis fr/en, mention dans la PR, aucune exception. → test Task 2 (`resolveTitles`) et Task 3 (`fetchHse` → `null`).
5. **Gemini en 429 pendant la publication** — la PR n'est pas fusionnée, commentaire « traduction reportée : Gemini indisponible », aucune traduction d'un autre modèle écrite. → test Task 1 (`isUnavailable`) + `culture-translate` Task 1.

---

### Task 0 : corriger l'inscription UNESCO du kochari

**Files:**
- Modify: `src/data/culture/kochari/fr.md`, `en.md`, `hy.md`, `ru.md`

- [ ] **Step 1 : vérifier la liste** — ouvrir https://ich.unesco.org/en/RL/kochari-traditional-group-dance-01266 (ou la fiche « Kochari » depuis https://ich.unesco.org/en/state/armenia-AM) et noter la liste exacte et l'année. Attendu : Liste représentative, 2017.
- [ ] **Step 2 : corriger la phrase** dans `fr.md` (« liste du patrimoine culturel immatériel nécessitant une sauvegarde urgente » → « liste représentative du patrimoine culturel immatériel de l'humanité », ou ce que dit la fiche) et la phrase équivalente des trois traductions, à la main.
- [ ] **Step 3 : recalculer `sourceHash`** des trois traductions avec `bodyHash` (`scripts/lib/culture-markdown.mjs`) appliqué au corps du nouveau `fr.md` :
  `node -e "import('./scripts/lib/culture-markdown.mjs').then(async m=>{const fs=await import('node:fs');const f=m.parseFrontMatter(fs.readFileSync('src/data/culture/kochari/fr.md','utf8'));console.log(m.bodyHash(f.body))})"`, puis remplacer la valeur dans `en.md`, `hy.md`, `ru.md`.
- [ ] **Step 4 :** `npm run culture:check` → aucun `✗` pour `kochari`.
- [ ] **Step 5 : commit** `Culture : kochari inscrit sur la liste représentative (UNESCO 2017)`.

### Task 1 : repli de modèle pour la rédaction, jamais pour la traduction

**Files:**
- Modify: `scripts/lib/culture-llm.mjs`, `scripts/culture-translate.mjs`
- Test: `test/culture-llm.test.mjs`

**Interfaces:**
- Produces:
  - `CULTURE_FALLBACK_MODELS: string[]` = `['nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free']` (mêmes ids que `classify-rubrics.mjs` au 16 oct. ; commentaire renvoyant à CLAUDE.md « modèles :free se retirent »).
  - `OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/'`
  - `isUnavailable(err: Error): boolean` — vrai pour HTTP 429, 404, 5xx, `TimeoutError`/`AbortError` ; faux pour 400/401/403 et « réponse vide ».
  - `chatDraft({ messages, temperature?, env?, fetchImpl? }): Promise<{ text, model, fellBack: boolean }>` — `chat` avec `llmConfig(env)` ; si `isUnavailable`, essaie chaque modèle de repli sur OpenRouter avec `env.OPENROUTER_API_KEY` (sauté si clé absente) ; relance la dernière erreur si tout échoue.
  - `chat` garde sa signature ; une erreur HTTP porte `err.status` (nombre).

- [ ] **Step 1 : tests en échec** dans `test/culture-llm.test.mjs` :
  - `isUnavailable : 429/404/503/timeout oui, 401/400/réponse vide non`.
  - `chatDraft : Gemini 429 → premier repli OpenRouter, clé OpenRouter, fellBack true, model = modèle servi` (faux `fetchImpl` qui répond 429 à l'URL Gemini, 200 à `openrouter.ai`; vérifier l'en-tête `Authorization: Bearer OR_KEY`).
  - `chatDraft : Gemini 401 → rejette sans repli` (aucun appel à openrouter).
  - `chatDraft : sans OPENROUTER_API_KEY → rejette l'erreur Gemini`.
- [ ] **Step 2 :** `node --test test/culture-llm.test.mjs` → FAIL (`chatDraft` non exporté).
- [ ] **Step 3 : implémenter** dans `culture-llm.mjs`.
- [ ] **Step 4 : traduction sans repli** — `culture-translate.mjs` garde `chat` (pas `chatDraft`) ; dans le `catch` par langue, si `isUnavailable(e)` la ligne de résumé devient `- ✗ ${lang} — traduction reportée : Gemini indisponible (${e.message})`. Ajouter au test : `culture-translate n'importe pas chatDraft` (lecture du source comme texte, `assert.doesNotMatch(src, /chatDraft/)`).
- [ ] **Step 5 :** `node --test test/culture-llm.test.mjs` → PASS ; `npm test` → PASS.
- [ ] **Step 6 : commit** `Culture : repli OpenRouter :free pour la rédaction, jamais pour la traduction`.

### Task 2 : sujets identifiés par Wikidata

**Files:**
- Modify: `scripts/lib/culture-sources.mjs`, `scripts/lib/culture-topic.mjs`, `src/data/culture/sujets.json`
- Test: `test/culture-sources.test.mjs`, `test/culture-topic.test.mjs`

**Interfaces:**
- Produces:
  - `fetchEntity(qid, fetchImpl?): Promise<Entity>` où `Entity = { qid, labels: {fr,en,hy,ru}, descriptions: {fr,en}, aliases: {fr: string[], en: string[]}, sitelinks: {fr,en,hy,ru} /* titres ou undefined */, image: string|null /* P18, nom de fichier sans "File:" */, facts: string[] }` — une seule requête `Special:EntityData/<qid>.json` ; `facts` = ce que rend aujourd'hui `fetchWikidataFacts` (factoriser en `factsFromEntity(entity)` pur ; `fetchWikidataFacts` peut rester comme enveloppe).
  - `resolveTitles(topic, entity): { fr?, en?, hy?, ru? }` — `entity.sitelinks`, chaque clé surchargée par `topic.wikipedia?.[lang]` si présente.
  - `fetchWikipedia` : une page d'homonymie **lève** `Error('page d’homonymie : <lang>:<titre>')` au lieu de rendre `null` ; absente → `null` comme avant. Le résultat gagne `kind: 'wikipedia'`.
  - `validateTopics` : exige `qid` conforme à `/^Q\d+$/` ; `wikipedia` devient facultatif.
- [ ] **Step 1 : tests en échec** :
  - `fetchEntity : libellés, descriptions, alias, sitelinks fr/en/hy/ru, P18, faits` (fixture JSON minimale d'entité en ligne, sitelinks `frwiki`/`hywiki`/…).
  - `resolveTitles : sitelinks, surcharge manuelle prioritaire, langue absente omise`.
  - `fetchWikipedia : homonymie → lève` (remplace l'assertion `null` du test existant pour ce cas ; page absente → `null` conservé).
  - `validateTopics : qid requis, wikipedia facultatif`.
- [ ] **Step 2 :** `node --test test/culture-sources.test.mjs test/culture-topic.test.mjs` → FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : migrer `sujets.json`** — pour chaque sujet, lire le `qid` depuis la page fr (`pageprops.wikibase_item` via l'API, une requête par sujet), vérifier à l'œil que le libellé Wikidata est bien le sujet arménien (kochari : la danse, pas le plat), ajouter `"qid"`. Garder `wikipedia` seulement là où le sitelink ne convient pas.
- [ ] **Step 5 :** `npm test` → PASS ; `npm run culture:check` → aucun `✗ sujets.json`.
- [ ] **Step 6 : commit** `Culture : sujets identifiés par Wikidata (fin des homonymes)`.

### Task 3 : ՀՍՀ sur Wikisource et table UNESCO

**Files:**
- Modify: `scripts/lib/culture-sources.mjs`
- Create: `src/data/culture/unesco.json`, `scripts/lib/culture-unesco.mjs`
- Test: `test/culture-sources.test.mjs`, `test/culture-unesco.test.mjs`

**Interfaces:**
- Consumes: `Entity` (Task 2).
- Produces:
  - Forme commune d'une source : `{ kind: 'wikipedia'|'hse'|'unesco', lang, title, url, revision: number|null, extract: string, license: string }`.
  - `hseTitle(entity): string|null` — base = `entity.sitelinks.hy` sans parenthèse finale (« Քոչարի (պար) » → « Քոչարի »), à défaut `entity.labels.hy` ; rendu `ՀՍՀ/${base.toUpperCase()}` ; `null` sans base.
  - `fetchHse(title, fetchImpl?): Promise<Source|null>` — `hy.wikisource.org`, `prop=revisions&rvprop=ids|content&rvslots=main` ; page absente → `null` ; `extract = wikitextToText(content)` ; `license: 'CC BY-SA 3.0'`.
  - `wikitextToText(s: string): string` (pur) — retire `{{…}}`, `<ref>…</ref>`, balises, `[[a|b]]`→`b`, `[[a]]`→`a`, `'''`/`''`.
  - `unesco.json` : `{ "<slug>": { "year": 2017, "list": "representative"|"urgent"|"good-practices", "name": "<intitulé officiel anglais>", "url": "https://ich.unesco.org/…" } }` pour les 8 éléments arméniens (doudouk 2008, khatchkar 2010, Sassna Tsrer 2012, lavash 2014, kochari 2017, art de l'alphabet 2019, pèlerinage de Saint-Thaddée 2020, forge de Gyumri 2023), slugs des sujets existants quand ils existent, sinon slug prévisible (`lavash`, `sassna-tsrer`…).
  - `unescoSource(entry): Source` (pur) — `kind: 'unesco'`, `lang: 'en'`, `title: entry.name`, `url`, `revision: null`, `license: 'UNESCO'`, `extract` en français : `Inscrit en ${year} sur la ${LIST_FR[list]} du patrimoine culturel immatériel de l'UNESCO, sous l'intitulé « ${name} ».` avec `LIST_FR = { representative: 'Liste représentative', urgent: 'Liste de sauvegarde urgente', 'good-practices': 'Registre des bonnes pratiques de sauvegarde' }`.
- [ ] **Step 1 : remplir `unesco.json` à la main**, chaque ligne vérifiée sur sa fiche ich.unesco.org (année et liste) — c'est la seule fois où le site est consulté.
- [ ] **Step 2 : tests en échec** :
  - `hseTitle : sitelink sans parenthèse, repli sur le libellé, capitales arméniennes` (« Կոմիտաս » → `ՀՍՀ/ԿՈՄԻՏԱՍ`).
  - `fetchHse : page absente → null ; contenu → texte nettoyé, licence CC BY-SA 3.0, URL hy.wikisource`.
  - `wikitextToText : modèles, références, liens, gras`.
  - `culture-unesco.test.mjs` : `unesco.json : 8 entrées, années 2008-2023, listes connues, URL ich.unesco.org` ; `unescoSource : phrase française, liste représentative du kochari 2017`.
- [ ] **Step 3 :** `node --test test/culture-sources.test.mjs test/culture-unesco.test.mjs` → FAIL.
- [ ] **Step 4 : implémenter.**
- [ ] **Step 5 :** tests → PASS.
- [ ] **Step 6 : commit** `Culture : sources ՀՍՀ (Wikisource) et table UNESCO curée`.

### Task 4 : contrôles mécaniques (faits, noms, ligne éditoriale)

**Files:**
- Create: `scripts/lib/culture-checks.mjs`
- Test: `test/culture-checks.test.mjs`

**Interfaces:**
- Consumes: `findUnsupported(claims, sourceTexts)` (`culture-prompts.mjs`, inchangé).
- Produces:
  - `mechanicalClaims(body: string): string[]` — sans modèle : chaque nombre de 2 chiffres ou plus, chaque date « 12 mars 1915 » / « mars 1915 » (mois français), dédoublonnés.
  - `entityTexts(entity): string[]` — libellés et alias fr/en (à ajouter à la botte de foin).
  - `splitClaims(unsupported: string[]): { facts: string[], names: string[] }` — contient un chiffre → `facts`, sinon `names`.
  - `EDITORIAL_TERMS: string[]` = `['azerbaïdjan', 'azerbaidjan', 'azerbaijan', 'azéri', 'azeri', 'köçəri']` (comparaison pliée, en début de mot, donc « azerbaïdjanais » compte).
  - `editorialAlerts(body: string): string[]` — une ligne par phrase qui contient un terme, phrase tronquée à 160 caractères.
- [ ] **Step 1 : tests en échec** :
  - `mechanicalClaims : années, nombres, dates en toutes lettres ; ignore les chiffres isolés`.
  - `splitClaims : chiffres vers facts, noms vers names`.
  - `editorialAlerts : « azerbaïdjanaise », « Azéris », « Köçəri » signalés ; « Arménie » non ; une alerte par phrase`.
- [ ] **Step 2 :** `node --test test/culture-checks.test.mjs` → FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `Culture : contrôles mécaniques des faits et de la ligne éditoriale`.

### Task 5 : consignes au modèle (rédaction, révision, idées)

**Files:**
- Modify: `scripts/lib/culture-prompts.mjs`
- Test: `test/culture-prompts.test.mjs`

**Interfaces:**
- Consumes: `Source` (Task 3), `Entity` (Task 2).
- Produces:
  - `buildDraftMessages({ topic, entity, sources, facts, event })` — le message utilisateur commence par `ENTITÉ WIKIDATA : <qid> — <labels.fr || labels.en> : <descriptions.fr || descriptions.en>` ; chaque source est titrée selon `kind` (`Wikipédia (hy)`, `Encyclopédie soviétique arménienne (ՀՍՀ)`, `UNESCO`) ; le système ajoute trois règles, mot pour mot :
    - `- Le sujet est l'entité Wikidata indiquée. Ignore tout passage d'une source qui traite d'un homonyme (autre danse, plat, lieu ou personne du même nom).`
    - `- Point de vue arménien. Ne mentionne jamais les variantes culturelles azerbaïdjanaises (danses, plats, étymologies, inscriptions UNESCO). Un fait historique sourcé qui nomme l'Azerbaïdjan reste permis, énoncé sans commentaire.`
    - `- Chaque date, chaque nombre et chaque nom propre doit figurer dans une source. Tu peux omettre ; tu ne dois jamais déformer.`
  - `buildReviseMessages({ title, description, body, instruction, entity, sources })` — même `JSON_SHAPE`, mêmes règles, plus : `Applique la CONSIGNE DU RELECTEUR au texte, et rien d'autre. La consigne fait foi sur les sources.` ; l'instruction est passée dans un bloc `CONSIGNE DU RELECTEUR :` séparé.
  - `buildIdeasMessages(existingTitles, n = 15)` — reprend la règle de point de vue arménien ; forme de réponse inchangée.
- [ ] **Step 1 : tests en échec** (existants à adapter) : `buildDraftMessages : entité en tête, sources titrées par kind, trois règles présentes` ; `buildReviseMessages : consigne isolée, texte actuel, sources` ; `buildIdeasMessages : 15 par défaut, règle éditoriale`.
- [ ] **Step 2 :** `node --test test/culture-prompts.test.mjs` → FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `Culture : consignes de cadrage, de ligne éditoriale et de révision`.

### Task 6 : corps de PR lisible sur téléphone

**Files:**
- Modify: `scripts/lib/culture-pr.mjs`
- Test: `test/culture-pr.test.mjs`

**Interfaces:**
- Produces:
  - `AUTO_START = '<!-- culture:auto:start -->'`, `AUTO_END = '<!-- culture:auto:end -->'`.
  - `buildAutoSection({ title, frBody, meta, unsupported /* {facts,names}|null */, editorial: string[], overlap, warnings }): string` — entre les marqueurs, dans cet ordre : `## titre` ; `### ⚠️ À vérifier en premier` (faits non retrouvés, puis alertes de ligne éditoriale préfixées `ligne éditoriale :`, puis recouvrement s'il dépasse le seuil, puis `warnings`) — ou une ligne « Rien à signaler » ; `### Texte` avec `frBody` dont les intertitres sont abaissés (`## ` → `#### `, `### ` → `##### `) ; `<details><summary>Noms à confirmer (N)</summary>…</details>` si `names` non vide ; `### Image` ; `### Sources` (libellé par `kind`) ; `### Modèle`.
  - `buildPrBody(args)` = `AUTO_START + buildAutoSection(args) + AUTO_END` + bloc fixe : mode d'emploi en deux lignes — « Pour corriger : commentez `/corrige <consigne>` (ex. `/corrige retire le paragraphe sur le plat`). » et « Pour publier, **en dernier** : cochez la case. » — puis `- [ ] Faits vérifiés`.
  - `replaceAutoSection(body, auto): string` — remplace le contenu entre marqueurs, garde le reste octet pour octet ; sans marqueurs, préfixe `AUTO_START+auto+AUTO_END`.
  - `isChecked(body): boolean`, `uncheck(body): string` — `- [x]`/`- [X] Faits vérifiés` ↔ `- [ ] Faits vérifiés`.
- [ ] **Step 1 : tests en échec** : `corps : alertes avant le texte, texte avant les sources, case en dernier` ; `corps : intertitres abaissés` ; `corps : noms repliés dans <details>` ; `corps : alerte éditoriale dans la liste ⚠️` ; `replaceAutoSection : case cochée préservée` ; `uncheck / isChecked` ; `corps sous 65 000 caractères pour un article de 1 000 mots`. Le test « null jamais présenté comme réussi » est conservé.
- [ ] **Step 2 :** `node --test test/culture-pr.test.mjs` → FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 :** → PASS.
- [ ] **Step 5 : commit** `Culture : page de relecture lisible sur téléphone`.

### Task 7 : affichage des nouvelles sources sur le site

**Files:**
- Modify: `scripts/lib/culture-pages.mjs`, `src/cultureStrings.js`
- Test: `test/culture-pages.test.mjs`

**Interfaces:**
- Consumes: `meta.sources[].kind` (absent = `wikipedia`, pour les articles déjà publiés).
- Produces: libellé par source — `wikipedia` : `(Wikipedia ${lang})` comme aujourd'hui ; `hse` : `(ՀՍՀ, Wikisource)` ; `unesco` : `(UNESCO)`. `sourcesNote` des quatre langues élargie : « Textes de Wikipédia (CC BY-SA 4.0) et de Wikisource (CC BY-SA 3.0), utilisés comme sources. » et ses équivalents en/hy/ru.
- [ ] **Step 1 : test en échec** `page : une source ՀՍՀ et une source UNESCO sont étiquetées ; une source sans kind reste Wikipedia`.
- [ ] **Step 2 :** FAIL → **Step 3 :** implémenter → **Step 4 :** `npm test` PASS.
- [ ] **Step 5 : commit** `Culture : attribution des sources Wikisource et UNESCO`.

### Task 8 : rédaction nocturne

**Files:**
- Modify: `scripts/culture-draft.mjs`, `scripts/lib/culture-topic.mjs`, `scripts/lib/culture-pr.mjs`, `.github/workflows/articles.yml`
- Test: `test/culture-topic.test.mjs`, `test/culture-pr.test.mjs`, `test/culture-workflows.test.mjs`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:
  - `MAX_OPEN = 2`, `MIN_AVAILABLE = 7` (`culture-topic.mjs`).
  - `queueFull(openBranches: string[], max = MAX_OPEN): boolean` — compte les branches `culture/*`.
  - `needsIdeas(available: number, min = MIN_AVAILABLE): boolean`.
  - `ideasIssueBody(ideas)` réécrit : liste numérotée lisible (`1. Titre — [Wikipédia](url)`) + bloc ```json``` d'objets `{ n, slug, title, qid, wikipedia, keywords, status: 'proposed' }` + mode d'emploi `/ajoute 1 4 7` · `/rejette 2 3`.
  - `meta.json` gagne `qid` ; `meta.sources[]` gagne `kind` et `license`.
  - Sorties `$GITHUB_OUTPUT` : `skipped=queue` (file pleine), `slug`/`title` (brouillon), `ideas=1` (idées à proposer, corps dans `--out-ideas`).
- **Ordre dans `culture-draft.mjs`** : file pleine → sortie `skipped=queue`, exit 0. Sinon : sujet → `fetchEntity(topic.qid)` → `resolveTitles` → `fetchWikipedia` pour fr, en, hy, ru (une langue absente ou en échec réseau = avertissement, l'homonymie lève) → `fetchHse(hseTitle(entity))` (échec = avertissement) → `unescoSource` si `unesco.json[slug]` → Commons avec `files: [entity.image, fr?.pageImage, en?.pageImage]` → `chatDraft` → claims modèle (`chatDraft`, température 0) **∪** `mechanicalClaims` → `findUnsupported(…, [...extracts, ...facts, ...eventFacts(event), ...entityTexts(entity)])` → `splitClaims` → `editorialAlerts` → `overlapRatio` contre les extraits Wikipédia seulement → `buildPrBody`. Après le brouillon (ou sans sujet) : si `needsIdeas(disponibles restants)` et `--ideas-open` absent, générer les idées (`chatDraft`), garder celles dont `fetchWikipedia(fr||en)` rend un `wikidata` non présent dans `sujets.json`, et sortir `ideas=1`. Nouvelle option `--ideas-open` (booléen) : une issue d'idées est déjà ouverte, ne rien générer.
- **`articles.yml`** : nom `Culture — brouillon quotidien` ; cron `0 3 * * *` ; étape qui pose `--ideas-open` si `gh issue list --state open --search 'in:title "Culture : idées de sujets"'` rend une issue ; étape d'idées `gh issue create` seulement si `ideas == '1'` ; étape PR inchangée sinon (corps depuis `--out-body`).
- [ ] **Step 1 : tests en échec** : `queueFull : 0, 1, 2 PR culture ; branches non culture ignorées` ; `needsIdeas : 6 oui, 7 non` ; `issue d'idées : numérotée, JSON avec n/qid/status proposed, mode d'emploi` ; workflows : `articles.yml : cron quotidien 0 3 * * *` et `articles.yml : idées seulement sans issue ouverte (--ideas-open)`.
- [ ] **Step 2 :** FAIL → **Step 3 :** implémenter → **Step 4 :** `npm test` PASS, `npm run lint` 0 erreur / 5 avertissements.
- [ ] **Step 5 : essai réel** sans écrire : `GEMINI_API_KEY=… npm run culture:draft -- --topic duduk --dry` si la clé est disponible localement ; sinon reporter l'essai au Step 2 de Task 11. Attendu : sources fr/en/hy/ru + ՀՍՀ + UNESCO listées, corps de PR dans l'ordre de Task 6.
- [ ] **Step 6 : commit** `Culture : brouillon quotidien, plafond de file, sources enrichies`.

### Task 9 : corrections par commentaire `/corrige`

**Files:**
- Create: `scripts/culture-revise.mjs`, `scripts/lib/culture-commands.mjs`, `.github/workflows/articles-revise.yml`
- Modify: `scripts/lib/culture-sources.mjs`, `test/culture-workflows.test.mjs` (ajouter le fichier à `FILES`)
- Test: `test/culture-commands.test.mjs`, `test/culture-workflows.test.mjs`

**Interfaces:**
- Produces:
  - `parseReviseCommand(text): string|null` (`culture-commands.mjs`) — consigne après `/corrige` si le texte **commence** par `/corrige` (espaces de tête tolérés), consigne non vide ; sinon `null`.
  - `refetchSources(metaSources, { unesco, fetchImpl }): Promise<Source[]>` (`culture-sources.mjs`) — Wikipédia et ՀՍՀ relus **à la révision enregistrée** (`revids=`), UNESCO depuis `unesco.json` ; une source en échec est omise.
  - `culture-revise.mjs <slug> --instruction <fichier> --pr-body <fichier> --out-body <fichier> --out-reply <fichier>` — lit `fr.md` et `meta.json` de la branche, `chatDraft(buildReviseMessages(…))`, réécrit `fr.md` (date conservée), relance les contrôles de Task 4, écrit `replaceAutoSection(prBody, buildAutoSection(…))` — puis `uncheck` si `isChecked` — dans `--out-body`, et une réponse : modèle utilisé, nombre de paragraphes changés, nouveaux ⚠️ éventuels, et « case décochée : recochez pour publier » le cas échéant. Échec du modèle → exit 1, `fr.md` inchangé, réponse avec l'erreur.
- **`articles-revise.yml`** : `on: issue_comment: types: [created]` ; `if: github.event.issue.pull_request && github.event.comment.author_association == 'OWNER' && startsWith(github.event.comment.body, '/corrige')` ; `concurrency: culture-revise-${{ github.event.issue.number }}`, `cancel-in-progress: false` ; permissions `contents: write`, `pull-requests: write`, `statuses: write`. Étapes : réaction 👀 sur le commentaire ; `gh pr view` → branche, état, corps ; s'arrêter si la branche ne commence pas par `culture/` ou PR fermée ; checkout de la branche ; corps de commentaire et corps de PR passés par `env:` → fichiers ; `node scripts/culture-revise.mjs` ; commit `Culture : révision « <slug> »`, `pull --rebase` puis push (même motif qu'`articles-translate.yml`) ; `gh pr edit --body-file` ; `culture-check` publié en statut ; `gh pr comment` avec la réponse (aussi en cas d'échec).
- [ ] **Step 1 : tests en échec** : `parseReviseCommand : début de commentaire seulement, consigne vide → null, multiligne gardé` ; `refetchSources : révision exacte demandée, source en échec omise` ; workflows : `articles-revise.yml : OWNER et /corrige exigés dans le if`, `articles-revise.yml : rebase avant push`, `articles-revise.yml : publie culture-check` (étendre le test existant à ce fichier), et l'existant « aucune donnée non fiable interpolée » couvre aussi `github.event.comment.body` (ajouter ce motif à la regex).
- [ ] **Step 2 :** FAIL → **Step 3 :** implémenter → **Step 4 :** `npm test` PASS.
- [ ] **Step 5 : commit** `Culture : corrections par commentaire /corrige (propriétaire seulement)`.

### Task 10 : idées validées par `/ajoute` et `/rejette`

**Files:**
- Create: `scripts/culture-ideas.mjs`, `.github/workflows/articles-ideas.yml`
- Modify: `scripts/lib/culture-commands.mjs`, `test/culture-workflows.test.mjs`
- Test: `test/culture-commands.test.mjs`

**Interfaces:**
- Produces:
  - `parseIdeaCommand(text): { action: 'add'|'reject', numbers: number[] }|null` — `/ajoute 1 4 7` ou `/ajoute 1,4,7` ; en début de commentaire seulement.
  - `readIdeas(issueBody): Idea[]` — le bloc ```json``` de l'issue (Task 8).
  - `applyIdeaCommand({ ideas, sujets, cmd }): { ideas, sujets, reply: string, done: boolean }` — `add` : idées `proposed` → ajoutées à `sujets.topics` (`{ slug, title, qid, keywords, status: 'pending' }`, `wikipedia` seulement si fourni) et marquées `added` ; slug ou `qid` déjà présents → signalé, non ajouté ; `reject` → `rejected` ; numéro inconnu ou déjà traité → signalé ; `done` vrai quand plus aucune idée `proposed`.
  - `writeIdeas(issueBody, ideas): string` — réécrit le bloc JSON et barre (`~~…~~`) les lignes traitées de la liste lisible.
- **`articles-ideas.yml`** : `on: issue_comment: types: [created]` ; `if: !github.event.issue.pull_request && github.event.issue.title == 'Culture : idées de sujets' && github.event.comment.author_association == 'OWNER' && (startsWith(github.event.comment.body, '/ajoute') || startsWith(github.event.comment.body, '/rejette'))` ; `concurrency: culture-ideas`, sans annulation ; checkout `main` ; corps passés par `env:` → fichiers ; commit `Culture : sujets ajoutés depuis les idées` sur `main` avec la boucle `pull --rebase`/push d'`articles-closed.yml` ; `gh issue edit --body-file` ; `gh issue comment` avec la réponse ; `gh issue close` si `done`.
- [ ] **Step 1 : tests en échec** : `parseIdeaCommand : espaces ou virgules, début seulement, /rejette` ; `applyIdeaCommand : ajout, rejet, numéro inconnu, déjà ajouté, qid déjà dans sujets.json, done` ; `writeIdeas : JSON réécrit, lignes barrées` ; workflows : `articles-ideas.yml : OWNER exigé, pas sur une PR`, ajout à `FILES`.
- [ ] **Step 2 :** FAIL → **Step 3 :** implémenter → **Step 4 :** `npm test` PASS ; `validateTopics` sur un `sujets.json` produit par `applyIdeaCommand` → aucune erreur.
- [ ] **Step 5 : commit** `Culture : idées de sujets validées par /ajoute et /rejette`.

### Task 11 : documentation et essai de bout en bout

**Files:**
- Modify: `CLAUDE.md`, `package.json` (si un script `culture:revise` est utile en local)

- [ ] **Step 1 : `CLAUDE.md`** — dans la puce « Articles Culture », ajouter seulement les pièges silencieux, en quelques lignes : (a) un titre Wikipédia deviné attrape les homonymes (koshary) — résoudre par `qid` ; (b) `/corrige` et `/ajoute` sont des consignes envoyées au modèle : le filtre `OWNER` est la garde, ne pas l'élargir ; (c) le grounding Google de Gemini interdit de stocker/publier ; (d) les traductions n'ont pas de repli, à dessein. Mettre à jour le nombre de tests de `npm test` (deux endroits) avec la valeur réelle. En retirer autant : la règle du fichier l'exige — chercher une note périmée dans la même puce.
- [ ] **Step 2 : essai réel** après fusion sur `main` : `gh workflow run articles.yml`, puis `gh run watch`. Attendu : une PR `culture/<slug>` dont le corps suit Task 6 ; commenter `/corrige retire la dernière phrase` depuis le téléphone ; attendu : réaction 👀, commit de révision, corps mis à jour, réponse. Ne **pas** cocher la case pendant l'essai sauf accord du propriétaire.
- [ ] **Step 3 :** `npm test`, `npm run lint`, `npm run build`, `npm run check` → tout passe.
- [ ] **Step 4 : commit** `Culture quotidien : documentation`.
