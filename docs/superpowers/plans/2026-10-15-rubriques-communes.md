# Rubriques communes — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les onglets par source de `NewsBrowser` par neuf onglets de rubrique (une étagère par source dans chacune), les fils fourre-tout étant classés article par article par un modèle gratuit OpenRouter.

**Architecture:** Un module plat `src/rubrics.js` porte les neuf rubriques, la table `RUBRIC_MAP` (source × rubrique d'origine → rubrique commune ou `{ mixed: défaut }`) et le regroupement pur `groupByRubric`. Au scrape, `scripts/lib/classify-rubrics.mjs` classe en un seul appel groupé les titres des fils `mixed` non encore en cache, puis écrit `rubric` sur ces articles dans `news.json`. `NewsBrowser` reconstruit ses sources comme avant (`buildSources`) et les recompose en rubriques.

**Tech Stack:** React 18 + Vite, Node 24 (`node:test`, `fetch`, `AbortSignal.timeout`, `--env-file-if-exists`), OpenRouter Chat Completions (API compatible OpenAI).

**Spec:** `docs/superpowers/specs/2026-10-15-rubriques-communes-design.md`

## Global Constraints

- Neuf rubriques, dans cet ordre : `armenie`, `politique`, `economie`, `monde`, `societe`, `diaspora`, `culture`, `sports`, `opinion`.
- Onglet par défaut : `armenie` (repli sur la première rubrique non vide).
- Étagères : ordre de `TAB_ORDER[lang]`, plafond **12** cartes, dédoublonnées par URL, triées par date décroissante, non datées en dernier.
- Un seul appel OpenRouter par instantané, au plus **80** titres, température 0, délai **20 s**, modèle `:free` (`OPENROUTER_MODEL`, sinon `DEFAULT_MODEL`).
- Toute réponse hors des neuf clés est rejetée ; tout échec du classeur → défaut du fil + ligne `✗ classify: …` ; **le scrape ne s'arrête jamais** pour le classeur.
- Secret `OPENROUTER_API_KEY` : GitHub Actions et `.env` local (ignoré par git). **Jamais** écrit dans un fichier suivi, jamais affiché dans un log.
- `src/rubrics.js` est un module **plat** : ni React, ni import de JSON (Node doit l'importer sans attribut d'import).
- Lint : reste à **0 erreur, 5 avertissements**.
- Le français porte tous ses accents.
- Chantier dans un worktree isolé ; un commit (point de retour) par tâche.

## Review Focus

- **Un article déjà classé dont la rubrique d'origine passe de `mixed` à fixe** (table corrigée, push sans scrape) : la table doit l'emporter sur le `rubric` resté dans `news.json`. Test dans la Tâche 1 (`rubricOf` ignore `article.rubric` hors fil `mixed`).
- **Le même article dans deux rubriques d'origine d'une même source qui mènent à la même rubrique commune** (NEWS.am `business` + `economics`) : une seule carte. Test dans la Tâche 2.
- **Une réponse du modèle entourée de texte ou de clôtures ```json, ou avec un index hors bornes ou une rubrique en majuscules** : on garde ce qui est valide, rien d'autre. Test dans la Tâche 4.
- **Un `rubric-cache.json` édité à la main avec une valeur invalide** : retombe sur le défaut du fil, sans planter. Test dans la Tâche 4 (`applyRubrics`).
- **Une langue où la rubrique `armenie` est vide** : l'onglet actif retombe sur la première rubrique non vide, jamais sur un panneau vide. Couvert par `groupByRubric` (Tâche 2, rubriques vides absentes) + `find(...) || rubrics[0]` (Tâche 6), vérifié au rendu.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/rubrics.js` (créé) | `RUBRICS`, `DEFAULT_RUBRIC`, `SHELF_CAP`, `RUBRIC_MAP`, `rubricOf`, `mixedDefault`, `groupByRubric` |
| `scripts/lib/classify-rubrics.mjs` (créé) | parcours des étagères, `collectPending`, `buildMessages`, `parseReply`, `applyRubrics`, `classifyRubrics` (réseau) |
| `src/data/rubric-cache.json` (créé par le scrape) | `{ url: rubrique }` |
| `scripts/scrape.mjs` | appelle le classeur avant d'écrire `news.json` |
| `src/components/NewsBrowser.jsx` | onglets = rubriques, panneau = étagères par source |
| `src/i18n.jsx` | `rubric.*` × 4 langues |
| `src/styles/global.css` | retrait de `.newsfeed__intro`, point « en direct » dans le titre d'étagère |
| `package.json`, `.github/workflows/hourly.yml` | `.env` local, secret en CI, commit du cache |
| `CLAUDE.md` | règle des rubriques, piège du repli |
| `test/rubric-map.test.mjs`, `test/rubric-group.test.mjs`, `test/rubric-i18n.test.mjs`, `test/classify-rubrics.test.mjs` (créés) | gardes sans réseau |

---

### Tâche 1 : la table des rubriques

**Files:**
- Create: `src/rubrics.js`
- Test: `test/rubric-map.test.mjs`

**Interfaces:**
- Produces : `RUBRICS: string[]`, `DEFAULT_RUBRIC = 'armenie'`, `SHELF_CAP = 12`, `RUBRIC_MAP: { [sourceId]: { [key]: string | { mixed: string } } }`, `rubricOf(sourceId, key, article, map = RUBRIC_MAP) → string`, `mixedDefault(sourceId, key, map = RUBRIC_MAP) → string | null`.

- [ ] **Step 1 : écrire le test qui échoue**

`test/rubric-map.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RUBRICS, RUBRIC_MAP, rubricOf, mixedDefault } from '../src/rubrics.js'

const news = JSON.parse(
  await readFile(new URL('../src/data/news.json', import.meta.url), 'utf-8'),
)

// Toutes les (source, rubrique d'origine) du dernier instantané. Une source
// indexée par langue a un objet { lang: [étagères] }, les autres une liste.
function couples() {
  const out = new Set()
  for (const [source, feed] of Object.entries(news)) {
    if (source === 'generatedAt' || !feed) continue
    const lists = Array.isArray(feed) ? [feed] : Object.values(feed)
    for (const list of lists)
      for (const shelf of list || []) out.add(`${source}|${shelf.categoryKey ?? shelf.sectionKey}`)
  }
  return [...out]
}

test('les neuf rubriques, dans l ordre des onglets', () => {
  assert.deepEqual(RUBRICS, [
    'armenie', 'politique', 'economie', 'monde', 'societe',
    'diaspora', 'culture', 'sports', 'opinion',
  ])
})

// LE PIÈGE SILENCIEUX : une rubrique ajoutée par une source et absente de la
// table tomberait dans le repli sans que rien ne le dise. Ce test le dit.
test('chaque rubrique d origine du snapshot est declaree dans RUBRIC_MAP', () => {
  const manquants = couples().filter((c) => {
    const [s, k] = c.split('|')
    return RUBRIC_MAP[s]?.[k] === undefined
  })
  assert.deepEqual(manquants, [], 'déclarer ces couples dans src/rubrics.js')
})

test('chaque valeur de la table est une des neuf rubriques', () => {
  for (const [s, keys] of Object.entries(RUBRIC_MAP))
    for (const [k, v] of Object.entries(keys)) {
      const r = typeof v === 'string' ? v : v?.mixed
      assert.ok(RUBRICS.includes(r), `${s}.${k} → ${JSON.stringify(v)}`)
    }
})

test('rubricOf : table fixe, puis rubric de l article pour un fil mixed, puis defaut', () => {
  const map = { x: { eco: 'economie', mix: { mixed: 'armenie' } } }
  assert.equal(rubricOf('x', 'eco', {}, map), 'economie')
  assert.equal(rubricOf('x', 'mix', { rubric: 'sports' }, map), 'sports')
  assert.equal(rubricOf('x', 'mix', { rubric: 'n-importe' }, map), 'armenie')
  assert.equal(rubricOf('x', 'mix', {}, map), 'armenie')
  assert.equal(rubricOf('x', 'inconnu', {}, map), 'armenie')
})

// Review Focus : une rubrique d'origine passée de mixed à fixe garde son vieux
// `rubric` dans news.json jusqu'au prochain scrape — la table doit l'emporter.
test('rubricOf ignore article.rubric hors fil mixed', () => {
  const map = { x: { eco: 'economie' } }
  assert.equal(rubricOf('x', 'eco', { rubric: 'sports' }, map), 'economie')
})

test('mixedDefault ne vaut que pour un fil mixed', () => {
  const map = { x: { eco: 'economie', mix: { mixed: 'diaspora' } } }
  assert.equal(mixedDefault('x', 'mix', map), 'diaspora')
  assert.equal(mixedDefault('x', 'eco', map), null)
  assert.equal(mixedDefault('y', 'eco', map), null)
})
```

- [ ] **Step 2 : vérifier l'échec**

Run : `node --test test/rubric-map.test.mjs`
Attendu : FAIL, `Cannot find module '…/src/rubrics.js'`.

- [ ] **Step 3 : écrire `src/rubrics.js`**

```js
// Les rubriques communes du navigateur d'actualités.
//
// Module JS PLAT, comme src/seo.js et src/newsSources.js : le scraper (Node),
// les tests et le bundle lisent la même table, et un export non-composant dans
// un .jsx ferait passer le lint de 5 à 6 avertissements. Il n'importe AUCUN
// JSON : Node ne sait pas importer un module qui en importe sans attribut.
//
// Chaque source garde ses propres rubriques dans news.json ; cette table les
// replie sur neuf rubriques communes. Une valeur `{ mixed: défaut }` désigne un
// FIL FOURRE-TOUT (« Top Stories », « Actualité »…) que le scrape classe article
// par article (scripts/lib/classify-rubrics.mjs) et dont le défaut sert de
// repli — c'est ce repli qui rend la panne d'OpenRouter SILENCIEUSE : tout le
// fil atterrit dans son défaut, sans autre signe qu'un « ✗ classify » au log.
//
// Une rubrique d'origine absente d'ici tombe dans DEFAULT_RUBRIC, en silence :
// test/rubric-map.test.mjs confronte cette table au dernier instantané.

export const RUBRICS = [
  'armenie',
  'politique',
  'economie',
  'monde',
  'societe',
  'diaspora',
  'culture',
  'sports',
  'opinion',
]

export const DEFAULT_RUBRIC = 'armenie'

// Cartes par étagère (une étagère = une source dans une rubrique).
export const SHELF_CAP = 12

const mixed = (d) => ({ mixed: d })

export const RUBRIC_MAP = {
  armenpress: {
    armenia: 'armenie',
    economy: 'economie',
    world: 'monde',
    culture: 'culture',
    sports: 'sports',
    'fact-check': mixed('armenie'),
    projects: mixed('armenie'),
  },
  armradio: {
    politics: 'politique',
    society: 'societe',
    economics: 'economie',
    analytics: 'opinion',
    world: 'monde',
    culture: 'culture',
    sport: 'sports',
  },
  // Le Courrier est indexé par `sectionKey`, pas par `categoryKey`.
  courrier: {
    actualite: mixed('armenie'),
    societe: 'societe',
    economie: 'economie',
    'arts-et-culture': 'culture',
    francophonie: mixed('diaspora'),
    opinions: 'opinion',
    region: 'monde',
    diasporas: 'diaspora',
  },
  armenews: {
    actualites: mixed('armenie'),
    sport: 'sports',
    communaute: 'diaspora',
    culture: 'culture',
    lifestyle: 'culture',
    magazine: mixed('culture'),
  },
  artzakank: {
    'armenie-artsakh': 'armenie',
    communaute: 'diaspora',
    divers: mixed('diaspora'),
  },
  armenieinfotv: {
    armenie: 'armenie',
    artsakh: 'armenie',
    'art-culture': 'culture',
    diaspora: 'diaspora',
    france: 'diaspora',
    geopolitique: 'politique',
    politique: 'politique',
    'un-autre-regard': 'opinion',
  },
  // Deux éditions (en, hy) sous une même table : leurs clés ne se recouvrent pas.
  asbarez: {
    'top-stories': mixed('armenie'),
    community: 'diaspora',
    'arts-culture': 'culture',
    'op-ed': 'opinion',
    columns: 'opinion',
    videos: mixed('diaspora'),
    sports: 'sports',
    hayastan: 'armenie',
    'klkhavor-loorer': mixed('armenie'),
    kaghoutigyanken: 'diaspora',
    'գաղութներ': 'diaspora',
    hotvadzner: mixed('opinion'),
  },
  oragark: {
    featured: mixed('armenie'),
    news: mixed('armenie'),
    armenia: 'armenie',
    community: 'diaspora',
    'arachin-hy': mixed('armenie'),
    'latest-news-hy': mixed('armenie'),
  },
  armenianweekly: {
    news: mixed('armenie'),
    diaspora: 'diaspora',
    culture: 'culture',
    opinion: 'opinion',
    columns: 'opinion',
    youth: mixed('diaspora'),
    'special-reports': mixed('armenie'),
  },
  // fr/ru/hy : la chronique de Harut Sassounian ; en : le fil d'actualité.
  californiacourier: {
    french: 'opinion',
    russian: 'opinion',
    'eastern-armenian': 'opinion',
    mainpost: mixed('armenie'),
  },
  civilnet: {
    politics: 'politique',
    economy: 'economie',
    society: 'societe',
    'human-rights': 'societe',
    region: 'monde',
    world: 'monde',
    opinion: 'opinion',
    civilnetcheck: mixed('politique'),
    'democracy-watch': mixed('politique'),
  },
  newsam: {
    politics: 'politique',
    business: 'economie',
    economics: 'economie',
    society: 'societe',
    incidents: 'societe',
    medicine: 'societe',
    culture: 'culture',
    style: 'culture',
    sport: 'sports',
    analytics: 'opinion',
  },
}

// La rubrique commune d'un article. `article.rubric` (écrit par le classeur)
// n'est lu QUE pour un fil mixed : si la table rend une rubrique d'origine
// fixe, elle l'emporte sur un `rubric` resté d'un ancien instantané — un push
// sur main rebâtit sans scraper.
export function rubricOf(sourceId, key, article, map = RUBRIC_MAP) {
  const v = map[sourceId]?.[key]
  if (typeof v === 'string') return v
  if (v && typeof v === 'object')
    return RUBRICS.includes(article?.rubric) ? article.rubric : v.mixed
  return DEFAULT_RUBRIC
}

// Le défaut d'un fil fourre-tout, ou null si la rubrique d'origine est fixe.
export function mixedDefault(sourceId, key, map = RUBRIC_MAP) {
  const v = map[sourceId]?.[key]
  return v && typeof v === 'object' ? v.mixed : null
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `node --test test/rubric-map.test.mjs`
Attendu : PASS (6 tests). Si le test de couverture échoue, c'est qu'un instantané plus récent a une rubrique d'origine nouvelle : l'ajouter à la table avec la rubrique qui lui correspond, puis relancer.

- [ ] **Step 5 : commit**

```bash
git add src/rubrics.js test/rubric-map.test.mjs
git commit -m "Rubriques communes : la table de correspondance des sources"
```

---

### Tâche 2 : le regroupement par rubrique

**Files:**
- Modify: `src/rubrics.js` (ajout en fin de fichier)
- Test: `test/rubric-group.test.mjs`

**Interfaces:**
- Consumes : `RUBRICS`, `SHELF_CAP`, `rubricOf` (Tâche 1).
- Produces : `groupByRubric(sources, { cap = SHELF_CAP, map = RUBRIC_MAP } = {}) → Array<{ key: string, shelves: Array<{ source, articles: Array<article & { catLabel: string }> }> }>`. `sources` a la forme que rend `buildSources` (`NewsBrowser.jsx`) : `{ id, brand, live, images, proxy?, armProxy?, cats: [{ key, label, articles }] }`.

- [ ] **Step 1 : écrire le test qui échoue**

`test/rubric-group.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByRubric } from '../src/rubrics.js'

const map = {
  a: { eco: 'economie', biz: 'economie', mix: { mixed: 'armenie' } },
  b: { eco: 'economie', sp: 'sports' },
}
const art = (url, date, extra = {}) => ({ title: url, url, date, ...extra })
const src = (id, cats) => ({ id, brand: id.toUpperCase(), cats })

test('une etagere par source, dans l ordre des sources', () => {
  const out = groupByRubric(
    [
      src('a', [{ key: 'eco', label: 'Eco A', articles: [art('a1', '2026-10-01')] }]),
      src('b', [{ key: 'eco', label: 'Eco B', articles: [art('b1', '2026-10-02')] }]),
    ],
    { map },
  )
  assert.deepEqual(out.map((r) => r.key), ['economie'])
  assert.deepEqual(out[0].shelves.map((s) => s.source.id), ['a', 'b'])
  assert.equal(out[0].shelves[0].articles[0].catLabel, 'Eco A')
})

// Review Focus : NEWS.am range le même article sous business ET economics.
test('fusion des rubriques d origine, une seule carte par URL', () => {
  const out = groupByRubric(
    [
      src('a', [
        { key: 'eco', label: 'Eco', articles: [art('u1', '2026-10-01'), art('u2', '2026-10-03')] },
        { key: 'biz', label: 'Biz', articles: [art('u1', '2026-10-01'), art('u3', '2026-10-02')] },
      ]),
    ],
    { map },
  )
  assert.deepEqual(out[0].shelves[0].articles.map((a) => a.url), ['u2', 'u3', 'u1'])
})

test('tri par date decroissante, non dates en dernier', () => {
  const out = groupByRubric(
    [src('a', [{ key: 'eco', label: 'E', articles: [art('x', null), art('y', '2026-10-01'), art('z', '2026-10-05')] }])],
    { map },
  )
  assert.deepEqual(out[0].shelves[0].articles.map((a) => a.url), ['z', 'y', 'x'])
})

test('plafond par etagere', () => {
  const many = Array.from({ length: 20 }, (_, i) => art(`u${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`))
  const out = groupByRubric([src('a', [{ key: 'eco', label: 'E', articles: many }])], { map, cap: 12 })
  assert.equal(out[0].shelves[0].articles.length, 12)
  assert.equal(out[0].shelves[0].articles[0].url, 'u19')
})

test('un fil mixed suit le rubric de chaque article', () => {
  const out = groupByRubric(
    [src('a', [{ key: 'mix', label: 'Top', articles: [art('m1', '2026-10-01', { rubric: 'sports' }), art('m2', '2026-10-01')] }])],
    { map },
  )
  assert.deepEqual(out.map((r) => r.key), ['armenie', 'sports'])
  assert.equal(out[0].shelves[0].articles[0].url, 'm2')
  assert.equal(out[1].shelves[0].articles[0].url, 'm1')
})

test('ordre des rubriques fixe, rubriques vides absentes', () => {
  const out = groupByRubric(
    [src('b', [
      { key: 'sp', label: 'S', articles: [art('s1', '2026-10-01')] },
      { key: 'eco', label: 'E', articles: [art('e1', '2026-10-01')] },
    ])],
    { map },
  )
  assert.deepEqual(out.map((r) => r.key), ['economie', 'sports'])
})

test('article sans url ignore, source sans article absente', () => {
  const out = groupByRubric(
    [src('a', [{ key: 'eco', label: 'E', articles: [{ title: 'sans url' }] }])],
    { map },
  )
  assert.deepEqual(out, [])
})
```

- [ ] **Step 2 : vérifier l'échec**

Run : `node --test test/rubric-group.test.mjs`
Attendu : FAIL, `groupByRubric` n'est pas exporté (`SyntaxError: The requested module … does not provide an export named 'groupByRubric'`).

- [ ] **Step 3 : implémenter (ajout en fin de `src/rubrics.js`)**

```js
// Horodatage d'un article ; un article non daté (ou mal daté) part en dernier.
const time = (a) => {
  const t = Date.parse(a.date)
  return Number.isNaN(t) ? -Infinity : t
}

// Les sources (forme de buildSources, NewsBrowser.jsx) recomposées en
// rubriques : pour chaque rubrique, une étagère par source, dans l'ordre des
// sources reçu (donc celui de TAB_ORDER). Une source fusionne toutes ses
// rubriques d'origine qui mènent à la même rubrique commune (NEWS.am business
// + economics), sans doublon d'URL. Chaque carte garde le libellé de sa
// rubrique d'origine (`catLabel`). Rubrique ou étagère vide : absente.
export function groupByRubric(sources, { cap = SHELF_CAP, map = RUBRIC_MAP } = {}) {
  const out = []
  for (const key of RUBRICS) {
    const shelves = []
    for (const source of sources) {
      const seen = new Set()
      const items = []
      for (const c of source.cats || [])
        for (const a of c.articles || []) {
          if (!a?.url || seen.has(a.url)) continue
          if (rubricOf(source.id, c.key, a, map) !== key) continue
          seen.add(a.url)
          items.push({ ...a, catLabel: c.label })
        }
      if (!items.length) continue
      // Stable : deux non datés gardent leur ordre (NaN vaut 0 pour sort).
      items.sort((x, y) => time(y) - time(x))
      shelves.push({ source, articles: items.slice(0, cap) })
    }
    if (shelves.length) out.push({ key, shelves })
  }
  return out
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `node --test test/rubric-group.test.mjs test/rubric-map.test.mjs`
Attendu : PASS (13 tests).

- [ ] **Step 5 : commit**

```bash
git add src/rubrics.js test/rubric-group.test.mjs
git commit -m "Rubriques communes : regroupement des sources par rubrique"
```

---

### Tâche 3 : les libellés de rubrique dans les quatre langues

**Files:**
- Modify: `src/i18n.jsx` (4 blocs `STRINGS`, après la ligne `'news.title': …` de chacun : lignes ~61, ~326, ~591, ~842)
- Test: `test/rubric-i18n.test.mjs`

**Interfaces:**
- Consumes : `RUBRICS` (Tâche 1), `ALL_LANGS` (`sites.config.js`).
- Produces : clés `rubric.<clé>` lues par `t()` en Tâche 6.

- [ ] **Step 1 : écrire le test qui échoue**

`test/rubric-i18n.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RUBRICS } from '../src/rubrics.js'
import { ALL_LANGS } from '../sites.config.js'

// Node ne sait pas importer du JSX : on compte les DÉCLARATIONS dans le texte,
// comme test/stations.test.mjs. t() rend la clé elle-même si elle manque, et
// le prérendu cuirait « rubric.economie » dans le HTML — d'où quatre par clé.
const i18n = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
const declarations = (cle) =>
  (i18n.match(new RegExp(`'${cle.replace(/\./g, '\\.')}':`, 'g')) || []).length

test('chaque rubrique a son libelle dans les quatre blocs STRINGS', () => {
  for (const r of RUBRICS)
    assert.equal(declarations(`rubric.${r}`), ALL_LANGS.length, `rubric.${r}`)
})
```

- [ ] **Step 2 : vérifier l'échec**

Run : `node --test test/rubric-i18n.test.mjs`
Attendu : FAIL, `rubric.armenie` — `0 !== 4`.

- [ ] **Step 3 : ajouter les libellés**

Dans le bloc `fr`, juste après `'news.title': 'Actualités',` :

```js
    'rubric.armenie': 'Arménie',
    'rubric.politique': 'Politique',
    'rubric.economie': 'Économie',
    'rubric.monde': 'Monde',
    'rubric.societe': 'Société',
    'rubric.diaspora': 'Diaspora',
    'rubric.culture': 'Culture',
    'rubric.sports': 'Sports',
    'rubric.opinion': 'Opinion',
```

Dans le bloc `en`, après `'news.title': 'News',` :

```js
    'rubric.armenie': 'Armenia',
    'rubric.politique': 'Politics',
    'rubric.economie': 'Economy',
    'rubric.monde': 'World',
    'rubric.societe': 'Society',
    'rubric.diaspora': 'Diaspora',
    'rubric.culture': 'Culture',
    'rubric.sports': 'Sports',
    'rubric.opinion': 'Opinion',
```

Dans le bloc `hy`, après `'news.title': 'Լուրեր',` :

```js
    'rubric.armenie': 'Հայաստան',
    'rubric.politique': 'Քաղաքականություն',
    'rubric.economie': 'Տնտեսություն',
    'rubric.monde': 'Աշխարհ',
    'rubric.societe': 'Հասարակություն',
    'rubric.diaspora': 'Սփյուռք',
    'rubric.culture': 'Մշակույթ',
    'rubric.sports': 'Սպորտ',
    'rubric.opinion': 'Կարծիք',
```

Dans le bloc `ru`, après `'news.title': 'Новости',` :

```js
    'rubric.armenie': 'Армения',
    'rubric.politique': 'Политика',
    'rubric.economie': 'Экономика',
    'rubric.monde': 'Мир',
    'rubric.societe': 'Общество',
    'rubric.diaspora': 'Диаспора',
    'rubric.culture': 'Культура',
    'rubric.sports': 'Спорт',
    'rubric.opinion': 'Мнение',
```

- [ ] **Step 4 : vérifier le succès**

Run : `node --test test/rubric-i18n.test.mjs`
Attendu : PASS.

- [ ] **Step 5 : commit**

```bash
git add src/i18n.jsx test/rubric-i18n.test.mjs
git commit -m "Rubriques communes : libellés en quatre langues"
```

---

### Tâche 4 : le classeur, partie pure

**Files:**
- Create: `scripts/lib/classify-rubrics.mjs`
- Test: `test/classify-rubrics.test.mjs`

**Interfaces:**
- Consumes : `RUBRICS`, `RUBRIC_MAP`, `mixedDefault` (Tâche 1).
- Produces :
  - `MAX_BATCH = 80`, `DEFAULT_MODEL` (chaîne)
  - `mixedArticles(news, map = RUBRIC_MAP) → Array<{ article, fallback: string }>`
  - `collectPending(news, cache, map = RUBRIC_MAP, max = MAX_BATCH) → Array<{ url, title }>`
  - `buildMessages(items) → Array<{ role, content }>`
  - `parseReply(text, count) → Map<number, string>` (index base 0)
  - `applyRubrics(news, cache, map = RUBRIC_MAP) → prunedCache` (**écrit** `article.rubric` dans `news`)

- [ ] **Step 1 : écrire le test qui échoue**

`test/classify-rubrics.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectPending,
  buildMessages,
  parseReply,
  applyRubrics,
  MAX_BATCH,
} from '../scripts/lib/classify-rubrics.mjs'

const map = {
  a: { top: { mixed: 'armenie' }, eco: 'economie' },
  b: { news: { mixed: 'diaspora' } },
}
// Les deux formes de news.json : indexée par langue (a) et liste plate (b).
const sample = () => ({
  generatedAt: '2026-10-15T00:00:00Z',
  a: {
    en: [
      { categoryKey: 'top', articles: [{ title: 'T1', url: 'u1' }, { title: 'T2', url: 'u2' }] },
      { categoryKey: 'eco', articles: [{ title: 'E1', url: 'e1' }] },
    ],
    hy: [{ categoryKey: 'top', articles: [{ title: 'T1', url: 'u1' }] }],
  },
  b: [{ sectionKey: 'news', articles: [{ title: 'N1', url: 'n1' }, { url: 'sans-titre' }] }],
})

test('collectPending : fils mixed seulement, sans doublon, hors cache, titre requis', () => {
  const p = collectPending(sample(), { u2: 'sports' }, map)
  assert.deepEqual(p, [{ url: 'u1', title: 'T1' }, { url: 'n1', title: 'N1' }])
})

test('collectPending plafonne le lot', () => {
  assert.equal(MAX_BATCH, 80)
  assert.equal(collectPending(sample(), {}, map, 1).length, 1)
})

test('buildMessages numerote a partir de 1, une ligne par titre', () => {
  const [sys, user] = buildMessages([{ url: 'x', title: 'Un\ntitre  ' }, { url: 'y', title: 'Deux' }])
  assert.equal(sys.role, 'system')
  for (const r of ['armenie', 'opinion']) assert.match(sys.content, new RegExp(r))
  assert.equal(user.content, '1. Un titre\n2. Deux')
})

test('parseReply : JSON nu', () => {
  assert.deepEqual([...parseReply('{"1":"politique","2":"sports"}', 2)], [[0, 'politique'], [1, 'sports']])
})

// Review Focus : clôtures, texte autour, majuscules, index hors bornes, clé inconnue.
test('parseReply tolere le bavardage et rejette l invalide', () => {
  const txt = 'Voici :\n```json\n{"1": " Economie ", "2": "météo", "3": "monde", "9": "sports"}\n```'
  assert.deepEqual([...parseReply(txt, 3)], [[0, 'economie'], [2, 'monde']])
})

test('parseReply : pas de JSON, ou JSON casse → rien', () => {
  assert.equal(parseReply('désolé', 2).size, 0)
  assert.equal(parseReply('{"1": "monde"', 2).size, 0)
  assert.equal(parseReply('', 2).size, 0)
})

test('applyRubrics : cache, sinon defaut ; purge des URL sorties du flux', () => {
  const news = sample()
  const pruned = applyRubrics(news, { u1: 'politique', vieux: 'monde', n1: 'invalide' }, map)
  assert.equal(news.a.en[0].articles[0].rubric, 'politique')
  assert.equal(news.a.hy[0].articles[0].rubric, 'politique')
  assert.equal(news.a.en[0].articles[1].rubric, 'armenie')
  // Review Focus : une valeur de cache invalide retombe sur le défaut du fil.
  assert.equal(news.b[0].articles[0].rubric, 'diaspora')
  // Une rubrique fixe n'est pas touchée.
  assert.equal(news.a.en[1].articles[0].rubric, undefined)
  assert.deepEqual(pruned, { u1: 'politique', n1: 'invalide' })
})
```

Note : `pruned` garde `n1: 'invalide'` — la purge ne retire que les URL sorties du flux ; la validation se fait à la lecture (`applyRubrics` et `rubricOf`), et une entrée invalide est retentée nulle part : c'est voulu, elle reste visible dans le fichier pour qui l'a éditée.

- [ ] **Step 2 : vérifier l'échec**

Run : `node --test test/classify-rubrics.test.mjs`
Attendu : FAIL, `Cannot find module '…/scripts/lib/classify-rubrics.mjs'`.

- [ ] **Step 3 : écrire la partie pure de `scripts/lib/classify-rubrics.mjs`**

```js
// Classement des FILS FOURRE-TOUT dans les rubriques communes (src/rubrics.js).
//
// Les rubriques d'origine claires passent par la table ; seuls les fils
// `{ mixed }` (« Top Stories », « Actualité »…) sont classés ici, article par
// article, sur leur TITRE, par un modèle gratuit OpenRouter — UN appel groupé
// par instantané, dans le quota gratuit. Le résultat est mis en cache par URL
// (src/data/rubric-cache.json) : un article n'est classé qu'une fois.
//
// LE PIÈGE : tout échec (pas de clé, quota, réponse illisible, délai) envoie
// les articles non classés dans le défaut de leur fil. Le scrape continue et
// le site reste juste en apparence ; le seul signe est « ✗ classify » au log.
import { RUBRICS, RUBRIC_MAP, mixedDefault } from '../../src/rubrics.js'

export const MAX_BATCH = 80
export const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free'
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Chaque étagère de chaque source, quelle que soit la forme du flux : une liste
// plate, ou un objet indexé par langue.
function* shelves(news) {
  for (const [source, feed] of Object.entries(news)) {
    if (source === 'generatedAt' || !feed || typeof feed !== 'object') continue
    const lists = Array.isArray(feed) ? [feed] : Object.values(feed)
    for (const list of lists)
      if (Array.isArray(list))
        for (const shelf of list) yield { source, shelf, key: shelf.categoryKey ?? shelf.sectionKey }
  }
}

// Les articles des fils mixed, avec le défaut de leur fil.
export function mixedArticles(news, map = RUBRIC_MAP) {
  const out = []
  for (const { source, shelf, key } of shelves(news)) {
    const fallback = mixedDefault(source, key, map)
    if (!fallback) continue
    for (const article of shelf.articles || []) if (article?.url) out.push({ article, fallback })
  }
  return out
}

// Les titres à classer : fils mixed, absents du cache, une fois par URL.
export function collectPending(news, cache, map = RUBRIC_MAP, max = MAX_BATCH) {
  const seen = new Set()
  const out = []
  for (const { article } of mixedArticles(news, map)) {
    if (!article.title || article.url in cache || seen.has(article.url)) continue
    seen.add(article.url)
    out.push({ url: article.url, title: article.title })
    if (out.length >= max) break
  }
  return out
}

export function buildMessages(items) {
  const list = items.map((it, i) => `${i + 1}. ${it.title.replace(/\s+/g, ' ').trim()}`).join('\n')
  const system =
    "Tu classes des titres d'actualité arménienne, chacun dans exactement une rubrique parmi : " +
    `${RUBRICS.join(', ')}. ` +
    "armenie = vie intérieure de l'Arménie et de l'Artsakh hors politique ; " +
    'politique = gouvernement, partis, élections, diplomatie ; ' +
    'economie = économie, entreprises, finances, énergie ; ' +
    "monde = actualité internationale sans lien direct avec l'Arménie ; " +
    'societe = société, faits divers, santé, éducation, droits ; ' +
    "diaspora = communautés arméniennes hors d'Arménie ; " +
    'culture = arts, patrimoine, religion, mode ; sports = sport ; ' +
    'opinion = éditoriaux, chroniques, analyses signées. ' +
    'Les titres peuvent être en français, anglais, arménien ou russe. ' +
    'Réponds UNIQUEMENT par un objet JSON {"numéro": "rubrique"}, sans aucun texte autour.'
  return [
    { role: 'system', content: system },
    { role: 'user', content: list },
  ]
}

// La réponse du modèle → Map(index base 0 → rubrique). Tolère le texte et les
// clôtures autour du JSON ; ignore toute rubrique inconnue ou tout index hors
// bornes. Ne lève jamais.
export function parseReply(text, count) {
  const out = new Map()
  const m = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!m) return out
  let obj
  try {
    obj = JSON.parse(m[0])
  } catch {
    return out
  }
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    const i = Number(k) - 1
    const r = String(v).trim().toLowerCase()
    if (Number.isInteger(i) && i >= 0 && i < count && RUBRICS.includes(r)) out.set(i, r)
  }
  return out
}

// Écrit `rubric` sur chaque article des fils mixed (cache si valide, défaut du
// fil sinon) et rend le cache purgé des URL sorties du flux. MODIFIE `news`.
export function applyRubrics(news, cache, map = RUBRIC_MAP) {
  const live = new Set()
  for (const { article, fallback } of mixedArticles(news, map)) {
    live.add(article.url)
    article.rubric = RUBRICS.includes(cache[article.url]) ? cache[article.url] : fallback
  }
  return Object.fromEntries(Object.entries(cache).filter(([url]) => live.has(url)))
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `node --test test/classify-rubrics.test.mjs`
Attendu : PASS (7 tests).

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/classify-rubrics.mjs test/classify-rubrics.test.mjs
git commit -m "Rubriques communes : classeur des fils fourre-tout (partie pure)"
```

---

### Tâche 5 : le classeur, appel réseau et branchement au scrape

**Files:**
- Modify: `scripts/lib/classify-rubrics.mjs` (ajout de `classifyRubrics`)
- Modify: `scripts/scrape.mjs` (import ; bloc `await writeJson('news.json', { … })` ~l. 279)
- Modify: `package.json` (script `scrape`)
- Modify: `.github/workflows/hourly.yml` (env de l'étape « Scrape hourly snapshot », `git add` de l'étape « Commit refreshed data »)
- Test: `test/classify-rubrics.test.mjs` (ajouts)

**Interfaces:**
- Consumes : `collectPending`, `buildMessages`, `parseReply`, `applyRubrics`, `DEFAULT_MODEL` (Tâche 4).
- Produces : `classifyRubrics(news, cache, { apiKey, model, fetchImpl, timeoutMs, log } = {}) → Promise<cache>` (ne lève jamais).

- [ ] **Step 1 : écrire les tests qui échouent (ajout à `test/classify-rubrics.test.mjs`)**

```js
import { classifyRubrics } from '../scripts/lib/classify-rubrics.mjs'

const quiet = { log() {}, warn() {} }
const reply = (content, ok = true, status = 200) => async () => ({
  ok,
  status,
  json: async () => ({ choices: [{ message: { content } }] }),
})
// classifyRubrics lit la vraie RUBRIC_MAP : les jeux d'essai passent donc par
// une rubrique réellement fourre-tout (armenpress fact-check).
test('classifyRubrics : ajoute au cache ce que le modele a classe', async () => {
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  const cache = await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl: reply('{"1":"politique"}'), log: quiet })
  assert.deepEqual(cache, { u1: 'politique' })
})

test('classifyRubrics sans cle : cache inchange, aucun appel', async () => {
  let called = false
  const fetchImpl = async () => { called = true }
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  const cache = await classifyRubrics(news, { x: 'monde' }, { apiKey: '', fetchImpl, log: quiet })
  assert.equal(called, false)
  assert.deepEqual(cache, { x: 'monde' })
})

test('classifyRubrics : HTTP 429 ou exception → cache inchange, pas de levee', async () => {
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  assert.deepEqual(
    await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl: reply('', false, 429), log: quiet }),
    {},
  )
  const boom = async () => { throw new Error('timeout') }
  assert.deepEqual(await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl: boom, log: quiet }), {})
})

test('classifyRubrics : rien a classer → aucun appel', async () => {
  let called = false
  const fetchImpl = async () => { called = true }
  await classifyRubrics({ a: [] }, {}, { apiKey: 'k', fetchImpl, log: quiet })
  assert.equal(called, false)
})
```

- [ ] **Step 2 : vérifier l'échec**

Run : `node --test test/classify-rubrics.test.mjs`
Attendu : FAIL, `classifyRubrics` non exporté.

- [ ] **Step 3 : implémenter (ajout en fin de `scripts/lib/classify-rubrics.mjs`)**

```js
// L'appel réseau : un lot, un appel. Rend le cache enrichi de ce que le modèle
// a classé. NE LÈVE JAMAIS — un échec laisse les articles à classer au
// prochain instantané, et applyRubrics leur donne le défaut de leur fil d'ici là.
// La clé n'est jamais écrite dans le log.
export async function classifyRubrics(
  news,
  cache,
  {
    apiKey = process.env.OPENROUTER_API_KEY,
    model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    fetchImpl = fetch,
    timeoutMs = 20000,
    log = console,
  } = {},
) {
  const next = { ...cache }
  const pending = collectPending(news, next)
  if (!pending.length) {
    log.log('  classify: aucun titre nouveau')
    return next
  }
  if (!apiKey) {
    log.warn(`  ✗ classify: OPENROUTER_API_KEY absente — ${pending.length} titres dans leur rubrique par défaut`)
    return next
  }
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://armenieinfo.ch',
        'X-Title': 'Armenie Info',
      },
      body: JSON.stringify({ model, temperature: 0, messages: buildMessages(pending) }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    const got = parseReply(body?.choices?.[0]?.message?.content, pending.length)
    for (const [i, rubric] of got) next[pending[i].url] = rubric
    const msg = `  classify: ${got.size}/${pending.length} titres classés (${model})`
    if (got.size) log.log(`  ✓${msg.slice(1)}`)
    else log.warn(`  ✗${msg.slice(1)} — réponse inexploitable`)
  } catch (err) {
    log.warn(`  ✗ classify: ${err.message} — ${pending.length} titres dans leur rubrique par défaut`)
  }
  return next
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `node --test test/classify-rubrics.test.mjs`
Attendu : PASS (11 tests).

- [ ] **Step 5 : brancher au scrape**

Dans `scripts/scrape.mjs`, ajouter aux imports :

```js
import { classifyRubrics, applyRubrics } from './lib/classify-rubrics.mjs'
```

Remplacer `await writeJson('news.json', {` … `})` (le bloc qui liste `generatedAt, courrier, armradio, …, newsam`) par la même liste affectée à une constante, suivie du classement :

```js
  const newsOut = {
    generatedAt,
    courrier,
    armradio,
    armenews,
    artzakank,
    armenieinfotv,
    armenpress,
    asbarez,
    oragark,
    armenianweekly,
    californiacourier,
    civilnet,
    newsam,
  }

  // Les fils fourre-tout sont classés dans les rubriques communes. Un échec
  // n'arrête rien : les articles prennent le défaut de leur fil (voir
  // scripts/lib/classify-rubrics.mjs) — le seul signe est « ✗ classify ».
  console.log('\nRubriques (fils fourre-tout):')
  const rubricCache = await classifyRubrics(newsOut, (await readJson('rubric-cache.json')) || {})
  await writeJson('rubric-cache.json', applyRubrics(newsOut, rubricCache))
  await writeJson('news.json', newsOut)
```

(Recopier la liste de clés **exactement** telle qu'elle figure dans le fichier au moment de l'édition — si une source a été ajoutée entre-temps, elle doit y rester.)

- [ ] **Step 6 : `.env` local et CI**

`package.json`, script `scrape` :

```json
    "scrape": "node --env-file-if-exists=.env scripts/scrape.mjs",
```

`.github/workflows/hourly.yml`, étape « Scrape hourly snapshot », bloc `env:` — ajouter :

```yaml
          # Classement des fils fourre-tout en rubriques (scripts/lib/
          # classify-rubrics.mjs). Optionnel : sans elle, chaque fil tombe dans
          # sa rubrique par défaut et le log porte « ✗ classify ».
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

Étape « Commit refreshed data », ligne `git add` :

```yaml
          git add src/data/news.json src/data/agenda.json src/data/meta.json src/data/instagram-feed.json src/data/rubric-cache.json
```

- [ ] **Step 7 : essai réel, sans écrire de données**

Le `.env` vit à la racine du dépôt principal, pas dans le worktree (fichier ignoré). Depuis le worktree :

```bash
cp "$(git rev-parse --path-format=absolute --git-common-dir)/../.env" .env
node --env-file-if-exists=.env --input-type=module -e "
import { readFile } from 'node:fs/promises'
import { classifyRubrics, collectPending } from './scripts/lib/classify-rubrics.mjs'
const news = JSON.parse(await readFile('src/data/news.json', 'utf-8'))
console.log('à classer :', collectPending(news, {}).length)
const c = await classifyRubrics(news, {})
const n = {}; for (const r of Object.values(c)) n[r] = (n[r] || 0) + 1
console.log(n)
"
```

Attendu : `✓ classify: N/80 titres classés (…)` avec N proche de 80, et une répartition plausible sur plusieurs rubriques. Lire une dizaine de paires titre → rubrique (`console.log` de `collectPending(...).slice(0,10)` et des valeurs correspondantes) pour juger la qualité. Si le modèle par défaut répond 404 (« No endpoints found »), choisir un autre modèle `:free` dans `https://openrouter.ai/api/v1/models` (champ `id` finissant par `:free`), mettre à jour `DEFAULT_MODEL` et relancer.

Puis le repli, même commande avec la clé vidée :

```bash
OPENROUTER_API_KEY= node --input-type=module -e "…même script…"
```

Attendu : `✗ classify: OPENROUTER_API_KEY absente — 80 titres dans leur rubrique par défaut`, cache vide, aucune exception.

- [ ] **Step 8 : suite complète et commit**

Run : `npm test`
Attendu : tout passe (241 + les nouveaux).

```bash
git add scripts/lib/classify-rubrics.mjs scripts/scrape.mjs package.json .github/workflows/hourly.yml test/classify-rubrics.test.mjs
git commit -m "Rubriques communes : classement OpenRouter branché au scrape horaire"
```

Ne **pas** commiter `src/data/` depuis le worktree : le robot horaire le réécrit, et un instantané local entrerait en conflit à la fusion.

---

### Tâche 6 : l'interface — onglets de rubrique

**Files:**
- Modify: `src/components/NewsBrowser.jsx` (import l. 6 ; fonction `NewsBrowser`, ~l. 343-470)
- Modify: `src/styles/global.css` (règle `.newsfeed__intro` ~l. 1453 ; `.newsfeed__live-dot`)

**Interfaces:**
- Consumes : `groupByRubric`, `DEFAULT_RUBRIC` (Tâches 1-2), `rubric.*` (Tâche 3), `buildSources` (inchangé).

- [ ] **Step 1 : import**

Ajouter sous l'import de `newsSources.js` :

```js
import { groupByRubric, DEFAULT_RUBRIC } from '../rubrics.js'
```

- [ ] **Step 2 : remplacer le corps de `NewsBrowser`**

Remplacer toute la fonction `export function NewsBrowser() { … }` par :

```jsx
export function NewsBrowser() {
  const { t, lang } = useI18n()
  // Les sources se construisent comme avant (marque, drapeaux d'image,
  // rubriques d'origine par langue) puis se recomposent en rubriques communes :
  // un onglet par rubrique, une étagère par source dans chacune. TAB_ORDER
  // décide toujours de la présence et de l'ordre des SOURCES — donc des
  // étagères —, src/rubrics.js de celui des onglets.
  const rubrics = groupByRubric(buildSources(t, lang))
  const now = useNow()
  const tabRefs = useRef({})
  const trackRef = useRef(null)
  const [activeKey, setActiveKey] = useState(DEFAULT_RUBRIC)
  // Repli sur la première rubrique non vide : une langue sans « Arménie » ne
  // doit jamais ouvrir sur un panneau vide.
  const active = rubrics.find((r) => r.key === activeKey) || rubrics[0]

  // Sous 640px, ce même tablist devient un tambour vertical (voir
  // useSourceDrum). Appelé inconditionnellement — les hooks ne se sautent pas —
  // et inerte tant que la piste n'existe pas.
  useSourceDrum({
    trackRef,
    itemRefs: tabRefs,
    ids: rubrics.map((r) => r.key),
    activeId: active?.key,
    onSettle: setActiveKey,
  })

  if (!rubrics.length) return null

  // Roving-tab entre les rubriques. Les flèches VERTICALES ne valent que dans
  // le tambour (≤640px) : sur le rail horizontal, Flèche bas doit faire
  // défiler la page, pas changer de rubrique.
  const onKeyDown = (e) => {
    const vertical =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 640px)').matches
    const i = rubrics.findIndex((r) => r.key === active.key)
    let next = null
    if (e.key === 'ArrowRight' || (vertical && e.key === 'ArrowDown'))
      next = (i + 1) % rubrics.length
    else if (e.key === 'ArrowLeft' || (vertical && e.key === 'ArrowUp'))
      next = (i - 1 + rubrics.length) % rubrics.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = rubrics.length - 1
    if (next == null) return
    e.preventDefault()
    setActiveKey(rubrics[next].key)
    tabRefs.current[rubrics[next].key]?.focus()
  }

  const panelId = `newsfeed-panel-${active.key}`

  return (
    <div className="newsfeed">
      <div className="newsfeed__tabwrap">
      <div
        className="newsfeed__tabs"
        role="tablist"
        aria-label={t('news.title')}
        ref={trackRef}
      >
        {rubrics.map((r) => {
          const isActive = r.key === active.key
          return (
            <button
              key={r.key}
              ref={(el) => (tabRefs.current[r.key] = el)}
              type="button"
              role="tab"
              id={`newsfeed-tab-${r.key}`}
              aria-selected={isActive}
              aria-controls={isActive ? panelId : undefined}
              tabIndex={isActive ? 0 : -1}
              className={`newsfeed__tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveKey(r.key)}
              onKeyDown={onKeyDown}
            >
              <span className="newsfeed__tab-brand">{t(`rubric.${r.key}`)}</span>
            </button>
          )
        })}
      </div>
      </div>

      {/* Le repère du tambour, mobile seulement (display:none au-dessus de
          640px). `aria-hidden` : aria-selected dit déjà « onglet 3 sur 9 ». */}
      <div className="newsfeed__dots" aria-hidden="true">
        {rubrics.map((r) => (
          <span
            key={r.key}
            className={`newsfeed__dot${r.key === active.key ? ' is-on' : ''}`}
          />
        ))}
      </div>

      <section
        className="newsfeed__source"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`newsfeed-tab-${active.key}`}
        key={active.key}
      >
        {active.shelves.map(({ source, articles }) => (
          <Carousel
            key={source.id}
            // Le titre est un nœud (marque + point « en direct ») : `label`
            // nomme alors les flèches, voir Carousel.jsx.
            label={source.live ? `${source.brand} — ${t('browser.live')}` : source.brand}
            title={
              <>
                {source.brand}
                {source.live && <span className="newsfeed__live-dot" aria-hidden="true" />}
              </>
            }
            reveal={false}
          >
            {articles.map((a, i) => (
              <ArticleCard
                key={a.url || i}
                item={a}
                catLabel={a.catLabel}
                showImage={source.images}
                proxy={source.proxy}
                armProxy={source.armProxy}
                now={now}
              />
            ))}
          </Carousel>
        ))}
      </section>
    </div>
  )
}
```

Mettre aussi à jour le commentaire « SEO note » au-dessus de `buildSources` : l'onglet prérendu est désormais la rubrique Arménie, avec les étagères de plusieurs sources, toutes dans la langue de la page (chaque langue ne montre que ses sources).

- [ ] **Step 3 : CSS**

Dans `src/styles/global.css` : supprimer la règle `.newsfeed__intro { … }` (plus aucun élément ne la porte — vérifier par `grep -rn newsfeed__intro src` qui ne doit rien rendre). Puis lire la règle `.newsfeed__live-dot` : elle était positionnée pour un onglet ; dans un `h3.shelf__title`, ajouter au besoin

```css
.shelf__title .newsfeed__live-dot {
  display: inline-block;
  margin-left: 0.5em;
  vertical-align: middle;
}
```

en ne gardant que ce que le rendu réel exige (Step 5).

- [ ] **Step 4 : lint, build, tests**

```bash
npm run lint
npm test
npm run build
npm run prerender
npm run check
grep -c '<div id="root"></div>' dist/ch/index.html
```

Attendu : lint 0 erreur / 5 avertissements ; tests verts ; `check` vert ; le `grep` vaut `0` (pages bien prérendues). Contrôler que le HTML prérendu contient les onglets de rubrique :

```bash
grep -o 'newsfeed-tab-[a-z]*' dist/ch/index.html | sort -u
grep -o 'newsfeed-tab-[a-z]*' dist/org/hy/index.html | sort -u
```

Attendu : des clés de rubrique (`armenie`, `politique`…), plus aucun identifiant de source.

- [ ] **Step 5 : vérifier le rendu**

Invoquer le skill `verifier-le-rendu` et suivre sa procédure : quatre langues (`/`, `/` du .org, `/hy/`, `/ru/`) × thèmes jour/nuit × 1400 px et 390 px, sur le build prérendu (`npm run preview` / `preview:org`). Points précis :
- Rail à 1400 px : les neuf rubriques sur deux rangs centrés au plus, sans libellé isolé ; si une langue laisse un orphelin, ajuster `column-gap` de `.newsfeed__tabs` et **remesurer les quatre** (cf. CLAUDE.md, « Le rail des sources sur grand écran »).
- Tambour à 390 px : neuf éléments, boucle dans les deux sens, neuf points, la page défile quand le pouce est posé hors des rangs.
- Clavier : Tab jusqu'à l'onglet, flèches gauche/droite, Home/End ; Flèche bas fait défiler la page à 1400 px.
- Point « en direct » d'ArmRadio dans le titre de son étagère (sous en/hy/ru), aligné.
- Aucune largeur de page > fenêtre (`document.documentElement.scrollWidth <= innerWidth`).

- [ ] **Step 6 : commit**

```bash
git add src/components/NewsBrowser.jsx src/styles/global.css
git commit -m "Rubriques communes : onglets par rubrique, étagères par source"
```

---

### Tâche 7 : documentation et mise en service

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : CLAUDE.md**

1. Dans « À savoir », remplacer **tout** le point qui commence par « **Les onglets du fil suivent la langue choisie, Armenpress en tête.** » (jusqu'à « … sans mesurer ce que devient le HTML prérendu. ») par :

```markdown
- **Les onglets du fil sont des RUBRIQUES, pas des sources.** Neuf rubriques
  communes (`RUBRICS`, `src/rubrics.js`) ; dans chacune, une étagère par
  source, dans l'ordre de **`TAB_ORDER`** (`src/newsSources.js`), qui décide
  toujours quelle source paraît sous quelle langue — une source absente de
  `TAB_ORDER` n'apparaît nulle part, et seul `test/source-count.test.mjs` le
  remarque. **`RUBRIC_MAP`** replie chaque rubrique d'origine sur une rubrique
  commune ; une rubrique d'origine nouvelle doit y être déclarée, sinon elle
  tombe en silence dans Arménie — `test/rubric-map.test.mjs` la confronte au
  dernier instantané. Seul l'onglet actif (Arménie) est prérendu ; chaque
  langue ne montrant que ses sources, le HTML reste dans la langue de la page.
  Ne réintroduisez pas d'onglet hors-langue sans mesurer ce qu'il prérend.

  **Les fils fourre-tout (`{ mixed }`) sont classés au scrape par un modèle
  gratuit OpenRouter** (`scripts/lib/classify-rubrics.mjs`, secret
  `OPENROUTER_API_KEY`, cache `src/data/rubric-cache.json`). **Le piège :** une
  clé expirée ou un quota épuisé ne casse rien — chaque fil retombe dans son
  défaut, le site a l'air juste, et le seul signe est `✗ classify` au log
  (`gh run view <id> --log | grep classify`).
```

2. Dans la liste « Généré par le scrape (ne pas éditer à la main) », ajouter `rubric-cache.json` (éditable à la main pour corriger un classement, une URL par ligne).
3. Mettre à jour le nombre de tests (« 241 tests ») et la liste qui suit dans la section Commandes, avec le total que donne `npm test`.
4. Dans « Le rail des sources sur grand écran », remplacer les mesures par source (fr 4+3, en 5+3…) par celles relevées en Tâche 6, Step 5, pour les neuf rubriques.

- [ ] **Step 2 : commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md : rubriques communes et piège du classeur"
```

- [ ] **Step 3 : secret GitHub (avant la fusion)**

Le propriétaire crée une clé sur openrouter.ai (Workspace → API Keys → New Key, limite de crédit basse), la copie dans le presse-papiers via le bouton de copie, puis, depuis PowerShell, **sans l'afficher** :

```powershell
Get-Clipboard | gh secret set OPENROUTER_API_KEY --repo cobranian/ArmenianNews
Set-Content -Encoding utf8 -NoNewline .env ("OPENROUTER_API_KEY=" + (Get-Clipboard))
```

(Si `.env` contient déjà d'autres variables, ajouter la ligne plutôt que réécrire le fichier.) Vérifier : `gh secret list --repo cobranian/ArmenianNews` doit lister `OPENROUTER_API_KEY`.

- [ ] **Step 4 : fusion et contrôle en production**

Après validation par le propriétaire : fusion dans `main` (fusion plutôt que rebase), push, puis `gh workflow run hourly.yml` pour un instantané complet. Contrôles :
- `gh run view <id> --log | grep classify` → une ligne `✓ classify`.
- `src/data/rubric-cache.json` commité par le robot.
- `curl -s https://armenieinfo.ch/ | grep -o 'newsfeed-tab-[a-z]*' | sort -u` → clés de rubrique.
- Même contrôle sur `https://armenianews.org/hy/`.

---

## Auto-revue

- **Couverture de la spec** : neuf rubriques et table (T1) ; `sectionKey` du Courrier (T1) ; regroupement, plafond 12, tri, doublons (T2) ; i18n (T3) ; classeur pur, lot de 80, rejet hors clés, purge (T4) ; appel unique, délai 20 s, repli `✗ classify`, secret, `.env`, CI, commit du cache (T5) ; onglets, étagères, point « en direct », intro retirée, tambour, rail remesuré, prérendu (T6) ; CLAUDE.md, mise en service (T7).
- **Écart assumé avec la spec** : la spec disait « `article.rubric` > table > défaut » ; le plan ne lit `article.rubric` que pour un fil `mixed` (sinon un vieux `rubric` l'emporterait sur une table corrigée, cf. Review Focus 1). À reporter dans la spec au moment de la fusion.
- **Noms cohérents** : `groupByRubric`, `rubricOf`, `mixedDefault`, `DEFAULT_RUBRIC`, `SHELF_CAP`, `collectPending`, `buildMessages`, `parseReply`, `applyRubrics`, `classifyRubrics`, `MAX_BATCH`, `DEFAULT_MODEL` — identiques d'une tâche à l'autre.
