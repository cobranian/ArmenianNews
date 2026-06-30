import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import news from '../data/news.json'

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

function ArmRadioStrip() {
  const { t, formatDate } = useI18n()
  if (!news.armradio?.length) return null

  return (
    <div className="armradio reveal">
      <div className="armradio__head">
        <span className="armradio__dot" />
        <span>{t('news.armradio')}</span>
      </div>
      <ul className="armradio__list">
        {news.armradio.map((a, i) => (
          <li className="armradio__item" key={i}>
            <span className="armradio__time">{formatDate(a.date)}</span>
            <a
              className="armradio__link"
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.title}
            </a>
          </li>
        ))}
      </ul>
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
        <div className="news-grid">
          {news.sections.map((item) => (
            <NewsCard key={item.sectionKey} item={item} />
          ))}
        </div>
        <ArmRadioStrip />
      </div>
    </section>
  )
}
