// Cloudflare Web Analytics — chargeur du beacon, avec l'interrupteur
// « mes propres visites » (voir ga-init.js, qui porte le même).
//
// Pourquoi un chargeur plutôt que la balise officielle posée en dur : Cloudflare
// Web Analytics n'a AUCUN filtre (ni IP, ni cookie) pour écarter des visites —
// une visite chargée est une visite comptée. Le seul moyen de ne pas compter un
// navigateur est de ne pas y charger le beacon, donc de décider côté client.
//
// Le jeton arrive par l'attribut `data-cf-beacon` de la balise qui charge ce
// script (posée par scripts/lib/site-meta.mjs depuis `cfBeaconToken`), et il
// est recopié tel quel sur la balise du beacon, qui le relit de la sienne.
// Script CLASSIQUE et SYNCHRONE : `document.currentScript` n'est défini que là.
var BALISE_CF = document.currentScript
var CONFIG_CF = BALISE_CF ? BALISE_CF.getAttribute('data-cf-beacon') : null

// `?mesure=non` écarte ce navigateur, `?mesure=oui` le réintègre. Mémorisé
// dans localStorage, donc PAR DOMAINE et PAR NAVIGATEUR. try/catch : en
// navigation privée stricte, localStorage peut lever — on mesure alors.
function sansMesure() {
  try {
    var q = new URLSearchParams(location.search).get('mesure')
    if (q === 'non') localStorage.setItem('sans-mesure', '1')
    else if (q === 'oui') localStorage.removeItem('sans-mesure')
    return localStorage.getItem('sans-mesure') === '1'
  } catch {
    return false
  }
}

if (CONFIG_CF && !sansMesure()) {
  var beacon = document.createElement('script')
  beacon.defer = true
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  beacon.setAttribute('data-cf-beacon', CONFIG_CF)
  document.body.appendChild(beacon)
}
