# Une vidéo promo pour les statuts WhatsApp

**Date** : 23 août 2026
**Statut** : conception validée, implémentation à venir
**Livrable** : un fichier MP4 vertical de 28 s, plus le projet Remotion qui le
régénère.

## Ce qu'on fabrique, et pour qui

Un **statut WhatsApp** — 9:16, 1080×1920, **28 secondes**, **muet**, en
**français**, qui envoie sur **armenieinfo.ch**.

Chacune de ces contraintes a été choisie, pas subie :

- **28 s et non 30.** WhatsApp découpe un statut au-delà de trente secondes, et
  la chute — l'adresse du site — est le seul plan dont la perte annulerait la
  vidéo entière. Deux secondes de marge coûtent moins qu'un segment tronqué.
- **Muet, sans bande-son du tout.** Un statut se regarde en muet ; la vidéo est
  donc conçue pour se passer de son. Lui en ajouter un ne servirait que le
  lecteur qui déverrouille le son par réflexe, au prix d'une question de droits
  (une piste tierce, ou l'extrait d'une des quinze radios — ce sont des œuvres
  et des programmes qu'on ne rediffuse pas parce qu'on en lie le flux).
- **Français, `.ch`.** Le statut est posté depuis un compte personnel : ce sont
  des contacts francophones qui le verront. Le `.org` a davantage besoin de
  trafic, mais une vidéo en anglais servie à la diaspora suisse convertirait
  moins bien qu'elle ne servirait le domaine.

Le projet est **paramétré par langue dès le départ** (voir « Interface d'édition »
plus bas) : une version anglaise pour le `.org` reste possible plus tard sans
refonte, mais elle **n'est pas dans ce lot**.

> **Amendement du 23 août 2026 — cette phrase n'a pas été tenue.** Le plan
> d'implémentation, écrit à partir de cette spec, n'a jamais prévu de prop de
> langue : il fige un schéma Zod à quatre clés (`montrerZones`, `promesse`,
> `adresse`, `signature`) et le français est écrit en dur dans quatre scènes —
> `Langues.tsx` (les quatre phrases et leurs pastilles), `Fil.tsx` (la table des
> mois, « Instantané du », « rédactions ») et `RadioAgenda.tsx` (« radios en
> direct », « événements, pays »). Une version anglaise demanderait donc bien
> une refonte de ces quatre fichiers. C'est la spec qui a promis, et le plan qui
> a lâché ; la revue finale de branche l'a relevé. La phrase reste ici pour
> mémoire, corrigée par cet encadré plutôt que réécrite — une spec qu'on
> retouche après coup cesse de dire ce qu'on croyait au moment de décider.

## La promesse, et pourquoi c'est celle-là

**« Toute la vie arménienne sur une page, refaite chaque heure. »**

Ce n'est pas une phrase inventée pour la vidéo : c'est le texte que porte déjà
`pages/lien.ch.html`, la carte que le site donne à partager. La vidéo et la carte
de partage doivent dire la même chose, sinon le lecteur qui suit le lien ne
reconnaît pas ce qu'on lui a promis.

Le reste n'est que **preuve** : les rédactions, les radios, l'agenda, les quatre
langues. Trente secondes muettes ne portent qu'une promesse.

Trois découpages ont été comparés :

| Découpage | Retenu ? | Pourquoi |
|---|---|---|
| Promesse → preuve → adresse | **oui** | Survit au visionnage distrait : coupée à la moitié, elle a déjà promis. Seule structure qui laisse la place aux quatre langues. |
| Le fil qui défile (un seul mouvement, 28 s de manchettes) | non | Ne montre ni la radio ni l'agenda — on promettrait « toute la vie arménienne » en ne montrant que les actualités. |
| Le chapelet de chiffres (7 · 15 · 27 · 4) | non | Imparable en muet, mais un statut qui compte se retient moins qu'un statut qui montre, et ça ne ressemble à rien du site. |

## Storyboard

**1080×1920, 30 ips, 840 images.**

**Zones interdites** : 190 px en haut (barre de progression + nom du posteur),
230 px en bas (champ « Répondre »). Tout ce qui porte du sens vit dans les
1 500 px du milieu.

| Images | Temps | Scène | Contenu |
|---|---|---|---|
| 0–90 | 0 → 3 s | `Ouverture` | Basalte plein. Le tracé de l'Ararat se dessine en abricot (`stroke-dashoffset`), puis se remplit. « Arménie Info » en Fraunces italique dessous. |
| 90–240 | 3 → 8 s | `Promesse` | Le glyphe recule en haut. La phrase tombe en trois temps : *« Toute la vie arménienne » — « sur une page » — « refaite chaque heure. »* |
| 240–420 | 8 → 14 s | `Fil` | Capture réelle de l'accueil, cadrée sur les cartes, qui remonte. Pastilles : **7 rédactions**, puis **mis à jour il y a N min**. |
| 420–570 | 14 → 19 s | `RadioAgenda` | Split vertical : la page radio en haut, l'agenda en bas, chacune arrivant de son côté. Pastilles : **15 radios en direct** · **N événements, N pays**. |
| 570–690 | 19 → 23 s | `Langues` | Retour au basalte. Les quatre `site.tagline` **s'empilent** — fr, en, hy, ru — chacune avec sa pastille, toutes présentes à la fin du plan. |
| 690–840 | 23 → 28 s | `Chute` | `armenieinfo.ch` en grand, l'Ararat à côté. Sous-titre : *« Gratuit. Sans compte. Sans publicité. »* Tenu 3 s pleines — c'est le seul plan qu'on doit pouvoir photographier. |

### La scène `Langues` s'empile, elle ne défile pas

La version évidente — faire se réécrire la marque, `Arménie Info` → `Armenia
News` → `Արմենիա Ինֆո` → `Armenia News` — **se termine sur ce qui ressemble à un
bug** : le `.org` sert la même marque en anglais et en russe, seul l'arménien
s'écarte (`STRINGS.hy['site.title']`, une translittération assumée). Deux plans
identiques à la suite se lisent comme une répétition ratée, pas comme deux
langues.

Ce sont donc les quatre `site.tagline` qui paraissent, et elles **s'empilent**
au lieu de se remplacer : chacune arrive avec sa pastille, et les quatre restent
à l'écran. Trois raisons :

- Elles sont réellement différentes dans les quatre langues, marque comprise.
- **Empilées, elles ne demandent pas d'être lues.** Quatre secondes ne suffisent
  pas à lire quatre phrases de soixante signes ; mais la différence entre latin,
  arménien et cyrillique se *voit* en un instant. L'écriture est le message.
- Le plan finit sur une image dense et immobile, ce qui prépare la chute.

### Ce qui est volontairement absent

- **Le mur Instagram.** 90 tuiles de visages en deux secondes ne prouvent rien
  et posent une question de droit à l'image que le site n'a pas à rouvrir dans
  une vidéo promotionnelle.
- **Les compteurs qui s'incrémentent.** C'est le tic de la vidéo SaaS ; ici il
  ferait ressembler un journal à un tableau de bord.
- **« Nouveau », les exclamations, l'urgence.** La voix du site est celle d'un
  journal.

## Où vit le projet

Dossier **voisin** : `Claude code/armenie-info-promo/`, avec son propre dépôt
git, plus une ligne dans le `.gitignore` du parent — le précédent
d'`ArmeniensDeLausanne/` est déjà là.

**Pas dans `ArmenianNews/promo/`**, et la raison n'est pas esthétique :
`eslint.config.js` est une config plate qui ratisserait un projet TypeScript de
plus sous la même racine. Le `CLAUDE.md` fige un invariant précis — « 0 erreur,
5 avertissements connus » — et ce compte se casserait en silence. On paierait
ensuite en `ignores` pour un dossier qui n'a rien à faire dans le bundle.

```
armenie-info-promo/
  src/Root.tsx          composition PromoWhatsApp — 1080×1920, 30 ips, 840 images
  src/Promo.tsx         les six scènes en <Series>
  src/scenes/           Ouverture · Promesse · Fil · RadioAgenda · Langues · Chute
  src/theme.ts          les jetons copiés de global.css
  src/fonts.ts          chargement des woff2 + delayRender
  src/facts.json        GÉNÉRÉ — jamais édité à la main
  public/fonts/*.woff2  copiés depuis ArmenianNews/public/fonts/
  public/shots/*.png    GÉNÉRÉS
  scripts/facts.mjs     lit ../ArmenianNews, écrit src/facts.json
  scripts/shots.mjs     Puppeteer → public/shots/
```

Scaffold : `npx create-video@latest --yes --blank --no-tailwind armenie-info-promo`.

## Les chiffres ne sont écrits nulle part en dur

`scripts/facts.mjs` lit le dépôt voisin et écrit
`{ sources, stations, stationsOnAir, events, countries, generatedAt }` dans
`src/facts.json`.

Trois règles de lecture, chacune reprise d'une méthode déjà éprouvée dans
`ArmenianNews` :

- **Stations** : compte des entrées de `STATIONS` dans `src/components/Radio.jsx`
  et des `offAir: true`, **en lisant le fichier comme du texte**. C'est ce que
  fait déjà `test/radio-count.test.mjs`, parce que Node ne sait pas importer du
  JSX. Mesuré au 23 août 2026 : **15 stations, 14 en ondes**.
- **Rédactions** : longueur de `TAB_ORDER.fr` dans `src/newsSources.js` — **7**.
  Le nombre dépend de la langue, et c'est la version française qu'on annonce.
- **Agenda** : le filtre canonique du site — complet (titre, date, URL),
  dédoublonné par URL, à venir. Mesuré sur l'instantané du 22 août 07:29 UTC :
  **152 événements sur 27 pays**.

**Pourquoi générer plutôt qu'écrire.** Le `CLAUDE.md` documente qu'une mesure
prise sur `src/data/` se périme au milieu d'une séance, le robot horaire s'en
chargeant. Un chiffre faux dans une vidéo ne se corrige pas : la vidéo est déjà
partie. Relancer `facts` avant chaque rendu est le seul état sûr.

Les chiffres volatils (événements, pays, âge de l'instantané) ne paraissent que
dans les pastilles des scènes `Fil` et `RadioAgenda`. Les chiffres stables (7
rédactions, 15 radios, 4 langues) portent le discours.

## Les polices

Les fichiers du site, pas ceux de Google : on copie les sous-ensembles utiles de
`ArmenianNews/public/fonts/` (Fraunces italique et romain, Hanken Grotesk, Noto
Serif Armenian pour la ligne `Արմենիա Ինֆո`) et on les déclare via l'API
`FontFace`, enveloppés dans `delayRender()` / `continueRender()`.

**Le piège a déjà été payé une fois**, dans `scripts/og-image.mjs` : sans
attendre le chargement effectif, le rendu part en polices de secours. En latin
cela donne « une autre police » ; en arménien, des rectangles vides. Un rendu
Remotion ne prévient pas davantage qu'une capture Puppeteer.

## Les captures

`scripts/shots.mjs` ouvre **armenieinfo.ch en production**, en viewport
téléphone 430×932 `deviceScaleFactor: 3` → 1290 px de large, ce qui remplit un
cadre vertical sans agrandissement. Il réutilise `puppeteer-core` et le
`findChrome()` de `ArmenianNews/scripts/lib/chrome.mjs` plutôt que d'ajouter une
dépendance.

Trois précautions, chacune correspondant à un piège documenté :

1. **Thème nuit forcé** (`localStorage.theme`) avant chargement — sinon une
   capture de jour arriverait en papier clair au milieu d'une vidéo basalte.
2. **Défilement complet avant la capture** — le `loading="lazy"` du site rend
   sinon une page aux images vides. Le `CLAUDE.md` note que ce défaut ne se voit
   que sur une page prérendue, ce qu'est la production.
3. **Capture pleine page**, l'animation de défilement étant faite ensuite dans
   Remotion par `translateY`. Un mouvement calculé, pas filmé : parfaitement
   fluide, et re-cadrable sans re-capturer.

Trois vues à capturer : accueil, `/radio/`, `/agenda/`.

**Conséquence acceptée** : les captures portent les titres du jour. La vidéo
vieillit donc au rythme de son contenu visible, et se refait en relançant
`shots` puis `render`.

## Interface d'édition

Les textes, durées et chiffres passent par un schéma **Zod** en `defaultProps`,
pour que le Studio permette de les corriger visuellement et que la correction se
réécrive dans le code. C'est aussi ce qui rendra une version anglaise possible
sans refonte : la langue devient un prop, pas une réécriture.

> **Amendement du 23 août 2026 :** la première moitié a été tenue (le schéma Zod
> existe, le Studio édite `promesse`, `adresse` et `signature`), la seconde non —
> la langue n'est pas un prop. Voir l'encadré de la section « Ce qu'on fabrique,
> et pour qui ».

## Vérification

1. `npx remotion studio` — la revue à l'œil.
2. `npx remotion still` sur les **six images-clés**, une par scène. C'est le
   contrôle qui attrape le repli de police : sur une image fixe, l'arménien en
   rectangles se voit immédiatement ; en lecture, non.
3. Un prop `showSafeZones` qui peint les 190 px du haut et les 230 px du bas.
   On le passe une fois, on vérifie qu'aucun mot n'y entre, on l'éteint.
4. **L'Ararat : Masis à droite.** On reprend le `path` de `public/favicon.svg`
   tel quel, sans le retracer. Un tracé miroir est un SVG parfaitement valide —
   le site a porté le glyphe à l'envers jusqu'au 1er août 2026, et il a fallu un
   lecteur pour l'attraper.
5. `npx remotion render` → durée **exactement 28,0 s**, H.264, poids visé sous
   10 Mo. Premier rendu : Remotion télécharge son propre Chrome Headless Shell
   (~150 Mo), une seule fois.
6. Le test que l'outillage ne peut pas faire : poster le statut et le regarder
   sur un téléphone.

## Ce que ce lot ne fait pas

- Pas de version anglaise, arménienne ni russe — l'architecture les permet, le
  lot ne les produit pas.
- Pas de bande-son, dans aucune variante.
- Pas d'intégration à la CI : le rendu est une **étape manuelle locale**, comme
  `ig-scrape`, `fb-scrape` et `og-image`. Il a besoin d'un Chrome et du réseau,
  et rien ne justifie de le refaire toutes les heures.
- **Aucune modification du dépôt `ArmenianNews` hors ce document.** Ses polices
  et ses JSON sont *lus*, jamais réécrits. La seule autre écriture est une ligne
  ajoutée au `.gitignore` du dépôt **parent** (`armenian-songs`), qui n'est pas
  ce dépôt-ci — vérifier avec `git rev-parse --show-toplevel` avant d'y toucher,
  comme le rappelle le `CLAUDE.md`.
