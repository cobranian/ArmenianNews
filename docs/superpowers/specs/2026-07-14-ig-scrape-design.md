# ig-scrape — récolte Instagram locale

Date : 2026-07-14

## Problème

Le mur Instagram donne une impression de fraîcheur qu'il n'a pas.

Le pool `src/data/instagram.json` est curé à la main. Le job horaire ne fait que
**re-mélanger** ses 78 permaliens dans `instagram-feed.json` : l'ordre change à
chaque heure, le contenu jamais. Le pool n'a pas été récolté depuis le
2026-07-01, et une partie des posts (`ig_armenia` notamment) date de **2023**.

La cause est le coût de la récolte : il n'existe aucun outil. Rafraîchir le pool
demande aujourd'hui de coller chaque URL à la main dans `instagram.json` et
d'enregistrer chaque image dans `src/data/ig/`. C'est pour cela que ça n'a pas
été fait.

Le pool ne stocke par ailleurs **aucune date**, donc rien ne signale qu'il a
vieilli — le même angle mort qui a laissé les rubriques armradio figées quatre
jours derrière un job tout vert.

## Objectif

Une commande, `npm run ig-scrape`, qui reconstruit le pool avec les posts
récents des comptes suivis et télécharge leurs images.

La récolte reste une **étape manuelle locale** : Instagram bloque le scraping
depuis la CI, exactement comme Facebook. Le script se lance à la main, puis on
commite et on pousse — le workflow horaire déploie.

Hors périmètre : automatiser la récolte en CI, et changer la façon dont le mur
choisit ou ordonne les posts (le tirage aléatoire horaire reste tel quel).

## Décisions

| Décision | Choix |
| --- | --- |
| Pool existant | **Remplacé** par les posts récents à chaque récolte |
| Volume | **9 posts par compte** (~81 pour 9 comptes) |
| Dates | **Enregistrées** par post |
| Récolte | Endpoint JSON interne d'Instagram, session connectée |

Le remplacement règle la fraîcheur à la racine : les vieux posts disparaissent
d'eux-mêmes, sans seuil d'élagage ni date d'expiration à maintenir. C'est déjà
le comportement de `fb-scrape.mjs`.

9 posts par compte donne un pool d'environ 2,7× les 30 affichés : le mélange
horaire change réellement d'une heure à l'autre, sans redescendre si loin dans
l'historique des comptes peu actifs qu'on réintroduirait des posts anciens.

## Approche : l'endpoint JSON, pas le DOM

Instagram alimente son propre front avec `web_profile_info`, qui renvoie pour un
compte, en **une requête**, ses derniers posts avec `shortcode`,
`taken_at_timestamp` et l'URL de l'image. On l'appelle depuis le contexte de la
page connectée : les cookies de session partent avec la requête.

L'alternative — calquer `fb-scrape.mjs` et scraper le DOM — demanderait d'ouvrir
les 9 profils **puis chacun des 81 posts** pour lire sa date, soit ~90
navigations. Instagram limite agressivement le débit et coupe avec « Please wait
a few minutes » bien avant la fin. 9 requêtes au lieu de 90 rendent ce risque
négligeable, et donnent des dates exactes plutôt que devinées.

Le prix à payer : c'est un endpoint interne, il peut changer sans préavis. C'est
acceptable parce que le script est **manuel** — un échec est vu immédiatement,
là où un job horaire verdirait tout seul sur des données figées.

## Fonctionnement

`scripts/ig-scrape.mjs`, exposé via `npm run ig-scrape`.

```bash
node scripts/ig-scrape.mjs --connect --dry   # rapporte ce qu'il trouve, n'écrit rien
node scripts/ig-scrape.mjs --connect         # télécharge les images + réécrit instagram.json
```

`--connect` s'attache au Chrome déjà lancé avec `--remote-debugging-port=9222`,
réutilisant la session connectée — même mécanique que `fb-scrape.mjs`, même
fenêtre de débogage, où il faut être connecté à Instagram.

Pour chaque compte :

1. appeler `web_profile_info` depuis la page connectée ;
2. trier les posts par `taken_at_timestamp` décroissant et garder les **9 plus
   récents** — le tri neutralise les posts épinglés, qu'Instagram remonte en
   tête de liste indépendamment de leur date ;
3. télécharger l'image de chaque post dans `src/data/ig/<shortcode>.jpg` ;
4. marquer une pause d'environ 2 s avant le compte suivant.

La **liste des comptes reste curée à la main** dans `instagram.json` : le script
ne l'invente pas et ne la modifie pas, il ne régénère que leurs posts.

Après la récolte, les images de `src/data/ig/` qui ne sont plus référencées sont
supprimées (deux traînent déjà aujourd'hui : `C9cmIrhMZnm`, `DJMuFB2tU91`).

## Données

Le pool passe de permaliens nus à des posts datés :

```jsonc
// avant
{ "handle": "ig_armenia", "name": "Armenia", "url": "…",
  "permalinks": ["https://www.instagram.com/p/Ctrt1AbKBmv/"] }

// après
{ "handle": "ig_armenia", "name": "Armenia", "url": "…",
  "posts": [{ "url": "https://www.instagram.com/p/Ctrt1AbKBmv/",
              "date": "2026-07-12T09:14:00.000Z" }] }
```

Deux consommateurs lisent `permalinks` et doivent suivre :

- `scripts/sources/instagram.mjs:22` — aplatit le pool avant le tirage aléatoire ;
- `src/components/Social.jsx:186` — repli utilisé avant l'existence du premier
  snapshot.

La date est transportée jusqu'à `instagram-feed.json`. Le composant l'ignore
pour l'instant : **le tirage aléatoire horaire ne change pas**. Elle existe pour
qu'on puisse contrôler la fraîcheur du pool d'un coup d'œil, sans ouvrir
Instagram — précisément ce qui manquait.

## Échecs

C'est le cœur du design, et la leçon d'armradio : un échec silencieux qui laisse
les données figées est pire qu'un échec bruyant.

- **Un compte échoue** (endpoint changé, rate-limit) → il **conserve ses posts
  précédents** et affiche un `✗` explicite. Le pool ne se vide jamais à moitié
  en silence. C'est la dégradation par source que `scrape.mjs` applique déjà.
- **Session non connectée** → arrêt net avec un message clair, avant toute
  écriture. Sans ce garde-fou, on récolterait neuf comptes vides.
- **Aucun compte ne réussit** → rien n'est écrit, sortie en erreur. Un pool
  intact vaut mieux qu'un pool corrompu.
- **Une image échoue au téléchargement** → non bloquant : le post reste dans le
  pool et la tuile retombe sur le motif arménien déterministe, comportement déjà
  en place.

## Vérification

Il n'y a pas de suite de tests dans ce projet. La vérification est
l'exécution réelle :

1. `--dry` : les 9 comptes rapportent 9 posts chacun, avec des dates récentes et
   plausibles, et rien n'est écrit.
2. Récolte réelle : `instagram.json` contient ~81 posts datés, `src/data/ig/`
   contient une image par post et aucune orpheline.
3. `npm run scrape` puis `npm run build` : le mur se peuple, aucune tuile ne
   retombe sur le motif faute d'image.
4. Coupure de session simulée (déconnexion) : le script s'arrête sans rien
   écrire.
