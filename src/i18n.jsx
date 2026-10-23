import { createContext, useContext, useEffect, useMemo } from 'react'
import { LANGS, langFromPath } from '../sites.config.js'
import { SITE_ID } from './site.js'
import { hyLongDate, hyMonthAbbr, hyWeekdayTime } from './hyDate.js'
import { relativeAge } from './relativeTime.js'
import { rubricStrings } from './rubricLabels.js'

// LANGS lives in sites.config.js because Node cannot parse JSX — the build
// scripts and tests run outside the browser and need this data as plain
// JavaScript. Re-export here for backward compatibility with existing code.
export { LANGS }

const STRINGS = {
  fr: {
    'site.title': 'Arménie Info',
    'site.tagline': 'Un instantané horaire de la vie arménienne, du monde et de Suisse',
    'site.snapshot': 'Instantané du',
    'site.cadence': 'chaque heure',

    'nav.news': 'Actualités',
    'nav.radio': 'En direct',
    'nav.agenda': 'Agenda',
    'nav.social': 'Réseaux',
    // Maillage interne (audit SEO du 21 août 2026) : les trois pages du site,
    // liées depuis chaque page — pied de page et « Voir aussi » des vues.
    'footer.pages': 'Pages du site',
    'footer.home': 'Accueil',
    'viewpage.also': 'Voir aussi',
    // Page « À propos » (vue `about`). Tout ce qui y est affirmé est vérifiable
    // dans le dépôt ; aucun nombre écrit en toutes lettres (les comptes sont
    // gardés ailleurs), le nombre de stations entre par {n}.
    'about.h1': 'À propos d’Arménie Info',
    'about.intro':
      'Arménie Info est un site indépendant, basé en Suisse et édité par {editor}, qui rassemble chaque heure la vie arménienne telle que la racontent ses propres médias : les dépêches des rédactions, les radios en direct, l’agenda de la diaspora et ses réseaux sociaux. Rien n’est réécrit — chaque titre renvoie à l’éditeur qui l’a publié.',
    'about.what.title': 'Ce que vous trouvez ici',
    'about.what.body':
      'Un instantané statique, reconstruit toutes les heures par un programme qui relit les sources et regénère les pages. Il n’y a ni compte, ni formulaire, ni base de données.',
    'about.what.news': 'les dernières dépêches des rédactions arméniennes, rubrique par rubrique, dans la langue de la page ;',
    'about.what.radio': '{n} stations en écoute directe, chacune avec une fiche sourcée (ville, genre, langue d’antenne) ;',
    'about.what.agenda': 'les événements de la diaspora, pays par pays, recensés depuis Armenopole ;',
    'about.what.social': 'une sélection de comptes Instagram curés à la main et le mur Facebook de Don Narek.',
    'about.what.sites':
      'Le même instantané est servi sous deux noms, un par domaine et par langue de tête :',
    'about.rules.title': 'Les règles',
    'about.rules.links':
      'Rien n’est réécrit ni résumé : les titres sont ceux des rédactions, et chaque carte mène à l’article d’origine, chez son éditeur.',
    'about.rules.hourly':
      'Tout est daté. Le bandeau du haut donne l’heure de l’instantané ; chaque dépêche affiche son âge.',
    'about.rules.noads':
      'Pas de publicité, pas de compte, pas de cookie de suivi dans l’Espace économique européen — la politique de confidentialité, en pied de page, dit exactement ce qui est mesuré.',
    'about.rules.facts':
      'Aucun fait de station n’est affirmé sans source ; un champ qui n’a pas pu être vérifié est laissé vide plutôt que deviné.',
    'about.sources.title': 'Les rédactions',
    'about.sources.body':
      'Les dépêches proviennent des sites de ces rédactions, lues telles quelles. Chacune paraît sous la ou les langues dans lesquelles elle publie :',
    'about.sources.langs': 'Langues',
    'about.sources.other':
      'L’agenda vient d’Armenopole, les radios de leurs propres flux, et les images des réseaux sociaux des comptes cités.',
    'about.contact.title': 'Contact',
    'about.contact.body': 'Une erreur, une source à proposer, une station qui se tait ? Écrivez à',

    'news.title': 'Actualités',
    ...rubricStrings('fr'),
    'news.subtitle': "Les dernières publications de chaque rubrique du Courrier d'Erevan",
    'news.armradio': "En direct d'Arménie · Public Radio of Armenia",
    'news.readmore': 'Lire la suite',
    'news.prev': 'Précédent',
    'news.next': 'Suivant',
    'news.source': 'Source',
    'news.empty': 'Aucun article pour le moment.',
    // Mention « articles en français » de la section Actualités : remplie sous
    // de/it seulement, où le fil est celui de fr (aucune rédaction n'écrit en
    // allemand ni en italien). Vide ailleurs : rien ne s'affiche.
    'news.originalLang': '',

    'agenda.title': 'Agenda',
    'agenda.subtitle': 'Événements arméniens dans le monde et en Suisse',
    'agenda.switzerland': 'Suisse',
    'agenda.world': 'Monde',
    'agenda.country': 'Pays',
    'agenda.empty': 'Aucun événement annoncé.',
    'agenda.more': "Tout l'agenda arménien, pays par pays",

    // Page /agenda
    'agenda.page.h1': "L'agenda arménien, dans le monde",
    'agenda.page.intro':
      "La liste complète des événements arméniens à venir : glanée toutes les heures sur armenopole.com, dans des dizaines de pays et en Suisse. Un événement en disparaît de lui-même une fois passé — cette page ne montre jamais que ce qu'il reste à voir.",
    'agenda.page.count': 'événements à venir, dans le monde et en Suisse',
    'agenda.page.home': 'Retour à l’accueil',

    'social.title': 'Réseaux sociaux',
    'social.subtitle':
      "Deux fils : une sélection Instagram retirée au sort chaque heure, et l'art que partage Don Narek",

    'fb.title': 'Art arménien',
    'fb.by': 'par Don Narek',
    'fb.subtitle': 'Les 25 dernières publications, en images',
    'fb.view': 'Voir la publication',

    'ig.title': 'Instagram',
    'ig.subtitle': "Une mosaïque d'inspiration arménienne, au hasard",
    'ig.strand': 'Mosaïque arménienne',
    'ig.strand.people': 'Visages arméniens',
    'ig.strand.studio': 'Ateliers arméniens',
    'ig.strand.creators': 'Créateurs arméniens',
    'ig.strand.land': 'Terres arméniennes',
    'ig.shuffle': 'Mélanger',
    'ig.visit': 'Voir le profil',
    'ig.accounts.all': 'Les comptes suivis ({n})',
    'ig.accounts.less': 'Masquer les comptes',
    'ig.view': 'Voir sur Instagram',

    'social.enlarge': 'Agrandir l’image',
    'fb.zoom': 'Agrandir',
    'ig.zoom': 'Agrandir',
    'lb.dialog': 'Image agrandie',
    'lb.close': 'Fermer',
    'lb.prev': 'Image précédente',
    'lb.next': 'Image suivante',

    'footer.built': "Instantané statique · sources liées à leurs sites d'origine",
    'footer.write': 'Écrivez-nous',
    'footer.sources': 'Sources',

    // Politique de confidentialité. Ce texte doit décrire ce que le site fait
    // RÉELLEMENT, pas un modèle générique : c'est l'affirmation publique sur
    // laquelle repose la licéité du dépôt de cookies. Si la configuration du
    // consentement change dans public/ga-init.js — notamment la liste des
    // régions où le cookie est refusé — ces chaînes doivent suivre, dans les
    // quatre langues.
    'privacy.title': 'Politique de confidentialité',
    'privacy.intro':
      "Ce site est un instantané statique : ni compte, ni formulaire, ni base de données. Il ne vous demande rien et ne conserve rien qui vous identifie personnellement.",
    'privacy.analytics.title': "Mesure d'audience",
    'privacy.analytics.body':
      "Nous utilisons Google Analytics et Cloudflare Web Analytics pour compter les visites et savoir quelles rubriques sont lues. Hors Espace économique européen et Royaume-Uni, Google Analytics dépose un cookie qui permet de reconnaître un visiteur d'une visite à l'autre. Depuis l'EEE et le Royaume-Uni, ce cookie n'est pas déposé : la mesure y est anonyme et sans cookie, comme l'exige le RGPD. Cloudflare Web Analytics ne dépose aucun cookie, où que vous soyez.",
    'privacy.analytics.optout':
      "Pour refuser ce cookie, bloquez-le dans votre navigateur. Le site fonctionne à l'identique sans lui.",
    'privacy.storage.title': 'Conservé sur votre appareil',
    'privacy.storage.body':
      "Votre choix de thème jour / nuit est enregistré localement par votre navigateur. Il ne quitte jamais votre appareil et ne nous est jamais transmis.",
    'privacy.content.title': 'Contenu de tiers',
    'privacy.content.body':
      "Les articles, événements et publications proviennent de sites tiers, cités et liés. Suivre un lien vous conduit chez l'éditeur concerné, dont la politique de confidentialité s'applique alors.",
    'privacy.rights.title': 'Vos droits',
    'privacy.rights.body':
      "Vous pouvez demander l'accès aux données vous concernant, leur rectification ou leur effacement. Le site ne collectant aucune donnée nominative, cela se limite en pratique aux mesures d'audience agrégées.",
    'privacy.contact': 'Pour toute question :',

    'sections.actualite': 'Actualités',
    'sections.societe': 'Société',
    'sections.economie': 'Économie',
    'sections.arts-et-culture': 'Arts et culture',
    'sections.francophonie': 'Arménie francophone',
    'sections.opinions': 'Opinions',
    'sections.region': 'Région',
    'sections.diasporas': 'Diasporas',

    'armcats.politics': 'Politique',
    'armcats.society': 'Société',
    'armcats.economics': 'Économie',
    'armcats.analytics': 'Analyses',
    'armcats.world': 'Monde',
    'armcats.culture': 'Culture',
    'armcats.sport': 'Sport',

    'namcats.actualites': 'Actualités',
    'namcats.sport': 'Sport',
    'namcats.communaute': 'Communauté',
    'namcats.culture': 'Culture',
    'namcats.lifestyle': 'Lifestyle',
    'namcats.magazine': 'Magazines',

    'azkcats.armenie-artsakh': 'Arménie & Artsakh',
    'azkcats.communaute': 'Communauté',
    'azkcats.divers': 'Divers',

    'aitcats.armenie': 'Arménie',
    'aitcats.art-culture': 'Art & Culture',
    'aitcats.artsakh': 'Artsakh',
    'aitcats.diaspora': 'Diaspora',
    'aitcats.france': 'France',
    'aitcats.geopolitique': 'Géopolitique',
    'aitcats.politique': 'Politique',
    'aitcats.un-autre-regard': 'Un autre regard',

    'browser.subtitle': 'Toutes les rubriques, source par source',
    'news.sources': '{n} rédactions arméniennes',
    'browser.armradio': 'Radio publique d’Arménie',
    'browser.asbarez': 'Asbarez — quotidien arménien de Los Angeles',
    'browser.armenianweekly': 'The Armenian Weekly — hebdomadaire arménien de Boston',
    'browser.oragark': 'Oragark — quotidien de la FRA',
    'browser.californiacourier': 'The California Courier — la chronique de Harut Sassounian',
    'browser.civilnet': 'CivilNet — média indépendant d’Erevan',
    'browser.newsam': 'NEWS.am — le principal groupe de presse privé d’Erevan',
    'browser.courrier': 'Courrier d’Erevan',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Écho des Arméniens de Suisse',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Armenpress',
    'browser.live': 'En direct',
    // Rubric names as Armenpress itself labels them in each edition — the
    // source is trilingual, so the fr dictionary only ever renders fr rubrics.
    'apcats.armenia': 'Arménie',
    'apcats.economy': 'Économie',
    'apcats.world': 'Monde',
    'apcats.culture': 'Culture',
    'apcats.sports': 'Sport',
    'apcats.fact-check': 'Vérification des faits',
    'apcats.projects': 'Projets exclusifs',

    'radio.eyebrow': 'Erevan · 128 kbps',
    'radio.title': 'En direct',
    // ONZE stations, pas une. Ne nommer que la Radio publique en passait dix
    // sous silence — le nombre est écrit en toutes lettres parce que t() ne
    // sait pas interpoler. Si vous touchez à STATIONS (Radio.jsx), les quatre
    // traductions ci-dessous doivent suivre ; un test le vérifie.
    'radio.subtitle': 'Dix-sept radios arméniennes, en flux continu',
    'radio.onair': 'En direct',
    'radio.tz': 'Erevan',
    'radio.play': 'Écouter en direct',
    'radio.pause': 'Mettre en pause',
    'radio.loading': 'Connexion au flux…',
    'radio.error': 'Flux indisponible.',
    'radio.retry': 'Réessayer',
    // Porté par la puce d'une station que sa propre régie n'alimente plus (voir
    // `offAir` dans Radio.jsx). Dit l'état de LA STATION, pas une panne du
    // lecteur : « Flux indisponible. » se lit comme un défaut du site, « hors
    // antenne » se lit comme un silence de la radio — et c'est le second qui
    // est vrai. Deux mots, pas de phrase : ils tiennent dans une puce.
    'radio.offair': 'hors antenne',
    'radio.volume': 'Volume',
    'radio.station': 'Station',
    'radio.stations.all': 'Voir les {n} stations',
    'radio.stations.less': 'Voir moins',
    'radio.st.public': 'Première chaîne',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Radio Arevik',
    'radio.st.culture': 'Radio Culture',
    'radio.st.mariam': 'Radio Mariam',
    'radio.st.vov': 'Voice of Van',
    'radio.st.lav': 'Lav Radio',
    'radio.st.fama': 'Radio Fama',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
    'radio.st.jazz': 'Radio Jazz FM',
    // Les trois ajouts du 11 août 2026. « Yeridasartoutian Tsayne » garde ses
    // lettres latines dans les trois langues à écriture non arménienne : c'est
    // ainsi que la station de Beyrouth écrit son propre nom, et le traduire
    // (« Voix de la jeunesse ») ferait d'une marque une description.
    'radio.st.vem': 'Radio Vem',
    'radio.st.yerevanfm': 'Radio Yerevan',
    'radio.st.tsayn': 'Yeridasartoutian Tsayne',
    'radio.st.radioa': 'Radio A',
    'radio.st.aypfm': 'AYP FM',
    'radio.more': 'Les dix-sept radios arméniennes en direct',

    // Page /radio
    'radio.page.h1': 'Radios arméniennes en direct',
    'radio.page.intro':
      'Dix-sept radios arméniennes en flux continu, réunies sur une seule page : les stations publiques d’Erevan, les antennes indépendantes et celles de la diaspora. Aucune inscription, rien à installer — le son démarre au clic et suit la bascule jour / nuit du site. Les flux sont ceux des stations elles-mêmes ; ArménieInfo n’héberge ni ne réencode aucun signal.',
    'radio.page.list': 'Les dix-sept stations',
    'radio.page.city': 'Ville',
    // Les villes des fiches de station sont des CLÉS (src/stations.js), comme
    // genre et langue : « Երևան » s'affichait tel quel sur la page française,
    // et partait ainsi dans le balisage RadioStation.areaServed.
    'radio.city.yerevan': 'Erevan',
    'radio.city.beirut': 'Beyrouth',
    'radio.city.glendale': 'Glendale',
    'radio.city.bourglesvalence': 'Bourg-lès-Valence',
    'radio.city.alfortville': 'Alfortville',
    'radio.page.genre': 'Genre',
    'radio.page.lang': 'Langue d’antenne',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Débit',
    'radio.page.home': 'Retour à l’accueil',
    'radio.remote.title': 'Changer de station sans revenir sur le site',
    'radio.remote.keys':
      'Une fois la radio lancée, les boutons « précédent » et « suivant » de l’écran verrouillé de votre téléphone passent d’une station à l’autre. Ceux du volant aussi, quand le téléphone est relié à la voiture en Bluetooth. La radio s’écoute aussi avec des écouteurs ou un casque audio.',
    'radio.remote.skip': 'Et si une station coupe, le lecteur passe tout seul à la suivante.',
    'radio.remote.icon': 'Boutons précédent et suivant',
    'radio.remote.prev': 'Station précédente',
    'radio.remote.next': 'Station suivante',
    'radio.genre.culture': 'Culture',
    'radio.genre.general': 'Généraliste',
    'radio.genre.jazz': 'Jazz',
    'radio.genre.kids': 'Enfants',
    'radio.genre.music': 'Musique',
    'radio.genre.news': 'Actualité',
    'radio.genre.religious': 'Religieux',
    'radio.genre.university': 'Universitaire',
    'radio.genre.youth': 'Jeunesse',
    'radio.page.lang.hy': 'Arménien',
    'radio.page.lang.fr-hy': 'Français et arménien',
  },
  // Allemand de Suisse : jamais de « ß », toujours « ss » (vergrössern,
  // schliessen, Fusszeile). Le fil reste en français sous /de/ (voir
  // news.originalLang) ; about.what.news le dit au lieu de promettre « la
  // langue de la page ». Le nombre de stations s'écrit en toutes lettres comme
  // ailleurs (test/radio-count.test.mjs).
  de: {
    'site.title': 'Arménie Info',
    'site.tagline': 'Eine stündliche Momentaufnahme des armenischen Lebens, aus der Welt und der Schweiz',
    'site.snapshot': 'Momentaufnahme vom',
    'site.cadence': 'stündlich',
    'nav.news': 'Nachrichten',
    'nav.radio': 'Live',
    'nav.agenda': 'Agenda',
    'nav.social': 'Social Media',
    'footer.pages': 'Seiten der Website',
    'footer.home': 'Startseite',
    'viewpage.also': 'Siehe auch',
    'about.h1': 'Über Arménie Info',
    'about.intro':
      'Arménie Info ist eine unabhängige Website mit Sitz in der Schweiz, herausgegeben von {editor}. Sie versammelt jede Stunde das armenische Leben, wie es seine eigenen Medien erzählen: die Meldungen der Redaktionen, Radiosender live, die Agenda der Diaspora und ihre sozialen Netzwerke. Nichts wird umgeschrieben – jeder Titel führt zu dem Medium, das ihn veröffentlicht hat.',
    'about.what.title': 'Was Sie hier finden',
    'about.what.body':
      'Eine statische Momentaufnahme, die ein Programm jede Stunde neu erstellt: Es liest die Quellen und erzeugt die Seiten neu. Es gibt weder Konto noch Formular noch Datenbank.',
    'about.what.news': 'die neuesten Meldungen der armenischen Redaktionen, Rubrik für Rubrik – hier in ihrer französischen Originalfassung;',
    'about.what.radio': '{n} Sender zum direkten Hören, jeder mit einem belegten Steckbrief (Stadt, Genre, Sendesprache);',
    'about.what.agenda': 'die Veranstaltungen der Diaspora, Land für Land, zusammengetragen von Armenopole;',
    'about.what.social': 'eine von Hand kuratierte Auswahl von Instagram-Konten und die Facebook-Seite von Don Narek.',
    'about.what.sites':
      'Dieselbe Momentaufnahme erscheint unter zwei Namen, einer pro Domain und Hauptsprache:',
    'about.rules.title': 'Die Regeln',
    'about.rules.links':
      'Nichts wird umgeschrieben oder zusammengefasst: Die Titel sind jene der Redaktionen, und jede Karte führt zum Originalartikel bei seinem Medium.',
    'about.rules.hourly':
      'Alles ist datiert. Das Band oben nennt die Uhrzeit der Momentaufnahme; jede Meldung zeigt ihr Alter.',
    'about.rules.noads':
      'Keine Werbung, kein Konto, kein Tracking-Cookie im Europäischen Wirtschaftsraum – die Datenschutzerklärung in der Fusszeile sagt genau, was gemessen wird.',
    'about.rules.facts':
      'Keine Angabe zu einem Sender ohne Quelle; ein Feld, das sich nicht überprüfen liess, bleibt leer, statt erraten zu werden.',
    'about.sources.title': 'Die Redaktionen',
    'about.sources.body':
      'Die Meldungen stammen von den Websites dieser Redaktionen und werden unverändert übernommen. Jede erscheint unter der Sprache oder den Sprachen, in denen sie veröffentlicht:',
    'about.sources.langs': 'Sprachen',
    'about.sources.other':
      'Die Agenda stammt von Armenopole, die Radiosender aus ihren eigenen Streams und die Bilder der sozialen Netzwerke von den genannten Konten.',
    'about.contact.title': 'Kontakt',
    'about.contact.body': 'Ein Fehler, eine Quelle, die Sie vorschlagen möchten, ein Sender, der verstummt ist? Schreiben Sie an',
    'news.title': 'Nachrichten',
    ...rubricStrings('de'),
    'news.subtitle': 'Die neuesten Beiträge aus jeder Rubrik des Courrier d’Erevan',
    'news.armradio': 'Live aus Armenien · Public Radio of Armenia',
    'news.readmore': 'Weiterlesen',
    'news.prev': 'Zurück',
    'news.next': 'Weiter',
    'news.source': 'Quelle',
    'news.empty': 'Im Moment keine Artikel.',
    'news.originalLang': 'Artikel auf Französisch',
    'agenda.title': 'Agenda',
    'agenda.subtitle': 'Armenische Veranstaltungen weltweit und in der Schweiz',
    'agenda.switzerland': 'Schweiz',
    'agenda.world': 'Welt',
    'agenda.country': 'Land',
    'agenda.empty': 'Keine Veranstaltungen angekündigt.',
    'agenda.more': 'Die ganze armenische Agenda, Land für Land',
    'agenda.page.h1': 'Die armenische Agenda, weltweit',
    'agenda.page.intro':
      'Die vollständige Liste der kommenden armenischen Veranstaltungen: stündlich auf armenopole.com gesammelt, in Dutzenden Ländern und in der Schweiz. Eine Veranstaltung verschwindet von selbst, sobald sie vorbei ist – diese Seite zeigt immer nur, was noch bevorsteht.',
    'agenda.page.count': 'kommende Veranstaltungen, weltweit und in der Schweiz',
    'agenda.page.home': 'Zurück zur Startseite',
    'social.title': 'Soziale Netzwerke',
    'social.subtitle':
      'Zwei Feeds: eine Instagram-Auswahl, jede Stunde neu ausgelost, und die Kunst, die Don Narek teilt',
    'fb.title': 'Armenische Kunst',
    'fb.by': 'von Don Narek',
    'fb.subtitle': 'Die 25 neuesten Beiträge, in Bildern',
    'fb.view': 'Beitrag ansehen',
    'ig.title': 'Instagram',
    'ig.subtitle': 'Ein armenisch inspiriertes Mosaik, zufällig zusammengestellt',
    'ig.strand': 'Armenisches Mosaik',
    'ig.strand.people': 'Armenische Gesichter',
    'ig.strand.studio': 'Armenische Ateliers',
    'ig.strand.creators': 'Armenische Kreative',
    'ig.strand.land': 'Armenische Landschaften',
    'ig.shuffle': 'Neu mischen',
    'ig.visit': 'Profil ansehen',
    'ig.accounts.all': 'Die verfolgten Konten ({n})',
    'ig.accounts.less': 'Konten ausblenden',
    'ig.view': 'Auf Instagram ansehen',
    'social.enlarge': 'Bild vergrössern',
    'fb.zoom': 'Vergrössern',
    'ig.zoom': 'Vergrössern',
    'lb.dialog': 'Vergrössertes Bild',
    'lb.close': 'Schliessen',
    'lb.prev': 'Vorheriges Bild',
    'lb.next': 'Nächstes Bild',
    'footer.built': 'Statische Momentaufnahme · Quellen mit ihren Originalseiten verlinkt',
    'footer.write': 'Schreiben Sie uns',
    'footer.sources': 'Quellen',
    'privacy.title': 'Datenschutzerklärung',
    'privacy.intro':
      'Diese Website ist eine statische Momentaufnahme: kein Konto, kein Formular, keine Datenbank. Sie verlangt nichts von Ihnen und speichert nichts, was Sie persönlich identifiziert.',
    'privacy.analytics.title': 'Reichweitenmessung',
    'privacy.analytics.body':
      'Wir verwenden Google Analytics und Cloudflare Web Analytics, um Besuche zu zählen und zu erfahren, welche Rubriken gelesen werden. Ausserhalb des Europäischen Wirtschaftsraums und des Vereinigten Königreichs setzt Google Analytics ein Cookie, das einen Besucher von einem Besuch zum nächsten wiedererkennt. Im EWR und im Vereinigten Königreich wird dieses Cookie nicht gesetzt: Die Messung erfolgt dort anonym und ohne Cookie, wie es die DSGVO verlangt. Cloudflare Web Analytics setzt keinerlei Cookie, wo immer Sie sich befinden.',
    'privacy.analytics.optout':
      'Um dieses Cookie abzulehnen, blockieren Sie es in Ihrem Browser. Die Website funktioniert ohne es genau gleich.',
    'privacy.storage.title': 'Auf Ihrem Gerät gespeichert',
    'privacy.storage.body':
      'Ihre Wahl zwischen Tag- und Nachtmodus speichert Ihr Browser lokal. Sie verlässt Ihr Gerät nie und wird uns nie übermittelt.',
    'privacy.content.title': 'Inhalte Dritter',
    'privacy.content.body':
      'Die Artikel, Veranstaltungen und Beiträge stammen von Websites Dritter, die genannt und verlinkt sind. Ein Link führt Sie zum jeweiligen Anbieter, dessen Datenschutzerklärung dann gilt.',
    'privacy.rights.title': 'Ihre Rechte',
    'privacy.rights.body':
      'Sie können Auskunft über die Sie betreffenden Daten, deren Berichtigung oder Löschung verlangen. Da die Website keine personenbezogenen Daten erhebt, beschränkt sich dies in der Praxis auf die zusammengefasste Reichweitenmessung.',
    'privacy.contact': 'Bei Fragen:',
    'sections.actualite': 'Aktuell',
    'sections.societe': 'Gesellschaft',
    'sections.economie': 'Wirtschaft',
    'sections.arts-et-culture': 'Kunst und Kultur',
    'sections.francophonie': 'Frankophones Armenien',
    'sections.opinions': 'Meinungen',
    'sections.region': 'Region',
    'sections.diasporas': 'Diasporas',
    'armcats.politics': 'Politik',
    'armcats.society': 'Gesellschaft',
    'armcats.economics': 'Wirtschaft',
    'armcats.analytics': 'Analysen',
    'armcats.world': 'Welt',
    'armcats.culture': 'Kultur',
    'armcats.sport': 'Sport',
    'namcats.actualites': 'Aktuell',
    'namcats.sport': 'Sport',
    'namcats.communaute': 'Gemeinschaft',
    'namcats.culture': 'Kultur',
    'namcats.lifestyle': 'Lifestyle',
    'namcats.magazine': 'Magazine',
    'azkcats.armenie-artsakh': 'Armenien & Arzach',
    'azkcats.communaute': 'Gemeinschaft',
    'azkcats.divers': 'Vermischtes',
    'aitcats.armenie': 'Armenien',
    'aitcats.art-culture': 'Kunst & Kultur',
    'aitcats.artsakh': 'Arzach',
    'aitcats.diaspora': 'Diaspora',
    'aitcats.france': 'Frankreich',
    'aitcats.geopolitique': 'Geopolitik',
    'aitcats.politique': 'Politik',
    'aitcats.un-autre-regard': 'Ein anderer Blick',
    'browser.subtitle': 'Alle Rubriken, Quelle für Quelle',
    'news.sources': '{n} armenische Redaktionen',
    'browser.armradio': 'Öffentlicher Rundfunk Armeniens',
    'browser.asbarez': 'Asbarez – armenische Tageszeitung aus Los Angeles',
    'browser.armenianweekly': 'The Armenian Weekly – armenische Wochenzeitung aus Boston',
    'browser.oragark': 'Oragark – Tageszeitung der ARF',
    'browser.californiacourier': 'The California Courier – die Kolumne von Harut Sassounian',
    'browser.civilnet': 'CivilNet – unabhängiges Medium aus Eriwan',
    'browser.newsam': 'NEWS.am – die grösste private Mediengruppe Eriwans',
    'browser.courrier': 'Courrier d’Erevan',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Écho des Arméniens de Suisse',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Armenpress',
    'browser.live': 'Live',
    'apcats.armenia': 'Armenien',
    'apcats.economy': 'Wirtschaft',
    'apcats.world': 'Welt',
    'apcats.culture': 'Kultur',
    'apcats.sports': 'Sport',
    'apcats.fact-check': 'Faktencheck',
    'apcats.projects': 'Exklusive Projekte',
    'radio.eyebrow': 'Eriwan · 128 kbps',
    'radio.title': 'Live',
    'radio.subtitle': 'Siebzehn armenische Radiosender im Livestream',
    'radio.onair': 'Live',
    'radio.tz': 'Eriwan',
    'radio.play': 'Live hören',
    'radio.pause': 'Pausieren',
    'radio.loading': 'Verbindung zum Stream …',
    'radio.error': 'Stream nicht verfügbar.',
    'radio.retry': 'Erneut versuchen',
    'radio.offair': 'nicht auf Sendung',
    'radio.volume': 'Lautstärke',
    'radio.station': 'Sender',
    'radio.stations.all': 'Alle {n} Sender anzeigen',
    'radio.stations.less': 'Weniger anzeigen',
    'radio.st.public': 'Erstes Programm',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Radio Arevik',
    'radio.st.culture': 'Radio Culture',
    'radio.st.mariam': 'Radio Mariam',
    'radio.st.vov': 'Voice of Van',
    'radio.st.lav': 'Lav Radio',
    'radio.st.fama': 'Radio Fama',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
    'radio.st.jazz': 'Radio Jazz FM',
    'radio.st.vem': 'Radio Vem',
    'radio.st.yerevanfm': 'Radio Yerevan',
    'radio.st.tsayn': 'Yeridasartoutian Tsayne',
    'radio.st.radioa': 'Radio A',
    'radio.st.aypfm': 'AYP FM',
    'radio.more': 'Die siebzehn armenischen Radiosender live',
    'radio.page.h1': 'Armenische Radiosender live',
    'radio.page.intro':
      'Siebzehn armenische Radiosender im Livestream, vereint auf einer einzigen Seite: die öffentlichen Sender aus Eriwan, unabhängige Stationen und jene der Diaspora. Keine Anmeldung, nichts zu installieren – der Ton startet per Klick und folgt dem Tag- und Nachtmodus der Website. Die Streams sind jene der Sender selbst; Arménie Info hostet kein Signal und codiert keines neu.',
    'radio.page.list': 'Die siebzehn Sender',
    'radio.page.city': 'Stadt',
    'radio.city.yerevan': 'Eriwan',
    'radio.city.beirut': 'Beirut',
    'radio.city.glendale': 'Glendale',
    'radio.city.bourglesvalence': 'Bourg-lès-Valence',
    'radio.city.alfortville': 'Alfortville',
    'radio.page.genre': 'Genre',
    'radio.page.lang': 'Sendesprache',
    'radio.page.fm': 'UKW',
    'radio.page.bitrate': 'Bitrate',
    'radio.page.home': 'Zurück zur Startseite',
    'radio.remote.title': 'Den Sender wechseln, ohne zur Website zurückzukehren',
    'radio.remote.keys':
      'Sobald das Radio läuft, wechseln die Tasten «Zurück» und «Weiter» auf dem Sperrbildschirm Ihres Telefons von einem Sender zum nächsten. Auch jene am Lenkrad, wenn das Telefon per Bluetooth mit dem Auto verbunden ist. Das Radio lässt sich auch mit Ohrhörern oder Kopfhörern hören.',
    'radio.remote.skip': 'Und wenn ein Sender abbricht, wechselt der Player von selbst zum nächsten.',
    'radio.remote.icon': 'Tasten Zurück und Weiter',
    'radio.remote.prev': 'Vorheriger Sender',
    'radio.remote.next': 'Nächster Sender',
    'radio.genre.culture': 'Kultur',
    'radio.genre.general': 'Vollprogramm',
    'radio.genre.jazz': 'Jazz',
    'radio.genre.kids': 'Kinder',
    'radio.genre.music': 'Musik',
    'radio.genre.news': 'Nachrichten',
    'radio.genre.religious': 'Religiös',
    'radio.genre.university': 'Hochschulradio',
    'radio.genre.youth': 'Jugend',
    'radio.page.lang.hy': 'Armenisch',
    'radio.page.lang.fr-hy': 'Französisch und Armenisch',
  },
  // Italien standard. Apostrophe typographique (’) partout : la clé et sa
  // valeur restent entre apostrophes droites, que lisent les tests.
  it: {
    'site.title': 'Arménie Info',
    'site.tagline': 'Un’istantanea oraria della vita armena, dal mondo e dalla Svizzera',
    'site.snapshot': 'Istantanea del',
    'site.cadence': 'ogni ora',
    'nav.news': 'Notizie',
    'nav.radio': 'In diretta',
    'nav.agenda': 'Eventi',
    'nav.social': 'Social',
    'footer.pages': 'Pagine del sito',
    'footer.home': 'Home',
    'viewpage.also': 'Vedi anche',
    'about.h1': 'Informazioni su Arménie Info',
    'about.intro':
      'Arménie Info è un sito indipendente, con sede in Svizzera e curato da {editor}, che raccoglie ogni ora la vita armena così come la raccontano i suoi stessi media: i dispacci delle redazioni, le radio in diretta, gli eventi della diaspora e i suoi social network. Nulla viene riscritto: ogni titolo rimanda all’editore che lo ha pubblicato.',
    'about.what.title': 'Che cosa trovate qui',
    'about.what.body':
      'Un’istantanea statica, ricostruita ogni ora da un programma che rilegge le fonti e rigenera le pagine. Non ci sono account, moduli né database.',
    'about.what.news': 'gli ultimi dispacci delle redazioni armene, rubrica per rubrica, qui nella loro versione originale francese;',
    'about.what.radio': '{n} stazioni in ascolto diretto, ognuna con una scheda documentata (città, genere, lingua di trasmissione);',
    'about.what.agenda': 'gli eventi della diaspora, paese per paese, raccolti da Armenopole;',
    'about.what.social': 'una selezione di account Instagram scelti a mano e la pagina Facebook di Don Narek.',
    'about.what.sites':
      'La stessa istantanea è pubblicata con due nomi, uno per dominio e per lingua principale:',
    'about.rules.title': 'Le regole',
    'about.rules.links':
      'Nulla viene riscritto né riassunto: i titoli sono quelli delle redazioni, e ogni scheda porta all’articolo originale, presso il suo editore.',
    'about.rules.hourly':
      'Tutto è datato. La fascia in alto indica l’ora dell’istantanea; ogni dispaccio mostra da quanto tempo è uscito.',
    'about.rules.noads':
      'Niente pubblicità, niente account, nessun cookie di tracciamento nello Spazio economico europeo: l’informativa sulla privacy, a piè di pagina, dice esattamente che cosa viene misurato.',
    'about.rules.facts':
      'Nessun dato su una stazione è affermato senza fonte; un campo che non è stato possibile verificare resta vuoto anziché essere indovinato.',
    'about.sources.title': 'Le redazioni',
    'about.sources.body':
      'I dispacci provengono dai siti di queste redazioni e sono ripresi così come sono. Ognuna compare nella lingua o nelle lingue in cui pubblica:',
    'about.sources.langs': 'Lingue',
    'about.sources.other':
      'Gli eventi provengono da Armenopole, le radio dai loro flussi e le immagini dei social dagli account citati.',
    'about.contact.title': 'Contatti',
    'about.contact.body': 'Un errore, una fonte da proporre, una stazione che tace? Scrivete a',
    'news.title': 'Notizie',
    ...rubricStrings('it'),
    'news.subtitle': 'Le ultime pubblicazioni di ogni rubrica del Courrier d’Erevan',
    'news.armradio': 'In diretta dall’Armenia · Public Radio of Armenia',
    'news.readmore': 'Continua a leggere',
    'news.prev': 'Precedente',
    'news.next': 'Successivo',
    'news.source': 'Fonte',
    'news.empty': 'Nessun articolo per il momento.',
    'news.originalLang': 'Articoli in francese',
    'agenda.title': 'Eventi',
    'agenda.subtitle': 'Eventi armeni nel mondo e in Svizzera',
    'agenda.switzerland': 'Svizzera',
    'agenda.world': 'Mondo',
    'agenda.country': 'Paese',
    'agenda.empty': 'Nessun evento in programma.',
    'agenda.more': 'Tutti gli eventi armeni, paese per paese',
    'agenda.page.h1': 'Gli eventi armeni nel mondo',
    'agenda.page.intro':
      'L’elenco completo dei prossimi eventi armeni: raccolto ogni ora su armenopole.com, in decine di paesi e in Svizzera. Un evento scompare da solo una volta passato: questa pagina mostra sempre e soltanto ciò che resta da vedere.',
    'agenda.page.count': 'eventi in programma, nel mondo e in Svizzera',
    'agenda.page.home': 'Torna alla home',
    'social.title': 'Social network',
    'social.subtitle':
      'Due flussi: una selezione Instagram estratta a sorte ogni ora, e l’arte che condivide Don Narek',
    'fb.title': 'Arte armena',
    'fb.by': 'di Don Narek',
    'fb.subtitle': 'Le ultime 25 pubblicazioni, in immagini',
    'fb.view': 'Vedi la pubblicazione',
    'ig.title': 'Instagram',
    'ig.subtitle': 'Un mosaico d’ispirazione armena, scelto a caso',
    'ig.strand': 'Mosaico armeno',
    'ig.strand.people': 'Volti armeni',
    'ig.strand.studio': 'Atelier armeni',
    'ig.strand.creators': 'Creativi armeni',
    'ig.strand.land': 'Terre armene',
    'ig.shuffle': 'Mescola',
    'ig.visit': 'Vedi il profilo',
    'ig.accounts.all': 'Gli account seguiti ({n})',
    'ig.accounts.less': 'Nascondi gli account',
    'ig.view': 'Vedi su Instagram',
    'social.enlarge': 'Ingrandisci l’immagine',
    'fb.zoom': 'Ingrandisci',
    'ig.zoom': 'Ingrandisci',
    'lb.dialog': 'Immagine ingrandita',
    'lb.close': 'Chiudi',
    'lb.prev': 'Immagine precedente',
    'lb.next': 'Immagine successiva',
    'footer.built': 'Istantanea statica · fonti collegate ai loro siti d’origine',
    'footer.write': 'Scriveteci',
    'footer.sources': 'Fonti',
    'privacy.title': 'Informativa sulla privacy',
    'privacy.intro':
      'Questo sito è un’istantanea statica: niente account, niente moduli, niente database. Non vi chiede nulla e non conserva nulla che vi identifichi personalmente.',
    'privacy.analytics.title': 'Misurazione del pubblico',
    'privacy.analytics.body':
      'Utilizziamo Google Analytics e Cloudflare Web Analytics per contare le visite e sapere quali rubriche vengono lette. Al di fuori dello Spazio economico europeo e del Regno Unito, Google Analytics installa un cookie che permette di riconoscere un visitatore da una visita all’altra. Dal SEE e dal Regno Unito questo cookie non viene installato: la misurazione è anonima e senza cookie, come richiede il GDPR. Cloudflare Web Analytics non installa alcun cookie, ovunque vi troviate.',
    'privacy.analytics.optout':
      'Per rifiutare questo cookie, bloccatelo nel vostro browser. Il sito funziona allo stesso modo anche senza.',
    'privacy.storage.title': 'Conservato sul vostro dispositivo',
    'privacy.storage.body':
      'La vostra scelta del tema giorno / notte è salvata localmente dal browser. Non lascia mai il vostro dispositivo e non ci viene mai trasmessa.',
    'privacy.content.title': 'Contenuti di terzi',
    'privacy.content.body':
      'Articoli, eventi e pubblicazioni provengono da siti di terzi, citati e collegati. Seguendo un link si arriva presso l’editore interessato, alla cui informativa sulla privacy si è allora soggetti.',
    'privacy.rights.title': 'I vostri diritti',
    'privacy.rights.body':
      'Potete chiedere l’accesso ai dati che vi riguardano, la loro rettifica o la loro cancellazione. Poiché il sito non raccoglie alcun dato nominativo, in pratica ciò riguarda soltanto le misurazioni aggregate del pubblico.',
    'privacy.contact': 'Per qualsiasi domanda:',
    'sections.actualite': 'Attualità',
    'sections.societe': 'Società',
    'sections.economie': 'Economia',
    'sections.arts-et-culture': 'Arte e cultura',
    'sections.francophonie': 'Armenia francofona',
    'sections.opinions': 'Opinioni',
    'sections.region': 'Regione',
    'sections.diasporas': 'Diaspore',
    'armcats.politics': 'Politica',
    'armcats.society': 'Società',
    'armcats.economics': 'Economia',
    'armcats.analytics': 'Analisi',
    'armcats.world': 'Mondo',
    'armcats.culture': 'Cultura',
    'armcats.sport': 'Sport',
    'namcats.actualites': 'Attualità',
    'namcats.sport': 'Sport',
    'namcats.communaute': 'Comunità',
    'namcats.culture': 'Cultura',
    'namcats.lifestyle': 'Lifestyle',
    'namcats.magazine': 'Riviste',
    'azkcats.armenie-artsakh': 'Armenia e Artsakh',
    'azkcats.communaute': 'Comunità',
    'azkcats.divers': 'Varie',
    'aitcats.armenie': 'Armenia',
    'aitcats.art-culture': 'Arte e cultura',
    'aitcats.artsakh': 'Artsakh',
    'aitcats.diaspora': 'Diaspora',
    'aitcats.france': 'Francia',
    'aitcats.geopolitique': 'Geopolitica',
    'aitcats.politique': 'Politica',
    'aitcats.un-autre-regard': 'Un altro sguardo',
    'browser.subtitle': 'Tutte le rubriche, fonte per fonte',
    'news.sources': '{n} redazioni armene',
    'browser.armradio': 'Radio pubblica armena',
    'browser.asbarez': 'Asbarez – quotidiano armeno di Los Angeles',
    'browser.armenianweekly': 'The Armenian Weekly – settimanale armeno di Boston',
    'browser.oragark': 'Oragark – quotidiano della FRA',
    'browser.californiacourier': 'The California Courier – la rubrica di Harut Sassounian',
    'browser.civilnet': 'CivilNet – testata indipendente di Erevan',
    'browser.newsam': 'NEWS.am – il principale gruppo editoriale privato di Erevan',
    'browser.courrier': 'Courrier d’Erevan',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Écho des Arméniens de Suisse',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Armenpress',
    'browser.live': 'In diretta',
    'apcats.armenia': 'Armenia',
    'apcats.economy': 'Economia',
    'apcats.world': 'Mondo',
    'apcats.culture': 'Cultura',
    'apcats.sports': 'Sport',
    'apcats.fact-check': 'Verifica dei fatti',
    'apcats.projects': 'Progetti esclusivi',
    'radio.eyebrow': 'Erevan · 128 kbps',
    'radio.title': 'In diretta',
    'radio.subtitle': 'Diciassette radio armene, in streaming continuo',
    'radio.onair': 'In diretta',
    'radio.tz': 'Erevan',
    'radio.play': 'Ascolta in diretta',
    'radio.pause': 'Metti in pausa',
    'radio.loading': 'Connessione al flusso…',
    'radio.error': 'Flusso non disponibile.',
    'radio.retry': 'Riprova',
    'radio.offair': 'fuori onda',
    'radio.volume': 'Volume',
    'radio.station': 'Stazione',
    'radio.stations.all': 'Vedi tutte le {n} stazioni',
    'radio.stations.less': 'Mostra meno',
    'radio.st.public': 'Primo canale',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Radio Arevik',
    'radio.st.culture': 'Radio Culture',
    'radio.st.mariam': 'Radio Mariam',
    'radio.st.vov': 'Voice of Van',
    'radio.st.lav': 'Lav Radio',
    'radio.st.fama': 'Radio Fama',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
    'radio.st.jazz': 'Radio Jazz FM',
    'radio.st.vem': 'Radio Vem',
    'radio.st.yerevanfm': 'Radio Yerevan',
    'radio.st.tsayn': 'Yeridasartoutian Tsayne',
    'radio.st.radioa': 'Radio A',
    'radio.st.aypfm': 'AYP FM',
    'radio.more': 'Le diciassette radio armene in diretta',
    'radio.page.h1': 'Radio armene in diretta',
    'radio.page.intro':
      'Diciassette radio armene in streaming continuo, riunite in un’unica pagina: le emittenti pubbliche di Erevan, le stazioni indipendenti e quelle della diaspora. Nessuna registrazione, niente da installare: l’audio parte con un clic e segue il tema giorno / notte del sito. I flussi sono quelli delle stazioni stesse; Arménie Info non ospita né ricodifica alcun segnale.',
    'radio.page.list': 'Le diciassette stazioni',
    'radio.page.city': 'Città',
    'radio.city.yerevan': 'Erevan',
    'radio.city.beirut': 'Beirut',
    'radio.city.glendale': 'Glendale',
    'radio.city.bourglesvalence': 'Bourg-lès-Valence',
    'radio.city.alfortville': 'Alfortville',
    'radio.page.genre': 'Genere',
    'radio.page.lang': 'Lingua di trasmissione',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Bitrate',
    'radio.page.home': 'Torna alla home',
    'radio.remote.title': 'Cambiare stazione senza tornare sul sito',
    'radio.remote.keys':
      'Una volta avviata la radio, i pulsanti «precedente» e «successivo» della schermata di blocco del telefono passano da una stazione all’altra. Anche quelli al volante, quando il telefono è collegato all’auto via Bluetooth. La radio si ascolta anche con auricolari o cuffie.',
    'radio.remote.skip': 'E se una stazione si interrompe, il lettore passa da solo alla successiva.',
    'radio.remote.icon': 'Pulsanti precedente e successivo',
    'radio.remote.prev': 'Stazione precedente',
    'radio.remote.next': 'Stazione successiva',
    'radio.genre.culture': 'Cultura',
    'radio.genre.general': 'Generalista',
    'radio.genre.jazz': 'Jazz',
    'radio.genre.kids': 'Bambini',
    'radio.genre.music': 'Musica',
    'radio.genre.news': 'Attualità',
    'radio.genre.religious': 'Religiosa',
    'radio.genre.university': 'Universitaria',
    'radio.genre.youth': 'Giovani',
    'radio.page.lang.hy': 'Armeno',
    'radio.page.lang.fr-hy': 'Francese e armeno',
  },
  en: {
    // La marque suit le domaine (.org = Armenia News), pas la langue — voir
    // sites.config.js. Forme latine sur les trois langues du .org : pas de
    // translittération arménienne ou russe, qui rouvrirait la même
    // divergence marque/métadonnées sous une autre forme.
    'site.title': 'Armenia News',
    'site.tagline': 'An hourly snapshot of Armenian life, from the world and Switzerland',
    'site.snapshot': 'Snapshot of',
    'site.cadence': 'hourly',

    'nav.news': 'News',
    'nav.radio': 'Live',
    'nav.agenda': 'Events',
    'nav.social': 'Social',
    'footer.pages': 'Site pages',
    'footer.home': 'Home',
    'viewpage.also': 'See also',
    'about.h1': 'About Armenia News',
    'about.intro':
      'Armenia News is an independent, Switzerland-based site edited by {editor}, which gathers Armenian life every hour as its own media tell it: the newsrooms’ dispatches, live radio, the diaspora’s events and its social networks. Nothing is rewritten — every headline links back to the outlet that published it.',
    'about.what.title': 'What you will find here',
    'about.what.body':
      'A static snapshot, rebuilt every hour by a program that re-reads the sources and regenerates the pages. There is no account, no form, no database.',
    'about.what.news': 'the latest dispatches from Armenian newsrooms, section by section, in the language of the page;',
    'about.what.radio': '{n} stations streaming live, each with a sourced fact sheet (city, genre, broadcast language);',
    'about.what.agenda': 'diaspora events, country by country, sourced from Armenopole;',
    'about.what.social': 'a hand-curated selection of Instagram accounts and Don Narek’s Facebook wall.',
    'about.what.sites':
      'The same snapshot is served under two names, one per domain and lead language:',
    'about.rules.title': 'The rules',
    'about.rules.links':
      'Nothing is rewritten or summarised: headlines are the newsrooms’ own, and every card leads to the original article, on its publisher’s site.',
    'about.rules.hourly':
      'Everything is dated. The banner at the top gives the time of the snapshot; every dispatch shows its age.',
    'about.rules.noads':
      'No ads, no account, no tracking cookie in the European Economic Area — the privacy policy in the footer says exactly what is measured.',
    'about.rules.facts':
      'No station fact is stated without a source; a field that could not be verified is left empty rather than guessed.',
    'about.sources.title': 'The newsrooms',
    'about.sources.body':
      'Dispatches come from these newsrooms’ own sites, read as they are. Each appears under the language(s) it publishes in:',
    'about.sources.langs': 'Languages',
    'about.sources.other':
      'The events come from Armenopole, the radio from the stations’ own streams, and the social images from the accounts cited.',
    'about.contact.title': 'Contact',
    'about.contact.body': 'A mistake, a source to suggest, a station gone silent? Write to',

    'news.title': 'News',
    ...rubricStrings('en'),
    'news.subtitle': "The latest stories from each section of Le Courrier d'Erevan",
    'news.armradio': 'Live from Armenia · Public Radio of Armenia',
    'news.readmore': 'Read more',
    'news.prev': 'Previous',
    'news.next': 'Next',
    'news.source': 'Source',
    'news.empty': 'No articles yet.',
    'news.originalLang': '',

    'agenda.title': 'Events',
    'agenda.subtitle': 'Armenian events around the world and in Switzerland',
    'agenda.switzerland': 'Switzerland',
    'agenda.world': 'World',
    'agenda.country': 'Country',
    'agenda.empty': 'No events announced.',
    'agenda.more': 'The full Armenian events calendar',

    // Page /events
    'agenda.page.h1': 'The Armenian agenda, around the world',
    'agenda.page.intro':
      'The full list of upcoming Armenian events, gathered hourly from armenopole.com across dozens of countries and Switzerland. An event drops off on its own once it has passed — this page only ever shows what still lies ahead.',
    'agenda.page.count': 'upcoming events, in Switzerland and around the world',
    'agenda.page.home': 'Back to the home page',

    'social.title': 'Social networks',
    'social.subtitle':
      'Two feeds: an Instagram selection drawn afresh every hour, and the art Don Narek shares',

    'fb.title': 'Armenian Art',
    'fb.by': 'by Don Narek',
    'fb.subtitle': 'The 25 latest posts, in pictures',
    'fb.view': 'View the post',

    'ig.title': 'Instagram',
    'ig.subtitle': 'A mosaic of Armenian inspiration, at random',
    'ig.strand': 'Armenian mosaic',
    'ig.strand.people': 'Armenian faces',
    'ig.strand.studio': 'Armenian studios',
    'ig.strand.creators': 'Armenian creators',
    'ig.strand.land': 'Armenian lands',
    'ig.shuffle': 'Shuffle',
    'ig.visit': 'View profile',
    'ig.accounts.all': 'Accounts we follow ({n})',
    'ig.accounts.less': 'Hide accounts',
    'ig.view': 'View on Instagram',

    'social.enlarge': 'Enlarge image',
    'fb.zoom': 'Enlarge',
    'ig.zoom': 'Enlarge',
    'lb.dialog': 'Enlarged image',
    'lb.close': 'Close',
    'lb.prev': 'Previous image',
    'lb.next': 'Next image',

    'footer.built': 'Static snapshot · sources linked to their original sites',
    'footer.write': 'Write to us',
    'footer.sources': 'Sources',

    'privacy.title': 'Privacy policy',
    'privacy.intro':
      'This site is a static snapshot: no accounts, no forms, no database. It asks you for nothing and keeps nothing that identifies you personally.',
    'privacy.analytics.title': 'Audience measurement',
    'privacy.analytics.body':
      'We use Google Analytics and Cloudflare Web Analytics to count visits and see which sections are read. Outside the European Economic Area and the United Kingdom, Google Analytics sets a cookie that lets it recognise a visitor from one visit to the next. From the EEA and the UK that cookie is not set: measurement there is anonymous and cookieless, as the GDPR requires. Cloudflare Web Analytics sets no cookie anywhere.',
    'privacy.analytics.optout':
      'To refuse that cookie, block it in your browser. The site works exactly the same without it.',
    'privacy.storage.title': 'Kept on your device',
    'privacy.storage.body':
      'Your day / night theme choice is stored locally by your browser. It never leaves your device and is never sent to us.',
    'privacy.content.title': 'Third-party content',
    'privacy.content.body':
      'Articles, events and posts come from third-party sites, credited and linked. Following a link takes you to that publisher, whose own privacy policy then applies.',
    'privacy.rights.title': 'Your rights',
    'privacy.rights.body':
      'You may request access to data concerning you, its correction or its deletion. As the site collects no personal data, in practice this is limited to aggregated audience measurement.',
    'privacy.contact': 'Questions:',

    'sections.actualite': 'News',
    'sections.societe': 'Society',
    'sections.economie': 'Economy',
    'sections.arts-et-culture': 'Arts & Culture',
    'sections.francophonie': 'Francophone Armenia',
    'sections.opinions': 'Opinions',
    'sections.region': 'Region',
    'sections.diasporas': 'Diasporas',

    'armcats.politics': 'Politics',
    'armcats.society': 'Society',
    'armcats.economics': 'Economics',
    'armcats.analytics': 'Analytics',
    'armcats.world': 'World',
    'armcats.culture': 'Culture',
    'armcats.sport': 'Sport',

    'namcats.actualites': 'News',
    'namcats.sport': 'Sport',
    'namcats.communaute': 'Community',
    'namcats.culture': 'Culture',
    'namcats.lifestyle': 'Lifestyle',
    'namcats.magazine': 'Magazines',

    'azkcats.armenie-artsakh': 'Armenia & Artsakh',
    'azkcats.communaute': 'Community',
    'azkcats.divers': 'Miscellany',

    'aitcats.armenie': 'Armenia',
    'aitcats.art-culture': 'Art & Culture',
    'aitcats.artsakh': 'Artsakh',
    'aitcats.diaspora': 'Diaspora',
    'aitcats.france': 'France',
    'aitcats.geopolitique': 'Geopolitics',
    'aitcats.politique': 'Politics',
    'aitcats.un-autre-regard': 'Another view',

    'browser.subtitle': 'Every rubric, source by source',
    'news.sources': '{n} Armenian newsrooms',
    'browser.armradio': 'Public Radio of Armenia',
    'browser.asbarez': 'Asbarez — Los Angeles Armenian daily',
    'browser.armenianweekly': 'The Armenian Weekly — Boston Armenian weekly',
    'browser.oragark': 'Oragark — ARF daily',
    'browser.californiacourier': 'The California Courier — Glendale Armenian weekly',
    'browser.civilnet': 'CivilNet — independent newsroom in Yerevan',
    'browser.newsam': 'NEWS.am — Yerevan’s largest private news group',
    'browser.courrier': 'Le Courrier d’Erevan',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Echo of Armenians in Switzerland',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Armenpress',
    'browser.live': 'Live',
    'apcats.armenia': 'Armenia',
    'apcats.economy': 'Economy',
    'apcats.world': 'World',
    'apcats.culture': 'Culture',
    'apcats.sports': 'Sports',
    'apcats.fact-check': 'Fact Check',
    'apcats.projects': 'Exclusive Projects',

    'radio.eyebrow': 'Yerevan · 128 kbps',
    'radio.title': 'Live radio',
    'radio.subtitle': 'Seventeen Armenian stations, streaming live',
    'radio.onair': 'On air',
    'radio.tz': 'Yerevan',
    'radio.play': 'Listen live',
    'radio.pause': 'Pause',
    'radio.loading': 'Connecting to the stream…',
    'radio.error': 'Stream unavailable.',
    'radio.retry': 'Retry',
    'radio.offair': 'off air',
    'radio.volume': 'Volume',
    'radio.station': 'Station',
    'radio.stations.all': 'Show all {n} stations',
    'radio.stations.less': 'Show fewer',
    'radio.st.public': 'First Programme',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Radio Arevik',
    'radio.st.culture': 'Radio Culture',
    'radio.st.mariam': 'Radio Mariam',
    'radio.st.vov': 'Voice of Van',
    'radio.st.lav': 'Lav Radio',
    'radio.st.fama': 'Radio Fama',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
    'radio.st.jazz': 'Radio Jazz FM',
    'radio.st.vem': 'Vem Radio',
    'radio.st.yerevanfm': 'Radio Yerevan',
    'radio.st.tsayn': 'Yeridasartoutian Tsayne',
    'radio.st.radioa': 'Radio A',
    'radio.st.aypfm': 'AYP FM',
    'radio.more': 'All seventeen Armenian radio stations',

    // Page /radio
    'radio.page.h1': 'Armenian radio online',
    'radio.page.intro':
      'Seventeen Armenian stations streaming live on one page: the public networks of Yerevan, the independent broadcasters and the diaspora’s own. No sign-up, nothing to install — sound starts on click and follows the site’s day / night switch. The streams are the stations’ own; Armenia News neither hosts nor re-encodes any signal.',
    'radio.page.list': 'The seventeen stations',
    'radio.page.city': 'City',
    'radio.city.yerevan': 'Yerevan',
    'radio.city.beirut': 'Beirut',
    'radio.city.glendale': 'Glendale',
    'radio.city.bourglesvalence': 'Bourg-lès-Valence',
    'radio.city.alfortville': 'Alfortville',
    'radio.page.genre': 'Format',
    'radio.page.lang': 'On-air language',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Bitrate',
    'radio.page.home': 'Back to the home page',
    'radio.remote.title': 'Switch stations without coming back to the site',
    'radio.remote.keys':
      'Once the radio is playing, the previous and next buttons on your phone’s lock screen move from one station to the next. So do the buttons on your steering wheel, when the phone is connected to the car over Bluetooth. You can also listen with earphones or headphones.',
    'radio.remote.skip': 'And if a station drops out, the player moves on to the next one by itself.',
    'radio.remote.icon': 'Previous and next buttons',
    'radio.remote.prev': 'Previous station',
    'radio.remote.next': 'Next station',
    'radio.genre.culture': 'Culture',
    'radio.genre.general': 'General',
    'radio.genre.jazz': 'Jazz',
    'radio.genre.kids': 'Kids',
    'radio.genre.music': 'Music',
    'radio.genre.news': 'News',
    'radio.genre.religious': 'Religious',
    'radio.genre.university': 'University',
    'radio.genre.youth': 'Youth',
    'radio.page.lang.hy': 'Armenian',
    'radio.page.lang.fr-hy': 'French and Armenian',
  },
  hy: {
    // « Արմենիա Ին֖ո » — la seule langue dont la marque affichée s'écarte du
    // domaine (en/ru affichent « Armenia News ») ET la seule écrite dans une
    // autre écriture que le latin.
    //
    // C'est une TRANSLITTÉRATION, pas une traduction : le son du nom latin
    // transcrit en lettres arméniennes, et non « Հայաստան » qui rendrait
    // *Armenia* par le nom natif du pays. Le procédé a un précédent établi
    // dans les médias arméniens — la chaîne « Արմենիա TV » s'écrit ainsi.
    //
    // Elle rend en Noto Serif Armenian : Fraunces n'a pas d'arménien, donc la
    // pile de --font-display y descend d'elle-même. Trois réglages de
    // global.css étaient justifiés par « la marque ne compose que du latin »
    // et ont dû être rouverts pour cette seule langue — la taille apparente
    // et l'approche de `.hero__title`/`.nav__brand`, plus l'italique du héros
    // (Noto Serif Armenian n'en a pas, le navigateur la synthétisait en
    // penché). Si vous repassez cette marque en latin, ces trois exceptions
    // redeviennent inutiles.
    //
    // Cela déroge à la règle « la marque suit le domaine » que porte
    // sites.config.js, et il faut savoir ce que ça implique : `SITES[id].brand`
    // reste « Armenia News », et le <title> se composant `${brand} · ${tagline}`,
    // l'onglet du navigateur, l'og:title et le JSON-LD de /hy/ annoncent
    // toujours « Armenia News ». L'écart est donc entre le texte VU dans la
    // page (nav, héros, pied) et les métadonnées. Il est assumé et demandé ;
    // pour l'effacer il faudrait une marque par langue dans sites.config.js,
    // ce qui touche le SEO et la carte de partage (un JPG cuit qui dit
    // « Armenia News »). Ne « corrigez » pas l'un des deux côtés seul en
    // croyant réparer une incohérence : les deux valeurs sont voulues.
    'site.title': 'Արմենիա Ինֆո',
    'site.tagline': 'Հայկական կյանքի ժամային պատկեր՝ աշխարհից եւ Շվեյցարիայից',
    'site.snapshot': 'Պատկեր՝',
    'site.cadence': 'ամեն ժամ',

    'nav.news': 'Լուրեր',
    'nav.radio': 'Ուղիղ',
    'nav.agenda': 'Միջոցառումներ',
    'nav.social': 'Ցանցեր',
    'footer.pages': 'Կայքի էջերը',
    'footer.home': 'Գլխավոր էջ',
    'viewpage.also': 'Տես նաև',
    'about.h1': 'Armenia News-ի մասին',
    'about.intro':
      'Armenia News-ը Շվեյցարիայում հիմնված անկախ կայք է, որը խմբագրում է {editor}-ը և որն ամեն ժամ հավաքում է հայկական կյանքը այնպես, ինչպես այն պատմում են հայկական լրատվամիջոցները՝ խմբագրությունների լուրերը, ուղիղ եթերի ռադիոն, սփյուռքի միջոցառումներն ու սոցիալական ցանցերը։ Ոչինչ չի վերաշարադրվում․ յուրաքանչյուր վերնագիր տանում է այն հրատարակչի մոտ, որը հրապարակել է այն։',
    'about.what.title': 'Ինչ կգտնեք այստեղ',
    'about.what.body':
      'Ստատիկ պատկեր, որն ամեն ժամ վերակառուցում է ծրագիրը՝ վերընթերցելով աղբյուրները և վերստեղծելով էջերը։ Չկա ոչ հաշիվ, ոչ ձև, ոչ տվյալների բազա։',
    'about.what.news': 'հայկական խմբագրությունների վերջին լուրերը՝ բաժին առ բաժին, էջի լեզվով․',
    'about.what.radio': '{n} ռադիոկայան ուղիղ եթերում, յուրաքանչյուրը՝ աղբյուրներով հիմնավորված քարտով (քաղաք, ժանր, եթերի լեզու)․',
    'about.what.agenda': 'սփյուռքի միջոցառումները՝ երկիր առ երկիր, Armenopole-ից․',
    'about.what.social': 'ձեռքով ընտրված Instagram հաշիվներ և Դոն Նարեկի Facebook պատը։',
    'about.what.sites':
      'Նույն պատկերը մատուցվում է երկու անունով՝ մեկը յուրաքանչյուր դոմենի և գլխավոր լեզվի համար․',
    'about.rules.title': 'Կանոնները',
    'about.rules.links':
      'Ոչինչ չի վերաշարադրվում կամ ամփոփվում․ վերնագրերը խմբագրություններինն են, և յուրաքանչյուր քարտ տանում է բնօրինակ հոդվածին՝ հրատարակչի կայքում։',
    'about.rules.hourly':
      'Ամեն ինչ թվագրված է։ Վերևի շերտը ցույց է տալիս պատկերի ժամը, յուրաքանչյուր լուր՝ իր տարիքը։',
    'about.rules.noads':
      'Ոչ գովազդ, ոչ հաշիվ, ոչ հետևող cookie Եվրոպական տնտեսական տարածքում․ ստորին մասի գաղտնիության քաղաքականությունը հստակ ասում է, թե ինչ է չափվում։',
    'about.rules.facts':
      'Ռադիոկայանի ոչ մի փաստ չի հաստատվում առանց աղբյուրի․ չստուգված դաշտը մնում է դատարկ, ոչ թե գուշակված։',
    'about.sources.title': 'Խմբագրությունները',
    'about.sources.body':
      'Լուրերը գալիս են այս խմբագրությունների կայքերից՝ առանց փոփոխության։ Յուրաքանչյուրը հայտնվում է այն լեզվով կամ լեզուներով, որոնցով հրապարակում է․',
    'about.sources.langs': 'Լեզուներ',
    'about.sources.other':
      'Միջոցառումները՝ Armenopole-ից, ռադիոն՝ կայանների սեփական հոսքերից, սոցիալական ցանցերի պատկերները՝ նշված հաշիվներից։',
    'about.contact.title': 'Կապ',
    'about.contact.body': 'Սխա՞լ, առաջարկվող աղբյո՞ւր, լռած ռադիոկայա՞ն։ Գրեք՝',

    'news.title': 'Լուրեր',
    ...rubricStrings('hy'),
    'news.subtitle': '«Կուրիեր» թերթի յուրաքանչյուր բաժնի վերջին հրապարակումները',
    'news.armradio': 'Ուղիղ Հայաստանից · Հանրային ռադիո',
    'news.readmore': 'Կարդալ ավելին',
    'news.prev': 'Նախորդ',
    'news.next': 'Հաջորդ',
    'news.source': 'Աղբյուր',
    'news.empty': 'Դեռ հոդվածներ չկան։',
    'news.originalLang': '',

    'agenda.title': 'Միջոցառումներ',
    'agenda.subtitle': 'Հայկական միջոցառումներ աշխարհում եւ Շվեյցարիայում',
    'agenda.switzerland': 'Շվեյցարիա',
    'agenda.world': 'Աշխարհ',
    'agenda.country': 'Երկիր',
    'agenda.empty': 'Հայտարարված միջոցառումներ չկան։',
    'agenda.more': 'Հայկական միջոցառումների ամբողջական օրացույցը՝ երկիր առ երկիր',

    // Page /hy/events — traduction à relire par un locuteur natif.
    'agenda.page.h1': 'Հայկական օրացույցը՝ ամբողջ աշխարհում',
    'agenda.page.intro':
      'Հայկական առաջիկա բոլոր միջոցառումների ամբողջական ցանկը՝ հավաքված ամեն ժամ armenopole.com կայքից, տասնյակ երկրներում և Շվեյցարիայում։ Միջոցառումն ինքն իրեն անհետանում է ցանկից՝ անցնելուց հետո — այս էջը միշտ ցույց է տալիս միայն այն, ինչ դեռ առջևում է։',
    'agenda.page.count': 'առաջիկա միջոցառում՝ աշխարհում և Շվեյցարիայում',
    'agenda.page.home': 'Վերադառնալ գլխավոր էջ',

    'social.title': 'Սոցիալական ցանցեր',
    'social.subtitle':
      'Երկու հոսք՝ ամեն ժամ վերաշաղախված Instagram-ի ընտրանին և Դօն Նարեկի կիսած արվեստը',

    'fb.title': 'Հայկական արվեստ',
    'fb.by': 'Դօն Նարեկի կողմից',
    'fb.subtitle': 'Վերջին 25 հրապարակումները՝ նկարներով',
    'fb.view': 'Դիտել հրապարակումը',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Հայկական ոգեշնչման խճանկար՝ պատահական',
    'ig.strand': 'Հայկական խճանկար',
    'ig.strand.people': 'Հայկական դեմքեր',
    'ig.strand.studio': 'Հայկական արվեստանոցներ',
    'ig.strand.creators': 'Հայ ստեղծագործողներ',
    'ig.strand.land': 'Հայկական բնաշխարհ',
    'ig.shuffle': 'Խառնել',
    'ig.visit': 'Դիտել պրոֆիլը',
    'ig.accounts.all': 'Հետևվող հաշիվները ({n})',
    'ig.accounts.less': 'Թաքցնել հաշիվները',
    'ig.view': 'Դիտել Instagram-ում',

    'social.enlarge': 'Խոշորացնել պատկերը',
    'fb.zoom': 'Խոշորացնել',
    'ig.zoom': 'Խոշորացնել',
    'lb.dialog': 'Խոշորացված պատկեր',
    'lb.close': 'Փակել',
    'lb.prev': 'Նախորդ պատկերը',
    'lb.next': 'Հաջորդ պատկերը',

    'footer.built': 'Ստատիկ պատկեր · աղբյուրները կապված են իրենց կայքերին',
    'footer.write': 'Գրեք մեզ',
    'footer.sources': 'Աղբյուրներ',

    'privacy.title': 'Գաղտնիության քաղաքականություն',
    'privacy.intro':
      'Այս կայքը ստատիկ պատկեր է՝ առանց հաշիվների, ձևաթղթերի կամ տվյալների բազայի։ Այն ձեզնից ոչինչ չի պահանջում և չի պահպանում որևէ բան, որ անձնապես ձեզ նույնականացնի։',
    'privacy.analytics.title': 'Այցելությունների չափում',
    'privacy.analytics.body':
      'Մենք օգտագործում ենք Google Analytics և Cloudflare Web Analytics՝ այցելությունները հաշվելու և իմանալու, թե որ բաժիններն են կարդացվում։ Եվրոպական տնտեսական տարածքից և Միացյալ Թագավորությունից դուրս Google Analytics-ը տեղադրում է cookie, որը թույլ է տալիս ճանաչել այցելուին մեկ այցից մյուսը։ ԵՏՏ-ից և Միացյալ Թագավորությունից այդ cookie-ն չի տեղադրվում. չափումն այնտեղ անանուն է և առանց cookie-ի, ինչպես պահանջում է GDPR-ը։ Cloudflare Web Analytics-ը ոչ մի տեղ cookie չի տեղադրում։',
    'privacy.analytics.optout':
      'Այդ cookie-ն մերժելու համար արգելափակեք այն ձեր դիտարկիչում։ Կայքն առանց դրա աշխատում է ճիշտ նույն կերպ։',
    'privacy.storage.title': 'Պահվում է ձեր սարքում',
    'privacy.storage.body':
      'Ցերեկ / գիշեր ձևավորման ձեր ընտրությունը պահվում է տեղում՝ ձեր դիտարկիչի կողմից։ Այն երբեք չի հեռանում ձեր սարքից և երբեք մեզ չի փոխանցվում։',
    'privacy.content.title': 'Երրորդ կողմի բովանդակություն',
    'privacy.content.body':
      'Հոդվածները, միջոցառումները և հրապարակումները գալիս են երրորդ կողմի կայքերից՝ նշված և հղումով։ Հղմանը հետևելը ձեզ տանում է տվյալ հրատարակչի մոտ, որտեղ գործում է նրա գաղտնիության քաղաքականությունը։',
    'privacy.rights.title': 'Ձեր իրավունքները',
    'privacy.rights.body':
      'Դուք կարող եք պահանջել ձեզ վերաբերող տվյալների հասանելիություն, ուղղում կամ ջնջում։ Քանի որ կայքը անձնական տվյալներ չի հավաքում, գործնականում դա սահմանափակվում է ամփոփ չափումներով։',
    'privacy.contact': 'Հարցերի համար՝',

    'sections.actualite': 'Լուրեր',
    'sections.societe': 'Հասարակություն',
    'sections.economie': 'Տնտեսություն',
    'sections.arts-et-culture': 'Արվեստ եւ մշակույթ',
    'sections.francophonie': 'Ֆրանսախոս Հայաստան',
    'sections.opinions': 'Կարծիքներ',
    'sections.region': 'Տարածաշրջան',
    'sections.diasporas': 'Սփյուռք',

    'armcats.politics': 'Քաղաքականություն',
    'armcats.society': 'Հասարակություն',
    'armcats.economics': 'Տնտեսություն',
    'armcats.analytics': 'Վերլուծություն',
    'armcats.world': 'Աշխարհ',
    'armcats.culture': 'Մշակույթ',
    'armcats.sport': 'Սպորտ',

    'namcats.actualites': 'Լուրեր',
    'namcats.sport': 'Սպորտ',
    'namcats.communaute': 'Համայնք',
    'namcats.culture': 'Մշակույթ',
    'namcats.lifestyle': 'Ապրելակերպ',
    'namcats.magazine': 'Ամսագրեր',

    'azkcats.armenie-artsakh': 'Հայաստան և Արցախ',
    'azkcats.communaute': 'Համայնք',
    'azkcats.divers': 'Զանազան',

    'aitcats.armenie': 'Հայաստան',
    'aitcats.art-culture': 'Արվեստ և մշակույթ',
    'aitcats.artsakh': 'Արցախ',
    'aitcats.diaspora': 'Սփյուռք',
    'aitcats.france': 'Ֆրանսիա',
    'aitcats.geopolitique': 'Աշխարհաքաղաքականություն',
    'aitcats.politique': 'Քաղաքականություն',
    'aitcats.un-autre-regard': 'Այլ հայացք',

    'browser.subtitle': 'Բոլոր բաժինները՝ ըստ աղբյուրի',
    'news.sources': '{n} հայկական խմբագրություն',
    'browser.armradio': 'Հայաստանի հանրային ռադիո',
    'browser.asbarez': 'Ասպարէզ — Լոս Անճելըսի հայ օրաթերթ',
    'browser.armenianweekly': 'The Armenian Weekly — Բոստոնի հայկական շաբաթաթերթ',
    'browser.oragark': 'Օրակարգ — ՀՅԴ օրաթերթ',
    'browser.californiacourier': 'The California Courier — Հարություն Սասունյանի սյունակ',
    'browser.civilnet': 'CivilNet — երևանյան անկախ լրատվամիջոց',
    'browser.newsam': 'NEWS.am — Երևանի խոշորագույն մասնավոր լրատվական խումբ',
    'browser.courrier': '«Կուրիեր դ’Էրեւան»',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Շվեյցարիայի հայերի արձագանք',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Արմենպրես',
    'browser.live': 'Ուղիղ եթեր',
    'apcats.armenia': 'Հայաստան',
    'apcats.economy': 'Տնտեսություն',
    'apcats.world': 'Աշխարհ',
    'apcats.culture': 'Մշակույթ',
    'apcats.sports': 'Սպորտ',
    'apcats.fact-check': 'Փաստերի ստուգում',
    'apcats.projects': 'Հատուկ նախագծեր',

    'radio.eyebrow': 'Երևան · 128 kbps',
    'radio.title': 'Ուղիղ եթեր',
    'radio.subtitle': 'Տասնյոթ հայկական ռադիոկայան՝ ուղիղ եթերում',
    'radio.onair': 'Ուղիղ',
    'radio.tz': 'Երևան',
    'radio.play': 'Միացնել',
    'radio.pause': 'Դադարեցնել',
    'radio.loading': 'Միանում է հեռարձակմանը…',
    'radio.error': 'Հեռարձակումն անհասանելի է։',
    'radio.retry': 'Կրկնել',
    'radio.offair': 'եթերից դուրս',
    'radio.volume': 'Ձայն',
    'radio.station': 'Ալիք',
    'radio.stations.all': 'Տեսնել {n} ռադիոկայանները',
    'radio.stations.less': 'Տեսնել ավելի քիչ',
    'radio.st.public': 'Առաջին ծրագիր',
    'radio.st.im': 'Իմ ռադիո',
    'radio.st.arevik': 'Ռադիո Արևիկ',
    'radio.st.culture': 'Ռադիո Մշակույթ',
    'radio.st.mariam': 'Ռադիո Մարիամ',
    'radio.st.vov': 'Վանա ձայն',
    'radio.st.lav': 'Լավ Ռադիո',
    'radio.st.fama': 'Ռադիո Ֆամա',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
    'radio.st.jazz': 'Radio Jazz FM',
    // « Վէմ » et « Երիտասարդութեան » sont écrits comme les stations elles-mêmes
    // les écrivent — en orthographe OCCIDENTALE (vem.am titre « «Վէմ»
    // ռադիոկայան », et l'antenne de Beyrouth est une antenne de la diaspora
    // occidentale). L'interface, elle, est en arménien oriental : c'est un
    // écart voulu, pas une coquille. Un nom propre s'écrit comme son porteur
    // l'écrit.
    'radio.st.vem': 'Վէմ ռադիո',
    'radio.st.yerevanfm': 'Ռադիո Երևան',
    'radio.st.tsayn': 'Երիտասարդութեան ձայնը',
    'radio.st.radioa': 'Ռատիօ Ա',
    'radio.st.aypfm': 'AYP FM',
    'radio.more': 'Բոլոր տասնյոթ հայկական ռադիոկայանները՝ ուղիղ եթերում',

    // Page /radio — traductions hy/ru à relire par un locuteur natif (voir
    // task-5-report.md).
    'radio.page.h1': 'Հայկական ռադիո ուղիղ եթերում',
    'radio.page.intro':
      'Տասնյոթ հայկական ռադիոկայաններ՝ ուղիղ հեռարձակմամբ մեկ էջում. Երևանի հանրային ցանցերը, անկախ հեռարձակողները և սփյուռքի իրենը։ Ոչ մի գրանցում, ոչինչ տեղադրելու կարիք չկա. ձայնը սկսվում է սեղմումով և հետևում է կայքի ցերեկ / գիշեր անջատիչին։ Հոսքերը կայանների սեփականն են. Armenia News-ը չի հյուրընկալում և չի վերակոդավորում որևէ ազդանշան։',
    'radio.page.list': 'Տասնյոթ ռադիոկայանները',
    'radio.page.city': 'Քաղաք',
    'radio.city.yerevan': 'Երևան',
    'radio.city.beirut': 'Բեյրութ',
    'radio.city.glendale': 'Գլենդեյլ',
    'radio.city.bourglesvalence': 'Բուր-լե-Վալանս',
    'radio.city.alfortville': 'Ալֆորվիլ',
    'radio.page.genre': 'Ժանր',
    'radio.page.lang': 'Եթերի լեզուն',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Հոսքի արագություն',
    'radio.page.home': 'Վերադառնալ գլխավոր էջ',
    'radio.remote.title': 'Փոխեք կայանը՝ առանց կայք վերադառնալու',
    'radio.remote.keys':
      'Ռադիոն միացնելուց հետո հեռախոսի կողպված էկրանի «նախորդ» և «հաջորդ» կոճակներով կարող եք անցնել մի կայանից մյուսը։ Նույնը՝ մեքենայի ղեկի կոճակներով, երբ հեռախոսը Bluetooth-ով միացված է մեքենային։ Ռադիոն կարող եք լսել նաև ականջակալներով։',
    'radio.remote.skip': 'Իսկ եթե կայանն անջատվի, նվագարկիչն ինքը կանցնի հաջորդին։',
    'radio.remote.icon': '«Նախորդ» և «հաջորդ» կոճակներ',
    'radio.remote.prev': 'Նախորդ կայանը',
    'radio.remote.next': 'Հաջորդ կայանը',
    'radio.genre.culture': 'Մշակույթ',
    'radio.genre.general': 'Ընդհանուր',
    'radio.genre.jazz': 'Ջազ',
    'radio.genre.kids': 'Մանկական',
    'radio.genre.music': 'Երաժշտություն',
    'radio.genre.news': 'Լուրեր',
    'radio.genre.religious': 'Կրոնական',
    'radio.genre.university': 'Համալսարանական',
    'radio.genre.youth': 'Երիտասարդական',
    'radio.page.lang.hy': 'Հայերեն',
    'radio.page.lang.fr-hy': 'Ֆրանսերեն և հայերեն',
  },
  ru: {
    // Forme latine délibérée : la marque suit le domaine (.org = Armenia
    // News), pas la langue — voir sites.config.js et le commentaire jumeau
    // dans le bloc `en`.
    'site.title': 'Armenia News',
    'site.tagline': 'Ежечасный снимок армянской жизни, со всего мира и из Швейцарии',
    'site.snapshot': 'Снимок от',
    'site.cadence': 'каждый час',

    'nav.news': 'Новости',
    'nav.radio': 'В эфире',
    'nav.agenda': 'Афиша',
    'nav.social': 'Соцсети',
    'footer.pages': 'Страницы сайта',
    'footer.home': 'Главная',
    'viewpage.also': 'См. также',
    'about.h1': 'О сайте Armenia News',
    // /ru/about/ est classée « Soft 404 » par le test en direct de Search
    // Console (août puis 17-18 oct. 2026 : 200, HTML rendu complet), alors que
    // /ru/radio/ et les « À propos » fr/en/hy passent. Deux hypothèses ont été
    // RÉFUTÉES par un nouveau test : le mot « Ошибка » (août) et l'accumulation
    // de négations (« Ничего не… », « нет ни… », réécrites à l'affirmative le
    // 18 oct.). La cause reste inconnue — ne pas y voir une règle d'écriture.
    'about.intro':
      'Armenia News — независимый сайт, базирующийся в Швейцарии, который ведёт {editor} и который каждый час собирает армянскую жизнь такой, какой её рассказывают сами армянские медиа: сообщения редакций, радио в прямом эфире, события диаспоры и её социальные сети. Каждый заголовок приводится дословно и ведёт к изданию, которое его опубликовало.',
    'about.what.title': 'Что вы здесь найдёте',
    'about.what.body':
      'Статический снимок, который каждый час пересобирает программа: она перечитывает источники и заново генерирует страницы. Все материалы открыты сразу, для любого читателя.',
    'about.what.news': 'последние сообщения армянских редакций, рубрика за рубрикой, на языке страницы;',
    'about.what.radio': '{n} радиостанций в прямом эфире, каждая — с карточкой фактов с указанием источников (город, жанр, язык вещания);',
    'about.what.agenda': 'события диаспоры, страна за страной, по данным Armenopole;',
    'about.what.social': 'подборка Instagram-аккаунтов, отобранных вручную, и стена Facebook Дон Нарека.',
    'about.what.sites':
      'Один и тот же снимок подаётся под двумя именами — по одному на домен и его основной язык:',
    'about.rules.title': 'Правила',
    'about.rules.links':
      'Заголовки принадлежат редакциям и приводятся в исходном виде; каждая карточка ведёт к оригинальной статье на сайте издателя.',
    'about.rules.hourly':
      'Всё датировано. Лента вверху показывает время снимка; у каждого сообщения указан его возраст.',
    'about.rules.noads':
      'Сайт бесплатен и свободен от рекламы и регистрации; в Европейской экономической зоне отслеживающие cookie отключены — политика конфиденциальности внизу страницы точно говорит, что измеряется.',
    'about.rules.facts':
      'Каждый факт о радиостанции подкреплён источником; в карточке показаны только проверенные поля.',
    'about.sources.title': 'Редакции',
    'about.sources.body':
      'Сообщения берутся с сайтов этих редакций в исходном виде. Каждая появляется на том языке или языках, на которых публикуется:',
    'about.sources.langs': 'Языки',
    'about.sources.other':
      'События — с Armenopole, радио — из собственных потоков станций, изображения соцсетей — из указанных аккаунтов.',
    'about.contact.title': 'Контакт',
    // Pas « Ошибка » en tête de phrase : c'est le mot des pages d'erreur
    // russes (« Ошибка 404 »), et le test en direct de Search Console classait
    // /ru/about/ en « Soft 404 » — deux fois de suite, 200 OK et page rendue —
    // quand les trois autres langues passaient. Mesuré le 22 août 2026.
    'about.contact.body': 'Хотите уточнить факт, предложить источник или сообщить о станции вне эфира? Напишите на',

    'news.title': 'Новости',
    ...rubricStrings('ru'),
    'news.subtitle': 'Последние публикации из каждой рубрики «Курьера Еревана»',
    'news.armradio': 'Прямой эфир из Армении · Общественное радио Армении',
    'news.readmore': 'Читать далее',
    'news.prev': 'Назад',
    'news.next': 'Вперёд',
    'news.source': 'Источник',
    'news.empty': 'Пока нет статей.',
    'news.originalLang': '',

    'agenda.title': 'Афиша',
    'agenda.subtitle': 'Армянские события по всему миру и в Швейцарии',
    'agenda.switzerland': 'Швейцария',
    'agenda.world': 'Мир',
    'agenda.country': 'Страна',
    'agenda.empty': 'Анонсов пока нет.',
    'agenda.more': 'Вся армянская афиша событий, по странам',

    // Страница /ru/events — перевод на проверку носителю языка.
    'agenda.page.h1': 'Армянская афиша по всему миру',
    'agenda.page.intro':
      'Полный список предстоящих армянских событий, собираемый каждый час с armenopole.com в десятках стран и в Швейцарии. Событие исчезает из списка само собой, как только оно прошло — эта страница всегда показывает лишь то, что ещё впереди.',
    'agenda.page.count': 'предстоящих событий — в Швейцарии и по всему миру',
    'agenda.page.home': 'Вернуться на главную',

    'social.title': 'Социальные сети',
    'social.subtitle':
      'Две ленты: подборка из Instagram, обновляемая случайным образом каждый час, и искусство, которым делится Дон Нарек',

    'fb.title': 'Армянское искусство',
    'fb.by': 'от Дон Нарека',
    'fb.subtitle': 'Последние 25 публикаций, в изображениях',
    'fb.view': 'Смотреть публикацию',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Мозаика армянского вдохновения, наугад',
    'ig.strand': 'Армянская мозаика',
    'ig.strand.people': 'Армянские лица',
    'ig.strand.studio': 'Армянские мастерские',
    'ig.strand.creators': 'Армянские создатели',
    'ig.strand.land': 'Армянские просторы',
    'ig.shuffle': 'Перемешать',
    'ig.visit': 'Смотреть профиль',
    'ig.accounts.all': 'Аккаунты ({n})',
    'ig.accounts.less': 'Скрыть аккаунты',
    'ig.view': 'Смотреть в Instagram',

    'social.enlarge': 'Увеличить изображение',
    'fb.zoom': 'Увеличить',
    'ig.zoom': 'Увеличить',
    'lb.dialog': 'Увеличенное изображение',
    'lb.close': 'Закрыть',
    'lb.prev': 'Предыдущее изображение',
    'lb.next': 'Следующее изображение',

    'footer.built': 'Статический снимок · источники со ссылками на их сайты',
    'footer.write': 'Напишите нам',
    'footer.sources': 'Источники',

    'privacy.title': 'Политика конфиденциальности',
    'privacy.intro':
      'Этот сайт — статический снимок: без учётных записей, форм и базы данных. Он ничего у вас не запрашивает и не хранит ничего, что позволяло бы вас лично идентифицировать.',
    'privacy.analytics.title': 'Измерение аудитории',
    'privacy.analytics.body':
      'Мы используем Google Analytics и Cloudflare Web Analytics, чтобы считать посещения и понимать, какие разделы читают. За пределами Европейской экономической зоны и Великобритании Google Analytics устанавливает cookie, позволяющий узнавать посетителя от визита к визиту. Из ЕЭЗ и Великобритании этот cookie не устанавливается: измерение там анонимное и без cookie, как того требует GDPR. Cloudflare Web Analytics не устанавливает cookie нигде.',
    'privacy.analytics.optout':
      'Чтобы отказаться от этого cookie, заблокируйте его в браузере. Сайт работает точно так же и без него.',
    'privacy.storage.title': 'Хранится на вашем устройстве',
    'privacy.storage.body':
      'Ваш выбор дневной / ночной темы сохраняется локально браузером. Он никогда не покидает ваше устройство и не передаётся нам.',
    'privacy.content.title': 'Материалы третьих сторон',
    'privacy.content.body':
      'Статьи, события и публикации поступают со сторонних сайтов — со ссылкой и указанием источника. Переход по ссылке ведёт к соответствующему изданию, где действует его собственная политика конфиденциальности.',
    'privacy.rights.title': 'Ваши права',
    'privacy.rights.body':
      'Вы можете запросить доступ к касающимся вас данным, их исправление или удаление. Поскольку сайт не собирает персональных данных, на практике это ограничивается сводными показателями аудитории.',
    'privacy.contact': 'Вопросы:',

    'sections.actualite': 'Новости',
    'sections.societe': 'Общество',
    'sections.economie': 'Экономика',
    'sections.arts-et-culture': 'Искусство и культура',
    'sections.francophonie': 'Франкоязычная Армения',
    'sections.opinions': 'Мнения',
    'sections.region': 'Регион',
    'sections.diasporas': 'Диаспоры',

    'armcats.politics': 'Политика',
    'armcats.society': 'Общество',
    'armcats.economics': 'Экономика',
    'armcats.analytics': 'Аналитика',
    'armcats.world': 'Мир',
    'armcats.culture': 'Культура',
    'armcats.sport': 'Спорт',

    'namcats.actualites': 'Новости',
    'namcats.sport': 'Спорт',
    'namcats.communaute': 'Сообщество',
    'namcats.culture': 'Культура',
    'namcats.lifestyle': 'Образ жизни',
    'namcats.magazine': 'Журналы',

    'azkcats.armenie-artsakh': 'Армения и Арцах',
    'azkcats.communaute': 'Сообщество',
    'azkcats.divers': 'Разное',

    'aitcats.armenie': 'Армения',
    'aitcats.art-culture': 'Искусство и культура',
    'aitcats.artsakh': 'Арцах',
    'aitcats.diaspora': 'Диаспора',
    'aitcats.france': 'Франция',
    'aitcats.geopolitique': 'Геополитика',
    'aitcats.politique': 'Политика',
    'aitcats.un-autre-regard': 'Другой взгляд',

    'browser.subtitle': 'Все рубрики, источник за источником',
    'news.sources': '{n} армянских редакций',
    'browser.armradio': 'Общественное радио Армении',
    'browser.asbarez': 'Аспарез — армянская ежедневная газета из Лос-Анджелеса',
    'browser.armenianweekly': 'The Armenian Weekly — армянский еженедельник из Бостона',
    'browser.oragark': 'Орагарк — ежедневная газета АРФД',
    'browser.californiacourier': 'The California Courier — колонка Арута Сасуняна',
    'browser.civilnet': 'CivilNet — независимая редакция из Еревана',
    'browser.newsam': 'NEWS.am — крупнейший частный медиахолдинг Еревана',
    'browser.courrier': 'Курьер Еревана',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Эхо армян Швейцарии',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Арменпресс',
    'browser.live': 'В прямом эфире',
    'apcats.armenia': 'Армения',
    'apcats.economy': 'Экономика',
    'apcats.world': 'Мир',
    'apcats.culture': 'Культура',
    'apcats.sports': 'Спорт',
    'apcats.fact-check': 'Проверка фактов',
    'apcats.projects': 'Спецпроекты',

    'radio.eyebrow': 'Ереван · 128 кбит/с',
    'radio.title': 'Прямой эфир',
    'radio.subtitle': 'Семнадцать армянских радиостанций в прямом эфире',
    'radio.onair': 'В эфире',
    'radio.tz': 'Ереван',
    'radio.play': 'Слушать в эфире',
    'radio.pause': 'Пауза',
    'radio.loading': 'Подключение к потоку…',
    'radio.error': 'Поток недоступен.',
    'radio.retry': 'Повторить',
    'radio.offair': 'не в эфире',
    'radio.volume': 'Громкость',
    'radio.station': 'Станция',
    'radio.stations.all': 'Показать все {n} радиостанций',
    'radio.stations.less': 'Показать меньше',
    'radio.st.public': 'Первая программа',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Радио Аревик',
    'radio.st.culture': 'Радио Культура',
    'radio.st.mariam': 'Радио Мариам',
    'radio.st.vov': 'Голос Вана',
    'radio.st.lav': 'Лав Радио',
    'radio.st.fama': 'Радио Фама',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
    'radio.st.jazz': 'Radio Jazz FM',
    'radio.st.vem': 'Радио Вем',
    'radio.st.yerevanfm': 'Радио Ереван',
    'radio.st.tsayn': 'Yeridasartoutian Tsayne',
    'radio.st.radioa': 'Radio A',
    'radio.st.aypfm': 'AYP FM',
    'radio.more': 'Все семнадцать армянских радиостанций в прямом эфире',

    // Page /radio — traductions hy/ru à relire par un locuteur natif (voir
    // task-5-report.md).
    'radio.page.h1': 'Армянское радио онлайн',
    'radio.page.intro':
      'Семнадцать армянских радиостанций в прямом эфире на одной странице: общественные сети Еревана, независимые вещатели и станции диаспоры. Никакой регистрации, ничего устанавливать не нужно — звук начинается по клику и следует дневному / ночному переключателю сайта. Потоки принадлежат самим станциям; Armenia News не хостит и не перекодирует ни один сигнал.',
    'radio.page.list': 'Семнадцать радиостанций',
    'radio.page.city': 'Город',
    'radio.city.yerevan': 'Ереван',
    'radio.city.beirut': 'Бейрут',
    'radio.city.glendale': 'Глендейл',
    'radio.city.bourglesvalence': 'Бур-ле-Валанс',
    'radio.city.alfortville': 'Альфорвиль',
    'radio.page.genre': 'Жанр',
    'radio.page.lang': 'Язык эфира',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Битрейт',
    'radio.page.home': 'Вернуться на главную',
    'radio.remote.title': 'Переключайте станции, не возвращаясь на сайт',
    'radio.remote.keys':
      'Когда радио играет, кнопки «назад» и «вперёд» на экране блокировки телефона переключают станции. Кнопки на руле тоже, если телефон подключён к машине по Bluetooth. Слушать радио можно и в наушниках.',
    'radio.remote.skip': 'А если станция пропадёт, плеер сам перейдёт на следующую.',
    'radio.remote.icon': 'Кнопки «назад» и «вперёд»',
    'radio.remote.prev': 'Предыдущая станция',
    'radio.remote.next': 'Следующая станция',
    'radio.genre.culture': 'Культура',
    'radio.genre.general': 'Общее',
    'radio.genre.jazz': 'Джаз',
    'radio.genre.kids': 'Детское',
    'radio.genre.music': 'Музыка',
    'radio.genre.news': 'Новости',
    'radio.genre.religious': 'Религиозное',
    'radio.genre.university': 'Университетское',
    'radio.genre.youth': 'Молодёжное',
    'radio.page.lang.hy': 'Армянский',
    'radio.page.lang.fr-hy': 'Французский и армянский',
  },
}

// de-CH et it-CH : formats suisses (« 23.10.2026 », mois en toutes lettres
// identiques). Intl les rend correctement dans un navigateur, contrairement à
// hy-AM (voir hyDate.js) : pas de table écrite en dur.
const LOCALES = { fr: 'fr-FR', de: 'de-CH', it: 'it-CH', en: 'en-GB', hy: 'hy-AM', ru: 'ru-RU' }

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  // La langue vient de l'URL, jamais de localStorage.
  //
  // Chaque langue a désormais son adresse (voir sites.config.js), et c'est
  // l'URL qui fait autorité. Restaurer une langue depuis localStorage
  // ferait basculer au montage une page dont le HTML prérendu et l'attribut
  // <html lang> disent autre chose : flash de contenu, et un attribut lang qui
  // ment sur ce qui est affiché. Googlebot n'ayant pas de localStorage,
  // l'écart serait invisible en test et bien réel pour les lecteurs.
  //
  // Ce qu'on perd — « le site se souvient de ma langue » — est repris par
  // l'URL, qui se met en favori, revient dans l'historique et se partage.
  const lang = useMemo(() => {
    const path = typeof location !== 'undefined' ? location.pathname : '/'
    return langFromPath(SITE_ID, path)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => {
    const t = (key) => STRINGS[lang][key] ?? STRINGS.fr[key] ?? key

    // Toutes les dates affichées passent par ces quatre formateurs, et c'est
    // le point : l'arménien n'a pas de données de date dans l'ICU de Chrome, et
    // `toLocaleDateString('hy-AM')` y rend la langue DU LECTEUR (voir le
    // dossier complet dans src/hyDate.js). Un appel direct à Intl depuis un
    // composant rouvrirait le trou pour cette seule date, en silence — c'est
    // ce qui était arrivé aux pastilles de l'agenda, restées en français sur
    // /hy/ alors que le reste de la page était traduit.
    //
    // `locale` reste exposé parce que la forme publique de useI18n() le
    // documente, mais NE L'UTILISEZ PAS pour formater une date : il vaut
    // 'hy-AM', une locale que le navigateur accepte sans savoir la rendre.
    const hy = lang === 'hy'

    const formatDate = (iso) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      if (hy) return hyLongDate(d)
      return d.toLocaleDateString(LOCALES[lang], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }

    // Le jour du mois est le même chiffre dans les quatre langues — pas besoin
    // d'Intl pour ça.
    const formatDayNum = (d) => String(d.getDate())

    // Le français abrège avec un point (« juil. »), l'arménien sans. Le retrait
    // du point vit ici plutôt que dans le composant, pour que la règle soit
    // décidée au même endroit que le choix de la langue.
    const formatMonthAbbr = (d) =>
      hy
        ? hyMonthAbbr(d)
        : d.toLocaleDateString(LOCALES[lang], { month: 'short' }).replace('.', '')

    const formatWeekdayTime = (d) =>
      hy
        ? hyWeekdayTime(d)
        : d.toLocaleDateString(LOCALES[lang], {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })

    // Cinquième formateur, même règle que les quatre autres : l'âge d'un
    // article passe par ici et jamais par Intl depuis un composant. Le détail
    // est dans relativeTime.js — `Intl.RelativeTimeFormat('hy')` rendrait la
    // langue du lecteur, exactement comme `toLocaleDateString('hy-AM')`.
    const formatAge = (iso, now) => relativeAge(iso, now, lang)

    return {
      lang,
      t,
      formatDate,
      formatDayNum,
      formatMonthAbbr,
      formatWeekdayTime,
      formatAge,
      locale: LOCALES[lang],
    }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}
