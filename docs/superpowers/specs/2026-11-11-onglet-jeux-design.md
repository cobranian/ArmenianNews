# Onglet Jeux : échecs et backgammon — conception

Date : 11 novembre 2026. Statut : à approuver.

## Intention

Ajouter aux deux vitrines (armenieinfo.ch et armenianews.org, sept langues) un
onglet **Jeux** qui propose les **échecs** et le **backgammon** de lokolok.com,
avec des **fonctionnalités identiques** à celles de lokolok. Ces deux jeux sont
écrits par Nareg (`../Games/Chess`, `../Games/Backgammon`) ; lokolok ne fait
que les copier dans son portail.

Pourquoi ces deux jeux sur un site d'actualité arménienne : le nardi (le
backgammon) est le jeu des cours et des parcs d'Erevan, et les échecs sont une
fierté nationale. L'onglet donne une raison de revenir au site, et une page
pilier de plus, qu'on peut indexer.

## Ce qui a été décidé avec Nareg

1. **Fonctionnalités identiques à lokolok.** On réutilise **le code des deux
   jeux tel quel** : pas de réécriture en React. Tout ce qu'ils font sur
   lokolok doit marcher ici :
   - **Échecs** : robot à 4 niveaux (facile, intermédiaire, moyen, fort) ;
     couleur blancs, noirs ou au hasard ; toutes les règles ; feuille de
     partie ; reprise de coup ; partie retrouvée après un rechargement ;
     **mode ami** par QR code ou lien, sans compte, avec pendule (0, 1, 3, 5,
     10 ou 30 min), 3 reprises par partie, proposition de nulle, abandon et
     revanche aux couleurs inversées.
   - **Backgammon** : robot à 3 niveaux ; matchs en 1, 3 ou 5 points ; videau
     de 1 à 64 et règle de Crawford ; partie retrouvée après un rechargement ;
     **mode ami** avec dés équitables (engagement SHA-256) et victoire
     réclamable après 3 min d'absence de l'ami.
   - Langue de l'interface du jeu : les sept langues du site y sont déjà
     (fr, de, it, en, es, hy, ru).
2. **Apparence des jeux : telle quelle** (maquette A). Le cuir, l'érable, le
   noyer, le laiton et les polices propres à chaque jeu ne sont **pas**
   retouchés pour l'Apricot Press.
3. **Plein écran.** Toucher un jeu ouvre sa propre page, en plein écran, sans
   la barre du site. Un **petit bouton de retour** ramène à l'onglet Jeux, dans
   la bonne langue. Les jeux calculent la taille du plateau sur `100dvh` :
   la barre du site lui volerait environ 100 px sur téléphone.
4. **Une base Firebase séparée de celle de lokolok.** Les deux sites restent
   indépendants. Le prix à payer est assumé : il faut tenir à jour **deux
   copies** des règles de sécurité et de la couche de salles.
5. **L'onglet Jeux montre les deux jeux et des textes réécrits pour Arménie
   Info**, et non la copie des pages de lokolok : un texte repris mot pour mot
   ferait choisir à Google un seul des deux sites.
6. **L'angle des textes est arménien.**
   - **Les échecs** : une matière obligatoire à l'école en Arménie depuis 2011,
     trois Olympiades gagnées (2006, 2008, 2012) et Tigran Petrossian, champion
     du monde.
   - **Le nardi** : le nom arménien du backgammon, et le plateau qu'on sort
     dans les cours d'Erevan.

   Chaque texte est suivi des règles, en court. **Aucun fait n'est publié sans
   source**, selon la même règle que `src/stations.js` : un fait qu'on ne
   trouve pas, ou sur lequel deux sources se contredisent, est **omis**. Le
   français s'écrit d'abord, puis il est traduit dans les six autres langues.

## Hors du périmètre, et à ne pas faire

- Pas de compte, de classement, de publicité ni de tournoi. lokolok n'en a pas
  non plus pour ces deux jeux.
- Pas d'autre jeu de lokolok.
- Pas de variante « long nardi » : le backgammon de lokolok est le backgammon
  occidental, et le texte ne doit pas laisser croire autre chose.
- **Échec, même si tout fonctionne :**
  - un mode ami qui écrit dans la base de **lokolok**. Le `config.js` de
    lokolok, recopié tel quel, le ferait **sans aucune erreur** ;
  - une page du site alourdie par les jeux. Le code des jeux et le SDK
    Firebase ne doivent jamais entrer dans le bundle React ;
  - un fait faux ou sans source dans les textes.

## Architecture retenue (choix de Claude, approuvables avec le document)

### Où vivent les jeux

- Copie des jeux, embarquée dans le dépôt, sous **`public/play/echecs/`** et
  **`public/play/backgammon/`**. Il faut garder `/play/<jeu>/` : c'est le chemin
  que `urlSalle` (`protocole.js`) met dans les liens d'invitation. Vite copie
  `public/` dans les **deux** `dist/`. Ici c'est voulu : un jeu n'a pas de
  langue de vitrine, et un lien d'invitation s'ouvre sur l'hôte qui l'a créé.
- La couche de salles de lokolok est copiée sous **`public/assets/net/`** :
  `salle.js`, `salle2.js`, `protocole.js`, `journal.js`, `messages.js`,
  `qrcode.js`. Il faut garder ce chemin, parce que les jeux l'importent en
  **absolu** (`import('/assets/net/salle2.js')`). Le `config.js` est **propre à
  Arménie Info**. `classement.js` n'est pas copié.
- Le **dépôt ne lit jamais `../Games` ni `../lokolok` en CI** : ce sont
  d'autres dépôts. Un script local, `npm run jeux:sync`, recopie les jeux sans
  leurs tests ni leurs fichiers de développement (même liste d'exclusion que
  `lokolok/sync-games.js`), puis la couche net sans son `config.js`. Il pose
  aussi les deux ajouts décrits plus bas. **Une mise à jour d'un jeu sur
  lokolok n'arrive ici que par ce script**, lancé à la main, suivi d'un commit.
  Cette limite est assumée.

### Ce qui change dans la copie (et rien d'autre)

1. **Bouton de retour.** Un petit script, `retour.js`, ajouté à chaque
   `index.html` copié. Il crée un lien discret dans un coin, vers la vue Jeux
   de la langue du jeu (`?lang=`, puis la langue que le jeu a retenue). Le
   chemin est déduit de l'hôte et de la langue, à partir de `sites.config.js`
   (table générée par `jeux:sync`, ou écrite au build). Il ne doit masquer
   **aucune** commande du jeu, ni en portrait à 360 px, ni en paysage.
2. **Statistiques.** `/assets/stats.js` de lokolok (bouton « Partager »,
   événements GA du portail) est remplacé par une **cale** qui définit
   `window.lokolokStat` et envoie `partie_debut`, `partie_fin`, `salle_creee`
   et `salle_rejointe` au GA4 de la vitrine, **sous le consentement déjà en
   place** (`ga-init.js`). Pas de bouton « Partager ».

3. **Script en ligne des échecs** (choix de Claude). `Games/Chess/index.html`
   contient `<script>LokoI18n.appliquer();</script>`, que la CSP du site
   (`script-src 'self'`) bloquerait **en silence** : l'interface des échecs ne
   serait jamais traduite, et rien ne l'annoncerait. `jeux:sync` sort donc
   cette ligne dans un fichier externe, à chaque synchronisation. On ne
   touche pas à `Games/Chess` : ce serait changer aussi ce que sert lokolok.
   Un test vérifie qu'**aucun** `index.html` de `public/play/` ne contient de
   script en ligne. Le backgammon n'en a pas.

Les liens de l'onglet vers un jeu passent `?lang=<langue de la page>`. Le jeu
garde cette langue dans `localStorage`, comme sur lokolok.

### La vue « jeux »

Une cinquième vue dans `VIEWS` (`sites.config.js`). Ses slugs suivent la règle
des slugs existants : en latin, traduits là où le mot change, avec le slash
final.

| fr | de | it | en | es | hy | ru |
|---|---|---|---|---|---|---|
| `jeux/` | `spiele/` | `giochi/` | `games/` | `juegos/` | `games/` | `games/` |

**Ajouter une vue touche sept endroits** (voir CLAUDE.md, « Les vues ») :

- `VIEWS` ;
- `VIEW_SEO` ;
- la route d'`App.jsx` ;
- le composant ;
- `SANS_AGENDA` (la vue jeux n'a **pas** d'`Event`) ;
- le bloc « Pages » du pied de page ;
- la page 404.

Il faut y ajouter un lien **Jeux** dans la `Nav`, à côté de Radio et Agenda.
`test/about.test.mjs` montre le tour complet.

La vue montre, pour chaque jeu :
- une vignette (celles de lokolok, `assets/vignettes/{echecs,backgammon}.png`,
  peuvent servir) et un bouton « Jouer » qui ouvre le jeu ;
- le texte arménien, puis les règles en court.

Elle porte le style du site (Apricot Press, jour et nuit) : ce sont **les jeux**
qui gardent le leur, pas l'onglet. Elle est prérendue comme les autres vues, et
son hydratation ne doit montrer aucun écart (`npm run hydration-check`).

Les textes et leurs sources vivent dans un **module plat** (même raison que
`src/stations.js` et `src/seo.js`). Un test exige au moins une source
`https://` par fait, et que chaque chaîne existe dans les sept langues.

### SEO

- La vue Jeux est indexable : `hreflang` réciproques, sitemap, JSON-LD par le
  générateur commun.
- Les pages `/play/*` sont des outils sans texte : `noindex`, hors du sitemap.
- `npm run check` couvre la nouvelle vue : il passe à 35 pages, 7 langues × 5
  vues.

### Mode ami : base Firebase d'Arménie Info

- **Projet : `armenie-info`** (celui du .ch). Une seule base Realtime
  Database (`europe-west1`) sert **les deux** vitrines. Le .org s'y connecte
  depuis son domaine, ce que Firebase accepte.
- `database.rules.json` : une copie des règles de lokolok, **réduite** aux
  salles d'`echecs` et de `backgammon` si les règles le permettent sans perdre
  de garde. Les tests de règles de lokolok (`tests/regles/`, sur émulateur,
  Java 21) sont recopiés pour ce qui concerne ces deux jeux. Ils tournent en
  local et sont **sautés** sans émulateur, comme sur lokolok.
- **CSP** (`firebase.json`, **les deux blocs `headers`**, comme toujours) :
  - `script-src` : `https://www.gstatic.com` (SDK Firebase 12.3.0) ;
  - `connect-src` : la base (`https://*.firebasedatabase.app`,
    `wss://*.firebasedatabase.app`) et l'authentification anonyme
    (`https://identitytoolkit.googleapis.com`,
    `https://securetoken.googleapis.com`).

  Les pages `/play/*` suivent la même CSP. Il faut vérifier que les jeux n'ont
  **aucun script en ligne** (la CSP n'a pas `'unsafe-inline'`) et que leurs
  workers modules se chargent (`worker-src` retombe sur `script-src 'self'`).
- **Cache** (choix de Claude) : `firebase.json` sert `assets/**` en
  `immutable` pour un an. Or `/assets/net/*.js`, la cale de statistiques et
  les fichiers de `/play/**` ne portent pas d'empreinte dans leur nom. Sans un
  en-tête plus précis pour ces chemins, posé **dans les deux blocs**, un
  correctif de `config.js` ou une resynchronisation n'atteindrait jamais les
  joueurs qui reviennent.
- **Garde-fous de test**, parce que ces pannes-là seraient muettes :
  - `public/assets/net/config.js` ne désigne **jamais** le projet
    `lokolok-com` ;
  - les deux blocs CSP contiennent les hôtes Firebase ;
  - chaque jeu copié contient `index.html` et son `retour.js` ;
  - aucun fichier de `public/play/` n'est importé par `src/`.

### Étapes manuelles de Nareg (une fois)

Elles reprennent la checklist « Realtime Database » du README de lokolok,
appliquée au projet `armenie-info` :

1. Créer la Realtime Database, en `europe-west1` et en mode verrouillé.
2. Activer l'authentification **Anonyme**.
3. Ajouter une application Web, puis copier `apiKey` et `appId`.
4. Si la clé d'API est restreinte par référent, y ajouter les deux domaines.
5. Déployer les règles. Le compte de service de la CI n'a aujourd'hui que le
   rôle Hosting Admin. Il faut soit lui ajouter un rôle sur la base, soit
   déployer les règles à la main avec `firebase deploy --only database`. Le
   plan d'exécution doit choisir une option et l'écrire.

Le README d'ArmenianNews reçoit cette procédure.

## Mise en ligne en deux temps (décidé par Nareg)

1. **Premier temps, sans rien attendre de Nareg** : la vue Jeux dans les sept
   langues, les deux jeux contre le robot, et la politique de confidentialité
   à jour. Le `config.js` d'Arménie Info a un `apiKey` vide : le bouton du mode
   ami affiche alors le message clair de `salle.js` (« pas encore configuré »),
   et le SDK Firebase n'est jamais téléchargé. La CSP et les règles peuvent
   déjà être en place.
2. **Second temps, après les étapes manuelles de Nareg** : les clés sont
   copiées dans `config.js`, les règles sont déployées, puis le mode ami est
   vérifié de bout en bout avec deux navigateurs avant d'être annoncé.

Chaque temps est une PR à part, et a ses propres vérifications.

## Politique de confidentialité (décidé par Nareg)

Les textes `privacy.*` de `src/i18n.jsx` (sept langues) sont mis à jour dans le
**premier temps** :

- **`privacy.storage.body`** : il ne parle aujourd'hui que du thème. Les jeux
  gardent aussi dans le navigateur la partie en cours, le niveau, la couleur
  ou la longueur de match, la langue du jeu, le prénom facultatif du mode ami
  et, au backgammon, les secrets de dés d'une salle. Rien de tout cela ne nous
  est transmis.
- **Une section nouvelle pour le mode ami**, qui **nomme Firebase** (Google) :
  - une connexion anonyme, sans compte, crée un identifiant gardé dans le
    navigateur ;
  - les coups, et le prénom s'il est saisi, transitent par une base Firebase
    Realtime Database en Europe (`europe-west1`) ;
  - une salle est périmée après 24 h ;
  - rien de tout cela ne se produit sans un clic sur « mode ami ».

  Il faut confirmer ce que les règles et `salle.js` font **réellement** des
  vieilles salles (sont-elles effacées, ou seulement écrasables ?) et écrire
  seulement ce qui est vrai.
- Le commentaire de tête des chaînes `privacy.*` le rappelle déjà : ce texte
  doit décrire ce que le site fait vraiment. Toute évolution du mode ami doit
  donc le suivre.

## Ce qui est laissé au constructeur

- Le dessin de la vue Jeux, dans le cadre du style du site et des pièges de
  `pieges-rendu.md`.
- La forme exacte du bouton de retour, et sa place, pourvu qu'il ne masque
  rien.
- Le libellé de la Nav dans chaque langue.
- La rédaction des textes, sous la règle des sources.
- L'ordre des tâches, et le fait de travailler dans un worktree, selon
  l'habitude du dépôt.

## Vérification attendue avant de dire « fini »

- `npm test`, `npm run lint` (toujours 5 avertissements), `npm run build`,
  `npm run check`, `npm run prerender`, `npm run hydration-check`.
- Dans un vrai Chrome, sur les deux vitrines en préversion, à 360 px et sur
  ordinateur : une partie contre le robot dans chaque jeu ; une partie
  retrouvée après un rechargement ; le bouton de retour qui ramène à la bonne
  langue.
- **Mode ami, de bout en bout :** deux navigateurs, une salle créée sur l'un et
  rejointe par le lien sur l'autre, des coups vus des deux côtés, puis un
  rechargement. Il faut aussi vérifier que l'écriture part bien dans la base
  `armenie-info`, **pas** dans celle de lokolok.
