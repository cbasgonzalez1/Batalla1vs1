/**
 * PRNG con semilla. Es la UNICA fuente de aleatoriedad del proyecto.
 * Math.random() esta prohibido en cualquier codigo que toque la simulacion.
 */

/** mulberry32: rapido, buena distribucion, estado de 32 bits. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de cadena a entero de 32 bits, para semillas legibles. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Devuelve un flotante en [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}
