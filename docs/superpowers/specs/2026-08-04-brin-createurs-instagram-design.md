# Un cinquième brin Instagram : « Créateurs arméniens »

**Date** : 2026-08-04
**Portée** : `src/data/instagram.json`, `src/data/instagram-feed.json`,
`src/components/Social.jsx`, `src/i18n.jsx`, `scripts/sources/instagram.mjs`,
`scripts/ig-scrape.mjs`, `scripts/ig-select.mjs` (neuf), `package.json`,
`test/instagram-strands.test.mjs`, `test/instagram-pool.test.mjs` (neuf),
`test/instagram-draw.test.mjs` (neuf), `CLAUDE.md`.

**Suite directe de** `2026-08-04-quatre-brins-instagram-design.md`, écrit le même
jour : ce chantier-là a taillé quatre brins dans les 25 comptes existants, celui-ci
en tire un cinquième, recrute les deux premiers comptes depuis, et rend le tirage
capable d'accueillir un compte d'une tout autre taille que ses voisins.

## La demande, et ce que le pool en disait déjà

Des liens Instagram pour un brin « Créateurs arméniens ». Confrontés au pool,
la moitié étaient **déjà sur le site** :

| Lien demandé | État au 4 août 2026 |
|---|---|
| `armeniancreators` | déjà dans le pool, brin `creation` |
| `armenian_women_artists` | déjà dans le pool, brin `creation` |
| `simonian_jewels` | **absent** — recruté ici, catalogue entier |
| `naregjewelry` | **absent** — recruté ici, avec une liste d'exclusion |
| `/reels/Dbf5hB8s7qq/` | déjà sur le mur : un post de `@maisonlumiere_geneva` |

Le lien de Reel n'est pas un compte mais **un post**, et l'architecture n'a pas
de place pour un post isolé : un brin est un `group` posé sur un **compte**, et
tous ses posts suivent. Maison Lumière change bien de brin, mais pour rejoindre
« Ateliers arméniens » — le Reel s'affichera donc là, pas chez les créateurs.

## 1. La taxonomie : cinq brins

| Brin (clé `group`) | Comptes | Réserve | Servi |
|---|---|---|---|
| `institutions` | 9 (−1) | 81 | 18 |
| `personnalites` | 6 | 54 | 18 |
| `creation` | 4 (−2 +1) | 36 | 18 |
| `createurs` *(neuf)* | 4 | 27 + le catalogue Simonian | 18 |
| `terre` | 4 | 36 | 18 |

- `createurs` ← `simonian_jewels`, `naregjewelry` (recrutés), `armeniancreators`,
  `armenian_women_artists` (venus de `creation`)
- `creation` ← `maisonlumiere_geneva` (venu de `institutions`), et garde
  `abgarart`, `haykmiqayelyanart`, `margarit.armeniandance`

Vingt-sept comptes au total, contre vingt-cinq.

**La ligne de partage entre les deux brins voisins**, telle qu'elle se lit dans
les comptes réellement présents :

> **Créateurs** = ce qui se catalogue. Deux joailleries qui vendent ce qu'elles
> font, deux collectifs qui référencent d'autres créateurs.
> **Ateliers** = ce qui se pratique. Deux peintres, une danse, une maison
> genevoise qui accueille.

Cette ligne est **moins nette que la première version de cette spec**, qui
opposait « une main qui signe » à « une maison qui porte un catalogue » : Maison
Lumière est une maison, et elle est pourtant dans Ateliers. C'est une décision
de curation qui prime sur la règle, et elle est notée comme telle plutôt que
maquillée — la règle sert à trancher les cas indécis, pas à contredire un choix
explicite.

**L'ordre : `createurs` se pose après `creation`, avant `terre`.**

## 2. Le titre

| Clé i18n | fr | en | hy | ru |
|---|---|---|---|---|
| `ig.strand.creators` | Créateurs arméniens | Armenian creators | Հայ ստեղծագործողներ | Армянские создатели |

*creators* est un choix explicite. Il **redit le nom d'un des comptes du brin**
(`@armeniancreators`), qui apparaît en pastille juste sous le carrousel : un
lecteur anglophone verra « Armenian creators » deux fois. *makers* évitait la
collision ; il a été écarté parce que « créateurs » est le mot demandé et que sa
traduction directe vaut plus que l'évitement d'un écho.

`Հայ` et non `Հայկական`, seule entorse au moule des quatre titres existants :
`ստեղծագործողներ` désigne des **personnes**, et l'arménien met alors `Հայ`.
`Հայկական դեմքեր` garde `Հայկական` parce que des *visages* ne sont pas des
personnes grammaticalement.

## 3. Le tirage à la ronde — le cœur de ce chantier

`selectInstagram` mélange aujourd'hui **la réserve entière du brin** et en prend
les 18 premiers. Chaque compte y pèse à proportion de ses posts. C'est
invisible tant que tous en ont exactement neuf ; cela cesse de l'être à la
première réserve inégale :

| Compte | Réserve | Tuiles au mélange à plat | Tuiles à la ronde |
|---|---|---|---|
| `simonian_jewels` | ~200 | **~16 sur 18** | **5** |
| `naregjewelry` | 9 | ~0,7 | 5 |
| `armeniancreators` | 9 | ~0,7 | 4 |
| `armenian_women_artists` | 9 | ~0,7 | 4 |

Le mélange à plat ferait de « Créateurs arméniens » le catalogue Simonian avec
trois figurants. **C'est exactement le déséquilibre que le tirage par groupe
corrige un cran plus haut** — il existe pour que le groupe le plus fourni ne
chasse pas les autres de leur propre carrousel. Le même principe descend d'un
niveau : un compte ne chasse pas les autres de leur propre brin.

Le mécanisme : chaque compte du brin a sa propre pile mélangée ; on pioche un
post chez chacun **à tour de rôle** jusqu'à 18, en sautant les comptes épuisés.

**L'ordre des comptes est lui aussi remélangé à chaque tirage.** Sans cela, le
même compte prendrait toujours la tuile en trop *et* ouvrirait toujours le
carrousel — un rang figé sur une étagère qui se veut renouvelée.

**La déduplication par shortcode reste**, et elle garde son rôle d'origine : un
post COLLAB vit sur deux grilles sous le même code (`nemrabandofficial` /
`van.nemra`), et le carrousel l'afficherait à côté de lui-même.

**Aucun effet sur les quatre autres brins aujourd'hui** — tous leurs comptes ont
neuf posts, donc la ronde et le mélange à plat donnent la même chose à la
répartition près. Le changement les protège pour la suite, il ne les déplace
pas.

## 4. Deux réglages de récolte, par compte

`ig-scrape.mjs` récolte aujourd'hui **9 posts pour tout le monde**, les plus
récents, sans exception possible. Les deux comptes recrutés demandent l'inverse
de cela, chacun dans un sens.

### `count: 'all'` — le catalogue entier de simonian_jewels

Un champ optionnel par compte : un entier, ou `'all'`. Défaut 9 (l'actuel
`PER_ACCOUNT`). `simonian_jewels` prend `'all'`.

L'endpoint rend une page à la fois et publie un `next_max_id` : `'all'` le suit
jusqu'à épuisement. Deux gardes, parce qu'une boucle de pagination sur un compte
dont on ne connaît pas la taille est un chèque en blanc :

- **Un plafond dur de 500 posts**, journalisé s'il est atteint. Il n'est pas là
  pour brider un catalogue plausible mais pour qu'un compte inattendu (ou une
  pagination qui ne se termine pas) ne remplisse pas le dépôt en silence.
- **Une pause entre les pages**, comme entre les comptes : le script existe
  parce qu'Instagram coupe l'accès sur un rythme trop soutenu.

Le nombre réel est **mesuré au `--dry` avant toute écriture**, avec le poids
correspondant. S'il dépasse largement l'ordre de grandeur attendu, c'est une
décision à reprendre, pas un fait accompli.

### `exclude` — quinze posts qui ne doivent pas entrer

Une liste de **shortcodes** à la racine du pool, pas une consigne de position :

```
DYIOafVM7Ck  DWMnEA9DHQy  DTivHQtDHJx  Dbl4jYKM8b7  DTs_DE0DAWl
DTIhcZTjKOL  DNJSR9pME4c  DLh8hGHs280  C_xrBJUMjvi  DCHLupzM-mg
C84_5AIsRVo  C8tpsTCMrOq  C8HDSFQseZP  C6igwGksduf  C50Mq6VsF5R
```

Seize URL ont été fournies, dont un doublon (`DNJSR9pME4c`) ; aucun de ces
codes n'est aujourd'hui dans le pool ni empaqueté dans `src/data/ig/`.

**Nommer les posts plutôt que compter les premiers** est ce qui rend la règle
durable : « ne prends pas les 4 premières » désigne une position dans une grille
que le compte réordonne à chaque publication, et Instagram y fait flotter les
posts épinglés quel que soit leur âge. Un shortcode ne bouge jamais.

**La liste est globale, pas attachée à un compte.** Un shortcode identifie un
post à lui seul ; l'attacher à `naregjewelry` ajouterait une donnée à tenir
juste pour se tromper le jour où l'un de ces posts est un COLLAB visible sur
deux grilles.

**Elle s'applique en UN seul endroit : `ig-scrape.mjs`**, qui décide de ce qui
entre dans le pool. Ni `selectInstagram` ni `Social.jsx` ne la relisent — un
filtre écrit à deux endroits finit par diverger. Le pool est simplement dépourvu
de ces posts, donc rien en aval n'a de décision à prendre.

## 5. Le piège du `count=12`, et pourquoi il serait muet

`harvest()` appelle l'endpoint avec `?count=12`. Les deux réglages ci-dessus le
rendent **insuffisant, sans le dire** :

- `naregjewelry` veut 9 posts après retrait de 15 exclus. Si ces 15 sont parmi
  ses plus récents, une réponse de 12 en laisse **zéro**, et `if (!posts.length)
  throw` classerait le compte en échec pour une cause qui n'est pas la sienne.
- Un compte à `count` élevé recevrait 12 posts et le log dirait « ✓ 12 posts »
  — une réussite annoncée pour une récolte tronquée.

La requête demande donc **ce qu'on veut vraiment** : `count = min(50, voulu +
nombre d'exclus)` par page, et la pagination prend le relais au-delà. C'est
exact par construction dans le pire cas, où tous les exclus sont en tête.

**Et un avertissement quand la récolte est courte.** Un compte qui rend moins
que son `count` après exclusion n'est pas une erreur — il peut simplement avoir
peu publié — mais c'est le seul état où le pool contient autre chose que ce qui
a été demandé.

## 6. Des images au format des tuiles, pas au format d'Instagram

`download()` prend `image_versions2.candidates[0]`, c'est-à-dire **le plus grand
format qu'Instagram propose** (~1080 px). Mesuré sur le dépôt : 218 images,
48,8 Mo, **229 Ko de moyenne** — pour des tuiles rendues autour de 300 px et une
lightbox qui n'en montre guère plus de 900.

`candidates` est un tableau de plusieurs tailles. Prendre **le plus petit
candidat d'au moins 640 px de large** coûte zéro dépendance, zéro traitement
d'image, et divise le poids par environ trois. Un catalogue de 200 posts passe
ainsi de ~46 Mo à ~15 Mo dans le dépôt — et le dépôt garde ce poids dans son
historique pour toujours, ce qui est la raison de le regarder maintenant plutôt
qu'après.

Le repli si aucun candidat n'atteint 640 px : le plus grand disponible. Un post
ne doit jamais perdre son image sur une règle de taille.

**Les 218 images existantes ne rétrécissent pas ici** — elles sont réécrites au
format réduit à leur prochaine récolte, compte par compte. Le dépôt portera donc
deux générations d'images pendant un temps. C'est sans conséquence pour le
lecteur : chaque tuile affiche le fichier qui existe.

## 7. `--only <handle>` — récolter sans churner les 26 autres

`ig-scrape.mjs` boucle sur tout le pool : ajouter deux comptes coûterait 27
requêtes Instagram, une réécriture complète de `instagram.json` et un
re-téléchargement de 218 images — un diff illisible, et une limitation de débit
pour rien.

`--only <handle>` restreint la boucle, et accepte plusieurs handles séparés par
des virgules. Trois points vérifiés plutôt que supposés :

- **Le nettoyage des orphelins reste sûr.** Il construit `live` depuis
  `accounts` **en entier**, et un compte non récolté conserve ses `posts` par la
  branche `previousPosts` déjà en place — aucune image des autres comptes ne
  devient orpheline.
- **La garde `if (!okCount)` garde son sens** : avec `--only`, elle protège du
  cas où le seul compte visé échoue.
- **Un handle inconnu sort en erreur.** Sans correspondance dans le pool, le
  script s'arrête au lieu de récolter zéro compte et d'annoncer « rien écrit » —
  une faute de frappe ne doit pas se lire comme un échec réseau.

## 8. Le feed doit être re-tiré, et rien ne le rappelle

`instagram-feed.json` ne porte aujourd'hui que les quatre `group` existants.
Sans re-tirage, le brin `createurs` n'a aucun post, `Social.jsx` fait
`if (!posts.length) return null`, et le brin **n'existe nulle part** : pas
d'erreur, pas de test qui tombe, pas de build qui échoue — jusqu'au prochain
instantané horaire, qu'un push sur `main` ne déclenche pas (il bâtit et déploie
sans scraper). Or `selectInstagram` n'est atteignable que par `npm run scrape`,
qui re-gratte tout le réseau pour changer une sélection locale.

D'où **`scripts/ig-select.mjs` (`npm run ig-select`)** : il appelle
`selectInstagram(18)` et réécrit le seul `instagram-feed.json`, en **conservant
son `generatedAt`**. Un re-tirage n'est pas un instantané : aucune source n'a été
relue, et prétendre le contraire ferait annoncer une fraîcheur qui n'a pas eu
lieu.

## 9. Les garde-fous

**`test/instagram-strands.test.mjs`** (existant) : deux assertions passent de
quatre à cinq brins ; le reste est déjà générique.

**`test/instagram-draw.test.mjs`** (neuf) garde le tirage à la ronde, sur un pool
en dur — aucun réseau, aucune dépendance aux données du jour :

- Un compte à 200 posts face à trois comptes à 9 obtient **5 tuiles sur 18**,
  pas 16. C'est l'assertion qui échoue si quelqu'un « simplifie » la ronde en
  remettant un mélange à plat.
- Aucun shortcode n'apparaît deux fois, même quand deux comptes partagent un
  post (le cas COLLAB).
- Un brin dont la réserve totale est inférieure à la limite rend tout ce qu'il a,
  sans boucler.

**`test/instagram-pool.test.mjs`** (neuf) garde les réglages de récolte, dont le
mode de panne est silencieux :

- **Aucun shortcode de `exclude` n'est présent dans les `posts` du pool.** C'est
  ce qui attrape une régression de `ig-scrape`, une édition à la main, et le cas
  où un post exclu revient par une autre grille. Le site n'ayant aucune raison
  de relire la liste, ce test est le seul endroit d'où l'exclusion peut être
  vérifiée.
- **Aucune image d'un post exclu ne traîne dans `src/data/ig/`.**
- **`count` et `exclude` sont bien formés** : `count` entier positif ou `'all'`,
  shortcodes distincts et non vides.

Ce qu'aucun test ne peut voir, et qui reste une étape manuelle : que
`instagram-feed.json` ait bien été re-tiré. Les tests lisent le **pool**, pas la
sélection.

## Ce qui n'est pas fait

- **Aucun mécanisme d'épinglage de post.** Garantir qu'un post précis soit à
  l'écran demanderait une liste de posts curés hors comptes, et **deux
  protections que rien ne rappellerait** : `ig-scrape` réécrit `posts`
  intégralement, et son nettoyage final supprime toute image qu'aucun post ne
  pointe. `exclude` est l'opération inverse et n'a pas ce défaut : retirer est
  stable, garantir ne l'est pas.
- **Le plafond reste global**, 18 tuiles pour les cinq brins. La ronde rend un
  plafond par brin moins nécessaire : c'est la répartition, pas le total, qui
  posait problème.
- **Les 218 images existantes ne sont pas re-téléchargées** au format réduit.
  Une récolte complète le ferait, au prix d'un diff de 218 fichiers ; elles se
  réduiront compte par compte.
- **Le rythme visuel de la section n'est pas retravaillé.** Six étagères
  empilées se lisent comme une répétition ; les différencier toucherait
  `Carousel` et `global.css`, bien au-delà de la demande.
- **La clé `institutions` n'est pas renommée.** La raison est inchangée : c'est
  le repli `acc.group || 'institutions'`, écrit à la fois dans
  `scripts/sources/instagram.mjs` et dans `Social.jsx`.

## Vérification

- `node scripts/ig-scrape.mjs --only simonian_jewels,naregjewelry --dry`
  **avant** toute écriture. Il doit établir quatre choses : les deux handles
  existent ; la pagination termine et **combien de posts compte réellement le
  catalogue Simonian** ; `candidates` porte bien plusieurs tailles avec leur
  `width`, sans quoi la règle des 640 px n'a pas de prise ; et aucun shortcode
  exclu ne figure dans ce qui serait retenu.
- Le **poids réel** des images à télécharger, annoncé au `--dry`. C'est le
  chiffre qui décide si `'all'` reste raisonnable.
- `npm test` — cinq brins, leurs titres dans les quatre langues, le tirage à la
  ronde, le pool.
- `npm run lint` — 0 erreur, 5 avertissements connus, aucun nouveau.
- `npm run ig-select`, puis **comptage par groupe et par compte** de
  `instagram-feed.json` : cinq groupes, 18 posts chacun, et dans `createurs` une
  répartition ~5/5/4/4 et non 16/1/1/0. `generatedAt` inchangé.
- Rendu vérifié aux quatre langues et aux deux thèmes, à 360 px et en large : le
  titre le plus long du nouveau brin est arménien (`Հայ ստեղծագործողներ`).
- Les pastilles du nouveau brin listent ses quatre comptes, y compris un compte
  dont aucun post n'aurait été tiré — c'est leur rôle de repli.
- `CLAUDE.md` mis à jour : les cinq brins et leurs comptes, le tirage à la
  ronde, et au passage le chiffre périmé de « 16 comptes curés, 144 posts » que
  le passage à 25 comptes avait déjà rendu faux.
