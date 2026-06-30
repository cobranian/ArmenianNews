import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import { loadScript } from '../hooks/useScript.js'
import ig from '../data/instagram.json'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Instagram() {
  const { t } = useI18n()
  const ref = useRef(null)

  // Flatten every curated permalink across accounts.
  const allPosts = useMemo(
    () =>
      ig.accounts.flatMap((acc) =>
        (acc.permalinks || []).map((url) => ({ url, handle: acc.handle })),
      ),
    [],
  )

  const [posts, setPosts] = useState(() => shuffle(allPosts).slice(0, 9))
  const reshuffle = () => setPosts(shuffle(allPosts).slice(0, 9))

  // Load embed.js and (re)process whenever the visible posts change.
  useEffect(() => {
    if (!posts.length) return
    let cancelled = false
    loadScript('https://www.instagram.com/embed.js', { id: 'instagram-embed' })
      .then(() => {
        if (cancelled) return
        if (window.instgrm?.Embeds) window.instgrm.Embeds.process()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [posts])

  return (
    <section className="section section--alt" id="instagram">
      <div className="container">
        <SectionHead eyebrow="Instagram" title={t('ig.title')} subtitle={t('ig.subtitle')} />

        {posts.length > 0 && (
          <>
            <div className="ig-toolbar reveal">
              <button className="btn-gold" onClick={reshuffle}>
                ✦ {t('ig.shuffle')}
              </button>
            </div>
            <div className="ig-grid" ref={ref}>
              {posts.map((p) => (
                <div className="ig-cell" key={p.url}>
                  <blockquote
                    className="instagram-media"
                    data-instgrm-permalink={p.url}
                    data-instgrm-version="14"
                    style={{ background: '#FFF', margin: 0, maxWidth: 326, width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Always show the account chips: the entry points + graceful fallback
            when an account has no curated permalinks yet. */}
        <div className="ig-accounts reveal">
          {ig.accounts.map((acc) => (
            <a
              key={acc.handle}
              className="ig-chip"
              href={acc.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('ig.visit')}
            >
              <span aria-hidden="true">◎</span> @{acc.handle}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
