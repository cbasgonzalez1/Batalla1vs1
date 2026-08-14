import { picoDe } from './sotavento.js';

/**
 * Que aprende el jugador de un disparo que no acerto.
 *
 * A 88 unidades el rival no cabe en pantalla, asi que hoy fallar no enseña
 * nada: ves el arco salir y no vuelves a saber del proyectil. Eso convierte
 * cada fallo en un turno tirado a la basura, que es el pecado del genero.
 *
 * Esto devuelve dos numeros, no uno: cuanto fallaste Y que construiste. El
 * segundo es el que hace que un turno fallado siga valiendo para algo.
 *
 * Modulo puro: sin azar, sin reloj, sin DOM.
 */

/** Se considera que la arena "le cae encima" si el monton llega a esta distancia. */
export const CERCA = 8;

/**
 * @param {object} tiro
 * @param {number} tiro.xImpacto   donde revento
 * @param {number} tiro.xObjetivo  donde esta el rival
 * @param {number} tiro.facing     +1 si disparas hacia la derecha, -1 si a la izquierda
 * @param {number} [tiro.volumen]  arena levantada
 * @param {number} [tiro.centro]   donde cae esa arena
 * @param {number} [tiro.anchura]  anchura de la campana
 */
export function lecturaDeTiro({ xImpacto, xObjetivo, facing, volumen = 0, centro = null, anchura = 0 }) {
  const desvio = (xImpacto - xObjetivo) * Math.sign(facing || 1);

  const lectura = {
    // 'corto' se queda antes del rival; 'largo' se pasa. Medido en el sentido
    // del disparo, para que un jugador que tira hacia la izquierda lea lo mismo
    // que uno que tira hacia la derecha.
    sentido: desvio < 0 ? 'corto' : 'largo',
    distancia: Math.abs(desvio),
    arena: null,
  };

  if (volumen > 0 && centro !== null && anchura > 0) {
    const hastaElRival = Math.abs(centro - xObjetivo);
    lectura.arena = {
      pico: picoDe(volumen, anchura),
      distancia: hastaElRival,
      // Le ha caido encima: el suelo del rival ha subido y su solucion de tiro
      // acaba de caducar.
      encima: hastaElRival <= CERCA,
    };
  }

  return lectura;
}

/** Un tiro que hace daño no necesita lectura de fallo: ya la dio la vida del rival. */
export const acerto = (lectura, radioLetal) => lectura.distancia <= radioLetal;
