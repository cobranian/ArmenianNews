# Le mur Instagram en quatre brins, et ses comptes repliés

**Date** : 2026-08-04
**Portée** : `src/data/instagram.json`, `scripts/sources/instagram.mjs`,
`scripts/scrape.mjs`, `src/components/Social.jsx`, `src/i18n.jsx`,
`src/styles/global.css`, `test/instagram-strands.test.mjs` (neuf).

## Le problème

Deux problèmes, arrivés par le même chemin : le pool a grossi sans que la
structure qui l'affiche ne bouge.

**Le mur est déséquilibré.** Mesuré sur le pool du 4 août 2026 :

| Brin | Comptes | Posts en réserve | Tuiles servies | Tuiles par compte |
|---|---|---|---|---|
| `institutions` — Mosaïque arménienne | **17** | 153 | 30 | **1,8** |
| `personnalites` — Visages arméniens | **8** | 72 | 30 | **3,8** |

Un compte de la mosaïque est deux fois moins visible qu'un visage, sans que
personne ne l'ait décidé : c'est arrivé compte après compte. Et « Mosaïque »
en est venu à désigner tout ce qui n'est pas une personne — une agence de
tourisme, une église, un collectif d'artistes, un compte de cuisine — donc le
titre ne promet plus rien de précis au lecteur.

**Le rang de pastilles est devenu un mur de texte.** Sous chaque carrousel,
`.ig-accounts` liste **tous** les comptes du brin en `◎ @handle`. À 25 comptes,
c'est 25 pastilles qui repoussent le brin suivant, sur un site où la section
réseaux est déjà la plus longue.

## La solution

**Quatre brins**, taillés dans les 25 comptes existants — aucun recrutement,
aucune récolte préalable :

| Brin (clé `group`) | Comptes | Réserve | Servi | Renouvellement |
|---|---|---|---|---|
| `institutions` | 10 | 90 | 18 | 20 % |
| `personnalites` | 6 | 54 | 18 | 33 % |
| `creation` *(neuf)* | 5 | 45 | 18 | 40 % |
| `terre` *(neuf)* | 4 | 36 | 18 | 50 % |

- `terre` ← `explorearmenia`, `unexplored_armenia`, `armenia.travel`, `ig_armenia`
- `creation` ← `armeniancreators`, `armenian_women_artists`,
  `margarit.armeniandance` (venus de `institutions`), `haykmiqayelyanart`,
  `abgarart` (venus de `personnalites`)

**Les deux clés existantes ne sont PAS renommées.** `institutions` décrit moins
bien son brin qu'avant, et c'est un prix accepté : `acc.group || 'institutions'`
est le repli écrit à la fois dans `scripts/sources/instagram.mjs` et dans
`Social.jsx`. Renommer la clé sans toucher les deux replis ferait basculer tout
compte non étiqueté vers un brin qui n'existe plus — un compte qui disparaît du
site, sans erreur.

**18 tuiles par brin** au lieu de 30 : 72 au total, contre 60 aujourd'hui. Le mur
grossit de 20 % pour deux brins de plus, et chaque brin puise moins profond dans
sa réserve, donc tourne mieux qu'avant.

## Les titres : un seul moule

Les deux titres actuels partagent une construction — « Mosaïque arménienne »,
« Visages arméniens ». Les deux nouveaux la reprennent, pour que le mur se lise
comme une famille de quatre et non comme deux brins plus deux ajouts.

| Clé i18n | fr | en | hy | ru |
|---|---|---|---|---|
| `ig.strand` | Mosaïque arménienne | Armenian mosaic | Հայկական խճանկար | Армянская мозаика |
| `ig.strand.people` | Visages arméniens | Armenian faces | Հայկական դեմքեր | Армянские лица |
| `ig.strand.land` | Terres arméniennes | Armenian lands | Հայկական բնաշխարհ | Армянские просторы |
| `ig.strand.studio` | Ateliers arméniens | Armenian studios | Հայկական արվեստանոցներ | Армянские мастерские |

Les deux clés existantes gardent leur nom, y compris `ig.strand` tout court pour
la mosaïque : renommer une clé i18n ne change rien à l'affichage tant que les
quatre blocs suivent, mais fait diverger les quatre `STRINGS` le jour où l'un
est oublié — pour un gain nul.

`բնաշխարհ` (le pays comme paysage) et `просторы` (les étendues) sont préférés à
une traduction littérale de « terre », qui dirait le sol et non le voyage.

## Les pastilles : un repli par brin

```
REPLIÉ (l'état par défaut)          DÉPLIÉ
 ╭────────────────────────╮          ╭────────────────────────────────────╮
 │  ⌄ Les 10 comptes      │          │  ⌃ Masquer les comptes             │
 │       suivis           │          │  ◎ @armenianinstitute              │
 ╰────────────────────────╯          │  ◎ @eglise.armenienne.geneve       │
                                     │  ◎ @theusarmenians  ◎ @repatarmenia│
                                     ╰────────────────────────────────────╯
```

C'est le motif que le dépôt a déjà pour les douze stations
(`2026-08-01-stations-radio-depliage-mobile-design.md`), à une différence près :
la bascule des stations n'existe **que** sous 640 px, parce que la mise en page
dépliée tient d'elle-même sur grand écran. Ici le repli vaut à **toutes** les
largeurs — 25 pastilles encombrent autant un écran large qu'un téléphone.

Trois points qui ne sont pas cosmétiques :

- **Le nombre entre par un gabarit `{n}`**, jamais écrit dans la chaîne. Même
  raison que `radio.stations.all` — « Показать все 10 аккаунтов » et
  « Տեսնել 10 հաշիվները » ne placent pas le chiffre au même endroit — et une
  raison de plus ici : les quatre brins n'ont pas le même compte, donc un
  nombre en dur serait faux trois fois sur quatre.
- **Replié = `hidden`, pas une opacité.** C'est l'inverse exact du piège du
  tambour, où il fallait `opacity: 0` pour garder des onglets focusables dans
  l'arbre d'accessibilité. Ici on veut que 25 liens **sortent** du parcours
  clavier tant qu'ils sont repliés : un `Tab` qui traverse des liens invisibles
  perd le lecteur au clavier.
- **`hidden` garde les liens dans le HTML prérendu.** Les 25 liens sortants vers
  les profils restent dans la source que lisent les crawlers, et un compte dont
  aucun post n'a encore été récolté reste joignable — c'est le rôle de repli que
  les pastilles jouent déjà.

## Le garde-fou

Aucun test ne touche Instagram aujourd'hui, et le mode de panne est silencieux.
Deux façons de perdre un compte sans qu'aucun contrôle ne tombe :

1. **Un `group` mal orthographié** crée un cinquième brin que `igStrands` ne
   rend jamais. Le compte disparaît du mur ; ni le lint, ni le build, ni
   `npm run check` ne peuvent le voir — c'est une chaîne valide dans un JSON
   valide.
2. **Un titre manquant dans un seul des quatre blocs `STRINGS`.** `t()` vaut
   `STRINGS[lang][clé] ?? STRINGS.fr[clé] ?? clé` : une clé absente **rend la
   clé**. Le carrousel s'intitulerait `ig.strand.land`, cuit dans le HTML que
   Google indexe. Trois blocs sur quatre suffisent à masquer le trou, puisque le
   repli sur le français affiche un titre juste — c'est précisément ce qu'il
   faut attraper.

`test/instagram-strands.test.mjs` (sans réseau) garde les deux, sur le modèle de
`test/stations.test.mjs` : il lit `Social.jsx` **comme du texte** (Node ne sait
pas importer du JSX) pour en extraire les brins déclarés, et compte les
déclarations de chaque clé de titre dans `src/i18n.jsx`.

## Ce qui n'est pas fait

- **Aucun compte n'est recruté.** Les quatre brins sont taillés dans les 25
  comptes du pool. « Mémoire & patrimoine », le sujet qui manque vraiment au mur,
  demanderait une curation puis une récolte — c'est un autre chantier.
- **Le plafond reste global**, un seul chiffre pour les quatre brins. Un plafond
  par brin, proportionné à chaque réserve, serait plus fin ; il ferait aussi
  diverger deux endroits, et le dépôt sait déjà où cela mène (`WANT` du scrape
  Facebook contre un plafond côté vue).
- **Les groupes ne deviennent pas des données.** `igStrands` reste écrit dans
  `Social.jsx` : c'est là qu'est l'ordre d'affichage, et un ordre est une
  décision éditoriale, pas une donnée récoltée. Le test le lit à cet endroit.

## Vérification

- `npm test` — dont le nouveau fichier : quatre brins, chacun titré dans les
  quatre langues, aucun compte hors des quatre.
- `npm run lint` — 0 erreur, 5 avertissements connus (aucun nouveau).
- `instagram-feed.json` re-tiré localement, **`generatedAt` inchangé** : aucun
  instantané n'a lieu ici, seule la sélection change. Sans ce re-tirage, les
  posts du fichier ne portent que les deux anciens `group` et **deux des quatre
  brins seraient vides** jusqu'au prochain instantané horaire — un push sur
  `main` bâtissant et déployant sans re-scraper.
- Rendu vérifié aux quatre langues et aux deux thèmes, à 360 px et en large,
  replié **et** déplié : le titre le plus long est arménien
  (`Հայկական արվեստանոցներ`) et c'est lui qui décide si la tête de brin tient.
- Parcours clavier : replié, aucun `◎ @compte` ne prend le focus ; déplié, ils
  le prennent tous, et la bascule porte un `aria-expanded` juste.
