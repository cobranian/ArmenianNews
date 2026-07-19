// Google Analytics 4 — bootstrap avec Consent Mode v2.
//
// Externe (et non « inline »), comme theme-init.js, pour que la
// Content-Security-Policy reste en script-src 'self' sans autoriser les
// scripts inline (voir firebase.json). Le script gtag.js (googletagmanager.com)
// et les domaines de collecte (google-analytics.com) y sont autorisés.
//
// Le consentement est REFUSÉ par défaut : GA fonctionne alors sans cookie
// (mesure « pinguée » anonyme), donc RGPD-friendly et sans bannière — dans la
// même logique que l'analytics Cloudflare sans cookie déjà en place. Si un jour
// une bannière de consentement est ajoutée, elle n'aura qu'à appeler
// gtag('consent', 'update', { analytics_storage: 'granted' }).
//
// L'ID de mesure GA4 (G-EB3W5XXSMW, propriété « Arménie Info ») doit rester
// identique ici ET dans l'URL gtag.js d'index.html.
window.dataLayer = window.dataLayer || []
function gtag() {
  window.dataLayer.push(arguments)
}
window.gtag = gtag

// Doit être poussé AVANT que gtag.js ne traite la file d'attente.
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
})

gtag('js', new Date())
gtag('config', 'G-EB3W5XXSMW')
