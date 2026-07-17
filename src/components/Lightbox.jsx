import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n.jsx'
import { Motif } from './motifs.jsx'

/* ------------------------------------------------------------------ *
 * Lightbox — the social cards enlarge in place instead of leaving the
 * page. This is the peintres#movses mechanic (frame lifts on hover, click
 * opens an enlarged view, ‹ › browse the set) worn in Arménie Info's own
 * skin: basalt/abricot that flips with the day/night toggle, not the
 * reference's cream paper. The way out to the network is a link INSIDE
 * the lightbox, so "il peut aller sur Facebook" without the card itself
 * navigating away.
 *
 * Rendered through a portal on <body>: the shelf track clips its overflow
 * on the x-axis, so a lightbox mounted inside it would be cut off.
 *
 * `items` — [{ img, alt, title, sub, href, cta, seed, c1, c2, ink }].
 * A photo-less post falls back to its deterministic Armenian motif, the
 * same one its card shows, so the enlarged view never comes up blank.
 * ------------------------------------------------------------------ */
export function Lightbox({ items, startIndex = 0, onClose }) {
  const { t } = useI18n()
  const [cur, setCur] = useState(startIndex)
  const stageRef = useRef(null)
  const restoreRef = useRef(null)

  const n = items.length
  const go = useCallback((d) => setCur((i) => (i + d + n) % n), [n])

  // Remember what had focus, lock the page scroll, focus the dialog; put it
  // all back when the lightbox closes.
  useEffect(() => {
    restoreRef.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    stageRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      const el = restoreRef.current
      if (el && typeof el.focus === 'function') el.focus()
    }
  }, [])

  // Escape closes, arrows browse, Tab stays trapped inside the dialog.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'Tab') {
        const f = stageRef.current?.parentElement?.querySelectorAll(
          'button, [href]',
        )
        if (!f || !f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const item = items[cur]
  const showPhoto = !!item.img

  return createPortal(
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={t('lb.dialog')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {n > 1 && (
        <button
          className="lb__nav lb__nav--prev"
          type="button"
          onClick={() => go(-1)}
          aria-label={t('lb.prev')}
        >
          <span aria-hidden="true">‹</span>
        </button>
      )}

      <div className="lb__stage" ref={stageRef} tabIndex={-1}>
        <div
          className={`lb__frame${showPhoto ? '' : ' lb__frame--motif'}`}
          style={
            showPhoto
              ? undefined
              : { '--c1': item.c1, '--c2': item.c2, '--ink': item.ink }
          }
        >
          {showPhoto ? (
            <img className="lb__img" src={item.img} alt={item.alt} />
          ) : (
            <svg className="lb__motif" viewBox="0 0 100 100" aria-hidden="true">
              <Motif index={item.seed} />
            </svg>
          )}
          <span className="lb__corner lb__corner--tl" aria-hidden="true" />
          <span className="lb__corner lb__corner--br" aria-hidden="true" />
        </div>

        <button
          className="lb__close"
          type="button"
          onClick={onClose}
          aria-label={t('lb.close')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="lb__meta">
          <p className="lb__cap">
            <span className="lb__net">{item.sub}</span>
            <span className="lb__title">{item.title}</span>
          </p>
          <a className="lb__out" href={item.href} rel="noopener noreferrer">
            {item.cta} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      {n > 1 && (
        <button
          className="lb__nav lb__nav--next"
          type="button"
          onClick={() => go(1)}
          aria-label={t('lb.next')}
        >
          <span aria-hidden="true">›</span>
        </button>
      )}

      {n > 1 && (
        <p className="lb__count" aria-hidden="true">
          {cur + 1} <span>/</span> {n}
        </p>
      )}
    </div>,
    document.body,
  )
}
