# Vidéo automatique à la publication d'un article Culture

16 novembre 2026. Demande de Nareg : « Lorsque l'article est publié, publie
automatiquement la vidéo sur YouTube et Instagram (Reel). Je ne veux plus
d'image sur Instagram. »

## Intention

Aujourd'hui, chaque article Culture coûte une séance manuelle par langue, sur
plusieurs jours : un agent écrit les phrases de la vidéo, le rendu Remotion se
fait sur le PC de Nareg (`../armenie-video`, sans dépôt distant), Claude
téléverse dans YouTube Studio par Chrome (limite ~10 à 13 envois par 24 h et
par compte Google), puis `npm run reels:add` met la vidéo dans la file des
Reels. Le but : qu'un article publié parte en vidéo sur YouTube et en Reel
**sans séance**, avec la même relecture qu'aujourd'hui, et pas davantage.

Instagram ne publie plus d'images (fait : PR #181). Un article y arrive donc
UNIQUEMENT par son Reel : la vidéo devient la seule présence Instagram de
l'article.

## Objectifs

1. Le texte de la vidéo (7 « faits », titre et chapô YouTube) est **relu avec
   l'article** : il est rédigé avec le brouillon, montré dans la PR, corrigé
   par `/corrige` comme le reste, et couvert par la case « Faits vérifiés »
   (décision de Nareg, 16 nov.).
2. À la publication (fusion de la PR Culture), les 7 vidéos sont rendues en CI,
   déposées dans la release des Reels, inscrites dans `src/data/reels.json`,
   puis téléversées en **public** sur les 7 chaînes YouTube et inscrites dans
   `src/data/culture-videos.json`.
3. Le Reel d'un article neuf passe **avant** le catalogue sur chaque compte FB
   et IG (sinon il attendrait des semaines derrière les 23 anciens).

## Non-objectifs

- Re-téléverser ou modifier les vidéos déjà publiques.
- Une chaîne YouTube de plus, ou TikTok.
- Les vidéos de brève ou d'actualité : seulement la Culture.

## Anti-objectifs (échecs même si « ça marche »)

- Une vidéo part sans la relecture que reçoit son article (le français relu, les traductions sous la même règle que celles de l'article).
- Un doublon sur YouTube (un même Short publié deux fois sur une chaîne) :
  même règle « au plus une fois » que `social-post` (registre écrit AVANT
  l'envoi).
- Une vidéo YouTube restée privée ou en brouillon sans que le tableau de bord
  #128 le dise.
- Un échec muet : toute étape en panne a sa ligne sur #128.

## Contraintes mesurées

- **Audit YouTube.** Une app de l'API YouTube Data v3 non auditée par Google
  (projet créé après juillet 2020) voit ses vidéos `videos.insert` **verrouillées
  en privé**. Pour publier en public, Nareg doit remplir le formulaire d'audit
  « YouTube API Services », ce qui prend des jours ou des semaines. Tant que
  l'audit n'est pas obtenu, la CI ne peut pas publier.
- **Quota.** 10 000 unités/jour par projet ; un envoi = 1 600 → **6 envois/jour**.
  Un article = 7 langues. Il faut donc une file sur deux jours, ou une hausse de
  quota (même formulaire que l'audit).
- **Comptes.** 7 chaînes de marque sous un même compte Google. Il faut un
  jeton OAuth (refresh token) **par chaîne**, obtenu une fois par Nareg via un
  script local de consentement (choisir la chaîne dans l'écran Google). Ce
  sont 7 secrets GitHub, et le jeton expire après 7 jours tant que l'app reste
  « en test » : il faut passer l'écran de consentement « en production ».
- **Rendu.** Remotion tourne sous Linux avec Chrome headless ; ~1 à 2 min par
  Short, 7 par article, sans GPU. Le résultat doit rester < 10 Mo (CRF 30) et
  avec une piste audio (contrôle déjà présent dans `render-all.mjs`).
- `GITHUB_TOKEN` ne déclenche aucun workflow (piège n° 1 des articles Culture) :
  la chaîne vidéo se lance par `gh workflow run` explicite, comme
  `hourly.yml` aujourd'hui.

## Approches envisagées

**A. Tout en CI, code vidéo rapatrié dans ce dépôt (`video/`)** — retenue.
Le projet Remotion entre dans le dépôt public (polices et musiques sont déjà
sous licence libre, photos sous CC). Un workflow rend, dépose, inscrit et
téléverse. Coût : un `npm ci` Remotion de plus (mis en cache) et un dossier
lourd en dépendances. Avantage : un seul dépôt, la CI voit les articles et la
vidéo dans le même commit, plus de chemin `../ArmenianNews` codé en dur.

**B. Dépôt `armenie-video` séparé et privé, appelé par la CI.** Garde
l'historique à part, mais ajoute une clé de déploiement, deux checkouts et une
version à synchroniser entre deux dépôts. Aucun bénéfice réel : rien n'y est
secret.

**C. Semi-automatique : la CI rend et met en file, Claude téléverse par Chrome
en séance.** Ne demande ni audit ni jetons, mais ne répond pas à la demande
(« automatiquement »). Gardé comme **mode de repli tant que l'audit YouTube
n'est pas accordé** : la file est la même, seul l'envoyeur change.

## Conception (approche A, repli C)

### 1. Le texte de la vidéo naît avec le brouillon

- `culture-draft.mjs` (Gemini) produit, avec `fr.md`, un fichier
  `src/data/culture/<slug>/short.fr.json` : `{ facts: [7 × {eyebrow,title,text,big}],
  outroTitle, ytTitle, ytLead }`, soit le format actuel de
  `armenie-video/src/shorts/data/<slug>.json` découpé par langue. Les règles du
  prompt sont celles données aux agents jusqu'ici : chaque fait vient de
  l'article, chaque nombre figure dans l'article, texte ≤ 130 caractères,
  `ytTitle` + mot-dièse ≤ 100.
- La PR affiche les 7 faits sous l'article (corps de PR ou commentaire), pour
  une relecture au téléphone.
- `culture-check` contrôle `short.fr.json` : format, longueurs, et **chaque
  suite de chiffres présente dans `fr.md`**. Un échec bloque comme aujourd'hui.
- `/corrige` peut viser la vidéo (même modèle, même garde OWNER).
- `culture-translate.mjs` traduit `short.fr.json` en `short.<lang>.json`, avec
  `sourceHash` du `short.fr.json` (même règle de péremption que les `.md`) et
  la même garde d'alphabet.
- **Les vidéos traduites suivent la règle de l'article** (décision de Nareg,
  16 nov.) : une traduction Gemini part seule ; une traduction du secours
  `:free` attend que le relecteur recoche, comme l'article
  (`articles-publish.yml`). La relecture humaine porte sur le français.
- Les 23 sujets existants : leurs fichiers `src/shorts/data/<slug>.json` sont
  découpés une fois en `short.<lang>.json` dans le dossier de chaque article.
  Une seule source de vérité.

### 2. Rendu en CI à la publication

Nouveau workflow `video.yml`, lancé par `articles-publish.yml` et
`articles-merged.yml` (`gh workflow run video.yml -f slug=<slug>`), et à la
main.

1. `npm ci` dans `video/` (cache), Chrome headless de Remotion.
2. Rendu des 7 langues présentes (`short.<lang>.json` à jour) ; contrôle
   taille + audio.
3. Dépôt dans la release `reels-1` et entrées `reels.json` (logique de
   `scripts/lib/reels-add.mjs`, déjà pure), commit sur `main`.
4. Mise en file YouTube : `src/data/youtube-queue.json` (une entrée par
   slug × langue, avec l'URL de l'asset de la release). Les MP4 restent dans la
   release : la CI de l'envoi n'a pas à re-rendre.

### 3. Envoi YouTube

- `scripts/youtube-post.mjs`, appelé par `hourly.yml` (comme `social-post`) :
  au plus N envois par run (N calculé pour tenir le quota du jour), registre
  `src/data/youtube-posted.json` écrit et poussé AVANT l'envoi. Un échec sûr
  (4xx) ressort du registre et repart, 3 fois au plus ; un échec ambigu reste
  noté `uncertain`. Même mécanique que `social-send`, réutilisée.
- `videos.insert` resumable, `privacyStatus: public`, `selfDeclaredMadeForKids:
  false`, `defaultLanguage` = langue, titre/description = sortie de
  `describe.mjs` (crédits photo + musique). Puis entrée dans
  `culture-videos.json` (logique de `videos-add.mjs`).
- Secrets : `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_<FR|EN|HY|RU|DE|IT|ES>`.
  Un canal sans jeton est ignoré (comme les canaux sociaux).
- **Tant que l'audit manque** (variable `YOUTUBE_AUTO` absente) : rien n'est
  envoyé ; #128 liste la file 🎬 « à téléverser », et Claude la vide par Chrome
  en séance (méthode actuelle), avec `videos:add`.

### 4. Reel prioritaire

Dans `plan()` (`scripts/lib/social.mjs`), le Reel du jour prend d'abord un
article publié depuis moins de 7 jours, puis le catalogue dans l'ordre actuel.
Toujours un Reel par jour d'Erevan et par compte.

### 5. Tableau de bord

La section 🎬 de #128 ajoute : file YouTube (en attente, envoyés, échecs),
état de l'audit (variable), jetons refusés (« Recoller le jeton YouTube <lang> »),
et un rendu en échec.

## Ce qui revient à Nareg

- Créer le projet Google Cloud, activer YouTube Data API v3, écran de
  consentement « en production », puis remplir l'audit et la hausse de quota.
  Claude prépare les textes du formulaire.
- Lancer 7 fois le script local de consentement (une fois par chaîne) et coller
  les jetons en secrets. Claude donne les commandes `!`.

## Choix faits par Claude (à vérifier par Nareg)

- **Musique.** Le brouillon choisit la piste parmi les trois (`mazia` foi /
  écrit / pierre, `sergo` histoire / batailles, `otar` vie / fête / arts) et
  l'écrit dans `short.fr.json` (`music`). Elle s'affiche dans la PR et se change
  par `/corrige`. Elle ne retombe plus en silence sur `otar`.
- **Ordre de la file YouTube.** Premier arrivé, premier servi, par article,
  toutes les langues de l'article ensemble. On demande la hausse de quota avec
  l'audit. #128 passe en 🟠 si la file dépasse 14 envois (deux articles), ou si
  une vidéo y attend depuis plus de 5 jours.

## Laissé au constructeur

Le découpage exact des scripts, le nom des fichiers de file et de registre, et
le format du commentaire de PR qui montre les faits.

## Suite immédiate (hors conception)

Vidéos manquantes au 16 nov. : hy Khor Virap et hy Cilicie (rendues, envoi ce
soir) ; Mékhitaristes et Khorovats, 7 langues chacun (rendus en cours, à valider
par Nareg, puis envoi par Chrome et `reels:add`).
