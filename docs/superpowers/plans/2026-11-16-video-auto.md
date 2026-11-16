# Vidéo automatique à la publication — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un article Culture publié part tout seul en Short YouTube (7 chaînes) et en Reel FB/IG, son texte vidéo ayant été relu avec l'article.

**Architecture:** le texte de la vidéo vit à côté de l'article (`src/data/culture/<slug>/short.<lang>.json`), rédigé par le brouillon, contrôlé par `culture-check`, traduit par `culture-translate`. Le projet Remotion entre dans le dépôt (`video/`, paquet npm à part). Un workflow `video.yml` rend à la publication, dépose dans la release `reels-1` et met en file YouTube ; `youtube-post.mjs`, appelé chaque heure, vide la file par l'API (si `YOUTUBE_AUTO=1`), sinon la file est vidée en séance par Chrome.

**Tech Stack:** Node 24 ESM, `node:test`, Remotion 4.0.539 (React 19), GitHub Actions, YouTube Data API v3 (OAuth refresh token, upload resumable), `gh`.

**Spec:** `docs/superpowers/specs/2026-11-16-video-auto-design.md`

## Global Constraints

- 7 langues : `fr en hy ru de it es` ; `de it es` restent FACULTATIVES (`OPTIONAL`, `culture-validate.mjs`).
- Un Short = 7 faits `{eyebrow,title,text,big}` + `outroTitle`, `ytTitle`, `ytLead` ; `text` ≤ 130 caractères ; `ytTitle` + mot-dièse de la langue ≤ 100 (règle de `describe.mjs`).
- Toute suite de chiffres d'un `short.<lang>.json` figure dans `<lang>.md`.
- Pistes : `mazia`, `sergo`, `otar` (`video/src/shorts/music.json`, `TRACKS`) ; plus de repli silencieux.
- Rendu : < 10 Mo, une piste audio, `--crf 30` (contrôle de `render-all.mjs`).
- Vidéos traduites : même règle que l'article (Gemini part seul ; secours `:free` attend le recochage).
- « Au plus une fois » : registre YouTube écrit et poussé AVANT l'envoi ; échec sûr retenté 3 fois, échec ambigu noté `uncertain`.
- Quota : 6 envois par jour Pacifique (minuit PT) ; file FIFO par article.
- Rien ne part sur YouTube sans `vars.YOUTUBE_AUTO == '1'`.
- Commit : messages en français, pied `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `video/` a son propre `package.json` ; le lint et `npm test` de la racine l'ignorent.

## Review Focus

1. Un article publié SANS `short.fr.json` (brouillon dont la vidéo a échoué) → l'article part, pas de vidéo, une note, aucun crash de `video.yml` (Task 3, Task 7).
2. `fr.md` retouché par `/corrige` après la traduction de la vidéo → `short.<lang>.json` périmé (hash du short fr), jamais rendu (Task 3, Task 5).
3. Deux runs horaires concurrents ou un run coupé pendant un envoi YouTube → jamais de doublon (Task 9).
4. Une chaîne sans jeton, ou un jeton refusé → les autres langues continuent ; aucun essai brûlé (Task 9).
5. Une langue qui échoue au rendu → les autres sont déposées et mises en file ; l'échec se voit sur #128 (Task 7, Task 11).

---

### Task 1: Rapatrier le projet Remotion dans `video/`

**Files:**
- Create: `video/` (copie de `../armenie-video` SANS `out/`, `music-src/`, `node_modules/`, `.git/`), `video/.gitignore` (`node_modules/`, `out/`, `public/photos/`, `src/shorts/credits.json`, `src/shorts/all.ts`, `src/shorts/data/`)
- Create: `video/youtube-meta/` ← `../armenie-video/out/youtube/*.json` et `ids-*.txt` (historique des métadonnées publiées)
- Modify: `video/scripts/sync.mjs` (chemin `../ArmenianNews/src/data/culture` → `../../src/data/culture`), `eslint.config.js` (ignorer `video/**`), `package.json` racine (`"video:test": "npm --prefix video test"`), `.gitattributes` si besoin (`*.mp3 binary`)

**Interfaces:**
- Produces: `video/` autonome : `npm --prefix video ci`, `npm --prefix video test`, `node video/scripts/render-all.mjs --slug <s> [--lang xx]`.

- [ ] **Step 1:** copier (robocopy/`cp -r` avec exclusions), corriger le chemin de `sync.mjs`, ajouter `video/.gitignore`.
- [ ] **Step 2:** `npm --prefix video ci && node video/scripts/sync.mjs && npm --prefix video test` → `pass 7, fail 0` ; `npm run lint` racine → 0 erreur, 5 avertissements (inchangé).
- [ ] **Step 3:** rendu témoin : `node video/scripts/render-all.mjs --slug duduk --lang fr` → `1 OK, 0 échec(s)`.
- [ ] **Step 4:** commit `video : le projet Remotion entre dans le dépôt`.

### Task 2: Le texte vidéo à côté de l'article (migration + module pur)

**Files:**
- Create: `scripts/lib/culture-short.mjs`, `scripts/culture-short-split.mjs` (migration unique), `test/culture-short.test.mjs`
- Create (par la migration) : `src/data/culture/<slug>/short.<lang>.json` pour les 25 sujets
- Modify: `video/scripts/sync.mjs` (lit les `short.*.json` des articles, écrit `src/shorts/data/<slug>.json` et `music.json#BY_SLUG`)

**Interfaces:**
- Produces:
  - `SHORT_MAX_TEXT = 130`, `TRACK_IDS = ['mazia','sergo','otar']`, `HASHTAG: Record<lang,string>` (repris de `describe.mjs`)
  - `shortHash(shortFr: object): string` — sha256 hex de `JSON.stringify` des champs `facts,outroTitle,ytTitle,ytLead,music` (ordre fixe)
  - `validateShort(short, { lang, articleText }): string[]` — erreurs ; vide = conforme
  - `parseShortJson(text): object|null`
- Fichier : `{ facts, outroTitle, ytTitle, ytLead, music? (fr seul), sourceHash? (hors fr), model? }`

- [ ] **Step 1: tests**
  - `validateShort` refuse : 6 faits ; un `text` de 131 caractères ; `ytTitle` + `HASHTAG.fr` de 101 ; un « 1701 » absent de `articleText` ; `music: 'jazz'` en fr ; `big` non booléen.
  - accepte le Short Khor Virap fr réel contre `fr.md` réel (fixture lue depuis `src/data/culture/`).
  - `shortHash` stable sur un objet aux clés permutées, différent si un `text` change.
- [ ] **Step 2:** `node --test test/culture-short.test.mjs` → FAIL (module absent).
- [ ] **Step 3:** implémenter ; chiffres = `/\d+/g` sur les faits, `ytTitle`, `ytLead`, comparés aux suites de chiffres de l'article après retrait des espaces fines (`4 000` ≡ `4000`).
- [ ] **Step 4:** `culture-short-split.mjs` : pour chaque `../armenie-video/src/shorts/data/<slug>.json` (ou `video/` après Task 1), écrit `short.<lang>.json` ; `music` depuis `BY_SLUG` (défaut explicite `otar`) ; `sourceHash` hors fr = `shortHash(fr)`. Lancer, puis `node video/scripts/sync.mjs` → mêmes 24 Shorts (+ Garni) ; `git diff --stat video/src/shorts/data` vide en contenu (formatage permis).
- [ ] **Step 5:** tests verts (`npm test`), commit `culture : le texte des Shorts vit avec l'article`.

### Task 3: `culture-check` contrôle le Short

**Files:**
- Modify: `scripts/lib/culture-load.mjs` (`readArticle` rend `shorts: { [lang]: string|null }`), `scripts/lib/culture-validate.mjs` (`validateArticle({…, shorts})` rend en plus `shorts: { [lang]: object }`), `test/culture-validate.test.mjs`

**Interfaces:**
- Consumes: `validateShort`, `shortHash`, `parseShortJson` (Task 2).
- Produces: `validateArticle(...).shorts` — les Shorts publiables par langue (fr conforme ; traduction conforme ET `sourceHash === shortHash(fr)` ET langue de l'article publiable).

- [ ] **Step 1: tests**
  - `short.fr.json` absent → `notes` contient `short.fr.json absent : pas de vidéo`, `errors` inchangé, `shorts` vide.
  - `short.fr.json` invalide → une erreur `short.fr.json : …` (bloque).
  - `short.hy.json` au `sourceHash` ancien → `errors` (`short.hy.json : traduction périmée`) ; `short.de.json` périmé → `notes`.
  - article `hy.md` refusé → pas de `shorts.hy` même si le Short est bon.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter (mêmes canaux `errors`/`notes` que les `.md`). **Step 4:** `npm test` vert ; `node scripts/culture-check.mjs khorovats-et-la-tradition-du-barbecue-armenien` → conforme.
- [ ] **Step 5:** commit.

### Task 4: Le brouillon écrit le Short, la PR le montre, `/corrige` le révise

**Files:**
- Modify: `scripts/lib/culture-prompts.mjs` (`buildShortMessages({ title, description, body })`), `scripts/culture-draft.mjs`, `scripts/lib/culture-pr.mjs` (`buildAutoSection({…, short})`), `scripts/lib/culture-prompts.mjs` (`buildReviseMessages({…, short})` ; la réponse JSON porte `short`), `scripts/culture-revise.mjs`, tests `test/culture-prompts.test.mjs`, `test/culture-pr.test.mjs`

**Interfaces:**
- Consumes: `validateShort`, `parseShortJson`, `TRACK_IDS`.
- Produces: `short.fr.json` sur la branche `culture/<slug>` ; section « 🎬 La vidéo » dans la partie robot de la PR : piste, puis les 7 faits `**title** — text`, puis `ytTitle`.

- [ ] **Step 1: tests**
  - `buildShortMessages` : le message système exige 7 faits, ≤ 130 caractères, nombres tirés de l'article, `music` ∈ `TRACK_IDS` avec leurs thèmes (mazia foi/écrit/pierre, sergo histoire/batailles, otar vie/fête/arts), et un JSON seul ; le message utilisateur contient le corps.
  - `buildAutoSection({ short })` contient `🎬`, la piste et les 7 titres ; sans `short`, contient `⚠️ Pas de vidéo`.
  - `buildReviseMessages({ short })` inclut le Short courant et demande `short` en retour.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. Brouillon : après l'article, un appel `chatDraft` (même `sticky`), `validateShort` contre `fr.md` ; deux essais ; échec → avertissement PR, pas de fichier. Révision : si la réponse porte un `short` valide, réécrire `short.fr.json` ; sinon garder l'ancien et le dire dans la réponse.
- [ ] **Step 4:** `npm test` vert ; `npm run culture:draft -- --dry --topic kochari` (avec `GEMINI_API_KEY`) affiche la section 🎬.
- [ ] **Step 5:** commit.

### Task 5: `culture-translate` traduit le Short

**Files:**
- Modify: `scripts/lib/culture-prompts.mjs` (`buildShortTranslateMessages({ lang, short, articleText })`), `scripts/culture-translate.mjs`, `test/culture-prompts.test.mjs`

**Interfaces:**
- Consumes: `shortHash`, `validateShort`, `translationScriptProblem`, `chatResilient` + `sticky` déjà partagés.
- Produces: `short.<lang>.json` avec `sourceHash = shortHash(fr)` et `model`.

- [ ] **Step 1: tests** — le prompt fournit l'article TRADUIT de la langue (`<lang>.md` qui vient d'être écrit) et exige les mêmes 7 faits, l'orthographe des noms de cet article, et le « ss » suisse en de.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter : traduire le Short juste après le `.md` de la langue, seulement si le `.md` a été écrit ; garde d'alphabet + `validateShort` contre ce `.md` ; échec → ligne `- ✗ <lang> vidéo — …` dans le résumé, l'article n'est pas touché. Le repli secours garde sa mention « modèle de secours » (c'est elle qui retient la fusion).
- [ ] **Step 4:** `npm test` vert. **Step 5:** commit.

### Task 6: Reel d'un article neuf en tête

**Files:**
- Modify: `scripts/lib/social.mjs` (`plan`), `test/social-reels.test.mjs`

**Interfaces:**
- Produces: `FRESH_REEL_DAYS = 7` exporté.

- [ ] **Step 1: test** — registre avec 0 Reel aujourd'hui, catalogue `reel:a` (2026-10-01) et `reel:neuf` (date = `now` − 2 j) → le plan Instagram rend `['reel:neuf']` ; avec `reel:neuf` daté de −8 j → `['reel:a']`.
- [ ] **Step 2:** FAIL. **Step 3:** tri des Reels : `ageDays(date) <= FRESH_REEL_DAYS` d'abord (plus récent en tête), puis l'ordre actuel ; toujours un Reel par jour d'Erevan. **Step 4:** `npm test` vert. **Step 5:** commit.

### Task 7: `video.yml` — rendre, déposer, mettre en file

**Files:**
- Create: `.github/workflows/video.yml`, `scripts/video-publish.mjs`, `scripts/lib/youtube-queue.mjs`, `test/youtube-queue.test.mjs`
- Create: `scripts/lib/youtube-meta.mjs` (titre/description : logique de `video/scripts/describe.mjs` déplacée ici ; `describe.mjs` l'importe)
- Modify: `scripts/lib/reels-add.mjs` (rien de local : `addReels` sert tel quel), `.github/workflows/articles-publish.yml` et `articles-merged.yml` (après fusion : `gh workflow run video.yml --ref main -f slug=$SLUG`), `test/deploy-config.test.mjs` ou un nouveau `test/video-workflow.test.mjs`

**Interfaces:**
- Consumes: `validateArticle(...).shorts` (Task 3), `addReels`, `assetName`, `REEL_BASE`.
- Produces:
  - `src/data/youtube-queue.json` : `{ version: 1, items: [{ slug, lang, asset, title, description, addedAt }] }`
  - `enqueue(queue, adds, now): queue` (pas de doublon slug×lang ; ordre d'arrivée)
  - `youtubeMeta({ slug, lang, short, credit, music }): { title, description }`
  - `node scripts/video-publish.mjs <slug> --dir <mp4s>` : release + `reels.json` + file.

- [ ] **Step 1: tests**
  - `enqueue` ignore un slug×lang déjà en file ou déjà dans `culture-videos.json`.
  - `youtubeMeta` rend pour Khor Virap fr exactement le titre/description de `video/youtube-meta/monastere-de-khor-virap-au-pied-du-mont-ararat-fr.json`.
  - le workflow : déclenché par `workflow_dispatch` avec `slug` ; contient `npx remotion browser ensure`, `render-all.mjs --slug`, `video-publish.mjs` ; `concurrency: video-main` ; `articles-publish.yml` contient `gh workflow run video.yml`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. Le job : checkout ; `npm ci` racine + `npm --prefix video ci` (cache npm des deux lockfiles) ; `ffprobe -version || sudo apt-get install -y ffmpeg` ; `node video/scripts/sync.mjs` ; rendu des langues de `shorts` seulement (une langue en échec n'arrête pas les autres) ; `video-publish.mjs` (`gh release upload reels-1 --clobber`, `addReels`, `enqueue`) ; commit `data: vidéos de « <slug> »` sur main avec `git pull --rebase` (3 essais) ; `gh workflow run hourly.yml` ; en cas d'échec : `gh workflow run social-check.yml`.
- [ ] **Step 4:** `npm test` vert ; essai réel : `gh workflow run video.yml -f slug=khorovats-et-la-tradition-du-barbecue-armenien` APRÈS accord de Nareg (commande `!` à lui donner) — 7 assets dans la release, 7 entrées en file.
- [ ] **Step 5:** commit.

### Task 8: Connexion des chaînes (local, une fois)

**Files:**
- Create: `scripts/youtube-auth.mjs`, `docs/youtube-setup.md` (projet Cloud, écran de consentement « en production », scopes `youtube.upload` + `youtube.readonly`, audit + hausse de quota avec le texte à coller, 7 secrets)

**Interfaces:**
- Produces: secrets `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_{FR,EN,HY,RU,DE,IT,ES}` ; table `YT_CHANNELS = { fr: 'UC6XuuuP2t57coFE6f4uqX9Q', en: 'UC6wp4LgAJIZKwCkHwbWEoXQ', hy: 'UCkDbtL2BscdI6iLTcjXlpHw', ru: 'UC7IB7SETN9YlUHShEbzAw8Q', de: 'UCsVZkaQ_qW8t5D3DkZl-n2A', it: 'UCU5wfH1iTa0lVKswZiol2eg', es: 'UCjvG5iFzxPKX_7u9t7-JCuQ' }` dans `scripts/lib/youtube.mjs`.

- [ ] **Step 1:** `youtube-auth.mjs --lang hy` : serveur loopback `127.0.0.1`, ouvre l'URL de consentement (`access_type=offline&prompt=consent`), échange le code, appelle `channels.list?mine=true`, **refuse** si l'id rendu ≠ `YT_CHANNELS[lang]`, puis affiche la commande `gh secret set YT_REFRESH_TOKEN_HY` (jeton lu sur stdin, jamais affiché).
- [ ] **Step 2:** test unitaire de la comparaison d'id (fonction pure `checkChannel(expected, got)`).
- [ ] **Step 3:** commit. Les 7 consentements = Nareg (commandes `!`).

### Task 9: `youtube-post.mjs` — vider la file

**Files:**
- Create: `scripts/lib/youtube.mjs` (pur), `scripts/youtube-post.mjs`, `test/youtube.test.mjs`
- Modify: `.github/workflows/hourly.yml` (étape après `social-post`, `continue-on-error: true`, secrets YT_*, `YOUTUBE_AUTO: ${{ vars.YOUTUBE_AUTO }}`, `git add src/data/youtube-posted.json src/data/youtube-queue.json src/data/culture-videos.json`)

**Interfaces:**
- Consumes: file (Task 7), `addVideos`/`entryFromMeta` (`scripts/lib/videos-add.mjs`), `isUnavailable`-style classification de `social-send.mjs`.
- Produces:
  - `planUploads({ queue, ledger, tokens, now, perDay = 6 }): { ledger, uploads }` — FIFO ; ignore les langues sans jeton ; compte les envois du jour PT (`America/Los_Angeles`) ; écrit `posted["<slug>:<lang>"] = now` AVANT.
  - `settleUploads(ledger, results, now)` — même sémantique que `settle` de `social.mjs` (sûr → `failed`, 3 essais, 50 min d'écart ; ambigu → `uncertain` ; jeton refusé → 0 essai).
  - CLI : `node scripts/youtube-post.mjs` (horaire) ; `node scripts/youtube-post.mjs mark <slug> <lang> <videoId>` (envoi fait à la main par Chrome : registre + `culture-videos.json` + retrait de la file).
- Registre `src/data/youtube-posted.json` : `{ version: 1, posted: {}, failed: {} }`.

- [ ] **Step 1: tests**
  - 8 éléments en file, 0 envoi aujourd'hui → 6 prévus ; 4 déjà envoyés aujourd'hui PT → 2.
  - langue sans jeton sautée, la suivante servie.
  - `settleUploads` : 400 → `failed` attempts 1 ; `invalid_grant` → 0 essai ; délai → reste `posted`, `uncertain: true`.
  - un élément au registre n'est jamais replanifié (doublon impossible) ; sans `YOUTUBE_AUTO=1`, le CLI ne fait rien et le dit.
  - `mark` ajoute l'entrée `culture-videos.json` (`entryFromMeta`, `uploadDate` du jour, `PT44S`).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. Envoi : jeton d'accès via `oauth2.googleapis.com/token` ; MP4 téléchargé depuis `REEL_BASE + asset` ; `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status` avec `snippet { title, description, defaultLanguage: lang, defaultAudioLanguage: lang, categoryId: '27' }`, `status { privacyStatus: 'public', selfDeclaredMadeForKids: false }` ; vérifier ensuite `videos.list?part=status` : `privacyStatus !== 'public'` → l'élément reste au registre et une alerte `audit` est levée (vidéo verrouillée en privé).
- [ ] **Step 4:** `npm test` vert. **Step 5:** commit.

### Task 10: Tableau de bord 🎬

**Files:**
- Modify: `scripts/lib/publication-check.mjs` (`checkYoutubeQueue({ queue, ledger, auto, now })`), le script qui assemble #128 (`scripts/social-check.mjs` ou équivalent), `test/publication-check.test.mjs`

**Interfaces:**
- Produces: alertes `{ key, level, text, action }` :
  - `auto` absent → `info` « N vidéo(s) à téléverser en séance (Chrome) » + liste slug/langue.
  - file > 14 ou plus vieille > 5 j → `faire`.
  - `failed` abandonné (3 essais) → `faire` avec `youtube-post.mjs retry`.
  - jeton refusé → `faire` « Recoller le jeton YouTube <lang> : `node scripts/youtube-auth.mjs --lang <lang>` ».
  - vidéo restée privée → `faire` « Audit YouTube non accordé ».
- [ ] **Step 1:** tests (un par alerte). **Step 2:** FAIL. **Step 3:** implémenter ; `checkVideos` garde sa règle des 3 jours. **Step 4:** `npm test` vert. **Step 5:** commit.

### Task 11: Documentation et mise en service

**Files:**
- Modify: `CLAUDE.md` (une entrée courte « Vidéo automatique » : `video/` paquet à part, audit/quota, registre YouTube = mémoire de ce qui est parti ; retirer un piège périmé en échange), `README.md` (section Vidéos), `src/data/culture/*` inchangés

- [ ] **Step 1:** `npm run lint` (0 erreur, 5 avertissements), `npm test`, `npm --prefix video test`, `npm run build && npm run check`.
- [ ] **Step 2:** PR unique `video-auto` ; fusion par Nareg.
- [ ] **Step 3:** mise en service, avec Nareg : `docs/youtube-setup.md` (projet, audit), 7 `youtube-auth`, `gh variable set YOUTUBE_AUTO --body 1` seulement une fois l'audit accordé.
