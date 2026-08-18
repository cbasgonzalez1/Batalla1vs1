/**
 * Tres propuestas de pieza: lo que el jugador conduce y con lo que dispara.
 *
 * No son tres skins. Cada una cambia la partida por un sitio distinto —cuanto
 * te mueves, como de plana es tu trayectoria y cuanto aguantas— y por eso hay
 * que elegir UNA antes de modelar nada. Las tres respetan `Y_PIVOTE`, que es lo
 * unico que no se negocia (ARTE.md §9).
 */

import {
  caminoRedondeado, circulo, caja, camino, grupo, polilinea,
  sombraContacto, filaRemaches, rueda, siluetaUnica,
} from './primitivas.js';
import { CAUCHO, claro, camuflaje, oscuro, contorno } from './paleta.js';
import { FICHAS, construir, Y_PIVOTE } from './vehiculos.js';

const GROSOR = 0.066;
const LUZ = [0.1, -0.15];

/** Rota un punto alrededor del origen. */
function rot([x, y], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/** Tubo con el freno como engrosamiento de la punta, igual que en los blindados. */
function tubo({ raiz, largo, r, ang = 0, freno = 'ninguno' }) {
  const rf = freno === 'ninguno' ? r : r * 1.8;
  const lf = freno === 'ninguno' ? 0 : Math.min(0.5, largo * 0.16);
  const pts = [[0, -r], [largo - lf, -r]];
  if (lf) pts.push([largo - lf, -rf], [largo, -rf], [largo, rf], [largo - lf, rf]);
  else pts.push([largo, -r], [largo, r]);
  pts.push([largo - lf, r], [0, r]);
  return caminoRedondeado(pts.map((p) => rot(p, ang)).map((p) => [p[0] + raiz[0], p[1] + raiz[1]]), r * 0.4);
}

/**
 * Rueda de radios de una pieza remolcada. Es lo que dice «1916» sin un texto, y
 * es su unica pieza cara: doce radios modelados. Se dibuja como geometria y no
 * como calcomania porque a traves de ella se ve el terreno.
 */
function ruedaRadios(cx, cy, r, c) {
  let s = camino(circulo(cx, cy, r), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.9), { fill: c.base });
  s += camino(circulo(cx, cy, r * 0.78), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.71), { fill: claro(c.base) });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const p0 = [cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2];
    const p1 = [cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74];
    s += camino(polilinea([p0, p1]), { stroke: c.contorno, 'stroke-width': r * 0.11, 'stroke-linecap': 'round', fill: 'none' });
  }
  s += camino(circulo(cx, cy, r * 0.24), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.16), { fill: c.base });
  return s;
}

/** Pinta una lista de formas como un cuerpo con contorno unico y tres tonos. */
function cuerpo(formas, base, { negro = false, dentro = '' } = {}) {
  const col = negro
    ? { c: '#12140c', l: '#12140c', b: '#12140c' }
    : { c: contorno(base), l: claro(base), b: base };
  return siluetaUnica({
    formas, cont: col.c, tonoClaro: col.l, tonoBase: col.b,
    grosor: GROSOR, luz: LUZ, dentro: negro ? '' : dentro,
  });
}

// ── A. Blindado con torreta ───────────────────────────────────────────────

function blindado(base, negro) {
  return construir(FICHAS.find((f) => f.id === 'media'), { base, negro });
}

// ── B. Pieza de campana ───────────────────────────────────────────────────

/**
 * Canon de campana sobre curena. Cuatro masas y nada mas: RUEDA grande delante,
 * ESCUDO alto detras de ella, TUBO largo y fino, y COLA larga que se clava en el
 * suelo por detras.
 *
 * La version anterior las apilaba todas en la misma vertical y en negro salia un
 * borron con un palo. Lo que hace legible una pieza remolcada es que las cuatro
 * masas ocupen sitios distintos: la rueda asoma por detras del escudo, el tubo
 * arranca por delante y la cola sale por el lado contrario.
 */
function campana(base, negro) {
  const C = negro
    ? { banda: '#12140c', base: '#12140c', llanta: '#12140c', buje: '#12140c', contorno: '#12140c' }
    : { ...CAUCHO, base: '#6d5636' };
  const f = [];

  // cola: dos largueros que de perfil se solapan, con el azadon en la punta
  f.push(caminoRedondeado([
    [-0.15, 1.62], [0.35, 1.3], [-4.15, 0.5], [-4.35, 0.72],
    [-4.9, 0.5], [-4.72, 0.05], [-4.05, 0.12], [-0.3, 1.05],
  ], 0.09));
  // escudo: plancha alta con el borde superior recortado y la tronera del tubo
  f.push(caminoRedondeado([
    [0.05, 0.62], [1.02, 0.62], [1.14, 2.02], [0.86, 2.02],
    [0.86, 2.62], [1.16, 2.62], [1.24, 3.32], [0.2, 3.24], [0.02, 0.62],
  ], 0.1));
  // cuna, freno de retroceso y recuperador sobre el tubo
  f.push(caja(0.15, Y_PIVOTE - 0.34, 1.45, 0.68, 0.15));
  f.push(caja(1.1, Y_PIVOTE + 0.28, 1.35, 0.22, 0.1));
  f.push(caja(-0.55, 0.82, 0.75, 0.62, 0.2));          // mamelon del eje
  f.push(tubo({ raiz: [1.15, Y_PIVOTE], largo: 3.3, r: 0.14, freno: 'dos' }));

  let dentro = '';
  if (!negro) {
    dentro += camino(caja(-6, -1, 12, 2.05, 0), { fill: oscuro(base) });
    dentro += filaRemaches(0.1, 1.0, 1.35, contorno(base));
    dentro += camino(polilinea([[0.02, 2.02], [1.14, 2.02]]), { stroke: contorno(base), 'stroke-width': 0.06, fill: 'none' });
  }
  let s = sombraContacto(-1.6, 7.2, 0.16);
  s += cuerpo(f, base, { negro, dentro });
  // La rueda va LA ULTIMA: de perfil es la pieza mas cercana, y tapada por el
  // escudo se pierde justo lo que dice que esto se remolca.
  s += ruedaRadios(-0.3, 1.12, 1.12, C);
  return s;
}

// ── C. Mortero de sitio ───────────────────────────────────────────────────

/**
 * Mortero de sitio: placa base, bipode y tubo gordo. Tres masas que no se
 * parecen a nada mas del juego, y por eso se reconoce a 0,55x de zoom.
 *
 * Sustituye al «obus sobre plataforma», que era un pedestal con un tubo saliendo
 * y en negro se leia como un yunque. Un mortero de verdad se distingue por la
 * placa apoyada en el suelo y la pata del bipode abierta hacia delante.
 */
function sitio(base, negro) {
  const f = [];
  // El tubo pasa POR el pivote: la boca sale de prolongarlo, no de colgarla.
  const pie = [-0.55, 0.5];
  const dx = 0.35 - pie[0], dy = Y_PIVOTE - pie[1];
  const ang = Math.atan2(dy, dx);
  const hasta = Math.hypot(dx, dy) + 1.5;

  // placa base: ancha, baja y con el labio levantado en los dos cantos
  f.push(caminoRedondeado([
    [-2.15, 0.02], [-1.75, 0.44], [1.75, 0.44], [2.15, 0.02],
    [1.95, -0.02], [1.55, 0.2], [-1.55, 0.2], [-1.95, -0.02],
  ], 0.08));
  f.push(caminoRedondeado([[-1.0, 0.3], [1.0, 0.3], [0.72, 0.78], [-0.72, 0.78]], 0.12));
  // bipode: la pata larga hacia delante y el travesano de nivelacion
  f.push(caminoRedondeado([[0.28, 2.5], [2.32, 0.16], [2.6, 0.42], [0.56, 2.72]], 0.07));
  // la segunda pata TERMINA EN LA PLACA: acabada en el aire se lee como una
  // varilla suelta y rompe el trapecio del bipode
  f.push(caminoRedondeado([[0.08, 2.14], [1.42, 0.42], [1.66, 0.62], [0.32, 2.34]], 0.07));
  f.push(caja(1.02, 1.16, 0.9, 0.18, 0.06));
  f.push(caja(0.02, Y_PIVOTE - 0.3, 0.86, 0.62, 0.14));   // collar de elevacion
  f.push(tubo({ raiz: pie, largo: hasta, r: 0.29, ang, freno: 'ancho' }));

  let dentro = '';
  if (!negro) {
    dentro += camino(caja(-4, -1, 8, 1.4, 0), { fill: oscuro(base) });
    dentro += camino(circulo(-1.25, 0.34, 0.22), { fill: camuflaje(base) });
    dentro += filaRemaches(-1.8, 1.8, 0.34, contorno(base));
  }
  return sombraContacto(0.2, 5.4, 0.18) + cuerpo(f, base, { negro, dentro });
}

// ── el catalogo de propuestas ─────────────────────────────────────────────

export const PIEZAS = [
  {
    id: 'blindado',
    nombre: 'Blindado con torreta',
    lema: 'La que ya funciona',
    dibujar: blindado,
    tiro: 'Plano y directo',
    avance: 'Alto — 1,0x',
    aguante: 'Medio — 100',
    epoca: '1916 · 1944',
    tesis: 'El carro se mueve, apunta y encaja. Es la pieza que hace que «avanzar» sea una decision de verdad: repostas, subes a la loma, disparas y te bajas antes de que te devuelvan el tiro.',
    cuesta: 'Es la que ya esta dibujada y la que tiene quince variantes en el catalogo. Elegirla no cuesta nada; el trabajo es modelar los quince.',
    riesgo: 'Es tambien la mas vista. Un juego de tanques de perfil se parece a los otros veinte que hay, y la silueta de torreta no dice «Primera Guerra» por si sola.',
  },
  {
    id: 'campana',
    nombre: 'Pieza de campana',
    lema: 'La que dice 1916 sin un texto',
    dibujar: campana,
    tiro: 'Muy plano, alcance largo',
    avance: 'Bajo — 0,35x, y hay que enganchar',
    aguante: 'Bajo — 60, el escudo solo tapa de frente',
    epoca: '1914 · 1918',
    tesis: 'La rueda de radios, el escudo y la cola clavada en el suelo son la imagen de la Gran Guerra. Aqui no conduces un carro: emplazas una pieza, y moverla cuesta tanto que cada cambio de posicion es media partida.',
    cuesta: 'Tres primitivas nuevas —rueda de radios, escudo y cola— y un tren de rodaje que no es una oruga. El catalogo de quince habria que rehacerlo casi entero.',
    riesgo: 'Si moverse cuesta tanto, la mecanica de avance pierde sentido y el juego vuelve a ser el duelo estatico de antes. Habria que reequilibrar el deposito.',
  },
  {
    id: 'sitio',
    nombre: 'Mortero de sitio',
    lema: 'La que ignora los muros',
    dibujar: sitio,
    tiro: 'Parabola altisima',
    avance: 'Ninguno — se ancla y se queda',
    aguante: 'Alto — 150, pero es un blanco quieto',
    epoca: '1916 · 1945',
    tesis: 'Placa base clavada en el suelo, bipode abierto y un tubo casi vertical. No se mueve; a cambio su trayectoria pasa por encima de cualquier muro y de cualquier talud que levante Sotavento, y es la unica pieza que no puede quedar encerrada en su propio hoyo.',
    cuesta: 'Poco dibujo: placa base, bipode y un tubo gordo. Lo caro es de reglas, porque hay que decidir que pasa con `avance.js` cuando una pieza no avanza.',
    riesgo: 'Un jugador que no se mueve no toma la decision del turno. Como pieza unica mata la mecanica nueva; como una entre quince, es la excepcion que la hace interesante.',
  },
];
