// La copie des jeux (npm run jeux:sync) — fonctions pures. Les entrées et
// sorties disque sont dans scripts/jeux-sync.mjs.
//
// Quatre transformations, et rien d'autre (spec 2026-11-11-onglet-jeux,
// « Ce qui change dans la copie ») :
//   1. /assets/net/ → /play/net/ (sous /assets/, ces fichiers sans empreinte
//      tomberaient sous le cache immutable d'un an du site) ;
//   2. la balise /assets/stats.js de lokolok est retirée ;
//   3. le script en ligne des échecs part dans js/appliquer.js (la CSP
//      `script-src 'self'` le bloquerait EN SILENCE : interface jamais traduite) ;
//   4. retour.js, le bouton de retour vers la vue Jeux, avant </body>.
// Un motif attendu absent LÈVE une erreur : une mise à jour de Games/ qui le
// déplacerait doit arrêter le sync, pas publier une copie cassée.
import { ALL_LANGS, SITES, pathFor, siteOf } from '../../sites.config.js'

// Fichiers de développement à ne jamais publier — la liste de
// lokolok/sync-games.js, recopiée telle quelle.
export const EXCLUS = [
  /\.exe$/i, /\.swf$/i, /^README\.md$/i, /^docs$/i, /^tests$/i, /^tools$/i,
  /^tests?\.html$/i, /^test\.[^/]+\.js$/i, /^aide-[^/]+\.js$/i, /^original\.html$/i,
  /^package(-lock)?\.json$/i, /^\.git/, /^node_modules$/,
]

export const RETOUR_SRC = '/play/retour.js'
export const APPLIQUER_JS = 'LokoI18n.appliquer();\n'

const STATS = /^[ \t]*<script src="\/assets\/stats\.js"><\/script>[ \t]*\r?\n/m
const APPLIQUER_EN_LIGNE = '<script>LokoI18n.appliquer();</script>'
const EN_LIGNE = /<script(?![^>]*\bsrc=)[^>]*>/

// Les fichiers qui DOIVENT importer la couche net : s'ils ne la visent plus,
// c'est que Games/ ou lokolok a changé de chemin, et le multijoueur se
// chargerait depuis une URL morte.
const doitViserNet = (chemin) => /^(echecs|backgammon)\/js\/main\.js$/.test(chemin) || chemin === 'net/salle.js'

function exiger(ok, chemin, quoi) {
  if (!ok) throw new Error(`jeux:sync — ${chemin} : ${quoi} introuvable. Games/ ou lokolok a changé ; adapter scripts/lib/jeux-sync.mjs.`)
}

// `chemin` est relatif à public/play/ (ex. 'echecs/index.html').
export function transformer(chemin, texte) {
  const c = chemin.replace(/\\/g, '/')
  if (!/\.(js|html)$/.test(c)) return texte
  let out = texte

  // 1. La couche net.
  if (doitViserNet(c)) exiger(out.includes('/assets/net/'), c, '« /assets/net/ »')
  out = out.split('/assets/net/').join('/play/net/')

  if (/(^|\/)index\.html$/.test(c)) {
    // 2. Les statistiques du portail lokolok.
    exiger(STATS.test(out), c, 'la balise <script src="/assets/stats.js">')
    out = out.replace(STATS, '')

    // 3. Le script en ligne des échecs, sorti à la même place.
    if (c === 'echecs/index.html') {
      exiger(out.includes(APPLIQUER_EN_LIGNE), c, `« ${APPLIQUER_EN_LIGNE} »`)
      out = out.replace(APPLIQUER_EN_LIGNE, '<script src="js/appliquer.js"></script>')
    }
    if (EN_LIGNE.test(out)) {
      throw new Error(`jeux:sync — ${c} : un script en ligne, que la CSP (script-src 'self') bloquerait en silence.`)
    }

    // 4. Le bouton de retour, juste avant </body>, indenté comme la ligne d'avant.
    const n = out.split('</body>').length - 1
    exiger(n === 1, c, 'un </body> unique')
    const fin = out.includes('\r\n') ? '\r\n' : '\n'
    const indent = out.match(/([ \t]*)<script[^\n]*\r?\n<\/body>/)?.[1] ?? '  '
    out = out.replace('</body>', `${indent}<script src="${RETOUR_SRC}" defer></script>${fin}</body>`)
  }
  return out
}

// Le nom du lien, lu par les lecteurs d'écran — dans la langue de la vitrine
// de retour, avec SA marque (l'arménien affiche « Արմենիա Ինֆո », comme
// STRINGS.hy['site.title']).
const LABELS = {
  fr: 'Retour à Arménie Info',
  de: 'Zurück zu Arménie Info',
  it: 'Torna ad Arménie Info',
  en: 'Back to Armenia News',
  es: 'Volver a Armenia News',
  hy: 'Վերադառնալ Արմենիա Ինֆո',
  ru: 'Вернуться на Armenia News',
}

// { [lang]: { host, path, label } }. L'ORDRE compte : pour chaque hôte, la
// première langue listée est sa langue de tête (SITES[id].pages[0]) — c'est
// elle que retourCible prend pour une langue hors des 7.
export function retourTable() {
  const out = {}
  for (const site of Object.values(SITES)) {
    for (const { lang } of site.pages) {
      out[lang] = { host: SITES[siteOf(lang)].host, path: pathFor(lang, 'games'), label: LABELS[lang] }
    }
  }
  for (const l of ALL_LANGS) if (!out[l]?.label) throw new Error(`retourTable : ${l} sans entrée ni libellé`)
  return out
}

// La langue de retour. Copiée dans retour.js par Function#toString : AUCUNE
// référence hors de ses paramètres, et une syntaxe que tout navigateur lit.
export function retourLangue(table, o) {
  var h = String(o.hostname || '').toLowerCase().replace(/^www\./, '')
  var l = String(o.lang || '').toLowerCase().split('-')[0]
  if (Object.prototype.hasOwnProperty.call(table, l)) return l
  var langs = Object.keys(table)
  for (var i = 0; i < langs.length; i++) {
    if (table[langs[i]].host.replace(/^https?:\/\//, '').toLowerCase() === h) return langs[i]
  }
  return langs[0]
}

// L'URL de retour : un chemin sur la vitrine de cette langue ou en local
// (préversion), sinon une URL absolue — un `fr` ouvert sur armenianews.org
// renvoie vers armenieinfo.ch/jeux/, jamais vers un /jeux/ qui y ferait 404.
export function retourCible(table, o) {
  var l = retourLangue(table, o)
  var e = table[l]
  var h = String(o.hostname || '').toLowerCase().replace(/^www\./, '')
  var local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
  if (local || e.host.replace(/^https?:\/\//, '').toLowerCase() === h) return e.path
  return e.host + e.path
}

// Le source de public/play/retour.js. Script classique (CSP script-src 'self',
// chargé en `defer`) : textContent et style posés depuis le JS, jamais
// d'innerHTML. Il lit <html lang> APRÈS le chargement, car c'est le jeu qui
// le pose (?lang=, puis la langue retenue, puis le navigateur).
//
// Le coin haut-gauche d'abord. Mais le backgammon en paysage (640 × 360) n'y
// laisse aucun vide : le plateau touche le bord, et le bouton couvrait la
// flèche du point 13 (mesuré le 11 nov. 2026). Le script mesure donc
// l'occupation de chaque coin (25 points d'essai : 3 par commande touchée,
// 1 par texte ou dessin) et choisit par choisirCoin ci-dessous.

// Le coin du bouton, parmi les quatre (haut-gauche, haut-droit, bas-gauche,
// bas-droit). `occupations[i]` : occupation mesurée du coin i, 0 = libre.
// `actuel` : le coin où il est déjà (-1 au premier placement).
//   - le coin actuel encore libre est GARDÉ : le bouton ne saute pas d'un coin
//     à l'autre pendant un tour, quand Lancer/Valider/Annuler apparaissent ;
//   - sinon le premier coin libre ;
//   - sinon le MOINS occupé (à égalité, le premier) — jamais haut-gauche
//     d'office, qui est justement le coin couvert en paysage.
// Copiée dans retour.js par Function#toString, comme retourCible.
export function choisirCoin(occupations, actuel) {
  if (actuel >= 0 && occupations[actuel] === 0) return actuel
  var meilleur = 0
  for (var i = 0; i < occupations.length; i++) {
    if (occupations[i] === 0) return i
    if (occupations[i] < occupations[meilleur]) meilleur = i
  }
  return meilleur
}

export function retourJs(table) {
  return `// Généré par scripts/jeux-sync.mjs (npm run jeux:sync) — ne pas éditer.
// Le bouton de retour des jeux vers la vue Jeux d'Arménie Info / Armenia News.
(function () {
  'use strict';
  var TABLE = ${JSON.stringify(table)};
  var retourLangue = ${retourLangue.toString()};
  var retourCible = ${retourCible.toString()};
  var choisirCoin = ${choisirCoin.toString()};

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
    a.textContent = '\\u2190';
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
`
}
