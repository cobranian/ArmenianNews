import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headFor, applyMeta, replaceMeta, META_MARKER } from '../scripts/lib/site-meta.mjs'
import { ALL_LANGS, LANG_URL, siteOf } from '../sites.config.js'

const PAGES = ALL_LANGS.map((lang) => ({ lang, siteId: siteOf(lang) }))

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
  assert.ok(hy.includes('content="https://armenianews.org/og-image.jpg"'))
})

test('la balise de vérification GSC n\'apparaît que si le jeton existe', () => {
  assert.ok(headFor({ siteId: 'ch', lang: 'fr' }).includes('google-site-verification'))
  assert.ok(!headFor({ siteId: 'org', lang: 'en' }).includes('google-site-verification'))
})

test('applyMeta remplace le marqueur et l\'attribut lang', () => {
  const src = `<!doctype html>\n<html lang="fr">\n  <head>\n    <!--SITE_META-->\n  </head>\n</html>`
  const out = applyMeta(src, { siteId: 'org', lang: 'ru' })
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

test('replaceMeta rejoue sur un HTML déjà bâti, autant de fois que voulu', () => {
  // C'est le cas d'usage de Task 8 : dist/org/index.html est passé par Vite
  // (hachages d'assets posés, marqueur consommé), et il faut en dériver la
  // page /hy/ sans rejouer le build.
  const src = `<!doctype html>\n<html lang="fr">\n  <head>\n    <!--SITE_META-->\n  </head>\n  <body><script src="/assets/index-a1b2c3.js"></script></body>\n</html>`
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
