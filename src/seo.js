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

// Codes de locale Open Graph, un par langue.
export const OG_LOCALE = { fr: 'fr_FR', en: 'en_US', hy: 'hy_AM', ru: 'ru_RU' }
