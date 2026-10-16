# Brève quotidienne — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chaque jour et dans chaque langue (fr/en/hy/ru), générer au scrape une brève de 5 à 7 sujets croisés entre les sources, et la publier en pages HTML statiques datées et indexées (`/breve/AAAA-MM-JJ/`, `/brief/…`, `/hy/brief/…`, `/ru/brief/…`).

**Architecture:** `scripts/scrape.mjs` appelle `generateBriefs()` après le classement des rubriques ; le modèle OpenRouter reçoit des titres numérotés et renvoie des ids, que le code résout en liens. Les brèves sont des JSON versionnés dans `src/data/briefs/{lang}/`. Au build, `scripts/build-sites.mjs` écrit les pages avec un module Node (pas de React, pas de prérendu), l'en-tête venant de `scripts/lib/site-meta.mjs` étendu, et ajoute les URL au sitemap.

**Tech Stack:** Node 24 (ESM, `node --test`), Vite + React (seulement pour les liens de nav/pied de page), OpenRouter (modèles `:free`), Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-10-16-breve-quotidienne-design.md`

## Global Constraints

- Langues : `fr` sur le .ch, `en`/`hy`/`ru` sur le .org — toujours dérivé de `sites.config.js` (`ALL_LANGS`, `siteOf`), jamais écrit en dur.
- Slugs : `fr: 'breve/'`, `en: 'brief/'`, `hy: 'brief/'`, `ru: 'brief/'`, **slash final obligatoire** ; date au format `AAAA-MM-JJ` + `/`.
- Date de la brève = date murale `Asia/Yerevan` ; brève due à partir de **7 h** à Erevan si son fichier n'existe pas ; **jamais régénérée**.
- Fenêtre : articles des **24 h** précédentes, dédoublonnés par URL, **plafond 100**, **minimum 10** ; **5 à 7 sujets**, rejet sous **3**.
- Délai d'appel **180 000 ms** ; mêmes modèles que le classeur (`DEFAULT_MODEL`, `FALLBACK_MODELS`, `OPENROUTER_MODEL`).
- **Le modèle ne fournit jamais d'URL** : les liens viennent des articles envoyés.
- Pas de garde-fou sur le texte (décision du propriétaire) — seulement sur la **structure** du JSON.
- Journal : `✓ brief/{lang}`, `· brief/{lang}: …` (cas normal), `✗ brief/{lang}: …` (échec) ; la clé n'apparaît jamais au log.
- Modules lus par Node ET par le bundle = **JS plat** dans `src/`, sans import JSON ni JSX (règle du dépôt : lint à 5 avertissements, Node ne parse pas `.jsx`).
- Toute date affichée en arménien passe par `src/hyDate.js` ; fr/en/ru peuvent utiliser `Intl` **uniquement côté Node** (build).
- Toute chaîne venue d'une brève est **échappée** en HTML et, dans le JSON-LD, `<` est échappé en `<`.
- Messages de commit en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Après chaque tâche : `npm test` et `npm run lint` (0 erreur, **5 avertissements**) passent.

## Review Focus

1. **Le modèle renvoie les ids en chaînes (`"3"`), en double, ou entoure son JSON de texte/clôtures ```json** → les ids sont convertis, dédoublonnés, le JSON extrait (test en Task 3).
2. **Un scrape à 20:30 UTC tombe le lendemain à Erevan (00:30)** → la date est celle d'Erevan et la brève n'est pas due avant 7 h (test en Task 2).
3. **Une page datée hy existe un jour où en n'en a pas** → hreflang limité aux langues présentes, `x-default` absent ; aucune langue citée sans page (test en Task 5).
4. **Un titre ou un texte contenant `<script>`, `"` ou `&`** → échappé dans le HTML et le JSON-LD (test en Task 6).
5. **Aucune brève encore (premier déploiement) ou un JSON de brève corrompu sur disque** → `/breve/` rend le message d'attente, le sitemap ne cite que les pages existantes, le fichier corrompu est ignoré avec un avertissement au lieu de casser le build (test en Task 6).

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/newsLangs.js` (créé) | `TAB_ORDER`, `SOURCE_NAMES`, `feedFor(news, id, lang)` — la forme de `news.json`, lisible par Node |
| `src/newsSources.js` (modifié) | ré-exporte `TAB_ORDER`, `shelvesFor` délègue à `feedFor` |
| `src/briefStrings.js` (créé) | chaînes de la brève, quatre langues (titre, nav, marque visible, mentions…) |
| `src/rubricLabels.js` (créé) | libellés des 9 rubriques, quatre langues ; `i18n.jsx` les étale |
| `scripts/lib/brief-select.mjs` (créé) | horloge d'Erevan, règle « due », sélection des articles |
| `scripts/lib/brief-generate.mjs` (créé) | consigne, analyse de la réponse, appel réseau, écriture des fichiers |
| `scripts/brief.mjs` (créé) | CLI `npm run brief` (`--force`, `--dry`) |
| `sites.config.js` (modifié) | `BRIEF_SLUGS`, `briefUrl`, `briefPath` |
| `scripts/lib/brief-links.mjs` (créé) | `briefLangsByDate`, `briefAlternates` — partagé par l'en-tête et le sitemap |
| `scripts/lib/site-meta.mjs` (modifié) | `composeHead` interne, `briefHeadFor` |
| `scripts/lib/brief-pages.mjs` (créé) | `loadBriefs`, `cssHrefFrom`, `briefPageHtml`, `briefIndexHtml`, `writeBriefPages` |
| `scripts/lib/sitemap.mjs` (modifié) | entrées de brève |
| `scripts/build-sites.mjs` (modifié) | branche pages et sitemap |
| `src/styles/global.css` (modifié) | classes `.brief*` |
| `src/components/Nav.jsx`, `Footer.jsx`, `scripts/lib/not-found.mjs` (modifiés) | liens « Brève » |
| `scripts/check-build.mjs`, `.github/workflows/hourly.yml` (modifiés) | contrôle et sonde |

---

### Task 1: Modules plats partagés (sources, rubriques, chaînes de la brève)

Node doit lire `TAB_ORDER`, les noms de sources et les libellés de rubriques. Aujourd'hui ils vivent dans `src/newsSources.js` (qui importe `news.json` — illisible par Node sans attribut), `NewsBrowser.jsx` et `i18n.jsx` (JSX). On les extrait sans changer le rendu.

**Files:**
- Create: `src/newsLangs.js`, `src/rubricLabels.js`, `src/briefStrings.js`, `test/news-langs.test.mjs`, `test/brief-strings.test.mjs`
- Modify: `src/newsSources.js:17-130` (le bloc `TAB_ORDER` … `shelvesFor`), `src/components/NewsBrowser.jsx:165-299` (les 12 `brand:`), `src/i18n.jsx` (les 4 blocs de 9 lignes `'rubric.*'`, lignes ~62-70, ~336-344, ~610-618, ~870-878), `test/rubric-i18n.test.mjs`, `test/source-count.test.mjs:44`

**Interfaces:**
- Produces:
  - `TAB_ORDER: Record<lang, string[]>` (même valeur qu'aujourd'hui)
  - `SOURCE_NAMES: Record<sourceId, string>`
  - `feedFor(news: object, id: string, lang: string): Shelf[]` (toujours un tableau)
  - `RUBRIC_LABELS: Record<lang, Record<rubric, string>>`, `rubricStrings(lang): Record<'rubric.x', string>`
  - `BRIEF_STRINGS: Record<lang, { title, nav, brand, description, latest, archive, sources, previous, next, disclaimer, empty, home }>`

- [ ] **Step 1: Écrire le test qui échoue** — `test/news-langs.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAB_ORDER, SOURCE_NAMES, feedFor } from '../src/newsLangs.js'
import { ALL_LANGS } from '../sites.config.js'

test('TAB_ORDER couvre les quatre langues', () => {
  assert.deepEqual(Object.keys(TAB_ORDER).sort(), [...ALL_LANGS].sort())
})

test('chaque source nommée dans TAB_ORDER a un nom affichable', () => {
  for (const ids of Object.values(TAB_ORDER))
    for (const id of ids) assert.ok(SOURCE_NAMES[id], `SOURCE_NAMES.${id}`)
})

test('feedFor lit les deux formes de news.json', () => {
  const news = {
    armenpress: { fr: [{ categoryKey: 'armenia', articles: [] }] },
    courrier: [{ sectionKey: 'actualite', articles: [] }],
    armradio: { en: [{ categoryKey: 'politics', articles: [] }] },
  }
  assert.equal(feedFor(news, 'armenpress', 'fr').length, 1)
  assert.equal(feedFor(news, 'courrier', 'fr').length, 1)
  // ArmRadio n'a pas d'édition française : repli sur l'anglais.
  assert.equal(feedFor(news, 'armradio', 'fr')[0].categoryKey, 'politics')
  assert.deepEqual(feedFor(news, 'absente', 'fr'), [])
  assert.deepEqual(feedFor(news, 'armenpress', 'ru'), [])
})
```

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `node --test test/news-langs.test.mjs`
Expected: FAIL — `Cannot find module '…/src/newsLangs.js'`

- [ ] **Step 3: Créer `src/newsLangs.js`**

Déplacer **verbatim** depuis `src/newsSources.js` le long commentaire de `TAB_ORDER`, le tableau `TAB_ORDER`, `BY_LANG` et `FEED_LANG` (avec leurs commentaires), puis ajouter :

```js
// La forme de news.json et l'ordre des sources par langue, lisibles par Node.
//
// Module JS PLAT, sans import JSON : le scraper (scripts/lib/brief-select.mjs)
// doit lire TAB_ORDER, et src/newsSources.js importe news.json — Node refuse
// un import JSON sans attribut. newsSources.js ré-exporte d'ici.

// … TAB_ORDER, BY_LANG, FEED_LANG déplacés ici, inchangés …

// Le nom de chaque rédaction, tel qu'affiché. Une seule source de vérité :
// l'onglet (NewsBrowser.jsx) et la ligne « Sources » de la brève.
export const SOURCE_NAMES = {
  armenpress: 'Armenpress',
  armradio: 'ArmRadio',
  courrier: "Courrier d'Erevan",
  armenews: "Nouvelles d'Arménie",
  artzakank: 'Artzakank',
  armenieinfotv: 'ArménieInfo.tv',
  asbarez: 'Asbarez',
  oragark: 'Oragark',
  armenianweekly: 'Armenian Weekly',
  californiacourier: 'California Courier',
  civilnet: 'CivilNet',
  newsam: 'NEWS.am',
}

// Les étagères brutes d'une source pour une langue. Toujours un tableau.
export function feedFor(news, id, lang) {
  const feed = BY_LANG.has(id) ? news?.[id]?.[FEED_LANG[id]?.(lang) ?? lang] : news?.[id]
  return Array.isArray(feed) ? feed : []
}
```

Dans `src/newsSources.js`, remplacer le bloc déplacé par :

```js
import { TAB_ORDER, feedFor } from './newsLangs.js'

export { TAB_ORDER }

// Les étagères brutes d'une source pour une langue. Toujours un tableau : une
// source absente du snapshot rend [], jamais undefined.
export function shelvesFor(id, lang) {
  return feedFor(news, id, lang)
}
```

(garder `import news from './data/news.json'` et `visibleSources` tels quels.)

Dans `NewsBrowser.jsx`, ajouter `import { SOURCE_NAMES } from '../newsLangs.js'` et remplacer chacun des 12 `brand: '…'` par `brand: SOURCE_NAMES.<id>` (l'id est la clé `id:` de la même entrée).

Dans `test/source-count.test.mjs:44`, le texte lu doit venir de `src/newsLangs.js` au lieu de `src/newsSources.js` (changer le chemin du `readFile` et le message d'assertion ; la regex reste la même).

- [ ] **Step 4: Créer `src/rubricLabels.js` et l'étaler dans `i18n.jsx`**

```js
// Les libellés des neuf rubriques communes, par langue.
//
// Module JS PLAT : i18n.jsx les étale dans ses dictionnaires (t('rubric.x')),
// et les pages de brève (Node, scripts/lib/brief-pages.mjs) les lisent
// directement — Node ne sait pas importer du JSX.
export const RUBRIC_LABELS = {
  fr: { /* les 9 valeurs des lignes 'rubric.*' du bloc fr d'i18n.jsx, verbatim */ },
  en: { /* idem bloc en */ },
  hy: { /* idem bloc hy */ },
  ru: { /* idem bloc ru */ },
}

export const rubricStrings = (lang) =>
  Object.fromEntries(Object.entries(RUBRIC_LABELS[lang]).map(([k, v]) => [`rubric.${k}`, v]))
```

Remplir les quatre objets en **recopiant** les 36 valeurs d'`i18n.jsx` (clé `armenie`, `politique`, …, `opinion`), puis dans `i18n.jsx` : `import { rubricStrings } from './rubricLabels.js'` et remplacer chaque bloc de 9 lignes `'rubric.*'` par `...rubricStrings('fr'),` (resp. `'en'`, `'hy'`, `'ru'`).

Réécrire `test/rubric-i18n.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RUBRICS } from '../src/rubrics.js'
import { RUBRIC_LABELS } from '../src/rubricLabels.js'
import { ALL_LANGS } from '../sites.config.js'

// t() rend la clé elle-même si elle manque, et le prérendu cuirait
// « rubric.economie » dans le HTML : chaque rubrique doit avoir un libellé non
// vide dans chaque langue, ET i18n.jsx doit étaler chaque langue une fois.
test('chaque rubrique a son libellé dans les quatre langues', () => {
  for (const l of ALL_LANGS)
    for (const r of RUBRICS) assert.ok(RUBRIC_LABELS[l]?.[r]?.trim(), `${l}.${r}`)
})

test('i18n.jsx étale les libellés de chaque langue', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  for (const l of ALL_LANGS)
    assert.equal(src.split(`...rubricStrings('${l}')`).length - 1, 1, l)
  assert.ok(!/'rubric\.[a-z]+':/.test(src), 'plus de libellé de rubrique écrit en dur')
})
```

- [ ] **Step 5: Créer `src/briefStrings.js` et son test**

```js
// Les chaînes de la brève quotidienne, par langue.
//
// Module JS PLAT, lu par Node (scripts/lib/brief-pages.mjs, not-found.mjs) ET
// par le bundle (Nav.jsx, Footer.jsx). `brand` est la marque VISIBLE de la
// langue — « Արմենիա Ինֆո » sous hy, comme STRINGS.hy['site.title'] d'i18n.jsx
// (voir CLAUDE.md : la marque arménienne s'écarte du domaine) ;
// test/brief-strings.test.mjs garde les deux égales.
export const BRIEF_STRINGS = {
  fr: {
    title: 'La brève du jour',
    nav: 'Brève',
    brand: 'Arménie Info',
    description:
      'Chaque matin, les sujets du jour croisés entre les rédactions arméniennes, avec les liens vers leurs articles.',
    latest: 'Dernière brève',
    archive: 'Archives',
    sources: 'Sources',
    previous: '← Veille',
    next: 'Lendemain →',
    disclaimer: 'Synthèse automatique des titres du jour — lisez les articles d’origine.',
    empty: 'La première brève paraîtra demain matin.',
    home: 'Accueil',
  },
  en: {
    title: 'The daily brief',
    nav: 'Brief',
    brand: 'Armenia News',
    description:
      'Every morning, the day’s stories cross-checked across Armenian newsrooms, with links to their articles.',
    latest: 'Latest brief',
    archive: 'Archive',
    sources: 'Sources',
    previous: '← Previous day',
    next: 'Next day →',
    disclaimer: 'Automated summary of the day’s headlines — read the original articles.',
    empty: 'The first brief will appear tomorrow morning.',
    home: 'Home',
  },
  hy: {
    title: 'Օրվա ամփոփում',
    nav: 'Ամփոփում',
    brand: 'Արմենիա Ինֆո',
    description:
      'Ամեն առավոտ՝ օրվա թեմաները հայկական խմբագրությունների համադրությամբ, նրանց հոդվածների հղումներով։',
    latest: 'Վերջին ամփոփումը',
    archive: 'Արխիվ',
    sources: 'Աղբյուրներ',
    previous: '← Նախորդ օր',
    next: 'Հաջորդ օր →',
    disclaimer: 'Օրվա վերնագրերի ավտոմատ ամփոփում․ կարդացեք բնօրինակ հոդվածները։',
    empty: 'Առաջին ամփոփումը կհրապարակվի վաղը առավոտյան։',
    home: 'Գլխավոր էջ',
  },
  ru: {
    title: 'Сводка дня',
    nav: 'Сводка',
    brand: 'Armenia News',
    description:
      'Каждое утро — главные темы дня по материалам армянских редакций, со ссылками на их статьи.',
    latest: 'Последняя сводка',
    archive: 'Архив',
    sources: 'Источники',
    previous: '← Предыдущий день',
    next: 'Следующий день →',
    disclaimer: 'Автоматическая сводка заголовков дня — читайте оригинальные статьи.',
    empty: 'Первая сводка появится завтра утром.',
    home: 'Главная',
  },
}
```

`test/brief-strings.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BRIEF_STRINGS } from '../src/briefStrings.js'
import { ALL_LANGS } from '../sites.config.js'

test('chaque langue porte toutes les clés de fr, non vides', () => {
  const keys = Object.keys(BRIEF_STRINGS.fr)
  for (const l of ALL_LANGS)
    for (const k of keys) assert.ok(BRIEF_STRINGS[l]?.[k]?.trim(), `${l}.${k}`)
})

test('la marque visible concorde avec site.title d’i18n.jsx', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  const titles = [...src.matchAll(/'site\.title':\s*'([^']+)'/g)].map((m) => m[1])
  assert.equal(titles.length, ALL_LANGS.length, 'un site.title par bloc')
  // Les blocs STRINGS d'i18n.jsx sont dans l'ordre fr, en, hy, ru.
  ALL_LANGS.forEach((l, i) => assert.equal(BRIEF_STRINGS[l].brand, titles[i], l))
})
```

Si ce dernier test révèle que `'site.title'` est écrit avec des guillemets doubles ou que l'ordre des blocs diffère, ajuster la regex / l'ordre au fichier réel — pas les valeurs de `brand`.

- [ ] **Step 6: Lancer tests et lint**

Run: `npm test && npm run lint`
Expected: tous PASS ; lint `0 errors, 5 warnings`.

- [ ] **Step 7: Vérifier que le bundle n'a pas changé de comportement**

Run: `npm run build && npm run check`
Expected: build OK, `check` sans `✗`.

- [ ] **Step 8: Commit**

```bash
git add src/newsLangs.js src/newsSources.js src/rubricLabels.js src/briefStrings.js src/i18n.jsx src/components/NewsBrowser.jsx test/news-langs.test.mjs test/brief-strings.test.mjs test/rubric-i18n.test.mjs test/source-count.test.mjs
git commit -m "Brève : modules plats pour l'ordre des sources, les rubriques et les chaînes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Horloge d'Erevan et sélection des articles

**Files:**
- Create: `scripts/lib/brief-select.mjs`, `test/brief-select.test.mjs`

**Interfaces:**
- Consumes: `TAB_ORDER`, `feedFor` (`src/newsLangs.js`) ; `rubricOf(sourceId, key, article)` (`src/rubrics.js`)
- Produces:
  - `BRIEF_HOUR = 7`, `WINDOW_MS = 86_400_000`, `MAX_ARTICLES = 100`, `MIN_ARTICLES = 10`
  - `yerevanClock(now: Date): { date: 'AAAA-MM-JJ', hour: number }`
  - `isBriefDue(now: Date, exists: boolean): boolean`
  - `selectArticles(news, lang, now = new Date(), max = MAX_ARTICLES): Array<{ id: number, source, rubric, title, url, date }>` — ids 1..n, plus récent d'abord

- [ ] **Step 1: Écrire le test qui échoue** — `test/brief-select.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { yerevanClock, isBriefDue, selectArticles, MAX_ARTICLES } from '../scripts/lib/brief-select.mjs'

test('yerevanClock : UTC+4, sans heure d’été', () => {
  assert.deepEqual(yerevanClock(new Date('2026-10-16T02:59:00Z')), { date: '2026-10-16', hour: 6 })
  assert.deepEqual(yerevanClock(new Date('2026-10-16T03:00:00Z')), { date: '2026-10-16', hour: 7 })
  // Un scrape du soir UTC est déjà le lendemain à Erevan.
  assert.deepEqual(yerevanClock(new Date('2026-10-15T20:30:00Z')), { date: '2026-10-16', hour: 0 })
  assert.deepEqual(yerevanClock(new Date('2026-07-01T19:59:00Z')), { date: '2026-07-01', hour: 23 })
})

test('isBriefDue : 7 h à Erevan et fichier absent', () => {
  assert.equal(isBriefDue(new Date('2026-10-16T02:59:00Z'), false), false)
  assert.equal(isBriefDue(new Date('2026-10-16T03:00:00Z'), false), true)
  assert.equal(isBriefDue(new Date('2026-10-16T03:00:00Z'), true), false)
  assert.equal(isBriefDue(new Date('2026-10-15T20:30:00Z'), false), false)
})

const NOW = new Date('2026-10-16T05:00:00Z')
const art = (title, url, hoursAgo) => ({
  title,
  url,
  date: hoursAgo == null ? null : new Date(NOW - hoursAgo * 3600e3).toISOString(),
})

const news = {
  armenpress: {
    fr: [{ categoryKey: 'economy', articles: [art('Eco 1', 'u1', 1), art('Vieux', 'u2', 30)] }],
    en: [{ categoryKey: 'armenia', articles: [art('EN only', 'e1', 1)] }],
  },
  courrier: [
    {
      sectionKey: 'actualite',
      articles: [
        art('  Mixte  classé ', 'c1', 2),
        art('Sans date', 'c2', null),
        art('Doublon', 'u1', 3),
        { title: '', url: 'c3', date: NOW.toISOString() },
      ],
    },
  ],
  // newsam n'est pas dans TAB_ORDER.fr : jamais sélectionné sous fr.
  newsam: { en: [{ categoryKey: 'politics', articles: [art('NEWS.am', 'n1', 1)] }] },
}
news.courrier[0].articles[0].rubric = 'politique'

test('selectArticles : langue, fenêtre, dédoublonnage, tri, ids', () => {
  const got = selectArticles(news, 'fr', NOW)
  assert.deepEqual(
    got.map((a) => [a.id, a.title, a.source, a.rubric, a.url]),
    [
      [1, 'Eco 1', 'armenpress', 'economie', 'u1'],
      [2, 'Mixte classé', 'courrier', 'politique', 'c1'],
    ],
  )
  assert.ok(got.every((a) => typeof a.date === 'string'))
})

test('selectArticles : plafond, plus récents d’abord', () => {
  const many = Array.from({ length: MAX_ARTICLES + 20 }, (_, i) => art(`T${i}`, `m${i}`, i / 10))
  const big = { courrier: [{ sectionKey: 'societe', articles: many }] }
  const got = selectArticles(big, 'fr', NOW)
  assert.equal(got.length, MAX_ARTICLES)
  assert.equal(got[0].url, 'm0')
  assert.equal(got.at(-1).id, MAX_ARTICLES)
})

test('selectArticles : langue sans source → []', () => {
  assert.deepEqual(selectArticles({}, 'ru', NOW), [])
})
```

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `node --test test/brief-select.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `scripts/lib/brief-select.mjs`**

```js
// Ce que la brève quotidienne reçoit : quand elle est due, et quels articles.
//
// La date d'une brève est la date MURALE D'EREVAN, pas celle d'UTC ni celle de
// la machine : un scrape à 20:30 UTC est déjà le lendemain à Erevan, et le
// runner de la CI est en UTC là où un poste local ne l'est pas. Intl est sûr
// ici (Node a l'ICU complet ; c'est le NAVIGATEUR qui n'a pas hy-AM, voir
// src/hyDate.js) — et on ne formate qu'en chiffres.
import { TAB_ORDER, feedFor } from '../../src/newsLangs.js'
import { rubricOf } from '../../src/rubrics.js'

export const BRIEF_HOUR = 7
export const WINDOW_MS = 24 * 3600 * 1000
export const MAX_ARTICLES = 100
export const MIN_ARTICLES = 10

const CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Yerevan',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function yerevanClock(now = new Date()) {
  const p = Object.fromEntries(CLOCK.formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

// Due : pas encore écrite ET la journée d'Erevan a commencé (7 h). Une brève
// écrite n'est JAMAIS régénérée — son URL datée garde un contenu stable.
export function isBriefDue(now, exists) {
  return !exists && yerevanClock(now).hour >= BRIEF_HOUR
}

// Les articles de la langue, sur les 24 h précédentes, dans les sources que
// TAB_ORDER attribue à cette langue — la même règle que le fil. Un article
// sans titre, sans URL ou sans date lisible est écarté : on ne peut ni le
// situer dans la journée ni le citer.
export function selectArticles(news, lang, now = new Date(), max = MAX_ARTICLES) {
  const end = now.getTime()
  const since = end - WINDOW_MS
  const seen = new Set()
  const out = []
  for (const source of TAB_ORDER[lang] ?? []) {
    for (const shelf of feedFor(news, source, lang)) {
      const key = shelf.categoryKey ?? shelf.sectionKey
      for (const a of shelf.articles ?? []) {
        const title = typeof a?.title === 'string' ? a.title.replace(/\s+/g, ' ').trim() : ''
        const t = Date.parse(a?.date)
        if (!title || !a?.url || Number.isNaN(t) || t < since || seen.has(a.url)) continue
        seen.add(a.url)
        out.push({ source, rubric: rubricOf(source, key, a), title, url: a.url, date: a.date, t })
      }
    }
  }
  out.sort((x, y) => y.t - x.t)
  return out.slice(0, max).map(({ t, ...a }, i) => ({ id: i + 1, ...a }))
}
```

- [ ] **Step 4: Lancer les tests**

Run: `node --test test/brief-select.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/brief-select.mjs test/brief-select.test.mjs
git commit -m "Brève : horloge d'Erevan et sélection des articles du jour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Génération (consigne, analyse, appel, écriture) + branchement au scrape + CLI

**Files:**
- Create: `scripts/lib/brief-generate.mjs`, `scripts/brief.mjs`, `test/brief-generate.test.mjs`, `src/data/briefs/.gitkeep`
- Modify: `scripts/lib/classify-rubrics.mjs` (exporter `ENDPOINT`, extraire `modelChain`), `scripts/scrape.mjs:303-305`, `package.json` (script `brief`)

**Interfaces:**
- Consumes: `selectArticles`, `yerevanClock`, `isBriefDue`, `MIN_ARTICLES` (Task 2) ; `RUBRICS` (`src/rubrics.js`) ; `ALL_LANGS` (`sites.config.js`)
- Produces:
  - `ENDPOINT: string`, `modelChain(forced?: string): string[]` (dans `classify-rubrics.mjs`)
  - `MIN_TOPICS = 3`, `MAX_TOPICS = 7`, `BRIEF_TIMEOUT_MS = 180000`
  - `buildBriefMessages(lang, articles): Array<{role, content}>`
  - `parseBrief(text, articles): { intro: string, topics: Topic[] } | null`, `Topic = { title, text, rubric: string|null, sources: Array<{ source, url, title }> }`
  - `generateBriefs({ news, now?, dir, apiKey?, model?, fetchImpl?, timeoutMs?, log?, force? }): Promise<string[]>` — langues écrites ; ne lève jamais
  - Fichier `{dir}/{lang}/{date}.json` : `{ date, lang, generatedAt, model, intro, topics }`

- [ ] **Step 1: Exporter `ENDPOINT` et `modelChain` du classeur**

Dans `scripts/lib/classify-rubrics.mjs`, rendre `ENDPOINT` exporté (`export const ENDPOINT = …`) et ajouter, juste après `FALLBACK_MODELS` :

```js
// La chaîne de modèles qu'OpenRouter essaie dans l'ordre. OPENROUTER_MODEL ou
// un modèle imposé la réduisent à un seul. Partagée avec la brève
// (scripts/lib/brief-generate.mjs) : un changement de modèle vaut pour les deux.
export function modelChain(forced = process.env.OPENROUTER_MODEL) {
  return forced ? [forced] : [DEFAULT_MODEL, ...FALLBACK_MODELS]
}
```

puis dans `classifyRubrics`, remplacer les deux lignes `const forced = …` / `const models = …` par :

```js
  const forced = model || process.env.OPENROUTER_MODEL
  const models = modelChain(forced)
```

Run: `node --test test/classify-rubrics.test.mjs` → PASS (rien ne change).

- [ ] **Step 2: Écrire le test qui échoue** — `test/brief-generate.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  buildBriefMessages,
  parseBrief,
  generateBriefs,
  MAX_TOPICS,
} from '../scripts/lib/brief-generate.mjs'

const articles = [
  { id: 1, source: 'armenpress', rubric: 'politique', title: 'A', url: 'https://a/1', date: 'x' },
  { id: 2, source: 'civilnet', rubric: 'politique', title: 'B', url: 'https://b/2', date: 'x' },
  { id: 3, source: 'courrier', rubric: 'economie', title: 'C', url: 'https://c/3', date: 'x' },
]
const topic = (ids, extra = {}) => ({ title: 'Sujet', text: 'Texte.', rubric: 'politique', ids, ...extra })

test('buildBriefMessages : langue cible, ids, sources et rubriques', () => {
  const [sys, user] = buildBriefMessages('ru', articles)
  assert.equal(sys.role, 'system')
  assert.match(sys.content, /russe/)
  assert.match(sys.content, /JSON/)
  assert.match(user.content, /^1\. \[armenpress · politique\] A$/m)
  assert.match(user.content, /^3\. \[courrier · economie\] C$/m)
})

test('parseBrief : JSON entouré de texte, ids en chaînes, doublons', () => {
  const reply =
    'Voici :\n```json\n' +
    JSON.stringify({
      intro: ' Intro  du jour ',
      topics: [topic(['1', 2, 2, 1]), topic([3], { rubric: 'Economie' }), topic([2])],
    }) +
    '\n```'
  const b = parseBrief(reply, articles)
  assert.equal(b.intro, 'Intro du jour')
  assert.equal(b.topics.length, 3)
  assert.deepEqual(
    b.topics[0].sources,
    [
      { source: 'armenpress', url: 'https://a/1', title: 'A' },
      { source: 'civilnet', url: 'https://b/2', title: 'B' },
    ],
  )
  assert.equal(b.topics[1].rubric, 'economie')
})

test('parseBrief : aucune URL ne vient du modèle', () => {
  const reply = JSON.stringify({
    topics: [topic([1], { url: 'https://evil' }), topic([2]), topic([3]), topic([99])],
  })
  const b = parseBrief(reply, articles)
  assert.equal(b.topics.length, 3, 'le sujet à id inconnu est retiré')
  assert.ok(!JSON.stringify(b).includes('evil'))
})

test('parseBrief : rubrique inconnue → null, plafond de sujets', () => {
  const many = Array.from({ length: MAX_TOPICS + 3 }, () => topic([1], { rubric: 'météo' }))
  const b = parseBrief(JSON.stringify({ intro: 'i', topics: many }), articles)
  assert.equal(b.topics.length, MAX_TOPICS)
  assert.equal(b.topics[0].rubric, null)
})

test('parseBrief : rejets', () => {
  assert.equal(parseBrief('pas de JSON', articles), null)
  assert.equal(parseBrief('{ cassé', articles), null)
  assert.equal(parseBrief(JSON.stringify({ topics: [topic([1]), topic([2])] }), articles), null)
  assert.equal(parseBrief(JSON.stringify({ topics: [topic([]), topic([1]), topic([2])] }), articles), null)
  assert.equal(parseBrief(undefined, articles), null)
})

// ---- generateBriefs, réseau simulé ----

const NOW = new Date('2026-10-16T05:00:00Z') // 09:00 à Erevan
const recent = (i) => ({ title: `T${i}`, url: `https://x/${i}`, date: '2026-10-16T04:00:00Z' })
const news = {
  courrier: [{ sectionKey: 'societe', articles: Array.from({ length: 12 }, (_, i) => recent(i)) }],
  armenpress: { en: [{ categoryKey: 'armenia', articles: [recent(100)] }] },
}
const okReply = JSON.stringify({ intro: 'Intro', topics: [topic([1, 2]), topic([3]), topic([4])] })
const fakeFetch = (content, calls) => async (url, init) => {
  calls.push(JSON.parse(init.body))
  return { ok: true, json: async () => ({ model: 'm:free', choices: [{ message: { content } }] }) }
}
const quiet = { log() {}, warn() {} }

test('generateBriefs : écrit la brève due, saute les langues trop minces', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  const calls = []
  const done = await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls), log: quiet,
  })
  assert.deepEqual(done, ['fr'])
  assert.equal(calls.length, 1, 'en n’a qu’un article : pas d’appel')
  assert.equal(calls[0].reasoning.enabled, false)
  const b = JSON.parse(await readFile(path.join(dir, 'fr', '2026-10-16.json'), 'utf-8'))
  assert.equal(b.date, '2026-10-16')
  assert.equal(b.lang, 'fr')
  assert.equal(b.model, 'm:free')
  assert.equal(b.generatedAt, NOW.toISOString())
  assert.match(b.topics[0].sources[0].url, /^https:\/\/x\/\d+$/)
})

test('generateBriefs : jamais régénérée, rien avant 7 h, rien sans clé', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  await mkdir(path.join(dir, 'fr'), { recursive: true })
  await writeFile(path.join(dir, 'fr', '2026-10-16.json'), '{"keep":true}')
  const calls = []
  assert.deepEqual(
    await generateBriefs({ news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls), log: quiet }),
    [],
  )
  assert.equal(await readFile(path.join(dir, 'fr', '2026-10-16.json'), 'utf-8'), '{"keep":true}')

  const early = new Date('2026-10-16T02:00:00Z') // 06:00 à Erevan
  const dir2 = await mkdtemp(path.join(tmpdir(), 'brief-'))
  assert.deepEqual(
    await generateBriefs({ news, now: early, dir: dir2, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls), log: quiet }),
    [],
  )
  // `force` ignore l'heure (CLI), jamais l'existence du fichier.
  assert.deepEqual(
    await generateBriefs({ news, now: early, dir: dir2, apiKey: 'k', force: true, fetchImpl: fakeFetch(okReply, calls), log: quiet }),
    ['fr'],
  )

  const dir3 = await mkdtemp(path.join(tmpdir(), 'brief-'))
  assert.deepEqual(await generateBriefs({ news, now: NOW, dir: dir3, apiKey: '', log: quiet }), [])
  assert.deepEqual(await readdir(dir3), [])
})

test('generateBriefs : réponse invalide ou réseau en échec → rien écrit, ne lève pas', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  const warns = []
  const log = { log() {}, warn: (m) => warns.push(m) }
  await generateBriefs({ news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch('n’importe quoi', []), log })
  await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', log,
    fetchImpl: async () => { throw new Error('timeout') },
  })
  await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', log,
    fetchImpl: async () => ({ ok: false, status: 429 }),
  })
  assert.deepEqual(await readdir(dir), [])
  assert.ok(warns.some((w) => /✗ brief\/fr: réponse invalide/.test(w)))
  assert.ok(warns.some((w) => /✗ brief\/fr: timeout/.test(w)))
  assert.ok(warns.some((w) => /✗ brief\/fr: HTTP 429/.test(w)))
  assert.ok(warns.every((w) => !w.includes('Bearer')))
})
```

- [ ] **Step 3: Lancer pour voir l'échec**

Run: `node --test test/brief-generate.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Implémenter `scripts/lib/brief-generate.mjs`**

```js
// La brève quotidienne : une synthèse des titres du jour qui CROISE les
// sources et renvoie à leurs articles. Une par langue et par jour d'Erevan.
//
// LE MODÈLE NE FOURNIT JAMAIS D'URL. Il reçoit des titres numérotés et répond
// par des numéros ; c'est le code qui en fait des liens, depuis les articles
// envoyés. Un numéro inconnu est ignoré. Ce n'est pas un filtre sur le texte
// (le propriétaire a choisi la publication automatique, sans garde-fou), c'est
// ce qui empêche un lien inventé de mener à un 404 ou à un site tiers.
//
// LE PIÈGE, le même que le classeur : un échec n'écrit rien et ne casse rien.
// Le passage de l'heure suivante réessaie ; le seul signe est « ✗ brief » au
// log, et une journée sans page datée.
import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { RUBRICS } from '../../src/rubrics.js'
import { ALL_LANGS } from '../../sites.config.js'
import { ENDPOINT, modelChain } from './classify-rubrics.mjs'
import { selectArticles, yerevanClock, isBriefDue, MIN_ARTICLES } from './brief-select.mjs'

export const MIN_TOPICS = 3
export const MAX_TOPICS = 7
// Un seul appel par langue et par jour : on peut attendre. Le classeur, lui,
// dépassait déjà 90 s sur 80 titres (15 octobre 2026).
export const BRIEF_TIMEOUT_MS = 180000

const LANG_NAME = {
  fr: 'français',
  en: 'anglais',
  hy: 'arménien oriental (orthographe de la République d’Arménie)',
  ru: 'russe',
}

export function buildBriefMessages(lang, articles) {
  const list = articles.map((a) => `${a.id}. [${a.source} · ${a.rubric}] ${a.title}`).join('\n')
  const system =
    "Tu rédiges la brève quotidienne d'un site d'actualité arménienne, à partir des titres du jour " +
    'de plusieurs rédactions (chaque ligne : numéro, [source · rubrique], titre). ' +
    `Écris en ${LANG_NAME[lang]}, dans un style neutre et factuel. ` +
    `Choisis entre ${MIN_TOPICS + 2} et ${MAX_TOPICS} sujets du jour, en privilégiant ceux que PLUSIEURS sources couvrent. ` +
    'Pour chaque sujet : un titre court, 2 ou 3 phrases, une rubrique parmi ' +
    `${RUBRICS.join(', ')}, et la liste des numéros des titres qui le traitent. ` +
    "N'affirme rien qui ne figure pas dans les titres ; ne cite aucune URL. " +
    'Commence par une introduction d’une ou deux phrases. ' +
    'Réponds UNIQUEMENT par un objet JSON ' +
    '{"intro": "…", "topics": [{"title": "…", "text": "…", "rubric": "…", "ids": [1, 2]}]}, sans aucun texte autour.'
  return [
    { role: 'system', content: system },
    { role: 'user', content: list },
  ]
}

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

// La réponse du modèle → { intro, topics }, ou null si elle est inexploitable.
// Tolère le texte et les clôtures autour du JSON. Ne lève jamais.
export function parseBrief(text, articles) {
  const m = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj
  try {
    obj = JSON.parse(m[0])
  } catch {
    return null
  }
  const byId = new Map(articles.map((a) => [a.id, a]))
  const topics = []
  for (const t of Array.isArray(obj?.topics) ? obj.topics : []) {
    const title = clean(t?.title)
    const body = clean(t?.text)
    if (!title || !body) continue
    const seen = new Set()
    const sources = []
    for (const raw of Array.isArray(t?.ids) ? t.ids : []) {
      const a = byId.get(Number(raw))
      if (!a || seen.has(a.url)) continue
      seen.add(a.url)
      sources.push({ source: a.source, url: a.url, title: a.title })
    }
    if (!sources.length) continue
    const r = clean(t?.rubric).toLowerCase()
    topics.push({ title, text: body, rubric: RUBRICS.includes(r) ? r : null, sources })
    if (topics.length === MAX_TOPICS) break
  }
  if (topics.length < MIN_TOPICS) return null
  return { intro: clean(obj?.intro), topics }
}

const exists = (p) => access(p).then(() => true, () => false)

// Une brève par langue due. NE LÈVE JAMAIS — chaque langue échoue seule.
// `force` ignore l'heure (CLI `npm run brief -- --force`), jamais l'existence
// du fichier : une brève publiée ne se réécrit pas.
// La clé n'est jamais écrite dans le log.
export async function generateBriefs({
  news,
  now = new Date(),
  dir,
  apiKey = process.env.OPENROUTER_API_KEY,
  model,
  fetchImpl = fetch,
  timeoutMs = BRIEF_TIMEOUT_MS,
  log = console,
  force = false,
} = {}) {
  const { date, hour } = yerevanClock(now)
  const written = []
  for (const lang of ALL_LANGS) {
    const file = path.join(dir, lang, `${date}.json`)
    try {
      const has = await exists(file)
      if (has) continue
      if (!force && !isBriefDue(now, has)) {
        log.log(`  · brief/${lang}: ${hour} h à Erevan, attend ${date} 7 h`)
        continue
      }
      const articles = selectArticles(news, lang, now)
      if (articles.length < MIN_ARTICLES) {
        log.log(`  · brief/${lang}: trop peu d'articles (${articles.length})`)
        continue
      }
      if (!apiKey) {
        log.warn(`  ✗ brief/${lang}: OPENROUTER_API_KEY absente`)
        continue
      }
      const models = modelChain(model || process.env.OPENROUTER_MODEL)
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://armenieinfo.ch',
          'X-Title': 'Armenie Info',
        },
        body: JSON.stringify({
          models,
          temperature: 0.3,
          reasoning: { enabled: false },
          messages: buildBriefMessages(lang, articles),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const brief = parseBrief(body?.choices?.[0]?.message?.content, articles)
      if (!brief) {
        log.warn(`  ✗ brief/${lang}: réponse invalide`)
        continue
      }
      const used = body?.model || models[0]
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(
        file,
        JSON.stringify({ date, lang, generatedAt: now.toISOString(), model: used, ...brief }, null, 2) + '\n',
        'utf-8',
      )
      written.push(lang)
      log.log(`  ✓ brief/${lang}: ${brief.topics.length} sujets sur ${articles.length} titres (${used})`)
    } catch (err) {
      log.warn(`  ✗ brief/${lang}: ${err.message}`)
    }
  }
  return written
}
```

- [ ] **Step 5: Lancer les tests**

Run: `node --test test/brief-generate.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 6: Brancher au scrape**

Dans `scripts/scrape.mjs`, ajouter l'import `import { generateBriefs } from './lib/brief-generate.mjs'`, puis **après** `await writeJson('news.json', newsOut)` :

```js
  // La brève quotidienne, une fois par jour et par langue (scripts/lib/
  // brief-generate.mjs). Lue sur newsOut, donc avec les rubriques du
  // classeur. Un échec n'écrit rien ; le passage suivant réessaie.
  console.log('\nBrève quotidienne:')
  await generateBriefs({ news: newsOut, dir: join(__dirname, '../src/data/briefs') })
```

Vérifier que le chemin des autres `writeJson` est bien `join(__dirname, '../src/data', name)` (lire `writeJson`, ligne ~53) et aligner le `dir` sur le même dossier. Créer `src/data/briefs/.gitkeep` (fichier vide) pour que le dossier existe dans le dépôt, et vérifier que l'étape de commit de `hourly.yml` ajoute bien `src/data/` en entier (`grep -n "git add" .github/workflows/hourly.yml`) ; si elle liste des fichiers un par un, y ajouter `src/data/briefs`.

- [ ] **Step 7: CLI `npm run brief`**

`scripts/brief.mjs` :

```js
/**
 * Génère la brève du jour hors du scrape, sur le news.json actuel.
 *
 *   npm run brief                 # les langues dues (7 h à Erevan passé)
 *   npm run brief -- --force      # ignore l'heure (jamais un fichier existant)
 *   npm run brief -- --dry        # n'écrit rien : affiche la brève en console
 *
 * La clé vient de OPENROUTER_API_KEY ou du .env local.
 */
import { readFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateBriefs } from './lib/brief-generate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // pas de .env : la variable d'environnement suffit
}
const force = process.argv.includes('--force')
const dry = process.argv.includes('--dry')
const news = JSON.parse(await readFile(path.join(root, 'src/data/news.json'), 'utf-8'))
const dir = dry ? await mkdtemp(path.join(tmpdir(), 'brief-')) : path.join(root, 'src/data/briefs')
const done = await generateBriefs({ news, dir, force })
if (dry)
  for (const lang of done)
    for (const f of await readdir(path.join(dir, lang)))
      console.log(`\n── ${lang}/${f}\n` + (await readFile(path.join(dir, lang, f), 'utf-8')))
```

Dans `package.json`, ajouter `"brief": "node scripts/brief.mjs",` après `"scrape"`.

- [ ] **Step 8: Essai réel (réseau) — le seul qui dise si le modèle gratuit tient**

Run: `npm run brief -- --dry --force`
Expected: pour chaque langue, `✓ brief/{lang}: N sujets sur M titres (modèle)` en moins de 180 s, puis le JSON. Lire au moins fr et hy : sujets dans la bonne langue, sources pertinentes. Si une langue échoue en délai ou en 429, noter le modèle et la durée dans le rapport de tâche ; si **toutes** échouent, s'arrêter et rapporter (ne pas changer le modèle sans accord). Si la clé manque localement, demander à l'utilisateur de la poser via l'invite masquée (`$k = Read-Host -AsSecureString`) plutôt que de la coller dans le chat.

- [ ] **Step 9: Suite complète et lint**

Run: `npm test && npm run lint`
Expected: PASS ; `0 errors, 5 warnings`.

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/brief-generate.mjs scripts/lib/classify-rubrics.mjs scripts/brief.mjs scripts/scrape.mjs package.json src/data/briefs/.gitkeep test/brief-generate.test.mjs .github/workflows/hourly.yml
git commit -m "Brève : génération quotidienne au scrape et CLI npm run brief

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`hourly.yml` seulement s'il a été modifié au Step 6.)

---

### Task 4: Adresses des brèves dans `sites.config.js`

**Files:**
- Modify: `sites.config.js` (après `pathFor`, ~ligne 251)
- Create: `test/brief-urls.test.mjs`

**Interfaces:**
- Consumes: `LANG_URL`, `SITES`, `siteOf` (existants)
- Produces:
  - `BRIEF_SLUGS: { fr: 'breve/', en: 'brief/', hy: 'brief/', ru: 'brief/' }`
  - `briefUrl(lang, date = null): string` — absolue, slash final
  - `briefPath(lang, date = null): string` — sans hôte, slash final

- [ ] **Step 1: Écrire le test qui échoue**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BRIEF_SLUGS, briefUrl, briefPath, ALL_LANGS, ALL_VIEWS, VIEWS } from '../sites.config.js'

test('les adresses de la brève', () => {
  assert.equal(briefUrl('fr'), 'https://armenieinfo.ch/breve/')
  assert.equal(briefUrl('en'), 'https://armenianews.org/brief/')
  assert.equal(briefUrl('hy', '2026-10-16'), 'https://armenianews.org/hy/brief/2026-10-16/')
  assert.equal(briefPath('ru', '2026-10-16'), '/ru/brief/2026-10-16/')
  assert.equal(briefPath('fr'), '/breve/')
})

test('slash final partout (Firebase redirige la forme sans)', () => {
  for (const l of ALL_LANGS) {
    assert.match(BRIEF_SLUGS[l], /^[a-z]+\/$/)
    assert.ok(briefUrl(l, '2026-01-02').endsWith('/2026-01-02/'))
  }
})

test('date mal formée refusée', () => {
  assert.throws(() => briefUrl('fr', '16-10-2026'))
  assert.throws(() => briefUrl('xx'))
})

test('aucun slug de brève ne heurte une vue', () => {
  for (const l of ALL_LANGS)
    for (const v of ALL_VIEWS) assert.notEqual(VIEWS[v].slugs[l], BRIEF_SLUGS[l], `${l}/${v}`)
})
```

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `node --test test/brief-urls.test.mjs` → FAIL (`BRIEF_SLUGS` non exporté).

- [ ] **Step 3: Implémenter** — dans `sites.config.js`, après `pathFor` :

```js
// La brève quotidienne (scripts/lib/brief-pages.mjs). Ce n'est PAS une vue :
// pas de route React, pas de prérendu — des HTML statiques écrits au build,
// une page par jour et par langue. D'où une table à part, mais les mêmes
// règles que VIEWS : slug latin, traduit là où le mot change (« brève » n'est
// pas un mot anglais), et SLASH FINAL, pour la même raison (Firebase redirige
// en 301 toute URL de répertoire vers sa forme à slash final).
export const BRIEF_SLUGS = { fr: 'breve/', en: 'brief/', hy: 'brief/', ru: 'brief/' }

const BRIEF_DATE = /^\d{4}-\d{2}-\d{2}$/

export function briefUrl(lang, date = null) {
  const slug = BRIEF_SLUGS[lang]
  if (!slug) throw new Error(`pas de brève en ${lang}`)
  if (date !== null && !BRIEF_DATE.test(date)) throw new Error(`date de brève invalide : ${date}`)
  return LANG_URL[lang] + slug + (date ? `${date}/` : '')
}

export function briefPath(lang, date = null) {
  return briefUrl(lang, date).slice(SITES[siteOf(lang)].host.length)
}
```

(`siteOf` est déclarée plus bas en `function` : hissée, donc utilisable.)

- [ ] **Step 4: Lancer** — `node --test test/brief-urls.test.mjs` → PASS ; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add sites.config.js test/brief-urls.test.mjs
git commit -m "Brève : adresses dérivées de sites.config.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Liens entre langues et en-tête HTML d'une brève

**Files:**
- Create: `scripts/lib/brief-links.mjs`, `test/brief-head.test.mjs`
- Modify: `scripts/lib/site-meta.mjs` (factoriser `headFor` en `composeHead`, ajouter `briefHeadFor`)

**Interfaces:**
- Consumes: `briefUrl` (Task 4) ; `BRIEF_STRINGS` (Task 1)
- Produces:
  - `briefLangsByDate(briefs: Record<lang, Brief[]>): Map<date, lang[]>` — langues dans l'ordre `ALL_LANGS`
  - `briefAlternates(date: string|null, byDate: Map): Array<[hreflang, href]>` — `x-default` inclus
  - `longDate(lang, date): string` (exporté de `brief-links.mjs`, utilisé par l'en-tête et les pages)
  - `briefHeadFor({ siteId, lang, date = null, brief = null, byDate }): string` — même enveloppe `META_START…META_END` que `headFor`
  - `Brief` = l'objet JSON écrit en Task 3

- [ ] **Step 1: Écrire le test qui échoue** — `test/brief-head.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { briefLangsByDate, briefAlternates, longDate } from '../scripts/lib/brief-links.mjs'
import { briefHeadFor, headFor } from '../scripts/lib/site-meta.mjs'
import { briefUrl } from '../sites.config.js'

const b = (lang, date, extra = {}) => ({
  date, lang, generatedAt: `${date}T03:23:00Z`, model: 'm', intro: `Intro ${lang}`,
  topics: [{ title: 'T', text: 'x', rubric: 'politique', sources: [{ source: 'armenpress', url: 'https://a/1', title: 'A' }] }],
  ...extra,
})
const briefs = {
  fr: [b('fr', '2026-10-16')],
  en: [b('en', '2026-10-15')],
  hy: [b('hy', '2026-10-16'), b('hy', '2026-10-15')],
  ru: [],
}

test('briefLangsByDate : langues présentes par date, ordre ALL_LANGS', () => {
  const m = briefLangsByDate(briefs)
  assert.deepEqual(m.get('2026-10-16'), ['fr', 'hy'])
  assert.deepEqual(m.get('2026-10-15'), ['en', 'hy'])
})

test('briefAlternates : index = quatre langues + x-default anglais', () => {
  const alt = briefAlternates(null, briefLangsByDate(briefs))
  assert.deepEqual(alt.map(([h]) => h), ['fr', 'en', 'hy', 'ru', 'x-default'])
  assert.equal(alt.at(-1)[1], briefUrl('en'))
})

test('briefAlternates : page datée = langues présentes seulement', () => {
  const byDate = briefLangsByDate(briefs)
  // en absent le 16 : pas de x-default (il désignerait une page inexistante).
  assert.deepEqual(briefAlternates('2026-10-16', byDate), [
    ['fr', briefUrl('fr', '2026-10-16')],
    ['hy', briefUrl('hy', '2026-10-16')],
  ])
  assert.deepEqual(briefAlternates('2026-10-15', byDate).map(([h]) => h), ['en', 'hy', 'x-default'])
})

test('longDate : fr/en/ru par Intl (Node), hy par hyDate', () => {
  assert.equal(longDate('fr', '2026-10-16'), 'vendredi 16 octobre 2026')
  assert.equal(longDate('en', '2026-10-16'), 'Friday, October 16, 2026')
  assert.match(longDate('hy', '2026-10-16'), /^16 հոկտեմբերի, 2026 թ\.$/)
  assert.match(longDate('ru', '2026-10-16'), /16 октября 2026/)
})

test('briefHeadFor : page datée', () => {
  const byDate = briefLangsByDate(briefs)
  const h = briefHeadFor({ siteId: 'org', lang: 'hy', date: '2026-10-16', brief: briefs.hy[0], byDate })
  assert.ok(h.includes(`<link rel="canonical" href="${briefUrl('hy', '2026-10-16')}" />`))
  assert.equal((h.match(/hreflang=/g) || []).length, 2)
  assert.ok(!h.includes('hreflang="en"'))
  assert.ok(h.includes('<meta property="og:type" content="article" />'))
  assert.ok(h.includes('"@type":"NewsArticle"'))
  assert.ok(h.includes('"citation":["https://a/1"]'))
  assert.ok(h.includes('content="Intro hy"'))
})

test('briefHeadFor : index sans brève — description par défaut, quatre langues', () => {
  const h = briefHeadFor({ siteId: 'ch', lang: 'fr', byDate: new Map() })
  assert.ok(h.includes(`<link rel="canonical" href="${briefUrl('fr')}" />`))
  assert.equal((h.match(/hreflang=/g) || []).length, 5)
  assert.ok(h.includes('<title>La brève du jour · Arménie Info</title>'))
  assert.ok(!h.includes('NewsArticle'))
})

test('briefHeadFor échappe < dans le JSON-LD', () => {
  const evil = b('fr', '2026-10-16', { intro: '</script><script>alert(1)</script>' })
  const h = briefHeadFor({ siteId: 'ch', lang: 'fr', date: '2026-10-16', brief: evil, byDate: briefLangsByDate({ fr: [evil] }) })
  assert.ok(!h.includes('</script><script>'))
})

test('headFor inchangé par la factorisation', () => {
  // Instantané de garde : la sortie actuelle, capturée AVANT le Step 3.
  assert.equal(headFor({ siteId: 'ch', lang: 'fr', view: 'radio' }), HEAD_SNAPSHOT)
})
```

Pour le dernier test : **avant toute modification** de `site-meta.mjs`, générer l'instantané :
`node -e "import('./scripts/lib/site-meta.mjs').then(m=>require('fs').writeFileSync('test/fixtures/head-ch-fr-radio.txt', m.headFor({siteId:'ch',lang:'fr',view:'radio'})))"`
et remplacer `HEAD_SNAPSHOT` par `readFileSync(new URL('./fixtures/head-ch-fr-radio.txt', import.meta.url), 'utf-8')` (avec `import { readFileSync } from 'node:fs'`). Si `test/fixtures/` n'existe pas, le créer. Si `longDate('ru', …)` ou `'fr'` diffère d'un détail typographique (casse, « г. »), corriger l'**attendu** du test en le recopiant de la sortie de Node, pas l'implémentation.

- [ ] **Step 2: Lancer pour voir l'échec** — `node --test test/brief-head.test.mjs` → FAIL (module introuvable).

- [ ] **Step 3: Implémenter `scripts/lib/brief-links.mjs`**

```js
// Les liens entre les versions linguistiques d'une brève, partagés par
// l'en-tête HTML (site-meta.mjs) et le sitemap (sitemap.mjs) : deux
// générateurs qui divergeraient feraient ignorer le bloc par Google.
//
// LE PIÈGE : une page datée ne doit citer QUE les langues qui ont une brève ce
// jour-là. Les quatre langues ne paraissent pas forcément le même jour (modèle
// en échec, trop peu d'articles) ; un hreflang vers une page absente fait
// ignorer TOUT le bloc, silencieusement. L'index (/breve/), lui, existe
// toujours dans les quatre langues.
import { ALL_LANGS, briefUrl } from '../../sites.config.js'
import { hyLongDate } from '../../src/hyDate.js'

export function briefLangsByDate(briefs) {
  const m = new Map()
  for (const lang of ALL_LANGS)
    for (const b of briefs[lang] ?? []) m.set(b.date, [...(m.get(b.date) ?? []), lang])
  for (const [d, langs] of m) m.set(d, ALL_LANGS.filter((l) => langs.includes(l)))
  return m
}

export function briefAlternates(date, byDate) {
  const langs = date === null ? ALL_LANGS : (byDate.get(date) ?? [])
  const out = langs.map((l) => [l, briefUrl(l, date)])
  if (langs.includes('en')) out.push(['x-default', briefUrl('en', date)])
  return out
}

// La date en toutes lettres. Côté NODE seulement (build) : Intl y a l'ICU
// complet. L'arménien passe malgré tout par src/hyDate.js, comme partout dans
// le dépôt — une seule table de mois arméniens.
const LOCALE = { fr: 'fr-FR', en: 'en-US', ru: 'ru-RU' }
export function longDate(lang, date) {
  const [y, m, d] = date.split('-').map(Number)
  if (lang === 'hy') return hyLongDate(new Date(y, m - 1, d))
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  )
}
```

- [ ] **Step 4: Factoriser `headFor` et ajouter `briefHeadFor` dans `site-meta.mjs`**

1. Transformer `jsonLd(site, lang)` en `siteGraph(site, lang)` qui **rend le tableau** `graph` (sans `JSON.stringify`), et ajouter :

```js
const ldScript = (graph) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
```

2. Extraire le corps de `headFor` (de `const lines = [` à la fin) dans :

```js
// Le <head> commun à toutes les pages bâties : accueil, vues, brèves. Ce qui
// varie est passé en paramètres ; le reste (préchargements, Search Console,
// bloc Open Graph de six balises pour l'image, Twitter, JSON-LD) est écrit
// UNE fois — la brève ne doit pas devenir une seconde copie à tenir à jour.
function composeHead({ site, lang, url, title, description, keywords, alternates, ogType, graph }) {
  // … le tableau `lines` actuel, avec ces substitutions :
  //   - les lignes hreflang : ...alternates.map(([h, href]) => `<link rel="alternate" hreflang="${h}" href="${href}" />`)
  //     (le commentaire « Versions linguistiques » reste au-dessus) ;
  //   - `<meta name="keywords" …>` seulement si `keywords` est fourni ;
  //   - og:type : `content="${ogType}"` ;
  //   - le JSON-LD : `${ldScript(graph)}`.
  // … puis le `body` et le `return` actuels.
}
```

et réduire `headFor` à ses gardes + :

```js
  return composeHead({
    site, lang, url, title, description, keywords,
    alternates: [
      ...ALL_LANGS.map((l) => [l, urlFor(l, view)]),
      ['x-default', xDefaultFor(view)],
    ],
    ogType: 'website',
    graph: siteGraph(site, lang),
  })
```

3. Ajouter :

```js
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { briefUrl } from '../../sites.config.js' // fusionner avec l'import existant
import { briefAlternates, longDate } from './brief-links.mjs'

// L'en-tête d'une page de brève : `/breve/` (date null) ou une page datée.
// Mêmes balises que les vues, via composeHead ; ce qui change : le hreflang
// (langues présentes ce jour-là, voir brief-links.mjs), og:type article et un
// NewsArticle qui cite les URL sources.
export function briefHeadFor({ siteId, lang, date = null, brief = null, byDate }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  const s = BRIEF_STRINGS[lang]
  if (!s) throw new Error(`pas de chaînes de brève en ${lang}`)
  const url = briefUrl(lang, date)
  const title = date
    ? `${s.title} — ${longDate(lang, date)} · ${site.brand}`
    : `${s.title} · ${site.brand}`
  const description = (date && brief?.intro) || s.description
  const graph = siteGraph(site, lang)
  if (date && brief) {
    graph.push({
      '@type': 'NewsArticle',
      '@id': `${url}#article`,
      headline: `${s.title} — ${longDate(lang, date)}`,
      description,
      url,
      mainEntityOfPage: url,
      datePublished: brief.generatedAt,
      inLanguage: lang,
      isAccessibleForFree: true,
      publisher: { '@id': `${site.host}/#organization` },
      citation: brief.topics.flatMap((t) => t.sources.map((x) => x.url)),
    })
  }
  return composeHead({
    site, lang, url, title, description,
    alternates: briefAlternates(date, byDate),
    ogType: date ? 'article' : 'website',
    graph,
  })
}
```

- [ ] **Step 5: Lancer** — `node --test test/brief-head.test.mjs test/site-meta.test.mjs test/views.test.mjs` → PASS ; puis `npm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/brief-links.mjs scripts/lib/site-meta.mjs test/brief-head.test.mjs test/fixtures/head-ch-fr-radio.txt
git commit -m "Brève : en-tête HTML et hreflang limités aux langues présentes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pages statiques, sitemap et branchement au build

**Files:**
- Create: `scripts/lib/brief-pages.mjs`, `test/brief-pages.test.mjs`
- Modify: `scripts/lib/sitemap.mjs`, `scripts/build-sites.mjs`, `test/sitemap.test.mjs` (si les appels existants doivent passer un 3e argument — ce n'est pas le cas : il est optionnel)

**Interfaces:**
- Consumes: `briefHeadFor`, `beaconTag`, `gaTag` (`site-meta.mjs`) ; `briefLangsByDate`, `briefAlternates`, `longDate` (Task 5) ; `briefUrl`, `briefPath`, `pathFor`, `langPath`, `SITES` ; `BRIEF_STRINGS`, `RUBRIC_LABELS`, `SOURCE_NAMES` ; `VIEW_SEO` (`src/seo.js`)
- Produces:
  - `loadBriefs(dir, log = console): Promise<Record<lang, Brief[]>>` — plus récente d'abord ; fichier illisible ou incohérent ignoré avec `⚠`
  - `cssHrefFrom(html): string`
  - `briefPageHtml({ siteId, lang, brief, list, byDate, cssHref }): string`
  - `briefIndexHtml({ siteId, lang, list, byDate, cssHref }): string`
  - `writeBriefPages(site, dist, briefs, cssHref): Promise<number>` — nombre de pages écrites
  - `sitemapFor(siteId, lastmod, briefs = {})`

- [ ] **Step 1: Écrire le test qui échoue** — `test/brief-pages.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  loadBriefs, cssHrefFrom, briefPageHtml, briefIndexHtml, writeBriefPages,
} from '../scripts/lib/brief-pages.mjs'
import { briefLangsByDate } from '../scripts/lib/brief-links.mjs'
import { sitemapFor } from '../scripts/lib/sitemap.mjs'
import { SITES, briefUrl, briefPath } from '../sites.config.js'

const b = (lang, date, extra = {}) => ({
  date, lang, generatedAt: `${date}T03:23:00Z`, model: 'm', intro: 'Intro & <b>',
  topics: [
    { title: 'Titre "1" <script>', text: 'Texte & suite.', rubric: 'politique',
      sources: [
        { source: 'armenpress', url: 'https://a/1?x=1&y=2', title: 'A' },
        { source: 'civilnet', url: 'https://b/2', title: 'B' },
      ] },
    { title: 'Deux', text: 'x', rubric: null, sources: [{ source: 'courrier', url: 'https://c/3', title: 'C' }] },
  ],
  ...extra,
})
const CSS = '/assets/index-abc.css'

test('cssHrefFrom lit la feuille hachée du HTML bâti', () => {
  assert.equal(cssHrefFrom('<link rel="stylesheet" crossorigin href="/assets/index-DpuyAKNh.css">'), '/assets/index-DpuyAKNh.css')
  assert.throws(() => cssHrefFrom('<html></html>'))
})

test('loadBriefs : tri, fichiers corrompus ignorés', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'briefs-'))
  await mkdir(path.join(dir, 'fr'))
  await writeFile(path.join(dir, 'fr', '2026-10-15.json'), JSON.stringify(b('fr', '2026-10-15')))
  await writeFile(path.join(dir, 'fr', '2026-10-16.json'), JSON.stringify(b('fr', '2026-10-16')))
  await writeFile(path.join(dir, 'fr', '2026-10-17.json'), '{ cassé')
  await writeFile(path.join(dir, 'fr', '2026-10-18.json'), JSON.stringify(b('fr', '2026-10-01')))
  const warns = []
  const got = await loadBriefs(dir, { warn: (m) => warns.push(m) })
  assert.deepEqual(got.fr.map((x) => x.date), ['2026-10-16', '2026-10-15'])
  assert.deepEqual(got.en, [])
  assert.equal(warns.length, 2)
})

test('page datée : contenu, échappement, liens, veille/lendemain', () => {
  const list = [b('fr', '2026-10-17'), b('fr', '2026-10-16'), b('fr', '2026-10-15')]
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief: list[1], list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(html.includes('<html lang="fr">'))
  assert.ok(html.includes(`<link rel="stylesheet" href="${CSS}">`))
  assert.ok(html.includes('vendredi 16 octobre 2026'))
  assert.ok(html.includes('Titre &quot;1&quot; &lt;script&gt;'))
  assert.ok(!html.includes('Titre "1" <script>'))
  assert.ok(html.includes('Intro &amp; &lt;b&gt;'))
  assert.ok(html.includes('href="https://a/1?x=1&amp;y=2"'))
  assert.ok(html.includes('>Armenpress</a>'))
  assert.ok(html.includes('>Politique<'))
  assert.ok(html.includes(`href="${briefPath('fr', '2026-10-15')}"`), 'veille')
  assert.ok(html.includes(`href="${briefPath('fr', '2026-10-17')}"`), 'lendemain')
  assert.ok(html.includes('Synthèse automatique'))
  assert.ok(html.includes('data-brief="2026-10-16"'))
})

test('page datée la plus ancienne : pas de veille', () => {
  const list = [b('fr', '2026-10-16'), b('fr', '2026-10-15')]
  const html = briefPageHtml({ siteId: 'ch', lang: 'fr', brief: list[1], list, byDate: briefLangsByDate({ fr: list }), cssHref: CSS })
  assert.ok(!html.includes('← Veille'))
  assert.ok(html.includes('Lendemain →'))
})

test('index : dernière brève + archive ; vide : message d’attente', () => {
  const list = [b('en', '2026-10-16'), b('en', '2026-10-15')]
  const html = briefIndexHtml({ siteId: 'org', lang: 'en', list, byDate: briefLangsByDate({ en: list }), cssHref: CSS })
  assert.ok(html.includes(`<link rel="canonical" href="${briefUrl('en')}" />`))
  assert.ok(html.includes('Friday, October 16, 2026'))
  assert.ok(html.includes(`href="${briefPath('en', '2026-10-15')}"`))
  assert.ok(html.includes('data-brief="index"'))
  const empty = briefIndexHtml({ siteId: 'org', lang: 'ru', list: [], byDate: new Map(), cssHref: CSS })
  assert.ok(empty.includes('Первая сводка появится завтра утром.'))
  assert.ok(empty.includes('<html lang="ru">'))
})

test('writeBriefPages : chaque vitrine ne bâtit que ses langues', async () => {
  const dist = await mkdtemp(path.join(tmpdir(), 'dist-'))
  const briefs = { fr: [b('fr', '2026-10-16')], en: [b('en', '2026-10-16')], hy: [], ru: [] }
  const n = await writeBriefPages(SITES.org, dist, briefs, CSS)
  assert.equal(n, 4) // /brief/, /brief/2026-10-16/, /hy/brief/, /ru/brief/
  await readFile(path.join(dist, 'brief', '2026-10-16', 'index.html'), 'utf-8')
  await readFile(path.join(dist, 'hy', 'brief', 'index.html'), 'utf-8')
  await assert.rejects(readFile(path.join(dist, 'breve', 'index.html')))
})

test('sitemap : index des quatre langues, pages datées existantes seulement', () => {
  const briefs = { fr: [b('fr', '2026-10-16')], en: [], hy: [b('hy', '2026-10-16')], ru: [] }
  const org = sitemapFor('org', '2026-10-16T05:00:00Z', briefs)
  assert.ok(org.includes(`<loc>${briefUrl('en')}</loc>`))
  assert.ok(org.includes(`<loc>${briefUrl('hy', '2026-10-16')}</loc>`))
  assert.ok(!org.includes(`<loc>${briefUrl('en', '2026-10-16')}</loc>`))
  assert.ok(!org.includes('armenieinfo.ch/breve/2026-10-16/</loc>'))
  assert.ok(org.includes('<lastmod>2026-10-16T03:23:00Z</lastmod>'))
  // Sans brèves : les entrées d'index existent quand même.
  assert.ok(sitemapFor('ch', '2026-10-16T05:00:00Z').includes(`<loc>${briefUrl('fr')}</loc>`))
})
```

- [ ] **Step 2: Lancer pour voir l'échec** — `node --test test/brief-pages.test.mjs` → FAIL.

- [ ] **Step 3: Implémenter `scripts/lib/brief-pages.mjs`**

```js
/**
 * Les pages de la brève quotidienne — HTML complets écrits au build, hors du
 * bundle React et hors du prérendu (une page par jour et par langue : ~1 460
 * par an, que Puppeteer cuirait à chaque heure).
 *
 * Elles réutilisent la feuille CSS que Vite a produite (nom haché, lu dans le
 * index.html bâti) et theme-init.js : même palette, mêmes polices, même thème
 * jour/nuit que le site, sans son JavaScript. L'en-tête vient de
 * site-meta.mjs (briefHeadFor), comme pour toutes les pages bâties.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { SITES, ALL_LANGS, briefPath, pathFor, langPath, siteOf } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { RUBRIC_LABELS } from '../../src/rubricLabels.js'
import { SOURCE_NAMES } from '../../src/newsLangs.js'
import { VIEW_SEO } from '../../src/seo.js'
import { briefHeadFor, beaconTag, gaTag } from './site-meta.mjs'
import { briefLangsByDate, longDate } from './brief-links.mjs'

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/

// Toutes les brèves, par langue, la plus récente d'abord. Un fichier illisible
// ou dont la date ne correspond pas à son nom est IGNORÉ avec un avertissement :
// une brève corrompue ne doit pas empêcher le déploiement horaire.
export async function loadBriefs(dir, log = console) {
  const out = Object.fromEntries(ALL_LANGS.map((l) => [l, []]))
  for (const lang of ALL_LANGS) {
    let files = []
    try {
      files = await readdir(path.join(dir, lang))
    } catch {
      continue
    }
    for (const f of files) {
      const m = f.match(DATE_FILE)
      if (!m) continue
      try {
        const b = JSON.parse(await readFile(path.join(dir, lang, f), 'utf-8'))
        if (b.date !== m[1] || b.lang !== lang || !Array.isArray(b.topics) || !b.topics.length)
          throw new Error('contenu incohérent')
        out[lang].push(b)
      } catch (err) {
        log.warn(`  ⚠ brève ${lang}/${f} ignorée : ${err.message}`)
      }
    }
    out[lang].sort((a, b) => b.date.localeCompare(a.date))
  }
  return out
}

export function cssHrefFrom(html) {
  const m = html.match(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/)
  if (!m) throw new Error('feuille CSS de Vite introuvable dans index.html — build incomplet')
  return m[1]
}

function shell({ siteId, lang, head, cssHref, body }) {
  const s = BRIEF_STRINGS[lang]
  const nav = [
    [langPath(siteId, lang), s.home],
    [pathFor(lang, 'radio'), VIEW_SEO.radio[lang].title],
    [pathFor(lang, 'agenda'), VIEW_SEO.agenda[lang].title],
    [briefPath(lang), s.title],
  ]
    .map(([href, label]) => `<a href="${href}">${esc(label)}</a>`)
    .join('')
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#100f0d" />
    ${head}
    ${gaTag(siteId)}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <script src="/theme-init.js"></script>
    <link rel="stylesheet" href="${cssHref}">
  </head>
  <body class="brief-body">
    <header class="brief-nav">
      <div class="container brief-nav__inner">
        <a class="brief-nav__brand" href="${langPath(siteId, lang)}">${esc(s.brand)}</a>
        <nav class="brief-nav__links">${nav}</nav>
      </div>
    </header>
${body}
    ${beaconTag(siteId)}
  </body>
</html>
`
}

function topicsHtml(lang, brief) {
  const s = BRIEF_STRINGS[lang]
  return brief.topics
    .map((t) => {
      const rubric = t.rubric ? `<span class="brief__rubric">${esc(RUBRIC_LABELS[lang][t.rubric])}</span>` : ''
      const links = t.sources
        .map((x) => `<a href="${esc(x.url)}" rel="noopener" title="${esc(x.title)}">${esc(SOURCE_NAMES[x.source] ?? x.source)}</a>`)
        .join(' · ')
      return `        <li class="brief__topic">
          ${rubric}
          <h2 class="brief__topic-title">${esc(t.title)}</h2>
          <p class="brief__text">${esc(t.text)}</p>
          <p class="brief__sources">${esc(s.sources)} : ${links}</p>
        </li>`
    })
    .join('\n')
}

function briefBlock(lang, brief) {
  const s = BRIEF_STRINGS[lang]
  return `      <h1 class="brief__date">${esc(longDate(lang, brief.date))}</h1>
      ${brief.intro ? `<p class="brief__intro">${esc(brief.intro)}</p>` : ''}
      <ol class="brief__topics">
${topicsHtml(lang, brief)}
      </ol>
      <p class="brief__disclaimer">${esc(s.disclaimer)}</p>`
}

export function briefPageHtml({ siteId, lang, brief, list, byDate, cssHref }) {
  const s = BRIEF_STRINGS[lang]
  const i = list.findIndex((x) => x.date === brief.date)
  const newer = i > 0 ? list[i - 1] : null
  const older = i >= 0 && i < list.length - 1 ? list[i + 1] : null
  const pager = [
    older ? `<a rel="prev" href="${briefPath(lang, older.date)}">${esc(s.previous)}</a>` : '<span></span>',
    `<a href="${briefPath(lang)}">${esc(s.archive)}</a>`,
    newer ? `<a rel="next" href="${briefPath(lang, newer.date)}">${esc(s.next)}</a>` : '<span></span>',
  ].join('')
  const body = `    <main class="container brief" data-brief="${brief.date}">
      <p class="brief__kicker">${esc(s.title)}</p>
${briefBlock(lang, brief)}
      <nav class="brief__pager">${pager}</nav>
    </main>`
  const head = briefHeadFor({ siteId, lang, date: brief.date, brief, byDate })
  return shell({ siteId, lang, head, cssHref, body })
}

export function briefIndexHtml({ siteId, lang, list, byDate, cssHref }) {
  const s = BRIEF_STRINGS[lang]
  const [latest] = list
  const archive = list
    .map((b) => `<li><a href="${briefPath(lang, b.date)}">${esc(longDate(lang, b.date))}</a></li>`)
    .join('')
  const body = latest
    ? `    <main class="container brief" data-brief="index">
      <p class="brief__kicker">${esc(s.latest)}</p>
${briefBlock(lang, latest)}
      <section class="brief__archive">
        <h2>${esc(s.archive)}</h2>
        <ul>${archive}</ul>
      </section>
    </main>`
    : `    <main class="container brief" data-brief="index">
      <h1 class="brief__date">${esc(s.title)}</h1>
      <p class="brief__intro">${esc(s.empty)}</p>
    </main>`
  const head = briefHeadFor({ siteId, lang, byDate })
  return shell({ siteId, lang, head, cssHref, body })
}

// Les pages d'UNE vitrine : seulement ses langues (sites.config.js). Le .ch
// n'écrit jamais /brief/, le .org jamais /breve/.
export async function writeBriefPages(site, dist, briefs, cssHref) {
  const byDate = briefLangsByDate(briefs)
  let n = 0
  const put = async (rel, html) => {
    const dir = path.join(dist, rel.replace(/^\/|\/$/g, ''))
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    n++
  }
  for (const { lang } of site.pages) {
    if (siteOf(lang) !== site.id) continue
    const list = briefs[lang] ?? []
    await put(briefPath(lang), briefIndexHtml({ siteId: site.id, lang, list, byDate, cssHref }))
    for (const brief of list)
      await put(briefPath(lang, brief.date), briefPageHtml({ siteId: site.id, lang, brief, list, byDate, cssHref }))
  }
  return n
}
```

- [ ] **Step 4: Étendre `sitemapFor`** — dans `scripts/lib/sitemap.mjs`, importer `briefUrl` et `briefLangsByDate`, `briefAlternates`, puis :

```js
const xhtml = (alts) =>
  alts.map(([h, href]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${href}" />`).join('\n')

// Les brèves : l'index de chaque langue (toujours servi), et chaque page
// datée EXISTANTE, avec les mêmes alternates que son <head> (brief-links.mjs).
// lastmod d'une page datée = son generatedAt : elle ne change jamais.
function briefEntries(site, lastmod, briefs) {
  const byDate = briefLangsByDate(briefs)
  return site.pages.flatMap(({ lang }) => [
    `  <url>
    <loc>${briefUrl(lang)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
${xhtml(briefAlternates(null, byDate))}
  </url>`,
    ...(briefs[lang] ?? []).map(
      (b) => `  <url>
    <loc>${briefUrl(lang, b.date)}</loc>
    <lastmod>${b.generatedAt}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.6</priority>
${xhtml(briefAlternates(b.date, byDate))}
  </url>`,
    ),
  ])
}
```

Changer la signature en `sitemapFor(siteId, lastmod, briefs = {})` et concaténer : `const urls = [...<entrées actuelles>, ...briefEntries(site, lastmod, briefs)].join('\n')` (l'expression actuelle produit déjà une chaîne jointe : la transformer en tableau avant le `.join('\n')`).

- [ ] **Step 5: Brancher dans `scripts/build-sites.mjs`**

Imports : `import { loadBriefs, cssHrefFrom, writeBriefPages } from './lib/brief-pages.mjs'`. Puis :

```js
// Les brèves quotidiennes : HTML statiques, après le build Vite (il faut le
// nom haché de la feuille CSS). Voir scripts/lib/brief-pages.mjs.
async function writeBriefs(site, briefs) {
  const dist = path.join(root, 'dist', site.id)
  const built = await readFile(path.join(dist, 'index.html'), 'utf-8')
  const n = await writeBriefPages(site, dist, briefs, cssHrefFrom(built))
  console.log(`  → dist/${site.id} : ${n} pages de brève`)
}
```

`writeSeoFiles(site, stamp, briefs)` passe `briefs` à `sitemapFor(site.id, stamp, briefs)`. Dans la boucle finale : `const briefs = await loadBriefs(path.join(root, 'src/data/briefs'))` avant la boucle, et `await writeBriefs(site, briefs)` après `copyStandalone(site)`.

- [ ] **Step 6: Lancer** — `node --test test/brief-pages.test.mjs` → PASS ; `npm test` → PASS.

- [ ] **Step 7: Build réel avec une brève d'essai**

Si `npm run brief -- --force` (Task 3) a écrit des brèves réelles, les garder ; sinon copier une sortie `--dry` dans `src/data/briefs/fr/<date>.json`. Puis :
Run: `npm run build`
Expected: `→ dist/ch : N pages de brève`, `→ dist/org : M pages de brève` ; `ls dist/ch/breve` montre `index.html` et le dossier daté ; `grep -c "<loc>" dist/ch/sitemap.xml` a augmenté de 1 + nombre de brèves fr.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/brief-pages.mjs scripts/lib/sitemap.mjs scripts/build-sites.mjs test/brief-pages.test.mjs
git commit -m "Brève : pages statiques datées, archive et sitemap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Styles et liens « Brève » (nav, pied de page, 404)

**REQUIRED SUB-SKILL:** `verifier-le-rendu` avant de déclarer cette tâche faite (quatre langues, deux thèmes, mobile).

**Files:**
- Modify: `src/styles/global.css` (fin de fichier, avant les blocs `@media (pointer: coarse)` s'ils sont en fin), `src/components/Nav.jsx:37-41`, `src/components/Footer.jsx:27-32`, `scripts/lib/not-found.mjs:62-67`, `test/not-found.test.mjs`
- Create: `test/brief-links-ui.test.mjs`

**Interfaces:**
- Consumes: `BRIEF_STRINGS` (Task 1), `briefPath` (Task 4) ; classes émises par Task 6 : `brief-body`, `brief-nav`, `brief-nav__inner`, `brief-nav__brand`, `brief-nav__links`, `brief`, `brief__kicker`, `brief__date`, `brief__intro`, `brief__topics`, `brief__topic`, `brief__rubric`, `brief__topic-title`, `brief__text`, `brief__sources`, `brief__disclaimer`, `brief__pager`, `brief__archive`

- [ ] **Step 1: Test qui échoue** — `test/brief-links-ui.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Node ne sait pas importer du JSX : on lit les composants comme du texte,
// comme test/img-lazy.test.mjs. Une page sans lien interne ne circule pas.
for (const f of ['Nav.jsx', 'Footer.jsx']) {
  test(`${f} lie la brève`, async () => {
    const src = await readFile(new URL(`../src/components/${f}`, import.meta.url), 'utf-8')
    assert.match(src, /briefPath\(lang\)/)
    assert.match(src, /BRIEF_STRINGS\[lang\]/)
  })
}

test('chaque font-family .brief est suivie de son font-size-adjust', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf-8')
  const block = css.slice(css.indexOf('/* === Brève quotidienne'))
  assert.ok(block.length > 100, 'bloc de la brève présent')
  const lines = block.split('\n')
  lines.forEach((l, i) => {
    const m = l.match(/font-family: var\(--font-(display|body|mono)\)/)
    if (!m) return
    const fsa = { display: 'display', body: 'body', mono: 'util' }[m[1]]
    assert.match(lines[i + 1], new RegExp(`font-size-adjust: var\\(--fsa-${fsa}\\)`), `ligne ${i}`)
  })
})
```

Dans `test/not-found.test.mjs`, ajouter au test des liens de chaque site : `assert.ok(html.includes(\`href="${briefPath(p.lang)}"\`))` pour chaque page du site (importer `briefPath`).

Run: `node --test test/brief-links-ui.test.mjs test/not-found.test.mjs` → FAIL.

- [ ] **Step 2: Liens**

`Nav.jsx` : `import { BRIEF_STRINGS } from '../briefStrings.js'`, ajouter `briefPath` à l'import de `sites.config.js`, et insérer dans `links`, après l'entrée agenda : `[briefPath(lang), BRIEF_STRINGS[lang].nav],`.

`Footer.jsx` : mêmes imports ; ajouter `[briefPath(lang), BRIEF_STRINGS[lang].title],` après l'entrée agenda de `pages`.

`not-found.mjs` : importer `briefPath` et `BRIEF_STRINGS` ; ajouter `[briefPath(p.lang), BRIEF_STRINGS[p.lang].title],` après l'entrée agenda.

- [ ] **Step 3: Styles** — ajouter à `src/styles/global.css` :

```css
/* === Brève quotidienne (pages statiques, scripts/lib/brief-pages.mjs) ===
   Hors de React : ces règles stylent un HTML écrit par Node, qui charge la
   même feuille. Convention du fichier : chaque font-family est suivie de son
   font-size-adjust. */
.brief-body {
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
.brief-nav {
  border-bottom: 1px solid var(--line);
}
.brief-nav__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 24px;
  padding-block: 18px;
}
.brief-nav__brand {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-style: italic;
  font-size: 1.35rem;
  color: var(--apricot-ink);
  text-decoration: none;
}
.brief-nav__links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
}
.brief-nav__links a {
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-soft);
  text-decoration: none;
}
.brief-nav__links a:hover,
.brief-nav__links a:focus-visible {
  color: var(--apricot-ink);
}
.brief {
  max-width: 46rem;
  padding-block: 40px 64px;
}
.brief__kicker,
.brief__rubric {
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--apricot-ink);
}
.brief__date {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-size: clamp(1.9rem, 5vw, 2.8rem);
  line-height: 1.1;
  margin: 0.2em 0 0.5em;
  text-wrap: balance;
}
.brief__intro,
.brief__text {
  font-family: var(--font-body);
  font-size-adjust: var(--fsa-body);
  font-size: 1.08rem;
  line-height: 1.6;
}
.brief__intro {
  color: var(--text-soft);
  margin: 0 0 2em;
}
.brief__topics {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--line-strong);
}
.brief__topic {
  padding: 1.4em 0;
  border-bottom: 1px solid var(--line);
}
.brief__topic-title {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-size: 1.35rem;
  line-height: 1.25;
  margin: 0.3em 0 0.4em;
}
.brief__text {
  margin: 0 0 0.6em;
}
.brief__sources,
.brief__disclaimer,
.brief__pager,
.brief__archive li {
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.8rem;
  color: var(--text-faint);
}
.brief__sources a,
.brief__pager a,
.brief__archive a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid var(--line-apricot);
}
.brief__sources a:hover,
.brief__pager a:hover,
.brief__archive a:hover {
  color: var(--apricot-ink);
}
.brief__disclaimer {
  margin-top: 2em;
}
.brief__pager {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2.4em;
}
.brief__archive h2 {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-size: 1.2rem;
  margin: 3em 0 0.6em;
}
.brief__archive ul {
  list-style: none;
  padding: 0;
  margin: 0;
  columns: 2 14rem;
}
.brief__archive li {
  padding: 0.25em 0;
}
@media (pointer: coarse) {
  .brief-nav__links a,
  .brief__pager a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}
```

(Si `--apricot-ink`, `--line-apricot` ou `--text-faint` n'ont pas de valeur en thème jour, prendre l'équivalent que le reste du fichier utilise dans le bloc `[data-theme="light"]` — vérifier par `grep -n "line-apricot\|apricot-ink" src/styles/global.css`.)

- [ ] **Step 4: Tests et lint** — `npm test && npm run lint` → PASS ; `0 errors, 5 warnings`.

- [ ] **Step 5: Vérifier le rendu** — invoquer le skill `verifier-le-rendu` et suivre sa procédure sur : `/breve/<date>/` (fr), `/hy/brief/<date>/`, `/ru/brief/`, `/brief/` vide si possible, aux largeurs et dans les deux thèmes qu'il prescrit, plus la nav et le pied de page de l'accueil dans les quatre langues (le 5ᵉ lien ne doit pas casser la nav mobile). `npm run build && npm run preview` (puis `preview:org`).

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/components/Nav.jsx src/components/Footer.jsx scripts/lib/not-found.mjs test/brief-links-ui.test.mjs test/not-found.test.mjs
git commit -m "Brève : styles des pages et liens depuis la nav, le pied de page et la 404

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Contrôle du build, sonde de production, documentation

**Files:**
- Modify: `scripts/check-build.mjs` (nouvelle boucle avant le bilan final), `.github/workflows/hourly.yml:318-322`, `CLAUDE.md`, `README.md` (une ligne de commande)

**Interfaces:**
- Consumes: `loadBriefs`, `briefLangsByDate`, `briefAlternates`, `briefUrl`, `briefPath`, `siteOf`

- [ ] **Step 1: Contrôle dans `check-build.mjs`**

Ajouter les imports (`briefUrl`, `briefPath`, `siteOf` depuis `sites.config.js` ; `loadBriefs` ; `briefLangsByDate`, `briefAlternates`) puis, avant le bilan final :

```js
// Les brèves : chaque page attendue existe, dans sa langue, avec SON canonical,
// un bloc hreflang exactement égal à briefAlternates (donc sans langue absente
// ce jour-là), sans le domaine voisin, et listée dans le sitemap. Les liens de
// nav sont rendus par React — non vérifiables ici avant le prérendu — et sont
// gardés par test/brief-links-ui.test.mjs.
{
  const briefs = await loadBriefs(path.join(root, 'src/data/briefs'))
  const byDate = briefLangsByDate(briefs)
  for (const site of Object.values(SITES)) {
    const other = Object.values(SITES).find((s) => s.id !== site.id).host
    const sitemap = await readFile(path.join(root, 'dist', site.id, 'sitemap.xml'), 'utf-8').catch(() => '')
    for (const { lang } of site.pages) {
      for (const date of [null, ...(briefs[lang] ?? []).map((b) => b.date)]) {
        const rel = path.join('dist', site.id, briefPath(lang, date).replace(/^\//, ''), 'index.html')
        const html = await readFile(path.join(root, rel), 'utf-8').catch(() => null)
        const fail = (why) => { console.error(`✗ ${rel} — ${why}`); bad++ }
        if (!html) { fail('absent'); continue }
        if (!html.includes(`<html lang="${lang}">`)) fail(`<html lang="${lang}"> manquant`)
        if (!html.includes(`<link rel="canonical" href="${briefUrl(lang, date)}" />`)) fail('canonical')
        const got = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])
        if (JSON.stringify(got) !== JSON.stringify(briefAlternates(date, byDate))) fail('hreflang')
        const foreign = html.replaceAll(/<link rel="alternate"[^>]+>/g, '')
        if (foreign.includes(`${other}/`) && !foreign.includes('sameAs')) fail(`cite ${other}`)
        if (!sitemap.includes(`<loc>${briefUrl(lang, date)}</loc>`)) fail('absente du sitemap')
      }
    }
  }
  console.log('✓ pages de brève contrôlées')
}
```

Note : le JSON-LD `sameAs` de l'Organization cite légitimement le domaine voisin ; si la heuristique `foreign` produit un faux positif, remplacer le test par : aucun `href="${other}` hors des `<link rel="alternate"`.

Adapter le nom du compteur (`bad`) et le format des messages à ceux du fichier. Mettre à jour le commentaire d'en-tête de `npm run check` dans `CLAUDE.md` (« contrôle les 16 pages produites… ») en ajoutant « et les pages de brève ».

Run: `npm run build && npm run check` → aucun `✗`.

Contre-épreuve (prouve que le contrôle mord) : supprimer à la main `dist/org/hy/brief/index.html`, relancer `npm run check` → `✗ … — absent` ; puis `npm run build` pour restaurer.

- [ ] **Step 2: Sonde de production** — dans `.github/workflows/hourly.yml`, étape « Sonder la production », ajouter :

```bash
          probe "https://armenieinfo.ch/breve/" 200 || fail=1
          probe "https://armenianews.org/brief/" 200 || fail=1
```

et compléter le nom de l'étape : `Sonder la production (404 francs, slugs jumeaux, brève)`.

- [ ] **Step 3: Documentation**

`CLAUDE.md` — **seulement ce qui est silencieux** (règle d'en-tête du fichier ; en échange, chercher une ligne périmée à retirer) :
- dans « Commandes » : `npm run brief         # générer la brève du jour hors du scrape (--force ignore 7 h, --dry n'écrit rien)` et mettre à jour le nombre de tests de `npm test` (compter avec `npm test 2>&1 | grep -E "^# tests"`) ;
- dans « Données » : `src/data/briefs/{lang}/AAAA-MM-JJ.json` est **généré par le scrape, une fois, et jamais régénéré** ; une correction se fait à la main dans le JSON ;
- dans « À savoir », un paragraphe : le hreflang d'une page datée ne cite que les langues présentes ce jour-là (`scripts/lib/brief-links.mjs`, partagé avec le sitemap) ; une journée sans brève ne casse rien et le seul signe est `✗ brief/{lang}` au log (`gh run view <id> --log | grep brief`) ; le modèle ne fournit jamais d'URL.

`README.md` : une ligne dans la liste des commandes pour `npm run brief`.

- [ ] **Step 4: Tout repasser**

Run: `npm test && npm run lint && npm run build && npm run check`
Expected: tout vert ; lint `0 errors, 5 warnings`.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-build.mjs .github/workflows/hourly.yml CLAUDE.md README.md
git commit -m "Brève : contrôle du build, sonde de production et documentation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Après le plan

Fusion dans `main` via `superpowers:finishing-a-development-branch`. Le premier run horaire après 7 h à Erevan (03:23 UTC) produit la première brève ; vérifier le lendemain matin avec `gh run list --workflow hourly.yml` puis `gh run view <id> --log | grep brief`, et ouvrir `https://armenieinfo.ch/breve/`.
