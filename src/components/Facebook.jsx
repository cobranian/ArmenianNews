import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { loadScript } from '../hooks/useScript.js'
import fb from '../data/facebook.json'

const FB_LOCALE = { fr: 'fr_FR', en: 'en_US', hy: 'hy_AM' }

export function Facebook() {
  const { t, lang } = useI18n()
  const ref = useRef(null)
  const [width, setWidth] = useState(500)

  // Responsive width for the plugin (max 500, Page Plugin's cap).
  useEffect(() => {
    const measure = () => {
      const w = ref.current?.offsetWidth || 500
      setWidth(Math.min(500, Math.max(320, w)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Load the SDK for the active locale and (re)parse XFBML.
  useEffect(() => {
    let cancelled = false
    const locale = FB_LOCALE[lang] || 'fr_FR'
    loadScript(`https://connect.facebook.net/${locale}/sdk.js#xfbml=1&version=v19.0`, {
      id: 'facebook-jssdk',
    })
      .then(() => {
        if (cancelled) return
        if (window.FB?.XFBML) window.FB.XFBML.parse(ref.current)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lang, width])

  return (
    <section className="section" id="facebook">
      <div className="container">
        <SectionHead eyebrow="Facebook" title={t('fb.title')} subtitle={t('fb.subtitle')} />
        <div id="fb-root" />
        <div className="fb-wrap reveal" ref={ref}>
          <div
            className="fb-page"
            data-href={fb.url}
            data-tabs={fb.tabs || 'timeline'}
            data-width={width}
            data-height="720"
            data-small-header="false"
            data-adapt-container-width="true"
            data-hide-cover="false"
            data-show-facepile="true"
            key={`${lang}-${width}`}
          >
            <blockquote cite={fb.url} className="fb-xfbml-parse-ignore">
              <a href={fb.url} target="_blank" rel="noopener noreferrer">
                {t('fb.fallback')}
              </a>
            </blockquote>
          </div>
        </div>
        <p className="fb-fallback">
          <a href={fb.url} target="_blank" rel="noopener noreferrer">
            {t('fb.fallback')} →
          </a>
        </p>
      </div>
    </section>
  )
}
