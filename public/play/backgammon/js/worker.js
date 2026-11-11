// Backgammon — choix du tour du robot hors du fil principal (Web Worker module).
// Message reçu : { pos, joueur, des, niveau, budgetMs } ; réponse : { tour } ou { erreur }.

import { choisirTour } from './robot.js';

self.onmessage = ({ data }) => {
  try {
    const { pos, joueur, des, niveau, budgetMs } = data;
    self.postMessage({ tour: choisirTour(pos, joueur, des, niveau, { budgetMs }) });
  } catch (e) {
    self.postMessage({ erreur: e instanceof Error ? e.message : String(e) });
  }
};
