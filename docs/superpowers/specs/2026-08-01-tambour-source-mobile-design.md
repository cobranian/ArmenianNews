# Le tambour de source — sélecteur vertical du navigateur d'actualités sur mobile

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

Un **tambour** : les marques sont gravées sur un cylindre qui tourne sur un axe
horizontal. Une **bande de lumière abricot fixe** traverse le milieu du cadre.
Le nom qui passe dans la bande est le nom actif. Il n'y a ni bordure, ni fond
coloré, ni pastille : **la sélection est l'éclairage**. Les voisines s'inclinent
en arrière, s'éloignent et perdent la lumière.

C'est la thèse du système de design (« basalte volcanique, lumière abricot »)
appliquée à un contrôle, à la place du soulignement d'onglet générique
d'aujourd'hui.

```
   ┈┈┈┈┈┈ Nouvelles d'Arménie ┈┈┈┈┈┈      rotateX(28°)   opacité .34
  ═══════════════════════════════════
       A R M E N P R E S S    ●            0°  pleine lumière
  ═══════════════════════════════════
   ┈┈┈┈┈┈┈ ArménieInfo.tv ┈┈┈┈┈┈┈┈┈       rotateX(-28°)  opacité .34
              · · ● · · · ·                7 marques, la 3ᵉ est active
```

## Décisions actées

| Question | Décision | Pourquoi |
|---|---|---|
| Portée | Tambour **sous 640 px seulement** ; au-dessus, le rail masthead actuel inchangé | Le rail tient sur une ligne sur large écran et sert de manchette. Le défaut est propre au mobile. |
| Hauteur | **3 rangs, 132 px** (3 × 44) | 5 rangs coûteraient 210 px avant le premier article, un tiers d'un écran de 640 px. |
| Contenu du rang | La marque seule, plus le point rouge « en direct » | Le tambour sélectionne ; la fraîcheur est déjà sur chaque carte. |
| Repère de position | **Sept pastilles de 3 px** sous le cadre | C'est le seul endroit où le nombre de sources est écrit. C'est la réponse directe au défaut. |
| Cadre autour du rang actif | **Retiré** | La bande et le cadre feraient le même travail ; la bande est ce que le site a de propre. |

## Architecture

### Un seul DOM, deux rendus

Contrainte de tête : **aucun balisage n'est dupliqué.** Ce sont les mêmes
`<button role="tab">` dans le même `role="tablist"`. Une media query `≤640px`
les passe en colonne défilante avec perspective.

Ce que cela évite, et qui n'est pas théorique dans ce dépôt :

- le **HTML prérendu** ne change pas (`scripts/prerender.mjs` cuit le DOM rendu,
  un second arbre y partirait en double dans les douze pages) ;
- rien à ajouter aux gardes `hreflang` / `data-view` / agenda ;
- pas de second chemin de code à tenir synchronisé avec `TAB_ORDER`.

Le seul ajout au DOM est la rangée de pastilles, `aria-hidden`, `display: none`
au-dessus de 640 px.

### `src/components/useSourceDrum.js` — nouveau module

Un hook, hors de `NewsBrowser.jsx` (déjà 426 lignes, et il porte déjà
`TAB_ORDER`, `buildSources`, `ArticleCard` et `useNow`). Il ne connaît que le
défilement et la géométrie ; il ignore ce qu'est une source.

Interface :

```js
useSourceDrum({ trackRef, itemRefs, ids, activeId, onSettle })
```

- Écoute `matchMedia('(max-width: 640px)')`. **Hors du mode tambour, il ne pose
  aucun écouteur et n'écrit aucune variable CSS** — le rail desktop reste
  exactement ce qu'il est aujourd'hui.
- Sur défilement (throttlé en `requestAnimationFrame`), écrit sur chaque rang
  `--d` (distance signée au centre, en rangs, bornée à ±2.2) et `--o` (opacité).
- Sur repos du défilement (120 ms), appelle `onSettle(id)` avec le rang centré.
- Quand `activeId` change **de l'extérieur** (clavier, clic, changement de
  langue), recentre le rang — instantanément au montage, en douceur ensuite.
- Ignore les événements de défilement qu'il a lui-même provoqués, sinon un
  recentrage programmé rappellerait `onSettle` et pourrait boucler.

`--d` vaut `0` par défaut en CSS : **sans JavaScript, la colonne est une liste
plate, aimantée et défilante.** Dégradée, jamais cassée.

### CSS

Bloc unique dans `global.css`, à la suite du bloc `.newsfeed__tab*` existant,
sous `@media (max-width: 640px)`.

- `.newsfeed__tabs` devient le défileur : `flex-direction: column`,
  `height: 132px`, `overflow-y: auto`, `scroll-snap-type: y mandatory`,
  `perspective: 620px`, `padding-block: 44px` (pour que le premier et le dernier
  rang puissent se centrer), barre de défilement masquée.
- `mask-image: linear-gradient(...)` fond les deux bords du cadre. Un masque et
  non un dégradé de la couleur de fond : le site a une bascule jour / nuit, un
  fond en dur mentirait sous l'un des deux thèmes.
- `.newsfeed__tab` : `flex: 0 0 44px`, pleine largeur, `scroll-snap-align: center`,
  `transform: rotateX(calc(var(--d, 0) * -28deg)) translateZ(...)`,
  `opacity: var(--o, 1)`. Le soulignement (`border-bottom`) est neutralisé.
- La bande : `.newsfeed__tabwrap::before`, `pointer-events: none`, trois couches
  dans un seul dégradé — deux filets `--line-apricot` en haut et en bas, fondus
  aux extrémités horizontales, plus une lueur radiale.

**Convention du fichier à ne pas casser** : toute règle qui pose
`font-family: var(--font-display)` pose aussi `font-size-adjust: var(--fsa-display)`.

### Jetons

Deux jetons nouveaux, un par thème, pour la lueur de la bande :

```css
:root                  { --drum-glow: rgba(242, 169, 59, 0.11); }
[data-theme='light']   { --drum-glow: rgba(207, 125, 24, 0.12); }
```

Ils suivent le couple `--apricot` / `--apricot-deep` déjà en place. Aucune autre
couleur n'est introduite.

## Interaction

| Geste | Effet |
|---|---|
| Glissement vertical | Défilement natif avec inertie, aimantation au rang. Le rang centré devient actif **au repos** (120 ms), pas à chaque pixel. |
| Toucher un voisin | Il vient au centre et devient actif. |
| ↑ ↓ | Rang précédent / suivant. **S'ajoutent** à ← → (conservées) et à `Home` / `End`. |
| Cible tactile | 44 px de haut sur toute la largeur (aujourd'hui ~90 × 45 px). |

## Accessibilité

- `role="tablist"` / `role="tab"` / `aria-selected` / `tabIndex` roving :
  inchangés. Le tambour est une **peau**, pas un nouveau motif ARIA.
- La rangée de pastilles est `aria-hidden` : elle redit une information que
  `aria-selected` porte déjà.
- `prefers-reduced-motion: reduce` : ni inclinaison, ni translation, ni
  défilement animé. Le fondu d'opacité reste, il ne bouge pas.
- Focus clavier visible sur le rang, sur la ligne entière.

## Ce qui n'est pas fait

- Le tambour ne **boucle pas** (après la dernière marque on ne revient pas à la
  première). Sept rangs se parcourent d'un geste, et les pastilles disent où
  l'on est ; une boucle rendrait ce repère faux.
- Le rendu desktop n'est pas touché.
- Aucun changement dans `TAB_ORDER`, `buildSources` ou les données.

## Vérification

1. `npm run lint` — 0 erreur, **5 avertissements** (les cinq connus, documentés
   dans `CLAUDE.md`). Un sixième serait une régression.
2. `npm test` — les 119 tests. Aucun ne lit ce code, mais `source-count`
   lit `TAB_ORDER` : il prouve que le tableau n'a pas bougé.
3. `npm run dev` + inspection à 360 px, 390 px et 430 px, dans les **quatre**
   langues (les listes font 7 / 7 / 7 / 5 rangs) et dans les **deux** thèmes.
4. Contrôle du dégradé : mêmes vues avec JavaScript désactivé et avec
   `prefers-reduced-motion` forcé.
5. `npm run build && npm run check` — les douze pages, avant toute poussée.

**Le déploiement n'est pas dans cette spec.** Un push sur `main` déclenche
`hourly.yml`, donc la production. Le travail reste local jusqu'à validation à
l'écran.
