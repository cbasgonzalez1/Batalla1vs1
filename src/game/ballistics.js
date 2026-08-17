import { clamp } from '../core/mathx.js';

/**
 * Balistica a mano. Sin motor de fisica.
 *
 * Integrador de Euler semi-implicito a paso fijo. Determinista por
 * construccion: no lee reloj, no lee Math.random, y el mismo estado inicial
 * con los mismos parametros produce siempre la misma trayectoria,
 * independientemente de los fps de la maquina.
 *
 * Es la MISMA funcion la que mueve el proyectil real y la que dibuja el arco
 * de previsualizacion. Si divergieran, el jugador aprenderia a desconfiar del
 * arco; compartir el paso lo hace imposible.
 */

export const FIXED_DT = 1 / 120;
export const GRAVITY = -26;

/** Un paso. Muta `s` en sitio. `s` = { x, y, vx, vy }. */
export function step(s, wind, dt) {
  s.vx += wind * dt;
  s.vy += GRAVITY * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

/**
 * Simula hacia delante hasta impactar el terreno o agotar el tiempo.
 * No muta nada externo. Devuelve los puntos muestreados y como termino.
 *
 * @returns {{ points: number[][], hit: null | {x:number,y:number}, steps:number, vx:number, vy:number }}
 */
export function simulate(start, wind, terrain, opts = {}) {
  const {
    maxSteps = 1200,        // 10 s de vuelo a 120 Hz
    sampleEvery = 5,        // un punto cada 5 pasos
    maxPoints = 64,
    bounds = null,
    // Choques que no son el terreno. Se recibe como funcion y no como lista de
    // obstaculos a proposito: asi la balistica no tiene que saber que existen
    // las minas ni los deflectores, solo que algo puede pasarle al proyectil.
    // Devuelve null, o { fin: {x,y} } para terminar el vuelo, o { rebote: true }
    // habiendo cambiado ya la velocidad de `s`.
    alChocar = null,
  } = opts;

  const s = { x: start.x, y: start.y, vx: start.vx, vy: start.vy };
  const points = [];
  let hit = null;
  let i = 0;

  for (; i < maxSteps; i++) {
    const px = s.x;
    const py = s.y;
    step(s, wind, FIXED_DT);

    if (alChocar) {
      const choque = alChocar(s, px, py);
      if (choque?.fin) {
        hit = choque.fin;
        points.push([hit.x, hit.y]);
        break;
      }
      // Un rebote no termina el vuelo: se apunta el punto para que el arco
      // dibuje el codo y se sigue volando con la velocidad ya cambiada.
      if (choque?.rebote && points.length < maxPoints) points.push([s.x, s.y]);
    }

    const impact = sweepTerrain(px, py, s.x, s.y, terrain);
    if (impact) {
      hit = impact;
      points.push([impact.x, impact.y]);
      break;
    }

    if (bounds && (s.x < bounds.minX || s.x > bounds.maxX || s.y < bounds.minY)) break;

    if (i % sampleEvery === 0 && points.length < maxPoints) {
      points.push([s.x, s.y]);
    }
  }

  // La velocidad final se devuelve porque Sotavento la necesita: cuanto mas
  // vertical llega el proyectil, mas lejos se lleva el viento la arena. Sin
  // esto no se puede anticipar el deposito antes de disparar.
  return { points, hit, steps: i, vx: s.vx, vy: s.vy };
}

/**
 * Colision contra el heightmap barriendo el segmento del paso. Sin esto, a
 * potencia alta el proyectil recorre mas de dos columnas por paso y puede
 * atravesar una cresta fina.
 */
export function sweepTerrain(x0, y0, x1, y1, terrain, substeps = 4) {
  for (let k = 1; k <= substeps; k++) {
    const t = k / substeps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (x < terrain.x0 || x > terrain.x0 + terrain.width) continue;
    const h = terrain.heightAt(x);
    if (y <= h) return { x, y: h };
  }
  return null;
}

/**
 * Vector de lanzamiento a partir de elevacion, potencia y orientacion.
 *
 * La potencia interpola el CUADRADO de la velocidad, no la velocidad. El
 * alcance de un tiro va con v^2, asi que interpolar v dejaba todo el alcance
 * util apinado en el ultimo tramo del arrastre; interpolando v^2 el alcance
 * crece lineal con el dedo y el control se vuelve legible.
 */
export function launchVelocity(phi, power, facing, speedMin, speedMax) {
  const p = clamp(power, 0, 1);
  const speed = Math.sqrt(speedMin * speedMin + p * (speedMax * speedMax - speedMin * speedMin));
  return {
    vx: Math.cos(phi) * speed * facing,
    vy: Math.sin(phi) * speed,
  };
}
