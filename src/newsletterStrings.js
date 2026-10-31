// Textes de la lettre hebdomadaire, une lettre par langue (sites.config.js,
// `newsletter.lists`). Une langue dotée d'une liste sans entrée ici fait
// échouer test/newsletter.test.mjs. Module PLAT, sans JSX : Node le lit pour
// composer le numéro (scripts/lib/newsletter.mjs). Même raison que src/seo.js.
export const NEWSLETTER_STRINGS = {
  fr: {
    subject: (dateLabel) => `Arménie Info — la semaine du ${dateLabel}`,
    intro: 'Le résumé de la semaine arménienne : les brèves du jour, la culture et l’agenda à venir.',
    briefs: 'Les brèves de la semaine',
    culture: 'Culture',
    agenda: 'À l’agenda',
    more: 'Tout l’agenda',
  },
  en: {
    subject: (dateLabel) => `Armenia News — week of ${dateLabel}`,
    intro: 'Your Armenian week in brief: the daily briefs, culture and what is coming up.',
    briefs: 'This week’s briefs',
    culture: 'Culture',
    agenda: 'Coming up',
    more: 'Full agenda',
  },
  de: {
    subject: (dateLabel) => `Arménie Info — die Woche vom ${dateLabel}`,
    intro: 'Die armenische Woche im Überblick: der Tag in Kürze, Kultur und die kommenden Veranstaltungen.',
    briefs: 'Der Tag in Kürze, diese Woche',
    culture: 'Kultur',
    agenda: 'Demnächst',
    more: 'Alle Veranstaltungen',
  },
  it: {
    subject: (dateLabel) => `Arménie Info — la settimana del ${dateLabel}`,
    intro: 'La settimana armena in sintesi: il giorno in breve, la cultura e i prossimi eventi.',
    briefs: 'Il giorno in breve, questa settimana',
    culture: 'Cultura',
    agenda: 'Prossimi eventi',
    more: 'Tutti gli eventi',
  },
  hy: {
    // Marque VUE sur /hy/ (STRINGS.hy['site.title']), pas celle des métadonnées.
    subject: (dateLabel) => `Արմենիա Ինֆո — շաբաթվա ամփոփում (${dateLabel})`,
    intro: 'Հայկական շաբաթը համառոտ՝ օրվա ամփոփումները, մշակույթը և առաջիկա միջոցառումները։',
    briefs: 'Շաբաթվա ամփոփումները',
    culture: 'Մշակույթ',
    agenda: 'Առաջիկա միջոցառումներ',
    more: 'Բոլոր միջոցառումները',
  },
  ru: {
    subject: (dateLabel) => `Armenia News — неделя с ${dateLabel}`,
    intro: 'Армянская неделя вкратце: сводки дня, культура и ближайшие события.',
    briefs: 'Сводки недели',
    culture: 'Культура',
    agenda: 'Ближайшие события',
    more: 'Вся афиша',
  },
}
