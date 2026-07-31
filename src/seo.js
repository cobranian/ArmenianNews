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
    description:
      'Actualités, agenda et réseaux sociaux arméniens du monde et de Suisse, mis à jour chaque heure.',
    keywords:
      'actualités arméniennes, Arménie, Artsakh, diaspora arménienne, agenda arménien, communauté arménienne de Suisse',
  },
  en: {
    tagline: 'Armenian news, events and social media',
    description:
      'Armenian news, events and social media from Armenia and the diaspora, updated every hour.',
    keywords:
      'Armenian news, Armenia, Artsakh, Armenian diaspora, Armenian events, Armenian community',
  },
  hy: {
    tagline: 'Հայկական լուրեր, միջոցառումներ և սոցիալական ցանցեր',
    description:
      'Հայկական լուրեր, միջոցառումներ և սոցիալական ցանցեր Հայաստանից և սփյուռքից, թարմացվում է ամեն ժամ։',
    keywords:
      'հայկական լուրեր, Հայաստան, Արցախ, հայկական սփյուռք, միջոցառումներ, հայ համայնք',
  },
  ru: {
    tagline: 'Армянские новости, события и социальные сети',
    description:
      'Армянские новости, события и социальные сети из Армении и диаспоры, обновление каждый час.',
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
        'Douze radios arméniennes en direct, d’Erevan et de la diaspora : actualité, musique, culture et jazz. Écoute gratuite, sans compte ni installation.',
    },
    en: {
      title: 'Armenian radio online',
      description:
        'Twelve Armenian radio stations streaming live from Yerevan and the diaspora: news, music, culture and jazz. Free to listen, no account, nothing to install.',
    },
    hy: {
      title: 'Հայկական ռադիոկայաններ ուղիղ եթերում',
      description:
        'Տասներկու հայկական ռադիոկայան ուղիղ եթերում՝ Երևանից և սփյուռքից․ լուրեր, երաժշտություն, մշակույթ և ջազ։ Անվճար, առանց հաշվի և տեղադրման։',
    },
    ru: {
      title: 'Армянское радио онлайн',
      description:
        'Двенадцать армянских радиостанций в прямом эфире из Еревана и диаспоры: новости, музыка, культура и джаз. Бесплатно, без регистрации и установки.',
    },
  },
}

// Codes de locale Open Graph, un par langue.
export const OG_LOCALE = { fr: 'fr_FR', en: 'en_US', hy: 'hy_AM', ru: 'ru_RU' }
