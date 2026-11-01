---
name: publier-whatsapp
description: Use when the session-start reminder announces WhatsApp posts waiting (« RAPPEL WHATSAPP »), or when the user asks to post on the WhatsApp channels of armenieinfo.ch / armenianews.org. WhatsApp channels have no publishing API — posts go through WhatsApp Web in Chrome, one by one, only after the user said yes in this session.
---

# Publier sur les chaînes WhatsApp, par WhatsApp Web

**Pourquoi à la main** : aucune API ne publie dans une chaîne WhatsApp (l'API
Business ne sert que les conversations), et automatiser un compte personnel
expose le numéro à un blocage. Le hook `SessionStart` (`.claude/settings.json`)
lance `node scripts/linkedin-pending.mjs --hook`, qui annonce LinkedIn ET
WhatsApp. Sept chaînes, une par langue (créées le 1er nov. 2026) ; leurs liens
vivent dans `sites.config.js` (`whatsapp` de `social` / `socialByLang`), d'où
les tire `WHATSAPP_CHANNELS` (`scripts/lib/linkedin-pending.mjs`).

**Protection** : les chaînes WhatsApp n'ont pas de commentaires ; les
réactions sont réglées sur « Aucune » (Infos de la chaîne → Paramètres de la
chaîne). Une nouvelle chaîne doit recevoir le même réglage.

## Règles

- **Rien ne part sans un « oui » de l'utilisateur DANS CETTE SESSION.**
- Rythme humain : un message à la fois, jamais en rafale, rien en arrière-plan.
- Après **chaque** message réellement publié (et vu dans la chaîne) :
  `node scripts/linkedin-pending.mjs --mark <whatsapp-ch|whatsapp-org> <id>`.
  Ne marquez jamais un message non publié.

## Étapes

1. `node scripts/linkedin-pending.mjs --list` : le lien de la chaîne, le texte
   exact et la commande `--mark`.
2. Chrome (outils `mcp__claude-in-chrome__*`) : `https://web.whatsapp.com/`.
   Si un code QR s'affiche, demander à l'utilisateur de le scanner
   (WhatsApp → Appareils connectés) — ne jamais tenter une autre connexion.
3. Onglet « Chaînes » → la bonne chaîne : `whatsapp-ch` « Arménie Info »,
   `whatsapp-de` « Arménie Info – Deutsch », `whatsapp-it` « Arménie Info –
   Italiano », `whatsapp-org` « Armenia News », `whatsapp-es` « Armenia News en
   Español », `whatsapp-hy` « Արմենիա Ինֆո », `whatsapp-ru` « Armenia News на
   русском ». Vérifier le nom en haut de la conversation. Ne jamais lire ni
   ouvrir les conversations personnelles de l'utilisateur.
4. Taper le texte de `--list` tel quel ; attendre l'aperçu du lien.
5. Faire valider ce qui est à l'écran si c'est le premier message de la
   séance, puis Envoyer. Vérifier qu'il apparaît, puis `--mark`.
