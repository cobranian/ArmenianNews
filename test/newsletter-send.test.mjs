// Invariant : un numéro part au plus une fois par semaine ISO et par vitrine
// (le registre fait foi, et un registre en avance n'envoie pas), une vitrine
// sans compte Buttondown, une semaine vide ou une vitrine sans clé n'envoie
// rien, un 2xx dont le statut n'est pas celui demandé est un échec, et la requête Buttondown reste un BROUILLON tant que NEWSLETTER_STATUS
// ne dit pas autre chose. Aucun appel réseau : on ne teste que la requête
// composée, jamais son envoi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planSends, buttondownRequest, checkCreated } from '../scripts/newsletter-send.mjs'
import { SITES } from '../sites.config.js'

const digest = (week = '2026-W45') => ({ week, subject: `Sujet ${week}`, body: '# Corps' })
const quiet = () => {}
const keys = () => true

test('semaine déjà envoyée = rien', () => {
  const r = planSends({ registry: { ch: '2026-W45' }, digests: { ch: digest() }, hasKey: keys, hasAccount: keys, log: quiet })
  assert.deepEqual(r, [])
})

test('registre en avance = rien (comparaison AAAA-Wss)', () => {
  const r = planSends({ registry: { ch: '2026-W46' }, digests: { ch: digest('2026-W45') }, hasKey: keys, hasAccount: keys, log: quiet })
  assert.deepEqual(r, [])
  // L'ordre des chaînes suit celui des semaines, passage d'année compris.
  assert.ok('2026-W53' < '2027-W01')
  assert.equal(planSends({ registry: { ch: '2026-W53' }, digests: { ch: digest('2027-W01') }, hasKey: keys, hasAccount: keys, log: quiet }).length, 1)
})

test('vitrine sans compte Buttondown : désactivée, même avec clé', () => {
  const lines = []
  const r = planSends({
    registry: {},
    digests: { ch: digest(), org: digest() },
    hasKey: keys,
    hasAccount: (id) => id === 'org',
    log: (l) => lines.push(l),
  })
  assert.deepEqual(r.map((s) => s.siteId), ['org'])
  assert.ok(lines.includes('✗ newsletter/ch: désactivée (pas de compte Buttondown)'))
})

test('par défaut, le compte est lu dans sites.config.js', () => {
  const r = planSends({ registry: {}, digests: { ch: digest(), org: digest() }, hasKey: keys, log: quiet })
  assert.deepEqual(r.map((s) => s.siteId), ['ch', 'org'])
  const avant = SITES.ch.newsletter
  const lines = []
  try {
    SITES.ch.newsletter = { ...avant, buttondown: null }
    assert.deepEqual(planSends({ registry: {}, digests: { ch: digest() }, hasKey: keys, log: (l) => lines.push(l) }), [])
    assert.ok(lines.includes('✗ newsletter/ch: désactivée (pas de compte Buttondown)'))
  } finally {
    SITES.ch.newsletter = avant
  }
})

test('semaine suivante = envoi', () => {
  const d = digest()
  const r = planSends({ registry: { ch: '2026-W44' }, digests: { ch: d }, hasKey: keys, hasAccount: keys, log: quiet })
  assert.deepEqual(r, [{ siteId: 'ch', digest: d }])
})

test('registre vide = envoi des deux vitrines', () => {
  const r = planSends({ registry: {}, digests: { ch: digest(), org: digest() }, hasKey: keys, hasAccount: keys, log: quiet })
  assert.deepEqual(r.map((s) => s.siteId), ['ch', 'org'])
})

test('digest null écarté', () => {
  const lines = []
  const r = planSends({ registry: {}, digests: { ch: null, org: digest() }, hasKey: keys, hasAccount: keys, log: (l) => lines.push(l) })
  assert.deepEqual(r.map((s) => s.siteId), ['org'])
  assert.ok(lines.some((l) => l.includes('✗ newsletter/ch') && l.includes('semaine vide')))
})

test('vitrine sans clé écartée', () => {
  const lines = []
  const r = planSends({
    registry: {},
    digests: { ch: digest(), org: digest() },
    hasKey: (id) => id === 'ch',
    hasAccount: keys,
    log: (l) => lines.push(l),
  })
  assert.deepEqual(r.map((s) => s.siteId), ['ch'])
  assert.ok(lines.some((l) => l.includes('✗ newsletter/org') && l.includes('pas de clé')))
})

test('sans hasKey, la clé est lue dans process.env (BUTTONDOWN_API_KEY_<SITE>)', () => {
  const avant = process.env.BUTTONDOWN_API_KEY_CH
  delete process.env.BUTTONDOWN_API_KEY_CH
  try {
    assert.deepEqual(planSends({ registry: {}, digests: { ch: digest() }, hasAccount: keys, log: quiet }), [])
    process.env.BUTTONDOWN_API_KEY_CH = 'k'
    assert.equal(planSends({ registry: {}, digests: { ch: digest() }, hasAccount: keys, log: quiet }).length, 1)
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

test('checkCreated : le statut rendu doit être celui demandé', () => {
  assert.equal(checkCreated('draft', { id: 'e1', status: 'draft' }), null)
  assert.equal(checkCreated('about_to_send', { status: 'about_to_send' }), null)
  assert.equal(checkCreated('draft', { status: 'sent' }), 'Buttondown a répondu « sent » au lieu de « draft »')
  assert.equal(checkCreated('draft', { id: 'e1' }), 'Buttondown a répondu « aucun statut » au lieu de « draft »')
  assert.equal(checkCreated('draft', null), 'Buttondown a répondu « aucun statut » au lieu de « draft »')
  assert.match(checkCreated('about_to_send', { status: 'draft' }), /« draft » au lieu de « about_to_send »/)
})

test('workflow : planifié seulement si NEWSLETTER_ENABLED, à :50 (hors du push horaire)', async () => {
  const { readFile } = await import('node:fs/promises')
  const yml = await readFile(new URL('../.github/workflows/newsletter.yml', import.meta.url), 'utf-8')
  assert.match(yml, /cron: '50 5 \* \* 1,2,3'/)
  assert.ok(
    yml.includes("if: github.event_name == 'workflow_dispatch' || vars.NEWSLETTER_ENABLED == 'true'"),
    'le job planifié doit être gardé par vars.NEWSLETTER_ENABLED',
  )
})
