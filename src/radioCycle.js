/* La station d'après (dir = 1) ou d'avant (dir = -1) dans l'ordre de la liste,
 * pour les boutons ⏮ / ⏭ de l'écran de verrouillage (Media Session, voir
 * `Radio.jsx`). Elle saute les stations `offAir` et boucle aux deux bouts, comme
 * le tambour mobile. Module plat, sans React, pour que Node puisse le tester.
 *
 * Renvoie l'id courant si aucune autre station n'est à l'antenne : rester sur
 * place vaut mieux que couper le flux pour un mount muet. */
export function stepStation(stations, currentId, dir) {
  const n = stations.length
  if (!n) return currentId
  const from = stations.findIndex((s) => s.id === currentId)
  // Station inconnue : ⏭ part d'« avant le début » et tombe sur la première,
  // ⏮ part du début et tombe sur la dernière.
  const start = from === -1 ? (dir > 0 ? -1 : 0) : from
  for (let k = 1; k <= n; k++) {
    const s = stations[(((start + dir * k) % n) + n) % n]
    if (!s.offAir && s.id !== currentId) return s.id
  }
  return currentId
}
