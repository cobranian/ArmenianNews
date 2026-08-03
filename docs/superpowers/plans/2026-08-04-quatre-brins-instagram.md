# Le mur Instagram en quatre brins — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper le mur Instagram en quatre brins taillés dans les 25 comptes
existants, ramener le tirage à 18 posts par brin, et replier les pastilles de
comptes derrière une bascule par brin.

**Architecture:** Aucune structure nouvelle. `selectInstagram` groupe déjà par
`acc.group` : ajouter deux valeurs de `group` dans `src/data/instagram.json`
suffit à produire deux brins de plus. `Social.jsx` reçoit deux entrées dans son
tableau `igStrands` et un sous-composant local `AccountChips` qui replie les
pastilles. Un test neuf relie les trois côtés (données, vue, i18n), parce que
leur désaccord est silencieux.

**Tech Stack:** React 18 (pas de bibliothèque d'état), JSON importés au build,
`node --test` (aucun réseau), ESLint config plate, CSS unique
(`src/styles/global.css`).

**Spec:** `docs/superpowers/specs/2026-08-04-quatre-brins-instagram-design.md`

## Global Constraints

- **Ne renommez pas les clés `group` existantes** (`institutions`,
  `personnalites`). Le repli `acc.group || 'institutions'` est écrit à deux
  endroits — `scripts/sources/instagram.mjs:31` et `src/components/Social.jsx:274`
  — et un renommage y ferait disparaître des comptes en silence.
- **Toute clé i18n neuve doit exister dans les QUATRE blocs `STRINGS`** de
  `src/i18n.jsx` (fr, en, hy, ru). `t()` vaut
  `STRINGS[lang][clé] ?? STRINGS.fr[clé] ?? clé` : trois blocs sur quatre
  suffisent à masquer le trou derrière le repli français.
- **Un nombre affiché entre par un gabarit `{n}`**, jamais concaténé ni écrit
  en toutes lettres. Les quatre brins n'ont pas le même compte.
- **`src/data/instagram.json` se relit et se réécrit avec
  `JSON.stringify(pool, null, 2) + '\n'`** — vérifié aller-retour identique à
  l'octet près. N'éditez pas ce fichier à la main.
- **Aucun test ne touche le réseau.**
- Le français porte tous ses accents. Les messages de commit du dépôt sont en
  français **sans accents**.
- `npm run lint` doit rester à **0 erreur, 5 avertissements** (les cinq connus,
  documentés dans CLAUDE.md). Aucun avertissement neuf.

---

### Task 1 : Les quatre brins, et le test qui les relie

**Files:**
- Create: `test/instagram-strands.test.mjs`
- Modify: `src/data/instagram.json` (les `group` de 9 comptes)
- Modify: `src/i18n.jsx` (2 clés × 4 blocs, après `'ig.strand.people'` aux
  lignes 60, 267, 486, 681)
- Modify: `src/components/Social.jsx:270-273` (tableau `igStrands`)
- Modify: `CLAUDE.md:339-343` et `CLAUDE.md:728-731`, `README.md:33`,
  `README.md:297-301`, `README.md:327-333`

**Interfaces:**
- Consomme : rien.
- Produit : quatre valeurs de `group` (`institutions`, `personnalites`,
  `creation`, `terre`) lisibles dans `src/data/instagram.json` ; quatre clés de
  titre (`ig.strand`, `ig.strand.people`, `ig.strand.studio`,
  `ig.strand.land`) ; un tableau `igStrands` de quatre entrées, **une entrée par
  ligne** dans `Social.jsx` (le test le lit comme du texte).

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `test/instagram-strands.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ALL_LANGS } from '../sites.config.js'

// Node ne sait pas importer du JSX : on lit `igStrands` comme du texte,
// exactement comme test/stations.test.mjs lit STATIONS et
// test/source-count.test.mjs lit TAB_ORDER.
const pool = JSON.parse(
  await readFile(new URL('../src/data/instagram.json', import.meta.url), 'utf-8'),
)
const jsx = await readFile(
  new URL('../src/components/Social.jsx', import.meta.url),
  'utf-8',
)
const i18n = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')

// Une entree d'igStrands, sur UNE ligne. Si prettier en enveloppe une, ce
// motif n'en trouve que trois et le premier test tombe — bruyamment, ce qui
// est le but : un brin muet est exactement ce qu'on refuse.
const strands = [
  ...jsx.matchAll(
    /\{\s*id:\s*'[\w-]+',\s*group:\s*'(\w+)',\s*title:\s*t\('([\w.]+)'\)\s*\}/g,
  ),
].map(([, group, key]) => ({ group, key }))

// Le repli est ecrit a deux endroits (scripts/sources/instagram.mjs et
// Social.jsx) : le test lit la meme regle, sinon il garderait autre chose que
// ce que le site affiche.
const groupOf = (acc) => acc.group || 'institutions'

test('le mur declare quatre brins', () => {
  assert.equal(strands.length, 4, 'igStrands ne declare plus quatre brins')
  assert.deepEqual(
    strands.map((s) => s.group).sort(),
    ['creation', 'institutions', 'personnalites', 'terre'],
  )
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Un `group` mal
// orthographie cree un cinquieme brin qu'igStrands ne rend jamais : le compte
// disparait du mur. C'est une chaine valide dans un JSON valide — ni le lint,
// ni le build, ni npm run check ne peuvent le voir.
test('aucun compte n est hors des quatre brins', () => {
  const declares = new Set(strands.map((s) => s.group))
  for (const acc of pool.accounts) {
    assert.ok(
      declares.has(groupOf(acc)),
      `@${acc.handle} porte group: '${groupOf(acc)}' — aucun brin ne le rend`,
    )
  }
})

test('aucun brin n est vide', () => {
  for (const s of strands) {
    const n = pool.accounts.filter((acc) => groupOf(acc) === s.group).length
    assert.ok(n > 0, `le brin '${s.group}' n a aucun compte — son titre serait mort`)
  }
})

// On compte les DECLARATIONS dans i18n.jsx : quatre par cle, une par bloc
// STRINGS. Trois suffiraient a l'affichage (le repli sur le francais masque le
// trou), et c'est precisement ce qu'il faut attraper — sinon le carrousel
// s'intitulerait `ig.strand.land`, cuit dans le HTML que Google indexe.
function declarations(cle) {
  return (i18n.match(new RegExp(`'${cle.replace(/\./g, '\\.')}':`, 'g')) || []).length
}

test('chaque brin a son titre dans les quatre langues', () => {
  for (const s of strands) {
    assert.equal(
      declarations(s.key),
      ALL_LANGS.length,
      `${s.key} manque dans un des quatre blocs STRINGS de src/i18n.jsx ` +
        `— le carrousel afficherait la cle elle-meme`,
    )
  }
})
```

- [ ] **Step 2 : Lancer le test et le voir échouer**

Run: `node --test test/instagram-strands.test.mjs`
Expected: FAIL — `le mur declare quatre brins`, « Expected values to be strictly
equal: 2 !== 4 ».

- [ ] **Step 3 : Regrouper les neuf comptes**

Ne pas éditer le JSON à la main. Lancer :

```bash
node -e "
const fs=require('fs');
const p='src/data/instagram.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
const TERRE=['explorearmenia','unexplored_armenia','armenia.travel','ig_armenia'];
const CREATION=['armeniancreators','armenian_women_artists','margarit.armeniandance','haykmiqayelyanart','abgarart'];
let n=0;
for(const a of d.accounts){
  if(TERRE.includes(a.handle)){a.group='terre';n++}
  else if(CREATION.includes(a.handle)){a.group='creation';n++}
}
if(n!==9) throw new Error('attendu 9 comptes deplaces, obtenu '+n);
fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
const g={};for(const a of d.accounts)g[a.group||'institutions']=(g[a.group||'institutions']||0)+1;
console.log(g);
"
```

Expected: `{ institutions: 10, personnalites: 6, terre: 4, creation: 5 }`

- [ ] **Step 4 : Ajouter les deux titres dans les quatre blocs**

Dans `src/i18n.jsx`, juste après chaque ligne `'ig.strand.people'` :

```js
// bloc fr (apres la ligne 60)
    'ig.strand.studio': 'Ateliers arméniens',
    'ig.strand.land': 'Terres arméniennes',

// bloc en (apres la ligne 267)
    'ig.strand.studio': 'Armenian studios',
    'ig.strand.land': 'Armenian lands',

// bloc hy (apres la ligne 486)
    'ig.strand.studio': 'Հայկական արվեստանոցներ',
    'ig.strand.land': 'Հայկական բնաշխարհ',

// bloc ru (apres la ligne 681)
    'ig.strand.studio': 'Армянские мастерские',
    'ig.strand.land': 'Армянские просторы',
```

Les quatre titres partagent une construction — « Mosaïque arménienne », « Visages
arméniens », « Ateliers arméniens », « Terres arméniennes ». `բնաշխարհ` (le pays
comme paysage) et `просторы` (les étendues) sont préférés à une traduction
littérale de « terre », qui dirait le sol et non le voyage.

- [ ] **Step 5 : Déclarer les deux brins dans la vue**

Dans `src/components/Social.jsx`, remplacer le tableau `igStrands`
(lignes 270-273) par :

```jsx
  const igStrands = [
    { id: 'instagram', group: 'institutions', title: t('ig.strand') },
    { id: 'instagram-visages', group: 'personnalites', title: t('ig.strand.people') },
    { id: 'instagram-ateliers', group: 'creation', title: t('ig.strand.studio') },
    { id: 'instagram-terres', group: 'terre', title: t('ig.strand.land') },
  ]
```

**Une entrée par ligne**, sans retour à la ligne interne : le test les lit comme
du texte. Mettre à jour le commentaire juste au-dessus, qui annonce deux brins :

```jsx
  // The wall reads as four strands: the community and its institutions, the
  // people who are its face, the studios where the work is made, and the land
  // itself. Each account declares its own strand in instagram.json; anything
  // unlabelled falls in with the first.
```

- [ ] **Step 6 : Lancer le test et le voir passer**

Run: `node --test test/instagram-strands.test.mjs`
Expected: PASS, 4 tests.

Puis la suite entière, pour vérifier qu'aucun autre test ne comptait les brins :

Run: `npm test`
Expected: PASS, 130 tests (126 + 4).

- [ ] **Step 7 : Mettre les documents d'accord avec les données**

Trois affirmations sont désormais fausses, et elles portent des chiffres :

`CLAUDE.md:339-343` — remplacer « chaque compte déclare son `group`
(`institutions` | `personnalites`, 8 comptes chacun) » et « Le job horaire
appelle `selectInstagram(30)`, donc 60 posts » par les quatre brins et leurs
comptes (10 / 6 / 5 / 4). Laisser le **pourquoi** (le tirage par groupe, sinon
le groupe le plus fourni chasse l'autre) intact : c'est ce qui vaut d'être
écrit. Le nombre de posts (72) est mis à jour en Task 2, pas ici.

`CLAUDE.md:728-731` — le schéma du pool : `group` vaut désormais
`institutions`, `personnalites`, `creation` ou `terre` (absent =
`institutions`).

`README.md:33`, `README.md:297-301`, `README.md:327-333` — « 16 curated
accounts » (il y en a **25**), « **Two** swipeable carousels … 8 accounts each »
et « one carousel per strand » : quatre brins, 10 / 6 / 5 / 4.

- [ ] **Step 8 : Commit**

```bash
git add test/instagram-strands.test.mjs src/data/instagram.json src/i18n.jsx src/components/Social.jsx CLAUDE.md README.md
git commit -m "feat(social): le mur Instagram passe a quatre brins"
```

---

### Task 2 : 18 tuiles par brin, et la sélection re-tirée

**Files:**
- Modify: `scripts/sources/instagram.mjs:26` (défaut du paramètre) et le
  commentaire lignes 20-25
- Modify: `scripts/scrape.mjs:257` (`selectInstagram(30)`)
- Modify: `src/data/instagram-feed.json` (régénéré, jamais à la main)
- Modify: `CLAUDE.md` (le nombre de posts du job horaire)

**Interfaces:**
- Consomme : les quatre valeurs de `group` posées en Task 1.
- Produit : `src/data/instagram-feed.json` dont les `posts` portent les quatre
  `group`, 18 par brin, et dont `generatedAt` est **inchangé**.

- [ ] **Step 1 : Baisser le plafond**

`scripts/sources/instagram.mjs`, ligne 26 :

```js
export async function selectInstagram(limit = 18) {
```

`scripts/scrape.mjs`, ligne 257 :

```js
    igPosts = await selectInstagram(18)
```

Et dans le commentaire de `instagram.mjs` (lignes 20-25), remplacer
« institutions | personnalites » par les quatre brins. Le reste du raisonnement
— `limit` par groupe et non `limit` en tout — reste vrai mot pour mot.

- [ ] **Step 2 : Re-tirer la sélection, `generatedAt` inchangé**

**C'est l'étape qu'on oublie.** Les posts de `instagram-feed.json` portent leur
`group` : tant qu'il n'est pas re-tiré, il ne contient que les deux anciens
brins et **deux des quatre carrousels seraient vides** — jusqu'au prochain
instantané horaire, puisqu'un push sur `main` bâtit et déploie **sans**
re-scraper.

`generatedAt` est repris du fichier existant : aucun instantané n'a lieu ici,
seule la sélection change. Même règle que le `lastmod` des sitemaps, qui ne
prend jamais l'heure du build.

```bash
node --input-type=module -e "
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { selectInstagram } from './scripts/sources/instagram.mjs'
const p='src/data/instagram-feed.json'
const prev=JSON.parse(await readFile(p,'utf-8'))
const meta=JSON.parse(await readFile('src/data/meta.json','utf-8'))
const pool=JSON.parse(await readFile('src/data/instagram.json','utf-8'))
const poolUrls=new Set(pool.accounts.flatMap(a=>(a.posts||[]).map(x=>x.url)))
const code=u=>u.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1]||u
const posts=await selectInstagram(18)
await writeFile(p, JSON.stringify({ generatedAt: prev.generatedAt, posts }, null, 2)+'\n')
const byGroup=posts.reduce((m,x)=>(m[x.group]=(m[x.group]||0)+1,m),{})
console.log('total', posts.length, JSON.stringify(byGroup))
console.log('generatedAt inchange:', prev.generatedAt===meta.generatedAt)
console.log('sans image:', posts.filter(x=>!existsSync('src/data/ig/'+code(x.url)+'.jpg')).length)
console.log('hors pool:', posts.filter(x=>!poolUrls.has(x.url)).length)
console.log('doublons:', posts.length-new Set(posts.map(x=>code(x.url))).size)
"
```

Expected:
```
total 72 {"institutions":18,"personnalites":18,"terre":18,"creation":18}
generatedAt inchange: true
sans image: 0
hors pool: 0
doublons: 0
```

- [ ] **Step 3 : Vérifier que les quatre brins arrivent bien dans la vue**

Run:
```bash
node -e "
const f=require('./src/data/instagram-feed.json');
const g={};for(const p of f.posts)g[p.group]=(g[p.group]||0)+1;
console.log(g);
console.log('un handle par brin:', Object.fromEntries(Object.keys(g).map(k=>[k,new Set(f.posts.filter(p=>p.group===k).map(p=>p.handle)).size])));
"
```
Expected: quatre brins à 18, et le nombre de comptes distincts par brin ≤ le
nombre de comptes du brin (10 / 6 / 5 / 4).

- [ ] **Step 4 : Mettre CLAUDE.md d'accord sur le nombre**

`CLAUDE.md`, dans la description de `instagram.mjs` : « Le job horaire appelle
`selectInstagram(18)`, donc 72 posts dans `instagram-feed.json`. »

- [ ] **Step 5 : Lancer la suite**

Run: `npm test`
Expected: PASS, 130 tests.

- [ ] **Step 6 : Commit**

```bash
git add scripts/sources/instagram.mjs scripts/scrape.mjs src/data/instagram-feed.json CLAUDE.md
git commit -m "feat(social): 18 tuiles par brin, selection re-tiree sur les quatre"
```

---

### Task 3 : Les pastilles repliées derrière une bascule

**Files:**
- Modify: `src/components/Social.jsx` (sous-composant `AccountChips`, et son
  usage lignes 350-364)
- Modify: `src/i18n.jsx` (2 clés × 4 blocs, à côté des autres `ig.*`)
- Modify: `src/styles/global.css:2825-2849` (`.ig-accounts`, `.ig-chip`)

**Interfaces:**
- Consomme : `igStrands` (Task 1) — chaque entrée fournit `id` et `group`.
- Produit : `AccountChips({ id, accounts, t })`, sous-composant **local** (non
  exporté — l'exporter ferait entrer `Social.jsx` dans la règle
  `react-refresh/only-export-components` et ajouterait un sixième
  avertissement).

- [ ] **Step 1 : Ajouter les deux chaînes dans les quatre blocs**

Dans `src/i18n.jsx`, après `'ig.visit'` dans chaque bloc :

```js
// bloc fr
    'ig.accounts.all': 'Les comptes suivis ({n})',
    'ig.accounts.less': 'Masquer les comptes',

// bloc en
    'ig.accounts.all': 'Accounts we follow ({n})',
    'ig.accounts.less': 'Hide accounts',

// bloc hy
    'ig.accounts.all': 'Հետևվող հաշիվները ({n})',
    'ig.accounts.less': 'Թաքցնել հաշիվները',

// bloc ru
    'ig.accounts.all': 'Аккаунты ({n})',
    'ig.accounts.less': 'Скрыть аккаунты',
```

**Le nombre est entre parenthèses, pas dans la phrase**, et c'est un écart
délibéré au motif de `radio.stations.all` (« Voir les {n} stations »). Là-bas le
nombre est **fixe** (12) et le russe s'accorde une fois pour toutes
(« 12 радиостанций »). Ici il vaut 10, 6, 5 ou 4 selon le brin, et le russe
change de forme avec lui — « 4 аккаунта » mais « 10 аккаунтов ». Une forme
unique dans la phrase serait donc fausse pour au moins un brin, sans que rien ne
le signale. La parenthèse met le nombre hors de la grammaire.

- [ ] **Step 2 : Écrire le sous-composant**

Dans `src/components/Social.jsx`, juste avant la fonction du composant `Social`
(après les autres sous-composants du fichier) :

```jsx
/* Les pastilles de comptes : des portes d'entrée vers les profils, et le repli
   d'un compte dont aucun post n'a encore été récolté — sans elles, ce compte
   n'existerait nulle part sur le site.
 *
 * Repliées par défaut : à 25 comptes, le rang repoussait le brin suivant très
 * bas. Le motif est celui des douze stations (`.radio__stations-toggle`), à une
 * différence près : la bascule des stations n'existe que sous 640px, parce que
 * la mise en page dépliée tient d'elle-même sur grand écran. 25 pastilles
 * encombrent autant un écran large qu'un téléphone.
 *
 * REPLIÉ = `hidden`, PAS une opacité. C'est l'inverse exact du piège du
 * tambour, où il fallait `opacity: 0` pour garder des onglets focusables dans
 * l'arbre d'accessibilité : ici on veut que ces liens SORTENT du parcours
 * clavier tant qu'ils sont repliés. Et `hidden` les laisse dans le HTML
 * prérendu, donc les liens sortants restent lisibles par les crawlers. */
function AccountChips({ id, accounts, t }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ig-accounts">
      <button
        type="button"
        className="ig-accounts__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {open
          ? t('ig.accounts.less')
          : t('ig.accounts.all').replace('{n}', accounts.length)}
        <span aria-hidden="true">{open ? ' ⌃' : ' ⌄'}</span>
      </button>
      <div className="ig-accounts__list" id={id} hidden={!open}>
        {accounts.map((acc) => (
          <a
            key={acc.handle}
            className="ig-chip"
            href={acc.url}
            rel="noopener noreferrer"
            title={t('ig.visit')}
          >
            <span aria-hidden="true">◎</span> @{acc.handle}
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : L'appeler à la place du rang**

Dans le rendu, remplacer le bloc `{/* Account chips… */}` et son
`<div className="ig-accounts">` (lignes 350-364) par :

```jsx
              <AccountChips
                id={`${id}-comptes`}
                accounts={ig.accounts.filter((acc) => inGroup(group)(acc))}
                t={t}
              />
```

`id` est celui du brin (`instagram`, `instagram-visages`, `instagram-ateliers`,
`instagram-terres`), donc `aria-controls` désigne un élément unique sur les
quatre brins.

- [ ] **Step 4 : Les styles**

Dans `src/styles/global.css`, remplacer la règle `.ig-accounts`
(lignes 2825-2831) par :

```css
.ig-accounts {
  margin-top: 40px;
  text-align: center;
}
.ig-accounts__toggle {
  /* 14px de rembourrage vertical et un plancher explicite : le rembourrage
     seul ne suffit pas, la hauteur de ligne dépend de l'écriture — même mesure
     que `.radio__stations-toggle`, qui tombait à 43px en arménien. */
  padding: 14px 12px;
  min-height: 44px;
  background: none;
  border: 0;
  font-family: var(--font-mono);
  font-size-adjust: var(--fsa-util);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: var(--apricot-ink);
  cursor: pointer;
}
/* Jeton de focus, pas de filet — voir `.newsfeed__tab:focus-visible`. */
.ig-accounts__toggle:focus-visible {
  outline: 2px solid var(--apricot-ink-strong);
  outline-offset: 2px;
  border-radius: 3px;
}
.ig-accounts__list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
}
/* SANS CETTE RÈGLE, LA BASCULE NE CACHE RIEN. Le `display: none` de l'attribut
   `hidden` vient de la feuille du navigateur ; n'importe quelle règle d'auteur
   qui pose un `display` la bat, quelle que soit sa spécificité. Le rang
   resterait donc affiché, et le bouton ne ferait que changer d'intitulé. */
.ig-accounts__list[hidden] {
  display: none;
}
```

- [ ] **Step 5 : Lint et tests**

Run: `npm run lint`
Expected: 0 erreur, **5** avertissements (les cinq connus). Un sixième
signifierait que `AccountChips` a été exporté — ne pas l'exporter.

Run: `npm test`
Expected: PASS, 130 tests.

- [ ] **Step 6 : Vérifier le rendu**

**REQUIRED SUB-SKILL:** invoquer le skill `verifier-le-rendu` du dépôt avant
toute affirmation sur le rendu. Ce qu'il faut avoir vu, dans les deux thèmes :

- **360 px et large**, replié **et** déplié, sur les quatre brins.
- **Les quatre langues.** Le titre le plus long est arménien
  (`Հայկական արվեստանոցներ`) et c'est lui qui décide si la tête de brin tient ;
  la bascule arménienne est celle qui frôle le plancher de 44 px.
- **Le parcours clavier** : replié, aucun `◎ @compte` ne prend le focus ;
  déplié, ils le prennent tous. Mesure directe dans la console de la page :

```js
document.querySelectorAll('.ig-accounts__list[hidden] a').length  // 25 replies
document.activeElement                                            // apres Tab
```

- **`aria-expanded`** suit l'état : `false` replié, `true` déplié.

- [ ] **Step 7 : Commit**

```bash
git add src/components/Social.jsx src/i18n.jsx src/styles/global.css
git commit -m "feat(social): replier les pastilles de comptes derriere une bascule"
```

---

### Task 4 : Vérification de bout en bout

**Files:** aucun fichier modifié si tout passe. Sinon, correction dans le
fichier fautif puis nouveau commit.

**Interfaces:**
- Consomme : les trois tâches précédentes.
- Produit : la preuve que les douze pages sortent justes.

- [ ] **Step 1 : La suite complète**

Run: `npm test`
Expected: PASS, 130 tests.

Run: `npm run lint`
Expected: 0 erreur, 5 avertissements.

- [ ] **Step 2 : Le build à deux vitrines et son contrôle**

Run: `npm run build && npm run check`
Expected: les 12 pages et les 2 sitemaps/robots contrôlés, aucune erreur.
`check-build.mjs` ne lit pas le mur Instagram — ce qu'on vérifie ici, c'est
qu'aucune des deux vitrines n'a été cassée par un changement de composant.

- [ ] **Step 3 : Le prérendu**

Run: `npm run prerender`
Expected: 12 pages cuites, aucune garde `lang` ni `data-view` en échec.

Puis, sur le HTML cuit — les pastilles doivent y être **présentes et repliées** :

```bash
node -e "
const fs=require('fs');
const h=fs.readFileSync('dist/ch/index.html','utf8');
console.log('pastilles dans le HTML prerendu:', (h.match(/ig-chip/g)||[]).length);
console.log('rangs replies:', (h.match(/ig-accounts__list[^>]*hidden/g)||[]).length);
console.log('titres de brin:', ['Mosaïque','Visages','Ateliers','Terres'].filter(s=>h.includes(s)));
"
```
Expected: 25 pastilles, 4 rangs repliés, les quatre titres présents. Zéro
pastille voudrait dire que le repli les a sorties du DOM au lieu de les cacher —
25 liens sortants perdus, et un compte sans post récolté devenu invisible.

- [ ] **Step 4 : Commit s'il y a eu correction**

```bash
git add -A
git commit -m "fix(social): <ce qui a ete corrige>"
```

---

## Ce que ce plan ne fait pas

- **Aucun compte n'est recruté ni récolté.** Les quatre brins sont taillés dans
  les 25 comptes du pool ; `npm run ig-scrape` n'est pas lancé.
- **Le plafond reste un seul chiffre** pour les quatre brins. Un plafond par
  brin serait plus fin et ferait diverger deux endroits.
- **`igStrands` reste écrit dans `Social.jsx`** : l'ordre d'affichage est une
  décision éditoriale, pas une donnée récoltée.
