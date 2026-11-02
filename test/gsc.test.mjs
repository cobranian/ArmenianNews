// Google Search Console (scripts/lib/gsc.mjs) : les propriétés sont de
// DOMAINE (sc-domain:), l'assertion JWT est signée sans dépendance, et le
// pas est branché après IndexNow, sans pouvoir faire échouer le déploiement.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { siteProperty, submitUrl, parseServiceAccount, jwtAssertion, GSC_SCOPE, TOKEN_URL } from '../scripts/lib/gsc.mjs'
import { checkIndexing } from '../scripts/lib/publication-check.mjs'

test('propriétés de domaine, sitemap désigné par son URL complète', () => {
  assert.equal(siteProperty('https://armenieinfo.ch'), 'sc-domain:armenieinfo.ch')
  assert.equal(
    submitUrl('https://armenianews.org'),
    'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aarmenianews.org/sitemaps/https%3A%2F%2Farmenianews.org%2Fsitemap.xml',
  )
})

test('secret absent → null (pas sauté) ; secret incomplet → erreur', () => {
  assert.equal(parseServiceAccount(undefined), null)
  assert.equal(parseServiceAccount('  '), null)
  assert.throws(() => parseServiceAccount('{"client_email":"x"}'), /incomplète/)
})

test('assertion JWT RS256 vérifiable, bons scope et audience', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const sa = { client_email: 'gsc@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }
  const jwt = jwtAssertion(sa, 1000)
  const [h, c, s] = jwt.split('.')
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url')))
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString())
  assert.deepEqual(claims, { iss: sa.client_email, scope: GSC_SCOPE, aud: TOKEN_URL, iat: 1000, exp: 4600 })
})

test('hourly.yml : Google après IndexNow, même écart, secret seulement à cette étape', () => {
  const y = readFileSync('.github/workflows/hourly.yml', 'utf8').replace(/\r\n/g, '\n')
  const i = y.indexOf('IndexNow — soumettre les pages nouvelles')
  const g = y.indexOf('Google — renvoyer les sitemaps changés')
  assert.ok(i > 0 && g > i)
  assert.match(y.slice(g), /^[^\n]*\n\s*if: success\(\)\n\s*env:\n\s*GSC_SERVICE_ACCOUNT: \$\{\{ secrets\.GSC_SERVICE_ACCOUNT \}\}\n\s*run: node scripts\/gsc-sitemaps\.mjs --since "\$RUNNER_TEMP\/sitemaps-avant"/)
  assert.equal(y.match(/GSC_SERVICE_ACCOUNT: \$\{\{/g).length, 1)
})

test('tableau de bord : Google non branché = action à faire', () => {
  assert.equal(checkIndexing({ gscConfigured: false }).find((r) => r.key === 'idx-google-off').level, 'faire')
  assert.equal(checkIndexing({ gscConfigured: true }).find((r) => r.key === 'idx-google').level, 'ok')
})
