// Le texte d'un Short vit à côté de son article (src/data/culture/<slug>/
// short.<lang>.json). Ce fichier garde les règles qu'aucun rendu ne signale :
// 7 faits, longueurs lisibles sur un téléphone, titre YouTube sous la limite
// de 100 caractères une fois le mot-dièse ajouté, et AUCUN nombre qui ne soit
// pas dans l'article de la même langue — un chiffre inventé passerait le
// rendu, l'envoi et la relecture d'un œil pressé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import {
  SHORT_MAX_TEXT, SHORT_MAX_SPOKEN, SPOKEN_SINCE, spokenRequired, TRACK_IDS, HASHTAG, shortHash, validateShort, parseShortJson,
  shortReference, shortReferenceOf, frShortAtPublish,
} from '../scripts/lib/culture-short.mjs'

const CULTURE = new URL('../src/data/culture/', import.meta.url)
const KHOR = 'monastere-de-khor-virap-au-pied-du-mont-ararat'
const read = (slug, file) => readFile(new URL(`${slug}/${file}`, CULTURE), 'utf8')

const ARTICLE = 'En 301, le roi proclame le christianisme. La fosse fait 6 mètres, 4 000 pèlerins.'
const fact = (over = {}) => ({ eyebrow: 'Arménie', title: 'Un titre', text: 'Un texte court.', big: false, ...over })
const short = (over = {}) => ({
  facts: Array.from({ length: 7 }, () => fact()),
  outroTitle: 'Khor Virap',
  ytTitle: 'Un titre YouTube',
  ytLead: 'Une phrase qui résume.',
  music: 'mazia',
  ...over,
})
const without = (o, key) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key))
const check = (s, lang = 'fr') => validateShort(s, { lang, articleText: ARTICLE })

test('constantes : longueur, pistes, mot-dièse des sept langues', () => {
  assert.equal(SHORT_MAX_TEXT, 130)
  assert.deepEqual(TRACK_IDS, ['mazia', 'sergo', 'otar'])
  assert.deepEqual(Object.keys(HASHTAG).sort(), ['de', 'en', 'es', 'fr', 'hy', 'it', 'ru'])
  assert.equal(HASHTAG.fr, '#Arménie')
})

test('validateShort : un Short conforme ne rend aucune erreur', () => {
  assert.deepEqual(check(short()), [])
})

test('validateShort refuse 6 faits', () => {
  assert.ok(check(short({ facts: Array.from({ length: 6 }, () => fact()) })).length > 0)
})

test('validateShort : 130 caractères passent, 131 non', () => {
  const at = (n) => short({ facts: [fact({ text: 'a'.repeat(n) }), ...Array.from({ length: 6 }, () => fact())] })
  assert.deepEqual(check(at(130)), [])
  assert.ok(check(at(131)).length > 0)
})

test('validateShort : ytTitle + mot-dièse au-delà de 100 caractères est refusé', () => {
  // « <titre> #Arménie » : le titre + l'espace + le mot-dièse.
  const room = 100 - 1 - HASHTAG.fr.length
  assert.deepEqual(check(short({ ytTitle: 'a'.repeat(room) })), [])
  const over = short({ ytTitle: 'a'.repeat(room + 1) })
  assert.equal(`${over.ytTitle} ${HASHTAG.fr}`.length, 101)
  assert.ok(check(over).length > 0)
})

test('validateShort refuse un nombre absent de l’article', () => {
  const errs = check(short({ ytLead: 'Fondé en 1701.' }))
  assert.ok(errs.some((e) => e.includes('1701')), errs.join(' | '))
  // Le nombre peut être n'importe où : eyebrow, title, text, ytTitle, ytLead.
  assert.ok(check(short({ facts: [fact({ eyebrow: '1701' }), ...Array.from({ length: 6 }, () => fact())] })).length > 0)
  // Un nombre de l'article passe, quel que soit le séparateur de milliers.
  for (const n of ['301', '4 000', '4 000', '4000', '4,000', '4.000']) {
    assert.deepEqual(check(short({ ytLead: `Il y a ${n} pèlerins.` })), [], n)
  }
  // « 4,4 » est un décimal, pas un séparateur de milliers : 4 et 4 ne sont pas 44.
  assert.ok(check(short({ ytLead: 'Elle fait 44 mètres.' })).length > 0)
})

test('validateShort : music hors des trois pistes est refusée en fr, absente aussi', () => {
  assert.ok(check(short({ music: 'jazz' })).length > 0)
  const sans = without(short(), 'music')
  assert.ok(check(sans).length > 0)
})

test('validateShort : music absente hors fr est acceptée', () => {
  const sans = without(short(), 'music')
  for (const lang of ['en', 'hy', 'ru', 'de', 'it', 'es']) assert.deepEqual(check({ ...sans, sourceHash: 'x' }, lang), [], lang)
})

test('validateShort refuse un big non booléen', () => {
  assert.ok(check(short({ facts: [fact({ big: 'true' }), ...Array.from({ length: 6 }, () => fact())] })).length > 0)
})

// Le prompt interdit les URL ; le code l'exige, dans chaque champ publié.
test('validateShort refuse une URL dans n’importe quel champ', () => {
  const URL_ERR = /URL interdite/
  const withFact = (over) => short({ facts: [fact(over), ...Array.from({ length: 6 }, () => fact())] })
  for (const s of [
    withFact({ eyebrow: 'Voir https://x.am' }),
    withFact({ title: 'www.armenpress.am' }),
    withFact({ text: 'Lire sur http://exemple.org la suite.' }),
    short({ outroTitle: 'www.khorvirap.am' }),
    short({ ytTitle: 'Khor Virap https://youtu.be/x' }),
    short({ ytLead: 'Plus sur WWW.Armenie.ch.' }),
  ]) assert.ok(check(s).some((e) => URL_ERR.test(e)), JSON.stringify(s).slice(0, 80))
  assert.ok(!check(short({ ytLead: 'Un site www-libre, sans adresse.' })).some((e) => URL_ERR.test(e)))
})

test('validateShort refuse un objet qui n’en est pas un, ou un champ manquant', () => {
  assert.ok(check(null).length > 0)
  assert.ok(check([]).length > 0)
  assert.ok(check(without(short(), 'ytLead')).length > 0)
})

test('validateShort accepte le vrai Short fr de Khor Virap contre le vrai fr.md', async () => {
  const s = JSON.parse(await read(KHOR, 'short.fr.json'))
  assert.deepEqual(validateShort(s, { lang: 'fr', articleText: shortReferenceOf(await read(KHOR, 'fr.md')) }), [])
})

// Shorts publiés avant la règle des nombres, dont un nombre n'est pas écrit en
// chiffres dans l'article (« trente-six lettres », « dix mille manuscrits »…)
// ou n'y figure pas du tout (Komitas « 1914 », Cilicie en « 300 »). Ils sont
// déjà en ligne : on ne réécrit pas leurs faits ici, on les fige. Un nouveau
// nom dans cette liste est une régression ; un nom qui en sort, une correction.
// Tatev hy/ru « 9 » et Sayat-Nova es/hy/it/ru « 12 » n'y sont entrés qu'à la
// revue du 20 nov. 2026 : ces nombres n'étaient « dans l'article » que par le
// front-matter (date, sourceHash), qui ne compte plus (shortReference).
const gap = (slug, langs, numbers) => langs.map((l) => [`${slug}/short.${l}.json`, numbers])
const ALL = ['fr', 'en', 'hy', 'ru', 'de', 'it', 'es']
const KNOWN_NUMBER_GAPS = {
  ...Object.fromEntries(gap('alphabet-armenien', ALL, '36')),
  ...Object.fromEntries(gap('komitas', ALL, '3000, 1914')),
  ...Object.fromEntries(gap('lavash', ['fr', 'ru', 'it', 'es'], '6')),
  ...Object.fromEntries(gap('monastere-de-tatev', ['fr', 'en', 'de'], '10000')),
  'monastere-de-tatev/short.hy.json': '10000, 9, 14',
  'monastere-de-tatev/short.ru.json': '8, 9, 10000',
  'royaume-armenien-de-cilicie/short.en.json': '300',
  ...Object.fromEntries(gap('sayat-nova-et-la-tradition-des-ashoughs', ['fr', 'es', 'hy', 'it', 'ru'], '12')),
}

test('chaque short.<lang>.json migré est conforme à l’article de sa langue (écarts connus figés)', async () => {
  const gaps = {}
  const other = []
  for (const slug of await readdir(CULTURE)) {
    const files = (await readdir(new URL(`${slug}/`, CULTURE)).catch(() => [])).filter((f) => /^short\.\w+\.json$/.test(f))
    for (const f of files) {
      const lang = f.split('.')[1]
      const errs = validateShort(JSON.parse(await read(slug, f)), { lang, articleText: shortReferenceOf(await read(slug, `${lang}.md`)) })
      for (const e of errs) {
        const m = e.match(/^nombres absents de l’article : (.+)$/)
        if (m) gaps[`${slug}/${f}`] = m[1]
        else other.push(`${slug}/${f} : ${e}`)
      }
    }
  }
  assert.deepEqual(other, [])
  assert.deepEqual(gaps, KNOWN_NUMBER_GAPS)
})

test('shortHash : stable si les clés sont permutées, différent si un texte change', () => {
  const a = short()
  const permuted = { music: a.music, ytLead: a.ytLead, ytTitle: a.ytTitle, outroTitle: a.outroTitle, facts: a.facts.map(({ big, text, title, eyebrow }) => ({ big, text, title, eyebrow })), model: 'x' }
  assert.match(shortHash(a), /^[0-9a-f]{64}$/)
  assert.equal(shortHash(permuted), shortHash(a))
  const changed = short({ facts: [fact({ text: 'Autre texte.' }), ...a.facts.slice(1)] })
  assert.notEqual(shortHash(changed), shortHash(a))
})

test('parseShortJson : JSON nu, bloc ```json```, et refus de ce qui n’est pas un objet', () => {
  assert.deepEqual(parseShortJson('{"a":1}'), { a: 1 })
  assert.deepEqual(parseShortJson('Voici :\n```json\n{"a":1}\n```\n'), { a: 1 })
  assert.equal(parseShortJson('pas du json'), null)
  assert.equal(parseShortJson('[1,2]'), null)
  assert.equal(parseShortJson(''), null)
  assert.equal(parseShortJson(undefined), null)
})

// --- Revue du 20 nov. 2026 : une seule référence, et jamais de réécriture ---

const MD = '---\ntitle: "Komitas"\ndescription: "Le père."\ndate: 2026-10-19\nsourceHash: 4f1c9d27e8b3a6051c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b\nmodel: gemini-2.5-pro\n---\nNé en 1869.\n'

test('shortReferenceOf : titre, description, corps — jamais les chiffres du front-matter', () => {
  const ref = shortReferenceOf(MD)
  assert.equal(ref, shortReference({ title: 'Komitas', description: 'Le père.', body: 'Né en 1869.' }))
  assert.doesNotMatch(ref, /2026|4f1c9d27|2\.5/)
  // Des nombres que seul le front-matter « contenait » sont refusés.
  const s = short({ facts: [fact({ text: 'Né en 1869, 2026 et 4.' }), ...short().facts.slice(1)] })
  assert.match(validateShort(s, { lang: 'fr', articleText: ref }).join(), /nombres absents de l’article : 2026, 4/)
  assert.deepEqual(validateShort(s, { lang: 'fr', articleText: MD }), [], 'contre le .md brut, ils passaient')
  assert.equal(shortReferenceOf('pas de front-matter'), '')
})

test('frShortAtPublish : présent mais non conforme → jamais rédigé à nouveau ; absent → rédigé, sauf vidéo en ligne', () => {
  const ref = shortReferenceOf(MD)
  const bad = frShortAtPublish({ raw: JSON.stringify({ ...short(), music: 'inconnue' }), reference: ref })
  assert.equal(bad.draft, false)
  assert.equal(bad.short, null)
  assert.match(bad.problems.join(), /music/)
  assert.deepEqual(frShortAtPublish({ raw: '{pas du json', reference: ref }), { short: null, draft: false, problems: ['JSON illisible'] })
  assert.deepEqual(frShortAtPublish({ raw: null, reference: ref }), { short: null, draft: true, problems: [] })
  assert.equal(frShortAtPublish({ raw: null, reference: ref, published: true }).draft, false)
  const good = short()
  assert.deepEqual(frShortAtPublish({ raw: JSON.stringify(good), reference: ref }).short, good)
})

// --- spoken : la phrase dite, une par fait ---

const spoken = (s) => ({ ...s, facts: s.facts.map((f) => ({ ...f, spoken: 'Une phrase dite.' })) })

test('validateShort : spoken exigé quand requireSpoken', () => {
  assert.equal(SHORT_MAX_SPOKEN, 90)
  assert.deepEqual(validateShort(spoken(short()), { lang: 'fr', articleText: ARTICLE, requireSpoken: true }), [])
  assert.ok(validateShort(short(), { lang: 'fr', articleText: ARTICLE, requireSpoken: true }).some((e) => /fait 1 : spoken manquant/.test(e)))
  assert.deepEqual(check(short()), []) // ancien short, sans exigence : toujours valide
})

test('validateShort : spoken trop long, nombre inventé', () => {
  const s = spoken(short()); s.facts[0].spoken = 'x'.repeat(91)
  assert.ok(check(s).some((e) => /fait 1 : spoken de 91 caractères \(max 90\)/.test(e)))
  const n = spoken(short()); n.facts[2].spoken = 'En 1999, rien.'
  assert.ok(check(n).some((e) => /nombres absents de l’article : 1999/.test(e)))
})

test('validateShort : spoken présent sur un fait impose les 7', () => {
  const s = short(); s.facts[0] = { ...s.facts[0], spoken: 'Dit.' }
  assert.ok(check(s).some((e) => /fait 2 : spoken manquant/.test(e)))
})

test('shortHash : inchangé pour un short sans spoken, changé avec', async () => {
  const fr = JSON.parse(await read(KHOR, 'short.fr.json'))
  const en = JSON.parse(await read(KHOR, 'short.en.json'))
  assert.equal(shortHash(fr), en.sourceHash)
  assert.notEqual(shortHash(spoken(fr)), shortHash(fr))
})

test('spokenRequired : à partir de SPOKEN_SINCE', () => {
  assert.equal(spokenRequired(SPOKEN_SINCE), true)
  assert.equal(spokenRequired('2026-10-17'), false)
  assert.equal(spokenRequired(undefined), false)
})
