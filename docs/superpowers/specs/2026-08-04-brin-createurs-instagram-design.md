# Un cinquième brin Instagram : « Créateurs arméniens »

**Date** : 2026-08-04
**Portée** : `src/data/instagram.json`, `src/data/instagram-feed.json`,
`src/components/Social.jsx`, `src/i18n.jsx`, `test/instagram-strands.test.mjs`,
`scripts/ig-scrape.mjs`, `scripts/ig-select.mjs` (neuf), `package.json`,
`scripts/sources/instagram.mjs` (commentaire), `CLAUDE.md`.

**Suite directe de** `2026-08-04-quatre-brins-instagram-design.md`, écrit le même
jour : ce chantier-là a taillé quatre brins dans les 25 comptes existants, celui-ci
en tire un cinquième et recrute le premier compte depuis.

## La demande, et ce que le pool en disait déjà

Quatre liens Instagram, pour un brin « Créateurs arméniens ». Confrontés au
pool, trois des quatre étaient **déjà sur le site** :

| Lien demandé | État au 4 août 2026 |
|---|---|
| `armeniancreators` | déjà dans le pool, brin `creation` |
| `armenian_women_artists` | déjà dans le pool, brin `creation` |
| `simonian_jewels` | **absent** — le seul compte réellement neuf |
| `/reels/Dbf5hB8s7qq/` | déjà sur le mur : c'est un post de `@maisonlumiere_geneva`, brin `institutions`, image déjà empaquetée dans `src/data/ig/` |

Le quatrième lien n'est pas un compte mais **un post**, et l'architecture n'a
pas de place pour un post isolé : un brin est un `group` posé sur un **compte**,
et tous ses posts suivent. Le mécanisme d'épinglage qu'il faudrait a été
examiné puis écarté — voir « Ce qui n'est pas fait ».

La demande se réduit donc à une question de taxonomie : le brin `creation`,
titré « Ateliers arméniens », contient déjà l'essentiel de ce que « Créateurs »
désignerait. Fallait-il le renommer, ou le scinder ?

## La solution : scinder, sur une ligne lisible

**Cinq brins.** `creation` est scindé en deux, et `maisonlumiere_geneva` quitte
`institutions`.

| Brin (clé `group`) | Comptes | Réserve | Servi | Renouvellement |
|---|---|---|---|---|
| `institutions` | 9 (−1) | 81 | 18 | 22 % |
| `personnalites` | 6 | 54 | 18 | 33 % |
| `creation` | 3 (−2) | 27 | 18 | 67 % |
| `createurs` *(neuf)* | 4 | 36 | 18 | 50 % |
| `terre` | 4 | 36 | 18 | 50 % |

- `createurs` ← `simonian_jewels` (recruté), `armeniancreators`,
  `armenian_women_artists` (venus de `creation`), `maisonlumiere_geneva`
  (venu de `institutions`)
- `creation` garde `abgarart`, `haykmiqayelyanart`, `margarit.armeniandance`

**La ligne de partage doit se lire sans légende**, sinon elle ne tiendra pas à
la prochaine curation — c'est le seul critère qui compte pour deux brins
voisins :

> **Ateliers** = une main qui signe une œuvre. Trois artistes, chacun sous son
> nom.
> **Créateurs** = une maison qui porte un catalogue. Une joaillerie, deux
> collectifs qui rassemblent d'autres créateurs, un lieu genevois.

C'est la distinction entre celui qui fait et ce qui rassemble ; elle survit à
l'ajout d'un compte parce qu'on peut la trancher en regardant une seule grille.

**Le prix, assumé** : `creation` tombe à 3 comptes et puise 18 tuiles dans 27,
donc deux tiers de sa réserve à chaque tirage — c'est le brin qui tournera le
moins bien. Il reste au-dessus du seuil où un carrousel se répète (18 tuiles
distinctes), et le remède est une curation, pas un réglage.

**L'ordre : `createurs` se pose après `creation`, avant `terre`.** L'arc que le
commentaire d'`igStrands` décrit déjà reste narratif — la communauté, ses
visages, l'œuvre, les maisons qui la portent, la terre.

## Le titre : le moule des quatre autres

| Clé i18n | fr | en | hy | ru |
|---|---|---|---|---|
| `ig.strand.creators` | Créateurs arméniens | Armenian creators | Հայ ստեղծագործողներ | Армянские создатели |

*creators* est un choix explicite. Il **redit le nom d'un des comptes du brin**
(`@armeniancreators`), qui apparaît en pastille juste sous le carrousel : un
lecteur anglophone verra « Armenian creators » deux fois, une fois comme titre
d'étagère et une fois comme compte. *makers* évitait la collision ; il a été
écarté parce que « créateurs » est le mot demandé et que sa traduction directe
vaut plus que l'évitement d'un écho. Le titre reste le seul des cinq à ne pas
suivre le moule « Armenian + nom commun neutre » — c'est le prix, il est connu.

Les quatre langues disent alors le même mot : `ստեղծագործողներ` et `создатели`
traduisent *creators*, pas *makers* — c'était déjà le cas avant l'arbitrage
anglais, qui les rejoint plutôt qu'il ne les déplace.

`Հայ` et non `Հայկական`, seule entorse au moule des quatre titres existants :
`ստեղծագործողներ` désigne des **personnes**, et l'arménien met alors `Հայ`.
`Հայկական դեմքեր` garde `Հայկական` parce que des *visages* ne sont pas des
personnes grammaticalement.

## Deux pièges silencieux, désamorcés au passage

**Le feed doit être re-tiré, et rien ne le rappelle.** `instagram-feed.json` ne
porte aujourd'hui que les quatre `group` existants. Sans re-tirage, le brin
`createurs` n'a aucun post, `Social.jsx` fait `if (!posts.length) return null`,
et le brin **n'existe nulle part** : pas d'erreur, pas de test qui tombe, pas de
build qui échoue — jusqu'au prochain instantané horaire, qu'un push sur `main`
ne déclenche pas (il bâtit et déploie sans scraper). Or `selectInstagram` n'est
atteignable que par `npm run scrape`, qui re-gratte tout le réseau pour changer
une sélection locale.

D'où **`scripts/ig-select.mjs` (`npm run ig-select`)** : il appelle
`selectInstagram(18)` et réécrit le seul `instagram-feed.json`, en **conservant
son `generatedAt`**. Un re-tirage n'est pas un instantané : aucune source n'a
été relue, et prétendre le contraire ferait annoncer une fraîcheur qui n'a pas
eu lieu.

**Récolter un compte ne doit pas churner les 25 autres.** `ig-scrape.mjs` boucle
sur tout le pool : ajouter `simonian_jewels` coûterait aujourd'hui 26 requêtes
Instagram, une réécriture complète de `instagram.json` et un re-téléchargement
de 218 images — un diff illisible pour trois lignes voulues, et un risque de
limitation de débit pour rien.

D'où **`--only <handle>`**, qui restreint la boucle de récolte. Trois points
vérifiés plutôt que supposés :

- Le nettoyage des orphelins reste sûr. Il construit `live` depuis `accounts`
  **en entier**, et un compte non récolté conserve ses `posts` par la branche
  `previousPosts` déjà en place — aucune image des 25 autres ne devient
  orpheline.
- La garde `if (!okCount)` garde son sens : avec `--only`, elle protège du cas
  où le seul compte visé échoue.
- Un handle inconnu ne doit pas être un succès silencieux — sans correspondance
  dans le pool, le script sort en erreur au lieu de récolter zéro compte et
  d'annoncer « rien écrit ».

## Le garde-fou

`test/instagram-strands.test.mjs` existe déjà et couvre exactement ce chantier :
il extrait les brins de `Social.jsx` lu **comme du texte**, vérifie qu'aucun
compte du pool ne porte un `group` qu'aucun brin ne rend, qu'aucun brin n'est
vide, et que chaque titre est déclaré dans les **quatre** blocs `STRINGS`.

Deux assertions passent de quatre à cinq (le compte de brins et la liste
attendue des groupes). Le reste est déjà générique et se met à garder le
nouveau brin sans modification.

Ce que le test ne peut pas voir, et qui reste une étape manuelle : que
`instagram-feed.json` ait bien été re-tiré. Il lit le **pool**, pas la
sélection.

## Ce qui n'est pas fait

- **Aucun mécanisme d'épinglage de post.** Le Reel demandé suivra Maison Lumière
  dans le nouveau brin, mais le tirage prend 18 posts au hasard sur les 36 du
  groupe : il sera à l'écran environ une heure sur deux. L'y garantir demanderait
  une liste de posts curés hors comptes, et **deux protections que rien ne
  rappellerait** : `ig-scrape` réécrit `posts` intégralement, et son nettoyage
  final supprime toute image qu'aucun post ne pointe. Un post épinglé et son
  image disparaîtraient donc à la première récolte suivante, en silence. Le mur
  est un tirage aléatoire par construction ; on ne lui greffe pas une exception
  qui se sabote elle-même.
- **Le rythme visuel de la section n'est pas retravaillé.** Six étagères
  empilées (une Facebook, cinq Instagram) se lisent comme une répétition ; les
  différencier toucherait `Carousel` et `global.css`, bien au-delà de la demande.
  Le plafond reste à 18 tuiles par brin.
- **Les groupes ne deviennent pas des données.** `igStrands` reste écrit dans
  `Social.jsx` — un ordre d'affichage est une décision éditoriale, pas une donnée
  récoltée, et le test le lit à cet endroit.
- **La clé `institutions` n'est pas renommée**, alors qu'elle décrit encore moins
  bien son brin qu'hier. La raison est inchangée : c'est le repli
  `acc.group || 'institutions'`, écrit à la fois dans
  `scripts/sources/instagram.mjs` et dans `Social.jsx`.

## Vérification

- `npm test` — dont `instagram-strands` : cinq brins, chacun titré dans les
  quatre langues, aucun compte hors des cinq, aucun brin vide.
- `npm run lint` — 0 erreur, 5 avertissements connus, aucun nouveau.
- `node scripts/ig-scrape.mjs --only simonian_jewels --dry` avant l'écriture :
  le handle existe, la récolte renvoie des posts datés. Un handle absent
  d'Instagram répond 404 et se lit comme un échec de compte, pas comme une
  panne.
- `npm run ig-select` exécuté, puis **comptage par groupe** de
  `instagram-feed.json` : cinq groupes, 18 posts chacun, `generatedAt`
  inchangé. C'est le contrôle qui attrape le piège du brin vide.
- Rendu vérifié aux quatre langues et aux deux thèmes, à 360 px et en large : le
  titre le plus long du nouveau brin est arménien
  (`Հայ ստեղծագործողներ`), et c'est lui qui décide si la tête de brin tient.
- Les pastilles du nouveau brin listent bien ses quatre comptes, et
  `simonian_jewels` y figure même si aucun de ses posts n'est tiré — c'est le
  rôle de repli des pastilles.
