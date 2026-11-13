# Zoom sur l'affiche — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toucher l'image de la visionneuse l'ouvre en plein écran, avec zoom à deux doigts, déplacement, double toucher, molette.

**Architecture:** Les calculs du zoom (bornes, point fixe sous les doigts) vivent dans un module plat `src/zoomMath.js`, testé sous Node. `src/components/ZoomView.jsx` capte les gestes (Pointer Events, `transform`) et rend la couche plein écran. `Lightbox.jsx` ne gagne qu'un bouton autour de l'image et un état `zoom`.

**Tech Stack:** React 18, CSS (`src/styles/global.css`), `node --test`, Puppeteer (`puppeteer-core` + `scripts/lib/chrome.mjs`) pour la vérification.

**Spec:** `docs/superpowers/specs/2026-11-13-zoom-affiche-design.md`

## Global Constraints

- Aucune dépendance nouvelle.
- Zoom borné : `MIN_SCALE = 1`, `MAX_SCALE = 4`, double toucher `DOUBLE_TAP_SCALE = 2.5`.
- La page n'est jamais zoomée : `touch-action: none` sur la couche plein écran, rien sur `<meta viewport>`.
- Chaînes `lb.zoom` (« Agrandir l'image ») et `lb.zoomClose` (« Fermer l'agrandissement ») dans les **sept** blocs `STRINGS` (`test/i18n-parity.test.mjs`).
- Lint : pas un avertissement de plus que les 8 actuels ; pas d'export non-composant dans un `.jsx` (d'où `zoomMath.js` plat).
- `prefers-reduced-motion` : aucune transition.
- Le motif (item sans photo) n'est pas agrandissable.

## Review Focus

- Échap pendant le zoom ferme le zoom, **pas** la visionneuse ; ‹ › clavier inertes pendant le zoom.
- Changer d'image dans la visionneuse (‹ ›) ferme/réinitialise le zoom.
- Pincement qui finit à un doigt : le doigt restant enchaîne un déplacement sans saut.
- Image plus large que haute (photo Instagram paysage) : bornes de déplacement justes sur les deux axes.
- Après fermeture sur mobile : `visualViewport.scale === 1` (la page n'a pas zoomé).

---

### Task 1: Calculs du zoom (`src/zoomMath.js`)

**Files:**
- Create: `src/zoomMath.js`
- Test: `test/zoom-math.test.mjs`

**Interfaces:**
- Produces:
  - `MIN_SCALE`, `MAX_SCALE`, `DOUBLE_TAP_SCALE` (nombres).
  - `clampScale(s: number) -> number`
  - `clampPan(state: {x, y, scale}, box: {vw, vh, iw, ih}) -> {x, y, scale}` — `iw/ih` = taille affichée de l'image à l'échelle 1 (ajustée « contain »), origine du `transform` au centre ; déplacement max par axe = `max(0, (i*scale - v) / 2)`.
  - `zoomAt(state, newScale, px, py, box) -> state` — `px/py` relatifs au centre de l'écran ; le point sous `(px, py)` reste fixe : `x' = px - (px - x) * s'/s` (idem y), puis `clampScale` et `clampPan`.
  - `toggleZoom(state, px, py, box) -> state` — `scale > 1` → `{x: 0, y: 0, scale: 1}`, sinon `zoomAt(state, DOUBLE_TAP_SCALE, px, py, box)`.

- [ ] **Step 1: Écrire les tests** (`box = {vw: 400, vh: 800, iw: 400, ih: 560}`)
  - `clampScale(0.5) === 1`, `clampScale(5) === 4`, `clampScale(2) === 2`.
  - `clampPan({x: 500, y: -500, scale: 2}, box)` → `{x: 200, y: -160, scale: 2}`.
  - `clampPan({x: 50, y: 30, scale: 1}, box)` → `{x: 0, y: 0, scale: 1}`.
  - `zoomAt({x: 0, y: 0, scale: 1}, 2, 100, 0, box)` → `{x: -100, y: 0, scale: 2}`.
  - `zoomAt({x: 0, y: 0, scale: 1}, 9, 0, 0, box).scale === 4`.
  - `toggleZoom({x: -100, y: 0, scale: 2}, 0, 0, box)` → `{x: 0, y: 0, scale: 1}`.
  - `toggleZoom({x: 0, y: 0, scale: 1}, 0, 0, box)` → `{x: 0, y: 0, scale: 2.5}`.
  - Paysage `{vw: 400, vh: 800, iw: 400, ih: 250}` : `clampPan({x: 0, y: 300, scale: 4}, …)` → `y: 100` (`(1000-800)/2`).
- [ ] **Step 2:** `node --test test/zoom-math.test.mjs` → FAIL (module absent).
- [ ] **Step 3:** Écrire `src/zoomMath.js` (module plat, en-tête de commentaire en français disant pourquoi il est hors du `.jsx`).
- [ ] **Step 4:** `node --test test/zoom-math.test.mjs` → PASS.
- [ ] **Step 5:** Commit : `git add src/zoomMath.js test/zoom-math.test.mjs && git commit -m "visionneuse: calculs du zoom (bornes, point fixe)"`.

### Task 2: Plein écran et gestes, branchés dans la visionneuse

**Files:**
- Create: `src/components/ZoomView.jsx`
- Modify: `src/components/Lightbox.jsx` (état `zoom`, bouton autour de `.lb__img`, `go()` remet `zoom` à `false`)
- Modify: `src/styles/global.css` (`.lb__zoom`, `.zv`, `.zv__img`, `.zv__close` ; bloc `≤620px` : `.lb__zoom` en `position: absolute; inset: 0`)
- Modify: `src/i18n.jsx` (deux clés × sept langues)
- Test: `test/zoom-wiring.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`clampScale`, `zoomAt`, `toggleZoom`, `clampPan`, constantes).
- Produces: `ZoomView({ src, alt, closeLabel, onClose })`.

- [ ] **Step 1: Test de branchement** (lecture des sources, à la manière de `test/light-data.test.mjs`) :
  - `Lightbox.jsx` importe `ZoomView` et rend `className="lb__zoom"` avec `aria-label={t('lb.zoom')}`.
  - `go` contient `setZoom(false)`.
  - `global.css` : la règle `.zv` contient `touch-action: none`.
  - `ZoomView.jsx` écoute `keydown` sur `window` en **capture** (`, true)`) et appelle `stopPropagation` — c'est ce qui empêche l'Échap d'atteindre l'écouteur de la Lightbox (sur `document`, en bouillonnement).
- [ ] **Step 2:** `node --test test/zoom-wiring.test.mjs` → FAIL.
- [ ] **Step 3: `ZoomView.jsx`.** Couche `div.zv` (`role="dialog"`, `aria-modal`), `img.zv__img` avec `style.transform = translate(x px, y px) scale(s)`, bouton `.zv__close` (×, `aria-label={closeLabel}`, focus à l'ouverture). `box` calculé depuis `naturalWidth/Height` ajustés « contain » à `innerWidth/innerHeight` (recalcul au `resize`). Gestes :
  - Pointeurs actifs dans une `Map` (`setPointerCapture`). Deux pointeurs : échelle = échelle de départ × distance/distance de départ, via `zoomAt` au milieu des doigts. Un pointeur et `scale > 1` : déplacement + `clampPan`. Quand un des deux doigts se lève, ré-ancrer le départ sur le doigt restant (pas de saut).
  - Double toucher / double clic : deux `pointerup` à < 300 ms et < 30 px → `toggleZoom`, avec transition CSS `transform 0.25s` posée seulement pour ce geste (classe `zv__img--anim`), jamais pendant un pincement.
  - `wheel` (`passive: false`) : `zoomAt(state, scale * Math.exp(-deltaY * 0.002), …)`.
  - Clavier sur `window` en capture : Échap → `onClose()` ; flèches et Tab → `preventDefault` (Tab garde le focus sur la croix) ; toujours `stopPropagation`.
- [ ] **Step 4: `Lightbox.jsx`.** `const [zoom, setZoom] = useState(false)` ; dans `go`, `setZoom(false)`. L'image photo devient `<button type="button" className="lb__zoom" aria-label={t('lb.zoom')} onClick={() => setZoom(true)}><img …/></button>`. Si `zoom && showPhoto` : `<ZoomView src={item.img} alt={item.alt} closeLabel={t('lb.zoomClose')} onClose={…} />` dans la `div.lb`, et au retour le focus revient sur `.lb__zoom`.
- [ ] **Step 5: CSS.** `.lb__zoom` : bouton nu (`border: 0; padding: 0; background: none; display: block; cursor: zoom-in`), `:focus-visible` comme `.lb__out`. `.zv` : `position: fixed; inset: 0; z-index: 210; display: grid; place-items: center; overflow: hidden; touch-action: none; background: color-mix(in srgb, var(--basalt) 96%, transparent)`. `.zv__img` : `max-width: 100vw; max-height: 100dvh; object-fit: contain; user-select: none; -webkit-user-drag: none; transform-origin: center`. `.zv__close` : 46 px, en haut à droite, `top: calc(12px + env(safe-area-inset-top, 0px))`, mêmes couleurs que `.lb__close`. `@media (prefers-reduced-motion: reduce)` : `.zv__img--anim { transition: none }`.
- [ ] **Step 6: Chaînes.** `lb.zoom` / `lb.zoomClose` dans les sept blocs, à côté de `lb.close` : fr « Agrandir l'image » / « Fermer l'agrandissement » ; de « Bild vergrössern » / « Vergrösserung schliessen » ; it « Ingrandisci l'immagine » / « Chiudi l'ingrandimento » ; en « Enlarge image » / « Close enlarged view » ; es « Ampliar la imagen » / « Cerrar la ampliación » ; hy « Մեծացնել պատկերը » / « Փակել մեծացումը » ; ru « Увеличить изображение » / « Закрыть увеличение ».
- [ ] **Step 7:** `npm test` → seul échec admis : `retour.js` (CRLF local connu) ; `npm run lint` → 8 avertissements, 0 erreur.
- [ ] **Step 8: Vérification mobile (Puppeteer, `npm run build` puis `npm run preview`, 360 et 390 px, `isMobile`/`hasTouch`)** — script jetable hors de `scripts/` ou supprimé ensuite :
  - toucher `.lb__zoom` → `.zv` visible ; Échap → `.zv` absent **et** `.lb` toujours présent ;
  - pincement simulé (deux pointeurs CDP `Input.dispatchTouchEvent`) → `scale` lu dans `transform` > 1 ; double toucher → retour à 1 ;
  - après fermeture : `visualViewport.scale === 1` ;
  - captures jour et nuit, desktop 1400 px (clic + molette).
- [ ] **Step 9:** `npm run build && npm run check` → conformes.
- [ ] **Step 10: Commit** (avec la spec et ce plan) :
  `git add src/components/ZoomView.jsx src/components/Lightbox.jsx src/styles/global.css src/i18n.jsx test/zoom-wiring.test.mjs docs/superpowers/specs/2026-11-13-zoom-affiche-design.md docs/superpowers/plans/2026-11-13-zoom-affiche.md && git commit -m "visionneuse: plein écran et zoom à deux doigts sur l'image"`.
