import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import news from '../data/news.json'

function NewsCard({ item }) {
  const { t } = useI18n()
  return (
    <article className="card">
      <a className="card__media" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
      </a>
      <div className="card__body">
        <a className="card__title" href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title || t('news.empty')}
        </a>
        <a className="card__more" href={item.url} target="_blank" rel="noopener noreferrer">
          {t('news.readmore')}
        </a>
      </div>
    </article>
  )
}

/* A section row: title + ‹ › arrows that scroll a horizontal, swipeable
   track of article cards. Arrows disable at the track's start / end. */
function Shelf({ label, articles }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 240), behavior: 'smooth' })
  }

  if (!articles?.length) return null

  return (
    <div className="shelf reveal">
      <div className="shelf__head">
        <h3 className="shelf__title">{label}</h3>
        <div className="shelf__nav">
          <button
            className="shelf__arrow"
            onClick={() => scroll(-1)}
            disabled={atStart}
            aria-label={`${label} — ${t('news.prev')}`}
          >
            ‹
          </button>
          <button
            className="shelf__arrow"
            onClick={() => scroll(1)}
            disabled={atEnd}
            aria-label={`${label} — ${t('news.next')}`}
          >
            ›
          </button>
        </div>
      </div>
      <div className="shelf__track" ref={trackRef} onScroll={update}>
        {articles.map((a, i) => (
          <NewsCard key={a.url || i} item={a} />
        ))}
      </div>
    </div>
  )
}

/* ArmRadio headlines as a continuous, hover-pausing "wire" ticker.
   The list is rendered twice so the marquee can loop seamlessly. */
function NewsWire() {
  const { t, formatDate } = useI18n()
  if (!news.armradio?.length) return null

  const Item = ({ a, hidden }) => (
    <a
      className="armradio__item"
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <span className="armradio__time">{formatDate(a.date)}</span>
      <span className="armradio__link">{a.title}</span>
    </a>
  )

  return (
    <div className="armradio reveal">
      <div className="armradio__head">
        <span className="armradio__dot" />
        <span>{t('news.armradio')}</span>
      </div>
      <div className="armradio__ticker">
        <div className="armradio__track">
          {news.armradio.map((a, i) => (
            <Item a={a} key={`a${i}`} />
          ))}
          {news.armradio.map((a, i) => (
            <Item a={a} key={`b${i}`} hidden />
          ))}
        </div>
      </div>
    </div>
  )
}

export function News() {
  const { t } = useI18n()

  return (
    <section className="section" id="actualites">
      <div className="container">
        <SectionHead
          eyebrow="Courrier d'Erevan"
          title={t('news.title')}
          subtitle={t('news.subtitle')}
        />
        {news.sections.map((s) => (
          <Shelf
            key={s.sectionKey}
            label={t(`sections.${s.sectionKey}`)}
            articles={s.articles}
          />
        ))}
        <NewsWire />
      </div>
    </section>
  )
}
