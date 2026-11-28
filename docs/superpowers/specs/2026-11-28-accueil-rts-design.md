# Nouvel accueil « à la RTS », page Actualités, radio permanente

Date : 28 novembre 2026. Statut : conception validée par Nareg, à planifier.
Maquette validée (« parfait ») : `.superpowers/brainstorm/7187-1795824347/content/accueil-v1.html`
(non versionnée ; servie par le compagnon visuel, images sous `/files/`).

## Intention

**Augmenter la rétention** des visiteurs qui arrivent sur le site : qu'ils
restent, cliquent plus loin et se promènent. Tout arbitrage de détail se
tranche à cette aune : ce qui retient l'œil et invite au clic monte, ce qui
occupe de la place sans rien proposer (le grand bandeau doré du héros)
rétrécit. Mesure du succès : GA4 (durée d'engagement, pages vues par
visite), avant / après.

Modèle revendiqué : la page d'ouverture de rts.ch (grille « une »),
son bandeau « L'actualité en vidéo » et son lecteur plein écran, sa barre de
rubriques (« Culture • Cinéma • Séries… »). L'esthétique reste celle du site
(« Apricot Press », basalte / abricot, Fraunces + Hanken Grotesk, jour / nuit).

## Ce qui est construit

### 1. En-tête (toutes les pages)

- Le héros actuel (`Hero.jsx` : kicker trilingue, grand titre doré, baseline,
  nœud, pastille « Instantané du… ») **disparaît de l'accueil**. La marque
  devient une ligne dans la barre de navigation (Fraunces italique, dégradé
  abricot, ~26 px).
- Barre principale : marque · Actualités · Culture · Agenda · Radio · Jeux ·
  bouton **« Radio en direct »** (point rouge + ▶/⏸) · langue · jour/nuit.
  Sur téléphone : marque, bouton radio (icône seule), menu ☰.
- Sous la barre, **sur l'accueil seulement** : la barre de rubriques
  À la une • Arménie • Politique • Économie • Monde • Société • Diaspora •
  Culture • Sports • Opinion (points abricot entre les mots, défilement
  horizontal sur téléphone). Chaque entrée mène à la page de la rubrique
  (§3).
- L'horodatage de l'instantané survit en petit à côté du titre « À la une »
  (« Mis à jour il y a 12 min »). Il dépend de l'heure : il suit les règles
  d'hydratation (valeur du prérendu, mise à jour au montage — `renderClock.js`).

### 2. Accueil, de haut en bas

1. **À la une** — 6 actualités en grille RTS : une grande (2/3) + deux à
   droite, puis une rangée de trois. Chaque carte : image 16:9, nom de la
   rubrique (abricot), titre, « il y a 2 h · Source ».
   Choix : les **6 plus récentes, une seule par rubrique** (pas une une
   entièrement politique). Seulement les articles **avec image**.
   Téléphone : la grande, puis une liste (titre à gauche, vignette carrée à
   droite).
2. **Culture** — 4 grandes cases (image 3:4, dégradé sombre en bas, rubrique
   Culture + titre). Choix : les **4 derniers articles publiés**. Lien « Tous
   les articles » vers l'index Culture existant. 2×2 sur tablette ; défilement
   au doigt sur téléphone.
3. **La culture en vidéo** — bande de cartes verticales 9:16 (5 visibles sur
   ordinateur, flèches ‹ › ; ~2,2 visibles et défilement au doigt sur
   téléphone). Carte : **image de l'article Culture** (pas la vignette
   YouTube, dont le texte incrusté se superpose au nôtre), titre du Short,
   pastille « ▶ 44 s » (durée tirée de `culture-videos.json`). Ordre : du
   plus récent au plus ancien (`uploadDate`). Source :
   `src/data/culture-videos.json`, langue de la page.
4. Puis le **reste du site, inchangé** : brève (de/it), fil d'actualités par
   source, agenda, réseaux, pied de page. **La section Radio de l'accueil
   est retirée** (la barre permanente la remplace ; `/radio/` reste).

### 3. Page Actualités et pages de rubrique (nouvelles)

- « Actualités » (menu principal) ouvre une page nouvelle dont le sous-menu
  est À la une • Arménie • Politique • Économie • Monde • Société •
  Diaspora • Culture • Sports • Opinion (les 9 `RUBRICS` + « À la une »).
- « À la une » = page d'arrivée : la grille RTS en tête, puis beaucoup plus
  d'articles, toutes rubriques mêlées, du plus récent au plus ancien.
- Chaque rubrique = sa page, même mise en page, filtrée sur la rubrique,
  toutes sources de la langue confondues.
- Une page par (vitrine, langue, rubrique) : 10 × 7 langues. Slugs latins,
  traduits là où le mot change la requête, slash final (règles de `VIEWS`).

### 4. Page résumé d'un article d'actualité (nouvelle)

Un clic sur **n'importe quel** article d'actualité de la langue (une, page
Actualités, pages de rubrique, « À lire aussi », étagères du fil existant)
ouvre une page à nous :
- en tête : titre de la rubrique + barre de rubriques (la courante marquée) ;
- fil d'Ariane « Actualités › Politique », titre, source + date, image
  (créditée à la source) ;
- **résumé de 3 à 4 phrases rédigé par l'IA**, dans la langue de la page,
  suivi de « Résumé rédigé automatiquement à partir de l'article. Seul
  l'article original fait foi. » ;
- bouton **« Lire l'article complet sur <domaine> »** (lien externe vers
  l'URL de la source) ;
- « À lire aussi en <rubrique> » : 3 articles de la même rubrique.
- **Sans résumé** (échec du modèle, source inaccessible) : la page existe
  quand même — titre, image, bouton vers la source. Jamais de texte de
  remplacement inventé.
- **`noindex, follow`** sur ces pages : des résumés d'articles d'autres
  journaux, renouvelés chaque heure, seraient lus par Google comme du
  contenu mince ; la sanction porterait sur le domaine entier. Absentes des
  sitemaps.

### 5. Articles Culture : barre de rubriques

- Les articles Culture (pages statiques existantes, `culture-pages.mjs`)
  reçoivent en tête « Culture » + une barre : Tous les articles • Histoire •
  Patrimoine • Musique • Littérature • Arts • Cinéma • Traditions.
- Chaque article reçoit **une** rubrique Culture (champ à ajouter, p. ex.
  dans `meta.json` de l'article ; les 37 existants classés à la main, les
  futurs brouillons doivent la porter — garde dans `culture-validate.mjs`).
- Chaque entrée de la barre mène à l'index Culture filtré sur la rubrique
  (pages statiques, comme l'index actuel). Les 4 cases de l'accueil
  affichent cette rubrique.

### 6. Lecteur vidéo plein écran (comportement RTS)

- Clic sur une carte → calque plein écran, fond assombri, la page reste
  derrière. Vidéo verticale centrée, lancée d'office ; titre en haut,
  compteur « 6 sur 35 », croix pour fermer ; ‹ › sur les côtés ; rangée de
  repères en bas (un par vidéo, la courante en abricot).
- Clavier : ← → (et ↑ ↓) changent de vidéo, Échap ferme ; focus piégé dans
  le calque et rendu à la carte à la fermeture.
- Téléphone : vidéo plein cadre, **glisser vers le haut / le bas** pour
  changer, repères en haut.
- **Enchaînement automatique** à la fin d'une vidéo vers la suivante.
- Lecteur `youtube-nocookie` (déjà dans `frame-src`), avec
  `referrerpolicy="strict-origin-when-cross-origin"` — sans référent,
  YouTube répond « Erreur 153 » (constaté sur la maquette).
- Si la radio joue, elle est **mise en pause** à l'ouverture d'une vidéo et
  **reprend** à la fermeture (choix : deux sons superposés seraient
  inaudibles).

### 7. Radio permanente et navigation sans rechargement (approche A)

But : lancer la radio puis se promener sur **tout** le site (accueil,
Actualités, résumés, Culture, agenda, jeux, brève) sans coupure, sur
téléphone comme sur ordinateur.

- **Barre radio fixée en bas** de toutes les pages : ▶/⏸, station,
  « EN DIRECT » + égaliseur quand ça joue, « Suivante », « 17 stations »
  (déplie la liste des stations). Repliée par défaut, présente même radio
  éteinte. Respecte les zones sûres (`env(safe-area-inset-bottom)`), cibles
  tactiles ≥ 44 px, ne masque pas le pied de page (marge basse réservée).
- **Navigation sans rechargement** : un clic sur un lien interne du même
  domaine charge la page suivante en arrière-plan et remplace le contenu ;
  la barre radio et son `<audio>` ne sont jamais détruits. Chaque page garde
  sa vraie URL (et son HTML prérendu/statique, inchangé pour Google et les
  partages).
- Doit fonctionner sur **les trois familles de pages** : les vues React
  (accueil, radio, agenda, about, games, Actualités et rubriques), les pages
  statiques (Culture, brève, résumés d'articles) et le passage de l'une à
  l'autre.
- À chaque navigation : `<title>`, métadonnées, `<html lang>` (changement
  de langue compris), défilement en haut (ou vers l'ancre), focus déplacé
  au début du contenu, **une page vue GA4**, bouton Retour / Avancer du
  navigateur fonctionnels (y compris la position de défilement au retour).
- **Repli** : liens externes, téléchargements, Ctrl/⌘-clic, `target`,
  erreurs réseau ou toute anomalie → navigation classique. Le pire cas est
  le comportement d'aujourd'hui (la radio se coupe), jamais une page cassée.
- Les acquis de la radio sont conservés : Media Session (écran verrouillé,
  Android, volant), élément `<audio>` nu sans Web Audio sur iOS, `plain:`
  pour les flux sans CORS, `offAir`.

## Données

- **Résumés IA** : gratuits, via les modèles `:free` d'OpenRouter déjà en
  service, sur le modèle des résumés de l'agenda (`agenda-resumes.mjs`) :
  le scrape récupère le texte de l'article **côté serveur**, le donne au
  modèle, ne **stocke ni ne publie** que le résumé. Cache par URL (un
  article n'est résumé qu'une fois), traitement des seuls nouveaux articles
  à chaque heure, budget par run, garde d'alphabet comme pour la brève
  (hy/ru sans latin parasite). Ligne `git add` du cache dans `hourly.yml`
  (sinon refaits chaque heure, en silence). Le cache n'entre pas dans le
  bundle (chargé par la page résumé seulement, ou cuit dans son HTML).
- **Rubrique** : celle déjà calculée (`rubric` / `RUBRIC_MAP`, classement
  OpenRouter des fils mixtes).

- **Durée de vie d'une page résumé** *(choix de Claude)* : une archive
  légère (titre, URL, image, rubrique, source, date, résumé) garde chaque
  article **30 jours** après sa sortie de l'instantané ; sa page résumé vit
  donc 30 jours, puis disparaît (le 404 existant renvoie vers Actualités).
  L'archive est élaguée à chaque run : le nombre de pages écrites reste
  borné.
- **de / it** *(choix de Claude)* : le résumé est écrit **dans la langue de
  la page** (de/it) à partir de l'article français, avec la mention « Article
  original en français » près du bouton. Même garde d'alphabet que la brève
  de/it.
- **Partage du quota gratuit** *(choix de Claude)* : les résumés passent
  **en dernier** dans le scrape, après classification, brève et résumés
  d'agenda, avec un plafond par run. Mieux vaut des articles sans résumé
  (la page sait s'en passer) qu'une brève ou un classement perdus en
  silence. Signe de panne au log : `✗ résumé-article`, et une ligne dans
  le tableau de bord / `[sources-down]` si la couverture tombe sous un seuil.

## Portée

Les **deux vitrines et les sept langues**. Chaque langue ne montre que ses
sources (`TAB_ORDER`, `CONTENT_LANG`).

Pages Culture filtrées par rubrique *(choix de Claude)* : `noindex, follow`,
absentes des sitemaps ; une rubrique sans article dans une langue
**n'apparaît pas** dans la barre de cette langue.

## Non-buts

- Pas de refonte du fil d'actualités par source, de l'agenda, des réseaux,
  du pied de page.
- Pas de suppression des pages `/radio/`, Culture, brève.
- Pas de nouvelle source, pas de reproduction du texte des articles.
- Pas de mise en ligne avant validation locale par Nareg (`npm run dev` /
  `npm run preview` puis captures ordinateur + téléphone).

## Anti-buts (échec même si « ça marche »)

- La radio qui se coupe en naviguant, ou qui bégaie, sur téléphone.
- Une page dont le HTML prérendu ne s'hydrate plus (React refait la racine
  en silence) — `npm run hydration-check` doit rester propre.
- Des pages résumé indexées, ou des `Event`/JSON-LD là où le contenu n'est
  pas visible.
- Des `hreflang` non réciproques, des URL sans slash final, des pages
  hors sitemap qui devraient y être (rubriques) ou dedans qui ne devraient
  pas (résumés).
- Un texte de résumé présenté comme fiable quand il manque ou s'est trompé
  de langue.

## Approches envisagées

**Navigation / radio**
- **A. Barre radio permanente + navigation sans rechargement** — retenue.
  Seule à tenir « sans accroc partout ». Coût : la pièce la plus technique
  (titres, défilement, GA4, retour, pages statiques + React).
- B. Articles en calque par-dessus l'accueil — la radio se coupe dès qu'on
  quitte l'accueil. Écartée.
- C. Radio dans une fenêtre à part — inutilisable sur téléphone. Écartée.

**Extrait des articles**
- A. Recopier le début de l'article — risque juridique, contenu dupliqué,
  15 extracteurs. Écartée.
- **B. Résumé IA de 3–4 phrases** — retenue (gratuit, OpenRouter `:free`).

**Clic sur une rubrique**
- **A. Une vraie page par rubrique** — retenue (lieu où l'on continue à
  lire).
- B. Retour à l'accueil, onglet ouvert — écartée.

## Contraintes connues (voir CLAUDE.md)

- Ajouter une vue touche sept endroits (`VIEWS`, `VIEW_SEO`, route
  `App.jsx`, composant, `SANS_AGENDA`, pied de page, 404).
- Hydratation : tout ce qui dépend de l'heure/thème/écran part de la valeur
  du prérendu.
- `lightData()` n'embarque que les langues de la vitrine ; ce qui est lu
  par les nouvelles vues doit rester dans ce périmètre.
- CSP : `frame-src` youtube-nocookie déjà là ; images des sources : `img-src
  https:` déjà là. Toute nouvelle origine → les **deux** blocs `headers`.
- `npm run check` vérifie 35 pages : les nouvelles vues et pages s'y
  ajoutent (lang, canonical, hreflang, noindex des résumés).
- Fuseau / `Intl` : dates via les formateurs du contexte i18n uniquement.
- Le chantier se fait dans le worktree `ArmenianNews-accueil-rts`
  (branche `accueil-rts`), un point de retour par tâche.

## Ordre de livraison

Décidé par Nareg (option A) :

1. **D'abord la production des résumés, seule et invisible** : module de
   résumé + archive 30 jours + cache + ligne `git add` dans `hourly.yml`,
   tests compris. Fusionnée et déployée tout de suite : elle remplit le
   cache en arrière-plan. **Aucun changement visible** pour les visiteurs
   (ni page, ni lien, ni texte) — c'est la condition qui autorise cette
   mise en ligne avant validation.
2. **Ensuite l'interface** (en-tête, accueil, Actualités et rubriques,
   pages résumé, rubriques Culture, lecteur vidéo, radio permanente +
   navigation sans rechargement), construite dans le worktree et validée en
   local par Nareg (ordinateur + téléphone, jour + nuit, au moins fr / en /
   hy) avec les vrais résumés déjà produits.
3. Mise en ligne de l'interface **seulement après son feu vert**.

## Laissé au constructeur

- Schéma d'URL des pages résumé (identifiant stable par article) et des
  rubriques Culture.
- Mécanisme exact de la navigation sans rechargement (bibliothèque ou code
  maison), tant que les exigences du §7 tiennent.
- Nombre d'articles par page Actualités / rubrique, pagination.
- Liste fine des rubriques Culture par article (proposée à Nareg pour
  relecture).
