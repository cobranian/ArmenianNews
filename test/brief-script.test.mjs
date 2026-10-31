import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowedWords, strayWords, frenchWords } from '../scripts/lib/brief-script.mjs'
import { parseBrief } from '../scripts/lib/brief-generate.mjs'

test('strayWords : les mots réellement publiés le 17 octobre 2026 sont repérés', () => {
  assert.deepEqual(
    strayWords('Զինվածային թիմի capitaine 3 մեդալ է նվաճել, ինչը նշանակում է իր individual successoffice', 'hy'),
    ['capitaine', 'individual', 'successoffice'],
  )
  assert.deepEqual(strayWords('Փաշինյանը հանդիպել է Մասudz Փեզեշքիանի հետ', 'hy'), ['Մասudz'], 'alphabets mêlés')
  assert.deepEqual(strayWords('В football — результаты матчей', 'ru'), ['football'])
})

test('strayWords : sigles, mots courts, rédactions et mots des titres sources sont permis', () => {
  assert.deepEqual(strayWords('Բացվել է COP17-ը, UNESCO-ն', 'hy'), [])
  assert.deepEqual(strayWords('Հայտնում են Armenpress-ը և CivilNet-ը', 'hy', allowedWords()), [])
  const allowed = allowedWords(['Frontiers: плохой сон может повышать риск'])
  assert.deepEqual(strayWords('Исследование Frontiers о сне', 'ru', allowed), [])
})

test('strayWords : l’inverse vaut en français et en anglais', () => {
  assert.deepEqual(strayWords('Le duduk (ծիրանափող) est un hautbois', 'fr'), ['ծիրանափող'])
  assert.deepEqual(strayWords('Le duduk (ծիրանափող) est un hautbois', 'fr', allowedWords(['ծիրանափող'])), [])
  assert.deepEqual(strayWords('Plain English text', 'en'), [])
})

const articles = [1, 2, 3, 4].map((id) => ({ id, source: 'armenpress', rubric: 'politique', title: 'Վերնագիր', url: `https://a/${id}` }))
const reply = (topics, intro = 'Օրվա ամփոփում։') => JSON.stringify({ intro, topics })
const t = (title, text, id) => ({ title, text, rubric: 'politique', ids: [id] })

test('parseBrief(lang) : écarte le sujet fautif, garde les autres, rapporte les mots', () => {
  const rejected = []
  const b = parseBrief(
    reply([t('Մեկ', 'Լավ տեքստ։', 1), t('Երկու', 'Լավ տեքստ։', 2), t('Երեք', 'Լավ տեքստ։', 3), t('Չորս', 'individual successoffice', 4)]),
    articles, 'hy', rejected,
  )
  assert.equal(b.topics.length, 3)
  assert.deepEqual(rejected, ['individual', 'successoffice'])
})

test('parseBrief(lang) : trop de sujets fautifs → null (retenté l’heure suivante)', () => {
  const bad = (id) => t('Վերնագիր', 'remporter', id)
  assert.equal(parseBrief(reply([bad(1), bad(2), t('Լավ', 'Լավ։', 3)]), articles, 'hy'), null)
})

test('parseBrief(lang) : une introduction fautive est vidée, pas la brève', () => {
  const ok = [1, 2, 3].map((id) => t('Լավ', 'Լավ տեքստ։', id))
  assert.equal(parseBrief(reply(ok, 'Թարմ լուրեր bentley'), articles, 'hy').intro, '')
  assert.equal(parseBrief(reply(ok), articles, 'hy').intro, 'Օրվա ամփոփում։')
})

test('parseBrief sans langue : comportement inchangé', () => {
  assert.equal(parseBrief(reply([1, 2, 3].map((id) => t('X', 'remporter', id))), articles).topics.length, 3)
})

test('es : frenchWords repère le français ET l\'anglais, pas l\'espagnol', () => {
  assert.deepEqual(frenchWords('La reunión también está prevista en el sur del país', 'es'), [])
  assert.ok(frenchWords('Le gouvernement a annoncé que les mesures sont prises dans la région pour les habitants avec des aides', 'es').length)
  assert.deepEqual(frenchWords('El puente que une a ambas comunidades les permitirá dialogar', 'es'), [])
  assert.ok(frenchWords('The government announced the measures with the region', 'es').length)
  assert.ok(strayWords('Ереван', 'es').length)
})
