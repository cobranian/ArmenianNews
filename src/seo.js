// Chaînes SEO par langue : ce qui part dans <title>, <meta description> et les
// cartes de partage. Séparé de i18n.jsx — qui importe React — parce que
// scripts/lib/site-meta.mjs doit les lire depuis Node pour générer les pages
// /hy/ et /ru/ hors du bundle. Même raison que src/worldPlace.js.
//
// La marque ne vit PAS ici : elle vient du site (SITES[id].brand), parce
// qu'elle suit le domaine et non la langue. Le titre final se compose
// `${brand} · ${tagline}`.

export const SEO = {
  fr: {
    tagline: 'Actualités arméniennes',
    // Les QUATRE piliers, radios comprises. Elles y manquaient, alors que la
    // page les met en avant et que /radio/ leur consacre ses propres
    // descriptions : l'extrait de recherche de l'accueil vendait donc trois
    // atouts sur quatre, en omettant le seul qu'on ne trouve nulle part
    // ailleurs. Le nombre est écrit en toutes lettres et gardé par
    // test/radio-count.test.mjs, comme les quatorze autres textes.
    description:
      'Actualités, quinze radios en direct, agenda et réseaux sociaux arméniens du monde et de Suisse, mis à jour chaque heure.',
    keywords:
      'actualités arméniennes, Arménie, Artsakh, diaspora arménienne, agenda arménien, communauté arménienne de Suisse',
  },
  en: {
    tagline: 'Armenian news, events and social media',
    description:
      'Armenian news, fifteen live radio stations, events and social media from Armenia and the diaspora, updated every hour.',
    keywords:
      'Armenian news, Armenia, Artsakh, Armenian diaspora, Armenian events, Armenian community',
  },
  hy: {
    // Raccourcie (le <title> faisait 65 caractères avec la marque, coupé
    // vers 60 dans les résultats) : la description porte déjà les quatre
    // piliers, le titre n'a besoin que des deux qu'on cherche.
    tagline: 'Հայկական լուրեր և միջոցառումներ',
    description:
      'Հայկական լուրեր, տասնհինգ ռադիոկայան ուղիղ եթերում, միջոցառումներ և սոցիալական ցանցեր Հայաստանից և սփյուռքից, թարմացվում է ամեն ժամ։',
    keywords:
      'հայկական լուրեր, Հայաստան, Արցախ, հայկական սփյուռք, միջոցառումներ, հայ համայնք',
  },
  ru: {
    tagline: 'Армянские новости, события и социальные сети',
    description:
      'Армянские новости, пятнадцать радиостанций в прямом эфире, события и социальные сети из Армении и диаспоры, обновление каждый час.',
    keywords:
      'армянские новости, Армения, Арцах, армянская диаспора, армянские события, армянская община',
  },
}

// Titre et description des PAGES DE VUE, par langue.
//
// Le titre y mène par le MOT-CLÉ et non par la marque — inverse de l'accueil.
// La raison est concrète : Google tronque un titre vers 60 caractères et
// « Arménie Info » n'est pas encore un nom que l'on cherche. Sur l'accueil, la
// marque EST le sujet ; sur /radio, le sujet est la radio.
//
// Le titre final se compose `${VIEW_SEO[view][lang].title} · ${brand}`.
export const VIEW_SEO = {
  radio: {
    fr: {
      title: 'Radios arméniennes en direct',
      description:
        'Quinze radios arméniennes en direct, d’Erevan et de la diaspora : actualité, musique, culture et jazz. Écoute gratuite, sans compte ni installation.',
    },
    en: {
      title: 'Armenian radio online',
      description:
        'Fifteen Armenian radio stations streaming live from Yerevan and the diaspora: news, music, culture and jazz. Free to listen, no account, nothing to install.',
    },
    hy: {
      title: 'Հայկական ռադիոկայաններ ուղիղ եթերում',
      description:
        'Տասնհինգ հայկական ռադիոկայան ուղիղ եթերում՝ Երևանից և սփյուռքից․ լուրեր, երաժշտություն, մշակույթ և ջազ։ Անվճար, առանց հաշվի և տեղադրման։',
    },
    ru: {
      title: 'Армянское радио онлайн',
      description:
        'Пятнадцать армянских радиостанций в прямом эфире из Еревана и диаспоры: новости, музыка, культура и джаз. Бесплатно, без регистрации и установки.',
    },
  },
  // AUCUN NOMBRE DE PAYS dans ces quatre descriptions, et c'est délibéré.
  // Elles annonçaient « 26 pays » — le compte de WORLD_COUNTRIES
  // (scripts/sources/armenopole.mjs), c'est-à-dire la nav de la SOURCE, hors
  // Suisse. Or la page ne rend pas ces 26 pays : elle rend une section par pays
  // ayant au moins un événement À VENIR, Suisse comprise — 27 au moment où
  // c'est écrit, et un nombre qui change à chaque snapshot horaire, sans que
  // personne ne touche au dépôt.
  //
  // Un chiffre pareil ne peut donc pas être gardé par un test, contrairement
  // aux « quinze » radios ci-dessus : le compte des stations vit dans le dépôt
  // (test/radio-count.test.mjs le confronte au tableau STATIONS), celui des
  // pays vit dans la donnée du jour. Le seul correctif qui tienne est de
  // retirer le chiffre — ce qui supprime la classe de bug au lieu de la
  // surveiller. Ne le réintroduisez pas.
  agenda: {
    fr: {
      // 70 caractères avec la marque dans l'ancienne forme (« … : événements
      // en Suisse et dans le monde ») : Google coupe vers 60, la marque
      // sautait. 48 désormais. Le mot-clé reste en tête.
      title: 'Agenda arménien : Suisse et monde',
      description:
        'Concerts, conférences et rassemblements de la diaspora arménienne, en Suisse et dans le monde : agenda recensé depuis Armenopole et mis à jour chaque heure.',
    },
    en: {
      title: 'Armenian events worldwide',
      description:
        'Armenian diaspora concerts, talks and gatherings around the world: an events calendar sourced from Armenopole, updated every hour.',
    },
    hy: {
      title: 'Հայկական միջոցառումներ ամբողջ աշխարհում',
      description:
        'Հայ սփյուռքի համերգներ, դասախոսություններ և հավաքներ ամբողջ աշխարհում՝ հավաքագրված Armenopole կայքից և թարմացվող ամեն ժամ։',
    },
    ru: {
      title: 'Армянские события по всему миру',
      description:
        'Концерты, лекции и встречи армянской диаспоры по всему миру: календарь событий с Armenopole, обновляемый каждый час.',
    },
  },
}

// Codes de locale Open Graph, un par langue.
export const OG_LOCALE = { fr: 'fr_FR', en: 'en_US', hy: 'hy_AM', ru: 'ru_RU' }
