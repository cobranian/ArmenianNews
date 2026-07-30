// Âge d'un article, en toutes lettres courtes : « il y a 3 h », « 2 d ago »,
// « 5 րոպե առաջ », « 12 мин назад ».
//
// Cinquième module plat du dépôt, pour les deux raisons habituelles : il
// n'importe pas React (le lint passerait de 5 à 6 avertissements
// `react-refresh` si ces exports vivaient dans i18n.jsx — voir seo.js, site.js,
// worldPlace.js, hyDate.js), et il doit rester testable depuis Node.
//
// POURQUOI PAS `Intl.RelativeTimeFormat`. C'est exactement le piège documenté
// dans hyDate.js, sur une autre API : l'ICU de Chrome n'embarque pas les
// données arméniennes, donc `Intl.RelativeTimeFormat('hy')` ne *résout* pas et
// retombe sur la langue DU LECTEUR — un lecteur allemand verrait « vor 3
// Stunden » sur /hy/. L'ICU de Node, lui, est complet : aucun test côté Node ne
// verrait la panne, et `npm run prerender` cuirait dans la page la langue du
// Chrome de la CI. Utiliser Intl pour fr/en/ru et une table pour hy ferait
// dépendre le rendu du moteur ; les quatre langues sont donc écrites ici.
//
// POURQUOI DES UNITÉS ABRÉGÉES, ET RIEN AUTOUR. Pas de « il y a », pas de
// « ago », pas de « առաջ », pas de « назад » : sous une carte d'actualité, la
// position dit déjà que c'est un âge, et la tournure ne faisait que rallonger.
// L'abréviation, elle, évite en plus l'accord en nombre — qui n'est pas
// décoratif en russe : « 1 минуту / 2 минуты / 5 минут ». Reste « 45 min »,
// « 6 h », « 2 j » : une ligne de date de manchette, ce que la carte est déjà.

const UNITS = {
  fr: { s: 's', min: 'min', h: 'h', d: 'j' },
  en: { s: 's', min: 'min', h: 'h', d: 'd' },
  // ժամ (heure), րոպե (minute), վրկ (վայրկյան, seconde), օր (jour). Après un
  // numéral l'arménien garde le singulier : pas de forme plurielle à gérer.
  hy: { s: 'վրկ', min: 'րոպե', h: 'ժամ', d: 'օր' },
  ru: { s: 'с', min: 'мин', h: 'ч', d: 'дн' },
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Renvoie l'unité la plus grande qui reste ≥ 1, comme le ferait une manchette :
// on n'écrit pas « il y a 90 min » quand « il y a 1 h » suffit.
export function ageParts(seconds) {
  if (seconds < MINUTE) return { n: seconds, unit: 's' }
  if (seconds < HOUR) return { n: Math.floor(seconds / MINUTE), unit: 'min' }
  if (seconds < DAY) return { n: Math.floor(seconds / HOUR), unit: 'h' }
  return { n: Math.floor(seconds / DAY), unit: 'd' }
}

/* `iso` : la date de parution ; `now` : l'instant de référence (ms).
 *
 * Une date future est RAMENÉE à une seconde plutôt que rendue telle quelle.
 * Le cas n'est pas théorique : les sources datent dans leur propre fuseau et un
 * décalage d'horloge de quelques minutes suffit. « 1 s » est faux de peu ;
 * « dans 4 heures » sous une carte d'actualité est faux de beaucoup, et se lit
 * comme un bug. */
export function relativeAge(iso, now = Date.now(), lang = 'fr') {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const seconds = Math.max(1, Math.floor((now - t) / 1000))
  const { n, unit } = ageParts(seconds)
  const units = UNITS[lang] || UNITS.fr
  return `${n} ${units[unit]}`
}
