// Généré par scripts/jeux-sync.mjs (npm run jeux:sync) — ne pas éditer.
// Le bouton de retour des jeux vers la vue Jeux d'Arménie Info / Armenia News.
(function () {
  'use strict';
  var TABLE = {"fr":{"host":"https://armenieinfo.ch","path":"/jeux/","label":"Retour à Arménie Info","plein":"Plein écran","quitter":"Quitter le plein écran"},"de":{"host":"https://armenieinfo.ch","path":"/de/spiele/","label":"Zurück zu Arménie Info","plein":"Vollbild","quitter":"Vollbild verlassen"},"it":{"host":"https://armenieinfo.ch","path":"/it/giochi/","label":"Torna ad Arménie Info","plein":"Schermo intero","quitter":"Esci dallo schermo intero"},"en":{"host":"https://armenianews.org","path":"/games/","label":"Back to Armenia News","plein":"Fullscreen","quitter":"Exit fullscreen"},"es":{"host":"https://armenianews.org","path":"/es/juegos/","label":"Volver a Armenia News","plein":"Pantalla completa","quitter":"Salir de pantalla completa"},"hy":{"host":"https://armenianews.org","path":"/hy/games/","label":"Վերադառնալ Արմենիա Ինֆո","plein":"Ամբողջ էկրան","quitter":"Դուրս գալ ամբողջ էկրանի ռեժիմից"},"ru":{"host":"https://armenianews.org","path":"/ru/games/","label":"Вернуться на Armenia News","plein":"Полный экран","quitter":"Выйти из полноэкранного режима"}};
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

  // Un rond de 44 px, commun au lien de retour et au bouton plein écran.
  function rond(el) {
    var s = el.style;
    s.width = '44px';
    s.height = '44px';
    s.flex = 'none';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.boxSizing = 'border-box';
    s.margin = '0';
    s.padding = '0';
    s.border = '0';
    s.borderRadius = '50%';
    s.background = 'rgba(20, 14, 10, 0.55)';
    s.color = '#fff';
    s.font = '22px/1 system-ui, sans-serif';
    s.textDecoration = 'none';
    s.cursor = 'pointer';
    s.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.35)';
  }

  // Les quatre coins d'un cadre, tournés vers l'extérieur (entrer) ou vers
  // l'intérieur (quitter). Construits nœud par nœud, sans HTML en texte.
  var SVG = 'http://www.w3.org/2000/svg';
  var COINS_DEHORS = 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5';
  var COINS_DEDANS = 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5';
  function icone() {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(SVG, 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2.2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    return { svg: svg, chemin: p };
  }

  // Le plein écran, comme le bouton de lokolok — mais ici le jeu EST la page,
  // donc c'est la page entière qui passe en plein écran. Absent de l'iPhone
  // (WebKit n'y met en plein écran que les <video>) : le bouton n'y est pas
  // posé, plutôt que de ne rien faire au toucher.
  var racine = document.documentElement;
  var demander = racine.requestFullscreen || racine.webkitRequestFullscreen;
  var sortir = document.exitFullscreen || document.webkitExitFullscreen;
  var PERMIS = !!(demander && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  var CHANGEMENT = 'onfullscreenchange' in document ? 'fullscreenchange' : 'webkitfullscreenchange';
  function elementPlein() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function entrer() {
    // Une exception synchrone ou un refus (geste manquant) : rien à faire.
    try {
      var p = demander.call(racine, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* refusé */ }
  }

  function poser() {
    if (document.getElementById('retour-vitrine')) return;
    var o = { lang: document.documentElement.lang, hostname: location.hostname };
    var T = TABLE[retourLangue(TABLE, o)];

    // Le groupe se place d'un bloc dans un coin : choisir() mesure le groupe.
    var boite = document.createElement('div');
    boite.id = 'retour-vitrine';
    var b = boite.style;
    b.position = 'fixed';
    b.zIndex = '2147483000';
    b.display = 'flex';
    b.gap = '8px';

    var a = document.createElement('a');
    a.href = retourCible(TABLE, o);
    a.setAttribute('aria-label', T.label);
    a.title = T.label;
    a.textContent = '\u2190';
    rond(a);
    boite.appendChild(a);

    var plein = null, dessin = null;
    function majBouton() {
      var actif = !!elementPlein();
      var nom = actif ? T.quitter : T.plein;
      plein.setAttribute('aria-label', nom);
      plein.setAttribute('aria-pressed', actif ? 'true' : 'false');
      plein.title = nom;
      dessin.chemin.setAttribute('d', actif ? COINS_DEDANS : COINS_DEHORS);
    }
    if (PERMIS) {
      plein = document.createElement('button');
      plein.type = 'button';
      plein.id = 'plein-ecran';
      rond(plein);
      dessin = icone();
      plein.appendChild(dessin.svg);
      majBouton();
      plein.addEventListener('click', function () {
        if (elementPlein()) { if (sortir) sortir.call(document); } else entrer();
      });
      boite.appendChild(plein);
    }

    document.body.appendChild(boite);
    choisir(boite);

    // Un écran qui s'ouvre, un bouton du jeu qui apparaît (attribut hidden) :
    // choisir() ne déplace le bouton que si son coin est désormais occupé.
    // Écran tourné : tout est remesuré, mais le coin actuel resté libre gagne.
    var minuteur = null;
    function plusTard() {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () { choisir(boite); }, 150);
    }
    window.addEventListener('resize', plusTard);
    if (window.MutationObserver) {
      new MutationObserver(plusTard).observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    }

    if (!PERMIS) return;
    // Sur un téléphone, le premier bouton touché dans le jeu (« Contre le
    // robot », « Jouer »…) fait passer en plein écran : c'est le geste que
    // l'API exige. Une fois que le joueur en est SORTI lui-même (geste retour,
    // bouton), on ne l'y remet plus d'office : seul le bouton l'y ramène.
    var tactile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var sorti = false, etait = false;
    document.addEventListener('click', function (e) {
      if (!tactile || sorti || elementPlein()) return;
      var t = e.target;
      if (!t || !t.closest || !t.closest('button') || boite.contains(t)) return;
      entrer();
    }, true);
    document.addEventListener(CHANGEMENT, function () {
      var actif = !!elementPlein();
      if (etait && !actif) sorti = true;
      etait = actif;
      majBouton();
      plusTard();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
