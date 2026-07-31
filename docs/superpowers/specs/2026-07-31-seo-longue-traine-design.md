# Longue traîne : huit pages piliers pour `/radio` et `/agenda`

**Date** : 2026-07-31
**Portée** : les deux vitrines, les quatre langues.
**Statut** : design validé, plan d'implémentation à écrire.

## 1. État des lieux, mesuré

Relevé sur `armenieinfo.ch` en production le 2026-07-31 :

| Mesure | Valeur |
|---|---|
| Texte visible dans le HTML prérendu | 19 320 caractères |
| Balises `<article>` | 70 |
| `H1` | « Arménie Info » (la marque) |
| `<h2>` | 4 |
| URL indexables sur les deux vitrines | **4** (`.ch/`, `.org/`, `/hy/`, `/ru/`) |

Le prérendu fonctionne : Google lit une page pleine, pas une coquille React. Le
problème n'est donc pas technique, il est **structurel**.

Trois constats en découlent.

**La balise `<meta name="keywords">` (`src/seo.js`) est inerte.** Google l'a
abandonnée en 2009, Bing la traite au mieux comme du bruit, Yandex l'ignore. Y
ajouter des mots-clés n'a aucun effet sur le classement. C'était la question
posée au départ ; la réponse est qu'il n'y a rien à y gagner.

**Quatre URL doivent gagner toutes les requêtes.** Une requête classe une
*page*, pas un site. « Écouter une radio arménienne en direct » et « événements
arméniens à Genève » sont deux intentions distinctes : une page d'accueil
généraliste qui contient les deux sera battue par deux pages dédiées.

**Le corps des pages est du contenu repris.** Les titres viennent d'Armenpress,
du Courrier d'Erevan, de NEWS.am. Sur ces mots, Google classe la source, qui a
vingt ans d'autorité. En revanche, le site détient deux jeux de données que
personne d'autre n'agrège — **douze radios en direct** et un **agenda de
26 pays** — et ni l'un ni l'autre n'a d'URL propre.

## 2. Objectif

Gagner des requêtes de **longue traîne** dans les quatre langues, sur les deux
vitrines : peu de volume par requête, beaucoup de requêtes, et une donnée que le
site est seul à détenir.

Exemples de requêtes visées : « radio arménienne en direct », « écouter radio
Erevan », « armenian radio online », « événements arméniens Genève », « soirée
arménienne Suisse », « armenian events London ».

### Non-objectifs, explicites

- **Ne vise pas** « actualités arméniennes », « Armenian news », « новости
  Армении ». Ces requêtes appartiennent à Armenpress et NEWS.am ; rien dans ce
  design ne change cela.
- **Ne touche pas** à la balise `keywords` comme levier — elle reste en place,
  documentée comme inerte.
- **Ne crée pas** de page par pays ni par station. Écarté délibérément :
  voir § 9.

## 3. Décisions et leur raison

| Décision | Raison |
|---|---|
| 8 nouvelles pages : `/radio` et `/agenda` × 4 langues | Deux sujets à donnée unique et stable, assez de matière pour être substantiels, aucun risque de page vide |
| Vue par chemin dans l'application React | Les pages héritent de la nav, du pied de page, du thème, du sélecteur de langue et de la typographie ; leurs `hreflang` passent par le même générateur |
| Slugs en caractères latins | Un slug arménien partirait en pourcent-encodage, illisible dans un partage, sans gain de classement |
| Slug traduit là où le mot change la requête | En anglais, *agenda* désigne un ordre du jour, pas une liste d'événements : `events` est le mot cherché |
| `H1` de l'accueil inchangé | Il porte le dégradé abricot et la correction `cap-height` du bloc `html:lang(hy)`, et sert les requêtes de marque ; les mots-clés sont servis par les nouvelles pages |
| Liste complète des événements sur `/agenda` | La longue traîne se joue sur le texte des titres réels ; un extrait la perdrait |
| Rédaction par Claude, validation par le propriétaire | faits vérifiables uniquement ; `hy` et `ru` signalés pour relecture native |

**Volume rédactionnel** : ~200 à 300 mots de texte propre par page, introduction
**et** fiches comprises. Ce décompte ne couvre pas les données déjà affichées
(noms de stations, titres et dates d'événements), qui viennent du dépôt et des
scrapes.

## 4. Architecture des URL

Une page est un triplet **(vitrine, langue, vue)**. Trois vues : `home`,
`radio`, `agenda`.

| | `home` | `radio` | `agenda` |
|---|---|---|---|
| .ch `fr` | `/` | `/radio` | `/agenda` |
| .org `en` | `/` | `/radio` | `/events` |
| .org `hy` | `/hy/` | `/hy/radio` | `/hy/events` |
| .org `ru` | `/ru/` | `/ru/radio` | `/ru/events` |

L'URL se dérive du chemin de langue plus le slug de la vue dans cette langue.

`sites.config.js` gagne un export `VIEWS` (les vues et leurs slugs par langue)
et une fonction `urlFor(siteId, lang, view)`.

**Le tableau `pages` ne bouge pas.** Il continue de décrire une page d'accueil
par langue, parce que `LANG_URL` en dérive : y ajouter les nouvelles pages
rendrait la table ambiguë (`fr` pointerait sur deux URL) et casserait d'un seul
coup le sélecteur de langue et les `hreflang`.

### Le piège central : des `hreflang` par vue

`scripts/lib/site-meta.mjs` écrit aujourd'hui ses `hreflang` depuis `LANG_URL`,
donc toujours vers les quatre **accueils**.

Si les 8 nouvelles pages héritent de ce bloc tel quel, `/radio` du `.ch`
déclarera comme équivalent anglais l'**accueil** du `.org`, et non `/radio`.
Google reçoit des correspondances contradictoires et **ignore le bloc entier**,
sur les douze pages — pas seulement sur les nouvelles.

`headFor()` doit donc prendre la vue en paramètre : les alternates de `/radio`
citent les quatre `/radio`, ceux de `/agenda` les quatre `/agenda`, chaque page
se citant elle-même. Le `canonical` suit la même règle.

### Fichiers touchés

| Fichier | Changement |
|---|---|
| `sites.config.js` | `VIEWS`, slugs par langue, `urlFor()` |
| `scripts/lib/site-meta.mjs` | `headFor({ siteId, lang, view })` ; `hreflang` et `canonical` conscients de la vue |
| `scripts/build-sites.mjs` | produit 12 fichiers au lieu de 4 |
| `scripts/prerender.mjs` | sa boucle parcourt les vues en plus des langues (elle écrit déjà dans des sous-dossiers) |
| `scripts/lib/sitemap.mjs` | 12 entrées, alternates cohérents avec leur vue |
| `src/App.jsx` | choisit sa vue d'après le chemin, comme `langFromPath` choisit la langue |
| `src/components/Nav.jsx` | ancres absolues hors de l'accueil (voir § 7) |

**Firebase n'a rien à changer.** `dist/ch/radio/index.html` est servi tel quel
sur `/radio` : Hosting cherche un fichier puis un index de dossier **avant**
d'appliquer la réécriture attrape-tout `** → /index.html`. C'est exactement
ainsi que `dist/org/hy/index.html` est servi sur `/hy/` aujourd'hui.

## 5. La page `/radio`

**`H1`** : la requête, pas la marque. « Radios arméniennes en direct » (`fr`),
« Armenian radio online » (`en`), et l'équivalent en `hy` / `ru`.

**Structure** :

1. `H1`
2. Introduction, ~80 mots : ce que c'est, douze stations, Erevan et diaspora,
   gratuit, sans compte.
3. **Le lecteur, composant `Radio.jsx` réutilisé tel quel** — pas une copie.
4. Les douze stations, chacune en `H2`, avec ses faits : ville, genre, langue
   d'antenne, fréquence FM si elle existe, débit.
5. Liens vers l'accueil et vers `/agenda`.

### La règle de sourçage

`STATIONS` (`src/components/Radio.jsx`) ne porte que deux champs : un `id` et
une URL de flux. Les noms vivent dans l'i18n (`radio.st.*`). **Ville, genre,
fréquence, langue d'antenne n'existent nulle part dans le dépôt** — il faut les
chercher sur les sites des stations.

**Ce qui n'est pas sourçable n'est pas écrit.** Le débit se mesure sur les flux.
La fréquence de Radio Jazz FM (89.3 MHz, Erevan) est déjà documentée dans le
code. Pour les stations indépendantes (Yerevan Nights, Armenian Gospel Radio),
il se peut qu'aucune source publique fiable n'existe : ces fiches auront alors
deux champs au lieu de cinq. Une fiche brève et vraie classe ; une fiche
complète et inventée coûte la crédibilité du site.

## 6. La page `/agenda`

**`H1`** : « Agenda arménien : événements en Suisse et dans le monde », et ses
équivalents.

**Structure** :

1. `H1`
2. Introduction : la fabrication (source armenopole, 26 pays, mise à jour
   horaire), comment lire la liste.
3. **La liste complète, en HTML explorable, groupée par pays.** Au relevé du
   2026-07-31 : 159 événements, dont 11 en Suisse, répartis sur 26 pays. Pas un
   carrousel de douze.
4. Liens vers l'accueil et vers `/radio`.

Le rendu mobile de cette liste demande un soin particulier : c'est une page
longue par construction.

### Données structurées

**Sur `/agenda`** : un `Event` schema.org par événement. C'est **le seul
balisage de ce projet qui produit un résultat enrichi visible** dans Google (les
fiches d'événements avec date et lieu).

Deux garde-fous :

- **Seuls les événements à venir sont balisés.** Baliser un événement passé
  comme à venir enfreint les règles de Google.
- **Le lieu se limite à la donnée réelle.** `agenda.json` porte un champ
  `location` textuel (« Genève », « Uruguay »), pas d'adresse. Le balisage
  émettra donc `location: { @type: Place, name: <location> }` sans adresse
  inventée. Search Console signalera l'adresse manquante comme un
  **avertissement non bloquant** : c'est le comportement correct, pas un défaut
  à corriger.

**Sur `/radio`** : un balisage `RadioStation` par station, dans un `ItemList`.
Il aide Google à comprendre l'entité mais **n'affiche rien de particulier** dans
les résultats. Ne pas en attendre de résultat enrichi.

## 7. Navigation et liens internes

**La nav doit devenir absolue hors de l'accueil.** Elle pointe aujourd'hui sur
des ancres (`#actualites`, `#agenda`, `#reseaux`). Sur `/radio`, ces ancres ne
désignent rien : la page n'a pas ces sections. `Nav.jsx` doit émettre
`/#agenda` (chemin de langue + ancre) dès que la vue n'est pas `home`. Sans
cela, les huit nouvelles pages ont une nav morte.

**Les liens de l'accueil vers les nouvelles pages sont un levier, pas une
politesse.** Chaque section concernée de l'accueil gagne un lien vers sa page
dédiée, avec un **texte d'ancre qui porte la requête** : « Toutes les radios
arméniennes en direct », et non « En savoir plus ». C'est ce texte que Google
lit pour décider du sujet de la page de destination.

## 8. Ce qui change sur les 4 pages existantes

Peu de choses, et c'est voulu.

- Elles gagnent les liens d'ancre vers les nouvelles pages (§ 7).
- Le sitemap passe de 4 à 12 entrées.
- **Le `H1` reste la marque** (raison en § 3).
- **La balise `keywords` reste en place**, avec un commentaire dans
  `src/seo.js` indiquant qu'elle est sans effet depuis 2009. La retirer ne
  gagnerait rien au classement et ferait bouger le générateur de méta et ses
  tests pour zéro effet ; le commentaire évite d'y revenir dans six mois en
  croyant tenir un levier.

**Le doublon `/agenda` ↔ section agenda de l'accueil** se gère par la
différence : l'accueil montre un carrousel d'un pays à la fois, la page montre
les 159 événements groupés avec une introduction que l'accueil n'a pas, et
chaque page porte son propre `canonical`. C'est la configuration normale d'un
site ayant une page d'accueil et des pages de rubrique.

## 9. Ce qui a été écarté

**Une page par pays de l'agenda** (`/agenda/france`, `/agenda/suisse`…).
Viserait « événements arméniens Lyon » aussi bien que « … Genève », mais un pays
dont les événements sont passés donne une **page vide**, que Google lit comme un
soft-404. Il faudrait une règle de seuil et une purge du sitemap. À reconsidérer
si `/agenda` prouve qu'elle capte du trafic.

**Une page par station de radio** (`/radio/radio-van`…). Contenu parfaitement
stable, mais il faudrait rédiger un texte propre à chaque station **dans les
quatre langues**, sinon 48 pages quasi identiques — du contenu dupliqué interne.
Le coût rédactionnel est disproportionné au gain.

**Des pages autonomes** (le mécanisme `standalone` de `lien.html`). Elles
n'auraient ni nav, ni sélecteur de langue, ni le CSS du site (il faudrait le
dupliquer), et dériveraient à la première évolution du design. Ce mécanisme est
fait pour des cartes de partage, pas pour des pages destinées à classer.

## 10. Vérification

Quatre tests s'ajoutent, tous **sans réseau**, dans l'esprit des 61 existants :

1. **Unicité** — chaque triplet (vitrine, langue, vue) produit exactement une
   URL, et la table des slugs couvre les quatre langues. Sans ce test, une
   langue produirait une page joignable nulle part, en silence.
2. **Réciprocité des `hreflang` par vue** — les alternates de `/radio` citent
   les quatre `/radio`, chacune se citant elle-même. C'est le test qui garde le
   piège du § 4.
3. **Sitemap** — 12 entrées, alternates cohérents avec leur vue.
4. **`npm run check` passe de 4 à 12 pages** — `lang`, `canonical`, `hreflang`,
   carte de partage propre à la vitrine, jeton GA et jeton beacon de la bonne
   vitrine. Ce sont les contrôles existants, appliqués aux nouvelles pages.

## 11. Mesure et critères de succès

**Indexation** — Search Console, Couverture : les 8 nouvelles URL doivent passer
à « Indexée ». Délai attendu : quelques jours à quelques semaines. Les deux
sitemaps sont à resoumettre après le déploiement.

**Indicateur avancé, à quatre semaines** — les **impressions** sur ces URL
(Search Console → Performances, filtré par page). Quelques dizaines
d'impressions, même sans clic, signifient que Google positionne la page et que
c'est une affaire de temps.

**Critère d'échec, à huit semaines** — zéro impression signifie que la page
n'est pas compétitive et qu'il faut y revenir. Ce n'est pas un motif d'attendre
davantage.

**Horizon de classement** : 3 à 6 mois sur `armenieinfo.ch`, davantage sur
`armenianews.org`, qui démarre avec l'autorité d'un domaine neuf.

## 12. Séquencement

La plomberie de routage est commune aux deux pages, mais la suite se découpe en
deux étapes livrables :

**Étape 1** — `VIEWS`, `urlFor()`, `headFor` conscient de la vue, build,
prérendu, sitemap, tests, nav absolue, **plus `/radio`**. Contenu stable, aucun
risque de page vide. Déployable et observable en ligne.

**Étape 2** — `/agenda`, sa liste complète et son balisage `Event`. Plus de
contenu, plus de règles Google à respecter.

## 13. Risques

| Risque | Portée | Traitement |
|---|---|---|
| `hreflang` non conscients de la vue | **Élevé** — invalide le bloc sur les 12 pages | Test 2 du § 10 |
| Faits de stations non sourçables | Moyen — fiches plus courtes que prévu | Règle du § 5 : ce qui n'est pas sourçable n'est pas écrit |
| Balisage `Event` refusé par Google | Moyen — perte du résultat enrichi, pas du classement | Événements à venir seulement ; lieu limité à la donnée réelle |
| Nav morte sur les nouvelles pages | Moyen — pages orphelines, pas de circulation d'autorité | § 7, ancres absolues |
| Relecture `hy` / `ru` sans œil natif | Faible — qualité rédactionnelle | Les passages douteux sont signalés nommément au propriétaire avant publication |
| Page `/agenda` longue sur mobile | Faible — confort de lecture | Soin particulier au rendu, vérifié en iframe 390 px sur le serveur de développement |
