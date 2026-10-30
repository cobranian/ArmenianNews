// Invariant : un numéro part au plus une fois par semaine ISO et par vitrine
// (le registre fait foi), une semaine vide ou une vitrine sans clé n'envoie
// rien, et la requête Buttondown reste un BROUILLON tant que NEWSLETTER_STATUS
// ne dit pas autre chose. Aucun appel réseau : on ne teste que la requête
// composée, jamais son envoi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planSends, buttondownRequest } from '../scripts/newsletter-send.mjs'

const digest = (week = '2026-W45') => ({ week, subject: `Sujet ${week}`, body: '# Corps' })
const quiet = () => {}
const keys = () => true

test('semaine déjà envoyée = rien', () => {
  const r = planSends({ registry: { ch: '2026-W45' }, digests: { ch: digest() }, hasKey: keys, log: quiet })
  assert.deepEqual(r, [])
})

test('semaine suivante = envoi', () => {
  const d = digest()
  const r = planSends({ registry: { ch: '2026-W44' }, digests: { ch: d }, hasKey: keys, log: quiet })
  assert.deepEqual(r, [{ siteId: 'ch', digest: d }])
})

test('registre vide = envoi des deux vitrines', () => {
  const r = planSends({ registry: {}, digests: { ch: digest(), org: digest() }, hasKey: keys, log: quiet })
  assert.deepEqual(r.map((s) => s.siteId), ['ch', 'org'])
})

test('digest null écarté', () => {
  const lines = []
  const r = planSends({ registry: {}, digests: { ch: null, org: digest() }, hasKey: keys, log: (l) => lines.push(l) })
  assert.deepEqual(r.map((s) => s.siteId), ['org'])
  assert.ok(lines.some((l) => l.includes('✗ newsletter/ch') && l.includes('semaine vide')))
})

test('vitrine sans clé écartée', () => {
  const lines = []
  const r = planSends({
    registry: {},
    digests: { ch: digest(), org: digest() },
    hasKey: (id) => id === 'ch',
    log: (l) => lines.push(l),
  })
  assert.deepEqual(r.map((s) => s.siteId), ['ch'])
  assert.ok(lines.some((l) => l.includes('✗ newsletter/org') && l.includes('pas de clé')))
})

test('sans hasKey, la clé est lue dans process.env (BUTTONDOWN_API_KEY_<SITE>)', () => {
  const avant = process.env.BUTTONDOWN_API_KEY_CH
  delete process.env.BUTTONDOWN_API_KEY_CH
  try {
    assert.deepEqual(planSends({ registry: {}, digests: { ch: digest() }, log: quiet }), [])
    process.env.BUTTONDOWN_API_KEY_CH = 'k'
    assert.equal(planSends({ registry: {}, digests: { ch: digest() }, log: quiet }).length, 1)
  } finally {
    if (avant === undefined) delete process.env.BUTTONDOWN_API_KEY_CH
    else process.env.BUTTONDOWN_API_KEY_CH = avant
  }
})

test('brouillon par défaut', () => {
  const d = digest()
  const { url, init } = buttondownRequest(d, { key: 'k' })
  assert.equal(url, 'https://api.buttondown.com/v1/emails')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.Authorization, 'Token k')
  assert.equal(init.headers['Content-Type'], 'application/json')
  assert.doesNotMatch(init.headers['User-Agent'], /\b(Chrome|Chromium|Firefox|Safari|Edg|OPR)\/\d/i)
  assert.deepEqual(JSON.parse(init.body), { subject: d.subject, body: d.body, status: 'draft' })
})

test('statut vide = brouillon (variable de dépôt non posée)', () => {
  assert.equal(JSON.parse(buttondownRequest(digest(), { key: 'k', status: '' }).init.body).status, 'draft')
})

test('statut explicite respecté', () => {
  const { init } = buttondownRequest(digest(), { key: 'k', status: 'about_to_send' })
  assert.equal(JSON.parse(init.body).status, 'about_to_send')
})
