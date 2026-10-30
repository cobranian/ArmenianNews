// Le pied de page annonce le flux RSS et, sur la langue de tête de chaque
// vitrine, le formulaire d'inscription à la lettre hebdomadaire (Buttondown).
//
// Trois pièges muets gardés ici :
// - une clé absente d'un bloc STRINGS ne casse rien : t() retombe sur le
//   français, ou rend la clé elle-même ;
// - la CSP est dupliquée dans firebase.json : n'autoriser Buttondown que d'un
//   côté passe la préversion et bloque l'envoi du formulaire en production sur
//   l'autre domaine, sans la moindre erreur visible côté site ;
// - la lettre est écrite dans UNE langue par vitrine : si elle divergeait de
//   la langue de tête, le formulaire s'afficherait sur une page dont la lettre
//   n'est pas dans sa langue.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SITES, newsletterAction, primaryLang } from '../sites.config.js'
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

test('newsletterAction', () => {
  for (const id of Object.keys(SITES)) {
    assert.ok(
      newsletterAction(id).startsWith('https://buttondown.com/api/emails/embed-subscribe/'),
      `${id} : action inattendue`,
    )
  }
  const avant = SITES.ch.newsletter
  try {
    SITES.ch.newsletter = null
    assert.equal(newsletterAction('ch'), null)
  } finally {
    SITES.ch.newsletter = avant
  }
})

test('langue de la lettre = langue de tête de la vitrine', () => {
  assert.equal(SITES.ch.newsletter.lang, primaryLang('ch'))
  assert.equal(SITES.org.newsletter.lang, primaryLang('org'))
})
