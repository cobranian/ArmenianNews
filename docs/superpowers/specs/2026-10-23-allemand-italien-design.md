# Allemand et italien sur armenieinfo.ch — conception

Date : 23 octobre 2026. Statut : à approuver.

## Intention

Armenieinfo.ch vise un public suisse. La Suisse a quatre langues nationales, et
le site n'en sert qu'une. On ajoute **`/de/`** et **`/it/`** au .ch, pour que
les lecteurs alémaniques et tessinois trouvent le site dans leur langue, y
compris par Google.

Le problème de fond : **aucune rédaction arménienne n'écrit en allemand ni en
italien** à la taille de celles que le site agrège. Une page allemande faite de
titres étrangers se lit mal et se classe mal. La conception tient donc en une
idée : **sous `/de/` et `/it/`, c'est la brève du jour qui est le contenu dans
la langue**. Le fil d'actualités suit, en langue originale, et il est présenté
comme tel.

## Objectifs

1. Six langues au total : le .ch sert **fr (`/`), de (`/de/`), it (`/it/`)** ;
   le .org reste inchangé (en `/`, hy `/hy/`, ru `/ru/`).
2. Les quatre vues (accueil, radio, agenda, à propos) existent en de et en it :
   24 pages au lieu de 16.
3. Brève quotidienne en de et en it, comme dans les quatre autres langues.
4. Articles Culture traduits en de et en it.
5. Toute l'interface (chrome, i18n, SEO, 404, sélecteur de pays de l'agenda)
   traduite.

## Non-objectifs

- Aucune nouvelle source d'actualité, et aucune traduction automatique des
  titres ou des articles des rédactions. Le contenu reste dans sa langue
  d'origine, comme aujourd'hui.
- Pas de nouvelle carte de partage : de et it gardent `og-image-ch.jpg`, comme
  hy et ru gardent celle du .org (la carte suit la vitrine, pas la langue).
- Pas de nouvelle carte de liens (`pages/lien-de.ch.html`, etc.).
- Pas de domaine propre (armenieinfo.de, etc.).

## Anti-objectifs (ce qui serait un échec même si « ça marche »)

- **Afficher une traduction comme si quelqu'un l'avait relue.** Personne ne
  relit l'allemand ni l'italien. Tout texte de/it rédigé par un modèle doit le
  dire ou en avoir le statut connu (voir Culture).
- **Une page `lang="de"` dont le premier écran n'a rien d'allemand.**
- **Une langue « traduite partout et joignable nulle part »**, ou des
  `hreflang` non réciproques : Google ignorerait le bloc entier sur les
  24 pages.
- **Casser le .org.** Ses pages, son sélecteur et ses données ne doivent changer
  qu'à la marge (deux pastilles de langue de plus et deux `hreflang` de plus).
- **Doubler le poids du bundle du .ch** en y embarquant tout le `news.json`
  anglais.

## Décisions prises avec l'utilisateur

### Fil d'actualités : sources françaises + une partie des anglaises

Sous `/de/` et `/it/`, les rubriques communes montrent :

- les **quatre fils francophones** (ArménieInfo.tv, Courrier d'Erevan,
  Nouvelles d'Arménie, Artzakank), comme sous `fr` ;
- **Armenpress, CivilNet et California Courier**, dans leur **édition
  française** (décision de l'utilisateur). Sous de/it, le fil est donc
  exactement celui de `fr`, sept sources, entièrement en français. Aucune
  édition anglaise n'est embarquée sur le .ch.

La section est marquée **« articles en français »** (« Artikel auf
Französisch » / « Articoli in francese »), une fois par section et pas par
carte. Les étagères portent `lang="fr"` pour les lecteurs d'écran et pour
Google.

**Conséquence technique à respecter** : aujourd'hui `TAB_ORDER[lang]` et
`feedFor(news, id, lang)` lisent le flux **de la langue de la page**. Il faut
une notion de **langue de contenu** : de et it lisent le contenu `fr`
(`TAB_ORDER`, `feedFor`, `selectArticles`, `lightData`). C'est une seule règle,
par exemple `CONTENT_LANG = { de: 'fr', it: 'fr' }` dans `newsLangs.js`, et
non une copie de `TAB_ORDER.fr`, qui finirait par diverger. `lightData()` doit
produire pour le .ch **exactement le même `news.json` allégé qu'aujourd'hui** :
le poids du bundle ne doit pas bouger à cause du fil (seuls les dictionnaires
i18n de/it s'ajoutent).

### Accueil de/it : la brève en tête

Sur `/de/` et `/it/`, le premier écran après le héros présente **la brève du
jour** (titre, chapeau, les premiers sujets, lien vers la page datée), avant le
fil. Sur fr/en/hy/ru, l'accueil ne change pas. La mise en page de ce bloc est
laissée au constructeur, dans l'esthétique « Apricot Press » existante. Il doit
passer le skill `verifier-le-rendu` (mobile compris).

S'il n'y a pas encore de brève ce jour-là (avant 7 h à Erevan, ou modèle en
panne), on affiche la plus récente avec sa date visible. On n'affiche jamais un
bloc vide.

### Brève quotidienne de/it

- Générée par le même pipeline (`scripts/brief.mjs`, `scripts/lib/brief-*`),
  écrite en de/it à partir des articles des sources que de/it affichent (la même
  règle que le fil : `selectArticles` suit `TAB_ORDER`).
- Slugs : *mon choix* `de: 'kurzmeldungen/'`, `it: 'notizie/'`. La règle
  existante s'applique : slug latin, traduit là où le mot change la requête,
  slash final. Le constructeur peut retenir un autre mot s'il est plus
  recherché, à défaut `brief/` comme en/hy/ru.
- Filtre d'alphabet (`brief-script.mjs`) : de et it attendent `Latin`. **Limite
  connue et acceptée** : ce filtre ne détecte pas une phrase française ou
  anglaise glissée dans une brève allemande (même alphabet). Le constructeur
  peut ajouter un contrôle léger s'il est fiable et sans réseau. Ce n'est pas
  exigé.
- Coût accepté : deux appels de plus au modèle par jour.

### Culture de/it

- Traduites depuis le `fr.md` relu, par **le même modèle Gemini et la même
  règle que hy/ru/en** : pas de modèle de secours (une panne retarde, elle ne
  dégrade pas), empreinte `sourceHash` (retoucher le français périme la
  traduction), même contrôle `culture-check`.
- **Une panne de/it ne retient jamais la publication** (*mon choix*). Si la
  traduction de/it échoue (Gemini en panne, recouvrement au-dessus du seuil),
  l'article fr/en/hy/ru est publié et l'article de/it suit plus tard : relance
  automatique au passage suivant, plus un commentaire sur la PR ou l'issue.
  Pendant ce temps, `langHrefsFor` renvoie vers l'index de la section. Une
  langue que personne ne relit ne doit pas retarder un texte relu.
- **Mention visible** sous le titre des pages de/it : « Aus dem Französischen
  übersetzt » / « Tradotto dal francese », avec lien vers l'article français.
  *Mon choix :* ne pas l'ajouter rétroactivement à en/hy/ru (hors périmètre ;
  à rediscuter séparément).
- **Wikipédia de/it** (décision de l'utilisateur, précisée avec Claude) :
  - résolues par les **sitelinks Wikidata** du `qid` du sujet (`dewiki`,
    `itwiki`), jamais par un titre deviné. Même piège des homonymes que
    documenté pour « Kochari » ;
  - **citées comme sources** sur la page de leur langue (« Wikipedia de ») ;
  - leur **titre** est transmis au traducteur comme nom en usage du sujet
    (orthographe allemande ou italienne d'un nom propre) ;
  - leur **texte n'entre pas** dans le brouillon français : celui-ci reste
    rédigé depuis fr/en, et c'est lui qui est relu ;
  - le **contrôle de recouvrement** s'étend aux traductions : la traduction de
    est comparée à l'extrait de dewiki, l'italienne à itwiki, avec le même
    seuil ;
  - **sujet sans page de/it : on publie quand même** la traduction, avec les
    sources fr/en seulement.
- Un article publié avant ce chantier (sans de/it) : *mon choix* : le traduire
  en de/it par un lot unique, avec les mêmes règles. Le lot ouvre **une PR que
  le propriétaire fusionne** ; il ne pousse jamais sur `main` lui-même, comme
  le reste du flux Culture. Les articles existants sont peu nombreux. En attendant, `langHrefsFor` renvoie déjà vers l'index de
  la section, jamais un 404.

### Le reste de l'interface

Interface, Radio, Agenda, À propos, page 404 : traduits intégralement en de et
en it (blocs `STRINGS` complets, `SEO`, `VIEW_SEO`, `OG_LOCALE`, noms de pays de `worldPlace.js`, `radio.genre.*`, etc.). L'agenda
ouvre sur la Suisse, comme en fr. `Intl` rend correctement les dates de/it :
**pas de table écrite en dur** comme `hyDate.js`. En revanche, l'âge des
dépêches (`relativeTime.js`) a des tables en dur pour toutes les langues, à
dessein : il faut **ajouter de et it à ces tables**, et ne pas passer par
`Intl.RelativeTimeFormat` (voir CLAUDE.md).

## Mes choix (Claude), à vérifier en lisant

- **Slugs de vue** : `de` → `radio/`, `veranstaltungen/`, `ueber-uns/` ;
  `it` → `radio/`, `eventi/`, `chi-siamo/`. Culture : `kultur/` et `cultura/`
  (le mot change). Toujours slash final, latin, sans accent (`ueber`, pas
  `über`).
- **Ordre des langues** (`ALL_LANGS`, `LANGS`) : `fr, de, it, en, hy, ru`. Le
  .ch affiche alors « FR DE IT EN ՀԱՅ РУ » (les trois langues nationales
  ensemble) et le .org « EN FR DE IT ՀԱՅ РУ » (`orderLangsFor` met la langue
  du domaine en tête). Libellés `DE`, `IT`.
- **`x-default`** reste l'anglais.
- **Codes de langue `de` et `it`, sans région** (décision de l'utilisateur) :
  `<html lang>`, `hreflang`, sitemaps et `LANGS` utilisent `de` et `it`. Le
  site vise tous les lecteurs germanophones et italophones (Allemagne,
  Autriche, Italie compris), pas seulement la Suisse. Le texte garde
  l'orthographe suisse (`ss`). `og:locale` : `de_DE` / `it_IT`, cohérents avec
  ce ciblage.
- **Marque** : « Arménie Info » sur les trois pages du .ch (le `<title>`, le
  JSON-LD, la carte de partage). Pas de « Armenien Info » ni de « Armenia
  Info » : la marque suit le domaine.
- **Typographie** : de/it utilisent les mêmes familles et les mêmes
  `font-size-adjust` que fr (latin). Les mots composés allemands, longs, sont
  le risque de mise en page. Vérifier titres, pastilles et rail des rubriques
  à 360 px.

## Contraintes et pièges connus (tirés de CLAUDE.md)

- **Les listes de langues à étendre**, dont certaines ne préviennent pas :
  `ALL_LANGS`, `LANGS`, `SITES.ch.pages` (`sites.config.js`), toutes les tables
  de slugs (`VIEWS`, `BRIEF_SLUGS`, `CULTURE_SLUGS`), `LANG_SWITCH_LABEL`,
  `STRINGS` + `LOCALES` (`i18n.jsx`), `SEO` + `OG_LOCALE` + `VIEW_SEO`
  (`seo.js`), `TAB_ORDER` (`newsLangs.js`), `EXPECTED` (`brief-script.mjs`),
  `ENTITY_LANGS` (`culture-sources.mjs`), `PRELOAD` (`site-meta.mjs` : de/it
  préchargent comme fr), `relativeTime.js`, `worldPlace.js`, la page 404
  (`not-found.mjs`), le prompt de traduction Culture.
  **`ARMENPRESS_LANGS` et `CIVILNET_SECTIONS` ne doivent PAS recevoir de/it** :
  ces sources n'ont pas d'édition allemande ou italienne. C'est exactement le
  cas « troisième liste de langues, distincte de LANGS » que documente
  CLAUDE.md. Commenter ce choix là où la liste vit. Un `STRINGS` incomplet
  retombe en silence sur le français : il faut un test qui exige les mêmes clés
  dans les six blocs.
- **`hreflang` réciproques** sur les 24 pages, et les pages datées (brève)
  ne citent que les langues présentes ce jour-là (règle déjà en place).
- **Hydratation** : rien dans de/it ne doit dépendre de l'heure ou de l'écran au
  premier rendu (`npm run hydration-check` sur les 24 pages).
- **Sélecteur de langue sur mobile** : six pastilles au lieu de quatre dans la
  barre de navigation, avec le plancher tactile de 44 px
  (`@media (pointer: coarse)`). Mesurer à 360 et 390 px. Si ça ne tient pas, le
  constructeur choisit une forme repliée, dans l'esthétique existante, et la
  documente.
- **Tests et contrôles** : `npm run check` passe de 16 à 24 pages. Les tests
  qui comptent ou énumèrent des langues (sites-config, views, site-meta,
  sitemaps, not-found, hreflang, radio-count : les textes qui écrivent
  « dix-sept » en toutes lettres doivent exister aussi en de/it) sont à mettre
  à jour, pas à affaiblir.
- **Prérendu** : 24 pages, la garde `lang` + `data-view` s'applique.
- **Firebase** : rien à changer côté cibles. Les `redirects` des slugs jumeaux
  (`firebase.json`, dupliqué sur les deux cibles) doivent couvrir les nouveaux
  slugs, et le .org doit rediriger `/de/` et `/it/` vers le .ch, comme il le
  fait déjà pour `/fr/`.
- **IndexNow / sitemaps** : le sitemap du .ch liste les nouvelles pages.

## Laissé au constructeur

- Découpage en étapes et ordre de livraison. *Suggestion* : (1) l'ossature à
  six langues et l'interface traduite ; (2) le fil de/it et `lightData` ;
  (3) la brève ; (4) le bloc brève de l'accueil ; (5) Culture.
- La forme exacte du bloc brève de l'accueil de/it, et du marqueur « en langue
  originale ».
- La qualité des traductions d'interface : rédigées par Claude, en allemand
  standard suisse (`ss` au lieu de `ß`, comme l'usage suisse) et en italien
  standard.

## Critères de réussite

- `npm test`, `npm run lint` (toujours 5 avertissements connus),
  `npm run build`, `npm run check` (24 pages), `npm run prerender` et
  `npm run hydration-check` passent.
- `/de/` et `/it/` s'affichent en de/it à 360, 390 et 1400 px, jour et nuit,
  avec la brève visible sur le premier écran mobile après le héros.
- Le .org s'affiche comme avant, à deux pastilles de langue près.
- Le `news.json` allégé du .ch est identique à celui d'avant ce chantier. Le
  bundle ne grossit que des dictionnaires i18n de/it.
