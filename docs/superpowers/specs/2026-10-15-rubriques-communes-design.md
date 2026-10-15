# Rubriques communes — design

Date : 2026-10-15
Statut : validé en conversation (sections 1 à 3), spec à relire.

## But

Remplacer les onglets **par source** du navigateur d'actualités (`NewsBrowser`)
par des onglets **par rubrique**, toutes sources confondues. Le lecteur qui
s'intéresse à l'économie voit d'un coup ce qu'en disent Armenpress, CivilNet et
NEWS.am, ce qu'aucune de ces rédactions ne propose seule : c'est de la valeur
propre au site, sans rien republier.

Hors champ : réécriture ou republication d'articles (écartée), URL propre par
rubrique (levier SEO possible plus tard, mais c'est une nouvelle vue à sept
points de contact), filtre par source à l'intérieur d'une rubrique. La brève
quotidienne est un **sous-projet distinct**, avec sa propre spec.

## Les neuf rubriques

Ordre fixe des onglets, clé → libellé fr :

| Clé | fr | Exemples de rubriques sources |
|---|---|---|
| `armenie` | Arménie | armenpress `armenia`, oragark `armenia`, asbarez-hy `hayastan`, artzakank `armenie-artsakh`, armenieinfotv `armenie`/`artsakh` |
| `politique` | Politique | `politics` (armradio, civilnet, newsam), armenieinfotv `politique`/`geopolitique` |
| `economie` | Économie | `economy`/`economics`/`business` (armenpress, armradio, civilnet, newsam) |
| `monde` | Monde | `world` (armenpress, armradio, civilnet), civilnet `region` |
| `societe` | Société | `society` (armradio, civilnet, newsam), newsam `incidents`/`medicine`, civilnet `human-rights` |
| `diaspora` | Diaspora | asbarez `community`, armenianweekly `diaspora`, oragark `community`, armenews/artzakank `communaute`, armenieinfotv `diaspora`/`france`, asbarez-hy `kaghoutigyanken`/`գաղութներ` |
| `culture` | Culture | `culture`/`arts-culture`/`art-culture`, newsam `style`, armenews `lifestyle` |
| `sports` | Sports | `sports`/`sport` (armenpress, armradio, armenews, asbarez, newsam) |
| `opinion` | Opinion | asbarez `op-ed`/`columns`, armenianweekly `opinion`/`columns`, civilnet `opinion`, California Courier (chronique Sassounian), armenieinfotv `un-autre-regard`, newsam/armradio `analytics` |

La table exhaustive (≈ 75 couples) est écrite à l'implémentation, depuis
l'inventaire de `news.json` ; le test de couverture (plus bas) garantit
qu'aucun couple n'est oublié.

## Section 1 — Données et classement

### `src/rubrics.js` (module plat)

Module JS sans React, comme `src/seo.js` ou `src/newsSources.js`, parce que
Node (tests, scraper) et le bundle doivent lire la même table, et qu'un export
non-composant dans un `.jsx` ferait monter le lint à 6 avertissements.

- `RUBRICS` — les neuf clés, dans l'ordre des onglets.
- `RUBRIC_MAP[sourceId][categoryKey]` — soit une clé de rubrique, soit
  `{ mixed: '<rubrique par défaut>' }` pour un **fil fourre-tout** à classer
  article par article. Fils `mixed` connus : asbarez `top-stories`/`videos`,
  oragark `featured`/`news`/`arachin-hy`/`latest-news-hy`, armenews
  `actualites`/`magazine`, artzakank `divers`, les rubriques du Courrier,
  armenianweekly `news`/`youth`/`special-reports`, californiacourier `mainpost`,
  asbarez-hy `klkhavor-loorer`/`hotvadzner`, armenpress `fact-check`/`projects`,
  civilnet `civilnetcheck`/`democracy-watch`. (La liste définitive est arrêtée
  à l'implémentation, avec le même test de couverture.)
- `rubricOf(sourceId, categoryKey, article)` — `article.rubric` s'il existe et
  est valide, sinon la table, sinon le défaut du fil `mixed`.
- `groupByRubric(sources, lang)` — fonction pure : pour chaque rubrique, une
  étagère par source (ordre de `TAB_ORDER[lang]`), articles fusionnés toutes
  catégories d'origine confondues, dédoublonnés par URL, triés par date
  décroissante (non datés en dernier), plafonnés à **12**. Une étagère vide
  n'est pas rendue ; une rubrique sans étagère non plus.

**Le Courrier** n'a pas de `categoryKey` mais un `sectionKey` : `RUBRIC_MAP`
l'indexe par cette clé, et le regroupement la lit à défaut.

**La table est appliquée au build, pas au scrape** : une correction de
correspondance part en production au prochain push, sans attendre un
instantané (un push sur `main` ne scrape pas).

### Classement des fils `mixed` — `scripts/lib/classify-rubrics.mjs`

Appelé par `scripts/scrape.mjs` après les sources, avant l'écriture de
`news.json`.

1. Rassembler les articles des fils `mixed` dont l'URL n'est pas dans
   `src/data/rubric-cache.json` (`{ url: rubrique }`).
2. **Un seul appel OpenRouter groupé** par instantané (≈ 24/jour, dans le quota
   gratuit) : liste numérotée de titres en entrée, JSON `{ "n": "rubrique" }`
   en sortie. Modèle `:free` configurable (`OPENROUTER_MODEL`, défaut fixé à
   l'implémentation après essai), température 0. Au-delà d'un plafond de titres
   par appel (≈ 80), le reste attend l'instantané suivant.
3. Toute valeur hors des neuf clés est rejetée (l'article prend le défaut).
4. Écrire `rubric` sur chaque article des fils `mixed` dans `news.json`
   (cache ou défaut), et purger du cache les URL qui ont quitté le flux.

**Repli** : pas de clé, quota dépassé, réponse non-JSON, délai dépassé
(20 s) → les articles non classés prennent le défaut de leur fil, une ligne
`✗ classify: <raison>` est écrite au log, **le scrape continue**. Les articles
déjà en cache gardent leur rubrique.

**Secret** : `OPENROUTER_API_KEY` — GitHub Actions (`gh secret set`) et `.env`
local (déjà ignoré par git). **Jamais** dans le dépôt.

Les fonctions pures (prompt, lecture de la réponse, fusion avec le cache,
purge) sont séparées de l'appel réseau pour être testées sans réseau.

## Section 2 — Interface

- **Onglets = rubriques** non vides pour la langue de la page, ordre `RUBRICS`,
  libellés `t('rubric.<clé>')` (clés dans les quatre blocs `STRINGS`). Onglet
  par défaut : `armenie` (repli sur la première rubrique non vide).
- **Panneau** : une étagère (`Carousel`) par source, titre = marque de la
  source. Le point « en direct » d'ArmRadio passe de l'onglet au titre de son
  étagère. `newsfeed__intro` disparaît.
- **Cartes** : `ArticleCard` inchangé ; `catLabel` porte le libellé de la
  **rubrique d'origine** de la source. Les drapeaux d'image (`proxy`,
  `armProxy`, `images`) suivent l'étagère.
- `buildSources` reste la source des étagères (marque, drapeaux, catégories
  par langue) ; `groupByRubric` les recompose. `TAB_ORDER` garde ses deux
  rôles (présence et ordre des sources par langue) ; `lightData()` et
  `test/source-count.test.mjs` ne bougent pas.
- **Mobile ≤ 640 px** : `useSourceDrum` reçoit les clés de rubrique (neuf
  éléments). Règles du tambour inchangées.
- **Grand écran** : rail à deux rangs centrés ; l'écart `clamp(14px, 5vw,
  64px)` est **remesuré** dans les quatre langues à 1400 px.
- **Prérendu** : seul l'onglet actif (Arménie) est cuit, avec les étagères de
  plusieurs sources, toutes dans la langue de la page. URL, `hreflang` et vues
  inchangés.

## Section 3 — Tests, documentation, déploiement

### Tests (sans réseau)

- `test/rubric-map.test.mjs` — tout couple (source, `categoryKey`/`sectionKey`)
  présent dans `news.json` est déclaré dans `RUBRIC_MAP` ; toute valeur est une
  des neuf clés ; tout défaut `mixed` est valide.
- `test/rubric-i18n.test.mjs` — chaque `rubric.<clé>` existe dans les quatre
  `STRINGS` (sinon `t()` rend la clé, cuite dans le HTML prérendu).
- `test/rubric-group.test.mjs` — priorité `article.rubric` > table > défaut ;
  fusion multi-catégories ; dédoublonnage ; tri, non datés en dernier ;
  plafond ; rubrique vide masquée.
- `test/classify-rubrics.test.mjs` — prompt ; lecture de réponse (valide,
  clés inconnues, JSON entouré de texte, tronqué) ; repli ; purge du cache.

### Vérification au-delà des tests

`npm run lint` (5 avertissements), `npm run build` → `npm run prerender` →
`npm run check`, scrape local **avec** puis **sans** clé, contrôle visuel des
quatre langues × deux thèmes × 1400/390 px (skill `verifier-le-rendu`).

### Documentation

CLAUDE.md : remplacer le paragraphe « Les onglets du fil suivent la langue
choisie » par la règle des rubriques (onglets = `RUBRICS`, étagères ordonnées
par `TAB_ORDER`, `RUBRIC_MAP` passage obligé de toute nouvelle rubrique
source) et ajouter le piège du repli silencieux du classeur. Retirer en
contrepartie les passages devenus périmés (badge de langue par onglet,
SEO « Armenpress en tête prérendu »).

### Déploiement

- Secret `OPENROUTER_API_KEY` ajouté par le propriétaire du dépôt ;
  `hourly.yml` le passe à l'étape de scrape.
- Sans la clé, le site fonctionne : table fixe + défauts.
- Chantier dans un worktree isolé, un point de retour par tâche, fusion dans
  `main` après validation.

## Risques connus

- **Repli silencieux** : une clé expirée envoie tous les fils fourre-tout dans
  leur défaut, sans erreur visible hors du log. Signal : `✗ classify`.
- **Classement erroné** par le modèle : borné aux neuf clés, au pire un article
  dans la mauvaise rubrique ; correction manuelle possible en éditant le cache.
- **Rubriques déséquilibrées par langue** (ex. Sports sous `fr` : deux sources) :
  accepté ; une rubrique vide est masquée.
