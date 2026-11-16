# Kit des chaînes YouTube : Arménie Info et Armenia News

Deux chaînes, comme pour Facebook et Instagram : une par site, une langue par
chaîne. Tout ce qui suit est prêt à copier-coller.

Fichiers (dossier `out/`) :

| Fichier | Où le mettre |
|---|---|
| `avatar.png` (1080×1080) | Photo de profil (les deux chaînes) |
| `banniere-armenie-info.png` (2560×1440) | Bannière de la chaîne française |
| `banniere-armenia-news.png` (2560×1440) | Bannière de la chaîne anglaise |
| `garni-fr.mp4` (1080×1920, ~44 s) | Premier Short, chaîne française |
| `garni-en.mp4` (1080×1920, ~44 s) | Premier Short, chaîne anglaise |

---

## 1. Créer les chaînes (à faire par toi)

YouTube → photo de profil → **Créer une chaîne**. Pour pouvoir en avoir deux,
et plus tard les confier à quelqu'un d'autre, choisis **un compte de marque**
(« Utiliser un nom personnalisé ») plutôt que ton nom.

## 2. Chaîne française : Arménie Info

- **Nom** : Arménie Info
- **Identifiant** (handle) : `@armenieinfo` (sinon `@armenieinfo-ch`)
- **Description** :

> Arménie Info raconte l'Arménie et sa diaspora : histoire, patrimoine,
> musique, personnalités. De courtes vidéos tirées des articles Culture
> d'armenieinfo.ch, chaque fait sourcé.
>
> Toute l'actualité arménienne, l'agenda de la diaspora et les radios
> arméniennes en direct : https://armenieinfo.ch

- **Liens** (Personnalisation → Informations de base → Liens) :
  - Site : https://armenieinfo.ch
  - Culture : https://armenieinfo.ch/culture/
  - Agenda : https://armenieinfo.ch/agenda/
- **Mots-clés de la chaîne** : Arménie, arménien, diaspora arménienne,
  histoire de l'Arménie, culture arménienne, patrimoine, Erevan, Suisse

## 3. Chaîne anglaise : Armenia News

- **Nom** : Armenia News
- **Identifiant** : `@armenianewsorg` (sinon `@armenia-news-org`)
- **Description** :

> Armenia News tells the story of Armenia and its diaspora: history,
> heritage, music and people. Short videos drawn from the Culture articles
> of armenianews.org, every fact sourced.
>
> Armenian news, diaspora events and live Armenian radio:
> https://armenianews.org

- **Liens** :
  - Website: https://armenianews.org
  - Culture: https://armenianews.org/culture/
  - Events: https://armenianews.org/events/
- **Mots-clés** : Armenia, Armenian, Armenian diaspora, Armenian history,
  Armenian culture, heritage, Yerevan

---

## 4. Le premier Short : Garni

Mettre en ligne depuis l'appli mobile, ou depuis YouTube Studio : une vidéo
verticale de moins de 3 minutes devient un Short d'elle-même.

### Français (chaîne Arménie Info)

**Titre** (≤ 100 caractères) :

> Le seul temple gréco-romain encore debout de l'ex-URSS 🏛️ #Arménie

**Description** :

> Le temple de Garni, bâti vers 76–77 par le roi Tiridate Iᵉʳ, jeté à terre
> par le séisme de 1679, puis remonté pierre par pierre entre 1969 et 1975.
>
> L'article complet : https://armenieinfo.ch/culture/temple-paien-de-garni/?utm_source=youtube&utm_medium=video
>
> Photo : Katsiaryna Naliuka, « Ancient temple in Garni », CC BY-SA 4.0,
> via Wikimedia Commons :
> https://commons.wikimedia.org/wiki/File:Ancient_temple_in_Garni.jpg
> Cette vidéo est diffusée sous la même licence (CC BY-SA 4.0).
>
> #Arménie #Garni #histoire #patrimoine #Shorts

### Anglais (chaîne Armenia News)

**Titre** :

> The only Greco-Roman temple still standing in the former USSR 🏛️ #Armenia

**Description** :

> Garni Temple, built around AD 76–77 by King Tiridates I, toppled by the
> 1679 earthquake, then rebuilt stone by stone between 1969 and 1975.
>
> Full article: https://armenianews.org/culture/temple-paien-de-garni/?utm_source=youtube&utm_medium=video
>
> Photo: Katsiaryna Naliuka, "Ancient temple in Garni", CC BY-SA 4.0,
> via Wikimedia Commons:
> https://commons.wikimedia.org/wiki/File:Ancient_temple_in_Garni.jpg
> This video is shared under the same licence (CC BY-SA 4.0).
>
> #Armenia #Garni #history #heritage #Shorts

### Réglages à l'envoi

- **Public** : « Non, elle n'est pas conçue pour les enfants ».
- **Contenu modifié ou synthétique** : non. Ce sont du texte et une photo
  réelle, sans visage ni voix générés.
- **Musique** : la vidéo est muette. Dans l'éditeur des Shorts, « Ajouter un
  son » propose la bibliothèque audio de YouTube, libre de droits sur YouTube.
  Un son discret aide la diffusion.
- **Lien vers une vidéo** (Shorts) : plus tard, quand la chaîne aura une
  vidéo longue, relie-la ici.

---

## 5. Après la mise en ligne

Envoie-moi les deux liens YouTube. Je pourrai alors :

1. intégrer chaque vidéo dans son article Culture, avec le balisage
   `VideoObject`, pour que Google montre la vidéo dans ses résultats (le
   « SEO vidéo » proprement dit) ;
2. ajouter le lien de la chaîne au pied de page des deux sites, à côté de
   Facebook, Instagram, Bluesky et Telegram.

## 6. Faire les vidéos suivantes

Chaque article Culture peut donner un Short : on écrit ses 7 faits dans
`src/<sujet>/content.ts` (chacun pris dans l'article publié), on choisit sa
photo, puis :

```bash
npx remotion studio                         # aperçu
npx remotion render GarniFr out/garni-fr.mp4
```
