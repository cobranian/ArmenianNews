import { useI18n } from '../i18n.jsx'
import { pathFor } from '../../sites.config.js'
import { STATION_FACTS } from '../stations.js'
import { VIEW_SEO } from '../seo.js'
import { radioJsonLd } from '../jsonld.js'
import { Radio } from './Radio.jsx'

// La vue /radio. Elle COMPLÈTE l'accueil, elle ne le remplace pas : l'accueil
// garde sa section lecteur, cette page ajoute ce que l'accueil n'a pas — une
// introduction, et les faits de chaque station.
//
// Le lecteur est le composant Radio réutilisé, pas une copie : deux lecteurs
// divergeraient au premier correctif. Seul son lien « toutes les radios » est
// retiré (`more={false}`) — il pointerait ici sur la page courante, et le clic
// rechargerait le document, donc couperait le flux en cours d'écoute.
export function RadioPage() {
  const { t, lang } = useI18n()
  const ids = Object.keys(STATION_FACTS)

  return (
    <main className="viewpage">
      <div className="container">
        <h1 className="viewpage__title">{t('radio.page.h1')}</h1>
        <p className="viewpage__intro">{t('radio.page.intro')}</p>
      </div>

      <Radio more={false} />

      <section className="section" id="stations">
        <div className="container">
          <h2 className="section__title">{t('radio.page.list')}</h2>
          <ul className="stations">
            {ids.map((id) => {
              const f = STATION_FACTS[id]
              const champs = [
                // `city` est une clé (yerevan, beirut, glendale) : « Երևան »
                // s'affichait tel quel sous fr/en/ru. Même règle que genre et
                // langue, gardée par test/stations.test.mjs.
                ['radio.page.city', f.city && t(`radio.city.${f.city}`)],
                ['radio.page.genre', f.genre && t(`radio.genre.${f.genre}`)],
                ['radio.page.lang', f.langue && t(`radio.page.lang.${f.langue}`)],
                ['radio.page.fm', f.fm && `${f.fm} MHz`],
                ['radio.page.bitrate', f.bitrate && `${f.bitrate} kbps`],
              ].filter(([, v]) => v)

              return (
                <li className="stations__item" key={id}>
                  <h3 className="stations__name">{t(`radio.st.${id}`)}</h3>
                  <dl className="stations__facts">
                    {champs.map(([cle, valeur]) => (
                      <div key={cle}>
                        <dt>{t(cle)}</dt>
                        <dd>{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              )
            })}
          </ul>
          <p className="viewpage__back">
            <a href={pathFor(lang, 'home')}>{t('radio.page.home')}</a>
          </p>
          {/* Le pont radio ⇄ agenda : chaque page pilier lie l'autre, dans sa
              langue — l'audit du 21 août 2026 avait mesuré qu'aucune des deux
              ne le faisait. Le libellé est le <title> de la page cible. */}
          <p className="viewpage__also">
            {t('viewpage.also')}{' '}
            <a href={pathFor(lang, 'agenda')}>{VIEW_SEO.agenda[lang].title}</a>
          </p>
        </div>
      </section>

      {/* application/ld+json n'est pas exécuté : script-src 'self' ne le bloque
          pas. Le contenu vient de nos propres fichiers et « < » y est échappé. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: radioJsonLd(lang, t) }}
      />
    </main>
  )
}
