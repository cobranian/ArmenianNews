import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clampPan, pinchTo, zoomAt, toggleZoom } from '../zoomMath.js'

/* ------------------------------------------------------------------ *
 * ZoomView — l'image de la visionneuse en plein écran, pour LIRE une
 * affiche : zoom à deux doigts, déplacement à un doigt, double toucher,
 * molette et double clic sur ordinateur. Spec :
 * docs/superpowers/specs/2026-11-13-zoom-affiche-design.md
 *
 * Rendue DANS la .lb (même portail) : `.lb` porte un backdrop-filter, donc
 * c'est elle — plein écran elle aussi — qui contient cette couche fixe.
 *
 * Le geste est capté par la couche (`touch-action: none`), jamais par le
 * navigateur : la page ne zoome pas, et rien ne reste agrandi à la
 * fermeture. Les calculs (bornes, point fixe) sont dans src/zoomMath.js.
 * ------------------------------------------------------------------ */

const TAP_MS = 300 // double toucher : deux relâchés à moins de 300 ms…
const TAP_PX = 30 // … et à moins de 30 px l'un de l'autre
const MOVE_PX = 10 // au-delà, ce n'était pas un toucher mais un geste

const ORIGIN = { x: 0, y: 0, scale: 1 }

// Point relatif au centre de l'écran (box : voir src/zoomMath.js).
const rel = (p, box) => ({ x: p.x - box.vw / 2, y: p.y - box.vh / 2 })

export function ZoomView({ src, alt, closeLabel, onClose }) {
  const [view, setView] = useState(ORIGIN)
  const [anim, setAnim] = useState(false)
  const imgRef = useRef(null)
  const closeRef = useRef(null)
  const viewRef = useRef(ORIGIN)
  const boxRef = useRef({ vw: 1, vh: 1, iw: 1, ih: 1 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const lastTap = useRef(null)

  const apply = useCallback((next, animated = false) => {
    viewRef.current = next
    setAnim(animated)
    setView(next)
  }, [])

  // Taille de l'image ajustée « contain » à l'écran, à l'échelle 1.
  const measure = useCallback(() => {
    const img = imgRef.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const nw = img?.naturalWidth || vw
    const nh = img?.naturalHeight || vh
    const k = Math.min(vw / nw, vh / nh)
    boxRef.current = { vw, vh, iw: nw * k, ih: nh * k }
    apply(clampPan(viewRef.current, boxRef.current))
  }, [apply])

  useLayoutEffect(() => {
    closeRef.current?.focus()
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // Clavier, en CAPTURE sur window : passe avant l'écouteur de la Lightbox
  // (sur document, en bouillonnement), qu'on arrête. Échap ferme le zoom
  // seul ; les flèches ne changent pas d'image sous le zoom ; Tab reste sur
  // la croix, seul élément focusable.
  useEffect(() => {
    const onKey = (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault()
        if (e.key === 'Tab') closeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // (Re)part d'un état de geste à partir des pointeurs présents : appelé à
  // chaque doigt posé ou levé, pour que le doigt restant d'un pincement
  // enchaîne un déplacement sans saut.
  // Les points sont COPIÉS : onPointerMove modifie les objets de `pointers`,
  // et un départ qui serait le même objet donnerait un écart toujours nul
  // (défaut relevé en relecture : aucun déplacement ne bougeait l'image).
  const anchor = () => {
    const pts = [...pointers.current.values()]
    const v = viewRef.current
    if (pts.length >= 2) {
      const [a, b] = pts
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, boxRef.current),
        view: v,
      }
    } else if (pts.length === 1) {
      gesture.current = { kind: 'pan', start: { x: pts[0].x, y: pts[0].y }, view: v }
    } else {
      gesture.current = null
    }
  }

  const onPointerDown = (e) => {
    if (e.target === closeRef.current || closeRef.current?.contains(e.target)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
    anchor()
  }

  const onPointerMove = (e) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    const g = gesture.current
    if (!g) return
    const box = boxRef.current
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = rel({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, box)
      apply(pinchTo(g.view, g.mid, mid, dist / g.dist, box))
    } else if (g.view.scale > 1) {
      apply(
        clampPan(
          { x: g.view.x + p.x - g.start.x, y: g.view.y + p.y - g.start.y, scale: g.view.scale },
          box,
        ),
      )
    }
  }

  const onPointerUp = (e) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    const wasSingle = pointers.current.size === 1
    pointers.current.delete(e.pointerId)
    anchor()
    // Un toucher (pas un geste) : candidat au double toucher.
    if (!wasSingle || Math.hypot(p.x - p.x0, p.y - p.y0) > MOVE_PX) {
      lastTap.current = null
      return
    }
    const now = e.timeStamp
    const prev = lastTap.current
    if (prev && now - prev.t < TAP_MS && Math.hypot(p.x - prev.x, p.y - prev.y) < TAP_PX) {
      lastTap.current = null
      const pt = rel(p, boxRef.current)
      apply(toggleZoom(viewRef.current, pt.x, pt.y, boxRef.current), true)
    } else {
      lastTap.current = { t: now, x: p.x, y: p.y }
    }
  }

  const onPointerCancel = (e) => {
    pointers.current.delete(e.pointerId)
    anchor()
  }

  // Molette : écouteur natif non passif, pour pouvoir empêcher le défilement.
  const layerRef = useRef(null)
  useEffect(() => {
    const el = layerRef.current
    const onWheel = (e) => {
      e.preventDefault()
      const pt = rel({ x: e.clientX, y: e.clientY }, boxRef.current)
      const v = viewRef.current
      apply(zoomAt(v, v.scale * Math.exp(-e.deltaY * 0.002), pt.x, pt.y, boxRef.current))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [apply])

  return (
    <div
      className="zv"
      ref={layerRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <img
        ref={imgRef}
        className={`zv__img${anim ? ' zv__img--anim' : ''}`}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={measure}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
      <button ref={closeRef} className="zv__close" type="button" onClick={onClose} aria-label={closeLabel}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
