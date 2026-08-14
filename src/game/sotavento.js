import { clamp } from '../core/mathx.js';
import { VIENTO } from './viento.js';

/**
 * A donde va la arena que levanta un impacto.
 *
 * Dos diales independientes, y que sean independientes es lo importante:
 *
 * - CUAN LEJOS la lleva depende del viento Y del alzado del tiro. Un obus que
 *   cae casi vertical levanta una columna alta que el viento arrastra lejos;
 *   uno raso escupe la arena de lado y la deja cerca.
 * - CUAN ANCHA cae depende SOLO del viento. Si la anchura creciera tambien con
 *   el alzado, con viento flojo la campana colapsaria en una aguja y el
 *   parapeto solo existiria en el caso de desplazamiento cero — que es
 *   justamente el caso en que la arena vuelve a caer en el crater y no sirve
 *   de nada.
 *
 * Modulo puro: ni azar, ni reloj, ni estado. Los seis moviles calculan el
 * mismo monton de arena a partir de los mismos tres numeros.
 */

export const TRANSPORTE = {
  // Alcance del acarreo, en unidades de mundo, entre viento nulo y viento pleno.
  arrastreBase: 8,
  arrastrePorAlzado: 22,
  // Velocidad vertical de impacto que se considera "caida plena".
  alzadoPleno: 50,
  alzadoMinimo: 0.15,
  // Anchura de la campana: nunca baja de esto, por muy en calma que este.
  anchuraBase: 2.4,
  anchuraPorViento: 1.6,
};

/** Cuanto se parece el tiro a una caida vertical, de 0,15 a 1. */
export function alzadoDe(velocidadVertical, ajustes = TRANSPORTE) {
  const caida = Math.abs(velocidadVertical ?? 0);
  return clamp(caida / ajustes.alzadoPleno, ajustes.alzadoMinimo, 1);
}

/**
 * Centro y anchura del deposito.
 *
 * @param {number} xImpacto  donde revento el proyectil
 * @param {number} viento    con signo; positivo empuja a la derecha
 * @param {number} vyImpacto velocidad vertical al impactar
 */
export function transporte(xImpacto, viento, vyImpacto, ajustes = TRANSPORTE, limiteViento = VIENTO.limite) {
  const w = clamp(viento / limiteViento, -1, 1);
  const alzado = alzadoDe(vyImpacto, ajustes);

  return {
    centro: xImpacto + w * (ajustes.arrastreBase + ajustes.arrastrePorAlzado * alzado),
    anchura: ajustes.anchuraBase + ajustes.anchuraPorViento * Math.abs(w),
    alzado,
  };
}

/**
 * Altura del pico que dejara ese deposito, para poder anunciarlo antes de
 * disparar sin tener que tocar el terreno.
 */
export const picoDe = (volumen, anchura) => volumen / (anchura * Math.sqrt(2 * Math.PI));
