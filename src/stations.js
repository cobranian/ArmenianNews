// Les faits sourcés sur les quinze stations du lecteur.
//
// Module PLAT (pas de JSX) : test/stations.test.mjs doit le lire depuis Node.
// Même raison que src/seo.js, src/site.js, src/worldPlace.js, src/hyDate.js.
//
// LA RÈGLE : aucun fait sans source, et un champ non trouvé est un champ
// ABSENT — jamais « ? », jamais une approximation. Une fiche à deux champs
// vrais classe aussi bien qu'une fiche à cinq champs plausibles, et elle ne
// coûte pas la crédibilité du site le jour où un lecteur la dément.
// test/stations.test.mjs fait échouer le build si cette règle est violée.
//
// Les LIBELLÉS sont dans i18n (radio.st.*) : ce module ne porte que des faits.
// `genre` et `langue` sont des clés courtes (pas du texte affichable) — une
// page arménienne ne doit pas afficher « Actualité, musique ».
//
// `city` est écrit dans l'écriture de la ville (« Երևան » reste « Երևան »
// sur les quatre pages), jamais traduit — comme le badge `location` de
// l'agenda. `bitrate` est mesuré sur le flux lui-même (en-tête `icy-br`,
// `curl -sI -H "Icy-MetaData: 1" <flux>`), la source est alors le flux.
//
// Détail de la recherche station par station : voir
// .superpowers/sdd/2026-07-31-seo-longue-traine/task-4-report.md
export const STATION_FACTS = {
  public: {
    // La fréquence FM de la Première chaîne est ambiguë : la page officielle
    // « How to Listen » affiche deux valeurs contradictoires pour Erevan
    // (103.8 ET 69.8 MHz, dans le même onglet) et Wikipédia en indique une
    // troisième (107.7). Aucune des trois n'est retenue — champ absent.
    city: 'Երևան',
    genre: 'general',
    langue: 'hy',
    bitrate: '128',
    sources: [
      'https://en.wikipedia.org/wiki/Public_Radio_of_Armenia',
      'https://en.armradio.am/how-to-listen/',
      'https://eu1.stream4cast.com/proxy/publicra/stream',
    ],
  },
  im: {
    city: 'Երևան',
    genre: 'youth',
    langue: 'hy',
    fm: '103.8',
    bitrate: '128',
    sources: [
      'https://en.armradio.am/how-to-listen/',
      'https://bestradio.fm/en/armenia/4140-im-radio-yerevan-103-8-fm.html',
      'https://eu1.stream4cast.com/proxy/aamiry02/stream',
    ],
  },
  arevik: {
    city: 'Երևան',
    genre: 'kids',
    langue: 'hy',
    fm: '97.3',
    bitrate: '128',
    sources: [
      'https://hy.armradio.am/archives/269928',
      'https://bestradio.fm/en/kids-radio/4133-arevik-97-3-fm-yerevan-radio.html',
      'https://eu1.stream4cast.com/proxy/aamiryan/stream',
    ],
  },
  culture: {
    // Ville et fréquence non trouvées : le site officiel (mshakuyt.armradio.am)
    // détaille les émissions mais ne publie ni ville ni fréquence FM, et aucune
    // page dédiée (comme celle d'Arevik) n'a été trouvée pour les confirmer.
    genre: 'culture',
    langue: 'hy',
    bitrate: '128',
    sources: [
      'https://mshakuyt.armradio.am/',
      'https://eu1.stream4cast.com/proxy/aamiry01/stream',
    ],
  },
  mariam: {
    // La fondation possède des bureaux à Erevan ET à Gyumri (les deux adresses
    // figurent au bas de radiomariam.am) : la ville d'émission retenue ici
    // vient d'un annuaire à monitoring audio (ACRCloud), qui pointe Erevan.
    city: 'Երևան',
    genre: 'religious',
    langue: 'hy',
    fm: '104.1',
    sources: [
      'https://mytuner-radio.com/radio/radio-mariam-armenia-radio-maria-397089/',
      'https://radiomariam.am/',
    ],
  },
  vov: {
    // Seule station du lot à ne pas émettre depuis l'Arménie : Radio Van émet
    // depuis le Liban, pour la diaspora arménienne du pays.
    city: 'Beirut',
    genre: 'news',
    langue: 'hy',
    fm: '94.7 / 95.0',
    bitrate: '32',
    sources: [
      'https://raddio.net/7296-radio-voice-of-van/',
      'https://tunein.com/radio/Radio-Voice-of-Van-947-s14223/',
      'https://www.voiceofvan.net/',
      'https://vovan.s3ming.com/vovan.mp3?_=1',
    ],
  },
  lav: {
    // Se décrit elle-même comme la première radio internet d'Arménie : aucune
    // fréquence FM n'est publiée nulle part, donc le champ reste absent.
    city: 'Երևան',
    genre: 'music',
    langue: 'hy',
    bitrate: '256',
    sources: [
      'https://www.lavradio.am/',
      'https://onlineradiobox.com/am/lav/',
      'https://eu.stream4cast.com/proxy/lavradio/stream',
    ],
  },
  fama: {
    // Radio de l'Université pédagogique d'Erevan (« Առաջին Համալսարանական
    // Ռադիո »), pas une station musicale généraliste malgré son flux pop.
    city: 'Երևան',
    genre: 'university',
    langue: 'hy',
    bitrate: '192',
    sources: [
      'https://www.radiofama.am/',
      'https://onlineradiobox.com/am/fama/',
      'https://eu.stream4cast.com/proxy/rmirzakh/stream',
    ],
  },
  yerevannights: {
    // Basée à Glendale (Californie), pas en Arménie malgré son nom — deux
    // annuaires indépendants s'accordent sur cette ville.
    city: 'Glendale',
    genre: 'music',
    langue: 'hy',
    bitrate: '128',
    sources: [
      'https://www.yerevannights.com/',
      'https://onlineradiobox.com/us/yerevannights/',
      'https://icecast.worldweb.services/Web',
    ],
  },
  gospel: {
    city: 'Երևան',
    genre: 'religious',
    langue: 'hy',
    bitrate: '128',
    sources: [
      'https://armgospelradio.com/',
      'https://onlineradiobox.com/am/armeniangospel/',
      'https://s8.myradiostream.com:15554/listen.mp3',
    ],
  },
  yeraz: {
    // Ville volontairement absente : le site se décrit lui-même comme « la
    // première radio arménienne en ligne de Syrie », au service de la
    // communauté d'Alep (indicatif téléphonique syrien +963 21), alors que
    // l'annuaire qui la référence la classe sous Erevan. Les deux sources se
    // contredisent, donc aucune ville n'est retenue.
    genre: 'music',
    langue: 'hy',
    sources: ['https://onlineradiobox.com/am/eraz/'],
  },
  jazz: {
    // 89.3 MHz, Erevan — déjà documenté dans le commentaire de STATIONS
    // (src/components/Radio.jsx), vérifié ici sur un annuaire indépendant.
    // (Une autre page du même annuaire titre « 106.9 » pour une entrée
    // distincte du nom similaire : non retenue, elle ne correspond pas à ce
    // flux ni à la fiche détaillée de la station.)
    city: 'Երևան',
    genre: 'jazz',
    fm: '89.3',
    bitrate: '256',
    sources: ['https://onlineradiobox.com/am/jazz/', 'https://am.radioaurora.am/jz'],
  },
  vem: {
    // Fréquence : son propre site ne la publie NULLE PART (vérifié sur
    // l'accueil et les pages « à propos », en arménien comme en anglais).
    // Elle est donc prise chez deux annuaires indépendants qui concordent sur
    // 91.1 — le même arbitrage que pour `im` et `arevik`. Concordance, pas
    // arbitrage à la main : si les deux avaient divergé, le champ serait
    // absent.
    //
    // Le genre est sourcé par la NAVIGATION de la station elle-même, pas par
    // une description d'annuaire : Աստվածաշունչ (Bible), Սուրբ հայրեր (Pères
    // de l'Église), Աղոթքներ (prières). C'est une radio d'Église, comme
    // mariam et gospel.
    city: 'Երևան',
    genre: 'religious',
    langue: 'hy',
    fm: '91.1',
    bitrate: '320',
    sources: [
      'https://vem.am/',
      'https://mytuner-radio.com/radio/vem-radio-911-fm-445579/',
      'https://streema.com/radios/Radio_VEM',
      'https://eu1.stream4cast.com/proxy/vemradio/stream',
    ],
  },
  yerevanfm: {
    // 102 MHz pour Erevan, et c'est LA STATION qui le dit — arradio.am publie
    // la liste de son réseau ville par ville (« Yerevan - 102 Mhz,
    // Charentsavan - 104.4 Mhz, … »). Les annuaires, eux, annoncent 102.1 et
    // 101.9 ; ils se contredisent entre eux, et le site prime sur les deux.
    // Seule la fréquence d'Erevan est retenue : ce réseau en compte neuf, et
    // le champ n'en porte qu'une.
    city: 'Երևան',
    genre: 'general',
    langue: 'hy',
    fm: '102',
    bitrate: '256',
    sources: [
      'https://arradio.am/',
      'https://mytuner-radio.com/radio/radio-yerevan-air-radio-intercontinental-418215/',
      'https://eu1.stream4cast.com/proxy/arradioi/stream',
    ],
  },
  tsayn: {
    // Beyrouth — la seule station du lecteur hors d'Arménie.
    //
    // FRÉQUENCE VOLONTAIREMENT ABSENTE : trois sources, trois réponses. Son
    // propre site annonce « FM 104.9 - 106.7 MHZ », un annuaire dit 87.9, un
    // autre 104.2. Le format à deux valeurs ne serait pourtant pas un
    // obstacle — `vov` porte déjà « 94.7 / 95.0 » — mais là, les sources
    // concordaient. C'est exactement le cas de `yeraz`, dont la ville est
    // absente parce que le site et un annuaire se contredisaient : un site
    // officiel ne suffit pas à trancher contre un annuaire, sinon la règle ne
    // servirait jamais.
    //
    // « Beirut », en lettres latines, parce que `vov` — l'autre antenne
    // libanaise de la liste — l'écrit déjà ainsi. Deux graphies de la même
    // ville dans la même liste de fiches se verraient au premier coup d'œil.
    city: 'Beirut',
    genre: 'music',
    langue: 'hy',
    bitrate: '128',
    sources: [
      'https://yeridasartoutiantsayne.com/',
      'https://mytuner-radio.com/fr/radio/yeridasartoutian-tsayne-446353/',
      'https://cast5.asurahosting.com/proxy/jean/live',
    ],
  },
}
