# Le tambour de source — sélecteur vertical à 360° du navigateur d'actualités sur mobile

**Date** : 2026-08-01
**Portée** : `src/components/NewsBrowser.jsx`, `src/components/useSourceDrum.js` (nouveau),
`src/styles/global.css`.

## Le problème

`.newsfeed__tabwrap` aligne les marques sur une seule ligne en `overflow-x: auto`.
Sous 640 px, un écran de 360 px en montre deux et demie sur sept : le lecteur ne
voit pas qu'il y en a sept, et la barre de défilement de 3 px est le seul indice
qu'il en manque. Le nombre de sources par langue va de cinq (`ru`) à sept
(`fr`, `en`, `hy`), donc le défaut est constant sur les quatre vitrines.

Deuxième défaut, tactile : chaque cible fait la largeur du mot (~90 px) alors
que la ligne entière est disponible.

## La solution

Un **cylindre**. Les marques sont réparties autour d'un axe horizontal ; une
**bande de lumière abricot fixe** traverse le milieu du cadre. Le nom qui passe
dans la bande est le nom actif. Il n'y a ni bordure, ni fond coloré, ni
pastille : **la sélection est l'éclairage**. Les voisines s'inclinent, s'éloignent
et perdent la lumière ; au-delà de 90° elles sont passées derrière le cylindre.

**Il tourne à 360° et il boucle** : après la dernière marque revient la
première, dans les deux sens, au geste comme au clavier.

C'est la thèse du système de design (« basalte volcanique, lumière abricot »)
appliquée à un contrôle, à la place du soulignement d'onglet générique.

```
   ┈┈┈┈┈┈┈┈┈ CivilNet ┈┈┈┈┈┈┈┈┈┈       +42°   la DERNIÈRE source
  ═══════════════════════════════════
       A R M E N P R E S S    ●           0°   pleine lumière
  ═══════════════════════════════════
   ┈┈┈┈┈┈┈ ArménieInfo.tv ┈┈┈┈┈┈┈┈       −42°
              · · ● · · · ·               7 marques, la 1ʳᵉ est active
```

## Décisions actées

| Question | Décision | Pourquoi |
|---|---|---|
| Portée | Tambour **sous 640 px seulement** ; au-dessus, le rail masthead actuel inchangé | Le rail tient sur une ligne sur large écran et sert de manchette. Le défaut est propre au mobile. |
| Hauteur | **3 rangs pleins, 132 px**, plus l'amorce des suivants | 5 rangs coûteraient 210 px avant le premier article, un tiers d'un écran de 640 px. |
| Contenu du rang | La marque seule, plus le point rouge « en direct » | Le tambour sélectionne ; la fraîcheur est déjà sur chaque carte. |
| Repère de position | **Une pastille de 3 px par source** sous le cadre | C'est le seul endroit où le nombre de sources est écrit. C'est la réponse directe au défaut. |
| Bouclage | **Oui, dans les deux sens** | Demandé. Sept marques se parcourent d'un geste continu ; s'arrêter au bout impose un demi-tour. |
| Pas angulaire | **42° constants**, quel que soit le nombre de sources | Le russe en a cinq et les autres sept. Un pas dérivé du nombre (360°/n) donnerait à la roue russe une allure différente d'une vitrine à l'autre. |

## Architecture

### Un seul DOM, deux rendus

Contrainte de tête : **aucun balisage n'est dupliqué.** Ce sont les mêmes
`<button role="tab">` dans le même `role="tablist"`. Une media query `≤640px`
les passe en colonne, et le hook les pose sur le cylindre.

Ce que cela évite, et qui n'est pas théorique dans ce dépôt :

- le **HTML prérendu** ne change pas (`scripts/prerender.mjs` cuit le DOM rendu ;
  un second arbre y partirait en double dans les douze pages) ;
- rien à ajouter aux gardes `hreflang` / `data-view` / agenda ;
- pas de second chemin de code à tenir synchronisé avec `TAB_ORDER`.

Le seul ajout au DOM est la rangée de pastilles, `aria-hidden`, `display: none`
au-dessus de 640 px.

### Pourquoi l'aimantation native du navigateur est écartée

`scroll-snap` était la première implémentation, et **elle ne peut pas boucler** :
elle vit sur un défileur, un défileur a un début et une fin, et rien ne permet
d'en recoudre les deux bouts. Les contournements connus triplent la liste dans
le DOM et sautent d'une copie à l'autre — inacceptable ici, puisque ces mêmes
boutons servent de rail horizontal sur large écran et partent dans le HTML
prérendu : vingt-et-un onglets, dont quatorze mensongers.

La roue est donc pilotée à la main sur les sept éléments réels. Effet de bord
bienvenu : le piège documenté dans la première version — l'aimantation calcule
ses points d'accroche sur la boîte **transformée**, donc l'inclinaison
corrompait la géométrie et le rang actif se reposait 13 px sous la bande —
disparaît avec l'aimantation elle-même.

### `src/components/useSourceDrum.js`

Un hook, hors de `NewsBrowser.jsx` (déjà 426 lignes, et il porte déjà
`TAB_ORDER`, `buildSources`, `ArticleCard` et `useNow`). Il ne connaît que la
géométrie et le geste ; il ignore ce qu'est une source.

```js
useSourceDrum({ trackRef, itemRefs, ids, activeId, onSettle })
```

- **`pos`** est un flottant libre, **jamais borné à `[0, n)` pendant le geste**.
  C'est `ring(d, n)` — l'écart le plus court sur l'anneau, dans `[-n/2, n/2)` —
  qui produit le bouclage. Le ramener de force ferait sauter la roue au passage
  du zéro.
- Écrit sur chaque rang `--a` (son angle) et `--o` (son opacité). **Le signe de
  l'angle est négatif** : `rotateX` positif fait *monter* un rang, donc sans ce
  moins le rang suivant apparaîtrait au-dessus de l'actif et un glissement vers
  le bas ferait monter le contenu. Mesuré à l'écran, pas déduit.
- Au-delà de 90°, un rang est derrière le cylindre : `visibility: hidden` **et**
  `pointer-events: none` — sa boîte se superpose sinon à celle du rang de face.
- **Pas de `setPointerCapture`.** Ce serait le réflexe pour suivre un doigt qui
  sort du cadre, mais la capture réoriente aussi le `click` de compatibilité
  vers l'élément capturant : le `onClick` des boutons ne partirait plus, et
  toucher une marque ne sélectionnerait rien. On écoute
  `pointermove`/`pointerup` sur `window`.
- **Hors du mode tambour, aucun écouteur, aucune variable**, et nettoyage de
  celles déjà posées.

### Le repli sans JavaScript

Il est porté par le **CSS**, pas par le hook. Tant que la classe `is-drum` n'est
pas posée — et c'est le hook qui la pose —, la colonne reste une liste plate,
défilante et aimantée. Utilisable, sans boucle. Ne déplacez pas `is-drum` dans
le rendu React : elle mentirait si le hook ne tournait pas.

### Deux garde-fous, et pourquoi ils existent

1. **`paint()` refuse d'écrire hors service.** Sans cette garde, une image
   d'animation déjà programmée au moment du passage en large écran réécrirait
   `visibility: hidden` sur les rangs qui étaient derrière le cylindre — et le
   rail masthead perdrait trois marques, en silence.
2. **`sync()` est idempotente et branchée sur `resize` en plus de `change`.**
   `change` est la voie normale, mais elle peut manquer : redimensionner un
   `<iframe>` depuis le document parent fait basculer `matches` **sans** émettre
   l'événement (constaté dans Chrome avec un écouteur témoin indépendant).
   Le cas réel visé est le doigt encore posé pendant une rotation d'écran.

### CSS

Bloc unique dans `global.css`, sous `@media (max-width: 640px)`.

- `.newsfeed__tabs` : colonne, `height: 132px`, `width: min(84%, 340px)`
  centrée, `perspective: 560px`, masque de fondu aux deux bords. **Un masque et
  non un dégradé vers la couleur de fond** : le site a une bascule jour / nuit,
  un fond en dur mentirait sous l'un des deux thèmes.
- `.newsfeed__tabs.is-drum` : `overflow: hidden`, `touch-action: none`,
  aimantation coupée.
- `.newsfeed__tabs.is-drum .newsfeed__tab` : tous les rangs à la **même** place,
  le milieu du cadre, et la rotation seule les répartit —
  `translateZ(-62px) rotateX(var(--a)) translateZ(62px)`. Le premier
  `translateZ` recule le cylindre entier ; sans lui, le rang de face serait
  62 px plus près de l'œil que le plan du cadre, donc agrandi par la
  perspective.
- **Convention du fichier à ne pas casser** : toute règle qui pose
  `font-family: var(--font-X)` pose aussi `font-size-adjust: var(--fsa-X)`.

### Jetons

Deux jetons nouveaux, un par thème, pour la lueur de la bande :

```css
:root                { --drum-glow: rgba(242, 169, 59, 0.12); }
[data-theme='light'] { --drum-glow: rgba(207, 125, 24, 0.15); }
```

Aucune autre couleur n'est introduite.

## Interaction

| Geste | Effet |
|---|---|
| Glissement vertical | La roue suit le doigt, puis part en inertie et s'aimante sur le rang le plus proche. Elle boucle sans butée. |
| Toucher un voisin | Il revient au centre **par le plus court chemin**, en passant par le bord si c'est plus court. |
| ↑ ↓ | Rang précédent / suivant, avec bouclage. **S'ajoutent** à ← → (conservées) et à `Home` / `End`. |
| Molette | Rotation, puis aimantation après 90 ms d'arrêt. |
| Cible tactile | ~300 × 44 px (contre ~90 × 45 px avant). |

Le tambour **ne va pas bord à bord** : sur 132 px de haut, un défileur pleine
largeur capture le geste de qui fait défiler la page en posant le doigt là. Les
gouttières laissées de part et d'autre restent un endroit où le glissement
atteint la page.

## Accessibilité

- `role="tablist"` / `role="tab"` / `aria-selected` / `tabIndex` roving :
  inchangés. Le tambour est une **peau**, pas un nouveau motif ARIA.
- La rangée de pastilles est `aria-hidden` : elle redit ce que `aria-selected`
  porte déjà.
- `prefers-reduced-motion: reduce` : le geste reste (c'est de la manipulation
  directe), mais l'animation qui court seule après lui disparaît — le rang se
  pose d'un coup.
- Focus clavier visible sur la ligne entière.

## Ce qui n'est pas fait

- Le rendu desktop n'est pas touché.
- Aucun changement dans `TAB_ORDER`, `buildSources` ou les données.

## Vérification

1. `npm run lint` — 0 erreur, **5 avertissements** (les cinq connus, documentés
   dans `CLAUDE.md`). Un sixième serait une régression.
2. `npm test` — les 119 tests.
3. `npm run build && npm run check` — les douze pages.
4. Inspection à 360 et 390 px dans les **quatre** langues (les listes font
   7 / 7 / 7 / 5 rangs) et les **deux** thèmes, plus le rail desktop à 1000 px.
5. Bouclage : sur la première source, la **dernière** doit être juste au-dessus ;
   ↑ depuis la première mène à la dernière, ↓ depuis la dernière à la première.
6. Passage mobile → desktop **avec un doigt encore posé** : la classe `is-drum`
   et toutes les variables en ligne doivent disparaître, et les sept marques
   rester visibles.

> **Le banc d'essai en `<iframe>` ne sait pas tester le changement de viewport.**
> Redimensionner l'iframe depuis le parent met bien à jour `innerWidth` et
> `matches`, mais **n'émet ni `resize` ni `change`** dans la fenêtre interne.
> Vérifiez chaque largeur par un **chargement neuf**, et simulez la transition en
> émettant l'événement à la main.

**Le déploiement n'est pas dans cette spec.** Un push sur `main` déclenche
`hourly.yml`, donc la production. Le travail reste local jusqu'à validation à
l'écran.
