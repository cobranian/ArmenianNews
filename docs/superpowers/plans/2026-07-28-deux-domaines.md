# Deux domaines, une base de code — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** servir `armenieinfo.ch` (fr) et `armenianews.org` (en, hy, ru) depuis un seul dépôt, un seul scrape horaire et un seul projet Firebase, avec des `hreflang` réciproques qui rendent enfin indexables les trois langues aujourd'hui invisibles.

**Architecture:** un `sites.config.js` à la racine est la source de vérité (hosts, marques, pages, langues). Un générateur de `<head>` en JS pur (`scripts/lib/site-meta.mjs`) produit les métadonnées par couple (site, langue) ; il est appelé à la fois par un plugin Vite (build principal) et par le post-build (pages `/hy/` et `/ru/`). La langue se résout depuis l'URL, plus depuis `localStorage`. Un orchestrateur `scripts/build-sites.mjs` lance deux builds Vite, dérive les pages supplémentaires, et écrit les sitemaps et robots.

**Tech Stack:** Vite 6, React 18, Node 24 (`node --test` intégré), Firebase Hosting (deux cibles, un projet), Puppeteer-core pour le prérendu.

**Spec de référence :** `docs/superpowers/specs/2026-07-28-deux-domaines-design.md`

## Global Constraints

- **Langues** : exactement `fr`, `en`, `hy`, `ru` — les codes de `LANGS`, qui vit dans `sites.config.js` depuis Task 1 (`src/i18n.jsx` le ré-exporte).
- **Répartition figée** : `armenieinfo.ch/` → fr. `armenianews.org/` → en, `/hy/` → hy, `/ru/` → ru.
- **Marques** : `Arménie Info` sur le .ch, `Armenia News` sur le .org.
- **Ordre du sélecteur de langue** : figé par domaine, la langue du domaine en tête. `.ch` → FR EN ՀԱՅ РУ ; `.org` → EN FR ՀԱՅ РУ **sur ses trois pages**, seule la mise en évidence de la langue active se déplace.
- **`hreflang` réciproques** : les quatre `alternate` plus `x-default` sont **identiques sur les quatre pages**, chacune se citant elle-même. Une page absente de son propre bloc fait ignorer tout le bloc par Google.
- **`x-default`** = `https://armenianews.org/`.
- **`localStorage` ne stocke plus la langue.** La clé `lang` n'est ni lue ni écrite. La clé `theme` reste inchangée.
- **`lastmod` des sitemaps** = `src/data/meta.json` → `generatedAt`. **Jamais** l'heure du build (voir Task 7).
- **Lint** : `npm run lint` doit rester à **0 erreur** et ne jamais **dépasser** le décompte d'avertissements constaté (6 au départ ; il peut descendre à 5 après le déplacement de `LANGS` à Task 1 — une baisse est une amélioration, une hausse une régression). Les avertissements connus sont documentés dans `CLAUDE.md` ; ne pas les « corriger ».
- **Node ne sait pas parser `.jsx`.** Aucun script de `scripts/` ni aucun test ne doit importer un fichier `.jsx` : ils tournent sous Node, qui lève `ERR_UNKNOWN_FILE_EXTENSION`. Ce qui doit être lu des deux côtés (navigateur et Node) vit dans un `.js` plat — `sites.config.js`, `src/seo.js`, `src/site.js`. N'ajoutez pas de transpileur pour contourner ça.
- **Aucun fichier de `scripts/sources/`, `src/data/` ou `proxy/` ne bouge ni ne change.**
- **`og:image`** reste `og-image.jpg` sur les deux sites (1200×630, sRGB, sans profil ICC — contrainte WhatsApp).
- **GA4** : l'ID `G-EB3W5XXSMW` reste identique dans `index.html` et `public/ga-init.js`.
- **Projet Firebase** : `armenie-info` pour les deux sites. Sites Hosting : `armenie-info` (cible `ch`) et `armenia-news` (cible `org`).

## Structure des fichiers

**Créés**
| Fichier | Responsabilité |
|---|---|
| `sites.config.js` | Source de vérité : les deux sites, leurs pages, dérivations (`LANG_URL`, `primaryLang`, `langFromPath`). Aucune dépendance. |
| `src/seo.js` | Chaînes SEO par langue (titre, description, keywords). JS plat, **sans React**, pour être lisible par Node. |
| `src/site.js` | `SITE_ID` de la page courante et `orderedLangs()`. **JS plat, sans composant** — voir la note d'avertissement de Task 5. |
| `scripts/lib/site-meta.mjs` | Génère le `<head>` par (site, langue) et l'applique à un HTML. Consommé par le plugin Vite **et** par le post-build. |
| `scripts/build-sites.mjs` | Orchestrateur : deux builds Vite, dérivation de `/hy/` et `/ru/`, sitemaps, robots. |
| `scripts/check-build.mjs` | Contrôle les quatre pages produites (lang, canonical, hreflang, marque). Réutilisable après chaque build. |
| `test/sites-config.test.mjs` | Vérifie les dérivations et l'invariant langues. |
| `test/site-meta.test.mjs` | Vérifie la réciprocité des `hreflang` et le canonical auto-référent. |

**Modifiés**
| Fichier | Changement |
|---|---|
| `index.html` | Métas en dur remplacées par un marqueur `<!--SITE_META-->` ; `<html lang>` devient dynamique. |
| `vite.config.js` | Nouveau plugin `siteMeta()` ; lit `SITE_ID`. |
| `src/i18n.jsx` | Langue résolue depuis l'URL ; `localStorage` retiré ; `setLang` retiré du contexte. |
| `src/components/Nav.jsx:57-68` | Sélecteur de boutons → liens, ordonné par domaine. |
| `scripts/prerender.mjs` | Boucle sur les quatre pages au lieu d'une. |
| `scripts/scrape.mjs:50-65` | `writeSitemap` supprimé (déplacé au build). |
| `package.json` | `build` → orchestrateur ; ajout de `test`. |
| `firebase.json` | `hosting` devient un tableau de deux cibles. |
| `.firebaserc` | Ajout des `targets`. |
| `.github/workflows/hourly.yml` | `git add` sans le sitemap ; déploiement des deux cibles. |
| `eslint.config.js` | `sites.config.js` et `test/**` dans le monde Node. |
| `CLAUDE.md`, `README.md` | Nouvelle architecture et nouveaux pièges. |

**Supprimé** : `public/sitemap.xml` (désormais généré dans `dist/<id>/`).

---

## Task 1 : `sites.config.js` — la source de vérité

**Files:**
- Create: `sites.config.js`
- Create: `test/sites-config.test.mjs`
- Modify: `eslint.config.js:51`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `SITES` : `{ ch: Site, org: Site }` où `Site = { id, host, firebaseSite, brand, email, gscToken, pages }` et `pages: Array<{ lang, path }>`
  - `LANGS` : `Array<{ code, label, name }>` — **déplacé depuis `src/i18n.jsx:5-10`** (voir ci-dessous)
  - `LANG_URL` : `Record<'fr'|'en'|'hy'|'ru', string>` — URL absolue avec slash final
  - `ALL_LANGS` : `string[]` — les codes dans l'ordre canonique `['fr','en','hy','ru']`
  - `X_DEFAULT` : `string`
  - `primaryLang(siteId: string): string`
  - `langFromPath(siteId: string, pathname: string): string`
  - `siteOf(lang: string): string` — l'id du site qui héberge cette langue
- Consumes: rien.

**Note d'intégration** : ce module ne doit **jamais** importer `src/i18n.jsx`. `i18n.jsx` l'importe, l'inverse créerait un cycle.

**⚠ `LANGS` déménage ici.** Node lève `ERR_UNKNOWN_FILE_EXTENSION` sur un import de `.jsx` : ni les tests ni les scripts de build — qui tournent sous Node — ne peuvent lire `src/i18n.jsx`. La liste des langues doit donc vivre dans un `.js` plat. `src/i18n.jsx` la ré-exporte (`export { LANGS } from '../sites.config.js'`) pour que `Nav.jsx` et les autres consommateurs restent inchangés. Bénéfice au passage : il n'y a plus **deux** listes à tenir d'accord, donc l'invariant « une langue = une URL » devient structurel au lieu d'être vérifié après coup. **N'ajoutez pas de transpileur** (`tsx`, `ts-node`…) pour contourner ça — ce serait masquer la cause à deux endroits, dont le build.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `test/sites-config.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Tout vient de sites.config.js — surtout PAS de src/i18n.jsx, que Node ne
// sait pas parser (ERR_UNKNOWN_FILE_EXTENSION sur .jsx).
import {
  SITES, LANGS, LANG_URL, ALL_LANGS, X_DEFAULT, primaryLang, langFromPath, siteOf,
} from '../sites.config.js'

test('chaque langue vit à exactement une URL', () => {
  const langs = Object.values(SITES).flatMap((s) => s.pages.map((p) => p.lang))
  assert.deepEqual([...langs].sort(), [...ALL_LANGS].sort())
  assert.equal(new Set(langs).size, langs.length, 'une langue est servie à deux endroits')
})

test('ALL_LANGS et LANGS décrivent exactement les mêmes langues', () => {
  assert.deepEqual([...ALL_LANGS].sort(), LANGS.map((l) => l.code).sort())
})

test('LANG_URL est absolue et finit par un slash', () => {
  for (const lang of ALL_LANGS) {
    assert.match(LANG_URL[lang], /^https:\/\/[^/]+\/(?:[a-z]{2}\/)?$/, lang)
  }
  assert.equal(LANG_URL.fr, 'https://armenieinfo.ch/')
  assert.equal(LANG_URL.en, 'https://armenianews.org/')
  assert.equal(LANG_URL.hy, 'https://armenianews.org/hy/')
  assert.equal(LANG_URL.ru, 'https://armenianews.org/ru/')
})

test('x-default pointe sur la page anglaise', () => {
  assert.equal(X_DEFAULT, 'https://armenianews.org/')
})

test('primaryLang donne la langue de tête du domaine', () => {
  assert.equal(primaryLang('ch'), 'fr')
  assert.equal(primaryLang('org'), 'en')
})

test('langFromPath : le chemin fait autorité, sinon la langue du site', () => {
  assert.equal(langFromPath('org', '/hy/'), 'hy')
  assert.equal(langFromPath('org', '/hy'), 'hy')     // cleanUrls, sans slash final
  assert.equal(langFromPath('org', '/ru/'), 'ru')
  assert.equal(langFromPath('org', '/'), 'en')
  assert.equal(langFromPath('ch', '/'), 'fr')
})

test('langFromPath : une URL inconnue retombe sur la langue du site', () => {
  // Le rewrite SPA de Firebase sert index.html pour toute URL non trouvée ;
  // cette page-là est dans la langue par défaut du site, pas en 404.
  assert.equal(langFromPath('org', '/nimportequoi'), 'en')
  assert.equal(langFromPath('org', '/hydravion'), 'en') // ne doit PAS matcher /hy
})

test('siteOf route chaque langue vers son domaine', () => {
  assert.equal(siteOf('fr'), 'ch')
  assert.equal(siteOf('en'), 'org')
  assert.equal(siteOf('hy'), 'org')
  assert.equal(siteOf('ru'), 'org')
})
```

- [ ] **Step 2 : ajouter le script de test et couvrir les nouveaux fichiers au lint**

Dans `package.json`, ajouter à `"scripts"` :

```json
"test": "node --test test/*.mjs"
```

> **Le joker n'est pas décoratif.** Depuis Node 22, l'argument de `--test` est un
> **motif glob**, pas un dossier à parcourir : `node --test test/` fait
> correspondre le dossier lui-même, que Node tente ensuite de charger comme
> module — `MODULE_NOT_FOUND` (vérifié sur Node v24.15.0). Les deux shells sont
> couverts : sous Ubuntu (la CI) `sh` expanse le motif avant Node ; sous Windows
> `cmd.exe` ne l'expanse pas et Node le résout lui-même.

Dans `eslint.config.js`, ligne 51, étendre la liste du monde Node :

```js
    files: ['scripts/**/*.mjs', 'vite.config.js', 'eslint.config.js', 'sites.config.js', 'test/**/*.mjs'],
```

- [ ] **Step 3 : lancer le test pour le voir échouer**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../sites.config.js'`

- [ ] **Step 4 : écrire `sites.config.js`**

```js
// Source de vérité des deux vitrines. Tout en dérive : métadonnées HTML,
// hreflang, sitemaps, cibles Firebase, sélecteur de langue.
//
// Ce module est importé par le navigateur (src/) ET par Node (scripts/,
// vite.config.js). Il ne doit donc utiliser aucune API propre à l'un ou à
// l'autre — et surtout jamais importer src/i18n.jsx, qui l'importe déjà :
// le cycle casserait le bundle.

// Langues de l'interface. Vit ici et non dans i18n.jsx parce que Node doit
// pouvoir la lire (le build et les tests tournent hors navigateur, et Node
// lève ERR_UNKNOWN_FILE_EXTENSION sur un .jsx). i18n.jsx la ré-exporte, donc
// les composants continuent de l'importer depuis là.
// Le contenu (articles, posts) reste dans sa langue d'origine ; seul le chrome
// de l'interface est traduit.
export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն' },
  { code: 'ru', label: 'РУ', name: 'Русский' },
]

export const SITES = {
  ch: {
    id: 'ch',
    host: 'https://armenieinfo.ch',
    firebaseSite: 'armenie-info',
    brand: 'Arménie Info',
    email: 'contact@armenieinfo.ch',
    gscToken: 'dMoDQHq0L5w16RdNPGKom7TJZe6LNjEc7Qq4PtVjO7k',
    pages: [{ lang: 'fr', path: '/' }],
  },
  org: {
    id: 'org',
    host: 'https://armenianews.org',
    firebaseSite: 'armenia-news',
    brand: 'Armenia News',
    // Le .org n'a pas encore de boîte aux lettres propre ; on annonce celle qui
    // existe réellement plutôt qu'une adresse morte dans le JSON-LD.
    email: 'contact@armenieinfo.ch',
    gscToken: null, // à remplir dès la propriété Search Console créée
    pages: [
      { lang: 'en', path: '/' },
      { lang: 'hy', path: '/hy/' },
      { lang: 'ru', path: '/ru/' },
    ],
  },
}

// Ordre canonique des langues. Doit correspondre aux codes de LANGS, juste
// au-dessus — vérifié par test/sites-config.test.mjs et par une assertion au
// build (scripts/build-sites.mjs).
export const ALL_LANGS = ['fr', 'en', 'hy', 'ru']

// lang -> URL absolue, slash final compris. Une seule table, consommée par le
// générateur de hreflang ET par le sélecteur de langue : ce que le HTML
// déclare à Google et ce que le bouton fait au clic ne peuvent pas diverger.
export const LANG_URL = Object.fromEntries(
  Object.values(SITES).flatMap((site) =>
    site.pages.map((page) => [page.lang, site.host + page.path]),
  ),
)

// La page servie à un visiteur dont aucune langue ne correspond.
export const X_DEFAULT = LANG_URL.en

export function primaryLang(siteId) {
  return SITES[siteId].pages[0].lang
}

export function siteOf(lang) {
  const hit = Object.values(SITES).find((s) => s.pages.some((p) => p.lang === lang))
  if (!hit) throw new Error(`langue sans site : ${lang}`)
  return hit.id
}

// Le chemin fait autorité ; à défaut, la langue de tête du domaine.
// Normalise le slash final pour que /hy et /hy/ se comportent pareil
// (Firebase sert les deux via cleanUrls) — et pour que /hydravion ne
// matche pas /hy.
export function langFromPath(siteId, pathname) {
  const site = SITES[siteId]
  const norm = pathname.endsWith('/') ? pathname : `${pathname}/`
  const hit = site.pages.find((p) => p.path !== '/' && norm.startsWith(p.path))
  return hit ? hit.lang : primaryLang(siteId)
}
```

- [ ] **Step 5 : ré-exporter `LANGS` depuis `src/i18n.jsx`**

Remplacer la déclaration des lignes 3-10 par une ré-exportation, pour que
`Nav.jsx` et les autres consommateurs restent inchangés :

```js
// La liste des langues vit dans sites.config.js : Node doit pouvoir la lire
// (le build et les tests tournent hors navigateur, et il ne sait pas parser
// .jsx). Ré-exportée ici pour que les composants l'importent toujours d'ici.
export { LANGS } from '../sites.config.js'
```

- [ ] **Step 6 : lancer le test pour le voir passer**

Run: `npm test`
Expected: PASS — 8 tests, 0 échec. **Sous `node --test`, sans transpileur.**

- [ ] **Step 7 : vérifier le lint**

Run: `npm run lint`
Expected: 0 erreur. Le décompte d'avertissements est de 6 avant ce changement ;
il peut tomber à **5** si `react-refresh/only-export-components` ne compte pas
les ré-exportations. Une baisse est une amélioration. **Noter le chiffre
constaté** — c'est le nouveau seuil de référence pour les tâches suivantes.

- [ ] **Step 8 : commit**

```bash
git add sites.config.js src/i18n.jsx test/sites-config.test.mjs eslint.config.js package.json
git commit -m "config: sites.config.js, source de vérité des deux vitrines"
```

---

## Task 2 : `src/seo.js` — les chaînes SEO par langue

**Files:**
- Create: `src/seo.js`

**Interfaces:**
- Produces: `SEO: Record<lang, { tagline: string, description: string, keywords: string }>`
- Consumes: rien.

**Pourquoi un fichier à part et pas `i18n.jsx`** : ces chaînes doivent être lues par Node (`scripts/lib/site-meta.mjs` génère les pages `/hy/` et `/ru/` hors bundle), or `i18n.jsx` importe React et exporte un composant. C'est le précédent exact de `src/worldPlace.js`, gardé à part pour la même raison. Le fichier n'exporte **aucun composant**, donc il n'ajoute pas d'avertissement `react-refresh` — le compte reste à 6.

- [ ] **Step 1 : écrire `src/seo.js`**

```js
// Chaînes SEO par langue : ce qui part dans <title>, <meta description> et les
// cartes de partage. Séparé de i18n.jsx — qui importe React — parce que
// scripts/lib/site-meta.mjs doit les lire depuis Node pour générer les pages
// /hy/ et /ru/ hors du bundle. Même raison que src/worldPlace.js.
//
// La marque ne vit PAS ici : elle vient du site (SITES[id].brand), parce
// qu'elle suit le domaine et non la langue. Le titre final se compose
// `${brand} · ${tagline}`.

export const SEO = {
  fr: {
    tagline: 'Actualités arméniennes de Suisse',
    description:
      'Actualités, agenda et réseaux sociaux arméniens de Suisse et du monde, mis à jour chaque heure.',
    keywords:
      'actualités arméniennes, Arménie, Artsakh, diaspora arménienne, agenda arménien, communauté arménienne de Suisse',
  },
  en: {
    tagline: 'Armenian news, events and social media',
    description:
      'Armenian news, events and social media from Armenia and the diaspora, updated every hour.',
    keywords:
      'Armenian news, Armenia, Artsakh, Armenian diaspora, Armenian events, Armenian community',
  },
  hy: {
    tagline: 'Հայկական լուրեր, միջոցառումներ և սոցիալական ցանցեր',
    description:
      'Հայկական լուրեր, միջոցառումներ և սոցիալական ցանցեր Հայաստանից և սփյուռքից, թարմացվում է ամեն ժամ։',
    keywords:
      'հայկական լուրեր, Հայաստան, Արցախ, հայկական սփյուռք, միջոցառումներ, հայ համայնք',
  },
  ru: {
    tagline: 'Армянские новости, события и социальные сети',
    description:
      'Армянские новости, события и социальные сети из Армении и диаспоры, обновление каждый час.',
    keywords:
      'армянские новости, Армения, Арцах, армянская диаспора, армянские события, армянская община',
  },
}

// Codes de locale Open Graph, un par langue.
export const OG_LOCALE = { fr: 'fr_FR', en: 'en_US', hy: 'hy_AM', ru: 'ru_RU' }
```

> `keywords` est repris par parité avec l'`index.html` actuel. Aucun moteur majeur ne le lit depuis plus de quinze ans ; il est conservé parce que le supprimer sortirait du périmètre demandé, pas parce qu'il sert.

- [ ] **Step 2 : vérifier que le fichier est lisible depuis Node**

Run: `node -e "import('./src/seo.js').then(m => console.log(Object.keys(m.SEO).join(',')))"`
Expected: `fr,en,hy,ru`

- [ ] **Step 3 : vérifier le lint**

Run: `npm run lint`
Expected: 0 erreur, 5 avertissements (référence depuis Task 1)

- [ ] **Step 4 : commit**

```bash
git add src/seo.js
git commit -m "seo: chaînes de titre et description par langue, lisibles depuis Node"
```

---

## Task 3 : `scripts/lib/site-meta.mjs` — le générateur de `<head>`

**Files:**
- Create: `scripts/lib/site-meta.mjs`
- Create: `test/site-meta.test.mjs`

**Interfaces:**
- Consumes: `SITES`, `LANG_URL`, `ALL_LANGS`, `X_DEFAULT`, `siteOf` (Task 1) ; `SEO`, `OG_LOCALE` (Task 2)
- Produces:
  - `headFor({ siteId, lang }): string` — le bloc de balises `<head>`, encadré des sentinelles, indenté de 4 espaces
  - `applyMeta(html: string, { siteId, lang }): string` — remplace `<!--SITE_META-->` (HTML **source**) et l'attribut `lang` de `<html>`
  - `replaceMeta(html: string, { siteId, lang }): string` — remplace ce qui est **entre les sentinelles** (HTML **déjà bâti**) et l'attribut `lang`
  - `META_MARKER: string` = `'<!--SITE_META-->'`
  - `META_START: string` = `'<!--SITE_META:START-->'`, `META_END: string` = `'<!--SITE_META:END-->'`

**Pourquoi deux fonctions.** `applyMeta` consomme le marqueur : après le passage du plugin Vite, `dist/<id>/index.html` ne le contient plus. Or Task 8 doit dériver `/hy/` et `/ru/` **à partir du HTML bâti** (celui-ci porte les hachages d'assets que le HTML source n'a pas). D'où les sentinelles : `applyMeta` pose un bloc encadré, `replaceMeta` échange son contenu autant de fois qu'on veut. Sans elles, dériver une page exigerait de rejouer tout le build.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `test/site-meta.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headFor, applyMeta, replaceMeta, META_MARKER } from '../scripts/lib/site-meta.mjs'
import { ALL_LANGS, LANG_URL, siteOf } from '../sites.config.js'

const PAGES = ALL_LANGS.map((lang) => ({ lang, siteId: siteOf(lang) }))

test('le canonical est auto-référent sur chaque page', () => {
  for (const { siteId, lang } of PAGES) {
    const head = headFor({ siteId, lang })
    assert.ok(
      head.includes(`<link rel="canonical" href="${LANG_URL[lang]}" />`),
      `canonical manquant ou faux pour ${lang}`,
    )
  }
})

test('les hreflang sont réciproques : chaque page cite les quatre, dont elle-même', () => {
  for (const { siteId, lang } of PAGES) {
    const head = headFor({ siteId, lang })
    for (const other of ALL_LANGS) {
      assert.ok(
        head.includes(`hreflang="${other}" href="${LANG_URL[other]}"`),
        `page ${lang} : alternate ${other} manquant`,
      )
    }
    assert.ok(head.includes('hreflang="x-default"'), `page ${lang} : x-default manquant`)
  }
})

test('la marque suit le domaine, la baseline suit la langue', () => {
  assert.ok(headFor({ siteId: 'ch', lang: 'fr' }).includes('Arménie Info · Actualités arméniennes'))
  assert.ok(headFor({ siteId: 'org', lang: 'en' }).includes('Armenia News · Armenian news'))
  // Sur /hy/ : marque anglaise du domaine, baseline arménienne.
  const hy = headFor({ siteId: 'org', lang: 'hy' })
  assert.ok(hy.includes('Armenia News · Հայկական լուրեր'), 'marque ou baseline fausse sur /hy/')
})

test('og:url et og:image sont absolus vers le bon host', () => {
  const hy = headFor({ siteId: 'org', lang: 'hy' })
  assert.ok(hy.includes('property="og:url" content="https://armenianews.org/hy/"'))
  assert.ok(hy.includes('content="https://armenianews.org/og-image.jpg"'))
})

test('la balise de vérification GSC n\'apparaît que si le jeton existe', () => {
  assert.ok(headFor({ siteId: 'ch', lang: 'fr' }).includes('google-site-verification'))
  assert.ok(!headFor({ siteId: 'org', lang: 'en' }).includes('google-site-verification'))
})

test('applyMeta remplace le marqueur et l\'attribut lang', () => {
  const src = `<!doctype html>\n<html lang="fr">\n  <head>\n    <!--SITE_META-->\n  </head>\n</html>`
  const out = applyMeta(src, { siteId: 'org', lang: 'ru' })
  assert.ok(out.includes('<html lang="ru">'))
  assert.ok(!out.includes(META_MARKER))
  assert.ok(out.includes('https://armenianews.org/ru/'))
})

test('applyMeta refuse un HTML sans marqueur plutôt que de produire une page muette', () => {
  assert.throws(
    () => applyMeta('<html lang="fr"><head></head></html>', { siteId: 'ch', lang: 'fr' }),
    /SITE_META/,
  )
})

test('replaceMeta rejoue sur un HTML déjà bâti, autant de fois que voulu', () => {
  // C'est le cas d'usage de Task 8 : dist/org/index.html est passé par Vite
  // (hachages d'assets posés, marqueur consommé), et il faut en dériver la
  // page /hy/ sans rejouer le build.
  const src = `<!doctype html>\n<html lang="fr">\n  <head>\n    <!--SITE_META-->\n  </head>\n  <body><script src="/assets/index-a1b2c3.js"></script></body>\n</html>`
  const built = applyMeta(src, { siteId: 'org', lang: 'en' })
  assert.ok(built.includes('/assets/index-a1b2c3.js'), 'le corps bâti doit survivre')

  const hy = replaceMeta(built, { siteId: 'org', lang: 'hy' })
  assert.ok(hy.includes('<html lang="hy">'))
  assert.ok(hy.includes('rel="canonical" href="https://armenianews.org/hy/"'))
  // Un seul canonical : celui de l'anglais doit avoir disparu, pas s'ajouter.
  assert.equal((hy.match(/rel="canonical"/g) || []).length, 1)
  assert.ok(hy.includes('/assets/index-a1b2c3.js'), 'le hachage d\'asset doit survivre')

  // Idempotent : rejouer sur le résultat redonne le même résultat.
  assert.equal(replaceMeta(hy, { siteId: 'org', lang: 'hy' }), hy)
})

test('replaceMeta refuse un HTML sans sentinelles', () => {
  assert.throws(
    () => replaceMeta('<html lang="en"><head></head></html>', { siteId: 'org', lang: 'hy' }),
    /SITE_META/,
  )
})
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/lib/site-meta.mjs'`

- [ ] **Step 3 : écrire `scripts/lib/site-meta.mjs`**

```js
// Génère le <head> propre à un couple (site, langue).
//
// Appelé à deux moments : par le plugin Vite pendant `vite build` (page par
// défaut de chaque site), et par scripts/build-sites.mjs pour dériver /hy/ et
// /ru/ à partir du HTML déjà bâti. Un seul générateur pour les deux, sinon les
// quatre pages divergent — et une divergence dans les hreflang les fait
// silencieusement ignorer par Google.
import { SITES, LANG_URL, ALL_LANGS, X_DEFAULT } from '../../sites.config.js'
import { SEO, OG_LOCALE } from '../../src/seo.js'

export const META_MARKER = '<!--SITE_META-->'

// Le bloc généré s'encadre de sentinelles. Elles restent dans le HTML bâti,
// ce qui permet à scripts/build-sites.mjs de dériver /hy/ et /ru/ en échangeant
// juste le contenu entre les deux — à partir du HTML SORTI de Vite, donc avec
// ses hachages d'assets. Sans elles il faudrait rejouer un build par page.
export const META_START = '<!--SITE_META:START-->'
export const META_END = '<!--SITE_META:END-->'

// Échappe ce qui part dans un attribut HTML. Les chaînes viennent de nos
// propres fichiers, mais un apostrophe typographique mal placé dans une
// baseline ne doit pas pouvoir casser un attribut.
const attr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function jsonLd(site, lang) {
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${site.host}/#website`,
      url: `${site.host}/`,
      name: site.brand,
      description: SEO[lang].description,
      inLanguage: site.pages.map((p) => p.lang),
      publisher: { '@id': `${site.host}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${site.host}/#organization`,
      name: site.brand,
      url: `${site.host}/`,
      email: site.email,
      description: SEO[lang].description,
      // Les deux marques se déclarent l'une l'autre : c'est ce qui les présente
      // comme des sites sœurs plutôt que comme deux copies concurrentes.
      sameAs: Object.values(SITES)
        .filter((s) => s.id !== site.id)
        .map((s) => `${s.host}/`),
      logo: {
        '@type': 'ImageObject',
        url: `${site.host}/apple-touch-icon.png`,
        width: 180,
        height: 180,
      },
      image: `${site.host}/og-image.jpg`,
    },
  ]
  // Échappe "<" pour qu'aucune chaîne ne puisse fermer le <script>.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}

export function headFor({ siteId, lang }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!SEO[lang]) throw new Error(`langue sans chaînes SEO : ${lang}`)

  const url = LANG_URL[lang]
  const title = `${site.brand} · ${SEO[lang].tagline}`
  const { description, keywords } = SEO[lang]
  const image = `${site.host}/og-image.jpg`

  const lines = [
    `<meta name="description" content="${attr(description)}" />`,
    `<meta name="keywords" content="${attr(keywords)}" />`,
    `<title>${attr(title)}</title>`,
    `<link rel="canonical" href="${url}" />`,
    '',
    '<!-- Versions linguistiques. Réciproques et identiques sur les quatre',
    '     pages : une page absente de son propre bloc fait ignorer tout le',
    '     bloc par Google. Générées depuis sites.config.js — ne pas éditer. -->',
    ...ALL_LANGS.map(
      (l) => `<link rel="alternate" hreflang="${l}" href="${LANG_URL[l]}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${X_DEFAULT}" />`,
    '',
  ]

  if (site.gscToken) {
    lines.push(
      '<!-- Vérification de propriété Google Search Console -->',
      `<meta name="google-site-verification" content="${attr(site.gscToken)}" />`,
      '',
    )
  }

  lines.push(
    '<!-- Open Graph / partage social -->',
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${attr(site.brand)}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${attr(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    ...ALL_LANGS.filter((l) => l !== lang).map(
      (l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`,
    ),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${attr(title)}" />`,
    `<meta name="twitter:description" content="${attr(description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    '',
    '<!-- Données structurées (schema.org) -->',
    `<script type="application/ld+json">${jsonLd(site, lang)}</script>`,
  )

  const body = lines.map((l) => (l ? `    ${l}` : '')).join('\n')
  return `    ${META_START}\n${body}\n    ${META_END}`
}

const setLang = (html, lang) => html.replace(/<html\s+lang="[^"]*"/, `<html lang="${lang}"`)

// Pour le HTML SOURCE (index.html du dépôt), qui porte le marqueur.
export function applyMeta(html, { siteId, lang }) {
  if (!html.includes(META_MARKER)) {
    throw new Error(`marqueur ${META_MARKER} absent du HTML — page sans métadonnées, refus`)
  }
  return setLang(html, lang).replace(META_MARKER, headFor({ siteId, lang }).trimStart())
}

// Pour le HTML DÉJÀ BÂTI, qui porte les sentinelles. Idempotent : rejouable
// autant de fois que voulu sur son propre résultat.
export function replaceMeta(html, { siteId, lang }) {
  const from = html.indexOf(META_START)
  const to = html.indexOf(META_END)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(
      `sentinelles ${META_START}…${META_END} absentes — HTML non bâti par applyMeta, refus`,
    )
  }
  const head = headFor({ siteId, lang }).trimStart()
  return setLang(html.slice(0, from) + head + html.slice(to + META_END.length), lang)
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

Run: `npm test`
Expected: PASS — 16 tests au total (7 de Task 1 + 9 ici), 0 échec

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/site-meta.mjs test/site-meta.test.mjs
git commit -m "seo: générateur de head par site et par langue, hreflang réciproques"
```

---

## Task 4 : `index.html` dépouillé + plugin Vite

**Files:**
- Modify: `index.html:1-39, 41-75` (métas et JSON-LD remplacés par le marqueur)
- Modify: `vite.config.js:1-61`

**Interfaces:**
- Consumes: `applyMeta`, `META_MARKER` (Task 3) ; `primaryLang` (Task 1)
- Produces: un `index.html` contenant `<!--SITE_META-->`, et un build Vite qui le remplace selon `process.env.SITE_ID` (défaut `'ch'`).

- [ ] **Step 1 : remplacer les métas de `index.html` par le marqueur**

**Ne procédez pas par numéros de ligne** : les blocs à retirer sont à trois endroits, et supprimer le premier décale tous les suivants. Repérez chaque bloc par son **contenu**.

À **retirer** de `<head>` — quatre blocs, dans n'importe quel ordre :

| Bloc | Repère |
|---|---|
| description + keywords | `<meta name="description"` et `<meta name="keywords"` |
| canonical + vérification GSC | `<link rel="canonical"`, son commentaire `<!-- Google Search Console…`, et `<meta name="google-site-verification"` |
| `<title>` | `<title>Arménie Info · Actualités arméniennes de Suisse</title>` |
| Open Graph / Twitter / JSON-LD | du commentaire `<!-- Open Graph / social sharing -->` jusqu'à la fin du `</script>` du bloc `application/ld+json`, commentaire `<!-- Structured data…` compris |

À **conserver** intact, bien qu'entouré de lignes supprimées :

- `<meta charset="UTF-8" />`
- `<meta name="viewport" …/>`
- **`<meta name="theme-color" content="#100f0d" />`** — il est situé *entre* `keywords` et `canonical`, donc au milieu de la zone retirée. C'est le piège de cette étape : il ne fait pas partie des métadonnées par site (il est identique sur les quatre pages) et doit rester en dur.
- tout le bloc Google Analytics avec son commentaire, les favicons, les polices, et tout le `<body>`

Le `<head>` doit alors commencer exactement ainsi :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#100f0d" />

    <!-- Métadonnées propres au couple (site, langue) : titre, description,
         canonical, hreflang, Open Graph, JSON-LD, vérification Search Console.
         Générées par scripts/lib/site-meta.mjs depuis sites.config.js, et
         injectées ici par le plugin siteMeta() de vite.config.js.
         Ne rien écrire en dur à la place : les quatre pages divergeraient, et
         des hreflang divergents sont ignorés par Google. -->
    <!--SITE_META-->

    <!-- Google Analytics 4 (Consent Mode v2 — consentement refusé par défaut,
```

Tout le reste du fichier (scripts GA, favicons, polices, `<body>`) est **inchangé**.

Contrôle avant de passer à l'étape suivante :

```bash
node -e "
const h=require('node:fs').readFileSync('index.html','utf8');
const doit=['<!--SITE_META-->','theme-color','G-EB3W5XXSMW','favicon.svg','theme-init.js','<div id=\"root\"></div>'];
const parti=['rel=\"canonical\"','og:site_name','google-site-verification','application/ld+json','name=\"keywords\"','<title>'];
let ko=0;
for(const s of doit) if(!h.includes(s)){console.error('MANQUE (doit rester): '+s);ko++}
for(const s of parti) if(h.includes(s)){console.error('RESTE (doit partir): '+s);ko++}
console.log(ko?ko+' problème(s)':'✓ index.html conforme');
process.exit(ko?1:0)"
```

Expected: `✓ index.html conforme`

- [ ] **Step 2 : ajouter le plugin dans `vite.config.js`**

Remplacer les lignes 1 à 11 par :

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { applyMeta } from './scripts/lib/site-meta.mjs'
import { primaryLang } from './sites.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Firebase Hosting serves from the domain root.
// Override with BASE_PATH env if deploying under a subpath.
const base = process.env.BASE_PATH ?? '/'

// Quelle vitrine ce build produit. scripts/build-sites.mjs lance un build par
// site avec SITE_ID posé ; `npm run dev` n'en pose aucun et travaille donc sur
// le .ch, la vitrine française.
const SITE_ID = process.env.SITE_ID ?? 'ch'

// Injecte le <head> propre à (site, langue par défaut du site). Les pages /hy/
// et /ru/ ne passent pas par ici : elles sont dérivées après le build par
// scripts/build-sites.mjs, avec le même générateur.
function siteMeta() {
  return {
    name: 'site-meta',
    transformIndexHtml(html) {
      return applyMeta(html, { siteId: SITE_ID, lang: primaryLang(SITE_ID) })
    },
  }
}
```

Puis, à la fin du fichier, remplacer l'export par :

```js
export default defineConfig({
  base,
  plugins: [react(), siteMeta(), agendaEventsJsonLd()],
})
```

La fonction `agendaEventsJsonLd()` (lignes 17-56) est **inchangée**.

- [ ] **Step 3 : bâtir et vérifier le HTML produit**

Run: `npm run build && node -e "const h=require('node:fs').readFileSync('dist/index.html','utf8'); for (const s of ['<html lang=\"fr\"','rel=\"canonical\" href=\"https://armenieinfo.ch/\"','hreflang=\"hy\" href=\"https://armenianews.org/hy/\"','hreflang=\"x-default\"','Arménie Info · Actualités']) { if (!h.includes(s)) { console.error('MANQUE: '+s); process.exit(1) } } console.log('OK — head fr complet')"`

Expected: `OK — head fr complet`

> À ce stade `npm run build` produit encore `dist/` à plat ; Task 6 le remplace par `dist/ch` et `dist/org`.

- [ ] **Step 4 : vérifier le mode dev**

Run: `npm run dev` puis ouvrir `http://localhost:5173`
Expected: la page s'affiche en français, `<head>` contient le canonical `armenieinfo.ch` et les quatre `hreflang`. Arrêter le serveur.

- [ ] **Step 5 : lint et tests**

Run: `npm run lint && npm test`
Expected: 0 erreur / 5 avertissements, puis 16 tests réussis

- [ ] **Step 6 : commit**

```bash
git add index.html vite.config.js
git commit -m "seo: head généré par site et par langue au lieu de métas en dur"
```

---

## Task 5 : la langue se résout depuis l'URL

**Files:**
- Create: `src/site.js`
- Modify: `src/i18n.jsx:1, 567-606`

**Interfaces:**
- Consumes: `langFromPath`, `primaryLang` (Task 1)
- Produces:
  - `src/site.js` → `SITE_ID: string`, `orderedLangs(langs: Array<{code}>): Array<{code}>`
  - le contexte `useI18n()` expose `{ lang, t, formatDate, locale }` — **`setLang` disparaît**. Task 6 en dépend (`Nav.jsx`).

**⚠ Pourquoi `src/site.js` et pas deux exports de plus sur `i18n.jsx`.** La règle `react-refresh/only-export-components` signale **chaque export non-composant** d'un fichier qui exporte aussi un composant. `i18n.jsx` exporte déjà `LanguageProvider` (composant) et `useI18n` — c'est un des six avertissements assumés. Y ajouter `SITE_ID` et `orderedLangs` en ferait **un septième**, en violation directe de la contrainte globale du plan. Un module plat sans composant n'en déclenche aucun. C'est le même raisonnement que celui qui garde `src/worldPlace.js` hors d'`i18n.jsx` — voir la section lint de `CLAUDE.md`.

`src/site.js` n'importe **que** `sites.config.js`, jamais `i18n.jsx` : `orderedLangs` reçoit `LANGS` en paramètre, ce qui évite le cycle `i18n → site → i18n`.

**Changement de comportement assumé** : le site ne se souvient plus de la langue entre deux visites. En gardant `localStorage`, un lecteur arrivé du .ch en français sur `armenianews.org/hy/` recevrait un HTML prérendu en arménien sous `<html lang="hy">` que React basculerait en français au montage : flash de contenu et attribut `lang` mensonger. Googlebot n'ayant pas de `localStorage`, l'écart serait invisible en test et bien réel en production.

- [ ] **Step 1 : créer `src/site.js`**

```js
// À quelle vitrine appartient la page courante, et dans quel ordre son
// sélecteur de langue s'affiche.
//
// Module plat et SANS composant, délibérément : la règle
// react-refresh/only-export-components signale chaque export non-composant
// d'un fichier qui exporte aussi un composant. Mettre ces deux-là dans
// i18n.jsx ferait passer le lint de 6 à 7 avertissements. Même raison que
// src/worldPlace.js — voir la section lint de CLAUDE.md.
//
// N'importe QUE sites.config.js : orderedLangs reçoit LANGS en paramètre
// plutôt que de l'importer, ce qui évite le cycle i18n → site → i18n.
import { primaryLang } from '../sites.config.js'

// Posé au build par scripts/build-sites.mjs (VITE_SITE_ID). `npm run dev`
// n'en pose pas et travaille donc sur le .ch, la vitrine française.
export const SITE_ID = import.meta.env.VITE_SITE_ID ?? 'ch'

// La langue du domaine en tête, le reste dans l'ordre reçu. Dérivé et non
// écrit à la main : sinon ajouter une cinquième langue obligerait à corriger
// deux listes, qui finiraient par diverger.
//
// L'ordre suit le DOMAINE, pas la langue affichée : sur les trois pages du
// .org la barre reste « EN FR ՀԱՅ РУ », seule la mise en évidence se déplace.
export function orderedLangs(langs) {
  const first = primaryLang(SITE_ID)
  return [...langs].sort((a, b) => (a.code === first ? -1 : b.code === first ? 1 : 0))
}
```

- [ ] **Step 2 : ajouter les imports en tête de `src/i18n.jsx`**

Après la ligne 1 :

```js
import { langFromPath } from '../sites.config.js'
import { SITE_ID } from './site.js'
```

> **Note (défaut de plan corrigé à Task 1).** `LANGS` ne vit plus dans ce
> fichier : Task 1 l'a déplacé dans `sites.config.js` parce que Node ne sait pas
> parser `.jsx` (`ERR_UNKNOWN_FILE_EXTENSION`) et que le build comme les tests
> tournent hors navigateur. `i18n.jsx` porte désormais
> `export { LANGS } from '../sites.config.js'` — **laisser cette ligne en
> place**, les consommateurs (`Nav.jsx`) l'importent toujours d'ici. Les numéros
> de ligne ci-dessous ont donc glissé de quelques unités ; repérer
> `export function LanguageProvider` plutôt que de compter les lignes.

- [ ] **Step 3 : remplacer `LanguageProvider`**

```jsx
export function LanguageProvider({ children }) {
  // La langue vient de l'URL, jamais de localStorage.
  //
  // Chaque langue a désormais son adresse (voir sites.config.js), et c'est
  // l'URL qui fait autorité. Restaurer une langue depuis localStorage
  // ferait basculer au montage une page dont le HTML prérendu et l'attribut
  // <html lang> disent autre chose : flash de contenu, et un attribut lang qui
  // ment sur ce qui est affiché. Googlebot n'ayant pas de localStorage,
  // l'écart serait invisible en test et bien réel pour les lecteurs.
  //
  // Ce qu'on perd — « le site se souvient de ma langue » — est repris par
  // l'URL, qui se met en favori, revient dans l'historique et se partage.
  const lang = useMemo(() => {
    const path = typeof location !== 'undefined' ? location.pathname : '/'
    return langFromPath(SITE_ID, path)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => {
    const t = (key) => STRINGS[lang][key] ?? STRINGS.fr[key] ?? key
    const formatDate = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return d.toLocaleDateString(LOCALES[lang], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
    return { lang, t, formatDate, locale: LOCALES[lang] }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
```

> **Ne rien exporter de plus depuis ce fichier.** `useI18n` (lignes 602-606) reste inchangé. Tout export non-composant supplémentaire ajoute un avertissement `react-refresh` — c'est pourquoi `SITE_ID` et `orderedLangs` vivent dans `src/site.js`.

- [ ] **Step 4 : retirer `useState` de l'import s'il n'est plus utilisé**

Vérifier la ligne 1 : `useState` n'est plus employé dans `i18n.jsx` après ce changement. La ligne devient :

```js
import { createContext, useContext, useEffect, useMemo } from 'react'
```

- [ ] **Step 5 : vérifier qu'aucune clé `lang` ne subsiste**

Run: `grep -n "localStorage" src/i18n.jsx`
Expected: aucune sortie

- [ ] **Step 6 : lint**

Run: `npm run lint`
Expected: **1 erreur attendue** — `Nav.jsx` référence `setLang`, qui n'existe plus. C'est le signal que Task 6 est nécessaire ; ne pas corriger `i18n.jsx` pour la faire taire. Le nombre d'**avertissements doit rester à 6** : s'il est passé à 7, c'est qu'un export non-composant a été ajouté à `i18n.jsx` au lieu de `src/site.js`.

- [ ] **Step 7 : commit**

```bash
git add src/site.js src/i18n.jsx
git commit -m "i18n: la langue vient de l'URL, plus de localStorage"
```

---

## Task 6 : le sélecteur de langue devient de la navigation

**Files:**
- Modify: `src/components/Nav.jsx:1-6, 57-68`

**Interfaces:**
- Consumes: `orderedLangs` depuis `src/site.js`, `useI18n` et `LANGS` depuis `src/i18n.jsx` (Task 5) ; `LANG_URL` (Task 1)
- Produces: quatre `<a href>` en dur dans le HTML de chaque page — le maillage réciproque entre les deux domaines.

- [ ] **Step 1 : mettre à jour les imports (lignes 1-6)**

```jsx
import { useEffect, useState } from 'react'
import { useI18n, LANGS } from '../i18n.jsx'
import { orderedLangs } from '../site.js'
import { LANG_URL } from '../../sites.config.js'
import { KnotMark } from './Ornament.jsx'

export function Nav() {
  const { t, lang } = useI18n()
```

- [ ] **Step 2 : remplacer le bloc du sélecteur (lignes 57-68)**

```jsx
          {/* Chaque langue a son URL — le sélecteur navigue, il ne bascule pas
              un état. Ce sont donc quatre liens en dur dans le HTML de chaque
              page : le maillage réciproque entre les deux domaines, que Google
              attend en plus des hreflang. L'ordre vient du domaine (voir
              orderedLangs), pas de la langue affichée : la barre reste stable
              quand on navigue à l'intérieur du .org. */}
          <div className="lang" role="group" aria-label="Language">
            {orderedLangs(LANGS).map((l) => (
              <a
                key={l.code}
                href={LANG_URL[l.code]}
                hrefLang={l.code}
                aria-current={lang === l.code ? 'true' : undefined}
                title={l.name}
              >
                {l.label}
              </a>
            ))}
          </div>
```

- [ ] **Step 3 : adapter le style du sélecteur**

Dans `src/styles/global.css`, la règle qui cible `.lang button` doit aussi cibler `.lang a`. Localiser :

Run: `grep -n "\.lang" src/styles/global.css`

Pour chaque sélecteur `.lang button` trouvé, le remplacer par `.lang button, .lang a`. Ajouter ensuite, à la suite du bloc `.lang` :

```css
/* Le sélecteur de langue est fait de liens depuis que chaque langue a son URL :
   on neutralise la décoration de lien pour qu'ils gardent l'allure de boutons. */
.lang a {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.lang a[aria-current='true'] {
  /* Reprend l'état que `aria-pressed` portait du temps des boutons. */
  font-weight: 700;
}
```

> Si `grep` montre que la règle existante utilise déjà `aria-pressed` pour la mise en évidence, remplacer ce sélecteur par `[aria-current='true']` au même endroit plutôt que d'ajouter une règle concurrente.

- [ ] **Step 4 : lint**

Run: `npm run lint`
Expected: 0 erreur, **5 avertissements** — l'erreur de Task 5 est résolue

- [ ] **Step 5 : vérifier en dev**

Run: `npm run dev` puis ouvrir `http://localhost:5173`
Expected:
- l'ordre du sélecteur est **FR EN ՀԱՅ РУ** (on est sur la vitrine `ch`)
- FR est mis en évidence
- survoler EN affiche `https://armenianews.org/` dans la barre d'état, ՀԱՅ affiche `https://armenianews.org/hy/`
- dans les outils de développement, `localStorage` ne contient **que** la clé `theme`

Arrêter le serveur.

- [ ] **Step 6 : commit**

```bash
git add src/components/Nav.jsx src/styles/global.css
git commit -m "nav: sélecteur de langue en liens, ordonné par domaine"
```

---

## Task 7 : sitemaps et robots générés

**Files:**
- Create: `scripts/lib/sitemap.mjs`
- Modify: `scripts/scrape.mjs:48-65` (suppression de `writeSitemap` et de son appel)
- Delete: `public/sitemap.xml`
- Modify: `test/site-meta.test.mjs` (ajout des cas sitemap)

**Interfaces:**
- Consumes: `SITES`, `LANG_URL`, `ALL_LANGS`, `X_DEFAULT` (Task 1)
- Produces:
  - `sitemapFor(siteId: string, lastmod: string): string`
  - `robotsFor(siteId: string): string`

**⚠ Piège à ne pas réintroduire.** `scripts/scrape.mjs:50-52` porte aujourd'hui ce commentaire :

> *« Written here, not at build time: a push to main rebuilds without scraping, and a lastmod from that build would announce a freshness that never happened. »*

Il met en garde contre un `lastmod` pris à **l'heure du build**. Le déplacement reste sûr parce que `lastmod` est lu depuis `src/data/meta.json` → `generatedAt`, c'est-à-dire l'horodatage du **dernier scrape** : un rebuild sans scrape réémet la même valeur, donc n'annonce aucune fraîcheur qui n'a pas eu lieu. Le générateur porte ce raisonnement en commentaire — sans quoi la prochaine personne le « corrigera » en sens inverse.

- [ ] **Step 1 : ajouter les cas de test**

Ajouter à la fin de `test/site-meta.test.mjs` :

```js
import { sitemapFor, robotsFor } from '../scripts/lib/sitemap.mjs'

test('le sitemap du .ch liste sa seule URL', () => {
  const xml = sitemapFor('ch', '2026-07-28T10:00:00.000Z')
  assert.ok(xml.includes('<loc>https://armenieinfo.ch/</loc>'))
  assert.ok(xml.includes('<lastmod>2026-07-28T10:00:00.000Z</lastmod>'))
  assert.equal((xml.match(/<url>/g) || []).length, 1)
})

test('le sitemap du .org liste ses trois URL avec leurs hreflang', () => {
  const xml = sitemapFor('org', '2026-07-28T10:00:00.000Z')
  assert.equal((xml.match(/<url>/g) || []).length, 3)
  for (const loc of ['https://armenianews.org/', 'https://armenianews.org/hy/', 'https://armenianews.org/ru/']) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), loc)
  }
  // Chaque <url> porte les quatre alternates + x-default, y compris la version
  // française hébergée sur l'autre domaine.
  assert.ok(xml.includes('hreflang="fr" href="https://armenieinfo.ch/"'))
  assert.equal((xml.match(/hreflang="x-default"/g) || []).length, 3)
  assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'))
})

test('robots.txt pointe vers le sitemap de son propre domaine', () => {
  assert.ok(robotsFor('org').includes('Sitemap: https://armenianews.org/sitemap.xml'))
  assert.ok(robotsFor('ch').includes('Sitemap: https://armenieinfo.ch/sitemap.xml'))
})
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/lib/sitemap.mjs'`

- [ ] **Step 3 : écrire `scripts/lib/sitemap.mjs`**

```js
// sitemap.xml et robots.txt, un jeu par vitrine.
//
// Générés au build et non au scrape, parce qu'il en faut désormais deux avec
// des <loc> différents et que public/ est partagé entre les deux sites.
//
// Le commentaire historique de scripts/scrape.mjs mettait en garde : « a push
// to main rebuilds without scraping, and a lastmod from that build would
// announce a freshness that never happened ». La garde tient toujours, et elle
// est respectée ici : `lastmod` vient de src/data/meta.json → generatedAt,
// l'horodatage du DERNIER SCRAPE. Un rebuild sans scrape réémet donc la même
// valeur. Ne jamais y substituer new Date() : ce serait exactement le bug
// contre lequel ce commentaire prévenait.
import { SITES, LANG_URL, ALL_LANGS, X_DEFAULT } from '../../sites.config.js'

// Les annotations xhtml:link dans le sitemap répètent ce que portent les
// <link hreflang> du HTML. Google accepte les deux et recoupe : c'est une
// redondance voulue, pas un oubli de factorisation.
function alternates() {
  return [
    ...ALL_LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${LANG_URL[l]}" />`,
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${X_DEFAULT}" />`,
  ].join('\n')
}

export function sitemapFor(siteId, lastmod) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!lastmod) throw new Error('lastmod manquant — attendu meta.json → generatedAt')

  const urls = site.pages
    .map(
      (page) => `  <url>
    <loc>${site.host}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
${alternates()}
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}

export function robotsFor(siteId) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  return `# ${site.brand} — ${site.host}
User-agent: *
Allow: /

Sitemap: ${site.host}/sitemap.xml
`
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

Run: `npm test`
Expected: PASS — 19 tests, 0 échec

- [ ] **Step 5 : retirer `writeSitemap` de `scripts/scrape.mjs`**

Supprimer les lignes 48 à 66 (la constante `PUBLIC_DIR`, le commentaire et la fonction `writeSitemap`), puis :

Run: `grep -n "writeSitemap\|PUBLIC_DIR" scripts/scrape.mjs`

Supprimer aussi la ligne d'appel `await writeSitemap(...)` que ce `grep` révèle. Vérifier ensuite que `join` et `writeFile` restent utilisés ailleurs dans le fichier (ils le sont, par `writeJson`) ; ne pas toucher aux imports.

Ajouter à la place, là où se trouvait la fonction :

```js
// Le sitemap n'est plus écrit ici : il en faut un par vitrine, avec des <loc>
// distincts, et public/ est partagé entre les deux sites. Il est désormais
// généré au build par scripts/lib/sitemap.mjs — qui lit son `lastmod` dans
// meta.json.generatedAt, donc l'horodatage de ce scrape-ci, pas l'heure du
// build. La garde d'origine (« ne pas annoncer une fraîcheur qui n'a pas eu
// lieu ») est donc toujours tenue.
```

- [ ] **Step 6 : supprimer le sitemap versionné**

```bash
git rm public/sitemap.xml
```

- [ ] **Step 7 : vérifier que le scrape tourne encore**

Run: `npm run scrape`
Expected: le script se termine sans erreur, `src/data/meta.json` est réécrit, **aucune** ligne `→ wrote public/sitemap.xml`, et `public/sitemap.xml` n'existe pas.

> Ce scrape prend 3 à 4 minutes et sollicite les sources réelles. Si le réseau est indisponible, vérifier au minimum : `node -e "import('./scripts/scrape.mjs')"` ne doit pas lever d'erreur de syntaxe ou d'import.

- [ ] **Step 8 : lint et commit**

```bash
npm run lint
git add scripts/lib/sitemap.mjs scripts/scrape.mjs test/site-meta.test.mjs public/sitemap.xml
git commit -m "sitemap: un jeu sitemap+robots par vitrine, généré au build"
```

---

## Task 8 : l'orchestrateur de build

**Files:**
- Create: `scripts/build-sites.mjs`
- Modify: `package.json` (script `build`)
- Modify: `.gitignore` (si `dist` y figure sans glob)

**Interfaces:**
- Consumes: `SITES`, `ALL_LANGS`, `primaryLang` (Task 1) ; `applyMeta` (Task 3) ; `sitemapFor`, `robotsFor` (Task 7)
- Produces: `dist/ch/index.html` et `dist/org/{index.html, hy/index.html, ru/index.html}`, plus `sitemap.xml` et `robots.txt` dans chaque `dist/<id>/`. Task 9 (prérendu) et Task 10 (Firebase) en dépendent.

- [ ] **Step 1 : écrire `scripts/build-sites.mjs`**

```js
/**
 * Bâtit les deux vitrines.
 *
 *   npm run build
 *
 * Un build Vite par site (le bundle diffère par sa langue de démarrage, pas
 * par son code), puis dérivation des pages supplémentaires du .org : /hy/ et
 * /ru/ partagent exactement le bundle de /, seules leurs métadonnées et leur
 * attribut <html lang> changent. Une copie de fichier HTML suffit donc — pas
 * de multi-entrée Rollup, pas d'assets dupliqués.
 *
 * Sortie : dist/ch/ et dist/org/, chacun prêt pour sa cible Firebase.
 */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// LANGS vient de sites.config.js, PAS de src/i18n.jsx : Node ne sait pas
// parser .jsx (ERR_UNKNOWN_FILE_EXTENSION), et ce script tourne sous Node.
// C'est la raison pour laquelle la liste a été déplacée à Task 1.
import { SITES, ALL_LANGS, LANGS } from '../sites.config.js'
import { replaceMeta } from './lib/site-meta.mjs'
import { sitemapFor, robotsFor } from './lib/sitemap.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Invariant : chaque langue de l'interface doit vivre à exactement une URL.
// Sans cette assertion, ajouter une cinquième langue à LANGS la rendrait
// traduite partout et joignable nulle part — en silence.
{
  const declared = Object.values(SITES).flatMap((s) => s.pages.map((p) => p.lang))
  const known = LANGS.map((l) => l.code)
  const missing = known.filter((l) => !declared.includes(l))
  const extra = declared.filter((l) => !known.includes(l))
  if (missing.length || extra.length) {
    console.error(
      `sites.config.js et LANGS divergent — sans page : [${missing}] ; sans traduction : [${extra}]`,
    )
    process.exit(1)
  }
  if (new Set(declared).size !== declared.length) {
    console.error(`une langue est servie à deux adresses : [${declared}]`)
    process.exit(1)
  }
  if (declared.length !== ALL_LANGS.length) {
    console.error(`ALL_LANGS (${ALL_LANGS.length}) ne couvre pas les pages (${declared.length})`)
    process.exit(1)
  }
}

// `vite build` dans un processus fils, avec SITE_ID dans son environnement.
// Un processus par site plutôt que l'API JS : la config de Vite est mise en
// cache par processus, et deux builds successifs en lisant une seule ferait
// produire au second les métadonnées du premier — silencieusement.
function viteBuild(siteId) {
  const outDir = path.join('dist', siteId)
  console.log(`\n▸ build ${siteId} → ${outDir}`)
  const res = spawnSync(
    process.execPath,
    [path.join('node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SITE_ID: siteId, VITE_SITE_ID: siteId },
    },
  )
  if (res.status !== 0) {
    console.error(`build ${siteId} en échec (code ${res.status})`)
    process.exit(res.status ?? 1)
  }
}

// Les pages non-racine d'un site : même bundle, métadonnées régénérées.
//
// On repart du HTML BÂTI (dist/<id>/index.html), pas du HTML source : lui seul
// porte les hachages d'assets posés par Vite. C'est pour cela que le bloc de
// métadonnées est encadré de sentinelles — replaceMeta échange ce qu'il y a
// entre elles sans toucher au reste. Rebâtir une fois par page coûterait deux
// builds Vite de plus pour un résultat identique.
async function derivePages(site) {
  const dist = path.join(root, 'dist', site.id)
  const built = await readFile(path.join(dist, 'index.html'), 'utf-8')

  for (const page of site.pages) {
    if (page.path === '/') continue
    const dir = path.join(dist, page.path.replace(/^\/|\/$/g, ''))
    await mkdir(dir, { recursive: true })
    const html = replaceMeta(built, { siteId: site.id, lang: page.lang })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    console.log(`  → dist/${site.id}${page.path}index.html (${page.lang})`)
  }
}

// lastmod = l'horodatage du dernier SCRAPE, jamais celui du build.
// Voir l'avertissement en tête de scripts/lib/sitemap.mjs.
async function lastmod() {
  try {
    const meta = JSON.parse(await readFile(path.join(root, 'src/data/meta.json'), 'utf-8'))
    if (meta.generatedAt) return meta.generatedAt
  } catch {
    /* pas de snapshot encore */
  }
  console.warn('⚠ meta.json sans generatedAt — sitemaps sans lastmod')
  return null
}

async function writeSeoFiles(site, stamp) {
  const dist = path.join(root, 'dist', site.id)
  if (stamp) {
    await writeFile(path.join(dist, 'sitemap.xml'), sitemapFor(site.id, stamp), 'utf-8')
    console.log(`  → dist/${site.id}/sitemap.xml`)
  }
  await writeFile(path.join(dist, 'robots.txt'), robotsFor(site.id), 'utf-8')
  console.log(`  → dist/${site.id}/robots.txt`)
}

const stamp = await lastmod()

for (const site of Object.values(SITES)) {
  viteBuild(site.id)
  await derivePages(site)
  await writeSeoFiles(site, stamp)
}

// Garde-fou : si public/robots.txt réapparaissait un jour, Vite le copierait
// dans les deux dist/ avec le host du .ch et le .org annoncerait le sitemap du
// voisin. On vérifie que chaque robots pointe bien sur son propre domaine.
for (const site of Object.values(SITES)) {
  const robots = await readFile(path.join(root, 'dist', site.id, 'robots.txt'), 'utf-8')
  if (!robots.includes(site.host)) {
    console.error(`dist/${site.id}/robots.txt ne pointe pas sur ${site.host}`)
    process.exit(1)
  }
}

console.log(
  `\n✓ ${Object.keys(SITES).length} vitrines bâties : ` +
    Object.values(SITES)
      .map((s) => `${s.id} (${s.pages.map((p) => p.lang).join('/')})`)
      .join(', '),
)
```

- [ ] **Step 2 : supprimer `public/robots.txt`**

Il est désormais généré par site. Le laisser dans `public/` le ferait copier dans les deux `dist/` avec le host du .ch.

```bash
git rm public/robots.txt
```

Supprimer alors la boucle de vérification `robots` de l'étape précédente (elle ne vérifiait qu'un écrasement qui n'a plus lieu d'être) — ou la garder telle quelle : elle reste un contrôle utile que `writeSeoFiles` a bien tourné. **La garder.**

- [ ] **Step 3 : brancher le script**

Dans `package.json`, remplacer :

```json
"build": "vite build",
```

par :

```json
"build": "node scripts/build-sites.mjs",
"build:one": "vite build",
```

> `build:one` reste pour un build unique de dépannage. Il produit `dist/` à plat avec les métadonnées du .ch.

- [ ] **Step 4 : bâtir**

Run: `npm run build`
Expected: deux blocs `▸ build …`, quatre lignes `→ dist/…index.html`, quatre lignes sitemap/robots, et `✓ 2 vitrines bâties : ch (fr), org (en/hy/ru)`

- [ ] **Step 5 : écrire `scripts/check-build.mjs`**

```js
/**
 * Contrôle ce que le build a réellement produit.
 *
 *   npm run check          # après npm run build
 *
 * Dérivé de sites.config.js : ajouter une page ou une langue étend
 * automatiquement le contrôle, sans toucher à ce fichier.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES, LANG_URL, ALL_LANGS } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let bad = 0

for (const site of Object.values(SITES)) {
  for (const page of site.pages) {
    const rel = path.join('dist', site.id, page.path.replace(/^\//, ''), 'index.html')
    let html
    try {
      html = await readFile(path.join(root, rel), 'utf-8')
    } catch {
      console.error(`✗ ${rel} — absent`)
      bad++
      continue
    }

    const checks = [
      [`<html lang="${page.lang}">`, html.includes(`<html lang="${page.lang}"`)],
      [
        `canonical ${LANG_URL[page.lang]}`,
        html.includes(`rel="canonical" href="${LANG_URL[page.lang]}" />`),
      ],
      ['un seul canonical', (html.match(/rel="canonical"/g) || []).length === 1],
      [`og:site_name "${site.brand}"`, html.includes(`og:site_name" content="${site.brand}"`)],
      [
        'les 4 hreflang, réciproques',
        ALL_LANGS.every((l) => html.includes(`hreflang="${l}" href="${LANG_URL[l]}"`)),
      ],
      ['x-default', html.includes('hreflang="x-default"')],
    ]

    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
    if (failed.length) {
      console.error(`✗ ${rel}\n    ${failed.join('\n    ')}`)
      bad += failed.length
    } else {
      console.log(`✓ ${rel} (${page.lang})`)
    }
  }
}

if (bad) {
  console.error(`\n${bad} problème(s)`)
  process.exit(1)
}
console.log('\n✓ toutes les pages sont conformes')
```

Ajouter à `package.json` → `"scripts"` :

```json
"check": "node scripts/check-build.mjs",
```

- [ ] **Step 6 : lancer le contrôle**

Run: `npm run check`
Expected:
```
✓ dist/ch/index.html (fr)
✓ dist/org/index.html (en)
✓ dist/org/hy/index.html (hy)
✓ dist/org/ru/index.html (ru)

✓ toutes les pages sont conformes
```

- [ ] **Step 7 : vérifier les sitemaps produits**

Run: `cat dist/org/sitemap.xml && cat dist/ch/robots.txt`
Expected: trois blocs `<url>` pour le .org, chacun avec cinq `xhtml:link` ; le robots du .ch pointe sur `https://armenieinfo.ch/sitemap.xml`

- [ ] **Step 8 : lint, tests et commit**

```bash
npm run lint && npm test
git add scripts/build-sites.mjs scripts/check-build.mjs package.json public/robots.txt
git commit -m "build: deux vitrines, quatre pages, sitemaps et robots par site"
```

---

## Task 9 : le prérendu boucle sur les quatre pages

**Files:**
- Modify: `scripts/prerender.mjs:28-72`

**Interfaces:**
- Consumes: `SITES` (Task 1) ; les sorties de Task 8
- Produces: les quatre `index.html` de `dist/` avec leur `#root` rempli.

- [ ] **Step 1 : réécrire le corps de `scripts/prerender.mjs`**

Remplacer tout ce qui suit le bloc de commentaire d'en-tête (à partir de la ligne `import { existsSync }`) par :

```js
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from './lib/chrome.mjs'
import { SITES } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const executablePath = findChrome()
if (!executablePath) {
  console.error('No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

for (const site of Object.values(SITES)) {
  const outDir = path.join(root, 'dist', site.id)
  if (!existsSync(path.join(outDir, 'index.html'))) {
    console.error(`dist/${site.id}/index.html not found. Run \`npm run build\` first.`)
    process.exit(1)
  }
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox'],
})

let baked = 0
try {
  // Un serveur de prévisualisation par vitrine : les deux dist/ sont des
  // racines distinctes. Les pages d'un même site partagent le sien.
  for (const site of Object.values(SITES)) {
    const server = await preview({
      root,
      preview: { port: 4174, host: '127.0.0.1' },
      build: { outDir: path.join('dist', site.id) },
    })
    const origin = server.resolvedUrls.local[0].replace(/\/$/, '')

    try {
      for (const page of site.pages) {
        const file = path.join(root, 'dist', site.id, page.path.replace(/^\//, ''), 'index.html')
        const tab = await browser.newPage()
        try {
          await tab.goto(origin + page.path, { waitUntil: 'networkidle0' })

          // .reveal starts at opacity:0 and only becomes visible once
          // useReveal's IntersectionObserver fires on scroll. Serialising as-is
          // would ship a transparent page. Stamp every .reveal visible before
          // reading the DOM.
          await tab.evaluate(() => {
            document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
          })

          // La page doit avoir démarré dans SA langue : si le prérendu de /hy/
          // cuit du contenu anglais, la résolution de langue par URL est
          // cassée et on servirait un <html lang="hy"> plein d'anglais.
          const domLang = await tab.evaluate(() => document.documentElement.lang)
          if (domLang !== page.lang) {
            throw new Error(
              `${site.id}${page.path} : rendu en "${domLang}" au lieu de "${page.lang}"`,
            )
          }

          const rendered = await tab.$eval('#root', (el) => el.innerHTML)
          if (!rendered.trim()) {
            throw new Error(`${site.id}${page.path} : #root vide — refus de cuire une page blanche`)
          }

          const html = await readFile(file, 'utf-8')
          const marker = '<div id="root"></div>'
          if (!html.includes(marker)) throw new Error(`marker ${marker} not found in ${file}`)

          await writeFile(file, html.replace(marker, `<div id="root">${rendered}</div>`), 'utf-8')
          console.log(
            `✓ ${site.id}${page.path} (${page.lang}) — ${rendered.length.toLocaleString('en-US')} chars`,
          )
          baked++
        } finally {
          await tab.close()
        }
      }
    } finally {
      await new Promise((res) => server.httpServer.close(res))
    }
  }
} finally {
  await browser.close()
}

console.log(`✓ ${baked} pages prérendues`)
```

- [ ] **Step 2 : bâtir et prérendre**

Run: `npm run build && npm run prerender`
Expected: quatre lignes `✓ …` puis `✓ 4 pages prérendues`. Aucune erreur `rendu en "xx" au lieu de "yy"`.

- [ ] **Step 3 : vérifier que chaque page porte bien du contenu dans sa langue**

Run:
```bash
node -e "
const fs = require('node:fs');
for (const [f, lang] of [['dist/ch/index.html','fr'],['dist/org/index.html','en'],['dist/org/hy/index.html','hy'],['dist/org/ru/index.html','ru']]) {
  const h = fs.readFileSync(f,'utf8');
  const root = h.slice(h.indexOf('<div id=\"root\">'), h.indexOf('</body>'));
  console.log(lang.padEnd(3), root.length.toLocaleString('en-US').padStart(9), 'chars', root.length > 5000 ? '✓' : '✗ TROP COURT');
}
"
```
Expected: quatre lignes, chacune bien au-dessus de 5 000 caractères et marquée `✓`

- [ ] **Step 4 : commit**

```bash
git add scripts/prerender.mjs
git commit -m "prerender: cuit les quatre pages, avec garde sur la langue rendue"
```

---

## Task 10 : Firebase — deux cibles, un projet

**Files:**
- Modify: `.firebaserc`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: `dist/ch/` et `dist/org/` (Task 8)
- Produces: deux cibles Hosting déployables par `firebase deploy --only hosting`.

- [ ] **Step 1 : créer le site Hosting du .org**

Run: `npx firebase-tools@15.23.0 hosting:sites:create armenia-news --project armenie-info`
Expected: création confirmée, URL de repli `https://armenia-news.web.app`

> Si le nom est déjà pris à l'échelle mondiale, la commande échoue. Choisir alors une variante, **et la reporter dans `sites.config.js` → `org.firebaseSite`** ainsi qu'à l'étape 2 : les deux doivent rester d'accord.

- [ ] **Step 2 : déclarer les cibles dans `.firebaserc`**

```json
{
  "projects": {
    "default": "armenie-info"
  },
  "targets": {
    "armenie-info": {
      "hosting": {
        "ch": ["armenie-info"],
        "org": ["armenia-news"]
      }
    }
  }
}
```

- [ ] **Step 3 : passer `firebase.json` à deux cibles**

`"hosting"` devient un tableau. Les deux entrées sont **identiques sauf** `target`, `public` et `cleanUrls`.

**Ne pas paraphraser la CSP** : sa liste `media-src` porte les hosts des flux radio, et un host omis coupe la lecture en production sans que la préversion le montre. Le bloc ci-dessous reprend l'actuel mot pour mot — écrire le fichier ainsi :

```json
{
  "hosting": [
    {
      "target": "ch",
      "public": "dist/ch",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }],
      "headers": [
        {
          "source": "**",
          "headers": [
            { "key": "X-Content-Type-Options", "value": "nosniff" },
            { "key": "X-Frame-Options", "value": "DENY" },
            { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
            {
              "key": "Permissions-Policy",
              "value": "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()"
            },
            {
              "key": "Content-Security-Policy",
              "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https://eu1.stream4cast.com https://eu.stream4cast.com https://icecast.worldweb.services https://s8.myradiostream.com:15554 https://radio-mariam-proxy.cobranian.workers.dev https://radio-yeraz-proxy.cobranian.workers.dev https://vovan.s3ming.com; connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com; upgrade-insecure-requests"
            }
          ]
        },
        {
          "source": "assets/**",
          "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
        }
      ]
    },
    {
      "target": "org",
      "public": "dist/org",
      "cleanUrls": true,
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }],
      "headers": [
        {
          "source": "**",
          "headers": [
            { "key": "X-Content-Type-Options", "value": "nosniff" },
            { "key": "X-Frame-Options", "value": "DENY" },
            { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
            {
              "key": "Permissions-Policy",
              "value": "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()"
            },
            {
              "key": "Content-Security-Policy",
              "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https://eu1.stream4cast.com https://eu.stream4cast.com https://icecast.worldweb.services https://s8.myradiostream.com:15554 https://radio-mariam-proxy.cobranian.workers.dev https://radio-yeraz-proxy.cobranian.workers.dev https://vovan.s3ming.com; connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com; upgrade-insecure-requests"
            }
          ]
        },
        {
          "source": "assets/**",
          "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
        }
      ]
    }
  ]
}
```

Vérifier ensuite que les deux CSP sont bien identiques :

Run: `node -e "const c=require('node:fs').readFileSync('firebase.json','utf8'); const m=[...c.matchAll(/\"value\": \"default-src[^\"]*\"/g)].map(x=>x[0]); console.log(m.length===2 && m[0]===m[1] ? '✓ CSP identiques' : '✗ CSP divergentes ou manquantes')"`
Expected: `✓ CSP identiques`

> **Piège assumé** : le bloc `headers` — CSP comprise — est désormais dupliqué. Un nouveau host de flux radio ajouté à `media-src` d'un seul côté passerait la préversion et casserait la lecture en production sur l'autre domaine. C'est noté dans `CLAUDE.md` à Task 12.

- [ ] **Step 4 : vérifier `/hy/` face au rewrite SPA**

C'est le point que la spec demande de **vérifier plutôt que de supposer** : Firebase sert le contenu statique avant d'appliquer les rewrites, donc `dist/org/hy/index.html` devrait l'emporter sur `"source": "**"`.

Run: `npx firebase-tools@15.23.0 emulators:start --only hosting --project armenie-info`

Puis, dans un autre terminal — l'émulateur sert la **première** cible sur le port 5000 et la seconde sur 5001 (l'ordre est affiché au démarrage ; adapter les ports si besoin) :

```bash
for u in http://localhost:5001/ http://localhost:5001/hy http://localhost:5001/hy/ http://localhost:5001/ru/; do
  printf '%-32s ' "$u"
  curl -sL "$u" | grep -o '<html lang="[a-z]*"' | head -1
done
```

Expected:
```
http://localhost:5001/           <html lang="en"
http://localhost:5001/hy         <html lang="hy"
http://localhost:5001/hy/        <html lang="hy"
http://localhost:5001/ru/        <html lang="ru"
```

**Si `/hy` ou `/hy/` renvoie `lang="en"`**, le rewrite catch-all les avale. Correctif : ajouter des rewrites explicites **avant** le catch-all dans l'entrée `org` —

```json
"rewrites": [
  { "source": "/hy{,/**}", "destination": "/hy/index.html" },
  { "source": "/ru{,/**}", "destination": "/ru/index.html" },
  { "source": "**", "destination": "/index.html" }
]
```

— puis relancer la vérification jusqu'à obtenir la sortie attendue. Arrêter l'émulateur.

- [ ] **Step 5 : ajouter le domaine personnalisé**

Dans la console Firebase → Hosting → site `armenia-news` → « Ajouter un domaine personnalisé » → `armenianews.org`. Poser chez le registrar les enregistrements A affichés.

> Le certificat et la propagation prennent de quelques minutes à 24 h. Le déploiement peut se faire avant : `armenia-news.web.app` sert entre-temps.

- [ ] **Step 6 : commit**

```bash
git add .firebaserc firebase.json
git commit -m "firebase: deux cibles Hosting dans le projet armenie-info"
```

---

## Task 11 : la CI déploie les deux vitrines

**Files:**
- Modify: `.github/workflows/hourly.yml`

**Interfaces:**
- Consumes: les cibles de Task 10
- Produces: un job horaire qui scrape une fois et déploie deux sites.

- [ ] **Step 1 : retirer le sitemap du commit de données**

Dans l'étape « Commit refreshed data », remplacer la ligne `git add` par :

```yaml
          # public/sitemap.xml n'est plus versionné : il en faut un par vitrine,
          # et ils sont générés au build (scripts/lib/sitemap.mjs), avec un
          # lastmod lu dans meta.json.generatedAt — donc l'heure de CE scrape.
          git add src/data/news.json src/data/agenda.json src/data/meta.json src/data/instagram-feed.json
```

- [ ] **Step 2 : ajouter l'étape de tests**

Juste après `- run: npm ci`, insérer :

```yaml
      # Les seuls tests du dépôt : ils gardent l'invariant « une langue = une
      # URL » et la réciprocité des hreflang. Ils ne touchent pas au réseau.
      - name: Tests
        run: npm test
```

- [ ] **Step 3 : adapter l'étape de déploiement**

Dans l'étape « Deploy to Firebase Hosting », remplacer la commande `deploy` par :

```bash
          out=$(npx --yes firebase-tools@15.23.0 deploy \
            --only hosting:ch,hosting:org --project armenie-info --non-interactive 2>&1)
```

Et élargir le garde-fou du no-op — avec deux cibles, Firebase peut rapporter qu'une seule est inchangée :

```bash
          # Firebase rejette une publication dont le contenu est identique à la
          # version en ligne (p. ex. une heure sans changement de données).
          # C'est un no-op réussi, pas un échec. Avec deux cibles, le message
          # peut ne concerner qu'une seule d'entre elles.
          if [ $code -ne 0 ] && echo "$out" | grep -qi "is the current active version"; then
            echo "::notice::Contenu inchangé — déjà en ligne. Ignoré."
            exit 0
          fi
```

- [ ] **Step 4 : vérifier la syntaxe du workflow**

Run: `npx --yes yaml-lint .github/workflows/hourly.yml 2>/dev/null || node -e "const y=require('node:fs').readFileSync('.github/workflows/hourly.yml','utf8'); if (y.includes('hosting:ch,hosting:org') && !y.includes('public/sitemap.xml')) console.log('✓ workflow à jour'); else { console.error('✗ workflow incomplet'); process.exit(1) }"`
Expected: `✓ workflow à jour`

- [ ] **Step 5 : commit**

```bash
git add .github/workflows/hourly.yml
git commit -m "ci: tests au build, déploiement des deux cibles, sitemap hors du commit"
```

---

## Task 12 : documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1 : mettre à jour `CLAUDE.md`**

Dans la section **Projet**, remplacer la première phrase par :

```markdown
**Arménie Info** (`armenieinfo.ch`) et **Armenia News** (`armenianews.org`) —
deux vitrines d'un **même instantané horaire** de la vie arménienne, servies
depuis une seule base de code. Le .ch sert le français ; le .org sert l'anglais
(`/`), l'arménien (`/hy/`) et le russe (`/ru/`).
```

Dans **Commandes**, corriger :

```markdown
npm run build        # bâtit les deux vitrines dans dist/ch/ et dist/org/
npm run build:one    # build Vite unique dans dist/ (dépannage)
npm test             # tests des dérivations de sites.config et des hreflang
```

Dans **Architecture**, ajouter avant « Internationalisation » :

```markdown
**Les deux vitrines** — `sites.config.js` (racine) est la source de vérité :
hosts, marques, pages, langues. Tout en dérive — métadonnées HTML, `hreflang`,
sitemaps, cibles Firebase, ordre du sélecteur de langue.

- `scripts/lib/site-meta.mjs` génère le `<head>` d'un couple (site, langue).
  Appelé par le plugin `siteMeta()` de `vite.config.js` pour la page par défaut
  de chaque site, **et** par `scripts/build-sites.mjs` pour dériver `/hy/` et
  `/ru/`. Un seul générateur pour les quatre pages : des `hreflang` divergents
  sont ignorés en bloc par Google.
- `scripts/build-sites.mjs` orchestre deux `vite build` (un par site, dans des
  processus fils — la config de Vite est mise en cache par processus), dérive
  les pages supplémentaires, puis écrit sitemap et robots par vitrine.
- `src/seo.js` porte les chaînes de titre et de description par langue. **JS
  plat, sans React**, parce que Node doit les lire pour générer `/hy/` et
  `/ru/` hors du bundle. Même raison que `src/worldPlace.js` — ne le
  reconsolidez pas dans `i18n.jsx`.
```

Dans **À savoir**, ajouter ces pièges :

```markdown
- **La langue vient de l'URL, plus de `localStorage`.** Chaque langue a son
  adresse (`sites.config.js`) et l'URL fait autorité. Restaurer la langue
  depuis `localStorage` ferait basculer au montage une page dont le HTML
  prérendu et l'attribut `<html lang>` disent autre chose : flash de contenu et
  attribut mensonger. Googlebot n'ayant pas de `localStorage`, l'écart serait
  **invisible en test** et bien réel en production. La clé `theme`, elle, reste.
- **Les `hreflang` doivent rester réciproques.** Les quatre `alternate` plus
  `x-default` sont identiques sur les quatre pages, chacune se citant
  elle-même. Une page absente de son propre bloc fait ignorer **tout** le bloc
  par Google — silencieusement. C'est pourquoi un seul générateur les produit.
- **Le bloc `headers` de `firebase.json` est dupliqué** entre les deux cibles,
  CSP comprise. Ajouter un host de flux radio à `media-src` d'un seul côté
  passe la préversion et casse la lecture en production sur l'autre domaine.
  Modifier les deux, toujours.
- **Le `lastmod` des sitemaps vient de `meta.json.generatedAt`**, jamais de
  l'heure du build. Un push sur `main` rebâtit sans scraper ; un `lastmod` pris
  au build annoncerait une fraîcheur qui n'a pas eu lieu. C'est la garde que
  portait `scripts/scrape.mjs` avant le déplacement — elle tient toujours, elle
  a juste changé de fichier (`scripts/lib/sitemap.mjs`).
- **`hreflang` ne transfère aucune autorité entre les domaines.** Il fait servir
  la bonne langue et empêche la déduplication ; ce n'est pas un signal de
  classement. `armenianews.org` démarre avec l'autorité d'un domaine neuf : un
  décollage lent est normal, pas un bug.
```

- [ ] **Step 2 : mettre à jour `README.md`**

Ajouter une section « Les deux domaines » reprenant le tableau URL → langue → site Firebase → marque, la procédure de déploiement (`firebase deploy --only hosting:ch,hosting:org`), et les deux étapes manuelles : créer la propriété Search Console du .org et reporter son jeton dans `sites.config.js` **avant** la mise en ligne ; soumettre les deux sitemaps et exclure `armenianews.org` des domaines de référence GA4 **après**.

- [ ] **Step 3 : vérification finale complète**

```bash
npm run lint && npm test && npm run build && npm run prerender
```
Expected: 0 erreur / 5 avertissements ; 19 tests réussis ; `✓ 2 vitrines bâties` ; `✓ 4 pages prérendues`

- [ ] **Step 4 : commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: les deux vitrines, leurs pièges et la procédure de déploiement"
```

---

## Étapes manuelles hors dépôt

| Quand | Quoi | Bloquant ? |
|---|---|---|
| Avant Task 10 | Créer le site Hosting `armenia-news` | oui (Task 10 étape 1) |
| Avant le déploiement | Créer la propriété Search Console `armenianews.org`, reporter le jeton dans `sites.config.js` → `org.gscToken` | **oui** — le jeton est compilé dans le HTML |
| Avant/pendant | Poser les enregistrements A d'`armenianews.org` chez le registrar | non (le `.web.app` sert entre-temps) |
| Après propagation DNS | Soumettre `https://armenianews.org/sitemap.xml` dans sa propriété GSC | non |
| Après déploiement | Soumettre `https://armenieinfo.ch/sitemap.xml` (si ce n'est pas déjà fait) | non |
| Après déploiement | GA4 → ajouter `armenianews.org` aux domaines de référence exclus | non — mais sans cela les deux sites se volent leurs attributions |

## Vérification finale (reprise de la spec)

- `npm run lint` → 0 erreur, **5 avertissements**. Le décompte est passé de 6 à 5 à Task 1 : `LANGS`, devenu ré-export dans `i18n.jsx`, ne déclenche plus `react-refresh`. **Task 12 doit corriger le chiffre dans `CLAUDE.md`**, sinon la prochaine personne lira « 6 attendus » et prendra la baisse pour une régression.
- `npm test` → 19 tests réussis
- `npm run build` → `dist/ch/index.html` et `dist/org/{index,hy/index,ru/index}.html`
- Les quatre HTML : `<html lang>` correct, canonical auto-référent, quatre `hreflang` réciproques sur chacun, `og:site_name` conforme à la marque du site
- `npm run prerender` → les quatre pages portent l'édition Armenpress de leur langue, pas un `#root` vide
- `firebase emulators:start` → `/`, `/hy`, `/hy/`, `/ru/` servent la page prérendue correspondante
- `npm run dev` → le sélecteur affiche **FR** EN ՀԱՅ РУ, navigue vers les bonnes URL, et `localStorage` ne contient que `theme`
- Les deux sitemaps répondent en 200 sur leur domaine avec les bonnes `<loc>`
