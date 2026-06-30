import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import news from '../data/news.json'

/* The first story of the day runs as a front-page lead. */
function LeadStory({ item }) {
  const { t } = useI18n()
  const label = t(`sections.${item.sectionKey}`)

  return (
    <article className="lead reveal">
      <a className="lead__media" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
        <span className="card__section">{label}</span>
      </a>
      <div className="lead__body">
        <div className="lead__eyebrow">{t('news.lead')}</div>
        <a className="lead__title" href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title || t('news.empty')}
        </a>
        <a className="lead__more" href={item.url} target="_blank" rel="noopener noreferrer">
          {t('news.readmore')}
        </a>
      </div>
    </article>
  )
}

function NewsCard({ item }) {
  const { t } = useI18n()
  const label = t(`sections.${item.sectionKey}`)

  return (
    <article className="card reveal">
      <a className="card__media" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" />
        ) : null}
        <span className="card__section">{label}</span>
      </a>
      <div className="card__body">
        <a
          className="card__title"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.title || t('news.empty')}
        </a>
        <a
          className="card__more"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('news.readmore')}
        </a>
      </div>
    </article>
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
  const [lead, ...rest] = news.sections

  return (
    <section className="section" id="actualites">
      <div className="container">
        <SectionHead
          eyebrow="Courrier d'Erevan"
          title={t('news.title')}
          subtitle={t('news.subtitle')}
        />
        {lead && <LeadStory item={lead} />}
        <div className="news-grid">
          {rest.map((item) => (
            <NewsCard key={item.sectionKey} item={item} />
          ))}
        </div>
        <NewsWire />
      </div>
    </section>
  )
}
