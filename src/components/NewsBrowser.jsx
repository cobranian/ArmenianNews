import { useI18n } from '../i18n.jsx'
import { Carousel } from './Carousel.jsx'
import news from '../data/news.json'

// One article card, sized to sit inside a shelf track (see .card in CSS).
function ArticleCard({ item, catLabel }) {
  const { t } = useI18n()
  return (
    <article className="card">
      <a className="card__media" href={item.url} target="_blank" rel="noopener noreferrer">
        {/* ArmRadio's CDN 403s hotlinked images when a Referer is sent, so
            suppress it — with no Referer it serves the image normally. */}
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : null}
        {catLabel && <span className="card__section">{catLabel}</span>}
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

// Build the two source groups. ArmRadio has real EN and HY editions (shown per
// the UI language); Courrier d'Erevan is French-only (courrier.am/hy serves the
// same French articles), so it stays French in every language. Every rubric is
// its own carousel — nothing is merged, and empty rubrics are dropped.
function buildSources(t, lang) {
  const armLang = lang === 'hy' ? 'hy' : 'en'
  const armradio = {
    id: 'armradio',
    brand: 'ArmRadio',
    name: t('browser.armradio'),
    lang: armLang.toUpperCase(),
    live: true,
    cats: (news.armradio?.[armLang] || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`armcats.${s.categoryKey}`), articles: s.articles })),
  }
  const courrier = {
    id: 'courrier',
    brand: "Courrier d'Erevan",
    name: t('browser.courrier'),
    lang: 'FR',
    live: false,
    cats: (news.courrier || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.sectionKey, label: t(`sections.${s.sectionKey}`), articles: s.articles })),
  }
  return [armradio, courrier].filter((s) => s.cats.length)
}

export function NewsBrowser() {
  const { t, lang } = useI18n()
  const sources = buildSources(t, lang)
  if (!sources.length) return null

  return (
    <div className="newsfeed">
      {sources.map((src) => (
        <section className="newsfeed__source" key={src.id} aria-label={src.name}>
          <header className="newsfeed__head">
            <span className="newsfeed__brand">{src.brand}</span>
            {src.live && <span className="newsfeed__live-dot" aria-hidden="true" />}
            <span className="newsfeed__lang">{src.lang}</span>
            <span className="newsfeed__desc">{src.name}</span>
          </header>

          {src.cats.map((c) => (
            <Carousel key={c.key} title={c.label}>
              {c.articles.map((a, i) => (
                <ArticleCard key={a.url || i} item={a} catLabel={c.label} />
              ))}
            </Carousel>
          ))}
        </section>
      ))}
    </div>
  )
}
