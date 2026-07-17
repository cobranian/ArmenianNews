# Ajout de la langue russe (RU) — spec de conception

**Date** : 2026-07-17
**Statut** : approuvé pour implémentation (étape 1)

## Objectif

Ajouter le **russe** comme 4ᵉ langue d'interface d'Arménie Info
(`fr / en / hy → fr / en / hy / ru`), alimenté par l'édition russe d'Armenpress
(`armenpress.am/ru`). L'édition russe d'ArmRadio (`ru.armradio.am`) est prévue
comme **étape 2 séparée** (voir « Suite »), car elle est bloquée par Cloudflare
et dépend d'une mise à jour du Cloudflare Worker.

## Faisabilité vérifiée (2026-07-17, appels en direct)

- **Armenpress `/ru` — ajout propre.** Les 7 rubriques
  (`armenia, economy, world, culture, sports, fact-check, projects`) renvoient la
  **structure Inertia identique** à fr/en/hy : `props.data.data.hits`, 27–36
  articles datés et illustrés par rubrique, `locale: "ru"`, URLs d'article en
  `/ru/article/{id}`. Aucune réécriture du module — seulement `'ru'` dans le
  tableau des langues et les libellés de rubriques en russe.
- **`ru.armradio.am` — bloqué.** Son API REST `/wp-json` renvoie
  `403 "Just a moment…"` (challenge Cloudflare), comme en/hy. En production, en/hy
  ne passent qu'à travers le **Cloudflare Worker `ARMRADIO_PROXY`**. Le russe
  exigerait donc une mise à jour + redéploiement du Worker, puis la lecture de ses
  IDs de rubriques russes *à travers* ce Worker. Reporté à l'étape 2.

## Décisions (validées avec l'utilisateur)

1. **Armenpress d'abord, ArmRadio en suivi.** On livre Armenpress ru maintenant
   (entièrement vérifiable). ArmRadio ru = étape 2, une fois le Worker mis à jour.
2. **Pas de réordonnancement.** L'interface RU se comporte **exactement comme HY** :
   Courrier d'Erevan reste le premier onglet, toutes les sources restent visibles,
   et le **contenu reste dans sa langue d'origine** (Armenpress en russe, Courrier
   en français, ArmRadio en anglais). Seul le *chrome* de l'interface est traduit.
   Le prérendu reste français (headless sans `localStorage`), donc l'ordre des
   onglets n'a aucun impact SEO de toute façon.

## Modifications (étape 1)

### 1. `src/i18n.jsx`
- `LANGS` : ajouter `{ code: 'ru', label: 'РУ', name: 'Русский' }` en fin de liste
  (après `hy`).
- `LOCALES` : ajouter `ru: 'ru-RU'` (formatage des dates via
  `toLocaleDateString`).
- `STRINGS` : ajouter un bloc `ru: { … }` **complet**, miroir des ~90 clés des
  autres langues, **toutes traduites en russe**. Rien ne doit retomber sur le
  français : `t()` a un repli `STRINGS.fr[key]`, acceptable comme filet mais pas
  comme rendu pour un lecteur russe.
  - Les libellés `apcats.*` (rubriques Armenpress) doivent reprendre **les noms
    que l'édition russe d'Armenpress emploie** : Армения, Экономика, Мир,
    Культура, Спорт, Проверка фактов, Эксклюзивные проекты.
  - Les autres familles de clés (`armcats.*`, `namcats.*`, `azkcats.*`,
    `aitcats.*`, `sections.*`, `radio.st.*`, etc.) sont traduites en russe même
    si la source correspondante n'a pas d'édition russe : ces libellés décorent
    des onglets/badges vus par un lecteur russe.

### 2. `scripts/sources/armenpress.mjs`
- `export const ARMENPRESS_LANGS = ['fr', 'en', 'hy', 'ru']`.
- Mettre à jour les commentaires d'en-tête : la source n'est plus « trilingue »
  mais **quadrilingue** (fr/en/hy/ru), 7 rubriques × 4 langues = **28 pages** par
  snapshot. Le garde-fou `got !== lang` (sert du contenu de la mauvaise langue →
  échoue la rubrique) et le constructeur d'URL gèrent `ru` sans changement.

### 3. `scripts/scrape.mjs`
- Graine : `let apLangs = { fr: [], en: [], hy: [], ru: [] }`.
- Boucle de backfill : `for (const lang of ['fr', 'en', 'hy', 'ru'])`.
- Mettre à jour le commentaire « 7 rubriques x trois langues = 21 pages » → quatre
  langues = 28 pages.

### 4. Données — régénérer et committer
- Lancer `npm run scrape` pour que `news.json` contienne le bloc
  `armenpress.ru` (7 rubriques peuplées) et committer les données. Sans cela,
  `buildSources` fait `news.armenpress?.['ru'] || []` → source vide → onglet
  Armenpress absent en interface RU jusqu'au premier job horaire. Committer une
  neige fraîche fait fonctionner le russe dès le déploiement.

## Explicitement inchangé

- **`src/components/NewsBrowser.jsx`** — `buildSources` indexe déjà Armenpress par
  `lang`, donc `ru` marche dès que la donnée existe. `armLang = lang === 'hy' ?
  'hy' : 'en'` résout `ru → 'en'` : ArmRadio sert de l'anglais sous l'interface RU,
  cohérent avec « le contenu reste dans sa langue ». (Le seul commentaire « la
  seule source trilingue » peut être mis à jour en « quadrilingue » — cosmétique.)
- **`src/components/Nav.jsx`** — rend `LANGS.map(...)`, donc la puce `РУ` apparaît
  automatiquement.
- **`firebase.json` (CSP)** — les images Armenpress viennent de l'hôte
  `armenpress.am`, déjà autorisé (les cartes fr/en/hy chargent déjà leurs images
  depuis cet hôte). Aucun nouvel hôte média → pas de changement CSP.
- **CSS** — `.lang` est un `inline-flex` ; une 4ᵉ puce s'insère sans règle
  dédiée. Aucun `repeat(3)` ni hypothèse « 3 langues » dans la base.

## Vérification

1. `npm run scrape` → `news.json` contient `armenpress.ru` avec 7 rubriques non
   vides (`locale ru`).
2. `npm run dev` → basculer sur **РУ** : chrome en russe (nav, titres de sections,
   pied de page, radio) ; onglet Armenpress affiche des articles russes avec des
   libellés de rubriques russes ; Courrier reste en français ; dates formatées
   `ru-RU`.
3. `npm run build && npm run prerender` → le HTML prérendu reste **français**
   (`<html lang="fr">`, Courrier en premier) — inchangé.
4. `npm run lint` → **0 erreur, 6 avertissements connus** (inchangé).
5. Capture mobile de la barre de nav : confirmer que 4 puces + bascule thème +
   hamburger tiennent sur petit écran (≤ 360px). Ajuster le padding `.lang button`
   mobile seulement si ça déborde.

## Suite — étape 2 (ArmRadio ru, non incluse ici)

Prérequis hors-code : **mettre à jour et redéployer le Cloudflare Worker**
(`proxy/armradio-worker.js`) pour router `lang=ru → ru.armradio.am`. Puis :

1. Lire les IDs de rubriques russes *à travers le Worker* (le site russe nomme ses
   catégories en russe, comme le site arménien) et les figer dans un
   `RU_CATEGORY_IDS` de `scripts/sources/armradio.mjs`, sur le modèle de
   `HY_CATEGORY_IDS`.
2. `BASE_BY_LANG.ru = 'https://ru.armradio.am'`.
3. Ajouter `'ru'` à la boucle armradio de `scripts/scrape.mjs`.
4. Dans `NewsBrowser.jsx`, faire résoudre `armLang` vers `'ru'` en interface RU
   (remplacer le ternaire par une table `{ hy:'hy', ru:'ru' }` avec repli `en`).

Tant que le Worker ne route pas `ru`, la rubrique ArmRadio ru revient vide et le
backfill la masque — d'où le report en étape distincte.
