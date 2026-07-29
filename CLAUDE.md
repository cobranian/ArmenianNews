# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) lorsqu'il
travaille sur ce dépôt.

## Projet

**Arménie Info** (`armenieinfo.ch`) et **Armenia News** (`armenianews.org`) —
deux vitrines d'un **même instantané horaire** de la vie arménienne, servies
depuis une seule base de code. Le .ch sert le français ; le .org sert l'anglais
(`/`), l'arménien (`/hy/`) et le russe (`/ru/`). Actualités, agenda et réseaux
sociaux, dans une esthétique de journal « Apricot Press » (basalte volcanique
éclairé d'abricot), avec une bascule **jour / nuit**. À elles deux, les
vitrines couvrent quatre langues : **Français / English / Հայերեն / Русский**.

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
npm install          # installer les dépendances
npm run dev          # serveur de développement sur http://localhost:5173 (vitrine .ch, français)
npm run build        # bâtit les deux vitrines dans dist/ch/ et dist/org/
npm run build:one    # build Vite unique dans dist/ (dépannage — pas ce qui part en prod)
npm run check        # contrôle les 4 pages produites (lang, canonical, hreflang réciproques) et les 2 sitemaps/robots
npm run prerender    # cuit les 4 pages avec Puppeteer (après npm run build) pour que les crawlers lisent du HTML rempli
npm run preview      # prévisualise dist/ch (la vitrine que sert armenie-info.web.app)
npm run preview:org  # prévisualise dist/org
npm test             # 45 tests : dérivations de sites.config.js, hreflang, langues, sitemaps, cartes de partage, nombre de radios, dates arméniennes
npm run lint         # ESLint (config plate, eslint.config.js) — passe : 0 erreur, 5 avertissements connus
npm run scrape       # rafraîchir src/data/{news,agenda,meta,instagram-feed}.json depuis les sources
npm run ig-scrape    # rafraîchir le pool Instagram (local, Chrome connecté — jamais en CI)
npm run fb-scrape    # rafraîchir Don Narek (local, Chrome connecté — jamais en CI)
npm run screenshot   # après un build : capturer le carrousel Don Narek dans dist/ch/don-narek-{desktop,mobile}.png
npm run og-image     # régénérer la carte de partage du .org (local, Chrome + Google Fonts — jamais en CI)
```

Il y a désormais **45 tests** (`node --test test/*.mjs`) : ils gardent les
invariants de `sites.config.js` (une langue = une URL), la réciprocité des
`hreflang`, l'ordre du sélecteur, la forme des sitemaps, le fait que chaque
vitrine annonce **sa** carte de partage, la concordance entre le tableau
`STATIONS` et les six textes qui annoncent un nombre de radios, et la
conformité des tables de dates arméniennes au CLDR (`test/hy-date.test.mjs`,
voir « À savoir ») — aucun ne touche le réseau. Le lint et l'exécution réelle
des scripts complètent la vérification.

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

**Les 5 avertissements restants sont connus et assumés** — ne les « corrigez »
pas mécaniquement :

- `Radio.jsx` (×2, `react-hooks/exhaustive-deps`) — le correctif que suggère la
  règle (capturer `audioRef.current` au montage) **introduirait un bug** : ce
  `useEffect` de démontage veut la référence au moment du démontage, pas celle
  figée au montage.
- `motifs.jsx` (×2) et `i18n.jsx` (×1, `react-refresh/only-export-components`) —
  ces fichiers exportent un composant **et** un hook ou des constantes. C'est le
  motif React standard pour un contexte ; l'avertissement ne concerne que le
  rafraîchissement à chaud en développement.

  `i18n.jsx` en portait **deux** — `LANGS` déclaré en dur et `useI18n` — sur les
  quatre que totalisait la ligne combinée avec `motifs.jsx`. La liste vit
  désormais dans `sites.config.js` (racine), parce que Node doit pouvoir la
  lire sans passer par un parseur JSX ; `i18n.jsx` se contente de la
  **ré-exporter** (`export { LANGS }`), et une ré-exportation ne déclenche pas
  la règle. Le décompte a donc **baissé** de 6 à 5 : c'est une amélioration, pas
  une régression. Ne remettez pas `LANGS` en dur dans `i18n.jsx` pour
  « simplifier » — cela recasserait le build à deux vitrines et les tests qui
  vérifient que `sites.config.js` et `LANGS` décrivent les mêmes langues.

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
    - **Ce module utilise `fetchTextNode` (node:https), pas `fetchText`**, et
      c'est délibéré : les pages de rubrique répondent **403 au `fetch` de Node
      (undici)** et 200 à `node:https` — même machine, même TLS OpenSSL, même
      HTTP/1.1, quels que soient les en-têtes. La raison est dans
      `scripts/lib/http.mjs`. Basculer sur `fetchText` ferait échouer les 28
      rubriques, que le backfill masquerait ensuite en silence. **CivilNet tombe
      exactement dans le même piège** — d'où l'aide partagée, qui n'existait pas
      quand Armenpress était seul concerné.
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
    donc c'est **l'une des trois sources quadrilingues**, avec Armenpress et
    CivilNet. Mapping
    (une rubrique par langue) : `en` → `mainpost` (le fil d'actualité anglais,
    qui contient aussi sa chronique anglaise — la rubrique `sas-column` propre à
    l'anglais s'est arrêtée en 2021, sans équivalent frais isolable) ; `fr` →
    `french` ; `ru` → `russian` ; `hy` → `eastern-armenian`. Les libellés sont
    **fixés à la main** (les noms de rubrique WordPress sont des noms de langue —
    « French », « Russian » — ou « mainpost », inutilisables comme titres) et
    portés dans les données. Images hotlinkées en direct.
  - `civilnet.mjs` — CivilNet (civilnet.am), la rédaction indépendante d'Erevan.
    **Troisième source quadrilingue** (fr/en/hy/ru, 1:1 avec la langue
    d'interface, comme Armenpress) — et le deuxième onglet que fr et ru
    reçoivent, à côté du California Courier. Application **Inertia.js** comme
    Armenpress : le flux est embarqué en JSON, **aucun sélecteur CSS**. Trois
    choses à retenir :
    - **Le chemin du payload n'est pas celui d'Armenpress.** Les articles vivent
      dans `props.feed.data.hits` (composant de page `feed/Tag`), pas dans
      `props.data.data.hits`. Recopier le chemin d'Armenpress lit « rubrique
      vide ».
    - **Les quatre éditions n'ont pas la même liste de rubriques** (5 en fr, 8 en
      en, 7 en hy, 6 en ru) : pas de desk monde ni opinions en français, et
      « Իրավունք » (droits) là où les autres ont Société. Chaque libellé vient du
      payload (`props.structure.tag.name`), déjà dans la langue de la page, donc
      il est **porté dans les données** comme pour asbarez/oragark — pas de clés
      i18n.
    - **Même piège 403 qu'Armenpress** : `fetch` (undici) → 403, `node:https` →
      200. D'où `fetchTextNode`. Un article n'a pas de slug, seulement un
      `article_id` : `/{lang}/news/{id}` est l'adresse stable (elle sert
      l'article ou redirige vers sa page canonique, `/video/{id}` pour une
      vidéo), et l'id est **propre à son édition** — un id anglais sous `/hy/`
      fait 404. Images hotlinkées en direct (pas de protection anti-hotlink,
      contrairement à ArmRadio).
  - `armenopole.mjs` — Agenda (Suisse + monde). Scrape **tous les pays de la nav
    d'armenopole** (26, hors Suisse gérée à part), en plafonnant chaque pays à 20
    événements, puis dédoublonne par URL. **N'utilise pas `greece`/`belgium`** :
    ce ne sont pas de vraies pages pays (elles renvoient un flux générique
    identique — Erevan/Angleterre/Chypre mêlés — d'où l'ancien « slug non
    fiable »). Alimente le sélecteur de pays de l'agenda (voir « L'exception »
    plus bas).
  - `instagram.mjs` — sélection aléatoire depuis le pool Instagram, **par
    brin** : chaque compte déclare son `group` (`institutions` | `personnalites`,
    8 comptes chacun) et le tirage prend `limit` posts **par groupe**, pas
    `limit` en tout — sinon le groupe le plus fourni chasserait l'autre de son
    propre carrousel. Le job horaire appelle `selectInstagram(30)`, donc 60 posts
    dans `instagram-feed.json`.
- **`scripts/fb-scrape.mjs`** — rafraîchit Don Narek (Facebook). **Étape manuelle
  locale**, pas horaire : Facebook exige une session connectée et bloque la CI.
- **`scripts/ig-scrape.mjs`** — rafraîchit le pool Instagram. **Étape manuelle
  locale**, pas horaire : Instagram exige une session connectée et bloque la CI.
  Récolte les **9 derniers posts** de chacun des **16 comptes curés** (144 posts,
  138 shortcodes distincts — `nemrabandofficial` et `van.nemra` sont
  collaborateurs, et un post COLLAB vit sur les deux grilles sous le **même**
  shortcode), datés, et télécharge leurs images dans `src/data/ig/`. Le job horaire ne fait
  que **re-mélanger** ce pool : sans récolte, le mur re-sert indéfiniment les
  mêmes posts tout en ayant l'air frais.
- **`scripts/shoot.mjs`** — capture d'écran du carrousel Don Narek (Puppeteer).

**Les deux vitrines** — `sites.config.js` (racine) est la source de vérité :
hosts, marques, pages, langues. Tout en dérive — métadonnées HTML, `hreflang`,
sitemaps, cibles Firebase, ordre du sélecteur de langue, jeton d'audience.

- `scripts/lib/site-meta.mjs` génère le `<head>` d'un couple (site, langue).
  Appelé par le plugin `siteMeta()` de `vite.config.js` pour la page par défaut
  de chaque site, **et** par `scripts/build-sites.mjs` pour dériver `/hy/` et
  `/ru/`. Un seul générateur pour les quatre pages : des `hreflang` divergents
  sont ignorés en bloc par Google. Il pose aussi la balise **Cloudflare Web
  Analytics** (marqueur `<!--CF_BEACON-->` dans `index.html`) à partir du
  `cfBeaconToken` de la vitrine : **un jeton par site**, donc deux tableaux de
  bord. `applyMeta` **refuse** un HTML privé de l'un ou l'autre marqueur —
  supprimer `<!--CF_BEACON-->` couperait la mesure des deux vitrines sans
  qu'aucun build ne s'en plaigne.
- **La carte de partage (`og:image`) est propre à chaque vitrine**, décrite par
  `ogImage` dans `sites.config.js` : `/og-image.jpg` pour le .ch (français),
  `/og-image-org.jpg` pour le .org (anglais). Les deux noms sont
  **asymétriques à dessein** — le .ch garde le sien parce que Facebook et
  WhatsApp l'ont déjà en cache, le .org en prend un neuf justement pour casser
  ce cache, puisqu'il servait jusqu'ici la carte française. Elle suit la
  **vitrine et non la langue** : les trois pages du .org partagent la carte
  anglaise, la marque étant unique par domaine.
  `scripts/og-image.mjs` (`npm run og-image`) la régénère depuis la marque de
  `sites.config.js` et les baselines d'`i18n` — **étape manuelle locale**, elle
  a besoin d'un Chrome et des Google Fonts. Deux pièges y sont désamorcés :
  `--force-color-profile=srgb` **ne suffit pas** à éviter le profil ICC que
  Chrome écrit en APP2 (d'où `stripIcc()` — sans quoi WhatsApp cesse d'afficher
  l'aperçu, en silence, cf. README), et il faut attendre `document.fonts.ready`
  ou la capture part en polices de secours. Ne relancez pas le script sur `ch` :
  sa carte lui est antérieure et son URL est déjà partagée.
  `npm run check` vérifie que chaque page annonce **sa** carte, **aucune carte
  étrangère**, et que le fichier existe vraiment dans `dist/` — une balise
  parfaite pointant sur un fichier absent servirait de l'`index.html` en 200,
  que les scrapers lisent comme une image cassée. Les deux `dist/` contiennent
  **les deux** fichiers (Vite copie tout `public/`) : c'est sans conséquence,
  chaque vitrine ne référence que le sien.
- **Les pages autonomes** (`pages/`) sont des HTML complets hors du bundle
  React — aujourd'hui les cartes de liens à partager sur les réseaux. La liste
  vit dans `sites.config.js` (`standalone`), **par vitrine**, et
  `build-sites.mjs` copie `pages/<nom>.<siteId>.html` vers
  `dist/<siteId>/<nom>.html` :

  | Fichier | Servi à | Affiche |
  |---|---|---|
  | `pages/lien.ch.html` | `armenieinfo.ch/lien.html` | armenieinfo**.ch** |
  | `pages/lien-fr.ch.html` | `armenieinfo.ch/lien-fr.html` | armenieinfo**.fr** |
  | `pages/lien.org.html` | `armenianews.org/lien.html` | armenianews.org |

  **Elles ne peuvent pas vivre dans `public/`** : Vite copie ce dossier dans les
  **deux** `dist/`, donc la carte française atterrirait aussi sur
  armenianews.org — en français, sous un domaine anglais, sans qu'aucun build
  ne s'en plaigne. Même piège que la carte de partage avant qu'elle ne devienne
  propre à chaque vitrine. La liste est **par site** et non globale : le `.org`
  n'a pas d'équivalent de `lien-fr`, et une liste unique l'y ferait chercher un
  fichier absent.

  `lien` affiche le domaine qui la sert — son URL et son contenu concordent.
  `lien-fr` est la même carte tournée vers le public français, d'où son
  **`noindex`** : deux pages françaises quasi identiques sur un même domaine,
  c'est du contenu dupliqué. Le `noindex` ne gêne en rien le partage social,
  Facebook et WhatsApp lisant l'Open Graph et non la directive robots.

  Un fichier manquant **interrompt le build**. Sans cela il se déploierait en
  silence, et Firebase répondrait à son URL par `index.html` en 200 — donc
  l'application entière au lieu d'un 404 franc. `npm run check` vérifie en
  outre, pour chaque carte, le `<html lang>`, le canonical (propre à **cette**
  page), l'`og:image` et l'absence du domaine ou de la carte du voisin.

  **Le nombre de radios est écrit en toutes lettres** dans ces cartes et dans
  les quatre `radio.subtitle` (`t()` ne sait pas interpoler). Rien ne les relie
  au tableau `STATIONS` de `Radio.jsx` : `test/radio-count.test.mjs` compte les
  stations et échoue si les six textes divergent. Sans lui, une douzième
  station ferait mentir six textes en quatre langues, en silence.
- `scripts/build-sites.mjs` orchestre deux `vite build` (un par site, dans des
  processus fils — la config de Vite est mise en cache par processus), dérive
  les pages supplémentaires à partir du HTML déjà bâti (pas un rebuild par
  page — juste un échange de métadonnées entre les sentinelles que pose
  `site-meta.mjs`), puis écrit sitemap et robots par vitrine. Une assertion en
  tête du script vérifie que `sites.config.js` et `LANGS` décrivent
  exactement les mêmes langues — sans elle, ajouter une cinquième langue à
  `LANGS` la rendrait traduite partout et joignable nulle part, en silence.
- `src/seo.js` porte les chaînes de titre et de description par langue. **JS
  plat, sans React**, parce que Node doit les lire pour générer `/hy/` et
  `/ru/` hors du bundle. Même raison que `src/worldPlace.js` — ne le
  reconsolidez pas dans `i18n.jsx`.
- `src/site.js` porte `SITE_ID` (quelle vitrine ce build produit, posé par
  `scripts/build-sites.mjs` via `VITE_SITE_ID` ; `npm run dev` n'en pose pas et
  travaille donc sur le .ch) et `orderedLangs()`, qui place la langue de tête
  du domaine en premier dans le sélecteur sans changer l'ordre relatif des
  autres — sur les trois pages du .org la barre reste « EN FR ՀԱՅ РУ », seule
  la mise en évidence se déplace. Module plat lui aussi, pour la même raison
  que `src/seo.js` : y ajouter ces exports dans `i18n.jsx` ferait remonter le
  lint d'un avertissement `react-refresh` de plus (voir la section Lint).
- `src/hyDate.js` porte les **noms de mois et de jours arméniens écrits en
  dur**, plus les trois formateurs qui s'en servent. Quatrième module plat, même
  raison que les deux précédents. Le pourquoi est dans « À savoir » ci-dessous :
  `Intl` ne sait pas rendre `hy-AM` dans un navigateur. **Toutes** les dates
  affichées passent par les formateurs du contexte i18n
  (`formatDate`, `formatDayNum`, `formatMonthAbbr`, `formatWeekdayTime`) : le
  `locale` que `useI18n()` expose encore ne doit **jamais** servir à formater
  une date.

**Internationalisation** — `src/i18n.jsx` expose un contexte React
(`useI18n()` → `{ t, lang, formatDate, locale }`) avec les dictionnaires
**fr / en / hy / ru**. `LANGS` vit dans `sites.config.js` et `i18n.jsx` se
contente de le ré-exporter (voir la section Lint) ; ajouter une langue touche
donc trois fichiers : une entrée dans `LANGS` **et** une page dans `SITES`
(`sites.config.js`), un bloc `STRINGS` complet (mêmes clés que `fr`, sinon
repli silencieux sur le français) et son `LOCALES` (`i18n.jsx`), et un bloc
`SEO` avec son `OG_LOCALE` (`src/seo.js`). **La langue vient de l'URL, plus de
`localStorage`** : chaque langue a sa propre adresse, et `LanguageProvider` la
lit une fois au montage via `langFromPath(SITE_ID, location.pathname)` — il n'y
a plus de `setLang` à appeler, le sélecteur de `Nav.jsx` est un jeu de liens
(`<a href={LANG_URL[l.code]}>`) qui navigue vers l'URL de chaque langue. Seul
le **chrome de l'interface** est traduit ; le **contenu** (articles, posts)
reste dans sa langue d'origine — un lecteur russe voit Armenpress **et**
ArmRadio en russe, mais Courrier (et les autres sources francophones) en
français, et Courrier reste le premier onglet (comme pour hy). Le français est
la langue par défaut et doit porter tous ses accents (é, è, à, ê, ç…).

**Le sélecteur de pays de l'agenda.** L'agenda est **un seul carrousel piloté
par une liste déroulante** (`src/components/Agenda.jsx`) : **tous les pays sont
sur le même rang**, triés par nom localisé. La Suisse n'est **plus épinglée en
tête** — elle prend sa place alphabétique comme les autres, pour que le menu
porte le même cadrage « le monde d'abord » que la baseline du Hero et le
sous-titre de la section.

**Mais elle reste le pays ouvert au chargement**, et cette dissociation est
délibérée : **l'ordre porte le positionnement, le défaut porte l'usage**. Ne
« simplifiez » pas le `useState('switzerland')` en `order[0]` — la clé de tri
étant le **libellé traduit**, `order[0]` désigne un pays différent selon la
langue (Allemagne en fr, Argentina en en, ԱՄԷ en hy, Австралия en ru). La même
page ouvrirait alors sur un pays arbitraire, et pas le même d'une URL à
l'autre. Le repli sur `order[0]` ne sert qu'au cas où la Suisse n'a aucun
événement à venir, pour que le carrousel ne soit jamais vide.
**Le menu ne liste que les pays qui ont réellement des événements à venir** —
Arménie (Erevan) comprise, car armenopole recense beaucoup d'événements d'Erevan
sur ses pages diaspora. Les événements « monde » sont **regroupés par le pays
résolu depuis le texte `location`**, pas par le slug de la page : le même
événement est recensé sur plusieurs pages pays (donc `country` est souvent la
communauté qui organise, pas le lieu), et Agenda **dédoublonne par URL** pour ne
pas resservir 2-3 copies du même événement. `scripts/sources/armenopole.mjs`
scrape **les 26 pays de la nav d'armenopole** (plafonnés à 20 événements chacun)
et dédoublonne aussi à la source — le menu couvre donc tout ce que le site
propose, en se purgeant des pays sans événement.

`src/worldPlace.js` porte cette résolution : `worldCountryKey(ev)` donne la clé
canonique (`location` d'abord — « Erevan » → `armenia`, « Angleterre » →
`unitedkingdom` —, puis le slug `country`, et en dernier recours le texte brut
plié), `countryLabel(key, lang)` / `countryFlag(key)` la rendent. **Le nom de
pays du sélecteur EST localisé dans les quatre langues** (fr compris) : c'est du
chrome d'interface (un libellé de contrôle), pas du contenu d'article. Le
**badge** de chaque carte, lui, garde le texte `location` brut (« Genève »,
« Erevan », « Angleterre ») pour toutes les langues — non redondant avec le pays
du menu, et fidèle au « Le Pays reste en Français ». Résoudre depuis `location`
avant le slug corrige au passage une donnée fausse (un événement en Angleterre
listé sous le slug `greece`). Ce module reste **volontairement un `.js` à part,
pas dans `i18n.jsx`** : y ajouter un export non-composant ferait passer le lint
de 5 à 6 avertissements `react-refresh` (voir la section lint) — même piège que
`src/seo.js` et `src/site.js` ci-dessous. Ne le reconsolidez
pas dans `i18n.jsx`. La table `PLACE_TO_COUNTRY` ne couvre que les lieux vus dans
le flux ; un lieu non mappé forme sa propre clé, étiquetée depuis son texte brut.
Le drapeau emoji dégrade en code-pays à deux lettres sous Windows (pas de drapeaux
emoji) — lu comme un tampon « dateline », c'est assumé.

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
- Schéma du pool Instagram :
  `accounts: [{ handle, name, url, group, posts: [{url, date}] }]`, où `group`
  vaut `institutions` ou `personnalites` et décide de quel carrousel le compte
  relève (absent = `institutions`). Le scraper réécrit les `posts` — **jamais**
  le tableau `accounts`.
- Les images bundlées vivent dans `src/data/ig/` (Instagram) et `src/data/fb/`
  (Facebook) : incluses au build, donc jamais de hotlink ni d'expiration. Sans
  image, une tuile affiche un **motif arménien déterministe** (voir
  `src/components/motifs.jsx`).

## Déploiement

`.github/workflows/hourly.yml` s'exécute **toutes les heures** (UTC), plus sur
dispatch manuel et sur push vers `main` :

- **Planifié / manuel** → scrape + commit des données + build + déploiement (un
  snapshot par heure).
- **Push vers `main`** → build + déploiement seulement (**le scrape est sauté**),
  pour qu'un changement de code ou de docs parte en prod vite, sans passer 3-4 min
  à re-scraper ni créer un snapshot en trop. Pour un snapshot frais à la demande,
  lancez le run manuel `workflow_dispatch`.

Les deux vitrines se déploient sur **Firebase Hosting**, mais dans **deux
projets Firebase distincts** — c'est le point le plus surprenant de ce
déploiement :

| Vitrine | Site Firebase | Projet | Secret CI |
|---|---|---|---|
| armenieinfo.ch | `armenie-info` | `armenie-info` | `FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO` |
| armenianews.org | `armenia-news-org` | `armenia-news-b146e` | `FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO` (le même) |

**Trois conséquences qu'il faut avoir en tête avant de toucher au déploiement.**

*Un compte de service n'a **par défaut** de droits que sur son propre projet.*
Ici, **un seul secret dessert les deux** : le compte appartient à `armenie-info`
et s'est vu accorder le rôle Firebase Hosting Admin **sur `armenia-news-b146e`
aussi** (console Cloud → IAM du second projet → Accorder l'accès). Sans cette
autorisation croisée, le déploiement du `.org` échouerait sur une erreur
d'autorisation muette sur sa cause — d'où la garde qui vérifie le secret avant
la première commande.

> Si ce rôle croisé est un jour révoqué, il faudra un second secret et un
> `GOOGLE_APPLICATION_CREDENTIALS` réassigné à chaque tour de boucle. Le
> compromis : une clé unique portant Hosting Admin sur deux projets élargit la
> portée en cas de fuite ; deux clés distinctes la cloisonnent mais doublent
> l'entretien. Le choix actuel est le premier, assumé.

*`firebase.json` désigne ses entrées par `site`, pas par `target`.* Les cibles
`.firebaserc` se déclarent **par projet**, ce qui obligerait à en tenir deux
tables cohérentes ; un nom de site est unique à l'échelle mondiale et désigne
donc son site sans ambiguïté, quel que soit le projet. `.firebaserc` ne garde
que `projects.default`.

*Le déploiement boucle site par site* plutôt que de les combiner en une
commande : Firebase rejette une publication dont le contenu est identique à la
version en ligne (un no-op réussi, pas un échec) — site par site, ce verdict ne
porte que sur celui-ci, alors qu'une sortie combinée ferait confondre l'échec
réel de l'un avec le no-op bénin de l'autre.

> **Ces noms ont bougé deux fois — ne vous fiez qu'au tableau ci-dessus.** Un
> site `armenianews-org` a d'abord été créé dans `armenie-info`, `armenia-news`
> y étant indisponible : ce nom était réservé par un projet du même compte. Ce
> projet a ensuite été supprimé par erreur et recréé sous l'identifiant
> `armenia-news-b146e`, ce qui a emporté son site avec lui. Le site
> `armenianews-org` de `armenie-info` subsiste, inutilisé, et peut être
> supprimé. Firebase réserve les noms d'un projet supprimé une trentaine de
> jours, d'où les tâtonnements de nommage visibles dans l'historique git.

Vite `base`
vaut `/` par défaut sur les deux (chaque domaine sert depuis sa propre racine) ;
surchargez avec `BASE_PATH=/sous-chemin` pour un sous-chemin — surtout utile
avec `build:one`, le build Vite unique de dépannage, puisque les deux vitrines
de production servent toujours depuis la racine de leur domaine.

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
  des seize comptes suivis sont dormants (`ig_armenia` n'a rien publié depuis
  juin 2023, `armeniancuisine` depuis novembre 2025), deux autres sont lents
  (`haykmiqayelyanart` depuis février 2026, `abgarart` depuis mars 2026) : leurs
  vieux posts apparaissent sur le
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
  - `fr` → Armenpress, ArménieInfo.tv, Artzakank, California Courier, CivilNet, Courrier d'Erevan, Nouvelles d'Arménie
  - `en`/`hy` → Armenpress, ArmRadio, Asbarez, California Courier, CivilNet, Oragark
  - `ru` → Armenpress, ArmRadio, California Courier, CivilNet

  Les sources 100 % francophones (Courrier, armenews, artzakank, armenieinfotv)
  n'apparaissent donc que sous `fr` ; ArmRadio (`en`/`hy`/`ru`, sans édition
  française) est **retiré** sous `fr` au lieu d'y servir des titres anglais sous
  `<html lang="fr">`. Asbarez et Oragark ont chacun une édition anglaise et une
  arménienne occidentale (pas de russe), donc ils rejoignent `en`/`hy` mais pas
  `ru` — et jamais `fr`. The California Courier traduit la chronique de Sassounian
  dans une rubrique par langue, donc — comme Armenpress — il paraît dans **les
  quatre** (`en` = son fil anglais ; `fr`/`ru`/`hy` = sa chronique). CivilNet
  publie une édition complète dans chacune des quatre, donc il y paraît aussi :
  `fr` et `ru` reçoivent ces deux-là en plus d'Armenpress. Comme aucun de ces ajouts n'est
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
- **La langue vient de l'URL, plus de `localStorage`.** Chaque langue a son
  adresse (`sites.config.js`) et l'URL fait autorité. Restaurer la langue
  depuis `localStorage` ferait basculer au montage une page dont le HTML
  prérendu et l'attribut `<html lang>` disent autre chose : flash de contenu et
  attribut mensonger. Googlebot n'ayant pas de `localStorage`, l'écart serait
  **invisible en test** et bien réel en production. La clé `theme`, elle, reste.
- **`Intl` ne sait pas rendre l'arménien dans un navigateur, et Node si.** C'est
  l'asymétrie la plus traître du dépôt. `Intl.DateTimeFormat('hy-AM')` ne
  *résout* pas dans l'ICU de Chrome, qui n'embarque pas les données de date
  arméniennes : il retombe sur la langue **du lecteur**, pas sur l'anglais. Un
  lecteur allemand voyait donc une date allemande sur `/hy/`. Mesuré :
  `…('hy-AM').resolvedOptions().locale` → `'fr'` depuis un Chrome français.
  **Node, lui, a l'ICU complet** et rend correctement « 29 հուլիսի, 2026 թ. » —
  donc aucun test côté Node ne pouvait voir la panne, et `npm run prerender`
  cuisait dans la page la langue du Chrome de la CI. D'où `src/hyDate.js`, qui
  écrit les mois et les jours **en dur** plutôt que de détecter la panne : une
  bascule conditionnelle ferait dépendre le HTML de la machine qui le produit,
  et c'est exactement la classe de bug qu'on répare.
  `test/hy-date.test.mjs` confronte les tables au CLDR **via l'ICU de Node** —
  la même asymétrie, retournée en outil. Le défaut touchait deux endroits, et le
  second s'était fait oublier : le bandeau de date du héros **et** les pastilles
  de l'agenda (`Agenda.jsx`), qui appelaient `toLocaleDateString(locale, …)` en
  direct. Ne rouvrez pas ce trou en formatant une date hors des formateurs du
  contexte.
- **La marque arménienne s'écarte volontairement du domaine.** `/hy/` affiche
  « Armenia Info » là où `/` et `/ru/` affichent « Armenia News »
  (`STRINGS.hy['site.title']`, `src/i18n.jsx`). C'est la **seule** entorse à la
  règle « la marque suit le domaine » que porte `sites.config.js`, et elle a une
  conséquence à connaître : `SITES.org.brand` reste « Armenia News », donc le
  `<title>`, l'`og:title` et le JSON-LD de `/hy/` annoncent toujours « Armenia
  News ». L'écart entre le texte **vu** et les **métadonnées** est assumé et
  demandé. Ne « corrigez » pas un seul des deux côtés en croyant réparer une
  incohérence : les deux valeurs sont voulues. Pour les aligner il faudrait une
  marque par langue dans `sites.config.js`, ce qui touche le SEO et la carte de
  partage (un JPG cuit qui dit « Armenia News »).
- **Les `hreflang` doivent rester réciproques.** Les quatre `alternate` plus
  `x-default` sont identiques sur les quatre pages, chacune se citant
  elle-même. Une page absente de son propre bloc fait ignorer **tout** le bloc
  par Google — silencieusement. C'est pourquoi un seul générateur les produit.
- **Le bloc `headers` de `firebase.json` est dupliqué** entre les deux cibles,
  CSP comprise. Ajouter un host de flux radio à `media-src` d'un seul côté
  passe la préversion et casse la lecture en production sur l'autre domaine.
  Modifier les deux, toujours.
- **Le jeton Cloudflare Web Analytics est propre à chaque vitrine.** La balise
  était autrefois codée en dur dans `index.html` — fichier partagé par les deux
  sites — donc armenianews.org versait ses visites dans le tableau de bord
  d'armenieinfo.ch, séparables seulement en filtrant par hôte. Elle est
  désormais générée depuis `cfBeaconToken` (`sites.config.js`), et `npm run
  check` vérifie que chaque page porte **son** jeton et **aucun jeton
  étranger** : c'est ce second contrôle qui compte, parce qu'un jeton du voisin
  se mesure sans la moindre erreur, simplement au mauvais endroit. Le jeton
  n'est pas un secret (il part en clair dans le HTML), et `null` est une valeur
  valable : aucune balise n'est alors émise. Aucun des deux domaines n'étant
  proxifié par Cloudflare (les deux pointent sur Firebase), il n'y a pas
  d'activation automatique au niveau de la zone — le beacon JS est la seule
  voie.
- **L'ID de mesure GA4 est propre à chaque vitrine, lui aussi — et il ne l'a pas
  toujours été.** `G-EB3W5XXSMW` était écrit en dur dans `index.html` **et**
  dans `public/ga-init.js`, deux fichiers que Vite copie à l'identique dans les
  deux `dist/` : armenianews.org était donc mesuré, mais dans la propriété
  « Arménie Info » — `/hy/` et `/ru/` compris, ce qui se voyait dans son rapport
  *Pages et écrans* puisque ces deux chemins n'existent que sur le .org. Trois
  propriétés GA vides avaient été créées en face, dont aucune ne recevait un
  seul hit. Depuis, l'ID vit dans `gaMeasurementId` (`sites.config.js`) et la
  paire de balises est générée par `site-meta.mjs` au marqueur `<!--GA_TAG-->`,
  exactement comme le beacon. Trois choses à ne pas défaire :
  - **`ga-init.js` reçoit l'ID par `data-ga-id`, pas par un `<script>` en
    ligne** : la CSP est en `script-src 'self'` sans `'unsafe-inline'`, un
    script en ligne serait bloqué. Il le relit via `document.currentScript`, qui
    n'est défini que pour un script **classique et synchrone** — n'ajoutez ni
    `async`, ni `defer`, ni `type="module"` à cette balise.
  - **`ga-init.js` doit précéder `gtag.js`.** `gtag.js` traite la file
    `dataLayer` dès son exécution : inversées, les deux balises restent
    présentes mais le premier hit part sans état de consentement — donc avec
    cookies là où le RGPD les interdit. Un test et `npm run check` gardent
    l'ordre, parce qu'un contrôle de simple présence ne le verrait pas.
  - **Le .ch garde `G-EB3W5XXSMW`** : c'est là qu'est son historique. Le .org a
    sa propre propriété (« Armenia News », `G-N6STD6Z5CC`), créée le 29 juillet
    2026 — elle démarre donc vide, et le trafic .org antérieur reste chez
    « Arménie Info ». Cette coupure est attendue, ce n'est pas une perte.
- **Le `lastmod` des sitemaps vient de `meta.json.generatedAt`**, jamais de
  l'heure du build. Un push sur `main` rebâtit sans scraper ; un `lastmod` pris
  au build annoncerait une fraîcheur qui n'a pas eu lieu. C'est la garde que
  portait `scripts/scrape.mjs` avant le déplacement — elle tient toujours, elle
  a juste changé de fichier (`scripts/lib/sitemap.mjs`).
- **`hreflang` ne transfère aucune autorité entre les domaines.** Il fait servir
  la bonne langue et empêche la déduplication ; ce n'est pas un signal de
  classement. `armenianews.org` démarre avec l'autorité d'un domaine neuf : un
  décollage lent est normal, pas un bug.
- **Un changement de layout de `dist/` atteint des scripts qu'aucune tâche ne
  touche.** `npm run preview` et `npm run screenshot` (`scripts/shoot.mjs`)
  servaient et écrivaient dans `dist/` racine ; depuis le découpage en deux
  vitrines, `dist/` n'a plus de `index.html` propre (seuls `dist/ch/` et
  `dist/org/` en ont un) — les deux se seraient cassés en silence. Les deux
  ciblent désormais `dist/ch`, la vitrine que sert réellement
  `armenie-info.web.app` (ce qui garde justes les URL d'image documentées dans
  le README). L'étape de capture d'écran est `continue-on-error: true` en CI :
  sans ce correctif, elle aurait échoué **toutes les heures**, sans jamais
  faire échouer le job ni alerter personne.
- **Une troisième liste de langues existe, et elle n'est pas fausse.**
  `ARMENPRESS_LANGS` (`scripts/sources/armenpress.mjs`) est distincte de
  `LANGS` et `ALL_LANGS` (`sites.config.js`) : elle décrit les éditions
  Armenpress à scraper, pas les langues d'interface — une distinction qui tient
  aujourd'hui parce que les deux listes se recouvrent exactement. L'assertion
  de `scripts/build-sites.mjs` ne couvre que `sites.config.js` et `LANGS`.
  Ajouter une cinquième langue d'interface sans toucher `ARMENPRESS_LANGS`
  laisserait Armenpress scraper une édition manquante en silence pour cette
  langue — rien ne le rappellera. `CIVILNET_SECTIONS`
  (`scripts/sources/civilnet.mjs`) est un quatrième tableau du même genre : ses
  clés sont les éditions CivilNet, et ses valeurs les rubriques propres à
  chacune. Même angle mort, même conséquence.
