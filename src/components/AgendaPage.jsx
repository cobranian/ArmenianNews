import { useMemo } from 'react'
import { useI18n } from '../i18n.jsx'
import { pathFor } from '../../sites.config.js'
import { worldCountryKey, countryLabel, countryFlag } from '../worldPlace.js'
import { agendaJsonLd } from '../jsonld.js'
import agenda from '../data/agenda.json'

// La vue /agenda : la liste COMPLÈTE, groupée par pays, là où l'accueil ne
// montre qu'un pays à la fois dans un carrousel. C'est cette différence qui
// évite le doublon entre les deux pages — avec l'introduction, que l'accueil
// n'a pas, et le canonical propre à chacune.
export function AgendaPage() {
  const { t, lang, formatDate } = useI18n()

  const { total, parPays } = useMemo(() => {
    const tous = [...(agenda.switzerland || []), ...(agenda.world || [])]
    // Dédoublonnage par URL : le même événement est recensé sur plusieurs pages
    // pays chez armenopole. Puis on écarte le passé — une liste d'événements
    // révolus est une page sans valeur, et son balisage serait fautif.
    const vus = new Set()
    const maintenant = Date.now()
    const frais = tous.filter((ev) => {
      if (vus.has(ev.url) || new Date(ev.date).getTime() < maintenant) return false
      vus.add(ev.url)
      return true
    })
    const groupes = new Map()
    for (const ev of frais) {
      const cle = worldCountryKey(ev)
      if (!groupes.has(cle)) groupes.set(cle, [])
      groupes.get(cle).push(ev)
    }
    const parPays = [...groupes.entries()].sort((a, b) =>
      countryLabel(a[0], lang).localeCompare(countryLabel(b[0], lang), lang),
    )
    return { total: frais.length, parPays }
  }, [lang])

  return (
    <main className="viewpage">
      <div className="container">
        <h1 className="viewpage__title">{t('agenda.page.h1')}</h1>
        <p className="viewpage__intro">{t('agenda.page.intro')}</p>
        <p className="viewpage__count">
          {total} {t('agenda.page.count')}
        </p>
      </div>

      {parPays.map(([cle, evs]) => (
        <section className="section" id={cle} key={cle}>
          <div className="container">
            <h2 className="section__title">
              <span aria-hidden="true">{countryFlag(cle)}</span> {countryLabel(cle, lang)}
            </h2>
            <ul className="agenda-list">
              {evs.map((ev) => (
                <li key={ev.url}>
                  {/* Toute date passe par les formateurs du contexte : Intl ne
                      résout pas hy-AM dans un navigateur. `formatDate` prend la
                      chaîne ISO telle quelle — PAS un objet Date (voir sa
                      signature dans i18n.jsx : `formatDate = (iso) => …`). */}
                  <time className="agenda-list__date" dateTime={ev.date}>
                    {formatDate(ev.date)}
                  </time>
                  <h3 className="agenda-list__title">
                    <a href={ev.url} rel="noopener noreferrer">
                      {ev.title}
                    </a>
                  </h3>
                  <p className="agenda-list__where">{ev.location}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <div className="container">
        <p className="viewpage__back">
          <a href={pathFor(lang, 'home')}>{t('agenda.page.home')}</a>
        </p>
      </div>

      {/* Le SEUL balisage du projet qui produise un résultat enrichi visible
          dans Google. Réutilise `parPays`, déjà dédoublonné par URL et filtré
          aux événements à venir — jamais une seconde liste qui pourrait
          diverger de ce que la page affiche réellement. Le plugin Vite
          (vite.config.js) pose son propre @graph hors des sentinelles et
          `stripAgendaLd` le retire de cette page (voir
          scripts/lib/agenda-ld.mjs) : deux graphes dupliqueraient les
          entités. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: agendaJsonLd(
            lang,
            parPays.flatMap(([, e]) => e),
          ),
        }}
      />
    </main>
  )
}
