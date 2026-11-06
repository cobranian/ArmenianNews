# Reels Facebook + Instagram : les Shorts Culture en musique

Date : 6 novembre 2026. Deux dépôts concernés : `armenie-video` (rendus, local,
sans remote) et `ArmenianNews` (publication, CI horaire).

## Intention

Faire rayonner l'Arménie — sa musique, sa culture, sa cuisine, ses peintres,
ses paysages, ses arts — auprès des Arméniens et de toute personne qu'elle
attire (mots de Nareg). Les Shorts Culture existent déjà (23 sujets × 7
langues, 81 publiés sur YouTube, muets) ; la musique de duduk vient d'être
intégrée au gabarit et validée à l'écoute (« parfait les sons et avec les
vidéos »). Il s'agit de les republier en **Reels** sur les comptes Facebook et
Instagram du site.

**Succès** (Nareg) : plus d'abonnés, plus de partages, et du monde qui passe
du Reel au site.

## Étapes

1. **Ce document** : les 23 Shorts Culture existants, remis en musique, en
   Reels — un par jour et par compte.
2. **Plus tard, hors de ce document** : de nouveaux sujets (cuisine, peintres,
   paysages…). On en reparle une fois l'étape 1 en service.

## Objectifs

- Les 23 sujets × 7 langues rendus **avec musique** (161 fichiers), relus
  automatiquement, puis publiés en Reels sur les **14 comptes** FB + IG (une
  paire par langue : `facebook-<clé>`, `instagram-<clé>` de `ACCOUNT_SETS`).
- **Un Reel par jour et par compte** (décidé par Nareg), en goutte-à-goutte
  jusqu'à épuisement du catalogue (~23 jours), puis chaque nouveau Short
  rendu entre dans la file.
- Chaque légende mène au site : lien vers l'article de **sa** langue
  (`cultureUrl(lang, slug)`, avec `utm_source=facebook|instagram&utm_medium=reel`),
  crédit photo, **crédit musique** (`musicCredit(slug)`, `armenie-video/src/shorts/music.tsx`).
- Les Shorts YouTube **non encore envoyés** (~84 : de 20, it 23, es 23,
  6 nouveaux sujets × fr/en/hy) partent dans leur version musicale, avec le
  crédit musique dans la description.

## Anti-objectifs (ce qui ferait échouer même si « ça marche »)

Nareg : **une faute dans la langue ou un fait faux.** S'y ajoutent :
- un Reel publié deux fois sur le même compte, ou plus d'un par jour ;
- une musique revendiquée (Content ID / gestionnaire de droits Meta) qui
  rendrait la vidéo muette ou bloquée ;
- une légende dans une autre langue que celle du compte, ou un lien vers
  l'article d'une autre langue.

## Non-objectifs

- Re-téléverser les 81 Shorts YouTube déjà publics (ils restent muets).
- Des Reels sur Bluesky, Telegram, LinkedIn ou X.
- Une relecture humaine : personne n'est disponible, Nareg a dit « on publie
  comme ça ». La relecture automatique (ci-dessous) est la seule garde.
- Les nouveaux sujets (étape 2) et le « Short par nouvel article » automatique
  (chantier séparé).

## Contraintes connues

- Le robot de publication tourne en CI (`hourly.yml`, job `social`, après le
  déploiement) ; il n'a **pas** accès à `armenie-video`. Les MP4 doivent donc
  vivre ailleurs que sur le poste.
- Le registre `src/data/social-posted.json` est la seule mémoire de ce qui est
  parti, écrit et poussé **avant** l'envoi ; un échec ambigu ne se retente pas
  (`isUncertain`). Ces règles valent telles quelles pour les Reels.
- Un compte absent du registre est **amorcé** (tout marqué `seed`). Les
  comptes existants n'ont jamais vu d'id `reel:*` : ils publieraient donc le
  catalogue — c'est **voulu**, au rythme d'un par jour.
- Fichiers : 1080×1920, 44,2 s, H.264 + AAC, ~4 Mo (CRF 30). Conformes aux
  exigences Reels connues (9:16, 3–90 s).
- Envois YouTube : ~10 par 24 h glissantes **par compte Google**, à la main
  dans Studio (procédure dans la mémoire `videos-youtube`).

## Décisions

Les décisions de Nareg :
- Public, objectif et mesure du succès (voir plus haut).
- Shorts existants d'abord, nouveaux sujets ensuite.
- Un Reel par jour et par compte.
- Les trois pistes de duduk et leur répartition par thème (validées à
  l'écoute).
- Publication sans relecture humaine, avec la relecture automatique.

Mes choix, annoncés et non contestés :
- Les 81 Shorts publics restent muets.
- Un essai YouTube **privé** avec la piste SERGO.TEL avant les envois
  musicaux.
- Les Reels sur les 14 comptes FB + IG, chaque langue sur ses propres comptes.

### 1. Relecture automatique (avant tout rendu)

- Un second modèle relit, pour chaque sujet × langue non française, les
  textes affichés à l'écran (`src/shorts/data/<slug>.json` : `facts`,
  `outroTitle`) et ceux qui partent en ligne (`ytTitle`, `ytLead`,
  descriptions de `out/youtube/<slug>-<lang>.json`).
- Il compare chaque texte à l'article de sa langue
  (`src/data/culture/<slug>/<lang>.md` côté site) et au français.
- Il **signale** sans corriger : faute de langue, faux sens, fait absent de
  l'article. Il produit une liste « sujet / langue / phrase / problème /
  proposition ».
- **Toutes les corrections proposées sont appliquées** (décision de Nareg :
  « applique tout »), sans validation ligne par ligne et sans attendre de
  réponse. La liste lui est montrée après coup : rien n'est corrigé sans
  trace.
- Une correction peut toucher la vidéo (`src/shorts/data/*.json`,
  `src/garni/content.ts`, `out/youtube/*.json`) **et l'article traduit du
  site** (`src/data/culture/<slug>/<lang>.md`, décision de Nareg). Elle ne
  touche **jamais** `fr.md` : le modifier rendrait périmées toutes ses
  traductions (`sourceHash`), que le build retirerait. Un défaut trouvé dans
  le français est seulement signalé. Une retouche d'un `<lang>.md` ne change
  pas son `sourceHash`, qui est l'empreinte du français : l'article reste
  publié. Elle passe par une PR du site, avec `npm run culture:check`.
- Cela vaut aussi pour les sujets déjà publics sur YouTube : leur Reel sera
  rendu à partir du texte corrigé.
- Mon choix : la relecture tourne en séance (sous-agents Claude, une langue
  par agent) plutôt que par Gemini, pour ne pas consommer le crédit qui sert
  aux articles.

### 2. Rendus (armenie-video)

- Il y a **un seul rendu par (sujet, langue)**, avec musique. Il sert au
  Reel et, s'il n'est pas encore envoyé, au Short YouTube.
- Le rendu écrase `out/<lang>/<slug>.mp4` : les vidéos déjà publiques sont
  tracées par leurs ids, le fichier muet n'a plus d'usage.
- Les descriptions `out/youtube/<slug>-<lang>.json` gagnent la ligne
  `musicCredit(slug)`, pour les envois à venir seulement.
- Si la piste juskiddink arrive avant les rendus, elle prend une partie des
  sujets « otar » (le plus chargé, 9 sujets). Sinon, elle attend l'étape 2.

- **Garni** (mon choix) : il garde sa composition propre (`GarniFr`…`GarniEs`,
  `src/garni/`), qui porte déjà `<ShortMusic slug="temple-paien-de-garni">`.
  Il fait partie des 161 : ses textes relus sont ceux de `src/garni/content.ts`
  et ses rendus sont écrits sous le chemin commun
  `out/<lang>/temple-paien-de-garni.mp4`.

### 3. Hébergement des MP4

- Une **release GitHub** du dépôt ArmenianNews (public), tag `reels-1`, porte
  un fichier `<lang>-<slug>.mp4` par vidéo (~650 Mo au total). Les MP4 ne
  passent **pas** par `public/` : Vite les copierait dans les deux `dist/`.
- Un nouveau rendu se publie en ajoutant ou en remplaçant le fichier dans la
  release.

### 4. Manifeste dans le dépôt

- `src/data/reels.json` liste les vidéos prêtes :
  `{ <slug>: { <lang>: { asset, title, caption, music } } }`.
- Il est écrit par un script local (`npm run reels:add`, sur le modèle de
  `videos:add`). Le script lit `armenie-video/out/youtube/<slug>-<lang>.json`
  et `music.tsx`, et téléverse le fichier dans la release (`gh release upload`).
- Seul ce manifeste fait foi pour le robot : une vidéo absente n'est jamais
  publiée.

### 5. Publication (ArmenianNews)

- **Nouveau type d'élément `reel`** dans `KINDS` (`scripts/lib/social.mjs`),
  activé par `SOCIAL_KINDS`.
  - Le constructeur `reelItems` produit, à partir du manifeste, un élément
    par (slug, langue), avec l'id `reel:<slug>`. L'id est partagé entre
    langues, comme `culture:<slug>` : chaque compte n'a qu'une langue.
  - Un élément `reel` ne vise **que** les plateformes facebook et instagram
    (`supports()`).
- **Cadence** : au plus **un** `reel` par compte et par jour civil d'Erevan.
  La règle se lit dans le registre (horodatage du dernier `reel:*` du
  compte) et s'ajoute à `MAX_PER_RUN`, sans le remplacer. L'ordre suit la
  date de l'article, la plus ancienne d'abord, comme aujourd'hui.
- **Amorçage** : un compte **nouveau** n'amorce pas les `reel:*`. Il reçoit
  donc lui aussi le catalogue au goutte-à-goutte. Mon choix : c'est le
  catalogue qui fait vivre un compte neuf.
- **Envoi** par téléversement du fichier (resumable upload, octets envoyés
  depuis la CI après un `gh release download`) plutôt que par URL : on évite
  de dépendre de la redirection 302 des assets GitHub. Sur Facebook, on suit
  le flux `video_reels` (start, téléversement, finish). Sur Instagram,
  `media_type=REELS` avec `upload_type=resumable`, puis l'attente du statut
  `FINISHED` (le délai doit être plus long que les 90 s des images) et
  `media_publish`.
  - Les appels qui publient (finish FB, `media_publish` IG) entrent dans
    `FINAL` : un délai ou une 5xx y est **ambigu** et ne se retente pas.
- **Légende** composée par `compose()` :
  - FB : titre, chapô, lien de l'article, crédits photo et musique.
  - IG : la même chose, mais « lien en bio » à la place du lien, plus les
    hashtags existants.
  - Les chaînes de légende viennent de `STRINGS` (social.mjs), dans les sept
    langues.
- **Tableau de bord** (#128) : les échecs passent déjà par le registre. On
  ajoute une ligne « Reels : N publiés / M au catalogue » par compte.

### 6. Ordre de mise en service

1. Relecture automatique, puis liste montrée à Nareg, puis corrections.
2. Rendus des 161, puis manifeste, puis release.
3. Un Reel d'essai à la main sur **un** compte (`social-test.yml --item
   reel:duduk`, compte fr). On vérifie : publié, son présent, pas de
   réclamation de droits, légende juste. Mon choix pour le premier : la
   piste « otar », la plus sûre.
4. Activation de `reel` dans `SOCIAL_KINDS` pour les 14 comptes.
5. En parallèle, les envois YouTube restants, version musicale, à la main
   dans Studio en séance comme jusqu'ici. Ils se tracent par `videos:add` et
   ne bloquent pas les Reels. Pour une vidéo déjà publique,
   `culture-videos.json` reste tel que publié ; `out/youtube` ne sert qu'aux
   envois à venir.

**Essai Content ID** (mon choix) : l'envoi YouTube **privé** de la piste
SERGO.TEL passe **avant** l'étape 4. Si YouTube revendique la piste, ses
8 sujets sont re-rendus avec la piste « mazia » avant d'entrer au manifeste.
Le gestionnaire de droits de Meta est un système distinct, mais une piste
revendiquée par l'un est un mauvais pari pour l'autre.

## Laissé au constructeur

- Les champs exacts des API Reels (versions, noms de paramètres, en-têtes de
  téléversement). Il faut les vérifier dans la documentation Meta en vigueur
  et par l'essai réel, pas de mémoire.
- Les droits supplémentaires éventuels de la clé (vidéo de Page). La clé
  FB/IG actuelle a `pages_manage_posts` et `instagram_content_publish`. Si
  l'essai réclame davantage, c'est Nareg qui régénère la clé.
- Les tests : il faut en écrire, sur le modèle de `test/social.test.mjs`
  (cadence, amorçage, `supports`, légende, manifeste).
- Le découpage en PR.
