# Chargement différé des images — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire que les 189 images de l'accueil ne se téléchargent plus au chargement — 11,6 Mo aujourd'hui pour un premier écran qui n'en montre aucune.

**Architecture :** Le correctif tient en quatre lignes déplacées — `loading="lazy"` remonte au-dessus de `src` dans les quatre `<img>` du dépôt qui le portent, parce que React pose les attributs dans l'ordre du JSX. Le reste du plan est la **preuve** : une mesure de référence avant, la même après, et un critère chiffré qui décide seul si l'hypothèse tient.

**Tech Stack :** React 18 (JSX), Vite, `puppeteer-core` (déjà en devDependency), `node --test`.

**Spec :** `docs/superpowers/specs/2026-08-05-chargement-differe-images-design.md`

## Global Constraints

- **Le critère de réussite est chiffré et ne se renégocie pas : au plus 20 images chargées au repos**, contre 189 aujourd'hui. Entre 20 et 189, l'hypothèse est **réfutée**.
- **Une mesure locale ne prouve rien seule.** Le seuil de déclenchement du chargement différé de Chrome dépend de la connexion estimée : court sur une liaison rapide, généreux sur une lente. `npm run preview` est la liaison la plus rapide qui soit — le résultat y sera flatteur, et devra être **reconfirmé sur la production après déploiement**.
- **Avant et après doivent être mesurés sur le MÊME banc** : même viewport (412 × 915), même serveur (`npm run preview`, `dist/ch`), sans défiler. Le nombre d'images chargées dépend directement du viewport ; changer de largeur entre les deux mesures invalide la comparaison.
- **Périmètre strict** : les composants qui rendent une `<img>`, et un fichier de test. **Aucune donnée, aucun script ajouté au dépôt, aucun style.** Le code de mesure vit dans le répertoire temporaire, pas dans `src/` ni `scripts/`.
- **Pas de `fetchpriority`, pas de `decoding`, pas d'attributs `width`/`height`.** Non mesurés, donc non motivés — et le CLS vaut déjà 0.
- **Le repli (`IntersectionObserver`) n'est PAS dans ce plan.** Si la mesure réfute l'hypothèse, on s'arrête et il fera l'objet de sa propre spec.
- **Contrôles qui doivent passer à chaque commit :** `npm test` (172 tests aujourd'hui, ce plan en ajoute), `npm run lint` (**0 erreur et exactement 5 avertissements connus** — un sixième est une régression).
- **Ce dossier est son propre dépôt git.** Vérifier `git rev-parse --show-toplevel` avant tout commit.

---

### Task 1 : La mesure de référence

**Files:**
- Aucun fichier du dépôt n'est modifié. Le script de mesure est écrit dans le répertoire temporaire.

**Interfaces:**
- Consumes: rien
- Produces: **le chiffre « avant » sur le banc local** — nombre d'images chargées au repos et octets transférés. C'est la seule valeur à laquelle la tâche 3 aura le droit de se comparer.

**Pourquoi cette tâche existe.** Le « avant » connu (189 images, 11,6 Mo) a été mesuré **sur la production**. La tâche 3 mesurera sur `npm run preview`. Comparer les deux serait comparer deux bancs différents — et le seuil de Chrome dépend justement de la liaison. Il faut donc un « avant » local.

- [ ] **Step 1 : Bâtir et servir**

```bash
npm run build
```

Attendu : `✓ 2 vitrines bâties : ch (fr), org (en/hy/ru)`

Puis, dans un terminal séparé (ou en tâche de fond) :

```bash
npm run preview
```

Attendu : un serveur sur `http://localhost:4173`.

- [ ] **Step 2 : Écrire le script de mesure dans le répertoire temporaire**

Le chemin exact du répertoire temporaire est donné par la variable d'environnement de la session ; à défaut, utiliser `$TMPDIR` / `$TEMP`. Écrire `mesure-lazy.mjs` :

```js
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = process.argv[2] || 'http://localhost:4173/'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  // `true` et non `'new'` : le depot est en puppeteer-core 25.3.0, ou `'new'`
  // est deprecie et `true` designe deja le mode headless moderne.
  headless: true,
  // 412 x 915 : un telephone. LE NOMBRE D IMAGES CHARGEES DEPEND DU VIEWPORT,
  // donc cette valeur doit etre IDENTIQUE avant et apres, sans quoi la
  // comparaison ne veut rien dire.
  defaultViewport: { width: 412, height: 915 },
  args: ['--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
// Laisser le navigateur finir ce qu il a commence, SANS DEFILER : c est
// exactement ce que fait un lecteur qui ouvre la page et s arrete.
await new Promise((r) => setTimeout(r, 8000))

const m = await page.evaluate(() => {
  const res = performance.getEntriesByType('resource')
  const imgs = res.filter((r) => r.initiatorType === 'img')
  const balises = [...document.querySelectorAll('img')]
  const enVue = balises.filter((i) => {
    const r = i.getBoundingClientRect()
    return r.top < innerHeight && r.bottom > 0
  }).length
  return {
    imagesChargees: imgs.length,
    octetsImages: imgs.reduce((n, r) => n + (r.encodedBodySize || 0), 0),
    balisesImg: balises.length,
    avecLazy: document.querySelectorAll('img[loading=lazy]').length,
    imagesDansLaFenetre: enVue,
    hauteurPage: document.documentElement.scrollHeight,
    hauteurFenetre: innerHeight,
  }
})

console.log(JSON.stringify({ url: URL, ...m, octetsImagesMo: +(m.octetsImages / 1048576).toFixed(2) }, null, 1))
await browser.close()
```

- [ ] **Step 3 : Mesurer, trois fois**

```bash
node <repertoire-temporaire>/mesure-lazy.mjs
node <repertoire-temporaire>/mesure-lazy.mjs
node <repertoire-temporaire>/mesure-lazy.mjs
```

Trois passages, parce qu'une mesure unique ne vaut rien — c'est la règle du dépôt, et elle a déjà attrapé un FCP fantôme à 5 668 ms pendant la conception.

Attendu : `imagesChargees` autour de **189**, `imagesDansLaFenetre` à **0**, et les trois passages cohérents entre eux.

**Consigner les trois valeurs.** Elles sont la référence de la tâche 3.

**Si `imagesChargees` est déjà bas en local (≤ 20)** alors que la production en charge 189, s'arrêter : cela signifierait que le banc local ne reproduit pas le défaut, et qu'il ne pourra donc pas prouver sa correction. Il faudrait alors mesurer autrement (throttling réseau) avant de continuer.

- [ ] **Step 4 : Rien à commiter**

Cette tâche ne modifie aucun fichier du dépôt. Vérifier :

```bash
git status --porcelain
```

Attendu : aucune ligne.

---

### Task 2 : Le garde et le réordonnancement

**Files:**
- Create: `test/img-lazy.test.mjs`
- Modify: `src/components/Agenda.jsx:42-48`
- Modify: `src/components/NewsBrowser.jsx:89-95`
- Modify: `src/components/Social.jsx:127-133`
- Modify: `src/components/Social.jsx:173-179`

**Interfaces:**
- Consumes: rien de la tâche 1 (la mesure est indépendante du code)
- Produces: le code corrigé, que la tâche 3 mesure

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `test/img-lazy.test.mjs` :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. React pose les
// attributs DANS L ORDRE DU JSX : poser `src` pendant que `loading` vaut encore
// sa valeur par defaut `eager` demarre le telechargement, et poser
// `loading="lazy"` apres n a plus d effet. Mesure le 5 aout 2026 : les 189
// images de l accueil se telechargeaient au chargement — 11,6 Mo — pour un
// premier ecran qui n en montre AUCUNE.
//
// Rien d autre ne le signale : ni le lint, ni les autres tests, ni le build,
// ni npm run check, ni le rendu. La page est parfaite, simplement 11,6 Mo trop
// lourde. Sans ce test, le correctif se defait au premier refactor qui
// reordonne des props, en silence.

const DIR = new URL('../src/components/', import.meta.url)

/** Chaque balise <img …/> du fichier, avec sa ligne de depart. */
function balisesImg(src) {
  const out = []
  const re = /<img\b/g
  let m
  while ((m = re.exec(src))) {
    const fin = src.indexOf('/>', m.index)
    if (fin === -1) continue
    out.push({
      ligne: src.slice(0, m.index).split('\n').length,
      corps: src.slice(m.index, fin),
    })
  }
  return out
}

const fichiers = (await readdir(DIR)).filter((f) => f.endsWith('.jsx'))
const balises = []
for (const f of fichiers) {
  const src = await readFile(new URL(f, DIR), 'utf-8')
  for (const b of balisesImg(src)) balises.push({ fichier: f, ...b })
}

// Une <img> SANS `loading` est hors sujet et doit le rester : la visionneuse
// (Lightbox.jsx) montre son image a la demande, elle doit charger tout de
// suite. Le test ne porte que sur celles qui se declarent differees.
const differees = balises.filter((b) => b.corps.includes('loading='))

test('loading est declare AVANT src dans chaque <img> differee', () => {
  for (const b of differees) {
    const iLoading = b.corps.indexOf('loading=')
    const iSrc = b.corps.indexOf('src=')
    assert.notEqual(iSrc, -1, `${b.fichier}:${b.ligne} — <img> differee sans src`)
    assert.ok(
      iLoading < iSrc,
      `${b.fichier}:${b.ligne} — src est declare AVANT loading. React pose les ` +
        `attributs dans l ordre du JSX, donc le telechargement part pendant que ` +
        `loading vaut encore eager, et le differe ne mord pas.`,
    )
  }
})

// Sans ce second test, retirer tous les `loading` ferait passer le premier au
// vert sur un tableau vide — un garde qui ne garde plus rien.
test('le depot porte au moins quatre images differees', () => {
  assert.ok(
    differees.length >= 4,
    `attendu au moins 4 <img> differees, trouve ${differees.length}`,
  )
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
node --test test/img-lazy.test.mjs
```

Attendu : **ÉCHEC** sur `loading est declare AVANT src`, en nommant un des quatre emplacements. Le second test doit passer.

**Un test qui n'a jamais été vu rouge ne prouve rien.** S'il passe du premier coup, c'est que `balisesImg` ne trouve pas les balises — vérifier avant d'aller plus loin.

- [ ] **Step 3 : Réordonner dans `src/components/Agenda.jsx`**

Remplacer :

```jsx
          <img
            className="agenda-card__photo"
            src={ev.image}
            alt={ev.title}
            loading="lazy"
            onError={() => setBroken(true)}
          />
```

par :

```jsx
          <img
            className="agenda-card__photo"
            loading="lazy"
            src={ev.image}
            alt={ev.title}
            onError={() => setBroken(true)}
          />
```

- [ ] **Step 4 : Réordonner dans `src/components/NewsBrowser.jsx`**

Remplacer :

```jsx
          <img
            src={src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
```

par :

```jsx
          <img
            loading="lazy"
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
```

- [ ] **Step 5 : Réordonner les deux `<img>` de `src/components/Social.jsx`**

Celle de Facebook — remplacer :

```jsx
          <img
            className="fb-card__photo"
            src={img}
            alt={by}
            loading="lazy"
            onError={() => setBroken(true)}
          />
```

par :

```jsx
          <img
            className="fb-card__photo"
            loading="lazy"
            src={img}
            alt={by}
            onError={() => setBroken(true)}
          />
```

Celle d'Instagram — remplacer :

```jsx
          <img
            className="ig-card__photo"
            src={img}
            alt={`@${handle} — ${name}`}
            loading="lazy"
            onError={() => setBroken(true)}
          />
```

par :

```jsx
          <img
            className="ig-card__photo"
            loading="lazy"
            src={img}
            alt={`@${handle} — ${name}`}
            onError={() => setBroken(true)}
          />
```

- [ ] **Step 6 : Lancer le test pour vérifier qu'il passe**

```bash
node --test test/img-lazy.test.mjs
```

Attendu : 2 tests, 0 échec.

- [ ] **Step 7 : Les contrôles du dépôt**

```bash
npm test 2>&1 | grep -E "^. (pass|fail)"
npm run lint 2>&1 | tail -2
npm run build 2>&1 | tail -2
npm run check 2>&1 | tail -2
```

Attendu : `pass 174`, `fail 0` (172 + 2) ; `0 errors, 5 warnings` ; `✓ 2 vitrines bâties` ; `✓ toutes les pages sont conformes`.

- [ ] **Step 8 : Commit**

```bash
git add test/img-lazy.test.mjs src/components/Agenda.jsx src/components/NewsBrowser.jsx src/components/Social.jsx
git commit -m "fix(images): declarer loading avant src pour que le differe morde

React pose les attributs DANS L ORDRE DU JSX. Poser src pendant que
loading vaut encore sa valeur par defaut eager demarre le telechargement,
et poser loading=\"lazy\" apres n a plus d effet. Les quatre <img> du depot
le declaraient dans le mauvais ordre.

Mesure avant : les 189 images de l accueil se telechargeaient au
chargement, 11,6 Mo, pour un premier ecran qui n en montre AUCUNE — la
page fait 10 804 px de haut pour une fenetre de 979, et la premiere image
est a 2 075 px du sommet.

Un test lit les composants COMME DU TEXTE et verifie l ordre, parce que
rien d autre ne le signale : ni le lint, ni les autres tests, ni le build,
ni check, ni le rendu. La page etait parfaite, simplement 11,6 Mo trop
lourde. Il a ete vu rouge avant d etre vu vert.

Il ne porte que sur les <img> qui se declarent differees : celle de la
visionneuse n a pas de loading et doit charger tout de suite. Un second
test exige au moins quatre images differees, sans quoi retirer tous les
loading ferait passer le premier au vert sur un tableau vide."
```

---

### Task 3 : La preuve locale, et le verdict

**Files:**
- Aucun fichier du dépôt n'est modifié.

**Interfaces:**
- Consumes: le chiffre « avant » de la tâche 1, le code corrigé de la tâche 2
- Produces: **le verdict**. Cette tâche est un portillon : elle autorise la suite ou l'arrête.

- [ ] **Step 1 : Rebâtir et resservir**

Le serveur de prévisualisation sert `dist/ch`, qui date d'avant le correctif. Le rebâtir est obligatoire, sans quoi on mesurerait l'ancien code.

```bash
npm run build
```

Attendu : `✓ 2 vitrines bâties : ch (fr), org (en/hy/ru)`

Redémarrer `npm run preview` s'il tournait sur l'ancien build.

- [ ] **Step 2 : Mesurer, trois fois, sur le MÊME banc**

Même script, même viewport, même serveur, sans défiler :

```bash
node <repertoire-temporaire>/mesure-lazy.mjs
node <repertoire-temporaire>/mesure-lazy.mjs
node <repertoire-temporaire>/mesure-lazy.mjs
```

- [ ] **Step 3 : Rendre le verdict**

| `imagesChargees` au repos | Verdict |
|---|---|
| **≤ 20** | Hypothèse **confirmée**. Continuer à la tâche 4. |
| **21 à 188** | Hypothèse **réfutée**. S'arrêter. |
| **189** (inchangé) | Hypothèse **réfutée**. S'arrêter. |

**Ne pas ajuster le seuil après coup.** Il a été fixé à 20 dans la spec, avant de connaître le résultat, précisément pour qu'il ne se plie pas à lui. Un passage de 189 à 150 est un échec, pas un progrès partiel.

**Si l'hypothèse est réfutée :** ne pas improviser un `IntersectionObserver` dans la foulée. Rapporter la mesure, laisser le correctif de la tâche 2 en place (l'ordre des attributs est juste dans l'absolu, même s'il ne suffit pas), et ouvrir une spec distincte pour le repli. C'est la consigne explicite de la spec.

- [ ] **Step 4 : Consigner l'écart**

Noter les trois valeurs après, à côté des trois valeurs avant. Elles entrent dans le message de commit de la tâche 4 et dans la mise à jour de `CLAUDE.md`.

---

### Task 4 : La documentation

**Files:**
- Modify: `CLAUDE.md` (section « À savoir »)

**Interfaces:**
- Consumes: les mesures avant/après des tâches 1 et 3
- Produces: rien de code

- [ ] **Step 1 : Ajouter le piège dans `CLAUDE.md`**

Sous « À savoir », ajouter une puce dont le contenu doit couvrir, avec les **chiffres réellement mesurés** aux tâches 1 et 3 :

- que React pose les attributs dans l'ordre du JSX, donc que `loading` doit précéder `src` ;
- que le défaut est **totalement silencieux** — lint, tests, build, `check` et rendu passent tous ;
- que `test/img-lazy.test.mjs` est le seul garde, et qu'il lit les composants comme du texte (Node ne sait pas importer du JSX) ;
- que le seuil de déclenchement de Chrome **dépend de la connexion estimée**, donc qu'une mesure locale est flatteuse et doit être reconfirmée en production.

- [ ] **Step 2 : En échange, chercher un piège périmé à retirer**

C'est la règle du fichier : « en ajoutant un piège, cherchez-en un périmé à retirer ». Relire la section « À savoir » et retirer ce qui ne vaut plus. Si rien n'est périmé, le dire explicitement dans le message de commit plutôt que de faire semblant d'avoir cherché.

- [ ] **Step 3 : Vérifier la taille annoncée**

`CLAUDE.md` annonce sa propre taille en tête. La re-mesurer et la corriger si l'écart dépasse 2 000 caractères :

```bash
wc -c CLAUDE.md
```

- [ ] **Step 4 : Les contrôles**

```bash
npm test 2>&1 | grep -E "^. (pass|fail)"
npm run lint 2>&1 | tail -2
```

Attendu : `pass 174`, `fail 0` ; `0 errors, 5 warnings`.

- [ ] **Step 5 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: le piege de l ordre des attributs sur une image differee"
```

Le message doit porter les chiffres avant/après réellement mesurés.

---

### Task 5 : La reconfirmation en production

**Files:**
- Aucun.

**Interfaces:**
- Consumes: le déploiement du correctif
- Produces: la seule mesure qui décrit ce que vivent les lecteurs

**Cette tâche ne peut s'exécuter qu'APRÈS que le travail est fusionné, poussé et déployé.** Le déploiement est déclenché par un `push` sur `main` et prend quelques minutes.

- [ ] **Step 1 : Attendre la fin du déploiement**

```bash
gh run list --workflow hourly.yml --limit 1
```

Attendu : le run déclenché par le push, `completed / success`.

- [ ] **Step 2 : Mesurer la production, trois fois**

Même script, même viewport, mais sur l'URL publique :

```bash
node <repertoire-temporaire>/mesure-lazy.mjs https://armenieinfo.ch/
node <repertoire-temporaire>/mesure-lazy.mjs https://armenieinfo.ch/
node <repertoire-temporaire>/mesure-lazy.mjs https://armenieinfo.ch/
```

- [ ] **Step 3 : Comparer au « avant » de production**

Le « avant » de production est connu et daté : **189 images, 11,6 Mo, 0 dans la fenêtre**, mesuré le 5 août 2026.

Le même critère s'applique : **≤ 20 images chargées au repos**.

**C'est ici que le piège du seuil se referme.** Si le local disait ≤ 20 et que la production reste haute, c'est que le seuil de Chrome, plus généreux sur la liaison réelle, charge davantage. Ce n'est pas un échec du correctif — mais c'est un résultat à rapporter tel quel, sans le maquiller en réussite au motif que le local était bon.

- [ ] **Step 4 : Rapporter**

Rapporter les trois mesures de production à côté des trois mesures locales et du « avant ». Si les deux bancs divergent, dire lequel décrit le lecteur : **la production**.

---

## Self-Review

**1. Couverture de la spec**

| Exigence de la spec | Tâche |
|---|---|
| `loading="lazy"` avant `src` dans les quatre `<img>` | 2 (steps 3-5) |
| Protocole : compter images et octets au repos, sans défiler | 1 (step 2), 3 (step 2) |
| Critère chiffré ≤ 20, non renégociable | 3 (step 3), Global Constraints |
| Piège du seuil dépendant de la connexion | Global Constraints, 5 (step 3) |
| Reconfirmation en production | 5 |
| Garde textuel sur l'ordre des attributs | 2 (step 1) |
| Le test doit être vu rouge avant vert | 2 (step 2) |
| Repli `IntersectionObserver` hors de ce plan | 3 (step 3), Global Constraints |
| Ni `fetchpriority`, ni `decoding`, ni `width`/`height` | Global Constraints |
| Périmètre : composants + un test, aucun script ajouté | Global Constraints, 1 (step 4) |

Aucune exigence sans tâche. Les deux mesures fausses consignées dans la spec (le FCP fantôme, les URL `wsrv` avec `&amp;`) sont des mises en garde, pas des exigences : elles se traduisent par la règle « trois passages » des tâches 1, 3 et 5.

**2. Placeholders** — aucun `TBD`, `TODO`, ni « ajouter la gestion d'erreur appropriée ». La seule chose non écrite mot pour mot est le **contenu rédactionnel** de la puce `CLAUDE.md` (tâche 4, step 1) : ses quatre points obligatoires sont listés, mais le texte final dépend de chiffres qui n'existeront qu'à la tâche 3. L'écrire d'avance reviendrait à inventer une mesure.

**3. Cohérence des noms** — `mesure-lazy.mjs` porte le même nom aux tâches 1, 3 et 5, et le même viewport 412 × 915. `balisesImg(src)` et `differees` ne servent que dans `test/img-lazy.test.mjs`. Le seuil de 20 est écrit à l'identique dans les Global Constraints, la tâche 3 et la tâche 5.

**Un écart voulu entre les tâches 3 et 5** : la tâche 3 peut confirmer et la tâche 5 réfuter. Ce n'est pas une incohérence, c'est le piège du seuil — et la tâche 5 dit explicitement lequel des deux bancs fait foi.
