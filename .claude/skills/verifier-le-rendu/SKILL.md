---
name: verifier-le-rendu
description: Use before claiming any visual, layout, CSS, mobile or responsive change is done on this repo (armenieinfo.ch / armenianews.org). Covers the measurement traps that make browser-based verification lie, the four languages, the two themes, the widths to test, and the commands that must pass. Trigger on any change to global.css, a component's rendering, a breakpoint, a tap target, or anything the user reports seeing on a phone.
---

# Vérifier le rendu avant de dire que c'est fait

Ce dépôt sert **douze pages** : deux vitrines × quatre langues × trois vues,
en **deux thèmes**, sur des écritures latine, arménienne et cyrillique. Une
mesure prise à un seul endroit ne prouve presque rien.

**La règle** : ne publiez jamais un chiffre obtenu une seule fois par un seul
chemin. Cette liste existe parce que **cinq mesures fausses** ont été produites
en une seule séance, toutes par l'instrument et non par le code — deux ont
atteint le rapport à l'utilisateur avant d'être corrigées.

## 1. Les cinq pièges de mesure, à écarter AVANT de conclure

| Piège | Ce qu'il fait croire | La parade |
|---|---|---|
| **`grep -n` aux numéros périmés** | qu'une règle est dans tel bloc `@media` | parcourir le CSS en **comptant les accolades** ; un `grep` ne connaît pas l'imbrication |
| **`<iframe>` redimensionnée depuis le parent** | que le code ne réagit pas au changement de largeur | `innerWidth` et `matches` changent mais **ni `resize` ni `change` ne partent** : une iframe **par taille**, chargement neuf ; émettre l'événement à la main pour tester la transition |
| **`@media (pointer: coarse)` inactif** | une dizaine de cibles tactiles trop petites | un Chrome de bureau est `pointer: fine` ; **injecter le bloc à la main** avant de compter |
| **`location.reload()`** | que la page défile toute seule au chargement | le rechargement **restaure la position** ; utiliser une **navigation neuve** (`?v=…`) |
| **`elementFromPoint` hors fenêtre** | qu'un élément n'est plus cliquable (renvoie `null`) | **assertion préalable** : `rect.top >= 0 && rect.bottom <= innerHeight`, sinon on jette |
| **`getBoundingClientRect` sur le tambour** | une dizaine de cibles tactiles de 16 à 37px | le cylindre incline ses éléments en 3D et le rect est la boîte **après transformation** ; mesurer en **`offsetHeight` / `offsetWidth`**, qui l'ignorent — les mêmes boutons font 44 et 46px |
| **`.focus()` en JS** | qu'aucun contour de focus n'existe (`outline-style: none`) | le focus programmatique ne déclenche **pas** `:focus-visible` ; lire les règles au **CSSOM** (`:focus-within`, lui, réagit) |

Deux corollaires :

- **`html { scroll-behavior: smooth }` avale les défilements synchrones.** Posez
  `d.documentElement.style.scrollBehavior = 'auto'` avant toute mise en position,
  puis **vérifiez** que la cible est bien où vous la vouliez.
- **Les images en chargement différé repoussent la mise en page** pendant
  plusieurs secondes. Pour une capture stable, masquez ce qui précède la section
  visée plutôt que de recalculer un `scrollTo`.

## 2. Le banc d'essai

Le serveur de développement ne sert que le **français** (vitrine `.ch`). Les
trois autres langues demandent un build.

```bash
npm run dev            # français,  http://localhost:5173
npm run build          # puis :
npm run preview:org    # en / hy / ru, http://localhost:4173  (/ , /hy/ , /ru/)
```

Déposez une page d'essai **jetable** dans `public/` (dev) ou `dist/org/`
(préversion) avec une `<iframe>` par largeur — même origine, donc
`contentDocument` est lisible. La production, elle, **bloque les iframes**
(`frame-ancestors`). **Supprimez le fichier** avant tout `build`, `check` ou
commit.

## 3. Ce qu'il faut couvrir

- **Largeurs** : 360 et 390 (téléphones), 700 (petite tablette, la largeur qui
  révèle les césures ingrates), 1000 et 1400+ (bureau). La bascule mobile de ce
  site est **640px**.
- **Langues** : les quatre. Les longueurs de noms diffèrent — une césure juste en
  français peut être laide en anglais — et l'arménien a une hauteur de ligne
  propre, qui a déjà fait tomber un bouton de 44px à 43px.
- **Thèmes** : jour **et** nuit. Un fond en dur ment sous l'un des deux ; un
  masque, non.
- **Dégradations** : `prefers-reduced-motion`, et le comportement **sans
  JavaScript** quand une classe est posée par un hook.
- **Accessibilité** : cible tactile ≥ 44px, focus visible, et — si vous cachez
  quelque chose — `opacity: 0` garde l'élément focusable là où
  `visibility: hidden` le retire de l'arbre.

## 4. Les commandes qui doivent passer

```bash
npm run lint     # 0 erreur, EXACTEMENT 5 avertissements connus (voir CLAUDE.md)
npm test         # 125 tests
npm run build
npm run check    # les 12 pages, hreflang, sitemaps, cartes de partage
```

Un **sixième** avertissement de lint est une régression, pas un détail.

## 5. Avant de pousser

`git push` sur `main` **déclenche le déploiement en production**
(`.github/workflows/hourly.yml`). Vérifiez d'abord `git rev-parse --show-toplevel`
— le dossier parent est un **autre dépôt**. Le distant reçoit un instantané
horaire : attendez-vous à devoir **fusionner** (jamais rebaser) ; le robot ne
touche que `src/data/*.json`, donc les conflits sont rares. Si `git push` reste
bloqué, c'est Git Credential Manager qui attend une interaction :
`GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git push origin main`.

## 6. Ce qu'aucune mesure ne remplace

L'inertie d'un geste, la précision d'un pouce et la continuité d'un flux audio
**ne se simulent pas**. Dites explicitement ce qui n'a pas été éprouvé sur un
appareil réel, plutôt que de laisser croire que tout l'a été.
