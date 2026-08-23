# Vidéo promo WhatsApp — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utilisez
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les
> étapes sont des cases à cocher (`- [ ]`).

**But** : produire un MP4 vertical de 28 s, muet, en français, qui promeut
armenieinfo.ch sur les statuts WhatsApp — plus le projet Remotion qui le
régénère.

**Architecture** : un projet Remotion autonome dans un dépôt **voisin**
(`armenie-info-promo/`), qui lit le dépôt `ArmenianNews` sans jamais l'écrire.
Deux scripts Node l'alimentent avant tout rendu : `facts.mjs` (les chiffres,
extraits du code et des JSON du site) et `shots.mjs` (les captures, prises sur
la production au moyen de Puppeteer). La composition est une suite de six
scènes, chacune un composant isolé, assemblées par une table de temps unique.

**Pile** : Remotion 4 · React 19 · TypeScript · Vitest · puppeteer-core ·
Node 24.

**Spec** : `docs/superpowers/specs/2026-08-23-video-promo-whatsapp-design.md`
(dans le dépôt `ArmenianNews`). Le plan argumente depuis cette spec — lisez les
deux.

## Contraintes globales

Elles s'appliquent à **toutes** les tâches.

- **Format** : 1080×1920, 30 ips, **840 images = 28,000 s**. Ni 30 s (WhatsApp
  découpe au-delà), ni un compte approximatif.
- **Zones interdites** : 190 px en haut, 230 px en bas. Aucun élément porteur de
  sens n'y entre.
- **Muet** : aucune piste audio, dans aucune variante.
- **Langue de la vidéo** : français. Seule la scène `Langues` affiche les trois
  autres écritures.
- **Palette**, copiée de `ArmenianNews/src/styles/global.css` :
  `basalte #100f0d` · `basalte-2 #16140f` · `abricot #f2a93b` ·
  `abricot-clair #ffc869` · `abricot-profond #c97d1e` · `texte #f3ecdb` ·
  `texte-doux #b9af9a` · `encre-sur-abricot #1c1408`.
- **Aucun chiffre écrit en dur** dans les composants. Tout vient de
  `src/facts.json`, généré.
- **Aucune écriture dans `ArmenianNews`.** Lecture seule. Vérifiez avec
  `git rev-parse --show-toplevel` avant toute commande git.
- **Le chemin du dépôt voisin** est configurable par la variable
  d'environnement `ARMENIANNEWS_DIR`, avec pour défaut `../ArmenianNews`.
- **L'Ararat** : Masis (le sommet le plus haut) à **droite**. Le `path` se
  recopie de `ArmenianNews/public/favicon.svg`, il ne se retrace pas.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/theme.ts` | Les jetons de couleur et les familles. Aucune logique. |
| `src/timing.ts` | La table des scènes : nom, image de début, durée. Source unique du montage. |
| `src/fonts.ts` | Déclaration des `FontFace` et attente de leur chargement. |
| `src/facts.json` | **Généré.** Les chiffres du site. |
| `src/Root.tsx` | Déclare la composition et son schéma Zod. |
| `src/Promo.tsx` | Assemble les six scènes depuis `timing.ts`. |
| `src/components/Ararat.tsx` | Le glyphe, animable. |
| `src/components/Pastille.tsx` | La puce abricot qui porte un chiffre. |
| `src/components/SafeZones.tsx` | Le calque de contrôle des zones interdites. |
| `src/scenes/*.tsx` | Une scène = un fichier. |
| `scripts/lib/facts.mjs` | **Fonctions pures** d'extraction. Testables sans disque. |
| `scripts/facts.mjs` | Lit le dépôt voisin, écrit `src/facts.json`. |
| `scripts/shots.mjs` | Puppeteer → `public/shots/*.png`. |
| `test/*.test.mjs` | Vitest. |

---

### Tâche 1 : Fonder le projet et l'isoler

**Fichiers :**
- Créer : `armenie-info-promo/` (par le scaffold)
- Modifier : `Claude code/.gitignore` (le dépôt **parent**, `armenian-songs`)

**Interfaces :**
- Consomme : rien.
- Produit : un projet Remotion qui démarre ; `npm test` qui tourne.

- [ ] **Étape 1 : Vérifier où l'on est**

```bash
cd "C:/Users/nareg/Documents/Claude code"
git rev-parse --show-toplevel
```

Attendu : `C:/Users/nareg/Documents/Claude code` — c'est le dépôt **parent**
(`armenian-songs`), pas `ArmenianNews`. Si vous voyez autre chose, arrêtez-vous.

- [ ] **Étape 2 : Scaffolder**

```bash
npx create-video@latest --yes --blank --no-tailwind armenie-info-promo
cd armenie-info-promo
npm i
```

- [ ] **Étape 3 : Relever ce que le gabarit a réellement produit**

```bash
ls src/
cat package.json
```

Notez les noms exacts (le gabarit « blank » crée en général `src/Root.tsx`,
`src/Composition.tsx` et `src/index.ts`). **Les tâches suivantes supposent
`src/Root.tsx`** ; si le gabarit a choisi un autre nom, adaptez et notez-le ici.

- [ ] **Étape 4 : Isoler du dépôt parent**

```bash
cd "C:/Users/nareg/Documents/Claude code"
printf '\n# Projet vidéo, dépôt à part\narmenie-info-promo/\n' >> .gitignore
git check-ignore -v armenie-info-promo
```

Attendu : une ligne citant `.gitignore`. Le dossier suit le précédent
d'`ArmeniensDeLausanne/`, déjà présent dans ce fichier.

- [ ] **Étape 5 : Donner au projet son propre dépôt**

```bash
cd armenie-info-promo
git init -b main
git add -A
git commit -m "Fondation : projet Remotion pour la vidéo promo"
```

- [ ] **Étape 6 : Installer Vitest**

```bash
npm i -D vitest
npm pkg set scripts.test="vitest run"
```

- [ ] **Étape 7 : Un test qui échoue, pour prouver que le harnais tourne**

Créez `test/harnais.test.mjs` :

```js
import { test, expect } from 'vitest'

test('le harnais de test tourne', () => {
  expect(1 + 1).toBe(3)
})
```

- [ ] **Étape 8 : Le lancer et vérifier qu'il ÉCHOUE**

Lancez : `npm test`
Attendu : ÉCHEC — `expected 2 to be 3`.

- [ ] **Étape 9 : Le corriger**

Remplacez `toBe(3)` par `toBe(2)`.

- [ ] **Étape 10 : Le relancer, puis le supprimer**

Lancez : `npm test`
Attendu : 1 test passé.

```bash
rm test/harnais.test.mjs
```

Il a prouvé que le harnais tourne, et il ne prouve plus rien ensuite. Le laisser
décalerait de un tous les comptes de tests annoncés dans les tâches suivantes
(3, puis 7, puis 12) — et un compte attendu qui ne tombe pas juste fait douter
d'un test sain.

- [ ] **Étape 11 : Vérifier que le Studio démarre**

```bash
npx remotion studio --no-open
```

Attendu : une URL imprimée. Arrêtez le serveur (Ctrl+C).

- [ ] **Étape 12 : Commit**

```bash
git add -A
git commit -m "Harnais de test (Vitest) et isolation du dépôt parent"
```

---

### Tâche 2 : Le thème et les polices

**Fichiers :**
- Créer : `src/theme.ts`, `src/fontFiles.ts`, `src/fonts.ts`, `test/fonts.test.mjs`
- Créer : `public/fonts/` (8 fichiers copiés)

**Pourquoi deux fichiers de police et non un.** `src/fonts.ts` appelle
`delayRender()` et `new FontFace(...)` **au chargement du module** : l'importer
depuis un test Node le ferait planter (`FontFace is not defined`), et le test
qui garde la liste ne pourrait pas exister. La **liste** vit donc dans
`src/fontFiles.ts`, sans le moindre effet de bord ; `src/fonts.ts` l'importe et
s'occupe du chargement. C'est la même séparation que `scripts/lib/facts.mjs` et
`scripts/facts.mjs` à la tâche suivante : les données pures d'un côté, l'effet
de l'autre.

**Interfaces :**
- Consomme : les woff2 de `ArmenianNews/public/fonts/`.
- Produit :
  - `COULEURS` : `{ basalte, basalte2, abricot, abricotClair, abricotProfond,
    texte, texteDoux, encreSurAbricot }` — toutes `string`.
  - `POLICES` : `{ display, displayHy, corps, corpsHy, corpsRu }` — toutes
    `string` (des `font-family` prêtes à poser).
  - `FICHIERS_POLICES` (depuis `src/fontFiles.ts`) : `Array<{ famille: string,
    style: string, fichier: string }>` — la liste que le test relit.
  - `src/fonts.ts` : aucun export. Importé pour son **effet** — il charge les
    polices et retient le rendu jusqu'à ce qu'elles soient là.

- [ ] **Étape 1 : Copier les huit fichiers**

Ces noms sont exacts, relevés dans `ArmenianNews/src/styles/fonts.json` le
23 août 2026.

```bash
cd armenie-info-promo
mkdir -p public/fonts
SRC="../ArmenianNews/public/fonts"
cp "$SRC/fraunces-6NU58FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChjeveQ.woff2" public/fonts/fraunces-italic-latin.woff2
cp "$SRC/fraunces-6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2" public/fonts/fraunces-latin.woff2
cp "$SRC/hanken-grotesk-ieVn2YZDLWuGJpnzaiwFXS9tYtpd59A.woff2" public/fonts/hanken-latin.woff2
cp "$SRC/noto-serif-armenian-3XFBEqMt3YoFsciDRZxptyCUKJmytZ0kVU-XvF7QaZuL85rnQ9bfH8E2ew.woff2" public/fonts/noto-serif-armenian.woff2
cp "$SRC/noto-sans-armenian-ZgN7jOZKPa7CHqq0h37c7ReDUubm2SEdFXp7ig73qtTY5idbxZhVoDur.woff2" public/fonts/noto-sans-armenian.woff2
cp "$SRC/golos-text-q5uCsoe9Lv5t7Meb31EcExd8hLxR.woff2" public/fonts/golos-cyrillic.woff2
cp "$SRC/golos-text-q5uCsoe9Lv5t7Meb31EcEx58hLxR.woff2" public/fonts/golos-cyrillic-ext.woff2
cp "$SRC/hanken-grotesk-ieVn2YZDLWuGJpnzaiwFXS9tYtpT59CjCQ.woff2" public/fonts/hanken-latin-ext.woff2
ls -la public/fonts/
```

**Pourquoi Golos et non Hanken pour le russe** : Hanken Grotesk n'a **aucun**
sous-ensemble `cyrillic` — seulement `cyrillic-ext`, qui ne couvre pas les
lettres russes courantes. Une phrase russe composée en Hanken part en police de
secours, sans erreur ni avertissement. Golos Text porte les deux, et c'est déjà
le choix du site pour le russe.

- [ ] **Étape 2 : Écrire le test AVANT le code**

Créez `test/fonts.test.mjs` :

```js
import { test, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { FICHIERS_POLICES } from '../src/fontFiles.ts'

test('chaque police déclarée existe dans public/fonts/', () => {
  for (const p of FICHIERS_POLICES) {
    expect(existsSync(`public/fonts/${p.fichier}`), `manquant : ${p.fichier}`).toBe(true)
  }
})

test('le russe n’est pas composé en Hanken Grotesk', () => {
  const ru = FICHIERS_POLICES.find((p) => p.fichier.includes('cyrillic'))
  expect(ru).toBeDefined()
  expect(ru.famille).toBe('Golos Text')
})

test('l’arménien a ses deux rôles', () => {
  const familles = FICHIERS_POLICES.map((p) => p.famille)
  expect(familles).toContain('Noto Serif Armenian')
  expect(familles).toContain('Noto Sans Armenian')
})
```

- [ ] **Étape 3 : Le lancer et vérifier qu'il ÉCHOUE**

Lancez : `npm test`
Attendu : ÉCHEC — `Cannot find module '../src/fontFiles.ts'`.

- [ ] **Étape 4 : Écrire `src/theme.ts`**

```ts
export const COULEURS = {
  basalte: '#100f0d',
  basalte2: '#16140f',
  abricot: '#f2a93b',
  abricotClair: '#ffc869',
  abricotProfond: '#c97d1e',
  texte: '#f3ecdb',
  texteDoux: '#b9af9a',
  encreSurAbricot: '#1c1408',
} as const

export const POLICES = {
  display: '"Fraunces", Georgia, serif',
  displayHy: '"Noto Serif Armenian", Georgia, serif',
  corps: '"Hanken Grotesk", system-ui, sans-serif',
  corpsHy: '"Noto Sans Armenian", system-ui, sans-serif',
  corpsRu: '"Golos Text", system-ui, sans-serif',
} as const

/** Zones que l'interface de WhatsApp recouvre, en pixels. */
export const ZONES_INTERDITES = { haut: 190, bas: 230 } as const
```

- [ ] **Étape 5a : Écrire `src/fontFiles.ts` — la liste, sans effet de bord**

```ts
export const FICHIERS_POLICES = [
  { famille: 'Fraunces', style: 'italic', fichier: 'fraunces-italic-latin.woff2' },
  { famille: 'Fraunces', style: 'normal', fichier: 'fraunces-latin.woff2' },
  { famille: 'Hanken Grotesk', style: 'normal', fichier: 'hanken-latin.woff2' },
  { famille: 'Hanken Grotesk', style: 'normal', fichier: 'hanken-latin-ext.woff2' },
  { famille: 'Noto Serif Armenian', style: 'normal', fichier: 'noto-serif-armenian.woff2' },
  { famille: 'Noto Sans Armenian', style: 'normal', fichier: 'noto-sans-armenian.woff2' },
  { famille: 'Golos Text', style: 'normal', fichier: 'golos-cyrillic.woff2' },
  { famille: 'Golos Text', style: 'normal', fichier: 'golos-cyrillic-ext.woff2' },
] as const

// Fraunces et Hanken sont des polices VARIABLES : leur @font-face doit annoncer
// une PLAGE de graisses. Déclarer `font-weight: 400` ferait synthétiser les
// autres graisses par le navigateur — un gras mécanique, visible.
export const PLAGE_GRAISSE = '100 900'
```

- [ ] **Étape 5b : Écrire `src/fonts.ts` — le chargement**

```ts
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion'
import { FICHIERS_POLICES, PLAGE_GRAISSE } from './fontFiles'

const attente = delayRender('Chargement des polices')

Promise.all(
  FICHIERS_POLICES.map(async (p) => {
    const face = new FontFace(p.famille, `url(${staticFile(`fonts/${p.fichier}`)}) format("woff2")`, {
      style: p.style,
      weight: PLAGE_GRAISSE,
    })
    document.fonts.add(await face.load())
  }),
)
  .then(() => continueRender(attente))
  .catch((e) => cancelRender(e))
```

**Le piège que ce code désamorce** : sans `delayRender`, le rendu commence avant
que les polices soient là et part en polices de secours. En latin cela donne
« une autre police » ; en arménien, des rectangles vides. `og-image.mjs`, dans
le dépôt voisin, a déjà payé ce piège une fois.

- [ ] **Étape 6 : Relancer le test**

Lancez : `npm test`
Attendu : 3 tests passés.

> Si Vitest échoue sur l'import de `.ts` depuis un `.mjs`, ajoutez
> `test: { include: ['test/**/*.test.mjs'] }` dans un `vitest.config.ts` et
> importez `../src/fonts.ts` (Vitest transpile le TypeScript nativement).

- [ ] **Étape 7 : Commit**

```bash
git add -A
git commit -m "Thème et polices auto-hébergées, chargées sous delayRender"
```

---

### Tâche 3 : Les chiffres, extraits du dépôt voisin

**Fichiers :**
- Créer : `scripts/lib/facts.mjs`, `scripts/facts.mjs`, `test/facts.test.mjs`
- Générer : `src/facts.json`

**Interfaces :**
- Consomme : rien du projet.
- Produit, depuis `scripts/lib/facts.mjs` :
  - `compterStations(texteRadioJsx: string): { total: number, enOndes: number }`
  - `compterSources(texteNewsSourcesJs: string, langue: string): number`
  - `agendaAVenir(agendaJson: object, maintenant: Date): { evenements: number, pays: number }`
- Produit, dans `src/facts.json` :
  `{ sources, stations, stationsEnOndes, evenements, pays, genereLe, instantaneLe }`

- [ ] **Étape 1 : Écrire les tests AVANT le code**

Créez `test/facts.test.mjs` :

```js
import { test, expect } from 'vitest'
import { compterStations, compterSources, agendaAVenir } from '../scripts/lib/facts.mjs'

test('compte les stations et celles qui sont en ondes', () => {
  const jsx = `
    const STATIONS = [
      { id: 'un', nom: 'Un' },
      { id: 'deux', nom: 'Deux', offAir: true },
      { id: 'trois', nom: 'Trois' },
    ]`
  expect(compterStations(jsx)).toEqual({ total: 3, enOndes: 2 })
})

test('compte les rédactions de la langue demandée, pas des autres', () => {
  const js = `
    export const TAB_ORDER = {
      fr: ['a', 'b', 'c'],
      en: ['a', 'b', 'c', 'd', 'e'],
    }`
  expect(compterSources(js, 'fr')).toBe(3)
  expect(compterSources(js, 'en')).toBe(5)
})

test('l’agenda ne retient que le complet, le futur, et une URL par événement', () => {
  const maintenant = new Date('2026-08-23T00:00:00Z')
  const agenda = {
    switzerland: [
      { title: 'A', date: '2026-09-01T20:00', url: 'https://x/a', country: 'switzerland' },
      { title: 'Passé', date: '2026-08-01T20:00', url: 'https://x/p', country: 'switzerland' },
      { title: 'Sans date', date: null, url: 'https://x/n', country: 'switzerland' },
    ],
    world: [
      { title: 'A (doublon)', date: '2026-09-01T20:00', url: 'https://x/a', country: 'france' },
      { title: 'B', date: '2026-09-05T18:00', url: 'https://x/b', country: 'france' },
    ],
  }
  expect(agendaAVenir(agenda, maintenant)).toEqual({ evenements: 2, pays: 2 })
})

test('un événement sans titre ou sans URL ne compte pas', () => {
  const maintenant = new Date('2026-08-23T00:00:00Z')
  const agenda = {
    switzerland: [
      { title: '', date: '2026-09-01T20:00', url: 'https://x/a', country: 'switzerland' },
      { title: 'B', date: '2026-09-01T20:00', url: '', country: 'switzerland' },
    ],
    world: [],
  }
  expect(agendaAVenir(agenda, maintenant)).toEqual({ evenements: 0, pays: 0 })
})
```

- [ ] **Étape 2 : Les lancer et vérifier qu'ils ÉCHOUENT**

Lancez : `npm test`
Attendu : ÉCHEC — `Cannot find module '../scripts/lib/facts.mjs'`.

- [ ] **Étape 3 : Écrire `scripts/lib/facts.mjs`**

```js
// Les compteurs lisent le code du site COMME DU TEXTE, et c'est délibéré :
// `Radio.jsx` est du JSX, que Node ne sait pas importer. C'est déjà la méthode
// de `test/radio-count.test.mjs` dans le dépôt voisin.

export function compterStations(texteRadioJsx) {
  const bloc = texteRadioJsx.slice(texteRadioJsx.indexOf('STATIONS'))
  const total = (bloc.match(/\bid:\s*'[^']+'/g) || []).length
  const horsOndes = (bloc.match(/offAir:\s*true/g) || []).length
  return { total, enOndes: total - horsOndes }
}

export function compterSources(texteNewsSourcesJs, langue) {
  const m = texteNewsSourcesJs.match(
    new RegExp(`\\b${langue}\\s*:\\s*\\[([^\\]]*)\\]`),
  )
  if (!m) throw new Error(`langue absente de TAB_ORDER : ${langue}`)
  return (m[1].match(/'[^']+'/g) || []).length
}

// Le filtre canonique de l'agenda du site : complet (titre, date, URL),
// à venir, dédoublonné par URL. Le contrôle explicite des champs n'est pas
// décoratif — `new Date(null)` vaut 0 et `new Date(undefined)` vaut NaN, donc
// un événement sans date passerait pour daté de 1970 ou comparerait faux.
export function agendaAVenir(agendaJson, maintenant) {
  const tous = [...(agendaJson.switzerland || []), ...(agendaJson.world || [])]
  const vus = new Set()
  const gardes = []
  for (const e of tous) {
    if (!e || !e.title || !e.date || !e.url) continue
    if (new Date(e.date) < maintenant) continue
    if (vus.has(e.url)) continue
    vus.add(e.url)
    gardes.push(e)
  }
  return {
    evenements: gardes.length,
    pays: new Set(gardes.map((e) => e.country)).size,
  }
}
```

- [ ] **Étape 4 : Relancer et vérifier que ça PASSE**

Lancez : `npm test`
Attendu : 7 tests passés (3 de la tâche 2 + 4 ici).

- [ ] **Étape 5 : Écrire le script qui s'en sert**

Créez `scripts/facts.mjs` :

```js
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compterStations, compterSources, agendaAVenir } from './lib/facts.mjs'

const SITE = process.env.ARMENIANNEWS_DIR || '../ArmenianNews'
const lire = (p) => readFileSync(join(SITE, p), 'utf8')

const stations = compterStations(lire('src/components/Radio.jsx'))
const sources = compterSources(lire('src/newsSources.js'), 'fr')
const agenda = JSON.parse(lire('src/data/agenda.json'))
const meta = JSON.parse(lire('src/data/meta.json'))
const { evenements, pays } = agendaAVenir(agenda, new Date())

const facts = {
  sources,
  stations: stations.total,
  stationsEnOndes: stations.enOndes,
  evenements,
  pays,
  instantaneLe: meta.generatedAt,
  genereLe: new Date().toISOString(),
}

// Une garde, parce qu'un zéro est un JSON parfaitement valide : c'est la seule
// façon dont ce script peut mentir sans rien casser.
for (const [k, v] of Object.entries(facts)) {
  if (typeof v === 'number' && v === 0) {
    throw new Error(`chiffre nul, refus d'écrire : ${k}`)
  }
}

writeFileSync('src/facts.json', JSON.stringify(facts, null, 2) + '\n')
console.log(facts)
```

- [ ] **Étape 6 : Le lancer pour de vrai**

```bash
npm pkg set scripts.facts="node scripts/facts.mjs"
npm run facts
```

Attendu, à ± les chiffres du jour : `sources: 7`, `stations: 15`,
`stationsEnOndes: 14`, `evenements` et `pays` non nuls.

**Si `sources` ne vaut pas 7 ou `stations` pas 15**, l'extraction est fausse —
ne « corrigez » pas le chiffre à la main, corrigez le compteur.

- [ ] **Étape 7 : Commit**

```bash
git add -A
git commit -m "Les chiffres de la vidéo, extraits du site et non écrits en dur"
```

---

### Tâche 4 : Les captures d'écran

**Fichiers :**
- Créer : `scripts/shots.mjs`
- Générer : `public/shots/accueil.png`, `radio.png`, `agenda.png`

**Interfaces :**
- Consomme : `puppeteer-core` et `findChrome` du dépôt voisin.
- Produit : trois PNG pleine page, 1290 px de large, thème nuit.

- [ ] **Étape 1 : Installer le pilote**

```bash
npm i -D puppeteer-core
```

- [ ] **Étape 2 : Écrire `scripts/shots.mjs`**

```js
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { findChrome } from '../../ArmenianNews/scripts/lib/chrome.mjs'

const VUES = [
  { nom: 'accueil', url: 'https://armenieinfo.ch/' },
  { nom: 'radio', url: 'https://armenieinfo.ch/radio/' },
  { nom: 'agenda', url: 'https://armenieinfo.ch/agenda/' },
]

const executablePath = findChrome()
if (!executablePath) throw new Error('Chrome introuvable')

mkdirSync('public/shots', { recursive: true })
const navigateur = await puppeteer.launch({ executablePath, headless: true })

for (const vue of VUES) {
  const page = await navigateur.newPage()
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 })

  // Le thème AVANT le premier rendu : posé après, la page aurait déjà peint
  // en clair, et la capture attraperait la bascule.
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('theme', 'night') } catch { /* mode privé */ }
  })

  await page.goto(vue.url, { waitUntil: 'networkidle2', timeout: 60000 })

  // Dérouler toute la page : le site charge ses images en `loading="lazy"`,
  // donc une capture pleine page sans défilement rend des cadres vides.
  await page.evaluate(async () => {
    const pas = window.innerHeight
    for (let y = 0; y < document.body.scrollHeight; y += pas) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 250))
    }
    window.scrollTo(0, 0)
  })
  await new Promise((r) => setTimeout(r, 1500))

  await page.screenshot({ path: `public/shots/${vue.nom}.png`, fullPage: true })
  console.log('capturé :', vue.nom)
  await page.close()
}

await navigateur.close()
```

- [ ] **Étape 3 : Le lancer**

```bash
npm pkg set scripts.shots="node scripts/shots.mjs"
npm run shots
```

- [ ] **Étape 4 : Vérifier les captures À L'ŒIL**

Ouvrez les trois PNG. Trois contrôles, dans cet ordre :

1. **Fond basalte sombre**, pas de papier clair. Sinon la clé `theme` du site a
   changé de valeur — relisez `ArmenianNews/public/theme-init.js`.
2. **Les images des cartes sont présentes**, pas des cadres vides. Sinon
   allongez les attentes de l'étape de défilement.
3. **Largeur = 1290 px** (`430 × 3`).

- [ ] **Étape 5 : Ne pas versionner les captures**

```bash
printf 'public/shots/\n' >> .gitignore
```

Elles se régénèrent, elles pèsent, et elles se périment — c'est du produit
dérivé, comme `src/facts.json`… qui, lui, **reste versionné** : il est minuscule
et il documente ce que disait la vidéo au moment du rendu.

- [ ] **Étape 6 : Commit**

```bash
git add -A
git commit -m "Captures de la production : thème nuit forcé, images dégelées"
```

---

### Tâche 5 : La table de temps et le squelette

**Fichiers :**
- Créer : `src/timing.ts`, `src/components/SafeZones.tsx`, `src/Promo.tsx`,
  `test/timing.test.mjs`
- Modifier : `src/Root.tsx`

**Interfaces :**
- Produit :
  - `IPS = 30`, `LARGEUR = 1080`, `HAUTEUR = 1920`, `DUREE = 840`
  - `SCENES: Array<{ nom: string, debut: number, duree: number }>`
  - `<SafeZones />` — calque rouge translucide.
  - `promoSchema` (Zod) et `PromoProps`.

- [ ] **Étape 1 : Écrire le test AVANT le code**

Créez `test/timing.test.mjs` :

```js
import { test, expect } from 'vitest'
import { SCENES, DUREE, IPS } from '../src/timing.ts'

test('les scènes sont contiguës — ni trou, ni chevauchement', () => {
  for (let i = 1; i < SCENES.length; i++) {
    expect(SCENES[i].debut, `trou avant ${SCENES[i].nom}`)
      .toBe(SCENES[i - 1].debut + SCENES[i - 1].duree)
  }
})

test('la première scène part de zéro', () => {
  expect(SCENES[0].debut).toBe(0)
})

test('le montage fait exactement 28 secondes', () => {
  const fin = SCENES.at(-1).debut + SCENES.at(-1).duree
  expect(fin).toBe(DUREE)
  expect(DUREE / IPS).toBe(28)
})

test('la vidéo tient sous la coupure de WhatsApp', () => {
  expect(DUREE / IPS).toBeLessThanOrEqual(30)
})

test('la chute dure au moins trois secondes', () => {
  const chute = SCENES.find((s) => s.nom === 'Chute')
  expect(chute.duree / IPS).toBeGreaterThanOrEqual(3)
})
```

- [ ] **Étape 2 : Le lancer et vérifier qu'il ÉCHOUE**

Lancez : `npm test`
Attendu : ÉCHEC — module `../src/timing.ts` introuvable.

- [ ] **Étape 3 : Écrire `src/timing.ts`**

```ts
export const IPS = 30
export const LARGEUR = 1080
export const HAUTEUR = 1920

// 28 s et non 30 : WhatsApp découpe un statut au-delà de trente secondes, et la
// chute — l'adresse du site — est le seul plan dont la perte annulerait la
// vidéo entière.
export const DUREE = 840

export const SCENES = [
  { nom: 'Ouverture', debut: 0, duree: 90 },
  { nom: 'Promesse', debut: 90, duree: 150 },
  { nom: 'Fil', debut: 240, duree: 180 },
  { nom: 'RadioAgenda', debut: 420, duree: 150 },
  { nom: 'Langues', debut: 570, duree: 120 },
  { nom: 'Chute', debut: 690, duree: 150 },
] as const
```

- [ ] **Étape 4 : Relancer et vérifier que ça PASSE**

Lancez : `npm test`
Attendu : 12 tests passés.

- [ ] **Étape 5 : Écrire `src/components/SafeZones.tsx`**

```tsx
import { AbsoluteFill } from 'remotion'
import { ZONES_INTERDITES } from '../theme'

/** Calque de CONTRÔLE. Jamais activé dans un rendu livré. */
export const SafeZones: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
      height: ZONES_INTERDITES.haut, background: 'rgba(224, 73, 47, 0.35)' }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
      height: ZONES_INTERDITES.bas, background: 'rgba(224, 73, 47, 0.35)' }} />
  </AbsoluteFill>
)
```

- [ ] **Étape 6 : Écrire `src/Promo.tsx` avec six scènes vides**

```tsx
import { AbsoluteFill, Sequence } from 'remotion'
import { z } from 'zod'
import { SCENES } from './timing'
import { COULEURS } from './theme'
import { SafeZones } from './components/SafeZones'
import './fonts'

// Ce que le Studio doit pouvoir corriger à la main — et donc réécrire dans le
// code. Les CHIFFRES n'y sont pas : ils viennent de `facts.json`, généré, et un
// chiffre saisi à la main est précisément ce que la spec interdit.
export const promoSchema = z.object({
  montrerZones: z.boolean(),
  promesse: z.array(z.string()).length(3),
  adresse: z.string(),
  signature: z.string(),
})

export type PromoProps = z.infer<typeof promoSchema>

// Les scènes réelles remplacent ce bouchon une par une, tâches 6 à 9.
const Bouchon: React.FC<{ nom: string }> = ({ nom }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center',
    color: COULEURS.texteDoux, fontSize: 60 }}>{nom}</AbsoluteFill>
)

export const Promo: React.FC<PromoProps> = ({ montrerZones }) => (
  <AbsoluteFill style={{ backgroundColor: COULEURS.basalte }}>
    {SCENES.map((s) => (
      <Sequence key={s.nom} from={s.debut} durationInFrames={s.duree} name={s.nom}>
        <Bouchon nom={s.nom} />
      </Sequence>
    ))}
    {montrerZones ? <SafeZones /> : null}
  </AbsoluteFill>
)
```

Les tâches 6 et 9 remplaceront les bouchons et **passeront `promesse`,
`adresse` et `signature` aux scènes concernées** — c'est à ce moment-là que le
schéma cesse d'être décoratif.
```

- [ ] **Étape 7 : Déclarer la composition dans `src/Root.tsx`**

```tsx
import { Composition } from 'remotion'
import { Promo, promoSchema } from './Promo'
import { DUREE, HAUTEUR, IPS, LARGEUR } from './timing'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PromoWhatsApp"
    component={Promo}
    durationInFrames={DUREE}
    fps={IPS}
    width={LARGEUR}
    height={HAUTEUR}
    schema={promoSchema}
    defaultProps={{
      montrerZones: false,
      // Le texte de `ArmenianNews/pages/lien.ch.html`, découpé en trois temps.
      promesse: ['Toute la vie arménienne', 'sur une page.', 'Refaite chaque heure.'],
      adresse: 'armenieinfo.ch',
      signature: 'Gratuit. Sans compte. Sans publicité.',
    }}
  />
)
```

- [ ] **Étape 8 : Vérifier dans le Studio**

```bash
npx remotion studio --no-open
```

Attendu : la composition `PromoWhatsApp` existe, dure 28 s, et la frise montre
six segments nommés.

- [ ] **Étape 9 : Commit**

```bash
git add -A
git commit -m "Table de temps gardée par des tests, squelette à six scènes"
```

---

### Tâche 6 : Ouverture et Promesse

**Fichiers :**
- Créer : `src/components/Ararat.tsx`, `src/scenes/Ouverture.tsx`,
  `src/scenes/Promesse.tsx`
- Modifier : `src/Promo.tsx`

**Interfaces :**
- Consomme : `COULEURS`, `POLICES`, `SCENES`.
- Produit : `<Ararat trace={number} taille={number} />` où `trace` va de 0
  (rien) à 1 (rempli).

- [ ] **Étape 1 : Écrire `src/components/Ararat.tsx`**

Le `path` est **recopié** de `ArmenianNews/public/favicon.svg`. Ne le retracez
pas : Masis, le sommet le plus haut, est à **droite** — c'est la vue depuis
l'Arménie, et un tracé miroir est un SVG parfaitement valide que rien ne
signalerait.

```tsx
import { interpolate } from 'remotion'
import { COULEURS } from '../theme'

const CRETE = 'M3 51 L20.5 19 L30 30.5 L40.5 12 L61 51 Z'
const NEIGE_MASIS = 'M40.5 12 L35.2 21.5 L42.4 23.6 L37.2 28.8 L30 30.5 Z'
const NEIGE_SIS = 'M20.5 19 L17.4 25 L22.6 26.2 L18.4 30 Z'

export const Ararat: React.FC<{ trace: number; taille: number }> = ({ trace, taille }) => {
  const remplissage = interpolate(trace, [0.55, 1], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  // `pathLength={1}` renormalise le contour : le tiret et le décalage
  // s'expriment alors en FRACTION du tracé, sans avoir à en mesurer la longueur
  // réelle. Une longueur devinée se verrait — trop courte, le tracé finirait
  // avant la fin ; trop longue, il resterait coupé.
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64">
      <path d={CRETE} fill={COULEURS.abricot} fillOpacity={remplissage}
        stroke={COULEURS.abricot} strokeWidth={1.5}
        pathLength={1} strokeDasharray={1}
        strokeDashoffset={interpolate(trace, [0, 0.7], [1, 0], {
          extrapolateRight: 'clamp',
        })} />
      <path d={NEIGE_MASIS} fill={COULEURS.basalte} opacity={0.32 * remplissage} />
      <path d={NEIGE_SIS} fill={COULEURS.basalte} opacity={0.32 * remplissage} />
      <rect x={3} y={53.6} width={58} height={2.8} rx={1.4}
        fill={COULEURS.abricotProfond} opacity={remplissage} />
    </svg>
  )
}
```

- [ ] **Étape 2 : Écrire `src/scenes/Ouverture.tsx`**

```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Ararat } from '../components/Ararat'
import { COULEURS, POLICES } from '../theme'

export const Ouverture: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const trace = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: 'clamp' })
  const marque = spring({ frame: frame - 45, fps, config: { damping: 200 } })

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 60 }}>
      <Ararat trace={trace} taille={420} />
      <div style={{
        fontFamily: POLICES.display, fontStyle: 'italic', fontSize: 96,
        color: COULEURS.texte, opacity: marque,
        transform: `translateY(${interpolate(marque, [0, 1], [30, 0])}px)`,
      }}>
        Arménie Info
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Étape 3 : Écrire `src/scenes/Promesse.tsx`**

Trois segments, un par temps de la phrase. Le texte est celui de
`ArmenianNews/pages/lien.ch.html` — la vidéo et la carte de partage doivent dire
la même chose.

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { COULEURS, POLICES, ZONES_INTERDITES } from '../theme'

// Les instants d'apparition restent ici — c'est du montage, pas du texte.
// Le texte, lui, arrive en prop : c'est ce qui rend la scène corrigeable dans
// le Studio, et traduisible plus tard sans y toucher.
const APPARITIONS = [0, 35, 75]

export const Promesse: React.FC<{ segments: string[] }> = ({ segments }) => {
  const frame = useCurrentFrame()
  const SEGMENTS = segments.map((texte, i) => ({ texte, apparait: APPARITIONS[i] }))
  return (
    <AbsoluteFill style={{
      justifyContent: 'center', paddingLeft: 90, paddingRight: 90,
      paddingTop: ZONES_INTERDITES.haut, paddingBottom: ZONES_INTERDITES.bas,
    }}>
      {SEGMENTS.map((s, i) => {
        const t = interpolate(frame - s.apparait, [0, 18], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
        return (
          <div key={s.texte} style={{
            fontFamily: POLICES.display,
            fontStyle: i === 0 ? 'italic' : 'normal',
            fontSize: i === 0 ? 104 : 88,
            lineHeight: 1.12,
            color: i === 2 ? COULEURS.abricot : COULEURS.texte,
            opacity: t,
            transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px)`,
            marginBottom: 28,
          }}>
            {s.texte}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
```

- [ ] **Étape 4 : Les brancher dans `src/Promo.tsx`**

Les scènes ne prenant pas les mêmes props, une table de composants « tous
identiques » ne suffit pas. Écrivez le rendu d'une scène explicitement :

```tsx
const rendreScene = (nom: string, props: PromoProps) => {
  switch (nom) {
    case 'Ouverture': return <Ouverture />
    case 'Promesse': return <Promesse segments={props.promesse} />
    default: return <Bouchon nom={nom} />
  }
}

// …dans le corps de Promo, `props` étant l'objet complet :
<Sequence key={s.nom} from={s.debut} durationInFrames={s.duree} name={s.nom}>
  {rendreScene(s.nom, props)}
</Sequence>
```

Signez donc `Promo` comme `({ ...props }: PromoProps)` — ou gardez l'objet
entier — plutôt que de déstructurer `montrerZones` seul.

- [ ] **Étape 5 : Vérifier les tests et le rendu fixe**

```bash
npm test
npx remotion still PromoWhatsApp out/verif-ouverture.png --frame=45
npx remotion still PromoWhatsApp out/verif-promesse.png --frame=200
```

Ouvrez les deux PNG. **Contrôlez la police** : « Arménie Info » doit être en
Fraunces italique — un serif à empattements marqués, pas la Times du système. Si
c'est du Times, `src/fonts.ts` n'a pas été importé ou `delayRender` a été
contourné.

- [ ] **Étape 6 : Commit**

```bash
git add -A
git commit -m "Scènes Ouverture et Promesse ; l'Ararat repris du favicon, Masis à droite"
```

---

### Tâche 7 : La scène `Fil`

**Fichiers :**
- Créer : `src/components/Pastille.tsx`, `src/scenes/Fil.tsx`
- Modifier : `src/Promo.tsx`

**Interfaces :**
- Consomme : `public/shots/accueil.png`, `src/facts.json`.
- Produit : `<Pastille>{enfants}</Pastille>` — puce abricot, encre sombre.

- [ ] **Étape 1 : Écrire `src/components/Pastille.tsx`**

```tsx
import { COULEURS, POLICES } from '../theme'

export const Pastille: React.FC<{ children: React.ReactNode; opacite?: number }> = ({
  children, opacite = 1,
}) => (
  <div style={{
    display: 'inline-block',
    background: COULEURS.abricot,
    color: COULEURS.encreSurAbricot,
    fontFamily: POLICES.corps,
    fontSize: 46,
    fontWeight: 600,
    padding: '18px 34px',
    borderRadius: 999,
    opacity: opacite,
  }}>
    {children}
  </div>
)
```

- [ ] **Étape 2 : Écrire `src/scenes/Fil.tsx`**

```tsx
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { Pastille } from '../components/Pastille'
import { COULEURS, ZONES_INTERDITES } from '../theme'
import facts from '../facts.json'

export const Fil: React.FC = () => {
  const frame = useCurrentFrame()

  // Le défilement est CALCULÉ, pas filmé : la capture est pleine page et on la
  // fait glisser. Aucune saccade possible, et on recadre sans re-capturer.
  const y = interpolate(frame, [0, 180], [-200, -2400])

  const pastille1 = interpolate(frame, [20, 35, 80, 95], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })
  const pastille2 = interpolate(frame, [100, 115, 165, 180], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  const minutes = Math.round((Date.parse(facts.genereLe) - Date.parse(facts.instantaneLe)) / 60000)

  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS.basalte }}>
      <Img src={staticFile('shots/accueil.png')}
        style={{ width: '100%', position: 'absolute', top: 0, transform: `translateY(${y}px)` }} />
      <AbsoluteFill style={{
        justifyContent: 'flex-end', alignItems: 'center',
        paddingBottom: ZONES_INTERDITES.bas + 40,
        background: `linear-gradient(transparent 55%, ${COULEURS.basalte} 92%)`,
      }}>
        <div style={{ position: 'absolute', bottom: ZONES_INTERDITES.bas + 40 }}>
          <Pastille opacite={pastille1}>{facts.sources} rédactions</Pastille>
        </div>
        <div style={{ position: 'absolute', bottom: ZONES_INTERDITES.bas + 40 }}>
          <Pastille opacite={pastille2}>mis à jour il y a {minutes} min</Pastille>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

- [ ] **Étape 3 : Brancher et vérifier**

Ajoutez `case 'Fil': return <Fil />` à `rendreScene`, puis :

```bash
npx remotion still PromoWhatsApp out/verif-fil.png --frame=270
npx remotion still PromoWhatsApp out/verif-fil-fin.png --frame=400
```

Trois contrôles : la capture **bouge** entre les deux images ; la pastille
« 7 rédactions » est lisible ; **le bas de la capture n'est pas dépassé** (pas
de bande vide sous l'image). Si elle se vide, réduisez la valeur finale du
`interpolate` de `y`.

- [ ] **Étape 4 : Commit**

```bash
git add -A
git commit -m "Scène Fil : la capture défile, les pastilles portent les chiffres générés"
```

---

### Tâche 8 : La scène `RadioAgenda`

**Fichiers :**
- Créer : `src/scenes/RadioAgenda.tsx`
- Modifier : `src/Promo.tsx`

**Interfaces :**
- Consomme : `public/shots/radio.png`, `public/shots/agenda.png`,
  `src/facts.json`, `<Pastille>`.

- [ ] **Étape 1 : Écrire `src/scenes/RadioAgenda.tsx`**

```tsx
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Pastille } from '../components/Pastille'
import { COULEURS, ZONES_INTERDITES } from '../theme'
import facts from '../facts.json'

export const RadioAgenda: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const haut = spring({ frame, fps, config: { damping: 200 } })
  const bas = spring({ frame: frame - 20, fps, config: { damping: 200 } })

  const utile = 1920 - ZONES_INTERDITES.haut - ZONES_INTERDITES.bas
  const moitie = utile / 2

  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS.basalte,
      paddingTop: ZONES_INTERDITES.haut, paddingBottom: ZONES_INTERDITES.bas }}>

      <div style={{ height: moitie, overflow: 'hidden', position: 'relative',
        transform: `translateX(${interpolate(haut, [0, 1], [-1080, 0])}px)` }}>
        <Img src={staticFile('shots/radio.png')}
          style={{ width: '100%', position: 'absolute', top: -300 }} />
        <div style={{ position: 'absolute', bottom: 30, left: 40 }}>
          <Pastille opacite={interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            {facts.stations} radios en direct
          </Pastille>
        </div>
      </div>

      <div style={{ height: moitie, overflow: 'hidden', position: 'relative',
        transform: `translateX(${interpolate(bas, [0, 1], [1080, 0])}px)` }}>
        <Img src={staticFile('shots/agenda.png')}
          style={{ width: '100%', position: 'absolute', top: -300 }} />
        <div style={{ position: 'absolute', bottom: 30, right: 40 }}>
          <Pastille opacite={interpolate(frame, [55, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            {facts.evenements} événements, {facts.pays} pays
          </Pastille>
        </div>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Étape 2 : Brancher et vérifier**

Ajoutez `case 'RadioAgenda': return <RadioAgenda />` à `rendreScene`, puis :

```bash
npx remotion still PromoWhatsApp out/verif-radioagenda.png --frame=500
```

Contrôles : les deux moitiés sont arrivées ; les deux pastilles sont hors des
zones interdites ; le cadrage `top: -300` montre bien le contenu et non l'en-tête
du site — ajustez cette valeur par vue si nécessaire.

- [ ] **Étape 3 : Commit**

```bash
git add -A
git commit -m "Scène RadioAgenda : deux moitiés, deux preuves"
```

---

### Tâche 9 : `Langues` et `Chute`

**Fichiers :**
- Créer : `src/scenes/Langues.tsx`, `src/scenes/Chute.tsx`
- Modifier : `src/Promo.tsx`

**Interfaces :**
- Consomme : `COULEURS`, `POLICES`, `<Ararat>`.

- [ ] **Étape 1 : Écrire `src/scenes/Langues.tsx`**

Les quatre phrases sont les `site.tagline` de `ArmenianNews/src/i18n.jsx`,
recopiées **verbatim**.

Elles **s'empilent** au lieu de se remplacer, et ce n'est pas un détail
d'animation : la version évidente — faire se réécrire la marque — finit sur
`Armenia News` deux fois, l'anglais et le russe partageant la même marque sur le
`.org`. Et quatre secondes ne suffisent pas à lire quatre phrases de soixante
signes ; empilées, elles n'ont pas à être lues — la différence entre latin,
arménien et cyrillique se voit d'un coup.

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { COULEURS, POLICES, ZONES_INTERDITES } from '../theme'

const LIGNES = [
  { pastille: 'FR', police: POLICES.corps,
    texte: 'Un instantané horaire de la vie arménienne, du monde et de Suisse' },
  { pastille: 'EN', police: POLICES.corps,
    texte: 'An hourly snapshot of Armenian life, from the world and Switzerland' },
  { pastille: 'ՀԱՅ', police: POLICES.corpsHy,
    texte: 'Հայկական կյանքի ժամային պատկեր՝ աշխարհից եւ Շվեյցարիայից' },
  { pastille: 'РУ', police: POLICES.corpsRu,
    texte: 'Ежечасный снимок армянской жизни, со всего мира и из Швейцарии' },
]

export const Langues: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{
      justifyContent: 'center', gap: 44, paddingLeft: 80, paddingRight: 80,
      paddingTop: ZONES_INTERDITES.haut, paddingBottom: ZONES_INTERDITES.bas,
    }}>
      {LIGNES.map((l, i) => {
        const t = interpolate(frame - i * 20, [0, 16], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        })
        return (
          <div key={l.pastille} style={{ display: 'flex', alignItems: 'baseline', gap: 26,
            opacity: t, transform: `translateX(${interpolate(t, [0, 1], [-40, 0])}px)` }}>
            <span style={{ fontFamily: POLICES.corps, fontSize: 34, fontWeight: 700,
              color: COULEURS.abricot, minWidth: 90 }}>{l.pastille}</span>
            <span style={{ fontFamily: l.police, fontSize: 44, lineHeight: 1.3,
              color: COULEURS.texte }}>{l.texte}</span>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
```

- [ ] **Étape 2 : Écrire `src/scenes/Chute.tsx`**

```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Ararat } from '../components/Ararat'
import { COULEURS, POLICES, ZONES_INTERDITES } from '../theme'

export const Chute: React.FC<{ adresse: string; signature: string }> = ({
  adresse, signature,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const entree = spring({ frame, fps, config: { damping: 200 } })

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 50,
      paddingTop: ZONES_INTERDITES.haut, paddingBottom: ZONES_INTERDITES.bas }}>
      <div style={{ opacity: entree, transform: `scale(${interpolate(entree, [0, 1], [0.85, 1])})` }}>
        <Ararat trace={1} taille={240} />
      </div>
      <div style={{ fontFamily: POLICES.display, fontSize: 92, color: COULEURS.abricot,
        opacity: entree }}>
        {adresse}
      </div>
      <div style={{ fontFamily: POLICES.corps, fontSize: 42, color: COULEURS.texteDoux,
        opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        textAlign: 'center' }}>
        {signature}
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Étape 3 : Brancher, puis vérifier l'ARMÉNIEN et le RUSSE**

Ajoutez à `rendreScene` :

```tsx
case 'Langues': return <Langues />
case 'Chute': return <Chute adresse={props.adresse} signature={props.signature} />
```


```bash
npx remotion still PromoWhatsApp out/verif-langues.png --frame=660
npx remotion still PromoWhatsApp out/verif-chute.png --frame=780
```

**Ouvrez `verif-langues.png` et regardez la troisième et la quatrième ligne.**
C'est le seul contrôle qui attrape le repli de police, et il ne se fait qu'à
l'œil :

- Des **rectangles vides** sur la ligne `ՀԱՅ` → la Noto arménienne n'est pas
  chargée.
- Une ligne `РУ` en police visiblement différente des autres → Golos n'est pas
  chargée, ou le texte est tombé sur `cyrillic-ext` au lieu de `cyrillic`.

- [ ] **Étape 4 : Commit**

```bash
git add -A
git commit -m "Scènes Langues (empilée, quatre écritures) et Chute"
```

---

### Tâche 10 : Vérifier, rendre, livrer

**Fichiers :**
- Modifier : `package.json` (scripts), `README.md` (créer)

- [ ] **Étape 1 : Le contrôle des zones interdites**

```bash
npx remotion still PromoWhatsApp out/zones-1.png --frame=200 --props='{"montrerZones":true}'
npx remotion still PromoWhatsApp out/zones-2.png --frame=500 --props='{"montrerZones":true}'
npx remotion still PromoWhatsApp out/zones-3.png --frame=660 --props='{"montrerZones":true}'
npx remotion still PromoWhatsApp out/zones-4.png --frame=780 --props='{"montrerZones":true}'
```

Aucun mot, aucune pastille, aucun chiffre ne doit toucher les bandes rouges.
Corrigez les scènes fautives avant de continuer.

- [ ] **Étape 2 : Rafraîchir les données puis rendre**

```bash
npm run facts
npm run shots
npx remotion render PromoWhatsApp out/arménie-info-promo.mp4 --codec=h264
```

Le premier rendu télécharge le Chrome Headless Shell de Remotion (~150 Mo).

- [ ] **Étape 3 : Contrôler le fichier produit**

```bash
ls -la out/arménie-info-promo.mp4
npx remotion versions
```

Attendu : durée **28,0 s**, poids **sous 10 Mo**. Si le fichier dépasse,
ajoutez `--crf=26`.

- [ ] **Étape 4 : Écrire le `README.md`**

```markdown
# armenie-info-promo

La vidéo promo verticale d'armenieinfo.ch, pour les statuts WhatsApp.
1080×1920, 28 s, muette, en français.

## Refaire la vidéo

    npm run facts     # relit les chiffres du site voisin
    npm run shots     # recapture armenieinfo.ch (Chrome requis)
    npx remotion render PromoWhatsApp out/promo.mp4 --codec=h264

**Toujours dans cet ordre.** `facts` et `shots` sont des étapes manuelles
locales : elles ont besoin du réseau et d'un Chrome, et rien ne justifie de les
rejouer en continu.

## Ce qui se périme

Les captures portent les titres du jour ; les pastilles portent les chiffres de
l'instantané. Une vidéo vieille d'un mois annonce un agenda d'il y a un mois —
relancez les trois commandes plutôt que de corriger un chiffre à la main.

## Le dépôt voisin

`ARMENIANNEWS_DIR` (défaut : `../ArmenianNews`) désigne le dépôt du site. Ce
projet le lit, il ne l'écrit jamais.

## Conception

Le raisonnement est dans le dépôt du site :
`docs/superpowers/specs/2026-08-23-video-promo-whatsapp-design.md`.
```

- [ ] **Étape 5 : Ne pas versionner les rendus**

```bash
printf 'out/\n' >> .gitignore
```

- [ ] **Étape 6 : Lancer tout le harnais une dernière fois**

```bash
npm test
```

Attendu : 12 tests passés, 0 échec.

- [ ] **Étape 7 : Commit**

```bash
git add -A
git commit -m "README et contrôles de livraison ; la vidéo se refait en trois commandes"
```

- [ ] **Étape 8 : Le seul test que l'outillage ne peut pas faire**

Envoyez le MP4 sur votre téléphone, postez-le en statut, regardez-le. Contrôlez
que le nom du compte en haut et le champ « Répondre » en bas ne recouvrent rien,
et que la chute reste à l'écran assez longtemps pour être photographiée.
