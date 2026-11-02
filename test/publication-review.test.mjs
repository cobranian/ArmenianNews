// Les correctifs de la revue du 2 nov. 2026 sur la publication robuste :
// jamais de doublon (un échec ambigu n'est pas retenté), rien de perdu en
// silence (run coupé, plan sans résultat), un tableau de bord qui voit les
// traductions en échec, et des traductions de secours jamais fusionnées
// d'office.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANNELS, plan, settle, ledgerFailures } from '../scripts/lib/social.mjs'
import { send, isUncertain } from '../scripts/lib/social-send.mjs'
import { checkAccounts } from '../scripts/lib/account-check.mjs'
import { chatDraft, chatResilient, explain, CULTURE_FALLBACK_MODELS } from '../scripts/lib/culture-llm.mjs'
import { checkPullRequests, checkSocial, checkWorkflows } from '../scripts/lib/publication-check.mjs'

const tg = CHANNELS.find((c) => c.id === 'telegram-ch')
const fb = CHANNELS.find((c) => c.id === 'facebook-ch')
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
const pageTok = (rest) => async (url, init) =>
  url.endsWith('?fields=access_token') ? new Response(JSON.stringify({ access_token: 'P' })) : rest(url, init)

// --- Jamais de doublon

test('délai dépassé ou 5xx sur l’appel qui PUBLIE : incertain, jamais retenté', async () => {
  const timeout = pageTok(async () => {
    throw Object.assign(new Error('aborted'), { name: 'TimeoutError' })
  })
  assert.equal(isUncertain(await send(fb, item('a'), { pageId: '1', token: 'T' }, { fetch: timeout }).catch((e) => e)), true)
  const bad = pageTok(async () => new Response('{}', { status: 502 }))
  assert.equal(isUncertain(await send(fb, item('a'), { pageId: '1', token: 'T' }, { fetch: bad }).catch((e) => e)), true)
})

test('refus net (4xx), ou panne AVANT la publication : sûr, donc retenté', async () => {
  const refused = pageTok(async () => new Response(JSON.stringify({ error: { message: 'bad' } }), { status: 400 }))
  assert.equal(isUncertain(await send(fb, item('a'), { pageId: '1', token: 'T' }, { fetch: refused }).catch((e) => e)), false)
  const prep = async () => new Response('{}', { status: 503 }) // conteneur Instagram : rien n'est parti
  const err = await send(ig, item('a'), { userId: '1', token: 'T' }, { fetch: prep, wait: async () => {} }).catch((e) => e)
  assert.equal(isUncertain(err), false)
})

test('settle : un échec incertain RESTE au registre et se signale', () => {
  const r = plan({ items: [item('duduk')], channels: [tg], ledger: base(), kinds: ['culture'], now })
  const after = settle(r.ledger, [{ channel: 'telegram-ch', id: 'culture:duduk', ok: false, uncertain: true, error: 'délai' }], now)
  assert.ok('culture:duduk' in after.channels['telegram-ch'].posted, 'pas de second envoi')
  assert.deepEqual(plan({ items: [item('duduk')], channels: [tg], ledger: after, kinds: ['culture'], now }).posts, [])
  const [f] = ledgerFailures(after)
  assert.equal(f.uncertain, true)
  assert.equal(f.abandoned, false)
})

// --- Rien de perdu en silence

test('settle : un envoi prévu sans résultat (run coupé) est incertain', () => {
  const r = plan({ items: [item('duduk'), item('lavash')], channels: [tg], ledger: base(), kinds: ['culture'], now })
  const after = settle(r.ledger, [{ channel: 'telegram-ch', id: 'culture:duduk', ok: true }], now, r.posts)
  assert.deepEqual(ledgerFailures(after).map((x) => [x.id, x.uncertain]), [['culture:lavash', true]])
  assert.ok('culture:lavash' in after.channels['telegram-ch'].posted)
})

test('settle : un plan jamais poussé n’invente aucun incertain', () => {
  const r = plan({ items: [item('duduk')], channels: [tg], ledger: base(), kinds: ['culture'], now })
  assert.deepEqual(ledgerFailures(settle(base(), [], now, r.posts)), [])
})

const hourly = readFileSync('.github/workflows/hourly.yml', 'utf8').replace(/\r\n/g, '\n')
const socialJob = hourly.slice(hourly.indexOf('\n  social:'))

test('hourly.yml : le report repart de main et REFAIT settle, avec le plan', () => {
  assert.match(socialJob, /git reset -q --hard origin\/main\s*\n\s*node scripts\/social-post\.mjs settle --results "\$RUNNER_TEMP\/social-results\.jsonl" --plan "\$RUNNER_TEMP\/social-plan\.json"/)
  const snapshot = hourly.slice(hourly.indexOf('\n  snapshot:'), hourly.indexOf('\n  social:'))
  assert.match(snapshot, /git pull --rebase && git push && break/, 'le snapshot se remet à jour avant de pousser')
})

// --- Clés

const meta = (scopes, debug) => async (url) => {
  if (url.includes('debug_token')) return new Response(JSON.stringify({ data: debug ?? { is_valid: true, expires_at: 0, scopes } }))
  if (url.endsWith('?fields=access_token')) return new Response(JSON.stringify({ access_token: 'PAGE' }))
  if (url.includes('fields=name')) return new Response(JSON.stringify({ name: 'Arménie Info' }))
  return new Response('{}', { status: 500 })
}

test('une clé qui ne sert que Facebook n’a pas besoin du droit Instagram', async () => {
  const a = await checkAccounts({ FB_PAGE_ID_CH: '1', FB_PAGE_TOKEN_CH: 'U' }, { fetch: meta(['pages_manage_posts']), now })
  assert.equal(a.tokens[0].problem, undefined)
})

test('une clé que Meta dit invalide est un problème, pas un avertissement', async () => {
  const a = await checkAccounts(
    { FB_PAGE_ID_CH: '1', FB_PAGE_TOKEN_CH: 'U' },
    { fetch: meta([], { is_valid: false, error: { message: 'Session has expired' } }), now },
  )
  assert.match(a.tokens[0].problem, /invalide/)
})

// --- Modèles

const messages = [{ role: 'user', content: 'x' }]
const env = { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }
const okFrom = (model) => ({ ok: true, status: 200, json: async () => ({ model, choices: [{ message: { content: 'r' } }] }) })

test('Gemini 400 API_KEY_INVALID = clé refusée → repli', async () => {
  const fetchImpl = async (url, init) =>
    url.includes('openrouter')
      ? okFrom(JSON.parse(init.body).model)
      : { ok: false, status: 400, text: async () => '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}', json: async () => ({}) }
  const r = await chatDraft({ messages, env, fetchImpl })
  assert.equal(r.fellBack, true)
  assert.match(explain(r.primaryError), /clé refusée/)
})

test('sticky saturé → les autres secours sont essayés', async () => {
  const fetchImpl = async (url, init) => {
    const model = JSON.parse(init.body).model
    if (!url.includes('openrouter')) return { ok: false, status: 402, json: async () => ({}) }
    if (model === CULTURE_FALLBACK_MODELS[0]) return { ok: false, status: 429, json: async () => ({}) }
    return okFrom(model)
  }
  const sticky = { model: CULTURE_FALLBACK_MODELS[0], primaryError: Object.assign(new Error('x'), { status: 402 }) }
  const r = await chatResilient({ messages, env, fetchImpl, sticky })
  assert.equal(r.model, CULTURE_FALLBACK_MODELS[1])
  assert.equal(r.primaryError.status, 402)
})

// --- Tableau de bord

test('PR : culture-check en échec, ou en attente depuis trop longtemps → action', () => {
  const pr = { number: 7, title: 'Culture : X', created_at: '2026-11-02T00:00:00Z', html_url: 'u' }
  assert.ok(checkPullRequests([{ ...pr, check: { state: 'failure', description: '✗ hy' } }], now).some((r) => r.key === 'pr-7-check' && r.level === 'faire'))
  assert.ok(checkPullRequests([{ ...pr, check: { state: 'pending', updated_at: '2026-11-01T00:00:00Z' } }], now).some((r) => r.key === 'pr-7-pending'))
})

test('un envoi incertain demande une vérification, avec la commande', () => {
  const rows = checkSocial({ live: true, accounts: [], tokens: [], failures: [{ channel: 'facebook-de', id: 'culture:ani', uncertain: true, error: 'délai', abandoned: false }] })
  const r = rows.find((x) => x.key.startsWith('uncertain'))
  assert.equal(r.level, 'faire')
  assert.match(r.action, /retry --drop --channel facebook-de --item culture:ani/)
})

test('aucun brouillon réussi dans les runs lus → signalé', () => {
  const rows = checkWorkflows({ 'articles.yml': { conclusion: 'failure', at: 't', url: 'u' } }, { now, lastDraftSuccess: null })
  assert.ok(rows.some((r) => r.key === 'draft-stale'))
})

// --- Workflows

test('articles-publish : des traductions de secours ne sont pas fusionnées d’office', () => {
  const y = readFileSync('.github/workflows/articles-publish.yml', 'utf8').replace(/\r\n/g, '\n')
  assert.match(y, /grep -q "modèle de secours"[\s\S]*fallback=1/)
  assert.match(y, /- name: Contrôle final, fusion, déploiement\n\s*if: steps\.prep\.outputs\.fallback != '1'/)
})

test('social-check.yml : les secrets ne sont visibles que de l’étape qui mesure', () => {
  const y = readFileSync('.github/workflows/social-check.yml', 'utf8').replace(/\r\n/g, '\n')
  const job = y.slice(y.indexOf('\n  check:'), y.indexOf('    steps:'))
  assert.doesNotMatch(job, /FB_PAGE_TOKEN|GEMINI_API_KEY/, 'pas au niveau du job : npm ci les verrait')
  assert.match(y, /- name: Mesurer\n\s*env:[\s\S]*GEMINI_API_KEY/)
  assert.match(y, /\[tableau-de-bord-en-panne\]/)
})
