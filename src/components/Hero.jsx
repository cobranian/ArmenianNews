import { useI18n } from '../i18n.jsx'
import { KnotMark, Ararat } from './Ornament.jsx'
import meta from '../data/meta.json'

export function Hero() {
  const { t, formatDate } = useI18n()

  return (
    <header className="hero" id="top">
      <div className="container hero__frame">
        {/* Trois écritures dans une seule ligne, identique sur les quatre
            pages. Le `lang` n'est donc pas décoratif : il marque la seule
            partie arménienne pour que global.css rattrape sa taille optique
            (les capitales arméniennes rendent 12 % plus hautes que les
            latines juste à côté), et il évite qu'un lecteur d'écran épelle
            « ՀԱՅԱՍՏԱՆ » avec la voix de la page. La famille, elle, n'a besoin
            de personne : la pile de --font-mono résout chaque glyphe. */}
        <div className="hero__kicker">
          <span lang="hy">ՀԱՅԱՍՏԱՆ</span> · ARMENIA · ARMÉNIE
        </div>
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
          <span className="hero__cadence">{t('site.cadence')}</span>
        </div>
      </div>
      <Ararat className="hero__ararat" />
    </header>
  )
}
