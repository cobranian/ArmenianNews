# Longue traîne : pages piliers `/radio` et `/agenda` — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe case à cocher (`- [ ]`).

**But :** donner une URL propre aux deux jeux de données que le site est seul à
détenir — douze radios en direct, un agenda de 26 pays — dans les quatre
langues, pour gagner des requêtes de longue traîne.

**Architecture :** une page devient un triplet (vitrine, langue, vue). Les vues
et leurs slugs vivent dans `sites.config.js`, d'où tout dérive : `hreflang`,
`canonical`, sitemap, build, prérendu, contrôles. `App.jsx` choisit sa vue
d'après le chemin, exactement comme `langFromPath` choisit déjà la langue. Aucun
routeur client : ce sont des fichiers HTML distincts, comme `/hy/` aujourd'hui.

**Pile :** Vite + React 18, Node ≥ 20 (`node --test`), ESLint config plate,
Puppeteer pour le prérendu, Firebase Hosting.

**Spec de référence :** `docs/superpowers/specs/2026-07-31-seo-longue-traine-design.md`

## Contraintes globales

- **Node ne sait pas parser du JSX.** Tout ce qu'un script ou un test doit lire
  vit dans un `.js` ou `.mjs` plat, jamais dans un `.jsx`. C'est la raison d'être
  de `sites.config.js`, `src/seo.js`, `src/site.js`, `src/worldPlace.js`,
  `src/hyDate.js`.
- **Lint : 0 erreur, exactement 5 avertissements connus.** Ne pas en ajouter. En
  particulier, **ne jamais exporter autre chose qu'un composant depuis un
  `.jsx`** — chaque export non-composant ajoute un avertissement
  `react-refresh/only-export-components`.
- **Le français porte tous ses accents** (é, è, à, ê, ç…).
- **Aucun test ne touche le réseau.** `npm test` doit rester hors-ligne.
- **Toute date affichée passe par les formateurs du contexte i18n**
  (`formatDate`, `formatDayNum`, `formatMonthAbbr`, `formatWeekdayTime`), jamais
  par `toLocaleDateString(locale, …)` : `Intl` ne résout pas `hy-AM` dans un
  navigateur.
- **Chaque `font-family: var(--font-X)` en CSS est immédiatement suivi de son
  `font-size-adjust: var(--fsa-X)`.**
- **Un ajout de langue touche trois fichiers** (`sites.config.js`, `i18n.jsx`,
  `src/seo.js`). Ce plan n'ajoute pas de langue, mais ajoute une dimension
  parallèle — les vues — qui obéit à la même discipline.
- **Vérification de fin d'étape**, dans cet ordre :
  `npm run lint && npm test && npm run build && npm run prerender && npm run check`
- **Commits fréquents**, un par tâche minimum. Messages en français, sans
  accents (convention du dépôt), terminés par les deux lignes
  `Co-Authored-By:` / `Claude-Session:` du dépôt.

---

## Structure des fichiers

### Créés

| Fichier | Responsabilité |
|---|---|
| `src/stations.js` | Les faits sourcés sur les douze stations. Module plat : le test doit le lire depuis Node. |
| `src/jsonld.js` | Construction des blocs JSON-LD des pages de vue. Module plat, **pas** dans un `.jsx`. |
| `src/components/RadioPage.jsx` | La vue `/radio` : titre, introduction, lecteur réutilisé, fiches de stations. |
| `src/components/AgendaPage.jsx` | La vue `/agenda` : titre, introduction, liste complète groupée par pays. |
| `test/views.test.mjs` | Invariants des vues : unicité des URL, couverture des slugs, réciprocité des `hreflang` par vue. |
| `test/stations.test.mjs` | La règle de sourçage : aucun fait sans source. |

### Modifiés

| Fichier | Changement |
|---|---|
| `sites.config.js` | `VIEWS`, `ALL_VIEWS`, `urlFor`, `pathFor`, `langPath`, `viewFromPath`, `xDefaultFor` |
| `src/seo.js` | `VIEW_SEO` — titre et description par vue et par langue |
| `scripts/lib/site-meta.mjs` | `headFor({ siteId, lang, view })` — `canonical`, `hreflang`, `x-default`, `og:url` conscients de la vue |
| `scripts/lib/sitemap.mjs` | une entrée par (langue × vue) |
| `scripts/build-sites.mjs` | dérive les pages de vue |
| `scripts/prerender.mjs` | cuit les pages de vue, avec garde sur la vue rendue |
| `scripts/check-build.mjs` | contrôle les pages de vue |
| `src/App.jsx` | choisit sa vue d'après le chemin, expose `data-view` |
| `src/components/Nav.jsx` | ancres absolues hors de l'accueil |
| `src/components/Radio.jsx` | lien vers `/radio` depuis la section d'accueil |
| `src/components/Agenda.jsx` | lien vers `/agenda` depuis la section d'accueil |
| `src/i18n.jsx` | chaînes des deux nouvelles pages, dans les quatre langues |
| `src/styles/global.css` | styles des deux pages de vue |
| `test/radio-count.test.mjs` | couvre les nouveaux textes qui annoncent un nombre de radios |

---

# ÉTAPE 1 — Le routage et la page `/radio`

Livrable : `/radio` en ligne dans les quatre langues, indexable, sans risque de
page vide. Observable en production avant d'écrire l'étape 2.

---

### Task 1 : les vues et la dérivation d'URL

**Fichiers :**
- Modifier : `sites.config.js` (après `LANG_URL`, ligne ~169)
- Créer : `test/views.test.mjs`

**Interfaces :**
- Consomme : `SITES`, `LANG_URL`, `ALL_LANGS`, `langFromPath`, `siteOf` (existants)
- Produit :
  - `VIEWS: { [view]: { slugs: { [lang]: string } } }`
  - `ALL_VIEWS: string[]` — `['home', 'radio']` à l'étape 1
  - `urlFor(lang: string, view?: string): string` — URL absolue
  - `pathFor(lang: string, view?: string): string` — chemin depuis la racine du domaine
  - `langPath(siteId: string, lang: string): string` — `'/'` ou `'/hy/'`
  - `viewFromPath(siteId: string, pathname: string): string`
  - `xDefaultFor(view?: string): string`

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `test/views.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VIEWS,
  ALL_VIEWS,
  ALL_LANGS,
  urlFor,
  pathFor,
  langPath,
  viewFromPath,
  xDefaultFor,
} from '../sites.config.js'

test('chaque vue declare un slug pour chacune des quatre langues', () => {
  for (const view of ALL_VIEWS) {
    assert.deepEqual(
      Object.keys(VIEWS[view].slugs).sort(),
      [...ALL_LANGS].sort(),
      `la vue ${view} ne couvre pas les quatre langues`,
    )
  }
})

test('chaque couple (langue, vue) vit a exactement une URL', () => {
  const urls = ALL_LANGS.flatMap((l) => ALL_VIEWS.map((v) => urlFor(l, v)))
  assert.equal(new Set(urls).size, urls.length, `URL en double : ${urls}`)
})

test('urlFor compose le chemin de langue et le slug de la vue', () => {
  assert.equal(urlFor('fr'), 'https://armenieinfo.ch/')
  assert.equal(urlFor('fr', 'radio'), 'https://armenieinfo.ch/radio')
  assert.equal(urlFor('en', 'radio'), 'https://armenianews.org/radio')
  assert.equal(urlFor('hy', 'radio'), 'https://armenianews.org/hy/radio')
  assert.equal(urlFor('ru', 'radio'), 'https://armenianews.org/ru/radio')
})

test('pathFor donne le chemin sans le host', () => {
  assert.equal(pathFor('fr'), '/')
  assert.equal(pathFor('fr', 'radio'), '/radio')
  assert.equal(pathFor('hy', 'radio'), '/hy/radio')
})

test('langPath donne le chemin de la page d accueil de la langue', () => {
  assert.equal(langPath('ch', 'fr'), '/')
  assert.equal(langPath('org', 'en'), '/')
  assert.equal(langPath('org', 'hy'), '/hy/')
})

test('viewFromPath lit la vue depuis le chemin', () => {
  assert.equal(viewFromPath('ch', '/'), 'home')
  assert.equal(viewFromPath('ch', '/radio'), 'radio')
  assert.equal(viewFromPath('ch', '/radio/'), 'radio')
  assert.equal(viewFromPath('org', '/hy/radio'), 'radio')
  assert.equal(viewFromPath('org', '/ru/radio'), 'radio')
})

// Firebase reecrit tout chemin inconnu vers index.html : la page servie est
// alors l'accueil, et la vue doit le dire. Sans ce repli, /radiotelevision
// rendrait une page de radio sous une URL qui n'existe pas.
test('viewFromPath retombe sur home pour un chemin inconnu', () => {
  assert.equal(viewFromPath('ch', '/nimportequoi'), 'home')
  assert.equal(viewFromPath('ch', '/radiotelevision'), 'home')
  assert.equal(viewFromPath('org', '/hy/nimportequoi'), 'home')
})

test('x-default suit la vue, pas seulement la langue', () => {
  assert.equal(xDefaultFor(), 'https://armenianews.org/')
  assert.equal(xDefaultFor('radio'), 'https://armenianews.org/radio')
})
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

Lancer : `node --test test/views.test.mjs`
Attendu : ÉCHEC — `SyntaxError: The requested module '../sites.config.js' does not provide an export named 'VIEWS'`

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `sites.config.js`, après la définition de `X_DEFAULT` (ligne ~172) :

```js
// Les VUES — la seconde dimension d'une page, à côté de la langue.
//
// Une page est un triplet (vitrine, langue, vue). `home` existait déjà sans
// porter de nom ; `radio` et `agenda` sont les pages piliers qui donnent une
// URL propre aux deux jeux de données que ce site est seul à agréger.
//
// LES SLUGS RESTENT EN CARACTÈRES LATINS. Un slug en écriture arménienne
// partirait en pourcent-encodage (/hy/%D5%BC%D5%A1...), illisible dans un
// partage, pour aucun gain de classement.
//
// Mais ils sont TRADUITS là où le mot change la requête : en anglais, « agenda »
// désigne un ordre du jour ou un mobile, pas une liste d'événements — c'est
// « events » que les gens tapent. « radio » s'écrit pareil dans les quatre.
export const VIEWS = {
  home: { slugs: { fr: '', en: '', hy: '', ru: '' } },
  radio: { slugs: { fr: 'radio', en: 'radio', hy: 'radio', ru: 'radio' } },
}

export const ALL_VIEWS = Object.keys(VIEWS)

// L'URL absolue d'un couple (langue, vue). Le chemin de langue porte déjà son
// slash final (LANG_URL), le slug s'y ajoute tel quel : les pages de vue n'ont
// donc PAS de slash final, et leur canonical non plus. Firebase sert le même
// fichier sur /radio et /radio/ ; c'est le canonical qui tranche laquelle des
// deux est l'adresse.
export function urlFor(lang, view = 'home') {
  const slugs = VIEWS[view]?.slugs
  if (!slugs) throw new Error(`vue inconnue : ${view}`)
  const slug = slugs[lang]
  if (slug === undefined) throw new Error(`la vue ${view} ne couvre pas ${lang}`)
  return slug ? LANG_URL[lang] + slug : LANG_URL[lang]
}

// Le même, sans le host : ce qui part dans un href interne.
export function pathFor(lang, view = 'home') {
  const host = SITES[siteOf(lang)].host
  return urlFor(lang, view).slice(host.length)
}

// Le chemin de la page d'accueil d'une langue — '/' ou '/hy/'. Sert aux ancres
// de la nav sur les pages de vue (voir Nav.jsx).
export function langPath(siteId, lang) {
  const hit = SITES[siteId].pages.find((p) => p.lang === lang)
  if (!hit) throw new Error(`${siteId} ne sert pas ${lang}`)
  return hit.path
}

// La vue que désigne un chemin. Le chemin fait autorité ; tout ce qui n'est pas
// reconnu retombe sur `home`, parce que c'est ce que Firebase sert réellement
// (réécriture ** → /index.html).
export function viewFromPath(siteId, pathname) {
  const lang = langFromPath(siteId, pathname)
  const base = langPath(siteId, lang)
  const norm = pathname.endsWith('/') ? pathname : `${pathname}/`
  const rest = norm.slice(base.length).replace(/\/$/, '')
  if (!rest) return 'home'
  const hit = ALL_VIEWS.find((v) => VIEWS[v].slugs[lang] === rest)
  return hit ?? 'home'
}

// x-default doit suivre la vue : sur /radio il pointe sur le /radio anglais,
// pas sur l'accueil anglais. Un x-default qui change de page au milieu d'un
// bloc d'alternates rend le bloc incohérent.
export function xDefaultFor(view = 'home') {
  return urlFor('en', view)
}
```

> **Attention à l'ordre des déclarations.** `urlFor` appelle `siteOf` et
> `viewFromPath` appelle `langFromPath`, tous deux définis **plus bas** dans le
> fichier. Ce sont des déclarations de fonction (hoistées), donc l'ordre n'a pas
> d'importance à l'exécution — mais `LANG_URL` et `SITES` sont des `const` : le
> bloc ci-dessus doit venir **après** eux.

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

Lancer : `node --test test/views.test.mjs`
Attendu : SUCCÈS, 8 tests

Puis la suite entière, pour vérifier que rien n'a bougé :
Lancer : `npm test`
Attendu : SUCCÈS, 69 tests (61 existants + 8)

- [ ] **Étape 5 : lint**

Lancer : `npm run lint`
Attendu : 0 erreur, 5 avertissements (les cinq connus, inchangés)

- [ ] **Étape 6 : commit**

```bash
git add sites.config.js test/views.test.mjs
git commit -m "seo(vues): une page est un triplet vitrine, langue, vue"
```

---

### Task 2 : les métadonnées conscientes de la vue

**C'est la tâche à risque du plan.** `headFor` écrit aujourd'hui ses `hreflang`
depuis `LANG_URL`, donc toujours vers les quatre **accueils**. Si les pages de
vue héritent de ce bloc, `/radio` du `.ch` déclarera comme équivalent anglais
l'**accueil** du `.org`. Google reçoit des correspondances contradictoires et
**ignore le bloc entier — sur les huit pages, pas seulement les nouvelles.**

**Fichiers :**
- Modifier : `src/seo.js` (ajout de `VIEW_SEO` après `SEO`)
- Modifier : `scripts/lib/site-meta.mjs:87-166` (`headFor`)
- Modifier : `test/site-meta.test.mjs` (ajouts en fin de fichier)

**Interfaces :**
- Consomme : `urlFor`, `xDefaultFor`, `ALL_VIEWS` (Task 1)
- Produit : `headFor({ siteId, lang, view })` — `view` optionnel, défaut `'home'`,
  donc rétrocompatible avec les appels existants de `build-sites.mjs`.
  `VIEW_SEO: { [view]: { [lang]: { title, description } } }`

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter à la fin de `test/site-meta.test.mjs` :

```js
import { ALL_VIEWS, urlFor, xDefaultFor } from '../sites.config.js'

// L'INVARIANT CENTRAL DE CE CHANTIER. Les alternates d'une page de vue doivent
// citer la MÊME vue dans les autres langues. S'ils citaient les accueils, Google
// recevrait des correspondances contradictoires et ignorerait le bloc entier —
// sur toutes les pages, pas seulement les nouvelles.
test('les hreflang sont reciproques PAR VUE', () => {
  for (const view of ALL_VIEWS) {
    for (const lang of ALL_LANGS) {
      const head = headFor({ siteId: siteOf(lang), lang, view })
      for (const autre of ALL_LANGS) {
        assert.ok(
          head.includes(`hreflang="${autre}" href="${urlFor(autre, view)}"`),
          `${view}/${lang} : alternate ${autre} manquant ou pointant ailleurs`,
        )
      }
      assert.ok(
        head.includes(`hreflang="x-default" href="${xDefaultFor(view)}"`),
        `${view}/${lang} : x-default ne suit pas la vue`,
      )
      assert.equal(
        (head.match(/rel="alternate"/g) || []).length,
        ALL_LANGS.length + 1,
        `${view}/${lang} : nombre d'alternates`,
      )
    }
  }
})

// Le mode d'échec visé : une page de vue qui recopierait le bloc de l'accueil
// passerait le test ci-dessus pour la vue `home` et échouerait ici.
test('une page de vue ne cite jamais l accueil dans ses alternates', () => {
  for (const view of ALL_VIEWS.filter((v) => v !== 'home')) {
    for (const lang of ALL_LANGS) {
      const head = headFor({ siteId: siteOf(lang), lang, view })
      for (const autre of ALL_LANGS) {
        assert.ok(
          !head.includes(`hreflang="${autre}" href="${urlFor(autre, 'home')}"`),
          `${view}/${lang} : cite l'accueil ${autre} au lieu de sa propre vue`,
        )
      }
    }
  }
})

test('le canonical d une page de vue se designe elle-meme', () => {
  for (const view of ALL_VIEWS) {
    for (const lang of ALL_LANGS) {
      const head = headFor({ siteId: siteOf(lang), lang, view })
      assert.ok(
        head.includes(`<link rel="canonical" href="${urlFor(lang, view)}" />`),
        `${view}/${lang} : canonical faux`,
      )
      assert.equal((head.match(/rel="canonical"/g) || []).length, 1)
    }
  }
})

// Le titre d'une page de vue mene par le MOT-CLE, pas par la marque : la marque
// est inconnue, et Google tronque la fin. L'accueil garde l'ordre inverse, ou
// la marque est le sujet.
test('le titre d une page de vue mene par le mot-cle', () => {
  assert.ok(
    headFor({ siteId: 'ch', lang: 'fr', view: 'radio' }).includes(
      '<title>Radios arméniennes en direct · Arménie Info</title>',
    ),
  )
  assert.ok(
    headFor({ siteId: 'org', lang: 'en', view: 'radio' }).includes(
      '<title>Armenian radio online · Armenia News</title>',
    ),
  )
})

test('og:url suit la vue', () => {
  const head = headFor({ siteId: 'org', lang: 'ru', view: 'radio' })
  assert.ok(head.includes('property="og:url" content="https://armenianews.org/ru/radio"'))
})

// La carte de partage suit la VITRINE, pas la vue : les pages /radio du .org
// gardent la carte anglaise du domaine. Rien a regenerer.
test('les pages de vue gardent la carte de partage de leur vitrine', () => {
  for (const view of ALL_VIEWS) {
    for (const site of Object.values(SITES)) {
      for (const page of site.pages) {
        const head = headFor({ siteId: site.id, lang: page.lang, view })
        assert.ok(head.includes(`content="${site.host}${site.ogImage}"`))
        for (const autre of Object.values(SITES)) {
          if (autre.id !== site.id) assert.ok(!head.includes(autre.ogImage))
        }
      }
    }
  }
})
```

- [ ] **Étape 2 : lancer les tests pour vérifier qu'ils échouent**

Lancer : `node --test test/site-meta.test.mjs`
Attendu : ÉCHEC — `headFor` ignore `view`, donc le canonical de `radio/fr` vaut
encore `https://armenieinfo.ch/` au lieu de `https://armenieinfo.ch/radio`

- [ ] **Étape 3 : ajouter les chaînes SEO par vue**

Dans `src/seo.js`, après `SEO` et avant `OG_LOCALE` :

```js
// Titre et description des PAGES DE VUE, par langue.
//
// Le titre y mène par le MOT-CLÉ et non par la marque — inverse de l'accueil.
// La raison est concrète : Google tronque un titre vers 60 caractères et
// « Arménie Info » n'est pas encore un nom que l'on cherche. Sur l'accueil, la
// marque EST le sujet ; sur /radio, le sujet est la radio.
//
// Le titre final se compose `${VIEW_SEO[view][lang].title} · ${brand}`.
export const VIEW_SEO = {
  radio: {
    fr: {
      title: 'Radios arméniennes en direct',
      description:
        'Douze radios arméniennes en direct, d’Erevan et de la diaspora : actualité, musique, culture et jazz. Écoute gratuite, sans compte ni installation.',
    },
    en: {
      title: 'Armenian radio online',
      description:
        'Twelve Armenian radio stations streaming live from Yerevan and the diaspora: news, music, culture and jazz. Free to listen, no account, nothing to install.',
    },
    hy: {
      title: 'Հայկական ռադիոկայաններ ուղիղ եթերում',
      description:
        'Տասներկու հայկական ռադիոկայան ուղիղ եթերում՝ Երևանից և սփյուռքից․ լուրեր, երաժշտություն, մշակույթ և ջազ։ Անվճար, առանց հաշվի և տեղադրման։',
    },
    ru: {
      title: 'Армянское радио онлайн',
      description:
        'Двенадцать армянских радиостанций в прямом эфире из Еревана и диаспоры: новости, музыка, культура и джаз. Бесплатно, без регистрации и установки.',
    },
  },
}
```

> **À signaler au propriétaire pour relecture native** : les entrées `hy` et `ru`
> ci-dessus. Le sens est vérifié, le registre journalistique ne l'est pas.

- [ ] **Étape 4 : rendre `headFor` conscient de la vue**

Dans `scripts/lib/site-meta.mjs`, remplacer l'import (ligne 8-9) :

```js
import { SITES, ALL_LANGS, urlFor, xDefaultFor } from '../../sites.config.js'
import { SEO, VIEW_SEO, OG_LOCALE } from '../../src/seo.js'
```

Puis dans `headFor` (ligne 87), remplacer la signature et les six lignes qui
composent l'URL, le titre, la description et les alternates :

```js
export function headFor({ siteId, lang, view = 'home' }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!SEO[lang]) throw new Error(`langue sans chaînes SEO : ${lang}`)
  if (!OG_LOCALE[lang]) throw new Error(`langue sans locale Open Graph : ${lang}`)
  if (view !== 'home' && !VIEW_SEO[view]?.[lang]) {
    throw new Error(`vue ${view} sans chaînes SEO en ${lang}`)
  }

  const url = urlFor(lang, view)
  // L'accueil mène par la marque (elle est le sujet) ; une page de vue mène par
  // le mot-clé (la marque n'est pas encore cherchée, et Google tronque la fin).
  const title =
    view === 'home'
      ? `${site.brand} · ${SEO[lang].tagline}`
      : `${VIEW_SEO[view][lang].title} · ${site.brand}`
  const description =
    view === 'home' ? SEO[lang].description : VIEW_SEO[view][lang].description
  const { keywords } = SEO[lang]
  const image = `${site.host}${site.ogImage}`
```

et, dans le tableau `lines`, remplacer les deux lignes d'alternates :

```js
    ...ALL_LANGS.map(
      (l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l, view)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${xDefaultFor(view)}" />`,
```

Enfin, propager `view` dans les deux applicateurs (lignes 220 et 241) :

```js
export function applyMeta(html, { siteId, lang, view = 'home' }) {
  // … les trois contrôles de marqueurs sont inchangés …
  return setLang(html, lang)
    .replace(META_MARKER, headFor({ siteId, lang, view }).trimStart())
    .replace(BEACON_MARKER, beaconTag(siteId))
    .replace(GA_MARKER, gaTag(siteId))
}

export function replaceMeta(html, { siteId, lang, view = 'home' }) {
  // … le contrôle des sentinelles est inchangé …
  const head = headFor({ siteId, lang, view }).trimStart()
  return setLang(html.slice(0, from) + head + html.slice(to + META_END.length), lang)
}
```

> `LANG_URL` et `X_DEFAULT` ne sont plus importés par ce fichier. Retirer les
> deux noms de la ligne d'import, sinon `no-unused-vars` remonte une **erreur**
> de lint (pas un avertissement).

- [ ] **Étape 5 : lancer les tests pour vérifier qu'ils passent**

Lancer : `node --test test/site-meta.test.mjs`
Attendu : SUCCÈS — les tests existants (canonical, hreflang, marque, carte de
partage, GA, beacon, GSC) passent toujours, `view` valant `'home'` par défaut.

Lancer : `npm test`
Attendu : SUCCÈS, 75 tests

- [ ] **Étape 6 : commit**

```bash
git add src/seo.js scripts/lib/site-meta.mjs test/site-meta.test.mjs
git commit -m "seo(meta): hreflang, canonical et titre conscients de la vue"
```

---

### Task 3 : le routage par chemin dans l'application

**Fichiers :**
- Modifier : `src/App.jsx`
- Modifier : `src/components/Nav.jsx:24-29`

**Interfaces :**
- Consomme : `viewFromPath`, `langPath`, `pathFor` (Task 1), `SITE_ID` (`src/site.js`)
- Produit : `App` rend `<div data-view={view}>` ; `Nav` accepte une prop
  `view: string`

> **Pas de test Node ici** : `node --test` ne sait pas importer du JSX. La
> vérification passe par le build, le prérendu et le navigateur — et la garde
> `data-view` de la Task 6 est ce qui empêche une régression silencieuse.

- [ ] **Étape 1 : router dans `App.jsx`**

Remplacer le corps de `src/App.jsx` :

```jsx
import { useEffect } from 'react'
import { useReveal } from './hooks/useReveal.js'
import { useI18n } from './i18n.jsx'
import { SITE_ID } from './site.js'
import { viewFromPath } from '../sites.config.js'
import { Nav } from './components/Nav.jsx'
import { Hero } from './components/Hero.jsx'
import { Radio } from './components/Radio.jsx'
import { News } from './components/News.jsx'
import { Agenda } from './components/Agenda.jsx'
import { Social } from './components/Social.jsx'
import { RadioPage } from './components/RadioPage.jsx'
import { Footer } from './components/Footer.jsx'

// La vue vient de l'URL, comme la langue — lue une fois au montage. Il n'y a pas
// de routeur client : chaque vue est un fichier HTML distinct, servi par
// Firebase, exactement comme /hy/ et /ru/. Naviguer entre les vues est une
// navigation de document, pas un changement d'état.
export default function App() {
  const { lang } = useI18n()
  const view = viewFromPath(SITE_ID, window.location.pathname)
  useReveal(lang)

  // Une arrivée à froid sur /#instagram atterrit en haut : le navigateur cherche
  // la cible pendant que #root est encore vide, renonce, et ne réessaie jamais.
  // On rejoue le hash une fois les sections montées.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  return (
    // `data-view` n'est pas décoratif : c'est ce que scripts/prerender.mjs lit
    // pour refuser de cuire l'accueil dans le fichier d'une page de vue. Voir la
    // garde de la Task 6, jumelle de celle qui existe déjà sur <html lang>.
    <div key={`${lang}-${view}`} data-view={view}>
      <Nav view={view} />
      {view === 'radio' ? (
        <RadioPage />
      ) : (
        <>
          <Hero />
          <main>
            <Radio />
            <News />
            <Agenda />
            <Social />
          </main>
        </>
      )}
      <Footer />
    </div>
  )
}
```

- [ ] **Étape 2 : rendre les ancres de la nav absolues hors de l'accueil**

Dans `src/components/Nav.jsx`, remplacer l'import (ligne 4) et le tableau
`links` (lignes 24-29) :

```jsx
import { LANG_URL, langPath } from '../../sites.config.js'
import { SITE_ID } from '../site.js'
```

```jsx
export function Nav({ view = 'home' }) {
  // … useState / useEffect inchangés …

  // Hors de l'accueil, les ancres ne désignent rien : /radio n'a ni #actualites
  // ni #agenda. Elles doivent donc porter le chemin de l'accueil de LA LANGUE
  // COURANTE — '/' sur le .ch, '/hy/' sur la page arménienne. Sans cela les
  // pages de vue ont une nav morte, et une page sans lien entrant interne ne
  // circule pas.
  const home = view === 'home' ? '' : langPath(SITE_ID, lang)
  const links = [
    [`${home}#direct`, t('nav.radio')],
    [`${home}#actualites`, t('nav.news')],
    [`${home}#agenda`, t('nav.agenda')],
    [`${home}#reseaux`, t('nav.social')],
  ]
```

Et la marque, ligne 34, qui pointe sur `#top` :

```jsx
        <a className="nav__brand" href={home ? langPath(SITE_ID, lang) : '#top'} aria-label={t('site.title')}>
```

> **Le sélecteur de langue reste sur `LANG_URL`, donc sur les accueils.** C'est
> volontaire pour cette étape : depuis `/hy/radio`, cliquer « FR » mène à
> l'accueil français, pas à `/radio`. Le rendre conscient de la vue est un
> raffinement — noté en fin de plan, pas fait ici.

- [ ] **Étape 3 : vérifier au navigateur**

Lancer : `npm run dev`, puis ouvrir `http://localhost:5173/radio`
Attendu : la page rend `RadioPage` (elle n'existe pas encore → cette étape est
bloquée par la Task 5 ; l'ordre d'exécution réel est 1, 2, 4, 5, 3).

> **Ordre d'exécution.** Cette tâche importe `RadioPage.jsx`, créé en Task 5.
> Exécuter les tâches dans l'ordre **1, 2, 4, 5, 3, 6, 7, 8, 9** — ou créer en
> Task 3 un `RadioPage.jsx` réduit à `export function RadioPage() { return null }`
> que la Task 5 remplira. La seconde voie garde chaque commit vert ; c'est
> celle-ci qu'il faut prendre.

- [ ] **Étape 4 : lint**

Lancer : `npm run lint`
Attendu : 0 erreur, 5 avertissements. `RadioPage.jsx` n'exporte **qu'un
composant** — s'il en sortait autre chose, un sixième avertissement apparaîtrait.

- [ ] **Étape 5 : commit**

```bash
git add src/App.jsx src/components/Nav.jsx src/components/RadioPage.jsx
git commit -m "seo(routage): l app choisit sa vue d apres le chemin"
```

---

### Task 4 : les faits sourcés sur les douze stations

**Fichiers :**
- Créer : `src/stations.js`
- Créer : `test/stations.test.mjs`

**Interfaces :**
- Consomme : rien
- Produit : `STATION_FACTS: { [id]: { city?, genre?, langue?, fm?, bitrate?, sources: string[] } }`
  où `id` est l'un des douze `id` de `STATIONS` (`src/components/Radio.jsx`)

**La règle, et c'est elle que le test garde : aucun fait sans source.** Une fiche
à deux champs vrais vaut mieux qu'à cinq champs plausibles.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `test/stations.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { STATION_FACTS } from '../src/stations.js'

// Node ne sait pas importer du JSX : on lit STATIONS comme du texte, exactement
// comme test/source-count.test.mjs lit TAB_ORDER.
const jsx = await readFile(new URL('../src/components/Radio.jsx', import.meta.url), 'utf-8')
const ids = [...jsx.matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map((m) => m[1])

test('les douze stations du lecteur ont une fiche, et reciproquement', () => {
  assert.equal(ids.length, 12, 'STATIONS ne contient plus douze entrees')
  assert.deepEqual([...ids].sort(), Object.keys(STATION_FACTS).sort())
})

// LA REGLE DE SOURCAGE. Une fiche qui affirme sans sourcer est exactement ce que
// ce chantier refuse : elle classe aussi bien qu'une fiche vraie, jusqu'au jour
// ou un lecteur la dement.
test('aucun fait n est affirme sans source', () => {
  for (const [id, f] of Object.entries(STATION_FACTS)) {
    const faits = ['city', 'genre', 'langue', 'fm', 'bitrate'].filter((k) => f[k] != null)
    if (faits.length) {
      assert.ok(Array.isArray(f.sources) && f.sources.length > 0, `${id} : faits sans source`)
      for (const s of f.sources) assert.match(s, /^https:\/\//, `${id} : source non https`)
    }
  }
})

test('aucun champ vide ni rempli d un point d interrogation', () => {
  for (const [id, f] of Object.entries(STATION_FACTS)) {
    for (const [k, v] of Object.entries(f)) {
      if (k === 'sources') continue
      if (v == null) continue
      assert.equal(typeof v, 'string', `${id}.${k} doit etre une chaine ou absent`)
      assert.ok(v.trim().length > 0, `${id}.${k} est vide`)
      assert.doesNotMatch(v, /\?|TBD|TODO|inconnu/i, `${id}.${k} n est pas un fait`)
    }
  }
})
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

Lancer : `node --test test/stations.test.mjs`
Attendu : ÉCHEC — `Cannot find module '../src/stations.js'`

- [ ] **Étape 3 : rechercher les faits, puis écrire le module**

Pour **chacun** des douze `id` (`public`, `im`, `arevik`, `culture`, `mariam`,
`vov`, `lav`, `fama`, `yerevannights`, `gospel`, `yeraz`, `jazz`) :

1. Ouvrir le site officiel de la station (ou sa page sur le site de son groupe).
2. Ne relever que ce qui y est **écrit** : ville d'émission, genre, langue
   d'antenne, fréquence FM.
3. Noter l'URL exacte dans `sources`.
4. **Champ non trouvé ⇒ champ absent.** Ne pas déduire, ne pas approximer.

Pour `bitrate`, lire l'en-tête `icy-br` du flux (l'URL est dans `STATIONS`) :

```bash
curl -sI -H "Icy-MetaData: 1" "https://eu1.stream4cast.com/proxy/publicra/stream" | grep -i "icy-br\|content-type"
```

La source est alors le flux lui-même — le mettre dans `sources`.

Créer `src/stations.js` :

```js
// Les faits sourcés sur les douze stations du lecteur.
//
// Module PLAT (pas de JSX) : test/stations.test.mjs doit le lire depuis Node.
// Même raison que src/seo.js, src/site.js, src/worldPlace.js, src/hyDate.js.
//
// LA RÈGLE : aucun fait sans source, et un champ non trouvé est un champ
// ABSENT — jamais « ? », jamais une approximation. Une fiche à deux champs
// vrais classe aussi bien qu'une fiche à cinq champs plausibles, et elle ne
// coûte pas la crédibilité du site le jour où un lecteur la dément.
// test/stations.test.mjs fait échouer le build si cette règle est violée.
//
// Les LIBELLÉS sont dans i18n (radio.st.*) : ce module ne porte que des faits.
// `genre` et `langue` sont des clés i18n (voir STRINGS.*['radio.genre.*']), pas
// du texte — une page arménienne ne doit pas afficher « Actualité, musique ».
export const STATION_FACTS = {
  public: {
    city: 'Երևան',
    genre: 'news',
    langue: 'hy',
    fm: '103.5',
    bitrate: '128',
    sources: ['https://www.armradio.am/'],
  },
  jazz: {
    // 89.3 MHz, Erevan — déjà documenté dans le commentaire de STATIONS
    // (src/components/Radio.jsx), vérifié sur le site de la station.
    city: 'Երևան',
    genre: 'jazz',
    fm: '89.3',
    bitrate: '256',
    sources: ['https://radioaurora.am/'],
  },
  // … les dix autres, remplies selon la recherche de l'étape 3.
  // Une station sans source publique fiable garde une fiche à deux champs :
  //   yerevannights: { genre: 'music', bitrate: '128', sources: ['https://…'] },
}
```

> **`city` est écrit dans l'écriture de la ville** et non traduit : « Երևան »
> reste « Երևան » sur les quatre pages, comme le badge `location` de l'agenda
> garde son texte brut. `genre` et `langue`, eux, sont des **clés i18n** parce
> que ce sont des libellés d'interface.

- [ ] **Étape 4 : lancer le test pour vérifier qu'il passe**

Lancer : `node --test test/stations.test.mjs`
Attendu : SUCCÈS, 3 tests

- [ ] **Étape 5 : rendre compte au propriétaire**

Écrire dans le message de commit la liste des stations dont la fiche est
**incomplète**, avec ce qui manque. C'est une information, pas un échec.

- [ ] **Étape 6 : commit**

```bash
git add src/stations.js test/stations.test.mjs
git commit -m "radio(faits): douze fiches sourcees, et rien qui ne le soit pas"
```

---

### Task 5 : la page `/radio`

**Fichiers :**
- Créer : `src/jsonld.js`
- Remplacer : `src/components/RadioPage.jsx` (l'ébauche vide de la Task 3)
- Modifier : `src/i18n.jsx` (quatre blocs `STRINGS`)
- Modifier : `src/styles/global.css`
- Modifier : `test/radio-count.test.mjs`

**Interfaces :**
- Consomme : `STATION_FACTS` (Task 4), `Radio` (`src/components/Radio.jsx`),
  `useI18n`, `pathFor` (Task 1)
- Produit : `RadioPage` (composant, **seul export du fichier**) ;
  `radioJsonLd(lang, t): string` (`src/jsonld.js`)

- [ ] **Étape 1 : ajouter les chaînes i18n**

Dans `src/i18n.jsx`, ajouter à **chacun** des quatre blocs `STRINGS` (`fr`, `en`,
`hy`, `ru`) — les quatre doivent porter **les mêmes clés**, sinon le repli
silencieux sur le français masque l'oubli :

```js
    // Page /radio
    'radio.page.h1': 'Radios arméniennes en direct',
    'radio.page.intro':
      'Douze radios arméniennes en flux continu, réunies sur une seule page : les stations publiques d’Erevan, les antennes indépendantes et celles de la diaspora. Aucune inscription, rien à installer — le son démarre au clic et suit la bascule jour / nuit du site. Les flux sont ceux des stations elles-mêmes ; ArménieInfo n’héberge ni ne réencode aucun signal.',
    'radio.page.list': 'Les douze stations',
    'radio.page.city': 'Ville',
    'radio.page.genre': 'Genre',
    'radio.page.lang': 'Langue d’antenne',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Débit',
    'radio.page.source': 'Source',
    'radio.page.home': 'Retour à l’accueil',
    'radio.genre.news': 'Actualité',
    'radio.genre.music': 'Musique',
    'radio.genre.culture': 'Culture',
    'radio.genre.jazz': 'Jazz',
    'radio.genre.religious': 'Religieux',
```

Équivalents anglais (`en`) :

```js
    'radio.page.h1': 'Armenian radio online',
    'radio.page.intro':
      'Twelve Armenian stations streaming live on one page: the public networks of Yerevan, the independent broadcasters and the diaspora’s own. No sign-up, nothing to install — sound starts on click and follows the site’s day / night switch. The streams are the stations’ own; Armenia News neither hosts nor re-encodes any signal.',
    'radio.page.list': 'The twelve stations',
    'radio.page.city': 'City',
    'radio.page.genre': 'Format',
    'radio.page.lang': 'On-air language',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Bitrate',
    'radio.page.source': 'Source',
    'radio.page.home': 'Back to the home page',
    'radio.genre.news': 'News',
    'radio.genre.music': 'Music',
    'radio.genre.culture': 'Culture',
    'radio.genre.jazz': 'Jazz',
    'radio.genre.religious': 'Religious',
```

Les blocs `hy` et `ru` traduisent **le même texte**, sans l'abréger.
**Les signaler tous les deux au propriétaire pour relecture native.**

- [ ] **Étape 2 : étendre le test qui compte les radios**

`test/radio-count.test.mjs` garde l'accord entre `STATIONS` et les textes qui
annoncent un nombre — aujourd'hui les quatre `radio.subtitle` et les deux cartes
de liens. Les deux nouvelles clés en annoncent un aussi : sans cet ajout, une
treizième station ferait mentir **six textes de plus**, en silence.

Le fichier n'a pas de « liste de clés » à compléter : il teste chaque famille de
textes séparément, avec la table `NOMBRES` (`fr: 'Douze'`, `en: 'Twelve'`,
`hy: 'Տասներկու'`, `ru: 'Двенадцать'`) et `ATTENDU = 12`. Ajouter donc un test à
la fin, bâti sur le même modèle que « les quatre sous-titres radio annoncent le
même nombre » :

```js
// Les deux textes de la page /radio annoncent eux aussi le nombre de stations,
// et `t()` ne sait toujours pas interpoler. Meme mode d'echec que radio.subtitle,
// sur deux cles de plus : une treizieme station ferait mentir huit textes au
// lieu de quatre. On lit i18n.jsx comme du texte, comme le reste du fichier.
test('les textes de la page /radio annoncent le meme nombre', () => {
  const src = read('src/i18n.jsx')
  for (const cle of ['radio.page.intro', 'radio.page.list']) {
    const trouves = [...src.matchAll(new RegExp(`'${cle}':\\s*\n?\\s*'([^']*)'`, 'g'))].map(
      (m) => m[1],
    )
    assert.equal(trouves.length, ALL_LANGS.length, `${ALL_LANGS.length} « ${cle} » attendus`)
    ALL_LANGS.forEach((lang, i) => {
      assert.ok(
        trouves[i].includes(NOMBRES[lang]) || trouves[i].includes(NOMBRES[lang].toLowerCase()),
        `${cle} (${lang}) devrait annoncer « ${NOMBRES[lang]} » : ${trouves[i]}`,
      )
    })
  }
})
```

> La regex tolère un retour à la ligne après le deux-points, parce que
> `radio.page.intro` est trop long pour tenir sur une ligne et que Prettier la
> reformatera. **Écrire les quatre valeurs de chaque clé dans l'ordre `fr`, `en`,
> `hy`, `ru`** : le test s'appuie sur l'ordre des dictionnaires, comme celui des
> sous-titres.

- [ ] **Étape 3 : lancer le test pour vérifier qu'il échoue**

Lancer : `node --test test/radio-count.test.mjs`
Attendu : ÉCHEC tant que les clés ne sont pas dans les quatre blocs `STRINGS`

- [ ] **Étape 4 : écrire le JSON-LD**

Créer `src/jsonld.js` :

```js
// Les blocs JSON-LD des pages de vue.
//
// Module PLAT et non un .jsx : un export non-composant depuis un .jsx ajoute un
// avertissement react-refresh/only-export-components, et le dépôt en tient
// exactement cinq, tous documentés. Même raison que src/seo.js.
//
// Sur /radio, le balisage RadioStation aide Google à comprendre l'entité mais
// N'AFFICHE RIEN de particulier dans les résultats. Ne pas en attendre de
// résultat enrichi : le seul de ce projet qui en produise est Event, sur
// /agenda.
import { STATION_FACTS } from './stations.js'
import { urlFor } from '../sites.config.js'

// Échappe "<" pour qu'aucune chaîne ne puisse fermer le <script>. Même garde
// que scripts/lib/site-meta.mjs.
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

export function radioJsonLd(lang, t) {
  const ids = Object.keys(STATION_FACTS)
  return safe({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('radio.page.h1'),
    url: urlFor(lang, 'radio'),
    numberOfItems: ids.length,
    itemListElement: ids.map((id, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'RadioStation',
        name: t(`radio.st.${id}`),
        // Les champs absents de la fiche sont absents du balisage : baliser un
        // fait qu'on n'affiche pas serait affirmer sans source par une autre
        // porte.
        ...(STATION_FACTS[id].city ? { areaServed: STATION_FACTS[id].city } : {}),
        ...(STATION_FACTS[id].langue ? { inLanguage: STATION_FACTS[id].langue } : {}),
      },
    })),
  })
}
```

- [ ] **Étape 5 : écrire le composant**

Remplacer `src/components/RadioPage.jsx` :

```jsx
import { useI18n } from '../i18n.jsx'
import { SITE_ID } from '../site.js'
import { pathFor } from '../../sites.config.js'
import { STATION_FACTS } from '../stations.js'
import { radioJsonLd } from '../jsonld.js'
import { Radio } from './Radio.jsx'

// La vue /radio. Elle COMPLÈTE l'accueil, elle ne le remplace pas : l'accueil
// garde sa section lecteur, cette page ajoute ce que l'accueil n'a pas — une
// introduction, et les faits de chaque station.
//
// Le lecteur est le composant Radio réutilisé TEL QUEL, pas une copie : deux
// lecteurs divergeraient au premier correctif.
export function RadioPage() {
  const { t, lang } = useI18n()
  const ids = Object.keys(STATION_FACTS)

  return (
    <main className="viewpage">
      <div className="container">
        <h1 className="viewpage__title">{t('radio.page.h1')}</h1>
        <p className="viewpage__intro">{t('radio.page.intro')}</p>
      </div>

      <Radio />

      <section className="section" id="stations">
        <div className="container">
          <h2 className="section__title">{t('radio.page.list')}</h2>
          <ul className="stations">
            {ids.map((id) => {
              const f = STATION_FACTS[id]
              const champs = [
                ['radio.page.city', f.city],
                ['radio.page.genre', f.genre && t(`radio.genre.${f.genre}`)],
                ['radio.page.lang', f.langue && t(`radio.page.lang.${f.langue}`)],
                ['radio.page.fm', f.fm && `${f.fm} MHz`],
                ['radio.page.bitrate', f.bitrate && `${f.bitrate} kbps`],
              ].filter(([, v]) => v)

              return (
                <li className="stations__item" key={id}>
                  <h3 className="stations__name">{t(`radio.st.${id}`)}</h3>
                  <dl className="stations__facts">
                    {champs.map(([cle, valeur]) => (
                      <div key={cle}>
                        <dt>{t(cle)}</dt>
                        <dd>{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              )
            })}
          </ul>
          <p className="viewpage__back">
            <a href={pathFor(lang, 'home')}>{t('radio.page.home')}</a>
          </p>
        </div>
      </section>

      {/* application/ld+json n'est pas exécuté : script-src 'self' ne le bloque
          pas. Le contenu vient de nos propres fichiers et « < » y est échappé. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: radioJsonLd(lang, t) }}
      />
    </main>
  )
}
```

> `radio.page.lang.hy` / `.ru` / `.en` sont des clés i18n supplémentaires à
> ajouter à l'étape 1 pour chaque langue d'antenne rencontrée dans les fiches.

- [ ] **Étape 6 : styles**

Dans `src/styles/global.css`, ajouter le bloc `.viewpage` / `.stations`. **Chaque
`font-family: var(--font-X)` doit être immédiatement suivi de son
`font-size-adjust: var(--fsa-X)`** — sans quoi le titre changera de taille vue
entre le français et l'arménien.

- [ ] **Étape 7 : vérifier**

Lancer : `npm test`
Attendu : SUCCÈS, 78 tests

Lancer : `npm run lint`
Attendu : 0 erreur, **5** avertissements. Six signifierait qu'un `.jsx` exporte
autre chose qu'un composant — corriger avant de continuer.

Lancer : `npm run dev`, ouvrir `http://localhost:5173/radio`
Attendu : `H1` « Radios arméniennes en direct », le lecteur, douze fiches.

Vérifier le rendu mobile en **iframe même-origine à 390 px** sur le serveur de
dev (`resize_window` ment d'environ 710 px, et la production bloque les iframes).

- [ ] **Étape 8 : commit**

```bash
git add src/jsonld.js src/components/RadioPage.jsx src/i18n.jsx src/styles/global.css test/radio-count.test.mjs
git commit -m "radio(page): /radio, ses douze fiches et son balisage"
```

---

### Task 6 : le build et le prérendu produisent les pages de vue

**Fichiers :**
- Modifier : `scripts/build-sites.mjs:80-92` (`derivePages`)
- Modifier : `scripts/prerender.mjs:58-112`

**Interfaces :**
- Consomme : `ALL_VIEWS`, `pathFor` (Task 1), `replaceMeta` (Task 2), `data-view` (Task 3)
- Produit : `dist/ch/radio/index.html`, `dist/org/radio/index.html`,
  `dist/org/hy/radio/index.html`, `dist/org/ru/radio/index.html`

- [ ] **Étape 1 : dériver les pages de vue au build**

Dans `scripts/build-sites.mjs`, remplacer `derivePages` :

```js
// Les pages autres que la racine : même bundle, métadonnées régénérées.
//
// Deux dimensions désormais — la langue ET la vue. Une seule page est produite
// par Vite (la racine du site, dans sa langue de tête) ; toutes les autres sont
// dérivées du HTML BÂTI, qui seul porte les hachages d'assets.
async function derivePages(site) {
  const dist = path.join(root, 'dist', site.id)
  const built = await readFile(path.join(dist, 'index.html'), 'utf-8')

  for (const page of site.pages) {
    for (const view of ALL_VIEWS) {
      const rel = pathFor(page.lang, view)
      if (rel === '/') continue // celle-là sort de Vite
      const dir = path.join(dist, rel.replace(/^\/|\/$/g, ''))
      await mkdir(dir, { recursive: true })
      const html = replaceMeta(built, { siteId: site.id, lang: page.lang, view })
      await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
      console.log(`  → dist/${site.id}${rel}/index.html (${page.lang}, ${view})`)
    }
  }
}
```

et compléter l'import de la ligne 21 :

```js
import { SITES, ALL_LANGS, ALL_VIEWS, LANGS, pathFor } from '../sites.config.js'
```

- [ ] **Étape 2 : cuire les pages de vue au prérendu, avec garde**

Dans `scripts/prerender.mjs`, remplacer la boucle interne (lignes 67-108). Le
changement de fond est la **seconde garde** : le prérendu vérifie déjà que la
page a démarré dans sa langue ; il doit maintenant vérifier qu'elle a démarré
dans **sa vue**.

```js
      for (const page of site.pages) {
        for (const view of ALL_VIEWS) {
          const rel = pathFor(page.lang, view)
          const file = path.join(root, 'dist', site.id, rel.replace(/^\//, ''), 'index.html')
          const tab = await browser.newPage()
          try {
            await tab.goto(origin + rel, { waitUntil: 'networkidle0' })

            await tab.evaluate(() => {
              document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
            })

            const domLang = await tab.evaluate(() => document.documentElement.lang)
            if (domLang !== page.lang) {
              throw new Error(`${site.id}${rel} : rendu en "${domLang}" au lieu de "${page.lang}"`)
            }

            // La jumelle de la garde ci-dessus, et elle est nécessaire : le
            // serveur de prévisualisation retombe sur l'index racine pour un
            // chemin qu'il ne trouve pas. Sans ce contrôle, une erreur de slug
            // ferait cuire l'ACCUEIL dans le fichier de /radio — une page
            // parfaitement valide, au mauvais contenu, sans le moindre signal.
            const domView = await tab.evaluate(
              () => document.querySelector('[data-view]')?.dataset.view,
            )
            if (domView !== view) {
              throw new Error(`${site.id}${rel} : rendu en vue "${domView}" au lieu de "${view}"`)
            }

            const rendered = await tab.$eval('#root', (el) => el.innerHTML)
            if (!rendered.trim()) {
              throw new Error(`${site.id}${rel} : #root vide — refus de cuire une page blanche`)
            }

            const html = await readFile(file, 'utf-8')
            const marker = '<div id="root"></div>'
            if (!html.includes(marker)) throw new Error(`marker ${marker} not found in ${file}`)

            await writeFile(file, html.replace(marker, `<div id="root">${rendered}</div>`), 'utf-8')
            console.log(
              `✓ ${site.id}${rel} (${page.lang}, ${view}) — ${rendered.length.toLocaleString('en-US')} chars`,
            )
            baked++
          } finally {
            await tab.close()
          }
        }
      }
```

et compléter l'import de la ligne 30 :

```js
import { SITES, ALL_VIEWS, pathFor } from '../sites.config.js'
```

- [ ] **Étape 3 : bâtir et cuire**

Lancer : `npm run build`
Attendu : `→ dist/ch/radio/index.html (fr, radio)` et les trois du `.org`

Lancer : `npm run prerender`
Attendu : `✓ 8 pages prérendues` (4 accueils + 4 radio), chacune avec un nombre
de caractères non nul

- [ ] **Étape 4 : vérifier que le contenu cuit est le bon**

```bash
node -e "
const fs=require('fs');
for (const f of ['dist/ch/index.html','dist/ch/radio/index.html']) {
  const h=fs.readFileSync(f,'utf8');
  const h1=(h.match(/<h1[\s\S]*?<\/h1>/)||[''])[0].replace(/<[^>]+>/g,' ').trim();
  console.log(f, '| H1:', h1, '| canonical:', (h.match(/rel=\"canonical\" href=\"([^\"]+)\"/)||[])[1]);
}"
```

Attendu :
```
dist/ch/index.html | H1: Arménie Info | canonical: https://armenieinfo.ch/
dist/ch/radio/index.html | H1: Radios arméniennes en direct | canonical: https://armenieinfo.ch/radio
```

Deux `H1` identiques signifieraient que la garde `data-view` n'a pas fonctionné.

- [ ] **Étape 5 : commit**

```bash
git add scripts/build-sites.mjs scripts/prerender.mjs
git commit -m "build(vues): huit pages baties et cuites au lieu de quatre"
```

---

### Task 7 : le sitemap et `npm run check` couvrent les pages de vue

**Fichiers :**
- Modifier : `scripts/lib/sitemap.mjs:27-50`
- Modifier : `scripts/check-build.mjs:17-19, 37-53, 212-218`
- Modifier : `test/site-meta.test.mjs` (les deux tests de sitemap, lignes 276-294)

**Interfaces :**
- Consomme : `ALL_VIEWS`, `urlFor`, `xDefaultFor`, `pathFor` (Task 1)
- Produit : `dist/ch/sitemap.xml` à 2 entrées, `dist/org/sitemap.xml` à 6

- [ ] **Étape 1 : écrire les tests qui échouent**

Remplacer les deux tests de sitemap de `test/site-meta.test.mjs` :

```js
test('le sitemap du .ch liste ses pages, une par vue', () => {
  const xml = sitemapFor('ch', '2026-07-28T10:00:00.000Z')
  assert.equal((xml.match(/<url>/g) || []).length, ALL_VIEWS.length)
  assert.ok(xml.includes('<loc>https://armenieinfo.ch/</loc>'))
  assert.ok(xml.includes('<loc>https://armenieinfo.ch/radio</loc>'))
  assert.ok(xml.includes('<lastmod>2026-07-28T10:00:00.000Z</lastmod>'))
})

test('le sitemap du .org liste ses trois langues fois ses vues', () => {
  const xml = sitemapFor('org', '2026-07-28T10:00:00.000Z')
  assert.equal((xml.match(/<url>/g) || []).length, 3 * ALL_VIEWS.length)
  for (const loc of [
    'https://armenianews.org/',
    'https://armenianews.org/hy/',
    'https://armenianews.org/radio',
    'https://armenianews.org/hy/radio',
    'https://armenianews.org/ru/radio',
  ]) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), loc)
  }
})

// Le meme piege que dans le <head> : une entree de sitemap dont les alternates
// pointent sur les accueils annonce a Google que /radio et l accueil sont la
// meme page en quatre langues.
test('les alternates du sitemap suivent la vue de leur entree', () => {
  const xml = sitemapFor('ch', '2026-07-28T10:00:00.000Z')
  const bloc = xml.split('<url>').find((b) => b.includes('<loc>https://armenieinfo.ch/radio</loc>'))
  for (const l of ALL_LANGS) {
    assert.ok(bloc.includes(`hreflang="${l}" href="${urlFor(l, 'radio')}"`), l)
  }
  assert.ok(bloc.includes(`hreflang="x-default" href="${xDefaultFor('radio')}"`))
})
```

- [ ] **Étape 2 : lancer les tests pour vérifier qu'ils échouent**

Lancer : `node --test test/site-meta.test.mjs`
Attendu : ÉCHEC — 1 `<url>` produite au lieu de 2

- [ ] **Étape 3 : rendre le sitemap conscient des vues**

Dans `scripts/lib/sitemap.mjs`, remplacer l'import et `sitemapFor` :

```js
import { SITES, ALL_LANGS, ALL_VIEWS, urlFor, xDefaultFor } from '../../sites.config.js'

// Les alternates d'une entrée citent la MÊME VUE dans les autres langues. Des
// alternates pointant sur les accueils annonceraient que /radio et l'accueil
// sont la même page en quatre langues — et Google, plutôt que d'arbitrer,
// écarterait le bloc.
function alternates(view) {
  return [
    ...ALL_LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l, view)}" />`,
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultFor(view)}" />`,
  ].join('\n')
}

export function sitemapFor(siteId, lastmod) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!lastmod) throw new Error('lastmod manquant — attendu meta.json → generatedAt')

  const urls = site.pages
    .flatMap((page) =>
      ALL_VIEWS.map(
        (view) => `  <url>
    <loc>${urlFor(page.lang, view)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>${view === 'home' ? '1.0' : '0.8'}</priority>
${alternates(view)}
  </url>`,
      ),
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}
```

- [ ] **Étape 4 : étendre `npm run check` aux pages de vue**

Dans `scripts/check-build.mjs`, remplacer l'import (ligne 12) et ouvrir une
boucle sur les vues (ligne 18) :

```js
import { SITES, ALL_LANGS, ALL_VIEWS, urlFor, pathFor, primaryLang } from '../sites.config.js'
```

```js
for (const site of Object.values(SITES)) {
  for (const page of site.pages) {
    for (const view of ALL_VIEWS) {
      const rel = path.join('dist', site.id, pathFor(page.lang, view).replace(/^\//, ''), 'index.html')
      // … la lecture du fichier est inchangée …
```

Dans le tableau `checks`, remplacer les trois contrôles qui utilisent `LANG_URL` :

```js
      [
        `canonical ${urlFor(page.lang, view)}`,
        html.includes(`rel="canonical" href="${urlFor(page.lang, view)}" />`),
      ],
      // …
      [
        'les 4 hreflang, réciproques ET de la bonne vue',
        ALL_LANGS.every((l) => html.includes(`hreflang="${l}" href="${urlFor(l, view)}"`)),
      ],
```

Et la ligne de succès (ligne 134) :

```js
      console.log(`✓ ${rel} (${page.lang}, ${view})`)
```

Enfin, le compte attendu du sitemap (ligne 212) :

```js
  const attendu = site.pages.length * ALL_VIEWS.length
```

> **Fermer la boucle `for (const view …)`** avant le bloc des fichiers SEO
> (ligne 139) : l'accolade manquante est l'erreur la plus probable de cette
> étape, et elle se voit immédiatement au lancement.

- [ ] **Étape 5 : vérifier la chaîne complète**

```bash
npm test && npm run build && npm run prerender && npm run check
```

Attendu :
- `npm test` : SUCCÈS, 79 tests
- `npm run check` : `✓ dist/ch/index.html (fr, home)`, `✓ dist/ch/radio/index.html (fr, radio)`,
  les six du `.org`, `✓ dist/ch/sitemap.xml (2 url)`, `✓ dist/org/sitemap.xml (6 url)`,
  puis `✓ toutes les pages sont conformes`

- [ ] **Étape 6 : commit**

```bash
git add scripts/lib/sitemap.mjs scripts/check-build.mjs test/site-meta.test.mjs
git commit -m "seo(sitemap): une entree par langue et par vue, alternates compris"
```

---

### Task 8 : le lien de l'accueil vers `/radio`

Une page sans lien entrant interne ne circule pas. Et **le texte du lien est ce
que Google lit pour décider du sujet de la page visée** — d'où un libellé qui
porte la requête, et non « En savoir plus ».

**Fichiers :**
- Modifier : `src/components/Radio.jsx` (fin de la section, vers la ligne 306)
- Modifier : `src/i18n.jsx` (une clé × 4 langues)

- [ ] **Étape 1 : ajouter la clé**

Dans les quatre blocs `STRINGS` :

```js
    'radio.more': 'Toutes les radios arméniennes en direct',   // fr
    'radio.more': 'All twelve Armenian radio stations',        // en
```

et ses équivalents `hy` / `ru`, **à signaler pour relecture native**.

- [ ] **Étape 2 : poser le lien**

Dans `src/components/Radio.jsx`, avant la fermeture de `</section>` :

```jsx
        {/* Le lien qui dit à Google laquelle des deux pages traite le sujet en
            profondeur. Son TEXTE porte la requête — « En savoir plus » ne dirait
            rien de la page visée. */}
        <p className="section__more">
          <a href={pathFor(lang, 'radio')}>
            {t('radio.more')} <span aria-hidden="true">→</span>
          </a>
        </p>
```

en important `pathFor` depuis `'../../sites.config.js'` et en prenant `lang`
depuis `useI18n()`.

- [ ] **Étape 3 : vérifier**

```bash
npm run lint && npm test && npm run build && npm run prerender && npm run check
```

Attendu : tout passe, 5 avertissements de lint.

Vérifier au navigateur (`npm run dev`) que le lien apparaît sous le lecteur de
l'accueil et mène bien à `/radio`, y compris en 390 px.

- [ ] **Étape 4 : commit**

```bash
git add src/components/Radio.jsx src/i18n.jsx
git commit -m "radio(accueil): le lien vers /radio, avec un texte qui porte la requete"
```

---

### Fin de l'étape 1 — déploiement et relevé

- [ ] Pousser sur `main` (le workflow saute le scrape et déploie).
- [ ] Vérifier en production les quatre URL : `armenieinfo.ch/radio`,
      `armenianews.org/radio`, `/hy/radio`, `/ru/radio`.
- [ ] Search Console, **les deux propriétés** : resoumettre les sitemaps.
- [ ] Tester `armenieinfo.ch/radio` dans l'outil de test des résultats
      enrichis de Google — le `ItemList`/`RadioStation` doit être lu **sans
      erreur** (aucun résultat enrichi n'est attendu, c'est normal).
- [ ] Noter la date de mise en ligne : c'est le point de départ des relevés à
      quatre et huit semaines (§ 11 du spec).

---

# ÉTAPE 2 — La page `/agenda`

À n'entamer qu'une fois l'étape 1 déployée et les quatre `/radio` indexées.

---

### Task 9 : la vue `agenda` dans la configuration

**Fichiers :**
- Modifier : `sites.config.js` (`VIEWS`)
- Modifier : `src/seo.js` (`VIEW_SEO`)
- Modifier : `test/views.test.mjs`

- [ ] **Étape 1 : étendre le test**

Ajouter à `test/views.test.mjs` :

```js
test('le slug de l agenda est traduit la ou le mot change la requete', () => {
  assert.equal(urlFor('fr', 'agenda'), 'https://armenieinfo.ch/agenda')
  assert.equal(urlFor('en', 'agenda'), 'https://armenianews.org/events')
  assert.equal(urlFor('hy', 'agenda'), 'https://armenianews.org/hy/events')
  assert.equal(urlFor('ru', 'agenda'), 'https://armenianews.org/ru/events')
})
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

Lancer : `node --test test/views.test.mjs`
Attendu : ÉCHEC — `vue inconnue : agenda`

- [ ] **Étape 3 : déclarer la vue**

Dans `sites.config.js`, à `VIEWS` :

```js
  // « agenda » en anglais désigne un ordre du jour ou un mobile, pas une liste
  // d'événements : le mot cherché est « events ». C'est la seule vue dont le
  // slug change d'une langue à l'autre, et c'est la raison d'être de la table.
  agenda: { slugs: { fr: 'agenda', en: 'events', hy: 'events', ru: 'events' } },
```

Dans `src/seo.js`, à `VIEW_SEO`, une entrée `agenda` avec ses quatre langues.
Titres : « Agenda arménien : événements en Suisse et dans le monde » (`fr`),
« Armenian events worldwide » (`en`), et leurs équivalents `hy` / `ru`,
**à signaler pour relecture native**.

- [ ] **Étape 4 : vérifier**

```bash
npm test && npm run build && npm run prerender && npm run check
```

Attendu : 12 pages bâties et cuites, sitemaps à 3 et 9 entrées.
**Les quatre pages `/agenda` rendent encore l'accueil** — `App.jsx` ne connaît
pas la vue : c'est la tâche suivante. Ne pas déployer entre les deux.

- [ ] **Étape 5 : commit**

```bash
git add sites.config.js src/seo.js test/views.test.mjs
git commit -m "seo(vues): la vue agenda, avec son slug traduit"
```

---

### Task 10 : la page `/agenda`

**Fichiers :**
- Créer : `src/components/AgendaPage.jsx`
- Modifier : `src/App.jsx` (brancher la vue)
- Modifier : `src/i18n.jsx`, `src/styles/global.css`

**Interfaces :**
- Consomme : `agenda.json`, `worldCountryKey`, `countryLabel`, `countryFlag`
  (`src/worldPlace.js`), les formateurs de `useI18n()`
- Produit : `AgendaPage` (seul export du fichier)

- [ ] **Étape 1 : les chaînes i18n**

Clés `agenda.page.h1`, `agenda.page.intro`, `agenda.page.count`,
`agenda.page.home`, dans les quatre blocs `STRINGS`. L'introduction dit **la
fabrication** : la source, le nombre de pays, la mise à jour horaire, le fait que
les événements passés disparaissent d'eux-mêmes.

- [ ] **Étape 2 : le composant**

```jsx
import { useMemo } from 'react'
import { useI18n } from '../i18n.jsx'
import { pathFor } from '../../sites.config.js'
import { worldCountryKey, countryLabel, countryFlag } from '../worldPlace.js'
import agenda from '../data/agenda.json'

// La vue /agenda : la liste COMPLÈTE, groupée par pays, là où l'accueil ne
// montre qu'un pays à la fois dans un carrousel. C'est cette différence qui
// évite le doublon entre les deux pages — avec l'introduction, que l'accueil
// n'a pas, et le canonical propre à chacune.
export function AgendaPage() {
  const { t, lang, formatDate } = useI18n()

  const parPays = useMemo(() => {
    const tous = [...(agenda.switzerland || []), ...(agenda.world || [])]
    // Dédoublonnage par URL : le même événement est recensé sur plusieurs pages
    // pays chez armenopole. Puis on écarte le passé — une liste d'événements
    // révolus est une page sans valeur, et son balisage serait fautif.
    const vus = new Set()
    const maintenant = Date.now()
    const frais = tous.filter((ev) => {
      if (vus.has(ev.url) || new Date(ev.date).getTime() < maintenant) return false
      vus.add(ev.url)
      return true
    })
    const groupes = new Map()
    for (const ev of frais) {
      const cle = worldCountryKey(ev)
      if (!groupes.has(cle)) groupes.set(cle, [])
      groupes.get(cle).push(ev)
    }
    return [...groupes.entries()].sort((a, b) =>
      countryLabel(a[0], lang).localeCompare(countryLabel(b[0], lang), lang),
    )
  }, [lang])

  return (
    <main className="viewpage">
      <div className="container">
        <h1 className="viewpage__title">{t('agenda.page.h1')}</h1>
        <p className="viewpage__intro">{t('agenda.page.intro')}</p>
      </div>

      {parPays.map(([cle, evs]) => (
        <section className="section" id={cle} key={cle}>
          <div className="container">
            <h2 className="section__title">
              <span aria-hidden="true">{countryFlag(cle)}</span> {countryLabel(cle, lang)}
            </h2>
            <ul className="agenda-list">
              {evs.map((ev) => (
                <li key={ev.url}>
                  {/* Toute date passe par les formateurs du contexte : Intl ne
                      résout pas hy-AM dans un navigateur. `formatDate` prend la
                      chaîne ISO telle quelle — PAS un objet Date (voir sa
                      signature dans i18n.jsx : `formatDate = (iso) => …`). */}
                  <time dateTime={ev.date}>{formatDate(ev.date)}</time>
                  <h3><a href={ev.url} rel="noopener noreferrer">{ev.title}</a></h3>
                  <p className="agenda-list__where">{ev.location}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <div className="container">
        <p className="viewpage__back">
          <a href={pathFor(lang, 'home')}>{t('agenda.page.home')}</a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Étape 3 : brancher la vue dans `App.jsx`**

```jsx
      {view === 'radio' ? (
        <RadioPage />
      ) : view === 'agenda' ? (
        <AgendaPage />
      ) : (
        <>{/* … l'accueil, inchangé … */}</>
      )}
```

- [ ] **Étape 4 : vérifier**

```bash
npm run lint && npm test && npm run build && npm run prerender && npm run check
```

Attendu : `✓ 12 pages prérendues`, 5 avertissements de lint.

Contrôler que `dist/ch/agenda/index.html` porte bien son propre `H1` et non
celui de l'accueil (même commande qu'à la Task 6, étape 4).

**Vérifier le rendu mobile en iframe 390 px** : c'est la page longue du site.

- [ ] **Étape 5 : commit**

```bash
git add src/components/AgendaPage.jsx src/App.jsx src/i18n.jsx src/styles/global.css
git commit -m "agenda(page): la liste complete, groupee par pays"
```

---

### Task 11 : le balisage `Event`

C'est **le seul balisage de ce projet qui produise un résultat enrichi visible**
dans Google. Deux règles y sont non négociables : seuls les événements **à
venir** sont balisés, et le lieu se limite à **ce que la donnée contient
réellement**.

**Fichiers :**
- Modifier : `src/jsonld.js`
- Modifier : `src/components/AgendaPage.jsx`
- Créer : `test/jsonld.test.mjs`

- [ ] **Étape 1 : écrire le test qui échoue**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agendaJsonLd } from '../src/jsonld.js'

const EVS = [
  { title: 'Soirée', url: 'https://ex.org/a', location: 'Genève', date: '2099-01-01T19:00:00.000Z' },
  { title: 'Passé', url: 'https://ex.org/b', location: 'Lyon', date: '2000-01-01T19:00:00.000Z' },
]

test('seuls les evenements a venir sont balises', () => {
  const bloc = JSON.parse(agendaJsonLd('fr', EVS))
  const noms = bloc.itemListElement.map((i) => i.item.name)
  assert.deepEqual(noms, ['Soirée'])
})

// Baliser une adresse que la donnee ne contient pas serait inventer un fait.
// Search Console signalera l'adresse manquante en AVERTISSEMENT non bloquant :
// c'est le comportement correct, pas un defaut a corriger.
test('le lieu se limite au texte reel, sans adresse inventee', () => {
  const item = JSON.parse(agendaJsonLd('fr', EVS)).itemListElement[0].item
  assert.equal(item.location['@type'], 'Place')
  assert.equal(item.location.name, 'Genève')
  assert.ok(!('address' in item.location), 'aucune adresse ne doit etre inventee')
})

test('aucune chaine ne peut fermer le script', () => {
  const out = agendaJsonLd('fr', [
    { title: '</script><script>x', url: 'https://ex.org/c', location: 'X', date: '2099-01-01T00:00:00.000Z' },
  ])
  assert.ok(!out.includes('</script'), 'le « < » doit etre echappe')
})
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

Lancer : `node --test test/jsonld.test.mjs`
Attendu : ÉCHEC — pas d'export `agendaJsonLd`

- [ ] **Étape 3 : écrire le balisage**

Dans `src/jsonld.js` :

```js
// Le SEUL balisage de ce projet qui produise un résultat enrichi visible dans
// Google (les fiches d'événements avec date et lieu). D'où deux règles strictes :
//
//   1. SEULS LES ÉVÉNEMENTS À VENIR. Baliser un événement passé comme à venir
//      enfreint les règles de Google et expose la page à une action manuelle.
//   2. LE LIEU SE LIMITE À LA DONNÉE. agenda.json ne porte qu'un `location`
//      textuel (« Genève », « Uruguay ») — jamais d'adresse. On émet donc un
//      Place nommé, sans `address`. Search Console le signalera en avertissement
//      NON BLOQUANT : c'est le comportement correct.
export function agendaJsonLd(lang, evenements, maintenant = Date.now()) {
  const avenir = evenements.filter((ev) => new Date(ev.date).getTime() >= maintenant)
  return safe({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: avenir.length,
    itemListElement: avenir.map((ev, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: ev.title,
        startDate: ev.date,
        url: ev.url,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: ev.location },
        ...(ev.image ? { image: ev.image } : {}),
      },
    })),
  })
}
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

Lancer : `node --test test/jsonld.test.mjs`
Attendu : SUCCÈS, 3 tests

- [ ] **Étape 5 : poser le bloc dans la page**

Dans `AgendaPage.jsx`, avant la fermeture de `</main>`, en réutilisant la liste
**déjà dédoublonnée et filtrée** du `useMemo` :

```jsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: agendaJsonLd(lang, parPays.flatMap(([, e]) => e)) }}
      />
```

- [ ] **Étape 6 : vérifier**

```bash
npm run lint && npm test && npm run build && npm run prerender && npm run check
```

Attendu : SUCCÈS, 5 avertissements de lint.

- [ ] **Étape 7 : commit**

```bash
git add src/jsonld.js src/components/AgendaPage.jsx test/jsonld.test.mjs
git commit -m "agenda(balisage): Event, a venir seulement, sans adresse inventee"
```

---

### Task 12 : le lien de l'accueil vers `/agenda`

Identique à la Task 8, sur l'autre section.

**Fichiers :**
- Modifier : `src/components/Agenda.jsx` (avant la fermeture de `</section>`, vers la ligne 170)
- Modifier : `src/i18n.jsx`

- [ ] **Étape 1 : la clé, dans les quatre langues**

```js
    'agenda.more': 'Tout l’agenda arménien, pays par pays',   // fr
    'agenda.more': 'The full Armenian events calendar',        // en
```

`hy` et `ru` **à signaler pour relecture native**.

- [ ] **Étape 2 : le lien**

```jsx
        <p className="section__more">
          <a href={pathFor(lang, 'agenda')}>
            {t('agenda.more')} <span aria-hidden="true">→</span>
          </a>
        </p>
```

- [ ] **Étape 3 : vérifier**

```bash
npm run lint && npm test && npm run build && npm run prerender && npm run check
```

- [ ] **Étape 4 : commit**

```bash
git add src/components/Agenda.jsx src/i18n.jsx
git commit -m "agenda(accueil): le lien vers /agenda, avec un texte qui porte la requete"
```

---

### Task 13 : la documentation

Le `CLAUDE.md` de ce dépôt est sa mémoire. Une dimension nouvelle qui n'y figure
pas sera défaite par la prochaine tâche qui touchera au build.

**Fichiers :**
- Modifier : `CLAUDE.md`
- Modifier : `README.md`

- [ ] **Étape 1 : écrire les trois entrées**

Dans `CLAUDE.md`, section « Architecture », ajouter **les vues** : une page est
un triplet, la table des slugs vit dans `sites.config.js`, les slugs sont latins
et traduits là où le mot change la requête.

Dans « À savoir », ajouter **le piège des `hreflang` par vue** — rédigé comme les
autres pièges du fichier : ce qui arrive, pourquoi c'est silencieux, ce qui le
garde (`test/views.test.mjs`, `test/site-meta.test.mjs`).

Ajouter aussi **la règle de sourçage des stations** et le test qui la garde.

Mettre à jour le nombre de tests annoncé (« 52 tests » y est déjà périmé : la
suite en compte 61 avant ce chantier).

- [ ] **Étape 2 : commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: les vues, le piege des hreflang, la regle de sourcage"
```

---

## Auto-revue du plan

**1. Couverture du spec.**

| Section du spec | Tâche |
|---|---|
| § 4 architecture des URL | 1 |
| § 4 `hreflang` par vue (piège central) | 2, 7 |
| § 4 fichiers touchés | 1, 2, 3, 6, 7 |
| § 5 page `/radio`, structure | 5 |
| § 5 règle de sourçage | 4 |
| § 6 page `/agenda`, liste complète | 10 |
| § 6 données structurées `Event` | 11 |
| § 6 `RadioStation` | 5 |
| § 7 nav absolue | 3 |
| § 7 liens de l'accueil, texte d'ancre | 8, 12 |
| § 8 `H1` de l'accueil inchangé | aucune modification — vérifié Task 6, étape 4 |
| § 8 `keywords` documentée comme inerte | **manquante → ajoutée à la Task 2, étape 3** |
| § 10 les quatre tests | 1 (unicité, slugs), 2 (réciprocité), 7 (sitemap, `check`) |
| § 11 mesure | fin d'étape 1 |
| § 12 séquencement | étapes 1 et 2 |

**Correction appliquée** : le commentaire d'inertie sur `keywords` (§ 8 du spec)
n'était rattaché à aucune tâche. Il rejoint la Task 2, étape 3, qui touche déjà
`src/seo.js` :

```js
// `keywords` N'A AUCUN EFFET SUR LE CLASSEMENT. Google l'a abandonnée en 2009,
// Bing la traite au mieux comme du bruit, Yandex l'ignore. Elle est conservée
// parce que la retirer ne gagnerait rien et ferait bouger le générateur de méta
// et ses tests pour zéro effet — mais ce n'est PAS un levier. Les mots-clés se
// gagnent par les pages de vue (VIEW_SEO ci-dessous) et leur contenu.
```

**2. Placeholders.** Aucun « TBD », « TODO », « gérer les cas limites », ni
« comme la Task N » sans le code. Les deux endroits où le contenu ne peut pas
être écrit d'avance sont **encadrés par une règle testable** plutôt que laissés
en suspens : les faits des stations (Task 4, gardés par `test/stations.test.mjs`)
et les traductions `hy` / `ru` (signalées nommément pour relecture, exigence du
spec § 3).

**3. Cohérence des types.** `urlFor(lang, view)` et `pathFor(lang, view)` — même
ordre d'arguments partout. `viewFromPath(siteId, pathname)` prend le site en
premier, comme `langFromPath` dont elle est la jumelle. `headFor`, `applyMeta` et
`replaceMeta` reçoivent tous `{ siteId, lang, view }`, `view` valant `'home'` par
défaut — ce qui garde les appels existants valides. `radioJsonLd(lang, t)` et
`agendaJsonLd(lang, evenements, maintenant?)` diffèrent parce que le premier lit
un module et le second reçoit sa donnée : c'est ce qui rend le second testable
sans réseau ni horloge.

**Une dépendance circulaire est signalée en Task 3** : `App.jsx` importe
`RadioPage.jsx`, créé en Task 5. La consigne est de créer l'ébauche
`export function RadioPage() { return null }` en Task 3, pour que chaque commit
reste vert.

**Deux erreurs corrigées en relisant le code source** — les deux étaient du type
que cette passe existe pour attraper :

- `formatDate` prend une **chaîne ISO**, pas un objet `Date`
  (`src/i18n.jsx:739`). La Task 10 écrivait `formatDate(new Date(ev.date))`, ce
  qui aurait rendu la chaîne brute (`Number.isNaN` sur un `Date` passé à
  `new Date()` ne déclenche pas, mais le contrat du formateur est l'ISO).
  Corrigé en `formatDate(ev.date)`.
- `test/radio-count.test.mjs` **n'a pas de liste de clés à compléter** : il teste
  chaque famille de textes séparément, avec la table `NOMBRES` et `ATTENDU`. La
  Task 5 demandait d'éditer une liste inexistante ; elle donne maintenant le
  code du test à ajouter.

---

## Reste hors périmètre

- **Le sélecteur de langue reste sur les accueils.** Depuis `/hy/radio`,
  cliquer « FR » mène à l'accueil français, pas à `/radio`. Le rendre conscient
  de la vue est un raffinement ; il demande de propager `view` jusqu'à `Nav` pour
  le bloc `.lang` et de vérifier que le maillage réciproque entre domaines reste
  cohérent.
- **La réécriture attrape-tout de Firebase** (`** → /index.html`) fait répondre
  200 à toute URL inexistante, avec l'accueil pour contenu. C'est une surface de
  soft-404 antérieure à ce chantier, et `viewFromPath` s'y conforme en retombant
  sur `home`. La traiter demanderait une page 404 propre et un
  `cleanUrls`/`trailingSlash` explicites.
- **Les pages par pays et par station**, écartées au § 9 du spec. À reconsidérer
  si `/agenda` et `/radio` captent du trafic.
