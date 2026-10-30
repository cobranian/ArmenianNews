// Le pied de page annonce le flux RSS et, sur la langue de tête de chaque
// vitrine, le formulaire d'inscription à la lettre hebdomadaire (Buttondown).
//
// Trois pièges muets gardés ici :
// - une clé absente d'un bloc STRINGS ne casse rien : t() retombe sur le
//   français, ou rend la clé elle-même ;
// - la CSP est dupliquée dans firebase.json : n'autoriser Buttondown que d'un
//   côté passe la préversion et bloque l'envoi du formulaire en production sur
//   l'autre domaine, sans la moindre erreur visible côté site ;
// - un nom de compte Buttondown deviné publierait un formulaire qui inscrit
//   chez un inconnu : tant que `buttondown` vaut null, aucun formulaire ;
// - la lettre est écrite dans UNE langue par vitrine : si elle divergeait de
//   la langue de tête, le formulaire s'afficherait sur une page dont la lettre
//   n'est pas dans sa langue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SITES, newsletterAction, newsletterFormAction, primaryLang } from '../sites.config.js'
import { BLOC_LANGS, valeur } from './helpers/i18n-blocks.mjs'

const CLES = [
  'footer.rss',
  'newsletter.title',
  'newsletter.label',
  'newsletter.submit',
  'newsletter.note',
  'privacy.newsletter.title',
  'privacy.newsletter.body',
]

test('les sept clés existent dans les six langues', () => {
  assert.equal(BLOC_LANGS.length, 6)
  for (const lang of BLOC_LANGS) {
    for (const cle of CLES) {
      const v = valeur(lang, cle)
      assert.equal(typeof v, 'string', `${cle} manque dans le bloc ${lang}`)
      assert.ok(v.trim().length > 0, `${cle} est vide dans le bloc ${lang}`)
    }
  }
})

test('confidentialité : hébergement aux États-Unis et mesure des ouvertures, dans les six langues', () => {
  const ETATS_UNIS = { fr: 'États-Unis', de: 'USA', it: 'Stati Uniti', en: 'United States', hy: 'Միացյալ Նահանգներ', ru: 'США' }
  for (const lang of BLOC_LANGS) {
    const v = valeur(lang, 'privacy.newsletter.body')
    assert.ok(v.includes(ETATS_UNIS[lang]), `${lang} : l'hébergement aux États-Unis n'est pas dit`)
    assert.ok(v.split('Buttondown').length - 1 >= 2, `${lang} : la politique de Buttondown n'est pas citée`)
  }
})

test('CSP : buttondown autorisé des deux côtés', async () => {
  const fb = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf-8'))
  const cibles = fb.hosting
  assert.equal(cibles.length, 2)
  for (const cible of cibles) {
    const csp = cible.headers
      .flatMap((h) => h.headers)
      .filter((h) => h.key === 'Content-Security-Policy')
      .map((h) => h.value)
    assert.ok(csp.length > 0, `${cible.site} : aucune CSP`)
    for (const v of csp) {
      assert.ok(
        v.includes("form-action 'self' https://buttondown.com"),
        `${cible.site} : form-action n'autorise pas Buttondown`,
      )
    }
  }
})

// Pose un compte Buttondown le temps d'un test : SITES est l'objet que lisent
// newsletterAction et newsletterFormAction, donc la logique éprouvée est celle
// du pied de page, pas une copie.
function avecCompte(siteId, buttondown, fn) {
  const avant = SITES[siteId].newsletter
  try {
    SITES[siteId].newsletter = { ...avant, buttondown }
    fn()
  } finally {
    SITES[siteId].newsletter = avant
  }
}

test('aucun compte confirmé : ni action ni formulaire, sur aucune page', () => {
  for (const id of Object.keys(SITES)) {
    assert.equal(SITES[id].newsletter.buttondown, null, `${id} : compte Buttondown non confirmé posé`)
    assert.equal(newsletterAction(id), null)
    for (const { lang } of SITES[id].pages) assert.equal(newsletterFormAction(id, lang), null, `${id}/${lang}`)
  }
})

test('newsletterAction : URL Buttondown une fois le compte posé, null sans lettre', () => {
  avecCompte('ch', 'compte-test', () => {
    assert.equal(newsletterAction('ch'), 'https://buttondown.com/api/emails/embed-subscribe/compte-test')
  })
  const avant = SITES.ch.newsletter
  try {
    SITES.ch.newsletter = null
    assert.equal(newsletterAction('ch'), null)
    assert.equal(newsletterFormAction('ch', 'fr'), null)
  } finally {
    SITES.ch.newsletter = avant
  }
})

test('compte posé : formulaire sur la seule langue de la lettre', () => {
  for (const id of Object.keys(SITES)) {
    avecCompte(id, 'compte-test', () => {
      for (const { lang } of SITES[id].pages) {
        const action = newsletterFormAction(id, lang)
        if (lang === SITES[id].newsletter.lang) assert.equal(action, newsletterAction(id), `${id}/${lang}`)
        else assert.equal(action, null, `${id}/${lang} : formulaire hors de la langue de la lettre`)
      }
    })
  }
})

test('le pied de page passe par newsletterFormAction', async () => {
  const src = await readFile(new URL('../src/components/Footer.jsx', import.meta.url), 'utf-8')
  assert.match(src, /newsletterFormAction\(SITE_ID, lang\)/)
  assert.ok(!src.includes('newsletterAction('), 'le pied de page contourne la garde du compte')
})

test('langue de la lettre = langue de tête de la vitrine', () => {
  assert.equal(SITES.ch.newsletter.lang, primaryLang('ch'))
  assert.equal(SITES.org.newsletter.lang, primaryLang('org'))
})
