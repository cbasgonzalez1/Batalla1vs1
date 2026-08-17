import { clamp } from '../core/mathx.js';

/**
 * Avanzar el blindado: la decision que faltaba en cada turno.
 *
 * Hasta ahora un turno era una sola cosa —apuntar y soltar— y entre disparo y
 * disparo no habia nada que hacer. Poder moverse convierte cada turno en una
 * eleccion: gastas el deposito en buscar mejor angulo o lo guardas y tiras
 * desde donde estas.
 *
 * Y engancha con lo que ya hace el juego, que es lo importante. Sotavento
 * mueve arena a sotavento del impacto; con avance, esa arena deja de ser solo
 * relieve y pasa a ser un MURO. Amontonar bastante delante del rival lo deja
 * encerrado en su hoyo, porque una oruga no sube de cierta pendiente. Es la
 * primera vez que construir terreno tiene una consecuencia directa sobre el
 * otro jugador.
 *
 * Modulo puro: no sabe de Three, ni del DOM, ni de red. Y es IDEMPOTENTE — se
 * le pasa siempre la x de inicio de turno y el desplazamiento pedido, nunca un
 * incremento. Es lo que permite que el movimiento viaje por el cable como un
 * solo numero: los seis moviles lo recalculan y les sale lo mismo.
 */

export const AVANCE = {
  // Deposito lleno y lo que se repone por turno. A 36 por turno y 8 por unidad
  // llana, un turno da unas 4,5 unidades de paseo: se nota, pero cruzar el
  // campo de 88 cuesta veinte turnos. No se puede huir, solo reposicionarse.
  deposito: 100,
  recarga: 36,
  costeLlano: 8,
  // Subir cuesta caro. Es lo que hace que el terreno importe: el que se queda
  // en el fondo de un crater se queda ahi.
  costeCuesta: 26,
  // Pendiente que la oruga ya no sube: tan(42 grados). Un talud de arena recien
  // caida se asienta a 34 grados, asi que un monton fresco SI se sube — pero
  // dos capas apiladas ya no. Ahi esta el juego.
  pendienteMaxima: 0.9,
  // Resolucion de la integracion. Fina para que el coste de una cuesta corta no
  // dependa de si el paso cae antes o despues de ella.
  paso: 0.25,
};

/**
 * Mueve desde `x` una distancia `pedido` (con signo), gastando combustible.
 *
 * @param {object} opciones
 * @param {number} opciones.x         posicion al empezar el turno
 * @param {number} opciones.pedido    desplazamiento pedido, con signo
 * @param {number} opciones.combustible
 * @param {(x:number) => number} opciones.alturaEn
 * @param {number} opciones.minX
 * @param {number} opciones.maxX
 * @returns {{x:number, combustible:number, recorrido:number, bloqueado:boolean}}
 */
export function mover({ x, pedido, combustible, alturaEn, minX, maxX, ajustes = AVANCE }) {
  const signo = Math.sign(pedido);
  const meta = Math.abs(pedido);
  let actual = x;
  let queda = combustible;
  let bloqueado = false;

  if (signo === 0 || meta === 0 || queda <= 0) {
    return { x, combustible, recorrido: 0, bloqueado: false };
  }

  let recorrido = 0;
  // Tope de vueltas: la integracion siempre avanza `paso`, pero mas vale un
  // guardia que un bucle infinito si alguien pide un desplazamiento absurdo.
  const vueltas = Math.ceil(meta / ajustes.paso) + 1;

  for (let i = 0; i < vueltas && recorrido < meta - 1e-9; i++) {
    const tramo = Math.min(ajustes.paso, meta - recorrido);
    const siguiente = clamp(actual + signo * tramo, minX, maxX);
    if (siguiente === actual) break; // pegado al borde del mundo

    const desnivel = alturaEn(siguiente) - alturaEn(actual);
    const pendiente = desnivel / Math.abs(siguiente - actual);
    if (pendiente > ajustes.pendienteMaxima) {
      bloqueado = true;
      break;
    }

    const coste = tramo * (ajustes.costeLlano + ajustes.costeCuesta * Math.max(0, pendiente));
    if (coste > queda) break;

    queda -= coste;
    recorrido += tramo;
    actual = siguiente;
  }

  return { x: actual, combustible: queda, recorrido: recorrido * (signo || 1), bloqueado };
}

/** Lo que se repone al empezar un turno. */
export function repostar(combustible, ajustes = AVANCE) {
  return Math.min(ajustes.deposito, combustible + ajustes.recarga);
}

/**
 * ¿Puede moverse algo desde aqui, en alguna direccion?
 *
 * Sirve para avisar al jugador de que esta encerrado: sin esto, aprietas el
 * boton y no pasa nada, y no queda claro si el juego esta roto o si el rival te
 * ha construido una pared.
 */
export function encerrado({ x, combustible, alturaEn, minX, maxX, ajustes = AVANCE }) {
  if (combustible < ajustes.paso * ajustes.costeLlano) return true;
  for (const signo of [-1, 1]) {
    const r = mover({ x, pedido: signo * ajustes.paso, combustible, alturaEn, minX, maxX, ajustes });
    if (Math.abs(r.recorrido) > 1e-9) return false;
  }
  return true;
}

/** Cuanto queda de deposito, de 0 a 1, para pintar la barra. */
export function fraccion(combustible, ajustes = AVANCE) {
  return clamp(combustible / ajustes.deposito, 0, 1);
}
