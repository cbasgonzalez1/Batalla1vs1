import { simulate, launchVelocity } from './ballistics.js';
import { clamp } from '../core/mathx.js';

/**
 * El rival de la maquina.
 *
 * Usa `simulate()` como oraculo: prueba tiros contra la MISMA funcion que mueve
 * el proyectil de verdad, asi que no hay una fisica de la IA y otra del juego
 * que puedan separarse.
 *
 * BARRE la potencia en vez de bisecarla, y esto no es un capricho: el alcance
 * NO crece de forma monotona con la potencia. Pasado cierto punto el proyectil
 * se sale del mundo y no impacta nunca, asi que la biseccion —que da por hecha
 * la monotonia— declara imposibles tiros que existen. Ya paso una vez, midiendo
 * los criterios de Sotavento: 200 de 200 combates salieron "sin solucion"
 * cuando todos la tenian.
 *
 * Modulo puro y determinista: todo el azar entra por el `rng` sembrado que se
 * le pasa, asi que dos moviles que simulen la misma partida ven a la IA hacer
 * exactamente lo mismo.
 */

export const DIFICULTAD = {
  // Error tipico del disparo, en unidades de mundo. A radio de explosion 5,2,
  // un error de 12 falla casi siempre y uno de 1,5 acierta casi siempre.
  facil: 12,
  normal: 6,
  dificil: 2.5,
};

/** Angulos que considera, de tenso a globo. */
const ANGULOS = [24, 32, 45, 58, 66];

/**
 * Busca la potencia que deja el impacto mas cerca del objetivo, para un angulo.
 * Devuelve null si con ese angulo no hay forma de llegar.
 */
export function resolverAngulo({ origen, objetivo, anguloDeg, viento, terreno, velocidad, muestras = 60 }) {
  const phi = (anguloDeg * Math.PI) / 180;
  const facing = Math.sign(objetivo - origen.x) || 1;
  const bordes = { minX: terreno.x0, maxX: terreno.x0 + terreno.width, minY: terreno.floorY - 10 };

  let mejor = null;

  for (let k = 1; k <= muestras; k++) {
    const potencia = k / muestras;
    const v = launchVelocity(phi, potencia, facing, velocidad.min, velocidad.max);
    const r = simulate({ ...origen, ...v }, viento, terreno, {
      maxSteps: 1400,
      sampleEvery: 1000,
      maxPoints: 4,
      bounds: bordes,
    });
    if (!r.hit) continue;

    const error = Math.abs(r.hit.x - objetivo);
    if (!mejor || error < mejor.error) {
      mejor = { anguloDeg, potencia, error, pasos: r.steps, vy: r.vy };
    }
  }

  return mejor;
}

/**
 * Elige el tiro.
 *
 * Entre los angulos que resuelven, prefiere el que menos se desvia. A igualdad
 * de puntería se queda con el de vuelo mas corto, que es el que menos tiempo le
 * da al rival para reaccionar.
 */
export function apuntar({ origen, objetivo, viento, terreno, velocidad, rng, error = DIFICULTAD.normal }) {
  const candidatos = ANGULOS
    .map((anguloDeg) => resolverAngulo({ origen, objetivo, anguloDeg, viento, terreno, velocidad }))
    .filter(Boolean)
    .filter((c) => c.error < 6);

  if (candidatos.length === 0) {
    // Nada llega: se tira con el angulo medio a toda potencia y a ver.
    return { anguloDeg: 45, potencia: 1, aCiegas: true };
  }

  candidatos.sort((a, b) => (Math.abs(a.error - b.error) > 0.5 ? a.error - b.error : a.pasos - b.pasos));
  const elegido = candidatos[0];

  // El fallo se mete DESPLAZANDO EL OBJETIVO, no toqueteando la potencia: asi
  // una IA facil falla como falla una persona —corta o larga— y no con un
  // angulo absurdo que se ve de lejos que es de maquina.
  const desvio = gaussiana(rng) * error;
  if (Math.abs(desvio) < 0.05) return { anguloDeg: elegido.anguloDeg, potencia: elegido.potencia };

  const conFallo = resolverAngulo({
    origen,
    objetivo: objetivo + desvio,
    anguloDeg: elegido.anguloDeg,
    viento,
    terreno,
    velocidad,
  });

  return {
    anguloDeg: elegido.anguloDeg,
    potencia: conFallo ? conFallo.potencia : elegido.potencia,
  };
}

/**
 * Normal(0,1) por Box-Muller, con el rng sembrado.
 *
 * Se usa una normal y no un uniforme porque los fallos de una persona se
 * agrupan cerca del objetivo y raras veces son enormes; un uniforme repartiria
 * los errores por igual y la IA pareceria que tira al azar.
 */
export function gaussiana(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Decide si gasta una carga de reaccion, y cual. */
export function reaccionar({ distanciaPrevista, radioLetal, cargas, rng, error = DIFICULTAD.normal }) {
  if (cargas <= 0) return null;

  // Cuanto peor es la IA, mas tarde ve venir el peligro.
  const vista = clamp(1 - error / 20, 0.15, 0.95);
  if (rng() > vista) return null;

  // Fuera del radio no hay nada que temer: gastar carga ahi es tirarla.
  if (distanciaPrevista > radioLetal) return null;

  // Muy cerca, saltar puede sacarte del radio; de refilon, el escudo cunde mas.
  return distanciaPrevista < radioLetal * 0.5 ? 'salto' : 'escudo';
}
