import { createContext, useContext, useEffect, useMemo } from 'react'
import { LANGS, langFromPath } from '../sites.config.js'
import { SITE_ID } from './site.js'
import { hyLongDate, hyMonthAbbr, hyWeekdayTime } from './hyDate.js'
import { relativeAge } from './relativeTime.js'

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

    'news.title': 'Actualités',
    'news.subtitle': "Les dernières publications de chaque rubrique du Courrier d'Erevan",
    'news.armradio': "En direct d'Arménie · Public Radio of Armenia",
    'news.readmore': 'Lire la suite',
    'news.prev': 'Précédent',
    'news.next': 'Suivant',
    'news.source': 'Source',
    'news.empty': 'Aucun article pour le moment.',

    'agenda.title': 'Agenda',
    'agenda.subtitle': 'Événements arméniens dans le monde et en Suisse',
    'agenda.switzerland': 'Suisse',
    'agenda.world': 'Monde',
    'agenda.country': 'Pays',
    'agenda.empty': 'Aucun événement annoncé.',
    'agenda.more': "Voir sur armenopole",

    'social.title': 'Réseaux sociaux',
    'social.subtitle':
      "Deux fils : l'art que partage Don Narek, et une sélection Instagram retirée au sort chaque heure",

    'fb.title': 'Art arménien',
    'fb.by': 'par Don Narek',
    'fb.subtitle': 'Les 20 dernières publications, en images',
    'fb.view': 'Voir la publication',

    'ig.title': 'Instagram',
    'ig.subtitle': "Une mosaïque d'inspiration arménienne, au hasard",
    'ig.strand': 'Mosaïque arménienne',
    'ig.strand.people': 'Visages arméniens',
    'ig.shuffle': 'Mélanger',
    'ig.visit': 'Voir le profil',
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
    'browser.armradio': 'Radio publique d’Arménie',
    'browser.asbarez': 'Asbarez — quotidien arménien de Los Angeles',
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
    'radio.subtitle': 'Douze radios arméniennes, en flux continu',
    'radio.onair': 'En direct',
    'radio.tz': 'Erevan',
    'radio.play': 'Écouter en direct',
    'radio.pause': 'Mettre en pause',
    'radio.loading': 'Connexion au flux…',
    'radio.error': 'Flux indisponible.',
    'radio.retry': 'Réessayer',
    'radio.volume': 'Volume',
    'radio.station': 'Station',
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
    'radio.more': 'Toutes les radios arméniennes en direct',

    // Page /radio
    'radio.page.h1': 'Radios arméniennes en direct',
    'radio.page.intro':
      'Douze radios arméniennes en flux continu, réunies sur une seule page : les stations publiques d’Erevan, les antennes indépendantes et celles de la diaspora. Aucune inscription, rien à installer — le son démarre au clic et suit la bascule jour / nuit du site. Les flux sont ceux des stations elles-mêmes ; ArménieInfo n’héberge ni ne réencode aucun signal.',
    'radio.page.list': 'Les douze stations',
    'radio.page.city': 'Ville',
    'radio.page.genre': 'Genre',
    'radio.page.lang': 'Langue d’antenne',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Débit',
    'radio.page.source': 'Source',
    'radio.page.home': 'Retour à l’accueil',
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

    'news.title': 'News',
    'news.subtitle': "The latest stories from each section of Le Courrier d'Erevan",
    'news.armradio': 'Live from Armenia · Public Radio of Armenia',
    'news.readmore': 'Read more',
    'news.prev': 'Previous',
    'news.next': 'Next',
    'news.source': 'Source',
    'news.empty': 'No articles yet.',

    'agenda.title': 'Events',
    'agenda.subtitle': 'Armenian events around the world and in Switzerland',
    'agenda.switzerland': 'Switzerland',
    'agenda.world': 'World',
    'agenda.country': 'Country',
    'agenda.empty': 'No events announced.',
    'agenda.more': 'See on armenopole',

    'social.title': 'Social networks',
    'social.subtitle':
      'Two feeds: the art Don Narek shares, and an Instagram selection drawn afresh every hour',

    'fb.title': 'Armenian Art',
    'fb.by': 'by Don Narek',
    'fb.subtitle': 'The 20 latest posts, in pictures',
    'fb.view': 'View the post',

    'ig.title': 'Instagram',
    'ig.subtitle': 'A mosaic of Armenian inspiration, at random',
    'ig.strand': 'Armenian mosaic',
    'ig.strand.people': 'Armenian faces',
    'ig.shuffle': 'Shuffle',
    'ig.visit': 'View profile',
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
    'browser.armradio': 'Public Radio of Armenia',
    'browser.asbarez': 'Asbarez — Los Angeles Armenian daily',
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
    'radio.subtitle': 'Twelve Armenian stations, streaming live',
    'radio.onair': 'On air',
    'radio.tz': 'Yerevan',
    'radio.play': 'Listen live',
    'radio.pause': 'Pause',
    'radio.loading': 'Connecting to the stream…',
    'radio.error': 'Stream unavailable.',
    'radio.retry': 'Retry',
    'radio.volume': 'Volume',
    'radio.station': 'Station',
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
    'radio.more': 'All twelve Armenian radio stations',

    // Page /radio
    'radio.page.h1': 'Armenian radio online',
    'radio.page.intro':
      'Twelve Armenian stations streaming live on one page: the public networks of Yerevan, the independent broadcasters and the diaspora’s own. No sign-up, nothing to install — sound starts on click and follows the site’s day / night switch. The streams are the stations’ own; Armenia News neither hosts nor re-encodes any signal.',
    'radio.page.list': 'The twelve stations',
    'radio.page.city': 'City',
    'radio.page.genre': 'Format',
    'radio.page.lang': 'On-air language',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Bitrate',
    'radio.page.source': 'Source',
    'radio.page.home': 'Back to the home page',
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

    'news.title': 'Լուրեր',
    'news.subtitle': '«Կուրիեր» թերթի յուրաքանչյուր բաժնի վերջին հրապարակումները',
    'news.armradio': 'Ուղիղ Հայաստանից · Հանրային ռադիո',
    'news.readmore': 'Կարդալ ավելին',
    'news.prev': 'Նախորդ',
    'news.next': 'Հաջորդ',
    'news.source': 'Աղբյուր',
    'news.empty': 'Դեռ հոդվածներ չկան։',

    'agenda.title': 'Միջոցառումներ',
    'agenda.subtitle': 'Հայկական միջոցառումներ աշխարհում եւ Շվեյցարիայում',
    'agenda.switzerland': 'Շվեյցարիա',
    'agenda.world': 'Աշխարհ',
    'agenda.country': 'Երկիր',
    'agenda.empty': 'Հայտարարված միջոցառումներ չկան։',
    'agenda.more': 'Տեսնել armenopole-ում',

    'social.title': 'Սոցիալական ցանցեր',
    'social.subtitle':
      'Երկու հոսք՝ Դօն Նարեկի կիսած արվեստը և Instagram-ի ընտրանին՝ վերաշաղախված ամեն ժամ',

    'fb.title': 'Հայկական արվեստ',
    'fb.by': 'Դօն Նարեկի կողմից',
    'fb.subtitle': 'Վերջին 20 հրապարակումները՝ նկարներով',
    'fb.view': 'Դիտել հրապարակումը',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Հայկական ոգեշնչման խճանկար՝ պատահական',
    'ig.strand': 'Հայկական խճանկար',
    'ig.strand.people': 'Հայկական դեմքեր',
    'ig.shuffle': 'Խառնել',
    'ig.visit': 'Դիտել պրոֆիլը',
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
    'browser.armradio': 'Հայաստանի հանրային ռադիո',
    'browser.asbarez': 'Ասպարէզ — Լոս Անճելըսի հայ օրաթերթ',
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
    'radio.subtitle': 'Տասներկու հայկական ռադիոկայան՝ ուղիղ եթերում',
    'radio.onair': 'Ուղիղ',
    'radio.tz': 'Երևան',
    'radio.play': 'Միացնել',
    'radio.pause': 'Դադարեցնել',
    'radio.loading': 'Միանում է հեռարձակմանը…',
    'radio.error': 'Հեռարձակումն անհասանելի է։',
    'radio.retry': 'Կրկնել',
    'radio.volume': 'Ձայն',
    'radio.station': 'Ալիք',
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
    'radio.more': 'Բոլոր տասներկու հայկական ռադիոկայանները՝ ուղիղ եթերում',

    // Page /radio — traductions hy/ru à relire par un locuteur natif (voir
    // task-5-report.md).
    'radio.page.h1': 'Հայկական ռադիո ուղիղ եթերում',
    'radio.page.intro':
      'Տասներկու հայկական ռադիոկայաններ՝ ուղիղ հեռարձակմամբ մեկ էջում. Երևանի հանրային ցանցերը, անկախ հեռարձակողները և սփյուռքի իրենը։ Ոչ մի գրանցում, ոչինչ տեղադրելու կարիք չկա. ձայնը սկսվում է սեղմումով և հետևում է կայքի ցերեկ / գիշեր անջատիչին։ Հոսքերը կայանների սեփականն են. Armenia News-ը չի հյուրընկալում և չի վերակոդավորում որևէ ազդանշան։',
    'radio.page.list': 'Տասներկու ռադիոկայանները',
    'radio.page.city': 'Քաղաք',
    'radio.page.genre': 'Ժանր',
    'radio.page.lang': 'Եթերի լեզուն',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Հոսքի արագություն',
    'radio.page.source': 'Աղբյուր',
    'radio.page.home': 'Վերադառնալ գլխավոր էջ',
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

    'news.title': 'Новости',
    'news.subtitle': 'Последние публикации из каждой рубрики «Курьера Еревана»',
    'news.armradio': 'Прямой эфир из Армении · Общественное радио Армении',
    'news.readmore': 'Читать далее',
    'news.prev': 'Назад',
    'news.next': 'Вперёд',
    'news.source': 'Источник',
    'news.empty': 'Пока нет статей.',

    'agenda.title': 'Афиша',
    'agenda.subtitle': 'Армянские события по всему миру и в Швейцарии',
    'agenda.switzerland': 'Швейцария',
    'agenda.world': 'Мир',
    'agenda.country': 'Страна',
    'agenda.empty': 'Анонсов пока нет.',
    'agenda.more': 'Смотреть на armenopole',

    'social.title': 'Социальные сети',
    'social.subtitle':
      'Две ленты: искусство, которым делится Дон Нарек, и подборка из Instagram, обновляемая случайным образом каждый час',

    'fb.title': 'Армянское искусство',
    'fb.by': 'от Дон Нарека',
    'fb.subtitle': 'Последние 20 публикаций, в изображениях',
    'fb.view': 'Смотреть публикацию',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Мозаика армянского вдохновения, наугад',
    'ig.strand': 'Армянская мозаика',
    'ig.strand.people': 'Армянские лица',
    'ig.shuffle': 'Перемешать',
    'ig.visit': 'Смотреть профиль',
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
    'browser.armradio': 'Общественное радио Армении',
    'browser.asbarez': 'Аспарез — армянская ежедневная газета из Лос-Анджелеса',
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
    'radio.subtitle': 'Двенадцать армянских радиостанций в прямом эфире',
    'radio.onair': 'В эфире',
    'radio.tz': 'Ереван',
    'radio.play': 'Слушать в эфире',
    'radio.pause': 'Пауза',
    'radio.loading': 'Подключение к потоку…',
    'radio.error': 'Поток недоступен.',
    'radio.retry': 'Повторить',
    'radio.volume': 'Громкость',
    'radio.station': 'Станция',
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
    'radio.more': 'Все двенадцать армянских радиостанций в прямом эфире',

    // Page /radio — traductions hy/ru à relire par un locuteur natif (voir
    // task-5-report.md).
    'radio.page.h1': 'Армянское радио онлайн',
    'radio.page.intro':
      'Двенадцать армянских радиостанций в прямом эфире на одной странице: общественные сети Еревана, независимые вещатели и станции диаспоры. Никакой регистрации, ничего устанавливать не нужно — звук начинается по клику и следует дневному / ночному переключателю сайта. Потоки принадлежат самим станциям; Armenia News не хостит и не перекодирует ни один сигнал.',
    'radio.page.list': 'Двенадцать радиостанций',
    'radio.page.city': 'Город',
    'radio.page.genre': 'Жанр',
    'radio.page.lang': 'Язык эфира',
    'radio.page.fm': 'FM',
    'radio.page.bitrate': 'Битрейт',
    'radio.page.source': 'Источник',
    'radio.page.home': 'Вернуться на главную',
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
  },
}

const LOCALES = { fr: 'fr-FR', en: 'en-GB', hy: 'hy-AM', ru: 'ru-RU' }

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
