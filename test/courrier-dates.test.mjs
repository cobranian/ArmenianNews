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

// La régression du 6 août 2026, cinq jours après celle du www. : le sitemap
// s'est mis à écrire ses `<loc>` sur `mail.courrier.am` pendant que la grille
// servait `courrier.am`. Chemin identique au caractère près, hôte différent —
// 5 455 dates chargées, 0 des 80 articles daté. Deux changements d'hôte en
// cinq jours : c'est ce qui a fait abandonner la liste de sous-domaines
// repliés au profit d'un appariement sur le CHEMIN SEUL.
test('le mail. du sitemap ne casse pas l appariement', () => {
  const sitemap = 'https://mail.courrier.am/fr/demission-et-reconduction-du-premier-ministre-'
  const grille = 'https://courrier.am/fr/demission-et-reconduction-du-premier-ministre-'
  assert.equal(normUrl(sitemap), normUrl(grille))
})

// Le point du correctif : ce test doit passer pour un sous-domaine qui
// n'existe pas encore. Nommer les hôtes un à un, c'est perdre la course d'une
// panne de retard à chaque fois.
test('un sous-domaine jamais vu s apparie quand meme', () => {
  const grille = 'https://courrier.am/fr/actualite'
  for (const hote of ['m.courrier.am', 'cdn.courrier.am', 'www2.courrier.am', 'courrier.am']) {
    assert.equal(normUrl(`https://${hote}/fr/actualite`), normUrl(grille), `hôte ${hote}`)
  }
  // Le protocole non plus ne doit pas compter.
  assert.equal(normUrl('http://courrier.am/fr/actualite'), normUrl(grille))
})

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

// Un www. au MILIEU du chemin n'est pas un hôte : le replier changerait l'URL,
// et deux articles différents pourraient alors partager une date.
test('seul l hote est jete, pas un www. du chemin', () => {
  assert.equal(normUrl('https://courrier.am/fr/www.exemple-com'), '/fr/www.exemple-com')
})

// Deux chemins différents ne doivent JAMAIS se confondre — c'est la seule
// chose que l'hôte garantissait encore. Le cas de la racine nue est le piège :
// repliée en chaîne vide, elle s'appariait avec tout ce qui se replie en vide.
test('des chemins differents restent differents', () => {
  assert.notEqual(normUrl('https://courrier.am/fr/a'), normUrl('https://courrier.am/fr/b'))
  assert.equal(normUrl('https://courrier.am/'), '/')
  assert.equal(normUrl('https://courrier.am'), '/')
  assert.notEqual(normUrl('https://courrier.am/'), normUrl('https://courrier.am/fr/a'))
})
