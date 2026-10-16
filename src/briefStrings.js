// Les chaînes de la brève quotidienne, par langue.
//
// Module JS PLAT, lu par Node (scripts/lib/brief-pages.mjs, not-found.mjs) ET
// par le bundle (Nav.jsx, Footer.jsx). `brand` est la marque VISIBLE de la
// langue — « Արմենիա Ինֆո » sous hy, comme STRINGS.hy['site.title'] d'i18n.jsx
// (voir CLAUDE.md : la marque arménienne s'écarte du domaine) ;
// test/brief-strings.test.mjs garde les deux égales.
export const BRIEF_STRINGS = {
  fr: {
    title: 'La brève du jour',
    nav: 'Brève',
    brand: 'Arménie Info',
    description:
      'Chaque matin, les sujets du jour croisés entre les rédactions arméniennes, avec les liens vers leurs articles.',
    latest: 'Dernière brève',
    archive: 'Archives',
    sources: 'Sources',
    previous: '← Veille',
    next: 'Lendemain →',
    disclaimer: 'Synthèse automatique des titres du jour — lisez les articles d’origine.',
    empty: 'La première brève paraîtra demain matin.',
    home: 'Accueil',
    radio: 'En direct',
    agenda: 'Agenda',
  },
  en: {
    title: 'The daily brief',
    nav: 'Brief',
    brand: 'Armenia News',
    description:
      'Every morning, the day’s stories cross-checked across Armenian newsrooms, with links to their articles.',
    latest: 'Latest brief',
    archive: 'Archive',
    sources: 'Sources',
    previous: '← Previous day',
    next: 'Next day →',
    disclaimer: 'Automated summary of the day’s headlines — read the original articles.',
    empty: 'The first brief will appear tomorrow morning.',
    home: 'Home',
    radio: 'Live',
    agenda: 'Events',
  },
  hy: {
    title: 'Օրվա ամփոփում',
    nav: 'Ամփոփում',
    brand: 'Արմենիա Ինֆո',
    description:
      'Ամեն առավոտ՝ օրվա թեմաները հայկական խմբագրությունների համադրությամբ, նրանց հոդվածների հղումներով։',
    latest: 'Վերջին ամփոփումը',
    archive: 'Արխիվ',
    sources: 'Աղբյուրներ',
    previous: '← Նախորդ օր',
    next: 'Հաջորդ օր →',
    disclaimer: 'Օրվա վերնագրերի ավտոմատ ամփոփում․ կարդացեք բնօրինակ հոդվածները։',
    empty: 'Առաջին ամփոփումը կհրապարակվի վաղը առավոտյան։',
    home: 'Գլխավոր էջ',
    radio: 'Ուղիղ',
    agenda: 'Միջոցառումներ',
  },
  ru: {
    title: 'Сводка дня',
    nav: 'Сводка',
    brand: 'Armenia News',
    description:
      'Каждое утро — главные темы дня по материалам армянских редакций, со ссылками на их статьи.',
    latest: 'Последняя сводка',
    archive: 'Архив',
    sources: 'Источники',
    previous: '← Предыдущий день',
    next: 'Следующий день →',
    disclaimer: 'Автоматическая сводка заголовков дня — читайте оригинальные статьи.',
    empty: 'Первая сводка появится завтра утром.',
    home: 'Главная',
    radio: 'В эфире',
    agenda: 'Афиша',
  },
}
