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
  switzerland:   { fr: 'Suisse',      de: 'Schweiz', it: 'Svizzera', en: 'Switzerland',    hy: 'Շվեյցարիա',      ru: 'Швейцария', es: 'Suiza',      flag: '🇨🇭' },
  armenia:       { fr: 'Arménie',     de: 'Armenien', it: 'Armenia', en: 'Armenia',        hy: 'Հայաստան',       ru: 'Армения', es: 'Armenia',        flag: '🇦🇲' },
  france:        { fr: 'France',      de: 'Frankreich', it: 'Francia', en: 'France',         hy: 'Ֆրանսիա',        ru: 'Франция', es: 'Francia',        flag: '🇫🇷' },
  usa:           { fr: 'États-Unis',  de: 'Vereinigte Staaten', it: 'Stati Uniti', en: 'United States',  hy: 'ԱՄՆ',            ru: 'США', es: 'Estados Unidos',            flag: '🇺🇸' },
  germany:       { fr: 'Allemagne',   de: 'Deutschland', it: 'Germania', en: 'Germany',        hy: 'Գերմանիա',       ru: 'Германия', es: 'Alemania',       flag: '🇩🇪' },
  russia:        { fr: 'Russie',      de: 'Russland', it: 'Russia', en: 'Russia',         hy: 'Ռուսաստան',      ru: 'Россия', es: 'Rusia',         flag: '🇷🇺' },
  lebanon:       { fr: 'Liban',       de: 'Libanon', it: 'Libano', en: 'Lebanon',        hy: 'Լիբանան',        ru: 'Ливан', es: 'Líbano',          flag: '🇱🇧' },
  canada:        { fr: 'Canada',      de: 'Kanada', it: 'Canada', en: 'Canada',         hy: 'Կանադա',         ru: 'Канада', es: 'Canadá',         flag: '🇨🇦' },
  greece:        { fr: 'Grèce',       de: 'Griechenland', it: 'Grecia', en: 'Greece',         hy: 'Հունաստան',      ru: 'Греция', es: 'Grecia',         flag: '🇬🇷' },
  italy:         { fr: 'Italie',      de: 'Italien', it: 'Italia', en: 'Italy',          hy: 'Իտալիա',         ru: 'Италия', es: 'Italia',         flag: '🇮🇹' },
  unitedkingdom: { fr: 'Royaume-Uni', de: 'Vereinigtes Königreich', it: 'Regno Unito', en: 'United Kingdom', hy: 'Մեծ Բրիտանիա',   ru: 'Великобритания', es: 'Reino Unido', flag: '🇬🇧' },
  belgium:       { fr: 'Belgique',    de: 'Belgien', it: 'Belgio', en: 'Belgium',        hy: 'Բելգիա',         ru: 'Бельгия', es: 'Bélgica',        flag: '🇧🇪' },
  netherlands:   { fr: 'Pays-Bas',    de: 'Niederlande', it: 'Paesi Bassi', en: 'Netherlands',    hy: 'Նիդեռլանդներ',   ru: 'Нидерланды', es: 'Países Bajos',     flag: '🇳🇱' },
  cyprus:        { fr: 'Chypre',      de: 'Zypern', it: 'Cipro', en: 'Cyprus',         hy: 'Կիպրոս',         ru: 'Кипр', es: 'Chipre',           flag: '🇨🇾' },
  argentina:     { fr: 'Argentine',   de: 'Argentinien', it: 'Argentina', en: 'Argentina',      hy: 'Արգենտինա',      ru: 'Аргентина', es: 'Argentina',      flag: '🇦🇷' },
  australia:     { fr: 'Australie',   de: 'Australien', it: 'Australia', en: 'Australia',      hy: 'Ավստրալիա',      ru: 'Австралия', es: 'Australia',      flag: '🇦🇺' },
  brazil:        { fr: 'Brésil',      de: 'Brasilien', it: 'Brasile', en: 'Brazil',         hy: 'Բրազիլիա',       ru: 'Бразилия', es: 'Brasil',       flag: '🇧🇷' },
  bulgaria:      { fr: 'Bulgarie',    de: 'Bulgarien', it: 'Bulgaria', en: 'Bulgaria',       hy: 'Բուլղարիա',      ru: 'Болгария', es: 'Bulgaria',       flag: '🇧🇬' },
  egypt:         { fr: 'Égypte',      de: 'Ägypten', it: 'Egitto', en: 'Egypt',          hy: 'Եգիպտոս',        ru: 'Египет', es: 'Egipto',         flag: '🇪🇬' },
  iraq:          { fr: 'Irak',        de: 'Irak', it: 'Iraq', en: 'Iraq',           hy: 'Իրաք',           ru: 'Ирак', es: 'Irak',           flag: '🇮🇶' },
  israel:        { fr: 'Israël',      de: 'Israel', it: 'Israele', en: 'Israel',         hy: 'Իսրայել',        ru: 'Израиль', es: 'Israel',        flag: '🇮🇱' },
  jordan:        { fr: 'Jordanie',    de: 'Jordanien', it: 'Giordania', en: 'Jordan',         hy: 'Հորդանան',       ru: 'Иордания', es: 'Jordania',       flag: '🇯🇴' },
  poland:        { fr: 'Pologne',     de: 'Polen', it: 'Polonia', en: 'Poland',         hy: 'Լեհաստան',       ru: 'Польша', es: 'Polonia',         flag: '🇵🇱' },
  qatar:         { fr: 'Qatar',       de: 'Katar', it: 'Qatar', en: 'Qatar',          hy: 'Կատար',          ru: 'Катар', es: 'Catar',          flag: '🇶🇦' },
  singapore:     { fr: 'Singapour',   de: 'Singapur', it: 'Singapore', en: 'Singapore',      hy: 'Սինգապուր',      ru: 'Сингапур', es: 'Singapur',       flag: '🇸🇬' },
  syria:         { fr: 'Syrie',       de: 'Syrien', it: 'Siria', en: 'Syria',          hy: 'Սիրիա',          ru: 'Сирия', es: 'Siria',          flag: '🇸🇾' },
  turkey:        { fr: 'Turquie',     de: 'Türkei', it: 'Turchia', en: 'Turkey',         hy: 'Թուրքիա',        ru: 'Турция', es: 'Turquía',         flag: '🇹🇷' },
  uae:           { fr: 'Émirats arabes unis', de: 'Vereinigte Arabische Emirate', it: 'Emirati Arabi Uniti', en: 'United Arab Emirates', hy: 'ԱՄԷ', ru: 'ОАЭ', es: 'Emiratos Árabes Unidos',        flag: '🇦🇪' },
  uruguay:       { fr: 'Uruguay',     de: 'Uruguay', it: 'Uruguay', en: 'Uruguay',        hy: 'Ուրուգվայ',      ru: 'Уругвай', es: 'Uruguay',        flag: '🇺🇾' },
  austria:       { fr: 'Autriche',    de: 'Österreich', it: 'Austria', en: 'Austria',        hy: 'Ավստրիա',        ru: 'Австрия', es: 'Austria',        flag: '🇦🇹' },
  china:         { fr: 'Chine',       de: 'China', it: 'Cina', en: 'China',          hy: 'Չինաստան',       ru: 'Китай', es: 'China',          flag: '🇨🇳' },
  spain:         { fr: 'Espagne',     de: 'Spanien', it: 'Spagna', en: 'Spain',          hy: 'Իսպանիա',        ru: 'Испания', es: 'España',        flag: '🇪🇸' },
  sweden:        { fr: 'Suède',       de: 'Schweden', it: 'Svezia', en: 'Sweden',         hy: 'Շվեդիա',         ru: 'Швеция', es: 'Suecia',         flag: '🇸🇪' },
}

// Free-text `location` values (accent-folded, lowercased) → canonical country
// key. Covers the country names as they appear in the French feed, the Swiss
// cantons/cities (so a Geneva event listed on a world page still lands under
// Switzerland), plus the sub-national places seen in the feed (US states, a
// Dutch region) so "New York" resolves to the United States.
export const PLACE_TO_COUNTRY = {
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
  // Pages pays apparues chez Armenopole en octobre 2026
  autriche: 'austria', vienne: 'austria', bruxelles: 'belgium', anvers: 'belgium',
  'sao paulo': 'brazil', chine: 'china', shanghai: 'china', espagne: 'spain',
  catalogne: 'spain', 'communaute de madrid': 'spain', suede: 'sweden',
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
// Exporté pour test/place-label.test.mjs, qui vérifie les six langues.
export const PLACES = {
  // Suisse
  geneve:     { de: 'Genf', it: 'Ginevra', en: 'Geneva', hy: 'Ժնև', ru: 'Женева', es: 'Ginebra' },
  tessin:     { de: 'Tessin', it: 'Ticino', en: 'Ticino', hy: 'Տիչինո', ru: 'Тичино', es: 'Tesino' },
  zurich:     { de: 'Zürich', it: 'Zurigo', en: 'Zurich', hy: 'Ցյուրիխ', ru: 'Цюрих', es: 'Zúrich' },
  vaud:       { de: 'Waadt', it: 'Vaud', en: 'Vaud', hy: 'Վո', ru: 'Во', es: 'Vaud' },
  fribourg:   { de: 'Freiburg', it: 'Friburgo', en: 'Fribourg', hy: 'Ֆրիբուր', ru: 'Фрибур', es: 'Friburgo' },
  valais:     { de: 'Wallis', it: 'Vallese', en: 'Valais', hy: 'Վալե', ru: 'Вале', es: 'Valais' },
  // Arménie
  erevan:     { de: 'Jerewan', it: 'Erevan', en: 'Yerevan', hy: 'Երևան', ru: 'Ереван', es: 'Ereván' },
  // Royaume-Uni
  angleterre: { de: 'England', it: 'Inghilterra', en: 'England', hy: 'Անգլիա', ru: 'Англия', es: 'Inglaterra' },
  ecosse:     { de: 'Schottland', it: 'Scozia', en: 'Scotland', hy: 'Շոտլանդիա', ru: 'Шотландия', es: 'Escocia' },
  // États-Unis
  'new york':      { de: 'New York', it: 'New York', en: 'New York', hy: 'Նյու Յորք', ru: 'Нью-Йорк', es: 'Nueva York' },
  'new jersey':    { de: 'New Jersey', it: 'New Jersey', en: 'New Jersey', hy: 'Նյու Ջերսի', ru: 'Нью-Джерси', es: 'Nueva Jersey' },
  massachusetts:   { de: 'Massachusetts', it: 'Massachusetts', en: 'Massachusetts', hy: 'Մասաչուսեթս', ru: 'Массачусетс', es: 'Massachusetts' },
  california:      { de: 'Kalifornien', it: 'California', en: 'California', hy: 'Կալիֆոռնիա', ru: 'Калифорния', es: 'California' },
  colorado:        { de: 'Colorado', it: 'Colorado', en: 'Colorado', hy: 'Կոլորադո', ru: 'Колорадо', es: 'Colorado' },
  texas:           { de: 'Texas', it: 'Texas', en: 'Texas', hy: 'Տեխաս', ru: 'Техас', es: 'Texas' },
  pennsylvanie:    { de: 'Pennsylvania', it: 'Pennsylvania', en: 'Pennsylvania', hy: 'Փենսիլվանիա', ru: 'Пенсильвания', es: 'Pensilvania' },
  maryland:        { de: 'Maryland', it: 'Maryland', en: 'Maryland', hy: 'Մերիլենդ', ru: 'Мэриленд', es: 'Maryland' },
  // Liban
  'mont-liban':    { de: 'Libanonberg', it: 'Monte Libano', en: 'Mount Lebanon', hy: 'Լեռնային Լիբանան', ru: 'Горный Ливан', es: 'Monte Líbano' },
  beyrouth:        { de: 'Beirut', it: 'Beirut', en: 'Beirut', hy: 'Բեյրութ', ru: 'Бейрут', es: 'Beirut' },
  // Pays-Bas
  'hollande-septentrionale': { de: 'Nordholland', it: 'Olanda Settentrionale', en: 'North Holland', hy: 'Հյուսիսային Հոլանդիա', ru: 'Северная Голландия', es: 'Holanda Septentrional' },
  utrecht:         { de: 'Utrecht', it: 'Utrecht', en: 'Utrecht', hy: 'Ուտրեխտ', ru: 'Утрехт', es: 'Utrecht' },
  overijssel:      { de: 'Overijssel', it: 'Overijssel', en: 'Overijssel', hy: 'Օվերէյսել', ru: 'Оверэйсел', es: 'Overijssel' },
  gueldre:         { de: 'Gelderland', it: 'Gheldria', en: 'Gelderland', hy: 'Գելդերլանդ', ru: 'Гелдерланд', es: 'Güeldres' },
  // Australie
  'nouvelle-galles du sud': { de: 'New South Wales', it: 'Nuovo Galles del Sud', en: 'New South Wales', hy: 'Նոր Հարավային Ուելս', ru: 'Новый Южный Уэльс', es: 'Nueva Gales del Sur' },
  victoria:        { de: 'Victoria', it: 'Victoria', en: 'Victoria', hy: 'Վիկտորիա', ru: 'Виктория', es: 'Victoria' },
  'territoire de la capitale australienne': { de: 'Australisches Hauptstadtterritorium', it: 'Territorio della Capitale Australiana', en: 'Australian Capital Territory', hy: 'Ավստրալիական մայրաքաղաքային տարածք', ru: 'Австралийская столичная территория', es: 'Territorio de la Capital Australiana' },
  // Canada
  quebec:          { de: 'Québec', it: 'Québec', en: 'Quebec', hy: 'Քվեբեկ', ru: 'Квебек', es: 'Quebec' },
  ontario:         { de: 'Ontario', it: 'Ontario', en: 'Ontario', hy: 'Օնտարիո', ru: 'Онтарио', es: 'Ontario' },
  'colombie-britannique': { de: 'British Columbia', it: 'Columbia Britannica', en: 'British Columbia', hy: 'Բրիտանական Կոլումբիա', ru: 'Британская Колумбия', es: 'Columbia Británica' },
  // France
  'ile-de-france':        { de: 'Île-de-France', it: 'Île-de-France', en: 'Île-de-France', hy: 'Իլ դը Ֆրանս', ru: 'Иль-де-Франс', es: 'Isla de Francia' },
  'auvergne-rhone-alpes': { de: 'Auvergne-Rhône-Alpes', it: 'Alvernia-Rodano-Alpi', en: 'Auvergne-Rhône-Alpes', hy: 'Օվերն-Ռոն-Ալպեր', ru: 'Овернь — Рона — Альпы', es: 'Auvernia-Ródano-Alpes' },
  "provence-alpes-cote-d'azur": { de: 'Provence-Alpes-Côte d’Azur', it: 'Provenza-Alpi-Costa Azzurra', en: 'Provence-Alpes-Côte d’Azur', hy: 'Պրովանս-Ալպեր-Լազուրե ափ', ru: 'Прованс — Альпы — Лазурный Берег', es: 'Provenza-Alpes-Costa Azul' },
  'nouvelle-aquitaine':   { de: 'Nouvelle-Aquitaine', it: 'Nuova Aquitania', en: 'Nouvelle-Aquitaine', hy: 'Նոր Ակվիտանիա', ru: 'Новая Аквитания', es: 'Nueva Aquitania' },
  // Allemagne
  baviere:                 { de: 'Bayern', it: 'Baviera', en: 'Bavaria', hy: 'Բավարիա', ru: 'Бавария', es: 'Baviera' },
  'baden-wurtemberg':      { de: 'Baden-Württemberg', it: 'Baden-Württemberg', en: 'Baden-Württemberg', hy: 'Բադեն-Վյուրտեմբերգ', ru: 'Баден-Вюртемберг', es: 'Baden-Wurtemberg' },
  'rhenanie-du-nord-westphalie': { de: 'Nordrhein-Westfalen', it: 'Renania Settentrionale-Vestfalia', en: 'North Rhine-Westphalia', hy: 'Հյուսիսային Հռենոս-Վեստֆալիա', ru: 'Северный Рейн — Вестфалия', es: 'Renania del Norte-Westfalia' },
  // Italie, Argentine
  venetie:         { de: 'Venetien', it: 'Veneto', en: 'Veneto', hy: 'Վենետո', ru: 'Венето', es: 'Véneto' },
  argentine:       { de: 'Argentinien', it: 'Argentina', en: 'Argentina', hy: 'Արգենտինա', ru: 'Аргентина', es: 'Argentina' },
  'buenos aires':  { de: 'Buenos Aires', it: 'Buenos Aires', en: 'Buenos Aires', hy: 'Բուենոս Այրես', ru: 'Буэнос-Айрес', es: 'Buenos Aires' },
  // Autriche, Belgique, Brésil, Chine, Espagne (pages ouvertes en octobre 2026)
  vienne:          { de: 'Wien', it: 'Vienna', en: 'Vienna', hy: 'Վիեննա', ru: 'Вена', es: 'Viena' },
  bruxelles:       { de: 'Brüssel', it: 'Bruxelles', en: 'Brussels', hy: 'Բրյուսել', ru: 'Брюссель', es: 'Bruselas' },
  anvers:          { de: 'Antwerpen', it: 'Anversa', en: 'Antwerp', hy: 'Անտվերպեն', ru: 'Антверпен', es: 'Amberes' },
  'sao paulo':     { de: 'São Paulo', it: 'San Paolo', en: 'São Paulo', hy: 'Սան Պաուլու', ru: 'Сан-Паулу', es: 'São Paulo' },
  shanghai:        { de: 'Shanghai', it: 'Shanghai', en: 'Shanghai', hy: 'Շանհայ', ru: 'Шанхай', es: 'Shanghái' },
  catalogne:       { de: 'Katalonien', it: 'Catalogna', en: 'Catalonia', hy: 'Կատալոնիա', ru: 'Каталония', es: 'Cataluña' },
  'communaute de madrid': { de: 'Autonome Gemeinschaft Madrid', it: 'Comunità di Madrid', en: 'Community of Madrid', hy: 'Մադրիդի համայնք', ru: 'Сообщество Мадрида', es: 'Comunidad de Madrid' },
}
// Variantes d'écriture d'un même lieu : une seule entrée, pas deux copies.
PLACES.californie = PLACES.california
PLACES.yerevan = PLACES.erevan

// Le lieu d'un événement dans la langue du lecteur. Ordre : la table PLACES,
// puis un nom de pays (« Russie », « Australie ») via COUNTRIES, sinon le texte
// d'origine — jamais une clé, jamais vide.
export function placeLabel(location, lang) {
  if (!location || lang === 'fr') return location || ''
  const k = fold(location)
  const p = PLACES[k]?.[lang]
  if (p) return p
  const c = COUNTRIES[PLACE_TO_COUNTRY[k] || k]
  // Un nom de pays (« Russie », ou l'alias « Cyprus »), pas une ville qui y
  // mène : celles-ci sont dans PLACES.
  if (c && (fold(c.fr) === k || fold(c.en) === k)) return c[lang] || location
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
