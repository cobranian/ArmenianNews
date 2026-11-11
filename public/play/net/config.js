// Config web Firebase d'Arménie Info (projet armenie-info) pour le mode
// « avec un ami » des jeux. Ce n'est PAS un secret : elle part chez chaque
// visiteur. Écrite à la main, JAMAIS écrasée par npm run jeux:sync (qui
// recopie le reste de public/play/net/ depuis lokolok, dont le config.js vise
// le projet de lokolok). Valeurs de la console Firebase (⚙ Paramètres du
// projet → Vos applications → Application Web) — voir la section Jeux du
// README. Si apiKey était vidée, salle.js refuserait de se connecter avec un
// message clair.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAwNzzlmqNdt0pfRyPe2HiIPmOKRBk9hlk',
  authDomain: 'armenie-info.firebaseapp.com',
  databaseURL: 'https://armenie-info-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'armenie-info',
  appId: '1:95859451112:web:9ffab14950fb89f0a3955d',
};
