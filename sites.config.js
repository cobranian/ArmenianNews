// Source de vérité des deux vitrines. Tout en dérive : métadonnées HTML,
// hreflang, sitemaps, cibles Firebase, sélecteur de langue.
//
// Ce module est importé par le navigateur (src/) ET par Node (scripts/,
// vite.config.js). Il ne doit donc utiliser aucune API propre à l'un ou à
// l'autre — et surtout jamais importer src/i18n.jsx, qui l'importe déjà :
// le cycle casserait le bundle.

export const SITES = {
  ch: {
    id: 'ch',
    host: 'https://armenieinfo.ch',
    // Les deux vitrines vivent dans des PROJETS Firebase distincts, d'où le
    // couple site + projet. Le nom de site suffirait à `firebase deploy`
    // (il est unique mondialement), mais le projet est nécessaire au `--project`
    // et au choix du compte de service : chaque projet a le sien, et celui de
    // l'un n'a aucun droit sur l'autre. Voir la boucle de déploiement dans
    // .github/workflows/hourly.yml.
    firebaseSite: 'armenie-info',
    firebaseProject: 'armenie-info',
    brand: 'Arménie Info',
    // Autres noms sous lesquels un lecteur pourrait chercher ce site. Sur un
    // domaine tout neuf, des signaux de nom contradictoires (masthead vs.
    // JSON-LD) laissent Google deviner lequel retenir ; alternateName est le
    // pont qui rattache l'ancien nom au nouveau plutôt que de les faire
    // concurrencer. Consommé par scripts/lib/site-meta.mjs (WebSite +
    // Organization).
    alternateName: ['Armenia Info', 'Արմենիա Ինֆո'],
    email: 'contact@armenieinfo.ch',
    gscToken: 'dMoDQHq0L5w16RdNPGKom7TJZe6LNjEc7Qq4PtVjO7k',
    // Cloudflare Web Analytics — un jeton PAR VITRINE, émis dans le tableau de
    // bord Cloudflare (Analytics & Logs → Web Analytics → Add a site). Ce
    // n'est pas un secret : il part en clair dans le HTML public, il n'ouvre
    // rien, il ne fait que nommer le site qui reçoit les visites.
    //
    // Aucun des deux domaines n'est proxifié par Cloudflare (tous deux pointent
    // sur Firebase Hosting, 199.36.158.100), donc la mise en place automatique
    // au niveau de la zone n'existe pas ici : le beacon JS est la seule voie.
    cfBeaconToken: '40017296bb8845b8b659cb9cc34dae77',
    pages: [{ lang: 'fr', path: '/' }],
  },
  org: {
    id: 'org',
    host: 'https://armenianews.org',
    // Projet DIFFÉRENT de celui du .ch — c'est délibéré et c'est la raison
    // d'être de la boucle de déploiement par site : chaque projet a son propre
    // compte de service, et celui de l'un n'a aucun droit sur l'autre.
    firebaseSite: 'armenia-news-org',
    firebaseProject: 'armenia-news-b146e',
    brand: 'Armenia News',
    // Idem : le .org est la vitrine la plus récente (le rebranding), donc le
    // pont doit couvrir à la fois l'ancien nom bilingue et sa forme
    // francophone, que la marque .ch continue de porter.
    alternateName: ['Armenia Info', 'Arménie Info', 'Արմենիա Ինֆո'],
    // Le .org n'a pas encore de boîte aux lettres propre ; on annonce celle qui
    // existe réellement plutôt qu'une adresse morte dans le JSON-LD.
    email: 'contact@armenieinfo.ch',
    // Search Console : le .org est vérifié par un **enregistrement DNS TXT** sur
    // la racine du domaine, et c'est la méthode qui fait autorité ici — elle
    // couvre le domaine entier, sous-domaines compris, et survit à tout
    // redéploiement. La balise ci-dessous est une **seconde** méthode, en
    // ceinture et bretelles : si le TXT sautait un jour, la propriété tiendrait
    // encore.
    //
    // La chaîne est celle du TXT. Google documente des jetons distincts par
    // méthode, mais sur ce compte les deux méthodes du .ch partagent exactement
    // la même chaîne (`dMoDQ…` est à la fois son TXT et son `content=`), donc le
    // pari est raisonnable — et sans risque : une balise que Google ne
    // reconnaîtrait pas reste inerte, elle ne défait pas la vérification DNS.
    //
    // À confirmer dans Search Console → Paramètres → Validation du propriétaire.
    // Si la méthode « Balise HTML » n'y apparaît pas comme validée, remplacez
    // cette valeur par le `content=` que le panneau *Balise HTML* affiche —
    // c'est la seule source qui garantit qu'elle valide.
    gscToken: '5x7MZD2uxesmZ84jOvXD0qRu3JyuCYtNXrncJY9YRQs',
    // Jeton Cloudflare Web Analytics propre au .org — les trois pages
    // (en, /hy/, /ru/) le portent, puisque la balise varie par SITE et non par
    // langue.
    //
    // Ne remettez PAS le jeton du .ch ici : c'est ce que faisait l'ancienne
    // balise codée en dur dans index.html, et le résultat était que les visites
    // des deux domaines tombaient dans le tableau de bord du .ch, séparables
    // seulement en filtrant par hôte. Un jeton par site donne deux tableaux de
    // bord, ce qui est le but. `null` est accepté et n'émet aucune balise —
    // mieux vaut ne pas mesurer que mesurer au mauvais endroit.
    cfBeaconToken: 'b74469000dec4afd956cda6c161c0f55',
    pages: [
      { lang: 'en', path: '/' },
      { lang: 'hy', path: '/hy/' },
      { lang: 'ru', path: '/ru/' },
    ],
  },
}

// Ordre canonique des langues. Doit correspondre aux codes de LANGS.
// L'invariant est vérifié par test/sites-config.test.mjs et par une assertion
// au build (scripts/build-sites.mjs).
export const ALL_LANGS = ['fr', 'en', 'hy', 'ru']

// Supported interface languages. Content (articles, posts) stays in its
// original language; only the chrome is translated. Moved here from
// src/i18n.jsx because Node cannot parse JSX — the build scripts and tests
// run outside the browser and need this data as plain JavaScript.
export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն' },
  { code: 'ru', label: 'РУ', name: 'Русский' },
]

// lang -> URL absolue, slash final compris. Une seule table, consommée par le
// générateur de hreflang ET par le sélecteur de langue : ce que le HTML
// déclare à Google et ce que le bouton fait au clic ne peuvent pas diverger.
export const LANG_URL = Object.fromEntries(
  Object.values(SITES).flatMap((site) =>
    site.pages.map((page) => [page.lang, site.host + page.path]),
  ),
)

// La page servie à un visiteur dont aucune langue ne correspond.
export const X_DEFAULT = LANG_URL.en

export function primaryLang(siteId) {
  return SITES[siteId].pages[0].lang
}

export function siteOf(lang) {
  const hit = Object.values(SITES).find((s) => s.pages.some((p) => p.lang === lang))
  if (!hit) throw new Error(`langue sans site : ${lang}`)
  return hit.id
}

// Le chemin fait autorité ; à défaut, la langue de tête du domaine.
// Normalise le slash final pour que /hy et /hy/ se comportent pareil
// (Firebase redirige /hy vers /hy/ en 301) — et pour que /hydravion ne
// matche pas /hy.
export function langFromPath(siteId, pathname) {
  const site = SITES[siteId]
  const norm = pathname.endsWith('/') ? pathname : `${pathname}/`
  const hit = site.pages.find((p) => p.path !== '/' && norm.startsWith(p.path))
  return hit ? hit.lang : primaryLang(siteId)
}
