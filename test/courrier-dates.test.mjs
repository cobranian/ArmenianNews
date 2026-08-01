import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normUrl } from '../scripts/sources/courrier.mjs'

// Courrier d'Erevan date ses articles par APPARIEMENT D'URL : le sitemap donne
// un `<lastmod>` à la minute, la grille de rubrique donne les articles, et
// c'est `normUrl` qui décide si les deux parlent du même article.
//
// Ce test existe parce que l'appariement a réellement cassé, en silence et à
// 100 % : le 1er août 2026, courrier.am s'est mis à écrire ses `<loc>` avec
// `www.` alors que la grille sert des liens sans `www.` — 5 445 dates
// chargées, 0 article daté, aucune erreur nulle part. Le seul symptôme visible
// était l'absence de l'âge sous « LIRE LA SUITE ».
//
// Aucune requête réseau ici : les chaînes sont les VRAIES formes relevées des
// deux côtés ce jour-là.

// La régression du 1er août 2026, dans les deux sens.
test('le www. du sitemap ne casse pas l appariement', () => {
  const sitemap =
    'https://www.courrier.am/fr/-tant-qu-il-n-existe-pas-d-alternative-concrete-la-question-d-un-referendum-ne-se-pose-pas-'
  const grille =
    'https://courrier.am/fr/-tant-qu-il-n-existe-pas-d-alternative-concrete-la-question-d-un-referendum-ne-se-pose-pas-'
  assert.equal(normUrl(sitemap), normUrl(grille))
})

test('l appariement tient aussi si les www. s inversent', () => {
  assert.equal(
    normUrl('https://courrier.am/fr/actualite'),
    normUrl('https://www.courrier.am/fr/actualite'),
  )
})

// Le piège d'origine, celui pour lequel `normUrl` a été écrite. Il doit
// survivre au correctif du www. — les deux se cumulent sur la même URL.
test('les accents encodes s apparient aux accents en clair', () => {
  assert.equal(
    normUrl('https://www.courrier.am/fr/content/arm%C3%A9nie-francophone/adama-ouane'),
    normUrl('https://courrier.am/fr/content/arménie-francophone/adama-ouane'),
  )
})

test('le slash final ne compte pas', () => {
  assert.equal(
    normUrl('https://www.courrier.am/fr/actualite/'),
    normUrl('https://courrier.am/fr/actualite'),
  )
})

// `normUrl` reçoit ce que le HTML et le XML lui donnent : elle ne doit jamais
// jeter. Une URL mal encodée fait échouer `decodeURI`, et le repli doit encore
// replier le www. — sinon le correctif aurait un trou sur ces URL-là.
test('une URL mal encodee ne fait pas tomber le scrape', () => {
  assert.doesNotThrow(() => normUrl('https://www.courrier.am/fr/100%'))
  assert.equal(normUrl('https://www.courrier.am/fr/100%'), normUrl('https://courrier.am/fr/100%'))
})

// Un www. au MILIEU du chemin n'est pas un hôte : le replier changerait l'URL.
test('seul le www. de l hote est replie', () => {
  assert.equal(
    normUrl('https://courrier.am/fr/www.exemple-com'),
    'https://courrier.am/fr/www.exemple-com',
  )
})
