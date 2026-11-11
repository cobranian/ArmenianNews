// Hasard équitable du mode ami : chaque lancer mêle un secret du lanceur
// (engagé d'avance par son SHA-256) et un apport de l'adversaire.
// SHA-256 synchrone en JS pur : ce module tourne aussi dans le navigateur.

import { deDepuisOctet } from './rules.js';

export const HEX32 = /^[0-9a-f]{32}$/;
export const HEX64 = /^[0-9a-f]{64}$/;

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotd = (x, n) => (x >>> n) | (x << (32 - n));

// SHA-256 (FIPS 180-4) d'un Uint8Array -> Uint8Array(32).
export function sha256(octets) {
  const n = octets.length;
  const total = ((n + 9 + 63) >> 6) << 6; // multiple de 64 qui contient octets, 0x80 et la longueur
  const m = new Uint8Array(total);
  m.set(octets);
  m[n] = 0x80;
  const vue = new DataView(m.buffer);
  vue.setUint32(total - 8, Math.floor((n * 8) / 2 ** 32));
  vue.setUint32(total - 4, (n * 8) >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let bloc = 0; bloc < total; bloc += 64) {
    for (let i = 0; i < 16; i++) w[i] = vue.getUint32(bloc + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotd(w[i - 15], 7) ^ rotd(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotd(w[i - 2], 17) ^ rotd(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotd(e, 6) ^ rotd(e, 11) ^ rotd(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotd(a, 2) ^ rotd(a, 13) ^ rotd(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d;
    h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const sortie = new Uint8Array(32);
  const vs = new DataView(sortie.buffer);
  for (let i = 0; i < 8; i++) vs.setUint32(i * 4, h[i]);
  return sortie;
}

export const versHex = (octets) =>
  Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');

// Hex minuscule -> octets ; null si longueur impaire ou caractère invalide.
export function depuisHex(s) {
  if (typeof s !== 'string' || s.length % 2 !== 0 || !/^[0-9a-f]*$/.test(s)) return null;
  const r = new Uint8Array(s.length / 2);
  for (let i = 0; i < r.length; i++) r[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return r;
}

// Source d'octets aléatoires : (n) -> Uint8Array de n octets. Par défaut `crypto`.
// Les tests peuvent en injecter une déterministe via `fixerSource` (jamais appelée par le jeu).
export const sourceCrypto = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
let sourceCourante = sourceCrypto;

// Installe la source (null ou rien : retour à `crypto`) et renvoie la précédente.
export function fixerSource(source) {
  const avant = sourceCourante;
  sourceCourante = source ?? sourceCrypto;
  return avant;
}

// 16 octets aléatoires en hex (secrets et apports).
export function nouveauSecret(source = sourceCourante) {
  return versHex(source(16));
}

export const engagement = (secretHex) => versHex(sha256(depuisHex(secretHex)));

// Dés tirés d'une suite d'octets (rejet des octets >= 252).
// Lancer : les deux premiers dés. Ouverture : première paire non égale
// (paires consécutives, sans recouvrement). null si les octets ne suffisent pas.
export function desDepuisOctets(octets, ouverture) {
  const des = [];
  for (const o of octets) {
    const d = deDepuisOctet(o);
    if (d !== null) des.push(d);
  }
  if (!ouverture) return des.length >= 2 ? [des[0], des[1]] : null;
  for (let i = 0; i + 1 < des.length; i += 2) {
    if (des[i] !== des[i + 1]) return [des[i], des[i + 1]];
  }
  return null;
}

const entier32 = (x) => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;

// Dés équitables d'un lancer : condensat de secret ‖ apport ‖ match ‖ manche ‖ numero ‖ k.
export function desEquitables({ secret, apport, match, manche, numero, ouverture }) {
  if (typeof secret !== 'string' || !HEX32.test(secret)) throw new Error('Secret invalide');
  if (typeof apport !== 'string' || !HEX32.test(apport)) throw new Error('Apport invalide');
  if (!entier32(match) || !entier32(manche) || !entier32(numero)) throw new Error('Compteur invalide');

  const entree = new Uint8Array(45);
  entree.set(depuisHex(secret), 0);
  entree.set(depuisHex(apport), 16);
  const vue = new DataView(entree.buffer);
  vue.setUint32(32, match);
  vue.setUint32(36, manche);
  vue.setUint32(40, numero);

  let octets = new Uint8Array(0);
  for (let k = 0; k < 256; k++) {
    entree[44] = k;
    const suite = new Uint8Array(octets.length + 32);
    suite.set(octets);
    suite.set(sha256(entree), octets.length);
    octets = suite;
    const des = desDepuisOctets(octets, !!ouverture);
    if (des) return des;
  }
  throw new Error('Hasard épuisé');
}
