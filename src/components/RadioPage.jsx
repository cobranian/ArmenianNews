import { useRef } from 'react'
import { useI18n } from '../i18n.jsx'
import { pathFor } from '../../sites.config.js'
import { STATION_FACTS, langueKey } from '../stations.js'
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
  const stepRef = useRef(null) // rempli par <Radio> : step(-1) / step(1)

  return (
    <main className="viewpage">
      <div className="container">
        <h1 className="viewpage__title">{t('radio.page.h1')}</h1>
        <p className="viewpage__intro">{t('radio.page.intro')}</p>
      </div>

      <Radio more={false} stepRef={stepRef} />

      {/* Ce qui se passe une fois la page quittée : ⏮ / ⏭ de l'écran verrouillé
          et du volant (Media Session, voir Radio.jsx), et le saut automatique
          d'un flux muet. La bascule reprend celle d'une commande au volant, et
          elle fonctionne : ses deux boutons appellent le même `step` que l'écran
          verrouillé (saut des stations hors antenne, lecture lancée). Les
          glyphes ⏮ ⏭ sont dessinés en SVG : iOS les rend en emoji. */}
      <section className="radio-remote" aria-labelledby="radio-remote-title">
        <div className="container radio-remote__inner">
          <div className="radio-remote__rocker" role="group" aria-label={t('radio.remote.icon')}>
            <button
              type="button"
              className="radio-remote__key"
              aria-label={t('radio.remote.prev')}
              onClick={() => stepRef.current?.(-1)}
            >
              <svg viewBox="0 0 20 18" aria-hidden="true" focusable="false">
                <path d="M0 0h3v18H0zM17 0v18L4 9z" />
              </svg>
            </button>
            <button
              type="button"
              className="radio-remote__key"
              aria-label={t('radio.remote.next')}
              onClick={() => stepRef.current?.(1)}
            >
              <svg viewBox="0 0 20 18" aria-hidden="true" focusable="false">
                <path d="M3 0l13 9-13 9zM17 0h3v18h-3z" />
              </svg>
            </button>
          </div>
          <div className="radio-remote__text">
            <h2 id="radio-remote-title" className="radio-remote__title">
              {t('radio.remote.title')}
            </h2>
            <p>{t('radio.remote.keys')}</p>
            <p>{t('radio.remote.skip')}</p>
          </div>
        </div>
      </section>

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
                ['radio.page.lang', f.langue && t(`radio.page.lang.${langueKey(f)}`)],
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
