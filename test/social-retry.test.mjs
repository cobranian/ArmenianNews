// Une publication ratée n'est plus perdue (2 nov. 2026). Avant, le registre
// marquait « parti » tout ce qui était tenté : quatre posts Instagram perdus
// ce jour-là sur « Media ID is not available », et la reprise se faisait à la
// main (PR #125). Désormais : `settle` remet en file ce que la plateforme a
// refusé, MAX_ATTEMPTS fois, et Instagram attend que son image soit prête.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANNELS, plan, settle, ledgerFailures, MAX_ATTEMPTS } from '../scripts/lib/social.mjs'
import { send, tokenHealth, instagramQuota, IG_READY_MS, IG_POLL_MS } from '../scripts/lib/social-send.mjs'
import { checkAccounts } from '../scripts/lib/account-check.mjs'

const tg = CHANNELS.find((c) => c.id === 'telegram-ch')
const ig = CHANNELS.find((c) => c.id === 'instagram-ch')
const item = (slug) => ({
  id: `culture:${slug}`,
  kind: 'culture',
  lang: 'fr',
  date: '2026-10-20',
  url: `https://armenieinfo.ch/culture/${slug}/`,
  title: slug,
  description: slug,
  image: { url: `https://armenieinfo.ch/culture/${slug}/image.jpg`, width: 1200, height: 868 },
})
const now = new Date('2026-11-02T12:00:00Z')
const base = () => ({ version: 1, channels: { 'telegram-ch': { seededAt: 'x', posted: {} } } })

test('un échec dit par la plateforme est retenté au run suivant', () => {
  const r1 = plan({ items: [item('duduk')], channels: [tg], ledger: base(), kinds: ['culture'], now })
  assert.equal(r1.posts.length, 1)
  const after = settle(r1.ledger, [{ channel: 'telegram-ch', id: 'culture:duduk', ok: false, error: 'HTTP 500' }], now)
  assert.equal('culture:duduk' in after.channels['telegram-ch'].posted, false)
  assert.equal(after.channels['telegram-ch'].failed['culture:duduk'].attempts, 1)
  const r2 = plan({ items: [item('duduk')], channels: [tg], ledger: after, kinds: ['culture'], now })
  assert.deepEqual(r2.posts.map((p) => p.item.id), ['culture:duduk'])
})

test('après MAX_ATTEMPTS échecs, l’article est abandonné — et signalé', () => {
  let ledger = base()
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const r = plan({ items: [item('duduk')], channels: [tg], ledger, kinds: ['culture'], now })
    assert.equal(r.posts.length, 1, `essai ${i + 1}`)
    ledger = settle(r.ledger, [{ channel: 'telegram-ch', id: 'culture:duduk', ok: false, error: 'refus' }], now)
  }
  assert.deepEqual(plan({ items: [item('duduk')], channels: [tg], ledger, kinds: ['culture'], now }).posts, [])
  const f = ledgerFailures(ledger)
  assert.equal(f.length, 1)
  assert.equal(f[0].abandoned, true)
  assert.equal(f[0].error, 'refus')
})

test('un succès efface l’échec passé, et le registre reçu n’est pas muté', () => {
  const l = base()
  l.channels['telegram-ch'].failed = { 'culture:duduk': { attempts: 1, last: 'x', error: 'e' } }
  l.channels['telegram-ch'].posted['culture:duduk'] = 'y'
  const after = settle(l, [{ channel: 'telegram-ch', id: 'culture:duduk', ok: true }], now)
  assert.equal(after.channels['telegram-ch'].failed, undefined)
  assert.equal(after.channels['telegram-ch'].posted['culture:duduk'], 'y')
  assert.ok(l.channels['telegram-ch'].failed['culture:duduk'], 'original intact')
})

// Faux Graph : le conteneur passe FINISHED après `readyAfter` lectures, et
// media_publish répond « not available » `notAvailable` fois.
const graph = ({ readyAfter = 0, notAvailable = 0 } = {}) => {
  const calls = { status: 0, publish: 0 }
  const f = async (url) => {
    if (url.endsWith('/media')) return new Response(JSON.stringify({ id: 'BOX' }))
    if (url.includes('fields=status_code')) {
      calls.status++
      return new Response(JSON.stringify({ status_code: calls.status > readyAfter ? 'FINISHED' : 'IN_PROGRESS' }))
    }
    if (url.endsWith('/media_publish')) {
      calls.publish++
      if (calls.publish <= notAvailable)
        return new Response(JSON.stringify({ error: { message: 'Media ID is not available' } }), { status: 400 })
      return new Response(JSON.stringify({ id: 'POST' }))
    }
    return new Response('{}', { status: 500 })
  }
  return { f, calls }
}
const creds = { userId: '1', token: 'T' }
const noWait = async () => {}

test('instagram : attend FINISHED au-delà des 30 s d’avant', async () => {
  const { f, calls } = graph({ readyAfter: 10 }) // 10 × 5 s = 50 s
  assert.equal(await send(ig, item('a'), creds, { fetch: f, wait: noWait }), 'POST')
  assert.equal(calls.publish, 1)
})

test('instagram : sans FINISHED, ne publie PAS (le run suivant retentera)', async () => {
  const { f, calls } = graph({ readyAfter: 1e9 })
  await assert.rejects(send(ig, item('a'), creds, { fetch: f, wait: noWait }), /pas prêt/)
  assert.equal(calls.publish, 0)
  assert.equal(calls.status, IG_READY_MS / IG_POLL_MS + 1)
})

test('instagram : « Media ID is not available » est réessayé', async () => {
  const { f, calls } = graph({ notAvailable: 2 })
  assert.equal(await send(ig, item('a'), creds, { fetch: f, wait: noWait }), 'POST')
  assert.equal(calls.publish, 3)
})

test('instagram : une autre erreur de publication n’est pas réessayée', async () => {
  let publish = 0
  const f = async (url) => {
    if (url.endsWith('/media')) return new Response(JSON.stringify({ id: 'BOX' }))
    if (url.includes('status_code')) return new Response(JSON.stringify({ status_code: 'FINISHED' }))
    publish++
    return new Response(JSON.stringify({ error: { message: '(#10) permission' } }), { status: 403 })
  }
  await assert.rejects(send(ig, item('a'), creds, { fetch: f, wait: noWait }), /permission/)
  assert.equal(publish, 1)
})

test('tokenHealth : droits manquants et échéance', async () => {
  const f = async () =>
    new Response(JSON.stringify({ data: { is_valid: true, expires_at: 1767225600, data_access_expires_at: 0, scopes: ['pages_manage_posts'] } }))
  const h = await tokenHealth('T', { fetch: f })
  assert.deepEqual(h.missing, ['instagram_content_publish'])
  assert.equal(h.expiresAt.toISOString().slice(0, 10), '2026-01-01')
  const never = async () =>
    new Response(JSON.stringify({ data: { is_valid: true, expires_at: 0, scopes: ['pages_manage_posts', 'instagram_content_publish'] } }))
  assert.deepEqual(await tokenHealth('T', { fetch: never }), { expiresAt: null, missing: [] })
  const dead = async () => new Response(JSON.stringify({ data: { is_valid: false, error: { message: 'Session has expired' } } }))
  await assert.rejects(tokenHealth('T', { fetch: dead }), /invalide.*expired/)
})

test('instagramQuota : lit l’usage sur 24 h', async () => {
  const f = async () => new Response(JSON.stringify({ data: [{ quota_usage: 12, config: { quota_total: 100 } }] }))
  assert.deepEqual(await instagramQuota(creds, { fetch: f }), { used: 12, total: 100 })
})

const meta = (scopes, expires) => async (url) => {
  if (url.includes('debug_token')) return new Response(JSON.stringify({ data: { is_valid: true, expires_at: expires, scopes } }))
  if (url.endsWith('?fields=access_token')) return new Response(JSON.stringify({ access_token: 'PAGE' }))
  if (url.includes('fields=name')) return new Response(JSON.stringify({ name: 'Arménie Info' }))
  if (url.includes('fields=username')) return new Response(JSON.stringify({ username: 'armenieinfo_ch' }))
  if (url.includes('content_publishing_limit'))
    return new Response(JSON.stringify({ data: [{ quota_usage: 3, config: { quota_total: 100 } }] }))
  return new Response('{}', { status: 500 })
}

test('checkAccounts : clé Facebook sans droit de publier = PROBLÈME, échéance proche = avertissement', async () => {
  const env = { FB_PAGE_ID_CH: '1', FB_PAGE_TOKEN_CH: 'USERTOKEN', IG_USER_ID_CH: '2' }
  const a = await checkAccounts(env, { fetch: meta(['pages_manage_posts'], 0), now })
  assert.equal(a.tokens.length, 1, 'une clé partagée n’est inspectée qu’une fois')
  assert.match(a.tokens[0].problem, /instagram_content_publish/)
  assert.ok(!a.tokens[0].problem.includes('USERTOKEN'))
  const soon = Math.floor(now.getTime() / 1000) + 5 * 86400
  const b = await checkAccounts(env, { fetch: meta(['pages_manage_posts', 'instagram_content_publish'], soon), now })
  assert.equal(b.tokens[0].problem, undefined)
  assert.match(b.tokens[0].warning, /5 jour/)
  assert.match(b.accounts.find((x) => x.channel === 'instagram-ch').who, /quota 3\/100/)
})

test('checkAccounts : Facebook sans clé de Page dérivable → problème (avant : passait)', async () => {
  const f = async (url) => {
    if (url.endsWith('?fields=access_token')) return new Response(JSON.stringify({}))
    if (url.includes('fields=name')) return new Response(JSON.stringify({ name: 'Arménie Info' }))
    if (url.includes('debug_token')) return new Response(JSON.stringify({ data: { is_valid: true, scopes: [] } }))
    return new Response('{}', { status: 500 })
  }
  const { accounts } = await checkAccounts({ FB_PAGE_ID_CH: '1', FB_PAGE_TOKEN_CH: 'U' }, { fetch: f, now })
  assert.match(accounts[0].problem, /aucune clé de Page/)
})

const hourly = readFileSync('.github/workflows/hourly.yml', 'utf8')
const socialJob = hourly.slice(hourly.indexOf('\n  social:'))

test('hourly.yml : le résultat des envois est reporté au registre, même après un échec', () => {
  assert.match(socialJob, /post --plan "\$RUNNER_TEMP\/social-plan\.json" --results "\$RUNNER_TEMP\/social-results\.jsonl"/)
  assert.match(socialJob, /if: always\(\) && env\.SOCIAL_LIVE == '1'[\s\S]*?settle --results/)
})

// Un run horaire en annulait un autre ENTRE le registre et l'envoi : tout
// était marqué parti, rien n'était envoyé. Le job social a son propre groupe,
// jamais annulé.
test('hourly.yml : le job social n’est jamais annulé par un run plus récent', () => {
  assert.match(socialJob, /concurrency:\s*\n\s*group: social\s*\n\s*cancel-in-progress: false/)
  const head = hourly.slice(0, hourly.indexOf('\njobs:'))
  assert.doesNotMatch(head, /^concurrency:/m, 'un groupe au niveau du workflow annulerait aussi le job social')
  const snapshot = hourly.slice(hourly.indexOf('\n  snapshot:'), hourly.indexOf('\n  social:'))
  assert.match(snapshot, /concurrency:\s*\n\s*group: deploy\s*\n\s*cancel-in-progress: true/)
})
