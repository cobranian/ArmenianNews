// Localized country badge for the "Monde" (world) agenda.
//
// The armenopole feed labels each world event with free French text
// (`location`: a country, a US state, a region) plus the country slug of the
// listing page it was scraped from (`country`). Those two can disagree — the
// same event is listed on several country pages, so `country` is often the
// community that organizes it, not where it happens. The `location` text is the
// more reliable "where", so we resolve from it first, slug second.
//
// The French UI keeps the raw scraped French text ("Le Pays reste en
// Français"); en/hy/ru show the country in the reader's language. `fr` is
// intentionally absent from COUNTRIES — the French branch never reaches it.

const COUNTRIES = {
  france: { en: 'France', hy: 'Ֆրանսիա', ru: 'Франция' },
  usa: { en: 'United States', hy: 'ԱՄՆ', ru: 'США' },
  germany: { en: 'Germany', hy: 'Գերմանիա', ru: 'Германия' },
  russia: { en: 'Russia', hy: 'Ռուսաստան', ru: 'Россия' },
  lebanon: { en: 'Lebanon', hy: 'Լիբանան', ru: 'Ливан' },
  canada: { en: 'Canada', hy: 'Կանադա', ru: 'Канада' },
  greece: { en: 'Greece', hy: 'Հունաստան', ru: 'Греция' },
  italy: { en: 'Italy', hy: 'Իտալիա', ru: 'Италия' },
  unitedkingdom: { en: 'United Kingdom', hy: 'Մեծ Բրիտանիա', ru: 'Великобритания' },
  belgium: { en: 'Belgium', hy: 'Բելգիա', ru: 'Бельгия' },
  netherlands: { en: 'Netherlands', hy: 'Նիդեռլանդներ', ru: 'Нидерланды' },
}

// Free-text `location` values (accent-folded, lowercased) → country slug. Covers
// the country names as they appear in the French feed, plus the sub-national
// places seen in it (US states, a Dutch region) so "New York" resolves to USA.
const PLACE_TO_COUNTRY = {
  angleterre: 'unitedkingdom',
  'royaume-uni': 'unitedkingdom',
  ecosse: 'unitedkingdom',
  'etats-unis': 'usa',
  'new york': 'usa',
  colorado: 'usa',
  californie: 'usa',
  massachusetts: 'usa',
  france: 'france',
  allemagne: 'germany',
  russie: 'russia',
  liban: 'lebanon',
  canada: 'canada',
  grece: 'greece',
  italie: 'italy',
  belgique: 'belgium',
  'pays-bas': 'netherlands',
  gueldre: 'netherlands',
}

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop accents (Genève -> geneve)
    .toLowerCase()
    .trim()

// Badge text for a world event in the active language. French keeps the raw
// scraped place; other languages resolve the country from the place text, then
// the armenopole slug, and fall back to the raw place if neither is known —
// never a bare slug.
export function worldPlace(ev, lang) {
  const fallback = ev.location || ev.country || ''
  if (lang === 'fr' || !fallback) return fallback
  const key = PLACE_TO_COUNTRY[fold(ev.location || ev.country || '')] || ev.country
  return COUNTRIES[key]?.[lang] || fallback
}
