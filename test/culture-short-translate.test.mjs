// translateShort : la traduction du Short d'une langue, modèle injecté (aucun
// réseau). Elle ne rend un short qu'après validateShort contre l'article de la
// langue et la garde d'alphabet ; sinon elle lève, et l'appelant écrit une
// ligne « ✗ <lang> vidéo » sans toucher à l'article.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translateShort } from '../scripts/lib/culture-short-translate.mjs'
import { shortHash, validateShort, needSpoken, shortNeedsTranslation } from '../scripts/lib/culture-short.mjs'

const fr = {
  facts: Array.from({ length: 7 }, (_, i) => ({ eyebrow: 'Arménie', title: `Fait ${"abcdefg"[i]}`, text: 'Un texte en 2005.', spoken: 'Un texte dit en 2005.', big: false })),
  outroTitle: 'Le duduk', ytTitle: 'Le duduk', ytLead: 'Un hautbois.', music: 'otar',
}
const en = {
  facts: Array.from({ length: 7 }, (_, i) => ({ eyebrow: 'Armenia', title: `Fact ${"abcdefg"[i]}`, text: 'A short text from 2005.', spoken: 'A text said in 2005.', big: false })),
  outroTitle: 'The duduk', ytTitle: 'The duduk', ytLead: 'An oboe from Armenia.',
}
const article = 'The duduk, listed by UNESCO in 2005.'
const chatOf = (obj, model = 'gemini') => async () => ({ text: JSON.stringify(obj), model, fellBack: false })

test('translateShort : short traduit, sourceHash du fr, model, sans music', async () => {
  const r = await translateShort({ lang: 'en', shortFr: fr, articleText: article, chat: chatOf({ ...en, music: 'otar' }) })
  assert.equal(r.short.sourceHash, shortHash(fr))
  assert.equal(r.short.model, 'gemini')
  assert.equal('music' in r.short, false)
  assert.deepEqual(validateShort(r.short, { lang: 'en', articleText: article }), [])
})

test('translateShort : nombre absent de l’article de la langue → refusé', async () => {
  const bad = { ...en, ytLead: 'An oboe from 1915.' }
  await assert.rejects(translateShort({ lang: 'en', shortFr: fr, articleText: article, chat: chatOf(bad) }), /non conforme.*nombres absents/)
})

test('translateShort : réponse illisible, et alphabet latin glissé dans l’arménien', async () => {
  await assert.rejects(translateShort({ lang: 'en', shortFr: fr, articleText: article, chat: async () => ({ text: 'pas du json', model: 'm' }) }), /illisible/)
  // `en` dans une réponse hy : la garde d'alphabet refuse du latin dans l'arménien
  await assert.rejects(translateShort({ lang: 'hy', shortFr: fr, articleText: article, chat: chatOf(en) }), /alphabet|non conforme/)
})

test('translateShort : le sticky est transmis au modèle injecté, et fellBack remonte', async () => {
  const sticky = { model: 'secours' }
  let seen
  const chat = async (o) => { seen = o; return { text: JSON.stringify(en), model: 'secours', fellBack: true } }
  const r = await translateShort({ lang: 'en', shortFr: fr, articleText: article, chat, sticky })
  assert.equal(seen.sticky, sticky)
  assert.equal(r.fellBack, true)
})

test('translateShort : traduction sans spoken refusée ; latin dans le spoken arménien refusé', async () => {
  const sans = { ...en, facts: en.facts.map((f) => ({ ...f, spoken: undefined })) }
  await assert.rejects(translateShort({ lang: 'en', shortFr: fr, articleText: article, chat: chatOf(sans) }), /spoken/)
  const hy = {
    facts: en.facts.map((f) => ({ ...f, eyebrow: 'Հայաստան', title: 'Դուդուկ', text: 'Դուդուկը 2005 թվականին։', spoken: 'Դուդուկը 2005 թվականին the oboe whistle։' })),
    outroTitle: 'Դուդուկ', ytTitle: 'Դուդուկ', ytLead: 'Հոբոյ։',
  }
  await assert.rejects(translateShort({ lang: 'hy', shortFr: fr, articleText: article, chat: chatOf(hy) }), /alphabet/)
})

// needSpoken, un seul verdict (revue finale du 25 nov. 2026) : la traduction
// d'un article ANCIEN (Short français sans voix, date avant SPOKEN_SINCE) n'a
// pas à inventer de phrase dite — articles-backfill.yml en rattrape chaque semaine.
const sansVoix = (s) => ({ ...s, facts: s.facts.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'spoken'))) })

test('translateShort : article ancien (fr sans spoken) → traduction sans spoken acceptée, prompt sans spoken', async () => {
  const frOld = sansVoix(fr)
  let seen
  const chat = async (o) => { seen = o; return { text: JSON.stringify(sansVoix(en)), model: 'gemini' } }
  const r = await translateShort({ lang: 'en', shortFr: frOld, articleText: article, chat, requireSpoken: needSpoken(frOld, '2026-10-17') })
  assert.equal(r.short.facts.some((f) => 'spoken' in f), false)
  assert.doesNotMatch(seen.messages[0].content, /spoken/)
  // Sans `requireSpoken` explicite : le même verdict, tiré du Short français.
  await translateShort({ lang: 'en', shortFr: frOld, articleText: article, chat })
})

test('fr avec spoken : traduction sans spoken refusée, et shortNeedsTranslation la dit à refaire', async () => {
  const requireSpoken = needSpoken(fr, '2026-10-17')
  assert.equal(requireSpoken, true)
  await assert.rejects(translateShort({ lang: 'en', shortFr: fr, articleText: article, chat: chatOf(sansVoix(en)), requireSpoken }), /spoken/)
  const ctx = { want: shortHash(fr), lang: 'en', articleText: article, requireSpoken }
  assert.equal(shortNeedsTranslation({ ...sansVoix(en), sourceHash: shortHash(fr) }, ctx), true)
  assert.equal(shortNeedsTranslation({ ...en, sourceHash: shortHash(fr) }, ctx), false)
  // Article ancien, ni voix ni date : la même traduction sans voix est à jour.
  const frOld = sansVoix(fr)
  const old = { want: shortHash(frOld), lang: 'en', articleText: article, requireSpoken: needSpoken(frOld, '2026-10-17') }
  assert.equal(shortNeedsTranslation({ ...sansVoix(en), sourceHash: shortHash(frOld) }, old), false)
})
