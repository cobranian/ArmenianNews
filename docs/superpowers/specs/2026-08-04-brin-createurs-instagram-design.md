# Un cinquième brin Instagram : « Créateurs arméniens »

**Date** : 2026-08-04
**Portée** : `src/data/instagram.json`, `src/data/instagram-feed.json`,
`src/components/Social.jsx`, `src/i18n.jsx`, `test/instagram-strands.test.mjs`,
`test/instagram-pool.test.mjs` (neuf), `scripts/ig-scrape.mjs`,
`scripts/ig-select.mjs` (neuf), `package.json`,
`scripts/sources/instagram.mjs` (commentaire), `CLAUDE.md`.

**Suite directe de** `2026-08-04-quatre-brins-instagram-design.md`, écrit le même
jour : ce chantier-là a taillé quatre brins dans les 25 comptes existants, celui-ci
en tire un cinquième et recrute les deux premiers comptes depuis.

## La demande, et ce que le pool en disait déjà

Des liens Instagram pour un brin « Créateurs arméniens ». Confrontés au pool,
la moitié étaient **déjà sur le site** :

| Lien demandé | État au 4 août 2026 |
|---|---|
| `armeniancreators` | déjà dans le pool, brin `creation` |
| `armenian_women_artists` | déjà dans le pool, brin `creation` |
| `simonian_jewels` | **absent** — recruté ici, avec un catalogue élargi |
| `naregjewelry` | **absent** — recruté ici, avec une liste d'exclusion |
| `/reels/Dbf5hB8s7qq/` | déjà sur le mur : un post de `@maisonlumiere_geneva` |

Le lien de Reel n'est pas un compte mais **un post**, et l'architecture n'a pas
de place pour un post isolé : un brin est un `group` posé sur un **compte**, et
tous ses posts suivent. Maison Lumière change bien de brin, mais pour rejoindre
« Ateliers arméniens » — le Reel s'affichera donc là, pas chez les créateurs.

La demande se réduit donc à trois choses : une taxonomie à scinder, et deux
réglages de récolte que le pool ne sait pas encore exprimer.

## 1. La taxonomie : cinq brins

| Brin (clé `group`) | Comptes | Réserve | Servi | Renouvellement |
|---|---|---|---|---|
| `institutions` | 9 (−1) | 81 | 18 | 22 % |
| `personnalites` | 6 | 54 | 18 | 33 % |
| `creation` | 4 (−2 +1) | 36 | 18 | 50 % |
| `createurs` *(neuf)* | 4 | 51 | 18 | 35 % |
| `terre` | 4 | 36 | 18 | 50 % |

- `createurs` ← `simonian_jewels`, `naregjewelry` (recrutés), `armeniancreators`,
  `armenian_women_artists` (venus de `creation`)
- `creation` ← `maisonlumiere_geneva` (venu de `institutions`), et garde
  `abgarart`, `haykmiqayelyanart`, `margarit.armeniandance`

Vingt-sept comptes au total, contre vingt-cinq. Aucun brin ne puise plus de la
moitié de sa réserve à chaque tirage — c'est mieux réparti qu'avant le chantier.

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

**L'ordre : `createurs` se pose après `creation`, avant `terre`.** L'arc que le
commentaire d'`igStrands` décrit déjà reste narratif — la communauté, ses
visages, l'œuvre, ceux qui en font un catalogue, la terre.

## 2. Le titre

| Clé i18n | fr | en | hy | ru |
|---|---|---|---|---|
| `ig.strand.creators` | Créateurs arméniens | Armenian creators | Հայ ստեղծագործողներ | Армянские создатели |

*creators* est un choix explicite. Il **redit le nom d'un des comptes du brin**
(`@armeniancreators`), qui apparaît en pastille juste sous le carrousel : un
lecteur anglophone verra « Armenian creators » deux fois, une fois comme titre
d'étagère et une fois comme compte. *makers* évitait la collision ; il a été
écarté parce que « créateurs » est le mot demandé et que sa traduction directe
vaut plus que l'évitement d'un écho.

Les quatre langues disent alors le même mot : `ստեղծագործողներ` et `создатели`
traduisent *creators*, pas *makers* — c'était déjà le cas avant l'arbitrage
anglais, qui les rejoint plutôt qu'il ne les déplace.

`Հայ` et non `Հայկական`, seule entorse au moule des quatre titres existants :
`ստեղծագործողներ` désigne des **personnes**, et l'arménien met alors `Հայ`.
`Հայկական դեմքեր` garde `Հայկական` parce que des *visages* ne sont pas des
personnes grammaticalement.

## 3. Deux réglages de récolte que le pool ne sait pas exprimer

`ig-scrape.mjs` récolte aujourd'hui **9 posts pour tout le monde**, les plus
récents, sans exception possible. Les deux comptes recrutés demandent l'inverse
de cela, chacun dans un sens.

### `count` — un catalogue plus profond pour simonian_jewels

Un champ optionnel par compte, défaut 9 (l'actuel `PER_ACCOUNT`).
`simonian_jewels` prend **24**.

Ce que cela fait, et ce que cela ne fait pas : le brin sert toujours 18 tuiles,
donc le catalogue n'occupe **pas** plus de place à l'écran. Il porte la réserve
du brin de 36 à 51, donc les tuiles changent bien davantage d'une heure à
l'autre. C'est la lecture retenue de « bigger catalogue » : plus à voir sur la
durée, pas une étagère plus longue.

### `exclude` — quinze posts que naregjewelry ne doit pas servir

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
deux grilles — le cas existe déjà dans ce pool (`nemrabandofficial` /
`van.nemra`).

**Elle s'applique en UN seul endroit : `ig-scrape.mjs`**, qui décide de ce qui
entre dans le pool. Ni `selectInstagram` ni `Social.jsx` ne la relisent — un
filtre écrit à deux endroits finit par diverger, et le dépôt en porte déjà la
trace (le plafond Facebook contre `WANT`). Le pool est simplement dépourvu de
ces posts, donc rien en aval n'a de décision à prendre.

## 4. Le piège du `count=12`, et pourquoi il serait muet

`harvest()` appelle `/api/v1/feed/user/<handle>/username/?count=12`. Les deux
réglages ci-dessus le rendent **insuffisant, sans le dire** :

- `simonian_jewels` veut 24 posts et n'en recevrait que 12. Le compte
  apparaîtrait avec la moitié de son catalogue, et le log dirait « ✓ 12 posts »
  — une réussite.
- `naregjewelry` veut 9 posts après retrait de 15 exclus. Si ces 15 sont parmi
  ses plus récents, une réponse de 12 en laisse **zéro**, et `if (!posts.length)
  throw` classerait le compte en échec pour une cause qui n'est pas la sienne.

La requête demande donc **ce qu'on veut vraiment** : `count = min(50, voulu +
nombre d'exclus)`. C'est exact par construction dans le pire cas, où tous les
exclus sont en tête. Le plafond de 50 est une borne de politesse envers
l'endpoint, à vérifier au `--dry` : si Instagram en rend moins, le log doit le
dire.

**Et un avertissement quand la récolte est courte.** Un compte qui rend moins
que son `count` après exclusion n'est pas une erreur — il peut simplement avoir
peu publié — mais c'est le seul état où le pool contient autre chose que ce qui
a été demandé. Il est journalisé, comme `courrier.mjs` journalise un sitemap qui
répond sans dater personne.

## 5. `--only <handle>` — récolter un compte sans churner les 26 autres

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

## 6. Le feed doit être re-tiré, et rien ne le rappelle

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

## 7. Les garde-fous

**`test/instagram-strands.test.mjs`** (existant) couvre déjà l'essentiel du
brin : il extrait les brins de `Social.jsx` lu **comme du texte**, vérifie
qu'aucun compte du pool ne porte un `group` qu'aucun brin ne rend, qu'aucun brin
n'est vide, et que chaque titre est déclaré dans les **quatre** blocs `STRINGS`.
Deux assertions passent de quatre à cinq ; le reste est déjà générique.

**`test/instagram-pool.test.mjs`** (neuf) garde les deux réglages de récolte,
dont le mode de panne est silencieux dans les deux sens :

- **Aucun shortcode de `exclude` n'est présent dans les `posts` du pool.** C'est
  ce qui attrape une régression de `ig-scrape`, une édition à la main, et le cas
  où un post exclu revient par une autre grille (COLLAB). Le site n'ayant aucune
  raison de relire la liste, ce test est le seul endroit d'où l'exclusion peut
  être vérifiée.
- **Aucune image orpheline de l'exclusion dans `src/data/ig/`.** Un post retiré
  du pool dont l'image reste empaquetée alourdit le bundle sans rien afficher.
- **`count` et `exclude` sont bien formés** : `count` entier positif,
  shortcodes distincts et non vides. Une liste avec un doublon ne casse rien,
  mais elle signale une liste éditée sans être relue.

Ce qu'aucun test ne peut voir, et qui reste une étape manuelle : que
`instagram-feed.json` ait bien été re-tiré. Les tests lisent le **pool**, pas la
sélection.

## Ce qui n'est pas fait

- **Aucun mécanisme d'épinglage de post.** Le tirage prend 18 posts au hasard
  dans la réserve du brin ; garantir qu'un post précis soit à l'écran
  demanderait une liste de posts curés hors comptes, et **deux protections que
  rien ne rappellerait** : `ig-scrape` réécrit `posts` intégralement, et son
  nettoyage final supprime toute image qu'aucun post ne pointe. Un post épinglé
  et son image disparaîtraient à la première récolte suivante, en silence.
  `exclude` est l'opération inverse et n'a pas ce défaut : retirer est stable,
  garantir ne l'est pas.
- **Le plafond reste global**, 18 tuiles pour les cinq brins. Un plafond par
  brin serait plus fin ; il ferait aussi diverger deux réglages, et le dépôt
  sait où cela mène.
- **Le rythme visuel de la section n'est pas retravaillé.** Six étagères
  empilées (une Facebook, cinq Instagram) se lisent comme une répétition ; les
  différencier toucherait `Carousel` et `global.css`, bien au-delà de la
  demande.
- **Les groupes ne deviennent pas des données.** `igStrands` reste écrit dans
  `Social.jsx` — un ordre d'affichage est une décision éditoriale, pas une
  donnée récoltée, et le test le lit à cet endroit.
- **La clé `institutions` n'est pas renommée**, alors qu'elle décrit encore
  moins bien son brin qu'hier. La raison est inchangée : c'est le repli
  `acc.group || 'institutions'`, écrit à la fois dans
  `scripts/sources/instagram.mjs` et dans `Social.jsx`.

## Vérification

- `node scripts/ig-scrape.mjs --only simonian_jewels,naregjewelry --dry`
  **avant** toute écriture : les deux handles existent, la réponse porte assez
  de posts pour honorer `count` après exclusion, et aucun shortcode exclu ne
  figure dans ce que le script retiendrait. Un handle absent d'Instagram répond
  404 et se lit comme un échec de compte.
- `npm test` — dont les cinq brins, leurs titres dans les quatre langues, et le
  nouveau fichier de pool.
- `npm run lint` — 0 erreur, 5 avertissements connus, aucun nouveau.
- `npm run ig-select`, puis **comptage par groupe** de `instagram-feed.json` :
  cinq groupes, 18 posts chacun, `generatedAt` inchangé. C'est le contrôle qui
  attrape le piège du brin vide.
- Rendu vérifié aux quatre langues et aux deux thèmes, à 360 px et en large : le
  titre le plus long du nouveau brin est arménien (`Հայ ստեղծագործողներ`), et
  c'est lui qui décide si la tête de brin tient.
- Les pastilles du nouveau brin listent ses quatre comptes, y compris un compte
  dont aucun post n'aurait été tiré — c'est leur rôle de repli.
- `CLAUDE.md` mis à jour : les brins et leurs comptes, et au passage le chiffre
  périmé de « 16 comptes curés, 144 posts » que le passage à 25 comptes avait
  déjà rendu faux.
