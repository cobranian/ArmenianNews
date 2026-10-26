// Le bouton Instagram des barres de partage statiques (pages article Culture,
// scripts/lib/culture-pages.mjs). Instagram n'a pas d'adresse de partage web :
// on ouvre la feuille de partage du système (navigator.share, téléphones),
// sinon on copie le lien et on le dit. Fichier à part, pas un <script> en
// ligne : la CSP est en script-src 'self' (voir culture-keys.js).
document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('[data-share-url]')
  if (!btn) return
  var url = btn.getAttribute('data-share-url')
  var title = btn.getAttribute('data-share-title') || ''
  if (navigator.share) {
    // Une annulation du lecteur rejette la promesse : rien à signaler.
    navigator.share({ title: title, url: url }).catch(function () {})
    return
  }
  var msg = btn.closest('.share') && btn.closest('.share').querySelector('.share__msg')
  var say = function () {
    if (!msg) return
    msg.textContent = btn.getAttribute('data-share-copied') || ''
    clearTimeout(msg._t)
    msg._t = setTimeout(function () { msg.textContent = '' }, 4000)
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(say, function () {})
  }
})
