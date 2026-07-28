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
// L'ID de mesure GA4 (G-EB3W5XXSMW, propriété « Arménie Info ») doit rester
// identique ici ET dans l'URL gtag.js d'index.html.

// Codes ISO 3166-1 alpha-2. Les 27 de l'UE, plus l'Islande, le Liechtenstein
// et la Norvège (EEE), plus le Royaume-Uni (UK GDPR, post-Brexit).
// Google n'accepte pas de groupement type 'EU' : il faut énumérer.
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
gtag('config', 'G-EB3W5XXSMW')
