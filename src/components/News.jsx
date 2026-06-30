import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
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
   track of article cards. */
function Shelf({ label, articles }) {
  if (!articles?.length) return null
  return (
    <Carousel title={label}>
      {articles.map((a, i) => (
        <NewsCard key={a.url || i} item={a} />
      ))}
    </Carousel>
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
