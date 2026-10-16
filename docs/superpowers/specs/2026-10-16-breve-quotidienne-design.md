# Brève quotidienne — design

Date : 2026-10-16
Statut : validé en conversation (sections 1 à 3), spec à relire.

## But

Donner au site un **contenu propre**, indexable, sans rien republier : chaque
jour et dans chaque langue, une brève qui **croise** les sources déjà agrégées
— les sujets que plusieurs rédactions couvrent — et **renvoie** à leurs
articles. Objectif : plus de pages utiles à Google, plus de temps passé, plus
de clics sortants vers les sources, et à terme une base éligible à AdSense.

Rappel du cadre (sous-projet 1, rubriques communes) : la réécriture ou la
republication d'articles a été **écartée** — Armenpress l'interdit par écrit,
et Google comme AdSense sanctionnent le contenu réécrit. La brève résume des
**titres** et cite ; elle ne reproduit aucun corps d'article.

Décisions prises en conversation :

| Question | Décision |
|---|---|
| Rythme et langues | une brève par jour, quatre langues (fr sur le .ch, en/hy/ru sur le .org) |
| Relecture | **publication automatique, sans garde-fou sur le texte** |
| Adresse et indexation | archive datée indexée + page de la dernière brève |
| Forme | 5 à 7 sujets croisés, ~400–600 mots, rubrique commune en étiquette |
| Architecture | génération au scrape, **pages HTML statiques écrites au build** (pas de vue React, pas de prérendu) |

Hors champ (YAGNI) : newsletter, flux RSS de la brève, régénération ou édition
manuelle d'une brève (le JSON se corrige à la main si besoin), image de partage
propre à chaque brève, bloc de la brève sur l'accueil.

## 1. Génération et données

### Quand

`scripts/scrape.mjs` appelle, après le classement des rubriques, un module
`scripts/lib/brief.mjs`. Pour chacune des quatre langues :

- la **date de la brève** est la date murale d'Erevan (`Asia/Yerevan`) au moment
  du scrape ;
- la brève est **due** si `src/data/briefs/{lang}/{AAAA-MM-JJ}.json` n'existe pas
  et qu'il est **7 h ou plus** à Erevan (pas de brève générée entre 0 h et 7 h :
  la journée n'a pas encore d'actualité) ;
- une brève écrite n'est **jamais régénérée** : l'URL datée garde un contenu
  stable.

Un échec n'écrit rien ; le passage de l'heure suivante réessaie, jusqu'à la fin
de la journée d'Erevan. Une journée sans brève est le seul mode de panne visible
côté lecteur.

### Ce qu'on envoie au modèle

1. Les articles de la langue, pris dans les sources que `TAB_ORDER`
   (`src/newsSources.js`) attribue à cette langue — la même règle que le fil.
2. Filtrés aux **24 dernières heures** (champ `date` ; un article non daté est
   écarté), dédoublonnés par URL, triés du plus récent au plus ancien,
   **plafonnés à 100**.
3. **Moins de 10 articles → pas de brève** ce jour-là (contenu mince), avec une
   ligne au log ; nouvel essai l'heure suivante.
4. Chaque article est envoyé comme `{ id, source, rubrique, titre }`, où `id`
   est un entier court propre à l'appel et `rubrique` la rubrique commune
   (`src/rubrics.js`, via `RUBRIC_MAP` et `rubric-cache.json`).

La consigne demande, **dans la langue de la page** : une introduction d'une ou
deux phrases, puis 5 à 7 sujets, en privilégiant ceux que **plusieurs sources**
couvrent ; pour chacun un titre, 2–3 phrases, une rubrique parmi les neuf clés,
et la liste des `ids` qui le traitent. Elle interdit d'affirmer ce qui ne figure
pas dans les titres et exige une réponse JSON :

```json
{ "intro": "…", "topics": [{ "title": "…", "text": "…", "rubric": "politique", "ids": [3, 17] }] }
```

### Ce que fait le code

- Les `ids` sont remplacés par `{ source, url, title }` depuis les articles
  envoyés. **Le modèle ne fournit jamais d'URL** : un id inconnu est ignoré, un
  sujet sans id valide est retiré. Ce n'est pas un garde-fou sur le texte, mais
  la condition pour bâtir des liens qui ne mènent ni à un 404 ni à un site tiers.
- Une `rubric` hors des neuf clés devient `null` (le sujet s'affiche sans
  étiquette).
- **Réponse rejetée** (pas d'écriture, nouvel essai l'heure suivante) si elle
  n'est pas un JSON lisible, ou s'il reste **moins de 3 sujets** après
  résolution des ids.

Fichier écrit, `src/data/briefs/{lang}/{AAAA-MM-JJ}.json` :

```json
{
  "date": "2026-10-16",
  "lang": "fr",
  "generatedAt": "2026-10-16T03:23:41Z",
  "model": "nvidia/nemotron-3.5-lightning:free",
  "intro": "…",
  "topics": [
    { "title": "…", "text": "…", "rubric": "politique",
      "sources": [{ "source": "armenpress", "url": "https://…", "title": "…" }] }
  ]
}
```

### Modèle et coût

- Même clé (`OPENROUTER_API_KEY`) et même chaîne que le classeur
  (`DEFAULT_MODEL` puis `FALLBACK_MODELS`, `scripts/lib/classify-rubrics.mjs`) —
  partagées, pas recopiées.
- Délai **180 s** par appel (un seul appel par langue et par jour, contre des
  lots de 40 titres pour le classeur — 80 titres dépassaient 90 s).
- 4 appels réussis par jour, dans le quota gratuit.
- Échec : `✗ brief/{lang}: <raison>` au log, sur le modèle de `✗ classify`.

### Stockage

`src/data/briefs/` est versionné par le commit horaire existant (~4 Ko par jour
et par langue). **Rien n'est importé dans le bundle React** : seul le module de
build lit ces fichiers.

## 2. Pages, URL et SEO

### Adresses

Slugs latins, traduits là où le mot change (même règle que `agenda`/`events`),
avec **slash final** (même piège 301 Firebase que les vues) :

| Langue | Dernière brève | Brève datée |
|---|---|---|
| fr (.ch) | `/breve/` | `/breve/2026-10-16/` |
| en (.org) | `/brief/` | `/brief/2026-10-16/` |
| hy (.org) | `/hy/brief/` | `/hy/brief/2026-10-16/` |
| ru (.org) | `/ru/brief/` | `/ru/brief/2026-10-16/` |

Table `BRIEF_SLUGS` dans `sites.config.js`, à côté de `VIEWS` mais **distincte** :
une brève n'est pas une vue React (pas de route, pas de prérendu). Fonctions
dérivées `briefUrl(lang, date?)` / `briefPath(lang, date?)` ; aucune URL de
brève écrite à la main hors des tests.

### Contenu

**Page datée** : date en toutes lettres (formateurs de `src/hyDate.js` pour
l'arménien, jamais `Intl` en `hy`), introduction, puis les sujets — titre,
étiquette de rubrique (libellés des rubriques communes), texte, et une ligne
« Sources : Armenpress · CivilNet » dont chaque nom pointe sur l'article. Une
mention discrète, traduite dans les quatre langues : « Synthèse automatique des
titres du jour — lisez les articles d'origine. » Liens « veille » / « lendemain »
vers les brèves voisines existantes, et vers l'accueil.

**`/breve/`** : la dernière brève en entier, puis l'archive (toutes les dates,
groupées par mois, la plus récente d'abord). Canonical sur elle-même : elle
change chaque jour, comme l'accueil.

Langue vide (aucune brève encore) : `/breve/` existe quand même, avec un
paragraphe « La première brève paraîtra demain matin » — l'URL est liée depuis
la nav dès le déploiement.

### Gabarit

HTML complet écrit par `scripts/lib/brief-pages.mjs`, appelé par
`scripts/build-sites.mjs` après les deux `vite build` :

- la feuille CSS que Vite a produite, retrouvée dans le `index.html` bâti de la
  vitrine (nom haché) — donc la même palette et les mêmes jetons
  `--font-*`/`--fsa-*` que le site ;
- `theme-init.js` pour respecter le thème jour/nuit choisi par le lecteur ;
- une barre de navigation **statique** (marque, Accueil / Radio / Agenda /
  Brève), sans le JavaScript de l'application ;
- les classes nouvelles (`.brief*`) vont dans `src/styles/global.css`, en
  respectant la convention `font-family` + `font-size-adjust`.

### En-tête

Produit par `scripts/lib/site-meta.mjs`, étendu pour accepter une brève
(`{ siteId, lang, brief: { date? } }`) — un seul générateur, comme pour les
vues :

- `<html lang>`, title, description (l'introduction de la brève), canonical,
  Open Graph complet (bloc de six balises, carte de la vitrine), polices
  préchargées, beacon Cloudflare et GA de la vitrine ;
- **hreflang** :
  - sur `/breve/` : les quatre langues et `x-default` (la page existe toujours) ;
  - sur une page datée : **seulement les langues qui ont une brève ce jour-là**,
    réciproquement, plus `x-default` vers l'anglais s'il existe. Une langue
    citée sans page ferait ignorer tout le bloc par Google ;
- JSON-LD `NewsArticle` : `headline`, `datePublished` (= `generatedAt`),
  `inLanguage`, `publisher` (la vitrine), `citation` (les URL sources).

### Maillage et indexation

- Lien « Brève du jour » dans la nav et le bloc « Pages » du pied de page de
  l'application, et sur la page 404 (`scripts/lib/not-found.mjs`).
- Pages indexables, présentes dans le sitemap de leur vitrine (`/breve/` avec
  `lastmod` = `meta.json.generatedAt`, chaque page datée avec son
  `generatedAt`).
- `npm run check` (`scripts/check-build.mjs`) contrôle chaque page de brève :
  `lang`, canonical, hreflang réciproques, absence du domaine voisin, présence
  dans le sitemap, et le lien de la nav.

## 3. Erreurs, tests, déploiement

### Modes de panne

| Cas | Effet | Signal |
|---|---|---|
| Modèle en échec toute la journée | pas de brève ce jour ; `/breve/` montre la précédente ; aucune page datée manquante n'est annoncée | `✗ brief/{lang}` à chaque heure |
| JSON illisible ou < 3 sujets valides | rejet, nouvel essai l'heure suivante | `✗ brief/{lang}: réponse invalide` |
| < 10 articles en 24 h | pas de brève | `· brief/{lang}: trop peu d'articles (n)` |
| Clé expirée / quota | les quatre langues en échec | comme `✗ classify` |

### Tests (sans réseau)

- `test/brief-due.test.mjs` — date d'Erevan et règle « 7 h et fichier absent »,
  y compris autour de minuit UTC et de minuit à Erevan.
- `test/brief-select.test.mjs` — sources par langue via `TAB_ORDER`, fenêtre de
  24 h, articles non datés écartés, dédoublonnage, plafond de 100, seuil de 10.
- `test/brief-parse.test.mjs` — réponse du modèle → JSON de brève : ids résolus,
  id inconnu ignoré, sujet sans source retiré, rubrique inconnue → `null`,
  rejet sous 3 sujets ou JSON illisible, aucune URL venue du modèle.
- `test/brief-pages.test.mjs` — URL dérivées de `BRIEF_SLUGS` avec slash final,
  hreflang réciproques limités aux langues présentes, canonical, `NewsArticle`,
  veille/lendemain, archive de `/breve/`, page vide, aucune page sur la mauvaise
  vitrine.
- `npm run check` étendu (voir ci-dessus).

### Déploiement

Rien de nouveau côté infrastructure : même workflow horaire, même commit de
données, même build ; le secret `OPENROUTER_API_KEY` est déjà en place. Les
pages de brève n'ajoutent rien au prérendu. La sonde post-déploiement vérifie
que `/breve/` (.ch) et `/brief/` (.org) répondent 200.

À documenter dans `CLAUDE.md` après la mise en œuvre, seulement ce qui est
silencieux : le hreflang limité aux langues présentes, et le fait qu'une brève
écrite n'est jamais régénérée.
