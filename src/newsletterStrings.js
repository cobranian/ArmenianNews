// Textes de la lettre hebdomadaire, en français et en anglais seulement (les
// deux langues de tête des vitrines). Module PLAT, sans JSX : Node le lit pour
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
}
