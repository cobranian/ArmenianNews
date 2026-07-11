import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { NewsBrowser } from './NewsBrowser.jsx'

// The news section is a two-source browser: pick a source (ArmRadio / Courrier
// d'Erevan) and one of its rubrics in the left rail, read the articles on the
// right. It replaces the earlier per-section shelves and the ArmRadio ticker.
export function News() {
  const { t } = useI18n()

  return (
    <section className="section" id="actualites">
      <div className="container">
        <SectionHead
          eyebrow="ArmRadio · Courrier d'Erevan"
          title={t('news.title')}
          subtitle={t('browser.subtitle')}
        />
        <NewsBrowser />
      </div>
    </section>
  )
}
