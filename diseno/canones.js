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
 * Canon de campana sobre curena, con escudo y ruedas de radios. La silueta es
 * la del canon, no la del vehiculo: rueda grande delante, escudo vertical,
 * tubo largo y fino, y una cola larga que se clava en el suelo detras.
 */
function campana(base, negro) {
  const C = negro
    ? { banda: '#12140c', base: '#12140c', llanta: '#12140c', buje: '#12140c', contorno: '#12140c' }
    : { ...CAUCHO, base: '#6d5636' };
  const R = 1.18;
  let s = sombraContacto(-1.2, 6.4);
  s += ruedaRadios(0.05, R, R, C);

  const f = [];
  // escudo: plancha vertical con el borde superior recortado. Es lo primero que
  // se ve y lo que separa esta silueta de la de un blindado.
  f.push(caminoRedondeado([
    [-0.62, 0.72], [0.62, 0.72], [0.66, 2.05], [0.5, 2.05],
    [0.5, 2.62], [0.66, 2.62], [0.6, 3.24], [-0.68, 3.14], [-0.72, 0.72],
  ], 0.12));
  // cuna y freno de retroceso alrededor del pivote
  f.push(caja(-0.72, Y_PIVOTE - 0.36, 1.9, 0.72, 0.16));
  f.push(caja(0.5, Y_PIVOTE + 0.16, 1.5, 0.24, 0.1));
  // cola: dos largueros que se juntan y acaban en el azadon. Se dibuja como una
  // sola forma porque de perfil los dos largueros se solapan.
  f.push(caminoRedondeado([
    [-0.5, 1.9], [-0.1, 1.62], [-3.9, 0.42], [-4.5, 0.5], [-4.42, 0.08], [-3.8, 0.02], [-0.62, 1.16],
  ], 0.1));
  // eje y mamelon de union
  f.push(caja(-0.34, 0.86, 0.7, 0.66, 0.2));
  f.push(tubo({ raiz: [0.35, Y_PIVOTE], largo: 3.7, r: 0.15, freno: 'dos' }));

  let dentro = '';
  if (!negro) {
    dentro += camino(caja(-5, 0.0, 10, 1.35, 0), { fill: oscuro(base) });
    dentro += filaRemaches(-0.6, 0.55, 1.35, contorno(base));
    dentro += camino(polilinea([[-0.72, 2.05], [0.66, 2.05]]), { stroke: contorno(base), 'stroke-width': 0.06, fill: 'none' });
  }
  s += cuerpo(f, base, { negro, dentro });
  return s;
}

// ── C. Obus de sitio ──────────────────────────────────────────────────────

/**
 * Obus de sitio sobre plataforma. No se mueve: cuatro gatos clavados y una base
 * ancha. A cambio, el tubo es el mas gordo del juego y su parabola pasa por
 * encima de cualquier muro y de cualquier talud que levante Sotavento.
 */
function sitio(base, negro) {
  const f = [];
  let s = sombraContacto(0, 6.0, 0.2);

  // base ancha y baja, con los gatos delantero y trasero clavados
  f.push(caminoRedondeado([
    [-2.2, 0.16], [-1.9, 0.9], [1.9, 0.9], [2.2, 0.16],
  ], 0.14));
  // Los dos brazos se clavan en el suelo y BAJAN hacia fuera: horizontales se
  // leen como dos aletas y la pieza parece un yunque.
  f.push(caminoRedondeado([[-3.7, -0.04], [-2.0, 0.42], [-2.0, 0.9], [-3.75, 0.42]], 0.1));
  f.push(caminoRedondeado([[3.7, -0.04], [2.0, 0.42], [2.0, 0.9], [3.75, 0.42]], 0.1));
  // pedestal giratorio, estrecho: si es tan ancho como la base, los tirantes se
  // quedan dentro de la silueta y dejan de contar
  f.push(caminoRedondeado([[-1.1, 0.9], [1.1, 0.9], [0.82, 1.9], [-0.82, 1.9]], 0.16));
  // cuna, con los dos tirantes de retroceso que la atan a la base
  f.push(caja(-1.05, Y_PIVOTE - 0.52, 2.1, 1.04, 0.2));
  f.push(caminoRedondeado([[-2.15, 0.92], [-1.0, 1.98], [-0.6, 1.8], [-1.75, 0.84]], 0.08));
  f.push(caminoRedondeado([[2.15, 0.92], [1.0, 1.98], [0.6, 1.8], [1.75, 0.84]], 0.08));
  f.push(tubo({ raiz: [0.15, Y_PIVOTE], largo: 2.5, r: 0.34, ang: (52 * Math.PI) / 180, freno: 'ancho' }));

  let dentro = '';
  if (!negro) {
    dentro += camino(caja(-5, 0.0, 10, 0.9, 0), { fill: oscuro(base) });
    dentro += camino(circulo(-1.9, 1.4, 0.34), { fill: camuflaje(base) });
    dentro += camino(circulo(1.9, 1.4, 0.4), { fill: camuflaje(base) });
    dentro += filaRemaches(-2.0, 2.0, 0.9, contorno(base));
  }
  s += cuerpo(f, base, { negro, dentro });
  return s;
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
    nombre: 'Obus de sitio',
    lema: 'La que ignora los muros',
    dibujar: sitio,
    tiro: 'Parabola altisima',
    avance: 'Ninguno — se ancla y se queda',
    aguante: 'Alto — 150, pero es un blanco quieto',
    epoca: '1916 · 1945',
    tesis: 'No se mueve. A cambio, su trayectoria pasa por encima de cualquier muro y de cualquier talud que levante Sotavento: es el unico que no puede quedar encerrado en su propio hoyo.',
    cuesta: 'Poco dibujo: base, pedestal, cuna y un tubo gordo. Lo caro es de reglas, porque hay que decidir que pasa con `avance.js` cuando una pieza no avanza.',
    riesgo: 'Un jugador que no se mueve no toma la decision del turno. Como pieza unica mata la mecanica nueva; como una entre quince, es la excepcion que la hace interesante.',
  },
];
