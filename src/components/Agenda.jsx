import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import agenda from '../data/agenda.json'

// Recurring Lausanne gatherings (from armeniensdelausanne.ch).
const RECURRING = {
  fr: ['Cours de danse · Dimanche 9h–10h, Studio 2 (Lausanne)', 'Cours de danse · Mardi 18h–19h, Maison de quartier des Faverges'],
  en: ['Dance class · Sunday 9–10am, Studio 2 (Lausanne)', 'Dance class · Tuesday 6–7pm, Faverges community house'],
  hy: ['Պարի դաս · Կիրակի 9:00–10:00, Studio 2 (Լոզան)', 'Պարի դաս · Երեքշաբթի 18:00–19:00, Faverges'],
}

// A single event rendered as a "broadsheet clipping" card that lives inside a
// horizontal, ‹ ›-scrollable track.
function EventCard({ ev, locale, place }) {
  const d = ev.date ? new Date(ev.date) : null
  const day = d ? d.toLocaleDateString(locale, { day: 'numeric' }) : '–'
  const month = d ? d.toLocaleDateString(locale, { month: 'short' }).replace('.', '') : ''
  const when = d
    ? d.toLocaleDateString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <a
      className="agenda-card"
      href={ev.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="agenda-card__top">
        <span className="agenda-card__date">
          <span className="agenda-card__day">{day}</span>
          <span className="agenda-card__month">{month}</span>
        </span>
        {place && <span className="agenda-card__place">{place}</span>}
      </div>
      <h4 className="agenda-card__title">{ev.title}</h4>
      <div className="agenda-card__foot">
        {when && <span className="agenda-card__when">{when}</span>}
        <span className="agenda-card__go" aria-hidden="true">↗</span>
      </div>
    </a>
  )
}

export function Agenda() {
  const { t, lang, locale } = useI18n()
  const recurring = RECURRING[lang] || RECURRING.fr

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

          <div className="recurring">
            <h4>{t('agenda.recurring')}</h4>
            <ul>
              {recurring.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
