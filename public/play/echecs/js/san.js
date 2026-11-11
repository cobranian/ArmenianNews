// Notation algébrique française (SAN) : R T D F C, pion sans lettre.

import { nomCase, coupsLegaux, jouer, enEchec } from './rules.js';

const LETTRE = { K: 'R', R: 'T', Q: 'D', B: 'F', N: 'C' };

export function san(pos, coup) {
  const piece = pos.cases[coup.de].toUpperCase();
  const colDe = coup.de & 7;
  const colVers = coup.vers & 7;
  let s;
  if (piece === 'K' && Math.abs(colVers - colDe) === 2) {
    s = colVers > colDe ? 'O-O' : 'O-O-O';
  } else {
    const prise = pos.cases[coup.vers] !== '' || (piece === 'P' && colDe !== colVers);
    if (piece === 'P') {
      s = (prise ? 'abcdefgh'[colDe] + 'x' : '') + nomCase(coup.vers);
      if (coup.promo) s += '=' + LETTRE[coup.promo.toUpperCase()];
    } else {
      s = LETTRE[piece];
      // Autres pièces identiques pouvant jouer légalement vers la même case.
      const autres = coupsLegaux(pos).filter((c) =>
        c.vers === coup.vers && c.de !== coup.de && pos.cases[c.de] === pos.cases[coup.de]);
      if (autres.length) {
        const memeCol = autres.some((c) => (c.de & 7) === colDe);
        const memeRang = autres.some((c) => (c.de >> 3) === (coup.de >> 3));
        if (!memeCol) s += 'abcdefgh'[colDe];
        else if (!memeRang) s += (coup.de >> 3) + 1;
        else s += nomCase(coup.de);
      }
      s += (prise ? 'x' : '') + nomCase(coup.vers);
    }
  }
  const apres = jouer(pos, coup);
  if (enEchec(apres)) s += coupsLegaux(apres).length === 0 ? '#' : '+';
  return s;
}
