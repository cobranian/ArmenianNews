import { useEffect, useRef } from 'react'

// Le tambour de source — la mécanique, pas l'apparence.
//
// Sous 640px, le rail d'onglets de NewsBrowser devient un CYLINDRE : les
// marques sont réparties autour d'un axe horizontal, on le fait tourner au
// doigt, et il BOUCLE — après la dernière marque revient la première, dans les
// deux sens. Ce hook pose sur chaque rang son angle (`--a`) et son opacité
// (`--o`) ; le CSS en fait une rotation dans la perspective du cadre (voir le
// bloc `@media (max-width: 640px)` de global.css). Le hook ignore ce qu'est une
// source ; il ne connaît que des ids et de la géométrie.
//
// POURQUOI ON N'UTILISE PAS L'AIMANTATION NATIVE DU NAVIGATEUR.
// C'était la première version, et elle ne peut pas boucler : `scroll-snap` vit
// sur un défileur, un défileur a un début et une fin, et il n'existe aucun
// moyen de recoudre les deux bouts. Les contournements connus dupliquent la
// liste dans le DOM (trois copies, on saute d'une copie à l'autre en douce) —
// inacceptable ici : ce sont les mêmes <button role="tab"> qui servent AUSSI de
// rail horizontal sur large écran, et que `npm run prerender` cuit dans les
// douze pages. Vingt-et-un onglets partiraient dans le HTML, dont quatorze
// mensongers. On pilote donc la roue nous-mêmes, sur sept éléments réels.
//
// QUATRE CHOSES À SAVOIR AVANT D'Y TOUCHER :
//
// 1. Le repli sans JavaScript est porté par le CSS, pas par ce fichier. Tant
//    que la classe `is-drum` n'est pas posée, la colonne reste une liste plate,
//    défilante et aimantée — dégradée, jamais cassée. C'est ce hook qui pose la
//    classe, donc c'est son ABSENCE qui déclenche le repli. Ne déplacez pas
//    `is-drum` dans le rendu React : elle mentirait si le hook ne tournait pas.
//
// 2. Hors du mode tambour, le hook ne pose AUCUN écouteur, n'écrit AUCUNE
//    variable, et efface celles qu'il avait posées en repassant en desktop. Le
//    rail large écran doit rester exactement ce qu'il était.
//
// 3. On ne capture PAS le pointeur (`setPointerCapture`) sur la piste. Ce
//    serait le réflexe pour suivre un doigt qui sort du cadre — mais la capture
//    réoriente aussi le `click` de compatibilité vers l'élément capturant, donc
//    le `onClick` des boutons ne partirait plus : toucher une marque ne
//    sélectionnerait plus rien. On écoute `pointermove`/`pointerup` sur
//    `window` à la place, ce qui suit le doigt tout aussi bien.
//
// 4. `pos` est un FLOTTANT libre, pas un index. Il n'est jamais borné à
//    [0, n) pendant le geste : c'est `ring()` qui ramène chaque écart au plus
//    court chemin sur l'anneau, et c'est de là que vient le bouclage. Le
//    ramener de force ferait sauter la roue au passage du zéro.

const DRUM_MQ = '(max-width: 640px)'
const REDUCE_MQ = '(prefers-reduced-motion: reduce)'

// Géométrie de la roue. L'écart angulaire est CONSTANT et ne dépend pas du
// nombre de sources : le russe en compte cinq et les trois autres langues sept,
// et une roue dont le pas changerait avec la langue n'aurait pas la même
// allure d'une vitrine à l'autre. `BACK_DEG` sert de dénominateur au fondu :
// l'opacité atteint zéro vers 64°, et c'est CE seuil — l'opacité nulle, pas un
// angle écrit séparément — qui coupe aussi les événements de pointeur.
const STEP_DEG = 42
// Pixels de glissement pour faire tourner d'un rang. Un peu moins que la
// hauteur d'un rang (44px) : le doigt paraît alors entraîner la surface du
// cylindre plutôt que de la traîner.
const DRAG_PX = 46
const BACK_DEG = 90

// Inertie. `FRICTION` est exprimée par tranche de 16 ms pour rester
// indépendante de la fréquence d'affichage ; en dessous de `MIN_V` on considère
// la roue à l'arrêt et on aimante sur le rang le plus proche.
const FRICTION = 0.94
const MIN_V = 0.0016
const SNAP_EASE = 0.2
// Un geste plus court que ceci est un TOUCHER, pas un glissement : on laisse
// alors le `onClick` du bouton faire la sélection.
const TAP_PX = 5

const mod = (a, n) => ((a % n) + n) % n
// L'écart le plus court de `d` crans sur un anneau de `n`, signé, dans
// [-n/2, n/2). C'est cette fonction, et elle seule, qui fait boucler la roue.
const ring = (d, n) => mod(d + n / 2, n) - n / 2

// `enabled` (vrai par défaut) permet à un appelant d'éteindre la roue sans
// démonter le composant : le lecteur radio s'en sert pour rendre la main à sa
// grille dépliée, où les quinze stations s'affichent à plat. Éteinte, la roue
// se nettoie exactement comme sur large écran — même chemin, `disable()`.
export function useSourceDrum({ trackRef, itemRefs, ids, activeId, onSettle, enabled = true }) {
  // Ce que le moteur doit lire à chaque tour sans être reconstruit pour autant :
  // le rappel et l'id actif changent à chaque rendu, les écouteurs non.
  const onSettleRef = useRef(onSettle)
  const activeRef = useRef(activeId)
  const idsRef = useRef(ids)
  const enabledRef = useRef(enabled)
  const firstRef = useRef(true)
  const apiRef = useRef(null)

  useEffect(() => {
    onSettleRef.current = onSettle
    activeRef.current = activeId
    idsRef.current = ids
    enabledRef.current = enabled
  })

  // --- Le moteur. Monté une fois. ---
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof window.matchMedia !== 'function') return

    const drumMq = window.matchMedia(DRUM_MQ)
    const reduceMq = window.matchMedia(REDUCE_MQ)

    let on = false // le tambour est-il en service ?
    let pos = 0 // position flottante sur la roue, en rangs
    let target = null // rang visé, ou null si la roue est libre
    let vel = 0 // rangs par milliseconde
    let raf = 0
    let last = 0
    let dragging = false
    let dragId = null
    let startY = 0
    let startPos = 0
    let lastY = 0
    let lastT = 0
    let travel = 0

    const count = () => idsRef.current.length
    const elFor = (i) => itemRefs.current[idsRef.current[i]]
    const indexOfActive = () => {
      const i = idsRef.current.indexOf(activeRef.current)
      return i < 0 ? 0 : i
    }

    const paint = () => {
      // Rien ne s'écrit hors service. Sans cette garde, une image d'animation
      // déjà programmée au moment où l'on repasse en large écran réécrirait
      // `--o: 0` et `pointer-events: none` sur les rangs qui étaient derrière
      // le cylindre — et le rail masthead perdrait des marques, en silence.
      if (!on) return
      const n = count()
      for (let i = 0; i < n; i++) {
        const el = elFor(i)
        if (!el) continue
        // Le SIGNE est négatif, et il compte. `rotateX` positif fait monter un
        // rang (en CSS, +Y descend et une rotation positive autour de X emmène
        // +Z vers −Y). Sans ce moins, le rang SUIVANT apparaîtrait au-dessus du
        // rang actif et un glissement vers le bas ferait monter le contenu :
        // une roue inversée, contre la lecture comme contre le geste. Mesuré à
        // l'écran, pas déduit — les deux conventions se ressemblent trop.
        const a = -ring(i - pos, n) * STEP_DEG
        const abs = Math.abs(a)
        // Le fondu suit l'angle et non le rang : pendant le geste, un rang qui
        // s'enfonce s'éteint continûment au lieu de sauter d'un palier.
        const o = Math.max(0, 1 - (abs / BACK_DEG) * 1.4)
        el.style.setProperty('--a', `${a.toFixed(2)}deg`)
        el.style.setProperty('--o', o.toFixed(3))
        // UN SEUL SEUIL, ET C'EST L'OPACITÉ QUI LE DONNE. Auparavant la
        // visibilité se coupait à 90° alors que l'opacité atteignait zéro dès
        // ~64° : entre les deux, un rang totalement transparent gardait une
        // boîte de clic écrasée en haut et en bas de la piste, et le toucher
        // sélectionnait une source dont le nom était invisible.
        //
        // ET SURTOUT, PLUS DE `visibility: hidden`. Elle retire l'élément de
        // l'arbre d'accessibilité, donc les deux rangs passés derrière le
        // cylindre devenaient infocusables : le `focus()` du roving-tabindex
        // échouait en silence, puis le bouton qui portait le focus passait à
        // son tour derrière et le focus tombait sur <body>. La navigation
        // clavier des onglets mourait. L'opacité, elle, ne retire rien.
        el.style.pointerEvents = o === 0 ? 'none' : ''
      }
    }

    const settle = () => {
      const n = count()
      pos = mod(pos, n) // on renormalise à l'arrêt, jamais pendant le geste
      const id = idsRef.current[mod(Math.round(pos), n)]
      if (id) onSettleRef.current(id)
    }

    const tick = (t) => {
      raf = 0
      const dt = Math.min(t - last, 50) || 16
      last = t
      let moving = false

      if (!dragging) {
        if (target != null) {
          const diff = target - pos
          if (Math.abs(diff) < 0.002) {
            pos = target
            target = null
          } else {
            // Approche exponentielle, corrigée du pas de temps pour ne pas
            // dépendre de la fréquence d'affichage.
            pos += diff * (reduceMq.matches ? 1 : 1 - Math.pow(1 - SNAP_EASE, dt / 16))
            moving = true
          }
        } else if (Math.abs(vel) > MIN_V) {
          pos += vel * dt
          vel *= Math.pow(FRICTION, dt / 16)
          moving = true
        } else if (pos !== Math.round(pos)) {
          // La condition est « la roue n'est pas alignée », pas « il restait de
          // la vitesse ». Écrite `vel !== 0`, elle laissait un glissement
          // terminé à vitesse EXACTEMENT nulle — un doigt qui marque une pause
          // avant de se lever, ce qui est courant — traverser les trois
          // branches sans jamais poser de cible : la roue s'immobilisait à
          // ~17° de travers, aucun nom aligné dans la bande, jusqu'au geste
          // suivant.
          vel = 0
          target = Math.round(pos)
          moving = true
        }
      }

      paint()
      if (moving || dragging) raf = requestAnimationFrame(tick)
      else settle()
    }

    const kick = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const goTo = (index, animate) => {
      target = pos + ring(index - pos, count())
      if (animate) return kick()
      pos = target
      target = null
      vel = 0
      paint()
    }

    // --- Gestes ---
    const onDown = (e) => {
      if (!drumMq.matches || dragging) return
      // UN GESTE QUI PART DU FOND DE LA PISTE APPARTIENT À LA PAGE.
      // `touch-action: none` vit désormais sur les RANGS, pas sur la piste :
      // poser le doigt sur un nom fait tourner la roue, le poser au-dessus ou
      // en dessous des noms fait défiler la page. Auparavant la piste entière
      // confisquait le geste, donc un pouce posé là — un endroit naturel, juste
      // au-dessus des carrousels — faisait tourner la roue au lieu de faire
      // défiler, et changeait de source sans que personne l'ait demandé.
      // Sans ce test, les deux partiraient en même temps : le navigateur
      // panoramiquerait la page ET la roue tournerait.
      if (e.target === track) return
      dragging = true
      dragId = e.pointerId
      startY = lastY = e.clientY
      startPos = pos
      lastT = e.timeStamp
      travel = 0
      vel = 0
      target = null
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      kick()
    }

    const onMove = (e) => {
      if (!dragging || e.pointerId !== dragId) return
      const dy = e.clientY - startY
      travel = Math.max(travel, Math.abs(dy))
      pos = startPos - dy / DRAG_PX
      const dt = e.timeStamp - lastT
      if (dt > 0) vel = -(e.clientY - lastY) / DRAG_PX / dt
      lastY = e.clientY
      lastT = e.timeStamp
      paint()
    }

    const onUp = (e) => {
      if (!dragging || (e.pointerId != null && e.pointerId !== dragId)) return
      dragging = false
      dragId = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      // Un toucher franc ne lance pas la roue : le onClick du bouton va choisir
      // la marque, et son effet la ramènera au centre par le plus court chemin.
      // Sous mouvement réduit, l'inertie est coupée net : une roue qui continue
      // de tourner seule après le départ du doigt est exactement l'animation
      // autonome que la préférence demande de supprimer.
      if (travel < TAP_PX || reduceMq.matches) {
        vel = 0
        target = Math.round(pos)
      }
      kick()
    }

    const clean = () => {
      for (let i = 0; i < count(); i++) {
        const el = elFor(i)
        if (!el) continue
        el.style.removeProperty('--a')
        el.style.removeProperty('--o')
        // `visibility` n'est plus jamais posée, mais on continue de la retirer :
        // un DOM déjà peint par la version précédente du hook en porterait
        // encore, et un rang invisible sur le rail masthead ne se voit pas.
        el.style.removeProperty('visibility')
        el.style.removeProperty('pointer-events')
      }
    }

    const enable = () => {
      on = true
      track.classList.add('is-drum')
      track.addEventListener('pointerdown', onDown)
      pos = indexOfActive()
      target = null
      vel = 0
      paint()
    }

    const disable = () => {
      on = false
      track.classList.remove('is-drum')
      track.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragging = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      clean()
    }

    // Idempotente : elle ne fait rien tant que l'état voulu est l'état courant.
    // C'est ce qui permet de l'appeler aussi souvent qu'on veut, donc de
    // l'accrocher à `resize` — sinon chaque image d'un redimensionnement
    // rappellerait `enable()` et remettrait la roue sur le rang actif, au
    // milieu d'un geste.
    const sync = () => {
      const want = drumMq.matches && enabledRef.current
      if (want === on) return
      want ? enable() : disable()
    }

    sync()
    drumMq.addEventListener('change', sync)
    // La CEINTURE, en plus des bretelles. `change` est la voie normale, mais on
    // l'a vu manquer : redimensionner un <iframe> depuis le document parent
    // fait basculer `matches` SANS émettre l'événement (constaté dans Chrome
    // avec un écouteur témoin indépendant). Le prix d'un oubli est laid — la
    // classe reste, et les rangs qui étaient derrière le cylindre gardent leur
    // `pointer-events: none` et une opacité nulle sur le rail large écran, où
    // des marques deviennent invisibles et inertes. `resize`, lui, part
    // toujours.
    window.addEventListener('resize', sync)
    apiRef.current = { goTo, sync, isOn: () => on }

    return () => {
      drumMq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      disable()
      apiRef.current = null
    }
  }, [trackRef, itemRefs])

  // --- Le rang actif revient au centre quand il change d'ailleurs : toucher
  // d'un voisin, flèches du clavier. Quand le changement vient de la roue
  // elle-même, `goTo` vise le rang où elle est déjà et ne bouge rien.
  //
  // `firstRef` retombe à faux ICI et nulle part ailleurs : le tout premier
  // placement doit être instantané (sinon la roue s'anime seule au chargement),
  // les suivants sont animés. Le moteur ci-dessus s'exécute avant celui-ci au
  // montage — y baisser le drapeau ferait tourner ce premier placement. ---
  //
  // La dépendance est la LISTE APLATIE, pas le tableau : `ids` est reconstruit
  // à chaque rendu de NewsBrowser, donc en dépendre relancerait la roue à
  // chaque tour d'horloge des cartes (useNow bat toutes les 60 s). ---
  // Allumer ou éteindre la roue passe par le MÊME `sync` que la media query :
  // un second chemin de mise en service divergerait du premier au premier
  // correctif, et c'est lui qui porte le nettoyage des variables en ligne.
  useEffect(() => {
    apiRef.current?.sync()
  }, [enabled])

  const idsKey = ids.join('|')
  useEffect(() => {
    const api = apiRef.current
    if (!api || !api.isOn()) return
    const i = idsRef.current.indexOf(activeId)
    if (i < 0) return
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia(REDUCE_MQ).matches
    api.goTo(i, !firstRef.current && !reduce)
    firstRef.current = false
  }, [activeId, idsKey])
}
