import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { Carousel } from './Carousel.jsx'
import news from '../data/news.json'

// One article card in the right-hand grid. Reuses the shared .card styling.
function BrowserCard({ item, catLabel }) {
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

// Build the two source groups from the scraped data. ArmRadio (EN, radio) and
// Courrier (FR, print) each keep their own native rubrics — nothing is merged.
function buildSources(t) {
  const armradio = {
    id: 'armradio',
    brand: 'ArmRadio',
    name: t('browser.armradio'),
    lang: 'EN',
    live: true,
    cats: (news.armradioSections || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.categoryKey, label: t(`armcats.${s.categoryKey}`), articles: s.articles })),
  }
  const courrier = {
    id: 'courrier',
    brand: "Courrier d'Erevan",
    name: t('browser.courrier'),
    lang: 'FR',
    live: false,
    cats: (news.sections || [])
      .filter((s) => s.articles?.length)
      .map((s) => ({ key: s.sectionKey, label: t(`sections.${s.sectionKey}`), articles: s.articles })),
  }
  return [armradio, courrier].filter((s) => s.cats.length)
}

export function NewsBrowser() {
  const { t, lang } = useI18n()
  const sources = useMemo(() => buildSources(t), [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flat, ordered list of every tab for arrow-key roving focus.
  const flat = useMemo(
    () => sources.flatMap((s) => s.cats.map((c) => ({ sourceId: s.id, catKey: c.key }))),
    [sources],
  )
  const tabRefs = useRef({})

  const first = flat[0]
  const [active, setActive] = useState(() => (first ? `${first.sourceId}:${first.catKey}` : ''))

  if (!sources.length) return null

  const [activeSourceId, activeCatKey] = active.split(':')
  const activeSource = sources.find((s) => s.id === activeSourceId) || sources[0]
  const activeCat =
    activeSource.cats.find((c) => c.key === activeCatKey) || activeSource.cats[0]
  const articles = activeCat?.articles || []

  const select = ({ sourceId, catKey }) => setActive(`${sourceId}:${catKey}`)

  // WAI-ARIA tabs: Up/Down move through the flat list (across both groups),
  // Home/End jump to the ends. Focus follows selection.
  const onKeyDown = (e) => {
    const i = flat.findIndex((f) => `${f.sourceId}:${f.catKey}` === active)
    if (i < 0) return
    let next = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % flat.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + flat.length) % flat.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = flat.length - 1
    if (next == null) return
    e.preventDefault()
    const target = flat[next]
    select(target)
    tabRefs.current[`${target.sourceId}:${target.catKey}`]?.focus()
  }

  const panelId = `browser-panel-${activeSource.id}-${activeCat.key}`

  return (
    <div className="browser reveal">
      <div
        className="browser__rail"
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('browser.pick')}
        onKeyDown={onKeyDown}
      >
        {sources.map((src) => (
          <div className="browser__group" key={src.id}>
            <div className="browser__group-head">
              <span className="browser__brand">{src.brand}</span>
              {src.live && <span className="browser__live-dot" aria-hidden="true" />}
              <span className="browser__lang">{src.lang}</span>
            </div>
            <div className="browser__desc">{src.name}</div>
            <div className="browser__cats">
              {src.cats.map((c) => {
                const id = `${src.id}:${c.key}`
                const isActive = id === active
                return (
                  <button
                    key={c.key}
                    ref={(el) => (tabRefs.current[id] = el)}
                    type="button"
                    role="tab"
                    id={`browser-tab-${src.id}-${c.key}`}
                    aria-selected={isActive}
                    aria-controls={isActive ? panelId : undefined}
                    tabIndex={isActive ? 0 : -1}
                    className={`browser__cat ${isActive ? 'is-active' : ''}`}
                    onClick={() => select({ sourceId: src.id, catKey: c.key })}
                  >
                    <span className="browser__cat-label">{c.label}</span>
                    <span className="browser__cat-count">{c.articles.length}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="browser__panel"
        role="tabpanel"
        id={panelId}
        aria-labelledby={`browser-tab-${activeSource.id}-${activeCat.key}`}
      >
        <div className="browser__panel-head">
          <h3 className="browser__panel-title">
            <span className="browser__panel-brand">{activeSource.brand}</span>
            {activeCat.label}
          </h3>
          <span className="browser__panel-count">{articles.length}</span>
        </div>
        {articles.length ? (
          <Carousel key={active} label={activeCat.label}>
            {articles.map((a, i) => (
              <BrowserCard key={a.url || i} item={a} catLabel={activeCat.label} />
            ))}
          </Carousel>
        ) : (
          <p className="browser__empty">{t('browser.empty')}</p>
        )}
      </div>
    </div>
  )
}
