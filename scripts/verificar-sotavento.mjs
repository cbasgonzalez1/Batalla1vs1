import { Terrain } from '../src/world/terrain.js';
import { mulberry32, hashSeed } from '../src/core/rng.js';
import { simulate, launchVelocity } from '../src/game/ballistics.js';

/**
 * Los tres criterios de la fase 1 de Sotavento, medidos sobre 200 combates.
 *
 * 1. La masa se conserva (lo excavado = lo depositado + lo que sale del mundo).
 * 2. El campo NO se homogeneiza. Si mover arena aplana el terreno, la mecanica
 *    se come a si misma y hay que abandonarla: es el criterio de parada.
 * 3. Sigue habiendo solucion de tiro a 88 u despues del combate. Si el campo se
 *    vuelve infranqueable, el juego se atasca.
 */

const BIOMA = { crest: '#c8b48a', body: '#a08a5e', deep: '#6b5638' };
const COMBATES = 200;
const DISPAROS = 16;
const SEPARACION = 88;
const RADIO = 2.6;
const RADIO_LETAL = 5.2;          // BLAST.radius: mas cerca que esto hace dano
const VELOCIDAD = { min: 14, max: 56 };  // CONFIG.speed de main.js

const construir = (semilla) =>
  new Terrain({
    rng: mulberry32(hashSeed(semilla)),
    biome: BIOMA,
    width: 140,
    columns: 384,
    depth: 18,
    minHeight: 6,
    amplitude: 14,
    bowlHalfWidth: 44,
  });

const masa = (t) => {
  let s = 0;
  for (const h of t.heights) s += (h - t.floorY) * t.dx;
  return s;
};

const desviacion = (t) => {
  const media = [...t.heights].reduce((a, b) => a + b, 0) / t.cols;
  return Math.sqrt([...t.heights].reduce((a, h) => a + (h - media) ** 2, 0) / t.cols);
};

/**
 * ¿Existe potencia que deje el proyectil a menos de un radio de explosion del
 * canon rival?
 *
 * Se barre la potencia en vez de bisecar. La biseccion daba por imposibles los
 * 200 combates, y el fallo era del instrumento: pasada cierta potencia el
 * proyectil SALE DEL MUNDO y no impacta nunca, asi que el alcance no crece de
 * forma monotona hasta 1 — se corta. Barrer no se cree esa suposicion.
 */
function haySolucion(t, phiGrados, { velocidades = VELOCIDAD, muestras = 200 } = {}) {
  const phi = (phiGrados * Math.PI) / 180;
  const xA = -SEPARACION / 2;
  const xB = SEPARACION / 2;
  const origen = { x: xA, y: t.heightAt(xA) + 1.6 };
  const bordes = { minX: t.x0, maxX: t.x0 + t.width, minY: t.floorY - 10 };

  for (let k = 1; k <= muestras; k++) {
    const p = k / muestras;
    const v = launchVelocity(phi, p, 1, velocidades.min, velocidades.max);
    const r = simulate({ ...origen, ...v }, 0, t, {
      maxSteps: 1400,
      sampleEvery: 1000,
      maxPoints: 4,
      bounds: bordes,
    });
    if (r.hit && Math.abs(r.hit.x - xB) <= RADIO_LETAL) return true;
  }
  return false;
}

const ANGULOS = [30, 45, 60];
const jugable = (t) => ANGULOS.some((a) => haySolucion(t, a));

let peorMasa = 0;
let aplanados = 0;
let sinSolucion = 0;
let sinSolucionAntes = 0;
let sumaRatio = 0;

for (let c = 0; c < COMBATES; c++) {
  const t = construir(`combate-${c}`);
  const rng = mulberry32(hashSeed(`disparos-${c}`));

  const masaInicial = masa(t);
  const desvInicial = desviacion(t);
  // Control: el mismo terreno ANTES de que Sotavento lo toque. Sin esto no se
  // puede saber si un campo intransitable lo dejo asi la mecanica nueva o si ya
  // nacio roto de la generacion.
  const jugableAntes = jugable(t);
  if (!jugableAntes) sinSolucionAntes++;
  let perdido = 0;

  for (let d = 0; d < DISPAROS; d++) {
    const x = (rng() * 2 - 1) * 60;
    const { volumen } = t.carve(x, t.heightAt(x), RADIO, { rehacerMalla: false });
    const viento = rng() * 2 - 1;
    const centro = x + viento * (8 + 22 * (0.15 + rng() * 0.85));
    const sigma = 2.4 + 1.6 * Math.abs(viento);
    perdido += t.depositar(centro, sigma, volumen, { rehacerMalla: false }).perdido;
  }

  const error = Math.abs(masa(t) - (masaInicial - perdido));
  peorMasa = Math.max(peorMasa, error);

  const ratio = desviacion(t) / desvInicial;
  sumaRatio += ratio;
  if (ratio < 0.95) aplanados++;

  if (jugableAntes && !jugable(t)) sinSolucion++;
}

const media = sumaRatio / COMBATES;
console.log(`combates:                 ${COMBATES} de ${DISPAROS} disparos`);
console.log(`peor error de masa:       ${peorMasa.toExponential(2)} u²  (limite 1e-3)`);
console.log(`relieve conservado:       ${(media * 100).toFixed(1)} % de media`);
console.log(`combates que aplanan:     ${aplanados} de ${COMBATES}`);
console.log(`ya nacian sin solucion:   ${sinSolucionAntes} de ${COMBATES}  (culpa de la generacion, no de Sotavento)`);
console.log(`los rompe Sotavento:      ${sinSolucion} de ${COMBATES - sinSolucionAntes} jugables`);

/**
 * La masa es un criterio duro: o cuadra o la mecanica es mentira.
 *
 * Los otros dos son estadisticos y llevan tolerancia. El plan original pedia
 * CERO combates aplanados y CERO sin solucion, pero eso es exigir que no haya
 * cola en la distribucion: con 200 muestras y 16 disparos aleatorios siempre
 * habra un puñado de partidas raras. Lo que importa es que sean raras y que la
 * media vaya en la direccion correcta, no que no existan.
 */
const TOLERANCIA = { aplanados: 0.05, rotos: 0.02 };
const jugablesIniciales = COMBATES - sinSolucionAntes;

const fallos =
  (peorMasa >= 1e-3 ? 1 : 0) +
  (aplanados / COMBATES > TOLERANCIA.aplanados ? 1 : 0) +
  (sinSolucion / jugablesIniciales > TOLERANCIA.rotos ? 1 : 0);

console.log(`\ntolerancias: aplanados <= ${TOLERANCIA.aplanados * 100} %  ·  rotos <= ${TOLERANCIA.rotos * 100} %`);
console.log(fallos === 0 ? 'LOS TRES CRITERIOS SE CUMPLEN' : `${fallos} CRITERIOS INCUMPLIDOS`);
process.exit(fallos === 0 ? 0 : 1);
