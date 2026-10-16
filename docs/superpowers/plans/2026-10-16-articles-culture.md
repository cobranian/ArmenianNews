# Articles « Culture » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publier chaque semaine un article original sur la culture arménienne, rédigé par Gemini depuis Wikipédia/Wikidata, relu en français dans une PR GitHub, traduit en en/hy/ru sur étiquette, et servi en pages statiques `/culture/` sur les deux vitrines.

**Architecture:** Trois CLI Node (`culture-draft`, `culture-translate`, `culture-check`) pilotées par trois workflows GitHub Actions ; des modules purs dans `scripts/lib/culture-*.mjs` (Markdown restreint, validation, choix du sujet, recouvrement, licences, prompts) ; des pages HTML statiques écrites au build par `culture-pages.mjs`, sur le modèle exact de `brief-pages.mjs` (même coquille, même `<head>` via `site-meta.mjs`, même sitemap). Le modèle est appelé via un point d'accès compatible OpenAI configurable.

**Tech Stack:** Node 24 (ESM, `node --test`), Vite 6 + React 18 (un seul composant ajouté), `sharp` (déjà en devDependency), API Wikimedia (MediaWiki Action API, Wikidata EntityData), Gemini via `https://generativelanguage.googleapis.com/v1beta/openai/`, GitHub Actions + `gh`.

**Spec:** `docs/superpowers/specs/2026-10-16-articles-culture-design.md`

## Global Constraints

- Langue de référence relue : `fr` ; traduites : `en`, `hy`, `ru` (`ALL_LANGS` de `sites.config.js`).
- Section : « Culture » / *Culture* / *Մշակույթ* / *Культура* ; slug `culture/` dans les quatre langues, **slash final obligatoire**.
- Slug d'article : `^[a-z0-9]+(?:-[a-z0-9]+)*$`, identique dans les quatre langues.
- Article : 700 à 1 000 mots ; `description` ≤ 160 caractères.
- Fenêtre agenda : **21 jours**. Seuil de recouvrement : **15 %** de 8-grammes.
- Licences d'image acceptées : domaine public, CC0, CC BY, CC BY-SA (toutes versions) ; refus de NC, ND et de tout le reste.
- Carte de partage : JPEG **1200×630**, sRGB, **sans profil ICC**.
- User-Agent Wikimedia : `ArmenieInfo/1.0 (https://armenieinfo.ch/a-propos/; contact@armenieinfo.ch)` — jamais un UA de navigateur.
- Modèle par défaut : `ARTICLES_BASE_URL` = `https://generativelanguage.googleapis.com/v1beta/openai/`, `ARTICLES_MODEL` = `gemini-flash-latest`, clé `GEMINI_API_KEY` (ou `ARTICLES_API_KEY`). La clé n'est **jamais** écrite dans un log.
- Le modèle ne fournit **jamais** d'URL publiée : liens et sources viennent du code (leçon de la brève).
- `sujets.json` : `status` ∈ `pending | published | rejected`.
- Workflows `articles*.yml` : jamais de secret Firebase ; jamais de `${{ }}` d'origine non fiable (titre, corps de PR, nom de branche) interpolé dans un `run:` — toujours via `env:`.
- `global.css` : chaque `font-family: var(--font-X)` est **immédiatement** suivie de `font-size-adjust: var(--fsa-X)` (display→display, body→body, mono→util).
- Le build ne casse **jamais** à cause d'un article : un article invalide est ignoré avec un avertissement. Seul `culture:check` est strict.
- Lint : reste à **0 erreur, 5 avertissements**.

### Écarts assumés par rapport à la spec

1. **La fusion n'est pas bloquée techniquement.** Le statut `culture-check` rouge est visible sur la PR, mais l'imposer exige une protection de branche « status requis » sur `main`, qui bloquerait aussi les pushes horaires du robot. Le statut est donc un signal, pas un verrou ; c'est dit dans la description de chaque PR.
2. **Le choix de l'image se fait par `imageChoice`** (0, 1, 2) dans `meta.json` — une ligne à changer sur mobile — et `meta.image` en est dérivé par le job de traduction, qui retélécharge l'image. Un `imageChoice` changé après la traduction est signalé « reposez l'étiquette ».
3. **Le bloc « À lire » de l'accueil est textuel** (titre + description), sans vignette : les images ne sont copiées dans `dist/` qu'au build, donc absentes en `npm run dev`.
4. **`agendaEvent` est un objet** `{ title, url, date, location }`, pas une URL seule : la page doit afficher le titre et la date, et ne montrer le bloc que si l'événement est encore à venir.
5. **L'image vit une fois par vitrine**, à `/culture/<slug>/image.{webp,jpg}`, partagée par `/hy/` et `/ru/`.
6. **Pas de lien « radio » en conclusion** : la nav de chaque page culture lie déjà la radio.
7. **Une mention de transparence IA** figure sous chaque article (`aiNote`) : rédigé avec un outil d'IA et vérifié ; traduit automatiquement pour en/hy/ru.

## Review Focus

1. **Front-matter cassé par une édition à la main** (deux-points dans un titre non cité, guillemet non fermé, ligne `---` supprimée) → message lisible de `culture:check`, et au build l'article est ignoré sans casser le déploiement. *Test : Task 2 et Task 4.*
2. **Sujet `pending` dont le dossier existe déjà** (statut remis à la main, ou PR fusionnée avant la mise à jour du statut) → le brouillon ne réécrit jamais un article publié. *Test : Task 5 (`availableTopics` exclut les dossiers existants).*
3. **Réponse du modèle enrobée** (clôture ```json, texte autour, HTML ou `<script>` dans le corps, lien `javascript:` ou `//hôte`) → JSON extrait, HTML neutralisé, lien refusé. *Test : Task 2 et Task 10.*
4. **Texte arménien ou russe** dans le recouvrement et la vérification des faits → les lettres non latines comptent comme des mots, aucun faux 0 %. *Test : Task 3 et Task 10.*
5. **Métadonnées Commons sales** (auteur en HTML avec entités, auteur absent, licence NC, image trop petite) → candidate écartée ou auteur nettoyé. *Test : Task 11.*

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `sites.config.js` (modif.) | `CULTURE_SLUGS`, `CULTURE_SLUG`, `cultureUrl`, `culturePath`, `cultureImagePath` |
| `src/cultureStrings.js` | Chaînes de la section, 4 langues (module plat lu par Node et le bundle) |
| `scripts/lib/culture-markdown.mjs` | Front-matter, Markdown restreint, empreinte du corps |
| `scripts/lib/culture-license.mjs` | `isFreeLicense` |
| `scripts/lib/culture-overlap.mjs` | 8-grammes et taux de recouvrement |
| `scripts/lib/culture-validate.mjs` | `validateArticle`, `chosenImage`, `factsChecked` |
| `scripts/lib/culture-load.mjs` | Lecture disque : `readArticle`, `articleSlugs`, `loadCulture` |
| `scripts/lib/culture-links.mjs` | `cultureLangsBySlug`, `cultureAlternates`, `teaserFor` (sans `fs`) |
| `scripts/lib/culture-topic.mjs` | Choix du sujet, statuts, validation de `sujets.json` |
| `src/data/culture/sujets.json` | Liste de sujets curée |
| `scripts/lib/site-meta.mjs` (modif.) | `composeHead({ ogImage })`, `cultureHeadFor` |
| `scripts/lib/static-shell.mjs` | Coquille HTML commune brève/culture (extraite de `brief-pages.mjs`) |
| `scripts/lib/culture-pages.mjs` | Pages index/article, copie des images |
| `scripts/lib/sitemap.mjs`, `scripts/build-sites.mjs`, `scripts/check-build.mjs` (modif.) | Intégration build |
| `src/components/{Nav,Footer}.jsx`, `scripts/lib/not-found.mjs` (modif.) | Liens entrants |
| `src/components/CultureTeaser.jsx`, `vite.config.js`, `src/App.jsx` (modif.) | Bloc « À lire » |
| `src/styles/global.css` (modif.) | Bloc `/* === Culture` |
| `scripts/lib/culture-llm.mjs` | Client compatible OpenAI |
| `scripts/lib/culture-prompts.mjs` | Messages, analyse des réponses, faits introuvables |
| `scripts/lib/culture-sources.mjs` | Wikipédia, Wikidata, Commons, téléchargement |
| `scripts/lib/culture-image.mjs` | WebP de page + JPEG 1200×630 |
| `scripts/lib/culture-pr.mjs` | Corps de PR et d'issue |
| `scripts/culture-{draft,translate,check,status}.mjs` | CLI |
| `.github/workflows/articles{,-translate,-check,-closed}.yml` | Automatisation |

---

### Task 1 : URL et chaînes de la section

**Files:**
- Modify: `sites.config.js` (après `briefPath`, vers la ligne 271)
- Create: `src/cultureStrings.js`
- Test: `test/culture-urls.test.mjs`

**Interfaces:**
- Produces: `CULTURE_SLUGS`, `CULTURE_SLUG` (RegExp), `cultureUrl(lang, slug = null) → string`, `culturePath(lang, slug = null) → string`, `cultureImagePath(slug, ext: 'webp'|'jpg') → string`, `CULTURE_STRINGS[lang]` avec les clés `nav, title, description, sources, sourcesNote, aiNote, image, readAlso, event, empty, teaser, all`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-urls.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_LANGS, cultureUrl, culturePath, cultureImagePath, CULTURE_SLUGS } from '../sites.config.js'
import { CULTURE_STRINGS } from '../src/cultureStrings.js'

test('cultureUrl : index et article, slash final, par vitrine', () => {
  assert.equal(cultureUrl('fr'), 'https://armenieinfo.ch/culture/')
  assert.equal(cultureUrl('en', 'komitas'), 'https://armenianews.org/culture/komitas/')
  assert.equal(cultureUrl('hy', 'komitas'), 'https://armenianews.org/hy/culture/komitas/')
  assert.equal(culturePath('ru', 'komitas'), '/ru/culture/komitas/')
  assert.equal(culturePath('en'), '/culture/')
  for (const l of ALL_LANGS) assert.ok(cultureUrl(l, 'a-b1').endsWith('/'))
})

test('cultureUrl refuse un slug ou une langue invalides', () => {
  for (const bad of ['Komitas', 'a/b', '../x', 'a--b', '-a', 'é']) assert.throws(() => cultureUrl('fr', bad), bad)
  assert.throws(() => cultureUrl('de'))
})

test('cultureImagePath', () => {
  assert.equal(cultureImagePath('komitas', 'jpg'), '/culture/komitas/image.jpg')
  assert.equal(cultureImagePath('komitas', 'webp'), '/culture/komitas/image.webp')
  assert.throws(() => cultureImagePath('komitas', 'png'))
  assert.throws(() => cultureImagePath('../x', 'jpg'))
})

test('CULTURE_SLUGS couvre les quatre langues', () => {
  assert.deepEqual(Object.keys(CULTURE_SLUGS).sort(), [...ALL_LANGS].sort())
})

test('CULTURE_STRINGS : mêmes clés, non vides, dans les quatre langues', () => {
  const keys = Object.keys(CULTURE_STRINGS.fr).sort()
  for (const l of ALL_LANGS) {
    assert.deepEqual(Object.keys(CULTURE_STRINGS[l]).sort(), keys, l)
    for (const k of keys) assert.ok(CULTURE_STRINGS[l][k].trim(), `${l}.${k}`)
  }
  assert.equal(CULTURE_STRINGS.fr.nav, 'Culture')
  assert.equal(CULTURE_STRINGS.hy.nav, 'Մշակույթ')
  assert.equal(CULTURE_STRINGS.ru.nav, 'Культура')
})
```

- [ ] **Step 2 : lancer le test et constater l'échec**

Run: `node --test test/culture-urls.test.mjs`
Expected: FAIL — `cultureUrl` n'est pas exporté.

- [ ] **Step 3 : implémenter**

Dans `sites.config.js`, juste après la fonction `briefPath` :

```js
// Les articles « Culture » (scripts/lib/culture-pages.mjs). Pas une vue, comme
// la brève : des HTML statiques écrits au build. Même slug latin dans les
// quatre langues (« culture » ne change pas la requête), et SLASH FINAL, pour
// la même raison que VIEWS et BRIEF_SLUGS. Le slug d'article est commun aux
// quatre langues : les hreflang d'un article ne diffèrent que par le préfixe.
export const CULTURE_SLUGS = { fr: 'culture/', en: 'culture/', hy: 'culture/', ru: 'culture/' }
export const CULTURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function cultureUrl(lang, slug = null) {
  const base = CULTURE_SLUGS[lang]
  if (!base) throw new Error(`pas de section Culture en ${lang}`)
  if (slug !== null && !CULTURE_SLUG.test(slug)) throw new Error(`slug d'article invalide : ${slug}`)
  return LANG_URL[lang] + base + (slug ? `${slug}/` : '')
}

export function culturePath(lang, slug = null) {
  return cultureUrl(lang, slug).slice(SITES[siteOf(lang)].host.length)
}

// L'image d'un article vit UNE fois par vitrine, sous la section de sa langue
// de tête (/culture/<slug>/), et sert aussi /hy/ et /ru/.
export function cultureImagePath(slug, ext) {
  if (!CULTURE_SLUG.test(slug)) throw new Error(`slug d'article invalide : ${slug}`)
  if (ext !== 'webp' && ext !== 'jpg') throw new Error(`extension d'image invalide : ${ext}`)
  return `/culture/${slug}/image.${ext}`
}
```

Créer `src/cultureStrings.js` :

```js
// Les chaînes de la section Culture, par langue.
//
// Module JS PLAT, lu par Node (culture-pages.mjs, site-meta.mjs, not-found.mjs)
// ET par le bundle (Nav.jsx, Footer.jsx, CultureTeaser.jsx) — même raison que
// src/briefStrings.js. Les textes hy et ru sont à faire relire une fois par un
// lecteur de la langue (voir la spec).
export const CULTURE_STRINGS = {
  fr: {
    nav: 'Culture',
    title: 'Culture arménienne',
    description:
      'Histoire, musique, danse et patrimoine arméniens : des articles de fond, sourcés, en quatre langues.',
    sources: 'Sources',
    sourcesNote: 'Textes de Wikipédia sous licence CC BY-SA 4.0, utilisés comme sources.',
    aiNote:
      'Article rédigé avec un outil d’IA à partir des sources citées, puis vérifié et corrigé par la rédaction.',
    image: 'Image',
    readAlso: 'À lire aussi',
    event: 'À ne pas manquer',
    empty: 'Le premier article paraîtra bientôt.',
    teaser: 'À lire',
    all: 'Tous les articles',
  },
  en: {
    nav: 'Culture',
    title: 'Armenian culture',
    description:
      'Armenian history, music, dance and heritage: in-depth, sourced articles in four languages.',
    sources: 'Sources',
    sourcesNote: 'Wikipedia texts under the CC BY-SA 4.0 licence, used as sources.',
    aiNote:
      'Written with an AI tool from the sources cited and checked by our editors; translated automatically from the reviewed French text.',
    image: 'Image',
    readAlso: 'Read next',
    event: 'Don’t miss',
    empty: 'The first article is coming soon.',
    teaser: 'Read',
    all: 'All articles',
  },
  hy: {
    nav: 'Մշակույթ',
    title: 'Հայկական մշակույթ',
    description:
      'Հայոց պատմություն, երաժշտություն, պար և ժառանգություն․ աղբյուրներով հոդվածներ՝ չորս լեզվով։',
    sources: 'Աղբյուրներ',
    sourcesNote: 'Վիքիպեդիայի տեքստերը՝ CC BY-SA 4.0 արտոնագրով, օգտագործված որպես աղբյուր։',
    aiNote:
      'Հոդվածը գրվել է արհեստական բանականության գործիքով՝ նշված աղբյուրներից, ստուգվել է խմբագրության կողմից և ավտոմատ թարգմանվել ֆրանսերենից։',
    image: 'Պատկեր',
    readAlso: 'Կարդացեք նաև',
    event: 'Չբաց թողնեք',
    empty: 'Առաջին հոդվածը շուտով կհրապարակվի։',
    teaser: 'Կարդալու',
    all: 'Բոլոր հոդվածները',
  },
  ru: {
    nav: 'Культура',
    title: 'Армянская культура',
    description:
      'История, музыка, танец и наследие Армении: подробные статьи с источниками на четырёх языках.',
    sources: 'Источники',
    sourcesNote: 'Тексты Википедии по лицензии CC BY-SA 4.0, использованные как источники.',
    aiNote:
      'Статья написана с помощью инструмента ИИ по указанным источникам, проверена редакцией и автоматически переведена с французского.',
    image: 'Изображение',
    readAlso: 'Читайте также',
    event: 'Не пропустите',
    empty: 'Первая статья скоро появится.',
    teaser: 'Читать',
    all: 'Все статьи',
  },
}
```

- [ ] **Step 4 : lancer le test et constater la réussite**

Run: `node --test test/culture-urls.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5 : commit**

```bash
git add sites.config.js src/cultureStrings.js test/culture-urls.test.mjs
git commit -m "Culture : URL de la section et chaînes en quatre langues"
```

---

### Task 2 : front-matter, Markdown restreint, empreinte

**Files:**
- Create: `scripts/lib/culture-markdown.mjs`
- Test: `test/culture-markdown.test.mjs`

**Interfaces:**
- Produces: `parseFrontMatter(text) → { data: Record<string,string>, body: string }` (lève si absent ou illisible), `serializeFrontMatter(data, body) → string`, `renderMarkdown(md) → string` (HTML), `bodyHash(body) → string` (16 hexa), `esc(s) → string`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-markdown.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFrontMatter, serializeFrontMatter, renderMarkdown, bodyHash,
} from '../scripts/lib/culture-markdown.mjs'

test('aller-retour du front-matter, guillemets et deux-points compris', () => {
  const data = { title: 'Komitas : le "père" de la musique', description: 'a: b', date: '2026-10-19' }
  const text = serializeFrontMatter(data, 'Corps.\n\n## Titre')
  const back = parseFrontMatter(text)
  assert.deepEqual(back.data, data)
  assert.equal(back.body, 'Corps.\n\n## Titre')
})

test('front-matter édité à la main : valeur non citée avec deux-points, BOM, CRLF', () => {
  const t = '﻿---\r\ntitle: Komitas : le père\r\ndate: 2026-10-19\r\n---\r\n\r\nLigne 1\r\nLigne 2\r\n'
  const { data, body } = parseFrontMatter(t)
  assert.equal(data.title, 'Komitas : le père')
  assert.equal(body, 'Ligne 1\nLigne 2')
})

test('front-matter cassé : message lisible', () => {
  assert.throws(() => parseFrontMatter('title: x\n\ncorps'), /front-matter absent/)
  assert.throws(() => parseFrontMatter('---\ntitle x\n---\ncorps'), /illisible/)
  assert.throws(() => parseFrontMatter('---\ntitle: "x\n---\ncorps'), /illisible/)
})

test('renderMarkdown : intertitres, paragraphes, gras, italique', () => {
  const html = renderMarkdown('# Grand\n\n## Deux\n\n### Trois\n\nUn **gras** et *italique*\nsur deux lignes.')
  assert.equal(
    html,
    '<h2>Grand</h2>\n<h2>Deux</h2>\n<h3>Trois</h3>\n<p>Un <strong>gras</strong> et <em>italique</em> sur deux lignes.</p>',
  )
})

test('renderMarkdown neutralise le HTML et les liens dangereux', () => {
  const html = renderMarkdown('<script>alert(1)</script> [a](javascript:alert(1)) [b](//evil.com) [c](http://x.am)')
  assert.ok(!html.includes('<script'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!/href="javascript:/.test(html))
  assert.ok(!/href="\/\/evil/.test(html))
  assert.ok(!/href="http:/.test(html))
})

test('renderMarkdown garde les liens https et internes', () => {
  const html = renderMarkdown('[Wiki](https://fr.wikipedia.org/wiki/A?x=1&y=2) et [agenda](/agenda/)')
  assert.ok(html.includes('<a href="https://fr.wikipedia.org/wiki/A?x=1&amp;y=2" rel="noopener">Wiki</a>'))
  assert.ok(html.includes('<a href="/agenda/">agenda</a>'))
})

test('bodyHash : stable malgré CRLF et espaces de bord, sensible au texte', () => {
  assert.equal(bodyHash('a\r\nb\n'), bodyHash('  a\nb'))
  assert.notEqual(bodyHash('a b'), bodyHash('a c'))
  assert.match(bodyHash('x'), /^[0-9a-f]{16}$/)
})
```

- [ ] **Step 2 : lancer le test et constater l'échec**

Run: `node --test test/culture-markdown.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : implémenter**

```js
// scripts/lib/culture-markdown.mjs
//
// Le format des articles Culture : un front-matter « clé: valeur » et un
// Markdown VOLONTAIREMENT restreint (paragraphes, ##/###, gras, italique,
// liens https ou internes). Pas de dépendance, et surtout : tout HTML écrit
// dans le texte est échappé. Un texte collé dans une PR, ou une réponse de
// modèle qui glisse un <script>, ne peut rien injecter dans la page.
import { createHash } from 'node:crypto'

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/

export function parseFrontMatter(text) {
  const m = String(text ?? '').replace(/^﻿/, '').match(FM)
  if (!m) throw new Error('front-matter absent (le fichier doit commencer par ---)')
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue
    const i = line.indexOf(':')
    if (i <= 0) throw new Error(`ligne de front-matter illisible : « ${line} »`)
    let v = line.slice(i + 1).trim()
    if (v.startsWith('"')) {
      try {
        v = JSON.parse(v)
      } catch {
        throw new Error(`ligne de front-matter illisible (guillemets) : « ${line} »`)
      }
    }
    data[line.slice(0, i).trim()] = String(v)
  }
  return { data, body: (m[2] ?? '').replace(/\r\n/g, '\n').trim() }
}

export function serializeFrontMatter(data, body) {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`)
  return `---\n${lines.join('\n')}\n---\n\n${String(body).replace(/\r\n/g, '\n').trim()}\n`
}

// Liens : https:// ou chemin interne (« / » non suivi d'un second « / », qui
// serait une URL protocole-relative vers un autre hôte).
const LINK = /\[([^\]\n]+)\]\((https:\/\/[^)\s]+|\/(?!\/)[^)\s]*)\)/g

function inline(s) {
  return esc(s)
    .replace(LINK, (_, text, href) =>
      href.startsWith('/') ? `<a href="${href}">${text}</a>` : `<a href="${href}" rel="noopener">${text}</a>`,
    )
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
}

export function renderMarkdown(md) {
  return String(md ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const h = !b.includes('\n') && b.match(/^(#{1,3})[ \t]+(.+)$/)
      if (h) {
        const n = Math.max(2, h[1].length)
        return `<h${n}>${inline(h[2])}</h${n}>`
      }
      return `<p>${inline(b.replace(/\n/g, ' '))}</p>`
    })
    .join('\n')
}

// L'empreinte du corps français : chaque traduction la porte (`sourceHash`).
// Si le français change après la traduction, l'empreinte ne correspond plus
// et la traduction est déclarée périmée.
export function bodyHash(body) {
  return createHash('sha256')
    .update(String(body ?? '').replace(/\r\n/g, '\n').trim())
    .digest('hex')
    .slice(0, 16)
}
```

- [ ] **Step 4 : lancer le test et constater la réussite**

Run: `node --test test/culture-markdown.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/culture-markdown.mjs test/culture-markdown.test.mjs
git commit -m "Culture : front-matter, Markdown restreint et empreinte du corps"
```

---

### Task 3 : licences d'image et recouvrement

**Files:**
- Create: `scripts/lib/culture-license.mjs`, `scripts/lib/culture-overlap.mjs`
- Test: `test/culture-license.test.mjs`, `test/culture-overlap.test.mjs`

**Interfaces:**
- Produces: `isFreeLicense(name) → boolean` ; `OVERLAP_N = 8`, `OVERLAP_THRESHOLD = 0.15`, `ngrams(text, n) → string[]`, `overlapRatio(draft, sources: string[], n) → number` (0..1).

- [ ] **Step 1 : écrire les tests qui échouent**

```js
// test/culture-license.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFreeLicense } from '../scripts/lib/culture-license.mjs'

test('licences acceptées', () => {
  for (const ok of ['Public domain', 'PD-old', 'CC0', 'CC BY 2.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0 de', 'cc-by-sa-4.0'])
    assert.equal(isFreeLicense(ok), true, ok)
})

test('licences refusées, et absence = refus', () => {
  for (const no of ['CC BY-NC 4.0', 'CC BY-NC-SA 2.0', 'CC BY-ND 3.0', 'GFDL', 'Fair use', '', null, undefined])
    assert.equal(isFreeLicense(no), false, String(no))
})
```

```js
// test/culture-overlap.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ngrams, overlapRatio, OVERLAP_THRESHOLD } from '../scripts/lib/culture-overlap.mjs'

const src = 'Komitas est né en 1869 à Kütahya dans une famille arménienne et devient prêtre puis musicologue renommé'

test('ngrams : mots pliés (casse, accents), ponctuation ignorée', () => {
  assert.deepEqual(ngrams('A, b. C', 2), ['a b', 'b c'])
  assert.deepEqual(ngrams('Été été', 2), ['ete ete'])
  assert.deepEqual(ngrams('un deux', 8), [])
})

test('copie intégrale → 1, texte propre → 0', () => {
  assert.equal(overlapRatio(src, [src]), 1)
  assert.equal(overlapRatio('Un tout autre texte qui ne doit rien à la source et parle de danse ici', [src]), 0)
})

test('paraphrase partielle → entre les deux', () => {
  const r = overlapRatio(`Introduction propre. ${src}. Conclusion propre et originale sur le sujet.`, [src])
  assert.ok(r > OVERLAP_THRESHOLD && r < 1, String(r))
})

test('arménien et russe : les lettres comptent comme des mots', () => {
  const hy = 'Կոմիտասը ծնվել է 1869 թվականին Քյոթահիայում հայկական ընտանիքում և դարձել երաժշտագետ'
  assert.equal(overlapRatio(hy, [hy]), 1)
  const ru = 'Комитас родился в 1869 году в Кютахье в армянской семье и стал музыковедом'
  assert.equal(overlapRatio(ru, [ru]), 1)
})

test('brouillon vide → 0', () => assert.equal(overlapRatio('', [src]), 0))
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-license.test.mjs test/culture-overlap.test.mjs`
Expected: FAIL — modules introuvables.

- [ ] **Step 3 : implémenter**

```js
// scripts/lib/culture-license.mjs
//
// Les licences d'image Commons que le site accepte : domaine public, CC0,
// CC BY et CC BY-SA, toutes versions. Refusées : NC (le site vise la
// publicité, donc un usage commercial), ND (la carte de partage est un
// recadrage, donc une œuvre dérivée), et tout ce qui n'est pas reconnu.
// Une licence absente vaut un refus.
export function isFreeLicense(name) {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return false
  if (/(^|[^a-z])(nc|nd)([^a-z]|$)|non-?commercial|no-?deriv|fair use/.test(n)) return false
  return /^(public domain|pd([^a-z]|$)|cc0|cc[- ]by(-sa)?[- ]\d)/.test(n)
}
```

```js
// scripts/lib/culture-overlap.mjs
//
// Mesure anti-paraphrase : la part des suites de 8 mots du brouillon qu'on
// retrouve telles quelles dans les extraits Wikipédia. Au-delà du seuil, la
// PR le signale : c'est le garde-fou du « contenu propre » qu'AdSense exige.
// Les mots sont pliés (casse, diacritiques) et reconnus par \p{L}\p{N}, pour
// que l'arménien et le russe comptent autant que le français.
export const OVERLAP_N = 8
export const OVERLAP_THRESHOLD = 0.15

const words = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

export function ngrams(text, n = OVERLAP_N) {
  const w = words(text)
  const out = []
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' '))
  return out
}

export function overlapRatio(draft, sources, n = OVERLAP_N) {
  const d = ngrams(draft, n)
  if (!d.length) return 0
  const s = new Set(sources.flatMap((x) => ngrams(x, n)))
  return d.filter((g) => s.has(g)).length / d.length
}
```

- [ ] **Step 4 : lancer et constater la réussite**

Run: `node --test test/culture-license.test.mjs test/culture-overlap.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/culture-license.mjs scripts/lib/culture-overlap.mjs test/culture-license.test.mjs test/culture-overlap.test.mjs
git commit -m "Culture : filtre des licences Commons et mesure de recouvrement"
```

---

### Task 4 : validation, chargement et liens entre langues

**Files:**
- Create: `scripts/lib/culture-validate.mjs`, `scripts/lib/culture-load.mjs`, `scripts/lib/culture-links.mjs`
- Test: `test/culture-validate.test.mjs`, `test/culture-load.test.mjs`
- Create (helper de test partagé): `test/helpers/culture-fixture.mjs`

**Interfaces:**
- Consumes: `parseFrontMatter`, `serializeFrontMatter`, `bodyHash` (Task 2) ; `isFreeLicense` (Task 3) ; `ALL_LANGS`, `CULTURE_SLUG`, `cultureUrl` (Task 1).
- Produces:
  - `TRANSLATED` = `['en','hy','ru']`
  - `validateArticle({ slug, meta, texts: {fr,en,hy,ru: string|null}, images: {webp: bool, jpg: bool} }) → { errors: string[], langs: { [lang]: { title, description, date, body, sourceHash, model } } }` — `langs` vide si erreur bloquante (meta, licence, fr).
  - `chosenImage(meta) → candidate | null`
  - `factsChecked(prBody) → boolean`
  - `readArticle(dir, slug) → article brut`, `articleSlugs(dir) → string[]`, `loadCulture(dir, log) → Article[]` où `Article = { slug, date, meta, image, sources, langs }`, trié du plus récent au plus ancien.
  - `cultureLangsBySlug(articles) → Map<slug, lang[]>`, `cultureAlternates(slug|null, bySlug) → [hreflang, url][]`, `teaserFor(articles, langs, n=3) → { [lang]: {slug,title,description,date}[] }`.

- [ ] **Step 1 : écrire le helper de test**

```js
// test/helpers/culture-fixture.mjs
// Fabrique un dossier d'article valide sur disque. Chaque test le casse
// ensuite d'UNE façon, pour que l'échec observé ait une seule cause.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { serializeFrontMatter, bodyHash } from '../../scripts/lib/culture-markdown.mjs'

export const FR_BODY = 'Premier paragraphe.\n\n## Intertitre\n\nSecond paragraphe.'

export const candidate = (i = 0, extra = {}) => ({
  file: `File:K${i}.jpg`, thumbUrl: `https://upload.wikimedia.org/k${i}.jpg`, width: 1600, height: 1000,
  author: 'Auteur', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  commonsUrl: `https://commons.wikimedia.org/wiki/File:K${i}.jpg`, ...extra,
})

export function meta(slug, extra = {}) {
  return {
    slug,
    sources: [{ lang: 'fr', title: 'Komitas', url: 'https://fr.wikipedia.org/wiki/Komitas', revision: 1 }],
    candidates: [candidate(0), candidate(1)],
    imageChoice: 0,
    image: { ...candidate(0), width: 1200, height: 750 },
    agendaEvent: null,
    overlap: 0.02,
    model: 'gemini-flash-latest',
    ...extra,
  }
}

export function texts({ date = '2026-10-19', title = 'Komitas', frBody = FR_BODY } = {}) {
  const fr = serializeFrontMatter({ title, description: 'Le père de la musique arménienne.', date }, frBody)
  const tr = (l) =>
    serializeFrontMatter(
      { title: `${title} ${l}`, description: `Desc ${l}`, date, sourceHash: bodyHash(frBody), model: 'm' },
      `Body ${l}.`,
    )
  return { fr, en: tr('en'), hy: tr('hy'), ru: tr('ru') }
}

export async function writeArticle(dir, slug, { m = meta(slug), t = texts(), images = true } = {}) {
  const base = path.join(dir, slug)
  await mkdir(base, { recursive: true })
  await writeFile(path.join(base, 'meta.json'), JSON.stringify(m, null, 2))
  for (const [l, v] of Object.entries(t)) if (v !== null) await writeFile(path.join(base, `${l}.md`), v)
  if (images) {
    await writeFile(path.join(base, 'image.webp'), 'w')
    await writeFile(path.join(base, 'image.jpg'), 'j')
  }
}
```

- [ ] **Step 2 : écrire les tests qui échouent**

```js
// test/culture-validate.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateArticle, chosenImage, factsChecked } from '../scripts/lib/culture-validate.mjs'
import { serializeFrontMatter } from '../scripts/lib/culture-markdown.mjs'
import { meta, texts, candidate } from './helpers/culture-fixture.mjs'

const ok = (over = {}) => ({ slug: 'komitas', meta: meta('komitas'), texts: texts(), images: { webp: true, jpg: true }, ...over })

test('article complet : aucune erreur, quatre langues', () => {
  const r = validateArticle(ok())
  assert.deepEqual(r.errors, [])
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en', 'hy', 'ru'])
  assert.equal(r.langs.fr.date, '2026-10-19')
})

test('traduction absente : erreur, les autres langues restent', () => {
  const r = validateArticle(ok({ texts: { ...texts(), hy: null } }))
  assert.match(r.errors.join('\n'), /hy\.md absent/)
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en', 'ru'])
})

test('traduction périmée : le français a changé après la traduction', () => {
  const t = texts()
  t.fr = serializeFrontMatter({ title: 'Komitas', description: 'd', date: '2026-10-19' }, 'Texte corrigé.')
  const r = validateArticle(ok({ texts: t }))
  assert.equal(r.errors.filter((e) => /périmée/.test(e)).length, 3)
  assert.deepEqual(Object.keys(r.langs), ['fr'])
})

test('fr cassé à la main : bloquant, message lisible', () => {
  const r = validateArticle(ok({ texts: { ...texts(), fr: 'title: x\ncorps' } }))
  assert.match(r.errors[0], /^fr\.md : front-matter absent/)
  assert.deepEqual(r.langs, {})
})

test('front-matter incomplet ou description trop longue', () => {
  const long = serializeFrontMatter({ title: 'T', description: 'x'.repeat(161), date: '2026-10-19' }, 'b')
  assert.match(validateArticle(ok({ texts: { ...texts(), fr: long } })).errors[0], /161 caractères/)
  const nodate = serializeFrontMatter({ title: 'T', description: 'd', date: '19/10/2026' }, 'b')
  assert.match(validateArticle(ok({ texts: { ...texts(), fr: nodate } })).errors[0], /AAAA-MM-JJ/)
})

test('licence refusée et sources absentes : bloquant', () => {
  const nc = meta('komitas', { image: { ...candidate(0, { license: 'CC BY-NC 4.0' }) }, candidates: [candidate(0, { license: 'CC BY-NC 4.0' })] })
  const r = validateArticle(ok({ meta: nc }))
  assert.match(r.errors.join('\n'), /licence d'image refusée/)
  assert.deepEqual(r.langs, {})
  assert.deepEqual(validateArticle(ok({ meta: meta('komitas', { sources: [] }) })).langs, {})
})

test('fichiers image absents alors que l’image est déclarée : bloquant', () => {
  const r = validateArticle(ok({ images: { webp: false, jpg: true } }))
  assert.match(r.errors.join('\n'), /image\.webp/)
  assert.deepEqual(r.langs, {})
})

test('imageChoice changé après la traduction : signalé, non bloquant', () => {
  const r = validateArticle(ok({ meta: meta('komitas', { imageChoice: 1 }) }))
  assert.match(r.errors.join('\n'), /reposez l'étiquette/)
  assert.equal(Object.keys(r.langs).length, 4)
})

test('article sans image : valide', () => {
  const r = validateArticle(ok({ meta: meta('komitas', { candidates: [], imageChoice: null, image: null }), images: { webp: false, jpg: false } }))
  assert.deepEqual(r.errors, [])
})

test('slug de meta incohérent ou slug invalide', () => {
  assert.deepEqual(validateArticle(ok({ meta: meta('autre') })).langs, {})
  assert.match(validateArticle(ok({ slug: '../x' })).errors[0], /slug invalide/)
})

test('chosenImage et factsChecked', () => {
  assert.equal(chosenImage(meta('k', { imageChoice: 1 })).file, 'File:K1.jpg')
  assert.equal(chosenImage(meta('k', { imageChoice: null })), null)
  assert.equal(chosenImage(meta('k', { imageChoice: 9 })), null)
  assert.equal(factsChecked('blabla\n- [x] Faits vérifiés\n'), true)
  assert.equal(factsChecked('- [X] Faits vérifiés'), true)
  assert.equal(factsChecked('- [ ] Faits vérifiés'), false)
  assert.equal(factsChecked(null), false)
})
```

```js
// test/culture-load.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadCulture, articleSlugs } from '../scripts/lib/culture-load.mjs'
import { cultureLangsBySlug, cultureAlternates, teaserFor } from '../scripts/lib/culture-links.mjs'
import { writeArticle, texts } from './helpers/culture-fixture.mjs'

const silent = () => { const w = []; return { warn: (m) => w.push(m), w } }

test('loadCulture : tri par date, article cassé ignoré avec avertissement', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', { t: texts({ date: '2026-10-19' }) })
  await writeArticle(dir, 'duduk', { t: texts({ date: '2026-10-26' }) })
  await writeArticle(dir, 'casse', { t: { ...texts(), fr: 'pas de front-matter' } })
  await writeFile(path.join(dir, 'sujets.json'), '{}')
  await mkdir(path.join(dir, 'Pas_Un_Slug'))
  const log = silent()
  const got = await loadCulture(dir, log)
  assert.deepEqual(got.map((a) => a.slug), ['duduk', 'komitas'])
  assert.ok(log.w.some((m) => /culture\/casse/.test(m)))
  assert.deepEqual(await articleSlugs(dir), ['casse', 'duduk', 'komitas'])
  assert.equal(got[0].image.width, 1200)
  assert.equal(got[0].sources[0].url, 'https://fr.wikipedia.org/wiki/Komitas')
})

test('loadCulture : dossier absent → liste vide', async () => {
  assert.deepEqual(await loadCulture(path.join(tmpdir(), 'nexiste-pas-culture'), silent()), [])
})

test('alternates : seulement les langues présentes ; index dans les quatre', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', { t: { ...texts(), hy: null } })
  const arts = await loadCulture(dir, silent())
  const bySlug = cultureLangsBySlug(arts)
  assert.deepEqual(bySlug.get('komitas'), ['fr', 'en', 'ru'])
  assert.deepEqual(cultureAlternates('komitas', bySlug), [
    ['fr', 'https://armenieinfo.ch/culture/komitas/'],
    ['en', 'https://armenianews.org/culture/komitas/'],
    ['ru', 'https://armenianews.org/ru/culture/komitas/'],
    ['x-default', 'https://armenianews.org/culture/komitas/'],
  ])
  assert.equal(cultureAlternates(null, bySlug).length, 5)
  assert.deepEqual(cultureAlternates('inconnu', bySlug), [])
})

test('teaserFor : trois plus récents par langue, langue absente exclue', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  for (const [s, d] of [['a', '2026-10-01'], ['b', '2026-10-08'], ['c', '2026-10-15'], ['d', '2026-10-22']])
    await writeArticle(dir, s, { t: texts({ date: d, title: s.toUpperCase() }) })
  await writeArticle(dir, 'e', { t: { ...texts({ date: '2026-10-29', title: 'E' }), ru: null } })
  const t = teaserFor(await loadCulture(dir, silent()), ['fr', 'ru'])
  assert.deepEqual(t.fr.map((x) => x.slug), ['e', 'd', 'c'])
  assert.deepEqual(t.ru.map((x) => x.slug), ['d', 'c', 'b'])
  assert.deepEqual(Object.keys(t.fr[0]).sort(), ['date', 'description', 'slug', 'title'])
})
```

- [ ] **Step 3 : lancer et constater l'échec**

Run: `node --test test/culture-validate.test.mjs test/culture-load.test.mjs`
Expected: FAIL — modules introuvables.

- [ ] **Step 4 : implémenter**

```js
// scripts/lib/culture-validate.mjs
//
// UNE validation, deux usages (spec §3.5) :
//   - culture-check (PR) : toute erreur fait échouer le contrôle ;
//   - le build : les erreurs sont des avertissements, et seules les langues
//     de `langs` sont publiées. Le déploiement horaire ne casse jamais à cause
//     d'un article.
// Une erreur est BLOQUANTE (langs vide) quand publier serait fautif : pas de
// source à citer, licence d'image refusée, fichiers image absents, français
// illisible. Une traduction absente ou périmée retire seulement sa langue.
import { ALL_LANGS, CULTURE_SLUG } from '../../sites.config.js'
import { parseFrontMatter, bodyHash } from './culture-markdown.mjs'
import { isFreeLicense } from './culture-license.mjs'

export const TRANSLATED = ALL_LANGS.filter((l) => l !== 'fr')
const DATE = /^\d{4}-\d{2}-\d{2}$/
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== ''

function parseLang(text) {
  const { data, body } = parseFrontMatter(text)
  if (!nonEmpty(data.title)) throw new Error('title vide')
  if (!nonEmpty(data.description)) throw new Error('description vide')
  if (data.description.length > 160)
    throw new Error(`description de ${data.description.length} caractères (160 au plus)`)
  if (!DATE.test(data.date ?? '')) throw new Error('date AAAA-MM-JJ attendue')
  if (!body) throw new Error('corps vide')
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    date: data.date,
    body,
    sourceHash: data.sourceHash ?? null,
    model: data.model ?? null,
  }
}

export function chosenImage(meta) {
  const c = Array.isArray(meta?.candidates) ? meta.candidates : []
  return Number.isInteger(meta?.imageChoice) ? (c[meta.imageChoice] ?? null) : null
}

export function validateArticle({ slug, meta, texts, images }) {
  if (!CULTURE_SLUG.test(slug ?? '')) return { errors: [`slug invalide : ${slug}`], langs: {} }
  const fatal = []
  const errors = []
  if (!meta || meta.slug !== slug) fatal.push('meta.json absent, illisible ou de slug incohérent')
  const sources = Array.isArray(meta?.sources)
    ? meta.sources.filter((s) => typeof s?.url === 'string' && s.url.startsWith('https://'))
    : []
  if (!sources.length) fatal.push('meta.json : aucune source https à citer')
  const img = meta?.image ?? null
  if (img) {
    if (!isFreeLicense(img.license)) fatal.push(`licence d'image refusée : ${img.license ?? '(aucune)'}`)
    if (!nonEmpty(img.author) || !nonEmpty(img.commonsUrl)) fatal.push('image sans auteur ou sans lien Commons')
    if (!images?.webp || !images?.jpg) fatal.push('image déclarée mais image.webp / image.jpg absents')
  }
  if ((chosenImage(meta)?.commonsUrl ?? null) !== (img?.commonsUrl ?? null))
    errors.push("image changée (imageChoice) — reposez l'étiquette « traduire »")

  let fr
  try {
    if (texts?.fr == null) throw new Error('absent')
    fr = parseLang(texts.fr)
  } catch (e) {
    fatal.push(`fr.md : ${e.message}`)
  }
  if (fatal.length) return { errors: [...fatal, ...errors], langs: {} }

  const langs = { fr }
  const hash = bodyHash(fr.body)
  for (const l of TRANSLATED) {
    if (texts?.[l] == null) {
      errors.push(`${l}.md absent — posez l'étiquette « traduire »`)
      continue
    }
    let t
    try {
      t = parseLang(texts[l])
    } catch (e) {
      errors.push(`${l}.md : ${e.message}`)
      continue
    }
    if (t.sourceHash !== hash) {
      errors.push(`${l}.md : traduction périmée — reposez l'étiquette « traduire »`)
      continue
    }
    langs[l] = t
  }
  return { errors, langs }
}

export function factsChecked(prBody) {
  return /^\s*[-*] \[[xX]\] Faits vérifiés/m.test(String(prBody ?? ''))
}
```

```js
// scripts/lib/culture-load.mjs
// Lecture sur disque des articles Culture (src/data/culture/<slug>/). Un
// article invalide est IGNORÉ avec un avertissement — voir culture-validate.
import { readdir, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { ALL_LANGS, CULTURE_SLUG } from '../../sites.config.js'
import { validateArticle } from './culture-validate.mjs'

export async function readArticle(dir, slug) {
  const base = path.join(dir, slug)
  const read = (f) => readFile(path.join(base, f), 'utf-8').catch(() => null)
  const has = (f) => access(path.join(base, f)).then(() => true, () => false)
  let meta = null
  const raw = await read('meta.json')
  if (raw) {
    try {
      meta = JSON.parse(raw)
    } catch {
      meta = null
    }
  }
  const texts = {}
  for (const l of ALL_LANGS) texts[l] = await read(`${l}.md`)
  return { slug, meta, texts, images: { webp: await has('image.webp'), jpg: await has('image.jpg') } }
}

export async function articleSlugs(dir) {
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && CULTURE_SLUG.test(e.name))
    .map((e) => e.name)
    .sort()
}

export async function loadCulture(dir, log = console) {
  const out = []
  for (const slug of await articleSlugs(dir)) {
    const raw = await readArticle(dir, slug)
    const { errors, langs } = validateArticle(raw)
    for (const e of errors) log.warn(`  ⚠ culture/${slug} : ${e}`)
    if (!langs.fr) continue
    out.push({
      slug,
      date: langs.fr.date,
      meta: raw.meta,
      image: raw.meta.image ?? null,
      sources: raw.meta.sources.filter((s) => typeof s?.url === 'string' && s.url.startsWith('https://')),
      langs,
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
}
```

```js
// scripts/lib/culture-links.mjs
//
// Les liens entre versions d'un article, partagés par l'en-tête HTML
// (site-meta.mjs), le sitemap et check-build : trois générateurs qui
// divergeraient feraient ignorer le bloc hreflang par Google.
//
// LE PIÈGE, le même que la brève : un article ne cite QUE ses langues
// présentes. Une traduction absente ou périmée n'est pas publiée ; un
// hreflang vers elle ferait ignorer TOUT le bloc. L'index, lui, existe
// toujours dans les quatre langues.
//
// Sans node:fs : vite.config.js l'importe aussi.
import { ALL_LANGS, cultureUrl } from '../../sites.config.js'

export function cultureLangsBySlug(articles) {
  return new Map(articles.map((a) => [a.slug, ALL_LANGS.filter((l) => a.langs[l])]))
}

export function cultureAlternates(slug, bySlug) {
  const langs = slug === null ? ALL_LANGS : (bySlug.get(slug) ?? [])
  const out = langs.map((l) => [l, cultureUrl(l, slug)])
  if (langs.includes('en')) out.push(['x-default', cultureUrl('en', slug)])
  return out
}

export function teaserFor(articles, langs, n = 3) {
  return Object.fromEntries(
    langs.map((l) => [
      l,
      articles
        .filter((a) => a.langs[l])
        .slice(0, n)
        .map((a) => ({ slug: a.slug, title: a.langs[l].title, description: a.langs[l].description, date: a.date })),
    ]),
  )
}
```

- [ ] **Step 5 : lancer et constater la réussite**

Run: `node --test test/culture-validate.test.mjs test/culture-load.test.mjs`
Expected: PASS (15 tests).

- [ ] **Step 6 : commit**

```bash
git add scripts/lib/culture-validate.mjs scripts/lib/culture-load.mjs scripts/lib/culture-links.mjs test/culture-validate.test.mjs test/culture-load.test.mjs test/helpers/culture-fixture.mjs
git commit -m "Culture : validation à deux sévérités, chargement et hreflang par article"
```

---

### Task 5 : choix du sujet et liste de départ

**Files:**
- Create: `scripts/lib/culture-topic.mjs`, `src/data/culture/sujets.json`
- Test: `test/culture-topic.test.mjs`

**Interfaces:**
- Consumes: `evenementsAVenir(evenements, maintenant)` de `src/agendaEvents.js` ; `CULTURE_SLUG`.
- Produces: `WINDOW_DAYS = 21`, `STATUSES`, `availableTopics(topics, { openBranches = [], existing = [] }) → topic[]`, `agendaMatch(topic, agenda, now) → event|null`, `pickTopic({ topics, openBranches, existing, agenda, now }) → { topic, event } | null`, `setTopicStatus(file, slug, status) → file`, `validateTopics(file) → string[]`. `topic = { slug, title, wikipedia: { fr?, en? }, keywords: string[], status }`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-topic.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  availableTopics, agendaMatch, pickTopic, setTopicStatus, validateTopics, WINDOW_DAYS,
} from '../scripts/lib/culture-topic.mjs'

const NOW = new Date('2026-10-19T08:00').getTime()
const day = (n) => new Date(NOW + n * 86400000).toISOString().slice(0, 16)
const T = (slug, keywords = [slug], status = 'pending') => ({ slug, title: slug, wikipedia: { fr: slug }, keywords, status })
const ev = (title, d, url = `https://e/${title}`) => ({ title, date: day(d), url, location: 'Genève' })

test('availableTopics : pending, sans PR ouverte, sans dossier existant', () => {
  const topics = [T('a'), T('b', ['b'], 'published'), T('c'), T('d'), T('e', ['e'], 'rejected')]
  assert.deepEqual(
    availableTopics(topics, { openBranches: ['culture/c', 'main'], existing: ['d'] }).map((t) => t.slug),
    ['a'],
  )
})

test('agendaMatch : mot-clé plié, fenêtre de 21 jours, passé ignoré', () => {
  const agenda = { switzerland: [ev('Concert de DUDUK', 5)], world: [ev('Duduk à Paris', -2), ev('Doudouk', WINDOW_DAYS + 1)] }
  assert.equal(agendaMatch(T('duduk', ['duduk', 'doudouk']), agenda, NOW).title, 'Concert de DUDUK')
  assert.equal(agendaMatch(T('komitas'), agenda, NOW), null)
  assert.equal(agendaMatch(T('x', []), agenda, NOW), null)
  assert.equal(agendaMatch(T('kochari', ['kotchari']), { switzerland: [ev('Soirée Kotchari', 3)] }, NOW).title, 'Soirée Kotchari')
  assert.equal(agendaMatch(T('ete', ['été']), { world: [ev('Fête de l’ETE', 1)] }, NOW).title, 'Fête de l’ETE')
})

test('pickTopic : le sujet de l’événement le plus proche passe devant la liste', () => {
  const topics = [T('komitas'), T('duduk'), T('kochari')]
  const agenda = { switzerland: [ev('Duduk', 10), ev('Kochari', 4)] }
  const got = pickTopic({ topics, agenda, now: NOW })
  assert.equal(got.topic.slug, 'kochari')
  assert.equal(got.event.title, 'Kochari')
})

test('pickTopic : sans événement, le premier disponible ; sans sujet, null', () => {
  assert.deepEqual(pickTopic({ topics: [T('a'), T('b')], agenda: null, now: NOW }), { topic: T('a'), event: null })
  assert.equal(pickTopic({ topics: [T('a', ['a'], 'published')], agenda: null, now: NOW }), null)
})

test('setTopicStatus', () => {
  const f = { topics: [T('a'), T('b')] }
  assert.equal(setTopicStatus(f, 'b', 'rejected').topics[1].status, 'rejected')
  assert.equal(f.topics[1].status, 'pending', 'pas de mutation')
  assert.throws(() => setTopicStatus(f, 'z', 'published'), /inconnu/)
  assert.throws(() => setTopicStatus(f, 'a', 'drafted'), /statut/)
})

test('validateTopics : doublon, slug, statut, sources, mots-clés', () => {
  const errs = validateTopics({ topics: [T('a'), T('a'), { ...T('B') }, { ...T('c'), status: 'x' }, { ...T('d'), wikipedia: {} }, { ...T('e'), keywords: 'e' }] })
  assert.equal(errs.length, 5, errs.join('\n'))
  assert.deepEqual(validateTopics({ topics: 'x' }), ['sujets.json : « topics » doit être un tableau'])
})

test('src/data/culture/sujets.json est valide', async () => {
  const file = JSON.parse(await readFile(new URL('../src/data/culture/sujets.json', import.meta.url), 'utf-8'))
  assert.deepEqual(validateTopics(file), [])
  assert.ok(file.topics.length >= 12)
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-topic.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : implémenter**

```js
// scripts/lib/culture-topic.mjs
//
// Le choix du sujet de la semaine (spec §1.1) : un sujet de la liste curée
// dont un événement de l'agenda tombe dans les 21 jours passe devant — le
// plus proche d'abord ; sinon le premier disponible.
//
// « Disponible » = `pending` ET sans PR ouverte ET sans dossier déjà présent.
// Sans la deuxième condition, un sujet en relecture serait rédigé une seconde
// fois le lundi suivant ; sans la troisième, un statut remis à `pending` à la
// main ferait réécrire un article publié.
import { evenementsAVenir } from '../../src/agendaEvents.js'
import { CULTURE_SLUG } from '../../sites.config.js'

export const WINDOW_DAYS = 21
export const STATUSES = ['pending', 'published', 'rejected']

const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

export function availableTopics(topics, { openBranches = [], existing = [] } = {}) {
  const open = new Set(openBranches)
  const done = new Set(existing)
  return topics.filter((t) => t.status === 'pending' && !open.has(`culture/${t.slug}`) && !done.has(t.slug))
}

export function agendaMatch(topic, agenda, now = Date.now()) {
  const keys = (Array.isArray(topic.keywords) ? topic.keywords : []).map(fold).filter(Boolean)
  if (!keys.length || !agenda) return null
  const all = [...(agenda.switzerland ?? []), ...(agenda.world ?? [])]
  const limit = now + WINDOW_DAYS * 86400000
  return (
    evenementsAVenir(all, now)
      .filter((e) => new Date(e.date).getTime() <= limit)
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((e) => keys.some((k) => fold(e.title).includes(k))) ?? null
  )
}

export function pickTopic({ topics, openBranches = [], existing = [], agenda = null, now = Date.now() }) {
  const avail = availableTopics(topics, { openBranches, existing })
  const matched = avail
    .map((topic) => ({ topic, event: agendaMatch(topic, agenda, now) }))
    .filter((x) => x.event)
    .sort((a, b) => a.event.date.localeCompare(b.event.date))
  if (matched.length) return matched[0]
  return avail.length ? { topic: avail[0], event: null } : null
}

export function setTopicStatus(file, slug, status) {
  if (!STATUSES.includes(status)) throw new Error(`statut invalide : ${status}`)
  if (!file.topics.some((t) => t.slug === slug)) throw new Error(`sujet inconnu : ${slug}`)
  return { ...file, topics: file.topics.map((t) => (t.slug === slug ? { ...t, status } : t)) }
}

export function validateTopics(file) {
  if (!Array.isArray(file?.topics)) return ['sujets.json : « topics » doit être un tableau']
  const errs = []
  const seen = new Set()
  file.topics.forEach((t, i) => {
    const at = `sujets.json[${i}] (${t?.slug})`
    if (!CULTURE_SLUG.test(t?.slug ?? '')) errs.push(`${at} : slug invalide`)
    else if (seen.has(t.slug)) errs.push(`${at} : slug en double`)
    seen.add(t?.slug)
    if (!STATUSES.includes(t?.status)) errs.push(`${at} : statut invalide`)
    if (!t?.wikipedia?.fr && !t?.wikipedia?.en) errs.push(`${at} : aucun article Wikipédia (fr ou en)`)
    if (!Array.isArray(t?.keywords)) errs.push(`${at} : « keywords » doit être un tableau`)
  })
  return errs
}
```

Créer `src/data/culture/sujets.json` :

```json
{
  "topics": [
    { "slug": "komitas", "title": "Komitas", "wikipedia": { "fr": "Komitas", "en": "Komitas" }, "keywords": ["komitas"], "status": "pending" },
    { "slug": "kochari", "title": "Le kochari", "wikipedia": { "fr": "Kochari", "en": "Kochari" }, "keywords": ["kochari", "kotchari", "քոչարի"], "status": "pending" },
    { "slug": "duduk", "title": "Le duduk", "wikipedia": { "fr": "Doudouk", "en": "Duduk" }, "keywords": ["duduk", "doudouk", "դուդուկ"], "status": "pending" },
    { "slug": "alphabet-armenien", "title": "L'alphabet de Mesrop Machtots", "wikipedia": { "fr": "Alphabet arménien", "en": "Armenian alphabet" }, "keywords": ["machtots", "mashtots", "alphabet arménien"], "status": "pending" },
    { "slug": "khatchkar", "title": "Les khatchkars", "wikipedia": { "fr": "Khatchkar", "en": "Khachkar" }, "keywords": ["khatchkar", "khachkar", "խաչքար"], "status": "pending" },
    { "slug": "bataille-de-sardarapat", "title": "La bataille de Sardarapat", "wikipedia": { "fr": "Bataille de Sardarapat", "en": "Battle of Sardarabad" }, "keywords": ["sardarapat", "sardarabad"], "status": "pending" },
    { "slug": "aram-khatchatourian", "title": "Aram Khatchatourian", "wikipedia": { "fr": "Aram Khatchatourian", "en": "Aram Khachaturian" }, "keywords": ["khatchatourian", "khachaturian"], "status": "pending" },
    { "slug": "charles-aznavour", "title": "Charles Aznavour", "wikipedia": { "fr": "Charles Aznavour", "en": "Charles Aznavour" }, "keywords": ["aznavour"], "status": "pending" },
    { "slug": "monastere-de-tatev", "title": "Le monastère de Tatev", "wikipedia": { "fr": "Monastère de Tatev", "en": "Tatev Monastery" }, "keywords": ["tatev"], "status": "pending" },
    { "slug": "lavash", "title": "Le lavash", "wikipedia": { "fr": "Lavash", "en": "Lavash" }, "keywords": ["lavash", "lavach"], "status": "pending" },
    { "slug": "serguei-paradjanov", "title": "Sergueï Paradjanov", "wikipedia": { "fr": "Sergueï Paradjanov", "en": "Sergei Parajanov" }, "keywords": ["paradjanov", "parajanov"], "status": "pending" },
    { "slug": "ani", "title": "Ani, la ville aux mille et une églises", "wikipedia": { "fr": "Ani (Arménie)", "en": "Ani" }, "keywords": ["ani "], "status": "pending" }
  ]
}
```

- [ ] **Step 4 : vérifier les titres Wikipédia contre l'API réelle**

Chaque titre doit résoudre vers un article (redirections acceptées), jamais vers une page d'homonymie. Lancer :

```bash
UA='ArmenieInfo/1.0 (https://armenieinfo.ch/a-propos/; contact@armenieinfo.ch)'
node -e "
const t=require('./src/data/culture/sujets.json').topics;
(async()=>{for(const x of t)for(const [l,ti] of Object.entries(x.wikipedia)){
const u=new URL('https://'+l+'.wikipedia.org/w/api.php');
Object.entries({action:'query',format:'json',formatversion:'2',redirects:'1',prop:'pageprops',ppprop:'disambiguation',titles:ti}).forEach(([k,v])=>u.searchParams.set(k,v));
const p=(await (await fetch(u,{headers:{'User-Agent':process.env.UA}})).json()).query.pages[0];
console.log((p.missing?'✗ MANQUANT':p.pageprops&&'disambiguation' in p.pageprops?'✗ HOMONYMIE':'✓'),l,ti,'→',p.title)}})()" 
```

Expected: une ligne `✓` par titre. Pour chaque `✗`, remplacer le titre par celui de l'article réel (chercher sur Wikipédia) et relancer jusqu'à n'avoir que des `✓`. Le mot-clé `"ani "` (avec espace) évite de faire correspondre « Daniel » ou « animation » : le vérifier à l'œil si on le change.

- [ ] **Step 5 : lancer le test et constater la réussite**

Run: `node --test test/culture-topic.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 6 : commit**

```bash
git add scripts/lib/culture-topic.mjs src/data/culture/sujets.json test/culture-topic.test.mjs
git commit -m "Culture : choix du sujet (liste curée + priorité agenda) et 12 sujets de départ"
```

---

### Task 6 : l'en-tête des pages Culture

**Files:**
- Modify: `scripts/lib/site-meta.mjs` — `composeHead` (vers la ligne 150) et ajout de `cultureHeadFor` après `briefHeadFor` (vers la ligne 318)
- Test: `test/culture-head.test.mjs`

**Interfaces:**
- Consumes: `cultureAlternates` (Task 4), `cultureUrl`, `cultureImagePath` (Task 1), `CULTURE_STRINGS`.
- Produces: `composeHead({ …, ogImage = null })` (URL absolue ; défaut : la carte de la vitrine) ; `cultureHeadFor({ siteId, lang, slug = null, article = null, bySlug, robots = null }) → string`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-head.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cultureHeadFor } from '../scripts/lib/site-meta.mjs'
import { cultureAlternates } from '../scripts/lib/culture-links.mjs'

const art = (image = { author: 'A', license: 'CC0', commonsUrl: 'https://c', width: 1200, height: 800 }) => ({
  slug: 'komitas', date: '2026-10-19', image,
  sources: [{ url: 'https://fr.wikipedia.org/wiki/Komitas' }],
  langs: {
    fr: { title: 'Komitas, <le> père', description: 'Desc "fr"', date: '2026-10-19', body: 'x' },
    en: { title: 'Komitas EN', description: 'Desc en', date: '2026-10-19', body: 'x' },
  },
})
const bySlug = new Map([['komitas', ['fr', 'en']]])
const alts = (h) => [...h.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])

test('page article : canonical, hreflang des langues présentes, carte propre, Article', () => {
  const h = cultureHeadFor({ siteId: 'ch', lang: 'fr', slug: 'komitas', article: art(), bySlug })
  assert.ok(h.includes('<link rel="canonical" href="https://armenieinfo.ch/culture/komitas/" />'))
  assert.deepEqual(alts(h), cultureAlternates('komitas', bySlug))
  assert.ok(h.includes('<meta property="og:image" content="https://armenieinfo.ch/culture/komitas/image.jpg" />'))
  assert.ok(h.includes('<meta property="og:type" content="article" />'))
  assert.ok(h.includes('<title>Komitas, &lt;le&gt; père · Arménie Info</title>'))
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'))
  const a = ld['@graph'].find((n) => n['@type'] === 'Article')
  assert.equal(a.headline, 'Komitas, <le> père')
  assert.equal(a.datePublished, '2026-10-19')
  assert.deepEqual(a.citation, ['https://fr.wikipedia.org/wiki/Komitas'])
})

test('article sans image : carte de la vitrine', () => {
  const h = cultureHeadFor({ siteId: 'org', lang: 'en', slug: 'komitas', article: art(null), bySlug })
  assert.ok(h.includes('<meta property="og:image" content="https://armenianews.org/og-image-org.jpg" />'))
})

test('index : quatre langues, pas d’Article, robots transmis', () => {
  const h = cultureHeadFor({ siteId: 'org', lang: 'hy', bySlug, robots: 'noindex, follow' })
  assert.equal(alts(h).length, 5)
  assert.ok(!h.includes('"Article"'))
  assert.ok(h.includes('<meta name="robots" content="noindex, follow" />'))
  assert.ok(h.includes('<link rel="canonical" href="https://armenianews.org/hy/culture/" />'))
})

test('article absent dans la langue demandée : lève', () => {
  assert.throws(() => cultureHeadFor({ siteId: 'org', lang: 'ru', slug: 'komitas', article: art(), bySlug }))
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-head.test.mjs`
Expected: FAIL — `cultureHeadFor` n'est pas exporté. (Vérifier au passage, avec `grep -n ogImage sites.config.js`, que la carte du .org est bien `/og-image-org.jpg` ; sinon corriger la valeur attendue du test.)

- [ ] **Step 3 : implémenter**

Dans `scripts/lib/site-meta.mjs` :

1. Ajouter aux imports : `cultureUrl, cultureImagePath` dans l'import de `../../sites.config.js`, puis

```js
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'
import { cultureAlternates } from './culture-links.mjs'
```

2. Remplacer la signature et la première ligne de `composeHead` :

```js
function composeHead({ site, lang, url, title, description, keywords, alternates, ogType, graph, robots = null, ogImage = null }) {
  // La carte de partage suit la VITRINE (voir `ogImage` dans sites.config.js) —
  // sauf un article Culture, qui porte la sienne (1200×630, sRGB, sans ICC,
  // produite par culture-image.mjs : les six balises ci-dessous restent vraies).
  const image = ogImage ?? `${site.host}${site.ogImage}`
```

3. Après `briefHeadFor`, ajouter :

```js
// L'en-tête d'une page Culture : l'index (`slug` null) ou un article. Mêmes
// balises que les vues et la brève, via composeHead ; hreflang limité aux
// langues présentes pour cet article (culture-links.mjs), og:type article,
// carte de partage propre à l'article quand il a une image.
export function cultureHeadFor({ siteId, lang, slug = null, article = null, bySlug, robots = null }) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  const s = CULTURE_STRINGS[lang]
  if (!s) throw new Error(`pas de chaînes Culture en ${lang}`)
  const url = cultureUrl(lang, slug)
  const a = slug ? article?.langs?.[lang] : null
  if (slug && !a) throw new Error(`article ${slug} absent en ${lang}`)
  const title = a ? `${a.title} · ${site.brand}` : `${s.title} · ${site.brand}`
  const description = a ? a.description : s.description
  const ogImage = a && article.image ? `${site.host}${cultureImagePath(slug, 'jpg')}` : null
  const graph = siteGraph(site, lang)
  if (a) {
    graph.push({
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: a.title,
      description,
      url,
      mainEntityOfPage: url,
      image: ogImage ?? `${site.host}${site.ogImage}`,
      author: { '@id': `${site.host}/#organization` },
      publisher: { '@id': `${site.host}/#organization` },
      datePublished: a.date,
      inLanguage: lang,
      isAccessibleForFree: true,
      citation: article.sources.map((x) => x.url),
    })
  }
  return composeHead({
    site, lang, url, title, description,
    alternates: cultureAlternates(slug, bySlug),
    ogType: a ? 'article' : 'website',
    graph,
    robots,
    ogImage,
  })
}
```

- [ ] **Step 4 : lancer les tests de l'en-tête et de la brève**

Run: `node --test test/culture-head.test.mjs test/brief-head.test.mjs test/site-meta.test.mjs`
Expected: PASS — les tests existants ne bougent pas (le défaut d'`ogImage` garde le comportement).

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/site-meta.mjs test/culture-head.test.mjs
git commit -m "Culture : en-tête des pages (hreflang par article, carte propre, JSON-LD Article)"
```

---

### Task 7 : coquille commune, pages Culture et styles

**Files:**
- Create: `scripts/lib/static-shell.mjs`, `scripts/lib/culture-pages.mjs`
- Modify: `scripts/lib/brief-pages.mjs` (retirer `esc` et `shell`, importer depuis `static-shell.mjs`)
- Modify: `src/styles/global.css` (ajouter le bloc `/* === Culture` à la fin du fichier, après le bloc de la brève)
- Test: `test/culture-pages.test.mjs`

**Interfaces:**
- Consumes: `cultureHeadFor` (Task 6), `cultureLangsBySlug` (Task 4), `renderMarkdown`, `esc` (Task 2), `longDate` (`brief-links.mjs`), `culturePath`, `cultureImagePath`, `siteOf`.
- Produces: `pageShell({ siteId, lang, head, cssHref, body }) → string` et `esc` (re-exporté) dans `static-shell.mjs` ; `cultureIndexHtml({ siteId, lang, list, bySlug, cssHref })`, `cultureArticleHtml({ siteId, lang, article, list, bySlug, cssHref, now })`, `writeCulturePages(site, dist, articles, cssHref, srcDir, now = Date.now()) → number`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-pages.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { cultureIndexHtml, cultureArticleHtml, writeCulturePages } from '../scripts/lib/culture-pages.mjs'
import { loadCulture } from '../scripts/lib/culture-load.mjs'
import { cultureLangsBySlug } from '../scripts/lib/culture-links.mjs'
import { SITES } from '../sites.config.js'
import { writeArticle, texts, meta } from './helpers/culture-fixture.mjs'

const CSS = '/assets/index-abc.css'
const NOW = new Date('2026-10-19T08:00').getTime()
const silent = { warn: () => {} }

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', {
    m: meta('komitas', { agendaEvent: { title: 'Concert <Komitas>', url: 'https://e/1', date: '2026-10-25T20:00', location: 'Genève' } }),
    t: texts({ date: '2026-10-19', title: 'Komitas <script>', frBody: 'Para **gras**.\n\n## Vie\n\n<b>brut</b>' }),
  })
  await writeArticle(dir, 'duduk', {
    m: meta('duduk', { candidates: [], imageChoice: null, image: null }),
    t: { ...texts({ date: '2026-10-12', title: 'Duduk' }), ru: null },
    images: false,
  })
  return { dir, list: await loadCulture(dir, silent) }
}

test('page article : texte échappé, Markdown rendu, image créditée, sources, IA', async () => {
  const { list } = await fixture()
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[0], list, bySlug: cultureLangsBySlug(list), cssHref: CSS, now: NOW })
  assert.ok(html.includes('<html lang="fr">'))
  assert.ok(html.includes('Komitas &lt;script&gt;'))
  assert.ok(!html.includes('<script>alert'))
  assert.ok(html.includes('<strong>gras</strong>'))
  assert.ok(html.includes('<h2>Vie</h2>'))
  assert.ok(html.includes('&lt;b&gt;brut&lt;/b&gt;'))
  assert.ok(html.includes('src="/culture/komitas/image.webp"'))
  assert.ok(html.includes('CC BY-SA 4.0'))
  assert.ok(html.includes('href="https://fr.wikipedia.org/wiki/Komitas"'))
  assert.ok(html.includes('Article rédigé avec un outil d’IA'))
  assert.ok(html.includes('href="/culture/"'), 'lien Culture dans la nav')
  assert.ok(html.includes(`href="${CSS}"`))
})

test('événement : affiché s’il est à venir, masqué sinon', async () => {
  const { list } = await fixture()
  const args = { siteId: 'ch', lang: 'fr', article: list[0], list, bySlug: cultureLangsBySlug(list), cssHref: CSS }
  assert.ok(cultureArticleHtml({ ...args, now: NOW }).includes('Concert &lt;Komitas&gt;'))
  assert.ok(!cultureArticleHtml({ ...args, now: new Date('2026-11-01').getTime() }).includes('Concert'))
})

test('« À lire aussi » : sans l’article lui-même, seulement la langue de la page', async () => {
  const { list } = await fixture()
  const bySlug = cultureLangsBySlug(list)
  const fr = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[0], list, bySlug, cssHref: CSS, now: NOW })
  assert.ok(fr.includes('href="/culture/duduk/"'))
  assert.ok(!fr.includes('culture-card"><a href="/culture/komitas/"'))
  const ru = cultureArticleHtml({ siteId: 'org', lang: 'ru', article: list[0], list, bySlug, cssHref: CSS, now: NOW })
  assert.ok(!ru.includes('/ru/culture/duduk/'), 'duduk n’existe pas en russe')
})

test('article sans image : motif, pas de <img>', async () => {
  const { list } = await fixture()
  const html = cultureArticleHtml({ siteId: 'ch', lang: 'fr', article: list[1], list, bySlug: cultureLangsBySlug(list), cssHref: CSS, now: NOW })
  assert.ok(html.includes('culture__figure--motif'))
  assert.ok(!html.includes('<img'))
})

test('index : cartes de la langue ; vide → noindex', async () => {
  const { list } = await fixture()
  const bySlug = cultureLangsBySlug(list)
  const fr = cultureIndexHtml({ siteId: 'ch', lang: 'fr', list, bySlug, cssHref: CSS })
  assert.ok(fr.includes('href="/culture/komitas/"') && fr.includes('href="/culture/duduk/"'))
  assert.ok(!fr.includes('noindex'))
  const vide = cultureIndexHtml({ siteId: 'org', lang: 'ru', list: [], bySlug: new Map(), cssHref: CSS })
  assert.ok(vide.includes('noindex, follow'))
})

test('writeCulturePages : langues de la vitrine seulement, images copiées', async () => {
  const { dir, list } = await fixture()
  const dist = await mkdtemp(path.join(tmpdir(), 'dist-'))
  const n = await writeCulturePages(SITES.org, dist, list, CSS, dir, NOW)
  // .org : index en/hy/ru (3) + komitas en/hy/ru (3) + duduk en/hy (2)
  assert.equal(n, 8)
  await access(path.join(dist, 'hy/culture/komitas/index.html'))
  await access(path.join(dist, 'culture/komitas/image.jpg'))
  await access(path.join(dist, 'culture/komitas/image.webp'))
  await assert.rejects(access(path.join(dist, 'ru/culture/duduk/index.html')))
  await assert.rejects(access(path.join(dist, 'culture/duduk/image.jpg')))
  const ch = await mkdtemp(path.join(tmpdir(), 'dist-'))
  assert.equal(await writeCulturePages(SITES.ch, ch, list, CSS, dir, NOW), 3)
  assert.match(await readFile(path.join(ch, 'culture/index.html'), 'utf-8'), /<html lang="fr">/)
})

test('chaque font-family .culture est suivie de son font-size-adjust', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf-8')
  const start = css.indexOf('/* === Culture')
  assert.ok(start > 0, 'bloc Culture présent')
  const lines = css.slice(start).split('\n')
  lines.forEach((l, i) => {
    const m = l.match(/font-family: var\(--font-(display|body|mono)\)/)
    if (!m) return
    const fsa = { display: 'display', body: 'body', mono: 'util' }[m[1]]
    assert.match(lines[i + 1], new RegExp(`font-size-adjust: var\\(--fsa-${fsa}\\)`), `ligne ${i}`)
  })
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-pages.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : extraire la coquille commune**

Créer `scripts/lib/static-shell.mjs` avec la fonction `shell` **déplacée telle quelle** depuis `brief-pages.mjs`, renommée `pageShell`, avec un lien Culture ajouté à la nav :

```js
// La coquille HTML des pages statiques (brève, Culture) : même feuille CSS
// hachée, theme-init.js, balises GA et Cloudflare de la vitrine, et une nav
// commune. Une seule copie — deux coquilles divergeraient (nav, balises).
import { pathFor, langPath, briefPath, culturePath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'
import { beaconTag, gaTag } from './site-meta.mjs'
import { esc } from './culture-markdown.mjs'

export { esc }

export function pageShell({ siteId, lang, head, cssHref, body }) {
  const s = BRIEF_STRINGS[lang]
  const nav = [
    [langPath(siteId, lang), s.home],
    [pathFor(lang, 'radio'), s.radio],
    [pathFor(lang, 'agenda'), s.agenda],
    [briefPath(lang), s.nav],
    [culturePath(lang), CULTURE_STRINGS[lang].nav],
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
```

Dans `scripts/lib/brief-pages.mjs` : supprimer la constante `esc` et la fonction `shell` ; retirer `beaconTag, gaTag` de l'import de `site-meta.mjs` et `pathFor, langPath` de l'import de `sites.config.js` s'ils ne servent plus ailleurs dans le fichier (vérifier avec `grep -n "pathFor\|langPath" scripts/lib/brief-pages.mjs`) ; ajouter `import { esc, pageShell } from './static-shell.mjs'` ; remplacer les deux appels `shell({` par `pageShell({`.

Run: `node --test test/brief-pages.test.mjs test/brief-links-ui.test.mjs`
Expected: PASS. Si un test vérifie la liste exacte des liens de nav, y ajouter le lien Culture attendu (`/culture/`), sans rien retirer.

- [ ] **Step 4 : écrire `culture-pages.mjs`**

```js
// scripts/lib/culture-pages.mjs
/**
 * Les pages de la section Culture — HTML complets écrits au build, hors du
 * bundle React et hors du prérendu, sur le modèle de brief-pages.mjs : même
 * coquille (static-shell.mjs), même feuille CSS, en-tête par site-meta.mjs
 * (cultureHeadFor).
 *
 * L'image d'un article est copiée UNE fois par vitrine, à /culture/<slug>/.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { culturePath, cultureImagePath, siteOf } from '../../sites.config.js'
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'
import { cultureHeadFor } from './site-meta.mjs'
import { cultureLangsBySlug } from './culture-links.mjs'
import { longDate } from './brief-links.mjs'
import { renderMarkdown } from './culture-markdown.mjs'
import { esc, pageShell } from './static-shell.mjs'

const card = (lang) => (x) =>
  `<li class="culture-card"><a href="${culturePath(lang, x.slug)}"><span class="culture-card__title">${esc(x.langs[lang].title)}</span><span class="culture-card__desc">${esc(x.langs[lang].description)}</span></a></li>`

function figure(lang, article) {
  const img = article.image
  if (!img) return '<div class="culture__figure culture__figure--motif" aria-hidden="true"></div>'
  const s = CULTURE_STRINGS[lang]
  return `<figure class="culture__figure">
        <img src="${cultureImagePath(article.slug, 'webp')}" alt="${esc(article.langs[lang].title)}" width="${Number(img.width) || 1200}" height="${Number(img.height) || 800}" decoding="async">
        <figcaption class="culture__credit">${esc(s.image)} : ${esc(img.author)} — <a href="${esc(img.commonsUrl)}" rel="noopener">${esc(img.license)}</a></figcaption>
      </figure>`
}

function eventBlock(lang, ev, now) {
  if (!ev?.url || !ev?.title || !ev?.date) return ''
  if (!(new Date(ev.date).getTime() >= now)) return ''
  const s = CULTURE_STRINGS[lang]
  return `<p class="culture__event">${esc(s.event)} : <a href="${esc(ev.url)}" rel="noopener">${esc(ev.title)}</a> — ${esc(longDate(lang, ev.date.slice(0, 10)))}${ev.location ? `, ${esc(ev.location)}` : ''}</p>`
}

export function cultureArticleHtml({ siteId, lang, article, list, bySlug, cssHref, now = Date.now() }) {
  const s = CULTURE_STRINGS[lang]
  const a = article.langs[lang]
  const sources = article.sources
    .map((x) => `<li><a href="${esc(x.url)}" rel="noopener">${esc(x.title ?? x.url)}</a>${x.lang ? ` (Wikipedia ${esc(x.lang)})` : ''}</li>`)
    .join('')
  const more = list
    .filter((x) => x.slug !== article.slug && x.langs[lang])
    .slice(0, 3)
    .map(card(lang))
    .join('')
  const body = `    <main class="container culture" data-culture="${article.slug}">
      <p class="culture__kicker"><a href="${culturePath(lang)}">${esc(s.title)}</a></p>
      <h1 class="culture__title">${esc(a.title)}</h1>
      <p class="culture__date"><time datetime="${a.date}">${esc(longDate(lang, a.date))}</time></p>
      ${figure(lang, article)}
      <div class="culture__body">
${renderMarkdown(a.body)}
      </div>
      ${eventBlock(lang, article.meta?.agendaEvent, now)}
      <section class="culture__sources">
        <h2>${esc(s.sources)}</h2>
        <ul>${sources}</ul>
        <p>${esc(s.sourcesNote)}</p>
        <p>${esc(s.aiNote)}</p>
      </section>
      ${more ? `<section class="culture__more"><h2>${esc(s.readAlso)}</h2><ul class="culture-list">${more}</ul></section>` : ''}
    </main>`
  const head = cultureHeadFor({ siteId, lang, slug: article.slug, article, bySlug })
  return pageShell({ siteId, lang, head, cssHref, body })
}

export function cultureIndexHtml({ siteId, lang, list, bySlug, cssHref }) {
  const s = CULTURE_STRINGS[lang]
  const items = list.filter((x) => x.langs[lang])
  const content = items.length
    ? `<ul class="culture-list">${items.map(card(lang)).join('')}</ul>`
    : `<p class="culture__intro">${esc(s.empty)}</p>`
  const body = `    <main class="container culture" data-culture="index">
      <h1 class="culture__title">${esc(s.title)}</h1>
      <p class="culture__intro">${esc(s.description)}</p>
      ${content}
    </main>`
  const head = cultureHeadFor({ siteId, lang, bySlug, robots: items.length ? null : 'noindex, follow' })
  return pageShell({ siteId, lang, head, cssHref, body })
}

// Les pages d'UNE vitrine : seulement ses langues. Les images ne sont copiées
// que pour les articles publiés dans au moins une de ses langues.
export async function writeCulturePages(site, dist, articles, cssHref, srcDir, now = Date.now()) {
  const bySlug = cultureLangsBySlug(articles)
  let n = 0
  const put = async (rel, html) => {
    const dir = path.join(dist, rel.replace(/^\/|\/$/g, ''))
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    n++
  }
  const langs = site.pages.map((p) => p.lang).filter((l) => siteOf(l) === site.id)
  for (const lang of langs) {
    await put(culturePath(lang), cultureIndexHtml({ siteId: site.id, lang, list: articles, bySlug, cssHref }))
    for (const article of articles.filter((a) => a.langs[lang]))
      await put(
        culturePath(lang, article.slug),
        cultureArticleHtml({ siteId: site.id, lang, article, list: articles, bySlug, cssHref, now }),
      )
  }
  for (const a of articles) {
    if (!a.image || !langs.some((l) => a.langs[l])) continue
    for (const ext of ['webp', 'jpg']) {
      const to = path.join(dist, cultureImagePath(a.slug, ext).replace(/^\//, ''))
      await mkdir(path.dirname(to), { recursive: true })
      await copyFile(path.join(srcDir, a.slug, `image.${ext}`), to)
    }
  }
  return n
}
```

- [ ] **Step 5 : ajouter les styles**

À la fin de `src/styles/global.css` (après le bloc `@media (pointer: coarse)` de la brève), ajouter :

```css
/* === Culture (pages statiques, scripts/lib/culture-pages.mjs, et bloc
   « À lire » de l'accueil, CultureTeaser.jsx) ===
   Convention du fichier : chaque font-family est suivie de son
   font-size-adjust. */
.culture {
  max-width: 46rem;
  padding-block: 40px 64px;
}
.culture__kicker {
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0;
}
.culture__kicker a {
  color: var(--apricot-ink);
  text-decoration: none;
}
.culture__title {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-size: clamp(1.9rem, 5vw, 2.8rem);
  line-height: 1.1;
  margin: 0.2em 0 0.3em;
  text-wrap: balance;
}
.culture__date,
.culture__credit,
.culture__sources,
.culture__event {
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.8rem;
  color: var(--text-faint);
}
.culture__intro {
  font-family: var(--font-body);
  font-size-adjust: var(--fsa-body);
  font-size: 1.08rem;
  line-height: 1.6;
  color: var(--text-soft);
  margin: 0 0 2em;
}
.culture__figure {
  margin: 1.6em 0;
}
.culture__figure img {
  display: block;
  width: 100%;
  height: auto;
}
.culture__figure--motif {
  aspect-ratio: 1200 / 630;
  border: 1px solid var(--line);
  background: repeating-linear-gradient(45deg, var(--line) 0 1px, transparent 1px 14px);
}
.culture__credit {
  margin-top: 0.5em;
}
.culture__body {
  font-family: var(--font-body);
  font-size-adjust: var(--fsa-body);
  font-size: 1.08rem;
  line-height: 1.7;
}
.culture__body h2,
.culture__body h3,
.culture__sources h2,
.culture__more h2 {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  line-height: 1.25;
  margin: 1.6em 0 0.5em;
}
.culture__body h2 {
  font-size: 1.45rem;
}
.culture__body h3,
.culture__sources h2,
.culture__more h2 {
  font-size: 1.2rem;
}
.culture__body a,
.culture__credit a,
.culture__sources a,
.culture__event a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid var(--line-apricot);
}
.culture__body a:hover,
.culture__credit a:hover,
.culture__sources a:hover,
.culture__event a:hover {
  color: var(--apricot-ink);
}
.culture__event {
  margin: 2em 0;
  padding: 1em;
  border: 1px solid var(--line-apricot);
}
.culture__sources {
  margin-top: 2.4em;
  border-top: 1px solid var(--line);
}
.culture__sources ul {
  padding-left: 1.2em;
}
.culture-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
}
.culture-card a {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  height: 100%;
  padding: 1em;
  border: 1px solid var(--line);
  color: var(--text);
  text-decoration: none;
}
.culture-card a:hover,
.culture-card a:focus-visible {
  border-color: var(--line-apricot);
}
.culture-card__title {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-size: 1.2rem;
  line-height: 1.25;
}
.culture-card__desc {
  font-family: var(--font-body);
  font-size-adjust: var(--fsa-body);
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-soft);
}
.culture-teaser {
  padding-block: 48px;
}
.culture-teaser__title {
  font-family: var(--font-display);
  font-size-adjust: var(--fsa-display);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  margin: 0 0 0.8em;
}
.culture-teaser__all {
  display: inline-block;
  margin-top: 1.2em;
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--apricot-ink);
  text-decoration: none;
}
@media (pointer: coarse) {
  .culture-teaser__all {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
}
```

- [ ] **Step 6 : lancer et constater la réussite**

Run: `node --test test/culture-pages.test.mjs test/brief-pages.test.mjs`
Expected: PASS.

- [ ] **Step 7 : commit**

```bash
git add scripts/lib/static-shell.mjs scripts/lib/culture-pages.mjs scripts/lib/brief-pages.mjs src/styles/global.css test/culture-pages.test.mjs
git commit -m "Culture : pages index et article, coquille commune avec la brève, styles"
```

---

### Task 8 : intégration au build, au sitemap, au contrôle et à la sonde

**Files:**
- Modify: `scripts/lib/sitemap.mjs` (`sitemapFor`, ajout de `cultureEntries`)
- Modify: `scripts/build-sites.mjs` (fin du fichier, vers les lignes 148-185)
- Modify: `scripts/check-build.mjs` (filtre du sitemap vers la ligne 352, et nouvelle section après celle des brèves)
- Modify: `.github/workflows/hourly.yml` (étape « Sonder la production »)
- Test: `test/culture-sitemap.test.mjs`

**Interfaces:**
- Consumes: `loadCulture` (Task 4), `writeCulturePages` (Task 7), `cultureLangsBySlug`, `cultureAlternates`, `cultureUrl`, `culturePath`, `cultureImagePath`.
- Produces: `sitemapFor(siteId, lastmod, briefs = {}, culture = [])`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-sitemap.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sitemapFor } from '../scripts/lib/sitemap.mjs'

const A = (slug, date, langs) => ({
  slug, date, image: null, sources: [], meta: {},
  langs: Object.fromEntries(langs.map((l) => [l, { title: slug, description: 'd', date, body: 'b' }])),
})
const culture = [A('duduk', '2026-10-26', ['fr', 'en', 'hy']), A('komitas', '2026-10-19', ['fr', 'en', 'hy', 'ru'])]

test('sitemap .org : index et articles par langue, hreflang des langues présentes', () => {
  const xml = sitemapFor('org', '2026-10-27T10:00:00Z', {}, culture)
  assert.ok(xml.includes('<loc>https://armenianews.org/culture/</loc>'))
  assert.ok(xml.includes('<loc>https://armenianews.org/ru/culture/komitas/</loc>'))
  assert.ok(!xml.includes('<loc>https://armenianews.org/ru/culture/duduk/</loc>'))
  assert.ok(!xml.includes('<loc>https://armenieinfo.ch/'))
  const duduk = xml.split('<url>').find((b) => b.includes('<loc>https://armenianews.org/culture/duduk/</loc>'))
  assert.ok(duduk.includes('<lastmod>2026-10-26</lastmod>'))
  assert.ok(!duduk.includes('hreflang="ru"'))
  assert.ok(duduk.includes('hreflang="x-default" href="https://armenianews.org/culture/duduk/"'))
})

test('sitemap : un index de langue sans article n’est pas listé (il est noindex)', () => {
  const xml = sitemapFor('org', '2026-10-27T10:00:00Z', {}, [A('x', '2026-10-01', ['fr'])])
  assert.ok(!xml.includes('/culture/'))
  const ch = sitemapFor('ch', '2026-10-27T10:00:00Z', {}, [A('x', '2026-10-01', ['fr'])])
  assert.ok(ch.includes('<loc>https://armenieinfo.ch/culture/x/</loc>'))
})

test('sitemap sans culture : inchangé', () => {
  assert.equal(sitemapFor('ch', '2026-10-27T10:00:00Z', {}), sitemapFor('ch', '2026-10-27T10:00:00Z', {}, []))
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-sitemap.test.mjs`
Expected: FAIL — aucune entrée `/culture/`.

- [ ] **Step 3 : implémenter le sitemap**

Dans `scripts/lib/sitemap.mjs`, ajouter `cultureUrl` à l'import de `sites.config.js`, puis :

```js
import { cultureLangsBySlug, cultureAlternates } from './culture-links.mjs'

// Les articles Culture : l'index d'une langue s'il a au moins un article (vide,
// il est en noindex — le lister serait contradictoire), et chaque article
// présent dans cette langue, avec les mêmes alternates que son <head>.
// lastmod = la date de l'article (il ne change plus une fois publié).
function cultureEntries(site, culture) {
  const bySlug = cultureLangsBySlug(culture)
  return site.pages.flatMap(({ lang }) => {
    const mine = culture.filter((a) => a.langs[lang])
    if (!mine.length) return []
    return [
      `  <url>
    <loc>${cultureUrl(lang)}</loc>
    <lastmod>${mine[0].date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
${xhtml(cultureAlternates(null, bySlug))}
  </url>`,
      ...mine.map(
        (a) => `  <url>
    <loc>${cultureUrl(lang, a.slug)}</loc>
    <lastmod>${a.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
${xhtml(cultureAlternates(a.slug, bySlug))}
  </url>`,
      ),
    ]
  })
}
```

Puis changer la signature et la liste :

```js
export function sitemapFor(siteId, lastmod, briefs = {}, culture = []) {
```

et ajouter `...cultureEntries(site, culture),` après `...briefEntries(site, lastmod, briefs),`.

Run: `node --test test/culture-sitemap.test.mjs test/sitemap.test.mjs`
Expected: PASS (si `test/sitemap.test.mjs` n'existe pas, lancer `node --test test/*.mjs` en entier).

- [ ] **Step 4 : brancher le build**

Dans `scripts/build-sites.mjs` :

```js
import { loadCulture } from './lib/culture-load.mjs'
import { writeCulturePages } from './lib/culture-pages.mjs'
```

Après `writeBriefs`, ajouter :

```js
// Les articles Culture : HTML statiques, comme la brève. Un article invalide
// a déjà été écarté par loadCulture (avertissement au log) — le build ne
// casse jamais à cause du contenu. Voir scripts/lib/culture-pages.mjs.
const CULTURE_DIR = path.join(root, 'src/data/culture')
async function writeCulture(site, culture) {
  const dist = path.join(root, 'dist', site.id)
  const built = await readFile(path.join(dist, 'index.html'), 'utf-8')
  const n = await writeCulturePages(site, dist, culture, cssHrefFrom(built), CULTURE_DIR)
  console.log(`  → dist/${site.id} : ${n} pages Culture`)
}
```

Modifier `writeSeoFiles` pour recevoir et transmettre `culture` :

```js
async function writeSeoFiles(site, stamp, briefs, culture) {
  const dist = path.join(root, 'dist', site.id)
  await writeFile(path.join(dist, 'sitemap.xml'), sitemapFor(site.id, stamp, briefs, culture), 'utf-8')
```

Et la boucle finale :

```js
const stamp = await lastmod()
const briefs = await loadBriefs(path.join(root, 'src/data/briefs'))
const culture = await loadCulture(CULTURE_DIR)

for (const site of Object.values(SITES)) {
  viteBuild(site.id)
  await derivePages(site)
  await copyStandalone(site)
  await writeBriefs(site, briefs)
  await writeCulture(site, culture)
  await writeSeoFiles(site, stamp, briefs, culture)
}
```

- [ ] **Step 5 : brancher le contrôle**

Dans `scripts/check-build.mjs` :

1. Ajouter `cultureUrl, culturePath, cultureImagePath` à l'import de `sites.config.js`, et :

```js
import { loadCulture } from './lib/culture-load.mjs'
import { cultureLangsBySlug, cultureAlternates } from './lib/culture-links.mjs'
```

2. Dans le filtre des entrées de vue du sitemap, remplacer `/<loc>[^<]*\/(breve|brief)\//` par `/<loc>[^<]*\/(breve|brief|culture)\//` et mettre à jour le commentaire : « Les entrées de la brève et de Culture sont variables ».

3. Après le bloc des brèves (avant `if (bad) {`), ajouter :

```js
// Les pages Culture : chaque page attendue existe, dans sa langue, avec SON
// canonical, un hreflang égal à cultureAlternates (sans langue absente pour
// cet article), sans le domaine voisin, listée au sitemap (sauf un index vide,
// qui est noindex), et l'image d'un article existe vraiment dans dist/ — une
// og:image parfaite sur un fichier absent sert un 404 aux réseaux.
{
  const culture = await loadCulture(path.join(root, 'src/data/culture'), { warn: () => {} })
  const bySlug = cultureLangsBySlug(culture)
  for (const site of Object.values(SITES)) {
    const other = Object.values(SITES).find((s) => s.id !== site.id).host
    const sitemap = await readFile(path.join(root, 'dist', site.id, 'sitemap.xml'), 'utf-8').catch(() => '')
    for (const { lang } of site.pages) {
      const mine = culture.filter((a) => a.langs[lang])
      for (const slug of [null, ...mine.map((a) => a.slug)]) {
        const rel = path.join('dist', site.id, culturePath(lang, slug).replace(/^\//, ''), 'index.html')
        const html = await readFile(path.join(root, rel), 'utf-8').catch(() => null)
        const fail = (why) => { console.error(`✗ ${rel} — ${why}`); bad++ }
        if (!html) { fail('absent'); continue }
        if (!html.includes(`<html lang="${lang}">`)) fail(`<html lang="${lang}"> manquant`)
        if (!html.includes(`<link rel="canonical" href="${cultureUrl(lang, slug)}" />`)) fail('canonical')
        const got = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])
        if (JSON.stringify(got) !== JSON.stringify(cultureAlternates(slug, bySlug))) fail('hreflang')
        const foreign = html.replaceAll(/<link rel="alternate"[^>]+>/g, '')
        if (foreign.includes(`href="${other}`)) fail(`cite ${other}`)
        if (mine.length && !sitemap.includes(`<loc>${cultureUrl(lang, slug)}</loc>`)) fail('absente du sitemap')
        const article = slug && mine.find((a) => a.slug === slug)
        if (article?.image) {
          for (const ext of ['webp', 'jpg']) {
            const img = path.join(root, 'dist', site.id, cultureImagePath(slug, ext).replace(/^\//, ''))
            await access(img).catch(() => fail(`image.${ext} absente de dist`))
          }
        }
      }
    }
  }
  console.log('✓ pages Culture contrôlées')
}
```

Vérifier que `access` est importé de `node:fs/promises` en tête de `check-build.mjs` ; sinon l'ajouter à l'import existant.

- [ ] **Step 6 : ajouter la sonde de production**

Dans `.github/workflows/hourly.yml`, étape « Sonder la production », renommer en `Sonder la production (404 francs, slugs jumeaux, brève, culture)` et ajouter après les deux sondes de brève :

```bash
          probe "https://armenieinfo.ch/culture/" 200 || fail=1
          probe "https://armenianews.org/culture/" 200 || fail=1
```

- [ ] **Step 7 : vérifier de bout en bout sans article**

Run: `npm run build && npm run check`
Expected: le build écrit `1 pages Culture` sur le .ch (index fr, vide) et `3 pages Culture` sur le .org (index en/hy/ru, vides) ; `npm run check` affiche `✓ pages Culture contrôlées` et se termine par `✓ toutes les pages sont conformes`.

- [ ] **Step 8 : lancer toute la suite**

Run: `npm test`
Expected: PASS, aucun test existant cassé.

- [ ] **Step 9 : commit**

```bash
git add scripts/lib/sitemap.mjs scripts/build-sites.mjs scripts/check-build.mjs .github/workflows/hourly.yml test/culture-sitemap.test.mjs
git commit -m "Culture : pages au build, sitemap, contrôle de dist et sonde de production"
```

---

### Task 9 : liens entrants et bloc « À lire » de l'accueil

**Files:**
- Modify: `src/components/Nav.jsx` (imports l. 4-5, tableau `links` vers la l. 41)
- Modify: `src/components/Footer.jsx` (imports l. 2-3, tableau `pages` vers la l. 32)
- Modify: `scripts/lib/not-found.mjs` (imports l. 21-22, liste `links` vers la l. 69)
- Create: `src/components/CultureTeaser.jsx`
- Modify: `vite.config.js` (plugin `cultureTeaser`, liste `plugins`)
- Modify: `src/App.jsx` (import, `<CultureTeaser />` après `<News />`)
- Test: `test/culture-links-ui.test.mjs`

**Interfaces:**
- Consumes: `culturePath`, `CULTURE_STRINGS`, `loadCulture` (Task 4), `teaserFor` (Task 4).
- Produces: module virtuel `virtual:culture-teaser` → `export default { [lang]: { slug, title, description, date }[] }` (langues de la vitrine seulement) ; composant `CultureTeaser`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-links-ui.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { notFoundHtml } from '../scripts/lib/not-found.mjs'

// Node ne sait pas importer du JSX : on lit les composants comme du texte,
// comme test/brief-links-ui.test.mjs. Une section sans lien entrant ne
// reçoit ni lecteur ni PageRank interne.
const src = (f) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf-8')

for (const f of ['components/Nav.jsx', 'components/Footer.jsx']) {
  test(`${f} lie la section Culture`, async () => {
    const s = await src(f)
    assert.match(s, /culturePath\(lang\)/)
    assert.match(s, /CULTURE_STRINGS\[lang\]/)
  })
}

test('l’accueil monte le bloc « À lire »', async () => {
  const s = await src('App.jsx')
  assert.match(s, /<CultureTeaser \/>/)
  assert.match(await src('components/CultureTeaser.jsx'), /virtual:culture-teaser/)
})

test('vite.config.js déclare le module virtuel', async () => {
  const s = await readFile(new URL('../vite.config.js', import.meta.url), 'utf-8')
  assert.match(s, /cultureTeaser\(\)/)
})

test('la 404 lie la section Culture dans chaque langue de la vitrine', () => {
  const org = notFoundHtml('org')
  for (const p of ['/culture/', '/hy/culture/', '/ru/culture/']) assert.ok(org.includes(`href="${p}"`), p)
  assert.ok(notFoundHtml('ch').includes('href="/culture/"'))
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-links-ui.test.mjs`
Expected: FAIL.

- [ ] **Step 3 : liens de nav, pied de page, 404**

`src/components/Nav.jsx` — imports :

```js
import { LANG_URL, langPath, pathFor, briefPath, culturePath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../briefStrings.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'
```

et dans `links`, juste après la ligne de la brève :

```js
    [culturePath(lang), CULTURE_STRINGS[lang].nav],
```

`src/components/Footer.jsx` — imports :

```js
import { pathFor, briefPath, culturePath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../briefStrings.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'
```

et dans `pages`, juste après la ligne de la brève :

```js
    [culturePath(lang), CULTURE_STRINGS[lang].title],
```

`scripts/lib/not-found.mjs` — ajouter `culturePath` à l'import de `sites.config.js`, `import { CULTURE_STRINGS } from '../../src/cultureStrings.js'`, et après la ligne de la brève dans `links` :

```js
        [culturePath(p.lang), CULTURE_STRINGS[p.lang].title],
```

- [ ] **Step 4 : module virtuel et composant**

Dans `vite.config.js`, ajouter aux imports :

```js
import { loadCulture } from './scripts/lib/culture-load.mjs'
import { teaserFor } from './scripts/lib/culture-links.mjs'
```

puis, après `lightData()` :

```js
// Le bloc « À lire » de l'accueil : les 3 derniers articles Culture de chaque
// langue de CETTE vitrine — titres et descriptions seulement, comme
// lightData() n'embarque que les langues servies. Les avertissements d'un
// article invalide sont déjà écrits par build-sites.mjs : ici, silence.
function cultureTeaser() {
  const ID = 'virtual:culture-teaser'
  const langs = SITES[SITE_ID].pages.map((p) => p.lang)
  return {
    name: 'culture-teaser',
    resolveId(id) {
      return id === ID ? `\0${ID}` : null
    },
    async load(id) {
      if (id !== `\0${ID}`) return null
      const articles = await loadCulture(join(__dirname, 'src/data/culture'), { warn: () => {} })
      return `export default ${JSON.stringify(teaserFor(articles, langs))}`
    },
  }
}
```

et `plugins: [react(), lightData(), cultureTeaser(), siteMeta(), agendaEventsJsonLd()],`.

Créer `src/components/CultureTeaser.jsx` :

```jsx
import TEASER from 'virtual:culture-teaser'
import { useI18n } from '../i18n.jsx'
import { culturePath } from '../../sites.config.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'

// Les 3 derniers articles Culture de la langue (module virtuel de
// vite.config.js). Rien à afficher → rien de rendu : pas de section vide.
export function CultureTeaser() {
  const { lang } = useI18n()
  const items = TEASER[lang] ?? []
  if (!items.length) return null
  const s = CULTURE_STRINGS[lang]
  return (
    <section className="culture-teaser container" id="culture" aria-labelledby="culture-teaser-title">
      <h2 id="culture-teaser-title" className="culture-teaser__title">
        {s.teaser}
      </h2>
      <ul className="culture-list">
        {items.map((x) => (
          <li key={x.slug} className="culture-card">
            <a href={culturePath(lang, x.slug)}>
              <span className="culture-card__title">{x.title}</span>
              <span className="culture-card__desc">{x.description}</span>
            </a>
          </li>
        ))}
      </ul>
      <a className="culture-teaser__all" href={culturePath(lang)}>
        {s.all} →
      </a>
    </section>
  )
}
```

Dans `src/App.jsx` : `import { CultureTeaser } from './components/CultureTeaser.jsx'` et, dans `<main>`, `<CultureTeaser />` juste après `<News />`.

- [ ] **Step 5 : lancer tests, lint, build**

Run: `node --test test/culture-links-ui.test.mjs && npm run lint && npm run build && npm run check`
Expected: tests PASS ; lint `0 errors, 5 warnings` (si `react-refresh` ou l'import virtuel ajoutent un avertissement, le corriger — ne pas l'accepter) ; build et check verts.

- [ ] **Step 6 : commit**

```bash
git add src/components/Nav.jsx src/components/Footer.jsx scripts/lib/not-found.mjs src/components/CultureTeaser.jsx vite.config.js src/App.jsx test/culture-links-ui.test.mjs
git commit -m "Culture : liens depuis la nav, le pied de page, la 404 et bloc « À lire » de l'accueil"
```

---

### Task 10 : client du modèle et prompts

**Files:**
- Create: `scripts/lib/culture-llm.mjs`, `scripts/lib/culture-prompts.mjs`
- Test: `test/culture-llm.test.mjs`, `test/culture-prompts.test.mjs`

**Interfaces:**
- Produces:
  - `DEFAULT_BASE_URL`, `DEFAULT_MODEL`, `LLM_TIMEOUT_MS`, `llmConfig(env) → { baseUrl, model, apiKey }`, `chat({ messages, baseUrl, model, apiKey, fetchImpl, timeoutMs, temperature }) → Promise<{ text, model }>` (lève sur non-200 ou réponse vide).
  - `MAX_EXTRACT = 24000`, `buildDraftMessages({ topic, sources, facts, event })`, `buildClaimsMessages(body)`, `buildTranslateMessages({ lang, title, description, body })`, `buildIdeasMessages(existingTitles)`, `parseArticleJson(text) → { title, description, body } | null`, `parseClaims(text) → string[]`, `parseIdeas(text) → { title, wikipedia_fr, wikipedia_en, keywords }[]`, `findUnsupported(claims, sourceTexts) → string[]`.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
// test/culture-llm.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chat, llmConfig, DEFAULT_BASE_URL, DEFAULT_MODEL } from '../scripts/lib/culture-llm.mjs'

const fake = (status, body, seen = {}) => async (url, init) => {
  seen.url = url; seen.init = init
  return { ok: status === 200, status, json: async () => body }
}

test('llmConfig : défauts Gemini, surcharges, clé dédiée prioritaire', () => {
  assert.deepEqual(llmConfig({ GEMINI_API_KEY: 'g' }), { baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL, apiKey: 'g' })
  assert.deepEqual(
    llmConfig({ ARTICLES_BASE_URL: 'https://openrouter.ai/api/v1', ARTICLES_MODEL: 'x', ARTICLES_API_KEY: 'a', GEMINI_API_KEY: 'g' }),
    { baseUrl: 'https://openrouter.ai/api/v1', model: 'x', apiKey: 'a' },
  )
})

test('chat : URL composée, en-têtes, modèle réellement servi', async () => {
  const seen = {}
  const r = await chat({
    messages: [{ role: 'user', content: 'x' }], baseUrl: 'https://h/v1beta/openai', model: 'm', apiKey: 'k',
    fetchImpl: fake(200, { model: 'm-002', choices: [{ message: { content: 'ok' } }] }, seen),
  })
  assert.deepEqual(r, { text: 'ok', model: 'm-002' })
  assert.equal(seen.url, 'https://h/v1beta/openai/chat/completions')
  assert.equal(seen.init.headers.Authorization, 'Bearer k')
  assert.equal(JSON.parse(seen.init.body).model, 'm')
})

test('chat : 429, réponse vide, clé absente → erreur sans la clé', async () => {
  const args = { messages: [], baseUrl: 'https://h/', model: 'm', apiKey: 'SECRET' }
  await assert.rejects(chat({ ...args, fetchImpl: fake(429, {}) }), (e) => /HTTP 429/.test(e.message) && !e.message.includes('SECRET'))
  await assert.rejects(chat({ ...args, fetchImpl: fake(200, { choices: [{ message: { content: ' ' } }] }) }), /vide/)
  await assert.rejects(chat({ ...args, apiKey: '' }), /clé API absente/)
})
```

```js
// test/culture-prompts.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDraftMessages, buildClaimsMessages, buildTranslateMessages, buildIdeasMessages,
  parseArticleJson, parseClaims, parseIdeas, findUnsupported, MAX_EXTRACT,
} from '../scripts/lib/culture-prompts.mjs'

const topic = { slug: 'komitas', title: 'Komitas' }
const sources = [{ lang: 'fr', title: 'Komitas', extract: 'Komitas est né en 1869. ' + 'x'.repeat(MAX_EXTRACT) }]

test('brouillon : règles, sources tronquées, faits, événement', () => {
  const [sys, user] = buildDraftMessages({ topic, sources, facts: ['Naissance : 1869-10-08'], event: { title: 'Concert', date: '2026-10-25T20:00', location: 'Genève' } })
  assert.match(sys.content, /UNIQUEMENT les faits/)
  assert.match(sys.content, /700 à 1000 mots/)
  assert.match(sys.content, /"title"/)
  assert.match(user.content, /SUJET : Komitas/)
  assert.match(user.content, /Naissance : 1869-10-08/)
  assert.match(user.content, /« Concert », le 2026-10-25, Genève/)
  assert.ok(user.content.length < MAX_EXTRACT + 2000, 'extrait tronqué')
})

test('parseArticleJson : clôtures, texte autour, description rognée', () => {
  const raw = 'Voici :\n```json\n{"title":" Komitas ","description":"' + 'mot '.repeat(60) + '","body":"A\\n\\n## B"}\n```\nFin.'
  const a = parseArticleJson(raw)
  assert.equal(a.title, 'Komitas')
  assert.ok(a.description.length <= 160 && a.description.endsWith('…'))
  assert.equal(a.body, 'A\n\n## B')
})

test('parseArticleJson : réponse inexploitable → null', () => {
  for (const bad of ['', 'pas de json', '{"title":"t"}', '{"title":"t","description":"d","body":""}', '{cassé'])
    assert.equal(parseArticleJson(bad), null, bad)
})

test('parseClaims : tableau, dédoublonné, borné', () => {
  assert.deepEqual(parseClaims('```json\n["1869", "Kütahya", "1869", 5, ""]\n```'), ['1869', 'Kütahya'])
  assert.deepEqual(parseClaims('rien'), [])
})

test('findUnsupported : chiffres exacts, noms pliés, arménien et russe', () => {
  const src = ['Komitas est né en 1869 à Kütahya. Կոմիտաս. Комитас умер в Париже.']
  assert.deepEqual(findUnsupported(['1869', 'Kutahya', 'Կոմիտաս', 'Париже'], src), [])
  assert.deepEqual(findUnsupported(['1870', '186', 'Erevan', 'Вена'], src), ['1870', '186', 'Erevan', 'Вена'])
  assert.deepEqual(findUnsupported(['Le', 'à'], src), [], 'mots trop courts ignorés')
})

test('traduction : langue cible nommée, fidélité, JSON du texte relu', () => {
  const [sys, user] = buildTranslateMessages({ lang: 'hy', title: 'T', description: 'D', body: '## B' })
  assert.match(sys.content, /arménien oriental/)
  assert.match(sys.content, /n'ajoute, ne retire/)
  assert.deepEqual(JSON.parse(user.content), { title: 'T', description: 'D', body: '## B' })
})

test('idées : titres existants exclus, analyse tolérante', () => {
  const [, user] = buildIdeasMessages(['Komitas'])
  assert.match(user.content, /Komitas/)
  const ideas = parseIdeas('[{"title":"Le tar","wikipedia_fr":"Tar (luth)","wikipedia_en":"Tar (lute)","keywords":["tar"]},{"title":""}]')
  assert.equal(ideas.length, 1)
  assert.equal(ideas[0].wikipedia_en, 'Tar (lute)')
  assert.deepEqual(buildClaimsMessages('x')[1].content, 'x')
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-llm.test.mjs test/culture-prompts.test.mjs`
Expected: FAIL — modules introuvables.

- [ ] **Step 3 : implémenter**

```js
// scripts/lib/culture-llm.mjs
//
// Un client MINIMAL pour tout point d'accès compatible OpenAI (/chat/completions).
// Gemini par défaut (offre gratuite) ; Claude, OpenRouter ou OmniRoute en
// changeant deux variables, sans code — voir la spec, « Pourquoi Gemini Flash ».
// La clé n'est jamais écrite dans un message d'erreur ni dans un log.
export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
export const DEFAULT_MODEL = 'gemini-flash-latest'
export const LLM_TIMEOUT_MS = 180000

export function llmConfig(env = process.env) {
  return {
    baseUrl: env.ARTICLES_BASE_URL || DEFAULT_BASE_URL,
    model: env.ARTICLES_MODEL || DEFAULT_MODEL,
    apiKey: env.ARTICLES_API_KEY || env.GEMINI_API_KEY || '',
  }
}

export async function chat({
  messages, baseUrl, model, apiKey, fetchImpl = fetch, timeoutMs = LLM_TIMEOUT_MS, temperature = 0.4,
}) {
  if (!apiKey) throw new Error('clé API absente (GEMINI_API_KEY ou ARTICLES_API_KEY)')
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature, messages }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} (${model})`)
  const body = await res.json()
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error(`réponse vide (${model})`)
  return { text, model: body?.model || model }
}
```

```js
// scripts/lib/culture-prompts.mjs
//
// Les messages envoyés au modèle et l'analyse de ses réponses. Le modèle ne
// fournit AUCUNE URL publiée : sources, liens et événement sont ajoutés par
// le code (leçon de la brève). Ses réponses sont des JSON qu'on extrait d'un
// texte éventuellement enrobé (clôtures ```json, phrase d'introduction).
export const MAX_EXTRACT = 24000

const LANG_NAME = {
  fr: 'français',
  en: 'anglais',
  hy: 'arménien oriental (orthographe de la République d’Arménie)',
  ru: 'russe',
}

const JSON_SHAPE = 'Réponds UNIQUEMENT par un objet JSON {"title": "…", "description": "… (160 caractères au plus)", "body": "… (Markdown)"}, sans aucun texte autour.'

export function buildDraftMessages({ topic, sources, facts = [], event = null }) {
  const system = [
    "Tu écris un article de fond pour la section Culture d'un site d'information arménien francophone.",
    'Règles absolues :',
    '- Utilise UNIQUEMENT les faits présents dans les SOURCES et FAITS ci-dessous. Une information absente des sources ne doit pas être écrite.',
    '- Construis ton propre plan et ton propre angle : ne suis pas l’ordre des sources et ne recopie aucune phrase.',
    '- 700 à 1000 mots, en français, avec 3 à 5 intertitres « ## ». Gras et italique permis avec parcimonie.',
    '- Ton chaleureux et fier de la culture arménienne, mais aucun superlatif que les sources ne justifient.',
    '- Génocide, Artsakh, conflits : les faits sourcés, sans commentaire ni adjectif.',
    '- Aucun lien, aucune URL dans le texte.',
    event ? '- Termine par un paragraphe qui invite à l’événement à venir indiqué.' : '',
    JSON_SHAPE,
  ]
    .filter(Boolean)
    .join('\n')
  const user = [
    `SUJET : ${topic.title}`,
    event
      ? `ÉVÉNEMENT À VENIR : « ${event.title} », le ${String(event.date).slice(0, 10)}${event.location ? `, ${event.location}` : ''}.`
      : '',
    facts.length ? `FAITS WIKIDATA :\n${facts.map((f) => `- ${f}`).join('\n')}` : '',
    ...sources.map(
      (s, i) => `SOURCE ${i + 1} — Wikipédia (${s.lang}) « ${s.title} » :\n${String(s.extract).slice(0, MAX_EXTRACT)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function buildClaimsMessages(body) {
  return [
    {
      role: 'system',
      content:
        "Liste toutes les dates, tous les nombres et tous les noms propres (personnes, lieux, œuvres, institutions) présents dans le texte, tels qu'ils y sont écrits. Réponds UNIQUEMENT par un tableau JSON de chaînes.",
    },
    { role: 'user', content: body },
  ]
}

export function buildTranslateMessages({ lang, title, description, body }) {
  return [
    {
      role: 'system',
      content: [
        `Tu traduis un article du français vers le ${LANG_NAME[lang]}.`,
        "Traduis fidèlement : n'ajoute, ne retire et ne commente rien.",
        'Garde la structure Markdown à l’identique (intertitres « ## », gras, italique, liens).',
        'Noms propres : la graphie établie dans la langue cible.',
        JSON_SHAPE,
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify({ title, description, body }) },
  ]
}

export function buildIdeasMessages(existingTitles) {
  return [
    {
      role: 'system',
      content:
        "Propose 10 sujets d'articles sur l'histoire, la culture, la danse, la musique, l'architecture ou la gastronomie arméniennes, chacun couvert par un article Wikipédia existant. Réponds UNIQUEMENT par un tableau JSON d'objets {\"title\": \"…\", \"wikipedia_fr\": \"titre exact de l'article Wikipédia français\", \"wikipedia_en\": \"titre exact de l'article Wikipédia anglais\", \"keywords\": [\"…\"]}.",
    },
    { role: 'user', content: `Sujets déjà traités ou prévus, à exclure :\n${existingTitles.map((t) => `- ${t}`).join('\n')}` },
  ]
}

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

function clip(s, max) {
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,.;:]+$/, '')}…`
}

function extract(text, open, close) {
  const s = String(text ?? '')
  const a = s.indexOf(open)
  const b = s.lastIndexOf(close)
  if (a < 0 || b <= a) return null
  try {
    return JSON.parse(s.slice(a, b + 1))
  } catch {
    return null
  }
}

export function parseArticleJson(text) {
  const o = extract(text, '{', '}')
  const title = clean(o?.title)
  const description = clean(o?.description)
  const body = typeof o?.body === 'string' ? o.body.replace(/\r\n/g, '\n').trim() : ''
  if (!title || !description || !body) return null
  return { title, description: clip(description, 160), body }
}

export function parseClaims(text) {
  const a = extract(text, '[', ']')
  if (!Array.isArray(a)) return []
  return [...new Set(a.filter((x) => typeof x === 'string').map(clean).filter((x) => x && x.length <= 80))].slice(0, 150)
}

export function parseIdeas(text) {
  const a = extract(text, '[', ']')
  if (!Array.isArray(a)) return []
  return a
    .filter((x) => clean(x?.title))
    .map((x) => ({
      title: clean(x.title),
      wikipedia_fr: clean(x.wikipedia_fr),
      wikipedia_en: clean(x.wikipedia_en),
      keywords: Array.isArray(x.keywords) ? x.keywords.map(clean).filter(Boolean) : [],
    }))
}

const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

// Les éléments factuels du brouillon introuvables dans les sources : la liste
// ⚠️ en tête de PR. Un nombre doit apparaître EXACTEMENT (1869 ne valide pas
// 186) ; un nom, par chacun de ses mots de 3 lettres ou plus (plié).
export function findUnsupported(claims, sourceTexts) {
  const hay = fold(sourceTexts.join('\n'))
  return claims.filter((c) => {
    const nums = c.match(/\d+/g)
    if (nums) return !nums.every((n) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(hay))
    const words = fold(c)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3)
    return words.length > 0 && !words.every((w) => hay.includes(w))
  })
}
```

- [ ] **Step 4 : lancer et constater la réussite**

Run: `node --test test/culture-llm.test.mjs test/culture-prompts.test.mjs`
Expected: PASS (10 tests).

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/culture-llm.mjs scripts/lib/culture-prompts.mjs test/culture-llm.test.mjs test/culture-prompts.test.mjs
git commit -m "Culture : client compatible OpenAI (Gemini par défaut) et prompts"
```

---

### Task 11 : Wikipédia, Wikidata, Commons et images

**Files:**
- Create: `scripts/lib/culture-sources.mjs`, `scripts/lib/culture-image.mjs`
- Test: `test/culture-sources.test.mjs`, `test/culture-image.test.mjs`

**Interfaces:**
- Consumes: `isFreeLicense` (Task 3).
- Produces:
  - `WIKI_UA`, `stripHtml(s)`, `wikidataTime(value) → string|null`
  - `fetchWikipedia(lang, title, fetchImpl) → { lang, title, url, revision, extract, wikidata, pageImage } | null`
  - `fetchWikidataFacts(qid, fetchImpl) → string[]`
  - `fetchCommonsCandidates({ files, search, limit = 3 }, fetchImpl) → candidate[]` (`candidate = { file, thumbUrl, width, height, author, license, licenseUrl, commonsUrl }`)
  - `downloadImage(url, fetchImpl) → Buffer`
  - `makeImages(buf) → { webp: Buffer, width, height, jpg: Buffer }`

- [ ] **Step 1 : écrire les tests qui échouent**

```js
// test/culture-sources.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchWikipedia, fetchWikidataFacts, fetchCommonsCandidates, downloadImage, wikidataTime, stripHtml, WIKI_UA,
} from '../scripts/lib/culture-sources.mjs'

// Un faux fetch qui route par hôte/paramètre et note les appels.
function router(routes) {
  const calls = []
  const impl = async (url, init) => {
    const u = new URL(url)
    calls.push({ u, init })
    for (const [match, body] of routes)
      if (match(u)) return { ok: true, status: 200, json: async () => body, arrayBuffer: async () => body }
    return { ok: false, status: 404, json: async () => ({}) }
  }
  return { impl, calls }
}

test('fetchWikipedia : extrait, révision, Wikidata, image de tête, UA honnête', async () => {
  const { impl, calls } = router([[(u) => u.host === 'fr.wikipedia.org', {
    query: { pages: [{ title: 'Komitas', extract: 'Texte', revisions: [{ revid: 42 }], pageprops: { wikibase_item: 'Q312' }, pageimage: 'Komitas.jpg' }] },
  }]])
  const r = await fetchWikipedia('fr', 'Komitas', impl)
  assert.deepEqual(r, { lang: 'fr', title: 'Komitas', url: 'https://fr.wikipedia.org/wiki/Komitas', revision: 42, extract: 'Texte', wikidata: 'Q312', pageImage: 'Komitas.jpg' })
  assert.equal(calls[0].init.headers['User-Agent'], WIKI_UA)
  assert.ok(!/Mozilla|Chrome/.test(WIKI_UA))
  assert.equal(calls[0].u.searchParams.get('redirects'), '1')
})

test('fetchWikipedia : page absente ou homonymie → null', async () => {
  const missing = router([[() => true, { query: { pages: [{ title: 'X', missing: true }] } }]])
  assert.equal(await fetchWikipedia('fr', 'X', missing.impl), null)
  const dab = router([[() => true, { query: { pages: [{ title: 'Ani', extract: 'Ani peut désigner', pageprops: { disambiguation: '' } }] } }]])
  assert.equal(await fetchWikipedia('fr', 'Ani', dab.impl), null)
})

test('wikidataTime : précisions jour, mois, année, avant notre ère', () => {
  assert.equal(wikidataTime({ time: '+1869-10-08T00:00:00Z', precision: 11 }), '1869-10-08')
  assert.equal(wikidataTime({ time: '+1869-10-00T00:00:00Z', precision: 10 }), '1869-10')
  assert.equal(wikidataTime({ time: '+1869-00-00T00:00:00Z', precision: 9 }), '1869')
  assert.equal(wikidataTime({ time: '-0301-00-00T00:00:00Z', precision: 9 }), '301 av. J.-C.')
  assert.equal(wikidataTime(null), null)
})

test('fetchWikidataFacts : dates connues, entité redirigée', async () => {
  const { impl } = router([[(u) => u.host === 'www.wikidata.org', {
    entities: { Q999: { claims: {
      P569: [{ mainsnak: { datavalue: { value: { time: '+1869-10-08T00:00:00Z', precision: 11 } } } }],
      P570: [{ mainsnak: { datavalue: { value: { time: '+1935-10-22T00:00:00Z', precision: 11 } } } }],
      P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
    } } },
  }]])
  assert.deepEqual(await fetchWikidataFacts('Q312', impl), ['Naissance : 1869-10-08', 'Décès : 1935-10-22'])
})

const ii = (title, { license = 'CC BY-SA 4.0', artist = '<a href="x">Jean &amp; Paul</a>', width = 2000, mime = 'image/jpeg' } = {}) => ({
  title,
  imageinfo: [{ thumburl: `https://upload.wikimedia.org/${title}`, width, height: 1500, mime, descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
    extmetadata: { LicenseShortName: { value: license }, Artist: { value: artist }, LicenseUrl: { value: 'https://cc/by-sa' } } }],
})

test('fetchCommonsCandidates : ordre (image de tête d’abord), filtres licence/auteur/taille/type', async () => {
  const { impl } = router([
    [(u) => u.searchParams.get('list') === 'search', { query: { search: [{ title: 'File:S1.jpg' }, { title: 'File:NC.jpg' }, { title: 'File:Petit.jpg' }, { title: 'File:Anon.jpg' }, { title: 'File:S2.svg' }, { title: 'File:S3.jpg' }] } }],
    [(u) => u.searchParams.get('prop') === 'imageinfo', { query: { pages: [
      ii('File:S3.jpg'), ii('File:S1.jpg'), ii('File:Lead.jpg'),
      ii('File:NC.jpg', { license: 'CC BY-NC 4.0' }), ii('File:Petit.jpg', { width: 500 }), ii('File:Anon.jpg', { artist: '' }), ii('File:S2.svg', { mime: 'image/svg+xml' }),
    ] } }],
  ])
  const c = await fetchCommonsCandidates({ files: ['Lead.jpg'], search: 'Komitas' }, impl)
  assert.deepEqual(c.map((x) => x.file), ['File:Lead.jpg', 'File:S1.jpg', 'File:S3.jpg'])
  assert.equal(c[0].author, 'Jean & Paul')
  assert.equal(c[0].commonsUrl, 'https://commons.wikimedia.org/wiki/File:Lead.jpg')
})

test('stripHtml décode les entités courantes', () => {
  assert.equal(stripHtml('<span>A&nbsp;&quot;B&quot; &#39;C&#39;</span>\n'), 'A "B" \'C\'')
})

test('downloadImage : refuse une page d’erreur trop petite', async () => {
  const tiny = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(100) })
  await assert.rejects(downloadImage('https://u/x.jpg', tiny), /trop petite/)
  const err = async () => ({ ok: false, status: 403 })
  await assert.rejects(downloadImage('https://u/x.jpg', err), /HTTP 403/)
})
```

```js
// test/culture-image.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { makeImages, PAGE_WIDTH } from '../scripts/lib/culture-image.mjs'

const src = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#c86a3a' } }).withIccProfile('p3').jpeg().toBuffer()

test('carte : JPEG 1200×630, sans profil ICC ; page : WebP ≤ 1200', async () => {
  const out = await makeImages(await src(2400, 1600))
  const card = await sharp(out.jpg).metadata()
  assert.equal(card.format, 'jpeg')
  assert.equal(card.width, 1200)
  assert.equal(card.height, 630)
  assert.equal(card.icc, undefined)
  const page = await sharp(out.webp).metadata()
  assert.equal(page.format, 'webp')
  assert.equal(page.width, PAGE_WIDTH)
  assert.equal(out.width, PAGE_WIDTH)
  assert.equal(out.height, 800)
})

test('petite image : la page ne s’agrandit pas, la carte garde 1200×630', async () => {
  const out = await makeImages(await src(900, 700))
  assert.equal(out.width, 900)
  const card = await sharp(out.jpg).metadata()
  assert.equal(card.width, 1200)
  assert.equal(card.height, 630)
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-sources.test.mjs test/culture-image.test.mjs`
Expected: FAIL — modules introuvables.

- [ ] **Step 3 : implémenter**

```js
// scripts/lib/culture-sources.mjs
//
// La collecte des sources d'un article : Wikipédia (extrait texte, révision,
// élément Wikidata, image de tête), Wikidata (dates clés) et Commons (images
// candidates sous licence libre).
//
// Le User-Agent s'identifie HONNÊTEMENT, avec un contact : c'est la règle de
// Wikimedia, et c'est la leçon de septembre 2026 — un UA qui se dit « Chrome »
// sans en avoir l'empreinte TLS se fait refuser (voir CLAUDE.md).
import { isFreeLicense } from './culture-license.mjs'

export const WIKI_UA = 'ArmenieInfo/1.0 (https://armenieinfo.ch/a-propos/; contact@armenieinfo.ch)'
const HEADERS = { 'User-Agent': WIKI_UA, 'Api-User-Agent': WIKI_UA }

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(String(url), { headers: HEADERS, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`)
  return res.json()
}

function api(host, params) {
  const u = new URL(`https://${host}/w/api.php`)
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: '2', ...params }))
    u.searchParams.set(k, v)
  return u
}

export async function fetchWikipedia(lang, title, fetchImpl = fetch) {
  const j = await getJson(
    api(`${lang}.wikipedia.org`, {
      redirects: '1',
      prop: 'extracts|revisions|pageprops|pageimages',
      explaintext: '1',
      rvprop: 'ids',
      ppprop: 'wikibase_item|disambiguation',
      piprop: 'name',
      titles: title,
    }),
    fetchImpl,
  )
  const p = j?.query?.pages?.[0]
  if (!p || p.missing || p.invalid || !p.extract) return null
  if (p.pageprops && 'disambiguation' in p.pageprops) return null
  return {
    lang,
    title: p.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
    revision: p.revisions?.[0]?.revid ?? null,
    extract: p.extract,
    wikidata: p.pageprops?.wikibase_item ?? null,
    pageImage: p.pageimage ?? null,
  }
}

export function wikidataTime(v) {
  const m = String(v?.time ?? '').match(/^([+-])(\d+)-(\d{2})-(\d{2})/)
  if (!m) return null
  const year = String(Number(m[2]))
  if (m[1] === '-') return `${year} av. J.-C.`
  if (v.precision >= 11) return `${m[2].padStart(4, '0')}-${m[3]}-${m[4]}`
  if (v.precision === 10) return `${m[2].padStart(4, '0')}-${m[3]}`
  return year
}

const TIME_PROPS = {
  P569: 'Naissance',
  P570: 'Décès',
  P571: 'Fondation ou création',
  P577: 'Publication',
  P580: 'Début',
  P582: 'Fin',
}

export async function fetchWikidataFacts(qid, fetchImpl = fetch) {
  const j = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, fetchImpl)
  const entity = Object.values(j?.entities ?? {})[0]
  const claims = entity?.claims ?? {}
  const out = []
  for (const [p, label] of Object.entries(TIME_PROPS)) {
    const t = wikidataTime(claims[p]?.[0]?.mainsnak?.datavalue?.value)
    if (t) out.push(`${label} : ${t}`)
  }
  return out
}

export const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const MIN_WIDTH = 800
const MIME = /^image\/(jpeg|png|webp)$/

export async function fetchCommonsCandidates({ files = [], search = '', limit = 3 } = {}, fetchImpl = fetch) {
  const titles = files.filter(Boolean).map((f) => (f.startsWith('File:') ? f : `File:${f}`))
  if (search) {
    const j = await getJson(
      api('commons.wikimedia.org', { list: 'search', srnamespace: '6', srlimit: '10', srsearch: `${search} filetype:bitmap` }),
      fetchImpl,
    )
    for (const r of j?.query?.search ?? []) titles.push(r.title)
  }
  const unique = [...new Set(titles)].slice(0, 15)
  if (!unique.length) return []
  const j = await getJson(
    api('commons.wikimedia.org', {
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: '1600',
      titles: unique.join('|'),
    }),
    fetchImpl,
  )
  const rank = new Map(unique.map((t, i) => [t, i]))
  return (j?.query?.pages ?? [])
    .map((p) => {
      const i = p.imageinfo?.[0]
      const m = i?.extmetadata ?? {}
      return {
        file: p.title,
        thumbUrl: i?.thumburl ?? i?.url,
        width: i?.width,
        height: i?.height,
        mime: i?.mime,
        author: stripHtml(m.Artist?.value),
        license: stripHtml(m.LicenseShortName?.value),
        licenseUrl: m.LicenseUrl?.value ?? null,
        commonsUrl: i?.descriptionurl,
      }
    })
    .filter((c) => c.thumbUrl && c.commonsUrl && c.author && isFreeLicense(c.license) && MIME.test(c.mime ?? '') && c.width >= MIN_WIDTH)
    .sort((a, b) => (rank.get(a.file) ?? 99) - (rank.get(b.file) ?? 99))
    .slice(0, limit)
}

// Plancher de taille AVANT tout encodage, sur les octets reçus : c'est ce qui
// distingue une vraie image d'une page d'erreur (même garde que ig-scrape).
export async function downloadImage(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 10000) throw new Error(`image trop petite (${buf.length} o) — page d'erreur ?`)
  return buf
}
```

```js
// scripts/lib/culture-image.mjs
//
// Deux fichiers par article :
//   image.webp — l'illustration de la page, 1200 px de large au plus
//                (jamais agrandie) ;
//   image.jpg  — la carte de partage, 1200×630 exactement, sRGB, SANS profil
//                ICC : sans quoi WhatsApp cesse d'afficher l'aperçu, en silence
//                (voir CLAUDE.md, la carte de partage).
// `sharp` est une dépendance de développement : seuls les CLI Culture (CI et
// poste local) l'appellent, jamais le build.
import sharp from 'sharp'

export const PAGE_WIDTH = 1200
export const CARD = { width: 1200, height: 630 }

export async function makeImages(buf) {
  const base = sharp(buf).rotate()
  const page = await base
    .clone()
    .resize({ width: PAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
  const jpg = await base
    .clone()
    .resize(CARD.width, CARD.height, { fit: 'cover', position: 'attention' })
    .toColourspace('srgb')
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  return { webp: page.data, width: page.info.width, height: page.info.height, jpg }
}
```

- [ ] **Step 4 : lancer et constater la réussite**

Run: `node --test test/culture-sources.test.mjs test/culture-image.test.mjs`
Expected: PASS (10 tests). Si `card.icc` n'est pas `undefined`, ajouter `.withMetadata({})` n'est **pas** la correction (il garderait le profil) : vérifier que rien n'appelle `withMetadata`/`keepIccProfile`, sharp retire les métadonnées par défaut.

- [ ] **Step 5 : commit**

```bash
git add scripts/lib/culture-sources.mjs scripts/lib/culture-image.mjs test/culture-sources.test.mjs test/culture-image.test.mjs
git commit -m "Culture : collecte Wikipédia/Wikidata/Commons et images (page + carte 1200×630 sans ICC)"
```

---

### Task 12 : corps de PR et CLI de rédaction

**Files:**
- Create: `scripts/lib/culture-pr.mjs`, `scripts/culture-draft.mjs`
- Modify: `package.json` (scripts)
- Test: `test/culture-pr.test.mjs`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: `buildPrBody({ title, meta, unsupported, overlap, warnings }) → string` ; `ideasIssueBody(ideas) → string` ; CLI `npm run culture:draft -- [--topic slug] [--open-branches f.json] [--out-body f.md] [--dry]`, qui écrit `slug=` et `title=` (ou `issue=1`) dans `$GITHUB_OUTPUT`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-pr.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrBody, ideasIssueBody } from '../scripts/lib/culture-pr.mjs'
import { factsChecked } from '../scripts/lib/culture-validate.mjs'
import { meta } from './helpers/culture-fixture.mjs'

test('corps de PR : faits ⚠️ en tête, recouvrement, sources, images, mode d’emploi, case', () => {
  const body = buildPrBody({
    title: 'Komitas',
    meta: meta('komitas', { agendaEvent: { title: 'Concert', url: 'https://e/1', date: '2026-10-25T20:00', location: 'Genève' } }),
    unsupported: ['1870', 'Vienne'],
    overlap: 0.21,
    warnings: ['Pas d’article Wikipédia en français'],
  })
  assert.ok(body.indexOf('⚠️ 1870') < body.indexOf('### Sources'))
  assert.match(body, /21\.0 %.*au-dessus du seuil/)
  assert.match(body, /> ⚠️ Pas d’article Wikipédia en français/)
  assert.match(body, /\[Komitas\]\(https:\/\/fr\.wikipedia\.org\/wiki\/Komitas\)/)
  assert.match(body, /0\. \*\*choisie\*\*/)
  assert.match(body, /"imageChoice"/)
  assert.match(body, /\[Concert\]\(https:\/\/e\/1\)/)
  assert.match(body, /gemini-flash-latest/)
  assert.match(body, /étiquette \*\*traduire\*\*/)
  assert.equal(factsChecked(body), false)
  assert.equal(factsChecked(body.replace('- [ ] Faits vérifiés', '- [x] Faits vérifiés')), true)
})

test('corps de PR : rien à signaler, pas d’image', () => {
  const body = buildPrBody({ title: 'T', meta: meta('t', { candidates: [], imageChoice: null, image: null }), unsupported: [], overlap: 0.03, warnings: [] })
  assert.match(body, /se retrouvent dans les sources/)
  assert.doesNotMatch(body, /au-dessus du seuil/)
  assert.match(body, /Aucune image libre/)
})

test('issue d’idées : entrées prêtes à coller dans sujets.json', () => {
  const body = ideasIssueBody([{ title: 'Le tar', wikipedia_fr: 'Tar (luth)', wikipedia_en: 'Tar (lute)', keywords: ['tar'] }])
  assert.match(body, /Le tar/)
  const json = JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1])
  assert.equal(json[0].slug, 'le-tar')
  assert.equal(json[0].status, 'pending')
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-pr.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : implémenter `culture-pr.mjs`**

```js
// scripts/lib/culture-pr.mjs
// Le corps de la PR de relecture (spec §1.1) et de l'issue d'idées. Le texte
// est du Markdown GitHub : GitHub l'assainit, rien n'y est exécuté.
import { OVERLAP_THRESHOLD } from './culture-overlap.mjs'

const pct = (x) => `${(x * 100).toFixed(1)} %`

export function buildPrBody({ title, meta, unsupported, overlap, warnings = [] }) {
  const lines = [`## ${title}`, '']
  for (const w of warnings) lines.push(`> ⚠️ ${w}`)
  if (warnings.length) lines.push('')
  if (unsupported.length) {
    lines.push('### ⚠️ À vérifier en premier', 'Introuvables tels quels dans les sources :', ...unsupported.map((c) => `- ⚠️ ${c}`))
  } else {
    lines.push('### Faits', 'Toutes les dates, chiffres et noms propres extraits se retrouvent dans les sources.')
  }
  lines.push(
    '',
    `### Recouvrement avec Wikipédia : ${pct(overlap)}${overlap > OVERLAP_THRESHOLD ? ` — ⚠️ au-dessus du seuil de ${pct(OVERLAP_THRESHOLD)} : reformulez les passages trop proches de la source` : ''}`,
    '',
    '### Sources',
    ...meta.sources.map((s) => `- [${s.title}](${s.url}) — Wikipédia ${s.lang}, révision ${s.revision}`),
  )
  const ev = meta.agendaEvent
  if (ev) lines.push('', '### Événement lié', `- [${ev.title}](${ev.url}) — ${String(ev.date).slice(0, 10)}${ev.location ? `, ${ev.location}` : ''}`)
  lines.push('', '### Image')
  if (meta.candidates?.length) {
    meta.candidates.forEach((c, i) => {
      lines.push(
        `${i}. ${i === meta.imageChoice ? '**choisie** ' : ''}[${c.file}](${c.commonsUrl}) — ${c.author}, ${c.license}`,
        `   <img src="${c.thumbUrl}" width="240">`,
      )
    })
    lines.push('', 'Pour en changer : modifiez `"imageChoice"` dans `meta.json` (0, 1 ou 2) **avant** de poser l’étiquette.')
  } else {
    lines.push('Aucune image libre trouvée : la page affichera un motif.')
  }
  lines.push(
    '',
    '### Modèle',
    `- Rédaction : \`${meta.model}\``,
    '',
    '### Relecture',
    '1. Corrigez `fr.md` (onglet « Files changed », menu ⋯ → *Edit file*).',
    '2. Cochez la case ci-dessous quand les faits sont vérifiés.',
    '3. Posez l’étiquette **traduire** : en, hy et ru sont produits depuis votre texte.',
    '4. Fusionnez quand le statut `culture-check` est vert. *Il ne bloque pas la fusion : c’est à vous de le regarder.*',
    '',
    '- [ ] Faits vérifiés',
    '',
  )
  return lines.join('\n')
}

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function ideasIssueBody(ideas) {
  const entries = ideas.map((x) => ({
    slug: slugify(x.title),
    title: x.title,
    wikipedia: { ...(x.wikipedia_fr ? { fr: x.wikipedia_fr } : {}), ...(x.wikipedia_en ? { en: x.wikipedia_en } : {}) },
    keywords: x.keywords,
    status: 'pending',
  }))
  return [
    'La liste `src/data/culture/sujets.json` est épuisée. Voici des idées générées ;',
    'copiez celles que vous retenez dans le tableau `topics`, **vérifiez les titres Wikipédia**, puis fermez cette issue.',
    '',
    ...ideas.map((x) => `- ${x.title}`),
    '',
    '```json',
    JSON.stringify(entries, null, 2),
    '```',
    '',
  ].join('\n')
}
```

- [ ] **Step 4 : lancer le test**

Run: `node --test test/culture-pr.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5 : écrire la CLI `scripts/culture-draft.mjs`**

```js
#!/usr/bin/env node
/**
 * Rédige le brouillon de la semaine (spec §1.1).
 *
 *   npm run culture:draft -- [--topic komitas] [--dry]
 *
 * En CI (articles.yml) : --open-branches (JSON des branches de PR ouvertes)
 * et --out-body (corps de la PR ou de l'issue). Écrit dans $GITHUB_OUTPUT :
 * `slug` et `title` (brouillon écrit), ou `issue=1` (liste vide, idées).
 * Toute panne du modèle lève : pas de PR, relance manuelle.
 */
import { readFile, writeFile, mkdir, appendFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { pickTopic } from './lib/culture-topic.mjs'
import { articleSlugs } from './lib/culture-load.mjs'
import { llmConfig, chat } from './lib/culture-llm.mjs'
import {
  buildDraftMessages, buildClaimsMessages, buildIdeasMessages, parseArticleJson, parseClaims, parseIdeas, findUnsupported,
} from './lib/culture-prompts.mjs'
import { fetchWikipedia, fetchWikidataFacts, fetchCommonsCandidates, downloadImage } from './lib/culture-sources.mjs'
import { makeImages } from './lib/culture-image.mjs'
import { overlapRatio } from './lib/culture-overlap.mjs'
import { serializeFrontMatter } from './lib/culture-markdown.mjs'
import { buildPrBody, ideasIssueBody } from './lib/culture-pr.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values } = parseArgs({
  options: {
    topic: { type: 'string' },
    'open-branches': { type: 'string' },
    'out-body': { type: 'string', default: path.join(root, 'culture-body.md') },
    dry: { type: 'boolean', default: false },
  },
})

const output = async (k, v) => {
  console.log(`${k}=${v}`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\n/g, ' ')}\n`)
}

const sujets = JSON.parse(await readFile(path.join(DIR, 'sujets.json'), 'utf-8'))
const openBranches = values['open-branches'] ? JSON.parse(await readFile(values['open-branches'], 'utf-8')) : []
const agenda = JSON.parse(await readFile(path.join(root, 'src/data/agenda.json'), 'utf-8'))
const existing = await articleSlugs(DIR)
const cfg = llmConfig()

let pick
if (values.topic) {
  const topic = sujets.topics.find((t) => t.slug === values.topic)
  if (!topic) throw new Error(`sujet inconnu : ${values.topic}`)
  pick = { topic, event: null }
} else {
  pick = pickTopic({ topics: sujets.topics, openBranches, existing, agenda, now: Date.now() })
}

if (!pick) {
  console.log('Liste de sujets épuisée : génération d’idées.')
  const { text } = await chat({ ...cfg, messages: buildIdeasMessages(sujets.topics.map((t) => t.title)) })
  await writeFile(values['out-body'], ideasIssueBody(parseIdeas(text)))
  await output('issue', '1')
  process.exit(0)
}

const { topic, event } = pick
if (existing.includes(topic.slug)) throw new Error(`src/data/culture/${topic.slug}/ existe déjà — rien à rédiger`)
console.log(`Sujet : ${topic.slug}${event ? ` (événement : ${event.title}, ${event.date})` : ''}`)

const warnings = []
const fr = topic.wikipedia.fr ? await fetchWikipedia('fr', topic.wikipedia.fr) : null
const en = topic.wikipedia.en ? await fetchWikipedia('en', topic.wikipedia.en) : null
if (!fr) warnings.push('Pas d’article Wikipédia en français : brouillon rédigé depuis l’anglais seul.')
const sources = [fr, en].filter(Boolean)
if (!sources.length) throw new Error(`aucune source Wikipédia pour ${topic.slug} — vérifiez les titres de sujets.json`)

const qid = fr?.wikidata ?? en?.wikidata
const facts = qid
  ? await fetchWikidataFacts(qid).catch((e) => (warnings.push(`Wikidata indisponible (${e.message}).`), []))
  : []
const candidates = await fetchCommonsCandidates({
  files: [fr?.pageImage, en?.pageImage],
  search: topic.title,
}).catch((e) => (warnings.push(`Commons indisponible (${e.message}).`), []))

const draftRes = await chat({ ...cfg, messages: buildDraftMessages({ topic, sources, facts, event }) })
const draft = parseArticleJson(draftRes.text)
if (!draft) throw new Error(`brouillon illisible (JSON attendu) — modèle ${draftRes.model}`)
const claimsRes = await chat({ ...cfg, temperature: 0, messages: buildClaimsMessages(draft.body) })
const unsupported = findUnsupported(parseClaims(claimsRes.text), [...sources.map((s) => s.extract), ...facts])
const overlap = overlapRatio(draft.body, sources.map((s) => s.extract))

const meta = {
  slug: topic.slug,
  sources: sources.map(({ lang, title, url, revision }) => ({ lang, title, url, revision })),
  candidates,
  imageChoice: null,
  image: null,
  agendaEvent: event ? { title: event.title, url: event.url, date: event.date, location: event.location ?? null } : null,
  overlap: Number(overlap.toFixed(3)),
  model: draftRes.model,
}

let images = null
if (candidates.length) {
  try {
    images = await makeImages(await downloadImage(candidates[0].thumbUrl))
    meta.imageChoice = 0
    meta.image = { ...candidates[0], width: images.width, height: images.height }
  } catch (e) {
    warnings.push(`Image non téléchargée (${e.message}) : la page affichera un motif.`)
  }
} else {
  warnings.push('Aucune image sous licence libre : la page affichera un motif.')
}

const date = new Date().toISOString().slice(0, 10)
const frText = serializeFrontMatter({ title: draft.title, description: draft.description, date }, draft.body)
const body = buildPrBody({ title: draft.title, meta, unsupported, overlap, warnings })

if (values.dry) {
  console.log(`\n${frText}\n----\n${body}`)
  process.exit(0)
}

const base = path.join(DIR, topic.slug)
await access(base).then(
  () => { throw new Error(`${base} existe déjà`) },
  () => {},
)
await mkdir(base, { recursive: true })
await writeFile(path.join(base, 'fr.md'), frText)
await writeFile(path.join(base, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
if (images) {
  await writeFile(path.join(base, 'image.webp'), images.webp)
  await writeFile(path.join(base, 'image.jpg'), images.jpg)
}
await writeFile(values['out-body'], body)
await output('slug', topic.slug)
await output('title', draft.title)
```

Dans `package.json`, ajouter aux `scripts` :

```json
    "culture:draft": "node --env-file-if-exists=.env scripts/culture-draft.mjs",
```

- [ ] **Step 6 : vérifier à vide (sans réseau ni clé)**

Run: `node scripts/culture-draft.mjs --topic inexistant`
Expected: échec `sujet inconnu : inexistant` (le script se charge, ses imports résolvent).

- [ ] **Step 7 : commit**

```bash
git add scripts/lib/culture-pr.mjs scripts/culture-draft.mjs package.json test/culture-pr.test.mjs
git commit -m "Culture : CLI de rédaction et corps de PR (faits à vérifier, recouvrement, images)"
```

---

### Task 13 : CLI de traduction, de contrôle et de statut

**Files:**
- Create: `scripts/culture-translate.mjs`, `scripts/culture-check.mjs`, `scripts/culture-status.mjs`
- Modify: `package.json`
- Test: `test/culture-check-cli.test.mjs`

**Interfaces:**
- Consumes: `readArticle`, `articleSlugs` (Task 4), `validateArticle`, `chosenImage`, `factsChecked`, `TRANSLATED` (Task 4), `setTopicStatus`, `validateTopics` (Task 5), `chat`, `llmConfig`, `buildTranslateMessages`, `parseArticleJson` (Task 10), `downloadImage`, `makeImages` (Task 11), `parseFrontMatter`, `serializeFrontMatter`, `bodyHash` (Task 2).
- Produces:
  - `npm run culture:translate -- <slug> [--summary f.md]` — exit 1 si une langue a échoué (les autres sont écrites).
  - `npm run culture:check -- [--dir d] [--pr-body f] [slug…]` — dernière ligne de sortie = résumé (≤ 140 caractères), exit 1 sur erreur.
  - `npm run culture:status -- <slug> <status>`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-check-cli.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeArticle, texts } from './helpers/culture-fixture.mjs'

const CLI = fileURLToPath(new URL('../scripts/culture-check.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' })
const last = (r) => r.stdout.trim().split('\n').at(-1)

async function dir() {
  const d = await mkdtemp(path.join(tmpdir(), 'culture-cli-'))
  await writeFile(path.join(d, 'sujets.json'), JSON.stringify({ topics: [{ slug: 'komitas', title: 'K', wikipedia: { fr: 'K' }, keywords: [], status: 'pending' }] }))
  return d
}

test('article conforme : exit 0, résumé vert', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas')
  const r = run('--dir', d, 'komitas')
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(last(r), /^✓/)
})

test('traduction manquante : exit 1, résumé ≤ 140 caractères avec la cause', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas', { t: { ...texts(), ru: null } })
  const r = run('--dir', d, 'komitas')
  assert.equal(r.status, 1)
  assert.match(last(r), /ru\.md absent/)
  assert.ok(last(r).length <= 140)
})

test('case « Faits vérifiés » : exigée seulement avec --pr-body', async () => {
  const d = await dir()
  await writeArticle(d, 'komitas')
  const body = path.join(d, 'body.md')
  await writeFile(body, '- [ ] Faits vérifiés')
  assert.equal(run('--dir', d, '--pr-body', body, 'komitas').status, 1)
  await writeFile(body, '- [x] Faits vérifiés')
  assert.equal(run('--dir', d, '--pr-body', body, 'komitas').status, 0)
})

test('sujets.json invalide : exit 1', async () => {
  const d = await dir()
  await writeFile(path.join(d, 'sujets.json'), JSON.stringify({ topics: [{ slug: 'X' }] }))
  assert.equal(run('--dir', d).status, 1)
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-check-cli.test.mjs`
Expected: FAIL — script introuvable.

- [ ] **Step 3 : implémenter `scripts/culture-check.mjs`**

```js
#!/usr/bin/env node
/**
 * Contrôle STRICT des articles Culture (spec §3.5) — celui des PR.
 *
 *   npm run culture:check -- [--pr-body corps.md] [slug…]
 *
 * Sans slug : tous les articles. --pr-body exige la case « Faits vérifiés ».
 * La DERNIÈRE ligne de sortie est un résumé de 140 caractères au plus : les
 * workflows la publient telle quelle comme description du statut de commit.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { readArticle, articleSlugs } from './lib/culture-load.mjs'
import { validateArticle, factsChecked } from './lib/culture-validate.mjs'
import { validateTopics } from './lib/culture-topic.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string', default: path.join(root, 'src/data/culture') },
    'pr-body': { type: 'string' },
  },
})

const errors = []
try {
  errors.push(...validateTopics(JSON.parse(await readFile(path.join(values.dir, 'sujets.json'), 'utf-8'))))
} catch (e) {
  errors.push(`sujets.json illisible : ${e.message}`)
}
const slugs = positionals.length ? positionals : await articleSlugs(values.dir)
for (const slug of slugs) {
  const { errors: errs } = validateArticle(await readArticle(values.dir, slug))
  errors.push(...errs.map((e) => `${slug} — ${e}`))
}
if (values['pr-body']) {
  const body = await readFile(values['pr-body'], 'utf-8').catch(() => '')
  if (!factsChecked(body)) errors.push('case « Faits vérifiés » non cochée dans la PR')
}

for (const e of errors) console.log(`✗ ${e}`)
const summary = errors.length
  ? `✗ ${errors.length} problème(s) : ${errors[0]}`
  : `✓ culture : ${slugs.length} article(s) conforme(s)`
console.log(summary.length > 140 ? `${summary.slice(0, 139)}…` : summary)
process.exit(errors.length ? 1 : 0)
```

Run: `node --test test/culture-check-cli.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 4 : implémenter `scripts/culture-translate.mjs`**

```js
#!/usr/bin/env node
/**
 * Traduit le fr.md ACTUEL d'un article en en/hy/ru (spec §1.2).
 *
 *   npm run culture:translate -- komitas [--summary resume.md]
 *
 * Chaque traduction porte `sourceHash` (empreinte du corps français) et
 * `model`. Synchronise aussi l'image si `imageChoice` a changé, et passe le
 * sujet `published` dans sujets.json : sur la branche de la PR, ce statut
 * n'atteint `main` qu'avec la fusion. Une langue en échec n'empêche pas les
 * autres d'être écrites ; le code de sortie est alors 1.
 */
import { readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { parseFrontMatter, serializeFrontMatter, bodyHash } from './lib/culture-markdown.mjs'
import { TRANSLATED, chosenImage } from './lib/culture-validate.mjs'
import { setTopicStatus } from './lib/culture-topic.mjs'
import { llmConfig, chat } from './lib/culture-llm.mjs'
import { buildTranslateMessages, parseArticleJson } from './lib/culture-prompts.mjs'
import { downloadImage } from './lib/culture-sources.mjs'
import { makeImages } from './lib/culture-image.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { summary: { type: 'string' } },
})
const [slug] = positionals
if (!slug) throw new Error('usage : culture-translate <slug>')
const base = path.join(DIR, slug)

const fr = parseFrontMatter(await readFile(path.join(base, 'fr.md'), 'utf-8'))
const hash = bodyHash(fr.body)
const metaPath = path.join(base, 'meta.json')
const meta = JSON.parse(await readFile(metaPath, 'utf-8'))
const lines = ['### Traductions']
let failed = 0

// L'image d'abord : si imageChoice a changé, meta.image et les fichiers suivent.
const chosen = chosenImage(meta)
if ((chosen?.commonsUrl ?? null) !== (meta.image?.commonsUrl ?? null)) {
  try {
    if (chosen) {
      const out = await makeImages(await downloadImage(chosen.thumbUrl))
      await writeFile(path.join(base, 'image.webp'), out.webp)
      await writeFile(path.join(base, 'image.jpg'), out.jpg)
      meta.image = { ...chosen, width: out.width, height: out.height }
    } else {
      await rm(path.join(base, 'image.webp'), { force: true })
      await rm(path.join(base, 'image.jpg'), { force: true })
      meta.image = null
    }
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    lines.push(`- ✓ image : ${meta.image ? meta.image.file : 'retirée'}`)
  } catch (e) {
    failed++
    lines.push(`- ✗ image : ${e.message}`)
  }
}

const cfg = llmConfig()
for (const lang of TRANSLATED) {
  try {
    const res = await chat({
      ...cfg,
      temperature: 0.2,
      messages: buildTranslateMessages({ lang, title: fr.data.title, description: fr.data.description, body: fr.body }),
    })
    const t = parseArticleJson(res.text)
    if (!t) throw new Error('réponse illisible (JSON attendu)')
    await writeFile(
      path.join(base, `${lang}.md`),
      serializeFrontMatter(
        { title: t.title, description: t.description, date: fr.data.date, sourceHash: hash, model: res.model },
        t.body,
      ),
    )
    lines.push(`- ✓ ${lang} — \`${res.model}\``)
    console.log(`  ✓ ${slug}/${lang}`)
  } catch (e) {
    failed++
    lines.push(`- ✗ ${lang} — ${e.message}`)
    console.warn(`  ✗ ${slug}/${lang} : ${e.message}`)
  }
}

const sujetsPath = path.join(DIR, 'sujets.json')
const sujets = JSON.parse(await readFile(sujetsPath, 'utf-8'))
if (sujets.topics.some((t) => t.slug === slug)) {
  await writeFile(sujetsPath, `${JSON.stringify(setTopicStatus(sujets, slug, 'published'), null, 2)}\n`)
} else {
  lines.push(`- ⚠️ ${slug} absent de sujets.json : statut non mis à jour`)
}

if (failed) lines.push('', 'Reposez l’étiquette **traduire** pour réessayer.')
if (values.summary) await writeFile(values.summary, `${lines.join('\n')}\n`)
process.exit(failed ? 1 : 0)
```

- [ ] **Step 5 : implémenter `scripts/culture-status.mjs`**

```js
#!/usr/bin/env node
// Change le statut d'un sujet : `npm run culture:status -- komitas rejected`.
// Utilisé par articles-closed.yml quand une PR est fermée sans fusion.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTopicStatus } from './lib/culture-topic.mjs'

const [slug, status] = process.argv.slice(2)
if (!slug || !status) throw new Error('usage : culture-status <slug> <pending|published|rejected>')
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/culture/sujets.json')
const sujets = JSON.parse(await readFile(file, 'utf-8'))
await writeFile(file, `${JSON.stringify(setTopicStatus(sujets, slug, status), null, 2)}\n`)
console.log(`${slug} → ${status}`)
```

Dans `package.json`, ajouter aux `scripts` :

```json
    "culture:translate": "node --env-file-if-exists=.env scripts/culture-translate.mjs",
    "culture:check": "node scripts/culture-check.mjs",
    "culture:status": "node scripts/culture-status.mjs",
```

- [ ] **Step 6 : vérifier**

Run: `npm run culture:check && node --test test/culture-check-cli.test.mjs && npm run lint`
Expected: `✓ culture : 0 article(s) conforme(s)` ; tests PASS ; lint `0 errors, 5 warnings`.

- [ ] **Step 7 : commit**

```bash
git add scripts/culture-translate.mjs scripts/culture-check.mjs scripts/culture-status.mjs package.json test/culture-check-cli.test.mjs
git commit -m "Culture : CLI de traduction (empreinte du français), de contrôle strict et de statut"
```

---

### Task 14 : workflows GitHub Actions

**Files:**
- Create: `.github/workflows/articles.yml`, `.github/workflows/articles-translate.yml`, `.github/workflows/articles-check.yml`, `.github/workflows/articles-closed.yml`
- Test: `test/culture-workflows.test.mjs`

**Interfaces:**
- Consumes: les quatre CLI (Tasks 12-13), secret `GEMINI_API_KEY`, variables de dépôt facultatives `ARTICLES_BASE_URL`, `ARTICLES_MODEL`.

- [ ] **Step 1 : écrire le test qui échoue**

```js
// test/culture-workflows.test.mjs
// Les workflows ne s'exécutent pas en test ; on garde ici les trois règles
// dont l'oubli ne se verrait qu'en production.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const FILES = ['articles.yml', 'articles-translate.yml', 'articles-check.yml', 'articles-closed.yml']
const read = (f) => readFile(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf-8')

for (const f of FILES) {
  test(`${f} : aucun secret Firebase`, async () => {
    assert.doesNotMatch(await read(f), /FIREBASE/)
  })
  test(`${f} : aucune donnée non fiable interpolée dans un run:`, async () => {
    const y = await read(f)
    const runs = [...y.matchAll(/run: \|\n((?:\s{10,}.*\n?)+)/g)].map((m) => m[1]).join('\n')
    assert.doesNotMatch(runs, /\$\{\{\s*(github\.event\.pull_request\.(title|body|head\.ref)|github\.head_ref|steps\.[^}]*outputs\.title)/)
  })
}

test('les robots publient le statut culture-check eux-mêmes', async () => {
  for (const f of ['articles.yml', 'articles-translate.yml']) assert.match(await read(f), /statuses\/.*context=culture-check/s, f)
})
```

- [ ] **Step 2 : lancer et constater l'échec**

Run: `node --test test/culture-workflows.test.mjs`
Expected: FAIL — fichiers absents.

- [ ] **Step 3 : `articles.yml`**

```yaml
# Le brouillon Culture de la semaine (spec §1.1). Ouvre UNE PR par article ;
# rien ne part en production avant la fusion par un humain.
#
# PIÈGE GitHub : une PR ouverte ou un commit poussé avec le GITHUB_TOKEN ne
# déclenche AUCUN autre workflow. articles-check.yml ne tournerait donc jamais
# sur les commits du robot : ce job publie lui-même le statut culture-check.
name: Culture — brouillon hebdomadaire

on:
  schedule:
    - cron: '0 6 * * 1' # lundi 06:00 UTC
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write
  issues: write
  statuses: write

concurrency:
  group: culture-draft
  cancel-in-progress: false

jobs:
  draft:
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci

      - name: Branches des PR ouvertes
        run: |
          gh pr list --state open --limit 200 --json headRefName --jq '[.[].headRefName]' > "$RUNNER_TEMP/open.json"

      - name: Rédiger
        id: draft
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          ARTICLES_BASE_URL: ${{ vars.ARTICLES_BASE_URL }}
          ARTICLES_MODEL: ${{ vars.ARTICLES_MODEL }}
        run: |
          node scripts/culture-draft.mjs --open-branches "$RUNNER_TEMP/open.json" --out-body "$RUNNER_TEMP/body.md"

      - name: Ouvrir l'issue d'idées
        if: steps.draft.outputs.issue == '1'
        run: |
          gh issue create --title "Culture : idées de sujets" --body-file "$RUNNER_TEMP/body.md"

      - name: Ouvrir la PR de relecture
        if: steps.draft.outputs.slug != ''
        env:
          SLUG: ${{ steps.draft.outputs.slug }}
          TITLE: ${{ steps.draft.outputs.title }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git switch -c "culture/$SLUG"
          git add src/data/culture
          git commit -m "Culture : brouillon « $TITLE »"
          git push -u origin "culture/$SLUG"
          gh label create traduire --color F28C28 --description "Traduire le français relu en en, hy et ru" 2>/dev/null || true
          gh pr create --base main --head "culture/$SLUG" --title "Culture : $TITLE" --body-file "$RUNNER_TEMP/body.md"
          if node scripts/culture-check.mjs "$SLUG" > "$RUNNER_TEMP/check.txt"; then state=success; else state=failure; fi
          cat "$RUNNER_TEMP/check.txt"
          gh api "repos/$GITHUB_REPOSITORY/statuses/$(git rev-parse HEAD)" \
            -f state="$state" -f context=culture-check -f description="$(tail -n 1 "$RUNNER_TEMP/check.txt")"
```

- [ ] **Step 4 : `articles-translate.yml`**

```yaml
# Traduit le français RELU quand l'étiquette « traduire » est posée (spec §1.2).
# Pousse un commit sur la branche de la PR, retire l'étiquette, commente, puis
# publie le statut culture-check lui-même (le commit du robot ne déclenche pas
# articles-check.yml — voir articles.yml).
name: Culture — traduction

on:
  pull_request:
    types: [labeled]

permissions:
  contents: write
  pull-requests: write
  statuses: write

concurrency:
  group: culture-translate-${{ github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  translate:
    if: github.event.label.name == 'traduire' && startsWith(github.head_ref, 'culture/')
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: ${{ github.token }}
      PR: ${{ github.event.pull_request.number }}
      BRANCH: ${{ github.head_ref }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci

      - name: Traduire
        id: tr
        continue-on-error: true
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          ARTICLES_BASE_URL: ${{ vars.ARTICLES_BASE_URL }}
          ARTICLES_MODEL: ${{ vars.ARTICLES_MODEL }}
        run: |
          SLUG="${BRANCH#culture/}"
          node scripts/culture-translate.mjs "$SLUG" --summary "$RUNNER_TEMP/summary.md"

      - name: Pousser, commenter, publier le statut
        if: always()
        run: |
          SLUG="${BRANCH#culture/}"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/data/culture
          git diff --cached --quiet || git commit -m "Culture : traductions de « $SLUG »"
          git push origin "HEAD:$BRANCH"
          gh pr edit "$PR" --remove-label traduire || true
          [ -f "$RUNNER_TEMP/summary.md" ] && gh pr comment "$PR" --body-file "$RUNNER_TEMP/summary.md"
          gh pr view "$PR" --json body --jq .body > "$RUNNER_TEMP/body.md"
          if node scripts/culture-check.mjs --pr-body "$RUNNER_TEMP/body.md" "$SLUG" > "$RUNNER_TEMP/check.txt"; then state=success; else state=failure; fi
          cat "$RUNNER_TEMP/check.txt"
          gh api "repos/$GITHUB_REPOSITORY/statuses/$(git rev-parse HEAD)" \
            -f state="$state" -f context=culture-check -f description="$(tail -n 1 "$RUNNER_TEMP/check.txt")"
```

- [ ] **Step 5 : `articles-check.yml`**

```yaml
# Le contrôle strict sur les modifications HUMAINES d'une PR Culture : un
# commit du relecteur (synchronize) ou la case « Faits vérifiés » cochée
# (edited). Les commits du robot sont contrôlés par articles*.yml eux-mêmes.
name: Culture — contrôle

on:
  pull_request:
    types: [synchronize, edited, reopened]

permissions:
  contents: read
  statuses: write

jobs:
  check:
    if: startsWith(github.head_ref, 'culture/')
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: ${{ github.token }}
      BRANCH: ${{ github.head_ref }}
      BODY: ${{ github.event.pull_request.body }}
      SHA: ${{ github.event.pull_request.head.sha }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Contrôler
        run: |
          SLUG="${BRANCH#culture/}"
          printf '%s' "$BODY" > "$RUNNER_TEMP/body.md"
          if node scripts/culture-check.mjs --pr-body "$RUNNER_TEMP/body.md" "$SLUG" > "$RUNNER_TEMP/check.txt"; then state=success; else state=failure; fi
          cat "$RUNNER_TEMP/check.txt"
          gh api "repos/$GITHUB_REPOSITORY/statuses/$SHA" \
            -f state="$state" -f context=culture-check -f description="$(tail -n 1 "$RUNNER_TEMP/check.txt")"
          [ "$state" = success ]
```

- [ ] **Step 6 : `articles-closed.yml`**

```yaml
# PR Culture fermée SANS fusion → le sujet passe `rejected` sur main, pour
# qu'il ne revienne pas le lundi suivant. Le push sur main par GITHUB_TOKEN
# ne déclenche pas de déploiement (rien à déployer).
name: Culture — sujet rejeté

on:
  pull_request:
    types: [closed]

permissions:
  contents: write

jobs:
  reject:
    if: github.event.pull_request.merged == false && startsWith(github.head_ref, 'culture/')
    runs-on: ubuntu-latest
    env:
      BRANCH: ${{ github.head_ref }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Marquer le sujet rejeté
        run: |
          SLUG="${BRANCH#culture/}"
          node scripts/culture-status.mjs "$SLUG" rejected
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/data/culture/sujets.json
          git diff --cached --quiet && exit 0
          git commit -m "Culture : sujet « $SLUG » rejeté"
          for i in 1 2 3; do
            git pull --rebase origin main && git push origin HEAD:main && exit 0
            sleep 10
          done
          exit 1
```

- [ ] **Step 7 : lancer le test**

Run: `node --test test/culture-workflows.test.mjs`
Expected: PASS (9 tests).

- [ ] **Step 8 : commit**

```bash
git add .github/workflows/articles.yml .github/workflows/articles-translate.yml .github/workflows/articles-check.yml .github/workflows/articles-closed.yml test/culture-workflows.test.mjs
git commit -m "Culture : workflows (brouillon hebdomadaire, traduction sur étiquette, contrôle, rejet)"
```

---

### Task 15 : essai réel, vérification du rendu et documentation

**Files:**
- Modify: `CLAUDE.md` (commandes, nombre de tests, un paragraphe « À savoir »)
- Modify: `README.md` (section « Articles Culture : relire une PR »)

- [ ] **Step 1 : essai réel local (nécessite une clé)**

Le propriétaire crée une clé gratuite sur Google AI Studio et l'ajoute à `.env` (`GEMINI_API_KEY=…`, fichier ignoré par git — vérifier avec `git check-ignore .env` depuis CE dossier). Puis :

```bash
npm run culture:draft -- --topic komitas --dry
```

Expected: le front-matter et le corps français s'affichent, puis le corps de PR. Vérifier à l'œil : 700-1 000 mots (`wc -w`), intertitres `##`, aucune URL dans le corps, liste ⚠️ plausible, recouvrement < 15 %. Si le modèle `gemini-flash-latest` répond 404, lister les modèles (`curl -s -H "Authorization: Bearer $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/openai/models`) et poser `ARTICLES_MODEL` sur un id Flash présent.

- [ ] **Step 2 : essai complet sans PR, puis rendu**

```bash
npm run culture:draft -- --topic komitas
npm run culture:translate -- komitas
npm run culture:check -- komitas
npm run build && npm run check && npm run prerender
grep -c '<div id="root"></div>' dist/ch/index.html
```

Expected: `culture:check` vert ; `check` vert avec `✓ pages Culture contrôlées` ; le `grep` vaut `0`.

Puis invoquer le skill **`verifier-le-rendu`** et suivre sa procédure sur : `dist/ch/culture/`, `dist/ch/culture/komitas/`, `dist/org/hy/culture/komitas/`, `dist/org/ru/culture/komitas/`, et le bloc « À lire » de l'accueil fr et hy — quatre langues, deux thèmes, largeurs du skill (dont 360 px : aucune page ne doit défiler horizontalement), cibles tactiles en `pointer: coarse`.

- [ ] **Step 3 : nettoyer l'essai**

L'article d'essai ne part **pas** sur `main` : il doit passer par une PR.

```bash
git status --short src/data/culture
git checkout -- src/data/culture/sujets.json
rm -rf src/data/culture/komitas
git status --short
```

Expected: arbre propre.

- [ ] **Step 4 : documenter**

Dans `CLAUDE.md` :
- section Commandes, ajouter :

```bash
npm run culture:draft     # rédiger le brouillon Culture de la semaine (--topic slug, --dry) — Gemini, GEMINI_API_KEY
npm run culture:translate # traduire le fr.md relu d'un article en en/hy/ru (slug)
npm run culture:check     # contrôle strict des articles Culture (celui des PR)
```

- remplacer le nombre de tests (`314`) par celui que donne `npm test` (deux occurrences : la ligne `npm test` et la phrase « Il y a désormais … tests ») ;
- dans « À savoir », ajouter un seul paragraphe :

```markdown
- **Articles Culture : trois pièges silencieux.** (1) Une PR ouverte ou un
  commit poussé avec le `GITHUB_TOKEN` ne déclenche aucun autre workflow :
  `articles.yml` et `articles-translate.yml` publient donc EUX-MÊMES le statut
  `culture-check` — un contrôle `pull_request` seul ne verrait jamais les
  commits du robot, et la PR aurait l'air vérifiée. (2) Chaque traduction
  porte l'empreinte du `fr.md` dont elle vient (`sourceHash`) : retoucher le
  français après la traduction la déclare périmée, et le build la retire au
  lieu de publier une version qui dit autre chose. (3) Le statut rouge ne
  bloque PAS la fusion (une protection de branche bloquerait aussi les pushes
  horaires) : c'est au relecteur de le regarder. Le pourquoi est dans
  `docs/superpowers/specs/2026-10-16-articles-culture-design.md`.
```

En ajoutant ce paragraphe, chercher dans `CLAUDE.md` un piège périmé à retirer (règle d'en-tête du fichier).

Dans `README.md`, ajouter une section « Articles Culture : relire une PR » qui reprend le mode d'emploi du corps de PR (corriger `fr.md`, cocher, étiquette `traduire`, fusionner au vert), plus : créer le secret (`gh secret set GEMINI_API_KEY`), lancer un brouillon à la demande (`gh workflow run articles.yml`), ajouter des sujets dans `src/data/culture/sujets.json` en vérifiant leur titre Wikipédia, et faire relire une fois le premier article arménien par un lecteur de la langue.

- [ ] **Step 5 : vérification finale**

Run: `npm test && npm run lint && npm run build && npm run check`
Expected: tous les tests PASS ; lint `0 errors, 5 warnings` ; build et check verts.

- [ ] **Step 6 : commit**

```bash
git add CLAUDE.md README.md
git commit -m "Culture : documentation (commandes, pièges, procédure de relecture)"
```

- [ ] **Step 7 : après fusion du chantier sur `main` (propriétaire)**

1. `gh secret set GEMINI_API_KEY` (coller la clé).
2. `gh workflow run articles.yml` puis `gh run watch`.
3. Ouvrir la PR créée, vérifier que le statut `culture-check` est présent (rouge : case non cochée et traductions absentes — attendu), poser l'étiquette `traduire`, vérifier le commentaire et le nouveau statut.
4. Cocher la case, fusionner, puis : `curl -sI https://armenieinfo.ch/culture/komitas/ | head -1` → `200`.
```
