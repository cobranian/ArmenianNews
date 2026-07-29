import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  headFor,
  applyMeta,
  replaceMeta,
  beaconTag,
  META_MARKER,
  BEACON_MARKER,
} from '../scripts/lib/site-meta.mjs'
import { sitemapFor, robotsFor } from '../scripts/lib/sitemap.mjs'
import { ALL_LANGS, LANG_URL, SITES, siteOf, primaryLang } from '../sites.config.js'

const PAGES = ALL_LANGS.map((lang) => ({ lang, siteId: siteOf(lang) }))

// Le squelette d'index.html réduit à ce qu'applyMeta exige : ses deux marqueurs.
const SRC = `<!doctype html>\n<html lang="fr">\n  <head>\n    ${META_MARKER}\n  </head>\n  <body>${BEACON_MARKER}</body>\n</html>`

test('le canonical est auto-référent sur chaque page', () => {
  for (const { siteId, lang } of PAGES) {
    const head = headFor({ siteId, lang })
    assert.ok(
      head.includes(`<link rel="canonical" href="${LANG_URL[lang]}" />`),
      `canonical manquant ou faux pour ${lang}`,
    )
  }
})

test('les hreflang sont réciproques : chaque page cite les quatre, dont elle-même', () => {
  for (const { siteId, lang } of PAGES) {
    const head = headFor({ siteId, lang })
    for (const other of ALL_LANGS) {
      assert.ok(
        head.includes(`hreflang="${other}" href="${LANG_URL[other]}"`),
        `page ${lang} : alternate ${other} manquant`,
      )
    }
    assert.ok(head.includes('hreflang="x-default"'), `page ${lang} : x-default manquant`)
  }
})

test('la marque suit le domaine, la baseline suit la langue', () => {
  assert.ok(headFor({ siteId: 'ch', lang: 'fr' }).includes('Arménie Info · Actualités arméniennes'))
  assert.ok(headFor({ siteId: 'org', lang: 'en' }).includes('Armenia News · Armenian news'))
  // Sur /hy/ : marque anglaise du domaine, baseline arménienne.
  const hy = headFor({ siteId: 'org', lang: 'hy' })
  assert.ok(hy.includes('Armenia News · Հայկական լուրեր'), 'marque ou baseline fausse sur /hy/')
})

test('og:url et og:image sont absolus vers le bon host', () => {
  const hy = headFor({ siteId: 'org', lang: 'hy' })
  assert.ok(hy.includes('property="og:url" content="https://armenianews.org/hy/"'))
  assert.ok(hy.includes('content="https://armenianews.org/og-image-org.jpg"'))
})

// La carte de partage porte la MARQUE et la LANGUE du domaine : celle du .org
// est en anglais, celle du .ch en français. Le mode d'échec n'est donc pas
// « absente » mais « celle du voisin » — c'est exactement ce qui se passait
// quand les deux vitrines pointaient sur le même /og-image.jpg : armenianews.org
// annonçait une carte disant « Arménie Info · Un instantané horaire de la vie
// arménienne » sous un <title> anglais. Aucune erreur nulle part, juste un
// aperçu WhatsApp et Facebook dans la mauvaise langue.
test('chaque vitrine annonce SA carte de partage, jamais celle de l\'autre', () => {
  for (const site of Object.values(SITES)) {
    for (const page of site.pages) {
      const head = headFor({ siteId: site.id, lang: page.lang })
      assert.ok(
        head.includes(`content="${site.host}${site.ogImage}"`),
        `${site.id}/${page.lang} : og:image attendu sur ${site.ogImage}`,
      )
      for (const autre of Object.values(SITES)) {
        if (autre.id === site.id) continue
        assert.ok(
          !head.includes(autre.ogImage),
          `${site.id}/${page.lang} : porte la carte de ${autre.id}`,
        )
      }
    }
  }
})

// Les deux vitrines portent désormais une balise ; l'invariant utile n'est donc
// plus « présente ou absente » mais « chacune la sienne ». Une page portant le
// jeton du voisin se déploie sans erreur et ne valide jamais — sans le moindre
// signal, exactement comme le beacon Cloudflare versé au mauvais compte.
test('chaque vitrine porte SON jeton de vérification GSC, jamais celui de l\'autre', () => {
  for (const site of Object.values(SITES)) {
    const head = headFor({ siteId: site.id, lang: primaryLang(site.id) })

    if (site.gscToken) {
      assert.ok(
        head.includes(`content="${site.gscToken}"`),
        `${site.id} : son propre jeton attendu dans la balise`,
      )
    } else {
      // Pas de jeton ⇒ pas de balise. Une balise vide vaudrait moins que rien.
      assert.ok(
        !head.includes('google-site-verification'),
        `${site.id} : sans jeton, aucune balise ne doit être émise`,
      )
    }

    for (const autre of Object.values(SITES)) {
      if (autre.id === site.id || !autre.gscToken) continue
      assert.ok(
        !head.includes(autre.gscToken),
        `${site.id} porte le jeton GSC de ${autre.id} — validation impossible, sans signal`,
      )
    }
  }
})

test('applyMeta remplace le marqueur et l\'attribut lang', () => {
  const out = applyMeta(SRC, { siteId: 'org', lang: 'ru' })
  assert.ok(out.includes('<html lang="ru">'))
  assert.ok(!out.includes(META_MARKER))
  assert.ok(out.includes('https://armenianews.org/ru/'))
})

test('applyMeta refuse un HTML sans marqueur plutôt que de produire une page muette', () => {
  assert.throws(
    () => applyMeta('<html lang="fr"><head></head></html>', { siteId: 'ch', lang: 'fr' }),
    /SITE_META/,
  )
})

test('applyMeta refuse un HTML sans marqueur de beacon', () => {
  // Sans ce refus, retirer <!--CF_BEACON--> d'index.html priverait les deux
  // vitrines de leur mesure d'audience sans qu'aucun build ne s'en plaigne.
  const sansBeacon = `<html lang="fr"><head>${META_MARKER}</head><body></body></html>`
  assert.throws(() => applyMeta(sansBeacon, { siteId: 'ch', lang: 'fr' }), /CF_BEACON/)
})

test('chaque vitrine émet SON jeton Cloudflare, et jamais celui de l\'autre', () => {
  for (const site of Object.values(SITES)) {
    const out = applyMeta(SRC, { siteId: site.id, lang: primaryLang(site.id) })
    assert.ok(!out.includes(BEACON_MARKER), `${site.id} : marqueur non consommé`)

    if (site.cfBeaconToken) {
      assert.equal(
        (out.match(new RegExp(site.cfBeaconToken, 'g')) || []).length,
        1,
        `${site.id} : son propre jeton, une seule fois`,
      )
    } else {
      // Pas de jeton ⇒ aucune balise. Mieux vaut ne pas mesurer que verser ses
      // visites dans le tableau de bord de l'autre vitrine.
      assert.ok(
        !out.includes('static.cloudflareinsights.com'),
        `${site.id} : sans jeton, aucune balise beacon ne doit être émise`,
      )
    }

    for (const autre of Object.values(SITES)) {
      if (autre.id === site.id || !autre.cfBeaconToken) continue
      assert.ok(
        !out.includes(autre.cfBeaconToken),
        `${site.id} porte le jeton de ${autre.id} — mesure versée au mauvais site`,
      )
    }
  }
})

test('un jeton Cloudflare mal formé est refusé, pas écrit dans la page', () => {
  // Le jeton part dans un attribut délimité par des apostrophes : une apostrophe
  // collée par erreur produirait une balise d'apparence correcte, lue de travers.
  const originel = SITES.ch.cfBeaconToken
  for (const mauvais of ["abc' onload='x", 'PAS-DU-HEXA', '40017296bb8845b8b659cb9cc34dae']) {
    SITES.ch.cfBeaconToken = mauvais
    assert.throws(() => beaconTag('ch'), /cfBeaconToken/, `accepté à tort : ${mauvais}`)
  }
  SITES.ch.cfBeaconToken = originel
})

test('replaceMeta rejoue sur un HTML déjà bâti, autant de fois que voulu', () => {
  // C'est le cas d'usage de Task 8 : dist/org/index.html est passé par Vite
  // (hachages d'assets posés, marqueur consommé), et il faut en dériver la
  // page /hy/ sans rejouer le build.
  const src = `<!doctype html>\n<html lang="fr">\n  <head>\n    ${META_MARKER}\n  </head>\n  <body>${BEACON_MARKER}<script src="/assets/index-a1b2c3.js"></script></body>\n</html>`
  const built = applyMeta(src, { siteId: 'org', lang: 'en' })
  assert.ok(built.includes('/assets/index-a1b2c3.js'), 'le corps bâti doit survivre')

  const hy = replaceMeta(built, { siteId: 'org', lang: 'hy' })
  assert.ok(hy.includes('<html lang="hy">'))
  assert.ok(hy.includes('rel="canonical" href="https://armenianews.org/hy/"'))
  // Un seul canonical : celui de l'anglais doit avoir disparu, pas s'ajouter.
  assert.equal((hy.match(/rel="canonical"/g) || []).length, 1)
  assert.ok(hy.includes('/assets/index-a1b2c3.js'), 'le hachage d\'asset doit survivre')

  // Idempotent : rejouer sur le résultat redonne le même résultat.
  assert.equal(replaceMeta(hy, { siteId: 'org', lang: 'hy' }), hy)
})

test('replaceMeta refuse un HTML sans sentinelles', () => {
  assert.throws(
    () => replaceMeta('<html lang="en"><head></head></html>', { siteId: 'org', lang: 'hy' }),
    /SITE_META/,
  )
})

test('le sitemap du .ch liste sa seule URL', () => {
  const xml = sitemapFor('ch', '2026-07-28T10:00:00.000Z')
  assert.ok(xml.includes('<loc>https://armenieinfo.ch/</loc>'))
  assert.ok(xml.includes('<lastmod>2026-07-28T10:00:00.000Z</lastmod>'))
  assert.equal((xml.match(/<url>/g) || []).length, 1)
})

test('le sitemap du .org liste ses trois URL avec leurs hreflang', () => {
  const xml = sitemapFor('org', '2026-07-28T10:00:00.000Z')
  assert.equal((xml.match(/<url>/g) || []).length, 3)
  for (const loc of ['https://armenianews.org/', 'https://armenianews.org/hy/', 'https://armenianews.org/ru/']) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), loc)
  }
  // Chaque <url> porte les quatre alternates + x-default, y compris la version
  // française hébergée sur l'autre domaine.
  assert.ok(xml.includes('hreflang="fr" href="https://armenieinfo.ch/"'))
  assert.equal((xml.match(/hreflang="x-default"/g) || []).length, 3)
  assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'))
})

test('robots.txt pointe vers le sitemap de son propre domaine', () => {
  assert.ok(robotsFor('org').includes('Sitemap: https://armenianews.org/sitemap.xml'))
  assert.ok(robotsFor('ch').includes('Sitemap: https://armenieinfo.ch/sitemap.xml'))
})
