// Le texte de la vidéo Garni. CHAQUE fait vient de l'article publié
// (ArmenianNews/src/data/culture/temple-paien-de-garni/{fr,en,hy,ru,de,it,es}.md), lui-même
// sourcé sur Wikipédia : rien n'est ajouté ici qui n'y soit pas.
//
// `focus` cadre la photo (object-position) : chaque scène montre une autre
// partie du temple, pour qu'une seule image ne paraisse pas figée.

export type Lang = "fr" | "en" | "hy" | "ru" | "de" | "it" | "es";

export type Fact = {
  eyebrow: string;
  title: string;
  text: string;
  focus?: string;
  big?: boolean; // titre en très grand (une date, un chiffre)
};

export type Copy = {
  brand: string;
  section: string;
  facts: Fact[];
  outro: { kicker: string; title: string; url: string };
  credit: string;
  // La langue règle l'approche et l'interlignage des titres (Scenes.tsx).
  lang?: Lang;
  // Facultatifs : Garni garde ses valeurs d'origine (garni.jpg, planche 4:3).
  photo?: string;
  plate?: number;
};

const CREDIT_FR = "Photo : Katsiaryna Naliuka · CC BY-SA 4.0 · Wikimedia Commons";
const CREDIT_EN = "Photo: Katsiaryna Naliuka · CC BY-SA 4.0 · Wikimedia Commons";
const CREDIT_HY = "Լուսանկարը՝ Katsiaryna Naliuka · CC BY-SA 4.0 · Wikimedia Commons";
const CREDIT_RU = "Фото: Katsiaryna Naliuka · CC BY-SA 4.0 · Wikimedia Commons";
// de, it et es : même mot « Foto: ».
const CREDIT_FOTO = "Foto: Katsiaryna Naliuka · CC BY-SA 4.0 · Wikimedia Commons";

export const COPY: Record<Lang, Copy> = {
  fr: {
    brand: "Arménie Info",
    section: "Culture",
    facts: [
      {
        eyebrow: "Arménie · Ier siècle",
        title: "Le temple de Garni",
        text: "Le seul temple hellénistique à colonnade encore debout dans tout l'ancien espace soviétique.",
        focus: "50% 45%",
      },
      {
        eyebrow: "Où",
        title: "À 30 km d'Erevan",
        text: "Sur un promontoire à 1 400 mètres, au-dessus des gorges de l'Azat.",
        focus: "20% 60%",
      },
      {
        eyebrow: "Quand",
        title: "76–77 apr. J.-C.",
        text: "Bâti par le roi Tiridate Ier, couronné à Rome par Néron.",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "Pour qui",
        title: "Mihr, le dieu soleil",
        text: "« Hélios ! » : ainsi s'ouvre l'inscription grecque retrouvée sur place en 1945.",
        focus: "50% 25%",
      },
      {
        eyebrow: "En chiffres",
        title: "24 colonnes ioniques",
        text: "6,54 m chacune, en basalte. Dans le décor gréco-romain : grenades, raisins, feuilles de noisetier.",
        focus: "35% 50%",
        big: true,
      },
      {
        eyebrow: "1679",
        title: "Un séisme le jette à terre",
        text: "Pendant près de trois siècles, ses pierres restent éparpillées sur le promontoire.",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Remonté pierre par pierre",
        text: "Chaque bloc d'origine reprend sa place exacte : c'est l'anastylose.",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "L'histoire complète", title: "Le temple de Garni", url: "armenieinfo.ch/culture" },
    credit: CREDIT_FR,
  },
  en: {
    brand: "Armenia News",
    section: "Culture",
    facts: [
      {
        eyebrow: "Armenia · 1st century",
        title: "Garni Temple",
        text: "The only colonnaded Hellenistic temple still standing in the whole former Soviet space.",
        focus: "50% 45%",
      },
      {
        eyebrow: "Where",
        title: "30 km from Yerevan",
        text: "On a promontory at 1,400 metres, above the gorge of the Azat river.",
        focus: "20% 60%",
      },
      {
        eyebrow: "When",
        title: "AD 76–77",
        text: "Built by King Tiridates I, crowned in Rome by Nero.",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "For whom",
        title: "Mihr, the sun god",
        text: "“Helios!” — so opens the Greek inscription found on the site in 1945.",
        focus: "50% 25%",
      },
      {
        eyebrow: "In numbers",
        title: "24 Ionic columns",
        text: "6.54 m each, in basalt. Among the Greco-Roman ornament: pomegranates, grapes, hazel leaves.",
        focus: "35% 50%",
        big: true,
      },
      {
        eyebrow: "1679",
        title: "An earthquake brings it down",
        text: "For nearly three centuries, its stones lie scattered across the promontory.",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Rebuilt stone by stone",
        text: "Every original block returns to its exact place: a method called anastylosis.",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "The full story", title: "Garni Temple", url: "armenianews.org/culture" },
    credit: CREDIT_EN,
  },
  hy: {
    brand: "Արմենիա Ինֆո",
    section: "Մշակույթ",
    lang: "hy",
    facts: [
      {
        eyebrow: "Հայաստան · I դար",
        title: "Գառնիի տաճարը",
        text: "Ողջ նախկին խորհրդային տարածքում պահպանված միակ սյունազարդ հելլենիստական տաճարը։",
        focus: "50% 45%",
      },
      {
        eyebrow: "Որտեղ",
        title: "Երևանից 30 կմ",
        text: "1400 մետր բարձրությամբ հրվանդանի վրա, Ազատ գետի կիրճի վերևում։",
        focus: "20% 60%",
      },
      {
        eyebrow: "Երբ",
        title: "Մ.թ. 76–77",
        text: "Կառուցել է Տրդատ Ա արքան, ում Հռոմում թագադրել էր Ներոնը։",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "Ում համար",
        title: "Միհր՝ արևի աստվածը",
        text: "Այսպես է սկսվում 1945 թ. տեղում գտնված հունարեն արձանագրությունը՝ «Հելիո՛ս»։",
        focus: "50% 25%",
      },
      {
        eyebrow: "Թվերով",
        title: "24 հոնիական սյուն",
        text: "Յուրաքանչյուրը 6,54 մ, բազալտից։ Հունահռոմեական զարդերում՝ նուռ, խաղող, պնդուկենու տերևներ։",
        focus: "35% 50%",
        big: true,
      },
      {
        eyebrow: "1679",
        title: "Երկրաշարժը տապալում է այն",
        text: "Դարեր շարունակ նրա քարերը մնում են ցրված հրվանդանի վրա։",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Վերականգնված քար առ քար",
        text: "Յուրաքանչյուր բնօրինակ տարր վերադառնում է իր ճշգրիտ տեղը՝ անաստիլոզի սկզբունքով։",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "Ամբողջական պատմությունը", title: "Գառնիի տաճարը", url: "armenianews.org/hy/culture" },
    credit: CREDIT_HY,
  },
  ru: {
    brand: "Armenia News",
    section: "Культура",
    lang: "ru",
    facts: [
      {
        eyebrow: "Армения · I век",
        title: "Храм в Гарни",
        text: "Единственный сохранившийся на всем постсоветском пространстве эллинистический колоннадный памятник.",
        focus: "50% 45%",
      },
      {
        eyebrow: "Где",
        title: "В 30 км от Еревана",
        text: "На мысе на высоте 1400 метров, над ущельем реки Азат.",
        focus: "20% 60%",
      },
      {
        eyebrow: "Когда",
        title: "76–77 гг. н. э.",
        text: "Построен царем Трдатом I, коронованным в Риме Нероном.",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "Для кого",
        title: "Михр, бог солнца",
        text: "«Гелиос!» — так начинается греческая надпись, найденная здесь в 1945 году.",
        focus: "50% 25%",
      },
      {
        eyebrow: "В цифрах",
        title: "24 ионические колонны",
        text: "По 6,54 м, из базальта. В греко-римском декоре — гранаты, виноград, листья орешника.",
        focus: "35% 50%",
        big: true,
      },
      {
        eyebrow: "1679",
        title: "Землетрясение рушит храм",
        text: "На протяжении столетий его камни лежат разбросанными по мысу.",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Восстановлен камень за камнем",
        text: "Каждый подлинный блок возвращается на свое точное место: это анастилоз.",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "Вся история", title: "Храм в Гарни", url: "armenianews.org/ru/culture" },
    credit: CREDIT_RU,
  },
  de: {
    brand: "Arménie Info",
    section: "Kultur",
    lang: "de",
    facts: [
      {
        eyebrow: "Armenien · 1. Jh.",
        title: "Der Tempel von Garni",
        text: "Das einzige erhaltene hellenistische Kolonnadenmonument im gesamten ehemaligen sowjetischen Raum.",
        focus: "50% 45%",
      },
      {
        eyebrow: "Wo",
        title: "28 bis 30 km von Eriwan",
        text: "Auf einem Felsvorsprung in 1400 Metern Höhe, über den Schluchten des Flusses Asat.",
        focus: "20% 60%",
      },
      {
        eyebrow: "Wann",
        title: "76–77 n. Chr.",
        text: "Erbaut von König Tiridates I., der in Rom von Nero gekrönt wurde.",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "Für wen",
        title: "Mihr, der Sonnengott",
        text: "«Helios!»: So beginnt die griechische Inschrift, die 1945 vor Ort entdeckt wurde.",
        focus: "50% 25%",
      },
      {
        eyebrow: "In Zahlen",
        title: "24 ionische Säulen",
        text: "Je 6,54 m hoch, aus Basalt. Im griechisch-römischen Dekor: Granatäpfel, Weintrauben, Haselnussblätter.",
        focus: "35% 50%",
      },
      {
        eyebrow: "1679",
        title: "Ein Beben bringt ihn zu Fall",
        text: "Über Jahrhunderte liegen seine Säulentrommeln und Kapitelle auf dem Felsvorsprung verstreut.",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Stein um Stein neu errichtet",
        text: "Jedes Originalelement kehrt an seinen genauen Platz zurück: Das ist die Anastilosis.",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "Die ganze Geschichte", title: "Der Tempel von Garni", url: "armenieinfo.ch/de/kultur" },
    credit: CREDIT_FOTO,
  },
  it: {
    brand: "Arménie Info",
    section: "Cultura",
    lang: "it",
    facts: [
      {
        eyebrow: "Armenia · I secolo",
        title: "Il Tempio di Garni",
        text: "L'unico monumento ellenistico colonnato conservato nell'intero ex spazio sovietico.",
        focus: "50% 45%",
      },
      {
        eyebrow: "Dove",
        title: "A circa 28-30 km da Erevan",
        text: "Su un promontorio a 1 400 metri, sopra le gole del fiume Azat.",
        focus: "20% 60%",
      },
      {
        eyebrow: "Quando",
        title: "76–77 d.C.",
        text: "Costruito dal re Tiridate I, incoronato a Roma da Nerone.",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "Per chi",
        title: "Mihr, il dio solare",
        text: "«Helios!»: così si apre l'iscrizione greca scoperta sul posto nel 1945.",
        focus: "50% 25%",
      },
      {
        eyebrow: "In cifre",
        title: "24 colonne ioniche",
        text: "Di 6,54 m ciascuna, in basalto. Nel decoro greco-romano: melagrane, grappoli d'uva, foglie di nocciolo.",
        focus: "35% 50%",
      },
      {
        eyebrow: "1679",
        title: "Un terremoto lo abbatte",
        text: "Per secoli, le sue pietre restano sparse sul promontorio.",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Ricostruito pietra su pietra",
        text: "Ogni elemento originale ritorna nella sua sede precisa: è l'anastilosi.",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "La storia completa", title: "Il Tempio di Garni", url: "armenieinfo.ch/it/cultura" },
    credit: CREDIT_FOTO,
  },
  es: {
    brand: "Armenia News",
    section: "Cultura",
    lang: "es",
    facts: [
      {
        eyebrow: "Armenia · siglo I",
        title: "El Templo de Garni",
        text: "El único templo helenístico de columnata aún en pie en todo el antiguo espacio soviético.",
        focus: "50% 45%",
      },
      {
        eyebrow: "Dónde",
        title: "A 30 km de Ereván",
        text: "Sobre un promontorio a 1400 metros, encima del cañón del río Azat.",
        focus: "20% 60%",
      },
      {
        eyebrow: "Cuándo",
        title: "76–77 d. C.",
        text: "Construido por el rey Tiridates I, coronado en Roma por Nerón.",
        focus: "70% 40%",
        big: true,
      },
      {
        eyebrow: "Para quién",
        title: "Mihr, el dios solar",
        text: "«¡Helios!»: así comienza la inscripción griega descubierta en el lugar en 1945.",
        focus: "50% 25%",
      },
      {
        eyebrow: "En cifras",
        title: "24 columnas jónicas",
        text: "De 6,54 m cada una, en basalto. En el decorado grecorromano: granadas, uvas, hojas de avellano.",
        focus: "35% 50%",
        big: true,
      },
      {
        eyebrow: "1679",
        title: "Un terremoto lo derriba",
        text: "Durante siglos, sus piedras permanecen dispersas por el promontorio.",
        focus: "80% 70%",
      },
      {
        eyebrow: "1969–1975",
        title: "Reconstruido piedra a piedra",
        text: "Cada bloque original vuelve a su lugar exacto: es la anastilosis.",
        focus: "50% 50%",
      },
    ],
    outro: { kicker: "La historia completa", title: "El Templo de Garni", url: "armenianews.org/es/cultura" },
    credit: CREDIT_FOTO,
  },
};
