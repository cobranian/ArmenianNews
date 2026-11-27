# Shorts Culture : une image par fait

## Pourquoi

Une seule photo pendant ~50 s rend la vidéo monotone, et on décroche. Le but
est le **rythme** : une image nouvelle à chaque fait pour retenir le
spectateur. Faire correspondre l'image au fait n'est pas l'objectif (l'ordre
peut être quelconque) ; être **dans le sujet**, si.

## Ce qui change dans la vidéo

- **7 faits, 7 images différentes.** L'écran de fin reprend l'image 1, la
  photo de l'article (`meta.image`). Le changement suit le fondu qui existe
  déjà entre les faits.
- Le fond flouté **et** la planche nette changent ensemble (même image).
- **Le crédit suit l'image** : auteur et licence de la photo à l'écran
  (obligation CC BY).
- Moins de 7 bonnes images : on en réutilise, **jamais deux fois de suite**.
  Une seule image : le Short reste comme aujourd'hui.

## D'où viennent les images

- **Source** : les images des articles Wikipédia du sujet (fr, en, hy, ru,
  ceux de `meta.sources`), plus les 3 `candidates` actuelles. La recherche
  Commons plein texte n'est **pas** étendue : elle ramène des homonymes
  (« Kochari » → koshary égyptien).
- **Filtres** (mêmes règles que les candidates aujourd'hui) : licence libre
  (`isFreeLicense`), bitmap, largeur ≥ plancher, auteur et page Commons
  présents ; plus un rapport largeur/hauteur raisonnable, pour écarter
  pictogrammes et bandeaux.
- **Choisies au brouillon** (`culture-draft`), enregistrées dans `meta.json`
  avec leur crédit, **téléchargées une fois et versionnées** à côté de
  l'article sous un nom que le site ne publie pas (le site ne lit que
  `image.jpg` / `image.webp`).

## Revue humaine (choix de Nareg)

Les 7 images sont **listées dans la PR de l'article** (vignette, fichier,
auteur, licence), comme les 3 candidates le sont déjà. Nareg les voit en
relisant, et peut en **remplacer** une (autre fichier Commons) avant de cocher
« Faits vérifiés ». Raison : une image hors sujet dans une vidéo publiée ne se
corrige plus, et Wikipédia contient du bruit — mesuré sur Gorky, la page
référence aussi « Mona Lisa detail eyes.jpg », des icônes de citation et de
licence.

## Mesure préalable (27 nov. 2026, Arshile Gorky)

Ses quatre articles Wikipédia donnent ~12 images utilisables : photos des
Archives of American Art, timbres arméniens, et une dizaine de tableaux
(« Garden in Sochi », « The Artist and His Mother », « The Liver is the Cock's
Comb »…), domaine public ou CC BY 2.0. Alphabet : ~28, Ani : ~40. Les petits
sujets en auront moins.

## Premier essai

L'article en validation, **Arshile Gorky (PR #226)** : ses 7 images listées
dans la PR, revues par Nareg, puis un rendu local du Short fr à regarder
avant d'étendre aux autres articles.

## Hors champ

- Les Shorts déjà publiés ne sont pas re-rendus.
- Pas de changement d'image en plein milieu d'un fait (image qui bouge
  pendant la lecture, crédit qui clignote).
- Garni et les vidéos hors Culture gardent leur image unique.

## Approches considérées

- **Une image par fait** — retenue, à la demande de Nareg : le plus captivant.
- Rotation de 3 images (1-2-3-1-2-3-1) — première version, dépassée : chaque
  image revenait 2–3 fois.
- Trois blocs (faits 1–3 / 4–5 / 6–7) — écartée : 2 changements seulement.
- Changement toutes les ~3 s — écartée : fatigue la lecture.

## Laissé au constructeur

Noms des fichiers et du champ de `meta.json`, commande de remplacement d'une
image depuis la PR, ordre des images (photo de l'article en tête, puis variété
photo/œuvre), rattrapage éventuel des articles existants, tests (une image et
un crédit par scène, repli sans répétition consécutive, filtres).
