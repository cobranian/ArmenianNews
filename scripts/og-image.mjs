/**
 * Génère la carte de partage (og:image) d'une vitrine.
 *
 *   npm run og-image            # la vitrine .org (Armenia News, anglais)
 *   npm run og-image -- ch org  # les deux
 *
 * Écrit `public/<fichier>` où le fichier vient de `SITES[id].ogImage` — la
 * même valeur que `scripts/lib/site-meta.mjs` met dans la balise `og:image`.
 * Une seule source décide donc du nom du fichier ET de l'URL annoncée : elles
 * ne peuvent pas diverger.
 *
 * ÉTAPE MANUELLE, PAS HORAIRE. La carte ne change que si la marque change, et
 * le rendu a besoin des Google Fonts (réseau) plus d'un Chrome local. La CI ne
 * la régénère jamais : elle sert le fichier versionné.
 *
 * TROIS CONTRAINTES QUI NE SE VOIENT PAS À L'ŒIL, et que ce script tient :
 *
 * 1. **Exactement 1200×630, sRGB, sans profil ICC** — sinon WhatsApp n'affiche
 *    aucun aperçu (il refuse en silence, l'image reste joignable en 200).
 *    D'où `deviceScaleFactor: 1` (un facteur 2 produirait un 2400×1260 qui
 *    mentirait aux balises `og:image:width/height`) et
 *    `--force-color-profile=srgb`, déjà le motif de `scripts/shoot.mjs`.
 *
 *    **Mais `--force-color-profile=srgb` ne suffit PAS** : Chrome écrit quand
 *    même un profil ICC sRGB dans un segment APP2, et c'est mesuré, pas
 *    supposé. La carte française — celle dont l'aperçu WhatsApp fonctionne —
 *    n'en porte aucun. D'où `stripIcc()` ci-dessous, sans quoi chaque
 *    régénération réintroduirait la panne que documente le README, et se
 *    verrait seulement en partageant le lien sur un téléphone.
 *
 * 2. **Le texte vient du dépôt, jamais d'une traduction improvisée** : la
 *    marque de `sites.config.js`, la baseline des dictionnaires `i18n`. Une
 *    carte de partage qui contredit le `<title>` de la page est un signal
 *    incohérent pour Google comme pour un lecteur.
 *
 * 3. **On attend `document.fonts.ready`.** Sans cela, Chrome capture parfois
 *    la page avec les polices de secours : le rendu part en Times, personne ne
 *    voit d'erreur, et le fichier est écrit quand même.
 *
 * 4. **Ce script rend MOINS que la carte qu'il remplace, et ça s'est vu.** Le
 *    .ch n'était pas né d'ici : sa carte portait, sous le titre latin, la
 *    marque en écriture arménienne, que le gabarit ignorait. La première
 *    régénération l'a donc effacée — un fichier valide, aux bonnes dimensions,
 *    simplement amputé d'une ligne, ce qu'aucun contrôle ne mesure. D'où
 *    `subbrand` dans CARDS. Avant de régénérer, COMPAREZ à l'ancienne image :
 *    ce script ne sait rendre que ce qu'on lui a appris.
 *
 * Les deux cartes sont désormais produites ici (le .ch depuis le 1er août
 * 2026, pour suivre le miroir de l'Ararat). Régénérer reste une opération à ne
 * pas faire à la légère : l'URL d'une carte est en cache plusieurs jours chez
 * Facebook et WhatsApp, donc le nouvel aperçu ne remplace pas l'ancien tout de
 * suite — et le nom du fichier ne change pas.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { SITES, primaryLang } from '../sites.config.js'
import { findChrome } from './lib/chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Palette « abricot sur basalte », copiée de src/styles/global.css. Dupliquée
// et non importée : ce script tourne dans Node, qui ne sait pas lire un CSS.
// Si la palette bouge là-bas, elle doit bouger ici — les deux valeurs sont
// les mêmes couleurs de marque, pas deux réglages indépendants.
const BASALT = '#100f0d'
const APRICOT = '#f2a93b'
const TEXT = '#f3ecdb'

// Ce que chaque carte raconte. La marque vient de sites.config.js ; le reste
// est repris mot pour mot des dictionnaires i18n (`site.tagline`, raccourci au
// segment que porte déjà la carte française) et des rubriques de la nav.
const CARDS = {
  ch: {
    kicker: 'ACTUALITÉS · AGENDA · RÉSEAUX',
    // La marque en écriture arménienne, sous le titre latin. C'est
    // `STRINGS.hy['site.title']` de src/i18n.jsx — une TRANSLITTÉRATION (le son
    // du nom latin en lettres arméniennes), pas une traduction. Recopiée ici
    // plutôt qu'importée : Node ne sait pas lire du JSX, même raison que
    // test/radio-count.test.mjs, qui lit i18n.jsx comme du texte.
    //
    // Elle est là parce que la carte .ch la portait DÉJÀ : c'est la seule
    // chose que ce script ne savait pas rendre, et la première régénération
    // l'a donc effacée en silence. Une carte ne doit pas perdre une ligne
    // parce qu'on retourne une montagne.
    subbrand: 'Արմենիա Ինֆո',
    tagline: 'Un instantané horaire de la vie arménienne',
  },
  org: {
    kicker: 'NEWS · EVENTS · SOCIAL',
    // Pas de sous-titre arménien ici, et c'est voulu : la carte du .org n'en a
    // jamais porté, et sa marque est déjà « Armenia News » sur les trois
    // langues du domaine.
    subbrand: null,
    tagline: 'An hourly snapshot of Armenian life',
  },
}

// La silhouette de l'Ararat — Masis et Sis. Exactement le tracé de
// public/favicon.svg, mais dessiné au trait plutôt que rempli : c'est la même
// marque que l'onglet du navigateur, pas un deuxième logo à entretenir.
// Masis (le haut) à DROITE — la vue depuis l'Arménie. Voir public/favicon.svg.
const ARARAT = 'M3 51 L20.5 19 L30 30.5 L40.5 12 L61 51 Z'

/**
 * Retire les segments APP2 « ICC_PROFILE » d'un JPEG, et rien d'autre.
 *
 * Un profil ICC est une métadonnée : le supprimer ne touche pas aux données
 * compressées, donc l'image reste identique au pixel près. Elle est déjà en
 * sRGB grâce à `--force-color-profile=srgb` — on enlève l'étiquette, pas la
 * conversion.
 *
 * Le profil peut être DÉCOUPÉ en plusieurs APP2 successifs (le format prévoit
 * jusqu'à 255 morceaux) : il faut donc tous les retirer, pas seulement le
 * premier. On recopie chaque autre segment tel quel, et à partir du `SOS`
 * (0xFFDA) tout le reste du fichier d'un bloc — au-delà, les octets ne sont
 * plus des segments mais des données entropiques, et les parcourir comme tels
 * corromprait l'image.
 */
function stripIcc(buf) {
  const out = [buf.subarray(0, 2)] // SOI
  let i = 2
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break
    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(i, i + 2))
      i += 2
      continue
    }
    if (marker === 0xda) break // début du scan : le reste part tel quel
    const len = buf.readUInt16BE(i + 2)
    const isIcc =
      marker === 0xe2 && buf.toString('latin1', i + 4, i + 15) === 'ICC_PROFILE'
    if (!isIcc) out.push(buf.subarray(i, i + 2 + len))
    i += 2 + len
  }
  out.push(buf.subarray(i)) // SOS + données compressées + EOI
  return Buffer.concat(out)
}

function html(siteId) {
  const site = SITES[siteId]
  const card = CARDS[siteId]
  if (!card) throw new Error(`pas de carte définie pour la vitrine « ${siteId} »`)
  const domain = site.host.replace(/^https?:\/\//, '')

  return `<!doctype html>
<html lang="${primaryLang(siteId)}">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<!-- Noto Serif Armenian : Fraunces ne porte AUCUN glyphe arménien, donc sans
     elle « Արմենիա Ինֆո » tomberait sur une police de secours — et comme on
     attend document.fonts.ready, la capture partirait quand même, en Times,
     sans erreur. (Pas de backtick dans ce commentaire : il vit à l'intérieur
     du gabarit littéral et le terminerait.) -->
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&family=Noto+Serif+Armenian:wght@600&family=Space+Mono:wght@400&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: ${BASALT};
    /* La lueur haute reprend le dégradé du hero : le fond n'est jamais un
       aplat sur ce site. */
    background-image: radial-gradient(circle at 50% -10%, #241f16 0%, ${BASALT} 62%);
    color: ${TEXT};
    display: flex; align-items: center; justify-content: center;
    -webkit-font-smoothing: antialiased;
  }
  .frame {
    position: absolute; inset: 26px;
    border: 1px solid rgba(243, 236, 219, 0.14);
  }
  .stack {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }
  .kicker {
    font-family: 'Space Mono', monospace;
    font-size: 20px; letter-spacing: 0.34em; text-indent: 0.34em;
    color: ${APRICOT};
  }
  .peaks { margin-top: 44px; width: 104px; height: 104px; }
  .peaks path { fill: none; stroke: ${APRICOT}; stroke-width: 2.4; stroke-linejoin: round; }
  .brand {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 700; font-size: 118px; line-height: 1;
    font-optical-sizing: auto; letter-spacing: -0.015em;
    margin-top: 26px;
  }
  /* Noto Serif Armenian n'embarque pas d'italique : ne lui en demandez pas,
     le navigateur en synthétiserait un penché mécanique — et l'arménien n'a
     pas d'italique de tradition (même règle que le bloc html:lang(hy) de
     global.css). Aucun backtick ici : ce CSS vit dans le gabarit littéral. */
  .subbrand {
    font-family: 'Noto Serif Armenian', Georgia, serif;
    font-weight: 600; font-size: 48px; line-height: 1.1;
    color: ${APRICOT}; margin-top: 16px;
  }
  .rule {
    width: 140px; height: 1px; margin: 46px 0 0;
    background: rgba(243, 236, 219, 0.28);
  }
  .tagline {
    font-family: 'Fraunces', Georgia, serif;
    font-style: italic; font-weight: 400; font-size: 31px;
    margin-top: 30px;
  }
  .domain {
    font-family: 'Space Mono', monospace;
    font-size: 23px; letter-spacing: 0.18em; text-indent: 0.18em;
    color: ${APRICOT}; margin-top: 34px;
  }
</style>
</head>
<body>
  <div class="frame"></div>
  <div class="stack">
    <div class="kicker">${card.kicker}</div>
    <svg class="peaks" viewBox="0 0 64 64" aria-hidden="true"><path d="${ARARAT}" /></svg>
    <div class="brand">${site.brand}</div>
    ${card.subbrand ? `<div class="subbrand">${card.subbrand}</div>` : ''}
    <div class="rule"></div>
    <div class="tagline">${card.tagline}</div>
    <div class="domain">${domain}</div>
  </div>
</body>
</html>`
}

const ids = process.argv.slice(2).filter(Boolean)
const targets = ids.length ? ids : ['org']
for (const id of targets) {
  if (!SITES[id]) throw new Error(`vitrine inconnue : « ${id} » (attendu : ${Object.keys(SITES).join(', ')})`)
}

const executablePath = findChrome()
if (!executablePath) {
  console.error('Aucun Chrome/Edge trouvé. Renseignez PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
})

try {
  for (const id of targets) {
    const file = SITES[id].ogImage
    if (!file) throw new Error(`SITES.${id} n'a pas d'ogImage`)

    const page = await browser.newPage()
    // deviceScaleFactor 1 : la sortie doit faire 1200×630 pile (voir l'en-tête).
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
    await page.setContent(html(id), { waitUntil: 'networkidle0' })
    // Sans cette attente, la capture peut partir avec les polices de secours.
    await page.evaluate(() => document.fonts.ready)

    const jpeg = stripIcc(await page.screenshot({ type: 'jpeg', quality: 90 }))
    const out = path.join(root, 'public', file.replace(/^\//, ''))
    await writeFile(out, jpeg)
    console.log(`✓ public${file}  (${SITES[id].brand}, ${(jpeg.length / 1024).toFixed(0)} ko)`)
    await page.close()
  }
} finally {
  await browser.close()
}
