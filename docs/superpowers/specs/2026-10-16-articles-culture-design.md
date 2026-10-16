# Articles « Culture » — design

Date : 16 octobre 2026
Statut : validé en brainstorming, à relire avant le plan d'implémentation.

## Objectif

Augmenter le trafic organique et le temps passé sur armenieinfo.ch et
armenianews.org en publiant des articles **originaux** sur l'histoire, la
culture, la danse et la musique arméniennes — un contenu propre aux deux
vitrines, condition préalable à une future demande AdSense.

**Ce que ce chantier n'est pas** : de la reformulation automatique de
Wikipédia publiée sans relecture. Ce modèle est explicitement refusé par
AdSense (« contenu reproduit », « faible valeur ») et par les règles anti-spam
de Google (« scaled content abuse », « scraped content »), dont l'action
manuelle frapperait le domaine entier, actualités comprises. Wikipédia et
Wikidata servent de **sources de faits**, pas de texte à paraphraser.

## Décisions

| Sujet | Décision |
|---|---|
| Relecture | Humaine, 30 à 60 min par semaine, sur le français uniquement |
| Rythme | Un article par semaine |
| File de relecture | Une pull request GitHub par article |
| Langues | Français = référence relue ; en / hy / ru traduits **depuis le français relu** |
| Déclenchement des traductions | Étiquette `traduire` posée sur la PR |
| Sujets | Liste curée `sujets.json` + priorité aux sujets liés à un événement de l'agenda dans les 21 jours |
| Images | Wikimedia Commons, licences PD / CC0 / CC BY / CC BY-SA, crédit affiché |
| Modèle | Gemini Flash (offre gratuite, Google AI Studio), via un point d'accès **compatible OpenAI configurable** |
| Section | « Culture » / *Culture* / *Մշակույթ* / *Культура*, slug `culture/` |
| Publicité | Hors périmètre — chantier séparé après ~15-20 articles |

### Pourquoi Gemini Flash, et pas OmniRoute

OmniRoute (passerelle auto-hébergée, bascule entre fournisseurs gratuits) a été
évalué. Il réglerait l'instabilité des modèles `:free` (404, 429), mais **pas**
la qualité de l'arménien — un routeur choisit qui répond, il ne rend pas le
modèle meilleur, et une bascule silencieuse vers un petit modèle sur une
traduction non relue serait invisible. Il ajoute un serveur à faire tourner
en CI, une passerelle qui voit toutes les clés, et un projet aux sorties très
fréquentes. Son mode « abonnements » enfreint les conditions des fournisseurs.
Pour un job hebdomadaire relançable à la main, la bascule n'a pas de valeur.

Le code n'appelle qu'un point d'accès compatible OpenAI (`ARTICLES_BASE_URL`,
`ARTICLES_MODEL`) : passer à Claude, OpenRouter ou OmniRoute est un changement
de deux variables, sans code.

Conditions Gemini vérifiées (ai.google.dev/gemini-api/terms, 16 oct. 2026) :
pour un utilisateur en Suisse / EEE / Royaume-Uni, les règles de données de
l'offre payante s'appliquent aussi au quota gratuit (pas d'entraînement sur
nos échanges). La restriction « offre payante uniquement » vise les API
Clients mis à disposition d'utilisateurs de l'EEE — ici, un job interne, les
visiteurs n'interagissent jamais avec le modèle. Seuls les modèles Flash
restent gratuits (Pro retiré en avril 2026). **La qualité de l'arménien n'a
pas été vérifiée** : faire relire le premier article `hy` une fois par un
lecteur arménophone.

## 1. Le circuit

### 1.1 Rédaction — `.github/workflows/articles.yml`

Planifié le lundi à 06:00 UTC, plus `workflow_dispatch`.

1. **Choix du sujet** (`scripts/lib/culture-topic.mjs`, pur) :
   - un sujet est **disponible** s'il est `pending` sur `main` **et** n'a pas
     de PR ouverte (branche `culture/<slug>`) — sans cette exclusion, un sujet
     en relecture serait re-rédigé le lundi suivant ;
   - si un événement de `agenda.json` à venir dans les 21 jours correspond aux
     mots-clés d'un sujet disponible → ce sujet ;
   - sinon le premier sujet disponible de la liste ;
   - si aucun sujet disponible → ouvrir une issue « Culture : idées de sujets »
     avec 10 propositions générées, et s'arrêter sans PR.
2. **Collecte** (`scripts/lib/culture-sources.mjs`) :
   - article Wikipédia fr **et** en (API REST Wikimedia, extraits texte, id de
     révision) ;
   - faits Wikidata de l'entité (dates, lieux) ;
   - 2-3 images candidates Wikimedia Commons, filtrées par licence.
   - User-Agent : `ArmenieInfo/1.0 (+https://armenieinfo.ch/a-propos/)` —
     règle Wikimedia, et leçon de l'incident Cloudflare de septembre 2026.
3. **Rédaction** du brouillon français par le modèle (consignes §2.2).
4. **Contrôles** : liste des faits à vérifier (§2.3), mesure de paraphrase
   (§2.3), validation (§3.5).
5. **PR** : branche `culture/<slug>`, commit du dossier de l'article, PR
   « Culture : <titre> » dont la description contient :
   - en tête, les faits ⚠️ introuvables dans les sources ;
   - le taux de recouvrement avec Wikipédia (et l'alerte s'il dépasse le seuil) ;
   - les sources avec leurs liens ;
   - les images candidates (aperçu, auteur, licence) et la ligne à modifier
     pour en changer ;
   - le modèle **réellement** utilisé ;
   - une case « faits vérifiés » et le mode d'emploi (« posez l'étiquette
     `traduire` quand le français est prêt »).

### 1.2 Relecture et traduction — `.github/workflows/articles-translate.yml`

Déclenché par `pull_request: types: [labeled]`, filtré sur l'étiquette
`traduire` et les branches `culture/*`.

1. Lit le `fr.md` **actuel** de la branche.
2. Le traduit en en / hy / ru. Chaque traduction porte en front-matter
   `sourceHash` (SHA-256 du corps de `fr.md`) et `model`.
3. Commit des langues réussies sur la branche, retrait de l'étiquette,
   commentaire sur la PR (modèle par langue, langues échouées).

### 1.3 Traduction périmée

Si `fr.md` change après la traduction, son empreinte ne correspond plus au
`sourceHash` des traductions : la validation échoue avec « traduction
périmée — reposez l'étiquette `traduire` ». Sans ce contrôle, en / hy / ru
partiraient avec l'ancienne version, sans signal.

### 1.4 Publication

Fusion de la PR → push sur `main` → le build et le déploiement existants de
`hourly.yml`. Le job de traduction passe le sujet `published` dans
`sujets.json` **sur la branche** : il arrive sur `main` avec la fusion, dans le
même commit que l'article.

PR fermée sans fusion → un job léger (`pull_request: closed`, non fusionnée)
passe le sujet `rejected` sur `main`, pour qu'il ne revienne pas.

## 2. Le contenu

### 2.1 Fichiers

```
src/data/culture/
  sujets.json
  <slug>/
    fr.md  en.md  hy.md  ru.md
    meta.json
    image.webp      # page
    image.jpg       # carte de partage, 1200×630, sRGB, sans ICC
```

`sujets.json` :

```json
{ "topics": [
  { "slug": "komitas", "title": "Komitas",
    "wikipedia": { "fr": "Komitas", "en": "Komitas" },
    "keywords": ["komitas"], "status": "pending" }
] }
```

`status` ∈ `pending | published | rejected` (l'état « en relecture » se lit dans les PR ouvertes, pas dans le fichier).

Front-matter de `fr.md` : `title`, `description` (≤ 160 caractères), `date`
(AAAA-MM-JJ). Les traductions ajoutent `sourceHash` et `model`.

`meta.json` : `slug`, `sources` (`[{ lang, title, url, revision }]`),
`image` (`{ file, author, license, licenseUrl, commonsUrl }` ou `null`),
`agendaEvent` (URL ou `null`), `overlap` (taux mesuré).

**Markdown restreint** (`scripts/lib/culture-markdown.mjs`) : paragraphes,
`##` / `###`, `**gras**`, `*italique*`, `[liens](https://…)`. Tout le reste est
du texte : le HTML est échappé. Pas de dépendance, et aucun texte collé dans
une PR ne peut injecter de balise.

### 2.2 Consignes de rédaction

- N'utiliser **que** les extraits fournis ; aucun fait absent des sources.
- Plan et angle propres, sans suivre l'ordre de l'article Wikipédia ;
  700 à 1 000 mots.
- Ton enthousiaste et fier, sans superlatif que les sources ne portent pas.
  Génocide, Artsakh, conflits : les faits, rien que les faits.
- Finir par un lien vers le site : l'événement d'agenda lié, à défaut une
  radio si pertinent.

Consignes de traduction : fidélité au français relu, aucun ajout ; arménien
**oriental** ; noms propres selon l'usage établi de la langue cible.

### 2.3 Garde-fous de relecture

1. **Faits à vérifier** : un second appel extrait dates, chiffres et noms
   propres du brouillon ; chacun est cherché dans les sources ; les absents
   sont listés ⚠️ en tête de PR.
2. **Anti-paraphrase** (`scripts/lib/culture-overlap.mjs`, pur) : part des
   8-grammes de mots (normalisés) du brouillon présents dans les extraits
   Wikipédia. Au-delà de **15 %**, alerte dans la PR. Seuil à réajuster après
   les premiers articles.
3. **Attribution** sur la page : « Sources : Wikipédia (CC BY-SA 4.0) » avec
   les liens, et le crédit de l'image.

## 3. Le site

### 3.1 URL

Dérivées de `sites.config.js`, comme la brève — **pas une vue** au sens de
`VIEWS` :

- `CULTURE_SLUGS = { fr: 'culture/', en: 'culture/', hy: 'culture/', ru: 'culture/' }`
- `cultureUrl(lang, slug = null)`, `culturePath(lang, slug = null)`

| | Index | Article |
|---|---|---|
| .ch (fr) | `armenieinfo.ch/culture/` | `/culture/<slug>/` |
| .org en | `armenianews.org/culture/` | `/culture/<slug>/` |
| .org hy / ru | `/hy/culture/`, `/ru/culture/` | `/hy/culture/<slug>/`… |

Slug d'article identique dans les quatre langues ; slash final obligatoire
(Firebase redirige un répertoire vers sa forme à slash final).

### 3.2 Pages

`scripts/lib/culture-pages.mjs`, sur le modèle de `brief-pages.mjs` : HTML
statiques écrits au build, hors bundle React et hors prérendu ; même feuille
CSS hachée (`cssHrefFrom`), `theme-init.js`, balises Cloudflare et GA de la
vitrine ; en-tête par `site-meta.mjs` (`cultureHeadFor`).

- **Index** : articles de la langue, du plus récent au plus ancien (image,
  titre, description, date).
- **Article** : image + crédit, titre, date, corps, bloc sources, lien vers
  l'événement d'agenda (s'il est encore à venir), puis « À lire aussi » :
  3 autres articles.
- Sans image : motif CSS de repli.

### 3.3 Référencement

- JSON-LD `Article` (`headline`, `datePublished`, `image`, `author` et
  `publisher` = l'éditeur de la page « À propos », `inLanguage`).
- `og:image` = `image.jpg` de l'article, avec les six balises (`secure_url`,
  `type`, `width`, `height`, `alt`).
- Canonical propre ; `hreflang` réciproques limités aux langues présentes pour
  cet article, `x-default` vers l'anglais s'il existe.
- Sitemaps : index et articles de la vitrine ; `lastmod` = `date` de l'article.

### 3.4 Liens entrants

- Entrée « Culture » dans la nav (y compris celle des pages autonomes : radio,
  agenda, brève), dans le pied de page et la page 404.
- Bloc « À lire » sur l'accueil : 3 derniers articles de la langue. Les
  données arrivent par un module virtuel Vite qui n'embarque que titres,
  descriptions, dates et images des langues de la vitrine (même principe que
  `lightData()`).

### 3.5 Validation à deux sévérités

`scripts/lib/culture-validate.mjs`, une seule fonction, deux usages :

- **PR (strict)** — `npm run culture:check` : traduction manquante ou périmée,
  front-matter invalide, licence d'image hors liste, image manquante déclarée,
  faits ⚠️ non résolus (case « faits vérifiés » non cochée) → échec.
  Lancé par `articles.yml` et `articles-translate.yml` **eux-mêmes**, qui
  publient le résultat comme statut de commit : un commit poussé avec le
  `GITHUB_TOKEN` ne déclenche aucun autre workflow, donc un contrôle
  `pull_request` classique ne verrait jamais les commits du robot. Les
  commits du relecteur déclenchent normalement `pull_request: synchronize`.
- **Build (tolérant)** — `build-sites.mjs` : un article invalide sur `main` est
  **ignoré avec un avertissement**, ses autres langues valides restent
  publiées ; le déploiement horaire ne casse jamais à cause du contenu.

`check-build.mjs` vérifie en outre, sur dist : lang, canonical, hreflang
réciproques, `og:image` présent dans `dist/`, absence du domaine voisin.
La sonde de production de `hourly.yml` ajoute `/culture/` sur les deux
vitrines (200).

## 4. Exploitation

### 4.1 Secrets et permissions

- Secret `GEMINI_API_KEY`. Variables `ARTICLES_BASE_URL` (défaut :
  `https://generativelanguage.googleapis.com/v1beta/openai/`) et
  `ARTICLES_MODEL` (défaut : le Flash gratuit courant).
- Workflows `articles*.yml` : `contents: write`, `pull-requests: write`,
  `issues: write`, `statuses: write` ; **aucun** secret Firebase.

### 4.2 Pannes

| Panne | Effet |
|---|---|
| Modèle : 429 / 404 / délai | Job en échec, pas de PR ; relance manuelle |
| Pas d'article Wikipédia fr | Rédaction depuis l'anglais seul, signalée dans la PR |
| Aucune image libre | PR sans image, avertissement ; motif sur la page |
| Liste de sujets vide | Issue avec 10 idées, pas de PR |
| Traduction échouée pour une langue | Commit des langues réussies ; statut rouge |
| Article invalide sur `main` | Ignoré au build avec avertissement |

### 4.3 Tests (`npm test`, sans réseau)

- choix du sujet, priorité agenda (fenêtre de 21 jours, mots-clés, statuts, exclusion des sujets en PR ouverte) ;
- rendu Markdown restreint et échappement du HTML ;
- recouvrement de 8-grammes ;
- filtre des licences Commons ;
- empreinte et détection de traduction périmée ;
- validation du front-matter et de `meta.json` (deux sévérités) ;
- `cultureUrl` / `culturePath`, réciprocité des `hreflang` des pages Culture ;
- présence de « Culture » dans les quatre dictionnaires.

### 4.4 Liste de départ

`sujets.json` initial, ~12 sujets, modifiable : Komitas, le kochari, le
duduk, l'alphabet de Mesrop Machtots, les khatchkars, Sardarapat, Aram
Khatchatourian, Charles Aznavour, le monastère de Tatev, le lavash, Sergueï
Paradjanov, Ani.

## Hors périmètre

- Emplacements publicitaires et demande AdSense (CSP sur les deux cibles,
  plateforme de consentement certifiée, mesure de la vitesse) — chantier
  séparé, après ~15-20 articles.
- Relecture des traductions en / hy / ru.
- Plus d'un article par semaine.
