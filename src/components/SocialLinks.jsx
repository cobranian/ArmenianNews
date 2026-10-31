import { socialFor } from '../../sites.config.js'
import { SITE_ID } from '../site.js'
import { useI18n } from '../i18n.jsx'

// Les comptes de la page (sites.config.js `socialFor` : ceux de la langue,
// puis ceux de la vitrine), au pied de page. Icônes tracées ici, en currentColor : ni police
// d'icônes ni requête vers les réseaux. Seul export du fichier : un composant, pour
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
  // Le papillon, réduit à 80 % : à pleine largeur il paraît plus gros que
  // les trois autres.
  bluesky: (
    <path
      fill="currentColor"
      transform="translate(2.4 2.4) scale(0.8)"
      d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"
    />
  ),
  telegram: (
    <path
      fill="currentColor"
      d="M21.9 4.3 18.6 19.8c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.2-8.3c.4-.4-.1-.6-.6-.2L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.5 2.9c.9-.3 1.7.2 1.4 1.4z"
    />
  ),
  // Le « in » seul, sans le carré : à côté des trois autres tracés nus, le
  // carré plein paraissait plus lourd.
  linkedin: (
    <path
      fill="currentColor"
      d="M6.9 19.5H3.6V9h3.3zM5.25 7.6a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8M20.4 19.5h-3.3v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.2h-3.3V9h3.2v1.4c.4-.8 1.5-1.7 3.1-1.7 3.3 0 4 2.2 4 5z"
    />
  ),
  // Le bouton de lecture seul, en creux dans un rectangle arrondi plein : la
  // forme qu'on reconnaît, sans le rouge de la marque (tout est currentColor).
  youtube: (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8M10 15V9l5.2 3z"
    />
  ),
}
const NAMES = { facebook: 'Facebook', instagram: 'Instagram', bluesky: 'Bluesky', telegram: 'Telegram', linkedin: 'LinkedIn', youtube: 'YouTube' }
export function SocialLinks({ className, size = 22 }) {
  const { lang } = useI18n()
  const accounts = Object.entries(socialFor(SITE_ID, lang))
  if (!accounts.length) return null
  return (
    <ul className={className}>
      {accounts.map(([platform, url]) => (
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
