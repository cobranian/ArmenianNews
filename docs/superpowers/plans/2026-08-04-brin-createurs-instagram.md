# Cinquième brin Instagram « Créateurs arméniens » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un cinquième brin Instagram « Créateurs arméniens » (4 comptes, dont 2 recrutés), rendre le tirage équitable entre comptes de tailles très inégales, et donner au scraper trois réglages qu'il n'a pas : récolter le catalogue entier d'un compte, exclure des posts nommés, et enregistrer les images au format des tuiles.

**Architecture:** Le pool (`src/data/instagram.json`) est la seule source de vérité des comptes ; `ig-scrape.mjs` le remplit, `selectInstagram` en tire la sélection horaire (`instagram-feed.json`), `Social.jsx` l'affiche. Les trois couches restent séparées : la liste d'exclusion ne vit que dans le scraper, le tirage ne connaît que le pool, l'affichage ne connaît que la sélection. Les fonctions pures sont extraites pour être testées sans réseau ni Chrome.

**Tech Stack:** Node 20+ (ESM, `node --test`), React 18 + Vite, Puppeteer-core (local uniquement).

## Global Constraints

- **Dépôt** : la racine git est `ArmenianNews/`. Vérifier avec `git rev-parse --show-toplevel` avant toute commande git — le dossier parent est un autre dépôt (`armenian-songs`).
- **Aucun réseau dans les tests.** `npm test` doit passer hors ligne. Les tests lisent des données en dur ou les fichiers du dépôt.
- **Une entrée d'`igStrands` tient sur UNE ligne** dans `Social.jsx` : `test/instagram-strands.test.mjs` la lit par expression régulière, une ligne enveloppée par prettier la rend invisible.
- **Une clé i18n doit exister dans les QUATRE blocs `STRINGS`** (`fr`, `en`, `hy`, `ru`) de `src/i18n.jsx`. `t()` vaut `STRINGS[lang][clé] ?? STRINGS.fr[clé] ?? clé` : trois blocs sur quatre masquent le trou par repli sur le français.
- **Les titres de test sont en français sans accents** (convention du dépôt, lisibilité de la sortie de `node --test`).
- **`npm run lint` doit rester à 0 erreur et 5 avertissements** — les 5 sont connus et documentés dans `CLAUDE.md`. Aucun nouveau.
- **Valeurs exactes reprises de la spec :** `MIN_IMAGE_WIDTH = 640`, `DEFAULT_COUNT = 9`, `MAX_COUNT = 500`, `MAX_PAGE = 50`, limite de tirage `18`, clé i18n `ig.strand.creators`, clé de groupe `createurs`.
- **Les 15 shortcodes exclus, verbatim :** `DYIOafVM7Ck`, `DWMnEA9DHQy`, `DTivHQtDHJx`, `Dbl4jYKM8b7`, `DTs_DE0DAWl`, `DTIhcZTjKOL`, `DNJSR9pME4c`, `DLh8hGHs280`, `C_xrBJUMjvi`, `DCHLupzM-mg`, `C84_5AIsRVo`, `C8tpsTCMrOq`, `C8HDSFQseZP`, `C6igwGksduf`, `C50Mq6VsF5R`.

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `scripts/sources/instagram.mjs` | *modifié* — expose `drawGroup()`, le tirage à la ronde ; `selectInstagram()` groupe et délègue | 1 |
| `test/instagram-draw.test.mjs` | *neuf* — garde le tirage sur un pool en dur | 1 |
| `scripts/lib/ig-harvest.mjs` | *neuf* — les décisions pures de la récolte : quel format d'image, combien de posts, quelle taille de page, quels posts exclure | 2 |
| `test/ig-harvest.test.mjs` | *neuf* — garde ces quatre décisions | 2 |
| `scripts/ig-scrape.mjs` | *modifié* — pagination, `--only`, branche les helpers, préserve `exclude` à la réécriture | 3 |
| `src/data/instagram.json` | *modifié* — racine `exclude`, 2 comptes recrutés, 3 `group` déplacés | 4 |
| `test/instagram-pool.test.mjs` | *neuf* — garde l'exclusion et la forme des réglages | 4 |
| `src/i18n.jsx` | *modifié* — `ig.strand.creators` ×4 langues | 5 |
| `src/components/Social.jsx` | *modifié* — une ligne dans `igStrands` | 5 |
| `test/instagram-strands.test.mjs` | *modifié* — quatre brins → cinq | 5 |
| `scripts/ig-select.mjs` + `package.json` | *neuf* — re-tirer le feed sans re-scraper le réseau | 6 |
| `CLAUDE.md` | *modifié* — les cinq brins, le tirage à la ronde, un chiffre périmé retiré | 8 |

**Ordre :** les tâches 1–6 sont hors réseau et testables. La tâche 7 est la seule qui parle à Instagram (Chrome local). La tâche 8 documente.

---

### Task 1: Le tirage à la ronde

Aujourd'hui `selectInstagram` mélange la réserve entière d'un brin et en prend 18 : un compte y pèse à proportion de ses posts. Avec le catalogue Simonian (plusieurs centaines) face à trois comptes de 9, il prendrait ~16 tuiles sur 18. Le tirage doit piocher chez chaque compte à tour de rôle.

**Files:**
- Modify: `scripts/sources/instagram.mjs` (remplace le corps de `selectInstagram`, lignes 26–57)
- Test: `test/instagram-draw.test.mjs` (créer)

**Interfaces:**
- Consumes: rien.
- Produces: `drawGroup(accounts, limit, seen)` exporté depuis `scripts/sources/instagram.mjs`.
  - `accounts`: `Array<{handle: string, name: string, group?: string, posts?: Array<{url: string, date?: string}>}>`
  - `limit`: `number`
  - `seen`: `Set<string>` de shortcodes déjà servis, **muté** par l'appel (partagé entre les groupes, comme aujourd'hui)
  - retourne `Array<{url: string, date: string|null, handle: string, name: string, group: string}>`
  - `selectInstagram(limit = 18)` garde exactement sa signature et son type de retour.

- [ ] **Step 1: Write the failing test**

Créer `test/instagram-draw.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawGroup } from '../scripts/sources/instagram.mjs'

// Un compte synthetique : `n` posts, shortcodes prefixes par le handle.
const compte = (handle, n, prefixe = handle) => ({
  handle,
  name: handle,
  group: 'createurs',
  posts: Array.from({ length: n }, (_, i) => ({
    url: `https://www.instagram.com/p/${prefixe}${i}/`,
    date: '2026-08-01T00:00:00.000Z',
  })),
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Un melange a plat de
// la reserve du brin donne les tuiles a proportion des posts : le catalogue
// Simonian prendrait ~16 tuiles sur 18 et les trois autres comptes ~1 chacun.
// Rien ne tomberait — le brin serait juste devenu le mur d'un seul compte.
test('un gros catalogue ne chasse pas ses voisins du brin', () => {
  const posts = drawGroup(
    [compte('simonian_jewels', 200), compte('a', 9), compte('b', 9), compte('c', 9)],
    18,
    new Set(),
  )
  assert.equal(posts.length, 18)
  const par = {}
  for (const p of posts) par[p.handle] = (par[p.handle] || 0) + 1
  assert.equal(par.simonian_jewels, 5, 'le gros compte doit avoir 5 tuiles, pas 16')
  for (const h of ['a', 'b', 'c']) {
    assert.ok(par[h] >= 4, `@${h} n a que ${par[h]} tuiles — il est chasse du brin`)
  }
})

test('un brin plus petit que la limite rend tout ce qu il a, sans boucler', () => {
  const posts = drawGroup([compte('a', 3), compte('b', 2)], 18, new Set())
  assert.equal(posts.length, 5)
})

// Un post COLLAB vit sur les deux grilles sous le MEME shortcode : le carrousel
// l afficherait a cote de lui-meme. C est le role d origine de `seen`.
test('un post partage par deux comptes ne sort qu une fois', () => {
  const posts = drawGroup([compte('a', 4, 'X'), compte('b', 4, 'X')], 18, new Set())
  const codes = posts.map((p) => p.url)
  assert.equal(new Set(codes).size, codes.length, 'un shortcode sort deux fois')
  assert.equal(posts.length, 4)
})

// `seen` est partage entre les groupes par selectInstagram : ce qu un brin a
// deja servi ne doit pas ressortir dans le suivant.
test('seen est respecte et mute', () => {
  const seen = new Set(['a0'])
  const posts = drawGroup([compte('a', 3)], 18, seen)
  assert.equal(posts.length, 2)
  assert.ok(seen.has('a1') && seen.has('a2'), 'drawGroup doit alimenter seen')
})

test('chaque post porte son compte, son nom et son groupe', () => {
  const [p] = drawGroup([compte('a', 1)], 18, new Set())
  assert.deepEqual(
    { handle: p.handle, name: p.name, group: p.group, date: p.date },
    { handle: 'a', name: 'a', group: 'createurs', date: '2026-08-01T00:00:00.000Z' },
  )
})

test('un compte sans group tombe dans institutions', () => {
  const acc = compte('a', 1)
  delete acc.group
  const [p] = drawGroup([acc], 18, new Set())
  assert.equal(p.group, 'institutions')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/instagram-draw.test.mjs
```

Attendu : ÉCHEC — `The requested module '../scripts/sources/instagram.mjs' does not provide an export named 'drawGroup'`.

- [ ] **Step 3: Write minimal implementation**

Dans `scripts/sources/instagram.mjs`, remplacer tout le corps depuis le commentaire au-dessus de `selectInstagram` (ligne 18) jusqu'à la fin du fichier par :

```js
// Instagram blocks scraping from CI, so the pool is harvested locally by
// `npm run ig-scrape` (and may be hand-edited). Each snapshot just re-randomises
// which posts are shown and in what order — a fresh random "chronology" hourly.
//
// The wall has five strands, and each account declares which it belongs to via
// `group` (institutions | personnalites | creation | createurs | terre), so we
// draw per group rather than from the whole pool — otherwise the biggest group
// would crowd the others off their own carousel.
//
// WITHIN a group we draw ROUND-ROBIN, one post per account in turn. A flat
// shuffle of the group's reserve gives each account tiles in proportion to how
// many posts it has, which is invisible while every account holds exactly nine
// — and stops being invisible the moment one doesn't. `simonian_jewels` carries
// its whole catalogue (`count: 'all'`), several hundred posts against its three
// neighbours' nine: flat, it would take ~16 of the strand's 18 tiles and
// "Créateurs arméniens" would become one account's wall. This is the same
// imbalance the per-group draw fixes one level up, applied one level down.
export function drawGroup(accounts, limit, seen = new Set()) {
  // One shuffled pile per account, and the ORDER OF THE PILES is shuffled too.
  // Without that second shuffle the same account would always take the spare
  // tile *and* always open the carousel — a fixed rank on a shelf whose whole
  // point is to change.
  const piles = shuffle(
    accounts
      .map((acc) => ({ acc, pile: shuffle(acc.posts || []) }))
      .filter(({ pile }) => pile.length),
  )

  const out = []
  while (out.length < limit) {
    let progressed = false
    for (const { acc, pile } of piles) {
      if (out.length >= limit) break
      while (pile.length) {
        const p = pile.shift()
        progressed = true
        const code = shortcode(p.url)
        if (seen.has(code)) continue
        seen.add(code)
        out.push({
          url: p.url,
          date: p.date || null,
          handle: acc.handle,
          name: acc.name,
          group: acc.group || 'institutions',
        })
        break
      }
    }
    // No pile yielded anything this round — every account is exhausted.
    if (!progressed) break
  }
  return out
}

export async function selectInstagram(limit = 18) {
  const src = JSON.parse(await readFile(join(DATA_DIR, 'instagram.json'), 'utf-8'))

  const byGroup = new Map()
  for (const acc of src.accounts || []) {
    const group = acc.group || 'institutions'
    byGroup.set(group, [...(byGroup.get(group) || []), acc])
  }

  // `seen` spans the groups, not just one: a post shared across two strands
  // would otherwise appear twice on the same page.
  const seen = new Set()
  const posts = []
  for (const [group, accounts] of byGroup) {
    const drawn = drawGroup(accounts, limit, seen)
    posts.push(...drawn)
    console.log(`  ✓ instagram/${group} (${drawn.length} random posts)`)
  }
  return posts
}
```

Les lignes 1–16 du fichier (imports, `shuffle`, `shortcode`) sont inchangées.

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/instagram-draw.test.mjs
npm test
npm run lint
```

Attendu : les 6 nouveaux tests passent ; `npm test` passe en entier ; lint à 0 erreur / 5 avertissements.

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/instagram.mjs test/instagram-draw.test.mjs
git commit -m "feat(instagram): tirer a la ronde entre les comptes d un brin

Le melange a plat donnait les tuiles a proportion des posts de chaque
compte. Invisible tant que tous en ont neuf ; un catalogue de plusieurs
centaines prendrait 16 tuiles sur 18 et le brin deviendrait le mur d un
seul compte. C est le desequilibre que le tirage par groupe corrige un
cran plus haut, applique un cran plus bas.

L ordre des comptes est remelange a chaque tirage : sinon le meme compte
prendrait toujours la tuile en trop et ouvrirait toujours le carrousel.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Les décisions pures de la récolte

`ig-scrape.mjs` est un script à `await` de haut niveau qui pilote Chrome : impossible à tester en unité. Les quatre décisions qu'il prend, elles, sont pures — on les sort dans `scripts/lib/`, où le dépôt range déjà `http.mjs`, `sitemap.mjs`, `site-meta.mjs`, `agenda-ld.mjs`.

**Files:**
- Create: `scripts/lib/ig-harvest.mjs`
- Test: `test/ig-harvest.test.mjs` (créer)

**Interfaces:**
- Consumes: rien.
- Produces, tous exportés depuis `scripts/lib/ig-harvest.mjs` :
  - `MIN_IMAGE_WIDTH = 640`, `DEFAULT_COUNT = 9`, `MAX_COUNT = 500`, `MAX_PAGE = 50` (constantes)
  - `pickImage(candidates: Array<{url: string, width?: number}>) => string | null`
  - `wantedFor(acc: {count?: number|'all'}) => number`
  - `pageCount(want: number, excludeCount: number) => number`
  - `shortcodeOf(url: string) => string | null`
  - `keepable(items: Array<{shortcode: string}>, exclude: Set<string>) => Array<same>`

- [ ] **Step 1: Write the failing test**

Créer `test/ig-harvest.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_COUNT,
  MAX_COUNT,
  MAX_PAGE,
  keepable,
  pageCount,
  pickImage,
  shortcodeOf,
  wantedFor,
} from '../scripts/lib/ig-harvest.mjs'

// Instagram liste ses formats du plus grand au plus petit. Le script prenait
// systematiquement candidates[0] — ~1080px, 229 Ko de moyenne mesures sur les
// 218 images du depot — pour des tuiles rendues autour de 300px.
const CANDIDATS = [
  { url: 'w1080', width: 1080 },
  { url: 'w750', width: 750 },
  { url: 'w640', width: 640 },
  { url: 'w320', width: 320 },
]

test('pickImage prend le plus petit format d au moins 640px', () => {
  assert.equal(pickImage(CANDIDATS), 'w640')
})

test('pickImage ignore l ordre du tableau', () => {
  assert.equal(pickImage([...CANDIDATS].reverse()), 'w640')
})

// Un post ne doit JAMAIS perdre son image sur une regle de taille : sans image
// la tuile retombe sur son motif armenien, ce qui se lit comme une panne.
test('pickImage retombe sur le plus grand si aucun n atteint 640px', () => {
  assert.equal(pickImage([{ url: 'w320', width: 320 }, { url: 'w150', width: 150 }]), 'w320')
})

test('pickImage rend null sans candidat exploitable', () => {
  assert.equal(pickImage([]), null)
  assert.equal(pickImage(undefined), null)
  assert.equal(pickImage([{ width: 1080 }]), null)
})

test('wantedFor vaut 9 par defaut', () => {
  assert.equal(wantedFor({}), DEFAULT_COUNT)
  assert.equal(wantedFor({ handle: 'a' }), 9)
})

test('wantedFor honore un entier', () => {
  assert.equal(wantedFor({ count: 24 }), 24)
})

test('wantedFor traduit all par le plafond dur', () => {
  assert.equal(wantedFor({ count: 'all' }), MAX_COUNT)
  assert.equal(MAX_COUNT, 500)
})

// Une valeur absurde ne doit pas se traduire par une recolte absurde.
test('wantedFor refuse une valeur invalide et retombe sur le defaut', () => {
  for (const v of [0, -3, 1.5, 'beaucoup', null]) {
    assert.equal(wantedFor({ count: v }), DEFAULT_COUNT, `count: ${JSON.stringify(v)}`)
  }
})

test('wantedFor plafonne un entier trop grand', () => {
  assert.equal(wantedFor({ count: 5000 }), MAX_COUNT)
})

// LE PIEGE QUE CE TEST GARDE. La requete demandait 12 posts en dur. Avec 15
// exclus parmi les plus recents, une page de 12 en laisse ZERO — et
// `if (!posts.length) throw` classerait le compte en echec reseau. La page doit
// demander ce qu on veut vraiment.
test('pageCount couvre le pire cas, tous les exclus en tete', () => {
  assert.equal(pageCount(9, 15), 24)
  assert.equal(pageCount(9, 0), 9)
})

test('pageCount reste sous le plafond de politesse de l endpoint', () => {
  assert.equal(pageCount(500, 15), MAX_PAGE)
  assert.equal(MAX_PAGE, 50)
})

test('shortcodeOf lit les trois formes d URL et ignore la query', () => {
  assert.equal(shortcodeOf('https://www.instagram.com/p/ABC123/'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/reel/ABC123/'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/tv/ABC123/'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/p/ABC123/?img_index=1'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/naregjewelry/'), null)
})

test('keepable retire les posts exclus et garde l ordre', () => {
  const items = [{ shortcode: 'a' }, { shortcode: 'b' }, { shortcode: 'c' }]
  assert.deepEqual(keepable(items, new Set(['b'])), [{ shortcode: 'a' }, { shortcode: 'c' }])
  assert.deepEqual(keepable(items, new Set()), items)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/ig-harvest.test.mjs
```

Attendu : ÉCHEC — `Cannot find module .../scripts/lib/ig-harvest.mjs`.

- [ ] **Step 3: Write minimal implementation**

Créer `scripts/lib/ig-harvest.mjs` :

```js
/**
 * Les décisions pures de la récolte Instagram, sorties de `ig-scrape.mjs` pour
 * être testables : ce script pilote un Chrome et n'est pas exécutable en test.
 */

// Les tuiles rendent autour de 300px, la lightbox guère plus de 900. Instagram
// propose plusieurs formats et le script prenait toujours le plus grand
// (~1080px) : 229 Ko de moyenne sur les 218 images du dépôt, que l'historique
// git garde pour toujours.
export const MIN_IMAGE_WIDTH = 640

// Ce que récolte un compte qui ne demande rien.
export const DEFAULT_COUNT = 9

// Plafond dur d'un `count: 'all'`. Il n'est pas là pour brider un catalogue
// plausible mais pour qu'un compte inattendu — ou une pagination qui ne se
// termine pas — ne remplisse pas le dépôt en silence.
export const MAX_COUNT = 500

// Ce qu'on demande à l'endpoint en une fois. Borne de politesse : au-delà, la
// pagination prend le relais.
export const MAX_PAGE = 50

export const shortcodeOf = (url) =>
  String(url || '').match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || null

/** Le plus petit format d'au moins MIN_IMAGE_WIDTH ; à défaut, le plus grand. */
export function pickImage(candidates) {
  const usable = (candidates || []).filter((c) => c && c.url)
  if (!usable.length) return null
  const w = (c) => c.width || 0
  const big = usable.filter((c) => w(c) >= MIN_IMAGE_WIDTH)
  const pool = big.length ? big : usable
  const pick = big.length
    ? pool.reduce((a, b) => (w(b) < w(a) ? b : a))
    : pool.reduce((a, b) => (w(b) > w(a) ? b : a))
  return pick.url
}

/** Combien de posts ce compte veut. `'all'` = tout, jusqu'au plafond dur. */
export function wantedFor(acc = {}) {
  const c = acc.count
  if (c === 'all') return MAX_COUNT
  if (Number.isInteger(c) && c > 0) return Math.min(c, MAX_COUNT)
  return DEFAULT_COUNT
}

/**
 * Ce qu'une page doit demander pour rendre `want` posts après exclusion, dans le
 * pire cas où tous les exclus sont en tête de grille.
 */
export function pageCount(want, excludeCount) {
  return Math.min(MAX_PAGE, want + excludeCount)
}

/** Retire les posts nommés dans la liste d'exclusion, sans changer l'ordre. */
export function keepable(items, exclude) {
  if (!exclude || !exclude.size) return items
  return items.filter((it) => !exclude.has(it.shortcode))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/ig-harvest.test.mjs
npm test
npm run lint
```

Attendu : les 13 nouveaux tests passent ; `npm test` passe ; lint inchangé.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ig-harvest.mjs test/ig-harvest.test.mjs
git commit -m "feat(ig-scrape): sortir les decisions de recolte dans scripts/lib

Quatre decisions pures que le script prenait en dur et qu on ne pouvait
pas tester : quel format d image retenir, combien de posts veut un
compte, ce qu une page doit demander, quels posts exclure.

Le format d image change au passage. Le script prenait candidates[0], le
plus grand format d Instagram (~1080px, 229 Ko de moyenne mesures sur les
218 fichiers du depot) pour des tuiles rendues a ~300px. Le plus petit
candidat d au moins 640px divise le poids par trois, sans dependance ni
traitement d image — ce qui compte quand l historique git garde ce poids
pour toujours.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Le scraper — pagination, `--only`, et la clé qu'il effaçait

Trois changements dans `ig-scrape.mjs`, plus un défaut à corriger : sa réécriture finale reconstruit `{_comment, accounts}` à partir de rien et **effacerait la clé `exclude`** que la tâche 4 ajoute à la racine du pool.

**Files:**
- Modify: `scripts/ig-scrape.mjs`

**Interfaces:**
- Consumes: `scripts/lib/ig-harvest.mjs` (tâche 2) — `pickImage`, `wantedFor`, `pageCount`, `keepable`, `shortcodeOf`, `MAX_PAGE`.
- Produces: le script accepte `--only <handle[,handle]>` et lit `pool.exclude` / `acc.count`.

- [ ] **Step 1: Brancher les helpers et lire les réglages**

Dans `scripts/ig-scrape.mjs`, ajouter l'import après la ligne 27 (`import puppeteer from 'puppeteer-core'`) :

```js
import {
  keepable,
  pageCount,
  pickImage,
  shortcodeOf,
  wantedFor,
} from './lib/ig-harvest.mjs'
```

Supprimer la constante `PER_ACCOUNT` (ligne 32) — `wantedFor` porte le défaut.

Après `const pool = JSON.parse(await readFile(POOL, 'utf-8'))` (ligne 51), ajouter :

```js
// La liste d'exclusion vit à la racine du pool et ne s'applique qu'ICI : c'est
// ce script qui décide de ce qui entre. Ni selectInstagram ni Social.jsx ne la
// relisent — un filtre écrit à deux endroits finit par diverger, et le pool est
// simplement dépourvu de ces posts.
const EXCLUDE = new Set(pool.exclude || [])

// --only <handle[,handle]> : récolter un compte sans réécrire les 26 autres.
// Ajouter un compte coûterait sinon 27 requêtes, une réécriture complète du
// pool et un re-téléchargement de toutes les images.
const onlyFlag = process.argv.findIndex((a) => a === '--only' || a.startsWith('--only='))
const onlyRaw =
  onlyFlag === -1
    ? null
    : process.argv[onlyFlag].includes('=')
      ? process.argv[onlyFlag].split('=').slice(1).join('=')
      : process.argv[onlyFlag + 1]
const ONLY = onlyRaw ? onlyRaw.split(',').map((s) => s.trim()).filter(Boolean) : null

// Une faute de frappe ne doit pas se lire comme un échec réseau : sans cette
// garde, `--only simonianjewels` récolterait zéro compte et annoncerait
// "rien écrit", ce qui ressemble à une panne Instagram.
if (ONLY) {
  const inconnus = ONLY.filter((h) => !pool.accounts.some((a) => a.handle === h))
  if (inconnus.length) {
    console.log(`✗ handle absent du pool : ${inconnus.join(', ')}`)
    process.exit(1)
  }
  console.log(`→ --only : ${ONLY.join(', ')}`)
}
```

- [ ] **Step 2: Remplacer `harvest` par une récolte paginée**

Remplacer le bloc `harvest` (lignes 94–118, commentaire inclus) par :

```js
// One request per page, issued from the page so the session cookies ride along.
// Throws on a non-200 — the caller degrades that account.
//
// This is the profile-grid feed. Its sibling `web_profile_info` is the endpoint
// you'll find in every guide online, and it still answers 200 with the account's
// bio and post COUNT — but its `edges` array now comes back empty, so it reads as
// a working call that found no posts. Don't go back to it.
const harvestPage = (handle, count, maxId) =>
  page.evaluate(
    async (h, appId, n, cursor) => {
      const qs = new URLSearchParams({ count: String(n) })
      if (cursor) qs.set('max_id', cursor)
      const res = await fetch(
        `/api/v1/feed/user/${encodeURIComponent(h)}/username/?${qs}`,
        { headers: { 'x-ig-app-id': appId }, credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!Array.isArray(json?.items)) throw new Error('unexpected payload shape')
      return {
        items: json.items.map((it) => ({
          shortcode: it.code,
          ts: it.taken_at,
          // A carousel post carries no image of its own — its first slide does.
          // The full candidate list travels: picking a size is a Node-side
          // decision (scripts/lib/ig-harvest.mjs), not a browser-side one.
          candidates:
            it.image_versions2?.candidates ||
            it.carousel_media?.[0]?.image_versions2?.candidates ||
            [],
          // 1 = photo, 2 = video/reel, 8 = carousel.
          isVideo: it.media_type === 2,
        })),
        nextMaxId: json.next_max_id || null,
      }
    },
    handle,
    IG_APP_ID,
    count,
    maxId || null,
  )

// Suit `next_max_id` jusqu'à tenir `want` posts NON EXCLUS, ou jusqu'à
// épuisement du compte. Une boucle de pagination sur un compte dont on ignore
// la taille est un chèque en blanc : `wantedFor` plafonne déjà à MAX_COUNT, et
// la pause entre les pages est la même précaution que celle entre les comptes —
// ce script existe parce qu'Instagram coupe l'accès sur un rythme trop soutenu.
async function harvestAll(handle, want) {
  const per = pageCount(want, EXCLUDE.size)
  const vus = new Map()
  let cursor = null
  let pages = 0
  do {
    const { items, nextMaxId } = await harvestPage(handle, per, cursor)
    for (const it of keepable(items, EXCLUDE)) {
      if (it.shortcode && it.ts && !vus.has(it.shortcode)) vus.set(it.shortcode, it)
    }
    cursor = nextMaxId
    pages++
    if (!items.length) break
    if (cursor) await sleep(1500)
  } while (cursor && vus.size < want)
  return { items: [...vus.values()], pages }
}

// Newest first. Instagram floats PINNED posts to the head of the list whatever
// their age, so sorting on the timestamp is what actually makes this "recent".
const newest = (items, want) => [...items].sort((a, b) => b.ts - a.ts).slice(0, want)
```

Note : le filtre `p.shortcode && p.ts` que portait l'ancien `newest` est monté dans `harvestAll`, où il évite d'accumuler des entrées inutilisables page après page.

- [ ] **Step 3: Adapter la boucle de récolte**

Remplacer la boucle `for (const acc of pool.accounts)` (lignes 128–145) par :

```js
const results = []
for (const acc of pool.accounts) {
  if (ONLY && !ONLY.includes(acc.handle)) {
    results.push({ acc, posts: [], ok: false, skipped: true })
    continue
  }
  const want = wantedFor(acc)
  try {
    const { items, pages } = await harvestAll(acc.handle, want)
    const posts = newest(items, want)
    if (!posts.length) throw new Error('no posts returned')
    results.push({ acc, posts, ok: true })
    const newestDate = new Date(posts[0].ts * 1000).toISOString().slice(0, 10)
    const p = pages > 1 ? `, ${pages} pages` : ''
    console.log(`  ✓ ${acc.handle} (${posts.length} posts, newest ${newestDate}${p})`)
    // Le seul état où le pool contient autre chose que ce qui a été demandé.
    // Ce n'est pas une erreur — le compte peut simplement avoir peu publié —
    // mais rien d'autre ne le signalerait.
    if (posts.length < want) {
      console.log(`    ↯ ${acc.handle} voulait ${want} posts, le compte en rend ${posts.length}`)
    }
  } catch (err) {
    results.push({ acc, posts: [], ok: false })
    console.log(`  ✗ ${acc.handle}: ${err.message} — keeping previous posts`)
  }
  // Stay under Instagram's rate limiter.
  await sleep(2000)
}

const okCount = results.filter((r) => r.ok).length
const tentes = results.filter((r) => !r.skipped).length
console.log(`\n→ ${okCount}/${tentes} accounts harvested`)
```

- [ ] **Step 4: Adapter le `--dry`, le téléchargement, et la réécriture**

Dans le bloc `if (DRY)` (lignes 147–156), remplacer la boucle d'affichage par une version qui annonce **le poids**, puisque c'est le chiffre qui décide si `'all'` reste raisonnable :

```js
if (DRY) {
  let total = 0
  for (const { acc, posts, skipped } of results) {
    if (skipped) continue
    for (const p of posts) {
      const src = pickImage(p.candidates)
      console.log(
        `   ${acc.handle} ${p.shortcode} ${new Date(p.ts * 1000).toISOString()} ` +
          `${src ? (p.candidates.find((c) => c.url === src)?.width ?? '?') + 'px' : 'sans image'}`,
      )
    }
    total += posts.length
  }
  console.log(`\n(dry run — ${total} posts retenus, rien écrit)`)
  await finish()
  process.exit(0)
}
```

Dans `download` (lignes 174–183), remplacer `p.image` par le format choisi :

```js
async function download(p) {
  const src = pickImage(p.candidates)
  if (!src) throw new Error('no usable image candidate')
  const res = await fetch(src, {
    headers: { referer: 'https://www.instagram.com/', 'user-agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 10000) throw new Error(`too small (${buf.length}B)`)
  await writeFile(path.join(IG_DIR, `${p.shortcode}.jpg`), buf)
  return buf.length
}
```

Dans la réécriture du pool (lignes 207–212), **préserver la racine** :

```js
// `...pool` d'abord : la racine porte `exclude`, que ce script lit sans le
// posséder. Reconstruire l'objet à partir de rien l'effacerait à la première
// récolte — un JSON valide, un pool sans exclusion, et rien pour le dire.
const json = { ...pool, accounts }
await writeFile(POOL, JSON.stringify(json, null, 2) + '\n')
```

Et dans le nettoyage des orphelins (lignes 217–219), utiliser le helper partagé :

```js
const live = new Set(accounts.flatMap((a) => a.posts.map((p) => shortcodeOf(p.url))))
```

- [ ] **Step 5: Vérifier que le script se charge et que rien n'a régressé**

```bash
node --check scripts/ig-scrape.mjs
npm run lint
npm test
node scripts/ig-scrape.mjs --only handle_qui_nexiste_pas --dry
```

Attendu : `node --check` silencieux ; lint et tests inchangés ; la dernière commande affiche `✗ handle absent du pool : handle_qui_nexiste_pas` et sort en code 1 **sans ouvrir Chrome** (la garde est avant le lancement du navigateur — si Chrome s'ouvre, remonter le bloc `ONLY` au-dessus de `const browser = …`).

- [ ] **Step 6: Commit**

```bash
git add scripts/ig-scrape.mjs
git commit -m "feat(ig-scrape): pagination, --only, et la cle que la reecriture effacait

Trois reglages que le script ne savait pas exprimer : recolter le
catalogue entier d un compte (pagination via next_max_id, plafonnee),
exclure des posts nommes, et n en recolter qu un sans reecrire le pool.

La requete demandait 12 posts en dur. Avec 15 exclus parmi les plus
recents, une page de 12 en laisse zero — et le compte serait classe en
echec pour une cause qui n est pas la sienne. Elle demande desormais ce
qu on veut vraiment.

Et la reecriture finale reconstruisait {_comment, accounts} a partir de
rien : elle aurait efface la cle `exclude` a la premiere recolte. Un
JSON valide, un pool sans exclusion, et rien pour le dire.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Le pool — deux comptes recrutés, trois déplacés, quinze exclus

**Files:**
- Modify: `src/data/instagram.json`
- Test: `test/instagram-pool.test.mjs` (créer)

**Interfaces:**
- Consumes: `scripts/lib/ig-harvest.mjs` (tâche 2) — `shortcodeOf`, `wantedFor`, `MAX_COUNT`.
- Produces: le pool porte `exclude: string[]` à la racine, et les comptes du groupe `createurs`.

- [ ] **Step 1: Write the failing test**

Créer `test/instagram-pool.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { shortcodeOf, wantedFor, MAX_COUNT } from '../scripts/lib/ig-harvest.mjs'

const pool = JSON.parse(
  await readFile(new URL('../src/data/instagram.json', import.meta.url), 'utf-8'),
)
const exclus = new Set(pool.exclude || [])
const tousLesPosts = pool.accounts.flatMap((a) =>
  (a.posts || []).map((p) => ({ handle: a.handle, code: shortcodeOf(p.url), url: p.url })),
)

test('la liste d exclusion est presente et bien formee', () => {
  assert.ok(Array.isArray(pool.exclude), 'pool.exclude doit etre un tableau')
  assert.equal(pool.exclude.length, exclus.size, 'la liste porte un doublon')
  for (const code of pool.exclude) {
    assert.match(code, /^[\w-]+$/, `shortcode invalide : ${JSON.stringify(code)}`)
  }
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Le site ne relit jamais
// `exclude` — ni selectInstagram, ni Social.jsx — parce qu un filtre ecrit a
// deux endroits finit par diverger. C est donc le SEUL endroit d ou l exclusion
// peut etre verifiee. Une regression de ig-scrape, une edition a la main, ou un
// post exclu qui revient par une autre grille (COLLAB) passeraient sinon
// inapercus : ils produiraient un pool valide, un build vert, et une tuile que
// personne ne voulait.
test('aucun post exclu n est entre dans le pool', () => {
  for (const p of tousLesPosts) {
    assert.ok(!exclus.has(p.code), `@${p.handle} sert ${p.code}, qui est exclu`)
  }
})

test('aucune image d un post exclu ne traine dans src/data/ig', async () => {
  const fichiers = await readdir(new URL('../src/data/ig/', import.meta.url))
  for (const f of fichiers.filter((x) => x.endsWith('.jpg'))) {
    const code = f.replace(/\.jpg$/, '')
    assert.ok(!exclus.has(code), `${f} appartient a un post exclu — poids mort dans le bundle`)
  }
})

test('chaque post porte une URL dont on sait tirer un shortcode', () => {
  for (const p of tousLesPosts) {
    assert.ok(p.code, `URL illisible : ${p.url} (@${p.handle})`)
  }
})

test('les reglages count sont bien formes', () => {
  for (const acc of pool.accounts) {
    if (!('count' in acc)) continue
    assert.ok(
      acc.count === 'all' || (Number.isInteger(acc.count) && acc.count > 0),
      `@${acc.handle} porte count: ${JSON.stringify(acc.count)} — attendu un entier positif ou 'all'`,
    )
    assert.ok(wantedFor(acc) <= MAX_COUNT)
  }
})

test('les quatre comptes du brin createurs sont la', () => {
  const brin = pool.accounts.filter((a) => a.group === 'createurs').map((a) => a.handle).sort()
  assert.deepEqual(brin, [
    'armenian_women_artists',
    'armeniancreators',
    'naregjewelry',
    'simonian_jewels',
  ])
})

test('simonian_jewels recolte tout son catalogue', () => {
  const acc = pool.accounts.find((a) => a.handle === 'simonian_jewels')
  assert.equal(acc.count, 'all')
})

test('maisonlumiere_geneva est dans Ateliers', () => {
  const acc = pool.accounts.find((a) => a.handle === 'maisonlumiere_geneva')
  assert.equal(acc.group, 'creation')
})

test('chaque compte porte handle, name et url', () => {
  for (const acc of pool.accounts) {
    for (const champ of ['handle', 'name', 'url']) {
      assert.ok(acc[champ], `un compte n a pas de ${champ} : ${JSON.stringify(acc.handle)}`)
    }
    // Un identifiant Instagram ne peut pas contenir de tiret : un handle mal
    // saisi renvoie un 404 et fait echouer le compte, sans autre signe.
    assert.match(acc.handle, /^[\w.]+$/, `handle invalide : ${acc.handle}`)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/instagram-pool.test.mjs
```

Attendu : ÉCHEC — `pool.exclude doit etre un tableau`, et les tests du brin `createurs`.

- [ ] **Step 3: Modifier le pool**

Dans `src/data/instagram.json` :

**a.** Remplacer la valeur de `_comment` par (une seule ligne dans le JSON) :

```
Instagram POOL — the recent posts of each curated account, harvested by `npm run ig-scrape` (drives a local logged-in Chrome; Instagram blocks CI). The hourly job re-randomises which of these show and in what order into instagram-feed.json, drawing ROUND-ROBIN per account so a large catalogue does not crowd its strand. Each tile shows src/data/ig/<shortcode>.jpg, else a deterministic Armenian motif. The `accounts` list is hand-curated — the scraper rewrites their `posts`, never the list itself. Per-account `count` (an integer, or 'all' for the whole catalogue up to 500) defaults to 9. Root-level `exclude` lists shortcodes the scraper must never take, whatever the account. Hand-editing a post is fine: add {url, date} and save its image as src/data/ig/<shortcode>.jpg.
```

**b.** Ajouter, juste après `_comment` et **avant** `accounts` :

```json
  "exclude": [
    "DYIOafVM7Ck",
    "DWMnEA9DHQy",
    "DTivHQtDHJx",
    "Dbl4jYKM8b7",
    "DTs_DE0DAWl",
    "DTIhcZTjKOL",
    "DNJSR9pME4c",
    "DLh8hGHs280",
    "C_xrBJUMjvi",
    "DCHLupzM-mg",
    "C84_5AIsRVo",
    "C8tpsTCMrOq",
    "C8HDSFQseZP",
    "C6igwGksduf",
    "C50Mq6VsF5R"
  ],
```

**c.** Changer trois `group` sur des comptes existants :

| Compte | `group` avant | `group` après |
|---|---|---|
| `armeniancreators` | `creation` | `createurs` |
| `armenian_women_artists` | `creation` | `createurs` |
| `maisonlumiere_geneva` | `institutions` | `creation` |

**d.** Ajouter deux comptes au tableau `accounts`, avec `posts: []` — la tâche 7 les remplira :

```json
    {
      "handle": "simonian_jewels",
      "name": "Simonian Jewels",
      "url": "https://www.instagram.com/simonian_jewels/",
      "group": "createurs",
      "count": "all",
      "posts": []
    },
    {
      "handle": "naregjewelry",
      "name": "Nareg Jewelry",
      "url": "https://www.instagram.com/naregjewelry/",
      "group": "createurs",
      "posts": []
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/instagram-pool.test.mjs
node -e "const p=require('./src/data/instagram.json');const g={};for(const a of p.accounts)g[a.group||'institutions']=(g[a.group||'institutions']||0)+1;console.log(g, 'total', p.accounts.length)"
```

Attendu : les 9 tests passent, et la répartition affiche
`{ institutions: 9, personnalites: 6, creation: 4, createurs: 4, terre: 4 } total 27`.

`npm test` **échouera encore** sur `instagram-strands.test.mjs` (« le mur declare quatre brins » : le pool a désormais un cinquième groupe qu'`igStrands` ne rend pas). C'est exactement ce que ce test existe pour attraper — la tâche 5 le résout. Le vérifier :

```bash
node --test test/instagram-strands.test.mjs
```

Attendu : ÉCHEC sur « aucun compte n est hors des quatre brins », mentionnant `group: 'createurs'`.

- [ ] **Step 5: Commit**

```bash
git add src/data/instagram.json test/instagram-pool.test.mjs
git commit -m "feat(instagram): le pool accueille le brin createurs

simonian_jewels (catalogue entier) et naregjewelry rejoignent le pool ;
armeniancreators et armenian_women_artists passent de creation a
createurs ; maisonlumiere_geneva rejoint Ateliers.

Quinze shortcodes entrent dans une liste d exclusion a la racine. Nommer
les posts plutot que compter les premiers est ce qui rend la regle
durable : une position dans la grille se deplace a chaque publication, et
Instagram y fait flotter les epingles quel que soit leur age.

Le site ne relit jamais cette liste — c est le scraper qui decide de ce
qui entre. Le test est donc le seul endroit d ou l exclusion peut etre
verifiee : une regression, une edition a la main ou un post revenu par
une autre grille produiraient sinon un pool valide et un build vert.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Le brin à l'écran

**Files:**
- Modify: `src/i18n.jsx` (4 blocs `STRINGS`)
- Modify: `src/components/Social.jsx` (tableau `igStrands`, lignes 331–336, et son commentaire lignes 325–330)
- Modify: `test/instagram-strands.test.mjs` (lignes 32–38)

**Interfaces:**
- Consumes: le groupe `createurs` du pool (tâche 4).
- Produces: la clé i18n `ig.strand.creators` et l'entrée `{ id: 'instagram-createurs', group: 'createurs', title: t('ig.strand.creators') }`.

- [ ] **Step 1: Mettre le test à jour (il doit échouer)**

Dans `test/instagram-strands.test.mjs`, remplacer le test des lignes 32–38 par :

```js
test('le mur declare cinq brins', () => {
  assert.equal(strands.length, 5, 'igStrands ne declare plus cinq brins')
  assert.deepEqual(
    strands.map((s) => s.group).sort(),
    ['creation', 'createurs', 'institutions', 'personnalites', 'terre'],
  )
})
```

Renommer aussi le test suivant, dont le titre parle encore de quatre brins :

```js
test('aucun compte n est hors des cinq brins', () => {
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/instagram-strands.test.mjs
```

Attendu : ÉCHEC sur « igStrands ne declare plus cinq brins » (4 ≠ 5).

- [ ] **Step 3: Ajouter la clé i18n dans les quatre blocs**

Dans `src/i18n.jsx`, ajouter une ligne **après** `'ig.strand.studio'` dans chacun des quatre blocs `STRINGS` :

```js
    // fr — après la ligne 61
    'ig.strand.creators': 'Créateurs arméniens',
```
```js
    // en — après la ligne 272
    'ig.strand.creators': 'Armenian creators',
```
```js
    // hy — après la ligne 495
    'ig.strand.creators': 'Հայ ստեղծագործողներ',
```
```js
    // ru — après la ligne 694
    'ig.strand.creators': 'Армянские создатели',
```

`Հայ` et non `Հայկական` : `ստեղծագործողներ` désigne des personnes, et l'arménien met alors `Հայ`.

- [ ] **Step 4: Ajouter le brin dans `Social.jsx`**

Remplacer le commentaire au-dessus d'`igStrands` (lignes 325–330) et le tableau (lignes 331–336) par :

```jsx
  // The wall reads as five strands: the community and the institutions that
  // carry Armenian life, the people who are its face, the studios where the
  // work is made, those who turn that work into a catalogue, and the land
  // itself. Each account declares its own strand in instagram.json; anything
  // unlabelled falls in with the first.
  //
  // One entry per line: test/instagram-strands.test.mjs reads this array as
  // text (Node cannot import JSX), and a wrapped entry fails it loudly.
  const igStrands = [
    { id: 'instagram', group: 'institutions', title: t('ig.strand') },
    { id: 'instagram-visages', group: 'personnalites', title: t('ig.strand.people') },
    { id: 'instagram-ateliers', group: 'creation', title: t('ig.strand.studio') },
    { id: 'instagram-createurs', group: 'createurs', title: t('ig.strand.creators') },
    { id: 'instagram-terres', group: 'terre', title: t('ig.strand.land') },
  ]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test test/instagram-strands.test.mjs
npm test
npm run lint
```

Attendu : tous les tests passent (le brin n'est pas vide — `armeniancreators` et `armenian_women_artists` ont déjà 9 posts chacun) ; lint à 0 erreur / 5 avertissements.

Vérifier qu'aucune entrée n'a été enveloppée par un formateur :

```bash
node -e "const s=require('fs').readFileSync('src/components/Social.jsx','utf8');console.log([...s.matchAll(/\{\s*id:\s*'[\w-]+',\s*group:\s*'(\w+)',\s*title:\s*t\('([\w.]+)'\)\s*\}/g)].length + ' entrees lues par le test')"
```

Attendu : `5 entrees lues par le test`.

- [ ] **Step 6: Commit**

```bash
git add src/i18n.jsx src/components/Social.jsx test/instagram-strands.test.mjs
git commit -m "feat(social): un cinquieme brin, Createurs armeniens

Le titre anglais redit le nom d un compte du brin (@armeniancreators),
qui figure en pastille juste sous le carrousel. « makers » evitait l echo
mais « createurs » est le mot demande, et sa traduction directe vaut plus
que l evitement d un doublon visuel.

En armenien, Հայ et non Հայկական : ստեղծագործողներ designe des personnes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `npm run ig-select` — re-tirer sans re-scraper

Changer un `group` dans le pool ne change rien à `instagram-feed.json`, que le site lit réellement. Sans re-tirage, le brin `createurs` n'a aucun post, `Social.jsx` fait `if (!posts.length) return null`, et le brin **n'existe nulle part** — sans erreur, sans test qui tombe, jusqu'au prochain instantané horaire, qu'un push sur `main` ne déclenche pas. Or `selectInstagram` n'est atteignable que par `npm run scrape`, qui re-gratte tout le réseau.

**Files:**
- Create: `scripts/ig-select.mjs`
- Modify: `package.json` (bloc `scripts`)

**Interfaces:**
- Consumes: `selectInstagram(limit)` de `scripts/sources/instagram.mjs` (tâche 1).
- Produces: la commande `npm run ig-select`.

- [ ] **Step 1: Écrire le script**

Créer `scripts/ig-select.mjs` :

```js
/**
 * Re-tirer la sélection Instagram sans toucher au réseau.
 *
 * `instagram-feed.json` est ce que le site lit réellement ; le pool
 * (`instagram.json`) n'est que la réserve. Changer un `group`, ajouter un compte
 * ou récolter des posts ne se voit donc PAS avant un nouveau tirage — un brin
 * dont la sélection ne porte aucun post ne se rend pas du tout (`Social.jsx`,
 * `if (!posts.length) return null`), sans erreur ni test qui tombe, jusqu'au
 * prochain instantané horaire. Et un push sur `main` bâtit et déploie sans
 * scraper.
 *
 * `npm run scrape` ferait ce tirage, mais en re-grattant toutes les sources
 * d'actualité pour changer une sélection purement locale.
 *
 *   npm run ig-select
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectInstagram } from './sources/instagram.mjs'

const FEED = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'instagram-feed.json',
)

const previous = JSON.parse(await readFile(FEED, 'utf-8'))
const posts = await selectInstagram(18)

if (!posts.length) {
  console.log('✗ tirage vide — le fichier n est pas touché.')
  process.exit(1)
}

// `generatedAt` est CONSERVÉ : un re-tirage n'est pas un instantané. Aucune
// source n'a été relue, et le bousculer annoncerait une fraîcheur qui n'a pas
// eu lieu.
await writeFile(
  FEED,
  JSON.stringify({ generatedAt: previous.generatedAt, posts }, null, 2) + '\n',
)

const parGroupe = {}
for (const p of posts) parGroupe[p.group] = (parGroupe[p.group] || 0) + 1
console.log(`\n✓ src/data/instagram-feed.json — ${posts.length} posts`)
for (const [g, n] of Object.entries(parGroupe)) console.log(`   ${g}: ${n}`)
console.log(`   generatedAt inchangé (${previous.generatedAt})`)
```

- [ ] **Step 2: Déclarer la commande**

Dans `package.json`, ajouter la ligne après `"ig-scrape"` :

```json
    "ig-select": "node scripts/ig-select.mjs",
```

- [ ] **Step 3: L'exécuter et vérifier la répartition**

```bash
npm run ig-select
```

Attendu : cinq groupes listés, **18 posts chacun**, `generatedAt` inchangé.

Puis le contrôle qui compte — la répartition **par compte** dans le nouveau brin :

```bash
node -e "const f=require('./src/data/instagram-feed.json');const c={};for(const p of f.posts)if(p.group==='createurs')c[p.handle]=(c[p.handle]||0)+1;console.log(c)"
```

Attendu à ce stade : `armeniancreators` et `armenian_women_artists` à 9 chacun (les deux comptes recrutés n'ont pas encore de posts). Après la tâche 7, ce sera ~5/5/4/4.

```bash
npm test
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ig-select.mjs package.json src/data/instagram-feed.json
git commit -m "feat(instagram): npm run ig-select, re-tirer sans re-scraper

instagram-feed.json est ce que le site lit ; le pool n est que la
reserve. Changer un group ou ajouter un compte ne se voit donc pas avant
un nouveau tirage — et un brin dont la selection ne porte aucun post ne
se rend PAS DU TOUT, sans erreur ni test qui tombe, jusqu au prochain
instantane horaire qu un push sur main ne declenche pas.

npm run scrape ferait ce tirage, mais en re-grattant toutes les sources
d actualite pour changer une selection purement locale.

generatedAt est conserve : un re-tirage n est pas un instantane, et le
bousculer annoncerait une fraicheur qui n a pas eu lieu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: La récolte réelle (local, Chrome connecté)

**Seule tâche qui parle à Instagram.** Elle ne tourne jamais en CI. Elle a une **porte** : le `--dry` doit établir le volume avant qu'un seul octet ne soit écrit.

**Files:**
- Modify: `src/data/instagram.json` (les `posts` des deux comptes, écrits par le script)
- Create: `src/data/ig/*.jpg` (écrits par le script)
- Modify: `src/data/instagram-feed.json` (re-tiré)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1: Ouvrir un Chrome connecté à Instagram**

```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir=.cache/ig-chrome-profile
```

Le profil `.cache/ig-chrome-profile` est en principe déjà connecté. Si la session a expiré, se connecter dans cette fenêtre. Le script contrôle le cookie `sessionid` et sort en erreur sinon — un « non connecté » se lirait autrement comme 27 échecs de compte indépendants.

- [ ] **Step 2: LA PORTE — mesurer avant d'écrire**

```bash
node scripts/ig-scrape.mjs --connect --only naregjewelry,simonian_jewels --dry
```

Quatre choses à établir dans cette sortie, **avant** de continuer :

1. **Les deux handles existent.** Un handle absent d'Instagram répond 404 et apparaît en `✗`.
2. **Combien de posts compte réellement le catalogue Simonian**, et en combien de pages. Si la ligne indique le plafond dur (500), le catalogue est plus grand que la borne : **s'arrêter et le signaler**, c'est une décision à reprendre, pas un fait accompli.
3. **`candidates` porte bien plusieurs tailles avec leur `width`** — la colonne de largeur de chaque ligne doit afficher `640px` (ou proche) et non `1080px` ni `?px`. Si elle affiche `?px`, le payload ne porte pas de `width` et la règle des 640 px n'a aucune prise : s'arrêter, la règle doit être revue avant d'écrire 200 images.
4. **Aucun des 15 shortcodes exclus n'apparaît** dans la liste. Contrôle :

```bash
node scripts/ig-scrape.mjs --connect --only naregjewelry,simonian_jewels --dry > /tmp/ig-dry.txt 2>&1
node -e "const p=require('./src/data/instagram.json');const t=require('fs').readFileSync('/tmp/ig-dry.txt','utf8');const h=p.exclude.filter(c=>t.includes(c));console.log(h.length?'✗ EXCLUS RETENUS: '+h.join(', '):'✓ aucun exclu retenu')"
```

Estimer le poids : `posts retenus × ~75 Ko` au format 640 px. Au-delà de ~20 Mo, s'arrêter et le signaler.

- [ ] **Step 3: Récolter**

Seulement si les quatre points de l'étape 2 sont au vert :

```bash
node scripts/ig-scrape.mjs --connect --only naregjewelry,simonian_jewels
```

- [ ] **Step 4: Vérifier ce qui a été écrit**

```bash
npm test
node -e "
const p=require('./src/data/instagram.json');
console.log('exclude preserve :', Array.isArray(p.exclude) && p.exclude.length===15);
for(const h of ['simonian_jewels','naregjewelry']){const a=p.accounts.find(x=>x.handle===h);console.log(h, a.posts.length, 'posts');}
const fs=require('fs');const d='src/data/ig/';const f=fs.readdirSync(d).filter(x=>x.endsWith('.jpg'));
const s=f.map(x=>fs.statSync(d+x).size);
console.log(f.length+' images, '+(s.reduce((a,b)=>a+b,0)/1048576).toFixed(1)+' Mo');
const neuves=f.filter(x=>fs.statSync(d+x).mtimeMs>Date.now()-3600000);
const sn=neuves.map(x=>fs.statSync(d+x).size);
console.log(neuves.length+' images neuves, moyenne '+(sn.reduce((a,b)=>a+b,0)/sn.length/1024).toFixed(0)+' Ko');
"
```

Attendu : `exclude preserve : true` (c'est le défaut de réécriture corrigé en tâche 3 — s'il vaut `false`, la correction n'a pas pris) ; les deux comptes ont des posts ; **la moyenne des images neuves est nettement sous les 229 Ko** des anciennes, autour de 60–90 Ko. Si elle est proche de 229 Ko, `pickImage` n'est pas branché sur le vrai payload.

`npm test` doit passer, dont « aucun post exclu n est entre dans le pool ».

- [ ] **Step 5: Re-tirer le feed et vérifier la ronde en conditions réelles**

```bash
npm run ig-select
node -e "const f=require('./src/data/instagram-feed.json');const c={};for(const p of f.posts)if(p.group==='createurs')c[p.handle]=(c[p.handle]||0)+1;console.log(c)"
```

Attendu : quatre comptes, **~5/5/4/4**. Si `simonian_jewels` approche 16, le tirage à la ronde de la tâche 1 n'est pas en service.

- [ ] **Step 6: Vérifier le rendu**

```bash
npm run dev
```

Ouvrir `http://localhost:5173`, section Réseaux :
- cinq étagères Instagram, la quatrième titrée « Créateurs arméniens » ;
- ses tuiles mélangent visiblement les quatre comptes ;
- ses pastilles (repliées par défaut) listent « Les comptes suivis (4) » ;
- le Reel de Maison Lumière, s'il est tiré, apparaît dans « Ateliers arméniens » ;
- vérifier `/hy/` : le titre `Հայ ստեղծագործողներ` est le plus long, c'est lui qui décide si la tête de brin tient. À 360 px de large et dans les deux thèmes.

- [ ] **Step 7: Commit**

```bash
git add src/data/instagram.json src/data/instagram-feed.json src/data/ig/
git commit -m "data(instagram): recolte de simonian_jewels et naregjewelry

Catalogue entier pour simonian_jewels, neuf posts pour naregjewelry hors
les quinze exclus. Images enregistrees au format des tuiles.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: La documentation

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** aucune.

- [ ] **Step 1: Mettre à jour les trois passages périmés**

**a.** Dans la section « Commandes », après la ligne `npm run ig-scrape` :

```
npm run ig-select   # re-tirer le mur Instagram depuis le pool (local, sans reseau)
```

**b.** Dans la description d'`instagram.mjs` (section « Flux de données »), remplacer le paragraphe qui décrit quatre brins par :

```
  - `instagram.mjs` — sélection aléatoire depuis le pool Instagram, **par
    brin** : chaque compte déclare son `group` (`institutions` |
    `personnalites` | `creation` | `createurs` | `terre` — 9, 6, 4, 4 et 4
    comptes) et le tirage prend `limit` posts **par groupe**, pas `limit` en
    tout — sinon le groupe le plus fourni chasserait les autres de leur propre
    carrousel. Le job horaire appelle `selectInstagram(18)`, donc 90 posts dans
    `instagram-feed.json`.
    - **À l'intérieur d'un brin, le tirage est À LA RONDE** : un post chez
      chaque compte à tour de rôle, l'ordre des comptes remélangé à chaque
      tirage. Un mélange à plat donnerait les tuiles à proportion des posts de
      chaque compte — invisible tant que tous en ont neuf, et faux dès qu'un
      compte porte `count: 'all'` (`simonian_jewels`) : il prendrait ~16 tuiles
      sur 18 et le brin deviendrait son mur. C'est le même déséquilibre que le
      tirage par groupe corrige un cran plus haut.
```

**c.** Dans la description de `scripts/ig-scrape.mjs`, remplacer le chiffre périmé « 9 derniers posts de chacun des **16 comptes** curés (144 posts, 138 shortcodes distincts…) » — faux depuis le passage à 25 comptes — par :

```
- **`scripts/ig-scrape.mjs`** — rafraîchit le pool Instagram. **Étape manuelle
  locale**, pas horaire : Instagram exige une session connectée et bloque la CI.
  Récolte les **9 derniers posts** de chacun des **27 comptes** curés, datés, et
  télécharge leurs images dans `src/data/ig/`. Trois réglages, tous silencieux
  s'ils manquent :
  - **`count` par compte** (entier, ou `'all'` jusqu'à un plafond dur de 500)
    surcharge le défaut de 9. `'all'` pagine via `next_max_id`.
  - **`exclude` à la racine du pool** : des shortcodes que le scraper ne prend
    jamais, quel que soit le compte. Il s'applique **ici seulement** — le site
    ne le relit pas, donc `test/instagram-pool.test.mjs` est le seul endroit
    d'où l'exclusion peut être vérifiée.
  - **`--only <handle[,handle]>`** récolte un compte sans réécrire les 26
    autres ni re-télécharger 218 images.

  **Le piège** : sa réécriture finale doit repartir de `{ ...pool, accounts }`.
  Reconstruire l'objet effacerait `exclude` à la première récolte — un JSON
  valide, un pool sans exclusion, et rien pour le dire.

  **Et le job horaire ne fait que re-mélanger ce pool** : sans récolte, le mur
  re-sert indéfiniment les mêmes posts tout en ayant l'air frais.
```

**d.** Dans la section « Données », mettre à jour le schéma du pool :

```
- Schéma du pool Instagram :
  `{ exclude: [shortcode], accounts: [{ handle, name, url, group, count?, posts: [{url, date}] }] }`,
  où `group` vaut `institutions`, `personnalites`, `creation`, `createurs` ou
  `terre` et décide de quel carrousel le compte relève (absent = `institutions`).
  Le scraper réécrit les `posts` — **jamais** le tableau `accounts`, **jamais**
  `exclude`. Une valeur de `group` hors de ces cinq fait disparaître le compte
  du mur sans le moindre signe : `igStrands` (`Social.jsx`) ne rend que les
  brins qu'il déclare, d'où `test/instagram-strands.test.mjs`.
```

**e.** Dans le préambule des tests, porter le décompte de **125** au nombre réel et nommer les trois fichiers Instagram. Le mesurer d'abord :

```bash
npm test 2>&1 | tail -5
```

Reprendre le total annoncé par `node --test` et l'écrire dans `CLAUDE.md`.

- [ ] **Step 2: Vérifier**

```bash
npm test
npm run lint
npm run build && npm run check
```

Attendu : tout passe. `npm run check` contrôle les 12 pages produites — il n'est pas affecté par ce chantier, mais il confirme qu'aucune régression de build ne s'est glissée.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: cinq brins Instagram, tirage a la ronde, reglages de recolte

Documente ce qui ne se deduit pas du code : pourquoi le tirage est a la
ronde a l interieur d un brin, pourquoi la liste d exclusion ne
s applique que dans le scraper, et pourquoi sa reecriture finale doit
repartir du pool entier sous peine d effacer cette liste en silence.

Retire au passage un chiffre perime — « 16 comptes curés, 144 posts » —
que le passage a 25 comptes avait deja rendu faux.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Couverture de la spec :**

| Section de la spec | Tâche |
|---|---|
| §1 taxonomie cinq brins | 4 (données) + 5 (affichage) |
| §2 titre `ig.strand.creators` ×4 langues | 5 |
| §3 tirage à la ronde + remélange de l'ordre + dedup COLLAB | 1 |
| §4 `count: 'all'` + pagination + plafond 500 + pause | 2 (décision) + 3 (pagination) |
| §4 `exclude` de 15 shortcodes, global, appliqué au seul scraper | 2 (`keepable`) + 3 (branchement) + 4 (données) |
| §5 piège du `count=12` + avertissement récolte courte | 2 (`pageCount`) + 3 (log `↯`) |
| §6 images au format des tuiles, repli si < 640 px | 2 (`pickImage`) + 3 (`download`) |
| §7 `--only` + orphelins sûrs + `okCount` + handle inconnu | 3 |
| §8 `ig-select`, `generatedAt` conservé | 6 |
| §9 les trois fichiers de test | 1, 4, 5 |
| Vérification : `--dry` avant écriture, poids mesuré | 7 (étape 2, porte explicite) |
| Vérification : répartition ~5/5/4/4 | 6 (étape 3) + 7 (étape 5) |
| Vérification : rendu 4 langues, 2 thèmes, 360 px | 7 (étape 6) |
| `CLAUDE.md` + chiffre périmé retiré | 8 |

**Un défaut trouvé pendant cette revue et corrigé dans le plan :** la spec ne mentionnait pas que `ig-scrape.mjs` reconstruit le pool en `{_comment, accounts}` et **effacerait `exclude`** à la première récolte. C'est une perte de données silencieuse — un JSON valide, un pool sans exclusion. Le correctif est en tâche 3 (étape 4), et il est **vérifié** en tâche 7 (étape 4, `exclude preserve : true`).

**Cohérence des noms :** `drawGroup`, `pickImage`, `wantedFor`, `pageCount`, `keepable`, `shortcodeOf`, `harvestPage`, `harvestAll` — chacun défini une fois et utilisé sous ce nom partout. `MIN_IMAGE_WIDTH` / `DEFAULT_COUNT` / `MAX_COUNT` / `MAX_PAGE` définis en tâche 2, consommés en tâches 3 et 4. Le groupe est `createurs` et la clé i18n `ig.strand.creators` partout (le groupe est un mot français sans accent, la clé un mot anglais — l'écart est délibéré et suit `personnalites` / `ig.strand.people`).
