# Flux RSS et newsletter hebdomadaire — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** six flux RSS (un par langue) générés au build, et une newsletter hebdomadaire par vitrine (fr pour le .ch, en pour le .org) composée depuis les brèves, Culture et l'agenda, envoyée par Buttondown.

**Architecture:** deux modules purs dans `scripts/lib/` (`feed.mjs` pour le XML, `newsletter.mjs` pour le numéro), appelés par `scripts/build-sites.mjs` (flux) et par un nouveau script `scripts/newsletter-send.mjs` (envoi), lancé par un workflow hebdomadaire. Le pied de page React reçoit un lien RSS et un formulaire HTML qui poste chez Buttondown.

**Tech Stack:** Node 24 (ESM, `node:test`), Vite + React 18 (hydraté), GitHub Actions, API REST Buttondown.

**Spec:** `docs/superpowers/specs/2026-10-30-rss-newsletter-design.md`

## Global Constraints

- Travailler dans un worktree isolé (`superpowers:using-git-worktrees`), un commit par tâche (mémoire « rollback par points de retour »).
- `npm test`, `npm run lint` (0 erreur, **5** avertissements, pas un de plus), `npm run build` puis `npm run check` passent à la fin de chaque tâche qui touche le build.
- Aucune URL écrite à la main hors des tests : tout dérive de `sites.config.js`.
- Aucune date de génération prise sur `new Date()` dans le XML : seules les dates des contenus.
- Toute nouvelle clé `t()` existe dans les **six** blocs `STRINGS` de `src/i18n.jsx` (sinon repli muet sur le français, ou la clé brute).
- Toute modification de CSP est faite dans les **deux** blocs `headers` de `firebase.json`.
- Le User-Agent des appels sortants ne dit jamais « Chrome » (`scripts/lib/http.mjs`).
- Pas de nouvelle dépendance npm : le XML s'écrit à la main, l'API s'appelle avec `fetch`.

## Review Focus

1. **Un titre ou un résumé contenant `&`, `<`, `"`** (fréquent : « Arménie & diaspora », guillemets français) doit produire un XML valide. → test `feed échappe & < > " '` (Tâche 1).
2. **Une langue sans aucune brève ni article** (de/it un jour creux) doit produire un flux valide à zéro élément, sans `lastBuildDate` vide. → test `flux vide valide` (Tâche 1).
3. **Le workflow relancé deux fois la même semaine** ne doit rien renvoyer. → test `semaine déjà envoyée = rien` (Tâche 5).
4. **Le lien RSS ajouté au `<head>`** ne doit pas faire échouer le contrôle « 7 alternate exactement » de `check-build.mjs` ni être pris pour un hreflang. → test `head : un seul lien RSS, hreflang intacts` (Tâche 2).
5. **Une semaine sans contenu** ne doit pas envoyer un numéro vide. → test `semaine vide = null` (Tâche 4).

---

### Task 1: Le flux RSS par langue

**Files:**
- Modify: `sites.config.js` (après `cultureUrl`/`culturePath`, ~l. 342)
- Create: `scripts/lib/feed.mjs`
- Modify: `scripts/build-sites.mjs` (`writeSeoFiles`, ~l. 196)
- Modify: `scripts/check-build.mjs` (nouveau bloc de contrôle des flux)
- Test: `test/feed.test.mjs`

**Interfaces:**
- Consumes: `loadBriefs` (→ `{ [lang]: Brief[] }`, plus récente d'abord, `Brief = { date, generatedAt, intro, topics[] }`), `loadCulture` (→ `Article[]`, `Article = { slug, date: 'AAAA-MM-JJ', langs: { [lang]: { title, description } } }`), `briefUrl`, `cultureUrl`, `langPath`, `siteOf`, `SITES` ; `BRIEF_STRINGS[lang].title`, `SEO[lang].tagline`, `SEO[lang].description`.
- Produces: `feedUrl(lang): string` et `feedPath(lang): string` dans `sites.config.js` ; `feedFor(lang, { briefs, culture }): string` (XML) et `feedItems(lang, { briefs, culture }): Item[]` avec `Item = { title, url, description, pubDate: Date }` dans `scripts/lib/feed.mjs` ; constante `FEED_MAX = 30`.

- [ ] **Step 1: Écrire les tests qui échouent** dans `test/feed.test.mjs` :
  - `feedUrl : un flux par langue, sous la page de la langue` — `feedUrl('fr') === 'https://armenieinfo.ch/feed.xml'`, `feedUrl('de') === 'https://armenieinfo.ch/de/feed.xml'`, `feedUrl('en') === 'https://armenianews.org/feed.xml'`, `feedUrl('hy') === 'https://armenianews.org/hy/feed.xml'` ; `feedPath('ru') === '/ru/feed.xml'`.
  - `feedItems mêle brèves et Culture, plus récent d'abord, plafonné à FEED_MAX` — 40 brèves fr + 2 articles → 30 éléments, triés par `pubDate` décroissante ; une brève a `url === briefUrl('fr', date)`, `description === intro`, `pubDate` = `generatedAt` ; un article a `url === cultureUrl('fr', slug)`, `pubDate` = `${date}T00:00:00Z`.
  - `feedItems ignore un article absent dans la langue` — article sans `langs.de` → absent du flux de.
  - `feed échappe & < > " '` — titre `Arménie & « diaspora » <b>` → le XML contient `&amp;` et `&lt;b&gt;`, pas `<b>`.
  - `flux vide valide` — aucune donnée → XML qui contient `<channel>` et `</rss>`, 0 `<item>`, aucune balise `<lastBuildDate>`.
  - `lastBuildDate = élément le plus récent` — égal à `pubDate.toUTCString()` du premier élément.
  - `en-tête du canal` — contient `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`, `<language>fr</language>`, `<atom:link href="${feedUrl('fr')}" rel="self" type="application/rss+xml"/>`, `<link>` = page de la langue, `<title>` = `${SITES.ch.brand} — ${SEO.fr.tagline}`.
  - Chaque `<item>` porte `<guid isPermaLink="true">` égal à son `<link>`.

- [ ] **Step 2: Lancer** `node --test test/feed.test.mjs` — attendu : FAIL (`feedUrl` / module introuvable).

- [ ] **Step 3: Implémenter** `feedUrl` / `feedPath` dans `sites.config.js` (`SITES[siteOf(lang)].host + langPath(siteOf(lang), lang) + 'feed.xml'`, chemin = URL moins l'hôte, comme `agendaCountryPath`), puis `feedItems` et `feedFor` dans `scripts/lib/feed.mjs`. Titre d'une brève : `${BRIEF_STRINGS[lang].title} — ${date}` (même forme que `llms.mjs`). Une fonction `xml(s)` locale échappe les cinq caractères. Commentaire de tête : pourquoi `lastBuildDate` ne vient jamais de l'horloge.

- [ ] **Step 4: Brancher le build** — dans `writeSeoFiles`, pour chaque `{ lang }` de `site.pages`, écrire `feedFor(lang, { briefs, culture })` dans `dist/<site>/<feedPath(lang) sans le / initial>` (créer le dossier si besoin, `mkdir … { recursive: true }`), et logguer `→ dist/<site><feedPath>`.

- [ ] **Step 5: Contrôle post-build** — dans `check-build.mjs`, pour chaque vitrine et chacune de ses langues : le fichier existe, commence par `<?xml`, contient `<atom:link href="${feedUrl(lang)}"`, et aucun `<link>` d'élément ne pointe vers l'hôte de l'autre vitrine.

- [ ] **Step 6: Vérifier** — `node --test test/feed.test.mjs` PASS, `npm test` PASS, `npm run build && npm run check` PASS (le log liste 6 `feed.xml`), et `dist/ch/feed.xml` s'ouvre sans erreur dans Chrome.

- [ ] **Step 7: Commit** — `git add sites.config.js scripts/lib/feed.mjs scripts/build-sites.mjs scripts/check-build.mjs test/feed.test.mjs` ; message « RSS : un flux par langue, généré au build ».

### Task 2: Annoncer le flux dans le `<head>`

**Files:**
- Modify: `scripts/lib/site-meta.mjs` (`composeHead`, ~l. 173-195)
- Modify: `scripts/check-build.mjs:177-178` (compte des alternates)
- Test: `test/site-meta.test.mjs` (ajouts)

**Interfaces:**
- Consumes: `feedUrl(lang)` (Tâche 1).
- Produces: une ligne `<link rel="alternate" type="application/rss+xml" title="…" href="${feedUrl(lang)}" />` dans toutes les têtes composées (`headFor`, `briefHeadFor`, `cultureHeadFor`, `agendaPaysHeadFor`).

- [ ] **Step 1: Tests qui échouent** dans `test/site-meta.test.mjs` :
  - `head : un seul lien RSS, hreflang intacts` — pour `headFor({ siteId: 'ch', lang: 'de', view: 'radio' })` : exactement un `type="application/rss+xml"`, son `href` vaut `feedUrl('de')` ; le nombre de `rel="alternate" hreflang=` reste `ALL_LANGS.length + 1`.
  - Même contrôle sur `briefHeadFor` et `cultureHeadFor` (une langue du .org).

- [ ] **Step 2: Lancer** `node --test test/site-meta.test.mjs` — FAIL.

- [ ] **Step 3: Implémenter** — ajouter la ligne juste après le bloc hreflang de `composeHead`. `title` = `SITES[siteOf(lang)].brand` (attribut échappé par `attr`). Le lien RSS est placé **avant** le commentaire des polices, pas dans le bloc hreflang.

- [ ] **Step 4: Corriger le contrôle de `check-build.mjs`** — l. 177-178, compter `/rel="alternate" hreflang=/g` au lieu de `/rel="alternate"/g` ; libellé inchangé. Sans ce changement, `npm run check` échoue sur les 24 pages.

- [ ] **Step 5: Vérifier** — tests PASS, `npm run build && npm run check` PASS. `npm run prerender && npm run hydration-check` : aucun écart (le `<head>` n'est pas hydraté, mais on le prouve).

- [ ] **Step 6: Commit** — « RSS : lien d'autodécouverte dans le head de toutes les pages ».

### Task 3: Pied de page — lien RSS, formulaire, confidentialité, CSP

**Files:**
- Modify: `sites.config.js` (champ `newsletter` dans `SITES.ch` et `SITES.org`)
- Modify: `src/components/Footer.jsx`
- Modify: `src/i18n.jsx` (six blocs `STRINGS`)
- Modify: `src/styles/global.css` (styles du formulaire)
- Modify: `firebase.json` (les **deux** `form-action`)
- Test: `test/newsletter-footer.test.mjs`

**Interfaces:**
- Consumes: `feedPath(lang)` (Tâche 1), `SITE_ID` (`src/site.js`), `useI18n()`.
- Produces: `SITES.<id>.newsletter = { buttondown: string, lang: string } | null` ; `newsletterAction(siteId): string | null` exporté de `sites.config.js`, valant `https://buttondown.com/api/emails/embed-subscribe/${buttondown}`. Valeurs : `ch → { buttondown: 'armenieinfo', lang: 'fr' }`, `org → { buttondown: 'armenianews', lang: 'en' }` — **noms provisoires**, corrigés à la Tâche 6 quand les comptes existent.

Clés i18n (six blocs) : `footer.rss`, `newsletter.title`, `newsletter.label`, `newsletter.submit`, `newsletter.note`, `privacy.newsletter.title`, `privacy.newsletter.body`. Textes fr de référence :
- `footer.rss` : « Flux RSS »
- `newsletter.title` : « La semaine arménienne, chaque lundi »
- `newsletter.label` : « Votre adresse e-mail »
- `newsletter.submit` : « S'abonner »
- `newsletter.note` : « Un e-mail par semaine. Désinscription en un clic. »
- `privacy.newsletter.title` : « Lettre d'information »
- `privacy.newsletter.body` : « Si vous vous abonnez, votre adresse e-mail est confiée à Buttondown, qui envoie la lettre et ne la partage pas. Elle ne sert qu'à cet envoi ; chaque lettre contient un lien de désinscription, et une demande à l'adresse ci-dessous la fait effacer. »
de/it/hy/ru : traductions fidèles ; `newsletter.*` y sont tout de même déclarées (le formulaire n'y est pas affiché, mais une clé absente d'un bloc est le motif que les tests de clés repèrent).

- [ ] **Step 1: Tests qui échouent** dans `test/newsletter-footer.test.mjs` :
  - `les sept clés existent dans les six langues` — pour chaque clé ci-dessus et chaque langue, `STRINGS[lang][clé]` est une chaîne non vide (suivre la façon dont `test/stations.test.mjs` lit `STRINGS`).
  - `CSP : buttondown autorisé des deux côtés` — dans `firebase.json`, chaque bloc `headers` contient `form-action 'self' https://buttondown.com`.
  - `newsletterAction` — `newsletterAction('ch')` commence par `https://buttondown.com/api/emails/embed-subscribe/` ; vaut `null` si `newsletter` est `null`.
  - `langue de la lettre = langue de tête de la vitrine` — `SITES.ch.newsletter.lang === primaryLang('ch')`, idem `org`.

- [ ] **Step 2: Lancer** — FAIL.

- [ ] **Step 3: Implémenter.** Dans `Footer.jsx` :
  - ajouter `[feedPath(lang), t('footer.rss')]` à la liste du bloc « Pages » ;
  - rendre le formulaire **seulement si** `SITES[SITE_ID].newsletter?.lang === lang` : `<form className="footer__newsletter" action={newsletterAction(SITE_ID)} method="post" target="_blank">`, un `<label>` visible lié à `<input type="email" name="email" required autoComplete="email">`, `<input type="hidden" name="embed" value="1">`, un bouton, la note. Aucun état React, aucune valeur dépendant de l'heure (hydratation).
  - ajouter la section `privacy.newsletter.*` dans la politique de confidentialité, après `privacy.storage`.
  Dans `firebase.json`, remplacer `form-action 'self'` par `form-action 'self' https://buttondown.com` dans les deux blocs. Styles dans `global.css` en suivant le skill `verifier-le-rendu` (police avec son `font-size-adjust`, cible tactile 44 px sous `pointer: coarse`).

- [ ] **Step 4: Vérifier** — `npm test` PASS ; `npm run lint` = 5 avertissements ; `npm run build && npm run check && npm run prerender && npm run hydration-check` PASS ; rendu vérifié selon le skill `verifier-le-rendu` (fr et en, jour et nuit, 375 px et bureau ; formulaire absent sur `/de/` et `/hy/`).

- [ ] **Step 5: Commit** — « Pied de page : flux RSS, inscription à la lettre, confidentialité ».

### Task 4: Composer le numéro de la semaine

**Files:**
- Create: `scripts/lib/newsletter.mjs`
- Create: `src/newsletterStrings.js` (module plat, fr et en)
- Test: `test/newsletter.test.mjs`

**Interfaces:**
- Consumes: briefs/culture (formes de la Tâche 1), `evenementsAVenir` (`src/agendaEvents.js`), `worldCountryKey`, `placeLabel` (`src/worldPlace.js`), `briefUrl`, `cultureUrl`, `agendaCountryUrl`, `urlFor`, `SITES`.
- Produces: `isoWeek(now: Date): string` (`'2026-W45'`) ; `digestFor(siteId, { briefs, culture, events, now }): { week, subject, body } | null` — `body` en Markdown (Buttondown le rend). `NEWSLETTER_STRINGS[lang] = { subject(dateLabel), intro, briefs, culture, agenda, more }`.

Règles : langue = `SITES[siteId].newsletter.lang`. Fenêtre = les 7 jours qui précèdent `now`. Brèves : une ligne par brève de la fenêtre, plus ancienne d'abord, `[titre du premier sujet](briefUrl(lang, date)+utm)`. Culture : chaque article dont `date` tombe dans la fenêtre, `[titre](url+utm)` puis la description. Agenda : `evenementsAVenir(events)` dont la date tombe dans les 14 jours suivant `now`, triés par date, 8 au plus, `titre — date — placeLabel(location, lang)`, lien `agendaCountryUrl(lang, worldCountryKey(ev))`. UTM : `?utm_source=newsletter&utm_medium=email&utm_campaign=hebdo-${week}`. Sujet fr : `Arménie Info — la semaine du ${date}` ; en : `Armenia News — week of ${date}` (date formatée par `Intl` dans la langue : ce module ne tourne que sous Node, l'arménien n'est pas concerné).

- [ ] **Step 1: Tests qui échouent** :
  - `isoWeek` — `isoWeek(new Date('2026-11-02T05:30:00Z')) === '2026-W45'` ; `isoWeek(new Date('2027-01-01T12:00:00Z')) === '2026-W53'`.
  - `semaine vide = null` — aucune brève ni article dans la fenêtre (agenda plein) → `null`.
  - `numéro .ch en français` — 7 brèves fr + 1 article de la semaine + 12 événements dans 14 jours → `subject` commence par `Arménie Info`, `body` contient 7 liens de brève, le lien de l'article, exactement 8 événements, et chaque lien porte `utm_campaign=hebdo-2026-W45`.
  - `numéro .org en anglais` — mêmes données en `en` → liens `armenianews.org`, aucun lien `armenieinfo.ch`.
  - `hors fenêtre exclu` — brève datée de 8 jours avant `now` et événement à 15 jours → absents.
  - `Markdown sûr` — un titre contenant `]` ou `)` n'interrompt pas le lien (échapper `[`, `]`, `(`, `)` dans le texte du lien).

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS, puis `npm test`, `npm run lint`.

- [ ] **Step 5: Commit** — « Lettre : composition du numéro hebdomadaire ».

### Task 5: Envoyer, une fois par semaine

**Files:**
- Create: `scripts/newsletter-send.mjs`
- Create: `src/data/newsletter-sent.json` (`{}`)
- Create: `.github/workflows/newsletter.yml`
- Modify: `package.json` (script `newsletter`)
- Test: `test/newsletter-send.test.mjs`

**Interfaces:**
- Consumes: `digestFor`, `isoWeek` (Tâche 4), `loadBriefs`, `loadCulture`, `src/data/agenda.json` (`switzerland` + `world`, comme `loadAgendaPays` de `build-sites.mjs`).
- Produces: `planSends({ registry, digests }): { siteId, digest }[]` et `buttondownRequest(digest, { key, status }): { url, init }` exportés pour les tests ; CLI `node scripts/newsletter-send.mjs plan --out <f>` puis `send --plan <f>`, et `--dry` sur les deux (n'écrit ni n'envoie, imprime le Markdown).

Règles :
- Registre `src/data/newsletter-sent.json` = `{ "ch": "2026-W45", "org": "2026-W45" }`. `planSends` écarte un site dont le registre vaut déjà la semaine du numéro, un `digest` `null` (log `✗ newsletter/<site>: semaine vide`) et un site sans clé (`BUTTONDOWN_API_KEY_CH` / `_ORG` absente : log `✗ newsletter/<site>: pas de clé`).
- `plan` écrit le registre ; le workflow le pousse **avant** `send` (un run annulé perd au pire un numéro, n'en double jamais — même ordre que le job `social` de `hourly.yml`).
- Requête : `POST https://api.buttondown.com/v1/emails`, en-têtes `Authorization: Token <clé>` et `Content-Type: application/json`, corps `{ subject, body, status }`. `status` vient de `NEWSLETTER_STATUS` ; défaut **`draft`**. **À vérifier dans la doc Buttondown au moment d'écrire ce code** (https://docs.buttondown.com/api-emails-create) : nom exact du champ et valeur qui déclenche l'envoi (attendu : `about_to_send`). Une réponse non-2xx fait échouer l'étape avec le corps de la réponse au log.

- [ ] **Step 1: Tests qui échouent** :
  - `semaine déjà envoyée = rien` — registre `{ ch: '2026-W45' }`, digest ch de `2026-W45` → `planSends` ne rend pas `ch`.
  - `semaine suivante = envoi` — registre `{ ch: '2026-W44' }` → `ch` rendu.
  - `digest null écarté`.
  - `brouillon par défaut` — `buttondownRequest(d, { key: 'k' })` : corps JSON avec `status: 'draft'`, en-tête `Authorization: 'Token k'`, URL ci-dessus.
  - `statut explicite respecté` — `{ status: 'about_to_send' }` passe tel quel.

- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter** `scripts/newsletter-send.mjs` (structure calquée sur `scripts/social-post.mjs`). **Step 4: Lancer** — PASS ; `node scripts/newsletter-send.mjs plan --dry` imprime les deux numéros de la semaine en cours.

- [ ] **Step 5: Workflow** `.github/workflows/newsletter.yml` :
  - `on: schedule: - cron: '30 5 * * 1,2,3'` + `workflow_dispatch`. Le registre fait qu'un seul des trois passages envoie, et rattrape un lundi sauté par GitHub.
  - `permissions: contents: write` ; `environment: newsletter` ; `env:` `NEWSLETTER_STATUS: ${{ vars.NEWSLETTER_STATUS }}`, `BUTTONDOWN_API_KEY_CH` et `_ORG` depuis les secrets.
  - Étapes : `actions/checkout` avec `ref: main` et `actions/setup-node` (node 24, cache npm) **aux mêmes SHA épinglés que `hourly.yml`** ; `npm ci` ; `plan` ; commit + push du registre (bloc recopié du job `social`) ; `send`.
  - `package.json` : `"newsletter": "node scripts/newsletter-send.mjs"`.

- [ ] **Step 6: Vérifier** — `npm test`, `npm run lint` (5 avertissements). **Step 7: Commit** — « Lettre : envoi hebdomadaire par Buttondown, registre avant envoi ».

### Task 6: Mise en service (avec Nareg) et documentation

Étapes manuelles — rien ne part chez les abonnés sans l'accord de Nareg.

- [ ] **Step 1 (Nareg)** — créer deux comptes Buttondown (contact@armenieinfo.ch, contact@armenianews.org), vérifier les limites du plan gratuit, noter les deux noms d'utilisateur, activer le double opt-in, mettre le logo et l'adresse de l'expéditeur.
- [ ] **Step 2** — reporter les vrais noms dans `SITES.*.newsletter.buttondown` ; `npm test`, `npm run build && npm run check`.
- [ ] **Step 3 (Nareg)** — créer l'environnement GitHub `newsletter`, y mettre `BUTTONDOWN_API_KEY_CH` et `BUTTONDOWN_API_KEY_ORG`. Ne **pas** créer `NEWSLETTER_STATUS` (donc brouillon).
- [ ] **Step 4** — documenter : une section « Lettre et RSS » dans `README.md` (comptes, secrets, passage en envoi automatique, registre) ; dans `CLAUDE.md`, **une** puce dans « À savoir » sur les deux pièges silencieux (supprimer une ligne du registre renvoie le numéro ; le contrôle `check-build` compte les alternates **avec** hreflang) — et retirer en échange une puce périmée, selon la règle de tête du fichier.
- [ ] **Step 5** — pousser la branche, ouvrir la PR, fusionner après relecture ; vérifier en production `curl -sI https://armenieinfo.ch/feed.xml` (200) et les cinq autres.
- [ ] **Step 6** — `gh workflow run newsletter.yml` : deux brouillons apparaissent chez Buttondown ; Nareg les relit et les envoie à la main. Après deux numéros relus sans retouche, et seulement avec son accord, créer la variable `NEWSLETTER_STATUS=about_to_send`.
- [ ] **Step 7** — IndexNow / Search Console : rien à faire (un flux n'est pas une page) ; soumettre `feed.xml` du .ch et du .org à Feedly et Inoreader en le cherchant par URL, pour amorcer leur index.
