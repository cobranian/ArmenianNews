import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Les jeux (public/play/**) chargent le SDK Firebase depuis gstatic et parlent
// à une Realtime Database : la CSP doit l'autoriser, et le bloc `headers` est
// DUPLIQUÉ entre les deux sites — un hôte ajouté d'un seul côté passe la
// préversion et casse la production de l'autre domaine. Ce test exige les deux
// côtés, identiques, et les en-têtes de /play/** (jamais indexé, jamais caché
// longuement : les fichiers ne portent pas de nom à empreinte).

const cfg = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'))
const entries = cfg.hosting

const directive = (csp, name) =>
  csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' ')) || ''
const cspOf = (e) =>
  e.headers.find((h) => h.source === '**').headers.find((h) => h.key === 'Content-Security-Policy').value

test('firebase.json : deux sites', () => assert.equal(entries.length, 2))

entries.forEach((e) => {
  const csp = cspOf(e)
  test(`${e.site} : script-src autorise gstatic`, () => {
    assert.ok(directive(csp, 'script-src').split(/\s+/).includes('https://www.gstatic.com'))
  })
  test(`${e.site} : connect-src autorise Realtime Database et auth anonyme`, () => {
    const c = directive(csp, 'connect-src').split(/\s+/)
    for (const h of [
      'https://*.firebasedatabase.app',
      'wss://*.firebasedatabase.app',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
    ]) assert.ok(c.includes(h), h)
  })
  test(`${e.site} : /play/** noindex, no-cache, et APRÈS la règle de cache générale`, () => {
    const i = e.headers.findIndex((h) => h.source === 'play/**')
    assert.ok(i >= 0, 'règle play/**')
    const get = (k) => e.headers[i].headers.find((h) => h.key === k)?.value
    assert.equal(get('Cache-Control'), 'no-cache')
    assert.equal(get('X-Robots-Tag'), 'noindex')
    // Les dossiers (play/echecs/) et .html matchent la règle regex à
    // s-maxage=3600 : la règle play/** doit venir après pour l'emporter.
    const j = e.headers.findIndex((h) => h.regex)
    assert.ok(i > j, 'play/** après la règle regex')
  })
})

test('les deux CSP sont identiques', () => {
  assert.equal(cspOf(entries[0]), cspOf(entries[1]))
})
