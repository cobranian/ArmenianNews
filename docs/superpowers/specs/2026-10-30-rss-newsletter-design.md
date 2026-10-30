# Flux RSS et newsletter hebdomadaire — conception

Date : 30 octobre 2026. Choix faits par Claude à la demande de Nareg (« lance-toi
sans questions, fais tes choix ») : chaque décision ci-dessous est la sienne et
peut être contestée à la relecture.

## Pourquoi

Le site ne vit aujourd'hui que de Google et des réseaux sociaux. Les positions
Google sont en page 2-3 (« armenia news » pos. 20, GSC du 18 oct.), faute
d'autorité plus que de technique. Un flux RSS fait entrer le site dans les
lecteurs et agrégateurs (Feedly, Inoreader, agrégateurs de la diaspora) ; une
newsletter crée une audience qui revient sans dépendre d'un algorithme. Le
contenu existe déjà : brève quotidienne (6 langues), articles Culture, agenda.

## Objectifs

1. Un flux RSS 2.0 **par langue** (6), généré au build, annoncé dans le `<head>`
   de toutes les pages et lié au pied de page.
2. Une newsletter **hebdomadaire par vitrine** : en français pour le .ch, en
   anglais pour le .org, composée automatiquement, envoyée par Buttondown.
3. Un formulaire d'inscription au pied de page, sur les pages de la langue de
   la newsletter seulement.

## Non-objectifs

- Pas de newsletter de/it/hy/ru en v1 (le RSS les couvre).
- Pas de texte écrit par un modèle dans la newsletter : elle n'assemble que des
  titres et textes déjà publiés et relus. Aucun nouvel appel LLM.
- Pas de backend, pas de base d'abonnés chez nous : Buttondown la détient.

## Anti-objectifs (échec même si « ça marche »)

- Un envoi en double aux abonnés (run relancé, cron rejoué).
- Un premier envoi automatique sans que Nareg ait relu un brouillon.
- Casser `npm run check` ou l'hydratation pour un lien de pied de page.
- Une politique de confidentialité qui ne mentionne pas la collecte d'e-mails.

## Décisions

- **URL des flux** : `langPath(siteId, lang) + 'feed.xml'` → `armenieinfo.ch/feed.xml`,
  `/de/feed.xml`, `/it/feed.xml`, `armenianews.org/feed.xml`, `/hy/feed.xml`, `/ru/feed.xml`.
- **Contenu d'un flux** : brèves datées + articles Culture de cette langue, les
  30 plus récents. Résumé seulement (intro de la brève, description de
  l'article), pas le texte entier : le flux doit amener au site.
- **Dates du flux** : `lastBuildDate` = date de l'élément le plus récent, jamais
  l'heure du build (même garde que le `lastmod` des sitemaps).
- **Fournisseur** : Buttondown, un compte par vitrine (gratuit jusqu'à un petit
  nombre d'abonnés — limites à vérifier à l'ouverture des comptes). Double
  opt-in et désinscription gérés par Buttondown.
- **Rythme** : lundi. Cron lundi, mardi et mercredi 05:50 UTC (le cron GitHub
  saute des passages ; :50 pour éviter le push du snapshot horaire), et
  seulement si la variable de dépôt `NEWSLETTER_ENABLED` vaut `true`
  (révision du 30 oct., revue finale) ; un registre `src/data/newsletter-sent.json` garantit un
  seul envoi par semaine ISO et par vitrine, poussé **avant** l'envoi (même
  règle que `social-posted.json`).
- **Mode brouillon d'abord** : par défaut l'API crée un **brouillon** que Nareg
  envoie à la main ; la variable de dépôt `NEWSLETTER_STATUS` passe à l'envoi
  automatique après deux numéros relus.
- **Contenu du numéro** : les sujets des brèves de la semaine ISO précédente,
  lundi–dimanche, quel que soit le jour du passage (un par jour, lien vers la
  brève datée), les articles Culture de la même semaine,
  les 8 prochains événements à 14 jours (lien vers la page agenda du pays).
  Liens marqués `utm_source=newsletter&utm_medium=email&utm_campaign=hebdo-AAAA-Www`.
  Semaine sans brève ni article : pas d'envoi, `✗ newsletter/<site>: semaine vide` au log.

## Contraintes

- Site statique, Firebase, CSP `form-action 'self'` dans **les deux** blocs
  `headers` de `firebase.json`.
- `npm run check` compte exactement 7 `rel="alternate"` par page de vue.
- Le pied de page est prérendu puis hydraté : rien ne doit dépendre de l'heure.
- Toute chaîne d'interface existe dans les six blocs `STRINGS`.
