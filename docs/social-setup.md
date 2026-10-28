# Publication automatique sur les réseaux

`scripts/social-post.mjs` publie chaque **nouvel article Culture** (et, sur
demande, la brève du jour) sur les comptes configurés : fr sur les comptes
d'Arménie Info, en sur ceux d'Armenia News. Il tourne dans le job `social` de
`hourly.yml`, après le déploiement et la sonde de production.

## Ce qui garantit qu'il ne fait pas de bêtise

- **Rien ne part tant que `SOCIAL_LIVE` ≠ `1`.** Le job simule et imprime les
  messages au log.
- **Un compte branché ne reçoit pas l'archive.** Au premier passage, tout ce qui
  existe est marqué « vu » (registre `src/data/social-posted.json`) ; seuls les
  articles publiés ensuite partent.
- **Jamais de doublon.** Le registre est poussé avant l'envoi. Un run annulé
  perd au pire un post.
- **Deux posts au plus par compte et par heure.**
- **Aucun texte rédigé par une IA au moment de l'envoi** : titre, description et
  URL de pages déjà en ligne. La brève (synthèse automatique, non relue) ne part
  que si `SOCIAL_KINDS` vaut `culture,brief`.
- **Les secrets ne sont visibles que du job `social`**, et les erreurs sont
  expurgées de toute valeur secrète avant d'être écrites au log.

## Mise en place (une fois)

1. GitHub → Settings → Environments → **New environment** `social`.
   Deployment branches : **main uniquement**. Y poser les secrets ci-dessous.
2. Pour chaque compte, poser **tous** ses secrets (un compte incomplet est
   ignoré, sans erreur). Suffixe `_CH` pour Arménie Info (fr), `_ORG` pour
   Armenia News (en).
3. Vérifier en local, avec les mêmes valeurs dans `.env` (jamais versionné) :
   `node --env-file=.env scripts/social-post.mjs test --channel facebook-ch`
   (aperçu), puis `--yes` pour un vrai post.
4. Variable d'environnement `SOCIAL_LIVE` = `1`. Le premier run amorce, les
   suivants publient.

| Plateforme | Secrets | Où les obtenir | À savoir |
|---|---|---|---|
| Facebook (Page) | `FB_PAGE_ID_*`, `FB_PAGE_TOKEN_*` | App Meta (type Business), droits `pages_manage_posts` + `pages_read_engagement` ; jeton de **Page** tiré d'un jeton utilisateur longue durée | Ce jeton n'expire pas, sauf changement de mot de passe ou retrait de l'app |
| Instagram | `IG_USER_ID_*` (+ le jeton de Page) | Compte pro lié à la Page ; `GET /{page-id}?fields=instagram_business_account` ; droit `instagram_content_publish` | Seuls les articles avec une image entre 4:5 et 1,91:1 partent ; le crédit de l'image est dans la légende |
| LinkedIn | `LINKEDIN_AUTHOR_*` (`urn:li:person:…` ou `urn:li:organization:…`), `LINKEDIN_TOKEN_*` | Produit « Share on LinkedIn » (profil) ; une **page entreprise** demande le produit « Community Management API », soumis à validation | **Le jeton expire après 60 jours** : à renouveler, sinon `✗ social/linkedin` |
| X | `X_API_KEY_*`, `X_API_SECRET_*`, `X_ACCESS_TOKEN_*`, `X_ACCESS_SECRET_*` | developer.x.com, app en lecture + écriture, jetons OAuth 1.0a de l'utilisateur | L'écriture par API est payante ou très limitée selon l'offre en vigueur : vérifier le tarif avant |
| Bluesky | `BLUESKY_HANDLE_*` (le **DID** `did:plc:…`, pas le pseudo), `BLUESKY_APP_PASSWORD_*` | Réglages → Confidentialité et sécurité → Mots de passe d'application | Gratuit. Jamais le mot de passe principal. Pseudos = domaines (@armenieinfo.ch, @armenianews.org) via un TXT `_atproto` chez Infomaniak : le DID ne bouge pas si le pseudo change, la connexion non plus |
| Telegram (canal) | `TELEGRAM_BOT_TOKEN_*`, `TELEGRAM_CHAT_*` (`@nomducanal`) | @BotFather, puis ajouter le bot comme admin du canal | Gratuit |

YouTube n'est pas couvert : il faut une vidéo, ce que le site ne produit pas
encore.

## En cas de panne

Chaque jour à 06:17 UTC, `social-check.yml` connecte chaque compte SANS publier
(`node scripts/social-post.mjs check`) et ouvre une issue `[social-down]` si une
clé est refusée ; elle se referme seule au retour. À lancer aussi à la main
après avoir recollé une clé : `gh workflow run social-check.yml`.

`gh run view <id> --log | grep social` : `✓` publié, `✗` échec (la raison
suit), `amorcé` = compte neuf. Pour republier un article, retirez sa ligne du
registre pour ce compte.
