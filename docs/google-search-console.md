# Prévenir Google automatiquement (une fois, ~10 minutes)

Bing, Yandex et Yahoo sont prévenus sans rien faire (IndexNow, `hourly.yml`).
Google ne lit pas IndexNow : le job horaire lui renvoie le sitemap de chaque
vitrine qui porte des pages nouvelles (`scripts/gsc-sitemaps.mjs`). Il lui faut
une identité Google à qui la Search Console fait confiance. Tant qu'elle
manque, le tableau de bord (issue épinglée « [tableau-de-bord] ») l'affiche en
orange et le pas est sauté.

**Pourquoi pas l'Indexing API** : Google la réserve aux offres d'emploi et aux
diffusions en direct ; s'en servir pour des articles viole ses règles.

## 1. Google Cloud — un compte de service sans aucun droit

Console Google Cloud, projet **armenie-info** :

1. *API et services → Bibliothèque* → « **Google Search Console API** » → Activer.
2. *IAM et administration → Comptes de service* → Créer :
   nom `gsc-sitemaps`, **aucun rôle** (passer les étapes 2 et 3).
3. Ouvrir le compte → onglet *Clés* → Ajouter une clé → JSON. Le fichier se
   télécharge : c'est un secret, ne le partagez avec personne.

## 2. GitHub — coller la clé

Dépôt → *Settings → Secrets and variables → Actions → New repository secret* :
nom **`GSC_SERVICE_ACCOUNT`**, valeur = **tout le contenu** du fichier JSON.
Puis supprimez le fichier de votre ordinateur.

## 3. Search Console — autoriser le compte, sur les DEUX propriétés

Pour `armenieinfo.ch` **puis** `armenianews.org` (propriétés de domaine) :
*Paramètres → Utilisateurs et autorisations → Ajouter un utilisateur* →
l'adresse du compte (`gsc-sitemaps@armenie-info.iam.gserviceaccount.com`,
visible dans le JSON sous `client_email`) → autorisation **Total**.

## Vérifier

`gh workflow run social-check.yml` : la ligne Google du tableau de bord passe
au vert. Au premier article publié, le journal du job horaire dit
`✓ gsc/ch : sitemap renvoyé…` (`gh run view <id> --log | grep gsc`).
Un `✗ gsc … 403` = le compte n'est pas (encore) utilisateur de la propriété.
