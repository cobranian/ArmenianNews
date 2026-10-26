import { SITES } from '../../sites.config.js'
import { SITE_ID } from '../site.js'

// Les comptes de la vitrine bâtie (sites.config.js `social`), dans la barre
// du haut ET au pied de page. Icônes tracées ici, en currentColor : ni police
// d'icônes ni requête vers Meta. Seul export du fichier : un composant, pour
// ne pas ajouter d'avertissement react-refresh (voir CLAUDE.md, Lint).
const ICONS = {
  facebook: (
    <path
      fill="currentColor"
      d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z"
    />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),
}
const NAMES = { facebook: 'Facebook', instagram: 'Instagram' }
const ACCOUNTS = Object.entries(SITES[SITE_ID]?.social ?? {})

export function SocialLinks({ className, size = 22 }) {
  if (!ACCOUNTS.length) return null
  return (
    <ul className={className}>
      {ACCOUNTS.map(([platform, url]) => (
        <li key={platform}>
          <a href={url} rel="noopener noreferrer" aria-label={NAMES[platform]} title={NAMES[platform]}>
            <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
              {ICONS[platform]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  )
}
