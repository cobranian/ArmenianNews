// Invariant gardé : le texte d'un article est extrait de la même façon quelle
// que soit la source (WordPress, Inertia, HTML nu), sans bruit de navigation,
// borné à MAX_TEXT, et `null` quand il n'y a rien à résumer. Aucun réseau.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractArticleText, fetchArticle, isAllowedArticleUrl, MIN_TEXT, MAX_TEXT, NODE_HOSTS } from '../scripts/lib/article-text.mjs'

const para = (n, len = 120) => `Paragraphe ${n} ` + 'x'.repeat(len - 12)

test('wordpress : corps seul, sans nav/aside/footer', () => {
  const ps = [1, 2, 3, 4].map((n) => para(n))
  const html =
    `<html><body><nav><p>${'Menu de navigation '.repeat(5)}</p></nav>` +
    `<article><div class="entry-content">${ps.map((p) => `<p>${p}</p>`).join('')}</div></article>` +
    `<aside><p>${'Publicité latérale '.repeat(5)}</p></aside>` +
    `<footer><p>${'Pied de page légal '.repeat(5)}</p></footer></body></html>`
  const out = extractArticleText(html)
  assert.equal(out, ps.join('\n'))
  assert.ok(!/Menu|Publicité|Pied/.test(out))
})

test('inertia : contenu HTML dans data-page échappé', () => {
  const A = 'Alpha ' + 'a'.repeat(160)
  const B = 'Beta ' + 'b'.repeat(160)
  const json = JSON.stringify({ props: { article: { title: 'T', content: `<p>${A}</p><p>${B}</p>` } } })
  const esc = json.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<html><body><div id="app" data-page="${esc}"></div></body></html>`
  const out = extractArticleText(html)
  assert.equal(out, `${A}\n${B}`)
  assert.ok(!/</.test(out))
})

test('fallback p : <p> directs dans body, les courts sont ignorés', () => {
  const ps = [1, 2, 3, 4, 5].map((n) => para(n))
  const html = `<html><body><p>Partager</p>${ps.map((p) => `<p>${p}</p>`).join('')}<p>Lire aussi</p></body></html>`
  assert.equal(extractArticleText(html), ps.join('\n'))
})

test('trop court : null', () => {
  const p = `<p>${'y'.repeat(30)}</p>`
  const html = `<html><body>${p}${p}${p}</body></html>`
  assert.equal(extractArticleText(html), null)
})

test('tronqué à MAX_TEXT', () => {
  const html = `<body>${Array.from({ length: 100 }, (_, i) => `<p>${para(i, 200)}</p>`).join('')}</body>`
  const out = extractArticleText(html)
  assert.ok(out.length <= MAX_TEXT)
  assert.ok(out.length >= MIN_TEXT)
})

test('fetchArticle route selon l’hôte', async () => {
  const calls = []
  const deps = {
    fetchTextNode: async (...a) => (calls.push(['node', ...a]), '<html/>'),
    fetchText: async (...a) => (calls.push(['text', ...a]), '<html/>'),
  }
  await fetchArticle('https://armenpress.am/fr/article/1', deps)
  await fetchArticle('https://www.armenews.com/x', deps)
  assert.deepEqual(calls[0], ['node', 'armenpress.am', '/fr/article/1'])
  assert.deepEqual(calls[1], ['text', 'https://www.armenews.com/x', { redirect: 'manual' }])
  assert.ok(NODE_HOSTS.has('med.news.am'))
})

test('isAllowedArticleUrl : domaines des sources seulement', () => {
  for (const u of ['https://armenpress.am/fr/article/1', 'https://www.armenews.com/x', 'https://hy.armradio.am/a'])
    assert.equal(isAllowedArticleUrl(u), true, u)
  for (const u of [
    'http://armenews.com/x',
    'https://169.254.169.254/latest',
    'https://localhost/x',
    'https://[::1]/x',
    'https://evil.example/x',
    'https://armenews.com.evil.example/x',
    'https://armenews.com:8443/x',
    'https://user:pw@armenews.com/x',
    'pas une url',
  ])
    assert.equal(isAllowedArticleUrl(u), false, u)
})

test('fetchArticle refuse une URL non admise sans rien appeler', async () => {
  let n = 0
  const deps = { fetchTextNode: async () => n++, fetchText: async () => n++ }
  await assert.rejects(fetchArticle('https://169.254.169.254/latest', deps), /URL refusée/)
  assert.equal(n, 0)
})

test('fetchArticle : www. ôté pour NODE_HOSTS seulement, hôte d’origine conservé', async () => {
  const calls = []
  const deps = { fetchTextNode: async (...a) => (calls.push(a), ''), fetchText: async () => '' }
  await fetchArticle('https://www.armenpress.am/x', deps)
  assert.deepEqual(calls[0], ['www.armenpress.am', '/x'])
})
