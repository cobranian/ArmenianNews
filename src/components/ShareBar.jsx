import { useEffect, useRef, useState } from 'react'
import { SHARE_NETWORKS, SHARE_NAMES, SHARE_ICONS, SHARE_STRINGS, shareHref } from '../share.js'

// La barre de partage côté React (visionneuse de l'agenda). Même balisage et
// mêmes classes que celle des pages Culture (scripts/lib/culture-pages.mjs),
// donc les mêmes styles. Seul export du fichier : un composant (react-refresh).
export function ShareBar({ lang, url, title }) {
  const s = SHARE_STRINGS[lang] ?? SHARE_STRINGS.en
  const [msg, setMsg] = useState('')
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  // Changer d'événement efface un « lien copié » qui ne le concerne plus.
  useEffect(() => setMsg(''), [url])

  const copy = () => {
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {})
      return
    }
    navigator.clipboard?.writeText(url).then(
      () => {
        setMsg(s.copied)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setMsg(''), 4000)
      },
      () => {},
    )
  }

  if (!url) return null
  return (
    <div className="share">
      <p className="share__label">{s.share}</p>
      <ul className="share__list">
        {SHARE_NETWORKS.map((n) => {
          const label = s.on(SHARE_NAMES[n])
          const href = shareHref(n, { url, title })
          const icon = (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d={SHARE_ICONS[n]} />
            </svg>
          )
          return href ? (
            <li key={n}>
              <a className="share__btn" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                {icon}
              </a>
            </li>
          ) : (
            <li key={n} className="share__copy">
              <button type="button" className="share__btn" onClick={copy} aria-label={label} title={label}>
                {icon}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="share__msg" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  )
}
