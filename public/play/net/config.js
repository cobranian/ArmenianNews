// Config web Firebase d'Arménie Info (projet armenie-info) pour le mode
// « avec un ami » des jeux. Ce n'est PAS un secret : elle part chez chaque
// visiteur. Écrite à la main, JAMAIS écrasée par npm run jeux:sync (qui
// recopie le reste de public/play/net/ depuis lokolok, dont le config.js vise
// le projet de lokolok). À remplir depuis la console Firebase (⚙ Paramètres
// du projet → Vos applications → Application Web) — voir la section Jeux du
// README. Tant que apiKey est vide, salle.js refuse de se connecter avec un
// message clair.
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: 'armenie-info.firebaseapp.com',
  databaseURL: '',
  projectId: 'armenie-info',
  appId: '',
};
