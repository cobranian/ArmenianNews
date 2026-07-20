import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'

// Horizontal, touch-swipeable track with ‹ › arrow controls that disable at
// the start / end. Shared by the news shelves and the Instagram wall.
// Pass `title` to show a heading on the left; otherwise the arrows sit alone
// on the right (`label` is still used for the arrows' accessible names).
// `reveal` (default true) gates the shelf on the scroll-in observer. Pass false
// when the shelf appears on demand (e.g. a tab switch) rather than on scroll —
// otherwise it would mount hidden and the one-shot observer never reveals it.
// `resetKey` scrolls the track back to the start whenever it changes — pass the
// active filter (e.g. the selected country) so switching content doesn't leave
// the track scrolled into the middle of the previous, longer list.
// `titleControl` wraps `title` in a plain <div> instead of an <h3>, for when the
// heading slot holds a form control (a <select>) rather than a heading.
export function Carousel({
  title,
  label,
  children,
  reveal = true,
  resetKey,
  titleControl = false,
}) {
  const { t } = useI18n()
  const trackRef = useRef(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const update = () => {
    const el = trackRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
  }

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Snap back to the start when the filtered content changes, then recompute the
  // arrow states for the new track length.
  useEffect(() => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: 0 })
    update()
  }, [resetKey])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 240), behavior: 'smooth' })
  }

  // `title` may be a node (see Social.jsx), which cannot name the arrows —
  // fall back to `label` for the accessible name in that case.
  const name = String(typeof title === 'string' ? title : label || '').trim()
  const TitleTag = titleControl ? 'div' : 'h3'

  return (
    <div className={`shelf${reveal ? ' reveal' : ''}`}>
      <div className="shelf__head">
        {title && <TitleTag className="shelf__title">{title}</TitleTag>}
        <div className="shelf__nav">
          <button
            className="shelf__arrow"
            onClick={() => scroll(-1)}
            disabled={atStart}
            aria-label={name ? `${name} — ${t('news.prev')}` : t('news.prev')}
          >
            ‹
          </button>
          <button
            className="shelf__arrow"
            onClick={() => scroll(1)}
            disabled={atEnd}
            aria-label={name ? `${name} — ${t('news.next')}` : t('news.next')}
          >
            ›
          </button>
        </div>
      </div>
      <div className="shelf__track" ref={trackRef} onScroll={update}>
        {children}
      </div>
    </div>
  )
}
