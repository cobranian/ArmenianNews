# Articles « Culture » au quotidien — design

Date : 17 octobre 2026
Statut : issu du brainstorming du 17 octobre, à relire avant le plan.
Complète `2026-10-16-articles-culture-design.md` (le circuit hebdomadaire) :
tout ce qui n'est pas modifié ici reste valable.

## Intention

Passer d'**un article par semaine à un article par jour**, pour **plus de
visites** et **plus d'articles présents dans Google**. Mesure : GA4
(visites des pages `/culture/`) et Search Console (pages Culture indexées,
impressions), à trois mois.

Le relecteur lit **un article par jour, le matin, sur téléphone, en 15 à
20 minutes**. Le circuit doit être assez propre pour qu'un jour, la relecture
puisse être allégée — mais **pas dans ce chantier** : rien ne paraît sans
relecture.

### Ce que le premier vrai article a appris (kochari, PR #16)

Le relecteur a supprimé 14 lignes et presque rien réécrit :

- **un homonyme** : trois paragraphes sur le *koshary*, plat égyptien,
  parce que la page Wikipédia fr « Kochari » parle aussi du plat ;
- **les variantes azerbaïdjanaises**, retirées par choix éditorial ;
- des **dates et noms à vérifier**, et des **sources trop minces** (Wikipédia
  fr + en seulement).

Une erreur probable est restée publiée : « inscrit en 2017 sur la liste de
sauvegarde **urgente** » — le kochari figurerait sur la liste
**représentative**. À vérifier sur ich.unesco.org et corriger dans les quatre
langues (tâche 0 du plan).

## Objectifs, non-objectifs, anti-objectifs

**Objectifs**
1. Un brouillon français prêt chaque matin.
2. Des sources plus riches et **sur le bon sujet**.
3. Une relecture faisable en 15-20 min sur téléphone, corrections comprises.
4. Une file de sujets qui ne se tarit pas, alimentée par l'IA **sous
   validation**.
5. **Entièrement gratuit.**

**Non-objectifs**
- Publication sans relecture humaine.
- Relecture des traductions en / hy / ru (inchangé).
- Toute source ou API payante.

**Anti-objectifs** — ce qui ferait échouer le chantier même s'il « marche » :
- un article hors sujet (homonyme) ou citant les variantes azerbaïdjanaises ;
- une date, un nombre ou un nom publié sans être dans une source, **sans
  avoir été signalé** au relecteur ;
- une pile de brouillons non relus qui s'accumule ;
- une bascule silencieuse vers un modèle plus faible ;
- un volume de textes générés qui exposerait les deux domaines à une action
  manuelle Google « scaled content abuse » — la relecture quotidienne et
  l'apport propre de chaque article en sont la protection.

## Contraintes

- Gratuité totale : Gemini Flash (offre gratuite) reste le modèle.
  **Aucun repli n'existe aujourd'hui** dans `culture-llm.mjs` (un 429 lève) ;
  le repli est à construire, selon la règle de l'utilisateur ci-dessous. Vérifier au plan les quotas
  quotidiens de l'offre gratuite face à ~10 appels/jour (brouillon, faits,
  corrections, 3 traductions).
- Sources : **seulement des sources dont l'accès automatisé est permis**.
  Exclues, vérifié le 17 oct. 2026 : Encyclopædia Universalis et Britannica
  (payantes, conditions interdisant l'usage automatisé / l'IA), Encyclopaedia
  Iranica (bloque les robots, aucune permission claire), Google Books
  (extraits seuls), **Gemini « grounding with Google Search »** (ses
  conditions interdisent de stocker et publier les résultats).
- Les contraintes GitHub déjà documentées (commit/fusion par
  `GITHUB_TOKEN` ne déclenchent pas d'autre workflow) s'appliquent aux
  nouveaux workflows.

## Décisions de l'utilisateur

| Sujet | Décision |
|---|---|
| Rythme | Un article par jour |
| Relecture | Le matin, sur téléphone, 15-20 min |
| Corrections | Par **consigne en commentaire** ; l'IA corrige et renvoie une version |
| Sujets | Mélange : liste curée, agenda, idées de l'IA **validées** par l'utilisateur |
| Ligne éditoriale | Point de vue arménien ; **ne jamais mentionner les variantes culturelles azerbaïdjanaises** (danses, plats, étymologies, inscriptions UNESCO) ; les **faits historiques sourcés** qui nomment l'Azerbaïdjan restent permis (Djoulfa, Artsakh) |
| Modèle de secours | Brouillon, liste des faits et `/corrige` peuvent basculer sur OpenRouter `:free` (modèle réel affiché). **Les traductions ne basculent jamais** : Gemini indisponible → la publication attend, commentaire sur la PR |
| Coût | Entièrement gratuit |
| Succès | Visites (GA4) et articles dans Google |

## Le circuit

### 1. Rédaction nocturne — `articles.yml`

- Cron **quotidien**, `0 3 * * *` (05:00 à Genève l'été, 04:00 l'hiver).
  *Mon choix.*
- **Plafond de file** : si **2** PR `culture/*` sont déjà ouvertes, le job
  s'arrête sans rédiger (log explicite). Évite la pile de brouillons et le
  gaspillage de quota un jour sans relecture. *Mon choix, valeur à ajuster.*
- Choix du sujet inchangé (`culture-topic.mjs`) : agenda à 21 jours d'abord,
  puis liste.

### 2. Sujets identifiés par Wikidata — fin des homonymes

- Chaque sujet de `sujets.json` porte un **`qid`** Wikidata
  (ex. `Q1133431`). Les titres Wikipédia de chaque langue sont **résolus
  depuis les sitelinks** de l'entité, pas devinés depuis un titre.
  `wikipedia: { fr, en }` reste accepté comme **surcharge** manuelle.
- Migration des sujets existants : ajouter le `qid` de chacun (vérifié à la
  main une fois).
- Une page résolue marquée `disambiguation` est rejetée (déjà détecté par
  `fetchWikipedia`, à faire échouer bruyamment plutôt que rédiger).
- **Consigne de cadrage** au modèle : le sujet est l'entité Wikidata
  (libellé + description fournis) ; tout passage d'une source qui traite d'un
  autre sujet homonyme est ignoré.

### 3. Sources

Dans l'ordre de priorité :

1. **Wikipédia fr, en, hy, ru** (sitelinks Wikidata ; même API qu'aujourd'hui).
   Mesuré le 17 oct. : souvent plus fournies en hy/ru (Komitas hy 97 ko ;
   Kochari ru 32 ko contre 7,6 ko en fr).
2. **Encyclopédie soviétique arménienne (ՀՍՀ) sur hy.wikisource**, page
   `ՀՍՀ/<TITRE ARMÉNIEN EN CAPITALES>` (CC BY-SA 3.0). Riche en dates et noms ;
   datée 1974-1987, cadrage soviétique : **faits seulement**, pas
   d'interprétation. Absente pour certains sujets (pas de kochari) : sans
   entrée, on continue sans elle.
3. **Patrimoine immatériel UNESCO** pour les 8 éléments arméniens inscrits
   (doudouk 2008, khatchkar 2010, Sassna Tsrer 2012, lavash 2014, kochari
   2017, art de l'alphabet 2019, pèlerinage de Saint-Thaddée 2020, forge de
   Gyumri 2023). **Pas de récupération automatique** : les conditions de
   ich.unesco.org n'ont pas été vérifiées et son texte n'est pas sous licence
   libre. Une **table de faits curée à la main** (`unesco.json` : sujet →
   année, liste exacte, intitulé officiel, URL), vérifiée une fois sur le
   site, est injectée comme faits sourcés, avec le lien en attribution.
   *Mon choix.*
4. **Wikidata** : faits structurés (déjà en place) **et** image `P18` comme
   premier candidat image, avant la recherche Commons — la recherche
   « <titre> Armenian » a proposé un khatchkar pour le kochari.

Plus tard, hors de ce chantier : ARAR (bibliothèque numérique arménienne,
OAI-PMH, à tester), Gallica et Internet Archive pour des livres du domaine
public choisis à la main.

`meta.json.sources` liste toutes les sources réellement utilisées (langue,
titre, URL, révision), et la page en affiche l'attribution et la licence
(CC BY-SA 4.0 Wikipédia, CC BY-SA 3.0 Wikisource, UNESCO).

### 4. Rédaction

Consignes ajoutées à `buildDraftMessages` :
- point de vue arménien ; **aucune mention des variantes culturelles
  azerbaïdjanaises** (ni nom, ni inscription UNESCO, ni étymologie) ; un fait
  historique sourcé qui nomme l'Azerbaïdjan reste permis, énoncé sans
  commentaire ; **ne jamais affirmer un
  fait faux** — omettre est permis, déformer non ;
- chaque date, nombre et nom propre doit venir d'une source fournie ;
- rester sur l'entité Wikidata (homonymes ignorés).

### 5. Faits à vérifier — gratuit, sans IA payante

Le contrôle existant (extraction des faits + `findUnsupported`) est complété
par une **extraction mécanique** sans modèle : toutes les années, nombres et
dates du brouillon sont cherchés dans l'ensemble des sources. Les noms propres
sont confrontés aux sources fr/en **et** aux libellés/alias Wikidata fr/en
de l'entité du sujet et des entités déjà citées dans ses faits Wikidata —
**sans** recherche Wikidata par nom (trop d'appels). Un nom en écriture
arménienne ou cyrillique ne « contient » pas sa forme française : les noms
non retrouvés vont dans une section **« Noms à confirmer »**, repliée et
placée sous le texte, pour que la liste ⚠️ de tête reste courte (dates,
nombres, ligne éditoriale). *Mon choix.*

Un **contrôle de ligne éditoriale** mécanique signale (⚠️) toute occurrence de
termes azerbaïdjanais (liste à définir : « azerbaïdjan », « azéri »,
« Köçəri »…) — le modèle peut désobéir, le contrôle non. C'est une **alerte**,
jamais un blocage : le relecteur juge si la mention est un fait historique
permis ou une variante à retirer.

### 5 bis. Modèle de secours

`culture-llm.mjs` gagne une chaîne de repli, sur le modèle de celle de
`classify-rubrics.mjs` : Gemini d'abord, puis des modèles OpenRouter `:free`
sur 429 / 404 / délai. Elle n'est activée **que** pour le brouillon, la liste
des faits et `/corrige` ; le modèle réellement utilisé est écrit dans la PR
(ou la réponse au commentaire). La **traduction** n'appelle que Gemini : en
échec, `articles-publish.yml` ne fusionne pas et commente « traduction
reportée : Gemini indisponible », et la publication reprend au prochain
enregistrement de la PR.

### 6. Page de relecture lisible sur téléphone

La PR doit se relire **sans ouvrir l'onglet « Fichiers »** :
1. en tête, la liste ⚠️ (faits non retrouvés, alertes de ligne éditoriale,
   recouvrement) — courte ;
2. le **texte de l'article** en entier, rendu en Markdown ;
3. image retenue (aperçu + licence) ;
4. sources ;
5. mode d'emploi en deux lignes : « commentez `/corrige <consigne>` » et
   « cochez Faits vérifiés pour publier » ;
6. la case « Faits vérifiés ».

Le texte et la liste ⚠️ sont **réécrits à chaque révision** (entre
marqueurs), la case et son état sont préservés.

### 7. Corrections par commentaire — nouveau `articles-revise.yml`

- Déclenché par `issue_comment` (créé) sur une PR `culture/*` ouverte, dont
  le commentaire commence par **`/corrige`**, **et dont l'auteur est le
  propriétaire du dépôt** (`author_association == 'OWNER'`). Tout autre
  auteur est ignoré : un commentaire est une consigne envoyée au modèle,
  donc une injection possible.
- Le modèle reçoit le `fr.md` actuel, la consigne, et les **mêmes sources**
  qu'au brouillon ; il renvoie le `fr.md` corrigé (même format JSON que le
  brouillon).
- Les contrôles du §5 sont relancés : **un fait ajouté par la consigne et
  absent des sources est signalé** comme les autres (la consigne du relecteur
  fait foi pour lui, mais le signal reste visible).
- Commit sur la branche, mise à jour du corps de PR (§6), réponse au
  commentaire avec un résumé de ce qui a changé et le modèle utilisé. Statut
  `culture-check` publié par le job lui-même (commit `GITHUB_TOKEN`).
- Si la case « Faits vérifiés » est déjà cochée, la révision **ne publie
  pas** : elle la **décoche** et le dit dans sa réponse — publier reste le
  dernier geste du relecteur. *Mon choix.*
- Plusieurs consignes à la suite : `concurrency` par PR, sans annulation
  (chaque consigne s'applique dans l'ordre).

La traduction et la publication restent celles d'aujourd'hui
(`articles-publish.yml`) : cocher la case traduit depuis le français
**actuel**, contrôle, fusionne, relance le déploiement.

### 8. Idées de sujets validées — file qui ne se tarit pas

- Quand moins de **7** sujets sont disponibles, le job nocturne (après sa
  rédaction) ouvre ou met à jour **une** issue « Culture : idées de sujets »
  avec ~15 idées numérotées. *Seuils : mon choix.*
- Chaque idée est **résolue vers un `qid` Wikidata** par le script
  (recherche `wbsearchentities`) avant d'être proposée ; une idée sans
  entité, ou dont l'entité n'a ni article fr ni en, est écartée. Les idées
  respectent la ligne éditoriale (§4) et excluent les sujets déjà présents.
- Validation sur téléphone : le propriétaire commente **`/ajoute 1 4 7`** ;
  un job (`issue_comment`, même filtre OWNER) ajoute ces sujets à
  `sujets.json` (`status: pending`) par un commit sur `main`, et répond.
  `/rejette 2 3` les retire de la liste proposée.
- Les sujets de l'agenda gardent la priorité, comme aujourd'hui.

## Pannes

| Panne | Effet |
|---|---|
| 2 PR déjà ouvertes | Pas de rédaction ce jour, log explicite |
| `qid` sans article fr ni en | Sujet sauté, signalé dans le log et l'issue d'idées |
| ՀՍՀ ou UNESCO absent/en échec | Rédaction sans cette source, mention dans la PR |
| Quota Gemini épuisé (brouillon, `/corrige`) | Repli OpenRouter `:free` (§5 bis) ; modèle réel affiché |
| Quota Gemini épuisé (traduction) | Pas de fusion ; commentaire « traduction reportée » |
| `/corrige` échoue | Réponse au commentaire avec l'erreur ; branche inchangée |
| Commentaire d'un non-propriétaire | Ignoré, sans réponse |

## Tests (`npm test`, sans réseau)

- résolution des titres par sitelinks (y compris surcharge manuelle, page
  d'homonymie rejetée) ;
- titre ՀՍՀ dérivé du libellé arménien ;
- extraction mécanique des années/nombres et leur recherche multisource ;
- contrôle de ligne éditoriale (termes signalés) ;
- plafond de file (0, 1, 2 PR ouvertes) ;
- analyse de `/corrige`, `/ajoute`, `/rejette` et filtre `OWNER` ;
- réécriture du corps de PR entre marqueurs, case préservée ;
- résolution d'une idée vers un `qid` (réponses Wikidata en fixture).

## Laissé au constructeur

- Format exact des marqueurs du corps de PR et de la réponse aux
  commentaires.
- Liste précise des termes du contrôle de ligne éditoriale (à soumettre au
  relecteur dans la PR du chantier).
- Budget de taille des extraits par source dans le prompt.
- Mise à jour de `CLAUDE.md` (« Articles Culture ») : seulement les pièges
  silencieux nouveaux (homonymes par titre, filtre OWNER, grounding Google
  interdit).
