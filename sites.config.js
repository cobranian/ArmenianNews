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
    // Carte de partage (og:image), propre à la vitrine : elle porte la marque
    // ET la langue du domaine, donc elle ne peut pas être partagée. Chemin
    // depuis la racine du domaine ; le fichier vit dans public/.
    //
    // Les deux noms sont désormais SYMÉTRIQUES — `-ch` et `-org`. Le .ch a
    // longtemps gardé `og-image.jpg` tout court, parce qu'une URL déjà en
    // cache chez Facebook et WhatsApp n'a rien à gagner à changer de nom. Le
    // calcul s'est inversé le 1er août 2026 : la carte a été redessinée
    // (l'Ararat se regarde depuis l'Arménie, cf. CLAUDE.md) et il fallait au
    // contraire que les scrapers cessent de resservir l'ancienne. Un nom neuf
    // est le seul levier ; il n'existe aucun outil public pour purger ces
    // caches. C'est exactement le raisonnement qu'avait suivi le .org.
    //
    // `public/og-image.jpg` SUBSISTE et ne doit pas être supprimé : plus
    // aucune page ne le référence, mais des aperçus en circulation le
    // pointent encore. Firebase réécrit tout chemin manquant vers index.html
    // et le sert en 200 — un scraper y verrait donc une image cassée plutôt
    // qu'un 404 franc. Le fichier porte le MÊME dessin que `og-image-ch.jpg`
    // au jour de la bascule ; il n'est plus régénéré (og-image.mjs écrit sur
    // `ogImage`), et c'est sans conséquence : son seul rôle est de répondre.
    ogImage: '/og-image-ch.jpg',
    // Pages autonomes de cette vitrine : un HTML complet hors du bundle React,
    // copié de `pages/<nom>.<siteId>.html` vers `dist/<siteId>/<nom>.html`.
    // La liste est PAR SITE et non globale — le .org n'a pas d'équivalent de
    // `lien-fr`, et une liste unique l'y ferait chercher un fichier absent.
    //
    // `lien` affiche armenieinfo.ch, le domaine qui la sert : son URL et son
    // contenu concordent. `lien-fr` est la même carte tournée vers le public
    // français, qui affiche armenieinfo.fr — d'où son `noindex`, c'est une
    // variante de ciblage, pas une seconde page à indexer.
    standalone: ['lien', 'lien-fr'],
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
    // Google Analytics 4 — un ID de mesure PAR VITRINE, exactement pour la même
    // raison que le jeton Cloudflare juste au-dessus. Celui-ci est l'historique :
    // il désigne la propriété « Arménie Info » (compte 401602985, propriété
    // 546187480), qui a des données depuis juillet 2026. Ne le changez pas —
    // repointer le .ch ailleurs abandonnerait son historique sur place.
    //
    // Il était autrefois écrit EN DUR dans index.html ET public/ga-init.js,
    // deux fichiers que Vite copie à l'identique dans les deux dist/ : les
    // visites d'armenianews.org tombaient donc dans le tableau de bord du .ch,
    // /hy/ et /ru/ compris. Même piège que le beacon, la carte de partage et
    // les pages `lien.html` — un fichier partagé ne peut pas porter une valeur
    // propre à une vitrine.
    gaMeasurementId: 'G-EB3W5XXSMW',
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
    // Carte de partage ANGLAISE — voir le commentaire du .ch pour la raison des
    // deux noms différents. Régénérer avec `npm run og-image`.
    ogImage: '/og-image-org.jpg',
    // Une seule carte ici : le .org n'a pas de domaine de vanité à mettre en
    // avant, contrairement au .ch et à son armenieinfo.fr.
    standalone: ['lien'],
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
    // Propriété « Armenia News » (compte 401602985, propriété 547487332), flux
    // « Armenia News — Web » sur https://armenianews.org. Créée le 29 juillet
    // 2026 : elle démarre donc vide, alors que le trafic .org d'avant cette date
    // — /hy/ et /ru/ compris — reste dans la propriété « Arménie Info ». Cette
    // coupure est attendue, ce n'est pas une perte.
    //
    // Ne remettez PAS l'ID du .ch ici : c'est précisément ce que faisait la
    // balise codée en dur, et rien ne le signalait — le .org était mesuré, mais
    // au mauvais endroit. `null` est accepté et n'émet aucune balise.
    gaMeasurementId: 'G-N6STD6Z5CC',
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

// Les VUES — la seconde dimension d'une page, à côté de la langue.
//
// Une page est un triplet (vitrine, langue, vue). `home` existait déjà sans
// porter de nom ; `radio` et `agenda` sont les pages piliers qui donnent une
// URL propre aux deux jeux de données que ce site est seul à agréger.
//
// LES SLUGS RESTENT EN CARACTÈRES LATINS. Un slug en écriture arménienne
// partirait en pourcent-encodage (/hy/%D5%BC%D5%A1...), illisible dans un
// partage, pour aucun gain de classement.
//
// Mais ils sont TRADUITS là où le mot change la requête : en anglais, « agenda »
// désigne un ordre du jour ou un mobile, pas une liste d'événements — c'est
// « events » que les gens tapent. « radio » s'écrit pareil dans les quatre.
//
// LE SLUG PORTE SON SLASH FINAL, et ce n'est pas cosmétique. Une vue est servie
// par un dossier (dist/ch/radio/index.html), exactement comme /hy/ et /ru/ ;
// Firebase Hosting redirige alors la forme sans slash vers celle avec, en 301 :
//
//     curl -I https://armenianews.org/hy   → 301 https://armenianews.org/hy/
//     curl -I https://armenianews.org/hy/  → 200
//
// Un slug sans slash ferait donc déclarer partout (canonical, hreflang, og:url,
// JSON-LD, sitemaps, liens internes) une adresse qui répond 301 vers l'adresse
// réellement servie — donc aucune page ne se citerait elle-même à l'URL finale.
// Rien ne l'aurait signalé : `npm run check` compare des chaînes, pas des codes
// HTTP, et `vite preview` sert les deux formes en 200.
export const VIEWS = {
  home: { slugs: { fr: '', en: '', hy: '', ru: '' } },
  radio: { slugs: { fr: 'radio/', en: 'radio/', hy: 'radio/', ru: 'radio/' } },
  // « agenda » en anglais désigne un ordre du jour ou un mobile, pas une liste
  // d'événements : le mot cherché est « events ». C'est la seule vue dont le
  // slug change d'une langue à l'autre, et c'est la raison d'être de la table.
  agenda: { slugs: { fr: 'agenda/', en: 'events/', hy: 'events/', ru: 'events/' } },
}

// Un slug sans ses slashes de bord. Sert à COMPARER (viewFromPath) là où
// `urlFor` compose. Comparer une forme normalisée à une forme brute est
// exactement ce qui casserait au premier slug portant son slash.
const normSlug = (s) => s.replace(/^\/|\/$/g, '')

export const ALL_VIEWS = Object.keys(VIEWS)

// L'URL absolue d'un couple (langue, vue). Le chemin de langue porte déjà son
// slash final (LANG_URL) et le slug le sien : une page de vue vit donc à
// `.../radio/`, la forme même que Firebase sert en 200 (voir VIEWS).
export function urlFor(lang, view = 'home') {
  const slugs = VIEWS[view]?.slugs
  if (!slugs) throw new Error(`vue inconnue : ${view}`)
  const slug = slugs[lang]
  if (slug === undefined) throw new Error(`la vue ${view} ne couvre pas ${lang}`)
  return slug ? LANG_URL[lang] + slug : LANG_URL[lang]
}

// Le même, sans le host : ce qui part dans un href interne.
export function pathFor(lang, view = 'home') {
  const host = SITES[siteOf(lang)].host
  return urlFor(lang, view).slice(host.length)
}

// Le chemin de la page d'accueil d'une langue — '/' ou '/hy/'. Sert aux ancres
// de la nav sur les pages de vue (voir Nav.jsx).
export function langPath(siteId, lang) {
  const hit = SITES[siteId].pages.find((p) => p.lang === lang)
  if (!hit) throw new Error(`${siteId} ne sert pas ${lang}`)
  return hit.path
}

// La vue que désigne un chemin. Le chemin fait autorité ; tout ce qui n'est pas
// reconnu retombe sur `home`, parce que c'est ce que Firebase sert réellement
// (réécriture ** → /index.html).
export function viewFromPath(siteId, pathname) {
  const lang = langFromPath(siteId, pathname)
  const base = langPath(siteId, lang)
  const norm = pathname.endsWith('/') ? pathname : `${pathname}/`
  // On compare deux formes NORMALISÉES. Les slugs portent leur slash final
  // (VIEWS) : confronter 'radio' au slug brut 'radio/' donnerait faux, la vue
  // retomberait sur `home`, et la garde `data-view` du prérendu ferait échouer
  // le build sans que la cause soit lisible.
  const rest = normSlug(norm.slice(base.length))
  if (!rest) return 'home'
  const hit = ALL_VIEWS.find((v) => normSlug(VIEWS[v].slugs[lang]) === rest)
  return hit ?? 'home'
}

// x-default doit suivre la vue : sur /radio il pointe sur le /radio anglais,
// pas sur l'accueil anglais. Un x-default qui change de page au milieu d'un
// bloc d'alternates rend le bloc incohérent.
export function xDefaultFor(view = 'home') {
  return urlFor('en', view)
}

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
