import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES, pathFor, primaryLang, briefPath } from '../sites.config.js'
import { notFoundHtml } from '../scripts/lib/not-found.mjs'

// La page 404 est ce que Firebase sert, avec un VRAI statut 404, à toute URL
// qui ne correspond à aucun fichier — depuis le retrait du rewrite `**` →
// index.html (voir firebase.json). Avant, l'accueil répondait 200 à
// n'importe quoi : un « soft 404 » pour Google, et un doublon de l'accueil par
// URL fantaisiste. Ces tests gardent les trois propriétés qui rendent la page
// utile sans la rendre indexable.

for (const site of Object.values(SITES)) {
  const html = notFoundHtml(site.id)
  const lang = primaryLang(site.id)

  test(`404 ${site.id} : langue du domaine, noindex, marque`, () => {
    assert.ok(html.startsWith('<!doctype html>'), 'document complet')
    assert.ok(html.includes(`<html lang="${lang}">`), `<html lang="${lang}">`)
    assert.match(html, /<meta name="robots" content="noindex[^"]*">/)
    assert.ok(html.includes(site.brand), 'porte la marque de la vitrine')
    assert.ok(html.includes('<meta name="viewport"'), 'viewport')
    // Pas de canonical : une page d'erreur ne se déclare pas comme une URL —
    // elle est servie à des milliers d'adresses différentes.
    assert.ok(!html.includes('rel="canonical"'), 'aucun canonical')
  })

  test(`404 ${site.id} : mène aux trois vues de chaque langue du site`, () => {
    for (const page of site.pages) {
      for (const view of ['home', 'radio', 'agenda']) {
        const href = pathFor(page.lang, view)
        assert.ok(html.includes(`href="${href}"`), `lien vers ${href}`)
      }
      const brief = briefPath(page.lang)
      assert.ok(html.includes(`href="${brief}"`), `lien vers ${brief}`)
    }
  })

  test(`404 ${site.id} : aucune URL du voisin`, () => {
    for (const other of Object.values(SITES)) {
      if (other.id === site.id) continue
      assert.ok(!html.includes(other.host), `ne cite pas ${other.host}`)
    }
  })
}

test('le 404 du .ch mène aux vues de/it, dans leur langue', () => {
  const ch = notFoundHtml('ch')
  for (const lang of ['de', 'it']) {
    for (const view of ['home', 'radio', 'agenda', 'about']) {
      assert.ok(ch.includes(`href="${pathFor(lang, view)}" hreflang="${lang}"`), `${lang}/${view}`)
    }
    assert.ok(ch.includes(`href="${briefPath(lang)}" hreflang="${lang}"`), `brève ${lang}`)
    assert.ok(ch.includes(`<li lang="${lang}">`), `ligne ${lang}`)
  }
  assert.ok(ch.includes('Startseite'), 'chaînes allemandes')
  assert.ok(ch.includes('<a href="/it/" hreflang="it">Home</a>'), 'chaînes italiennes')
  assert.ok(!ch.includes('ß'), 'allemand à la suisse : jamais ß')
})

test('le 404 du .org mène aux vues espagnoles, dans leur langue', () => {
  const org = notFoundHtml('org')
  for (const view of ['home', 'radio', 'agenda', 'about']) {
    assert.ok(org.includes(`href="${pathFor('es', view)}" hreflang="es"`), `es/${view}`)
  }
  assert.ok(org.includes(`<li lang="es">`), 'ligne es')
})

test('chaque langue a ses chaînes, sans repli silencieux', () => {
  // La page du .org affiche une ligne par langue servie : un libellé manquant
  // retomberait sur le français sans rien dire, et le lecteur russe verrait
  // « Retour à l\'accueil ». On vérifie que chaque langue écrit la sienne.
  const org = notFoundHtml('org')
  assert.ok(org.includes('Page not found'), 'titre anglais')
  assert.ok(org.includes('Էջը չի գտնվել') || org.includes('Գլխավոր'), 'chaînes arméniennes')
  assert.ok(org.includes('Главная') || org.includes('главную'), 'chaînes russes')
  assert.ok(!org.includes('Page introuvable'), 'pas de français sur le .org')
})

test('firebase.json ne réécrit plus tout vers index.html', () => {
  // Le catch-all transformait chaque URL inconnue en accueil servi en 200.
  // Sans lui, Firebase sert 404.html avec un statut 404 et redirige toujours
  // /radio → /radio/ (c'est le comportement de répertoire, pas le rewrite).
  const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf-8'))
  for (const h of firebase.hosting) {
    const catchAll = (h.rewrites ?? []).filter((r) => r.source === '**')
    assert.equal(catchAll.length, 0, `${h.site} réécrit encore ** → ${catchAll[0]?.destination}`)
  }
})

test('firebase.json redirige les slugs jumeaux vers la vue du domaine', () => {
  // « events » existe en en/hy/ru, « agenda » en fr : un lecteur qui tape le
  // slug de l'autre langue sur le mauvais domaine doit arriver à la vue, pas
  // sur une 404. Et /fr/ n'existe nulle part (le français vit à la racine du
  // .ch) : sur le .org il renvoie au .ch.
  const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf-8'))
  const byId = Object.fromEntries(
    firebase.hosting.map((h) => [Object.values(SITES).find((s) => s.firebaseSite === h.site).id, h]),
  )
  // En `regex`, pas en `source` : le glob `/events{,/**}` de la documentation
  // ne matchait ni /events ni /events/ dans l'émulateur (vérifié le 21 août
  // 2026 — les deux répondaient 404). Une regex RE2 est sans ambiguïté, et
  // c'est elle que ce test reproduit sur les mêmes chemins.
  const redir = (siteId) =>
    Object.fromEntries((byId[siteId].redirects ?? []).map((r) => [r.regex, r]))
  const matches = (re, paths) => paths.every((p) => new RegExp(re).test(p))

  const ch = redir('ch')
  const chRe = Object.keys(ch).find((re) => matches(re, ['/events', '/events/']))
  assert.ok(chRe, 'le .ch redirige /events et /events/')
  assert.equal(ch[chRe].destination, '/agenda/')
  assert.equal(ch[chRe].type, 301)
  assert.ok(!matches(chRe, ['/eventsx']), 'la regex est ancrée')

  const org = redir('org')
  const orgRe = Object.keys(org).find((re) => matches(re, ['/agenda', '/agenda/']))
  assert.ok(orgRe, 'le .org redirige /agenda et /agenda/')
  assert.equal(org[orgRe].destination, '/events/')
  assert.equal(org[orgRe].type, 301)
  const frRe = Object.keys(org).find((re) => matches(re, ['/fr', '/fr/']))
  assert.ok(frRe, 'le .org redirige /fr et /fr/')
  assert.equal(org[frRe].destination, SITES.ch.host + '/')
  assert.equal(org[frRe].type, 301)
  assert.ok(!matches(frRe, ['/fruits/']), 'la regex est ancrée')
})

// Les vues de/it ont leurs propres slugs d'agenda : « events » tapé sous /de/
// ou /it/ du .ch doit mener à la vue, et /de/… ou /it/… tapé sur le .org — où
// ces langues n'existent pas — doit mener au même chemin sur le .ch.
// Firebase écrit ses groupes nommés en RE2 (`(?P<nom>…)`, cités `:nom` dans la
// destination) ; on les traduit en JS pour rejouer la substitution ici.
test('firebase.json redirige les slugs de/it vers leur vue et vers le .ch', () => {
  const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf-8'))
  const bySite = Object.fromEntries(firebase.hosting.map((h) => [h.site, h.redirects ?? []]))
  const toJs = (re) => new RegExp(re.replace(/\(\?P</g, '(?<'))
  // La destination qu'un chemin obtiendrait, ou null s'il ne matche aucune règle.
  const follow = (siteId, p) => {
    for (const r of bySite[SITES[siteId].firebaseSite]) {
      const m = r.regex && toJs(r.regex).exec(p)
      if (!m) continue
      // Une destination ne cite JAMAIS un groupe qui n'a pas participé : ce
      // que Firebase en ferait n'est pas documenté (vide ? « :rest » littéral ?).
      return r.destination.replace(/:([a-z]\w*|\d+)/g, (_, k) => {
        const v = m.groups?.[k] ?? m[k]
        if (v === undefined) throw new Error(`${r.regex} : ${p} laisse :${k} sans valeur`)
        return v
      })
    }
    return null
  }
  assert.equal(follow('ch', '/de/events'), '/de/veranstaltungen/')
  assert.equal(follow('ch', '/de/events/'), '/de/veranstaltungen/')
  assert.equal(follow('ch', '/it/events/'), '/it/eventi/')
  assert.equal(follow('ch', '/de/eventsx/'), null)
  assert.equal(follow('ch', '/de/'), null)

  assert.equal(follow('org', '/de'), 'https://armenieinfo.ch/de/')
  assert.equal(follow('org', '/de/'), 'https://armenieinfo.ch/de/')
  assert.equal(follow('org', '/it/radio/'), 'https://armenieinfo.ch/it/radio/')
  assert.equal(follow('org', '/de/in-kuerze/2026-10-16/'), 'https://armenieinfo.ch/de/in-kuerze/2026-10-16/')
  // L'espagnol est servi par le .org : /es/ y reste, et le .ch l'y renvoie.
  assert.equal(follow('org', '/es/'), null)
  assert.equal(follow('org', '/es/events/'), '/es/eventos/')
  assert.equal(follow('org', '/es/agenda/'), '/es/eventos/')
  assert.equal(follow('ch', '/es'), 'https://armenianews.org/es/')
  assert.equal(follow('ch', '/es/'), 'https://armenianews.org/es/')
  assert.equal(follow('ch', '/es/radio/'), 'https://armenianews.org/es/radio/')
  assert.equal(follow('org', '/design/'), null)
  assert.equal(follow('org', '/items/'), null)
  for (const r of bySite[SITES.org.firebaseSite]) assert.equal(r.type, 301)
  // Aucune règle ne peut laisser un groupe vide : chaque groupe de la
  // destination est obligatoire dans sa regex (pas de « ? » sur le groupe).
  for (const p of ['/de', '/de/', '/it/', '/de/x', '/it/eventi/']) assert.doesNotThrow(() => follow('org', p), p)

  // La sonde de production vérifie ces redirections jusqu'à leur Location :
  // un code 301 seul passerait sur une destination mal substituée.
  const wf = readFileSync(new URL('../.github/workflows/hourly.yml', import.meta.url), 'utf-8')
  for (const line of [
    'probe "https://armenieinfo.ch/de/" 200',
    'probe "https://armenieinfo.ch/it/eventi/" 200',
    'probe "https://armenieinfo.ch/de/events/" 301 "/de/veranstaltungen/"',
    'probe "https://armenianews.org/de" 301 "https://armenieinfo.ch/de/"',
    'probe "https://armenianews.org/it/eventi/" 301 "https://armenieinfo.ch/it/eventi/"',
  ]) assert.ok(wf.includes(line), line)

  // Les deux blocs `headers` restent identiques (CSP comprise) : voir CLAUDE.md.
  const [a, b] = firebase.hosting
  assert.deepEqual(a.headers, b.headers)
})
