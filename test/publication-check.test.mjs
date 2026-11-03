// Le tableau de bord de la publication (scripts/lib/publication-check.mjs,
// social-check.yml). Né le 2 nov. 2026 : le crédit Gemini était à zéro, et le
// propriétaire l'a appris en dernier. Ce qui est gardé ici : un crédit épuisé
// est dit comme une facture, une alerte notifie UNE fois, une panne sans
// secours est bloquante, et chaque workflow d'articles relance le tableau en
// cas d'échec.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  checkModels,
  checkWorkflows,
  checkPullRequests,
  checkTranslations,
  checkSocial,
  checkDeadlines,
  lastOutcome,
  renderDashboard,
  notification,
  previousAlertKeys,
  alertKeys,
  DASHBOARD_TITLE,
  checkScraper,
  scrapeFailures,
} from '../scripts/lib/publication-check.mjs'

const now = new Date('2026-11-02T12:00:00Z')
const gemini402 = { label: 'Gemini', model: 'gemini-flash-latest', ok: false, status: 402, explain: 'Gemini : crédit épuisé (HTTP 402) — rechargez' }

test('Gemini 402 avec un secours vivant : à faire, avec l’action « recharger »', () => {
  const rows = checkModels({ primary: gemini402, fallbacks: [{ model: 'a:free', ok: true }] })
  const p = rows.find((r) => r.key.startsWith('llm-primary'))
  assert.equal(p.level, 'faire')
  assert.match(p.action, /Recharger le crédit/)
})

test('Gemini 402 et aucun secours : bloquant', () => {
  const rows = checkModels({ primary: gemini402, fallbacks: [{ model: 'a:free', ok: false, explain: 'x' }] })
  assert.equal(rows.find((r) => r.key.startsWith('llm-primary')).level, 'bloquant')
})

test('Gemini vivant mais plus aucun secours : à faire', () => {
  const rows = checkModels({ primary: { label: 'Gemini', model: 'g', ok: true }, fallbacks: [{ model: 'a:free', ok: false, explain: 'x' }] })
  assert.equal(rows.find((r) => r.key === 'llm-no-fallback').level, 'faire')
})

test('lastOutcome : ignore skipped/cancelled ; un run en cours avec un job en échec compte', () => {
  const runs = [
    { status: 'in_progress', failedJob: false },
    { status: 'completed', conclusion: 'skipped' },
    { status: 'completed', conclusion: 'failure', created_at: 't', html_url: 'u' },
  ]
  assert.equal(lastOutcome(runs).conclusion, 'failure')
  assert.equal(lastOutcome([{ status: 'in_progress', failedJob: true, created_at: 't', html_url: 'u' }]).conclusion, 'failure')
  assert.equal(lastOutcome([]), null)
})

test('checkWorkflows : un brouillon sans succès depuis 48 h est signalé', () => {
  const rows = checkWorkflows({ 'articles.yml': { conclusion: 'failure', at: '2026-11-02T03:00:00Z', url: 'u' } }, { now, lastDraftSuccess: '2026-10-30T03:00:00Z' })
  assert.ok(rows.some((r) => r.key === 'wf-draft-failure' && r.level === 'faire'))
  assert.ok(rows.some((r) => r.key === 'draft-stale'))
})

test('checkPullRequests : une PR qui attend plus de 3 jours devient une action', () => {
  const pr = (n, d) => ({ number: n, title: `Culture : T${n}`, created_at: d, html_url: `u${n}` })
  const rows = checkPullRequests([pr(1, '2026-11-01T00:00:00Z'), pr(2, '2026-10-25T00:00:00Z')], now)
  assert.equal(rows[0].level, 'info')
  assert.equal(rows[1].level, 'faire')
})

test('checkTranslations : traductions manquantes et faites par un secours', () => {
  const art = (slug, langs) => ({ slug, langs })
  const rows = checkTranslations([art('a', { fr: {}, en: { model: 'gemini' } }), art('b', { fr: {}, en: { model: 'x/y:free' } })], ['en', 'de'])
  assert.ok(rows.some((r) => r.key === 'tr-missing-de' && /2 article/.test(r.text)))
  assert.ok(rows.some((r) => r.key === 'tr-fallback' && /b\/en/.test(r.text)))
})

test('checkSocial : simulation, compte mort, clé sans droit, envoi abandonné', () => {
  const rows = checkSocial({
    live: false,
    accounts: [{ channel: 'facebook-ch', problem: 'HTTP 401' }, { channel: 'telegram-ch', who: 'x' }],
    tokens: [{ secret: 'FB_PAGE_TOKEN_CH', channels: ['facebook-ch'], expiresAt: null, missing: ['pages_manage_posts'], problem: 'droits manquants' }],
    failures: [{ channel: 'instagram-hy', id: 'culture:duduk', attempts: 3, error: 'refus', abandoned: true }],
  })
  const lv = Object.fromEntries(rows.map((r) => [r.key, r.level]))
  assert.equal(lv['social-not-live'], 'bloquant')
  assert.equal(lv['acct-facebook-ch'], 'bloquant')
  assert.equal(lv['token-FB_PAGE_TOKEN_CH'], 'bloquant')
  assert.equal(lv['abandon-instagram-hy-culture:duduk'], 'faire')
  assert.match(rows.find((r) => r.key.startsWith('abandon')).action, /social-post\.mjs retry --channel instagram-hy --item culture:duduk/)
})

test('checkDeadlines : 30 jours avant, l’échéance devient une action ; passée, bloquante', () => {
  const list = [{ key: 'k', what: 'Jeton', date: '2026-11-20', how: 'renouveler' }]
  assert.equal(checkDeadlines(now, list)[0].level, 'faire')
  assert.equal(checkDeadlines(new Date('2026-12-01'), list)[0].level, 'bloquant')
  assert.equal(checkDeadlines(new Date('2026-01-01'), list)[0].level, 'ok')
})

const sections = (rows) => [{ title: 'S', rows }]

test('notification : une alerte nouvelle notifie, la même ne notifie plus', () => {
  const s = sections([{ key: 'llm-primary-402', level: 'faire', text: 'crédit', action: 'payer' }])
  const body = renderDashboard(s, { now })
  assert.deepEqual(previousAlertKeys(body), ['llm-primary-402'])
  assert.match(notification(s, []), /1 nouvelle\(s\) alerte/)
  assert.equal(notification(s, previousAlertKeys(body)), null)
})

test('notification : retour au vert annoncé une fois', () => {
  const green = sections([{ key: 'x', level: 'ok', text: 'ok' }])
  assert.match(notification(green, ['llm-primary-402']), /levées/)
  assert.equal(notification(green, []), null)
})

test('renderDashboard : en-tête, liste d’actions, marqueur d’alertes', () => {
  const s = sections([
    { key: 'b', level: 'bloquant', text: 'compte mort', action: 'recoller la clé' },
    { key: 'i', level: 'info', text: 'note' },
  ])
  const body = renderDashboard(s, { now })
  assert.match(body, /^## 🔴 1 problème/)
  assert.match(body, /- \[ \] 🔴 recoller la clé/)
  assert.deepEqual(alertKeys(s), ['b'])
  assert.match(renderDashboard(sections([{ key: 'o', level: 'ok', text: 'ok' }]), { now }), /^## ✅ Tout est en ordre/)
})

test('le workflow trouve l’issue par le même titre que la bibliothèque', () => {
  const y = readFileSync('.github/workflows/social-check.yml', 'utf8').replace(/\r\n/g, '\n')
  assert.ok(y.includes(`--title "${DASHBOARD_TITLE}"`))
  assert.match(y, /startswith\("\[tableau-de-bord\]"\)/)
  assert.ok(DASHBOARD_TITLE.startsWith('[tableau-de-bord]'))
  assert.match(y, /--author app\/github-actions/, 'dépôt public : seule l’issue du robot compte')
  assert.match(y, /cron: '17 2 \* \* \*'/, 'avant le brouillon de 03:00')
  for (const k of ['GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'SOCIAL_LIVE']) assert.ok(y.includes(`${k}: \${{`), k)
})

test('chaque workflow d’articles relance le tableau de bord en cas d’échec', () => {
  for (const f of ['articles.yml', 'articles-publish.yml', 'articles-translate.yml', 'articles-backfill.yml', 'hourly.yml']) {
    const y = readFileSync(`.github/workflows/${f}`, 'utf8').replace(/\r\n/g, '\n')
    assert.match(y, /gh workflow run social-check\.yml --ref main/, f)
    assert.match(y, /actions: write/, `${f} : permission de lancer un workflow`)
  }
})

test('checkScraper : instantané frais, sources fraîches, scrape sans échec → tout vert', () => {
  const rows = checkScraper({ generatedAt: '2026-11-02T11:23:00Z', problems: [], tracked: 30, failures: {}, now })
  assert.deepEqual(rows.map((r) => r.level), ['ok', 'ok', 'ok'])
  assert.match(rows[0].text, /37 min/)
})

test('checkScraper : instantané vieux de plus de 3 h → le scrape horaire ne tourne plus', () => {
  const [r] = checkScraper({ generatedAt: '2026-11-02T07:00:00Z', failures: {}, now })
  assert.equal(r.level, 'faire')
  assert.equal(r.key, 'scrape-stale')
  assert.match(r.action, /GH_TOKEN/)
})

test('checkScraper : une source figée devient une action, à clé stable par source', () => {
  const p = '**armenieinfotv** : article le plus récent il y a 4 j (seuil 4 j)'
  const rows = checkScraper({ generatedAt: '2026-11-02T11:23:00Z', problems: [p], failures: {}, now })
  const src = rows.find((r) => r.key.startsWith('src-'))
  assert.equal(src.key, 'src-armenieinfotv')
  assert.equal(src.level, 'faire')
  assert.ok(!rows.some((r) => r.key === 'src-ok'))
  // La même source sous une autre durée garde la même clé : pas de nouvelle notification.
  const again = checkScraper({ generatedAt: '2026-11-02T11:23:00Z', problems: [p.replace('4 j (', '5 j (')], failures: {}, now })
  assert.equal(again.find((r) => r.key.startsWith('src-')).key, 'src-armenieinfotv')
})

test('checkScraper : les échecs partiels sont une info, jamais une alerte', () => {
  const rows = checkScraper({ generatedAt: '2026-11-02T11:23:00Z', failures: { armradio: 3, asbarez: 1 }, now })
  const r = rows.find((x) => x.key === 'scrape-partial')
  assert.equal(r.level, 'info')
  assert.match(r.text, /armradio ×3, asbarez ×1/)
  assert.equal(checkScraper({ generatedAt: '2026-11-02T11:23:00Z', failures: null, now }).at(-1).level, 'info')
})

test('scrapeFailures : compte les ✗ par source, ignore la synthèse « santé »', () => {
  const log = [
    '2026-11-03T15:24:33Z   ✓ armenieinfotv/armenie (10, 10 datés)',
    '2026-11-03T15:24:40Z   ✗ armradio/news: 403 [Just a moment…]',
    '2026-11-03T15:24:41Z   ✗ armradio/politics: 403',
    '2026-11-03T15:30:05Z   ✗ résumé/hy: alphabet — https://x',
    '2026-11-03T15:31:54Z ✗ santé : 1 problème(s)',
  ].join('\n')
  assert.deepEqual(scrapeFailures(log), { armradio: 2, 'résumé': 1 })
  // Dans un journal de job, seule l'étape du scrape compte : un test qui cite
  // « ✗ au log » ou un script d'alerte qui affiche « grep '✗' » n'est pas une panne.
  const job = [
    '##[group]Run npm test',
    '✔ summarizeAgenda : une réponse vide laisse un ✗ au log',
    '##[group]Run npm run scrape',
    '  ✗ armradio/news: 403',
    '##[group]Run node scripts/health.mjs',
    '✗ brief/hy: alphabet',
  ].join('\n')
  assert.deepEqual(scrapeFailures(job), { armradio: 1 })
})
