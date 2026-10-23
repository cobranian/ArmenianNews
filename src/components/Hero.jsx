import { useI18n } from '../i18n.jsx'
import { KnotMark, Ararat } from './Ornament.jsx'
import meta from '../data/meta.json'

export function Hero() {
  const { t, formatDate } = useI18n()

  return (
    <header className="hero" id="top">
      <div className="container hero__frame">
        {/* Trois écritures dans une seule ligne, identique sur toutes
            les pages. Ni la famille ni la taille n'ont besoin de ce `lang` :
            la pile de --font-mono résout chaque glyphe, et le
            `font-size-adjust: cap-height` posé sur .hero__kicker égalise les
            hauteurs de capitale police par police, à l'intérieur de la ligne.
            Le `lang` sert aux deux choses qu'eux ne peuvent pas faire : porter
            la correction de GRAISSE de l'arménien (voir global.css), et éviter
            qu'un lecteur d'écran épelle « ՀԱՅԱՍՏԱՆ » avec la voix de la
            page. */}
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
          {/* Rendue dans le fuseau de la machine : celui du prérendu (UTC en CI) peut
              différer d'un jour de celui du lecteur vers minuit. Écart toléré, sur
              ce seul texte, pour ne pas faire échouer l'hydratation de la page
              (src/renderClock.js). */}
          <strong suppressHydrationWarning>{formatDate(meta.generatedAt)}</strong>
          <span className="hero__cadence">{t('site.cadence')}</span>
        </div>
      </div>
      <Ararat className="hero__ararat" />
    </header>
  )
}
