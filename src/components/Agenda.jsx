import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import agenda from '../data/agenda.json'

// A single event rendered as a "broadsheet clipping" card that lives inside a
// horizontal, ‹ ›-scrollable track. A top banner shows the event's armenopole
// image (hotlinked); events with no image — or an image that fails to load —
// fall back to a deterministic Armenian motif, keeping every card the same
// height. The date pastille overlays the banner's bottom-left corner.
function EventCard({ ev, locale, place }) {
  const d = ev.date ? new Date(ev.date) : null
  const day = d ? d.toLocaleDateString(locale, { day: 'numeric' }) : '–'
  const month = d ? d.toLocaleDateString(locale, { month: 'short' }).replace('.', '') : ''
  const when = d
    ? d.toLocaleDateString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  const [broken, setBroken] = useState(false)
  const showPhoto = ev.image && !broken
  const seed = hash(ev.url || ev.title || '')
  const theme = THEMES[seed % THEMES.length]

  return (
    <a
      className="agenda-card"
      href={ev.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div
        className={`agenda-card__media${showPhoto ? ' agenda-card__media--photo' : ''}`}
        style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
      >
        {showPhoto ? (
          <img
            className="agenda-card__photo"
            src={ev.image}
            alt={ev.title}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="agenda-card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        <span className="agenda-card__date">
          <span className="agenda-card__day">{day}</span>
          <span className="agenda-card__month">{month}</span>
        </span>
        {place && <span className="agenda-card__place">{place}</span>}
      </div>
      <div className="agenda-card__body">
        <h4 className="agenda-card__title">{ev.title}</h4>
        <div className="agenda-card__foot">
          {when && <span className="agenda-card__when">{when}</span>}
          <span className="agenda-card__go" aria-hidden="true">↗</span>
        </div>
      </div>
    </a>
  )
}

export function Agenda() {
  const { t, locale } = useI18n()

  const swiss = agenda.switzerland || []
  const world = agenda.world || []

  return (
    <section className="section section--alt" id="agenda">
      <div className="container">
        <SectionHead
          eyebrow="Armenopole"
          title={t('agenda.title')}
          subtitle={t('agenda.subtitle')}
        />

        <div className="agenda reveal">
          {swiss.length ? (
            <Carousel title={`🇨🇭 ${t('agenda.switzerland')}`}>
              {swiss.map((ev, i) => (
                <EventCard key={ev.url || i} ev={ev} locale={locale} place={ev.location} />
              ))}
            </Carousel>
          ) : (
            <div className="agenda__empty">
              <h3><span className="agenda__flag">🇨🇭</span>{t('agenda.switzerland')}</h3>
              <p className="section__subtitle">{t('agenda.empty')}</p>
            </div>
          )}

          {world.length ? (
            <Carousel title={`🌍 ${t('agenda.world')}`}>
              {world.map((ev, i) => (
                <EventCard
                  key={ev.url || i}
                  ev={ev}
                  locale={locale}
                  place={ev.location || ev.country}
                />
              ))}
            </Carousel>
          ) : (
            <div className="agenda__empty">
              <h3><span className="agenda__flag">🌍</span>{t('agenda.world')}</h3>
              <p className="section__subtitle">{t('agenda.empty')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
