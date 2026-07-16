import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'

// Horizontal, touch-swipeable track with ‹ › arrow controls that disable at
// the start / end. Shared by the news shelves and the Instagram wall.
// Pass `title` to show a heading on the left; otherwise the arrows sit alone
// on the right (`label` is still used for the arrows' accessible names).
// `reveal` (default true) gates the shelf on the scroll-in observer. Pass false
// when the shelf appears on demand (e.g. a tab switch) rather than on scroll —
// otherwise it would mount hidden and the one-shot observer never reveals it.
export function Carousel({ title, label, children, reveal = true }) {
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

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 240), behavior: 'smooth' })
  }

  // `title` may be a node (see Social.jsx), which cannot name the arrows —
  // fall back to `label` for the accessible name in that case.
  const name = String(typeof title === 'string' ? title : label || '').trim()

  return (
    <div className={`shelf${reveal ? ' reveal' : ''}`}>
      <div className="shelf__head">
        {title && <h3 className="shelf__title">{title}</h3>}
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
