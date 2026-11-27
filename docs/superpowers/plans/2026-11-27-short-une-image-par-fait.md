# Shorts : une image par fait — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque fait d'un Short Culture montre une image différente (7 faits, 7 images), choisie au brouillon dans les articles Wikipédia du sujet, revue dans la PR, créditée à l'écran et dans la description YouTube.

**Architecture :** un module pur `scripts/lib/culture-short-images.mjs` choisit et décrit les images ; un CLI `scripts/culture-short-images.mjs <slug>` remplit `meta.shortImages` et télécharge `short-1.jpg`…`short-6.jpg` à côté de l'article ; le brouillon et la publication l'appellent ; la PR les liste ; `video/scripts/sync.mjs` les recopie avec un tableau de crédits par slug, et `ShortVideo.tsx` donne à chaque scène son image et son crédit.

**Tech Stack :** Node 24 (ESM, `node --test`), sharp, API MediaWiki (Wikipédia + Commons), Remotion (TSX).

**Spec :** `docs/superpowers/specs/2026-11-27-short-une-image-par-fait-design.md`

## Global Constraints

- Image 1 d'un Short = la photo de l'article (`meta.image`, fichier `image.jpg`) ; images 2–7 = `meta.shortImages[0..5]` (6 au plus).
- Fichiers : `src/data/culture/<slug>/short-<n>.jpg`, n = 1..6 — jamais `image.*` (seul nom que le site publie).
- Filtres : `isFreeLicense`, MIME `image/(jpeg|png|webp)`, largeur ≥ 800, auteur et `commonsUrl` présents, ratio largeur/hauteur entre 0,5 et 2,5, nom de fichier sans `icon|logo|flag|signature|pictogram|coat of arms|map` (insensible à la casse).
- Source : images des pages Wikipédia de `meta.sources` (`kind: 'wikipedia'`, langues fr, en, hy, ru), puis `meta.candidates`. Jamais la recherche Commons plein texte.
- Moins de 7 images : rotation `i % count`, jamais deux fois la même image de suite ; 1 image : comportement actuel.
- L'écran de fin montre l'image 1.
- User-Agent : `WIKI_UA` (`scripts/lib/culture-sources.mjs`) — jamais « Chrome ».
- Les Shorts déjà publiés ne sont pas re-rendus ; un slug sans `shortImages` rend exactement comme avant.
- Typographie française et accents dans tout texte affiché.

## Review Focus

1. **Image portrait** (tableau 1024×1227) dans la planche 920×540 : en `cover` centré, la tête est coupée → `objectPosition: '50% 20%'` quand largeur/hauteur < 1 (test en Task 4).
2. **Remplacement à la main** : Nareg change seulement `file` d'une entrée de `meta.shortImages` → le CLI doit le détecter (le `commonsUrl` ne finit plus par ce fichier), relire Commons, retélécharger ; un fichier refusé (licence non libre) doit échouer en clair, pas passer en silence (test en Task 2).
3. **Licences CC BY-SA de versions différentes** (3.0 + 4.0, ou piste BY-SA) : la ligne « même licence » doit annoncer la version la plus haute, une seule fois (test en Task 5).
4. **Même fichier en double** (référencé par fr et en, ou déjà photo de l'article) : jamais deux fois dans le Short (test en Task 1).
5. **`short-<n>.jpg` périmés** quand la liste raccourcit (de 6 à 4) : les fichiers en trop sont supprimés, sinon sync recopierait une image sans crédit (test en Task 2).

---

### Task 1 : choisir les images (module pur)

**Files :**
- Create : `scripts/lib/culture-short-images.mjs`
- Modify : `scripts/lib/culture-sources.mjs` (`fetchCommonsCandidates` : paramètre `max` pour le plafond de titres, défaut 15, gardé ; plafond réel de l'API = 50)
- Test : `test/culture-short-images.test.mjs`

**Interfaces :**
- Produces :
  - `SHORT_EXTRA = 6`
  - `wikiImageTitles(sources) -> Array<{ lang, title }>` (pages Wikipédia fr/en/hy/ru de `meta.sources`)
  - `async fetchPageImageFiles({ lang, title }, fetchImpl) -> string[]` (`prop=images&imlimit=100`, `File:` normalisé, ordre de la page, extensions jpg/jpeg/png/webp)
  - `pickShortImages({ articleImage, candidates, infos }) -> Candidate[]` (pur : `infos` = sortie de `fetchCommonsCandidates`, dans l'ordre des titres ; exclut le fichier de `articleImage` et les doublons ; candidates d'abord, puis Wikipédia ; applique ratio et nom ; 6 au plus)
  - `async gatherShortImages(meta, fetchImpl) -> Candidate[]` (enchaîne les trois ; 1 s entre deux appels MediaWiki)
  - `Candidate` = forme existante de `meta.candidates` (`file, thumbUrl, width, height, mime, author, license, licenseUrl, commonsUrl`)

- [ ] **Step 1 : tests qui échouent** — `pickShortImages` : (a) 10 infos valides → 6, l'image de l'article exclue ; (b) un `File:Duduk.jpg` présent deux fois → une fois ; (c) `File:Flag of Armenia.png`, un 3000×400 (ratio 7,5) et un 400×600 → écartés ; (d) ordre : candidates, puis Wikipédia dans l'ordre reçu. `fetchPageImageFiles` avec un faux `fetch` : SVG écartés, `Fichier:` → `File:`.
- [ ] **Step 2 :** `node --test test/culture-short-images.test.mjs` → FAIL (module absent).
- [ ] **Step 3 :** implémenter ; `gatherShortImages` passe à `fetchCommonsCandidates({ files, limit: 50, max: 50 })` les fichiers des candidates puis ceux des pages.
- [ ] **Step 4 :** test → PASS ; `node --test test/culture-sources.test.mjs` → PASS (défaut 15 inchangé).
- [ ] **Step 5 :** commit `culture: choisir les images d'un Short dans Wikipédia`.

### Task 2 : CLI `culture-short-images` (meta + fichiers)

**Files :**
- Create : `scripts/culture-short-images.mjs`
- Modify : `scripts/lib/culture-short-images.mjs` (fonctions pures ci-dessous), `scripts/lib/culture-image.mjs` (`makeShortImage(buf) -> Buffer` : JPEG 1200 px de large au plus, sans agrandissement, sRGB, sans ICC, qualité 82), `package.json` (`"culture:short-images": "node scripts/culture-short-images.mjs"`)
- Test : `test/culture-short-images.test.mjs`, `test/culture-image.test.mjs`

**Interfaces :**
- Consumes : `gatherShortImages`, `fetchCommonsCandidates`, `downloadImage`.
- Produces :
  - `isStale(entry) -> boolean` : vrai si `entry.commonsUrl` absent ou ne finit pas par `encodeURIComponent`-équivalent du `file` (espaces ↔ `_`).
  - `shortImageFile(n) -> 'short-<n>.jpg'`
  - CLI : `node scripts/culture-short-images.mjs <slug> [--refresh] [--dry]`. Sans `meta.shortImages` (ou `--refresh`) : `gatherShortImages` ; sinon, chaque entrée `isStale` est relue sur Commons par son `file` (`fetchCommonsCandidates({ files: [file], limit: 1 })`) — vide = **erreur** « <file> : introuvable ou licence non libre ». Télécharge les fichiers manquants ou périmés, supprime les `short-<n>.jpg` au-delà de la liste, écrit `meta.json` (`shortImages` après `image`). Code de sortie 1 en cas d'échec ; une ligne `✓`/`✗` par image.

- [ ] **Step 1 : tests qui échouent** — `isStale` : entrée intacte → faux ; `file` changé à la main → vrai ; `File:Garden in Sochi3.jpg` contre `…/File:Garden_in_Sochi3.jpg` → faux. `makeShortImage` : entrée 2400×1600 → 1200×800, sans ICC ; entrée 900 px → 900 (pas d'agrandissement).
- [ ] **Step 2 :** tests → FAIL.
- [ ] **Step 3 :** implémenter ; le CLI garde les fichiers d'une entrée non périmée sans les retélécharger.
- [ ] **Step 4 :** tests → PASS ; `npm run lint` → 0 erreur, 5 avertissements.
- [ ] **Step 5 :** commit `culture: CLI des images de Short (meta.shortImages, short-<n>.jpg)`.

### Task 3 : brancher le brouillon, la publication et la PR

**Files :**
- Modify : `scripts/culture-draft.mjs` (après l'image : `meta.shortImages = await gatherShortImages(meta)` + téléchargements, échec = avertissement de PR « Images de la vidéo non trouvées : le Short n'aura que la photo de l'article »), `scripts/culture-translate.mjs` (après le bloc image : même synchronisation que le CLI — fonction partagée `syncShortImages(base, meta, fetchImpl) -> { lines, failed }` exportée du module ; un échec ajoute `- ⚠️ images de la vidéo : …`, **non bloquant**), `scripts/lib/culture-pr.mjs` (section `### 🎬 Images de la vidéo`)
- Test : `test/culture-pr.test.mjs`, `test/culture-short-images.test.mjs`

**Interfaces :**
- Produces : `syncShortImages(base, meta, fetchImpl)` (le CLI de Task 2 l'appelle aussi).
- PR : sous `### 🎬 La vidéo`, `### 🎬 Images de la vidéo` : ligne « 1. photo de l'article » puis `n+1. [file](commonsUrl) — author, license` + `<img src="thumbUrl" width="160">` ; puis : « Pour en remplacer une : changez son `"file"` dans `meta.json` → `shortImages` par un autre fichier Commons (`File:…`), **avant** de cocher la case. » Sans `shortImages` : « Le Short n'aura que la photo de l'article. »

- [ ] **Step 1 : tests qui échouent** — `buildPrBody` avec 6 `shortImages` → la section contient 7 lignes numérotées et l'instruction ; sans → la phrase de repli ; un `file` contenant `[x] ` est désarmé (comme le reste).
- [ ] **Step 2 :** tests → FAIL.
- [ ] **Step 3 :** implémenter les trois branchements.
- [ ] **Step 4 :** `npm test` → tout PASS ; `node scripts/culture-draft.mjs --dry` n'est **pas** lancé (Gemini) — vérification par les tests.
- [ ] **Step 5 :** commit `culture: images de la vidéo au brouillon, à la publication et dans la PR`.

### Task 4 : la vidéo — une image et un crédit par scène

**Files :**
- Create : `video/src/shorts/slides.mjs` + `slides.d.mts` (comme `timing`)
- Modify : `video/scripts/sync.mjs`, `video/src/shorts/types.ts`, `video/src/shorts/ShortVideo.tsx`, `video/scripts/describe.mjs` (`garni/` n'est pas touché)
- Test : `video/test/slides.test.mjs`

**Interfaces :**
- Produces :
  - `slideImages(nFacts: number, nImages: number) -> number[]` : `i % nImages` (nImages ≥ 1).
  - `credits.json` : `Record<slug, Credit[]>`, index 0 = photo de l'article ; `Credit = { author, license, commonsUrl, width?, height? }`.
  - Photos : `public/photos/<slug>.jpg` (inchangé) et `public/photos/<slug>-<n>.jpg`.
  - `copyFor(slug, lang, image = 0)` → `photo`, `credit` de cette image.

- [ ] **Step 1 : tests qui échouent** — `slideImages(7, 7)` = `[0..6]` ; `(7, 3)` = `[0,1,2,0,1,2,0]` ; `(7, 1)` = sept 0 ; aucune paire consécutive égale pour `nImages` de 2 à 7.
- [ ] **Step 2 :** `npm --prefix video test` → FAIL.
- [ ] **Step 3 :** implémenter. `sync.mjs` copie `short-<n>.jpg` présents **et** déclarés dans `meta.shortImages` (un fichier sans entrée = erreur). `ShortVideo` : la scène i reçoit `copyFor(slug, lang, slideImages(n, credits.length)[i])` ; l'outro `copyFor(slug, lang, 0)`. Portrait (`width/height < 1`) : `fact.focus` vaut `'50% 20%'` pour cette scène (sans toucher au `Fact` stocké). `describe.mjs` passe le tableau.
- [ ] **Step 4 :** `npm --prefix video test` → PASS ; `npm --prefix video run lint` → PASS (tsc).
- [ ] **Step 5 :** commit `video: une image et un crédit par fait`.

### Task 5 : la description YouTube crédite toutes les images

**Files :**
- Modify : `scripts/lib/youtube-meta.mjs`, `scripts/video-publish.mjs` (crédits = `[meta.image, ...meta.shortImages]`)
- Test : `test/culture-videos.test.mjs` (ou le fichier qui teste déjà `youtubeMeta` — `grep -l youtubeMeta test/`)

**Interfaces :**
- `youtubeMeta({ slug, lang, short, credit, music })` : `credit` objet **ou** tableau ; un objet seul produit **octet pour octet** la description d'aujourd'hui.
- `shareAlikeLicense(licenses: string[], musicLicense)` → la licence BY-SA de version la plus haute parmi photos + piste, ou null (garder la signature à deux chaînes en appelant avec `[l]`).

- [ ] **Step 1 : tests qui échouent** — 3 crédits (PD, CC BY 2.0, CC BY-SA 3.0) + piste CC BY-SA 4.0 → 3 blocs photo, dédoublonnés par `commonsUrl`, une seule ligne « même licence (CC BY-SA 4.0) » ; un crédit objet → description identique à l'attendu actuel.
- [ ] **Step 2 :** tests → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npm test` → PASS.
- [ ] **Step 5 :** commit `youtube: créditer chaque image du Short`.

### Task 6 : essai sur Arshile Gorky (PR #226)

**Files :** sur la branche `culture/arshile-gorky-pionnier-armeno-americain-de-l-expressionnisme-abstrait` (worktree à part, la branche courante a du travail non commité).

- [ ] **Step 1 :** fusionner `main` + la branche de travail dans la branche Gorky ; `node scripts/culture-short-images.mjs arshile-gorky-pionnier-armeno-americain-de-l-expressionnisme-abstrait` → 6 lignes `✓`.
- [ ] **Step 2 :** régénérer le corps de PR (section images) et le publier sur #226 (`gh pr edit 226 --body-file`, en gardant tout ce qui est hors des marqueurs AUTO).
- [ ] **Step 3 :** Nareg revoit les 7 images et en remplace au besoin ; relancer le CLI.
- [ ] **Step 4 :** rendu local du Short fr — voix d'abord (`node video/scripts/voice.mjs --slug <slug> --lang fr`, 8 requêtes Gemini TTS), puis `node video/scripts/sync.mjs` et, dans `video/`, `npx remotion render Fr-<slug> out/fr/<slug>.mp4 --crf=30`, le donner à regarder ; **rien n'est poussé vers YouTube**.
- [ ] **Step 5 :** sur accord, PR de la fonctionnalité vers `main`.
