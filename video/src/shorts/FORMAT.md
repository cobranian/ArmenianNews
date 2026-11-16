# Format d'un Short : `src/shorts/data/<slug>.json`

Un fichier par article Culture d'ArmenianNews
(`../ArmenianNews/src/data/culture/<slug>/{fr,en,hy,ru,de,it,es}.md`).

`hy` et `ru` (chaîne Armenia News) : mêmes 7 faits que fr/en, traduits avec les
noms et termes de `hy.md` / `ru.md` ; `ytTitle` et `ytLead` viennent de
`out/youtube/translations.json`. Arménien en orthographe réformée, point final « ։ ».
Rendu : `npx remotion render Hy-<slug> out/hy/<slug>.mp4 --crf=30` (idem `Ru-`).

`de` et `it` (chaîne Arménie Info, lien `armenieinfo.ch/de/kultur`, `/it/cultura`)
et `es` (chaîne Armenia News, lien `armenianews.org/es/cultura`) : mêmes 7 faits
que fr/en, traduits avec les noms et termes de `de.md` / `it.md` / `es.md`. Pour
de/it, `ytTitle` et `ytLead` viennent de `out/youtube/translations.json` (titre
sans le hashtag final, premier paragraphe de la description) ; pour es, ils sont
traduits du fr/en. Allemand suisse : « ss », jamais « ß » (comme les articles).
Polices latines de la marque (Fraunces / Hanken / Space Mono couvrent ä ö ü à è
é ì ò ù á í ó ú ñ ¿ ¡ « »). Rendu : `npx remotion render De-<slug> out/de/<slug>.mp4 --crf=30`
(idem `It-`, `Es-`).

```json
{
  "slug": "duduk",
  "fr": {
    "facts": [
      { "eyebrow": "Arménie · 1 500 ans", "title": "Le duduk", "text": "…", "big": false },
      … 7 faits exactement …
    ],
    "outroTitle": "Le duduk",
    "ytTitle": "…",
    "ytLead": "…"
  },
  "en": { … même forme, à partir de en.md … }
}
```

## Règles, toutes obligatoires

1. **Aucun fait qui ne soit pas dans l'article publié** de la même langue (`fr.md`
   pour `fr`, `en.md` pour `en`). Pas de connaissance extérieure, pas d'arrondi
   qui change le sens, pas de superlatif que l'article n'emploie pas. Chiffres et
   dates recopiés tels quels. En cas de doute sur un fait : on ne le met pas.
2. **7 faits exactement.** Le premier est le crochet : le fait le plus frappant
   de l'article, compréhensible sans contexte, avec le nom du sujet en `title`.
   Ensuite, un ordre qui raconte (souvent chronologique). Le dernier ferme
   l'histoire (héritage, reconnaissance, ce qui reste aujourd'hui).
3. **Longueurs maximales** (la vidéo est lue sur un téléphone, en 6 secondes par fait) :
   - `eyebrow` ≤ 24 caractères : un repère court (« Où », « 1915 », « En chiffres »,
     « Erevan · 1937 »). Il est affiché en capitales.
   - `title` ≤ 30 caractères : le fait lui-même, en titre (« 24 colonnes ioniques »,
     « Un séisme le jette à terre »).
   - `text` ≤ 115 caractères : une phrase qui précise.
4. `big: true` seulement si `title` est une date, un chiffre ou un nombre court
   (≤ 16 caractères). Sinon `false`.
5. `outroTitle` ≤ 30 caractères : le nom du sujet (« Le duduk », « Komitas »).
6. `ytTitle` ≤ 75 caractères, **sans** hashtag ni emoji (ils sont ajoutés au
   rendu) : une accroche fidèle, qui donne envie, sans exagération.
   Ex. « Le seul temple gréco-romain encore debout de l'ex-URSS ».
7. `ytLead` : 1 ou 2 phrases (≤ 260 caractères) qui résument le sujet, pour la
   description YouTube.
8. Typographie française : espace avant `:` `;` `?` `!` en français, guillemets
   « », apostrophe droite `'` acceptée. Écrire « Ier » (pas « 1er ») pour les
   ordinaux de souverains et de siècles : le rendu le met en exposant.
9. JSON valide, UTF-8.
