// Généré par scripts/jeux-sync.mjs (npm run jeux:sync) — ne pas éditer.
// Le bouton de retour des jeux vers la vue Jeux d'Arménie Info / Armenia News.
(function () {
  'use strict';
  var TABLE = {"fr":{"host":"https://armenieinfo.ch","path":"/jeux/","label":"Retour à Arménie Info"},"de":{"host":"https://armenieinfo.ch","path":"/de/spiele/","label":"Zurück zu Arménie Info"},"it":{"host":"https://armenieinfo.ch","path":"/it/giochi/","label":"Torna ad Arménie Info"},"en":{"host":"https://armenianews.org","path":"/games/","label":"Back to Armenia News"},"es":{"host":"https://armenianews.org","path":"/es/juegos/","label":"Volver a Armenia News"},"hy":{"host":"https://armenianews.org","path":"/hy/games/","label":"Վերադառնալ Արմենիա Ինֆո"},"ru":{"host":"https://armenianews.org","path":"/ru/games/","label":"Вернуться на Armenia News"}};
  var retourLangue = function retourLangue(table, o) {
  var h = String(o.hostname || '').toLowerCase().replace(/^www\./, '')
  var l = String(o.lang || '').toLowerCase().split('-')[0]
  if (Object.prototype.hasOwnProperty.call(table, l)) return l
  var langs = Object.keys(table)
  for (var i = 0; i < langs.length; i++) {
    if (table[langs[i]].host.replace(/^https?:\/\//, '').toLowerCase() === h) return langs[i]
  }
  return langs[0]
};
  var retourCible = function retourCible(table, o) {
  var l = retourLangue(table, o)
  var e = table[l]
  var h = String(o.hostname || '').toLowerCase().replace(/^www\./, '')
  var local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
  if (local || e.host.replace(/^https?:\/\//, '').toLowerCase() === h) return e.path
  return e.host + e.path
};

  var COINS = [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']];
  var OBSTACLE = 'button, a[href], input, select, textarea, label, [role=button], [role=timer], [role=img], [tabindex], svg, img, canvas';

  // Le premier élément sous (x, y), hors du bouton, est-il une chose du jeu ?
  // Un conteneur sans texte propre (body, main, section, fond d'écran) est du vide.
  function occupe(a, x, y) {
    var pile = document.elementsFromPoint(x, y);
    for (var i = 0; i < pile.length; i++) {
      var e = pile[i];
      if (e === a || a.contains(e)) continue;
      if (e.closest(OBSTACLE)) return true;
      for (var n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) return true;
      }
      return false;
    }
    return false;
  }

  function libre(a) {
    var r = a.getBoundingClientRect();
    var xs = [r.left + 4, r.left + r.width / 2, r.right - 4];
    var ys = [r.top + 4, r.top + r.height / 2, r.bottom - 4];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) if (occupe(a, xs[i], ys[j])) return false;
    return true;
  }

  function placer(a, coin) {
    var s = a.style;
    s.top = s.bottom = s.left = s.right = 'auto';
    s[coin[0]] = 'env(safe-area-inset-' + coin[0] + ', 0px)';
    s[coin[1]] = 'env(safe-area-inset-' + coin[1] + ', 0px)';
  }

  function choisir(a) {
    for (var i = 0; i < COINS.length; i++) {
      placer(a, COINS[i]);
      if (libre(a)) return;
    }
    placer(a, COINS[0]);
  }

  function poser() {
    if (document.getElementById('retour-vitrine')) return;
    var o = { lang: document.documentElement.lang, hostname: location.hostname };
    var a = document.createElement('a');
    a.id = 'retour-vitrine';
    a.href = retourCible(TABLE, o);
    a.setAttribute('aria-label', TABLE[retourLangue(TABLE, o)].label);
    a.title = TABLE[retourLangue(TABLE, o)].label;
    a.textContent = '\u2190';
    var s = a.style;
    s.position = 'fixed';
    s.zIndex = '2147483000';
    s.width = '44px';
    s.height = '44px';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.boxSizing = 'border-box';
    s.borderRadius = '50%';
    s.background = 'rgba(20, 14, 10, 0.55)';
    s.color = '#fff';
    s.font = '22px/1 system-ui, sans-serif';
    s.textDecoration = 'none';
    s.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.35)';
    document.body.appendChild(a);
    choisir(a);

    var minuteur = null;
    function plusTard() {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { choisir(a); }, 150);
    }
    window.addEventListener('resize', plusTard);
    if (window.MutationObserver) {
      new MutationObserver(plusTard).observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
