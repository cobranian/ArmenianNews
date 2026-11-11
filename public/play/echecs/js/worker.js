// Échecs — choix du coup du robot hors du fil principal (Web Worker module).
// Message reçu : { fen, coups, niveau, budgetMs } ; réponse : { coup: 'e2e4', profondeur } ou { erreur }.

import { choisirCoup } from './robot.js';
import { versUCI } from './rules.js';

self.onmessage = ({ data }) => {
  try {
    const { fen, coups, niveau, budgetMs } = data;
    const { coup, profondeur } = choisirCoup({ fen, coups }, niveau, { budgetMs });
    self.postMessage({ coup: versUCI(coup), profondeur });
  } catch (e) {
    self.postMessage({ erreur: e instanceof Error ? e.message : String(e) });
  }
};
