# Le sélecteur de stations sur mobile — déplier sur place

**Date** : 2026-08-01
**Portée** : `src/components/Radio.jsx`, `src/i18n.jsx`, `src/styles/global.css`.

## Le problème

Mesuré à 360 px sur l'accueil :

| | |
|---|---|
| Stations dans `STATIONS` | **12** |
| Visibles sans défiler | **2** |
| Largeur visible / totale de `.radio__stations` | **312 / 1 646 px** |
| Indice qu'il en manque | **aucun** — `scrollbar-width: none` |

C'est le même défaut que le rail des sources d'actualités (réglé le même jour,
voir `2026-08-01-tambour-source-mobile-design.md`), en pire : ce rail-là gardait
au moins une barre de 3 px.

Et le site se contredit dans le même écran. Le sous-titre annonce « **Douze**
radios arméniennes, en flux continu », le lien en dessous « les **douze** radios
arméniennes en direct ». Le contrôle en montre deux, la troisième coupée en
plein mot.

## La solution

**Rien à inventer.** `.radio__stations` porte **déjà** `flex-wrap: wrap` en règle
de base : les douze puces s'enveloppent et se voient toutes, partout — sauf dans
le bloc `@media (max-width: 480px)`, qui force `nowrap` + `overflow-x: auto` et
supprime la barre de défilement. La compacité y a été échangée contre la
complétude, et l'indice a disparu dans l'échange.

L'état **déplié** est donc simplement la mise en page que le site utilise déjà
partout ailleurs, rendue atteignable sous 480 px.

```
REPLIÉ (~35 px, l'état d'aujourd'hui)
 ╭──────────────────────────────────╮
 │ ● Première chaîne   Im Radio  R… │
 │                     Voir les 12 ⌄│
 ╰──────────────────────────────────╯

DÉPLIÉ (~200 px, la mise en page de base restaurée)
 ╭──────────────────────────────────╮
 │ ● Première chaîne     Im Radio   │
 │ Radio Arevik     Radio Culture   │
 │ Radio Mariam      Voice of Van   │
 │ Lav Radio   Radio Fama           │
 │ Yerevan Nights                   │
 │ Armenian Gospel Radio            │
 │ Radio Yeraz     Radio Jazz FM    │
 │                        Replier ⌃ │
 ╰──────────────────────────────────╯
```

## Pourquoi pas le tambour

Le sélecteur de sources vient de recevoir un tambour à 360°. Le réutiliser ici
serait le réflexe, et ce serait une erreur :

- **Douze n'est pas sept.** Le tambour est un pas-à-pas ; franchir douze crans
  est long, et douze pastilles de repère ne sont plus une information.
- **Le contenant diffère.** Le tambour remplace un en-tête de section ; les
  puces vivent *dans* la console du lecteur. 132 px de roue pèseraient plus que
  le lecteur qu'elles servent.
- **La tâche diffère.** Choisir une source, c'est basculer entre des marques
  connues. Choisir une radio, c'est parcourir des noms pour voir ce qui existe —
  cela demande une liste qu'on embrasse, pas un pas-à-pas.
- **Un motif signature employé deux fois cesse d'être une signature.**

## Pourquoi pas non plus « aller sur /radio/ »

La page `/radio/` porte déjà les douze fiches documentées, et l'idée d'y
renvoyer était la première venue. **Elle est mauvaise** : le lien est un
`<a href>` ordinaire (`Radio.jsx`, `pathFor(lang, 'radio')`), donc une
navigation de document — un rechargement complet qui **coupe le flux en cours
d'écoute**. Le même piège est déjà documenté en tête du composant, à propos du
drapeau `more`. Les douze stations doivent rester atteignables **sur place**.

## Architecture

### Portée

`@media (max-width: 480px)` **uniquement**. Au-dessus, les puces s'enveloppent
déjà et les douze se voient : rien ne change, et rien ne doit changer.

C'est un point de vigilance : la borne du tambour des sources est **640 px**,
celle-ci **480 px**. Les deux sont justes — chaque défaut commence là où sa
propre mise en page casse — mais on ne les aligne pas « pour faire propre ».

### État replié

**Exactement ce qu'il y a aujourd'hui** : une rangée qui défile horizontalement.
Aucune régression. Un seul ajout : **la puce active est amenée dans le champ**
(`scrollIntoView({ inline: 'center', block: 'nearest' })`), pour que quelqu'un
qui écoute la douzième station la voie au lieu de voir les deux premières.

### État déplié

Le bloc `≤480px` rend la main : `flex-wrap: wrap` reprend, `overflow-x` revient
à `visible`. Les douze puces s'affichent sur ~5 rangs.

### Les douze puces restent toujours dans le DOM

Replier change la **forme**, jamais la **composition**. Les douze
`<button role="radio">` restent en permanence enfants du `role="radiogroup"`,
et restent atteignables au défilement même repliés.

Conséquence voulue : rien n'est retiré aux technologies d'assistance, aucun
radio n'est enfermé dans un conteneur fermé, et il n'y a **aucune question ARIA
à trancher**. C'est ce qui écarte la variante `<details>/<summary>`, séduisante
pour son accessibilité gratuite mais qui aurait coupé le groupe de radios en
deux.

### La bascule

Un `<button aria-expanded>` **hors** du `radiogroup`, sous la rangée.

- Replié : « Voir les 12 stations » ; déplié : « Replier ».
- **Le nombre est injecté depuis `STATIONS.length`**, jamais écrit à la main.
  La clé i18n ne porte que les mots.

Ce dernier point n'est pas cosmétique. `test/radio-count.test.mjs` garde
**quatorze** chaînes qui écrivent le nombre en toutes lettres (les quatre
`radio.subtitle`, les quatre `radio.more`, `radio.page.intro` / `radio.page.list`,
les descriptions de `src/seo.js`, les cartes de `pages/`), précisément parce que
`t()` ne sait pas interpoler. Écrire « douze » dans une nouvelle clé ferait
entrer un quinzième texte dans cette famille. L'injecter depuis le tableau le
rend **incapable de mentir**, et n'ajoute rien à tenir.

### État local, non persisté

Un `useState` dans `Radio.jsx`. Il retombe replié à chaque visite,
délibérément : la plupart des arrivées veulent appuyer sur Play, pas choisir.

### Les deux pages

`RadioPage` rend le même composant (`more={false}`), donc la bascule apparaît
aussi sur `/radio/`, au-dessus des fiches détaillées. C'est cohérent : les puces
y sont le commutateur, les fiches la documentation. Un second composant
divergerait au premier correctif — c'est le raisonnement déjà écrit pour le
drapeau `more`.

### Mouvement réduit

Pas d'animation de hauteur sous `prefers-reduced-motion: reduce` ; le dépliage
est immédiat.

## Ce qui n'est pas fait

- Le `<select>` de pays de l'agenda : natif, 27 options, le système déroule sa
  propre roue sur mobile. On ne fera pas mieux et on perdrait l'accessibilité
  gratuite.
- Les carrousels de cartes (`.shelf__track`) : les flèches existent et la carte
  suivante dépasse au bord. L'indice est là.
- Le rendu au-dessus de 480 px.

## Vérification

1. `npm run lint` — 0 erreur, **5 avertissements** connus. Un sixième serait une
   régression.
2. `npm test` — les 119 tests, dont `radio-count` qui doit rester vert **sans
   modification** : c'est la preuve que la nouvelle chaîne n'a pas rejoint la
   famille des textes qui écrivent le nombre à la main.
3. `npm run build && npm run check`.
4. Inspection à 360 et 390 px, **quatre langues**, **deux thèmes** : replié puis
   déplié, et vérification que les douze puces sont bien toutes rendues.
5. Choisir la douzième station, replier, vérifier qu'elle est visible sans
   défiler à la main.
6. Vérifier qu'au-dessus de 480 px la bascule est absente et la mise en page
   inchangée — par **chargement neuf**, jamais en redimensionnant une `<iframe>`
   (voir l'avertissement de méthode dans la spec du tambour : une iframe
   redimensionnée depuis le parent n'émet ni `resize` ni `change`).
7. La lecture ne doit **pas** s'interrompre en dépliant ou repliant.

**Le déploiement n'est pas dans cette spec.** Un push sur `main` déclenche
`hourly.yml`, donc la production.
