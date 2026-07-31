import { useEffect, useRef } from 'react'

// Le tambour de source — la mécanique, pas l'apparence.
//
// Sous 640px, le rail d'onglets de NewsBrowser bascule en colonne défilante
// aimantée (voir le bloc `@media (max-width: 640px)` de global.css). Ce hook
// n'y ajoute qu'une chose : la PERSPECTIVE. Il écrit sur chaque rang deux
// variables CSS — `--d`, sa distance signée au centre du cadre en rangs, et
// `--o`, son opacité — que le CSS transforme en inclinaison, en éloignement et
// en fondu. Le hook ignore ce qu'est une source ; il ne connaît que des ids et
// de la géométrie.
//
// TROIS CHOSES À SAVOIR AVANT D'Y TOUCHER :
//
// 1. `--d` vaut 0 par défaut CÔTÉ CSS. Sans JavaScript, la colonne reste une
//    liste plate, aimantée et défilante — dégradée, jamais cassée. Ne déplacez
//    pas ce défaut ici : une valeur initiale posée en JS ne servirait à rien
//    précisément dans le cas où le JS ne tourne pas.
//
// 2. Hors du mode tambour, le hook ne pose AUCUN écouteur et n'écrit AUCUNE
//    variable — et il nettoie celles qu'il avait posées en repassant en
//    desktop. Le rail large écran doit rester exactement ce qu'il était.
//
// 3. La géométrie est lue en `offsetTop` / `offsetHeight`, donc en positions de
//    MISE EN PAGE. C'est le point : les transformations 3D que ce hook provoque
//    n'affectent pas ces valeurs, donc écrire `--d` ne peut pas modifier ce
//    depuis quoi `--d` est calculé. Passer par `getBoundingClientRect()`, qui
//    lui applique les transformations, refermerait la boucle sur elle-même.

const DRUM_MQ = '(max-width: 640px)'
const REDUCE_MQ = '(prefers-reduced-motion: reduce)'

// Repos du défilement au-delà duquel le rang centré devient actif. Assez court
// pour suivre le doigt, assez long pour ne pas changer d'onglet à chaque rang
// traversé par un geste ample.
const SETTLE_MS = 120

// Bornes. `MAX_D` évite qu'un rang lointain n'accumule une rotation absurde ;
// `FADE` est la pente du fondu (à un rang d'écart il reste 0,38 d'opacité).
const MAX_D = 2.2
const FADE = 0.62

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function useSourceDrum({ trackRef, itemRefs, ids, activeId, onSettle }) {
  // Ce que l'effet moteur doit lire à chaque tour sans être reconstruit pour
  // autant : le rappel et l'id actif changent à chaque rendu, les écouteurs non.
  const onSettleRef = useRef(onSettle)
  const activeRef = useRef(activeId)
  const idsRef = useRef(ids)
  const firstRef = useRef(true)

  useEffect(() => {
    onSettleRef.current = onSettle
    activeRef.current = activeId
    idsRef.current = ids
  })

  // --- Le moteur : écouteurs, peinture, repos. Monté une fois. ---
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof window.matchMedia !== 'function') return

    const drumMq = window.matchMedia(DRUM_MQ)
    let raf = 0
    let settleTimer = 0

    const rows = () =>
      idsRef.current.map((id) => itemRefs.current[id]).filter(Boolean)

    // Distance signée d'un rang au centre du cadre, exprimée en rangs.
    const distance = (el, mid) => (el.offsetTop + el.offsetHeight / 2 - mid) / el.offsetHeight

    const paint = () => {
      raf = 0
      if (!drumMq.matches) return
      const mid = track.scrollTop + track.clientHeight / 2
      for (const el of rows()) {
        const d = clamp(distance(el, mid), -MAX_D, MAX_D)
        el.style.setProperty('--d', d.toFixed(3))
        el.style.setProperty('--o', Math.max(0, 1 - Math.abs(d) * FADE).toFixed(3))
      }
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint)
    }

    const nearestId = () => {
      const mid = track.scrollTop + track.clientHeight / 2
      let best = null
      let bestD = Infinity
      for (const id of idsRef.current) {
        const el = itemRefs.current[id]
        if (!el) continue
        const d = Math.abs(el.offsetTop + el.offsetHeight / 2 - mid)
        if (d < bestD) {
          bestD = d
          best = id
        }
      }
      return best
    }

    const onScroll = () => {
      schedule()
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        const id = nearestId()
        // Un recentrage programmé finit lui aussi par se reposer ici, sur l'id
        // qui est déjà actif : React ne re-rend pas, la boucle s'arrête d'elle
        // même. Pas besoin d'une fenêtre d'ignorance.
        if (id) onSettleRef.current(id)
      }, SETTLE_MS)
    }

    // Efface toute trace en repassant sur large écran — sinon un `--o` hérité
    // laisserait le rail masthead à demi transparent.
    const clean = () => {
      for (const el of rows()) {
        el.style.removeProperty('--d')
        el.style.removeProperty('--o')
      }
    }

    const center = (behavior) => {
      const el = itemRefs.current[activeRef.current]
      if (!el) return
      track.scrollTo({
        top: el.offsetTop + el.offsetHeight / 2 - track.clientHeight / 2,
        behavior,
      })
    }

    const sync = () => {
      if (drumMq.matches) {
        track.addEventListener('scroll', onScroll, { passive: true })
        center('auto')
        paint()
      } else {
        track.removeEventListener('scroll', onScroll)
        clearTimeout(settleTimer)
        clean()
      }
    }

    sync()
    drumMq.addEventListener('change', sync)
    window.addEventListener('resize', schedule)

    return () => {
      drumMq.removeEventListener('change', sync)
      window.removeEventListener('resize', schedule)
      track.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
      clearTimeout(settleTimer)
    }
  }, [trackRef, itemRefs])

  // --- Le rang actif revient au centre quand il change d'ailleurs : clic sur
  // un voisin, flèches du clavier. Quand le changement vient du défilement
  // lui-même, l'aimantation a déjà mis le rang là où ce calcul le veut, donc
  // `scrollTo` ne bouge rien.
  //
  // `firstRef` retombe à faux ICI et nulle part ailleurs : le tout premier
  // centrage doit être instantané (sinon la page s'anime toute seule au
  // chargement), les suivants sont doux. L'effet moteur ci-dessus s'exécute
  // avant celui-ci au montage — y baisser le drapeau ferait glisser le premier
  // centrage, qui est précisément celui qu'on veut muet. ---
  useEffect(() => {
    const track = trackRef.current
    const el = itemRefs.current[activeId]
    if (!track || !el || typeof window.matchMedia !== 'function') return
    if (!window.matchMedia(DRUM_MQ).matches) return
    const smooth = !firstRef.current && !window.matchMedia(REDUCE_MQ).matches
    track.scrollTo({
      top: el.offsetTop + el.offsetHeight / 2 - track.clientHeight / 2,
      behavior: smooth ? 'smooth' : 'auto',
    })
    firstRef.current = false
  }, [activeId, trackRef, itemRefs])
}
