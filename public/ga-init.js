// Google Analytics 4 — bootstrap avec Consent Mode v2.
//
// Externe (et non « inline »), comme theme-init.js, pour que la
// Content-Security-Policy reste en script-src 'self' sans autoriser les
// scripts inline (voir firebase.json). Le script gtag.js (googletagmanager.com)
// et les domaines de collecte (google-analytics.com) y sont autorisés.
//
// CONSENTEMENT PAR RÉGION. Le stockage analytique est accordé par défaut —
// donc cookies, donc visiteurs récurrents identifiés — SAUF dans l'EEE et au
// Royaume-Uni, où le RGPD exige un accord préalable pour tout cookie non
// essentiel. Là, le refus reste la valeur par défaut et GA retombe sur sa
// mesure « pinguée » anonyme, sans cookie.
//
// Pourquoi ce découpage plutôt qu'une bannière : le lectorat est très
// majoritairement hors UE (Arménie, Russie, diaspora nord-américaine, Suisse),
// et une bannière coûterait du chrome visuel dans quatre langues pour un taux
// d'acceptation qui plafonne. Le découpage régional donne la mesure complète
// là où elle est licite, sans rien demander à personne.
//
// LA SUISSE N'EST PAS DANS LA LISTE, délibérément. La nLPD révisée (en vigueur
// depuis septembre 2023) repose sur l'information et le droit d'opposition, pas
// sur le consentement préalable du RGPD : les cookies analytiques y sont
// licites moyennant mention dans la politique de confidentialité. L'y inclure
// priverait de cookies le lectorat principal d'armenieinfo.ch pour satisfaire
// une règle qui n'existe pas. Pour choisir malgré tout la prudence, ajouter
// 'CH' à REGIONS_CONSENTEMENT_REQUIS ci-dessous — c'est le seul geste à faire.
//
// La publicité reste refusée PARTOUT (ad_storage, ad_user_data,
// ad_personalization) : le site n'affiche aucune publicité, donc rien ne
// justifierait de collecter ces signaux.
//
// L'ID DE MESURE N'EST PAS ÉCRIT ICI, et c'est le fond de l'affaire : ce
// fichier vit dans public/, que Vite copie À L'IDENTIQUE dans les deux dist/.
// Un ID en dur y serait forcément celui d'une seule vitrine, et l'autre
// verserait ses visites dans la mauvaise propriété — c'est ce qui se passait,
// armenianews.org (/hy/ et /ru/ compris) tombant dans la propriété du .ch.
//
// Il arrive donc par l'attribut `data-ga-id` de la balise qui charge ce script,
// posée au build par scripts/lib/site-meta.mjs depuis `gaMeasurementId`
// (sites.config.js). Un attribut, et pas un `<script>` en ligne qui déclarerait
// une variable : la CSP est en `script-src 'self'` sans `'unsafe-inline'`.

// Codes ISO 3166-1 alpha-2. Les 27 de l'UE, plus l'Islande, le Liechtenstein
// et la Norvège (EEE), plus le Royaume-Uni (UK GDPR, post-Brexit).
// Google n'accepte pas de groupement type 'EU' : il faut énumérer.
// `document.currentScript` désigne la balise en cours d'exécution — elle n'est
// définie que pour un script CLASSIQUE et SYNCHRONE, ce que celui-ci est
// (`<script src="/ga-init.js" data-ga-id="…">`, sans `async` ni `defer`, sans
// `type="module"`). Le lire ici, au premier tour, et pas dans un callback : la
// propriété redevient `null` dès que le script rend la main.
var BALISE = document.currentScript
var GA_ID = BALISE ? BALISE.getAttribute('data-ga-id') : null

var REGIONS_CONSENTEMENT_REQUIS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB',
]

window.dataLayer = window.dataLayer || []
function gtag() {
  window.dataLayer.push(arguments)
}
window.gtag = gtag

// Doit être poussé AVANT que gtag.js ne traite la file d'attente.
//
// L'ordre compte : la règle RÉGIONALE d'abord, la règle globale ensuite. Une
// valeur par défaut portant `region` l'emporte sur celle qui n'en porte pas,
// et c'est l'ordre que documente Google. Inverser les deux blocs marcherait
// aussi, mais s'écarterait de l'exemple de référence sans raison.
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  region: REGIONS_CONSENTEMENT_REQUIS,
})

gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
})

gtag('js', new Date())

// Sans ID, on s'arrête là. Les défauts de consentement ci-dessus restent posés
// (ils ne coûtent rien et ne mesurent rien), mais aucune propriété n'est
// configurée — plutôt que d'en deviner une. Le cas n'arrive que si
// `gaMeasurementId` est `null` pour cette vitrine, ou si la balise a été
// recopiée à la main sans son attribut : le message pointe alors l'endroit
// exact, au lieu de laisser un mur de statistiques vide sans explication.
if (GA_ID) {
  gtag('config', GA_ID)
} else {
  console.warn('[ga-init] data-ga-id absent — aucune mesure GA4 (voir gaMeasurementId dans sites.config.js)')
}
