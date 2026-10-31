// Le pied de page annonce le flux RSS et, sur chaque langue dont la liste a
// un compte, le formulaire d'inscription à la lettre hebdomadaire (Buttondown,
// une liste par langue).
//
// Trois pièges muets gardés ici :
// - une clé absente d'un bloc STRINGS ne casse rien : t() retombe sur le
//   français, ou rend la clé elle-même ;
// - la CSP est dupliquée dans firebase.json : n'autoriser Buttondown que d'un
//   côté passe la préversion et bloque l'envoi du formulaire en production sur
//   l'autre domaine, sans la moindre erreur visible côté site ;
// - un nom de compte Buttondown deviné publierait un formulaire qui inscrit
//   chez un inconnu : tant que la liste d'une langue vaut null, aucun
//   formulaire sur cette langue ;
// - une liste par langue : le formulaire d'une page inscrit à la lettre de
//   SA langue, jamais à celle d'une autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SITES, newsletterAction, newsletterLetters } from '../sites.config.js'
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

test('les huit clés existent dans les sept langues', () => {
  assert.equal(BLOC_LANGS.length, 7)
  for (const lang of BLOC_LANGS) {
    for (const cle of CLES) {
      const v = valeur(lang, cle)
      assert.equal(typeof v, 'string', `${cle} manque dans le bloc ${lang}`)
      assert.ok(v.trim().length > 0, `${cle} est vide dans le bloc ${lang}`)
    }
  }
})

test('confidentialité : hébergement aux États-Unis et mesure des ouvertures, dans les sept langues', () => {
  const ETATS_UNIS = { fr: 'États-Unis', de: 'USA', it: 'Stati Uniti', en: 'United States', hy: 'Միացյալ Նահանգներ', ru: 'США', es: 'Estados Unidos' }
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

// Pose des comptes Buttondown le temps d'un test : SITES est l'objet que lisent
// newsletterAction, donc la logique éprouvée est celle
// du pied de page, pas une copie.
function avecListes(lists, fn) {
  const avant = {}
  for (const id of Object.keys(SITES)) avant[id] = SITES[id].newsletter
  try {
    for (const [id, l] of Object.entries(lists)) SITES[id].newsletter = { ...avant[id], lists: { ...avant[id].lists, ...l } }
    fn()
  } finally {
    for (const id of Object.keys(avant)) SITES[id].newsletter = avant[id]
  }
}

test('comptes confirmés dans les sept langues (31 oct. 2026)', () => {
  // Noms vérifiés dans Buttondown. En poser un sans créer le compte
  // publierait un formulaire qui inscrit chez un inconnu, ou nulle part.
  assert.deepEqual(SITES.ch.newsletter.lists, { fr: 'armenieinfo', de: 'armenieinfo-de', it: 'armenieinfo-it' })
  assert.deepEqual(SITES.org.newsletter.lists, { en: 'armenianews', es: 'armenianews-es', hy: 'armenianews-hy', ru: 'armenianews-ru' })
})

// Les langues sans lettre, nommées : toute autre langue sans liste fait
// échouer le test. Vide depuis le compte espagnol (31 oct. 2026).
const SANS_LETTRE = []

test('une liste déclarée pour CHAQUE langue de chaque vitrine (sauf SANS_LETTRE), et aucune autre', () => {
  for (const site of Object.values(SITES))
    assert.deepEqual(
      Object.keys(site.newsletter.lists).sort(),
      site.pages.map((p) => p.lang).filter((l) => !SANS_LETTRE.includes(l)).sort(),
      site.id,
    )
})

test('identifiants des lettres : ch et org pour fr et en (registre et secrets d’avant), la langue sinon', () => {
  const ids = Object.fromEntries(newsletterLetters().map((l) => [l.lang, l.id]))
  assert.deepEqual(ids, { fr: 'ch', de: 'de', it: 'it', en: 'org', es: 'es', hy: 'hy', ru: 'ru' })
  // Indépendants de l'ordre des pages : réordonner ne déplace pas la clé `org`.
  const avant = SITES.org.pages
  try {
    SITES.org.pages = [...avant].reverse()
    assert.equal(newsletterLetters().find((l) => l.lang === 'en').id, 'org')
    assert.equal(newsletterLetters().find((l) => l.lang === 'ru').id, 'ru')
  } finally {
    SITES.org.pages = avant
  }
})

test('newsletterAction : l’URL du compte de LA langue, null sans compte', () => {
  avecListes({ ch: { de: 'compte-de', it: null } }, () => {
    assert.equal(newsletterAction('ch', 'de'), 'https://buttondown.com/api/emails/embed-subscribe/compte-de')
    assert.equal(newsletterAction('ch', 'fr'), 'https://buttondown.com/api/emails/embed-subscribe/armenieinfo')
    assert.equal(newsletterAction('ch', 'it'), null)
    assert.equal(newsletterAction('ch', 'en'), null, 'une langue hors de la vitrine')
  })
})

test('formulaire : sur chaque page dont la liste a un compte, vers SA liste', () => {
  for (const site of Object.values(SITES))
    for (const page of site.pages) {
      if (SANS_LETTRE.includes(page.lang)) continue
      const attendu = site.newsletter.lists[page.lang]
      assert.equal(newsletterAction(site.id, page.lang), attendu ? newsletterAction(site.id, page.lang) : null, `${site.id}/${page.lang}`)
    }
  avecListes({ ch: { de: 'x-de', it: 'x-it' }, org: { hy: 'x-hy', ru: 'x-ru' } }, () => {
    for (const site of Object.values(SITES))
      for (const page of site.pages) {
        if (SANS_LETTRE.includes(page.lang)) {
          assert.equal(newsletterAction(site.id, page.lang), null, `${site.id}/${page.lang} : pas de formulaire`)
          continue
        }
        const action = newsletterAction(site.id, page.lang)
        assert.ok(action?.endsWith(`/${SITES[site.id].newsletter.lists[page.lang]}`), `${site.id}/${page.lang}`)
      }
  })
})

test('le pied de page passe par newsletterAction(SITE_ID, lang)', async () => {
  const src = await readFile(new URL('../src/components/Footer.jsx', import.meta.url), 'utf-8')
  // La langue de la PAGE : une autre ferait inscrire à la lettre d'une autre langue.
  assert.match(src, /newsletterAction\(SITE_ID, lang\)/)
  assert.equal(src.match(/newsletterAction\(/g).length, 1)
})

test('chaque secret de lettre est déclaré dans newsletter.yml', async () => {
  const yml = await readFile(new URL('../.github/workflows/newsletter.yml', import.meta.url), 'utf-8')
  for (const { id } of newsletterLetters()) {
    const nom = `BUTTONDOWN_API_KEY_${id.toUpperCase()}`
    assert.ok(yml.includes(`${nom}: \${{ secrets.${nom} }}`), `${nom} absent de newsletter.yml`)
  }
})
