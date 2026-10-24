# Résumé des événements de l'agenda dans la visionneuse

Date : 24 octobre 2026. Statut : mis en œuvre (branche feat/agenda-resume).

## Intention

Depuis le 24 octobre 2026, un clic sur une carte de l'agenda ouvre l'affiche en
grand dans la visionneuse des réseaux sociaux (`src/components/Lightbox.jsx`),
avec le bouton « Voir sur armenopole ». Le propriétaire veut pouvoir lire, sans
quitter le site, **de quoi parle l'événement** — dans les six langues du site.

Il a choisi un **résumé** plutôt que le texte complet d'armenopole : c'est
moins risqué (le texte appartient à armenopole et aux organisateurs ; le
recopier en entier serait republier leur travail) et cela laisse au lecteur une
raison de cliquer vers armenopole.

## Ce que voit le lecteur (option « A », choisie sur maquette)

- Dans la visionneuse, **sous le titre et au-dessus du bouton armenopole**, une
  ligne discrète « Résumé ▾ » (style des liens utilitaires du site : mono,
  majuscules, couleur abricot, soulignement fin).
- Un clic **déplie** deux ou trois phrases entre le titre et le bouton ; la
  flèche devient ▴ ; un second clic replie. Sur téléphone, l'affiche rétrécit
  pour faire place au texte (la visionneuse mobile donne déjà tout l'espace
  restant à l'image : `.lb__frame { flex: 1 1 auto }`). Le texte déplié a une
  hauteur maximale et défile s'il dépasse, pour que l'affiche ne disparaisse
  jamais.
- Sous le texte, une mention discrète **« Résumé automatique »** (traduite),
  parce que ces textes ne sont pas relus.
- **Un événement sans résumé dans la langue de la page n'affiche pas la ligne
  « Résumé »** — jamais de bloc vide, jamais de « chargement » qui reste.
- Le pli est par visionneuse : passer à l'événement suivant (‹ ›) **replie**.
  (Choix du constructeur : déplié-persistant serait aussi défendable ; replier
  garde l'affiche visible, ce qui est le cœur de la visionneuse.)
- Accessibilité : la ligne est un `<button aria-expanded aria-controls>`,
  focusable, prise dans le piège de Tab existant de la visionneuse (elle
  sélectionne `button, [href]`), contour de focus comme `.lb__out`. Cible
  tactile ≥ 44px sous `@media (pointer: coarse)` (voir CLAUDE.md, « Le plancher
  tactile »).
- La Lightbox est partagée avec Instagram et Facebook : le résumé est un champ
  **optionnel** des items (`item.summary`, ou une fonction de chargement — au
  choix du constructeur). Sans lui, la visionneuse sociale est inchangée.

Libellés à ajouter dans les six blocs `STRINGS` de `src/i18n.jsx` : « Résumé »,
« Résumé automatique » (et leurs traductions).

## Fabrication des résumés (au scrape horaire)

1. **Lecture du texte source.** Pour chaque événement de `agenda.json` **sans
   résumé en cache**, lire sa page armenopole. Le texte de présentation vit dans
   un `div` enfant de `.col-md-8.col-md-pull-4` (vérifié le 24 oct. 2026 sur
   `young-prodigies-of-armenia-in-switzerland.html`, ~1 500 caractères avec
   emojis et listes de dates). Le constructeur trouve le sélecteur exact et le
   fige par une **fixture réelle** dans `test/` (même logique que
   `test/courrier-grid.test.mjs`). Plancher : un texte de moins de ~80
   caractères n'est pas résumé. `og:description` (tronqué à ~200 caractères)
   n'est qu'un repli, pas la source principale.
   - Requêtes : `fetchText` d'armenopole (comme `scripts/sources/armenopole.mjs`,
     qui fonctionne en CI), espacées, **plafonnées à 20 événements par instantané** (voir « Décisions »)
     pour que le premier passage — ~170 événements — s'étale sur quelques
     heures au lieu de rallonger un seul run.
2. **Écriture du résumé.** Un modèle gratuit OpenRouter, via la **même chaîne
   de modèles** que la brève et le classement (`modelChain`,
   `scripts/lib/classify-rubrics.mjs` ; secret `OPENROUTER_API_KEY`, déjà passé
   au scrape dans `hourly.yml`). **Un appel par événement** qui rend les six
   langues en JSON (voir « Décisions », point 1).
   - **Contenu demandé** : de quoi il s'agit, qui joue / organise, le genre ou
     le ton. **Ni prix, ni horaires, ni adresses, ni liens** — ce sont eux
     qu'une erreur fausserait, et la visionneuse affiche déjà lieu, date et
     heure tirés des données d'armenopole. 2 à 3 phrases, ~250-400 caractères.
   - **Garde d'alphabet** : `strayWords` (`scripts/lib/brief-script.mjs`), avec
     comme mots permis ceux du **titre et du texte source** (noms propres, voir « Décisions »). Un
     résumé fautif dans une langue est **écarté pour cette langue seulement**.
3. **Cache.** `src/data/agenda-resumes.json`, une entrée par URL d'événement :
   `{ sourceHash, fr, de, it, en, hy, ru }`. `sourceHash` est l'empreinte du
   texte source : si armenopole modifie sa présentation, le résumé est refait.
   Une langue écartée reste absente et sera retentée au prochain instantané
   (avec un plafond de tentatives pour ne pas brûler le quota sur un cas
   impossible — au choix du constructeur). Les entrées d'événements passés
   sont **purgées** (le fichier ne grossit pas indéfiniment).
4. **Échecs.** Rien ne lève : clé absente, 404/429 du modèle, délai, page
   armenopole en échec — l'événement reste sans résumé et le log porte
   `✗ résumé: …` (même convention que `✗ classify`, `✗ brief`). Le reste du
   scrape continue.

## Livraison au navigateur (le poids)

- **Rien dans le bundle de la page.** `agenda-resumes.json` ne doit **pas**
  être importé statiquement par un composant : il partirait dans le bundle des
  deux vitrines (cf. `lightData()` dans `vite.config.js`, qui existe pour
  exactement ce problème avec `news.json`).
- **Un fichier par langue, chargé au premier dépli** : `{ [url]: résumé }` pour
  la langue de la page, ~100-200 Ko. Mécanisme au choix du constructeur :
  `import()` dynamique de fichiers par langue générés au scrape (Vite en fait
  des chunks séparés), ou fichiers écrits au build dans `dist/<site>/`.
  Contraintes : la CSP est `script-src 'self'` et `connect-src` doit autoriser
  la requête (même origine) — vérifier `firebase.json` **sur les deux cibles**.
- **Mais il faut savoir, sans rien télécharger, si un résumé existe** (pour
  afficher ou non la ligne « Résumé »). Le constructeur choisit : un booléen
  léger porté par l'événement dans `agenda.json`, ou afficher la ligne et ne la
  masquer qu'après chargement. Préférence : ne jamais montrer une ligne qui
  s'avère vide.
- Hydratation : la visionneuse n'existe qu'après un clic, donc hors du HTML
  prérendu ; aucun risque d'écart d'hydratation tant que rien du résumé n'est
  rendu dans la carte elle-même.

## Décisions prises après la relecture du document (choix de Claude)

Quatre questions soulevées par la relecture, tranchées sans changer ce que
voit le lecteur :

1. **Quota.** Mesuré le 24 oct. 2026 sur la clé (`GET /api/v1/key`) :
   `is_free_tier: false`, **1 000 requêtes :free par jour**, 9 utilisées ce
   jour-là. Donc : **un appel par événement** (les six langues en un JSON),
   **plafond de 20 événements par instantané** — le premier passage (~170)
   s'étale sur ~9 heures, ensuite quelques événements nouveaux par jour. Pire
   cas avec replis : ~60 requêtes/heure, très en dessous du plafond, sans
   priver le classement ni la brève. L'étape des résumés tourne **après**
   `classifyRubrics` et `generateBriefs` dans `scrape.mjs`.
2. **Noms propres.** La garde d'alphabet permet les mots du **titre ET du texte
   source** armenopole (`allowedWords([titre, texteSource])`) : un interprète
   cité en lettres latines dans un résumé arménien ou russe est légitime. Le
   prompt demande de garder les noms propres tels qu'ils sont écrits dans la
   source plutôt que de les translittérer.
3. **Prix, horaires, adresses.** Consigne dans le prompt **et** filtre
   mécanique : le résumé d'une langue est écarté s'il contient une heure
   (`\d{1,2}[:h.]\d{2}`, « 7 PM »), un montant avec devise (CHF, €, $, EUR,
   USD, ֏, ₽, руб) ou un numéro de rue évident. Les années, ordinaux et petits
   nombres (« 33e édition », « 2 concerts ») restent permis. Fonction pure,
   testée.
4. **Durée.** Budget total de **3 minutes** pour l'étape (lectures armenopole
   + appels au modèle) : à l'échéance, on s'arrête et le reste attend
   l'instantané suivant. Une page armenopole a son propre délai (celui de
   `fetchText`), un appel au modèle 30 s comme le classement.

## Pièges à ne pas oublier (silencieux)

- **`hourly.yml` liste explicitement les fichiers à commiter** après le scrape
  (`git add src/data/news.json src/data/agenda.json …`). Un nouveau fichier de
  données absent de cette liste serait réécrit à chaque run et **jamais
  commité** : les résumés seraient refaits chaque heure, sans aucun signe.
- `rubric-map`-style : aucun test ne voit le réseau. Les tests portent sur les
  fonctions pures (extraction du texte depuis la fixture, construction du
  prompt, analyse de la réponse, garde d'alphabet, purge du cache, choix des
  événements à résumer).
- Une page armenopole peut rediriger ou changer de gabarit : extraction vide =
  pas de résumé + `✗`, pas de résumé fabriqué à partir de rien.

## Objectifs / non-objectifs

- Objectif : un résumé court, dans la langue de la page, pour la grande
  majorité des événements, sans coût de chargement pour qui ne déplie pas.
- Non-objectif : traduire ou reproduire le texte complet d'armenopole.
- Non-objectif : afficher le résumé sur les cartes du carrousel ou sur la page
  `/agenda/` (possible plus tard ; hors périmètre).
- Anti-objectif : un prix, un horaire ou une adresse **inventés ou mal
  traduits** dans un résumé ; un bloc vide ou un chargement infini dans la
  visionneuse ; un bundle alourdi.

## Vérification attendue

`npm test`, `npm run lint` (exactement 5 avertissements), `npm run build`,
`npm run check`, `npm run prerender`, `npm run hydration-check` ; rendu de la
visionneuse dépliée dans les six langues à 360/390/1400 px, jour et nuit, croix
de fermeture sans chevauchement (voir le skill `verifier-le-rendu`) ; un scrape
local réel (`npm run scrape` avec la clé) pour mesurer combien de résumés sortent
par langue.
