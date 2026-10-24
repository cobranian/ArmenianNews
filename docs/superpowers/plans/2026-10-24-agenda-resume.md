# Résumé des événements de l'agenda — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans la visionneuse de l'agenda, une ligne « Résumé ▾ » déplie un résumé de 2-3 phrases de l'événement, écrit automatiquement dans la langue de la page.

**Architecture:** Au scrape horaire, un module pur (`scripts/lib/agenda-resumes.mjs`) lit la page armenopole des événements sans résumé, demande à un modèle :free OpenRouter les six langues en un JSON, filtre (alphabet, prix/heures/adresses), met en cache par URL, et écrit un fichier par langue. Le navigateur charge le fichier de sa langue au premier dépli (`import.meta.glob` non-eager → un chunk par langue) ; `agenda.json` porte seulement la liste des langues disponibles par événement.

**Tech Stack:** Node 24 (`node:test`), cheerio, OpenRouter (chaîne `modelChain`), React 18, Vite.

**Spec:** `docs/superpowers/specs/2026-10-24-agenda-resume-design.md`

## Global Constraints

- Six langues : `fr de it en hy ru` — lire `ALL_LANGS` dans `sites.config.js`, ne pas les écrire en dur.
- Un appel modèle par événement (six langues en un JSON) ; **20 événements max par instantané** ; **budget total 180 000 ms** pour l'étape ; délai d'un appel modèle 30 000 ms.
- Modèles : `modelChain()` de `scripts/lib/classify-rubrics.mjs`, `ENDPOINT` du même module, clé `process.env.OPENROUTER_API_KEY`, jamais écrite au log.
- Résumé : 2-3 phrases, ~250-400 caractères ; **ni prix, ni horaires, ni adresses, ni liens** ; noms propres gardés tels qu'écrits dans la source.
- Texte source de moins de **80** caractères → pas de résumé.
- Garde d'alphabet : `strayWords(text, lang, allowedWords([titre, texteSource]))` de `scripts/lib/brief-script.mjs`.
- Échec = jamais d'exception hors de l'étape ; log `✗ résumé: …` ; succès `✓ résumé: …`.
- `agenda-resumes.json` n'est **jamais** importé statiquement par un composant.
- Lint : exactement **5** avertissements (les connus). Tests existants : tous verts.

## Review Focus

1. Réponse du modèle enveloppée de ```` ```json ```` ou précédée de texte → doit être lue quand même (test Task 2).
2. Page armenopole vide, redirigée ou sans `[itemprop="description"]` → aucun appel modèle, tentative comptée (test Task 3).
3. Événement passé, absent de l'agenda → purgé du cache et des fichiers par langue (test Task 2).
4. Agenda reconstitué par backfill (scrape armenopole en échec) → `resumeLangs` recalculé depuis le cache, pas hérité figé (test Task 4).
5. Lecteur qui change d'événement (‹ ›) pendant le chargement d'un résumé → le texte d'un autre événement ne doit jamais s'afficher (vérifié Task 5, step navigateur).

---

### Task 1: Extraction du texte et filtres purs

**Files:**
- Create: `scripts/lib/agenda-resumes.mjs`
- Create: `test/agenda-resumes.test.mjs`
- Fixture (déjà en place, non commitée) : `test/fixtures/armenopole-event-2026-10-24.html` — extrait réel de `young-prodigies-of-armenia-in-switzerland.html`, relevé le 24 oct. 2026.

**Interfaces:**
- Produces:
  - `extractEventText(html: string): string | null` — texte de `[itemprop="description"]` (repli : premier `div` enfant de `.col-md-8.col-md-pull-4`), blancs repliés en espaces simples, sauts de ligne conservés en `\n` simple ; `null` si < 80 caractères.
  - `sourceHash(text: string): string` — sha1 hex, 12 premiers caractères.
  - `forbiddenDetail(text: string): string | null` — nom de la règle violée (`'heure'`, `'prix'`, `'adresse'`) ou `null`.

- [ ] **Step 1: Write the failing tests**

```js
test('extrait le texte réel de la fixture', () => {
  const t = extractEventText(fixture)
  assert.ok(t.startsWith('Save the Date'))
  assert.match(t, /Young Prodigies of Armenia/)
  assert.ok(t.length > 1000)
})
test('texte trop court ou absent → null', () => {
  assert.equal(extractEventText('<div itemprop="description">Bientôt.</div>'), null)
  assert.equal(extractEventText('<html><body>rien</body></html>'), null)
})
test('sourceHash est stable et sensible au texte', () => {
  assert.equal(sourceHash('a'), sourceHash('a')); assert.notEqual(sourceHash('a'), sourceHash('b'))
  assert.equal(sourceHash('a').length, 12)
})
test('forbiddenDetail attrape heures, prix, adresses', () => {
  assert.equal(forbiddenDetail('Concert à 19:30 à Genève.'), 'heure')
  assert.equal(forbiddenDetail('Starts at 7 PM.'), 'heure')
  assert.equal(forbiddenDetail('Начало в 19.00.'), 'heure')
  assert.equal(forbiddenDetail('Billets CHF 35.'), 'prix')
  assert.equal(forbiddenDetail('Entrée 15 €.'), 'prix')
  assert.equal(forbiddenDetail('Tickets $20.'), 'prix')
  assert.equal(forbiddenDetail('Տոմսը 5000 ֏ է։'), 'prix')
  assert.equal(forbiddenDetail('Билет 500 руб.'), 'prix')
  assert.equal(forbiddenDetail('Au 2 Place d’Arménie.'), 'adresse')
  assert.equal(forbiddenDetail('At 11 St. Annagasse.'), 'adresse')
})
test('forbiddenDetail laisse passer années, ordinaux, petits nombres', () => {
  for (const s of ['La 33e édition du festival.', 'Deux concerts en 2026.', '2 concerts, 6 villes.', 'Les 40 ans de GAIDZ.'])
    assert.equal(forbiddenDetail(s), null, s)
})
```

- [ ] **Step 2: Run `node --test test/agenda-resumes.test.mjs`** — Expected: FAIL (module absent).

- [ ] **Step 3: Implement the three functions in `scripts/lib/agenda-resumes.mjs`** (cheerio pour l'extraction ; `node:crypto` pour le hash). Règle `adresse` : un nombre suivi d'un mot de voie (`rue|route|place|avenue|chemin|ch\.|boulevard|st\.|street|ave|road|strasse|gasse|via|улица|ул\.|փողոց`) ou l'inverse (`Annagasse 11`). Règle `heure` : `\b\d{1,2}[:h.]\d{2}\b` ou `\b\d{1,2}\s?(am|pm)\b` (insensible à la casse). Règle `prix` : un nombre adjacent à `CHF|EUR|USD|€|\$|£|֏|₽|руб|AMD|dram`.

- [ ] **Step 4: Run the test** — Expected: PASS. Puis `npm test` : tout vert.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/agenda-resumes.mjs test/agenda-resumes.test.mjs test/fixtures/armenopole-event-2026-10-24.html
git commit -m "agenda : extraction du texte armenopole et filtre prix/heure/adresse"
```

### Task 2: Prompt, lecture de la réponse, vérification, cache

**Files:**
- Modify: `scripts/lib/agenda-resumes.mjs`
- Modify: `test/agenda-resumes.test.mjs`

**Interfaces:**
- Consumes: Task 1 ; `strayWords`, `allowedWords` (`scripts/lib/brief-script.mjs`) ; `ALL_LANGS` (`sites.config.js`).
- Produces:
  - `buildResumeMessages(ev: {title, location}, text: string): Array<{role, content}>` — système + utilisateur ; exige un objet JSON `{"fr":…,"de":…,"it":…,"en":…,"hy":…,"ru":…}`, 2-3 phrases, ~250-400 caractères, sans prix/horaires/adresses/liens, noms propres tels qu'écrits dans la source, hy en arménien oriental, ru en russe.
  - `parseResumeReply(content: string): Record<lang, string>` — accepte le JSON nu, entre fences ```` ```json ````, ou précédé/suivi de texte (premier `{` au dernier `}`) ; ignore les clés hors `ALL_LANGS` et les valeurs non-chaînes ou vides ; `{}` si illisible.
  - `vetResumes(byLang, { title, text }): { kept: Record<lang,string>, rejected: Array<[lang, reason]> }` — `reason` ∈ `'alphabet' | 'heure' | 'prix' | 'adresse' | 'longueur'` ; longueur hors 80-700 caractères = `'longueur'`.
  - Cache : `{ [url]: { hash: string, checkedAt: ISO, attempts: number, fr?, de?, it?, en?, hy?, ru? } }`.
  - `pendingEvents(events, cache, now: Date, max = 20): event[]` — d'abord les URL absentes du cache, puis celles à qui il manque une langue avec `attempts < 3`, puis celles dont `checkedAt` a plus de 7 jours ; dédoublonnées par URL ; au plus `max`.
  - `pruneCache(cache, events): cache` — ne garde que les URL présentes dans `events`.
  - `resumesFor(cache, lang): Record<url, string>`.
  - `resumeLangs(entry): lang[]` — langues présentes, dans l'ordre `ALL_LANGS`.

- [ ] **Step 1: Write the failing tests**

```js
const six = { fr: 'Un concert de jeunes musiciens arméniens en tournée en Suisse, entre classique, folk et jazz, de Komitas à Piazzolla.', de: '…', it: '…', en: '…', hy: '…', ru: '…' } // le constructeur écrit des phrases plausibles par langue, ≥ 80 caractères
test('parseResumeReply lit JSON nu, fences et texte autour', () => {
  assert.deepEqual(parseResumeReply(JSON.stringify(six)), six)
  assert.deepEqual(parseResumeReply('```json\n' + JSON.stringify(six) + '\n```'), six)
  assert.deepEqual(parseResumeReply('Voici :\n' + JSON.stringify(six) + '\nBonne journée'), six)
  assert.deepEqual(parseResumeReply('pas de json'), {})
  assert.deepEqual(parseResumeReply(JSON.stringify({ fr: '', es: 'hola', en: 3 })), {})
})
test('vetResumes écarte une langue fautive sans toucher aux autres', () => {
  const r = vetResumes({ ...six, ru: six.ru + ' Начало в 19:00.', hy: six.hy + ' football' }, { title: 'Young Prodigies of Armenia', text: 'Komitas Piazzolla' })
  assert.deepEqual(Object.keys(r.kept).sort(), ['de', 'en', 'fr', 'it'])
  assert.deepEqual(r.rejected.sort(), [['hy', 'alphabet'], ['ru', 'heure']])
})
test('vetResumes permet un nom propre latin cité par la source', () => {
  const r = vetResumes({ hy: six.hy + ' Piazzolla' }, { title: 'X', text: 'Astor Piazzolla' })
  assert.ok(r.kept.hy)
})
test('pendingEvents : nouveaux, puis incomplets, puis périmés ; plafond', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  const ev = (u) => ({ url: u, title: u })
  const cache = {
    a: { hash: 'h', checkedAt: '2026-10-24T00:00:00Z', attempts: 1, ...six },
    b: { hash: 'h', checkedAt: '2026-10-24T00:00:00Z', attempts: 1, fr: six.fr },
    c: { hash: 'h', checkedAt: '2026-10-10T00:00:00Z', attempts: 1, ...six },
    d: { hash: 'h', checkedAt: '2026-10-24T00:00:00Z', attempts: 3, fr: six.fr },
  }
  assert.deepEqual(pendingEvents([ev('a'), ev('b'), ev('c'), ev('d'), ev('n'), ev('n')], cache, now).map((e) => e.url), ['n', 'b', 'c'])
  assert.equal(pendingEvents(Array.from({ length: 30 }, (_, i) => ev('u' + i)), {}, now).length, 20)
})
test('pruneCache retire les événements passés ; resumesFor / resumeLangs', () => {
  const cache = { a: { hash: 'h', attempts: 1, fr: 'x', en: 'y' }, gone: { hash: 'h', attempts: 1, fr: 'z' } }
  const kept = pruneCache(cache, [{ url: 'a' }])
  assert.deepEqual(Object.keys(kept), ['a'])
  assert.deepEqual(resumesFor(kept, 'fr'), { a: 'x' })
  assert.deepEqual(resumeLangs(kept.a), ['fr', 'en'])
})
test('buildResumeMessages interdit prix, horaires, adresses et demande les six langues', () => {
  const m = buildResumeMessages({ title: 'T', location: 'Genève' }, 'texte source').map((x) => x.content).join('\n')
  for (const l of ['fr', 'de', 'it', 'en', 'hy', 'ru']) assert.match(m, new RegExp(`"${l}"`))
  assert.match(m, /texte source/)
})
```

- [ ] **Step 2: Run `node --test test/agenda-resumes.test.mjs`** — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement the functions listed in Interfaces.**
- [ ] **Step 4: Run the test** — Expected: PASS ; `npm test` vert.
- [ ] **Step 5: Commit** — `git commit -m "agenda : prompt, lecture, vérification et cache des résumés"`

### Task 3: L'étape réseau `summarizeAgenda`

**Files:**
- Modify: `scripts/lib/agenda-resumes.mjs`
- Modify: `test/agenda-resumes.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-2 ; `modelChain`, `ENDPOINT` (`classify-rubrics.mjs`) ; `fetchText` (`scripts/lib/http.mjs`).
- Produces: `async summarizeAgenda({ events, cache, apiKey = process.env.OPENROUTER_API_KEY, fetchPage = fetchText, fetchImpl = fetch, now = new Date(), budgetMs = 180000, max = 20, timeoutMs = 30000, log = console }): Promise<cache>` — ne lève jamais ; renvoie le cache **déjà purgé** (`pruneCache`).

Comportement : sans `apiKey` → `✗ résumé: OPENROUTER_API_KEY absente`, cache purgé rendu tel quel. Pour chaque événement de `pendingEvents` tant que le budget n'est pas épuisé : `fetchPage(url)` → `extractEventText` ; si `null`, `attempts += 1`, `checkedAt = now`, `✗ résumé: <url> — texte introuvable`, pas d'appel modèle. Si le hash est identique à l'entrée et qu'aucune langue ne manque → seulement `checkedAt = now`. Sinon un appel `fetchImpl(ENDPOINT, …)` (mêmes en-têtes et corps que `classifyRubrics` : `models: modelChain()`, `temperature: 0.3`, `reasoning: { enabled: false }`) ; si le hash a changé, les anciennes langues sont effacées ; on fusionne `vetResumes(...).kept` ; chaque rejet logué `✗ résumé/<lang>: <reason>`. Budget épuisé → `✗ résumé: budget de 180 s atteint, N événements reportés`. Fin : `✓ résumé: K événements traités, langues écrites {fr: n, …}`.

- [ ] **Step 1: Write the failing tests** (faux `fetchPage` et `fetchImpl`, aucun réseau)

```js
test('summarizeAgenda : écrit les langues valides, compte une page vide, ne lève pas', async () => {
  const events = [{ url: 'ok', title: 'Young Prodigies of Armenia' }, { url: 'vide', title: 'X' }]
  const fetchPage = async (u) => (u === 'ok' ? fixture : '<html></html>')
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(six) } }], model: 'm' }) })
  const out = await summarizeAgenda({ events, cache: {}, apiKey: 'k', fetchPage, fetchImpl, log: silent })
  assert.deepEqual(resumeLangs(out.ok), ['fr', 'de', 'it', 'en', 'hy', 'ru'])
  assert.equal(out.vide.attempts, 1); assert.deepEqual(resumeLangs(out.vide), [])
})
test('summarizeAgenda : modèle en échec → aucune exception, entrée sans langue', async () => {
  const out = await summarizeAgenda({ events: [{ url: 'ok', title: 'T' }], cache: {}, apiKey: 'k', fetchPage: async () => fixture, fetchImpl: async () => ({ ok: false, status: 429 }), log: silent })
  assert.deepEqual(resumeLangs(out.ok), [])
})
test('summarizeAgenda : sans clé, aucun appel', async () => {
  let calls = 0
  await summarizeAgenda({ events: [{ url: 'a', title: 'T' }], cache: {}, apiKey: '', fetchPage: async () => { calls++; return fixture }, fetchImpl: async () => { calls++ }, log: silent })
  assert.equal(calls, 0)
})
test('summarizeAgenda : budget épuisé → s’arrête', async () => {
  let calls = 0
  const events = Array.from({ length: 5 }, (_, i) => ({ url: 'u' + i, title: 'T' }))
  await summarizeAgenda({ events, cache: {}, apiKey: 'k', budgetMs: 0, fetchPage: async () => { calls++; return fixture }, fetchImpl: async () => ({ ok: false, status: 500 }), log: silent })
  assert.equal(calls, 0)
})
test('summarizeAgenda : texte source modifié → anciennes langues effacées', async () => {
  const cache = { ok: { hash: 'ancien', checkedAt: '2026-10-01T00:00:00Z', attempts: 1, ...six } }
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fr: six.fr }) } }] }) })
  const out = await summarizeAgenda({ events: [{ url: 'ok', title: 'T' }], cache, apiKey: 'k', fetchPage: async () => fixture, fetchImpl, now: new Date('2026-10-24T12:00:00Z'), log: silent })
  assert.deepEqual(resumeLangs(out.ok), ['fr'])
})
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement `summarizeAgenda`.** Le budget se mesure avec `Date.now()` au début de l'étape et se teste **avant** chaque événement.
- [ ] **Step 4: Run** — Expected: PASS ; `npm test` vert.
- [ ] **Step 5: Commit** — `git commit -m "agenda : étape de résumé au scrape (budget, plafond, sans exception)"`

### Task 4: Branchement au scrape et au job horaire

**Files:**
- Modify: `scripts/scrape.mjs` (après `generateBriefs`, avant `writeJson('agenda.json', …)`, ~l. 322)
- Modify: `.github/workflows/hourly.yml` (ligne `git add src/data/…`, ~l. 77)
- Create: `src/data/agenda-resumes.json` (`{}`) et `src/data/agenda-resumes/{fr,de,it,en,hy,ru}.json` (`{}`) pour que le build tourne avant le premier scrape
- Create: `test/agenda-resumes-wiring.test.mjs`

**Interfaces:**
- Consumes: `summarizeAgenda`, `resumesFor`, `resumeLangs` (Tasks 2-3).
- Produces: `withResumeLangs(events, cache): events` (pur, `agenda-resumes.mjs`) ; dans `agenda.json`, chaque événement porte `resumeLangs: lang[]` (absent = `[]`) ; fichiers `src/data/agenda-resumes/<lang>.json` = `resumesFor(cache, lang)`.

- [ ] **Step 1: Write the failing tests**

```js
test('le job horaire commite le cache et les fichiers par langue', () => {
  const yml = readFileSync(new URL('../.github/workflows/hourly.yml', import.meta.url), 'utf8')
  const add = yml.split('\n').find((l) => /git add src\/data\/news\.json/.test(l))
  assert.match(add, /src\/data\/agenda-resumes\.json/)
  assert.match(add, /src\/data\/agenda-resumes(\s|$)/)
})
test('un fichier de résumés par langue existe', () => {
  for (const l of ALL_LANGS) assert.ok(existsSync(new URL(`../src/data/agenda-resumes/${l}.json`, import.meta.url)), l)
})
test('aucun composant n’importe le cache des résumés en statique', () => {
  for (const f of readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter((f) => /\.(jsx?|mjs)$/.test(f)))
    assert.doesNotMatch(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'), /from ['"][^'"]*agenda-resumes/, f)
})
```

Et dans `test/agenda-resumes.test.mjs`, le cas backfill (Review Focus 4) :

```js
test('resumeLangs se recalcule depuis le cache, pas depuis un événement hérité', () => {
  const ev = { url: 'a', resumeLangs: ['fr', 'de'] } // venu d'un instantané précédent
  const cache = { a: { hash: 'h', attempts: 1, en: 'y' } }
  assert.deepEqual(withResumeLangs([ev], cache)[0].resumeLangs, ['en'])
})
```

(`withResumeLangs(events, cache): events` — nouvelle fonction pure dans `agenda-resumes.mjs`, renvoie des copies avec `resumeLangs` recalculé.)

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Dans `scrape.mjs` : lire `agenda-resumes.json` (`readJson`, `{}` par défaut), `summarizeAgenda({ events: [...agenda.switzerland, ...agenda.world], cache })`, appliquer `withResumeLangs` à `agenda.switzerland` et `agenda.world`, écrire le cache et les six fichiers par langue (créer le dossier). Dans `hourly.yml`, ajouter `src/data/agenda-resumes.json src/data/agenda-resumes` à la ligne `git add`. Créer les fichiers vides. `withResumeLangs` dans `agenda-resumes.mjs`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS. Puis un scrape réel : `npm run scrape` (le script charge `.env` via `--env-file-if-exists`). Expected au log : `✓ résumé: … langues écrites {…}` avec au moins `fr` et `en` non nuls, et des fichiers par langue non vides. Relever le compte par langue pour le rapport final. **Ne pas commiter les JSON de données issus de ce scrape local** (le robot horaire les écrit) — sauf les fichiers vides créés au step 3 : faire `git checkout` des JSON de données modifiés par le scrape, puis réécrire `{}` dans les sept fichiers de résumés avant de commiter.
- [ ] **Step 5: Commit** — `git add scripts/scrape.mjs .github/workflows/hourly.yml src/data/agenda-resumes.json src/data/agenda-resumes scripts/lib/agenda-resumes.mjs test/` puis `git commit -m "agenda : résumés branchés au scrape horaire et commités par le job"`

### Task 5: Affichage dans la visionneuse

**Files:**
- Create: `src/agendaResumes.js`
- Modify: `src/components/Lightbox.jsx`
- Modify: `src/components/Agenda.jsx`
- Modify: `src/i18n.jsx` (six blocs)
- Modify: `src/styles/global.css` (bloc `.lb__…`, ~l. 3901-4160)
- Create: `test/agenda-resume-ui.test.mjs`

**Interfaces:**
- Consumes: `src/data/agenda-resumes/<lang>.json` (Task 4) ; `resumeLangs` sur les événements.
- Produces:
  - `loadResume(lang: string, url: string): Promise<string | null>` (`src/agendaResumes.js`) — `import.meta.glob('./data/agenda-resumes/*.json', { import: 'default' })` **non-eager**, mémoïse le module par langue ; `null` si absent ou en échec.
  - Item de Lightbox : champ optionnel `summary?: () => Promise<string | null>`. Sans lui, la visionneuse sociale est inchangée.
  - Clés i18n : `'lb.summary'` et `'lb.summaryNote'` :
    fr « Résumé » / « Résumé automatique » ; de « Zusammenfassung » / « Automatische Zusammenfassung » ; it « Riassunto » / « Riassunto automatico » ; en « Summary » / « Automatic summary » ; hy « Ամփոփում » / « Ավտոմատ ամփոփում » ; ru « Кратко » / « Автоматическое резюме ».

Comportement Lightbox : si `item.summary`, un `<button class="lb__sum-toggle" aria-expanded aria-controls>` « Résumé ▾/▴ » entre `.lb__cap` et `.lb__out` (option A). Premier dépli → appel de `item.summary()` ; le résultat est rangé **par index d'item** (un `Map` ou état clé = `cur`), et n'est affiché que pour l'item courant (Review Focus 5). Résultat `null` → la ligne disparaît pour cet item. Changer d'item replie. Déplié : `<div id class="lb__sum">` texte + `<small class="lb__sum-note">`. CSS : style utilitaire de `.section__more a` (mono, majuscules, abricot) ; chaque `font-family` suivie de son `font-size-adjust` (convention du fichier) ; `.lb__sum` en `max-height: 30vh; overflow: auto` sur mobile ; focus comme `.lb__out` ; ajouter `.lb__sum-toggle` au bloc `@media (pointer: coarse)` (min-height 44px) ; `.lb__sum-toggle span` sans transition sous `prefers-reduced-motion`. Sur mobile `.lb__meta` est en colonne centrée — le texte déplié est aligné à gauche.

Agenda : `summary: ev.resumeLangs?.includes(lang) ? () => loadResume(lang, ev.url) : undefined` dans `lbItems`.

- [ ] **Step 1: Write the failing test** (lecture des sources comme texte, comme `test/img-lazy.test.mjs`)

```js
test('les deux libellés du résumé existent dans les six langues', () => {
  const src = readFileSync(new URL('../src/i18n.jsx', import.meta.url), 'utf8')
  assert.equal(src.match(/'lb\.summary':/g)?.length, 6)
  assert.equal(src.match(/'lb\.summaryNote':/g)?.length, 6)
})
test('les résumés sont chargés à la demande, pas embarqués', () => {
  const src = readFileSync(new URL('../src/agendaResumes.js', import.meta.url), 'utf8')
  assert.match(src, /import\.meta\.glob\(/)
  assert.doesNotMatch(src, /eager:\s*true/)
})
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `agendaResumes.js`, Lightbox, Agenda, i18n, CSS.
- [ ] **Step 4: Run** `npm test`, `npm run lint` (exactement 5 avertissements), `npm run build`, `npm run check`, `npm run prerender`, `npm run hydration-check` — tous verts. Vérifier que les chunks par langue existent dans `dist/ch/assets/` et que `dist/ch/index.html` + son JS d'entrée ne contiennent aucun texte de résumé.
- [ ] **Step 5: Vérifier au navigateur** (skill `verifier-le-rendu`, Puppeteer `puppeteer-core` + `findChrome`, préversion des deux vitrines avec des fichiers de résumés réels du scrape local de Task 4 remis temporairement) : fr/de/it sur `dist/ch`, en/hy/ru sur `dist/org` ; 360, 390, 1400 px ; jour et nuit. Contrôles : la ligne « Résumé » n'apparaît que pour un événement qui a un résumé dans la langue ; dépli/repli ; ‹ › replie et n'affiche jamais le texte d'un autre événement (cliquer « Résumé » puis ‹ › immédiatement) ; la croix ne chevauche ni la légende ni le résumé ; aucun débordement horizontal ; aucun téléchargement de `agenda-resumes` avant le premier dépli (écouter les requêtes réseau) ; la visionneuse Instagram n'a pas de ligne « Résumé ». Remettre ensuite les fichiers de résumés à `{}`.
- [ ] **Step 6: Commit** — `git commit -m "agenda : résumé dépliable dans la visionneuse (six langues, chargé au premier dépli)"`

### Task 6: Documentation

**Files:**
- Modify: `CLAUDE.md` — un seul paragraphe dans « À savoir », en retirant un piège périmé si possible (règle de budget en tête du fichier) : le fichier `agenda-resumes` doit rester dans la ligne `git add` de `hourly.yml` ; le résumé est chargé à la demande et ne doit jamais être importé en statique ; signe de panne `✗ résumé` au log.
- Modify: `docs/superpowers/specs/2026-10-24-agenda-resume-design.md` — statut « mis en œuvre ».

- [ ] **Step 1:** Écrire le paragraphe et le statut. `npm test` vert.
- [ ] **Step 2: Commit** — `git commit -m "docs : résumés de l'agenda (piège du git add, chargement à la demande)"`

La mise en production (`git push origin main`) se fait **après** accord du propriétaire, en suivant la section 5 du skill `verifier-le-rendu` (fusionner, ne pas rebaser).
