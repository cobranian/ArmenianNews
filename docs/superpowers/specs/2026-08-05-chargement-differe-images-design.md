# Faire mordre le chargement différé des images

**Date** : 5 août 2026
**Statut** : conception validée, implémentation à venir

## Le problème, mesuré

Un lecteur qui ouvre `armenieinfo.ch` et **ne défile pas d'un pixel** télécharge
**189 images pour 11,6 Mo**. Son premier écran n'en contient **aucune** : la page
fait 10 804 px de haut pour une fenêtre de 979, et la première image est à
2 075 px du sommet.

Les 189 portent pourtant toutes `loading="lazy"`.

Le reste de la page est sain, et c'est ce qui rend le contraste net. Mesuré sur
la production, en transfert réel (Firebase sert en brotli) :

| | Brut | Transféré |
|---|---|---|
| HTML prérendu | 264 ko | **25 ko** |
| JS | 1 010 ko | **219 ko** |
| CSS | 54 ko | **9 ko** |

**253 ko pour démarrer, puis 11,6 Mo d'images que personne n'a demandées.** Le
CLS vaut **0** — les conteneurs réservent leur place par `aspect-ratio`, rien ne
saute. Ce n'est donc pas un problème de mise en page, c'est un problème de
priorité réseau.

Le chantier WebP du même jour avait fait passer ces images de ~30 Mo à 11,6. Le
gain restant est plus grand que celui déjà obtenu.

**L'ampleur exacte de ce gain est une estimation, pas une mesure.** La première
image se trouve à 2 075 px du sommet, au-delà du seuil de déclenchement usuel de
Chrome, donc l'attendu est « quasiment aucune image au repos » — de l'ordre de
quelques centaines de kilo-octets. Le chiffre réel sortira de la mesure d'après,
et c'est lui qui fera foi.

## La cause, suspectée et non prouvée

Dans les **quatre** composants qui rendent une image, l'attribut est déclaré
dans cet ordre :

```jsx
<img
  src={...}          // d'abord
  alt={...}
  loading="lazy"     // ensuite
/>
```

C'est un piège React connu : quand React crée un élément côté client, il pose
les attributs **dans l'ordre du JSX**. Poser `src` pendant que `loading` vaut
encore sa valeur par défaut `eager` **démarre le téléchargement** ; poser
`loading="lazy"` après n'a plus d'effet. Le HTML prérendu porte le même ordre.

**Cette explication est cohérente avec la mesure ; elle n'est pas démontrée.**
La démontrer est le premier travail de l'implémentation, pas une hypothèse à
porter en production.

## Ce qu'on décide

**Réordonner l'attribut** : `loading="lazy"` remonte au-dessus de `src` dans
`Agenda.jsx:42`, `NewsBrowser.jsx:89`, `Social.jsx:127` et `Social.jsx:173`.
Quatre lignes déplacées, aucune logique nouvelle.

Deux autres voies ont été écartées, et l'une reste en repli :

- **Un `IntersectionObserver` maison** (repli explicite si la mesure réfute le
  réordonnancement) — il échangerait un substitut contre la vraie source à
  l'approche. Il fonctionne quelle que soit l'heuristique du navigateur, mais
  réimplémente ce que la plateforme fournit et ajoute du code à maintenir.
  Commencer par lui serait construire un contournement avant d'avoir vérifié
  que la plateforme ne fait pas déjà le travail.
- **Rendre moins de tuiles** — ne monter que les premières de chaque carrousel.
  C'est un changement **éditorial** autant que technique, et il ne corrige pas
  le défaut : il en réduit la surface.

## La preuve

Le changement est trivial ; la preuve est le livrable.

**Protocole** — compter les images chargées et les octets transférés **au repos,
sans défiler**, sur une navigation neuve :

```js
const res = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'img')
res.length                                              // 189 aujourd'hui
res.reduce((n, r) => n + (r.encodedBodySize || 0), 0)   // 11,6 Mo aujourd'hui
```

**Critère de réussite, chiffré pour qu'il ne se négocie pas** : **au plus 20
images chargées au repos**, contre 189 aujourd'hui. Le seuil est délibérément
lâche — il laisse passer une poignée d'images que le navigateur jugerait proches
— tout en étant hors d'atteinte d'un demi-succès. Entre 20 et 189, l'hypothèse
est réfutée et on bascule sur l'`IntersectionObserver`, sans discussion et sans
ajuster le seuil après coup.

Écrire « le nombre doit baisser nettement » aurait été un critère qui se plie à
son résultat : c'est ainsi qu'une amélioration de 189 à 150 se raconte comme une
réussite.

### Le piège de mesure, à désamorcer avant de conclure

**Le seuil de déclenchement du chargement différé de Chrome dépend de la
connexion estimée** : court sur une liaison rapide, généreux sur une lente.
Mesurer sur `npm run preview` en local, c'est mesurer sur la liaison la plus
rapide qui soit — le résultat y sera **flatteur**. Une amélioration locale ne
prouve donc rien à elle seule : elle doit être **reconfirmée sur la production
après déploiement**, au même protocole.

C'est le pendant, côté performance, de l'asymétrie `Intl` déjà documentée dans
`CLAUDE.md` : la machine qui mesure change le résultat.

### Deux mesures fausses déjà produites sur cette page

Elles sont consignées parce qu'elles se reproduiront.

- **Le FCP a été mesuré à 5 668 ms, puis à 380 ms.** La première valeur venait
  d'une navigation à froid, extension de pilotage comprise. Ni l'une ni l'autre
  ne décrit un vrai premier visiteur, mais 5,7 s n'est pas une propriété du
  site. Une seule mesure de temps ne vaut rien.
- **Les vignettes de presse ont été mesurées à 306 ko, puis à 43 ko.** Les URL
  `wsrv.nl` extraites du HTML portent `&amp;` (l'entité). Les rejouer telles
  quelles fait recevoir à wsrv un paramètre nommé `amp;w` qu'il ignore : on
  mesure alors **l'original non redimensionné**, pas ce que le navigateur
  reçoit. Décoder les entités avant de rejouer une URL tirée d'un HTML. Les
  vignettes de presse vont bien — `w=640&output=jpg&q=80` fait son travail — et
  ne sont pas concernées par ce chantier.

## Le garde

**Rien ne signale ce défaut** : ni le lint, ni les tests, ni `npm run build`, ni
`npm run check`, ni le rendu. La page est parfaite, simplement 11,6 Mo trop
lourde. Sans garde, la correction se défait au premier refactor qui réordonne
des props, en silence.

Un test lira les quatre composants **comme du texte** et vérifiera que dans
chaque balise `<img>`, `loading` apparaît avant `src`. C'est le procédé déjà
employé par `test/instagram-pool.test.mjs`, qui lit `Social.jsx` pour lier le
filtre d'exclusion au glob — Node ne sait pas importer du JSX.

Le test doit **échouer sur l'état actuel** avant d'être considéré comme un
garde : un test écrit après le correctif et jamais vu rouge ne prouve rien.

## Ce qu'on ne fait pas, délibérément

- **Ni `fetchpriority`, ni `decoding="async"`.** Non mesurés, donc non motivés.
- **Ni attributs `width`/`height`.** Le CLS vaut déjà 0 : les conteneurs
  réservent la place par `aspect-ratio`. Les ajouter serait un rite sans cause.
- **Pas de découpage du JS.** 219 ko en brotli pour cinq carrousels, quatre
  langues, un lecteur radio et un agenda : ce n'est pas là qu'est le poids.
- **Pas de nouvelles pages, pas de PWA.** Le premier reste écarté par le
  cadrage ; le second est noté comme suite possible dans
  `2026-08-05-images-webp-800-design.md`.

## Portée

Les quatre composants qui rendent une `<img>`, et un fichier de test. Aucune
donnée, aucun script, aucun style.
