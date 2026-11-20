// L'identifiant visé par l'ancre de l'adresse (`#instagram` → « instagram »),
// décodé. Module plat, comme seo.js ou site.js : un export non-composant dans
// i18n.jsx ferait monter le lint d'un avertissement react-refresh.
//
// Pourquoi une fonction pour une ligne : decodeURIComponent LÈVE sur une
// séquence invalide (`#%`, `#%E9`). Appelé tel quel dans un useEffect, il
// faisait démonter toute la racine par React 18 — page blanche pour une
// simple ancre mal tapée ou un lien tronqué. Une ancre indécodable ne vise
// rien : elle rend la chaîne vide, que les trois appelants (App.jsx,
// SocialSection.jsx, Social.jsx) traitent déjà comme « pas d'ancre ».
export function hashId(hash) {
  const brut = typeof hash === 'string' ? hash.replace(/^#/, '') : ''
  try {
    return decodeURIComponent(brut)
  } catch {
    return ''
  }
}
