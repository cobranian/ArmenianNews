// Les chaînes de la section Culture, par langue.
//
// Module JS PLAT, lu par Node (culture-pages.mjs, site-meta.mjs, not-found.mjs)
// ET par le bundle (Nav.jsx, Footer.jsx, CultureTeaser.jsx) — même raison que
// src/briefStrings.js. Les textes hy et ru sont à faire relire une fois par un
// lecteur de la langue (voir la spec).
export const CULTURE_STRINGS = {
  fr: {
    nav: 'Culture',
    title: 'Culture arménienne',
    description:
      'Histoire, musique, danse et patrimoine arméniens : des articles de fond, sourcés, en six langues.',
    sources: 'Sources',
    sourcesNote: 'Textes de Wikipédia (CC BY-SA 4.0) et de Wikisource (CC BY-SA 3.0), utilisés comme sources.',
    aiNote:
      'Article rédigé avec un outil d’IA à partir des sources citées, puis vérifié et corrigé par la rédaction.',
    image: 'Image',
    video: 'En vidéo',
    event: 'À ne pas manquer',
    empty: 'Le premier article paraîtra bientôt.',
    teaser: 'À lire',
    all: 'Tous les articles',
    readAlso: 'À lire aussi',
    prev: 'Article précédent',
    next: 'Article suivant',
    read: 'Lire l’article',
    carousel: 'Articles Culture',
    // Titre du sommaire sous le carrousel : TOUS les articles de la langue.
    index: 'Tous les sujets',
    // Mention portée sous le titre d'une traduction que personne ne relit
    // (de, it). Vide ailleurs : la page ne l'affiche pas.
    translatedFrom: '',
  },
  // de et it : « en plusieurs langues » plutôt qu'un nombre, qui ne serait vrai
  // qu'une fois toutes les traductions publiées.
  de: {
    nav: 'Kultur',
    title: 'Armenische Kultur',
    description:
      'Armenische Geschichte, Musik, Tanz und Kulturerbe: fundierte Artikel mit Quellenangaben, in mehreren Sprachen.',
    sources: 'Quellen',
    sourcesNote: 'Texte aus Wikipedia (CC BY-SA 4.0) und Wikisource (CC BY-SA 3.0), als Quellen verwendet.',
    aiNote:
      'Mit einem KI-Werkzeug aus den genannten Quellen verfasst und von der Redaktion geprüft; automatisch aus dem geprüften französischen Text übersetzt.',
    image: 'Bild',
    video: 'Im Video',
    event: 'Nicht verpassen',
    empty: 'Der erste Artikel erscheint in Kürze.',
    teaser: 'Lesenswert',
    all: 'Alle Artikel',
    readAlso: 'Ebenfalls lesenswert',
    prev: 'Vorheriger Artikel',
    next: 'Nächster Artikel',
    read: 'Artikel lesen',
    carousel: 'Kulturartikel',
    // Titre du sommaire sous le carrousel : TOUS les articles de la langue.
    index: 'Alle Themen',
    translatedFrom: 'Aus dem Französischen übersetzt',
  },
  it: {
    nav: 'Cultura',
    title: 'Cultura armena',
    description:
      'Storia, musica, danza e patrimonio armeni: articoli di approfondimento, con le loro fonti, in più lingue.',
    sources: 'Fonti',
    sourcesNote: 'Testi di Wikipedia (CC BY-SA 4.0) e di Wikisource (CC BY-SA 3.0), utilizzati come fonti.',
    aiNote:
      'Scritto con uno strumento di IA a partire dalle fonti citate e verificato dalla redazione; tradotto automaticamente dal testo francese verificato.',
    image: 'Immagine',
    video: 'In video',
    event: 'Da non perdere',
    empty: 'Il primo articolo uscirà a breve.',
    teaser: 'Da leggere',
    all: 'Tutti gli articoli',
    readAlso: 'Leggi anche',
    prev: 'Articolo precedente',
    next: 'Articolo successivo',
    read: 'Leggi l’articolo',
    carousel: 'Articoli di cultura',
    // Titre du sommaire sous le carrousel : TOUS les articles de la langue.
    index: 'Tutti i temi',
    translatedFrom: 'Tradotto dal francese',
  },
  en: {
    nav: 'Culture',
    title: 'Armenian culture',
    description:
      'Armenian history, music, dance and heritage: in-depth, sourced articles in six languages.',
    sources: 'Sources',
    sourcesNote: 'Texts from Wikipedia (CC BY-SA 4.0) and Wikisource (CC BY-SA 3.0), used as sources.',
    aiNote:
      'Written with an AI tool from the sources cited and checked by our editors; translated automatically from the reviewed French text.',
    image: 'Image',
    video: 'Watch the video',
    event: 'Don’t miss',
    empty: 'The first article is coming soon.',
    teaser: 'Read',
    all: 'All articles',
    readAlso: 'Read next',
    prev: 'Previous article',
    next: 'Next article',
    read: 'Read the article',
    carousel: 'Culture articles',
    // Titre du sommaire sous le carrousel : TOUS les articles de la langue.
    index: 'All topics',
    translatedFrom: '',
  },
  hy: {
    nav: 'Մշակույթ',
    title: 'Հայկական մշակույթ',
    description:
      'Հայոց պատմություն, երաժշտություն, պար և ժառանգություն․ աղբյուրներով հոդվածներ՝ վեց լեզվով։',
    sources: 'Աղբյուրներ',
    sourcesNote: 'Վիքիպեդիայի (CC BY-SA 4.0) և Վիքիդարանի (CC BY-SA 3.0) տեքստերը՝ օգտագործված որպես աղբյուր։',
    aiNote:
      'Հոդվածը գրվել է արհեստական բանականության գործիքով՝ նշված աղբյուրներից, ստուգվել է խմբագրության կողմից և ավտոմատ թարգմանվել ֆրանսերենից։',
    image: 'Պատկեր',
    video: 'Տեսանյութ',
    event: 'Չբաց թողնեք',
    empty: 'Առաջին հոդվածը շուտով կհրապարակվի։',
    teaser: 'Կարդալու',
    all: 'Բոլոր հոդվածները',
    readAlso: 'Կարդացեք նաև',
    prev: 'Նախորդ հոդվածը',
    next: 'Հաջորդ հոդվածը',
    read: 'Կարդալ հոդվածը',
    carousel: 'Մշակույթի հոդվածներ',
    // Titre du sommaire sous le carrousel : TOUS les articles de la langue.
    index: 'Բոլոր թեմաները',
    translatedFrom: '',
  },
  ru: {
    nav: 'Культура',
    title: 'Армянская культура',
    description:
      'История, музыка, танец и наследие Армении: подробные статьи с источниками на шести языках.',
    sources: 'Источники',
    sourcesNote: 'Тексты Википедии (CC BY-SA 4.0) и Викитеки (CC BY-SA 3.0), использованные как источники.',
    aiNote:
      'Статья написана с помощью инструмента ИИ по указанным источникам, проверена редакцией и автоматически переведена с французского.',
    image: 'Изображение',
    video: 'Видео',
    event: 'Не пропустите',
    empty: 'Первая статья скоро появится.',
    teaser: 'Читать',
    all: 'Все статьи',
    readAlso: 'Читайте также',
    prev: 'Предыдущая статья',
    next: 'Следующая статья',
    read: 'Читать статью',
    carousel: 'Статьи о культуре',
    // Titre du sommaire sous le carrousel : TOUS les articles de la langue.
    index: 'Все темы',
    translatedFrom: '',
  },
}
