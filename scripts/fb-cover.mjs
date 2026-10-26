/**
 * Photo de couverture de la Page Facebook d'une vitrine.
 *
 *   node scripts/fb-cover.mjs org <fichier.jpg>
 *
 * ÉTAPE MANUELLE (Chrome local + Google Fonts), jamais en CI : le fichier
 * n'est pas servi par le site, il est posé à la main sur la Page.
 *
 * 1640×924 : le format que Meta recommande. Facebook n'en montre pas la même
 * part partout — le téléphone l'affiche presque en entier, l'ordinateur n'en
 * garde qu'une bande centrale d'environ 1640×624. Tout ce qui se lit tient
 * donc dans cette bande (y 150 → 774) ; la chaîne de l'Ararat, décor, peut
 * en déborder par le bas. Le coin bas-gauche reste vide : la photo de profil
 * le recouvre sur ordinateur.
 *
 * Mêmes garde-fous que scripts/og-image.mjs (lire son en-tête) : textes repris
 * de la carte de partage, `document.fonts.ready`, et profil ICC retiré — une
 * image étiquetée autrement qu'en sRGB s'affiche délavée chez certains clients.
 */
import { writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import { SITES, primaryLang } from '../sites.config.js'
import { findChrome } from './lib/chrome.mjs'

const W = 1640
const H = 924
const BASALT = '#100f0d'
const APRICOT = '#f2a93b'
const TEXT = '#f3ecdb'

// Mot pour mot ceux de la carte de partage (scripts/og-image.mjs, CARDS).
const COPY = {
  org: { kicker: 'NEWS · EVENTS · SOCIAL', tagline: 'An hourly snapshot of Armenian life' },
  // subbrand : la marque en lettres arméniennes, comme sur la carte du .ch.
  ch: { kicker: 'ACTUALITÉS · AGENDA · RÉSEAUX', subbrand: 'Արմենիա Ինֆո', tagline: 'Un instantané horaire de la vie arménienne' },
}

// La chaîne de l'Ararat du héros du site (src/components/Ornament.jsx).
const RANGE = `M0 150 L0 96 L210 96 L430 30 L520 70 L610 18 L760 96 L905 50 L980 78
  L1130 14 L1250 70 L1320 52 L1440 96 L1440 150 Z`

function html(siteId) {
  const site = SITES[siteId]
  const c = COPY[siteId]
  const domain = site.host.replace(/^https?:\/\//, '')
  return `<!doctype html>
<html lang="${primaryLang(siteId)}">
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&family=Noto+Serif+Armenian:wght@600&family=Space+Mono:wght@400&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    background: ${BASALT};
    background-image: radial-gradient(ellipse 70% 60% at 50% 18%, #2a2216 0%, ${BASALT} 70%);
    color: ${TEXT};
    -webkit-font-smoothing: antialiased;
    position: relative;
  }
  .range {
    position: absolute; left: 0; bottom: 0; width: ${W}px; height: 330px;
    color: rgba(242, 169, 59, 0.2);
    filter: drop-shadow(0 -4px 40px rgba(242, 169, 59, 0.35));
  }
  .stack {
    position: absolute; left: 0; right: 0; top: ${c.subbrand ? 190 : 205}px;
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .kicker {
    font-family: 'Space Mono', monospace; font-size: 24px;
    letter-spacing: 0.34em; text-indent: 0.34em; color: ${APRICOT};
  }
  .brand {
    font-family: 'Fraunces', Georgia, serif; font-weight: 700; font-size: 140px;
    line-height: 1; letter-spacing: -0.015em; margin-top: 36px;
  }
  /* Pas d italique : Noto Serif Armenian n en a pas (voir og-image.mjs). */
  .subbrand {
    font-family: 'Noto Serif Armenian', Georgia, serif; font-weight: 600;
    font-size: 52px; line-height: 1.1; color: ${APRICOT}; margin-top: 14px;
  }
  .rule { width: 160px; height: 1px; margin-top: 38px; background: rgba(243, 236, 219, 0.28); }
  .tagline {
    font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 400;
    font-size: 42px; margin-top: 34px;
  }
  .domain {
    font-family: 'Space Mono', monospace; font-size: 26px;
    letter-spacing: 0.18em; text-indent: 0.18em; color: ${APRICOT}; margin-top: 34px;
  }
  /* Une ligne de plus (la marque arménienne) : le bloc se resserre pour
     rester dans la bande que Facebook montre sur ordinateur, au-dessus des sommets. */
  .compact .brand { font-size: 124px; margin-top: 28px; }
  .compact .subbrand { font-size: 46px; margin-top: 10px; }
  .compact .rule { margin-top: 28px; }
  .compact .tagline { font-size: 38px; margin-top: 24px; }
  .compact .domain { margin-top: 24px; }
</style>
</head>
<body class="${c.subbrand ? 'compact' : ''}">
  <div class="stack">
    <div class="kicker">${c.kicker}</div>
    <div class="brand">${site.brand}</div>
    ${c.subbrand ? `<div class="subbrand">${c.subbrand}</div>` : ''}
    <div class="rule"></div>
    <div class="tagline">${c.tagline}</div>
    <div class="domain">${domain}</div>
  </div>
  <svg class="range" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true">
    <path fill="currentColor" d="${RANGE}" />
    <path fill="rgba(244,236,216,0.16)" d="M610 18 L640 42 L600 50 L630 70 L760 96 L905 50 L760 96 L610 18 Z" />
    <path fill="rgba(244,236,216,0.14)" d="M1130 14 L1162 40 L1120 48 L1150 66 L1250 70 L1130 14 Z" />
  </svg>
</body>
</html>`
}

// Même fonction que scripts/og-image.mjs (voir son commentaire).
function stripIcc(buf) {
  const out = [buf.subarray(0, 2)]
  let i = 2
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break
    const marker = buf[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(i, i + 2))
      i += 2
      continue
    }
    if (marker === 0xda) break
    const len = buf.readUInt16BE(i + 2)
    const isIcc = marker === 0xe2 && buf.toString('latin1', i + 4, i + 15) === 'ICC_PROFILE'
    if (!isIcc) out.push(buf.subarray(i, i + 2 + len))
    i += 2 + len
  }
  out.push(buf.subarray(i))
  return Buffer.concat(out)
}

const [id = 'org', out] = process.argv.slice(2)
if (!COPY[id] || !out) {
  console.error('usage : node scripts/fb-cover.mjs <ch|org> <fichier.jpg>')
  process.exit(1)
}
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.setContent(html(id), { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  const jpeg = stripIcc(await page.screenshot({ type: 'jpeg', quality: 90 }))
  await writeFile(out, jpeg)
  console.log(`✓ ${out}  (${SITES[id].brand}, ${W}×${H}, ${(jpeg.length / 1024).toFixed(0)} ko)`)
} finally {
  await browser.close()
}
