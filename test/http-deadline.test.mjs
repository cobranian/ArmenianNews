// Invariant gardé : avec `deadline`, fetchText et fetchTextNode coupent la
// socket d'un hôte qui distille ses octets (le délai d'inactivité ne se
// déclenche jamais) et ne retentent pas. Une socket restée ouverte garderait
// Node en vie : le scrape, qui finit sans process.exit, pendrait. Sans
// `deadline`, rien ne change pour les autres appelants. Serveur local seulement.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { fetchText, fetchTextNode } from '../scripts/lib/http.mjs'

let server
let port
const hits = {}

before(async () => {
  server = http.createServer((req, res) => {
    hits[req.url] = (hits[req.url] || 0) + 1
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    if (req.url.startsWith('/trickle')) {
      // Un octet toutes les 50 ms, sans fin.
      const iv = setInterval(() => res.write('x'), 50)
      res.on('close', () => clearInterval(iv))
    } else {
      // Cinq octets en 250 ms, puis fin.
      let n = 0
      const iv = setInterval(() => {
        res.write('y')
        if (++n === 5) {
          clearInterval(iv)
          res.end()
        }
      }, 50)
      res.on('close', () => clearInterval(iv))
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  port = server.address().port
})

after(async () => {
  server.closeAllConnections()
  await new Promise((r) => server.close(r))
})

const local = (opts, cb) => http.request({ ...opts, host: '127.0.0.1', port }, cb)

test('fetchTextNode : deadline coupe un hôte qui distille, sans nouvel essai', async () => {
  const t0 = Date.now()
  await assert.rejects(fetchTextNode('x', '/trickle-node', { deadline: 300, request: local }), /deadline/)
  assert.ok(Date.now() - t0 < 1500, `${Date.now() - t0} ms`)
  assert.equal(hits['/trickle-node'], 1, 'aucun essai après une échéance')
})

test('fetchTextNode : réponse à temps sous deadline, une seule requête', async () => {
  assert.equal(await fetchTextNode('x', '/ok-node', { deadline: 2000, request: local }), 'yyyyy')
  assert.equal(hits['/ok-node'], 1)
})

test('fetchTextNode sans deadline : comportement inchangé', async () => {
  assert.equal(await fetchTextNode('x', '/ok-node-plain', { request: local }), 'yyyyy')
})

test('fetchText : deadline couvre la lecture du corps, sans nouvel essai', async () => {
  const t0 = Date.now()
  await assert.rejects(fetchText(`http://127.0.0.1:${port}/trickle-text`, { deadline: 300, retries: 2 }), /deadline/)
  assert.ok(Date.now() - t0 < 1500, `${Date.now() - t0} ms`)
  assert.equal(hits['/trickle-text'], 1, 'aucun essai après une échéance')
})

test('fetchText sans deadline : comportement inchangé', async () => {
  assert.equal(await fetchText(`http://127.0.0.1:${port}/ok-text`), 'yyyyy')
})
