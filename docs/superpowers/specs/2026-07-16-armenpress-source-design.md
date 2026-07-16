# Armenpress comme source d'actualités — design

**Date** : 2026-07-16
**Projet** : Arménie Info (`armenieinfo.ch`)

## Objectif

Ajouter **Armenpress** (`armenpress.am`), l'agence de presse nationale
arménienne, comme sixième source du fil d'actualités, en **français, anglais et
arménien**, et en faire l'**onglet par défaut**.

Comme les cinq sources existantes, on ne prélève que **titres, liens, dates et
vignettes**, chaque tuile renvoyant à l'article sur armenpress.am. Aucun texte
d'article n'est repris.

## Pourquoi l'onglet par défaut — le vrai gain

La revue de la [PR #2](https://github.com/cobranian/ArmenianNews/pull/2) a établi
un défaut que le prérendu ne pouvait pas corriger seul : `NewsBrowser` ne rend
que l'onglet actif, donc le HTML prérendu ne contient que la source par défaut.
Or celle-ci est **ArmRadio**, qui n'a que des éditions `en` et `hy`
(`NewsBrowser.jsx` : `const armLang = lang === 'hy' ? 'hy' : 'en'`). Résultat
mesuré en production : **70 titres en anglais servis sous `<html lang="fr">`**,
sur un site qui vise `actualités arméniennes Suisse`. Du texte anglais ne gagnera
jamais une requête française.

**Armenpress a une vraie édition française.** En le plaçant par défaut, le
contenu prérendu devient français. C'est le premier changement depuis la PR #2
qui améliore réellement le contenu indexé, et il tient en une ligne.

## Contexte technique — ce qui a été vérifié le 2026-07-16

**Le site est accessible avec l'outillage existant.** Les 403 initiaux venaient
du User-Agent de `curl` ; `scripts/lib/http.mjs` envoie déjà un en-tête de
navigateur, qui obtient 200 sur `/fr`, `/en` et `/hy`.

**Armenpress est une application Inertia.js.** Chaque page embarque sa charge
utile dans `<script data-page="app" type="application/json">`. Attention au
piège : `data-page` vaut la chaîne `"app"` — le JSON est le **contenu** de la
balise, pas la valeur de l'attribut. Un `.attr('data-page')` renvoie `"app"`.

La charge utile de l'accueil contient `props.feed.data` : une réponse
**Meilisearch** (`hits`, `totalHits`, `page`…) avec **16 articles**. Champs
utiles par article :

| Champ | Usage |
|---|---|
| `title` | le titre |
| `article_id` | l'URL : `https://armenpress.am/{lang}/article/{article_id}` |
| `published_at` | timestamp Unix (secondes) → ISO |
| `image` | chemin relatif → préfixer `https://armenpress.am` |
| `locale` | contrôle : doit valoir la langue demandée |

**Aucun sélecteur CSS n'est nécessaire.** C'est ce qui distingue cette source des
cinq autres : elles cassent au prochain redesign, celle-ci ne casse que si la
charge utile change de forme.

**Le site limite agressivement le débit.** Une trentaine de requêtes en un quart
d'heure depuis une IP résidentielle suisse ont suffi à déclencher un 403
persistant sur *toutes* les pages. Ce fait gouverne toute la conception.

## Décisions écartées

**Les sept rubriques (`armenia`, `economy`, `world`, `culture`, `sports`,
`fact-check`, `projects`).** Demandées, puis retirées par le propriétaire le
2026-07-16 sur la base des faits suivants :

1. Les pages `/{lang}/articles/{slug}` existent bien dans les trois langues,
   mais **embarquent un flux vide** (`component=Articles/Feed`, zéro `hits`) :
   elles chargent leurs dépêches côté client, après le rendu.
2. Il resterait donc 7 rubriques × 3 langues = **21 requêtes par heure**, sur un
   site qui bloque à 30. Depuis les IP de datacenter de la CI, le pronostic est
   mauvais — c'est exactement le scénario `armradio.am`, qui a coûté un proxy
   Cloudflare Worker et une chaîne de repli à quatre niveaux.
3. Le paramètre `?feed=N` (pagination de l'accueil, `per_page: 16`) peuple
   peut-être les pages de rubrique. **Non vérifié** : le blocage l'a rendu
   intestable. Toute reprise du sujet doit commencer par établir ce fait.

**Reconstituer les rubriques depuis les tags de l'accueil.** Impossible, et
vérifié : les `hits` ne portent **aucun champ de rubrique**, et leurs `tags` sont
des facettes de type `location`, `person`, `organization`, `author`, `theme` —
sans rapport avec les sept rubriques.

**Puppeteer pour rendre les pages de rubrique.** Le rendu headless est réservé
aux scrapes manuels locaux (`fb-scrape`, `ig-scrape`) ; jamais dans le job
horaire.

**La pagination.** 16 articles par langue suffisent à un instantané horaire.

## 1. Le module — `scripts/sources/armenpress.mjs`

Une requête par langue via `fetchText`, **trois au total**, avec **une pause
d'une seconde entre chacune** — le site m'a bloqué aujourd'hui, la politesse
n'est pas décorative.

Signature, alignée sur les modules voisins :

```js
export async function scrapeArmenpress(limit = 16)
// → { fr: [{ categoryKey: 'fil', articles }], en: [...], hy: [...] }
```

Chaque langue échoue indépendamment : une langue en erreur renvoie un tableau
d'articles vide, et `scrape.mjs` la recycle depuis le snapshot précédent.

Contrôle de cohérence : si `hits[0].locale` ne vaut pas la langue demandée, la
langue est traitée comme un échec plutôt que de servir du contenu dans la
mauvaise langue.

## 2. Les données — `news.json`

```
armenpress: { fr: [{ categoryKey: 'fil', articles: [...] }], en: [...], hy: [...] }
```

Cette forme copie **exactement** celle d'`armradio` (`{ en, hy }`). L'intérêt
n'est pas cosmétique : elle permet de réutiliser `backfillSections(fresh, prev,
'categoryKey')` **sans y toucher**. La dégradation en douceur est gratuite.

Le tableau ne contient qu'une entrée puisqu'il n'y a qu'une rubrique — la forme
reste celle d'une liste de rubriques, pour que le motif tienne si les rubriques
reviennent un jour.

## 3. L'interface — `NewsBrowser.jsx`

Un sixième onglet, **placé en premier** dans le tableau retourné par
`buildSources`, ce qui en fait l'onglet par défaut (`useState(sources[0]?.id)`).

**Premier vrai trilingue du site** : `fr→fr`, `en→en`, `hy→hy`, là où ArmRadio se
rabat sur l'anglais. Le badge de langue affiche donc la langue de l'interface.

Une seule rubrique, donc un seul carrousel.

## 4. L'internationalisation — `src/i18n.jsx`

Deux clés par langue :

- `browser.armenpress` — le nom de la source dans le sélecteur d'onglets.
- `apcats.fil` — le libellé de la rubrique unique : **« Fil » / « Wire » /
  « Հոսք »**. Armenpress est l'agence de presse nationale : c'est littéralement
  un fil de dépêches. Choix du rédacteur de la spec, faute de préférence
  exprimée ; il tient en une ligne et se change sans risque.

## Vérification

Il n'y a pas de suite de tests : la vérification est l'exécution réelle.

1. **Le scrape** — `npm run scrape` imprime trois lignes `✓ armenpress/{fr,en,hy}
   (16)` et `news.json` gagne une clé `armenpress` avec les trois langues.
2. **Les données sont saines** — chaque article a un `title` non vide, une `url`
   en `https://armenpress.am/{lang}/article/`, une `date` ISO valide, et
   `hits[0].locale` correspond à la langue.
3. **L'onglet par défaut** — sur le site construit, le premier onglet est
   Armenpress, et en français il affiche des titres **français**.
4. **Le gain SEO, mesuré** — après `npm run build && npm run prerender`, les
   titres français d'Armenpress doivent apparaître dans le HTML brut de
   `dist/index.html`. C'est le test décisif : il prouve que le contenu indexé est
   passé de l'anglais au français.

   Utiliser `grep -o … | wc -l` et **non** `grep -c`, qui compte les lignes (voir
   la spec SEO du 2026-07-16).

## Fichiers touchés

- `scripts/sources/armenpress.mjs` — nouveau
- `scripts/scrape.mjs` — appel + backfill de la nouvelle source
- `src/components/NewsBrowser.jsx` — sixième onglet, placé en premier
- `src/i18n.jsx` — `browser.armenpress` et `apcats.fil` × 3 langues
- `CLAUDE.md` — une ligne dans la liste de `scripts/sources/` (l. 92-98)
- `README.md` — une ligne dans le tableau « Sections » (l. 15-22)

### Une dette de documentation trouvée en chemin

Les deux listes ci-dessus sont **déjà périmées** : elles décrivent quatre sources
(`courrier`, `armradio`, `armenopole`, `instagram`) alors que `scripts/sources/`
en contient sept — **`armenews`, `artzakank` et `armenieinfotv` n'y figurent
nulle part**, ni dans le tableau du README, ni dans la liste de `CLAUDE.md`.

Y ajouter Armenpress sans plus rendrait la liste plus trompeuse, pas moins : un
lecteur y verrait cinq sources sur sept et croirait la liste exhaustive. Cette
spec ajoute donc **les quatre lignes manquantes** (`armenews`, `artzakank`,
`armenieinfotv`, `armenpress`), ce qui remet les deux documents en accord avec le
code. C'est le strict périmètre des fichiers déjà touchés — aucun autre
rattrapage documentaire n'est entrepris ici.

## Ce que cette spec ne promet pas

Le gain SEO reste **partiel et indirect**. Passer le contenu prérendu de
l'anglais au français est une vraie amélioration, mais les titres d'Armenpress
restent des dépêches agrégées : sur le texte d'une dépêche, l'original battra
toujours l'agrégateur. Ce qui vise `actualités arméniennes Suisse` demeure le
titre, le tagline et l'agenda suisse — et, plus que tout, **les liens entrants**,
qu'aucun commit ne créera.
