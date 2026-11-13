# Zoom sur l'affiche — plein écran et zoom à deux doigts

Date : 13 novembre 2026 · Taille : petit changement

## Intention

Sur téléphone, la visionneuse (`src/components/Lightbox.jsx`) ne donne à
l'affiche qu'environ 430 px de haut sur 780 : le programme d'un concert,
l'adresse ou l'heure exacte sont illisibles. Le lecteur doit pouvoir **lire
les détails de l'affiche** sans quitter le site.

## Objectifs

- Toucher (ou cliquer) l'image dans la visionneuse l'ouvre **en plein écran**,
  sur fond sombre, sans légende ni boutons, avec une croix pour revenir à la
  visionneuse.
- **Zoom à deux doigts**, déplacement à un doigt quand l'image est agrandie,
  **double toucher** pour zoomer (×2,5 sur le point touché) ou revenir à 1.
- Fermer le plein écran remet tout à zéro et ramène à la visionneuse, au même
  événement.
- Vaut pour **toutes** les images de la visionneuse : agenda, Instagram,
  Don Narek (même composant).

## Non-objectifs

- Pas d'élan ni de rebond physique (« inertie ») : zoom borné entre ×1 et ×4,
  l'image ne peut pas sortir de l'écran.
- Pas de bouton retour Android/historique : la visionneuse n'en gère pas
  aujourd'hui non plus.
- Le motif arménien (item sans photo) ne s'agrandit pas.

## Anti-objectifs

- Aucune dépendance nouvelle (le site n'a que React au runtime).
- Ne jamais laisser la **page** zoomée après fermeture (le zoom natif du
  navigateur reste coupé ; le geste est capté par l'image seule,
  `touch-action: none` sur la couche plein écran).
- Ne pas casser le balayage ‹ › ni la croix de la visionneuse.

## Approches

1. Ouvrir l'image dans un nouvel onglet (zoom natif) — ~5 lignes, mais on
   quitte le site.
2. **Retenue** : couche plein écran dans le site, zoom écrit à la main
   (Pointer Events + `transform: translate() scale()`), ~100 lignes.
3. Même chose avec PhotoSwipe — gestes plus aboutis, mais une dépendance
   ajoutée aux deux vitrines pour une seule fonction.

Choix de Nareg : **2**, pour lire les détails sans quitter le site et sans
alourdir le bundle.

## Conception (décisions de Claude, à corriger au besoin)

- L'image de la visionneuse devient un `<button>` (accessible au clavier,
  curseur `zoom-in`) ; deux chaînes nouvelles dans les sept blocs `STRINGS` :
  `lb.zoom` (« Agrandir l'image ») et `lb.zoomClose` (« Fermer l'agrandissement »).
- Couche plein écran rendue **dans** la visionneuse (même portail), au-dessus
  d'elle ; `Échap` ferme d'abord le plein écran, pas la visionneuse ; les
  flèches clavier ‹ › sont inactives tant qu'elle est ouverte.
- Ordinateur : molette pour zoomer autour du curseur, glisser pour déplacer,
  double clic comme le double toucher.
- `prefers-reduced-motion` : pas d'animation d'ouverture ni de zoom animé.
- Le code du geste dans un petit module à part (`src/components/ZoomView.jsx`),
  la Lightbox ne gagne que l'ouverture/fermeture.

## Vérification

`npm run lint` (aucun avertissement de plus), `npm test`, `npm run build`,
`npm run check` ; Puppeteer en viewport mobile (`pointer: coarse`, 360 et
390 px) : ouverture, pincement simulé par deux pointeurs, double toucher,
fermeture, page non zoomée ensuite ; thèmes jour et nuit. Le ressenti du geste
au pouce reste à éprouver sur un vrai téléphone.
