// Les cartes de liens (pages/) sont celles qu'on partage sur Facebook et
// WhatsApp. Elles sont restées sans mesure d'audience jusqu'au 19 octobre 2026 :
// l'origine sociale de ce trafic se perdait, la visite arrivant sur l'accueil
// avec la carte pour seul référent. Ce test garde les marqueurs dans chaque
// carte et le remplacement par les identifiants de SA vitrine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES } from '../sites.config.js'
import { applyAnalytics, BEACON_MARKER, GA_MARKER } from '../scripts/lib/site-meta.mjs'

for (const site of Object.values(SITES)) {
  for (const name of site.standalone ?? []) {
    test(`pages/${name}.${site.id}.html : mesure de sa vitrine, rien du voisin`, () => {
      const src = readFileSync(new URL(`../pages/${name}.${site.id}.html`, import.meta.url), 'utf-8')
      assert.ok(src.includes(GA_MARKER) && src.includes(BEACON_MARKER), 'marqueurs présents')
      assert.ok(!/G-[A-Z0-9]{6,12}|cloudflareinsights/.test(src), 'aucun identifiant écrit à la main')
      const html = applyAnalytics(src, site.id)
      assert.ok(html.includes(`data-ga-id="${site.gaMeasurementId}"`))
      assert.ok(html.includes(site.cfBeaconToken))
      assert.ok(html.indexOf('/ga-init.js') < html.indexOf('googletagmanager.com/gtag/js'), 'ga-init avant gtag')
      for (const autre of Object.values(SITES).filter((s) => s.id !== site.id)) {
        assert.ok(!html.includes(autre.gaMeasurementId) && !html.includes(autre.cfBeaconToken))
      }
    })
  }
}

test('applyAnalytics refuse un HTML sans marqueur', () => {
  assert.throws(() => applyAnalytics(`<html>${GA_MARKER}</html>`, 'ch'), /CF_BEACON/)
  assert.throws(() => applyAnalytics(`<html>${BEACON_MARKER}</html>`, 'ch'), /GA_TAG/)
})
