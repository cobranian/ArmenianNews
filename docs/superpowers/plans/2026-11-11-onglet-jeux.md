# Onglet Jeux — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une vue « jeux » sur les deux vitrines (7 langues) qui ouvre en
plein écran les échecs et le backgammon de lokolok, à l'identique, puis leur
mode ami sur une base Firebase propre à Arménie Info.

**Architecture :** les jeux sont copiés tels quels sous `public/play/` par un
script local (`npm run jeux:sync`) qui n'applique que quatre transformations
testées. La vue « jeux » est une vue React de plus, câblée comme `about`. Le
mode ami réutilise la couche de salles de lokolok, copiée sous
`public/play/net/` avec un `config.js` à nous.

**Tech Stack :** Vite + React 18, Node 22 (`node --test`), Firebase Hosting et
Realtime Database (SDK gstatic 12.3.0), émulateur Firebase (Java 21) pour les
règles.

**Spec :** `docs/superpowers/specs/2026-11-11-onglet-jeux-design.md` (à lire
en entier avant toute tâche ; CLAUDE.md aussi).

## Global Constraints

- Branche `onglet-jeux`, travail dans un worktree (habitude du dépôt : un
  checkpoint par tâche, fusionner plutôt que rebaser).
- **Deux PR** : le premier temps (tâches 1 à 7) part sans rien attendre de
  Nareg ; le second temps (tâches 8 à 10) attend ses étapes Firebase.
- Slugs de la vue : `fr jeux/`, `de spiele/`, `it giochi/`, `en games/`,
  `es juegos/`, `hy games/`, `ru games/`.
- Les jeux ne sont **pas retouchés** visuellement. Seules les 4
  transformations de la tâche 4 touchent la copie.
- Aucun fichier de `public/play/` dans le bundle React ; aucun import depuis
  `src/`.
- Les deux blocs `headers` **et** les deux blocs `redirects` de
  `firebase.json` changent toujours ensemble.
- Aucun fait sans source `https://` ; un fait non confirmé ou contredit est
  omis.
- `npm run lint` : toujours **0 erreur, 5 avertissements**.
- Le français porte tous ses accents ; `t()` retombe en silence sur le
  français, donc chaque clé existe dans les 7 blocs.
- Le CLAUDE.md est un budget : on n'y ajoute qu'un piège silencieux et payé, et
  l'on en retire un périmé si possible.

## Review Focus

1. **Lien d'invitation ouvert sur l'autre vitrine ou sans `?lang`** : le jeu
   doit s'ouvrir, dans la langue du navigateur, et son bouton de retour doit
   mener à une vue Jeux qui existe, jamais à un 404. → tâche 4, test
   `retourCible`.
2. **Langue du jeu hors des 7 du site** (pt, zh… choisie par le navigateur) :
   le retour mène à la langue de tête de la vitrine servie. → tâche 4.
3. **Téléphone en paysage, 360 × 640 et 640 × 360** : le bouton de retour ne
   masque aucune commande, ni le menu, ni les pendules, ni les dés. →
   tâche 4, vérification de rendu.
4. **Mode ami cliqué avant les clés (premier temps)** : un message clair, et
   aucun téléchargement de gstatic qui échoue en boucle. → tâche 7,
   vérification manuelle.
5. **Resynchronisation après une mise à jour de `Games/`** : les 4
   transformations s'appliquent encore. Si un motif attendu a disparu, le
   script **échoue bruyamment** au lieu de copier une version cassée. →
   tâche 4, test `transformer` « motif absent ».

---

## Premier temps — PR 1

### Task 1 : la vue « jeux », câblée de bout en bout

**Files :**
- Modify : `sites.config.js` (`VIEWS`), `src/seo.js` (`VIEW_SEO.games`),
  `src/i18n.jsx` (`nav.games`, 7 blocs), `src/components/Nav.jsx`,
  `src/App.jsx`, `scripts/lib/agenda-guard.mjs` (`SANS_AGENDA`),
  `src/components/Footer.jsx`, `scripts/lib/not-found.mjs`, `firebase.json`
  (`redirects`, deux blocs)
- Create : `src/components/GamesPage.jsx` (squelette : un `<main>` avec
  `<h1>`, rempli à la tâche 3)
- Test : `test/games-view.test.mjs`

**Interfaces :**
- Produces : la clé de vue `'games'`. `urlFor(lang, 'games')`,
  `pathFor(lang, 'games')` et `viewFromPath(siteId, path) === 'games'`
  fonctionnent. `VIEW_SEO.games[lang] = { title, description }`.

- [ ] **Step 1 : écrire `test/games-view.test.mjs`** sur le modèle de
  `test/about.test.mjs` :
  - `VIEWS.games.slugs` vaut exactement la table des Global Constraints ;
  - `urlFor('fr','games') === 'https://armenieinfo.ch/jeux/'` ;
  - `urlFor('hy','games') === 'https://armenianews.org/hy/games/'` ;
  - `viewFromPath('ch','/de/spiele')` et `viewFromPath('org','/es/juegos/')`
    rendent `'games'` ;
  - `VIEW_SEO.games` existe pour chaque `BLOC_LANGS`, avec une description
    de 160 caractères au plus ;
  - `headFor` a son canonical et ses 7 `hreflang` vers
    `urlFor(l,'games')` ;
  - `agendaGuardChecks('games', '{"@type":"Event"}', …)` échoue ;
  - `'nav.games':` apparaît `BLOC_LANGS.length` fois ;
  - `App.jsx` matche `/view === 'games' \? \(\s*<GamesPage \/>/` ;
  - `Footer.jsx` contient `pathFor(lang, 'games')` ;
  - `Nav.jsx` contient `pathFor(lang, 'games')` ;
  - `notFoundHtml(site)` lie la vue games de chaque langue ;
  - `firebase.json` : le bloc .ch redirige `^/games/?$` vers `/jeux/`,
    `^/de/games/?$` vers `/de/spiele/` et `^/it/games/?$` vers `/it/giochi/` ;
    le bloc .org redirige `^/jeux/?$` vers `/games/` et
    `^/es/(?:games|jeux)/?$` vers `/es/juegos/`.
- [ ] **Step 2 :** `node --test test/games-view.test.mjs`. Attendu : FAIL
  (`games` absent).
- [ ] **Step 3 : implémenter les dix endroits.** Les titres SEO sont en
  langage simple, par exemple fr « Échecs et backgammon en ligne ». Dans la
  Nav, le lien Jeux se place **après** Agenda et pointe toujours vers
  `pathFor(lang, 'games')`, y compris sur l'accueil : il n'y a pas d'ancre.
  Le lien Jeux de la 404 et du pied de page prend `VIEW_SEO.games[lang].title`.
- [ ] **Step 4 :** `npm test` est entièrement vert, et `npm run lint` donne
  0 erreur et 5 avertissements.
- [ ] **Step 5 :** `npm run build && npm run check`. Attendu : PASS, avec
  35 pages comptées (7 × 5).
- [ ] **Step 6 : commit** « Jeux : la vue games câblée (slugs, SEO, nav, 404,
  redirections) ».

### Task 2 : les textes arméniens, sourcés, en 7 langues

**Files :**
- Create : `src/games.js` (module plat, sans JSX)
- Test : `test/games-texts.test.mjs`

**Interfaces :**
- Produces :
  `GAMES = [{ id: 'echecs'|'backgammon', path: '/play/echecs/'|'/play/backgammon/', facts: [{ id, sources: string[] }], text: { [lang]: { title, intro: string[], rules: string[] } } }]`.
  `intro` contient des paragraphes, et chacun cite les faits qu'il affirme par
  `{fait:<id>}` en commentaire de données, **pas** dans le texte affiché :
  utiliser un champ `factsUsed: string[]` par paragraphe si c'est plus simple.
  L'ordre de `GAMES` donne l'ordre d'affichage : échecs, puis backgammon.

- [ ] **Step 1 : recherche.** Vérifier chacun de ces faits sur au moins une
  source `https://` : Wikipédia dans une langue, une fédération ou un média.
  - échecs obligatoires à l'école en Arménie depuis 2011 ;
  - Olympiades d'échecs gagnées en 2006, 2008 et 2012 ;
  - Tigran Petrossian, champion du monde de 1963 à 1969 ;
  - « nardi » comme nom du backgammon en Arménie ;
  - le nardi joué dans les cours et les parcs d'Erevan.

  Un fait introuvable, ou sur lequel deux sources se contredisent, est **omis**
  et noté dans le message de commit. Le backgammon de lokolok est le
  backgammon occidental : le texte peut dire qu'en Arménie on joue aussi le
  long nardi, **sans** laisser croire que c'est celui-là.
- [ ] **Step 2 : écrire `test/games-texts.test.mjs`.**
  - chaque fait a au moins une source qui matche `/^https:\/\//` ;
  - chaque `factsUsed` désigne un fait déclaré ;
  - chaque jeu a `text[l]` pour chacune des 7 langues de `ALL_LANGS`, avec un
    `title` non vide, au moins un paragraphe d'`intro` et au moins 3 `rules` ;
  - le nombre de paragraphes et de règles est le même dans toutes les langues
    d'un jeu, pour qu'une traduction ne perde pas une phrase ;
  - `text.hy` a moins de 10 % de lettres latines hors noms propres (même
    esprit que `translationScriptProblem`), et `text.ru` aussi.
- [ ] **Step 3 :** lancer le test. Attendu : FAIL (module absent).
- [ ] **Step 4 : rédiger le français**, sobre : un intro de 2 ou 3 paragraphes
  courts, puis 4 à 6 règles essentielles en une phrase chacune. Traduire
  ensuite en de, it, en, es, hy et ru. Pas de nombre de langues ou de jeux
  écrit en toutes lettres.
- [ ] **Step 5 :** le test passe, puis `npm test` est entièrement vert.
- [ ] **Step 6 : commit** « Jeux : textes sourcés en 7 langues », avec la liste
  des sources et des faits omis.

### Task 3 : `GamesPage`, la page de l'onglet

**Files :**
- Modify : `src/components/GamesPage.jsx`, `src/styles/global.css`,
  `src/i18n.jsx` (`games.play`, `games.rules`, 7 blocs)
- Create : `public/play/vignettes/echecs.png` et
  `public/play/vignettes/backgammon.png`, copiés depuis
  `../lokolok/assets/vignettes/`
- Test : ajouter à `test/games-view.test.mjs`

**Interfaces :**
- Consumes : `GAMES` (tâche 2), `useI18n()`.
- Produces : un lien « Jouer » par jeu, de la forme
  `href={`${g.path}?lang=${lang}`}`, qui appelle au clic
  `window.gtag?.('event', 'jeu_ouvert', { jeu: g.id })`.

- [ ] **Step 1 : test.** `GamesPage.jsx` importe `GAMES` depuis `../games.js`,
  contient `?lang=${lang}` et `'jeu_ouvert'`, et n'importe **rien** de
  `public/play`. Les clés `games.play` et `games.rules` existent dans les 7
  blocs.
- [ ] **Step 2 :** le test échoue (FAIL).
- [ ] **Step 3 : implémenter.** Le style est celui du site (Apricot Press,
  jour et nuit). Pour chaque jeu :
  - la vignette en `<img>` 640 × 400, avec `width` et `height` posés ;
  - le titre, l'intro et le bouton « Jouer » ;
  - les règles dans un `<details>`, titré `games.rules`.

  Lire d'abord le skill `verifier-le-rendu` et `pieges-rendu.md` : convention
  `font-family` + `font-size-adjust`, cible tactile de 44 px sous
  `pointer: coarse`, pas de `loading="lazy"` avant `src`. Rien ne dépend de
  l'heure ni de l'écran au rendu, sinon l'hydratation diverge.
- [ ] **Step 4 :** `npm test`, lint (5 avertissements),
  `npm run build && npm run check && npm run prerender && npm run hydration-check`.
  Attendu : tout PASS, et 0 écart d'hydratation sur les 35 pages.
- [ ] **Step 5 : vérifier le rendu**, selon le skill `verifier-le-rendu` :
  - à 360 px et sur ordinateur ;
  - de jour et de nuit ;
  - en fr, hy et ru.

  Capturer les écrans avec Puppeteer, pas avec `resize_window`.
- [ ] **Step 6 : commit** « Jeux : la page de l'onglet ».

### Task 4 : `jeux:sync`, la copie des jeux et le bouton de retour

**Files :**
- Create :
  - `scripts/jeux-sync.mjs` (entrées et sorties disque) ;
  - `scripts/lib/jeux-sync.mjs` (fonctions pures) ;
  - `public/play/retour.js` (généré) ;
  - `public/play/net/config.js` (écrit à la main, **jamais** écrasé par le
    sync) ;
  - `public/play/echecs/**`, `public/play/backgammon/**` et
    `public/play/net/{salle,salle2,protocole,journal,messages,qrcode}.js`
    (générés).
- Modify : `package.json` (`"jeux:sync": "node scripts/jeux-sync.mjs"`),
  `eslint.config.js` (ignorer `public/play/**`, du code tiers comme `.cache/`)
- Test : `test/jeux-sync.test.mjs`

**Interfaces :**
- Produces (dans `scripts/lib/jeux-sync.mjs`) :
  - `EXCLUS: RegExp[]`, la liste de `lokolok/sync-games.js` recopiée ;
  - `transformer(chemin: string, texte: string): string`, qui applique sur un
    fichier `.html` ou `.js` les transformations ci-dessous et **lève une
    erreur** si un motif attendu est absent du fichier qui doit le porter ;
  - `retourTable(): { [lang]: { host: string, path: string } }`, tiré de
    `SITES` et `pathFor(lang, 'games')` ;
  - `retourCible(table, { lang, hostname }): string`, qui rend une URL de
    retour.

**Les 4 transformations** (et rien d'autre) :
1. Dans tout `.js` et `.html` : `/assets/net/` devient `/play/net/`.
   Obligatoire dans `main.js` de chaque jeu et dans `salle.js`.
2. Dans chaque `index.html` : la balise
   `<script src="/assets/stats.js"></script>` est retirée (obligatoire).
3. Dans `echecs/index.html` : `<script>LokoI18n.appliquer();</script>`
   devient `<script src="js/appliquer.js"></script>`, et le sync écrit
   `js/appliquer.js` avec `LokoI18n.appliquer();`. La position est gardée : la
   ligne doit s'exécuter au même endroit du document.
4. Dans chaque `index.html`, juste avant `</body>` :
   `<script src="/play/retour.js" defer></script>`.

**Règles de `retourCible`**, dans l'ordre :
- la langue est celle du jeu si elle est l'une des 7, sinon la langue de tête
  de la vitrine (`ch` → fr, `org` → en) ;
- si l'hôte est `localhost` ou `127.0.0.1`, le retour est un **chemin**
  (préversion) ;
- si l'hôte est celui de la vitrine de cette langue, c'est aussi un chemin ;
- sinon, c'est une **URL absolue** vers la vitrine de cette langue : un `fr`
  ouvert sur armenianews.org renvoie vers armenieinfo.ch/jeux/.

`retour.js` embarque la table et une copie de `retourCible`, écrites par le
sync. Il lit `document.documentElement.lang` après le chargement, car le jeu
le pose. Il crée un `<a>` fixe dans le coin haut-gauche, en respectant
`env(safe-area-inset-*)`. Le lien fait 44 px de cible tactile, et c'est une
flèche avec un `aria-label` traduit (« Retour à Arménie Info » et ses
équivalents, dans la table). Il est placé en `textContent`, jamais en
`innerHTML`, et ses styles sont posés en `style` depuis le JS.

- [ ] **Step 1 : écrire `test/jeux-sync.test.mjs`.**
  - `transformer` sur un `index.html` d'échecs factice : plus de
    `/assets/stats.js`, plus de `<script>` en ligne, `js/appliquer.js` est
    référencé, et `/play/retour.js` est juste avant `</body>` ;
  - `transformer` sur un `main.js` qui ne contient pas `/assets/net/` lève une
    erreur (motif absent) ;
  - `retourCible` :
    - `{lang:'fr', hostname:'armenieinfo.ch'}` donne `'/jeux/'` ;
    - `{lang:'fr', hostname:'armenianews.org'}` donne
      `'https://armenieinfo.ch/jeux/'` ;
    - `{lang:'pt', hostname:'armenianews.org'}` donne `'/games/'` ;
    - `{lang:'hy', hostname:'localhost'}` donne `'/hy/games/'` ;
  - `retourTable()` égale la table embarquée dans `public/play/retour.js`
    (garde la dérive après un changement de `sites.config.js`) ;
  - sur les **fichiers réels** de `public/play/` :
    - aucun ne contient `/assets/net/` ni `/assets/stats.js` ;
    - chaque `index.html` de jeu contient `/play/retour.js` et aucun
      `<script>` sans `src` ;
  - `public/play/net/config.js` ne contient pas `lokolok-com` et contient
    `projectId: 'armenie-info'` ;
  - aucun fichier de `src/` ne contient `public/play` ni `/play/net`.
- [ ] **Step 2 :** le test échoue (FAIL).
- [ ] **Step 3 : implémenter** la bibliothèque et le script.
  - Le script lit `../Games/Chess` → `public/play/echecs/`,
    `../Games/Backgammon` → `public/play/backgammon/` et
    `../lokolok/assets/net/` → `public/play/net/` (sauf `config.js` et
    `classement.js`).
  - Il vide chaque dossier cible avant d'y copier, **sauf** `net/config.js`.
  - Il refuse de tourner en CI (`process.env.CI`) avec un message clair.
- [ ] **Step 4 : écrire `public/play/net/config.js`** dans le format de
  `lokolok/assets/net/config.js`, avec :
  - `apiKey: ''` et `appId: ''` ;
  - `authDomain: 'armenie-info.firebaseapp.com'` ;
  - `databaseURL: ''` ;
  - `projectId: 'armenie-info'`.

  Un commentaire renvoie au README.
- [ ] **Step 5 :** `npm run jeux:sync`, puis `npm test`. Attendu : tout PASS.
  `git status` montre les copies.
- [ ] **Step 6 : vérifier dans un vrai Chrome** (`npm run build &&
  npm run preview`, puis `/play/echecs/?lang=hy` et `/play/backgammon/?lang=ru`) :
  - une partie contre le robot dans chaque jeu ;
  - un rechargement, et la partie revient ;
  - l'interface est traduite : c'est la preuve que `appliquer.js` tourne ;
  - le bouton de retour ramène à `/hy/games/` ;
  - à 360 × 640 et à 640 × 360, le bouton ne couvre aucune commande.
- [ ] **Step 7 : commit** « Jeux : copie des jeux par jeux:sync, bouton de
  retour ». Le message rappelle le commit de `Games/` copié
  (`git -C ../Games log -1 --format=%h`).

### Task 5 : `firebase.json`, la CSP et les en-têtes de `/play/**`

**Files :**
- Modify : `firebase.json` (les deux blocs `headers`)
- Test : `test/jeux-firebase.test.mjs`

- [ ] **Step 1 : test.** Pour chacun des deux blocs :
  - la CSP de `source: "**"` contient, dans `script-src`,
    `https://www.gstatic.com` ;
  - dans `connect-src`, elle contient `https://*.firebasedatabase.app`,
    `wss://*.firebasedatabase.app`, `https://identitytoolkit.googleapis.com` et
    `https://securetoken.googleapis.com` ;
  - un en-tête `source: "play/**"` porte `Cache-Control: no-cache` et
    `X-Robots-Tag: noindex` ;
  - les deux CSP sont identiques entre elles.
- [ ] **Step 2 :** FAIL, puis implémenter, puis PASS.
- [ ] **Step 3 :** dans la préversion du navigateur, les workers des deux
  robots se chargent sans erreur CSP en console. sirv ne sert pas la CSP :
  il faut injecter l'en-tête, avec un petit serveur local qui lit
  `firebase.json`, ou en servant `dist/ch` par `firebase emulators:start
  --only hosting`. Choisir l'une des deux façons, et l'écrire dans le commit.
- [ ] **Step 4 : commit** « Jeux : CSP Firebase et en-têtes de /play/** ».

### Task 6 : confidentialité, README et CLAUDE.md

**Files :**
- Modify : `src/i18n.jsx` (`privacy.storage.body`, plus `privacy.games.title`
  et `privacy.games.body`, dans les 7 blocs), le composant qui rend la
  politique (le trouver avec `grep -rn "privacy.storage" src/components`),
  `README.md`, `CLAUDE.md`
- Test : ajouter à `test/games-view.test.mjs`

- [ ] **Step 1 : test.** Les deux nouvelles clés existent dans les 7 blocs, et
  `privacy.games.body` contient `Firebase` dans chacun.
- [ ] **Step 2 : lire le comportement réel** avant d'écrire. Dans
  `public/play/net/salle.js`, `salle2.js` et `../lokolok/database.rules.json` :
  une salle de plus de 24 h est-elle **effacée**, ou seulement **écrasable** ?
  Écrire uniquement ce qui est vrai, d'après la section « Politique de
  confidentialité » de la spec.
- [ ] **Step 3 : rédiger**, d'abord en français, puis dans les 6 autres
  langues. Le composant rend la nouvelle section après « Conservé sur votre
  appareil ».
- [ ] **Step 4 : README**, nouvelle section « Jeux » :
  - `npm run jeux:sync` et quand le lancer ;
  - les 4 transformations ;
  - les 5 étapes Firebase de Nareg, d'après la spec.
- [ ] **Step 5 : CLAUDE.md**, une entrée courte dans « À savoir » : `/play/**`
  est une copie de `Games/`, refaite par `jeux:sync` et jamais éditée à la
  main ; `config.js` vise `armenie-info` et pas lokolok. La commande s'ajoute
  aussi à la liste des commandes. Chercher un piège périmé à retirer.
- [ ] **Step 6 :** `npm test`, lint, build, check. Attendu : PASS.
- [ ] **Step 7 : commit** « Jeux : confidentialité (Firebase), README,
  CLAUDE.md ».

### Task 7 : vérification du premier temps et PR 1

- [ ] **Step 1 :** depuis la racine du worktree, `npm test && npm run lint &&
  npm run build && npm run check && npm run prerender &&
  npm run hydration-check`. Attendu : tout PASS, 5 avertissements, 35 pages et
  0 écart d'hydratation.
- [ ] **Step 2 : mode ami sans clés.** Cliquer sur le mode ami dans chaque jeu.
  Attendu : le message de `salle.js` sur la configuration manquante. Aucune
  requête vers gstatic en boucle dans l'onglet Réseau.
- [ ] **Step 3 :** relire la Review Focus. Chaque ligne du premier temps a sa
  preuve, test ou capture.
- [ ] **Step 4 :** fusionner `main` dans la branche (le robot horaire a
  avancé), relancer `npm test`, puis pousser et ouvrir la PR 1 avec
  `gh pr create`. La PR est fusionnée par Nareg.
- [ ] **Step 5 : après le déploiement**, sonder la production :
  - `curl -sI https://armenieinfo.ch/jeux/` donne 200 ;
  - `curl -sI https://armenianews.org/hy/games/` donne 200 ;
  - `curl -sI https://armenieinfo.ch/play/echecs/` porte `x-robots-tag:
    noindex` et un `cache-control` acceptable (voir la note ci-dessous) ;
  - `curl -sI https://armenieinfo.ch/play/net/config.js` et
    `curl -sI https://armenieinfo.ch/play/echecs/js/main.js` portent
    `cache-control: no-cache` ;
  - `curl -sI https://armenianews.org/play/backgammon/` : mêmes en-têtes que
    sur le .ch (`x-robots-tag: noindex`, `cache-control`, CSP) ;
  - `curl -sI https://armenieinfo.ch/play/echecs/ | grep -i
    content-security-policy` contient `https://www.gstatic.com` ;
  - `curl -sI https://armenieinfo.ch/games` donne un 301 vers `/jeux/`.

  Note : pour une URL de répertoire ou en `.html`, `cache-control: no-cache`
  **ou** `max-age=0, s-maxage=3600` sont acceptables — la priorité entre deux
  règles d'en-têtes Firebase qui se recouvrent n'est pas documentée, et le CDN
  est purgé à chaque déploiement. La sonde permanente de `hourly.yml` ne lit
  que le code et le `Location` : elle ne contrôle pas ces en-têtes.

---

## Second temps — PR 2 (après les étapes Firebase de Nareg)

### Task 8 : les règles de la base et leurs tests

**Files :**
- Create : `database.rules.json`, `test/regles/` (copie réduite de
  `../lokolok/tests/regles/` : `outils.js`, `sdk/`, `v2.test.js`,
  `v2-sdk.test.js` et `verifs.test.js`), les fichiers adaptés à
  `echecs` et `backgammon`
- Modify : `firebase.json` (clé `"database": { "rules": "database.rules.json" }`),
  `package.json` (`"test:regles"`)

- [ ] **Step 1 :** copier les règles de lokolok et restreindre `$jeu` à
  `echecs|backgammon` (`.validate` : `$jeu.matches(/^(echecs|backgammon)$/)`),
  sans retirer aucune autre garde.
- [ ] **Step 2 :** adapter les tests recopiés. Un test vérifie qu'une salle
  `minigolf` est refusée.
- [ ] **Step 3 :** `npx --yes firebase-tools@15.34.2 emulators:exec --only
  database --project demo-armenie-info "node --test --test-concurrency=1
  test/regles/*.test.js"`. Attendu : PASS. Sans émulateur, ces tests sont
  sautés. `npm test` ne les lance pas : ils vivent hors de `test/*.mjs`.
- [ ] **Step 4 : commit** « Jeux : règles RTDB (échecs, backgammon) et leurs
  tests ».

### Task 8b : les salles s'effacent d'elles-mêmes (décidé par Nareg, 11 nov.)

Nareg a décidé que les salles doivent s'effacer seules. Le compte de service
de la CI reçoit pour cela le rôle « Firebase Realtime Database Admin » sur
`armenie-info`, ajouté par Nareg lui-même.

**Files :**
- Create : `scripts/salles-purge.mjs` (entrées et sorties réseau) et
  `scripts/lib/salles-purge.mjs` (fonctions pures)
- Modify :
  - `database.rules.json` : `".indexOn": ["creeLe"]` sous `salles/$jeu` ;
  - `.github/workflows/hourly.yml` : une étape après le déploiement, en
    `continue-on-error`, avec un `✗ purge` au log en cas d'échec ;
  - `scripts/lib/health.mjs` si `[sources-down]` peut lire ce `✗` sans
    nouvelle machinerie ;
  - `src/i18n.jsx` (`privacy.games.body` et `privacy.rights.body`, 7 blocs) ;
  - `README.md`.
- Test : `test/salles-purge.test.mjs`

**Interfaces :**
- `sallesPerimees(salles, maintenant)` : rend les codes dont `creeLe` a plus
  de 24 h, ou dont `creeLe` manque. Le seuil est `PEREMPTION_MS`, la même
  valeur que `protocole.js`, 86 400 000 ms. Il faut l'importer ou le
  recopier, avec un test qui compare la valeur à celle de
  `public/play/net/protocole.js`.
- Le script s'authentifie avec le compte de service déjà présent en CI
  (`FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO`), en OAuth2 avec les portées
  `userinfo.email` et `firebase.database`. Il lit, pour chaque jeu
  (`echecs`, `backgammon`),
  `salles/<jeu>.json?orderBy="creeLe"&endAt=<maintenant-24h>`, puis efface
  chaque salle par un PATCH à `null`.
- La lecture via `orderBy` ne voit pas une salle sans `creeLe`. Le script fait
  donc aussi une lecture `shallow=true`, puis lit `creeLe` salle par salle,
  **seulement** pour les codes absents du premier lot.
- Pas de nouvelle dépendance npm. Si `google-auth-library` n'est pas déjà
  dans `node_modules`, signer le JWT avec `node:crypto`.

- [ ] **Step 1 : tests** de `sallesPerimees`, sur ces cas : une salle de
  23 h 59 gardée, une de 24 h 01 effacée, une sans `creeLe` effacée, une
  entrée qui n'est pas un objet ignorée.
- [ ] **Step 2 :** implémenter. Le script affiche `purge : N salle(s)
  effacée(s)` et ne fait jamais échouer le job : un échec du nettoyage ne
  doit pas retenir le déploiement.
- [ ] **Step 3 : confidentialité.** Les salles sont effacées automatiquement
  dans l'heure qui suit leurs 24 h, en 7 langues. Le texte doit rester vrai :
  il dit « au plus tard environ 25 h après sa création ». Le README décrit la
  purge et le rôle IAM qu'elle exige.
- [ ] **Step 4 : commit** « Jeux : purge horaire des salles de plus de
  24 h ».

### Task 9 : configuration Firebase (faite le 11 nov. par Claude, sauf l'IAM)

État : la base `armenie-info-default-rtdb` est créée en europe-west1, en mode
verrouillé. La connexion anonyme est activée, avec le nettoyage automatique
des comptes anonymes de plus de 30 jours. L'application Web existe déjà
(`1:95859451112:web:9ffab14950fb89f0a3955d`) ; sa configuration se lit par
`firebase apps:sdkconfig web <appId> --project armenie-info`.

- [ ] **Step 1 :** remplir `public/play/net/config.js` avec `apiKey`, `appId`
  et `databaseURL`, lus par `apps:sdkconfig`. Ces valeurs sont publiques ; ne
  pas les répéter dans le chat. Ajouter au test de la tâche 4 : `databaseURL`
  matche
  `^https://armenie-info-default-rtdb\.europe-west1\.firebasedatabase\.app$`.
- [ ] **Step 2 :** déployer les règles depuis le poste, avec le CLI connecté :
  `npx --yes firebase-tools@15.34.2 deploy --only database --project
  armenie-info`.
- [ ] **Step 3 : commit** « Jeux : configuration Firebase d'Arménie Info ».

### Task 10 : mode ami de bout en bout, puis PR 2

- [ ] **Step 1 :** servir `dist/ch` avec la CSP réelle, comme à la tâche 5.
  Ouvrir deux navigateurs, ou un profil normal et un profil privé, pour avoir
  deux uid anonymes.
- [ ] **Step 2 : échecs.** Créer une salle avec une pendule de 3 min, la
  rejoindre par le lien, jouer 3 coups de chaque côté. Recharger l'invité :
  l'état et les pendules reviennent. Proposer une nulle, la refuser. Puis
  abandonner, et lancer une revanche : les couleurs sont inversées.
- [ ] **Step 3 : backgammon.** Créer un match en 3 points avec videau,
  rejoindre, lancer, jouer, doubler et accepter. Recharger l'hôte : l'état
  revient.
- [ ] **Step 4 : vérifier la base.** Dans la console Firebase du projet
  `armenie-info`, les salles `salles/echecs/<code>` et
  `salles/backgammon/<code>` existent. Dans le réseau, les requêtes vont vers
  `armenie-info-default-rtdb`, et **aucune** vers `lokolok-com`.
- [ ] **Step 5 :** fusionner `main`, puis `npm test`, lint, build et check.
  Pousser, ouvrir la PR 2, la faire fusionner par Nareg.
- [ ] **Step 6 :** en production, refaire l'étape 2 en abrégé, avec une salle
  créée sur armenieinfo.ch et rejointe sur le lien partagé depuis un
  téléphone.
