// Titre de la chanson en cours, côté site. Module plat (sans React) : les tests
// Node l'importent. Le Worker (proxy/now-playing-worker.js) rend le texte brut
// du flux ; c'est ici qu'on décide s'il s'agit vraiment d'une chanson.

export const NOW_PLAYING_URL = 'https://radio-now-playing.cobranian.workers.dev/'
export const POLL_MS = 20000

const plier = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '')

// Une date complète (« 24 HOKTEMBER 2026 ») signe un créneau d'émission, pas un
// morceau : c'est ce que la Radio publique met dans son titre. La règle ne vaut
// QUE pour elle : ailleurs, « Live 12 September 1999 » est une vraie chanson.
export const TITRE_EST_UN_CRENEAU = new Set(['public'])
const DATE_EMISSION = /\b\d{1,2}\s+\p{L}{3,}\s+(19|20)\d{2}\b/u
const VIDE = /^(unknown|untitled|inconnu|n\/a|-+|\.+)$/i

// → { artist, title } ou null quand il n'y a rien à afficher.
export function songFrom(raw, { stationId = '', stationName = '', icyName = '' } = {}) {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text || VIDE.test(text)) return null
  const p = plier(text)
  if (!p) return null
  // Le nom de la station à la place d'un titre (Mariam, Yeraz) : rien.
  if (p === plier(stationName) || p === plier(icyName)) return null
  if (TITRE_EST_UN_CRENEAU.has(stationId) && DATE_EMISSION.test(text)) return null
  if (/^(https?:\/\/|www\.)/i.test(text)) return null

  const i = text.indexOf(' - ')
  if (i > 0 && i < text.length - 3) {
    return { artist: text.slice(0, i).trim(), title: text.slice(i + 3).trim() }
  }
  return { artist: '', title: text }
}
