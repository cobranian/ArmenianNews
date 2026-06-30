import { useI18n } from '../i18n.jsx'
import { KnotMark, Ararat } from './Ornament.jsx'
import meta from '../data/meta.json'

export function Hero() {
  const { t, formatDate } = useI18n()

  return (
    <header className="hero" id="top">
      <div className="container hero__frame">
        <div className="hero__kicker">ՀԱՅԱՍՏԱՆ · ARMENIA · ARMÉNIE</div>
        <h1 className="hero__title">
          {t('site.title').split("'").length === 2 ? (
            <>
              {t('site.title').split("'")[0]}'<em>{t('site.title').split("'")[1]}</em>
            </>
          ) : (
            <em>{t('site.title')}</em>
          )}
        </h1>
        <p className="hero__tagline">{t('site.tagline')}</p>
        <KnotMark />
        <div className="hero__date">
          <span>{t('site.snapshot')}</span>
          <strong>{formatDate(meta.generatedAt)}</strong>
        </div>
      </div>
      <Ararat className="hero__ararat" />
    </header>
  )
}
