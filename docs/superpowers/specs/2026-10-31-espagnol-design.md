# L'espagnol, septième langue — conception

*31 octobre 2026*

## Intention

Ouvrir **armenianews.org/es/** à la diaspora arménienne d'Argentine et
d'Amérique latine. Le .org passe de trois langues (en, hy, ru) à quatre, le
site de six à sept, et de 24 à 28 pages (7 × 4 vues).

Le pourquoi : la communauté arménienne d'Argentine est l'une des plus grandes
de la diaspora, elle a sa presse en espagnol, et aucune vitrine ne l'agrège
avec l'actualité d'Erevan. Armenpress publiant une édition espagnole, la page
`/es/` peut offrir ce que les autres langues offrent : Erevan et la diaspora
côte à côte, dans la langue du lecteur.

## Décisions de l'utilisateur

- **Vitrine** : le .org, à `/es/`.
- **Tout en espagnol dès le lancement** : interface, les quatre vues (accueil,
  radio, agenda, à propos), brève du jour, résumés de l'agenda, traductions
  Culture, page 404, SEO. Les deux seules exceptions sont ci-dessous et ont
  été décidées par l'utilisateur.
- **Réseaux sociaux : après le lancement.** Les comptes espagnols (Facebook,
  Instagram, Bluesky, Telegram) seront créés par l'utilisateur plus tard ; ce
  chantier ne touche pas `scripts/lib/social.mjs`.
- **Culture : l'espagnol est FACULTATIF**, au régime de/it (`OPTIONAL` dans
  `culture-validate.mjs`) : traduit, non relu, ne bloque jamais une
  publication.
- **Agenda : les événements de Diario Armenia entrent dès le lancement.**
- **Nor Sevan** : ses billets en arménien vont sur `/hy/`, pas `/es/` ; ses
  billets argentins sans lien avec l'Arménie **restent** (ligne du journal).
- **Registre : espagnol latino-américain neutre** (ustedes, pas de voseo, pas
  de vocabulaire propre à Buenos Aires).

## Sources du fil `es` (mesurées le 31 oct. 2026)

| Source | Comment | Rythme | Pièges mesurés |
|---|---|---|---|
| **Armenpress** `/es` | module existant, `ARMENPRESS_LANGS` + `'es'` | 11-15/jour, **rien le week-end** | même payload Inertia, mêmes 7 rubriques (`RUBRIC_MAP.armenpress` couvre tout), titres longs |
| **Soy Armenio** (soyarmenio.com) | WordPress REST | ~12/jour | Cloudflare : jamais testé depuis une IP de CI ; `_embed` = 2,4 Mo pour 20 posts (alléger) ; réécrit en partie Armenpress |
| **Diario Armenia** (diarioarmenia.org.ar) | WordPress REST | ~3/jour | **anti-hotlink muet** : Referer étranger → 200 + vignette 200×200 ; 57 catégories dont des étiquettes de mise en page (`Slider`, `Destacado1`) ; catégorie `Agenda` mêlée au fil |
| **Nor Sevan** (norsevan.com) | Wix — **RSS seul** (`/blog-feed.xml`) | 1-2/jour | billets en arménien occidental ; `lastmod` du sitemap = date d'édition ; image du flux ~540 Ko (retirer `/v1/fit/…`) |

Les études brutes (scripts d'essai, vignette de remplacement) sont dans le
dossier scratch de la séance ; les chiffres ci-dessus suffisent à construire.

## Ce qui se construit

### 1. La langue elle-même
Ajouter `es` partout où une langue s'énumère. L'inventaire complet (~60
endroits, classés « bruyant » / « silencieux ») a été dressé ; les points
**silencieux** sont ceux qui comptent, car aucun test ne les signale :

- `LOCALES` (`i18n.jsx`), `LOCALE` (`brief-links.mjs`), `LOCALES`
  (`agenda-pays.mjs`) — sinon dates dans la langue de la machine.
- `LANG_NAME` (`brief-generate.mjs`, `culture-prompts.mjs`), `LANG_NAMES`
  (`agenda-resumes.mjs`) — sinon « Écris en undefined ».
- `PLACES[*].es` (`worldPlace.js`) — sinon lieux d'agenda en français ; et
  `test/place-label.test.mjs` a sa propre liste de langues à étendre.
- `ENTITY_LANGS` (`culture-sources.mjs`) — Wikipédia espagnol.
- `firebase.json` : `/es/` du .ch → .org (miroir des règles de/it), sondes de
  production `/es/` dans `hourly.yml`, `articles-merged.yml` (liste en dur).
- Textes publics qui écrivent « six langues » : cartes `pages/lien*.html`,
  `cultureStrings.js`.
- Comptes en dur dans les tests (24 → 28, 6 → 7) : liste dans l'inventaire.

Slugs (choix du concepteur, règle existante : latin, traduit là où le mot
change la requête) : `/es/`, `/es/radio/`, `/es/eventos/`, `/es/acerca-de/`,
brève `/es/resumen/`, Culture `/es/cultura/`. `LANGS` : `{ code: 'es',
label: 'ES', name: 'Español' }`. `OG_LOCALE` : `es_419` (Amérique latine)
plutôt que `es_ES`. Polices : rien à faire (le bloc `latin` couvre ñ ¿ ¡ á) ;
`PRELOAD.es = PRELOAD.fr`.

**Pas de `CONTENT_LANG.es`** : contrairement à de/it, `es` a son propre fil.

### 2. Les sources
Un module par source dans `scripts/sources/` (lire d'abord le skill
`toucher-une-source`), `TAB_ORDER.es`, entrées `RUBRIC_MAP` dans le même
commit, `STALE_HOURS` par source (`scripts/lib/health.mjs`) — **Armenpress
es à 96 h** (week-ends sans publication ; 72 h déclencherait une fausse
alerte le lundi).

- **Diario Armenia** : images **recopiées localement** comme California
  Courier (la protection anti-hotlink rend une vignette en 200, sans erreur) ;
  catégorie `Agenda` exclue du fil ; table de catégories → rubriques avec un
  défaut, étiquettes de mise en page ignorées.
- **Nor Sevan** : date par `pubDate` du RSS ; billet majoritairement en
  écriture arménienne → fil `hy` ; sinon `es`.
- **Soy Armenio** : requête allégée (`_fields`), pas `_embed` complet.
  **Décision utilisateur** : si la CI reçoit un 403 Cloudflare, on passe
  par un relais Worker, sur le modèle d'Asbarez (`ASBAREZ_PROXY`) — on ne
  renonce pas à la source. Essayer d'abord en direct ; le relais seulement
  si le premier run CI le prouve nécessaire.

### 3. L'agenda : Diario Armenia
Les annonces de la catégorie `Agenda` deviennent des événements, rangés sous
`argentina` par `worldCountryKey`. La date n'est que dans le texte. **Règle
non négociable du dépôt** : un champ non trouvé est absent ; un événement
sans date sûre est **écarté** (`evenementComplet`), jamais deviné. Les dates
se stockent en heure murale sans fuseau (`2026-11-08T19:00`), comme
Armenopole. L'agenda étant commun aux sept langues, ces événements
paraissent aussi sur le .ch — c'est voulu (l'agenda est « le monde d'abord »).

*Choix du concepteur* — **pays** : le module pose `country: 'argentina'`
(la rubrique Agenda de Diario Armenia est l'agenda de la communauté
argentine : c'est une déduction de la source, pas une devinette) ; `location`
ne garde un lieu que s'il se résout dans `PLACE_TO_COUNTRY` vers un AUTRE
pays (Uruguay, Brésil…), sinon il reste vide, pour ne pas créer une clé
« Palermo » orpheline dans le menu. **Page pays** : si l'Argentine franchit
`PAYS_PAGE_MIN`, sa page `/agenda/…` naît d'elle-même dans les sept langues,
comme les autres — c'est le mécanisme existant, on le laisse faire ; compter
avec la croissance des sitemaps et des contrôles de `check`.

### 4. Brève, résumés, Culture
- **Brève es** : générée depuis le fil `es` (Armenpress es + trois sources).
  Garde d'alphabet : `es` attend du latin ; marqueurs pour détecter un sujet
  écrit en anglais ou en français à la place de l'espagnol — **ne pas
  réutiliser `COMMON`** (`que`, `entre` sont aussi espagnols).
- *Choix du concepteur* — **doublons Soy Armenio / Armenpress** : pas de
  dédoublonnage entre sources dans le fil (chaque source a son étagère,
  comme sur `/` où Armenpress et Asbarez couvrent déjà les mêmes faits) ; la
  consigne de la brève demande de **fusionner en un sujet** deux articles
  qui racontent le même fait, pour que la brève ne le dise pas deux fois.
- **Résumés d'agenda** : `es` dans `LANG_NAMES`, fichier
  `src/data/agenda-resumes/es.json`. Ajouter `es` marque tout le cache
  incomplet : prévoir le rattrapage progressif, pas une rafale de requêtes.
- **Culture** : `es` dans `OPTIONAL`, les ~19 articles existants restent
  valides ; traduction espagnole rattrapée par `articles-backfill`.
- Toutes les consignes aux modèles précisent **espagnol latino-américain
  neutre**.

### 5. Lettre hebdomadaire
Le code suit les autres langues (`newsletter.lists.es`), **mais le nom de
liste ne s'écrit qu'une fois le compte Buttondown créé** (`contact+es@`,
secret `BUTTONDOWN_API_KEY_ES`) : un nom deviné publierait un formulaire qui
inscrit chez un inconnu. Jusque-là, `/es/` n'affiche pas de formulaire.
Action utilisateur, comme les réseaux.

### 6. Le sélecteur de langue
Passe à 7 langues sur le .org (« EN ES ՀԱՅ РУ … » selon `orderLangsFor`).
Vérifier le rendu mobile (skill `verifier-le-rendu`) : le sélecteur à six
langues avait déjà demandé du CSS (commit `d09f930d`).

## Objectifs / non-objectifs / anti-objectifs

- **Objectif** : `/es/` et ses trois vues en ligne, fil vivant à quatre
  sources, brève quotidienne en espagnol, événements argentins dans l'agenda.
- **Non-objectifs** : réseaux sociaux espagnols ; radio en espagnol (aucune
  des sources n'a de flux) ; aucun travail propre à une page agenda Argentine (elle naît ou non du
  mécanisme existant).
- **Anti-objectifs** (échec même si « ça marche ») : une chaîne `undefined`
  ou une date en anglais sur `/es/` ; un événement à date inventée ; des
  images Diario Armenia remplacées par la vignette ; un hreflang non
  réciproque sur les 28 pages ; du contenu arménien ou anglais dans le fil
  `es` ; une fausse alerte `[sources-down]` chaque lundi.

## Laissé au concepteur
L'ordre de `TAB_ORDER.es`, les tables catégories → rubriques, la méthode
d'extraction des dates d'agenda (expression régulière ou modèle, tant que la
règle « absent plutôt que deviné » tient), le seuil exact de détection de
l'arménien chez Nor Sevan, les seuils `STALE_HOURS` des trois nouvelles
sources (à mesurer sur leur rythme), le découpage en PR.
