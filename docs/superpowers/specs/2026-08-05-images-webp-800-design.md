# Ré-encoder les images bundlées en WebP 800 px

**Date** : 5 août 2026
**Statut** : conception validée, implémentation à venir

## Le problème, mesuré

Un lecteur qui déroule l'accueil jusqu'en bas tire **~32 Mo d'images**. La page
prérendue fait 255 ko et référence 108 images, à **243 ko de moyenne** — pour des
tuiles affichées à ~300 px de large.

La cause est dans le stock, pas dans le rendu. Sur les 1 364 images de
`src/data/ig/` dont les dimensions se lisent :

| Largeur stockée | Nombre | Poids | Moyenne |
|---|---|---|---|
| ≤ 640 px | 219 | 16 Mo | 76 ko |
| 641–800 | 115 | 14 Mo | 122 ko |
| 801–1080 | 392 | 73 Mo | 191 ko |
| **> 1080** | **638** | **199 Mo** | **320 ko** |

La médiane est à **1080 px**. `pickImage` demande pourtant « le plus petit format
d'au moins 640 px » : dans 47 % des cas l'API Instagram n'offre aucun palier
intermédiaire et la règle retombe sur le plein format. Le comportement est
documenté dans `CLAUDE.md` ; son ampleur ne l'était pas. **63 % du poids tient
dans ces 638 images.**

Conséquences : `src/data/ig/` pèse **319 Mo** au total (315 Mo pour les 1 364
images mesurées ci-dessus, le reste pour 74 fichiers dont l'en-tête JPEG ne se
lit pas au parseur maison — ils seront convertis comme les autres), chaque
`dist/` 325 Mo, et ~650 Mo partent à chaque déploiement horaire, pour 90 tuiles
affichées.

## Ce qu'on décide

**Ré-encoder à la récolte**, en WebP 800 px qualité 78, et convertir le stock
existant une fois.

Deux autres voies ont été écartées :

- **Convertir au build** (plugin Vite) donnerait le même gain au lecteur, mais
  le dépôt resterait à 315 Mo et le build **horaire** paierait le
  redimensionnement de 1 438 images à chaque tour, pour un résultat identique à
  chaque fois.
- **Déléguer à un proxy** (`wsrv.nl`, déjà utilisé pour les vignettes
  Armenpress) suppose des images hotlinkées. Celles-ci sont hébergées par nous :
  le proxy devrait les retélécharger depuis armenieinfo.ch, `dist/` resterait à
  325 Mo, et un tiers entrerait dans le chemin critique du rendu.

Seule la conversion à la récolte fait l'économie **une fois** et la fait profiter
partout à la fois : dépôt, `dist/`, déploiement, lecteur.

### Pourquoi 800 px et pas 640

À 600 px — la taille réelle d'une tuile sur écran rétine — le 640 px q75 est
visuellement indiscernable de l'original, y compris sur le cas le plus exigeant
du pool (photo de bijou, gravure manuscrite fine, fond velours en dégradé).

Mais la visionneuse fait `min(1040px, 94vw)` : sur un téléphone de 390 px elle
affiche 367 px, soit **734 px en rétine**. À 640 l'image serait agrandie de 15 %
précisément là où le lecteur la regarde de près. 800 couvre ce cas exactement,
pour 28 Mo de plus.

Mesuré sur un échantillon de 24 images réparties sur toute la distribution des
largeurs :

| Cible | Moyenne servie | Réduction | Dépôt extrapolé |
|---|---|---|---|
| 640 px q75 | 42 ko | −83 % | 54 Mo |
| **800 px q78** | **63 ko** | **−74 %** | **82 Mo** |
| 1040 px q80 | 96 ko | −60 % | 125 Mo |
| *aujourd'hui* | *243 ko* | — | *315 Mo* |

### Résultat attendu

| | Aujourd'hui | Après |
|---|---|---|
| Image moyenne servie | 243 ko | ~63 ko |
| Visite complète de l'accueil | ~32 Mo | ~8 Mo |
| `src/data/ig/` | 315 Mo | ~82 Mo |
| `dist/` par vitrine | 325 Mo | ~92 Mo |

## L'architecture

### `scripts/lib/image.mjs` — nouveau

La règle d'encodage, isolée : `encode(buffer, { width, quality }) → buffer`.
WebP, `width` de large **au maximum**, et **jamais d'agrandissement** — une image
déjà à 500 px reste à 500 px, seulement ré-encodée.

Elle vit dans `lib/` pour la même raison qu'`ig-harvest.mjs` : c'est une décision
pure, testable sans réseau ni Chrome, là où les scripts qui l'appellent ne le
sont pas.

Défauts : `width: 800`, `quality: 78`.

### Les deux scrapes

`ig-scrape.mjs` et `fb-scrape.mjs` appellent `encode()` dans leur `download()`
avant d'écrire, et écrivent `.webp`.

**Le plancher de 10 ko reste AVANT l'encodage**, sur le JPEG reçu. C'est le garde
qui distingue une vraie image d'une page d'erreur — il a attrapé `DWr7TYjjHd9`
(9,6 ko) le 5 août. Déplacé après l'encodage, une image légitime de 42 ko
ramenée à 8 ko serait rejetée comme corrompue : un faux négatif silencieux, la
tuile retombant sur son motif sans que rien ne l'explique.

`MIN_IMAGE_WIDTH` ne bouge pas. `pickImage` continue de demander le plus petit
format d'au moins 640 px : inutile de télécharger 1 440 px pour en garder 800.
Ce qui change n'est pas ce qu'on **choisit**, c'est ce qu'on **écrit**.

Le nettoyage d'orphelins d'`ig-scrape` balaie désormais `.jpg` **et** `.webp` :
verrouillé sur une seule extension, il laisserait l'autre s'accumuler sans
qu'aucun compte ne diverge.

### `src/components/Social.jsx`

Le glob Facebook accepte déjà `{jpg,jpeg,png,webp}` et se clave sur le nom de
fichier complet — donc `facebook.json.image` doit passer en `.webp`.

Le glob Instagram est verrouillé sur `*.jpg` et se clave sur le shortcode : il
devient `*.{jpg,webp}` et retire l'une ou l'autre extension. `instagram.json`
n'a rien à changer, il ne stocke que des URL.

**Les deux globs acceptent les deux extensions définitivement**, pas seulement
pendant la transition : un `.jpg` qui survivrait à une migration incomplète
continue de s'afficher. Verrouiller sur `.webp` transformerait tout fichier
oublié en tuile muette retombée sur son motif, sans message.

### `scripts/reencode-images.mjs` — nouveau, et il reste

Convertit `src/data/{ig,fb}/` sur place, réécrit les champs `image` de
`facebook.json`, supprime les `.jpg`. **Aucun accès réseau** : les 1 438 images
sont déjà sur le disque, et re-récolter 1 448 posts prendrait des heures pour
risquer un blocage Instagram sur des fichiers qu'on possède.

Ce n'est pas un jetable. Le jour où la cible change — 640 px si le poids
redevient un souci, 1040 si l'audience passe au desktop — c'est lui qu'on
relance. Il prend largeur et qualité en arguments.

**Il traite donc les `.webp` autant que les `.jpg`.** L'écrire pour les seuls
`.jpg` le rendrait idempotent — agréable — mais **inutilisable une deuxième
fois** : après la migration il n'y a plus un seul `.jpg`, et le relancer à 640
ne ferait rien du tout, en silence. C'est exactement la contradiction que sa
raison d'être interdit.

Deux conséquences à assumer. Un second passage ré-encode du WebP vers du WebP,
donc **perd un peu de qualité** — c'est acceptable pour un changement de cible
délibéré, pas pour une routine. Et `encode()` n'agrandissant jamais, relancer à
1040 après une migration à 800 **ne rendra pas les pixels perdus** : il faudrait
re-récolter. Le script réduit, il ne restaure pas.

### `test/instagram-pool.test.mjs`

Son filtre `.jpg` suit le glob : `{jpg,webp}`, extension retirée dans les deux
cas. Sans quoi le test « aucune image d'un post exclu ne traîne » cesserait de
regarder quoi que ce soit — il passerait au vert sur un dossier vide de `.jpg`,
en ne prouvant plus rien.

### `package.json`

`sharp` en dépendance de développement. `ffmpeg` a servi à mesurer et suffirait
techniquement, mais rien ne garantit sa présence demain ni sur une autre
machine ; `sharp` s'installe avec `npm install`. Il n'entre jamais en CI : les
deux scrapes sont locaux et manuels, et le build n'en a pas besoin.

## La vérification

1. **Compte d'images avant/après**, et **zéro post du pool sans image**.
2. **162 tests**, lint à 0 erreur, `npm run build`, `npm run check`.
3. **Poids de `dist/`** : il doit tomber de 325 à ~92 Mo par vitrine. S'il ne
   tombe pas, la conversion n'a pas mordu là où on croit.
4. **Contrôle visuel sur les cas durs, pas sur une jolie photo.** Le bijou testé
   pendant la conception est le cas *facile* pour WebP : dégradé et texture. Le
   cas dur, ce sont les images **à texte plat** — le mur en contient (vignettes
   d'annonce, affiches d'événements, cartons titrés), et c'est là que WebP peut
   faire baver les contours. Trois de celles-là seront comparées à taille
   d'affichage réelle avant validation.

**Le filet** : si la qualité déçoit, `git revert` rend les `.jpg`, qui restent
dans l'historique git. La migration est réversible d'une commande.

## Ce qu'on ne fait pas, délibérément

- **Pas de `srcset`.** Une seule taille couvre les deux usages réels (tuile
  300 px, visionneuse mobile 367 px). Deux variantes doubleraient le stock et la
  complexité pour n'améliorer que le desktop, qui est la minorité de l'audience.
- **Pas d'AVIF.** Il compresse mieux, mais 5 à 10 fois plus lentement, pour un
  gain marginal sur WebP à 800 px.
- **Pas de retouche du JS ni du CSS.** Mesurés à 1 Mo et 100 ko : ce n'est pas là
  qu'est le poids, et y toucher ne serait motivé par aucune mesure.
- **Pas de CDN ni de changement d'hébergement.** Firebase sert ces fichiers
  correctement ; le problème est leur taille, pas leur livraison.
- **Pas de nouvelles pages.** Décidé au cadrage : le site reste un agrégateur
  d'instantanés à 12 URL.

## Portée

Ce chantier ne touche **que** les images bundlées (`src/data/ig/`,
`src/data/fb/`). Les vignettes des sources de presse sont hotlinkées ou passent
par `wsrv.nl` — elles ne sont pas concernées.
