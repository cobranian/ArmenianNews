# Deux domaines, une base de code

**Date** : 2026-07-28
**Objet** : servir `armenieinfo.ch` (français) et `armenianews.org` (anglais,
arménien, russe) depuis un seul dépôt, un seul scrape horaire et un seul projet
Firebase — en rendant enfin indexables les trois langues aujourd'hui invisibles.

## Le problème

`armenianews.org` vient d'être acheté et n'est pas encore actif. La demande
initiale était de dupliquer le dépôt dans deux dossiers frères. Trois faits
mesurés dans le code écartent cette forme.

**Le canonical est en dur.** `index.html:9` porte
`<link rel="canonical" href="https://armenieinfo.ch/" />`, et de même pour
`og:url`, les `@id` du JSON-LD, `public/sitemap.xml` et `public/robots.txt`. Un
dossier dupliqué tel quel ferait dire à `armenianews.org` que la page réelle est
`armenieinfo.ch`. Le domaine ne serait classé sur aucune requête, sans qu'aucun
log ne le signale.

**Le scrape ne supporte pas d'être doublé.** Le job horaire visite 28 pages
Armenpress, ~50 pages Asbarez et six autres sources. Armenpress, Asbarez et
armradio bloquent déjà les IP de datacenter (documenté dans `CLAUDE.md`) ;
doubler la cadence double le risque de blocage durable, que le backfill
masquerait ensuite en silence.

**La langue n'a pas d'URL.** Elle vit dans un contexte React et `localStorage`
(`src/i18n.jsx:570-582`). `armenieinfo.ch/` sert quatre langues sous une seule
adresse, et `scripts/prerender.mjs` ne cuit que le français. Google n'a donc
jamais indexé une ligne d'anglais, d'arménien ou de russe : Armenpress EN/HY/RU,
ArmRadio, Asbarez, Oragark et California Courier sont scrapés chaque heure et
introuvables en recherche. `hreflang` — le mécanisme qui déclare à Google que
deux pages sont le même contenu en deux langues — exige une URL par langue. Sans
URL, pas de `hreflang` ; sans `hreflang`, deux domaines au contenu identique sont
du duplicate content et Google en écarte un.

## La forme retenue

Une base de code, deux vitrines. Ce qui diffère entre les deux sites tient en une
quarantaine de lignes de métadonnées ; le moteur (scrapers, données, composants,
styles) est strictement partagé.

| URL | Langue | Site Firebase | Marque |
|---|---|---|---|
| `armenieinfo.ch/` | fr | `armenie-info` | Arménie Info |
| `armenianews.org/` | en | `armenia-news` | Armenia News |
| `armenianews.org/hy/` | hy | `armenia-news` | Armenia News |
| `armenianews.org/ru/` | ru | `armenia-news` | Armenia News |

Aucun fichier ne change de dossier. `scripts/`, `src/data/`, les Workers
Cloudflare et `eslint.config.js` ne sont pas touchés.

### Formes écartées

**Deux dossiers, code dupliqué** (la demande initiale) : deux jobs horaires sur
des sources qui bannissent déjà les IP de CI, et les quinze pièges documentés
dans `CLAUDE.md` à corriger deux fois. La dérive est certaine.

**Monorepo npm workspaces** (`packages/core` + `sites/*`) : donne la séparation
physique sans la duplication, mais casse `npm ci` en CI, les chemins relatifs de
`prerender.mjs`, `shoot.mjs` et `scrape.mjs`, et les trois environnements
d'`eslint.config.js` — pour isoler quarante lignes de métadonnées. Le prix d'un
monorepo pour le bénéfice d'un fichier de config.

**Un seul site Firebase, deux domaines attachés** : les deux domaines
serviraient le même `index.html`, donc le même prérendu et le même canonical.
C'est exactement le duplicate content qu'on cherche à éviter.

**Redirection 301 du .org vers le .ch** : propre pour le référencement, mais
`armenianews.org` n'aurait aucune présence anglophone propre. Contraire à
l'objectif.

## Architecture

### 1. `sites.config.js` — source de vérité unique

Un fichier à la racine décrit les deux vitrines. Les métadonnées HTML, les
`hreflang`, les sitemaps, les cibles Firebase et le sélecteur de langue en
dérivent tous.

```js
export const SITES = {
  ch:  { host: 'https://armenieinfo.ch',  firebaseSite: 'armenie-info',
         brand: 'Arménie Info', gscToken: 'dMoDQHq0L5w16RdNPGKom7TJZe6LNjEc7Qq4PtVjO7k',
         pages: [{ lang: 'fr', path: '/' }] },

  org: { host: 'https://armenianews.org', firebaseSite: 'armenia-news',
         brand: 'Armenia News', gscToken: null,   // à remplir après création GSC
         pages: [{ lang: 'en', path: '/' },
                 { lang: 'hy', path: '/hy/' },
                 { lang: 'ru', path: '/ru/' }] },
}
```

Le module dérive et exporte `LANG_URL` (`lang` → URL absolue), consommé par le
générateur de `hreflang` **et** par le sélecteur de langue — une seule table,
donc pas de divergence possible entre ce que le HTML déclare à Google et ce que
le bouton fait au clic.

**Invariant vérifié au build** : l'union des `pages[].lang` doit égaler
`LANGS` de `src/i18n.jsx`. Le build échoue sinon. Sans cette assertion, ajouter
une cinquième langue à `LANGS` la rendrait traduite partout et joignable nulle
part, en silence.

### 2. Métadonnées : un plugin Vite, pas quatre `index.html`

`index.html` reste unique en source et perd ses métadonnées en dur. Un plugin
`transformIndexHtml` dans `vite.config.js` les injecte selon le couple
(site, langue), lu depuis les variables d'environnement du build :

- `<html lang>`, `<title>`, `<meta name="description">`. Le titre se compose de
  **deux sources** : la marque vient du site (`SITES[id].brand`), la baseline et
  la description viennent de nouvelles clés `seo.tagline` / `seo.description`
  dans `src/i18n.jsx`, une par langue. Ainsi `armenianews.org/hy/` affiche la
  marque « Armenia News » avec une baseline en arménien — la marque suit le
  domaine, le reste suit la langue.
- `canonical` auto-référent et absolu
- les quatre `<link rel="alternate" hreflang>` plus `x-default`, **identiques sur
  les quatre pages**. Google exige la réciprocité : une page qui ne se cite pas
  elle-même dans son propre bloc voit tout le bloc ignoré.
- `og:url`, `og:site_name` (la marque du site), `og:locale` et ses alternates,
  `og:image` en absolu vers le bon host
- JSON-LD : deux entités `Organization` distinctes, une par marque, reliées par
  `sameAs`. C'est ce qui présente les deux domaines comme des sites sœurs plutôt
  que comme deux copies.
- la balise `google-site-verification` propre au site

`og:image` reste `og-image.jpg` pour les deux sites au départ — contrainte connue
à respecter si on en produit une seconde : 1200×630, sRGB, sans profil ICC, sinon
WhatsApp n'affiche pas d'aperçu.

### 3. Résolution de la langue au démarrage

Ordre strict, dans `LanguageProvider` (`src/i18n.jsx`) :

1. le **chemin** (`/hy/`, `/ru/`) fait autorité ;
2. sinon la **langue par défaut du site**, injectée au build ;
3. `localStorage` **ne participe plus** — la lecture et l'écriture de la clé
   `lang` sont supprimées.

Ce troisième point est un changement de comportement délibéré. En conservant
`localStorage`, un lecteur ayant déjà visité le .ch en français et arrivant sur
`armenianews.org/hy/` recevrait un HTML prérendu en arménien sous
`<html lang="hy">`, que React basculerait en français au montage : flash de
contenu, et un attribut `lang` qui ment sur ce qui est affiché. Googlebot n'ayant
pas de `localStorage`, l'écart serait invisible en test et bien réel pour les
lecteurs.

Contrepartie assumée : le site ne se souvient plus de la langue choisie. C'est le
prix des URL par langue, et l'échange est favorable — l'URL devient la mémoire,
et elle se met en favori, revient dans l'historique et se partage, ce que
`localStorage` ne fait pas.

### 4. Le sélecteur de langue devient de la navigation

`Nav.jsx:61` est le **seul** consommateur de `setLang` dans tout `src/`.
`onClick={() => setLang(l.code)}` devient `<a href={LANG_URL[l.code]}>`, et
`setLang` disparaît du contexte.

Passer de fr à en change de domaine (rechargement complet) ; hy↔ru reste sur le
.org. Bénéfice non évident : ce sont quatre liens en dur dans le HTML de chaque
page, donc un maillage réciproque entre les deux domaines — le signal que Google
attend en plus des `hreflang` pour traiter deux domaines comme un ensemble.

**Ordre d'affichage : figé par domaine**, la langue du domaine en tête.

| Page | Sélecteur |
|---|---|
| `armenieinfo.ch/` | **FR** · EN · ՀԱՅ · РУ |
| `armenianews.org/` | **EN** · FR · ՀԱՅ · РУ |
| `armenianews.org/hy/` | **EN** · FR · ՀԱՅ · РУ *(ՀԱՅ actif)* |
| `armenianews.org/ru/` | **EN** · FR · ՀԱՅ · РУ *(РУ actif)* |

L'ordre ne bouge donc pas en naviguant à l'intérieur du .org : la barre reste
stable, seule la mise en évidence de la langue active se déplace. L'ordre vient
de `SITES[id].pages[0].lang` suivi du reste de `LANGS`, pas d'une liste écrite à
la main — sinon ajouter une langue obligerait à corriger deux listes.

Les quatre langues restent listées sur les deux domaines : chaque entrée est un
lien vers l'URL de cette langue, y compris celles qui vivent sur l'autre
domaine.

### 5. Build

```
npm run build
├── vite build  SITE=ch   → dist/ch/index.html    (fr)
└── vite build  SITE=org  → dist/org/index.html   (en)
    └── post-build : copie vers hy/index.html et ru/index.html,
                     métadonnées réinjectées
```

Les trois pages du .org partagent le même bundle JS ; seules les métadonnées et
la langue de démarrage diffèrent. Une copie de fichier HTML suffit — pas de
multi-entrée Rollup, pas d'assets dupliqués. Deux builds Vite au total.

### 6. Prérendu

`scripts/prerender.mjs` sert aujourd'hui `dist/` via `vite preview`, visite `/`
et recuit `dist/index.html`. Il boucle désormais : servir `dist/ch` et visiter
`/` ; servir `dist/org` et visiter `/`, `/hy/`, `/ru/` ; recuire les quatre
fichiers.

Coût en CI : environ une minute de plus (quatre rendus Puppeteer). L'étape reste
`continue-on-error`, donc un échec dégrade vers le SPA nu, comme aujourd'hui.

`CLAUDE.md` documente que seul l'onglet par défaut (Armenpress) est prérendu.
Sous `/hy/` ce sera Armenpress arménien, sous `/ru/` Armenpress russe : les trois
langues scrapées mais jamais indexées deviennent du texte brut lisible par
Google. C'est le gain principal de l'opération.

### 7. `robots.txt` et `sitemap.xml` générés

`public/sitemap.xml` est aujourd'hui committé chaque heure par la CI
(`hourly.yml`, étape « Commit refreshed data »). Il en faut désormais deux, avec
des `<loc>` distincts, et `public/` étant partagé entre les deux sites il ne peut
plus les héberger.

Les deux fichiers passent en génération au build, dans `dist/<id>/`, à partir de
`src/data/meta.json` qui porte déjà `generatedAt`. Le sitemap du .org liste ses
trois URL avec leurs annotations `hreflang`. `public/sitemap.xml` est supprimé du
dépôt et retiré du `git add` horaire — un commit de moins par heure, et un diff
horaire qui ne contient plus que des données.

### 8. Firebase : deux sites, un seul projet

```jsonc
// .firebaserc
{ "projects": { "default": "armenie-info" },
  "targets": { "armenie-info": { "hosting": {
      "ch":  ["armenie-info"],
      "org": ["armenia-news"] } } } }

// firebase.json — "hosting" devient un tableau
[ { "target": "ch",  "public": "dist/ch",  … },
  { "target": "org", "public": "dist/org", "cleanUrls": true, … } ]
```

Un seul projet Firebase, donc le service account et le secret CI existants
(`FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO`) conviennent : leur rôle Hosting Admin
porte sur le projet et couvre le nouveau site. `firebase deploy --only hosting`
publie les deux cibles.

Deux points à **vérifier avant de déployer**, pas à supposer :

- **`/hy/` face au rewrite SPA.** Firebase sert le contenu statique avant
  d'appliquer les rewrites, donc `dist/org/hy/index.html` devrait l'emporter sur
  `"source": "**"` → `/index.html`. À confirmer au `firebase emulators:start`.
  Si ça ne passe pas, ajouter un rewrite explicite `/hy/**` avant le catch-all.
- **Le garde-fou `is the current active version`** de `hourly.yml` : avec deux
  cibles, la forme du message d'erreur de Firebase peut changer. Une heure sans
  changement de données doit rester un no-op réussi, pas un job en échec.

Le bloc `headers` (CSP comprise) est dupliqué dans les deux entrées de
`firebase.json`. C'est une dérive qui finira par arriver — typiquement un
nouveau host de flux radio ajouté à `media-src` d'un seul côté. À documenter
dans `CLAUDE.md` parmi les pièges.

**DNS** : chez le registrar d'`armenianews.org`, poser les enregistrements A que
Firebase affiche à l'ajout du domaine personnalisé. Certificat automatique.

### 9. Analytics et Search Console

**GA4** : une seule propriété (`G-EB3W5XXSMW`) pour les deux domaines. Le
hostname étant déjà une dimension GA4, les deux sites se segmentent sans rien
recréer. Un réglage requis dans l'interface : ajouter `armenianews.org` aux
domaines de référence exclus, faute de quoi chaque clic fr→en se compte comme du
trafic de référence et les deux sites se volent leurs attributions.

**Search Console** : créer une propriété pour `armenianews.org`. Elle fournit un
jeton de vérification à poser dans `sites.config.js` (`org.gscToken`).

**Soumission des sitemaps** — une étape manuelle par domaine, à faire une fois :

| Propriété GSC | Sitemap à soumettre | Quand |
|---|---|---|
| `armenieinfo.ch` | `https://armenieinfo.ch/sitemap.xml` | dès le déploiement |
| `armenianews.org` | `https://armenianews.org/sitemap.xml` | après propagation DNS et certificat |

Soumettre le sitemap du .org **avant** que le domaine ne résolve renvoie une
erreur de récupération dans GSC. Attendre que `https://armenianews.org/` réponde
en 200 dans un navigateur.

**Ce que `hreflang` fait et ne fait pas.** Il indique à Google que les quatre
URL sont le même contenu en quatre langues, ce qui produit deux effets : Google
sert la version correspondant à la langue du visiteur, et il cesse de traiter
les autres comme des doublons à écarter. Il **ne transfère aucune autorité entre
les domaines** — ce n'est pas un signal de classement. Le gain est défensif (ne
pas se cannibaliser), pas multiplicatif : `armenianews.org` démarre avec
l'autorité d'un domaine neuf. Le renforcement mutuel réel vient des liens en dur
du sélecteur de langue (§4). Cette distinction est notée ici pour que l'attente
reste calibrée si le trafic du .org met des mois à décoller — ce sera normal.

### 10. Ce qui ne change pas

`armenieinfo.ch` garde son URL, son canonical, sa propriété Search Console et son
classement. Aucune redirection, aucune migration : le référencement acquis n'est
pas exposé. Le seul changement visible côté .ch est que le sélecteur de langue y
mène désormais vers le .org au lieu de basculer sur place.

## Ordre de livraison

Une seule branche portant l'ensemble : `sites.config.js`, plugin de
métadonnées, résolution de langue par URL, sélecteur en liens, build à deux
sorties, prérendu en boucle, sitemaps générés, configuration Firebase. Vérifié
en local puis à l'émulateur, déployé d'un bloc. `armenieinfo.ch` ne bouge qu'au
merge.

**Étape manuelle bloquante** : la propriété Search Console d'`armenianews.org`
doit exister et son jeton être posé dans `sites.config.js` avant la mise en
ligne. Le DNS peut être posé en parallèle.

**Étapes manuelles après déploiement** : soumettre les deux sitemaps dans leurs
propriétés Search Console respectives, et ajouter `armenianews.org` aux domaines
de référence exclus dans GA4 (§9).

## Vérification

Il n'y a pas de suite de tests dans ce dépôt ; le lint et l'exécution réelle
tiennent lieu de vérification. Pour ce chantier :

- `npm run lint` — doit rester à 0 erreur et **6 avertissements**, les six
  connus et documentés dans `CLAUDE.md`. Un septième signale une régression.
- `npm run build` — produit `dist/ch/index.html` et `dist/org/{index,hy/index,ru/index}.html`.
- Inspection des quatre HTML : `<html lang>` correct, `canonical` auto-référent,
  les quatre `hreflang` réciproques présents sur chacun, `og:site_name` conforme
  à la marque du site.
- `npm run prerender` — les quatre fichiers contiennent l'édition Armenpress de
  leur langue, pas un `<div id="root">` vide.
- `firebase emulators:start` — `/`, `/hy`, `/hy/`, `/ru` servent bien la page
  prérendue correspondante et non le catch-all SPA.
- `npm run dev` — le sélecteur de langue navigue vers la bonne URL ; aucune clé
  `lang` n'est écrite dans `localStorage`.
- Ordre du sélecteur : **FR** · EN · ՀԱՅ · РУ sur le .ch, **EN** · FR · ՀԱՅ · РУ
  sur les trois pages du .org, avec la langue active mise en évidence.
- Les deux sitemaps répondent en 200 sur leur domaine et listent les bonnes
  `<loc>` avec leurs annotations `hreflang`.

## Documentation à mettre à jour

`CLAUDE.md` et `README.md` : la structure à deux sites, le rôle de
`sites.config.js`, la règle de résolution de langue (URL d'abord, plus de
`localStorage`), la duplication du bloc `headers` dans `firebase.json` comme
piège, et la procédure de déploiement à deux cibles.
