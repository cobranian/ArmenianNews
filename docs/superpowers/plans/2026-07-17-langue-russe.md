# Langue russe (RU) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le russe comme 4ᵉ langue d'interface, alimenté par l'édition russe d'Armenpress (`armenpress.am/ru`).

**Architecture:** Le russe est une langue d'interface de plus (`LANGS` + un dictionnaire `STRINGS.ru` complet dans `src/i18n.jsx`). La seule source à édition russe activée maintenant est Armenpress : on ajoute `'ru'` à `ARMENPRESS_LANGS` et à la boucle de `scrape.mjs`, puis on régénère `news.json`. Aucun composant ni CSS à modifier : `Nav` rend `LANGS`, `NewsBrowser.buildSources` indexe déjà Armenpress par `lang`, et les images Armenpress viennent d'un hôte déjà autorisé par la CSP.

**Tech Stack:** Vite + React 18 (SPA statique), scrapers Node ESM (`node:https` + cheerio), pas de suite de tests — la vérification se fait en **exécutant** le scraper et le serveur de dev, plus `npm run lint`.

## Global Constraints

- **Repo** : toutes les commandes git depuis `C:\Users\nareg\Documents\Claude code\ArmenianNews` (le dossier parent est un autre dépôt). Vérifier `git rev-parse --show-toplevel` → doit finir par `/ArmenianNews`.
- **Pas de suite de tests** : la vérification = exécuter le scraper / `npm run dev` / `npm run lint`. Ne pas inventer de framework de test.
- **`npm run lint` doit rester à 0 erreur, 6 avertissements connus** (Radio.jsx ×2, i18n.jsx + motifs.jsx ×4). Ne pas « corriger » ces 6.
- **Le français porte tous ses accents.** Le russe utilise le cyrillice ; ne pas translittérer les noms de marque déjà latins (`Yerevan Nights`, `Armenian Gospel Radio`, `Radio Yeraz`, `Im Radio`) — les garder tels quels, comme le fait déjà le bloc `hy`.
- **Libellés de rubriques Armenpress (`apcats.*`)** = les noms exacts de la nav russe d'Armenpress, relevés en direct : `armenia`→Армения, `economy`→Экономика, `world`→Мир, `culture`→Культура, `sports`→Спорт, `fact-check`→Проверка фактов, `projects`→**Спецпроекты**.
- **Le prérendu reste français** (`npm run prerender` tourne headless sans `localStorage`). Aucune tâche ne doit changer l'ordre des onglets ni le HTML prérendu.
- **Puce de langue** : label `РУ` (cyrillique), nom `Русский`.

---

### Task 1 : Langue d'interface russe (chrome complet)

Ajoute `ru` à `LANGS`, `LOCALES`, et un bloc `STRINGS.ru` complet. Après cette
tâche, basculer sur **РУ** traduit tout le chrome (nav, en-têtes de sections,
radio, pied de page, lightbox) — indépendamment de toute donnée scrapée.

**Files:**
- Modify: `src/i18n.jsx` (LANGS ~l.5-9, STRINGS ~l.11, LOCALES ~l.412)

**Interfaces:**
- Consumes : rien (première tâche).
- Produces : `LANGS` contient `{ code: 'ru', label: 'РУ', name: 'Русский' }` ; `STRINGS.ru` couvre exactement le même jeu de clés que `STRINGS.fr` ; `LOCALES.ru === 'ru-RU'`. La Task 2 s'appuie sur l'existence de la langue `ru` et des clés `apcats.*` russes.

- [ ] **Step 1 : Ajouter `ru` à `LANGS`**

Dans `src/i18n.jsx`, remplacer le tableau `LANGS` (l.5-9) :

```js
export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'hy', label: 'ՀԱՅ', name: 'Հայերեն' },
  { code: 'ru', label: 'РУ', name: 'Русский' },
]
```

- [ ] **Step 2 : Ajouter le bloc `ru` à `STRINGS`**

Dans `src/i18n.jsx`, à l'intérieur de l'objet `STRINGS`, juste **après** la
dernière accolade du bloc `hy: { … }` (l.409, la ligne `  },` qui ferme `hy`) et
**avant** l'accolade fermante de `STRINGS` (l.410 `}`), insérer :

```js
  ru: {
    'site.title': 'Армения Инфо',
    'site.tagline': 'Ежечасный снимок армянской жизни, из Швейцарии и со всего мира',
    'site.snapshot': 'Снимок от',

    'nav.news': 'Новости',
    'nav.radio': 'В эфире',
    'nav.agenda': 'Афиша',
    'nav.social': 'Соцсети',

    'news.title': 'Новости',
    'news.subtitle': 'Последние публикации из каждой рубрики «Курьера Еревана»',
    'news.armradio': 'Прямой эфир из Армении · Общественное радио Армении',
    'news.readmore': 'Читать далее',
    'news.prev': 'Назад',
    'news.next': 'Вперёд',
    'news.source': 'Источник',
    'news.empty': 'Пока нет статей.',

    'agenda.title': 'Афиша',
    'agenda.subtitle': 'Армянские события в Швейцарии и по всему миру',
    'agenda.switzerland': 'Швейцария',
    'agenda.world': 'Мир',
    'agenda.empty': 'Анонсов пока нет.',
    'agenda.more': 'Смотреть на armenopole',

    'social.title': 'Социальные сети',
    'social.subtitle':
      'Две ленты: искусство, которым делится Дон Нарек в Facebook, и подборка из Instagram, обновляемая случайным образом каждый час',

    'fb.title': 'Армянское искусство',
    'fb.by': 'от Дон Нарека',
    'fb.subtitle': 'Последние 20 публикаций, в изображениях',
    'fb.view': 'Смотреть публикацию',
    'fb.fallback': 'Открыть страницу в Facebook',

    'ig.title': 'Instagram',
    'ig.subtitle': 'Мозаика армянского вдохновения, наугад',
    'ig.strand': 'Армянская мозаика',
    'ig.strand.people': 'Армянские лица',
    'ig.shuffle': 'Перемешать',
    'ig.visit': 'Смотреть профиль',
    'ig.view': 'Смотреть в Instagram',

    'social.enlarge': 'Увеличить изображение',
    'fb.zoom': 'Увеличить',
    'ig.zoom': 'Увеличить',
    'lb.dialog': 'Увеличенное изображение',
    'lb.close': 'Закрыть',
    'lb.prev': 'Предыдущее изображение',
    'lb.next': 'Следующее изображение',

    'footer.built': 'Статический снимок · источники со ссылками на их сайты',
    'footer.write': 'Напишите нам',
    'footer.sources': 'Источники',

    'sections.actualite': 'Новости',
    'sections.societe': 'Общество',
    'sections.economie': 'Экономика',
    'sections.arts-et-culture': 'Искусство и культура',
    'sections.francophonie': 'Франкоязычная Армения',
    'sections.opinions': 'Мнения',
    'sections.region': 'Регион',
    'sections.diasporas': 'Диаспоры',

    'armcats.politics': 'Политика',
    'armcats.society': 'Общество',
    'armcats.economics': 'Экономика',
    'armcats.analytics': 'Аналитика',
    'armcats.world': 'Мир',
    'armcats.culture': 'Культура',
    'armcats.sport': 'Спорт',

    'namcats.actualites': 'Новости',
    'namcats.sport': 'Спорт',
    'namcats.communaute': 'Сообщество',
    'namcats.culture': 'Культура',
    'namcats.lifestyle': 'Образ жизни',
    'namcats.magazine': 'Журналы',

    'azkcats.armenie-artsakh': 'Армения и Арцах',
    'azkcats.communaute': 'Сообщество',
    'azkcats.divers': 'Разное',

    'aitcats.armenie': 'Армения',
    'aitcats.art-culture': 'Искусство и культура',
    'aitcats.artsakh': 'Арцах',
    'aitcats.diaspora': 'Диаспора',
    'aitcats.france': 'Франция',
    'aitcats.geopolitique': 'Геополитика',
    'aitcats.politique': 'Политика',
    'aitcats.un-autre-regard': 'Другой взгляд',

    'browser.subtitle': 'Все рубрики, источник за источником',
    'browser.armradio': 'Общественное радио Армении',
    'browser.courrier': 'Курьер Еревана',
    'browser.armenews': 'armenews.com',
    'browser.artzakank': 'Эхо армян Швейцарии',
    'browser.armenieinfotv': 'armenieinfo.tv',
    'browser.armenpress': 'Арменпресс',
    'apcats.armenia': 'Армения',
    'apcats.economy': 'Экономика',
    'apcats.world': 'Мир',
    'apcats.culture': 'Культура',
    'apcats.sports': 'Спорт',
    'apcats.fact-check': 'Проверка фактов',
    'apcats.projects': 'Спецпроекты',

    'radio.eyebrow': 'Ереван · 128 кбит/с',
    'radio.title': 'Прямой эфир',
    'radio.subtitle': 'Общественное радио Армении в прямом эфире',
    'radio.onair': 'В эфире',
    'radio.tz': 'Ереван',
    'radio.play': 'Слушать в эфире',
    'radio.pause': 'Пауза',
    'radio.loading': 'Подключение к потоку…',
    'radio.error': 'Поток недоступен.',
    'radio.retry': 'Повторить',
    'radio.volume': 'Громкость',
    'radio.station': 'Станция',
    'radio.st.public': 'Первая программа',
    'radio.st.im': 'Im Radio',
    'radio.st.arevik': 'Радио Аревик',
    'radio.st.culture': 'Радио Культура',
    'radio.st.mariam': 'Радио Мариам',
    'radio.st.vov': 'Голос Вана',
    'radio.st.lav': 'Лав Радио',
    'radio.st.fama': 'Радио Фама',
    'radio.st.yerevannights': 'Yerevan Nights',
    'radio.st.gospel': 'Armenian Gospel Radio',
    'radio.st.yeraz': 'Radio Yeraz',
  },
```

- [ ] **Step 3 : Ajouter le locale russe**

Dans `src/i18n.jsx`, remplacer la ligne `LOCALES` (~l.412) :

```js
const LOCALES = { fr: 'fr-FR', en: 'en-GB', hy: 'hy-AM', ru: 'ru-RU' }
```

- [ ] **Step 4 : Test automatique de parité des clés**

Le seul vrai risque d'un dictionnaire de 114 clés, c'est une clé manquante (qui
retomberait silencieusement sur le français). Ce script compare le jeu de clés
`fr` et `ru` et échoue si l'un manque à l'autre. Le créer :

`_check-i18n.mjs` (à la racine du projet) :

```js
import { readFile } from 'node:fs/promises'
const src = await readFile('src/i18n.jsx', 'utf8')
// STRINGS va de "const STRINGS = {" jusqu'à "\nconst LOCALES".
const body = src.slice(src.indexOf('const STRINGS = {'), src.indexOf('const LOCALES'))
// Découper par blocs de langue, dans l'ordre fr, en, hy, ru.
const cut = (from, to) => body.slice(body.indexOf(from), to ? body.indexOf(to) : undefined)
const keys = (slice) => new Set([...slice.matchAll(/^\s{4}'([\w.-]+)':/gm)].map((m) => m[1]))
const fr = keys(cut('fr: {', 'en: {'))
const ru = keys(cut('ru: {'))
const missingInRu = [...fr].filter((k) => !ru.has(k))
const extraInRu = [...ru].filter((k) => !fr.has(k))
console.log(`fr=${fr.size} keys, ru=${ru.size} keys`)
if (missingInRu.length) console.error('MANQUE dans ru:', missingInRu)
if (extraInRu.length) console.error('EN TROP dans ru:', extraInRu)
process.exit(missingInRu.length || extraInRu.length ? 1 : 0)
```

- [ ] **Step 5 : Lancer le test de parité**

Run: `node _check-i18n.mjs`
Expected: `fr=114 keys, ru=114 keys` (les deux nombres égaux) et **exit 0**, aucune
ligne « MANQUE » ni « EN TROP ». Si une clé manque, l'ajouter au bloc `ru` du
Step 2 et relancer.

- [ ] **Step 6 : Supprimer le script jetable**

Run: `rm -f _check-i18n.mjs`

- [ ] **Step 7 : Vérifier le rendu à l'écran**

Run: `npm run dev` puis ouvrir http://localhost:5173

Cliquer la puce **РУ** dans la barre de nav et vérifier :
- La puce `РУ` est présente et devient active (fond abricot).
- Nav : « Новости / В эфире / Афиша / Соцсети ».
- Titre de section Actualités « Новости », Agenda « Афиша », Réseaux « Социальные сети ».
- Bloc radio : bouton « Слушать в эфире », libellé « Прямой эфир ».
- Pied de page : « Напишите нам », « Источники ».
- **Aucun texte français résiduel** dans le chrome et **aucune clé brute** affichée (p.ex. `nav.news`).

Arrêter le serveur (Ctrl-C).

- [ ] **Step 8 : Lint**

Run: `npm run lint`
Expected: 0 erreur, 6 avertissements connus (inchangé).

- [ ] **Step 9 : Commit**

```bash
git add src/i18n.jsx
git commit -m "feat(i18n): ajoute le russe comme 4e langue d'interface (РУ)"
```

---

### Task 2 : Source Armenpress russe + régénération des données

Active la 4ᵉ édition d'Armenpress (`/ru`) dans le scraper, puis régénère
`news.json` pour que l'onglet Armenpress affiche des articles russes dès le
déploiement.

**Files:**
- Modify: `scripts/sources/armenpress.mjs` (l.25 `ARMENPRESS_LANGS`, + commentaires d'en-tête)
- Modify: `scripts/scrape.mjs` (l.148 graine `apLangs`, l.155 boucle, + commentaire l.140-143)
- Modify: `src/data/news.json` (régénéré par `npm run scrape`)

**Interfaces:**
- Consumes : de la Task 1, l'existence de la langue `ru` et des clés `apcats.*` russes (pour l'affichage).
- Produces : `news.json` gagne `armenpress.ru` = tableau de 7 objets `{ categoryKey, articles }`, chaque `articles` non vide, articles au format `{ title, url, date, image }` (`url` en `https://armenpress.am/ru/article/{id}`).

- [ ] **Step 1 : Activer la langue `ru` dans le module Armenpress**

Dans `scripts/sources/armenpress.mjs`, remplacer la ligne 25 :

```js
export const ARMENPRESS_LANGS = ['fr', 'en', 'hy', 'ru']
```

Et mettre à jour le commentaire l.24 juste au-dessus :

```js
// Quatre éditions — fr/en/hy/ru — qui mappent 1:1 à la langue de l'interface,
// contrairement à ArmRadio (pas d'édition française).
```

- [ ] **Step 2 : Mettre à jour les commentaires « trilingue / 21 pages »**

Toujours dans `scripts/sources/armenpress.mjs`, l'en-tête (l.5-6) dit « the only
trilingual source » et (l.14/l.20) « Seven rubrics per language … 21/21 pages ».
Remplacer « trilingual »/« trilingue » par « quadrilingue (fr/en/hy/ru) » et
« 21 pages » par « 28 pages (7 rubriques × 4 langues) ». C'est purement du
commentaire ; ne toucher à aucune ligne de code de `getHtml`, `parseHits`,
`scrapeCategory` (le garde-fou `got !== lang` gère déjà `ru`) ni des URLs
(`/${lang}/article/${id}` produit correctement l'URL `/ru/…`).

- [ ] **Step 3 : Semer et boucler `ru` dans l'orchestrateur**

Dans `scripts/scrape.mjs`, remplacer la graine (l.148) :

```js
  let apLangs = { fr: [], en: [], hy: [], ru: [] }
```

Puis la boucle de backfill (l.155) :

```js
  for (const lang of ['fr', 'en', 'hy', 'ru']) {
```

Et le commentaire au-dessus (l.142-143) « Seven rubrics x three languages = 21
pages » → « Sept rubriques × quatre langues = 28 pages ».

- [ ] **Step 4 : Commit du code (séparé des données)**

```bash
git add scripts/sources/armenpress.mjs scripts/scrape.mjs
git commit -m "feat(armenpress): active l'edition russe (/ru) dans le scrape"
```

- [ ] **Step 5 : Régénérer le snapshot**

Run: `npm run scrape`
Expected (dans les logs) : une section
`Armenpress — armenpress.am (fr/en/hy/ru …)` avec des lignes
`✓ armenpress/ru/armenia (10)`, `✓ armenpress/ru/economy (10)`, … pour les 7
rubriques ru (le nombre entre parenthèses ≥ 1). Les autres sources peuvent
échouer localement (403) et être backfillées depuis le snapshot précédent — c'est
normal, `news.json` conserve leurs données.

- [ ] **Step 6 : Vérifier que `news.json` contient bien `armenpress.ru`**

`_check-news.mjs` (à la racine) :

```js
import { readFile } from 'node:fs/promises'
const news = JSON.parse(await readFile('src/data/news.json', 'utf8'))
const ru = news.armenpress?.ru
if (!Array.isArray(ru)) { console.error('armenpress.ru absent'); process.exit(1) }
const nonEmpty = ru.filter((s) => s.articles?.length)
console.log(`armenpress.ru: ${ru.length} rubriques, ${nonEmpty.length} non vides`)
const sample = nonEmpty[0]?.articles?.[0]
console.log('exemple:', sample?.url, '|', sample?.title?.slice(0, 50))
// L'URL doit pointer vers l'edition /ru et le titre etre en cyrillique.
const okUrl = /armenpress\.am\/ru\/article\//.test(sample?.url || '')
const okCyr = /[А-Яа-яЁё]/.test(sample?.title || '')
process.exit(nonEmpty.length >= 5 && okUrl && okCyr ? 0 : 1)
```

Run: `node _check-news.mjs`
Expected: `armenpress.ru: 7 rubriques, 7 non vides` (au moins 5), une URL
`https://armenpress.am/ru/article/…` et un titre en cyrillique. **Exit 0.**

- [ ] **Step 7 : Supprimer le script jetable**

Run: `rm -f _check-news.mjs`

- [ ] **Step 8 : Vérifier le rendu de l'onglet Armenpress en russe**

Run: `npm run dev` → http://localhost:5173 → basculer sur **РУ** → onglet
**Armenpress**. Vérifier :
- Les titres de rubriques sont en russe (Армения, Экономика, Мир, Культура,
  Спорт, Проверка фактов, Спецпроекты).
- Les cartes montrent des titres russes et des images.
- Un clic sur une carte ouvre `armenpress.am/ru/article/…`.
- L'onglet **Courrier d'Erevan** reste en tête et en français (comportement HY).

Arrêter le serveur (Ctrl-C).

- [ ] **Step 9 : Commit des données**

```bash
git add src/data/
git commit -m "data: snapshot avec l'edition russe d'Armenpress"
```

---

### Task 3 : Vérification d'intégration (SEO prérendu + nav mobile + lint)

Confirme qu'aucune régression transverse : le prérendu reste français, la barre
de nav à 4 puces tient sur mobile, le lint est propre.

**Files:**
- Aucun changement de code attendu. Si la nav mobile déborde, seule modif permise :
  `src/styles/global.css` (padding `.lang button` sous `@media`, ~l.2032-2034).

**Interfaces:**
- Consumes : le site complet des Tasks 1-2.
- Produces : rien (tâche de vérification).

- [ ] **Step 1 : Lint global**

Run: `npm run lint`
Expected: 0 erreur, 6 avertissements connus.

- [ ] **Step 2 : Build + prérendu, vérifier que le HTML reste français**

Run: `npm run build && npm run prerender`
Expected: build et prérendu réussis.

Puis vérifier que le HTML prérendu est toujours français (défaut), pas russe :

Run: `grep -o '<html lang="[a-z]*"' dist/index.html | head -1`
Expected: `<html lang="fr"` (surtout **pas** `lang="ru"`).

Run: `grep -c "Courrier" dist/index.html`
Expected: ≥ 1 (Courrier d'Erevan est bien la source bakée en premier).

- [ ] **Step 3 : Vérifier la barre de nav à 4 puces sur mobile**

Run: `npm run dev` → ouvrir http://localhost:5173, réduire la fenêtre à 360px de
large (ou DevTools mobile). Vérifier que la pilule de langue (FR EN ՀԱՅ РУ) +
bascule thème + hamburger tiennent sur une ligne sans débordement horizontal ni
chevauchement.

- **Si ça déborde** (et seulement dans ce cas) : réduire le padding mobile des
  puces dans `src/styles/global.css` (~l.2032) de `14px 15px` à `14px 12px`, puis
  revérifier. Sinon, ne rien changer.

Arrêter le serveur.

- [ ] **Step 4 : Commit (seulement si le CSS a changé)**

```bash
# Uniquement si global.css a été touché au Step 3 :
git add src/styles/global.css
git commit -m "style(nav): resserre les puces de langue sur mobile pour 4 langues"
```

Si aucun fichier n'a changé, sauter ce commit.

---

## Suite (hors périmètre de ce plan) — ArmRadio russe

Documentée dans la spec (`docs/superpowers/specs/2026-07-17-langue-russe-design.md`,
section « Suite »). Bloquée tant que le Cloudflare Worker `ARMRADIO_PROXY` ne
route pas `lang=ru → ru.armradio.am`. Ne pas tenter dans ce plan.
