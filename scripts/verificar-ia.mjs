import { Terrain } from '../src/world/terrain.js';
import { mulberry32, hashSeed } from '../src/core/rng.js';
import { DIFICULTAD, apuntar } from '../src/game/ia.js';
import { simulate, launchVelocity } from '../src/game/ballistics.js';
import { BLAST, damageAt } from '../src/game/combat.js';
import { crearViento } from '../src/game/viento.js';

/**
 * ¿Significa algo la dificultad?
 *
 * Se tiran cientos de disparos en terreno REAL, con viento y relieve, y se mide
 * a que distancia del rival caen. Si las tres dificultades dieran lo mismo, el
 * dial seria decorativo.
 */

const BIOMA = { crest: '#c8b48a', body: '#a08a5e', deep: '#6b5638' };
const VELOCIDAD = { min: 14, max: 56 };
const COMBATES = 60;
const TIROS = 8;

const construir = (semilla) =>
  new Terrain({
    rng: mulberry32(hashSeed(semilla)),
    biome: BIOMA,
    width: 140,
    columns: 1400,
    depth: 18,
    minHeight: 3.2,
    amplitude: 13,
    bowlHalfWidth: 44,
    bowlWeight: 0.48,
    baseY: -80,
    floorY: -4,
    pads: [
      { x: -44, halfWidth: 2.6, feather: 3.2 },
      { x: 44, halfWidth: 2.6, feather: 3.2 },
    ],
  });

function medir(error) {
  const distancias = [];
  let impactos = 0;
  let alcanzados = 0;

  for (let c = 0; c < COMBATES; c++) {
    const terreno = construir(`ia-${c}`);
    const rng = mulberry32(hashSeed(`tiros-${error}-${c}`));
    const viento = crearViento(mulberry32(hashSeed(`viento-${c}`)));
    const origen = { x: -44, y: terreno.heightAt(-44) + 1.6 };
    const objetivo = 44;

    for (let t = 0; t < TIROS; t++) {
      const tiro = apuntar({
        origen, objetivo, viento: viento.actual, terreno, velocidad: VELOCIDAD, rng, error,
      });

      // Donde cae DE VERDAD el tiro que eligio la IA. Hay que simular su
      // potencia, no volver a buscar la mejor: buscarla otra vez mediria el
      // tiro perfecto y el error de la IA desapareceria del resultado.
      const phi = (tiro.anguloDeg * Math.PI) / 180;
      const v = launchVelocity(phi, tiro.potencia, 1, VELOCIDAD.min, VELOCIDAD.max);
      const vuelo = simulate({ ...origen, ...v }, viento.actual, terreno, {
        maxSteps: 1400,
        sampleEvery: 1000,
        maxPoints: 4,
        bounds: { minX: terreno.x0, maxX: terreno.x0 + terreno.width, minY: terreno.floorY - 10 },
      });
      if (!vuelo.hit) continue;

      const distancia = Math.abs(vuelo.hit.x - objetivo);
      distancias.push(distancia);
      impactos++;
      if (damageAt(objetivo + distancia, 0, objetivo, 0) > 0) alcanzados++;
      viento.avanzar();
    }
  }

  distancias.sort((a, b) => a - b);
  return {
    tiros: impactos,
    mediana: distancias[Math.floor(distancias.length / 2)] ?? Infinity,
    tasaDeAcierto: alcanzados / Math.max(1, impactos),
  };
}

console.log(`${COMBATES} combates x ${TIROS} tiros, terreno real con viento\n`);
const resultados = {};
for (const [nombre, error] of Object.entries(DIFICULTAD)) {
  const r = medir(error);
  resultados[nombre] = r;
  console.log(
    `${nombre.padEnd(8)} error=${String(error).padStart(4)}  ` +
      `mediana de fallo ${r.mediana.toFixed(2).padStart(6)} u  ` +
      `aciertan ${(r.tasaDeAcierto * 100).toFixed(0).padStart(3)} %`
  );
}

const { facil, normal, dificil } = resultados;
const ordenado = facil.tasaDeAcierto <= normal.tasaDeAcierto && normal.tasaDeAcierto <= dificil.tasaDeAcierto;
console.log(`\nla dificultad ordena la punteria: ${ordenado}`);
console.log(`radio de explosion: ${BLAST.radius}`);

const fallos = (ordenado ? 0 : 1) + (dificil.tasaDeAcierto < 0.5 ? 1 : 0) + (facil.tasaDeAcierto > 0.5 ? 1 : 0);
console.log(fallos === 0 ? '\nLA DIFICULTAD SIGNIFICA ALGO' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
