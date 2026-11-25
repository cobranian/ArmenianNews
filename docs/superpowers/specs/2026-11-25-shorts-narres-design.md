# Shorts narrés et ouverture qui accroche — conception

25 novembre 2026. Validé en conversation : l'approche « C » (texte + gabarit +
voix narrée), Gemini TTS, alternance de voix d'hommes et de femmes.

## Pourquoi

Augmenter trois choses à la fois : les **vues** des Shorts, les **abonnés** des
sept chaînes, les **visites** vers armenieinfo.ch et armenianews.org.

Mesures de départ (chaîne hy, 26 oct.–25 nov. 2026, vidIQ) :

- 95 % des vues viennent du fil Shorts : l'algorithme pousse déjà ces vidéos ;
- ~46 % de « vues engagées » : la moitié des gens passe dès le début ;
- ~45 % de la vidéo regardée en moyenne (~20 s sur 44) ;
- ~1 abonné pour 400 vues ; 1 seule visite externe en un mois.

Diagnostic : l'ouverture est encyclopédique (« ARMÉNIE · 405 / L'alphabet
arménien / Créé par… ») et muette de voix ; rien n'invite à s'abonner ni ne
nomme le site. Un Short ne peut pas porter de lien cliquable (YouTube les a
retirés des descriptions et commentaires de Shorts en 2023) : le site gagne en
étant **nommé**, à l'oral et à l'écran.

## Objectifs

1. Chaque Short futur porte une **voix narrée, intégrée à la vidéo** dans sa langue (Gemini TTS), sur la
   musique actuelle baissée sous la voix.
2. Le **premier fait est une accroche** : surprise, contradiction ou question,
   tirée de l'article — plus une notice d'encyclopédie.
3. L'ouverture est **lisible dès la première image** (pas de fondu d'entrée).
4. La **durée de chaque scène suit la voix**, au lieu d'accélérer la voix pour
   tenir dans 5,6 s.
5. La fin **dit et montre** le site et invite à s'abonner.
6. Les voix **alternent homme / femme** d'un sujet à l'autre, dans chaque langue.

## Non-objectifs

- **Aucune vidéo déjà publiée n'est refaite.** Les remettre en ligne créerait
  des doublons et perdrait leurs vues.
- Pas de vidéos longues pour l'instant (seule voie de liens cliquables : plus
  tard, si le reste marche).
- Pas de changement de la publication (envoi Chrome, file `youtube-queue.json`,
  Reels) : elle reçoit simplement des MP4 qui ont une voix.
- Pas de sous-titres mot à mot synchronisés (le texte à l'écran existe déjà).

## Anti-objectifs (échec même si « ça marche »)

- **Une voix qui dit un fait absent de l'article.** La règle « aucun fait qui ne
  soit dans l'article de la même langue » vaut pour le texte parlé comme pour le
  texte affiché.
- **Une accroche qui survend** (« le secret que personne ne connaît ») : la
  promesse doit être tenue par la vidéo, sinon la confiance et la rétention
  tombent.
- **Une langue publiée muette** parce que la synthèse a échoué en silence : un
  Short sans voix doit être un échec visible, pas un repli discret.
- **Voix et image désynchronisées** (phrase qui déborde sur la scène suivante,
  phrase de fin coupée) — défaut constaté sur l'essai du 25 nov.

## Contraintes mesurées (essais du 25 nov.)

- **Gemini 3.8 Flash TTS** (`gemini-3.8-flash-tts`, API Interactions,
  `/v1beta/interactions`, réponse WAV 24 kHz mono base64 dans
  `steps[].content[]`) lit fr, en, de, it, es, **ru et hy en natif** ; Nareg a
  jugé l'arménien et le russe corrects.
- La clé du projet **armenie-info** est en « Tier 1 » : **10 requêtes/minute,
  100 requêtes/jour** pour ce modèle. Une requête par phrase (8 × 7 = 56 par
  sujet) ne laisse place qu'à un sujet par jour, sans marge d'échec.
- Coût : quelques centimes par sujet (≈ 25 jetons audio/s).
- Les textes affichés (`text`, ≤ 130 car.) sont trop longs pour être dits en
  5,6 s : de 6 à 9 s à voix haute. Les accélérer (×1,45 testé) sonne pressé.
- Même raccourcies (~70–90 car.), les phrases durent 5 à 7 s.
- Le service Microsoft gratuit (edge-tts) n'a pas de voix arménienne et ses
  voix russes refusaient de répondre : écarté.
- ElevenLabs gratuit interdit l'usage commercial : écarté.

## Approches considérées

- **A. Texte seul** (accroche + fin) : peu de travail, mais l'ouverture garde
  son rythme et reste muette.
- **B. Texte + gabarit** : accroche, ouverture immédiate, fin avec site et
  abonnement. Sans voix.
- **C. B + voix narrée** — **retenue par Nareg** après écoute des essais. Plus gros
  levier de rétention attendu, au prix d'un appel TTS par langue et d'un texte
  parlé à relire.

Fournisseur de voix : **Gemini TTS**, choisi par Nareg contre Microsoft
(edge-tts) après écoute des sept langues.

## Ce qui est décidé

### Le texte parlé

- Chaque fait de `short.<lang>.json` gagne un champ **`spoken`** : la phrase
  dite, plus courte que `text` (cible ≤ 90 caractères), **mêmes faits, mêmes
  chiffres**, écrite pour l'oreille (nombres en toutes lettres quand c'est plus
  naturel, pas de parenthèses, pas d'abréviations).
- `spoken` est **écrit par le même modèle et au même moment** que le reste du
  short : `culture-draft.mjs` (fr), `culture-translate.mjs` (autres langues),
  `culture-revise.mjs` (`/corrige`). Il est donc **relu dans la PR** avec le
  reste, et couvert par `sourceHash` (il entre dans `shortHash`).
- `validateShort` exige `spoken` sur les 7 faits, sa longueur max, et que ses
  nombres figurent dans l'article (même contrôle que pour `text`).
- **Les nombres restent en chiffres dans `spoken`** (« 2019 », « 36 ») : Gemini
  TTS les lit lui-même dans chaque langue, et seul un nombre en chiffres passe
  le contrôle `numbersOf` contre l'article. Un nombre écrit en lettres
  échapperait au seul garde-fou automatique — et de/it/es ne sont pas relus.
  *(Décision de conception, sur remarque de la relecture.)*
- **Articles existants : pas de rattrapage.** Au 25 nov. 2026, aucune PR
  `culture/*` n'est ouverte et toutes les langues des 36 articles sont rendues
  (la file YouTube ne contient que deux Shorts déjà rendus). `spoken` est donc
  exigé **seulement pour les articles datés de la mise en service ou après**
  (date du front matter de `fr.md`, seuil écrit dans le code). Les anciens
  shorts restent valides sans `spoken`, ne sont jamais re-rendus, et leur
  `shortHash` ne change pas (`spoken` absent n'entre pas dans l'empreinte, pour
  ne pas périmer leurs traductions). Le rendu, lui, **refuse** un short sans
  `spoken` : un ancien article qu'on relancerait à la main échoue visiblement
  au lieu de sortir muet. *(Décision de conception.)*
- La **phrase de fin** (site + abonnement) n'est **pas** rédigée par le modèle :
  c'est une constante par langue dans le code, relue une fois. Elle nomme le
  domaine de la chaîne (fr/de/it → Arménie Info, armenieinfo.ch ;
  en/es/hy/ru → Armenia News / Արմենիա Ինֆո, armenianews.org).

### L'accroche

- `FORMAT.md` et les consignes de rédaction du short changent : le fait 1 est
  une accroche **vérifiable dans l'article** (un chiffre, une surprise, une
  contradiction, une question à laquelle la vidéo répond), `title` ≤ 30
  caractères comme aujourd'hui. Les patrons d'accroche du skill
  `viral-hooks` servent de référence à la consigne, filtrés par la règle
  « pas de survente ».
- Le nom du sujet reste visible dans la première scène (sourcil ou titre).

### La voix

- Modèle `gemini-3.8-flash-tts`, consigne de style commune
  (« narrateur de documentaire, calme et chaleureux, diction claire, débit
  naturel »).
- **Deux voix par langue, une femme et un homme**, dans une table
  (`VOICES[lang] = { female, male }`). Choix de Nareg (25 nov., sur les
  28 échantillons) :

  | Langue | Femme | Homme |
  |---|---|---|
  | fr | Kore | Sadaltager |
  | en | Kore | Sadaltager |
  | de | Kore | Sadaltager |
  | it | Sulafat | Sadaltager |
  | es | Sulafat | Sadaltager |
  | hy | Sulafat | Sadaltager |
  | ru | Kore | Sadaltager |
- **Alternance par sujet** : la voix d'un Short est déterminée par le sujet,
  pas tirée au hasard, pour qu'un nouveau rendu donne la même voix.
- **La table est complète avant la mise en service** : les 7 langues × 2 voix
  sont choisies par Nareg sur les échantillons du 26 nov., avant la fusion. Un
  test exige une entrée femme et une entrée homme pour chacune des 7 langues ;
  le code n'a donc pas de voix « par défaut ». *(Décision de conception.)*
- Musique : la piste actuelle continue, **baissée sous la voix** (≈ −10 dB
  pendant la parole), fondus inchangés.

### Le gabarit (Remotion)

- **Durée de scène = durée de la phrase + marge**, avec un minimum
  (aujourd'hui 6 s). La durée totale de la composition en découle
  (`calculateMetadata` de Remotion, ou durées écrites par `sync.mjs`).
- **Première scène sans fondu d'entrée** : titre et texte présents dès la
  première image.
- **Écran de fin** : la phrase de fin est dite, et l'écran montre le nom du site
  et un appel à s'abonner (en plus de l'URL déjà affichée).

### Où la voix est fabriquée

- Au **rendu**, dans `video.yml` (CI), avant Remotion : une étape appelle
  Gemini TTS pour chaque langue à rendre, écrit les WAV dans `video/public/`
  (hors git), puis Remotion les lit comme la musique. Le secret
  `GEMINI_API_KEY` est ajouté à ce workflow.
- **Une langue dont la voix échoue n'est pas rendue** (même mécanique
  qu'aujourd'hui : « langue sautée », run rouge, signalement sur le tableau de
  bord #128) ; un nouveau lancement la reprend. Jamais de Short muet en repli.

## Laissé au constructeur

- **Une requête par phrase, ou une par langue.** Mesuré le 25 nov. sur
  `gemini-3.8-flash-lite-tts` (28 essais) : la narration entière en une requête,
  avec `<long pause>` entre les phrases, **ne se découpe correctement que dans
  8 cas sur 28**. Le modèle place des pauses au milieu des phrases et en
  escamote parfois une demandée, même en ne gardant que les 7 silences les plus
  longs. Le découpage d'une requête unique n'est donc pas fiable, au moins sur
  Lite ; à re-mesurer sur `flash-tts`. Sans découpage fiable : **une requête
  par phrase** (56 par sujet, dans le quota de 100/jour pour un sujet par jour),
  avec `flash-lite-tts` en secours quand le quota de `flash-tts` est épuisé
  (quotas séparés ; constaté le 25 nov.).
- La règle exacte d'alternance (parité de l'ordre de publication, ou autre),
  pourvu qu'elle soit déterministe et alterne d'un sujet au suivant.
- Les valeurs de marge, de minimum de scène et de baisse de la musique.
- Le cache des WAV d'un rendu à l'autre (release, cache Actions, ou rien).
- Le libellé exact de l'appel à s'abonner dans les 7 langues (relu par Nareg
  pour hy et ru).

## Questions ouvertes (à Nareg)

Aucune. Document validé par Nareg le 25 nov. 2026, table des voix complète.

## Mesure du succès

Comparer, sur chaque chaîne, les 10 premiers Shorts avec voix aux 10 derniers
sans voix : vues engagées / vues (aujourd'hui ~46 % sur hy), pourcentage moyen
regardé (~45 %), abonnés gagnés pour 1 000 vues (~2,5). Données : vidIQ
(seule la chaîne hy y est branchée ; brancher les autres pour mesurer partout).

## À ne pas oublier

- `video/` contient des modifications non commitées (`Root.tsx`, `music.json`,
  `erebuni-rome/`) qui ne sont pas de ce chantier : travailler dans un worktree
  et ne pas les toucher.
- `video/` est un paquet npm à part : `npm --prefix video ci`, `npm run video:test`.
