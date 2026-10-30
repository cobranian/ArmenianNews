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
  'newsletter.newtab',
  'privacy.newsletter.title',
  'privacy.newsletter.body',
]

test('les huit clés existent dans les six langues', () => {
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

test('comptes confirmés (31 oct. 2026) : formulaire sur la seule langue de tête', () => {
  // Noms vérifiés dans Buttondown. En changer un sans créer le compte
  // publierait un formulaire qui inscrit chez un inconnu, ou nulle part.
  assert.equal(SITES.ch.newsletter.buttondown, 'armenieinfo')
  assert.equal(SITES.org.newsletter.buttondown, 'armenianews')
  for (const id of Object.keys(SITES)) {
    for (const { lang } of SITES[id].pages) {
      const action = newsletterFormAction(id, lang)
      if (lang === SITES[id].newsletter.lang) assert.equal(action, newsletterAction(id), `${id}/${lang}`)
      else assert.equal(action, null, `${id}/${lang}`)
    }
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

test('formulaire : seulement sur la langue de tête, pour chaque (vitrine, langue), compte simulé', () => {
  const sauve = {}
  for (const [id, lead] of [['ch', 'fr'], ['org', 'en']]) {
    sauve[id] = SITES[id].newsletter.buttondown
    SITES[id].newsletter.buttondown = 'compte-test'
    assert.equal(SITES[id].newsletter.lang, lead)
  }
  try {
    for (const site of Object.values(SITES)) {
      for (const page of site.pages) {
        const attendu = site.newsletter.lang === page.lang
        assert.equal(newsletterFormAction(site.id, page.lang) !== null, attendu, `${site.id}/${page.lang}`)
      }
    }
  } finally {
    for (const id of Object.keys(sauve)) SITES[id].newsletter.buttondown = sauve[id]
  }
})
