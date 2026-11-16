# Publication YouTube automatique : mise en place

Une seule fois, par le propriétaire. Les commandes pour vous sont écrites `! <commande>`.

Le compte Google possède **7 chaînes de marque** (fr, en, hy, ru, de, it, es). Chacune reçoit son propre jeton de rafraîchissement, mais tous partagent un seul client OAuth.

## 1. Projet Google Cloud

1. https://console.cloud.google.com : créer un projet (ex. « armenie-info-youtube »).
2. **APIs et services > Bibliothèque** : activer **YouTube Data API v3**.

## 2. Écran de consentement OAuth

1. **APIs et services > Écran de consentement OAuth** : type d'utilisateur **Externe**.
2. Nom de l'application, e-mail d'assistance, e-mail du développeur.
3. Scopes : `https://www.googleapis.com/auth/youtube.upload` et `https://www.googleapis.com/auth/youtube.readonly`.
4. **Publier l'application** (« Publier l'application » : passer de *Test* à *En production*). **Étape indispensable** : en mode test, les jetons de rafraîchissement expirent après 7 jours et la publication s'arrêterait en silence. L'écran « application non validée » au consentement est normal : « Paramètres avancés > Accéder à… ».

## 3. Client OAuth « Application de bureau »

**Identifiants > Créer des identifiants > ID client OAuth > Application de bureau.** Le script utilise une adresse de rebouclage (`127.0.0.1`, port aléatoire), acceptée d'office pour ce type de client. Notez l'ID client et le secret.

## 4. Secrets GitHub (9 au total)

Deux secrets communs, puis sept jetons (étape 5) :

```
! gh secret set YT_CLIENT_ID
! gh secret set YT_CLIENT_SECRET
```

Pour les consentements locaux, mettez aussi les deux valeurs dans le `.env` du dépôt (jamais commité) :

```
YT_CLIENT_ID=...
YT_CLIENT_SECRET=...
```

## 5. Les 7 consentements

Pour chaque langue, une fois. L'écran de consentement de Google demande **quelle chaîne** représenter : choisissez celle de la langue. Le script **refuse** un mauvais choix (il compare l'identifiant rendu par l'API à celui attendu) et n'enregistre rien.

```
! node scripts/youtube-auth.mjs --lang fr --set
! node scripts/youtube-auth.mjs --lang en --set
! node scripts/youtube-auth.mjs --lang hy --set
! node scripts/youtube-auth.mjs --lang ru --set
! node scripts/youtube-auth.mjs --lang de --set
! node scripts/youtube-auth.mjs --lang it --set
! node scripts/youtube-auth.mjs --lang es --set
```

Avec `--set`, le jeton passe directement dans `gh secret set YT_REFRESH_TOKEN_<LANG>` par l'entrée standard : il n'est ni affiché ni écrit sur disque. Sans `--set`, il est affiché une fois et la commande à lancer est indiquée.

Secrets obtenus : `YT_REFRESH_TOKEN_FR`, `_EN`, `_HY`, `_RU`, `_DE`, `_IT`, `_ES`.

## 6. Audit des services d'API YouTube et hausse de quota

**Pourquoi** : tant que le projet n'a pas passé l'audit, les vidéos envoyées par l'API sont **verrouillées en privé**. Et le quota par défaut est de 10 000 unités par jour, soit 6 envois (1 600 unités chacun) : insuffisant pour 7 langues.

Formulaire : https://support.google.com/youtube/contact/yt_api_form (« YouTube API Services - Audit and Quota Extension Form »).

Texte à coller :

> **Français.** Armenie Info (armenieinfo.ch) et Armenia News (armenianews.org) sont deux sites d'information sur la vie arménienne. Nous publions automatiquement, sur nos propres 7 chaînes YouTube (français, anglais, arménien, russe, allemand, italien, espagnol), les courtes vidéos verticales (Shorts) tirées de nos propres articles de la rubrique Culture. Chaque article publié donne lieu à environ 7 envois (un par langue), soit environ 3 articles par semaine. L'application n'envoie que du contenu que nous produisons, uniquement vers des chaînes que nous possédons ; elle ne lit aucune donnée d'autres utilisateurs. Scopes : youtube.upload (envoi) et youtube.readonly (vérifier que la chaîne autorisée est la bonne). Demande : sortir du mode privé forcé et obtenir un quota suffisant (environ 21 envois par semaine, avec marge pour les reprises).
>
> **English.** Armenie Info (armenieinfo.ch) and Armenia News (armenianews.org) are news sites about Armenian life. We automatically publish, to our own 7 YouTube channels (French, English, Armenian, Russian, German, Italian, Spanish), the short vertical videos (Shorts) made from our own Culture articles. Each published article produces about 7 uploads (one per language), about 3 articles per week. The application only uploads content we produce, only to channels we own; it reads no other user's data. Scopes: youtube.upload (uploading) and youtube.readonly (checking that the authorized channel is the expected one). Request: lift the forced-private restriction and obtain enough quota (about 21 uploads per week, with headroom for retries).

## 7. Activer l'automatisme

**Seulement une fois l'audit accordé** (avant, les vidéos resteraient privées) :

```
! gh variable set YOUTUBE_AUTO --body 1
```
