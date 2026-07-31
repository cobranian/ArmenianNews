import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  headFor,
  applyMeta,
  replaceMeta,
  beaconTag,
  gaTag,
  META_MARKER,
  BEACON_MARKER,
  GA_MARKER,
} from '../scripts/lib/site-meta.mjs'
import { sitemapFor, robotsFor } from '../scripts/lib/sitemap.mjs'
import {
  ALL_LANGS,
  LANG_URL,
  SITES,
  siteOf,
  primaryLang,
  ALL_VIEWS,
  urlFor,
  xDefaultFor,
} from '../sites.config.js'

const PAGES = ALL_LANGS.map((lang) => ({ lang, siteId: siteOf(lang) }))

// Le squelette d'index.html réduit à ce qu'applyMeta exige : ses trois marqueurs.
const SRC = `<!doctype html>\n<html lang="fr">\n  <head>\n    ${META_MARKER}\n    ${GA_MARKER}\n  </head>\n  <body>${BEACON_MARKER}</body>\n</html>`

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
  const sansBeacon = `<html lang="fr"><head>${META_MARKER}${GA_MARKER}</head><body></body></html>`
  assert.throws(() => applyMeta(sansBeacon, { siteId: 'ch', lang: 'fr' }), /CF_BEACON/)
})

test('applyMeta refuse un HTML sans marqueur GA4', () => {
  // Même raison que pour le beacon : retirer <!--GA_TAG--> d'index.html
  // couperait Google Analytics sur les deux vitrines à la fois, et aucun build
  // ne s'en plaindrait — la page resterait parfaitement valide, juste muette.
  const sansGa = `<html lang="fr"><head>${META_MARKER}</head><body>${BEACON_MARKER}</body></html>`
  assert.throws(() => applyMeta(sansGa, { siteId: 'ch', lang: 'fr' }), /GA_TAG/)
})

// L'invariant central de ce correctif. L'ID de mesure vivait en dur dans
// index.html ET public/ga-init.js, deux fichiers que Vite copie à l'identique
// dans les deux dist/ : armenianews.org envoyait donc ses visites — /hy/ et
// /ru/ comprises — dans la propriété GA du .ch. Rien ne le signalait ; la
// mesure fonctionnait, simplement au mauvais endroit. Exactement le mode
// d'échec du beacon Cloudflare, de la carte de partage et des pages lien.html.
test('chaque vitrine porte SON ID de mesure GA4, jamais celui de l\'autre', () => {
  for (const site of Object.values(SITES)) {
    const out = applyMeta(SRC, { siteId: site.id, lang: primaryLang(site.id) })
    assert.ok(!out.includes(GA_MARKER), `${site.id} : marqueur GA non consommé`)

    if (site.gaMeasurementId) {
      // Deux fois : dans data-ga-id, et dans l'URL de gtag.js. Les deux doivent
      // désigner la même propriété — un seul des deux repointé mesurerait d'un
      // côté et configurerait de l'autre.
      assert.equal(
        (out.match(new RegExp(site.gaMeasurementId, 'g')) || []).length,
        2,
        `${site.id} : son ID attendu dans data-ga-id ET dans l'URL gtag.js`,
      )
      assert.ok(
        out.includes(`data-ga-id="${site.gaMeasurementId}"`),
        `${site.id} : ga-init.js doit recevoir l'ID par attribut (CSP sans unsafe-inline)`,
      )
    } else {
      assert.ok(
        !out.includes('googletagmanager.com'),
        `${site.id} : sans ID, aucune balise GA ne doit être émise`,
      )
    }

    for (const autre of Object.values(SITES)) {
      if (autre.id === site.id || !autre.gaMeasurementId) continue
      assert.ok(
        !out.includes(autre.gaMeasurementId),
        `${site.id} porte l'ID GA de ${autre.id} — mesure versée à la mauvaise propriété`,
      )
    }
  }
})

test('ga-init.js est émis avant gtag.js, sinon le Consent Mode ne sert à rien', () => {
  // gtag.js traite la file `dataLayer` dès son exécution : si ga-init.js n'a pas
  // encore poussé ses `consent default`, le premier hit part sans état de
  // consentement — donc avec cookies là où le RGPD les interdit. Les deux
  // balises seraient pourtant bien présentes, et un test de présence passerait.
  const out = applyMeta(SRC, { siteId: 'org', lang: 'en' })
  assert.ok(
    out.indexOf('/ga-init.js') < out.indexOf('googletagmanager.com/gtag/js'),
    'ga-init.js doit précéder gtag.js',
  )
})

test('un ID de mesure mal formé est refusé, pas écrit dans la page', () => {
  // L'ID part dans un attribut ET dans une URL : une apostrophe ou un guillemet
  // collés par erreur produiraient une balise d'apparence correcte, lue de
  // travers — et une propriété qui ne reçoit jamais rien.
  const originel = SITES.ch.gaMeasurementId
  for (const mauvais of ['G-ABC" onload="x', 'UA-123456-1', 'EB3W5XXSMW', 'G-abc123']) {
    SITES.ch.gaMeasurementId = mauvais
    assert.throws(() => gaTag('ch'), /gaMeasurementId/, `accepté à tort : ${mauvais}`)
  }
  SITES.ch.gaMeasurementId = originel
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
  const src = `<!doctype html>\n<html lang="fr">\n  <head>\n    ${META_MARKER}\n    ${GA_MARKER}\n  </head>\n  <body>${BEACON_MARKER}<script src="/assets/index-a1b2c3.js"></script></body>\n</html>`
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

test('le sitemap du .ch liste ses pages, une par vue', () => {
  const xml = sitemapFor('ch', '2026-07-28T10:00:00.000Z')
  assert.equal((xml.match(/<url>/g) || []).length, ALL_VIEWS.length)
  assert.ok(xml.includes('<loc>https://armenieinfo.ch/</loc>'))
  assert.ok(xml.includes('<loc>https://armenieinfo.ch/radio/</loc>'))
  assert.ok(xml.includes('<lastmod>2026-07-28T10:00:00.000Z</lastmod>'))
})

test('le sitemap du .org liste ses trois langues fois ses vues', () => {
  const xml = sitemapFor('org', '2026-07-28T10:00:00.000Z')
  assert.equal((xml.match(/<url>/g) || []).length, 3 * ALL_VIEWS.length)
  for (const loc of [
    'https://armenianews.org/',
    'https://armenianews.org/hy/',
    'https://armenianews.org/radio/',
    'https://armenianews.org/hy/radio/',
    'https://armenianews.org/ru/radio/',
  ]) {
    assert.ok(xml.includes(`<loc>${loc}</loc>`), loc)
  }
})

// Le prefixe xhtml: est DECLARE, sinon les deux sitemaps sont du XML non
// conforme et Search Console les rejette en bloc. Rien d'autre ne le regarde :
// check-build.mjs compte les <xhtml:link> mais jamais leur namespace, donc
// perdre cette ligne d'en-tete passerait les tests, le check et le deploiement,
// pour n'echouer que dans Search Console, des semaines plus tard.
test('les deux sitemaps declarent le namespace xhtml de leurs alternates', () => {
  for (const siteId of Object.keys(SITES)) {
    const xml = sitemapFor(siteId, '2026-07-28T10:00:00.000Z')
    assert.ok(
      xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'),
      `${siteId} : prefixe xhtml non declare, sitemap non conforme`,
    )
    assert.ok(xml.includes('<xhtml:link'), `${siteId} : aucun alternate`)
  }
})

// L'alternate francais du .org pointe sur l'AUTRE DOMAINE. C'est le seul lien
// qui relie les deux vitrines dans les sitemaps ; le perdre isolerait le .ch de
// ses trois traductions sans qu'aucun compte d'alternates ne bouge.
test('le sitemap du .org cite la version francaise, hebergee sur le .ch', () => {
  const xml = sitemapFor('org', '2026-07-28T10:00:00.000Z')
  assert.ok(xml.includes(`hreflang="fr" href="${LANG_URL.fr}"`), 'accueil fr absent')
  assert.ok(
    xml.includes(`hreflang="fr" href="${urlFor('fr', 'radio')}"`),
    'la vue radio fr est absente des alternates du .org',
  )
  // Un x-default par entree, ni plus ni moins : un seul pour tout le fichier
  // laisserait les autres entrees sans page de repli.
  assert.equal(
    (xml.match(/hreflang="x-default"/g) || []).length,
    SITES.org.pages.length * ALL_VIEWS.length,
  )
})

// Le meme piege que dans le <head> : une entree de sitemap dont les alternates
// pointent sur les accueils annonce a Google que /radio et l accueil sont la
// meme page en quatre langues.
test('les alternates du sitemap suivent la vue de leur entree', () => {
  const xml = sitemapFor('ch', '2026-07-28T10:00:00.000Z')
  const bloc = xml.split('<url>').find((b) => b.includes(`<loc>${urlFor('fr', 'radio')}</loc>`))
  assert.ok(bloc, 'entree /radio/ introuvable dans le sitemap du .ch')
  for (const l of ALL_LANGS) {
    assert.ok(bloc.includes(`hreflang="${l}" href="${urlFor(l, 'radio')}"`), l)
  }
  assert.ok(bloc.includes(`hreflang="x-default" href="${xDefaultFor('radio')}"`))
})

test('robots.txt pointe vers le sitemap de son propre domaine', () => {
  assert.ok(robotsFor('org').includes('Sitemap: https://armenianews.org/sitemap.xml'))
  assert.ok(robotsFor('ch').includes('Sitemap: https://armenieinfo.ch/sitemap.xml'))
})

// L'INVARIANT CENTRAL DE CE CHANTIER. Les alternates d'une page de vue doivent
// citer la MÊME vue dans les autres langues. S'ils citaient les accueils, Google
// recevrait des correspondances contradictoires et ignorerait le bloc entier —
// sur toutes les pages, pas seulement les nouvelles.
test('les hreflang sont reciproques PAR VUE', () => {
  for (const view of ALL_VIEWS) {
    for (const lang of ALL_LANGS) {
      const head = headFor({ siteId: siteOf(lang), lang, view })
      for (const autre of ALL_LANGS) {
        assert.ok(
          head.includes(`hreflang="${autre}" href="${urlFor(autre, view)}"`),
          `${view}/${lang} : alternate ${autre} manquant ou pointant ailleurs`,
        )
      }
      assert.ok(
        head.includes(`hreflang="x-default" href="${xDefaultFor(view)}"`),
        `${view}/${lang} : x-default ne suit pas la vue`,
      )
      assert.equal(
        (head.match(/rel="alternate"/g) || []).length,
        ALL_LANGS.length + 1,
        `${view}/${lang} : nombre d'alternates`,
      )
    }
  }
})

// Le mode d'échec visé : une page de vue qui recopierait le bloc de l'accueil
// passerait le test ci-dessus pour la vue `home` et échouerait ici.
test('une page de vue ne cite jamais l accueil dans ses alternates', () => {
  for (const view of ALL_VIEWS.filter((v) => v !== 'home')) {
    for (const lang of ALL_LANGS) {
      const head = headFor({ siteId: siteOf(lang), lang, view })
      for (const autre of ALL_LANGS) {
        assert.ok(
          !head.includes(`hreflang="${autre}" href="${urlFor(autre, 'home')}"`),
          `${view}/${lang} : cite l'accueil ${autre} au lieu de sa propre vue`,
        )
      }
    }
  }
})

test('le canonical d une page de vue se designe elle-meme', () => {
  for (const view of ALL_VIEWS) {
    for (const lang of ALL_LANGS) {
      const head = headFor({ siteId: siteOf(lang), lang, view })
      assert.ok(
        head.includes(`<link rel="canonical" href="${urlFor(lang, view)}" />`),
        `${view}/${lang} : canonical faux`,
      )
      assert.equal((head.match(/rel="canonical"/g) || []).length, 1)
    }
  }
})

// Le titre d'une page de vue mene par le MOT-CLE, pas par la marque : la marque
// est inconnue, et Google tronque la fin. L'accueil garde l'ordre inverse, ou
// la marque est le sujet.
test('le titre d une page de vue mene par le mot-cle', () => {
  assert.ok(
    headFor({ siteId: 'ch', lang: 'fr', view: 'radio' }).includes(
      '<title>Radios arméniennes en direct · Arménie Info</title>',
    ),
  )
  assert.ok(
    headFor({ siteId: 'org', lang: 'en', view: 'radio' }).includes(
      '<title>Armenian radio online · Armenia News</title>',
    ),
  )
})

test('og:url suit la vue', () => {
  const head = headFor({ siteId: 'org', lang: 'ru', view: 'radio' })
  assert.ok(head.includes('property="og:url" content="https://armenianews.org/ru/radio/"'))
})

// La carte de partage suit la VITRINE, pas la vue : les pages /radio du .org
// gardent la carte anglaise du domaine. Rien a regenerer.
test('les pages de vue gardent la carte de partage de leur vitrine', () => {
  for (const view of ALL_VIEWS) {
    for (const site of Object.values(SITES)) {
      for (const page of site.pages) {
        const head = headFor({ siteId: site.id, lang: page.lang, view })
        assert.ok(head.includes(`content="${site.host}${site.ogImage}"`))
        for (const autre of Object.values(SITES)) {
          if (autre.id !== site.id) assert.ok(!head.includes(autre.ogImage))
        }
      }
    }
  }
})
