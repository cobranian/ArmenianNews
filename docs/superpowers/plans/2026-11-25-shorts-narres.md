# Shorts narrés — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque futur Short Culture est narré par une voix Gemini dans sa langue, ouvre sur une accroche lisible dès la première image, cale ses scènes sur la voix et finit en nommant le site et en invitant à s'abonner.

**Architecture :** le texte parlé (`spoken`) est un champ de plus de chaque fait de `short.<lang>.json`, écrit par les mêmes appels au modèle que le reste du Short et relu dans la PR. Au rendu (`video.yml`), un script `video/scripts/voice.mjs` appelle Gemini TTS phrase par phrase, dépose les WAV dans `video/public/voice/` et écrit leurs durées dans les données que lit Remotion ; `ShortVideo` en déduit la durée de chaque scène et baisse la musique sous la voix.

**Tech Stack :** Node 24 (ESM, `node --test`), Remotion 4.0.540 (React 19, TypeScript), Gemini API Interactions (`/v1beta/interactions`), ffprobe, GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-11-25-shorts-narres-design.md`

## Global Constraints

- Modèle principal `gemini-3.8-flash-tts`, secours `gemini-3.8-flash-lite-tts` (quotas séparés) ; réponse : WAV base64 dans `steps[].content[]` où `type === 'audio'`.
- Quota Tier 1 : **10 requêtes/minute, 100 requêtes/jour** par modèle → une requête par phrase, ≥ 6,5 s entre deux requêtes ; un 429 « per day » bascule sur le secours, pas de nouvel essai sur le principal.
- Style commun : `calm, warm documentary narrator, clear diction, natural pace, engaging`.
- Voix (femme / homme) : fr Kore/Sadaltager · en Kore/Sadaltager · de Kore/Sadaltager · it Sulafat/Sadaltager · es Sulafat/Sadaltager · hy Sulafat/Sadaltager · ru Kore/Sadaltager. **Aucune voix par défaut.**
- `spoken` : ≤ 90 caractères, mêmes faits que `text`, **nombres en chiffres**, chaque nombre présent dans l'article de la même langue.
- `spoken` exigé pour les articles dont `fr.md` a `date >= SPOKEN_SINCE` ; `SPOKEN_SINCE` = date de la fusion de ce chantier (à écrire au moment de la fusion, format `AAAA-MM-JJ`).
- `shortHash` d'un short **sans** `spoken` ne change pas (sinon toutes les traductions existantes deviennent périmées).
- Jamais de Short muet en repli : une langue sans voix n'est pas rendue (« langue sautée », run rouge).
- Les vidéos déjà publiées ne sont pas re-rendues.
- `video/` est un paquet npm à part : `npm --prefix video ci`, `npm run video:test` ; `npm test` et `npm run lint` à la racine l'ignorent.
- Ne pas toucher aux modifications non commitées de `video/` sur `main` (`Root.tsx`, `music.json`, `erebuni-rome/`) : travailler dans un worktree partant de `origin/main`.
- Jamais de déploiement local ; jamais de fusion sans l'accord de Nareg.

## Review Focus

1. **Le quota du jour épuisé au milieu d'un sujet** : les phrases déjà synthétisées ne doivent pas être redemandées au prochain lancement (cache par phrase), et la bascule sur Lite doit se faire sans perdre les phrases du modèle principal. → Task 4, test `synthesize reprend depuis le cache`.
2. **Une langue facultative (de/it/es) dont le short est sauté par `sync.mjs`** : `voice.mjs` doit l'ignorer proprement, pas planter tout le sujet. → Task 4, test `voice.mjs ignore une langue absente des données`.
3. **Un article publié juste avant `SPOKEN_SINCE` sans `spoken`** : `culture-check` passe, mais le rendu doit échouer visiblement. Ne pas produire une vidéo muette. → Task 5, `copyFor` lève une erreur si un fait n'a pas de voix.
4. **Une phrase très longue (> 12 s parlée)** : la scène s'allonge, la vidéo dépasse 60 s ou 10 Mo. → Task 5, test `sceneFrames plafonne` + contrôle de taille existant de `render-all`.
5. **Un nouvel article dont le texte parlé arménien contient du latin** : la garde d'alphabet des traductions doit couvrir `spoken`. → Task 2, test sur `translationScriptProblem` / garde du short traduit.

---

### Task 1 : le champ `spoken` dans le texte d'un Short

**Files :**
- Modify : `scripts/lib/culture-short.mjs` (constantes, `FACT_KEYS`, `validateShort`)
- Modify : `scripts/lib/culture-validate.mjs` (`checkShorts` : exigence selon la date)
- Test : `test/culture-short.test.mjs`, `test/culture-validate.test.mjs`

**Interfaces :**
- Produces : `SHORT_MAX_SPOKEN = 90`, `SPOKEN_SINCE` (chaîne `AAAA-MM-JJ`), `spokenRequired(date: string): boolean`, `validateShort(short, { lang, articleText, requireSpoken = false })`.

- [ ] **Step 1 : tests qui échouent** (`test/culture-short.test.mjs`)

```js
const spoken = (s) => ({ ...s, facts: s.facts.map((f) => ({ ...f, spoken: 'Une phrase dite.' })) })
test('validateShort : spoken exigé quand requireSpoken', () => {
  assert.deepEqual(validateShort(spoken(short()), { lang: 'fr', articleText: ARTICLE, requireSpoken: true }), [])
  assert.ok(validateShort(short(), { lang: 'fr', articleText: ARTICLE, requireSpoken: true }).some((e) => /fait 1 : spoken manquant/.test(e)))
  assert.deepEqual(check(short()), []) // ancien short, sans exigence : toujours valide
})
test('validateShort : spoken trop long, nombre inventé', () => {
  const s = spoken(short()); s.facts[0].spoken = 'x'.repeat(91)
  assert.ok(check(s).some((e) => /fait 1 : spoken de 91 caractères \(max 90\)/.test(e)))
  const n = spoken(short()); n.facts[2].spoken = 'En 1999, rien.'
  assert.ok(check(n).some((e) => /nombres absents de l’article : 1999/.test(e)))
})
test('validateShort : spoken présent sur un fait impose les 7', () => {
  const s = short(); s.facts[0] = { ...s.facts[0], spoken: 'Dit.' }
  assert.ok(check(s).some((e) => /fait 2 : spoken manquant/.test(e)))
})
test('shortHash : inchangé pour un short sans spoken, changé avec', async () => {
  const fr = JSON.parse(await read(KHOR, 'short.fr.json'))
  const en = JSON.parse(await read(KHOR, 'short.en.json'))
  assert.equal(shortHash(fr), en.sourceHash)
  assert.notEqual(shortHash(spoken(fr)), shortHash(fr))
})
test('spokenRequired : à partir de SPOKEN_SINCE', () => {
  assert.equal(spokenRequired(SPOKEN_SINCE), true)
  assert.equal(spokenRequired('2026-10-17'), false)
  assert.equal(spokenRequired(undefined), false)
})
```

Dans `test/culture-validate.test.mjs`, un test qui appelle `validateArticle` sur un article de fixture daté `SPOKEN_SINCE` dont le `short.fr.json` n'a pas `spoken` : `errors` contient `short.fr.json : fait 1 : spoken manquant` ; daté `2026-10-17` : aucune erreur de ce type.

- [ ] **Step 2 : lancer** `node --test test/culture-short.test.mjs test/culture-validate.test.mjs` — attendu : échec (`spokenRequired` non exporté).

- [ ] **Step 3 : implémenter.** `FACT_KEYS` devient `['eyebrow', 'title', 'text', 'big', 'spoken']` (une clé `undefined` disparaît de `JSON.stringify`, l'empreinte des anciens shorts ne bouge pas). `validateShort` : si `requireSpoken` ou si un fait a `spoken`, les 7 l'exigent ; longueur ≤ `SHORT_MAX_SPOKEN` ; `spoken` entre dans `texts` (contrôle des nombres et des URL). `SPOKEN_SINCE` : provisoirement `'2026-11-26'`, à remplacer par la date de fusion. `checkShorts` : `requireSpoken: spokenRequired(langs.fr?.data?.date ?? <date du front-matter de texts.fr>)` pour le français et chaque traduction.

- [ ] **Step 4 : lancer** les deux fichiers puis `npm test` — attendu : tout passe (les 36 articles existants restent valides).

- [ ] **Step 5 : commit** `feat(culture): champ spoken (texte parlé) des Shorts`

---

### Task 2 : les consignes de rédaction (accroche + texte parlé)

**Files :**
- Modify : `scripts/lib/culture-prompts.mjs` (`SHORT_EXAMPLE`, `SHORT_SHAPE`, `SHORT_RULES`, `buildShortTranslateMessages`)
- Modify : `scripts/lib/culture-short-translate.mjs` (passer `requireSpoken: true`)
- Modify : `scripts/culture-draft.mjs:216-218`, `scripts/lib/culture-checks.mjs:94,120` (passer `requireSpoken: true` pour un short neuf ou révisé)
- Modify : `video/src/shorts/FORMAT.md` (règles 2 et 3 : accroche, `spoken`)
- Test : `test/culture-prompts.test.mjs`, `test/culture-short-translate.test.mjs`

**Interfaces :**
- Consumes : `SHORT_MAX_SPOKEN`, `validateShort(..., { requireSpoken })` (Task 1).

- [ ] **Step 1 : tests qui échouent.**
  - `buildShortMessages(...)[0].content` contient `spoken`, `${SHORT_MAX_SPOKEN} caractères`, `en chiffres`, et une règle d'accroche qui interdit la survente (`/accroche/` et `/sans exagérer|n'exagère/`).
  - `SHORT_EXAMPLE.facts.every((f) => f.spoken)` et `validateShort(SHORT_EXAMPLE, { lang: 'fr', articleText: <texte duduk du test>, requireSpoken: true })` ne rend pas d'erreur de `spoken`.
  - `buildShortTranslateMessages` : la forme JSON demandée contient `"spoken"`.
  - `buildReviseMessages` avec un short : le système contient `spoken`.
  - `culture-short-translate` : une traduction rendue sans `spoken` est refusée ; une traduction hy dont `spoken` contient un mot latin hors noms propres est refusée par la même garde d'alphabet que `text` (Review Focus 5).
- [ ] **Step 2 : lancer** ces deux fichiers — échec attendu.
- [ ] **Step 3 : implémenter.** Règles à ajouter à `SHORT_RULES` (texte exact, le reste inchangé) :
  - remplacer la règle 1 par : `- Exactement ${SHORT_FACTS} faits. Le premier est l'ACCROCHE : le fait le plus surprenant de l'ARTICLE (un chiffre, un paradoxe, une question à laquelle la vidéo répond), compréhensible sans contexte, avec le nom du sujet en eyebrow ou en title ; il donne envie de rester sans exagérer ni promettre plus que la vidéo ne dit. Le dernier conclut.`
  - ajouter : `- spoken : la phrase DITE par la voix pendant ce fait, ${SHORT_MAX_SPOKEN} caractères au plus : le même fait que text, plus court, écrit pour l'oreille (pas de parenthèses ni d'abréviations, nombres EN CHIFFRES tels que dans l'ARTICLE).`
  - `SHORT_SHAPE` et la forme de `buildShortTranslateMessages` gagnent `"spoken": "…"` dans chaque fait ; la traduction dit `- spoken : traduis-le en phrase parlée, ${SHORT_MAX_SPOKEN} caractères au plus, nombres en chiffres.`
  - `SHORT_EXAMPLE` : ajouter un `spoken` à chacun des trois faits, dont tous les nombres sont dans le texte d'exemple.
  - `FORMAT.md` : réécrire la règle 2 (accroche) et ajouter la règle `spoken` avec les mêmes mots.
- [ ] **Step 4 : lancer** `npm test` — tout passe.
- [ ] **Step 5 : commit** `feat(culture): accroche et texte parlé dans les consignes du Short`

---

### Task 3 : table des voix, alternance et phrase de fin

**Files :**
- Create : `video/scripts/voices.mjs` (pur)
- Create : `video/src/shorts/cta.json`
- Test : `video/test/voices.test.mjs`

**Interfaces :**
- Produces : `VOICES: Record<Lang, { female: string, male: string }>`, `voiceFor({ lang, ordinal }): { name: string, gender: 'female'|'male' }` (ordinal pair → femme, impair → homme), `subjectOrdinal(slug, articles: { slug, date }[]): number` (rang du slug parmi les articles triés par `date` puis `slug`), `cta.json` = `{ <lang>: { spoken: string, screen: string } }` pour les 7 langues.

- [ ] **Step 1 : tests qui échouent.**

```js
test('VOICES : 7 langues, une femme et un homme chacune, choix de Nareg', () => {
  assert.deepEqual(VOICES, {
    fr: { female: 'Kore', male: 'Sadaltager' }, en: { female: 'Kore', male: 'Sadaltager' },
    de: { female: 'Kore', male: 'Sadaltager' }, it: { female: 'Sulafat', male: 'Sadaltager' },
    es: { female: 'Sulafat', male: 'Sadaltager' }, hy: { female: 'Sulafat', male: 'Sadaltager' },
    ru: { female: 'Kore', male: 'Sadaltager' },
  })
})
test('voiceFor alterne d’un sujet au suivant', () => {
  assert.equal(voiceFor({ lang: 'fr', ordinal: 10 }).name, 'Kore')
  assert.equal(voiceFor({ lang: 'fr', ordinal: 11 }).name, 'Sadaltager')
  assert.throws(() => voiceFor({ lang: 'xx', ordinal: 0 }))
})
test('subjectOrdinal : ordre de publication, stable', () => {
  const a = [{ slug: 'b', date: '2026-11-02' }, { slug: 'a', date: '2026-11-01' }, { slug: 'c', date: '2026-11-02' }]
  assert.deepEqual(['a', 'b', 'c'].map((s) => subjectOrdinal(s, a)), [0, 1, 2])
})
test('cta.json : 7 langues, phrase dite ≤ 90 caractères, domaine de la chaîne à l’écran', () => {
  // fr/de/it → armenieinfo.ch ; en/es/hy/ru → armenianews.org
})
```

- [ ] **Step 2 : lancer** `npm run video:test` — échec attendu.
- [ ] **Step 3 : implémenter.** `cta.json`, textes dits (ceux des essais du 25 nov., à faire relire par Nareg pour hy et ru) :
  - fr `L'article complet est sur Arménie Info point C H. Abonnez-vous !`
  - en `Read the full story on Armenia News dot org. Subscribe for more!`
  - de `Den ganzen Artikel gibt es auf Arménie Info Punkt C H. Jetzt abonnieren!`
  - it `L'articolo completo è su Arménie Info punto C H. Iscriviti!`
  - es `El artículo completo está en Armenia News punto org. ¡Suscríbete!`
  - ru `Полная статья — на сайте Armenia News точка org. Подписывайтесь!`
  - hy `Ամբողջական հոդվածը՝ Արմենիա Ինֆո կայքում։ Բաժանորդագրվե՛ք։`
  - `screen` : l'appel à s'abonner affiché (fr `Abonnez-vous`, en `Subscribe`, de `Abonnieren`, it `Iscriviti`, es `Suscríbete`, ru `Подписывайтесь`, hy `Բաժանորդագրվե՛ք`).
- [ ] **Step 4 : lancer** `npm run video:test` — passe.
- [ ] **Step 5 : commit** `feat(video): voix par langue, alternance par sujet, phrase de fin`

---

### Task 4 : synthèse vocale (`voice.mjs`)

**Files :**
- Create : `video/scripts/tts.mjs` (client Gemini, sans E/S disque)
- Create : `video/scripts/voice.mjs` (CLI : `node video/scripts/voice.mjs --slug <s> --lang <l>`)
- Modify : `video/.gitignore` (ou racine) : `public/voice/`
- Test : `video/test/tts.test.mjs`, `video/test/voice.test.mjs`

**Interfaces :**
- Consumes : `VOICES`, `voiceFor`, `subjectOrdinal`, `cta.json` (Task 3) ; `src/shorts/data/<slug>.json` écrit par `sync.mjs` (les faits portent `spoken`).
- Produces :
  - `requestBody({ text, voice, model }): object` ; `extractAudio(json): Buffer | null` ; `isDailyQuota(status, body): boolean` ; `synthesize({ text, voice, fetch, models = [PRIMARY, FALLBACK], sleep }): Promise<{ wav: Buffer, model: string }>`.
  - Fichiers : `video/public/voice/<slug>/<lang>/<i>.wav` (i = 0..6 faits, 7 = fin) et, dans `src/shorts/data/<slug>.json`, `<lang>.voice = { name, gender, model, lines: [{ file: 'voice/<slug>/<lang>/<i>.wav', seconds }] }` (8 entrées).
  - Code de sortie ≠ 0 si une phrase n'a pas pu être synthétisée.

- [ ] **Step 1 : tests qui échouent** (avec un `fetch` factice, jamais le réseau) :
  - `requestBody` contient `model`, la voix dans `generation_config.speech_config[0].voice`, le style commun dans `annotations[0].style`.
  - `extractAudio` rend le Buffer décodé d'une réponse de forme réelle (`{ steps: [{ content: [{ type: 'audio', data: <base64> }] }] }`) et `null` sans audio.
  - `synthesize` : un 429 dont le corps contient `per day` sur le principal → un seul appel au principal puis le secours ; un 429 « per minute » → attente puis nouvel essai sur le même modèle ; 3 échecs sur les deux modèles → rejet.
  - `voice.mjs` (fonction exportée `voiceLines({ data, lang, cta })`) : 8 textes = les 7 `spoken` puis `cta[lang].spoken` ; lève une erreur si un fait n'a pas `spoken`.
  - **Review Focus 1** — `synthesize reprend depuis le cache` : la fonction de haut niveau `voiceShort({ slug, lang, dir, fetch })` ne rappelle pas Gemini pour un `<i>.wav` déjà présent.
  - **Review Focus 2** — `voice.mjs ignore une langue absente des données` : `--lang es` sur des données sans bloc `es` sort avec le code 0 et un message, sans appel réseau.
- [ ] **Step 2 : lancer** `npm run video:test` — échec attendu.
- [ ] **Step 3 : implémenter.** `GEMINI_API_KEY` lue dans l'environnement (erreur claire si absente). Une requête par phrase, `sleep(6500)` entre deux. Durée de chaque WAV par `ffprobe` (comme `render-all.mjs`). L'ordinal vient de `subjectOrdinal(slug, <articles de ../src/data/culture/*/fr.md, champ date>)`.
- [ ] **Step 4 : lancer** `npm run video:test` — passe. Puis, en local avec la clé de `.env` : `node video/scripts/sync.mjs && node video/scripts/voice.mjs --slug alphabet-armenien --lang fr` sur un short auquel on a ajouté `spoken` à la main **dans le worktree seulement** — attendu : 8 WAV, bloc `voice` écrit. Ne pas commiter ce short modifié.
- [ ] **Step 5 : commit** `feat(video): synthèse vocale Gemini des Shorts`

---

### Task 5 : le gabarit narré (Remotion)

**Files :**
- Modify : `video/src/shorts/types.ts` (`ShortLangData.voice`), `video/src/garni/content.ts` (`Fact.spoken?`, `Copy.outro.subscribe?`)
- Modify : `video/src/shorts/ShortVideo.tsx` (durées par scène, voix, `shortDuration`)
- Modify : `video/src/shorts/music.tsx` (`ShortMusic` : baisse sous la voix)
- Modify : `video/src/garni/Scenes.tsx` (`FactScene` première scène sans entrée animée ; `Outro` affiche `subscribe`)
- Create : `video/src/shorts/timing.ts` (pur) ; Test : `video/test/timing.test.mjs` (via `node --experimental-strip-types` ou en écrivant `timing.mjs` en JS pur importé par le TSX — au choix du constructeur, pourvu que le test tourne dans `npm run video:test`)

**Interfaces :**
- Consumes : `<lang>.voice.lines[i].seconds` (Task 4), `cta.json.screen` (Task 3).
- Produces : `sceneFrames(seconds: number, fps: number): number` = `clamp(round((LEAD + seconds + TAIL) * fps), MIN_SCENE, MAX_SCENE)` avec `LEAD = 0.3`, `TAIL = 0.5`, `MIN_SCENE = 6 * fps`, `MAX_SCENE = 12 * fps` ; `outroFrames(seconds, fps)` = même règle avec minimum `5 * fps` ; `speechWindows(lines, fps, fade): [from, to][]` (frames où la voix parle, pour la musique).

- [ ] **Step 1 : tests qui échouent** (`timing`) : `sceneFrames(4, 30) === 180` (minimum), `sceneFrames(7, 30) === 234`, `sceneFrames(30, 30) === 360` (plafond — Review Focus 4) ; `speechWindows` rend 8 fenêtres croissantes qui ne se chevauchent pas.
- [ ] **Step 2 : lancer** `npm run video:test` — échec attendu.
- [ ] **Step 3 : implémenter.**
  - `copyFor` **lève une erreur** si le bloc de la langue n'a pas `voice` ou pas 8 lignes (Review Focus 3 : ancien short sans voix → rendu en échec, jamais muet).
  - `ShortVideo` : chaque `TransitionSeries.Sequence` dure `sceneFrames(lines[i].seconds)` ; dedans, `<Audio src={staticFile(lines[i].file)} />` dans une `<Sequence from={LEAD*fps}>` ; la fin dure `outroFrames(lines[7].seconds)` avec sa voix. `shortDuration` = somme des scènes + fin − 7 × `FADE`.
  - `ShortMusic` reçoit les fenêtres de parole : volume 1 hors parole, 0.3 pendant (≈ −10 dB), rampes de 0,25 s ; fondus d'entrée/sortie inchangés.
  - `FactScene` `first` : styles d'entrée à opacité 1 et sans translation dès la frame 0.
  - `Outro` : sous l'URL, `copy.outro.subscribe` (texte `screen` de `cta.json`), même famille que le sur-titre.
- [ ] **Step 4 : vérifier.** `npm run video:test` passe ; `npx --prefix video tsc --noEmit` sans erreur ; en local, `npx remotion render Fr-alphabet-armenien out/fr/test-narre.mp4 --crf 30` (données de la Task 4) produit un MP4 < 10 Mo avec flux audio ; le rendu d'un slug **sans** bloc `voice` échoue avec le message de `copyFor`. Envoyer le MP4 à Nareg pour écoute (skill `verifier-le-rendu` non applicable : ce n'est pas le site).
- [ ] **Step 5 : commit** `feat(video): scènes calées sur la voix, ouverture immédiate, fin avec abonnement`

---

### Task 6 : brancher la voix dans `video.yml`

**Files :**
- Modify : `.github/workflows/video.yml` (étape « Rendre »)
- Modify : `CLAUDE.md` (piège « Vidéo automatique » : quota TTS) — une ligne, en retirant une ligne périmée ailleurs si possible
- Test : `test/culture-workflows.test.mjs` (ou nouveau `test/video-voice-wiring.test.mjs`)

**Interfaces :**
- Consumes : `video/scripts/voice.mjs` (Task 4).

- [ ] **Step 1 : test qui échoue** : dans `video.yml`, l'étape `Rendre` a `GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}` dans son `env`, appelle `node video/scripts/voice.mjs --slug "$SLUG" --lang "$l"` **avant** `render-all.mjs` dans la même boucle, et un échec de `voice.mjs` ajoute la langue à `FAILED` sans lancer son rendu.
- [ ] **Step 2 : lancer** le test — échec attendu.
- [ ] **Step 3 : implémenter.** Dans la boucle : `node video/scripts/voice.mjs ... && node video/scripts/render-all.mjs ... || { echo "::warning::$SLUG/$l : voix ou rendu en échec, langue sautée"; FAILED="$FAILED $l"; }`. Le secret `GEMINI_API_KEY` existe déjà dans le dépôt (articles Culture) : ne pas en créer un autre. CLAUDE.md, liste « Vidéo automatique » : `(5) La voix (voice.mjs) consomme 8 requêtes Gemini TTS par langue, 56 par sujet, sur un quota de 100/jour : deux sujets le même jour basculent sur flash-lite-tts, au-delà la langue est sautée (relancer video.yml le lendemain).`
- [ ] **Step 4 : lancer** `npm test`, `npm run lint`, `npm run video:test` — tout passe.
- [ ] **Step 5 : commit** `ci(video): voix Gemini avant le rendu`

---

### Task 7 : mise en service

- [ ] **Step 1 :** remplacer `SPOKEN_SINCE` par la date du **premier brouillon écrit par le code fusionné** — pas celle de la fusion. Le brouillon quotidien part à 03:00 UTC : fusion le jour J **avant** 03:00 UTC → J ; **après** 03:00 UTC → J+1 (le brouillon de J a été écrit par l'ancien code, sans `spoken`). Le sens de l'erreur compte : **trop tard ne coûte rien** (un article de plus sans voix, comme les anciens) ; **trop tôt est le dommage** — un article daté de SPOKEN_SINCE mais rédigé par l'ancien code n'a pas de `spoken`, validateArticle refuse alors son Short après la fusion, et l'article partirait sans vidéo (video.yml échoue désormais sur `::error::` au lieu de se taire, mais la vidéo reste à refaire à la main). Dans le doute, prendre le lendemain. `npm test`.
- [ ] **Step 2 :** PR vers `main` ; **fusion seulement sur l'accord de Nareg**.
- [ ] **Step 3 :** après fusion, pour chaque PR `culture/*` ouverte : **d'abord fusionner `main` dans sa branche** (`git fetch origin` ; `git switch culture/<slug>` ; `git merge origin/main` ; `git push`), **puis seulement** y envoyer `/corrige ajoute le texte parlé (spoken) à chaque fait du Short`. L'ordre n'est pas négociable : articles-revise.yml et articles-check.yml exécutent le code de la **branche de la PR** — sans la fusion, c'est l'ancien culture-revise qui répond, il ne connaît pas `spoken` et rend un Short sans voix. Vérifier ensuite dans la PR que `short.fr.json` porte bien un `spoken` par fait.
- [ ] **Step 4 :** au premier article publié après la fusion, lire le log de `video.yml` (`gh run view <id> --log | grep -E "voix|sautée"`), vérifier les 7 MP4 (durée, audio) et les faire écouter à Nareg avant l'envoi sur YouTube.
- [ ] **Step 5 :** après 10 Shorts narrés par chaîne, comparer avec vidIQ (vues engagées / vues, % regardé, abonnés / 1 000 vues) aux 10 derniers sans voix — mesures de départ dans le design.
