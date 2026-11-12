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
  var choisirCoin = function choisirCoin(occupations, actuel) {
  if (actuel >= 0 && occupations[actuel] === 0) return actuel
  var meilleur = 0
  for (var i = 0; i < occupations.length; i++) {
    if (occupations[i] === 0) return i
    if (occupations[i] < occupations[meilleur]) meilleur = i
  }
  return meilleur
};

  var COINS = [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']];
  var COMMANDE = 'button, a[href], input, select, textarea, label, [role=button], [tabindex]:not([tabindex="-1"])';
  var DESSIN = '[role=timer], [role=img], [tabindex], svg, img, canvas';
  var actuel = -1;
  // Le bouton se tient à RETRAIT px du bord (en plus de l'encoche) : collé au
  // coin, l'arrondi de l'écran du téléphone le rognait (captures du 12 nov.
  // 2026). Et un coin n'est libre que si rien ne vient à MARGE px du bouton :
  // le score du backgammon debout le touchait sans être sous un point d'essai.
  var RETRAIT = 8, MARGE = 6;

  // Ce qu'il y a sous (x, y), hors du bouton : 3 pour une commande, 1 pour un
  // texte ou un dessin du jeu, 0 pour du vide (un conteneur sans texte propre :
  // body, main, section, fond d'écran).
  function poids(a, x, y) {
    var pile = document.elementsFromPoint(x, y);
    for (var i = 0; i < pile.length; i++) {
      var e = pile[i];
      if (e === a || a.contains(e)) continue;
      if (e.closest(COMMANDE)) return 3;
      if (e.closest(DESSIN)) return 1;
      for (var n = e.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) return 1;
      }
      return 0;
    }
    return 0;
  }

  function occupation(a) {
    var r = a.getBoundingClientRect();
    // 5 × 5 points, espacés de 14 px : une grille de 3 × 3 (22 px) laissait
    // passer entre deux rangées le score d'une ligne du backgammon couché
    // (19 px de haut, italien, 640 × 300).
    var total = 0;
    for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) {
      var x = r.left - MARGE + i * (r.width + 2 * MARGE) / 4;
      var y = r.top - MARGE + j * (r.height + 2 * MARGE) / 4;
      total += poids(a, x, y);
    }
    return total;
  }

  function placer(a, i) {
    var s = a.style, coin = COINS[i];
    s.top = s.bottom = s.left = s.right = 'auto';
    s[coin[0]] = 'calc(env(safe-area-inset-' + coin[0] + ', 0px) + ' + RETRAIT + 'px)';
    s[coin[1]] = 'calc(env(safe-area-inset-' + coin[1] + ', 0px) + ' + RETRAIT + 'px)';
  }

  // Le coin actuel encore libre ne se remesure même pas ailleurs : le bouton
  // ne bouge que si quelque chose du jeu vient sous lui, ou si l'écran tourne.
  // Les essais sont synchrones : aucun rendu n'a lieu entre deux placements.
  function choisir(a) {
    if (actuel >= 0 && occupation(a) === 0) return;
    var occ = [];
    for (var i = 0; i < COINS.length; i++) {
      placer(a, i);
      occ.push(occupation(a));
    }
    actuel = choisirCoin(occ, actuel);
    placer(a, actuel);
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

    // Un écran qui s'ouvre, un bouton du jeu qui apparaît (attribut hidden) :
    // choisir() ne déplace le bouton que si son coin est désormais occupé.
    // Écran tourné : tout est remesuré, mais le coin actuel resté libre gagne.
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
