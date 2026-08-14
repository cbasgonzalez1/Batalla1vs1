/**
 * Ruido de valor 1D + fBm. Determinista: la tabla se llena desde un PRNG
 * con semilla, asi que la misma semilla da siempre el mismo terreno.
 */

const TABLE_SIZE = 1024;
const TABLE_MASK = TABLE_SIZE - 1;

export function makeNoise1D(rng) {
  const table = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) table[i] = rng();

  return function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    // smootherstep de Perlin: 6t^5 - 15t^4 + 10t^3
    const u = f * f * f * (f * (f * 6 - 15) + 10);
    const a = table[i & TABLE_MASK];
    const b = table[(i + 1) & TABLE_MASK];
    return a + (b - a) * u;
  };
}

/** fBm normalizado a [0, 1]. */
export function fbm1D(noise, x, { octaves = 5, lacunarity = 2.07, gain = 0.52 } = {}) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
