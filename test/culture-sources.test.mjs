import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchWikipedia, fetchWikidataFacts, fetchEntity, resolveTitles, fetchCommonsCandidates, downloadImage, wikidataTime, stripHtml, WIKI_UA, hseTitle, fetchHse, wikitextToText,
} from '../scripts/lib/culture-sources.mjs'

// Un faux fetch qui route par hôte/paramètre et note les appels.
function router(routes) {
  const calls = []
  const impl = async (url, init) => {
    const u = new URL(url)
    calls.push({ u, init })
    for (const [match, body] of routes)
      if (match(u)) return { ok: true, status: 200, json: async () => body, arrayBuffer: async () => body }
    return { ok: false, status: 404, json: async () => ({}) }
  }
  return { impl, calls }
}

test('fetchWikipedia : extrait, révision, Wikidata, image de tête, UA honnête', async () => {
  const { impl, calls } = router([[(u) => u.host === 'fr.wikipedia.org', {
    query: { pages: [{ title: 'Komitas', extract: 'Texte', revisions: [{ revid: 42 }], pageprops: { wikibase_item: 'Q312' }, pageimage: 'Komitas.jpg' }] },
  }]])
  const r = await fetchWikipedia('fr', 'Komitas', impl)
  assert.deepEqual(r, { kind: 'wikipedia', lang: 'fr', title: 'Komitas', url: 'https://fr.wikipedia.org/wiki/Komitas', revision: 42, extract: 'Texte', license: 'CC BY-SA 4.0', wikidata: 'Q312', pageImage: 'Komitas.jpg' })
  assert.equal(calls[0].init.headers['User-Agent'], WIKI_UA)
  assert.ok(!/Mozilla|Chrome/.test(WIKI_UA))
  assert.equal(calls[0].u.searchParams.get('redirects'), '1')
})

test('fetchWikipedia : page absente → null, homonymie → lève', async () => {
  const missing = router([[() => true, { query: { pages: [{ title: 'X', missing: true }] } }]])
  assert.equal(await fetchWikipedia('fr', 'X', missing.impl), null)
  const dab = router([[() => true, { query: { pages: [{ title: 'Ani', extract: 'Ani peut désigner', pageprops: { disambiguation: '' } }] } }]])
  await assert.rejects(fetchWikipedia('fr', 'Ani', dab.impl), /page d’homonymie : fr:Ani/)
})

test('wikidataTime : précisions jour, mois, année, avant notre ère', () => {
  assert.equal(wikidataTime({ time: '+1869-10-08T00:00:00Z', precision: 11 }), '1869-10-08')
  assert.equal(wikidataTime({ time: '+1869-10-00T00:00:00Z', precision: 10 }), '1869-10')
  assert.equal(wikidataTime({ time: '+1869-00-00T00:00:00Z', precision: 9 }), '1869')
  assert.equal(wikidataTime({ time: '-0301-00-00T00:00:00Z', precision: 9 }), '301 av. J.-C.')
  assert.equal(wikidataTime(null), null)
})

test('fetchWikidataFacts : dates connues, entité redirigée', async () => {
  const { impl } = router([[(u) => u.host === 'www.wikidata.org', {
    entities: { Q999: { claims: {
      P569: [{ mainsnak: { datavalue: { value: { time: '+1869-10-08T00:00:00Z', precision: 11 } } } }],
      P570: [{ mainsnak: { datavalue: { value: { time: '+1935-10-22T00:00:00Z', precision: 11 } } } }],
      P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
    } } },
  }]])
  assert.deepEqual(await fetchWikidataFacts('Q312', impl), ['Naissance : 1869-10-08', 'Décès : 1935-10-22'])
})

const ii = (title, { license = 'CC BY-SA 4.0', artist = '<a href="x">Jean &amp; Paul</a>', width = 2000, mime = 'image/jpeg' } = {}) => ({
  title,
  imageinfo: [{ thumburl: `https://upload.wikimedia.org/${title}`, width, height: 1500, mime, descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
    extmetadata: { LicenseShortName: { value: license }, Artist: { value: artist }, LicenseUrl: { value: 'https://cc/by-sa' } } }],
})

test('fetchCommonsCandidates : ordre (image de tête d’abord), filtres licence/auteur/taille/type', async () => {
  const { impl } = router([
    [(u) => u.searchParams.get('list') === 'search', { query: { search: [{ title: 'File:S1.jpg' }, { title: 'File:NC.jpg' }, { title: 'File:Petit.jpg' }, { title: 'File:Anon.jpg' }, { title: 'File:S2.svg' }, { title: 'File:S3.jpg' }] } }],
    [(u) => u.searchParams.get('prop') === 'imageinfo', { query: { pages: [
      ii('File:S3.jpg'), ii('File:S1.jpg'), ii('File:Lead.jpg'),
      ii('File:NC.jpg', { license: 'CC BY-NC 4.0' }), ii('File:Petit.jpg', { width: 500 }), ii('File:Anon.jpg', { artist: '' }), ii('File:S2.svg', { mime: 'image/svg+xml' }),
    ] } }],
  ])
  const c = await fetchCommonsCandidates({ files: ['Lead.jpg'], search: 'Komitas' }, impl)
  assert.deepEqual(c.map((x) => x.file), ['File:Lead.jpg', 'File:S1.jpg', 'File:S3.jpg'])
  assert.equal(c[0].author, 'Jean & Paul')
  assert.equal(c[0].commonsUrl, 'https://commons.wikimedia.org/wiki/File:Lead.jpg')
})

test('stripHtml décode les entités courantes', () => {
  assert.equal(stripHtml('<span>A&nbsp;&quot;B&quot; &#39;C&#39;</span>\n'), 'A "B" \'C\'')
})

test('downloadImage : refuse une page d’erreur trop petite', async () => {
  const tiny = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(100) })
  await assert.rejects(downloadImage('https://u/x.jpg', tiny), /trop petite/)
  const err = async () => ({ ok: false, status: 403 })
  await assert.rejects(downloadImage('https://u/x.jpg', err), /HTTP 403/)
})

const claim = (value) => [{ mainsnak: { datavalue: { value } } }]
const ENTITY = { entities: { Q777: {
  labels: { fr: { value: 'Kochari' }, en: { value: 'Kochari' }, hy: { value: 'Քոչարի' }, ru: { value: 'Кочари' }, de: { value: 'Kochari' } },
  descriptions: { fr: { value: 'danse arménienne' }, en: { value: 'Armenian dance' } },
  aliases: { fr: [{ value: 'Kotchari' }], en: [{ value: 'Qochari' }, { value: 'Kochari dance' }] },
  sitelinks: { frwiki: { title: 'Kochari' }, enwiki: { title: 'Kochari (dance)' }, hywiki: { title: 'Քոչարի' }, dewiki: { title: 'Kochari' } },
  claims: { P18: claim('Kochari.jpg'), P571: claim({ time: '+1800-00-00T00:00:00Z', precision: 9 }) },
} } }

test('fetchEntity : libellés, descriptions, alias, sitelinks fr/en/hy/ru, P18, faits', async () => {
  const { impl, calls } = router([[(u) => u.host === 'www.wikidata.org', ENTITY]])
  const e = await fetchEntity('Q777', impl)
  assert.equal(calls.length, 1)
  assert.match(calls[0].u.pathname, /Special:EntityData\/Q777\.json$/)
  assert.deepEqual(e, {
    qid: 'Q777',
    labels: { fr: 'Kochari', en: 'Kochari', hy: 'Քոչարի', ru: 'Кочари' },
    descriptions: { fr: 'danse arménienne', en: 'Armenian dance' },
    aliases: { fr: ['Kotchari'], en: ['Qochari', 'Kochari dance'] },
    sitelinks: { fr: 'Kochari', en: 'Kochari (dance)', hy: 'Քոչարի', ru: undefined },
    image: 'Kochari.jpg',
    facts: ['Fondation ou création : 1800'],
  })
})

test('fetchEntity : entité minimale (rien de renseigné)', async () => {
  const { impl } = router([[() => true, { entities: { Q1: {} } }]])
  const e = await fetchEntity('Q1', impl)
  assert.equal(e.image, null)
  assert.deepEqual(e.facts, [])
  assert.deepEqual(e.aliases, { fr: [], en: [] })
})

test('resolveTitles : sitelinks, surcharge manuelle prioritaire, langue absente omise', () => {
  const entity = { sitelinks: { fr: 'Kochari', en: 'Kochari (dance)', hy: undefined, ru: undefined } }
  assert.deepEqual(resolveTitles({}, entity), { fr: 'Kochari', en: 'Kochari (dance)' })
  assert.deepEqual(resolveTitles({ wikipedia: { en: 'Kochari', ru: 'Кочари' } }, entity), { fr: 'Kochari', en: 'Kochari', ru: 'Кочари' })
})

test('hseTitle : sitelink sans parenthèse, repli sur le libellé, capitales arméniennes', () => {
  assert.equal(hseTitle({ sitelinks: { hy: 'Քոչարի (պար)' }, labels: { hy: 'Այլ' } }), 'ՀՍՀ/ՔՈՉԱՐԻ')
  assert.equal(hseTitle({ sitelinks: {}, labels: { hy: 'Կոմիտաս' } }), 'ՀՍՀ/ԿՈՄԻՏԱՍ')
  assert.equal(hseTitle({ sitelinks: {}, labels: {} }), null)
})

test('wikitextToText : modèles, références, liens, gras', () => {
  const w = "{{ՀՍՀ\n| A = {{x|y}}\n}}\n'''Կոմիտաս''' է [[երաժիշտ|կոմպոզիտոր]] և [[Երևան]]<ref>src</ref><ref name=a/>''։''"
  assert.equal(wikitextToText(w), 'Կոմիտաս է կոմպոզիտոր և Երևան։')
})

test('fetchHse : page absente → null ; contenu → texte nettoyé, licence CC BY-SA 3.0, URL hy.wikisource', async () => {
  const missing = router([[() => true, { query: { pages: [{ title: 'ՀՍՀ/X', missing: true }] } }]])
  assert.equal(await fetchHse('ՀՍՀ/X', missing.impl), null)
  const { impl, calls } = router([[(u) => u.host === 'hy.wikisource.org', {
    query: { pages: [{ title: 'ՀՍՀ/ԿՈՄԻՏԱՍ', revisions: [{ revid: 377903, slots: { main: { content: "'''ԿՈՄԻՏԱՍ''' [[հայ|հայ]] կոմպոզիտոր<ref>r</ref>" } } }] }] },
  }]])
  const r = await fetchHse('ՀՍՀ/ԿՈՄԻՏԱՍ', impl)
  assert.equal(r.kind, 'hse')
  assert.equal(r.lang, 'hy')
  assert.equal(r.revision, 377903)
  assert.equal(r.extract, 'ԿՈՄԻՏԱՍ հայ կոմպոզիտոր')
  assert.equal(r.license, 'CC BY-SA 3.0')
  assert.ok(r.url.startsWith('https://hy.wikisource.org/wiki/'))
  assert.equal(calls[0].init.headers['User-Agent'], WIKI_UA)
  assert.equal(calls[0].u.searchParams.get('rvslots'), 'main')
})
