import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSectionHtml, sectionUrl, sitemapUrl } from '../scripts/sources/courrier.mjs'

// Le Courrier d'Erevan a REFONDU son site le 11 septembre 2026 : nouveau thème
// Drupal (« card »), plus de préfixe /fr/ dans les URL, anciennes vignettes
// (`styles/530x350`) supprimées. Le scraper a continué de répondre — l'ancien
// sélecteur ne trouvait rien, `backfillSections` resservait l'instantané du
// 11 septembre, et ses 80 vignettes répondaient 404. Onze jours de cartes
// figées, toutes sans image, aucun contrôle en rouge.
//
// La fixture est un extrait RÉEL de /actualite relevé le 22 septembre 2026.
const html = readFileSync(new URL('./fixtures/courrier-actualite-2026-09-22.html', import.meta.url), 'utf8')

test('la nouvelle grille « card » est lue : titre, URL, image', () => {
  const arts = parseSectionHtml(html, 10)
  assert.equal(arts.length, 3)
  assert.equal(
    arts[0].title,
    'Nikol Pashinyan à New York pour la 81e session de l’Assemblée générale de l’ONU',
  )
  assert.equal(
    arts[0].url,
    'https://courrier.am/nikol-pashinyan-new-york-pour-la-81e-session-de-lassemblee-generale-de-lonu',
  )
  assert.match(arts[0].image, /^https:\/\/courrier\.am\/sites\/default\/files\/styles\/original_webp\//)
})

// Le sitemap garde la minute (« 2026-09-22T06:17Z ») là où la carte n'a que le
// jour (« 2026-09-22T12:00:00Z ») : le sitemap prime, la carte est le repli.
test('la date vient du sitemap quand il l a, de la carte sinon', () => {
  const dates = new Map([
    ['/nikol-pashinyan-new-york-pour-la-81e-session-de-lassemblee-generale-de-lonu', '2026-09-22T06:17:00.000Z'],
  ])
  const arts = parseSectionHtml(html, 10, dates)
  assert.equal(arts[0].date, '2026-09-22T06:17:00.000Z')
  assert.equal(arts[1].date, '2026-09-18T12:00:00.000Z')
})

test('limit est respecté', () => {
  assert.equal(parseSectionHtml(html, 2).length, 2)
})

test('une page sans carte rend une liste vide, pas une exception', () => {
  assert.deepEqual(parseSectionHtml('<html><body><p>rien</p></body></html>', 10), [])
})

// Les URL ne portent plus de préfixe de langue : `/fr/actualite` redirige 301
// vers `/actualite`, `/hy/actualite` répond 404, et `/fr/sitemap.xml` 301 vers
// `/sitemap.xml`. Suivre une redirection à chaque appel n'est pas un contrat.
test('les URL de rubrique et de sitemap n ont plus de prefixe de langue', () => {
  assert.equal(sectionUrl('actualite'), 'https://courrier.am/actualite')
  assert.equal(sitemapUrl(2), 'https://courrier.am/sitemap.xml?page=2')
})
