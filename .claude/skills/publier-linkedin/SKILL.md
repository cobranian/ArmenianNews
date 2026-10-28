---
name: publier-linkedin
description: Use when the session-start reminder announces LinkedIn posts waiting (« RAPPEL LINKEDIN »), or when the user asks to post on the LinkedIn pages of armenieinfo.ch / armenianews.org. LinkedIn has no automatic publishing for this site — posts go through Chrome, one by one, only after the user said yes in this session.
---

# Publier sur les pages LinkedIn, par le navigateur

**Pourquoi à la main** : l'API des pages LinkedIn (« Community Management
API ») est réservée aux entités juridiques enregistrées ; le site est
personnel, l'accès a été abandonné le 28 oct. 2026. Un hook `SessionStart`
(`.claude/settings.json`) lance `node scripts/linkedin-pending.mjs --hook`
et annonce ce qui attend.

## Règles

- **Rien ne part sans un « oui » de l'utilisateur DANS CETTE SESSION.** Un
  accord d'une session précédente ne vaut pas. Demandez, attendez.
- **Les conditions de LinkedIn interdisent l'automatisation.** Restez à un
  rythme humain : un post à la fois, jamais en rafale, rien en arrière-plan.
- Le clic « Publier » peut être refusé par le garde-fou de sécurité : dans ce
  cas, laissez le post prêt et demandez à l'utilisateur de cliquer.
- Après **chaque** post réellement publié (et vérifié sur la page) :
  `node scripts/linkedin-pending.mjs --mark <canal> <id>`. Sans cela, il
  reviendra à la session suivante. Ne marquez jamais un post non publié.

## Étapes

1. `node scripts/linkedin-pending.mjs --list` : pour chaque post, la page
   d'administration, le texte exact et la commande `--mark`.
2. Chrome (outils `mcp__claude-in-chrome__*`, onglet neuf) : ouvrir l'URL
   d'administration de la page — `linkedin-ch` = « Arménie Info » (français),
   `linkedin-org` = « Armenia News » (anglais). Vérifier le nom de la page en
   haut à gauche : on publie AU NOM DE LA PAGE, pas du profil personnel.
3. « + Créer » → « Commencer un post ». Coller le texte (taper le texte de
   `--list` tel quel). Attendre l'aperçu du lien (image + titre de l'article).
4. Faire valider à l'utilisateur ce qui est à l'écran si c'est le premier
   post de la session, puis « Publier ».
5. Vérifier que le post apparaît dans « Posts de la page », puis `--mark`.

## Repères

- Pages : linkedin.com/company/armenieinfo (org 146900320),
  linkedin.com/company/armenianews (org 146899338).
- Registre local : `.cache/linkedin-posted.json` (hors git). Le supprimer
  ré-amorce : seul le dernier article serait reproposé.
- Types publiés : ceux de `SOCIAL_KINDS` (Culture par défaut), comme le job
  horaire.
