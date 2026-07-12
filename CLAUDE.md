# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) lorsqu'il
travaille sur ce dépôt.

## Projet

**Arménie Info** (`armenie-info.web.app`) — un **instantané horaire** de la vie
arménienne : actualités, agenda et réseaux sociaux, dans une esthétique de
journal « Apricot Press » (basalte volcanique éclairé d'abricot), avec une
bascule **jour / nuit**. Interface trilingue : **Français / English / Հայերեն**.

Une tâche planifiée récupère les sources une fois par heure dans des fichiers
JSON ; le site est une application statique **Vite + React** qui affiche ces
fichiers. **Aucun backend à l'exécution.**

Ce dossier est un projet parmi d'autres dans le dépôt parent
`C:\Users\nareg\Documents\Claude code` (la racine git est le parent, pas ce
dossier). Les projets voisins (ArmeniensDeLausanne, pltr-dashboard, etc.) sont
indépendants — ne mélangez pas leur outillage ici.

## Commandes

```bash
npm install         # installer les dépendances
npm run dev         # serveur de développement sur http://localhost:5173
npm run build       # build de production dans dist/
npm run preview     # prévisualiser le build de production
npm run lint        # ESLint
npm run scrape      # rafraîchir src/data/{news,agenda,meta,instagram-feed}.json depuis les sources
npm run screenshot  # après un build : capturer le carrousel Don Narek dans dist/don-narek-{desktop,mobile}.png
```

Il n'y a **pas de suite de tests**.

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
  - `courrier.mjs` — Le Courrier d'Erevan (actualités, par rubrique).
  - `armradio.mjs` — Public Radio of Armenia. Passe par une **chaîne de sources
    multi-niveaux** (proxy Cloudflare Worker → API REST → flux RSS → Google News)
    car armradio.am est derrière Cloudflare, qui renvoie par intermittence un 403
    aux IP des datacenters de la CI.
  - `armenopole.mjs` — Agenda (Suisse + monde).
  - `instagram.mjs` — sélection depuis le pool Instagram curé.
- **`scripts/fb-scrape.mjs`** — rafraîchit Don Narek (Facebook). **Étape manuelle
  locale**, pas horaire : Facebook exige une session connectée et bloque la CI.
- **`scripts/shoot.mjs`** — capture d'écran du carrousel Don Narek (Puppeteer).

**Internationalisation** — `src/i18n.jsx` expose un contexte React
(`useI18n()` → `{ t, lang, setLang }`) avec les dictionnaires **fr / en / hy**.
Seul le **chrome de l'interface** est traduit ; le **contenu** (articles, posts)
reste dans sa langue d'origine. Le français est la langue par défaut et doit
porter tous ses accents (é, è, à, ê, ç…).

**Styles** — `src/styles/global.css`, un seul fichier. La bascule jour / nuit et
la palette « abricot sur basalte » y sont définies.

## Données : ce qui est scrapé vs. curé à la main

- **Généré par le scrape (ne pas éditer à la main)** — `news.json`,
  `agenda.json`, `instagram-feed.json`, `meta.json`. Ils sont réécrits à chaque
  snapshot horaire.
- **Curé à la main (jamais écrasé)** — `src/data/instagram.json` (le **pool** de
  permaliens Instagram ; le job horaire y pioche une sélection aléatoire dans
  `instagram-feed.json`) et `src/data/facebook.json` (les posts Don Narek).
  Voir le **README.md** pour la procédure d'ajout de posts et de rafraîchissement
  de Don Narek.
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
  (Cloudflare / anti-scraping) — d'où la chaîne de sources pour le newswire et
  le pool curé à la main pour Instagram.
- Le README.md du projet est la **référence détaillée** (chaîne de sources
  armradio, curation des feeds, déploiement, proxy Cloudflare Worker).
