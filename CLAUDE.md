# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) lorsqu'il
travaille sur ce dépôt.

## Ce qui entre dans ce fichier, et ce qui n'y entre pas

**Ce fichier est un budget, pas un journal.** Il pèse ~73 000 caractères, soit
~20 000 jetons **chargés à chaque session**, avant qu'une seule ligne de code
n'ait été lue. Chaque ajout se paie sur toutes les tâches à venir.

Le critère n'est donc pas « qu'est-ce qui a changé » — git le sait déjà, et les
messages de commit de ce dépôt racontent le détail bien mieux qu'un résumé ne le
ferait. Le critère est : **quelqu'un se tromperait-il sans qu'on le lui dise ?**

Trois questions avant d'ajouter quoi que ce soit :

1. **Est-ce déductible du code ?** « Le rail est sur deux rangs » se voit dans le
   CSS. « `flex-wrap: nowrap` est obligatoire dans le bloc du tambour, sinon la
   colonne part en colonnes » ne se voit nulle part.
2. **Le piège est-il SILENCIEUX ?** Ce qui casse un test ou le lint n'a pas
   besoin d'être écrit ici : le garde-fou existe déjà. Ce qui passe tous les
   contrôles et se voit seulement en production, oui.
3. **A-t-il été payé ?** Une mesure, une panne, une heure perdue. Pas une
   intention ni une bonne pratique générale.

**En ajoutant un piège, cherchez-en un périmé à retirer.** Un fichier qui ne fait
que croître meurt d'obésité, et un fichier trop long n'est plus lu — y compris
par Claude. Le fichier a été scindé le 25 octobre 2026 (~32 000 jetons) : les
pièges d'une source vont dans le skill `toucher-une-source`, ceux de rendu dans
`.claude/skills/verifier-le-rendu/pieges-rendu.md` — les skills se chargent
d'eux-mêmes quand la tâche les concerne. Ne gardez ici que ce qui vaut pour
**toute** tâche.

Où va le reste : le **récit** d'un chantier dans son message de commit ; le
**pourquoi** d'une décision de conception dans `docs/superpowers/specs/` ; une
**procédure** répétable dans un skill de `.claude/skills/`.

## Projet

**Arménie Info** (`armenieinfo.ch`) et **Armenia News** (`armenianews.org`) —
deux vitrines d'un **même instantané horaire** de la vie arménienne, servies
depuis une seule base de code. Le .ch sert le français (`/`), l'allemand
(`/de/`) et l'italien (`/it/`) ; le .org l'anglais (`/`), l'arménien (`/hy/`)
et le russe (`/ru/`) — six langues, 24 pages (6 × 4 vues). Actualités, agenda
et réseaux sociaux, esthétique de journal « Apricot Press » (basalte éclairé
d'abricot), bascule **jour / nuit**.

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
npm run check        # contrôle les 24 pages produites (6 langues × 4 vues : lang, canonical, hreflang réciproques), les pages de brève, les pages Culture (index + articles, hreflang, image), les 3 cartes de liens, les 2 pages 404 et les 2 sitemaps/robots
npm run prerender    # cuit les 24 pages avec Puppeteer (après npm run build) pour que les crawlers lisent du HTML rempli
npm run preview      # prévisualise dist/ch (la vitrine que sert armenie-info.web.app)
npm run preview:org  # prévisualise dist/org
npm test             # 743 tests : dérivations de sites.config.js, page 404 et redirections Firebase, dates murales de l'agenda et nœud Event, allègement des JSON au build, polices auto-hébergées, maillage interne, vue « À propos », hreflang par vue, langues, sitemaps, cartes de partage, nombre de radios, sourçage des stations, dates arméniennes, dérivations héritées de NEWS.am, appariement d'URL et grille du Courrier, User-Agent des scrapers, cinq brins Instagram, rubriques communes (table, regroupement, libellés, classeur)
npm run lint         # ESLint (config plate, eslint.config.js) — passe : 0 erreur, 5 avertissements connus
npm run scrape       # rafraîchir src/data/{news,agenda,meta,instagram-feed}.json depuis les sources
npm run ig-scrape    # rafraîchir le pool Instagram (local, Chrome connecté — jamais en CI)
npm run brief         # générer la brève du jour hors du scrape (--force ignore la règle des 7 h, --dry n'écrit rien)
npm run culture:draft     # rédiger le brouillon Culture du jour (quotidien, 03:00 UTC) (--topic slug, --dry) — Gemini, GEMINI_API_KEY
npm run culture:translate # traduire le fr.md relu en en/hy/ru, et de/it facultatives (slug [--langs de,it])
npm run culture:check     # contrôle strict des articles Culture (celui des PR)
npm run ig-select    # re-tirer le mur Instagram depuis le pool (local, sans réseau)
npm run fb-scrape    # rafraîchir Don Narek (local, Chrome connecté — jamais en CI)
npm run screenshot   # après un build : capturer le carrousel Don Narek dans dist/ch/don-narek-{desktop,mobile}.png
npm run hydration-check # après build + prerender : les 24 pages s'hydratent-elles sans écart ? (local, Chrome)
npm run radio-check  # les 17 flux radio diffusent-ils vraiment ? (local, réseau — jamais en CI ni dans npm test)
npm run og-image     # régénérer la carte de partage du .org (local, Chrome + Google Fonts — jamais en CI)
npm run fonts-sync   # re-télécharger les polices auto-hébergées (public/fonts/, src/styles/fonts.css + fonts.json) depuis Google Fonts (local, réseau)
```

Il y a désormais **743 tests** (`node --test test/*.mjs`) : ils gardent les
invariants de `sites.config.js` (une langue = une URL, un couple langue/vue =
une URL), la réciprocité des `hreflang` **par vue** (`test/views.test.mjs`,
`test/site-meta.test.mjs`), l'ordre du sélecteur, la forme des sitemaps, le
fait que chaque vitrine annonce **sa** carte de partage, la concordance entre
le tableau `STATIONS` et les six textes qui annoncent un nombre de radios, le
sourçage des fiches de station (`test/stations.test.mjs`, voir « À savoir »),
les deux filtres de l'agenda (`test/agenda-events.test.mjs` : aucun événement
sans date n'est rendu ni balisé) et les deux stades de sa garde
(`test/agenda-guard.test.mjs`, voir « À savoir »),
la conformité des tables de dates arméniennes au CLDR (`test/hy-date.test.mjs`,
voir « À savoir »), et les deux dérivations des verticales héritées de NEWS.am
(`test/newsam-legacy.test.mjs` : l'URL de vignette devinée depuis le mois de
publication, et la date de med recomposée en chiffres), et l'appariement d'URL
qui date les articles du Courrier (`test/courrier-dates.test.mjs`, voir
le skill `toucher-une-source`), et les cinq brins du mur Instagram — leur déclaration en six
langues, le tirage à la ronde et l'exclusion du pool
(`test/instagram-strands.test.mjs`, `test/instagram-draw.test.mjs`,
`test/instagram-pool.test.mjs`), et les rubriques communes du fil
(`test/rubric-map.test.mjs`, `test/rubric-group.test.mjs`,
`test/rubric-i18n.test.mjs`, `test/classify-rubrics.test.mjs`) — aucun ne touche le réseau. Le lint et l'exécution réelle des scripts complètent la vérification.

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

  `LANGS` vit dans `sites.config.js` (Node doit le lire sans parseur JSX) et
  `i18n.jsx` le **ré-exporte** (`export { LANGS }`), ce qui ne déclenche pas la
  règle. Ne le remettez pas en dur dans `i18n.jsx` : un avertissement de plus,
  et le build à deux vitrines recassé.

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
- **`scripts/sources/`** — un module par source. **Le détail de chacune (payload,
  chemins, 403, proxys, verticales, pièges de dates) est dans le skill
  `toucher-une-source`** (`.claude/skills/toucher-une-source/SKILL.md`) : à
  lire avant de toucher un module.

  | Module | Langues | Comment | Le piège à connaître |
  |---|---|---|---|
  | `armenpress` | fr/en/hy/ru | Inertia, `props.data.data.hits` | `fetchTextNode` obligatoire (undici → 403) |
  | `civilnet` | fr/en/hy/ru | Inertia, `props.feed.data.hits` | idem ; id propre à chaque édition |
  | `newsam` | en/hy/ru | Inertia + 3 verticales héritées | med : RSS mort depuis 2013 (garde de fraîcheur) |
  | `californiacourier` | fr/en/hy/ru | WordPress REST | images recopiées dans `public/cc/` (Cloudflare) |
  | `armradio` | en/hy/ru | Worker + KV, chaîne de replis | la CI est défiée : cron du Worker |
  | `asbarez` | en/hy | via Worker (`ASBAREZ_PROXY`) | WAF anti-datacenter, aucun repli |
  | `oragark` | en/hy | WordPress REST | — |
  | `armenianweekly` | en | WordPress REST | sous-catégories résolues depuis l'arbre |
  | `courrier` | fr | grille HTML + sitemap | dates par appariement d'URL (`www.`, accents) |
  | `armenews`, `artzakank`, `armenieinfotv` | fr | WordPress / HTML | artzakank publie par numéros |
  | `armenopole` | agenda | 21 pages pays | slug inconnu = 302 générique (`redirect: 'manual'`) |
  | `instagram` | mur | tirage à la ronde par brin | voir « Données » |

  **Trois règles valent pour toutes** : le User-Agent ne se dit **jamais**
  « Chrome » (`scripts/lib/http.mjs`, `test/http-ua.test.mjs` — Cloudflare
  répond 403 à tout UA de navigateur sans empreinte TLS) ; une rubrique en échec
  est **backfillée** sans bruit (signe : `✗` au log, et l'issue
  `[sources-down]`) ; le premier réflexe devant un mur figé est
  `gh run view <id> --log | grep '✗'`.
- **`scripts/fb-scrape.mjs`** et **`scripts/ig-scrape.mjs`** — Don Narek
  (Facebook) et le pool Instagram. **Étapes manuelles locales**, jamais en CI
  (sessions connectées). Leurs pièges (plancher de taille avant l'encodage,
  `count`, `exclude`, `--only`, la réécriture `{ ...pool, accounts }`) sont
  dans le même skill.
- **`scripts/shoot.mjs`** — capture d'écran du carrousel Don Narek (Puppeteer).

**Les deux vitrines** — `sites.config.js` (racine) est la source de vérité :
hosts, marques, pages, langues. Tout en dérive — métadonnées HTML, `hreflang`,
sitemaps, cibles Firebase, ordre du sélecteur de langue, jeton d'audience.

- `scripts/lib/site-meta.mjs` génère le `<head>` d'un couple (site, langue).
  Appelé par le plugin `siteMeta()` de `vite.config.js` pour la page par défaut
  de chaque site, **et** par `scripts/build-sites.mjs` pour dériver les autres.
  Un seul générateur pour les 24 pages : des `hreflang` divergents
  sont ignorés en bloc par Google. Il pose aussi la balise **Cloudflare Web
  Analytics** (marqueur `<!--CF_BEACON-->` dans `index.html`) à partir du
  `cfBeaconToken` de la vitrine : **un jeton par site**, donc deux tableaux de
  bord. `applyMeta` **refuse** un HTML privé de l'un ou l'autre marqueur —
  supprimer `<!--CF_BEACON-->` couperait la mesure des deux vitrines sans
  qu'aucun build ne s'en plaigne.
- **La carte de partage (`og:image`) est propre à chaque vitrine**, décrite par
  `ogImage` dans `sites.config.js` : `/og-image-ch.jpg` pour le .ch (français),
  `/og-image-org.jpg` pour le .org (anglais). Elle suit la **vitrine et non la
  langue** : les trois pages du .org partagent la carte anglaise, la marque
  étant unique par domaine.

  **Renommer une carte est le SEUL moyen de casser le cache des réseaux**, et
  c'est pour cela que les deux portent aujourd'hui un suffixe. Facebook et
  WhatsApp gardent l'aperçu d'une URL plusieurs jours, sans outil public de
  purge : tant que le nom du fichier ne change pas, une carte redessinée reste
  invisible pour tous les partages déjà en circulation. Le .ch s'appelait
  `og-image.jpg` tout court jusqu'au 1er août 2026 — le calcul s'est inversé
  quand sa carte a été redessinée (l'Ararat, voir `pieges-rendu.md`).

  **`public/og-image.jpg` subsiste, et ne doit pas être supprimé.** Plus
  aucune page ne le référence, mais des aperçus en circulation le pointent
  encore, et un scraper qui le redemande doit trouver une image, pas un 404.
  C'est le même piège que celui déjà documenté pour une balise
  `og:image` parfaite pointant un fichier absent. `npm run check` vérifie donc
  sa présence en plus de celle des deux cartes vives ; il n'est plus régénéré,
  et c'est sans conséquence — son seul rôle est de répondre.
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
  parfaite pointant sur un fichier absent servirait un 404,
  que les scrapers lisent comme une image cassée. Les deux `dist/` contiennent
  **les deux** fichiers (Vite copie tout `public/`) : c'est sans conséquence,
  chaque vitrine ne référence que le sien.
- **La grande carte WhatsApp ne se commande pas depuis le site.** WhatsApp a
  deux mises en page : la **grande** (vignette pleine largeur au-dessus du
  texte) et la **petite** (vignette carrée à gauche). Le choix appartient au
  **client** — le téléphone rend volontiers la grande là où WhatsApp Desktop
  rend la petite, **à métadonnées strictement identiques**. Deux captures qui
  diffèrent ne prouvent donc pas que le site a changé.

  Ce que le site *peut* faire tient dans un bloc de six balises : `og:image`,
  plus `secure_url`, `type`, `width`, `height` et `alt`. Un client bascule sur
  la petite carte dès qu'il doute de l'image ; ces cinq compléments lui évitent
  de devoir la télécharger pour savoir qu'elle est en https, que c'est un JPEG,
  et qu'elle fait 1,91:1. Les conditions matérielles sont tenues par ailleurs :
  1200×630, sRGB, sans profil ICC, ~64 ko — très en dessous des ~600 ko au-delà
  desquels WhatsApp cesse de chercher l'image.

  **Ce bloc doit être écrit DEUX fois, et l'oublier une fois ne se voit
  nulle part.** `site-meta.mjs` le pose sur les 24 pages React — et il ne
  voit **pas** `pages/`, dont les cartes de liens sont des HTML complets hors
  du bundle. Le bloc y a donc été recopié à la main, et il faut le tenir à
  jour des deux côtés. Le défaut a réellement été commis : l'accueil décrivait
  son image en entier pendant que `lien.html` n'en annonçait que trois balises
  — or **c'est `lien.html` qu'on partage**, pas l'accueil. Rien ne pouvait le
  signaler : la page était valide, simplement moins bien décrite que sa
  jumelle, et le seul symptôme était une petite carte chez un lecteur.
  `check-build.mjs` exige désormais les six balises sur **chaque** carte de
  liens, en plus des 24 pages.

  **Ne concluez pas d'une seule capture.** Un aperçu petit après un aperçu
  grand peut n'être qu'un changement de client : mesurez la largeur de la
  bulle (~900 px et plus = WhatsApp Desktop, ~500 px = téléphone) avant de
  soupçonner les balises. Et vérifiez ce qui est **réellement servi** —
  `curl -s https://armenieinfo.ch/lien.html | grep 'og:image'` — plutôt que ce
  que dit le dépôt : c'est ce qui a distingué ici la vraie régression de la
  différence de client.

  **Le vrai piège est le cache, et il est trompeur.** WhatsApp garde l'aperçu
  d'une URL plusieurs jours, sans outil public de purge, et la clé est l'URL
  **exacte**. Un aperçu peut donc afficher un titre retiré du site depuis des
  jours — c'est la façon la plus sûre de dater une capture : comparez son titre
  à `SEO[lang]` dans `src/seo.js`. Pour vérifier les métadonnées **actuelles**
  sans attendre l'expiration, partagez une URL à clé différente
  (`https://armenieinfo.ch/?v=2`) : même page, autre entrée de cache.
  Ne « corrigez » pas les balises sur la foi d'un aperçu ancien.
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
  `lien-fr` est la même carte tournée vers le public français. **Les trois
  cartes sont en `noindex`** (lien-fr depuis toujours, les deux autres depuis
  l'audit du 21 août 2026) : une carte indexable est une page de 15 ko qui dit
  la même chose que l'accueil sous un autre titre, un doublon qui concurrence
  la page qu'elle annonce. Le `noindex` ne gêne en rien le partage social,
  Facebook et WhatsApp lisant l'Open Graph et non la directive robots ;
  `npm run check` l'exige désormais sur chaque carte.

  Un fichier manquant **interrompt le build**. Sans cela il se déploierait en
  silence, et une URL déjà partagée répondrait 404. `npm run check` vérifie en
  outre, pour chaque carte, le `<html lang>`, le canonical (propre à **cette**
  page), l'`og:image` et l'absence du domaine ou de la carte du voisin.

  **Le nombre de radios est écrit en toutes lettres** dans ces cartes et dans
  les six `radio.subtitle` (`t()` ne sait pas interpoler). Rien ne les relie
  au tableau `STATIONS` de `Radio.jsx` : `test/radio-count.test.mjs` compte les
  stations et échoue si un texte diverge. Sans lui, une dix-huitième
  station ferait mentir ces textes en six langues, en silence.
- `scripts/build-sites.mjs` orchestre deux `vite build` (un par site, dans des
  processus fils — la config de Vite est mise en cache par processus), dérive
  les pages supplémentaires à partir du HTML déjà bâti (pas un rebuild par
  page — juste un échange de métadonnées entre les sentinelles que pose
  `site-meta.mjs`), puis écrit sitemap et robots par vitrine. Une assertion en
  tête du script vérifie que `sites.config.js` et `LANGS` décrivent
  exactement les mêmes langues — sans elle, ajouter une langue à
  `LANGS` la rendrait traduite partout et joignable nulle part, en silence.
- `src/seo.js` porte les chaînes de titre et de description par langue. **JS
  plat, sans React**, parce que Node doit les lire pour générer les pages
  dérivées hors du bundle. Même raison que `src/worldPlace.js` — ne le
  reconsolidez pas dans `i18n.jsx`.
- `src/site.js` porte `SITE_ID` (quelle vitrine ce build produit, posé par
  `scripts/build-sites.mjs` via `VITE_SITE_ID` ; `npm run dev` n'en pose pas et
  travaille donc sur le .ch) et `orderedLangs()`, qui place la langue de tête
  du domaine en premier dans le sélecteur sans changer l'ordre relatif des
  autres — sur les trois pages du .org la barre reste « EN FR DE IT ՀԱՅ РУ », seule
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
- `src/agendaEvents.js` porte les **deux filtres canoniques de l'agenda** —
  `evenementComplet` (titre, date, URL) et `evenementsAVenir` (complet,
  dédoublonné par URL, à venir). Cinquième module plat, et pour une raison de
  plus que les précédents : ses lecteurs sont dans les **deux** mondes — le
  composant `AgendaPage` et `src/jsonld.js` côté bundle, le plugin
  `agendaEventsJsonLd` (`vite.config.js`) et `scripts/check-build.mjs` côté
  Node. Le même filtre y était écrit trois fois, et il avait déjà divergé :
  seule la vue omettait le contrôle des champs, donc elle pouvait afficher un
  événement sans date — `<time>` vide, compté dans son total — que le balisage,
  lui, omettait. Le piège de conversion qui rend le contrôle explicite
  nécessaire (`new Date(null)` vaut 0, `new Date(undefined)` vaut NaN) est
  documenté en tête du module et figé par `test/agenda-events.test.mjs`.

**Les vues.** Une page n'est plus seulement un couple (vitrine, langue) mais un
**triplet** (vitrine, langue, vue). Quatre vues existent : `home` (l'accueil,
déjà là sans porter de nom jusqu'ici), `radio` et `agenda` — les deux pages
piliers qui donnent une URL propre aux deux jeux de données que ce site est
seul à agréger — et `about` (`/a-propos/`, `/about/`), la page qui dit qui
édite, d'où, avec quelles sources et quelles règles (ajoutée après l'audit
SEO du 21 août 2026 : un agrégateur que personne ne signe se lit comme une
ferme de liens). **Ajouter une vue touche sept endroits**, et deux d'entre
eux ne préviennent pas : `VIEWS` (`sites.config.js`), `VIEW_SEO` (`src/seo.js`,
sinon `site-meta` lance), la route d'`App.jsx`, le composant, `SANS_AGENDA`
dans `scripts/lib/agenda-guard.mjs` (une vue inconnue fait échouer `check`,
mais une vue **mal classée** laisserait passer des `Event`), le bloc « Pages »
du pied de page et la page 404 (silencieux tous deux : la page existerait sans
lien entrant). `test/about.test.mjs` montre le tour complet. La table `VIEWS` vit dans `sites.config.js`, à côté de
`LANG_URL` : tout en dérive (`urlFor(lang, view)`, `pathFor(lang, view)`,
`viewFromPath(siteId, pathname)`) — **aucune URL n'est écrite à la main** en
dehors des tests.

Les slugs restent en **caractères latins** : un slug en écriture arménienne
partirait en pourcent-encodage (`/hy/%D5%BC%D5%A1...`), illisible dans un
partage, pour aucun gain de classement. Mais ils sont **traduits là où le mot
change la requête** — `radio` s'écrit pareil dans les six langues, alors que
`agenda` devient `events` (en/hy/ru), `veranstaltungen`, `eventi` : en
anglais « agenda » désigne un ordre du jour ou un mobile, jamais une liste
d'événements, et c'est « events » que les gens tapent.

**Le slug porte son slash final** (`radio/`, `agenda/`, `events/`), et ce n'est
pas cosmétique. Une vue est servie par un dossier (`dist/ch/radio/index.html`),
exactement comme `/hy/` et `/ru/` — et Firebase Hosting redirige toute URL de
répertoire vers sa forme à slash final. Mesuré en production, sur une page qui
sert déjà :

```
curl -I https://armenianews.org/hy   → 301 https://armenianews.org/hy/
curl -I https://armenianews.org/hy/  → 200
```

Un slug sans ce slash aurait donc déclaré, sur toutes les pages (`canonical`,
les `hreflang`, `og:url`, le JSON-LD, les deux sitemaps, les liens internes),
une adresse qui **redirige** vers celle réellement servie — aucune page ne se
serait citée elle-même à son URL finale. Ce piège a réellement été commis
pendant ce chantier : ni `npm run check` (il compare des chaînes, pas des
codes HTTP) ni `vite preview` (sirv sert les deux formes en 200) ne peuvent le
voir — seule une revue qui teste des URL en production l'a rattrapé.
Conséquence pour `viewFromPath` : elle compare un slug **normalisé** (slash de
bord retiré des deux côtés) au chemin, pas le slug brut au chemin — comparer
`'radio'` à `'radio/'` retomberait sur `home` et ferait échouer la garde
`data-view` du prérendu (voir « À savoir »). `test/views.test.mjs` exige que
`/radio` et `/radio/` rendent tous deux `'radio'`.

**Internationalisation** — `src/i18n.jsx` expose un contexte React
(`useI18n()` → `{ t, lang, formatDate, locale }`) avec les dictionnaires
**fr / de / it / en / hy / ru**. Ajouter une langue touche une quinzaine
d'endroits, la plupart muets s'ils manquent : `sites.config.js` (`ALL_LANGS`,
`LANGS`, une page dans `SITES`, `VIEWS`, `BRIEF_SLUGS`, `CULTURE_SLUGS`,
`LANG_SWITCH_LABEL`) ; un bloc `STRINGS` complet (mêmes clés que `fr`, sinon
repli silencieux sur le français) et son `LOCALES` (`i18n.jsx`) ; `SEO` et
`OG_LOCALE` (`src/seo.js`) ; `briefStrings`, `cultureStrings`, `rubricLabels`,
`worldPlace`, `relativeTime` (`src/`) ; `PRELOAD` (`site-meta.mjs`) ;
`LANG_NAME` (`brief-generate.mjs`) et les marqueurs de `brief-script.mjs` ; les
`redirects` de `firebase.json` (deux cibles) ; `OPTIONAL` / `REQUIRED`
(`culture-validate.mjs`) ; `CONTENT_LANG` sans fil propre (voir « À savoir »).
**La langue vient de l'URL** : `LanguageProvider` la lit au montage
(`langFromPath(SITE_ID, location.pathname)`), le sélecteur de `Nav.jsx` est un
jeu de liens vers `LANG_URL`. Seul
le **chrome de l'interface** est traduit ; le **contenu** (articles, posts)
reste dans sa langue d'origine — un lecteur russe voit Armenpress **et**
ArmRadio en russe, mais Courrier (et les autres sources francophones) en
français, sous les rubriques communes. Le français est
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
scrape **les 21 vraies pages pays d'armenopole** (plafonnées à 20 événements chacune)
et dédoublonne aussi à la source — le menu couvre donc tout ce que le site
propose, en se purgeant des pays sans événement.

`src/worldPlace.js` porte cette résolution : `worldCountryKey(ev)` donne la clé
canonique (`location` d'abord — « Erevan » → `armenia`, « Angleterre » →
`unitedkingdom` —, puis le slug `country`, et en dernier recours le texte brut
plié), `countryLabel(key, lang)` / `countryFlag(key)` la rendent. **Le nom de
pays du sélecteur EST localisé dans les six langues** (fr compris) : c'est du
chrome d'interface (un libellé de contrôle), pas du contenu d'article. Le
**badge** de chaque carte (et la visionneuse, et `/events/`) est traduit lui
aussi depuis le 27 octobre 2026 par `placeLabel` (table `PLACES`) : un lecteur
anglais lisait « Angleterre ». **Un lieu absent de `PLACES` reste en français,
sans le moindre signe** — en ajouter un quand le flux en montre un nouveau. Résoudre depuis `location`
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

**Le détail du CSS est dans `.claude/skills/verifier-le-rendu/pieges-rendu.md`**
— la convention `font-family` + `font-size-adjust` (chaque famille posée sans
son réglage change de taille sous une seule langue), les polices
auto-hébergées (`npm run fonts-sync`, jamais de `<link>` Google), les tambours
mobiles, le rail des rubriques, l'opacité 0.02 du titre du héros. À lire avant
de toucher `global.css` ou un composant de rendu.
**Le HTML prérendu est HYDRATÉ, et un seul texte divergent annule tout.**
`main.jsx` fait `hydrateRoot` sur une racine cuite (`createRoot` jetait la
page : rien ne s'affichait avant que React l'ait refaite). Au premier écart,
React 18 refait toute la racine **en silence** — on retombe sur l'ancien coût,
aucun test ne tombe. D'où trois règles : le prérendu cuit `renderToString`
(`window.__PRERENDER__`), pas le DOM monté ; tout ce qui dépend de l'heure, du
thème ou de l'écran part de la valeur du prérendu et change **au montage**
(`src/renderClock.js`, `useClientNow`, thème de `Nav.jsx`) ; et
`npm run hydration-check` le prouve — avec `NODE_ENV=development npm run build`
pour lire chaque écart en clair (React n'avertit qu'une fois par page). Les
`.reveal` ne sont masqués que sous `html.js` (posé par `theme-init.js`) : le
prérendu ne doit plus y ajouter `is-visible`. Mesure (17 oct. 2026, bridage
réel) : TBT −25 %, LCP ~3,1 → ~2,9 s. **Le LCP « simulé » de Lighthouse (~10 s)
est un artefact** de ce site — mesurez avec `--throttling-method=devtools`.

## Données : ce qui est scrapé vs. curé à la main

- **Généré par le scrape (ne pas éditer à la main)** — `news.json`,
  `agenda.json`, `instagram-feed.json`, `meta.json`. Ils sont réécrits à chaque
  snapshot horaire. Exception : `rubric-cache.json` (classement des fils
  fourre-tout) s'édite à la main pour corriger un classement, une URL par ligne.
- **Rafraîchi à la main, jamais par la CI** — `src/data/instagram.json` (le
  **pool** Instagram : la **liste des comptes** est curée à la main, leurs
  **posts** sont récoltés par `npm run ig-scrape` ; le job horaire y pioche une
  sélection aléatoire dans `instagram-feed.json`) et `src/data/facebook.json`
  (les posts Don Narek, récoltés par `node scripts/fb-scrape.mjs` ou ajoutés à
  la main).
  Voir le **README.md** pour la procédure d'ajout de posts et de rafraîchissement
  des deux murs.
- **`src/data/briefs/{lang}/AAAA-MM-JJ.json` est généré par le scrape, une fois, et jamais régénéré** : une correction se fait à la main dans le JSON. Ne jamais l'écraser par un second passage.
- Schéma du pool Instagram :
  `{ exclude: [shortcode], accounts: [{ handle, name, url, group, count?,
  posts: [{url, date}] }] }`, où `group` vaut `institutions`, `personnalites`,
  `creation`, `createurs` ou `terre` et décide de quel carrousel le compte
  relève (absent = `institutions`). Le scraper réécrit les `posts` — **jamais**
  le tableau `accounts`, **jamais** `exclude`. Une valeur de `group` hors de
  ces cinq fait disparaître le compte du mur sans le moindre signe : `igStrands`
  (`Social.jsx`) ne rend que les brins qu'il déclare, d'où
  `test/instagram-strands.test.mjs`.
- **Les images Instagram ne passent PAS par un `import.meta.glob`, et ne
  doivent pas y revenir.** Un glob de `src/data/ig/` émet chaque fichier dans
  les deux `dist/`, qu'une tuile l'affiche ou non : 3 734 images, ~238 Mo par
  vitrine pour 90 tuiles (25 octobre 2026). Le module virtuel
  `virtual:ig-images` (`igFeedImages`, `vite.config.js` ; règle dans
  `scripts/lib/ig-images.mjs`) ne livre que celles du **tirage** : 18 Mo par
  vitrine. Le pool peut donc grossir sans alourdir le site — c'est le dépôt
  git qui paie. `IG_EXT` accepte `.jpg` **et** `.webp` définitivement (un JPEG
  resté d'une conversion deviendrait sinon une tuile muette) ; le glob
  Facebook, lui, reste (25 images). Sans image, une tuile affiche un **motif
  arménien déterministe** (`src/components/motifs.jsx`).

- **Deux JSON sont ALLÉGÉS au build, et le composant qui les importe ne le
  voit pas.** Le plugin `lightData()` (`vite.config.js`, fonctions pures dans
  `scripts/lib/light-data.mjs`) remplace, pour le bundle seulement, le contenu
  de `news.json` par les seules langues de la vitrine bâtie (fr sur le .ch,
  en/hy/ru sur le .org — `TAB_ORDER` décide donc aussi de ce qui est
  **embarqué**) et celui d'`instagram.json` par ses comptes **sans posts**. Le
  fichier sur disque ne change pas : scraper, tests et prérendu lisent le
  vrai. Mesuré le 21 août 2026 : bundle du .ch 1,45 Mo → 0,72 Mo brut, sans
  une carte de moins (196 images, 70 cartes, 90 tuiles prérendues avant comme
  après). Conséquence : `ig.accounts[].posts` est **toujours vide** côté
  navigateur, et un `news.json` qu'un composant lirait pour une autre langue
  que la sienne y est absent. `test/light-data.test.mjs` garde les deux
  filtres et leur branchement.

## Déploiement

`.github/workflows/hourly.yml` s'exécute **toutes les heures** (UTC), plus sur
dispatch manuel et sur push vers `main` :

- **Planifié / manuel** → scrape + commit des données + build + déploiement (un
  snapshot par heure).
- **Push vers `main`** → build + déploiement seulement (**le scrape est sauté**),
  pour qu'un changement de code ou de docs parte en prod vite, sans passer 3-4 min
  à re-scraper ni créer un snapshot en trop. Pour un snapshot frais à la demande,
  lancez le run manuel `workflow_dispatch`.

**« Toutes les heures » n'est PAS tenu par GitHub** : son cron saute des
passages sous charge — 5 à 6 par jour, même décalé à `:23` (mesuré du 14 au
19 octobre 2026), tous les runs « success ». Le déclencheur principal est donc
le Worker Cloudflare `hourly-trigger` (`proxy/hourly-trigger-worker.js`), qui
appelle `workflow_dispatch` à `:23` avec un jeton GitHub à grain fin
(`GH_TOKEN`, « Actions: Read and write » sur ce seul dépôt). **Ce jeton
expire**, et rien ne le dit : le site retombe sur le cron de GitHub. Si les
instantanés s'espacent (`gh run list --workflow=hourly.yml`), lisez d'abord
les logs du Worker (un `401` = jeton expiré).

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
> `armenianews-org` de `armenie-info`, inutilisé, a été supprimé le 25 octobre
> 2026. Firebase réserve les noms d'un projet supprimé une trentaine de
> jours, d'où les tâtonnements de nommage visibles dans l'historique git.

Vite `base`
vaut `/` par défaut sur les deux (chaque domaine sert depuis sa propre racine) ;
surchargez avec `BASE_PATH=/sous-chemin` pour un sous-chemin — surtout utile
avec `build:one`, le build Vite unique de dépannage, puisque les deux vitrines
de production servent toujours depuis la racine de leur domaine.

## À savoir

- **Pièges par source** (récolte Instagram, dates du Courrier et
  d'ArménieInfo.tv, titres Armenpress, ArmRadio ru et son Worker) : skill
  `toucher-une-source`.
- **Les onglets du fil sont des RUBRIQUES, pas des sources.** Neuf rubriques
  communes (`RUBRICS`, `src/rubrics.js`) ; dans chacune, une étagère par
  source, **la plus fraîche en tête** (Armenpress compris, voulu) ;
  **`TAB_ORDER`** (`src/newsLangs.js`) ne fait que départager les égalités et
  décide toujours quelle source paraît sous quelle langue — une source absente de
  `TAB_ORDER` n'apparaît nulle part, et seul `test/source-count.test.mjs` le
  remarque. **`RUBRIC_MAP`** replie chaque rubrique d'origine sur une rubrique
  commune ; une rubrique d'origine nouvelle doit y être déclarée, sinon elle
  tombe en silence dans Arménie — `test/rubric-map.test.mjs` la confronte au
  dernier instantané — en CI ce test est sauté (il gèlerait le job horaire,
  `npm test` précédant le scrape) : ajoutez l'entrée `RUBRIC_MAP` dans le même
  commit que la rubrique du scraper, le seul signe est `✗ rubric:` au log. Seul l'onglet actif (Arménie) est prérendu ; chaque
  langue ne montrant que ses sources, le HTML reste dans la langue de la page.
  Ne réintroduisez pas d'onglet hors-langue sans mesurer ce qu'il prérend.

  **Les fils fourre-tout (`{ mixed }`) sont classés au scrape par un modèle
  gratuit OpenRouter** (`scripts/lib/classify-rubrics.mjs`, secret
  `OPENROUTER_API_KEY`, cache `src/data/rubric-cache.json`). **Le piège :** une
  clé expirée ou un quota épuisé ne casse rien — chaque fil retombe dans son
  défaut, le site a l'air juste, et le seul signe est `✗ classify` au log
  (`gh run view <id> --log | grep classify`). Modèle en service :
  `nvidia/nemotron-3.5-lightning:free`, raisonnement coupé, replis
  `STRONG_MODEL` (`nemotron-3-ultra-550b`) puis `google/gemma-4-31b-it:free`, délai 30 s ;
  la brève met `STRONG_MODEL` en TÊTE dans les six langues (`briefModels`) :
  lightning y glissait des mots latins (hy/ru) et des erreurs de fait (en). Les modèles `:free` se retirent (404) — **et un
  modèle mort peut rester listé** dans `https://openrouter.ai/api/v1/models`
  (super-120b, 24 oct. 2026) : testez par un appel réel, puis ajoutez-le à
  `RETIRED` (`test/models.test.mjs`). Ceux à raisonnement dépassent le délai,
  les points d'accès gratuits répondent 429.
- **Une mesure prise sur `src/data/` se périme AU MILIEU d'une séance, et c'est
  le robot horaire qui la périme.** Le cas exact : « les 80 cartes du Courrier
  sont datées » a été mesuré sur l'instantané de la veille ; un `git pull` a
  ensuite ramené cinq snapshots, et dans celui du jour le compte était
  **0/80**. La conclusion était vraie à la mesure et fausse au rapport, sans
  qu'une ligne de code ait bougé — c'est ainsi qu'une panne déjà en cours a été
  décrite comme un risque théorique.

  Toute affirmation qui dépend des données doit donc être **re-mesurée après la
  fusion**. Le contrôle qui coûte le moins, un compte par source :

  ```bash
  node -e "const d=require('./src/data/news.json');for(const[k,v]of Object.entries(d)){if(k==='generatedAt')continue;const a=[],g=x=>{if(Array.isArray(x))x.forEach(g);else if(x&&typeof x==='object'){if(x.title&&x.url)a.push(x);else Object.values(x).forEach(g)}};g(v);console.log(k,a.length,a.filter(x=>x.date).length)}"
  ```

  C'est le pendant, côté données, de la règle du skill `verifier-le-rendu` : ne
  publiez jamais un chiffre obtenu une seule fois par un seul chemin.
- **Le backfill ressert indéfiniment une source tombée**, pendant que
  `meta.generatedAt` et le `lastmod` annoncent de la fraîcheur. Depuis le
  24 octobre 2026, `scripts/health.mjs` ouvre alors une issue `[sources-down]`
  (âge de l'article le plus récent par source × langue, brève du jour à midi
  d'Erevan, agenda vide, plus de 40 articles non classés, capture Don Narek
  en échec). **Le piège : ses seuils sont PAR SOURCE**
  (`STALE_HOURS`, `scripts/lib/health.mjs`, mesurés sur trois semaines). Une
  source nouvelle prend 96 h par défaut : un hebdomadaire ou une revue à
  numéros (Artzakank, `null`) y déclencherait une fausse alerte à chaque
  creux — déclarez son seuil dans le même commit.
- **Brève quotidienne : le hreflang d'une page datée ne cite que les langues présentes ce jour-là** (`scripts/lib/brief-links.mjs`, partagé avec le sitemap). Une journée sans brève ne casse rien : le seul signe est `✗ brief/{lang}` au log (`gh run view <id> --log | grep brief`). Le modèle ne fournit jamais d'URL : elles viennent des articles sélectionnés. Seul filtre de texte : l'alphabet (`brief-script.mjs`) — un sujet hy/ru qui écrit du latin hors titres sources (ou l'inverse en fr/en) est écarté ; signe au log : `✗ brief/hy: alphabet`. Les modèles :free le faisaient (« successoffice », « football » en russe, 17 oct. 2026).
- **Résumés de l'agenda (visionneuse, « Résumé ▾ ») : trois pièges muets.** (1) Le cache `src/data/agenda-resumes.json` et le dossier `src/data/agenda-resumes/` doivent rester dans la ligne `git add` de `hourly.yml` : absents, ils seraient refaits chaque heure sans le moindre signe (`test/agenda-resumes-wiring.test.mjs`). (2) Ils ne sont chargés qu'au premier dépli (`src/agendaResumes.js`, `import.meta.glob` non-eager) : un import statique les mettrait dans le bundle des deux vitrines. (3) Leur chaîne de modèles est **propre** (`RESUME_MODELS`, `scripts/lib/agenda-resumes.mjs`, `nemotron-3-ultra-550b` en tête) : la tête de la brève, `lightning`, écrit un arménien inutilisable — 0 résumé arménien sur 20, tous écartés par la garde d'alphabet (24 oct. 2026). Signe de panne : `✗ résumé` au log.
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

  **Et le même piège existe côté FUSEAU, sur les dates de l'agenda.** Armenopole
  n'écrit que « AOÛ 30 12:30 » — l'heure murale du lieu, sans année ni offset.
  `isoFromMonthDay` (`scripts/lib/util.mjs`) l'a longtemps passée par
  `new Date(année, mois, jour, h, m).toISOString()` : composée dans le fuseau
  de la machine qui scrape (UTC sur le runner), donc 12:30 à Genève publié
  comme `12:30Z`, et les 23:59 (« pas d'heure » chez Armenopole, 27 événements
  sur 155) basculant au lendemain pour un lecteur suisse — le prérendu disait
  31, son navigateur 1 — et dans le JSON-LD. Un scrape lancé depuis Zurich
  donnait d'autres valeurs que la CI. Rien ne tombait : une date décalée est
  une date valide. Depuis le 21 août 2026 la date stockée est une **heure
  murale sans fuseau** (`2026-08-30T12:30`), que tout moteur lit en heure
  locale — `getDate()` rend le même jour partout — et le nœud `Event` est
  composé **une fois** (`eventLd`, `src/agendaEvents.js`) pour l'accueil et
  pour `/agenda/`, 23:59 émis comme date seule. Ne remettez pas de `Z`, et ne
  recomposez pas d'`Event` hors de ce module : `test/util-dates.test.mjs` et
  `test/event-ld.test.mjs` le gardent.

  **Le même piège vaut pour `Intl.RelativeTimeFormat`**, et c'est pourquoi
  l'âge des dépêches a lui aussi ses tables écrites en dur
  (`src/relativeTime.js`). L'employer pour fr/en/ru en réservant une table à
  `hy` ferait dépendre le rendu du moteur — donc de la machine qui prérend.
- **La marque arménienne s'écarte volontairement du domaine, ET de l'écriture
  latine.** `/hy/` affiche **« Արմենիա Ինֆո »** là où `/` et `/ru/` affichent
  « Armenia News » (`STRINGS.hy['site.title']`, `src/i18n.jsx`). C'est une
  **translittération** — le son du nom latin en lettres arméniennes, pas
  « Հայաստան » qui traduirait *Armenia* par le nom natif ; le procédé suit le
  précédent d'« Արմենիա TV ».

  C'est la **seule** entorse à la règle « la marque suit le domaine » que porte
  `sites.config.js`, et elle a une conséquence à connaître : `SITES.org.brand`
  reste « Armenia News », donc le `<title>`, l'`og:title` et le JSON-LD de
  `/hy/` annoncent toujours « Armenia News ». L'écart entre le texte **vu** et
  les **métadonnées** est assumé et demandé. Ne « corrigez » pas un seul des
  deux côtés en croyant réparer une incohérence : les deux valeurs sont voulues.
  Pour les aligner il faudrait une marque par langue dans `sites.config.js`, ce
  qui touche le SEO et la carte de partage (un JPG cuit qui dit « Armenia
  News »).

  **Le passage à l'écriture arménienne a rouvert trois réglages** que
  `global.css` réservait au latin en s'appuyant sur « la marque ne compose que
  du latin » — hypothèse morte. Un bloc `html:lang(hy)` dédié, juste après
  `.hero__title em`, redonne à `.hero__title` et `.nav__brand` la cible
  arménienne (`cap-height 0.685`) et une approche nulle, et **annule
  l'italique** du titre : Noto Serif Armenian n'embarque aucune italique, donc
  `font-style: italic` faisait synthétiser au navigateur un penché mécanique —
  l'arménien n'a pas d'italique de tradition. Le dégradé abricot, lui, reste.
  Si cette marque repasse un jour en latin, ces trois exceptions redeviennent
  inutiles.
- **Les `hreflang` doivent rester réciproques.** Les six `alternate` plus
  `x-default` sont identiques sur les six pages d'une vue, chacune se citant
  elle-même. Une page absente de son propre bloc fait ignorer **tout** le bloc
  par Google — silencieusement. C'est pourquoi un seul générateur les produit.
- **`firebase.json` n'a plus de rewrite `**` → `index.html`, et ne doit pas le
  retrouver.** Ce catch-all servait l'accueil en **200** à toute URL inconnue
  (`/does-not-exist`, `armenieinfo.ch/events/`, `armenianews.org/fr/`…) : des
  soft 404 en nombre illimité, un doublon de l'accueil par lien cassé, mesuré
  en production le 21 août 2026. Le site n'en a pas besoin — chaque vue est un
  dossier réel, et la redirection `/radio` → `/radio/` est le comportement de
  répertoire de Firebase, pas le rewrite. Depuis, `build-sites.mjs` écrit un
  `404.html` par vitrine (`scripts/lib/not-found.mjs`, langue du domaine,
  `noindex`, liens vers les trois vues de chaque langue), le bloc `redirects`
  (dupliqué, comme `headers`) envoie les slugs jumeaux vers la vue du domaine
  et `/fr/` du .org vers le .ch, et une étape du workflow **sonde la
  production après le déploiement** — parce que ni `npm run check` ni les
  tests ne voient un code HTTP. `test/not-found.test.mjs` garde la page et la
  configuration.
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
- **Réseaux sociaux : le registre `src/data/social-posted.json` est la seule
  mémoire de ce qui est parti** (`scripts/social-post.mjs`, guide
  `docs/social-setup.md`). Le supprimer ne republie rien — chaque compte est
  ré-amorcé en silence — mais retirer UNE ligne republie cet article. Un compte
  sans entrée y est amorcé, jamais servi l'archive. Ajouter un secret de canal
  touche deux endroits : `ACCOUNTS` (`scripts/lib/social.mjs`) et le bloc `env`
  du job `social` de `hourly.yml` ; `test/social.test.mjs` échoue sur l'oubli.
- **IndexNow prévient Bing des pages nouvelles, et c'est le SEUL canal du
  .ch** : Bing Webmaster Tools lui accorde 0 soumission manuelle par jour.
  `hourly.yml` recopie les sitemaps en ligne avant le déploiement et soumet
  l'écart après (`scripts/indexnow.mjs`, au jour près). `public/<clé>.txt`
  prouve la propriété des deux hôtes : le supprimer ou le renommer fait
  répondre 403 à chaque envoi, sans que le job échoue — signe : `✗ indexnow`.
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
- **`continue-on-error` cache l'échec À L'API AUSSI, pas seulement à l'œil.**
  `gh run view --json jobs` rend `conclusion: success` pour une étape qui a
  quitté en 1 : aucune étape n'apparaît en échec, donc même un contrôle scripté
  passe à côté. Le seul moyen fiable est de **lire le log**
  (`gh run view <id> --log | grep "pages prérendues"`). Le prérendu a échoué
  24 h du 11 au 12 août 2026 derrière cet angle mort. Il ouvre désormais une
  **issue GitHub** — titre marqué `[prerender-down]`, assignée (un assigné est
  toujours notifié, un « Watch » peut être coupé), dédoublonnée sur une panne
  longue, et **refermée toute seule au retour**. Ne la remplacez pas par un
  échec de job : le déploiement doit continuer, un prérendu manqué ne dégrade
  que le SEO. La capture d'écran passe par l'issue `[sources-down]`, lue sur
  `steps.screenshot.outcome`.
- **`CONTENT_LANG` (`src/newsLangs.js`) décide de trois choses à la fois.**
  `{ de: 'fr', it: 'fr' }` : de et it n'ont pas de fil propre. Cette table fait
  lire le fil français à leurs pages (`TAB_ORDER.de = TAB_ORDER.fr`), fait
  résumer à leur brève les articles **français** (`brief-generate.mjs`), et
  décide de ce que le bundle du .ch **embarque** (`lightData()` filtre par
  langue de contenu — son `news.json` allégé est resté octet pour octet celui
  d'avant de/it). Y toucher change les trois d'un coup. `ARMENPRESS_LANGS` et
  `CIVILNET_SECTIONS` listent des **éditions** de source, pas des langues
  d'interface : ni de ni it, à dessein, et l'assertion de `build-sites.mjs` ne
  les couvre pas. Enfin, les traductions de/it (brève, Culture) sont
  **facultatives et non relues** : `OPTIONAL` (`culture-validate.mjs`) n'émet
  que des `notes`, jamais d'erreur, et la garde du français dans une brève de/it
  (`brief-script.mjs`) ne compte que les marqueurs en **minuscules** — une
  citation française en minuscules fait écarter son sujet (`✗ brief/de: alphabet`).
- **Les `hreflang` d'une page de vue héritaient d'un générateur pensé pour les
  accueils, et le bloc entier en aurait payé le prix.** `headFor` composait ses
  alternates depuis `LANG_URL`, donc toujours vers les accueils : recopié tel
  quel sur une page de vue, `/radio/` du .ch aurait déclaré comme équivalent
  anglais **l'accueil** du .org, et non `/radio/` du .org. Google, plutôt que
  d'arbitrer entre deux pages incompatibles, **ignore alors le bloc entier** —
  silencieusement, sur toutes les pages, puisqu'un seul générateur les produit
  toutes. `headFor` / `applyMeta` / `replaceMeta` (`scripts/lib/site-meta.mjs`)
  prennent désormais `{ siteId, lang, view }` (`view` vaut `'home'` par défaut,
  ce qui garde les appels existants valides) et composent chaque alternate avec
  `urlFor(l, view)`, jamais `LANG_URL[l]` directement. `xDefaultFor(view)` suit
  la même règle : sur `/radio` le `x-default` pointe le `/radio` anglais, pas
  l'accueil anglais — un `x-default` qui changerait de page au milieu d'un
  bloc d'alternates le rendrait incohérent. Gardé par `test/views.test.mjs` et
  `test/site-meta.test.mjs`, dont le test « une page de vue ne cite jamais
  l'accueil dans ses alternates » échoue précisément sur ce mode de panne.
- **La garde `data-view` du prérendu est la jumelle de la garde de langue déjà
  en place.** `scripts/prerender.mjs` vérifiait déjà que
  `document.documentElement.lang` correspond à la langue attendue ; il vérifie
  désormais aussi `document.querySelector('[data-view]').dataset.view` contre
  la vue attendue. Le serveur de prévisualisation (sirv) retombe sur l'index
  racine pour un chemin qu'il ne reconnaît pas : sans ce second contrôle, une
  erreur de slug ferait cuire l'**accueil** dans le fichier de `/radio/` — une
  page parfaitement valide, au mauvais contenu, sans le moindre signal.
- **Le graphe `Event` de l'agenda ne doit vivre que là où l'agenda est
  visible — et une simple recherche de `"@type":"Event"` ne suffit pas à le
  garder.** Le plugin `agendaEventsJsonLd` (`vite.config.js`, préexistant à ce
  chantier) injecte dans le `<head>` du HTML bâti un `@graph` de tous les
  événements de l'agenda, **hors des sentinelles
  `<!--SITE_META:START/END-->`** : `derivePages` (`scripts/build-sites.mjs`),
  qui ne rebâtit pas une page mais échange le bloc entre sentinelles, le
  recopiait donc tel quel dans **toutes** les pages dérivées. Tant que ces
  pages étaient des accueils, c'était juste — la section Agenda y est
  visible. Depuis les vues, non : `/radio/` embarquerait 159 `Event` datés et
  localisés sur une page qui n'en montre aucun. Google exige que le balisage
  décrive le contenu **visible** ; le risque est une action manuelle « données
  structurées non pertinentes », qui porte sur le **domaine entier**, accueils
  compris. Rien ne l'aurait signalé : aucun test, `npm run check` ni le lint
  ne lisent le `ld+json`.

  D'où un attribut, posé par le plugin et retiré par `derivePages`
  (`scripts/lib/agenda-ld.mjs`, constantes `AGENDA_LD_ATTR` / `AGENDA_LD_VALUE`
  partagées entre les deux côtés — les renommer d'un seul remettrait le graphe
  partout, en silence). Mais `/agenda/` affiche **légitimement** ses propres
  `Event`, posés par le composant via `agendaJsonLd` (`src/jsonld.js`) : un
  test « aucun `Event` hors de l'accueil » aurait donc échoué à tort sur cette
  page. La garde (`scripts/lib/agenda-guard.mjs`) distingue pour cela le
  graphe du **plugin** (l'attribut) de la présence d'`Event` **en général**, à
  trois états :

  | Vue | graphe du plugin (`data-ld="agenda"`) | `Event` en général |
  |---|---|---|
  | accueil | présent si l'agenda a un événement | idem |
  | agenda | absent (le composant pose le sien) | présent si un événement à venir |
  | radio | absent | aucun |
- **`npm run check` ne voit pas le même HTML en CI et en local — l'ordre des
  étapes diffère, et ça a déjà bloqué un déploiement.** Le workflow fait
  `build` → **`check`** → `screenshot` → **`prerender`** → deploy ; au poste de
  travail on enchaîne naturellement `build` → `prerender` → `check`. Or les
  `Event` de la vue `/agenda/` ne viennent **pas** du `<head>` comme ceux de
  l'accueil (que le plugin y écrit au build) : ils viennent du composant React,
  donc de `<div id="root">`, donc du **prérendu**. Exiger leur présence sans
  regarder le stade fait échouer `check` en CI sur les **six** pages agenda,
  toutes saines — et passer en local sur exactement les mêmes. Le prérendu
  étant `continue-on-error` à dessein (un prérendu manqué ne doit pas retenir le
  déploiement), **déplacer `check` après lui n'est pas la correction** : c'est
  la garde qui doit connaître les deux stades.

  `scripts/lib/agenda-guard.mjs` diffère donc la seule exigence qui dépend du
  prérendu, en reconnaissant la sortie brute du build à sa racine React vide
  (`<div id="root"></div>`, le marqueur même que remplace `prerender.mjs`).
  **Le sens du test est ce qui compte** : il reconnaît « pas encore prérendue »,
  pas « prérendue » — tout HTML qui ne porte pas cette signature exacte est tenu
  pour cuit, donc soumis à l'exigence. Écrit dans l'autre sens, un simple
  changement de forme du conteneur rendrait l'exigence inatteignable et la garde
  cesserait de protéger **sans qu'aucun contrôle ne tombe** ; ici le même
  changement la resserre. L'interdiction du graphe du **plugin**, elle, reste
  inconditionnelle aux deux stades : c'est elle qui porte la protection
  d'origine, et ce défaut-là naît au build. `test/agenda-guard.test.mjs` garde
  les deux moitiés, dont le cas qui prouve que la garde peut **encore** échouer
  (page agenda prérendue, aucun `Event`).
- **Aucun fait de station n'est affirmé sans source, et un champ non trouvé
  est un champ ABSENT — jamais « ? », jamais une approximation.**
  `src/stations.js` (`STATION_FACTS`) documente, station par station, où
  chaque fait a été trouvé et pourquoi certains restent volontairement
  absents : la fréquence FM de la Première chaîne (Radio publique d'Arménie)
  est absente parce que la page officielle « How to Listen » se contredit
  elle-même pour Erevan (103,8 ET 69,8 MHz, dans le même onglet) et que
  Wikipédia en indique une troisième (107,7) ; la ville de Radio Yeraz est
  absente parce que le site se décrit lui-même comme émettant depuis Alep
  tandis qu'un annuaire indépendant la classe sous Erevan — deux sources qui
  se contredisent valent une absence, pas un arbitrage à la main. Plusieurs
  fiches n'ont ainsi que deux champs, et c'est voulu : une fiche à deux champs
  vrais classe aussi bien qu'une fiche à cinq champs plausibles, et elle ne
  coûte pas la crédibilité du site le jour où un lecteur la dément.

  `test/stations.test.mjs` rend la règle mécanique : tout fait déclaré doit
  porter au moins une source en `https://`, et `genre` / `langue` sont des
  **clés** — pas du texte affichable, `RadioPage.jsx` les rend par
  `t('radio.genre.'+f.genre)` — donc chacune doit être déclarée **dans les
  six blocs** `STRINGS` de `src/i18n.jsx`. Sans ce dernier contrôle, une
  station ajoutée avec `genre: 'talk'` passerait le test de sourçage, le lint,
  `npm run check` et le prérendu — et les six pages `/radio/` afficheraient
  « Genre : radio.genre.talk », cuit dans le HTML que Google indexe (`t()`
  vaut `STRINGS[lang][clé] ?? STRINGS.fr[clé] ?? clé` : une clé absente
  **rend la clé**). Même mécanique que `test/radio-count.test.mjs`, sur une
  autre famille de chaînes.
- **Une station de radio peut se taire sans que RIEN ne le dise, et le dépôt
  n'en garde qu'une URL — qui reste valide longtemps après le silence.** Le
  premier signalement vient d'un lecteur qui clique et n'entend rien : ni test,
  ni lint, ni build ne regardent le réseau. D'où `npm run radio-check`, à
  lancer depuis une IP résidentielle (Voice of Van refuse les IP de
  datacenter). Il contrôle les dix-sept flux **dans les deux sens** — une station
  muette non marquée, et une station marquée qui rediffuse ; sans ce second
  sens, un `offAir` resterait posé pour toujours après le retour de la station.

  Trois mesures à connaître, chacune ayant coûté une fausse piste :
  - **401 ≠ 404.** Sur un Shoutcast, 401 « resource currently unavailable »
    signifie que le compte existe et qu'aucun encodeur n'y est connecté ; un
    mount inexistant répond 404. Un 401 n'est donc jamais une URL périmée — la
    chercher ailleurs est du temps perdu. Im Radio (août–octobre 2026) puis
    Gospel en sont les cas : détail dans le commentaire `offAir` de `Radio.jsx`.
  - **Le verdict est dans les octets, pas dans le code HTTP.** Un proxy devant
    un flux mort répond 200 avec un corps vide. `radio-check` attend le premier
    octet d'audio, puis raccroche.
  - **La moitié de ces serveurs ne parlent pas HTTP.** Voice of Van répond
    `ICY 200 OK`, ligne de statut Shoutcast v1 que le parseur de Node **et**
    curl refusent (`HPE_INVALID_CONSTANT`). D'où une socket nue dans
    `radio-check.mjs` : la première version, écrite avec `node:https`,
    déclarait en panne une station qui diffusait parfaitement.

  **Et `radio-check` ne dit PAS si une station peut se brancher à l'analyseur.**
  Il vérifie qu'elle diffuse, pas qu'elle se lit. `crossOrigin="anonymous"`
  exige `Access-Control-Allow-Origin` sur la réponse du flux : sans cet
  en-tête le navigateur ne baisse pas le son, il **refuse la ressource** —
  la station ne joue pas du tout, et aucun contrôle ne tombe. Ces flux-là
  prennent `plain: true`. Ça ne se devine pas de l'URL : `vemradio` et
  `arradioi` vivent sur le même hôte (`eu1.stream4cast.com`) et n'ont pas le
  même serveur derrière — Icecast sans CORS pour l'un, Shoutcast avec CORS
  pour l'autre. Une seule commande tranche, à lancer pour **toute** station
  ajoutée :

  ```bash
  curl -s -D - -o /dev/null -H 'Origin: https://armenieinfo.ch' <flux> | grep -i access-control
  ```

  **Marquer plutôt que retirer** : une station retirée ferait mentir les
  textes qui écrivent « dix-sept » en toutes lettres dans six langues,
  descriptions Google comprises, et tout serait à refaire à l'envers au retour.
  `offAir: true` rend la puce inerte sans toucher au compte.
- **Articles Culture : neuf pièges silencieux** (un brouillon par jour,
  03:00 UTC). (1) Un commit ou une PR poussés avec le `GITHUB_TOKEN` ne
  déclenchent aucun autre workflow : `articles.yml` et
  `articles-translate.yml` publient EUX-MÊMES le statut `culture-check`, sans
  quoi la PR aurait l'air vérifiée. (2) Chaque traduction porte l'empreinte du
  `fr.md` source (`sourceHash`) : retoucher le français la déclare périmée, et
  le build la retire. (3) Cocher « Faits vérifiés » PUBLIE : traduit, contrôle,
  fusionne — et cette fusion ne déclenche PAS le push sur `main`, d'où le
  `gh workflow run hourly.yml` explicite. (4) Un titre Wikipédia deviné attrape
  les homonymes (fr « Kochari » = le koshary égyptien) : les sujets se
  résolvent par `qid` Wikidata (`sujets.json`), les titres viennent des
  sitelinks. (5) `/corrige`, `/ajoute`, `/rejette` sont des consignes envoyées
  au modèle ou écrites sur `main` : la garde est `author_association ==
  'OWNER'` (et, pour les idées, issue écrite par `github-actions[bot]` — dépôt
  public, une issue au même titre se contrefait). Ne l'élargissez jamais.
  (6) Le grounding Google Search de Gemini interdit de stocker/publier ses
  résultats : jamais pour un brouillon. (7) Les traductions n'ont aucun repli de
  modèle, à dessein (du hy/ru/en non relu serait publié) : une panne Gemini
  retarde la publication, avec un commentaire. (8) Pas de réaction 👀 sur une
  commande = elle a été écartée (GitHub ne garde qu'un run en attente par
  groupe) : renvoyez-la. (9) Une branche `culture/*` ouverte avant ce chantier
  n'a pas `scripts/culture-revise.mjs` : `/corrige` y échoue jusqu'au rebase.
  Le pourquoi : `docs/superpowers/specs/2026-10-16-articles-culture-design.md`.
- **Pièges de rendu vus en production** (titre d'étagère qui élargit la page,
  `scrollIntoView`, `visibility: hidden`, `loading="lazy"` avant `src`, cible
  tactile de 44px tenue par `pointer: coarse`, Ararat de la marque) :
  `.claude/skills/verifier-le-rendu/pieges-rendu.md`.