// Les libellés des neuf rubriques communes, par langue.
//
// Module JS PLAT : i18n.jsx les étale dans ses dictionnaires (t('rubric.x')),
// et les pages de brève (Node, scripts/lib/brief-pages.mjs) les lisent
// directement — Node ne sait pas importer du JSX.
export const RUBRIC_LABELS = {
  fr: {
    armenie: 'Arménie',
    politique: 'Politique',
    economie: 'Économie',
    monde: 'Monde',
    societe: 'Société',
    diaspora: 'Diaspora',
    culture: 'Culture',
    sports: 'Sports',
    opinion: 'Opinion',
  },
  de: {
    armenie: 'Armenien',
    politique: 'Politik',
    economie: 'Wirtschaft',
    monde: 'Welt',
    societe: 'Gesellschaft',
    diaspora: 'Diaspora',
    culture: 'Kultur',
    sports: 'Sport',
    opinion: 'Meinung',
  },
  it: {
    armenie: 'Armenia',
    politique: 'Politica',
    economie: 'Economia',
    monde: 'Mondo',
    societe: 'Società',
    diaspora: 'Diaspora',
    culture: 'Cultura',
    sports: 'Sport',
    opinion: 'Opinioni',
  },
  en: {
    armenie: 'Armenia',
    politique: 'Politics',
    economie: 'Economy',
    monde: 'World',
    societe: 'Society',
    diaspora: 'Diaspora',
    culture: 'Culture',
    sports: 'Sports',
    opinion: 'Opinion',
  },
  hy: {
    armenie: 'Հայաստան',
    politique: 'Քաղաքականություն',
    economie: 'Տնտեսություն',
    monde: 'Աշխարհ',
    societe: 'Հասարակություն',
    diaspora: 'Սփյուռք',
    culture: 'Մշակույթ',
    sports: 'Սպորտ',
    opinion: 'Կարծիք',
  },
  ru: {
    armenie: 'Армения',
    politique: 'Политика',
    economie: 'Экономика',
    monde: 'Мир',
    societe: 'Общество',
    diaspora: 'Диаспора',
    culture: 'Культура',
    sports: 'Спорт',
    opinion: 'Мнение',
  },
}

export const rubricStrings = (lang) =>
  Object.fromEntries(Object.entries(RUBRIC_LABELS[lang]).map(([k, v]) => [`rubric.${k}`, v]))
