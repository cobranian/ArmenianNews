// Les textes des pages Agenda par pays (scripts/lib/agenda-pays.mjs), dans les
// sept langues. Module PLAT, comme briefStrings.js : Node le lit au build.
//
// Le nom du pays vient TOUJOURS en tête, suivi de « : » ou d'un tiret, et
// jamais derrière une préposition : « en Suisse », « au Canada », « aux
// États-Unis », « in der Schweiz », « negli Stati Uniti », et le locatif russe
// changent tous selon le pays. Une phrase qui place le pays après une
// préposition serait fautive pour une partie des 33 pays, sans que rien ne le
// signale. Les phrases qui suivent parlent de « ce pays », jamais de son nom.
export const AGENDA_PAYS_STRINGS = {
  fr: {
    title: (c) => `${c} : événements arméniens à venir`,
    description: (c) =>
      `${c} : concerts, conférences, commémorations et fêtes de la communauté arménienne. Dates et lieux, mis à jour chaque heure.`,
    intro:
      'Concerts, conférences, commémorations, fêtes : tous les événements à venir de la communauté arménienne recensés dans ce pays, avec leur date et leur lieu. La liste est mise à jour chaque heure depuis Armenopole.',
    count: (n) => `Événements à venir : ${n}`,
    others: 'Autres pays',
    all: 'Tous les pays',
  },
  de: {
    title: (c) => `${c}: armenische Veranstaltungen`,
    description: (c) =>
      `${c}: Konzerte, Vorträge, Gedenkfeiern und Feste der armenischen Gemeinschaft. Daten und Orte, stündlich aktualisiert.`,
    intro:
      'Konzerte, Vorträge, Gedenkfeiern, Feste: alle kommenden Veranstaltungen der armenischen Gemeinschaft in diesem Land, mit Datum und Ort. Die Liste wird stündlich aus Armenopole aktualisiert.',
    count: (n) => `Kommende Veranstaltungen: ${n}`,
    others: 'Weitere Länder',
    all: 'Alle Länder',
  },
  it: {
    title: (c) => `${c}: eventi armeni in programma`,
    description: (c) =>
      `${c}: concerti, conferenze, commemorazioni e feste della comunità armena. Date e luoghi, aggiornati ogni ora.`,
    intro:
      "Concerti, conferenze, commemorazioni, feste: tutti gli eventi in programma della comunità armena in questo paese, con data e luogo. L'elenco è aggiornato ogni ora da Armenopole.",
    count: (n) => `Eventi in programma: ${n}`,
    others: 'Altri paesi',
    all: 'Tutti i paesi',
  },
  en: {
    title: (c) => `${c}: upcoming Armenian events`,
    description: (c) =>
      `${c}: concerts, talks, commemorations and celebrations of the Armenian community. Dates and places, updated every hour.`,
    intro:
      'Concerts, talks, commemorations, celebrations: every upcoming event of the Armenian community listed in this country, with its date and place. The list is updated every hour from Armenopole.',
    count: (n) => `Upcoming events: ${n}`,
    others: 'Other countries',
    all: 'All countries',
  },
  hy: {
    title: (c) => `${c} — հայկական միջոցառումներ`,
    description: (c) =>
      `${c} — հայ համայնքի համերգներ, դասախոսություններ, ոգեկոչումներ և տոներ։ Ամսաթվեր և վայրեր, թարմացվում է ամեն ժամ։`,
    intro:
      'Համերգներ, դասախոսություններ, ոգեկոչումներ, տոներ․ այս երկրում հայ համայնքի բոլոր առաջիկա միջոցառումները՝ ամսաթվով և վայրով։ Ցանկը թարմացվում է ամեն ժամ՝ Armenopole-ի տվյալներով։',
    count: (n) => `Առաջիկա միջոցառումներ՝ ${n}`,
    others: 'Այլ երկրներ',
    all: 'Բոլոր երկրները',
  },
  ru: {
    title: (c) => `${c} — армянские мероприятия`,
    description: (c) =>
      `${c} — концерты, лекции, памятные вечера и праздники армянской общины. Даты и места, обновляется каждый час.`,
    intro:
      'Концерты, лекции, памятные вечера, праздники: все предстоящие мероприятия армянской общины в этой стране — с датой и местом. Список обновляется каждый час по данным Armenopole.',
    count: (n) => `Предстоящие мероприятия: ${n}`,
    others: 'Другие страны',
    all: 'Все страны',
  },
  es: {
    title: (c) => `${c}: próximos eventos armenios`,
    description: (c) =>
      `${c}: conciertos, conferencias, conmemoraciones y fiestas de la comunidad armenia. Fechas y lugares, actualizados cada hora.`,
    intro:
      'Conciertos, conferencias, conmemoraciones, fiestas: todos los próximos eventos de la comunidad armenia registrados en este país, con su fecha y su lugar. La lista se actualiza cada hora desde Armenopole.',
    count: (n) => `Próximos eventos: ${n}`,
    others: 'Otros países',
    all: 'Todos los países',
  },
}
