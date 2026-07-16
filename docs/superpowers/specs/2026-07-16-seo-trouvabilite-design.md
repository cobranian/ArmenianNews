# Trouvabilité dans Google — design

**Date** : 2026-07-16
**Projet** : Arménie Info (`armenieinfo.ch`)

## Objectif

Rendre le site trouvable dans Google sur quatre requêtes :

| Requête | État | Cible |
|---|---|---|
| `armenieinfo.ch` | acquis (site indexé, aucun concurrent) | conserver |
| `Arménie Info Suisse` | non positionné | premières places — terrain libre |
| `actualités arméniennes Suisse` | non positionné | premières places — terrain libre |
| `Arménie Info` | non positionné | une présence, pas la première place |

## Contexte et contraintes

**Un homonyme occupe la requête `Arménie Info`.** [armenieinfo.tv](https://armenieinfo.tv/)
est un média établi de la diaspora arménienne de France : domaine en
correspondance exacte, des années d'ancienneté, page Facebook de 12 000+
abonnés. Google lui donne la requête, avec armenews.com et franceinfo. Aucune
modification de ce dépôt ne renversera ça à court terme. C'est une contrainte
acceptée, pas un problème à résoudre : le mot **« Suisse »** est ce qui nous
distingue, et personne ne le défend.

**Le site est indexé** (confirmé par le propriétaire via Search Console). Le
travail n'est donc pas d'entrer dans l'index mais d'être choisi.

**Deux faiblesses identifiées dans le code :**

1. Le mot « Suisse » n'est ni dans le `<title>` ni dans le texte visible du
   haut de page — seulement dans `<meta name="description">`.
2. Le site est une SPA à une seule URL : le HTML brut ne contient que
   `<div id="root">`. Vérifié en récupérant la page — aucun article n'y est
   lisible. Google exécute le JS, mais dans une seconde passe, plus lente et
   moins fiable. Les mots des articles ne comptent pas de façon sûre — ce qui
   touche directement `actualités arméniennes Suisse`, une requête de contenu.

**Ce qui est hors de portée du code.** Sur `actualités arméniennes Suisse`, les
liens entrants pèsent plus lourd que tout ce qui suit. Le code prépare le
terrain ; la notoriété gagne la place. Gain attendu du seul travail technique :
réel mais modeste.

## Décisions écartées

- **Un routeur et des pages `/actualites`, `/agenda`** — refonte d'architecture
  pour un site dont l'identité est d'être un instantané d'une seule page. YAGNI.
- **Mettre les mots-clés dans le H1** — « Arménie Info » est la marque. La
  noyer sous des mots-clés se voit.
- **`hydrateRoot`** — voir §2.

---

## 1. Ciblage géographique (les mots)

Trois changements. Le H1 n'est pas touché.

| Élément | Aujourd'hui | Proposé |
|---|---|---|
| `<title>` (`index.html`) | `Arménie Info · Արմենիա Ինֆո` | `Arménie Info · Actualités arméniennes de Suisse` |
| `site.tagline` (fr, `src/i18n.jsx`) | `Un instantané quotidien de l'Arménie et de sa diaspora` | `Un instantané horaire de la vie arménienne, de Suisse et du monde` |
| `og:title`, `twitter:title` | `Arménie Info · Արմենիա Ինֆո` | alignés sur le nouveau `<title>` |

**Justification.** Le titre fait 47 caractères, sous la coupe d'affichage de
Google. « Arménie Info » reste en tête : la marque passe avant les mots-clés.
Le tagline place « Suisse » dans le texte visible juste sous le H1, ce qui vaut
plus qu'une balise. Au passage, « quotidien » devient « horaire », ce qui
corrige une contradiction avec le snapshot horaire réel.

**Coût accepté.** « Արմենիա Ինֆո » sort du `<title>`. Il reste dans
`og:site_name`, le JSON-LD (`alternateName`) et le H1 en arménien.

**Périmètre.** Seul le tagline **français** change. Les taglines `en` et `hy` ne
sont pas touchés : le ciblage « Suisse » vise une requête française.

## 2. Prérendu au build — `scripts/prerender.mjs`

Nouveau script, calqué sur `scripts/shoot.mjs` (même détection de Chrome via
`puppeteer-core`, même serveur `vite preview`).

**Étapes :**

1. Servir `dist/` avec `preview`, ouvrir la page, attendre `networkidle0`.
2. **Stamper la classe `is-visible` sur tous les `.reveal`** avant
   sérialisation. Sans ça, `.reveal { opacity: 0 }` (`global.css:1911`) livre à
   Google une page transparente — le contenu est masqué tant que
   `useReveal` n'a pas déclenché l'animation au scroll.
3. Sérialiser le `#root` rendu et le réinjecter dans `dist/index.html`.

**Pas de `hydrateRoot`.** On garde `createRoot` (`src/main.jsx`), qui vide le
conteneur et re-rend de zéro. React ne tente donc jamais de réconcilier le HTML
prérendu : aucun risque de mismatch d'hydratation. Le HTML sert le crawler,
React reprend la main pour l'utilisateur.

**Langue.** Le prérendu rend le français, langue par défaut — cohérent avec
`<html lang="fr">` et le canonical.

**Fraîcheur.** Le build tourne déjà toutes les heures : chaque snapshot est
prérendu, donc le HTML brut porte toujours les articles du moment.

**Couverture — limite découverte à l'implémentation (2026-07-16).** Le prérendu
ne capture que ce que le DOM contient, et `NewsBrowser` est une interface à
onglets : seule la source active est rendue. Mesure réelle : **70/366 articles
(19 %)**, tous d'ArmRadio, l'onglet par défaut. Le Courrier d'Erevan, Nouvelles
d'Arménie, Artzakank et Arménie Info TV sont derrière un clic et n'atteignent
jamais le HTML.

En revanche l'agenda est rendu en entier — **10/10 événements suisses, 10/10
monde** — de même que le titre, le tagline et l'identité du site.

**Décision du propriétaire, 2026-07-16 : on s'arrête là.** Le raisonnement : les
81 % manquants sont des gros titres agrégés depuis d'autres médias, sur lesquels
l'original battra toujours l'agrégateur — les baker n'apporterait rien aux
requêtes cibles. Ce qui les vise (le tagline « de Suisse », l'agenda suisse) est
prérendu. Rendre les onglets inactifs en CSS pour gagner les 81 % changerait le
comportement de l'application et quintuplerait le DOM pour du contenu dupliqué
que Google pondère faiblement.

Ma spec initiale affirmait que le prérendu rendait « les articles » lisibles,
sans avoir vérifié ce que le DOM contenait. C'était faux. Le résultat tient
quand même, mais pour une raison différente de celle que j'avais écrite.

**CI** (`.github/workflows/hourly.yml`) : une étape après le screenshot,
réutilisant le Chrome déjà installé par `browser-actions/setup-chrome`, en
**`continue-on-error: true`**. Si le prérendu échoue, on déploie la SPA telle
qu'elle est aujourd'hui — jamais de build cassé. C'est la dégradation en
douceur des scrapers, appliquée au build.

**Script npm** : `npm run prerender`, à lancer après `npm run build`.

## 3. Sitemap — `lastmod`

`public/sitemap.xml` annonce `changefreq: hourly` sans jamais prouver un
changement. Ajouter un `<lastmod>` alimenté par `meta.generatedAt` à chaque
snapshot.

**Qui l'écrit** : `scripts/scrape.mjs`, à la fin du snapshot, au même moment que
`meta.json` — c'est lui qui détient `generatedAt`. Pas le build : un push sur
`main` rebuild sans scraper, et le `lastmod` mentirait.

Le sitemap devient donc un fichier généré, mais il reste **committé** : il vit
dans `public/` (copié tel quel par Vite), et le site doit fonctionner sans
scrape. L'étape « Commit refreshed data » de `hourly.yml` doit donc ajouter
`public/sitemap.xml` à sa liste de fichiers, à côté des JSON de `src/data/`.

## 4. Hors-code (pour mémoire, pas dans ce plan)

Ce qui pèsera le plus, et qu'aucun commit ne fera :

- un lien depuis ArmeniensDeLausanne (projet voisin du dépôt parent) ;
- des liens depuis les réseaux sociaux du site ;
- des liens depuis les associations arméniennes de Suisse.

## Vérification

Le site étant déjà indexé, le succès se mesure hors du dépôt :

1. **Prérendu** — `curl https://armenieinfo.ch/ | grep` sur un titre d'article
   **d'ArmRadio** (l'onglet par défaut — voir « Couverture » plus haut) : le
   texte doit apparaître dans le HTML brut, sans exécution de JS. C'est le test
   décisif, et il est immédiat après déploiement.

   **Mesuré en production le 2026-07-16, après fusion** : 70/70 articles
   ArmRadio et 10/10 événements de l'agenda suisse présents dans le HTML servi ;
   HTML de 182 657 octets contre ~13 Ko sans prérendu. La taille est le
   coup d'œil le plus rapide.

   Pour compter les `.reveal` marqués, utilisez `grep -o "is-visible" | wc -l`
   (attendu : 11) et **non** `grep -c`, qui compte les lignes et répond `1` sur
   un HTML servi en ~92 lignes.
2. **Titre** — l'inspection d'URL dans Search Console montre le nouveau
   `<title>`.
3. **Requêtes** — le rapport « Performances » de Search Console, filtré sur
   `Suisse`, sur plusieurs semaines. Un déplacement de classement n'est pas
   observable en heures.

## Fichiers touchés

- `index.html` — `<title>`, `og:title`, `twitter:title`
- `src/i18n.jsx` — `site.tagline` (fr uniquement)
- `scripts/prerender.mjs` — nouveau
- `package.json` — script `prerender`
- `.github/workflows/hourly.yml` — étape de prérendu ; `public/sitemap.xml`
  ajouté à l'étape « Commit refreshed data »
- `scripts/scrape.mjs` — écrit `public/sitemap.xml` avec `lastmod`
- `public/sitemap.xml` — gagne un `lastmod`
