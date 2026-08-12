import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { NewsBrowser } from './NewsBrowser.jsx'
import { visibleSources } from '../newsSources.js'

// La section Actualités : un bandeau, un titre, puis le navigateur de sources
// (un rail de marques sur grand écran, un tambour sous 640px).
//
// LE BANDEAU EST DÉRIVÉ, ET IL DOIT LE RESTER. Il nommait autrefois cinq
// sources en dur — « ArmRadio · Courrier d'Erevan · Nouvelles d'Arménie ·
// Artzakank · ArménieInfo.tv » — et cette ligne s'est périmée deux fois : elle
// a cessé de couvrir les sources ajoutées depuis, et surtout elle IGNORAIT LA
// LANGUE. Sur armenianews.org elle annonçait quatre rédactions francophones
// au-dessus d'un rail qui, à dessein, n'en montre aucune, tout en taisant les
// huit réellement présentes, Armenpress compris.
//
// Rien ne pouvait le dire : le HTML restait valide, `npm run check` au vert,
// les tests au vert. C'est le même mode de panne que le nombre de rédactions
// des cartes de liens — sauf que celui-là a fini par recevoir un test, et
// celui-ci n'en avait aucun. Un compteur écrit à la main ment tôt ou tard ;
// celui-ci compte les sources que le rail rendra vraiment, donc il ne peut
// plus mentir.
export function News() {
  const { t, lang } = useI18n()
  const count = visibleSources(lang).length

  return (
    <section className="section" id="actualites">
      <div className="container">
        <SectionHead
          eyebrow={t('news.sources').replace('{n}', count)}
          title={t('news.title')}
          subtitle={t('browser.subtitle')}
        />
        <NewsBrowser />
      </div>
    </section>
  )
}
