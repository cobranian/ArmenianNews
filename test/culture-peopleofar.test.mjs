import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  peopleofarTerms, titleNames, fetchPeopleofarSources, refetchPeopleofar, checksFacts, measuresOverlap, PEOPLEOFAR_LICENSE,
} from '../scripts/lib/culture-peopleofar.mjs'
import { refetchSources } from '../scripts/lib/culture-sources.mjs'

const long = 'x'.repeat(400)
const post = (id, title, text = long, modified = '2020-01-01T00:00:00') => ({
  id, link: `https://www.peopleofar.com/p/${id}/`, title: { rendered: title }, content: { rendered: `<p>${text}</p>` }, modified_gmt: modified,
})
const fake = (body) => {
  const calls = []
  const impl = async (url, init) => (calls.push({ url: new URL(url), init }), { ok: true, status: 200, json: async () => body })
  return { impl, calls }
}

test('peopleofarTerms : libellé, alias, titre Wikipédia sans précision ; trop courts écartés', () => {
  const e = { labels: { en: 'Komitas' }, aliases: { en: ['Komitas Vardapet', 'Kom'] }, sitelinks: { en: 'Komitas (composer)' } }
  assert.deepEqual(peopleofarTerms(e), ['komitas', 'komitas vardapet'])
})

// La recherche WordPress fouille aussi le corps : « kochari » rendait Rubik Kocharian.
test('titleNames : mot entier, casse et entités ignorées', () => {
  assert.ok(titleNames('UNESCO about Armenian instrument DUDUK', ['duduk']))
  assert.ok(titleNames('Armenian Flatbread &#8216;Lavash&#8217;', ['lavash']))
  assert.ok(!titleNames('Art of Rubik Kocharian', ['kochari']))
})

test('fetchPeopleofarSources : filtre sur le titre, écarte les billets sans texte, deux au plus, UA honnête', async () => {
  const { impl, calls } = fake([
    post(1, 'Art of Rubik Kocharian'),
    post(2, 'Kochari &#8211; the dance'),
    post(3, 'Kochari video', '<iframe></iframe>'),
    post(4, 'Kochari again'),
    post(5, 'Kochari thrice'),
  ])
  const { sources, warnings } = await fetchPeopleofarSources({ labels: { en: 'Kochari' } }, impl)
  assert.deepEqual(sources.map((s) => s.postId), [2, 4])
  assert.equal(sources[0].title, 'Kochari – the dance')
  assert.equal(sources[0].kind, 'peopleofar')
  assert.equal(sources[0].license, PEOPLEOFAR_LICENSE)
  assert.equal(sources[0].revision, '2020-01-01T00:00:00')
  assert.deepEqual(warnings, [])
  assert.equal(calls[0].url.searchParams.get('search'), 'kochari')
  assert.ok(!/Chrome|Mozilla/.test(calls[0].init.headers['User-Agent']))
})

test('fetchPeopleofarSources : panne ou rien trouvé → avertissement, jamais une exception', async () => {
  const down = async () => ({ ok: false, status: 503, json: async () => ({}) })
  assert.match((await fetchPeopleofarSources({ labels: { en: 'Duduk' } }, down)).warnings[0], /PeopleOfAr indisponible/)
  assert.match((await fetchPeopleofarSources({ labels: { en: 'Duduk' } }, fake([]).impl)).warnings[0], /Pas de billet PeopleOfAr/)
})

test('refetch : le billet tel que lu ; modifié depuis → omis', async () => {
  const meta = { kind: 'peopleofar', postId: 7, revision: '2020-01-01T00:00:00', url: 'u' }
  assert.equal((await refetchPeopleofar(meta, fake(post(7, 'Lavash')).impl)).postId, 7)
  assert.equal(await refetchPeopleofar(meta, fake(post(7, 'Lavash', long, '2024-05-05T00:00:00')).impl), null)
  assert.equal((await refetchSources([meta], { fetchImpl: fake(post(7, 'Lavash')).impl })).length, 1)
})

// Un blog ne valide aucun fait ; mais ses phrases (tous droits réservés) ne doivent pas être reprises.
test('le blog est hors vérification des faits, dans la mesure du recouvrement', () => {
  assert.equal(checksFacts({ kind: 'peopleofar' }), false)
  assert.equal(checksFacts({ kind: 'wikipedia' }), true)
  assert.equal(measuresOverlap({ kind: 'peopleofar' }), true)
  assert.equal(measuresOverlap({}), true)
  assert.equal(measuresOverlap({ kind: 'unesco' }), false)
})
