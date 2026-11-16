// La charte du site (src/styles/global.css d'ArmenianNews) : basalte et abricot,
// Fraunces pour les titres, Hanken Grotesk pour le texte, Space Mono pour les
// surtitres. Les polices sont celles que le site auto-héberge (public/fonts/).
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const C = {
  basalt: "#100f0d",
  basalt2: "#16140f",
  apricot: "#f2a93b",
  apricotBright: "#ffc869",
  apricotDeep: "#c97d1e",
  cream: "#f1e8d4",
  muted: "rgba(241, 232, 212, 0.62)",
};

// Les familles de tête ne couvrent ni l'arménien ni le cyrillique. Comme sur
// le site (--font-display / --font-body / --font-mono de global.css), chaque
// rôle est une PILE : la police de la marque d'abord (le latin, chiffres et
// ponctuation compris, ne change donc pas), puis la compagne arménienne, puis
// la cyrillique. Mêmes familles que le site, mêmes fichiers (sous-ensembles
// « armenian » et « cyrillic » — PAS « cyrillic-ext », qui n'a pas les
// lettres russes), copiés depuis ArmenianNews/public/fonts/.
const FAMILY = {
  serif: "Fraunces",
  sans: "Hanken Grotesk",
  mono: "Space Mono",
  serifHy: "Noto Serif Armenian",
  sansHy: "Noto Sans Armenian",
  serifRu: "Literata",
  sansRu: "Golos Text",
  monoRu: "IBM Plex Mono",
};

export const F = {
  serif: `"${FAMILY.serif}", "${FAMILY.serifHy}", "${FAMILY.serifRu}", serif`,
  sans: `"${FAMILY.sans}", "${FAMILY.sansHy}", "${FAMILY.sansRu}", sans-serif`,
  // Aucune monospace arménienne n'existe : le site prend Noto Sans Armenian.
  mono: `"${FAMILY.mono}", "${FAMILY.sansHy}", "${FAMILY.monoRu}", monospace`,
};

const ARMENIAN = "U+0308, U+0530-058F, U+2010, U+2024, U+25CC, U+FB13-FB17";
const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";

// loadFont() tient un delayRender jusqu'au chargement : aucune image n'est
// rendue en police de secours.
await Promise.all([
  loadFont({ family: FAMILY.serif, url: staticFile("fonts/fraunces.woff2"), weight: "400 900" }),
  loadFont({ family: FAMILY.serif, url: staticFile("fonts/fraunces-italic.woff2"), style: "italic", weight: "400 600" }),
  loadFont({ family: FAMILY.sans, url: staticFile("fonts/hanken.woff2"), weight: "400 700" }),
  loadFont({ family: FAMILY.mono, url: staticFile("fonts/space-mono.woff2"), weight: "400" }),
  loadFont({ family: FAMILY.mono, url: staticFile("fonts/space-mono-bold.woff2"), weight: "700" }),
  loadFont({ family: FAMILY.serifHy, url: staticFile("fonts/noto-serif-armenian.woff2"), weight: "400 700", unicodeRange: ARMENIAN }),
  loadFont({ family: FAMILY.sansHy, url: staticFile("fonts/noto-sans-armenian.woff2"), weight: "400 700", unicodeRange: ARMENIAN }),
  loadFont({ family: FAMILY.serifRu, url: staticFile("fonts/literata-cyrillic.woff2"), weight: "400 700", unicodeRange: CYRILLIC }),
  loadFont({ family: FAMILY.sansRu, url: staticFile("fonts/golos-text-cyrillic.woff2"), weight: "400 700", unicodeRange: CYRILLIC }),
  loadFont({ family: FAMILY.monoRu, url: staticFile("fonts/ibm-plex-mono-cyrillic.woff2"), weight: "400", unicodeRange: CYRILLIC }),
  loadFont({ family: FAMILY.monoRu, url: staticFile("fonts/ibm-plex-mono-bold-cyrillic.woff2"), weight: "700", unicodeRange: CYRILLIC }),
]);

// Les deux sommets de l'Ararat, comme favicon.svg : Masis (le plus haut) à
// DROITE, vue depuis l'Arménie — ne pas inverser.
export const Ararat: React.FC<{ size: number; bg?: boolean }> = ({ size, bg = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    {bg ? <rect width="64" height="64" rx="13" fill={C.basalt} /> : null}
    <path d="M3 51 L20.5 19 L30 30.5 L40.5 12 L61 51 Z" fill={C.apricot} />
    <path d="M40.5 12 L35.2 21.5 L42.4 23.6 L37.2 28.8 L30 30.5 Z" fill={C.basalt} opacity="0.32" />
    <path d="M20.5 19 L17.4 25 L22.6 26.2 L18.4 30 Z" fill={C.basalt} opacity="0.32" />
    <rect x="3" y="53.6" width="58" height="2.8" rx="1.4" fill={C.apricotDeep} />
  </svg>
);
