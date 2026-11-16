import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_LANGS } from '../sites.config.js'
import { YT_CHANNELS, YT_SCOPES, ytLangs, checkChannel, consentOutcome } from '../scripts/lib/youtube.mjs'

// Une langue sans chaîne publierait nulle part ; une chaîne en trop serait un
// compte que rien ne relie au site. Les deux listes doivent coïncider.
test('YT_CHANNELS couvre exactement les sept langues du site', () => {
  assert.deepEqual([...ytLangs()].sort(), [...ALL_LANGS].sort())
  for (const id of Object.values(YT_CHANNELS)) assert.match(id, /^UC[\w-]{22}$/)
})

test('checkChannel accepte la bonne chaîne et refuse les autres', () => {
  assert.equal(checkChannel(YT_CHANNELS.hy, YT_CHANNELS.hy), null)
  const msg = checkChannel(YT_CHANNELS.hy, YT_CHANNELS.fr)
  assert.match(msg, new RegExp(YT_CHANNELS.hy))
  assert.match(msg, new RegExp(YT_CHANNELS.fr))
  assert.match(checkChannel(YT_CHANNELS.hy, undefined), /aucune/)
})

test('les scopes sont l\'envoi et la lecture seule', () => {
  assert.equal(YT_SCOPES.length, 2)
})

// Le serveur local du consentement : une requête parasite (onglet rouvert,
// mauvais state) ne doit ni abandonner l'attente ni afficher du texte brut.
test('consentOutcome : seul le bon state décide, le reste fait attendre', () => {
  const p = (o) => new URLSearchParams(o)
  assert.deepEqual(consentOutcome(p({ state: 's', code: 'c' }), 's'), { code: 'c' })
  assert.equal(consentOutcome(p({}), 's'), null)
  assert.equal(consentOutcome(p({ state: 'faux', code: 'c' }), 's'), null)
  assert.equal(consentOutcome(p({ state: 'faux', error: 'access_denied' }), 's'), null)
  assert.equal(consentOutcome(p({ state: 's' }), 's'), null)
  assert.deepEqual(consentOutcome(p({ state: 's', error: 'x\u001b[2Jy' }), 's'), { error: '"x\\u001b[2Jy"' })
})

test('youtube-auth.mjs : le lanceur du navigateur a un écouteur d’erreur', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../scripts/youtube-auth.mjs', import.meta.url), 'utf-8')
  assert.match(src, /opener\.on\('error'/)
})
