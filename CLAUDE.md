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
    aux IP des datacenters de la CI. Sert **en/hy/ru** — le fil (ticker) reste
    anglais, mais l'onglet ArmRadio du navigateur d'actualités suit la langue
    (ru via `ru.armradio.am`, voir « À savoir »).
  - `asbarez.mjs` — Asbarez, le quotidien arménien de Los Angeles, en **deux
    éditions** : anglaise (`asbarez.com`, 7 rubriques) et arménienne occidentale
    (`asbarez.am`, 5 rubriques). Servi sous **en/hy uniquement** (pas d'édition
    française ni russe) — voir la règle `buildSources` dans « À savoir ».
    - **Les deux éditions bloquent les IP de datacenter** (un WAF côté serveur,
      **pas** Cloudflare — `Server: Apache`, ce qui trompe : l'absence de
      `cf-ray` ne veut pas dire « joignable depuis la CI »). Direct depuis une IP
      résidentielle : OK. Depuis un runner GitHub Actions : **403** sur les deux.
      Elles passent donc **obligatoirement par un Cloudflare Worker**
      (`proxy/asbarez-worker.js`, variable `ASBAREZ_PROXY`) qui sort par une IP
      Cloudflare non bloquée — **aucun repli direct**, contrairement à armradio :
      sans le proxy, le flux revient vide et l'onglet disparaît. Le Worker envoie
      un vrai UA Chrome (le site filtre aussi les UA non-navigateur, en plus de
      l'IP). Redéployer : `cd proxy && npx wrangler deploy -c wrangler-asbarez.toml`.
    - **L'anglais passe par l'API REST WordPress** (`asbarez.com`, comme
      `armenews`), **l'arménien par les flux RSS par rubrique** (`asbarez.am`,
      `/archives/category/<slug>/feed/` — l'API REST y répond **401**). **Le RSS
      ne porte aucune image**, donc chaque article arménien est re-gratté pour son
      `og:image` (via le proxy, même blocage IP que les flux ; ~50 fetches/heure).
      Les images vivent sur `media.asbarez.am` et hotlinkent en direct comme
      l'édition anglaise. Un article dont la page échoue garde `image: null` et
      retombe sur le motif — une seule page morte ne casse pas la rangée.
    - **Les libellés de rubrique voyagent dans les données** (`{ categoryKey,
      label, articles }`), pas via `t('…cats.*')` : chaque édition ne s'affiche
      que sous sa langue (les rubriques anglaises sous `en`, arméniennes sous
      `hy`), donc router un libellé unilingue à travers les quatre dictionnaires
      i18n n'aurait aucun sens. Les images anglaises hotlinkent en direct côté
      navigateur (`media.asbarez.com` répond 200 depuis une IP résidentielle — le
      lecteur n'est pas en datacenter ; la CSP autorise déjà tout https).
  - `oragark.mjs` — Oragark (Օրակարգ, oragark.com), quotidien de la FRA/ՀՅԴ, en
    **deux éditions** : anglaise (Featured, News, Armenia, Community) et
    arménienne occidentale (Առաջին Օրակարգ, Վերջին Լուրեր, sous `/hy/`). Servi
    sous **en/hy uniquement**. **Plus simple que toutes les autres** : c'est **une
    seule install WordPress** — les deux éditions ne sont que des *rubriques* sur
    la **même API REST** (`/wp-json/wp/v2/`, comme `armenews`). Pas de filtre
    User-Agent, pas de Cloudflare (`Server: IIS`), images présentes dans les deux
    langues et **hotlinkées en direct** — donc ni proxy, ni RSS, ni scrape
    d'`og:image` (contrairement à asbarez). Libellés portés dans les données
    (`{ categoryKey, label, articles }`), chaque édition sous sa seule langue.
  - `californiacourier.mjs` — The California Courier (thecaliforniacourier.com),
    l'hebdomadaire arménien de Glendale. Une install WordPress REST ouverte (ni
    filtre UA, ni Cloudflare), comme oragark. **Son atout : la chronique de Harut
    Sassounian est traduite dans une rubrique fraîche et illustrée par langue** —
    donc c'est **la seule source, avec Armenpress, à servir les quatre langues**,
    et le seul deuxième onglet que les éditions fr et ru aient jamais. Mapping
    (une rubrique par langue) : `en` → `mainpost` (le fil d'actualité anglais,
    qui contient aussi sa chronique anglaise — la rubrique `sas-column` propre à
    l'anglais s'est arrêtée en 2021, sans équivalent frais isolable) ; `fr` →
    `french` ; `ru` → `russian` ; `hy` → `eastern-armenian`. Les libellés sont
    **fixés à la main** (les noms de rubrique WordPress sont des noms de langue —
    « French », « Russian » — ou « mainpost », inutilisables comme titres) et
    portés dans les données. Images hotlinkées en direct.
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
Armenpress **et** ArmRadio en russe, mais Courrier (et les autres sources
francophones) en français, et Courrier reste le premier onglet (comme pour hy).
Le français est la langue par défaut et doit porter tous ses accents
(é, è, à, ê, ç…).

**L'exception : le pays des événements « Monde ».** Le badge de pays des cartes
de l'agenda mondial *est* localisé (en/hy/ru), alors que le reste du contenu
scrapé ne l'est pas. `src/worldPlace.js` résout le pays à partir du texte libre
`location` d'armenopole (« Angleterre », « New York ») d'abord, puis du slug
`country`, et retombe sur le texte français brut si aucun n'est connu — jamais
un slug nu. **Le français garde le texte scrapé tel quel** (« Le Pays reste en
Français »). Ce module est **volontairement un `.js` à part, pas dans
`i18n.jsx`** : y ajouter un export non-composant ferait passer le lint de 6 à 7
avertissements `react-refresh` (voir la section lint). Ne le reconsolidez pas
dans `i18n.jsx`. Résoudre depuis `location` avant le slug corrige aussi une
donnée fausse du scrape (un événement en Angleterre listé sous le slug
`greece`). La table `PLACE_TO_COUNTRY` ne couvre que les lieux vus dans le flux ;
un lieu non mappé retombe sur son texte français.

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

- **Planifié / manuel / push vers `main`** → **tous** scrape + commit des données
  + build + déploiement. Un push prend donc lui aussi un snapshot frais, pour
  qu'un changement de code parte en prod avec des données à jour plutôt que de
  redéployer celles de l'heure précédente.
- **Pas de boucle infinie** : l'étape « Commit refreshed data » pousse le
  snapshot avec le `GITHUB_TOKEN` par défaut, et GitHub **ne déclenche
  volontairement aucun run** à partir d'un push fait avec `GITHUB_TOKEN` — le
  commit de snapshot ne peut donc pas re-déclencher le workflow. (N'introduisez
  pas de PAT pour ce push, sous peine de créer la boucle.)

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
- **Les onglets du fil suivent la langue choisie, Armenpress en tête.**
  `NewsBrowser` ne rend que l'onglet actif : la source par défaut (toujours
  Armenpress) est donc la seule que le prérendu injecte dans le HTML, et la
  seule que Google lit sans exécuter de JS. La règle (`buildSources`) : **chaque
  langue n'affiche que les sources qui publient dans cette langue**, Armenpress
  épinglé en premier, le reste par ordre alphabétique de marque (accents repliés,
  `é = e`, donc ArménieInfo.tv trie comme « Armenie ») :
  - `fr` → Armenpress, ArménieInfo.tv, Artzakank, California Courier, Courrier d'Erevan, Nouvelles d'Arménie
  - `en`/`hy` → Armenpress, ArmRadio, Asbarez, California Courier, Oragark
  - `ru` → Armenpress, ArmRadio, California Courier

  Les sources 100 % francophones (Courrier, armenews, artzakank, armenieinfotv)
  n'apparaissent donc que sous `fr` ; ArmRadio (`en`/`hy`/`ru`, sans édition
  française) est **retiré** sous `fr` au lieu d'y servir des titres anglais sous
  `<html lang="fr">`. Asbarez et Oragark ont chacun une édition anglaise et une
  arménienne occidentale (pas de russe), donc ils rejoignent `en`/`hy` mais pas
  `ru` — et jamais `fr`. The California Courier traduit la chronique de Sassounian
  dans une rubrique par langue, donc — comme Armenpress — il paraît dans **les
  quatre** (`en` = son fil anglais ; `fr`/`ru`/`hy` = sa chronique) : c'est le seul
  deuxième onglet que `fr` et `ru` reçoivent. Comme aucun de ces ajouts n'est
  jamais l'onglet par défaut (Armenpress reste épinglé en tête), ils ne changent
  rien au HTML prérendu. **Côté SEO c'est sûr** : Armenpress mappe 1:1 sur la langue
  d'interface, donc sous `fr` il prérend son édition française — du texte
  français sous `lang="fr"`, ce qu'une requête française doit trouver.
  (Auparavant Courrier menait pour prérendre le plus de texte français ; la règle
  par langue fait d'Armenpress la tête naturelle.) Comme le badge de langue par
  onglet vaudrait désormais toujours la langue d'interface, il a été **supprimé**
  (redondant). Ne réintroduisez pas d'onglet hors-langue sans mesurer ce que
  devient le HTML prérendu.
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
- **ArmRadio en russe (`ru.armradio.am`) est branché.** Comme en/hy, le site
  russe est derrière Cloudflare et répond **403** à l'API REST même depuis une IP
  résidentielle — il n'est donc joignable qu'à travers le **Cloudflare Worker
  `ARMRADIO_PROXY`** (`HOST_BY_LANG` route désormais `en`/`hy`/`ru`). Le site
  nommant ses catégories en russe, les slugs anglais ne résolvent pas : ses IDs
  de rubriques sont figés dans `RU_CATEGORY_IDS` (`scripts/sources/armradio.mjs`),
  exactement comme `HY_CATEGORY_IDS`. `NewsBrowser.jsx` fait alors résoudre
  `armLang` vers `ru` sous l'interface russe. **Le piège** : si le Worker n'est
  pas redéployé après un changement de `HOST_BY_LANG`, `lang=ru` renvoie
  `400 forbidden upstream` et chaque rubrique se backfille en silence — le seul
  signe est un mur ArmRadio ru figé. Redéployer : `cd proxy && npx wrangler
  deploy`.
- **Les images des cartes ArmRadio passent aussi par le Worker.** Le navigateur
  reçoit un **503** en hotlinkant les vignettes de `{en,hy,ru}.armradio.am`
  (protection anti-hotlink Cloudflare) — et wsrv.nl ne peut pas les récupérer non
  plus (Cloudflare le bloque). Le Worker, lui, les atteint depuis l'intérieur de
  Cloudflare : `armradio-worker.js` a un **mode image** (`?lang=&img=/wp-content/
  uploads/…`, allowlisté) et `NewsBrowser.jsx` route les images ArmRadio au rendu
  via `armradioImg()` (source `armProxy: true`). **Même piège que l'API** : après
  un changement de `HOST_BY_LANG` ou du mode image, `wrangler deploy` ou les
  vignettes retombent sur un motif. (Les images Armenpress, elles, hotlinkent
  directement — pas de 503.)
- Le README.md du projet est la **référence détaillée** (chaîne de sources
  armradio, curation des feeds, déploiement, proxy Cloudflare Worker).
