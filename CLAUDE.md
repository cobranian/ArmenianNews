# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) lorsqu'il
travaille sur ce dépôt.

## Projet

**Arménie Info** (`armenie-info.web.app`) — un **instantané horaire** de la vie
arménienne : actualités, agenda et réseaux sociaux, dans une esthétique de
journal « Apricot Press » (basalte volcanique éclairé d'abricot), avec une
bascule **jour / nuit**. Interface quadrilingue : **Français / English /
Հայերեն / Русский**.

Une tâche planifiée récupère les sources une fois par heure dans des fichiers
JSON ; le site est une application statique **Vite + React** qui affiche ces
fichiers. **Aucun backend à l'exécution.**

**Ce dossier est son propre dépôt git** — racine `ArmenianNews/`, remote
`github.com/cobranian/ArmenianNews`. Il se trouve à l'intérieur de
`C:\Users\nareg\Documents\Claude code`, qui est **un autre dépôt git**
(`armenian-songs`) et qui ne suit pas ce dossier.

**Le piège** : une commande git lancée depuis le dossier parent agit sur
`armenian-songs`, pas ici. Vérifiez toujours avec `git rev-parse --show-toplevel`,
et lancez `git check-ignore` depuis **ce** dossier — sinon vous validez une règle
du mauvais dépôt.

Les projets voisins (pltr-dashboard, comparateur2, etc.) sont indépendants — ne
mélangez pas leur outillage ici.

## Commandes

```bash
npm install         # installer les dépendances
npm run dev         # serveur de développement sur http://localhost:5173
npm run build       # build de production dans dist/
npm run preview     # prévisualiser le build de production
npm run lint        # ESLint (config plate, eslint.config.js) — passe : 0 erreur, 6 avertissements connus
npm run scrape      # rafraîchir src/data/{news,agenda,meta,instagram-feed}.json depuis les sources
npm run ig-scrape   # rafraîchir le pool Instagram (local, Chrome connecté — jamais en CI)
npm run screenshot  # après un build : capturer le carrousel Don Narek dans dist/don-narek-{desktop,mobile}.png
```

Il n'y a **pas de suite de tests**. Le lint et l'exécution réelle des scripts
tiennent lieu de vérification.

### Lint : ce qu'il faut savoir avant d'y toucher

`eslint.config.js` déclare **trois mondes**, parce que le dépôt exécute du code à
trois endroits : `src/` dans un navigateur, `scripts/` dans Node, et
`public/theme-init.js` dans un navigateur avant tout module (donc `sourceType:
'script'`, pas `module`).

- **`react/jsx-uses-vars` porte la config à bout de bras.** Sans cette règle, le
  `no-unused-vars` du cœur d'ESLint ne voit pas que `<Carousel />` utilise
  `Carousel` : il réclame la suppression de **tous** les imports de composants,
  y compris `React` et `App` dans `main.jsx`. 46 fausses erreurs, et un `--fix`
  qui détruit l'application. Ne retirez pas `eslint-plugin-react`.
- **`scripts/` a les globales navigateur en plus de celles de Node**, et c'est
  voulu : les callbacks passés à `page.evaluate()` sont sérialisés et exécutés
  dans le navigateur piloté par Puppeteer. `document` et `window` y sont réels.
- **`.cache/` est ignoré** : il contient les profils Chrome connectés des scrapes
  manuels — du code d'extension tierce, pas le nôtre.

**Les 6 avertissements restants sont connus et assumés** — ne les « corrigez »
pas mécaniquement :

- `Radio.jsx` (×2, `react-hooks/exhaustive-deps`) — le correctif que suggère la
  règle (capturer `audioRef.current` au montage) **introduirait un bug** : ce
  `useEffect` de démontage veut la référence au moment du démontage, pas celle
  figée au montage.
- `i18n.jsx` et `motifs.jsx` (×4, `react-refresh/only-export-components`) — ces
  fichiers exportent un composant **et** un hook ou des constantes. C'est le
  motif React standard pour un contexte ; l'avertissement ne concerne que le
  rafraîchissement à chaud en développement.

## Architecture

**`src/App.jsx`** est l'orchestrateur : il compose les sections
(`Nav`, `Hero`, `HeroCarousel`, `News`, `Agenda`, `Facebook`, `Instagram`,
`Footer`). Il n'y a **pas de bibliothèque d'état global** — les données viennent
des fichiers JSON importés, l'internationalisation vient d'un contexte React.

**Flux de données** — les scrapers écrivent des JSON dans `src/data/`, que les
composants importent au build :

- **`scripts/scrape.mjs`** — l'orchestrateur du snapshot. Il appelle chaque
  source, puis écrit `news.json`, `agenda.json`, `instagram-feed.json` et
  `meta.json`. Chaque source **échoue indépendamment et se dégrade en douceur** :
  si un scrape revient vide (ex. un 403 Cloudflare depuis la CI), le fichier
  précédent est réutilisé (backfill) au lieu d'être effacé.
- **`scripts/sources/`** — un module par source :
  - `armenpress.mjs` — Armenpress, l'agence de presse nationale, et la seule
    source **quadrilingue** (fr/en/hy/ru) : les quatre éditions correspondent
    1:1 à la langue de l'interface. Application Inertia.js : le JSON du flux est
    embarqué dans la page, donc **aucun sélecteur CSS**. **Sept rubriques ×
    quatre langues = 28 pages** par snapshot, espacées de 800 ms. L'édition
    russe (`armenpress.am/ru`) partage exactement la même structure Inertia et
    les mêmes slugs de rubriques ; ses libellés `apcats.*` sont les noms de sa
    propre navigation (voir `src/i18n.jsx`).
    - **Le piège du payload** : les articles d'une page de rubrique vivent dans
      `props.data.data.hits`, pas dans `props.feed.data.hits` (le chemin de
      l'accueil). Lire le chemin de l'accueil sur une page de rubrique renvoie
      « vide » — c'est de là que venait la légende « les pages de rubrique
      embarquent un flux vide ». Elles rendent 12 à 36 articles, tous datés et
      illustrés.
    - **Ce module utilise `node:https`, pas `fetchText`**, et c'est délibéré :
      les pages de rubrique répondent **403 au `fetch` de Node (undici)** et 200
      à `node:https` — même machine, même TLS OpenSSL, même HTTP/1.1, quels que
      soient les en-têtes. La raison est dans le module. Basculer sur
      `fetchText` ferait échouer les 28 rubriques, que le backfill masquerait
      ensuite en silence.
  - `courrier.mjs` — Le Courrier d'Erevan (actualités, par rubrique).
  - `armenews.mjs` — Nouvelles d'Arménie (armenews.com), six rubriques
    WordPress, francophone.
  - `artzakank.mjs` — Artzakank / Écho des Arméniens de Suisse, francophone,
    **trois** rubriques : Arménie & Artsakh et Communauté via l'API WordPress,
    plus Divers, gratté depuis la page HTML `/divers-p/`.
  - `armenieinfotv.mjs` — armenieinfo.tv, francophone, par rubrique.
  - `armradio.mjs` — Public Radio of Armenia. Passe par une **chaîne de sources
    multi-niveaux** (proxy Cloudflare Worker → API REST → flux RSS → Google News)
    car armradio.am est derrière Cloudflare, qui renvoie par intermittence un 403
    aux IP des datacenters de la CI. Sert **en/hy** ; l'édition **russe**
    (`ru.armradio.am`) est un chantier à venir (voir « À savoir »).
  - `armenopole.mjs` — Agenda (Suisse + monde).
  - `instagram.mjs` — sélection aléatoire depuis le pool Instagram.
- **`scripts/fb-scrape.mjs`** — rafraîchit Don Narek (Facebook). **Étape manuelle
  locale**, pas horaire : Facebook exige une session connectée et bloque la CI.
- **`scripts/ig-scrape.mjs`** — rafraîchit le pool Instagram. **Étape manuelle
  locale**, pas horaire : Instagram exige une session connectée et bloque la CI.
  Récolte les **9 derniers posts** de chacun des 8 comptes curés (72 posts),
  datés, et télécharge leurs images dans `src/data/ig/`. Le job horaire ne fait
  que **re-mélanger** ce pool : sans récolte, le mur re-sert indéfiniment les
  mêmes posts tout en ayant l'air frais.
- **`scripts/shoot.mjs`** — capture d'écran du carrousel Don Narek (Puppeteer).

**Internationalisation** — `src/i18n.jsx` expose un contexte React
(`useI18n()` → `{ t, lang, setLang }`) avec les dictionnaires **fr / en / hy /
ru**. `LANGS` (dans `i18n.jsx`) pilote seul le sélecteur de langue et la
persistance ; ajouter une langue = ajouter son entrée à `LANGS`, un bloc
`STRINGS` complet (mêmes clés que `fr`, sinon repli silencieux sur le français)
et son `LOCALES`. Seul le **chrome de l'interface** est traduit ; le **contenu**
(articles, posts) reste dans sa langue d'origine — un lecteur russe voit
Armenpress en russe, mais Courrier en français et ArmRadio en anglais, et
Courrier reste le premier onglet (comme pour hy). Le français est la langue par
défaut et doit porter tous ses accents (é, è, à, ê, ç…).

**Styles** — `src/styles/global.css`, un seul fichier. La bascule jour / nuit et
la palette « abricot sur basalte » y sont définies.

## Données : ce qui est scrapé vs. curé à la main

- **Généré par le scrape (ne pas éditer à la main)** — `news.json`,
  `agenda.json`, `instagram-feed.json`, `meta.json`. Ils sont réécrits à chaque
  snapshot horaire.
- **Rafraîchi à la main, jamais par la CI** — `src/data/instagram.json` (le
  **pool** Instagram : la **liste des comptes** est curée à la main, leurs
  **posts** sont récoltés par `npm run ig-scrape` ; le job horaire y pioche une
  sélection aléatoire dans `instagram-feed.json`) et `src/data/facebook.json`
  (les posts Don Narek, récoltés par `node scripts/fb-scrape.mjs` ou ajoutés à
  la main).
  Voir le **README.md** pour la procédure d'ajout de posts et de rafraîchissement
  des deux murs.
- Schéma du pool Instagram : `accounts: [{ handle, name, url, posts: [{url, date}] }]`.
  Le scraper réécrit les `posts` — **jamais** le tableau `accounts`.
- Les images bundlées vivent dans `src/data/ig/` (Instagram) et `src/data/fb/`
  (Facebook) : incluses au build, donc jamais de hotlink ni d'expiration. Sans
  image, une tuile affiche un **motif arménien déterministe** (voir
  `src/components/motifs.jsx`).

## Déploiement

`.github/workflows/hourly.yml` s'exécute **toutes les heures** (UTC), plus sur
dispatch manuel et sur push vers `main` :

- **Planifié / manuel** → scrape + commit des données + build + déploiement (un
  snapshot par heure).
- **Push vers `main`** → build + déploiement seulement (pas de snapshot), pour
  que les changements de code partent en prod sans créer de snapshot en trop.

Le site est déployé sur **Firebase Hosting** (projet `armenie-info`). Vite `base`
vaut `/` par défaut ; surchargez avec `BASE_PATH=/sous-chemin` pour un sous-chemin.

## À savoir

- Les scrapers dépendent du HTML actuel des sites sources ; si un site est
  redessiné, les sélecteurs du module correspondant dans `scripts/sources/`
  peuvent devoir être mis à jour.
- `armradio.am` et Instagram sont tous deux bloqués depuis les IP de la CI
  (Cloudflare / anti-scraping) — d'où la chaîne de sources pour le newswire et,
  pour Instagram, une récolte **locale** (`npm run ig-scrape`) depuis un Chrome
  connecté, à relancer à la main de temps en temps.
- `ig-scrape.mjs` interroge le flux de la grille de profil,
  `/api/v1/feed/user/<handle>/username/`. **N'y substituez pas
  `web_profile_info`** (l'endpoint que conseillent tous les tutoriels) : il
  répond bien 200, avec la bio et le *nombre* de posts, mais son tableau `edges`
  revient **vide** — ça se lit comme un compte sans publication, pas comme une
  panne. Le piège est silencieux.
- Un identifiant Instagram ne peut pas contenir de tiret : un handle mal saisi
  (ex. `armenian-trend`) renvoie un 404 et fait échouer le compte.
- **La fraîcheur du mur est plafonnée par l'activité réelle des comptes.** Deux
  comptes suivis sont dormants (`ig_armenia` n'a rien publié depuis juin 2023,
  `armeniancuisine` depuis novembre 2025) : leurs vieux posts apparaissent sur le
  mur et **aucune récolte n'y changera rien** — le script rapporte fidèlement ce
  que le compte publie. Pour rafraîchir vraiment, il faut retirer ou remplacer
  ces comptes à la main dans le tableau `accounts`. C'est un choix assumé, pas un
  bug.
- **L'ordre des onglets du fil est porteur de sens, pas cosmétique.**
  `NewsBrowser` ne rend que l'onglet actif : la source par défaut est donc la
  seule que le prérendu injecte dans le HTML, et la seule que Google lit sans
  exécuter de JS. Courrier d'Erevan est en tête parce qu'il est francophone et
  qu'il prérend le plus de texte français (80 articles, contre 70 pour
  Armenpress depuis le passage aux 7 rubriques — armenews, artzakank et
  armenieinfotv sont aussi francophones, mais plus petits). Armenpress est la
  seule source **quadrilingue** (fr/en/hy/ru) mais ne mène pas l'ordre. **La marge
  est désormais mince (80 vs 70)** : si le nombre d'articles bouge d'un côté ou
  de l'autre, remesurez avant de conclure que Courrier doit rester en tête.
  Avant Armenpress, ArmRadio (éditions `en`/`hy` seulement) faisait servir 70
  titres **anglais** sous `<html lang="fr">`. Ne réordonnez pas les onglets sans
  mesurer ce que devient le HTML prérendu.
- **Armenpress peut se périmer en silence.** Si une rubrique échoue, le module
  la renvoie vide et `backfillSections` restitue les articles du
  snapshot précédent — indéfiniment. Un blocage durable depuis la CI ferait donc
  resservir les mêmes dépêches pendant que `meta.generatedAt` et le `lastmod` du
  sitemap continuent d'annoncer de la fraîcheur. Le seul signal est un
  `console.warn` dans les logs. C'est le même piège que celui documenté pour
  Instagram, mais Armenpress n'a **aucun repli** — là où armradio en a quatre.
  Si le mur Armenpress semble figé, vérifiez les logs du job horaire avant de
  soupçonner le code.
- **Ne tronquez pas les titres Armenpress au deux-points.** Ce sont des chapôs,
  pas des titres : médiane 78 caractères, queue à 189, et ~50 % des cartes
  Armenpress restent coupées par le `line-clamp` (mesuré sur 210 titres,
  2026-07-17). La tentation est de couper « à la première proposition » dans
  `scripts/sources/armenpress.mjs`. **Deux raisons de ne pas le faire**, toutes
  deux mesurées :
  - **Le deux-points fait deux métiers opposés dans la même source.** Dans
    `TRIPP Development Company: Government approves…` la nouvelle est **avant**.
    Dans `Porte-parole du MAE: la visite de Tsitsernakaberd n'a pas été
    retirée…` elle est **après** — le deux-points est un préfixe d'attribution.
    Couper avant donnerait des cartes titrées « Porte-parole du MAE »,
    « Caroline Safarian », « Grégoire Jakhian » : des noms propres en guise de
    titres. Aucun motif syntaxique ne distingue les deux cas. Et de toute façon
    **30 des 45 titres longs n'ont aucun séparateur** — rien à couper.
  - **Le `line-clamp` CSS est non destructif, une coupe au scrape ne l'est
    pas.** Le titre entier reste dans le DOM : Google et les lecteurs d'écran le
    lisent, seul l'affichage est écourté. Couper à la source ferait indexer
    « Porte-parole du MAE » comme titre, sur la **seule source quadrilingue**.
    Voir le piège de l'ordre des onglets ci-dessus : le HTML prérendu compte.

  Le « … » plus « LIRE LA SUITE » est le traitement juste pour un chapô. Les
  50 % ne sont pas une dette : c'est la source qui parle comme une agence.
- **ArmRadio en russe (`ru.armradio.am`) est un chantier à venir, pas un
  oubli.** Le site russe est derrière Cloudflare et répond **403** à l'API REST
  même depuis une IP résidentielle — donc, comme en/hy, il n'est joignable qu'à
  travers le **Cloudflare Worker `ARMRADIO_PROXY`**. Il faut d'abord apprendre au
  Worker à router `lang=ru → ru.armradio.am` et le redéployer, puis lire ses IDs
  de rubriques russes *à travers* le Worker (le site russe nomme ses catégories
  en russe, comme le site arménien avec `HY_CATEGORY_IDS`). La procédure complète
  est dans `docs/superpowers/specs/2026-07-17-langue-russe-design.md` (section
  « Suite »). En attendant, sous l'interface russe, l'onglet ArmRadio sert
  l'édition **anglaise** (`armLang = lang === 'hy' ? 'hy' : 'en'` dans
  `NewsBrowser.jsx`), ce qui est cohérent avec « le contenu reste dans sa langue
  d'origine ».
- Le README.md du projet est la **référence détaillée** (chaîne de sources
  armradio, curation des feeds, déploiement, proxy Cloudflare Worker).
