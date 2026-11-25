// translateShort : la traduction du Short d'une langue, modèle injecté (aucun
// réseau). Elle ne rend un short qu'après validateShort contre l'article de la
// langue et la garde d'alphabet ; sinon elle lève, et l'appelant écrit une
// ligne « ✗ <lang> vidéo » sans toucher à l'article.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translateShort } from '../scripts/lib/culture-short-translate.mjs'
import { shortHash, validateShort } from '../scripts/lib/culture-short.mjs'

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
