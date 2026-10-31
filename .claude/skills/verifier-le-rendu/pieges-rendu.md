# Pièges de rendu (déplacés de CLAUDE.md)

Le détail du CSS et des composants de rendu. Chaque point a été mesuré ; aucun
ne fait tomber un test, un lint ou un build. Lire avant de toucher
`src/styles/global.css` ou un composant visuel, en plus de `SKILL.md`.

**Une convention du fichier à ne pas casser : chaque `font-family:
var(--font-X)` est immédiatement suivie de son `font-size-adjust:
var(--fsa-X)`** — 31 paires pour le display, 57 pour l'utilitaire, 13 pour le
corps. C'est ce qui donne aux sept langues la même taille *vue* alors que
chaque écriture a sa propre hauteur d'œil (le russe rendait 7 % plus gros, les
titres arméniens et russes 4,3 %). Le raisonnement complet, les mesures et les
deux pièges — la métrique *déclarée* des Noto arméniens est leur métrique
**latine**, et l'arménien demande deux corrections opposées selon le rôle —
sont dans le grand commentaire du fichier, à la définition des jetons `--fsa-*`.

Trois conséquences pratiques. **Une nouvelle règle qui pose une famille sans
son réglage** héritera de celui d'un autre rôle et changera de taille sous une
seule langue, en silence. **`.hero__title` et `.nav__brand` portent la
référence latine en dur** et non le jeton, parce qu'ils ne composent que le nom
de la marque : la valeur est écrite sur place car les deux sélecteurs sont
redéfinis plus bas, où une règle groupée se ferait écraser à spécificité égale.
Et **ne mesurez jamais une hauteur de capitale sur un rendu de 11px** : le
rasteur y arrondit et exagère l'écart — c'est ce qui avait produit une
sur-correction de 6 % sur la pastille arménienne.

**Les polices sont auto-hébergées, et ce sont les fichiers mêmes de Google
Fonts.** `public/fonts/` (62 woff2, 1,5 Mo, découpés par `unicode-range`
comme Google les servait), `src/styles/fonts.css` (107 `@font-face`, importé
en tête de `global.css`) et le manifeste `src/styles/fonts.json` sont tous
trois **écrits par `npm run fonts-sync`** (`scripts/fonts-sync.mjs`) — ne les
éditez pas à la main, et ne remettez pas de `<link>` `fonts.googleapis.com`
dans `index.html` : ajoutez la famille à `FONTS_CSS2` et relancez. La feuille
Google était une ressource bloquante cross-origin — ~800 ms sur le premier
rendu mobile (Lighthouse, 21 août 2026), 1,7 s avant le premier pixel même
JavaScript désactivé. Les glyphes n'ont pas bougé d'un pixel (captures
avant/après sur fr/en/hy/ru, 1400 et 390 px). `site-meta.mjs` **précharge par
langue** les 2 à 4 fichiers du premier écran (table `PRELOAD` : Fraunces
italique + romain et Hanken sous fr/en, les deux Noto arméniennes sous hy,
Fraunces italique + Literata + Golos sous ru) ; une entrée absente du
manifeste fait échouer le build. `firebase.json` met `fonts/**` en cache
immuable — **sur les deux cibles**, comme `headers`. `test/fonts.test.mjs`
garde la cohérence des trois artefacts et l'absence de Google dans
`index.html`. Les pages autonomes (`pages/lien*.html`) et `og-image.mjs`, eux,
chargent encore Google Fonts : ce sont des HTML hors bundle, rarement servis.

**`.hero__title` part de `opacity: 0.02`, pas de 0 — ne le « nettoyez »
pas.** Chrome ignore pour le LCP tout élément peint à opacité 0 : à 0, le
titre — le plus grand texte du premier écran — ne devenait candidat qu'au
début de son fondu, et le LCP se re-déclenchait 650 ms après le premier
rendu (mesuré 1,77 s → 2,42 s). À 0.02 il est invisible à l'œil mais compté
dès le premier paint (mesuré après : un seul candidat, `hero__title`, au même
instant que le FCP). Les autres éléments du héros gardent leur `rise` depuis 0.

**Les deux tambours (mobile, ≤640px).** `src/components/useSourceDrum.js` est un
hook générique : il pose sur des éléments l'angle (`--a`) et l'opacité (`--o`)
qui les répartissent sur un **cylindre tournant à 360°, qui boucle** — après le
dernier revient le premier, dans les deux sens. Deux appelants s'en servent :

| Appelant | Ce qui tourne | État replié / déplié |
|---|---|---|
| `NewsBrowser.jsx` | jusqu'à 9 rubriques (une vide est masquée) | — |
| `Radio.jsx` | les 17 stations | déplié = grille à plat, la roue s'éteint (`enabled: false`) |

Cinq choses à savoir avant d'y toucher, toutes payées une fois :

- **L'aimantation native ne peut pas boucler.** `scroll-snap` vit sur un
  défileur, et un défileur a un début et une fin. Les contournements connus
  triplent la liste dans le DOM — inacceptable ici, puisque ce sont les mêmes
  `<button role="tab">` qui servent de rail horizontal sur large écran et que
  `npm run prerender` cuit dans les 28 pages. La roue est donc pilotée à la
  main sur les éléments réels.
- **Le repli sans JavaScript est porté par le CSS.** C'est le hook qui pose la
  classe `is-drum` ; son **absence** déclenche le repli (une liste plate,
  défilante). Ne déplacez pas `is-drum` dans le rendu React : elle mentirait si
  le hook ne tournait pas.
- **`flex-wrap: nowrap` est obligatoire dans le bloc du tambour.** La règle de
  base enveloppe (voir le rail à deux rangs ci-dessous) et une colonne de
  hauteur fixe qui enveloppe part **en colonnes** : les rangs au-delà du
  troisième sortiraient sur le côté et le repli perdrait la moitié des sources.
- **Pas de `setPointerCapture`.** La capture réoriente le `click` de
  compatibilité vers l'élément capturant : le `onClick` des boutons ne partirait
  plus. On écoute `pointermove` / `pointerup` sur `window`.
- **`touch-action: none` vit sur les RANGS, pas sur la piste**, et les rangs sont
  en `width: fit-content` centré. Sur la piste entière, un pouce posé là — un
  endroit naturel, juste au-dessus des carrousels — faisait tourner la roue au
  lieu de faire défiler la page, et changeait de source sans qu'on le demande.
  `useSourceDrum` ignore en outre tout `pointerdown` dont la cible **est** la
  piste, sans quoi le navigateur panoramiquerait pendant que la roue tourne.
  Mesuré : 44,9 % de la surface confisque encore le geste, contre 100 % avant.

**Le rail des rubriques sur grand écran : deux rangs centrés, pas une ligne.**
Le conteneur est plafonné par `--maxw`, donc le rail ne s'élargit pas au-delà :
les neuf rubriques ne tiennent pas sur une ligne, **à toute largeur d'écran**.
La règle d'avant promettait « centrées quand elles tiennent, défilantes sinon » —
le premier cas ne se produisait jamais, et on payait 14px de barre de défilement
système au milieu d'une manchette. `column-gap: clamp(14px, 5vw, 64px)` est
**mesuré, pas choisi** : c'est l'écart qui place la césure, et les langues
n'ont pas les mêmes libellés — mesuré à 1400px le 15 octobre 2026 : fr 7+2,
en 7+2, hy 5+4, ru 6+2 (huit rubriques : l'une est vide). Le découpage **suit le
nombre de rubriques affichées par langue**, pas les sources : une mesure à
refaire quand une rubrique s'ajoute ou se vide, pas une constante. Et le coefficient est **5**vw, pas 4 :
à 4vw le terme médian vaut 56px sur un écran de 1400px, donc le plafond n'est
jamais atteint.

**Les dix-sept stations sont dépliables (mobile).** `.radio__stations` porte déjà
`flex-wrap: wrap` en règle de base ; le bloc `≤640px` le force en `nowrap` +
`overflow-x`, ce qui ne montrait que deux stations sur dix-sept sans le moindre
indice. La bascule rend simplement atteignable la mise en page que le site sert
déjà partout ailleurs. **Le nombre vient de `STATIONS.length` et entre par un
gabarit `{n}`** dans la chaîne i18n — jamais écrit à la main, pour deux raisons :
`test/radio-count.test.mjs` garde déjà quatorze textes qui écrivent le compte en
toutes lettres, et « Voir les 12 stations » / « Показать все 12 радиостанций » /
« Տեսնել 12 ռադիոկայանները » ne placent pas le chiffre au même endroit.

## Pièges vus en production

- **L'Ararat de la marque se regarde DEPUIS L'ARMÉNIE : Masis, le plus haut, à
  DROITE.** Ce n'est pas un choix graphique. Sis est à l'**est** de Masis ;
  Erevan regarde vers le sud, et face au sud l'est tombe à gauche — donc Masis
  se dresse à droite. L'arrangement inverse est la vue depuis le versant turc.
  Le site l'a porté à l'envers jusqu'au 1er août 2026, et **rien ne pouvait le
  dire** : un tracé miroir est un SVG parfaitement valide. Il a fallu un
  lecteur.

  Le piège pratique est ailleurs : **le glyphe est recopié dans cinq fichiers**
  — `public/favicon.svg` (la source, qui porte le raisonnement en commentaire),
  les trois `pages/lien*.html`, et la constante `ARARAT` de
  `scripts/og-image.mjs`. Aucun test ne les compare. Le miroir s'obtient par
  `x′ = 64 − x` sur le `viewBox` (les deux facettes de neige du favicon
  suivent) ; le fond arrondi et la barre basse étant symétriques, **retourner
  l'image entière** suffit pour les favicons matriciels — ce qui préserve
  couleurs et anticrénelage, là où un nouveau rendu les changerait.

  Les deux cartes de partage ont suivi le 1er août 2026, et **c'est la
  première fois que le `.ch` sort de `og-image.mjs`** — sa carte lui était
  antérieure. Le piège s'est refermé aussitôt : le gabarit ne savait pas rendre
  la marque en écriture arménienne que l'ancienne carte portait sous le titre
  latin, donc la première régénération l'a **effacée en silence**. Un JPEG
  valide, 1200×630, sans ICC, sous les 600 ko — tous les contrôles au vert, une
  ligne en moins. D'où `subbrand` dans `CARDS`. **Avant de régénérer une carte,
  ouvrez l'ancienne à côté** : ce script ne rend que ce qu'on lui a appris.

- **Un titre d'étagère ne doit jamais élargir la page.** `.shelf__title` porte
  `min-width: 0`, et ce n'est pas décoratif : c'est la valeur par défaut
  `min-width: auto` d'un élément flex qui l'empêchait de descendre sous la
  largeur intrinsèque de son contenu. Dans l'agenda, ce contenu est un
  `<select>` que le navigateur dimensionne sur son option **la plus longue**
  (« Émirats arabes unis »), jamais sur celle qui est choisie : à 360px la tête
  réclamait 360px dans une boîte de 308.

  **Le symptôme était à l'autre bout du site.** La page devenait défilable
  horizontalement, et `body::before` — la texture, en `position: fixed;
  inset: 0` — ne couvre que la **fenêtre**, pas le document : en défilant sur le
  côté, la bande excédentaire apparaissait sans texture ni fond de section, ce
  qui se lit comme une bordure claire au bord de l'écran. La tentation est
  `html { overflow-x: hidden }` : elle masquerait ce défaut **et tous les
  prochains** sans qu'aucune mesure ne les voie.
- **`scrollIntoView` fait défiler TOUS les ancêtres défilables, document
  compris.** `block: 'nearest'` n'est inerte que si l'élément est **déjà**
  visible — jamais au montage, puisque la console est sous le pli. Combiné à
  `html { scroll-behavior: smooth }`, un appel dans un effet faisait glisser la
  page par-dessus le héros à chaque chargement : mesuré, `scrollY` 0 → 485px en
  une seconde, sur les douze pages. Pour recentrer un élément dans un défileur,
  **écrivez `scrollLeft` / `scrollTop` sur ce défileur** : par construction, cela
  ne peut bouger que lui.
- **`visibility: hidden` retire de l'arbre d'accessibilité, `opacity: 0` non.**
  Le tambour masquait ainsi deux onglets sur sept : le `focus()` du
  roving-tabindex échouait en silence, puis le bouton qui portait le focus
  passait à son tour derrière le cylindre et le focus tombait sur `<body>`. La
  navigation clavier mourait. Si vous devez cacher un élément **focusable** sans
  le sortir du parcours, l'opacité est le bon outil.
- **`loading="lazy"` doit être déclaré AVANT `src`, et le défaut ne se voit
  QUE sur une page prérendue.** L'analyseur HTML décide du chargement différé au
  moment où `src` est posé ; `loading` lu après n'a plus d'effet. L'ordre du JSX
  se retrouve tel quel dans le HTML que cuit `npm run prerender` — celui que
  reçoivent les lecteurs et les robots.

  Mesuré en production le 5 août 2026, avant correction : **189 images
  téléchargées au chargement, 11,59 Mo**, pour un premier écran qui n'en montre
  **aucune** (page de 9 724 px, fenêtre de 915, première image à 2 075 px).
  Après, en production : **4 à 8 images, 0,17 à 0,36 Mo** sur trois passages.
  L'écart entre les passages n'est pas du bruit de mesure — c'est le seuil de
  Chrome qui suit la connexion estimée, et c'est la raison pour laquelle un
  chiffre unique ne décrit pas cette page.

  **Ce qui rend ce piège vicieux, c'est qu'il disparaît du banc le plus naturel
  pour le chercher.** Sur `npm run dev`, ou sur un `npm run preview` qui n'a pas
  été prérendu, la racine React est vide, tout monte côté client, et le différé
  **fonctionne** — 4 images, comme si de rien n'était. Une mesure prise là
  « prouve » l'absence du bug. Toute vérification du chargement différé exige
  donc `npm run build` **puis** `npm run prerender`, et le contrôle qui le
  prouve : `grep -c '<div id="root"></div>' dist/ch/index.html` doit valoir 0.

  Deux conséquences. `test/img-lazy.test.mjs` est le seul garde — il lit les
  composants **comme du texte** (Node ne sait pas importer du JSX) et ne porte
  que sur les `<img>` qui se déclarent différées, celle de la visionneuse devant
  charger tout de suite. Et le seuil de déclenchement de Chrome **dépend de la
  connexion estimée** : une mesure sur `localhost` est la plus flatteuse
  possible, elle doit être reconfirmée en production.

- **Le plancher tactile de 44px est déjà tenu — par `@media (pointer: coarse)`.**
  Ce bloc agrandit `.theme-toggle`, `.nav__toggle`, les pastilles de langue,
  `.lang-fold__toggle`, `.shelf__arrow`, `.radio__chip`, `.ig-chip` et
  `.radio__stations-toggle`. **Un audit mené dans un Chrome de bureau ne le voit
  pas** et rapportera une dizaine de fausses cibles trop petites : simulez le
  bloc à la main avant de conclure. Et le rembourrage seul ne suffit pas — la
  hauteur de ligne dépend de l'écriture, d'où le `min-height: 44px` explicite de
  la bascule des stations, qui tombait à 43px en arménien.
