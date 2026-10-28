---
name: toucher-une-source
description: Use before changing, debugging or adding a news/agenda/social source scraper on this repo (armenieinfo.ch / armenianews.org) — anything in scripts/sources/, scripts/ig-scrape.mjs, scripts/fb-scrape.mjs, scripts/lib/http.mjs, the proxy Workers, or when a source looks frozen, undated, imageless or empty. Holds each source's payload paths, 403/Cloudflare traps, proxies, date derivations and harvest rules, all measured in production.
---

# Toucher une source

Le détail, source par source, de ce que `CLAUDE.md` ne garde qu'en table. Tout
y a été **payé** : une panne vue en production, souvent après des jours de
silence, parce que le backfill ressert l'instantané précédent sans un mot.

Avant de conclure qu'un module marche, lancez-le **depuis la CI** autant que
depuis le poste (`gh workflow run hourly.yml`, puis
`gh run view <id> --log | grep '✗'`) : plusieurs sites répondent 200 à une IP
résidentielle et 403 à un runner.

## Les modules de `scripts/sources/`, un par un

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
  - **Le User-Agent ne doit PAS se dire « Chrome »** (ni aucun navigateur
    versionné). Depuis le 9 septembre 2026, Cloudflare répond 403 sur
    Armenpress, CivilNet et les quatre hôtes NEWS.am à tout UA qui annonce
    Chrome sans en avoir l'empreinte TLS — ce que Node n'a jamais. Le dépôt a
    servi **treize jours** de dépêches figées, 40 runs « success » d'affilée,
    avant qu'un lecteur ne le voie : le backfill masque les 403 et rien ne
    les compte. `UA` (`scripts/lib/http.mjs`) s'identifie désormais comme
    `ArmenieInfo/1.0`, et `test/http-ua.test.mjs` interdit le retour d'un UA
    de navigateur. Le premier réflexe devant un mur figé reste le même :
    `gh run view <id> --log | grep '✗'`.
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
  anglais, mais l'étagère ArmRadio du navigateur d'actualités suit la langue
  (ru via `ru.armradio.am`, voir plus bas).
- `asbarez.mjs` — Asbarez, le quotidien arménien de Los Angeles, en **deux
  éditions** : anglaise (`asbarez.com`, 7 rubriques) et arménienne occidentale
  (`asbarez.am`, 5 rubriques). Servi sous **en/hy uniquement** (pas d'édition
  française ni russe) — c'est `TAB_ORDER` (`src/newsSources.js`) qui l'attribue aux langues.
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
    `hy`), donc router un libellé unilingue à travers les six dictionnaires
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
- `armenianweekly.mjs` — The Armenian Weekly (armenianweekly.com), l'hebdomadaire
  anglophone de la FRA, publié depuis Watertown (Massachusetts). Servi sous
  **`en` seulement** — pas d'édition arménienne, russe ni française — donc il
  renvoie une **liste plate** d'étagères, comme Courrier, et non une carte par
  langue. Install WordPress REST ouverte comme oragark : ni Cloudflare, ni
  filtre UA, `fetch` (undici) répond 200, images hotlinkées en direct (~77 ko
  en `medium_large`, donc ni wsrv ni proxy). Sept rubriques, libellés portés
  dans les données.
  - **Le piège** : la page d'archive d'une rubrique WordPress (`/news/`) inclut
    les **sous-catégories**, le paramètre `categories` de l'API REST **non**.
    Le Weekly classe l'essentiel de son quotidien sous des enfants de News
    (`headline`, `announcements`, `briefs`), donc `categories=14` seul rend des
    étagères pleines, correctement datées et illustrées — simplement **six
    jours en retard** sur la page qu'ouvrirait un lecteur (mesuré le 12 août
    2026 : News 08-06 contre 08-12, Diaspora 08-07 contre 08-12). Rien ne
    tombe : ni requête, ni parseur, ni test. Le module résout donc les
    descendants depuis l'**arbre vivant** à chaque instantané, plutôt qu'une
    liste d'ids figée qui viderait une rubrique le jour où le site ajoute une
    sous-catégorie.
- `californiacourier.mjs` — The California Courier (thecaliforniacourier.com),
  l'hebdomadaire arménien de Glendale. Une install WordPress REST, comme
  oragark. **Son atout : la chronique de Harut
  Sassounian est traduite dans une rubrique fraîche et illustrée par langue** —
  donc c'est **l'une des trois sources quadrilingues**, avec Armenpress et
  CivilNet. Mapping
  (une rubrique par langue) : `en` → `mainpost` (le fil d'actualité anglais,
  qui contient aussi sa chronique anglaise — la rubrique `sas-column` propre à
  l'anglais s'est arrêtée en 2021, sans équivalent frais isolable) ; `fr` →
  `french` ; `ru` → `russian` ; `hy` → `eastern-armenian`. Les libellés sont
  **fixés à la main** (les noms de rubrique WordPress sont des noms de langue —
  « French », « Russian » — ou « mainpost », inutilisables comme titres) et
  portés dans les données. **Ses images ne se hotlinkent plus** : depuis le
  17 octobre 2026, Cloudflare défie tout navigateur (et wsrv, et i0.wp.com)
  mais pas les runners GitHub. Le scrape les recopie donc dans `public/cc/`
  (`scripts/lib/mirror-images.mjs`), **commité** par le job horaire — un push
  rebâtit sans scraper. Un scrape local, défié lui aussi, met `image: null`
  aux nouvelles : motif, sans panne. Signe : `✗ image` au log.
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
- `newsam.mjs` — NEWS.am, le principal groupe de presse privé d'Erevan, servi
  sous **en/hy/ru** (pas d'édition française). C'est la source la plus
  hétérogène du dépôt, parce que ce ne sont pas un site mais **quatre** :
  `news.am` (la rédaction moderne, 7 rubriques) et **trois verticales
  héritées** sur leurs propres hôtes — `sport.news.am`, `style.news.am`,
  `med.news.am`. Dix rubriques × trois langues = 30 pages par snapshot,
  espacées de 800 ms. Libellés portés dans les données.
  - **Les verticales ne sont pas joignables depuis le site moderne.** La
    tentation est de tout lire sur `news.am` : `/{lang}/news/sports` et
    `/medicine` **existent** comme étiquettes, mais elles retardent de
    plusieurs jours sur la verticale (Sports avait 9 jours de retard à
    l'écriture), et `style` répond **404**. Chaque verticale doit être lue sur
    son propre hôte.
  - **Le site moderne est un Inertia.js, comme Armenpress et CivilNet** — flux
    en JSON embarqué, **aucun sélecteur CSS**. Le chemin est celui de CivilNet
    (`props.feed.data.hits`, pages `feed/Tag`), **pas** celui d'Armenpress.
    Une différence avec CivilNet, en revanche : l'`article_id` de news.am est
    **partagé entre les éditions**, donc `/hy/news/{id}` sert la traduction
    arménienne du même article, là où un id CivilNet 404 hors de son édition.
  - **Même piège 403 que les deux autres** : tous les hôtes news.am répondent
    403 au `fetch` de Node (undici) et 200 à `node:https`. D'où `fetchTextNode`
    partout ici. Basculer sur `fetchText` ferait échouer les 30 pages, que le
    backfill masquerait ensuite en silence.
  - **Le RSS de med.news.am est mort depuis 2013, et il répond 200.** C'est le
    piège le plus vicieux de ce module : `/{seg}/rss/news` renvoie bien 100
    articles, dans les trois langues — mais ce sont les **plus anciens** du
    site, figés en **novembre 2013**, en ordre croissant. Rien dans la réponse
    HTTP ne le signale. Sport et style, eux, ont un RSS frais et trié. D'où
    deux mécanismes : **RSS pour sport et style**, **HTML pour med**
    (`article[itemtype]` sur `/{seg}/news/`) — et surtout une garde de
    fraîcheur (`MAX_AGE_DAYS`, 60 jours) qui **fait échouer** toute verticale
    dont l'article le plus récent est trop vieux. Sans elle, ce module aurait
    publié des titres vieux de treize ans comme actualité du jour. Ne la
    retirez pas pour « simplifier » : c'est elle qui a attrapé le cas.
  - **Deux dérivations remplacent des données que ces sites n'exposent pas**,
    et `test/newsam-legacy.test.mjs` les garde (sans réseau) :
    - *L'image.* Le RSS des verticales ne porte **ni `<enclosure>`, ni
      `<media:content>`, ni `<media:thumbnail>`** — rien. Mais le CMS hérité
      range chaque vignette à un chemin fixe,
      `/static/news/s/{AAAA}/{MM}/{id}.jpg`, indexé sur le mois de publication
      **local à Erevan**. On la devine donc, sans requête supplémentaire. Lire
      le mois en UTC daterait mal un article publié après 20 h UTC et servirait
      un 404 (la carte retomberait sur son motif, sans bruit).
    - *La date de med.* Son HTML n'a ni attribut `datetime`, ni JSON-LD, et son
      `<time>` **omet l'année** (« July 29, 20:34 »). Elle est recomposée en
      deux moitiés : année et mois depuis le chemin de l'image, jour et heure
      depuis le texte **lu en chiffres**. Lire des chiffres est le point : une
      seule règle couvre eng/arm/rus sans jamais analyser un nom de mois. Les
      deux ordres circulent sur le site (« 20:53, July 26 » en accueil,
      « July 26, 20:53 » en fil), d'où le retrait de l'horloge **avant** la
      recherche du jour — sinon « 20 » passerait pour le jour.
  - **Les verticales lâchent des 500 passagers**, med le plus souvent, et sur
    une langue différente à chaque fois. `fetchTextNode` retente les
    connexions coupées mais rejette tout non-200 immédiatement (ce qui est
    juste pour les 403 pour lesquels il a été écrit) : d'où une **reprise au
    niveau de la rubrique** (3 tentatives) dans ce module plutôt qu'un
    changement de l'aide partagée. Sans elle, un hoquet vidait la rubrique et
    le backfill le recouvrait sans un mot.
  - Les libellés des trois verticales sont **fixés en dur** — « NEWS.am
    Sport », « NEWS.am Style », « NEWS.am Medicine » : ce sont les noms de
    marque de ces sites, identiques dans les trois langues. Les sept rubriques
    modernes prennent le leur dans le payload, déjà localisé. Images
    hotlinkées en direct sur les quatre hôtes (aucune protection anti-hotlink,
    vérifié avec un `Referer` étranger) — donc ni proxy, ni wsrv.
- `armenopole.mjs` — Agenda (Suisse + monde). Scrape **les vraies pages pays
  d'armenopole** (21, hors Suisse gérée à part ; la liste suit la navigation du site, qui bouge — voir le commentaire de `WORLD_COUNTRIES`), en plafonnant chaque pays à 20
  événements, puis dédoublonne par URL. **Un slug inconnu redirige (302) vers
  le flux générique** `/armenian/events` — brazil, egypt, iraq, israel, jordan,
  qatar, syria, turkey le 30 sept. 2026, greece/belgium avant. Ses événements
  prenaient le slug, les régions non mappées (Île-de-France, Ontario…)
  retombaient dessus, et le dédoublonnage garde la **première** page : le menu
  affichait « Brésil » avec 20 événements de Paris, Californie, Zurich,
  Éthiopie. D'où `redirect: 'manual'` : un slug devenu générique sort en `✗`
  dans le log au lieu d'étiqueter un faux pays. Alimente le sélecteur de pays de l'agenda (voir « Le sélecteur de pays
  de l'agenda » dans `CLAUDE.md`).
- `instagram.mjs` — sélection aléatoire depuis le pool Instagram, **par
  brin** : chaque compte déclare son `group` (`institutions` |
  `personnalites` | `creation` | `createurs` | `terre` — 9, 6, 4, 4 et 4
  comptes) et le tirage prend `limit` posts **par groupe**, pas `limit` en
  tout — sinon le groupe le plus fourni chasserait les autres de leur propre
  carrousel. Le job horaire appelle `selectInstagram(18)`, donc 90 posts
  dans `instagram-feed.json`.
  - **À l'intérieur d'un brin, le tirage est À LA RONDE** : un post chez
    chaque compte à tour de rôle, l'ordre des comptes remélangé à chaque
    tirage. Un mélange à plat donnerait les tuiles à proportion des posts de
    chaque compte — invisible tant que tous en ont neuf, faux dès qu'un
    compte porte un `count` élevé. Mesuré : `simonian_jewels` (120 posts)
    contre trois comptes à 9 donne 5/5/4/4 à la ronde. À plat, l'espérance
    serait ~15 tuiles sur 18 (120×18/147 ≈ 14,7 ; simulation à 20 000
    tirages : 14,70). Même déséquilibre que le tirage par groupe corrige un
    cran plus haut.
- **`scripts/fb-scrape.mjs`** — rafraîchit Don Narek (Facebook). **Étape manuelle
locale**, pas horaire : Facebook exige une session connectée et bloque la CI.
- **`scripts/ig-scrape.mjs`** — rafraîchit le pool Instagram. **Étape manuelle
locale**, pas horaire : Instagram exige une session connectée et bloque la CI.
Récolte par défaut les **9 derniers posts** de chacun des **26 comptes
curés**, datés, et écrit leurs images **ré-encodées en WebP 800 px** dans
`src/data/ig/` (**1 448 posts** au pool le 5 août 2026, **20 comptes sur 26**
portant un `count` supérieur au défaut) — les décisions pures (combien de
posts, quelle image garder) vivent dans `scripts/lib/ig-harvest.mjs`, la
règle d'encodage dans `scripts/lib/image.mjs`, toutes deux testables sans
Chrome.

**Le plancher de taille doit rester AVANT l'encodage**, sur les octets reçus
du réseau — 10 000 ici, 15 000 dans `fb-scrape.mjs` : deux sources, deux
substituts d'erreur, deux seuils, à ne pas uniformiser. C'est ce garde qui
distingue une vraie image d'une page d'erreur (il a attrapé `DWr7TYjjHd9`,
9,6 ko). Déplacé après l'encodage, une image légitime de 42 ko ramenée à
8 ko serait rejetée comme corrompue : un faux négatif silencieux, la tuile
retombant sur son motif sans explication.

Trois réglages, tous silencieux s'ils manquent :
- **`count` par compte** (entier, ou `'all'` jusqu'à un plafond dur de 500)
  surcharge le défaut de 9.
- **`exclude` à la racine du pool** : des shortcodes que le scraper ne prend
  jamais, quel que soit le compte. Il s'applique **ici seulement** — le site
  ne le relit pas, donc `test/instagram-pool.test.mjs` est le seul endroit
  d'où l'exclusion peut être vérifiée.
- **`--only <handle[,handle]>`** récolte un compte sans réécrire les 25
  autres. **Mais `exclude` ne mord qu'au scrape** : écarter un post déjà
  dans le pool suppose de récolter **le compte qui le porte**, pas celui
  qu'on croit. Deux des quatre exclusions du 5 août visaient des posts de
  `arturaleksanyan_` alors que la demande portait sur le brin `creation` —
  sans lui dans le `--only`, ils seraient restés sur le mur tout en
  figurant dans `exclude`. Une exclusion enregistrée et sans effet ne
  déclenche rien : ni test, ni lint, ni build.

**Le piège** : sa réécriture finale doit repartir de `{ ...pool, accounts }`.
Reconstruire l'objet effacerait `exclude` à la première récolte — un JSON
valide, un pool sans exclusion, et rien pour le dire.

**Le seul vrai levier sur le poids est le nombre de posts, pas leur
taille.** `pickImage` retient le plus petit format d'au moins 640px, mais
l'API n'en propose parfois que deux — plein format et une vignette trop
petite pour la lightbox — et la règle retombe alors sur le plein format,
sans le signaler. D'où `count: 120` sur `simonian_jewels` (351 posts
disponibles) plutôt que `'all'`.

Et le job horaire ne fait que **re-mélanger** ce pool : sans récolte, le mur
re-sert indéfiniment les mêmes posts tout en ayant l'air frais.

## Récoltes, dates, titres, ArmRadio

- Les scrapers dépendent du HTML actuel des sites sources ; si un site est
  redessiné, les sélecteurs du module correspondant dans `scripts/sources/`
  peuvent devoir être mis à jour.
- `armradio.am` et Instagram sont tous deux bloqués depuis les IP de la CI
  (Cloudflare / anti-scraping) — d'où la chaîne de sources pour le newswire et,
  pour Instagram, une récolte **locale** (`npm run ig-scrape`) depuis un Chrome
  connecté, à relancer à la main de temps en temps.
- `ig-scrape.mjs` **n'appelle plus aucune API** : il ouvre chaque profil, défile
  à la molette à rythme irrégulier et lit les réponses `graphql` que la page
  reçoit (`timelineItems`, `scripts/lib/ig-harvest.mjs`). Depuis octobre 2026,
  `/api/v1/feed/user/…` — par nom comme par identifiant — **redirige vers
  l'accueil** : 200, du HTML, « Unexpected token '<' » sur les 27 comptes. Les
  27 échecs enchaînés ont valu un **429** à la session ; d'où la lenteur voulue
  (~30-40 min la tournée) et l'arrêt après 3 échecs d'affilée. N'y remettez pas
  non plus `web_profile_info` : 200 avec la bio, mais `edges` **vide**.
- Un identifiant Instagram ne peut pas contenir de tiret : un handle mal saisi
  (ex. `armenian-trend`) renvoie un 404 et fait échouer le compte.
- **La fraîcheur du mur est plafonnée par l'activité réelle des comptes, et un
  `count` élevé AMPLIFIE ce plafond au lieu de le lever.** Le tirage à la ronde
  donne à chaque compte une part de son brin : un dormant à `count: 9` prend
  deux tuiles sur dix-huit, le même à `count: 60` en prend quatre ou cinq —
  quatre fois plus de vieux posts, sur un brin qui n'en a pas plus. Mesuré le
  5 août 2026 : `ig_armenia`, muet depuis **juin 2023**, tient 4 des 18 tuiles
  du brin `terre`. Le script rapporte fidèlement ce que le compte publie —
  **aucune récolte n'y changera rien**. Pour rafraîchir vraiment, il faut
  baisser son `count` ou le retirer d'`accounts`.

  **Ne recopiez pas ici une liste de comptes dormants** : elle rote entre deux
  récoltes. Cette note a désigné `abgarart` comme lent « depuis mars 2026 »
  alors qu'il publiait le 1er août. Mesurez-la :

  ```bash
  node -e "const p=require('./src/data/instagram.json');for(const a of p.accounts)console.log((a.posts[0]?.date||'—').slice(0,10),a.handle,'count='+(a.count??9))" | sort
  ```
- **Un compte peut ne pas AVOIR le `count` qu'on lui demande, et le seul signal
  est une ligne `↯` dans la sortie du scrape.** `maisonlumiere_geneva` rend 18
  posts sur 60 demandés, `margarit.armeniandance` 56 : c'est leur catalogue
  entier, pas une panne. Le pool reste valide et le mur correct, donc ni test,
  ni lint, ni build ne le dira — seule cette ligne le dit, une fois, dans un
  flot de plusieurs centaines de téléchargements.

- **Chaque carte affiche l'âge de sa dépêche, et une source non datée n'affiche
  RIEN — sans le moindre signe.** `src/relativeTime.js` rend « 45 min », « 6 h »,
  « 2 j » sous « LIRE LA SUITE » ; `NewsBrowser.jsx` n'émet le `<time>` que si
  `item.date` existe. Une source qui renvoie `date: null` produit donc des
  cartes **parfaites**, simplement muettes sur leur fraîcheur : aucun test,
  aucun lint, aucun build ne tombe. C'est le mode de panne à connaître, parce
  qu'il se répare une source à la fois — et les onze le sont aujourd'hui.

  Deux l'ont été par un détour, et ce sont ces deux-là qu'on « simplifie » par
  erreur :
  - **Courrier d'Erevan lit ses dates dans le SITEMAP d'abord**, et dans sa
    grille à défaut. Depuis la refonte du site (11 septembre 2026), la grille
    `article.card` porte un `<time datetime>`, mais **au jour près** (figé à
    `T12:00:00Z`) — donc « il y a 18 h » ou « 1 j » selon l'heure de lecture.
    Le `<lastmod>` de `/sitemap.xml?page=N` est à la **minute**, en **2
    requêtes** pour 5 700 articles. C'est formellement une date de
    *modification* : vérifiée sur 8 articles, elle tombe à chaque fois sur le
    jour imprimé — ce site ne réédite pas.

    **Cette refonte a été silencieuse onze jours durant** : l'ancien sélecteur
    ne trouvait plus rien, chaque rubrique levait « No articles parsed », le
    backfill resservait l'instantané du 11 septembre, et ses 80 vignettes
    (`styles/530x350`, supprimées à la refonte) répondaient **404** — des
    cartes figées **et** sans image, tous les contrôles au vert. Les URL ont
    perdu leur préfixe de langue (`/fr/actualite` → 301, `/hy/…` → 404).
    `test/courrier-grid.test.mjs` lit la grille actuelle depuis une fixture
    réelle ; si le site refond encore, c'est lui qui tombera.

    **Ce détour a un prix, et il a été payé :** les dates ne rejoignent les
    articles que par **appariement d'URL**, et les deux côtés n'écrivent pas la
    même URL. Trois écarts connus, repliés par `normUrl` — les accents
    (`arménie` vs `arm%C3%A9nie`), le slash final, et le **`www.`**. Ce
    dernier est apparu **du jour au lendemain** : le 1er août 2026 courrier.am
    s'est mis à écrire tous ses `<loc>` en `www.courrier.am` alors que sa
    grille sert des liens sans `www.` — 5 445 dates chargées, **0 article
    daté**, sur les 8 rubriques. Rien n'a échoué : ni requête, ni parseur, ni
    build, parce qu'une date manquante est un `null` valide. Le seul symptôme
    était l'âge absent sous « LIRE LA SUITE », et il a fallu un lecteur pour le
    voir. Le module avertit désormais quand le sitemap répond, que des articles
    sont lus, et qu'aucun n'est daté — le seul état qui ne peut pas être
    légitime.
  - **ArménieInfo.tv paie une requête par article**, sa grille n'exposant rien
    non plus. Une page qui échoue laisse `date: null` : la carte perd son âge,
    et rien d'autre.

  **Un commentaire qui justifie un manque doit mourir avec le manque.**
  `armenieinfotv.mjs` renvoyait `date: null` *à dessein*, sous une note
  expliquant que le navigateur d'actualités n'affichait pas de dates — vraie à
  l'écriture, fausse dès que l'âge est apparu sur les cartes, et elle a fait
  passer le trou pour un choix. Le module l'a retirée en se datant ; la même
  phrase périmée est restée deux chantiers de plus dans `NewsBrowser.jsx`, où
  elle nommait encore Courrier et ArménieInfo.tv comme non datés.

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
    Voir « Les onglets du fil sont des RUBRIQUES » : seule la rubrique Arménie est prérendue, ses titres sont ce que Google lit.

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
- **Le Worker ne suffit plus : armradio.am défie sa sous-requête quand
  l'APPELANT est la CI.** Depuis mi-septembre 2026, le relais `?path=` répond
  « Just a moment… » (défi JavaScript de l'amont) depuis un runner GitHub, et
  200 depuis une IP résidentielle — même Worker, même URL. Cloudflare propage
  l'identité du visiteur (IP, score de bot) dans les sous-requêtes vers une
  autre zone Cloudflare, et le UA que le Worker envoie n'y change rien. Ne
  cherchez donc pas la cause dans `fetchText` ni dans le UA : la sonde
  `gh workflow run diag.yml` (curl seul, 30 s, sans instantané) est le seul
  banc qui reproduise un 403 propre à la CI — un poste résidentiel « prouve »
  le contraire. La parade est un **cron dans le Worker** qui préchauffe les 22
  réponses en **KV** sans visiteur (`proxy/README.md`, section « Cron + KV »),
  déployée le 22 septembre 2026 (namespace `CACHE`, id dans `wrangler.toml`,
  cron toutes les dix minutes). L'en-tête `x-armradio-source: kv | origin`
  dit d'où vient une réponse. Si ArmRadio se fige à nouveau, le signe est
  `✗ armradio/…: 403 [… « Just a moment… »]` dans le log : vérifiez d'abord
  que le cron tourne (tableau de bord Cloudflare → Worker → Logs), pas le UA.
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
