// Country resolution + localized labels for the agenda's country selector.
//
// The armenopole feed labels each event with free French text (`location`: a
// country, a city, a region) plus the country slug of the listing page it was
// scraped from (`country`). Those two can disagree — the same event is
// cross-listed on several country pages, so `country` is often the community
// that organizes it, not where it happens. The `location` text is the more
// reliable "where", so we resolve from it first, slug second.
//
// `worldCountryKey(ev)` returns a canonical key used to bucket events under the
// selector; `countryLabel(key, lang)` / `countryFlag(key)` render that key.
// The selector's country NAME is localized in every interface language — it is UI
// chrome (a control label), not article text, so unlike the scraped content it
// follows the interface language. The card's place badge keeps the raw scraped
// text (see Agenda.jsx): "Le Pays reste en Français".

// Exporté pour test/i18n-parity.test.mjs : countryLabel() retombe sur le
// français, donc seul un contrôle de la table voit un nom de/it manquant.
export const COUNTRIES = {
  switzerland:   { fr: 'Suisse',      de: 'Schweiz', it: 'Svizzera', en: 'Switzerland',    hy: 'Շվեյցարիա',      ru: 'Швейцария',      flag: '🇨🇭' },
  armenia:       { fr: 'Arménie',     de: 'Armenien', it: 'Armenia', en: 'Armenia',        hy: 'Հայաստան',       ru: 'Армения',        flag: '🇦🇲' },
  france:        { fr: 'France',      de: 'Frankreich', it: 'Francia', en: 'France',         hy: 'Ֆրանսիա',        ru: 'Франция',        flag: '🇫🇷' },
  usa:           { fr: 'États-Unis',  de: 'Vereinigte Staaten', it: 'Stati Uniti', en: 'United States',  hy: 'ԱՄՆ',            ru: 'США',            flag: '🇺🇸' },
  germany:       { fr: 'Allemagne',   de: 'Deutschland', it: 'Germania', en: 'Germany',        hy: 'Գերմանիա',       ru: 'Германия',       flag: '🇩🇪' },
  russia:        { fr: 'Russie',      de: 'Russland', it: 'Russia', en: 'Russia',         hy: 'Ռուսաստան',      ru: 'Россия',         flag: '🇷🇺' },
  lebanon:       { fr: 'Liban',       de: 'Libanon', it: 'Libano', en: 'Lebanon',        hy: 'Լիբանան',        ru: 'Ливан',          flag: '🇱🇧' },
  canada:        { fr: 'Canada',      de: 'Kanada', it: 'Canada', en: 'Canada',         hy: 'Կանադա',         ru: 'Канада',         flag: '🇨🇦' },
  greece:        { fr: 'Grèce',       de: 'Griechenland', it: 'Grecia', en: 'Greece',         hy: 'Հունաստան',      ru: 'Греция',         flag: '🇬🇷' },
  italy:         { fr: 'Italie',      de: 'Italien', it: 'Italia', en: 'Italy',          hy: 'Իտալիա',         ru: 'Италия',         flag: '🇮🇹' },
  unitedkingdom: { fr: 'Royaume-Uni', de: 'Vereinigtes Königreich', it: 'Regno Unito', en: 'United Kingdom', hy: 'Մեծ Բրիտանիա',   ru: 'Великобритания', flag: '🇬🇧' },
  belgium:       { fr: 'Belgique',    de: 'Belgien', it: 'Belgio', en: 'Belgium',        hy: 'Բելգիա',         ru: 'Бельгия',        flag: '🇧🇪' },
  netherlands:   { fr: 'Pays-Bas',    de: 'Niederlande', it: 'Paesi Bassi', en: 'Netherlands',    hy: 'Նիդեռլանդներ',   ru: 'Нидерланды',     flag: '🇳🇱' },
  cyprus:        { fr: 'Chypre',      de: 'Zypern', it: 'Cipro', en: 'Cyprus',         hy: 'Կիպրոս',         ru: 'Кипр',           flag: '🇨🇾' },
  argentina:     { fr: 'Argentine',   de: 'Argentinien', it: 'Argentina', en: 'Argentina',      hy: 'Արգենտինա',      ru: 'Аргентина',      flag: '🇦🇷' },
  australia:     { fr: 'Australie',   de: 'Australien', it: 'Australia', en: 'Australia',      hy: 'Ավստրալիա',      ru: 'Австралия',      flag: '🇦🇺' },
  brazil:        { fr: 'Brésil',      de: 'Brasilien', it: 'Brasile', en: 'Brazil',         hy: 'Բրազիլիա',       ru: 'Бразилия',       flag: '🇧🇷' },
  bulgaria:      { fr: 'Bulgarie',    de: 'Bulgarien', it: 'Bulgaria', en: 'Bulgaria',       hy: 'Բուլղարիա',      ru: 'Болгария',       flag: '🇧🇬' },
  egypt:         { fr: 'Égypte',      de: 'Ägypten', it: 'Egitto', en: 'Egypt',          hy: 'Եգիպտոս',        ru: 'Египет',         flag: '🇪🇬' },
  iraq:          { fr: 'Irak',        de: 'Irak', it: 'Iraq', en: 'Iraq',           hy: 'Իրաք',           ru: 'Ирак',           flag: '🇮🇶' },
  israel:        { fr: 'Israël',      de: 'Israel', it: 'Israele', en: 'Israel',         hy: 'Իսրայել',        ru: 'Израиль',        flag: '🇮🇱' },
  jordan:        { fr: 'Jordanie',    de: 'Jordanien', it: 'Giordania', en: 'Jordan',         hy: 'Հորդանան',       ru: 'Иордания',       flag: '🇯🇴' },
  poland:        { fr: 'Pologne',     de: 'Polen', it: 'Polonia', en: 'Poland',         hy: 'Լեհաստան',       ru: 'Польша',         flag: '🇵🇱' },
  qatar:         { fr: 'Qatar',       de: 'Katar', it: 'Qatar', en: 'Qatar',          hy: 'Կատար',          ru: 'Катар',          flag: '🇶🇦' },
  singapore:     { fr: 'Singapour',   de: 'Singapur', it: 'Singapore', en: 'Singapore',      hy: 'Սինգապուր',      ru: 'Сингапур',       flag: '🇸🇬' },
  syria:         { fr: 'Syrie',       de: 'Syrien', it: 'Siria', en: 'Syria',          hy: 'Սիրիա',          ru: 'Сирия',          flag: '🇸🇾' },
  turkey:        { fr: 'Turquie',     de: 'Türkei', it: 'Turchia', en: 'Turkey',         hy: 'Թուրքիա',        ru: 'Турция',         flag: '🇹🇷' },
  uae:           { fr: 'Émirats arabes unis', de: 'Vereinigte Arabische Emirate', it: 'Emirati Arabi Uniti', en: 'United Arab Emirates', hy: 'ԱՄԷ', ru: 'ОАЭ',        flag: '🇦🇪' },
  uruguay:       { fr: 'Uruguay',     de: 'Uruguay', it: 'Uruguay', en: 'Uruguay',        hy: 'Ուրուգվայ',      ru: 'Уругвай',        flag: '🇺🇾' },
}

// Free-text `location` values (accent-folded, lowercased) → canonical country
// key. Covers the country names as they appear in the French feed, the Swiss
// cantons/cities (so a Geneva event listed on a world page still lands under
// Switzerland), plus the sub-national places seen in the feed (US states, a
// Dutch region) so "New York" resolves to the United States.
const PLACE_TO_COUNTRY = {
  // Switzerland — cantons and cities seen in the feed
  suisse: 'switzerland', geneve: 'switzerland', valais: 'switzerland',
  zurich: 'switzerland', vaud: 'switzerland', fribourg: 'switzerland',
  // Armenia
  armenie: 'armenia', erevan: 'armenia', yerevan: 'armenia',
  // United Kingdom
  angleterre: 'unitedkingdom', 'royaume-uni': 'unitedkingdom', ecosse: 'unitedkingdom',
  // United States (+ states/cities seen in the feed)
  'etats-unis': 'usa', 'new york': 'usa', colorado: 'usa',
  californie: 'usa', massachusetts: 'usa',
  // the rest
  france: 'france', allemagne: 'germany', russie: 'russia', liban: 'lebanon',
  canada: 'canada', grece: 'greece', italie: 'italy', belgique: 'belgium',
  'pays-bas': 'netherlands', gueldre: 'netherlands', chypre: 'cyprus', cyprus: 'cyprus',
  argentine: 'argentina', australie: 'australia', bresil: 'brazil', bulgarie: 'bulgaria',
  egypte: 'egypt', irak: 'iraq', israel: 'israel', jordanie: 'jordan', pologne: 'poland',
  qatar: 'qatar', singapour: 'singapore', syrie: 'syria', turquie: 'turkey',
  uruguay: 'uruguay', 'emirats arabes unis': 'uae',
}

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // drop accents (Genève -> geneve)
    .toLowerCase()
    .trim()

// Canonical country key for an event, used to bucket it under the selector and
// as the selector's option value. Resolve from the location text first, then
// the armenopole slug; fall back to the folded raw place so an unmapped country
// still groups its own events together (labeled from the raw text, never a bare
// slug).
export function worldCountryKey(ev) {
  const loc = fold(ev.location || '')
  if (PLACE_TO_COUNTRY[loc]) return PLACE_TO_COUNTRY[loc]
  const slug = fold(ev.country || '')
  if (COUNTRIES[slug]) return slug
  if (PLACE_TO_COUNTRY[slug]) return PLACE_TO_COUNTRY[slug]
  return loc || slug || 'other'
}

export function countryFlag(key) {
  return COUNTRIES[key]?.flag || '🌍'
}

// Localized country name for the selector. Known keys are translated; an
// unmapped key falls back to the event's raw place text so it stays readable.
export function countryLabel(key, lang, fallback = '') {
  const c = COUNTRIES[key]
  if (c) return c[lang] || c.fr
  return fallback || key
}
