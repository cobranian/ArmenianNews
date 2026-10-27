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
// follows the interface language. The card's place badge is translated too, by
// `placeLabel` (table PLACES below); an unmapped place keeps its French text.

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
    .replace(/’/g, "'")
    .toLowerCase()
    .trim()

// Le badge de lieu d'une carte (« Angleterre », « Genève », « Québec ») : le
// texte d'Armenopole, toujours en français, traduit dans la langue du lecteur.
// Clés pliées comme PLACE_TO_COUNTRY. Une région ou une ville absente de la
// table garde son texte français ; un nom de pays passe par COUNTRIES. Les
// noms de pays seuls n'ont donc pas à figurer ici. `fr` est absent : le
// français affiche le texte de la source tel quel.
// Exporté pour test/i18n-parity.test.mjs (même raison que COUNTRIES).
export const PLACES = {
  // Suisse
  geneve:     { de: 'Genf', it: 'Ginevra', en: 'Geneva', hy: 'Ժնև', ru: 'Женева' },
  tessin:     { de: 'Tessin', it: 'Ticino', en: 'Ticino', hy: 'Տիչինո', ru: 'Тичино' },
  zurich:     { de: 'Zürich', it: 'Zurigo', en: 'Zurich', hy: 'Ցյուրիխ', ru: 'Цюрих' },
  vaud:       { de: 'Waadt', it: 'Vaud', en: 'Vaud', hy: 'Վո', ru: 'Во' },
  fribourg:   { de: 'Freiburg', it: 'Friburgo', en: 'Fribourg', hy: 'Ֆրիբուր', ru: 'Фрибур' },
  valais:     { de: 'Wallis', it: 'Vallese', en: 'Valais', hy: 'Վալե', ru: 'Вале' },
  // Arménie
  erevan:     { de: 'Jerewan', it: 'Erevan', en: 'Yerevan', hy: 'Երևան', ru: 'Ереван' },
  // Royaume-Uni
  angleterre: { de: 'England', it: 'Inghilterra', en: 'England', hy: 'Անգլիա', ru: 'Англия' },
  ecosse:     { de: 'Schottland', it: 'Scozia', en: 'Scotland', hy: 'Շոտլանդիա', ru: 'Шотландия' },
  // États-Unis
  'new york':      { de: 'New York', it: 'New York', en: 'New York', hy: 'Նյու Յորք', ru: 'Нью-Йорк' },
  'new jersey':    { de: 'New Jersey', it: 'New Jersey', en: 'New Jersey', hy: 'Նյու Ջերսի', ru: 'Нью-Джерси' },
  massachusetts:   { de: 'Massachusetts', it: 'Massachusetts', en: 'Massachusetts', hy: 'Մասաչուսեթս', ru: 'Массачусетс' },
  california:      { de: 'Kalifornien', it: 'California', en: 'California', hy: 'Կալիֆոռնիա', ru: 'Калифорния' },
  californie:      { de: 'Kalifornien', it: 'California', en: 'California', hy: 'Կալիֆոռնիա', ru: 'Калифорния' },
  colorado:        { de: 'Colorado', it: 'Colorado', en: 'Colorado', hy: 'Կոլորադո', ru: 'Колорадо' },
  texas:           { de: 'Texas', it: 'Texas', en: 'Texas', hy: 'Տեխաս', ru: 'Техас' },
  pennsylvanie:    { de: 'Pennsylvania', it: 'Pennsylvania', en: 'Pennsylvania', hy: 'Փենսիլվանիա', ru: 'Пенсильвания' },
  maryland:        { de: 'Maryland', it: 'Maryland', en: 'Maryland', hy: 'Մերիլենդ', ru: 'Мэриленд' },
  // Liban
  'mont-liban':    { de: 'Libanonberg', it: 'Monte Libano', en: 'Mount Lebanon', hy: 'Լեռնային Լիբանան', ru: 'Горный Ливан' },
  beyrouth:        { de: 'Beirut', it: 'Beirut', en: 'Beirut', hy: 'Բեյրութ', ru: 'Бейрут' },
  // Pays-Bas
  'hollande-septentrionale': { de: 'Nordholland', it: 'Olanda Settentrionale', en: 'North Holland', hy: 'Հյուսիսային Հոլանդիա', ru: 'Северная Голландия' },
  utrecht:         { de: 'Utrecht', it: 'Utrecht', en: 'Utrecht', hy: 'Ուտրեխտ', ru: 'Утрехт' },
  overijssel:      { de: 'Overijssel', it: 'Overijssel', en: 'Overijssel', hy: 'Օվերէյսել', ru: 'Оверэйсел' },
  gueldre:         { de: 'Gelderland', it: 'Gheldria', en: 'Gelderland', hy: 'Գելդերլանդ', ru: 'Гелдерланд' },
  // Australie
  'nouvelle-galles du sud': { de: 'New South Wales', it: 'Nuovo Galles del Sud', en: 'New South Wales', hy: 'Նոր Հարավային Ուելս', ru: 'Новый Южный Уэльс' },
  victoria:        { de: 'Victoria', it: 'Victoria', en: 'Victoria', hy: 'Վիկտորիա', ru: 'Виктория' },
  'territoire de la capitale australienne': { de: 'Australisches Hauptstadtterritorium', it: 'Territorio della Capitale Australiana', en: 'Australian Capital Territory', hy: 'Ավստրալիական մայրաքաղաքային տարածք', ru: 'Австралийская столичная территория' },
  // Canada
  quebec:          { de: 'Québec', it: 'Québec', en: 'Quebec', hy: 'Քվեբեկ', ru: 'Квебек' },
  ontario:         { de: 'Ontario', it: 'Ontario', en: 'Ontario', hy: 'Օնտարիո', ru: 'Онтарио' },
  'colombie-britannique': { de: 'British Columbia', it: 'Columbia Britannica', en: 'British Columbia', hy: 'Բրիտանական Կոլումբիա', ru: 'Британская Колумбия' },
  // France
  'ile-de-france':        { de: 'Île-de-France', it: 'Île-de-France', en: 'Île-de-France', hy: 'Իլ դը Ֆրանս', ru: 'Иль-де-Франс' },
  'auvergne-rhone-alpes': { de: 'Auvergne-Rhône-Alpes', it: 'Alvernia-Rodano-Alpi', en: 'Auvergne-Rhône-Alpes', hy: 'Օվերն-Ռոն-Ալպեր', ru: 'Овернь — Рона — Альпы' },
  "provence-alpes-cote-d'azur": { de: 'Provence-Alpes-Côte d’Azur', it: 'Provenza-Alpi-Costa Azzurra', en: 'Provence-Alpes-Côte d’Azur', hy: 'Պրովանս-Ալպեր-Լազուրե ափ', ru: 'Прованс — Альпы — Лазурный Берег' },
  'nouvelle-aquitaine':   { de: 'Nouvelle-Aquitaine', it: 'Nuova Aquitania', en: 'Nouvelle-Aquitaine', hy: 'Նոր Ակվիտանիա', ru: 'Новая Аквитания' },
  // Allemagne
  baviere:                 { de: 'Bayern', it: 'Baviera', en: 'Bavaria', hy: 'Բավարիա', ru: 'Бавария' },
  'baden-wurtemberg':      { de: 'Baden-Württemberg', it: 'Baden-Württemberg', en: 'Baden-Württemberg', hy: 'Բադեն-Վյուրտեմբերգ', ru: 'Баден-Вюртемберг' },
  'rhenanie-du-nord-westphalie': { de: 'Nordrhein-Westfalen', it: 'Renania Settentrionale-Vestfalia', en: 'North Rhine-Westphalia', hy: 'Հյուսիսային Հռենոս-Վեստֆալիա', ru: 'Северный Рейн — Вестфалия' },
  // Italie, Argentine
  venetie:         { de: 'Venetien', it: 'Veneto', en: 'Veneto', hy: 'Վենետո', ru: 'Венето' },
  'buenos aires':  { de: 'Buenos Aires', it: 'Buenos Aires', en: 'Buenos Aires', hy: 'Բուենոս Այրես', ru: 'Буэнос-Айрес' },
}

// Le lieu d'un événement dans la langue du lecteur. Ordre : la table PLACES,
// puis un nom de pays (« Russie », « Australie ») via COUNTRIES, sinon le texte
// d'origine — jamais une clé, jamais vide.
export function placeLabel(location, lang) {
  if (!location || lang === 'fr') return location || ''
  const k = fold(location)
  const p = PLACES[k]?.[lang]
  if (p) return p
  const c = COUNTRIES[PLACE_TO_COUNTRY[k] || k]
  if (c && fold(c.fr) === k) return c[lang] || location
  return location
}

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
