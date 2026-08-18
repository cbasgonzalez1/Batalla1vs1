/**
 * Los quince blindados del catalogo, dibujados como planchas.
 *
 * La regla que gobierna el fichero es «un cuerpo, un contorno»
 * (docs/ARTE-VEHICULOS.md §12): casco, superestructura, cupula, mantelete, tubo
 * y freno de boca salen de UNA silueta continua. Aqui eso se consigue pintando
 * dos veces: primero todas las piezas con un trazo grueso del color de contorno,
 * y despues las mismas piezas rellenas encima. Los bordes interiores quedan
 * tapados por el relleno y solo sobrevive el perimetro. Es la unica forma sin
 * filtros —prohibidos por ARTE.md §1.6— de que no reaparezcan las costuras.
 *
 * El invariante de ARTE.md §9 se cumple por construccion: el pivote de elevacion
 * es la constante `Y_PIVOTE` y NO sale de la ficha. Una ficha no puede romperlo
 * ni queriendo, que es lo unico que de verdad protege la sincronia de red.
 */

import {
  caminoRedondeado, circulo, caja, capsulaOruga, camino, grupo,
  sombraContacto, filaRemaches, rueda, neumatico, polilinea, siluetaUnica,
} from './primitivas.js';
import { CAUCHO, claro, camuflaje, oscuro, contorno } from './paleta.js';

/**
 * El PIVOTE de elevacion de las quince, a la misma Y. No es estetica: de ahi
 * sale el punto de salida del proyectil, y la boca se calcula como
 * `pivote + R(elevacion)·[largo, 0]` con el largo de la ficha.
 *
 * La version anterior fijaba la BOCA «en toda elevacion». Un tubo que gira
 * describe un arco, no una horizontal: para cuadrarlo habia que enterrar la cuna
 * del mortero por debajo de la oruga. Fijando el pivote se cumple lo que de
 * verdad hacia falta —que la altura del casco no desincronice nada— y ademas el
 * mortero se ve como un mortero (docs/ARTE-VEHICULOS.md §8).
 */
export const Y_PIVOTE = 2.32;

/**
 * Grosor del contorno de silueta, en unidades de mundo. Medido: 13 px sobre un
 * casco de 1150 px en la referencia, o sea 0,063 u sobre un casco de 5,6 u. El
 * valor es la MITAD del trazo, porque el relleno tapa la mitad interior.
 */
const GROSOR = 0.066;

/** Desplazamiento de la banda clara. Luz fija arriba-izquierda, ARTE.md §1.3. */
const LUZ = [0.1, -0.15];

// ── perfiles de casco ─────────────────────────────────────────────────────
// Cada uno devuelve la lista de puntos del perfil, recorrida por el borde
// inferior izquierdo, subiendo, cruzando el techo y bajando por la derecha.

// El vehiculo mira a la DERECHA: ahi va el glacis, ahi sale el tubo y hacia ahi
// dispara. Con el morro a la izquierda y el tubo a la derecha, el vehiculo se
// lee marcha atras aunque cada pieza este bien.

const perfiles = {
  /** Panza redondeada con meseta central. Es el perfil de la referencia. */
  panza(L, h, y0, { m0 = -0.22, m1 = 0.16, alza = 0.46 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.02, y0 + h * 0.62], [x0 + L * 0.08, y0 + h],
      [m0 * L - L * 0.08, y0 + h], [m0 * L, y0 + h + alza],
      [m1 * L, y0 + h + alza], [m1 * L + L * 0.07, y0 + h],
      [x1 - L * 0.1, y0 + h], [x1, y0 + h * 0.5], [x1, y0 + 0.08],
    ];
  },
  /** Caja de flancos rectos, frontal poco inclinado a la derecha. */
  caja(L, h, y0, { incl = 0.11 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.02, y0 + h], [x1 - L * incl, y0 + h],
      [x1, y0 + h * 0.42], [x1, y0 + 0.08],
    ];
  },
  /** Cuna: una sola superficie inclinada del techo al morro. La mas baja. */
  cuna(L, h, y0, { techo = 0.36 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.06], [x0 + L * 0.02, y0 + h], [x1 - L * techo, y0 + h],
      [x1 - L * 0.02, y0 + h * 0.26], [x1, y0 + 0.06],
    ];
  },
  /** Rombo de 1916. La oruga lo envuelve entero y la proa sube hacia delante. */
  rombo(L, h, y0, { estirado = 0 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0 + L * 0.07, y0 - 0.02], [x0, y0 + h * 0.34], [x0 + L * 0.11, y0 + h * 0.82],
      [x0 + L * (0.3 - estirado), y0 + h], [x1 - L * (0.26 - estirado), y0 + h],
      [x1 - L * 0.1, y0 + h * 0.8], [x1, y0 + h * 0.36], [x1 - L * 0.06, y0 - 0.02],
    ];
  },
  /** Casco bajo con banera abierta DETRAS, o sea a la izquierda. */
  banera(L, h, y0, { pared = 0.7, frente = 0.3 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.03, y0 + h + pared],
      [x1 - L * frente, y0 + h + pared], [x1 - L * frente, y0 + h],
      [x1 - L * 0.1, y0 + h], [x1, y0 + h * 0.45], [x1, y0 + 0.08],
    ];
  },
  /** Coche blindado: morro caido a la derecha y flancos altos. */
  coche(L, h, y0) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + h * 0.14], [x0 + L * 0.06, y0 + h], [x1 - L * 0.3, y0 + h],
      [x1 - L * 0.16, y0 + h * 0.74], [x1 - L * 0.03, y0 + h * 0.56],
      [x1, y0 + h * 0.14],
    ];
  },
  /** Casamata fija, de una pieza con el casco. El mas grande del catalogo. */
  casamata(L, h, y0) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.04, y0 + h], [x1 - L * 0.26, y0 + h],
      [x1 - L * 0.015, y0 + h * 0.36], [x1, y0 + 0.08],
    ];
  },
  /** Cabina delante (derecha) y caja de transporte abierta detras. */
  cabina(L, h, y0, { caja: c = 0.34 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.03, y0 + h * 0.94], [x0 + L * 0.11, y0 + h * 0.94],
      [x0 + L * 0.11, y0 + h * 0.62], [x1 - L * c, y0 + h * 0.62],
      [x1 - L * c, y0 + h], [x1 - L * 0.13, y0 + h],
      [x1, y0 + h * 0.44], [x1, y0 + 0.08],
    ];
  },
};

// ── piezas del cuerpo ─────────────────────────────────────────────────────

/** Rota un punto alrededor del origen del tubo. */
function rot(p, o, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = p[0] - o[0], dy = p[1] - o[1];
  return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c];
}

/**
 * Tubo + freno de boca como una sola forma. El freno es un ENGROSAMIENTO de la
 * punta, no una pieza pegada: si lleva contorno propio se lee como un carrete
 * encajado en un palo (docs/ARTE-VEHICULOS.md §12.2).
 */
function tuboCamino({ raiz, largo, r, ang, freno }) {
  const pts = [];
  const rf = freno === 'ninguno' ? r : freno === 'boquilla' ? r * 1.9 : r * 1.85;
  const lf = freno === 'ninguno' ? 0 : Math.min(0.5, largo * 0.16);
  pts.push([0, -r], [largo - lf, -r]);
  if (lf) {
    pts.push([largo - lf, -rf], [largo, -rf], [largo, rf], [largo - lf, rf]);
  } else {
    pts.push([largo, -r], [largo, r]);
  }
  pts.push([largo - lf, r], [0, r]);
  return caminoRedondeado(pts.map((p) => rot(p, [0, 0], ang)).map((p) => [p[0] + raiz[0], p[1] + raiz[1]]), r * 0.4);
}

/** Torreta, casamata o afuste. Nace del techo: comparte contorno con el casco. */
function torretaCamino(t) {
  const { tipo, cx, base, r, alto } = t;
  if (tipo === 'redonda') return caminoRedondeado([[cx - r, base], [cx + r, base], [cx + r * 0.94, base + alto], [cx - r * 0.94, base + alto]], alto * 0.6);
  if (tipo === 'conica') return caminoRedondeado([[cx - r, base], [cx + r, base], [cx + r * 0.66, base + alto], [cx - r * 0.66, base + alto]], 0.18);
  if (tipo === 'plataforma') return caminoRedondeado([[cx - r, base], [cx + r, base], [cx + r, base + alto], [cx - r, base + alto]], 0.14);
  return caminoRedondeado([[cx - r, base], [cx + r, base], [cx + r, base + alto], [cx - r, base + alto]], 0.22);
}

/** Todas las formas del cuerpo, en orden de dibujo. Una sola silueta. */
function piezasCuerpo(f) {
  const d = [];
  const casco = perfiles[f.perfil](f.L, f.alto, f.y0, f.opts ?? {});
  d.push(caminoRedondeado(casco, f.L * 0.02));

  for (const b of f.bultos ?? []) d.push(caja(b[0], b[1], b[2], b[3], 0.09));

  let raizTubo = null;
  if (f.torreta) {
    d.push(torretaCamino(f.torreta));
    if (f.torreta.cupula) {
      const c = f.torreta.cupula;
      d.push(caja(f.torreta.cx + c.x, f.torreta.base + f.torreta.alto - 0.02, c.w, c.h, 0.1));
    }
  }
  for (const e of f.extras ?? []) {
    if (e.tipo === 'caja') d.push(caja(e.x, e.y, e.w, e.h, e.r ?? 0.1));
    if (e.tipo === 'disco') d.push(circulo(e.x, e.y, e.r));
    if (e.tipo === 'perfil') d.push(caminoRedondeado(e.pts, e.r ?? 0.1));
  }

  for (const t of f.tubos) {
    const ang = (t.ang ?? 0) * Math.PI / 180;
    const largo = t.largo;
    // El pivote es el mismo en los quince y NO sale de la ficha: esta linea es
    // el invariante, y por eso una ficha no puede romperlo ni queriendo.
    const raiz = [t.x, Y_PIVOTE + (t.dy ?? 0)];
    if (t.mantelete) d.push(circulo(raiz[0], raiz[1], t.mantelete));
    d.push(tuboCamino({ raiz, largo, r: t.r, ang, freno: t.freno ?? 'ninguno' }));
    if (!raizTubo) raizTubo = raiz;
  }
  return { formas: d, casco, raizTubo };
}

// ── tren de rodaje ────────────────────────────────────────────────────────

/**
 * Radio de la cinta. Con rodillos de retorno la cinta va mas alta que la
 * rodadura y se ve el hueco; sin ellos apoya en las ruedas, que es la marca de
 * la MEDIA y lo que hace la referencia. Medido en la referencia: la cinta es
 * solo 0,03 u mas ancha que la rueda por cada lado.
 */
export const radioCinta = (r, rodillos) => (rodillos > 0 ? r * 1.42 : r + 0.03);

function trenOruga(r, { x0, x1, ruedas, rodillos = 0, eslabones = 26 }, C = C) {
  const R = radioCinta(r, rodillos);
  const cy = R;
  const yRueda = rodillos > 0 ? r + 0.05 : cy;
  const comba = rodillos > 0 ? 0.16 : 0.07;
  let s = '';
  s += camino(capsulaOruga(x0, x1, R, comba), {
    fill: C.banda, stroke: C.contorno, 'stroke-width': 0.1, 'stroke-linejoin': 'round',
  });
  // el eslabon: trazo discontinuo interior, nunca veintiseis cilindros
  const paso = (2 * Math.PI * R) / eslabones;
  s += camino(capsulaOruga(x0 + 0.14, x1 - 0.14, Math.max(0.1, R - 0.14), comba), {
    fill: 'none', stroke: C.llanta, 'stroke-width': 0.04,
    'stroke-dasharray': `${(paso * 0.45).toFixed(2)} ${(paso * 0.55).toFixed(2)}`,
  });
  // La motriz y el tensor son la primera y la ultima de la fila, un 12 % mayores
  // y con seis tornillos: si se dibujan ADEMAS de la fila, se solapan y el tren
  // de rodaje se lee como una fila de monedas apiladas.
  const rm = Math.min(r * 1.12, R - 0.02);
  const xi = x0 + 0.1 + rm, xf = x1 - 0.1 - rm;
  const d = ruedas > 1 ? (xf - xi) / (ruedas - 1) : 0;
  for (let i = 0; i < ruedas; i++) {
    const extremo = i === 0 || i === ruedas - 1;
    s += rueda(xi + d * i, yRueda, extremo ? rm : r, CAUCHO, extremo ? 6 : 4);
  }
  for (let i = 0; i < rodillos; i++) {
    const t = (i + 1) / (rodillos + 1);
    s += rueda(x0 + (x1 - x0) * t, cy + R - r * 0.42 - 0.06, r * 0.36, CAUCHO, 3);
  }
  return s;
}

function trenRuedas(r, { x0, x1, ruedas }, C = C) {
  let s = '';
  const paso = ruedas > 1 ? ((x1 - x0) - 2 * r) / (ruedas - 1) : 0;
  for (let i = 0; i < ruedas; i++) s += neumatico(x0 + r + paso * i, r, r, C);
  return s;
}

function trenMixto(r, { x0, x1, ruedas }, C = C) {
  // La rueda va DELANTE, o sea a la derecha, y la oruga detras. Con el neumatico
  // a la izquierda el vehiculo se lee marcha atras aunque cada pieza este bien.
  // Y se exagera el tamano: es la silueta mas reconocible del catalogo.
  let s = trenOruga(r * 0.82, { x0, x1: x1 - (x1 - x0) * 0.34, ruedas, rodillos: 1, eslabones: 18 }, C);
  s += neumatico(x1 - r * 1.05, r * 1.15, r * 1.15, C);
  return s;
}

// ── ensamblado ────────────────────────────────────────────────────────────

/**
 * Devuelve el SVG de un vehiculo, con el suelo en y=0 y el centro en x=0.
 * `negro` monta la prueba de silueta de la checklist sin duplicar codigo: si la
 * misma funcion no dibuja las dos, la prueba en negro deja de probar nada.
 */
export function construir(f, { base, negro = false } = {}) {
  const col = negro
    ? { base: '#12140c', claro: '#12140c', camu: '#12140c', osc: '#12140c', cont: '#12140c' }
    : { base, claro: claro(base), camu: camuflaje(base), osc: oscuro(base), cont: contorno(base) };

  // En la prueba de silueta TODO va en negro, tambien el rodaje: con la oruga
  // en color el ojo la usa para reconocer el vehiculo y la prueba deja de
  // probar la silueta (docs/CHECKLIST-REVISION.md §2.1).
  const C = negro
    ? { banda: '#12140c', base: '#12140c', llanta: '#12140c', buje: '#12140c', contorno: '#12140c' }
    : CAUCHO;
  const { formas, casco } = piezasCuerpo(f);
  const rodaje = f.rodaje;
  let s = '';

  s += sombraContacto(0, f.L * 0.92);

  if (rodaje.tipo === 'envolvente') {
    // La oruga ES el perfil, agrandado: en un rombo de 1916 el tren de rodaje no
    // va debajo del casco, va alrededor. Por eso la banda tiene que ser ancha de
    // verdad —0,62 u— o el vehiculo se lee como una almohada verde con una
    // costura, que es exactamente lo que salia con 0,34.
    const cx = casco.reduce((a, p) => a + p[0], 0) / casco.length;
    const cyy = casco.reduce((a, p) => a + p[1], 0) / casco.length;
    const desplazar = (k) => casco.map(([x, y]) => {
      const dx = x - cx, dy = y - cyy, l = Math.hypot(dx, dy) || 1;
      return [x + (dx / l) * k, y + (dy / l) * k];
    });
    const fuera = desplazar(0.62);
    s += camino(caminoRedondeado(fuera, f.L * 0.05), {
      fill: C.banda, stroke: C.contorno, 'stroke-width': 0.1, 'stroke-linejoin': 'round',
    });
    s += camino(caminoRedondeado(desplazar(0.3), f.L * 0.045), {
      fill: 'none', stroke: C.llanta, 'stroke-width': 0.05, 'stroke-dasharray': '0.17 0.2',
    });
    // Ruedas asomando por los recortes del faldon, en la banda que queda entre
    // el casco y el borde de la cinta. Sin ellas la cinta es un aro y el
    // vehiculo parece un contenedor (CATALOGO §2, TRINCHERAS).
    for (let i = 0; i < 5; i++) {
      const x = -f.L * 0.34 + (f.L * 0.68 * i) / 4;
      s += rueda(x, f.y0 - 0.3, 0.25, C, 4);
    }
  } else if (rodaje.tipo === 'ruedas') {
    s += trenRuedas(rodaje.r, rodaje, C);
  } else if (rodaje.tipo === 'mixto') {
    s += trenMixto(rodaje.r, rodaje, C);
  } else if (rodaje.tipo === 'oruga') {
    s += trenOruga(rodaje.r, rodaje, C);
  }

  let dentro = '';
  if (!negro) {
    for (const m of manchas(f)) {
      dentro += camino(circulo(m[0], m[1], m[2]), { fill: col.camu, transform: `scale(1 ${m[3]})` });
    }
    // La banda oscura acaba EXACTAMENTE en la costura, no cerca: si van
    // desfasadas se ven dos lineas paralelas y el casco parece mal montado
    // (docs/ARTE-VEHICULOS.md §12, «tres tonos, recortados»).
    // Topada a 0,62 u: en un casco alto —el rombo, el A7V— una banda al 50 % de
    // la altura parte el vehiculo en dos colores y deja de leerse como sombra.
    const costura = f.y0 + Math.min(f.alto * 0.42, 0.62);
    dentro += camino(caja(-f.L, f.y0 - 0.6, f.L * 2, costura - f.y0 + 0.6, 0), { fill: col.osc });
    dentro += filaRemaches(-f.L * 0.44, f.L * 0.44, costura, col.cont);
    for (const c of costuras(f)) dentro += camino(polilinea(c), { fill: 'none', stroke: col.cont, 'stroke-width': 0.06, 'stroke-linecap': 'round' });
  }
  s += siluetaUnica({
    formas, cont: col.cont, tonoClaro: col.claro, tonoBase: col.base,
    grosor: GROSOR, luz: LUZ, dentro,
  });

  return s;
}

/**
 * Manchas de camuflaje. Salen de la ficha, no del azar: dos planchas de la misma
 * ficha tienen que ser identicas o la fila de comparacion no compara nada.
 */
function manchas(f) {
  const y = f.y0 + f.alto * 0.62;
  return [
    [-f.L * 0.3, y / 0.62, f.L * 0.085, 0.62],
    [f.L * 0.02, y / 0.62, f.L * 0.07, 0.62],
    [f.L * 0.28, y / 0.62, f.L * 0.09, 0.62],
  ];
}

/** Costuras: toda linea interior arranca en el borde y muere en el borde. */
function costuras(f) {
  const out = [];
  if (f.torreta) {
    out.push([[f.torreta.cx - f.torreta.r, f.torreta.base], [f.torreta.cx + f.torreta.r, f.torreta.base]]);
  }
  out.push([[-f.L / 2, f.y0 + Math.min(f.alto * 0.42, 0.62)], [f.L / 2, f.y0 + Math.min(f.alto * 0.42, 0.62)]]);
  return out;
}

// ── el catalogo ───────────────────────────────────────────────────────────

const oru = (r, x0, x1, ruedas, rodillos, eslabones) => ({ tipo: 'oruga', r, x0, x1, ruedas, rodillos, eslabones });

/**
 * Quince fichas. Solo numeros: ninguna dibuja geometria a pelo, igual que en
 * `src/art/vehiculo/fichas/`, y por eso la plancha y el juego no pueden
 * divergir sin que se note.
 *
 * Diametro de rodadura = 0,13 L (docs/ARTE-VEHICULOS.md §12), de donde sale el
 * radio de cada ficha. El catalogo daba «1,3 u» para la MEDIA, que sobre un
 * casco de 5,6 u son 0,23 L: con eso cinco ruedas se solapan y el tren de
 * rodaje se lee como una fila de monedas. Manda §12.
 */
export const FICHAS = [
  {
    id: 'media', nombre: 'MEDIA', anio: 1942, clase: 'Carro medio',
    vida: 100, dano: 46, avance: '1,0x', piezas: 13,
    teatros: 'Stalingrado · Jarkov · Caen · Saint-Lo',
    nota: 'La vara de medir: es el vehiculo de la imagen de referencia. Panza redondeada con meseta, y la oruga apoyada en la rodadura sin rodillos de retorno, que es su marca.',
    L: 5.6, alto: 0.95, y0: 0.7, perfil: 'panza',
    rodaje: oru(0.32, -2.86, 2.86, 6, 0, 30),
    torreta: { tipo: 'redonda', cx: -0.5, base: 2.11, r: 1.0, alto: 0.62, cupula: { x: 0.3, w: 0.42, h: 0.22 } },
    tubos: [{ x: 0.45, largo: 3.0, r: 0.13, mantelete: 0.4 }],
    bultos: [[1.15, 1.65, 0.85, 0.2], [-2.2, 1.65, 0.55, 0.17]],
    extras: [{ tipo: 'caja', x: -2.98, y: 1.05, w: 0.3, h: 0.38, r: 0.12 }],
  },
  {
    id: 'pesado', nombre: 'PESADO', anio: 1943, clase: 'Carro pesado',
    vida: 140, dano: 52, avance: '0,55x', piezas: 17,
    teatros: 'Aquisgran · Dresde · Berlin',
    nota: 'Torreta cuadrada retrasada y freno de boca de dos camaras. Siete ruedas solapadas: el solape se exagera hasta que se vean dos filas, o se lee como una sola.',
    L: 6.2, alto: 1.32, y0: 0.76, perfil: 'caja',
    rodaje: oru(0.35, -3.16, 3.16, 7, 0, 30),
    torreta: { tipo: 'cuadrada', cx: -0.55, base: 2.08, r: 0.95, alto: 0.7, cupula: { x: -0.5, w: 0.42, h: 0.2 } },
    tubos: [{ x: 0.3, largo: 3.6, r: 0.16, mantelete: 0.44, freno: 'dos' }],
    bultos: [[1.15, 2.08, 1.05, 0.24], [-2.7, 2.08, 0.66, 0.2]],
    extras: [{ tipo: 'caja', x: -3.32, y: 1.1, w: 0.34, h: 0.5, r: 0.14 }],
  },
  {
    id: 'cazacarros', nombre: 'CAZACARROS', anio: 1943, clase: 'Cazacarros',
    vida: 90, dano: 56, avance: '0,8x', piezas: 12,
    teatros: 'Stalingrado · Jarkov · Aquisgran',
    nota: 'La silueta mas baja y el tubo mas largo del catalogo. Si el tubo no incomoda al mirarlo, es corto: todo su caracter esta en esa proporcion.',
    L: 5.4, alto: 1.55, y0: 0.88, perfil: 'cuna',
    rodaje: oru(0.31, -2.76, 2.76, 6, 3, 28),
    torreta: null,
    tubos: [{ x: -0.4, largo: 4.2, r: 0.15, mantelete: 0.46 }],
    bultos: [[-1.6, 2.43, 0.9, 0.22]],
    extras: [{ tipo: 'caja', x: -2.94, y: 1.2, w: 0.3, h: 0.44, r: 0.12 }],
  },
  {
    id: 'asalto', nombre: 'ASALTO PESADO', anio: 1944, clase: 'Canon de asalto',
    vida: 170, dano: 64, avance: '0,4x', piezas: 17,
    teatros: 'Berlin · Aquisgran · Dresde',
    nota: 'El mas grande y el que mas pega. Su caracter es la masa: se exagera el ancho del mantelete y el grosor del tubo, nunca la altura, que ya la tiene.',
    L: 6.8, alto: 1.6, y0: 0.86, perfil: 'casamata',
    rodaje: oru(0.4, -3.46, 3.46, 7, 0, 30),
    torreta: null,
    tubos: [{ x: 0.9, largo: 3.4, r: 0.22, mantelete: 0.62, freno: 'dos' }],
    bultos: [[-2.1, 2.46, 1.1, 0.26], [-0.4, 2.46, 0.7, 0.22]],
    extras: [{ tipo: 'caja', x: -3.66, y: 1.15, w: 0.36, h: 0.6, r: 0.14 }],
  },
  {
    id: 'obus', nombre: 'OBUS ATP', anio: 1943, clase: 'Artilleria autopropulsada',
    vida: 85, dano: 60, avance: '0,7x', piezas: 16,
    teatros: 'Todos',
    nota: 'Banera abierta y azadon de anclaje clavado en el suelo. El azadon es la silueta que lo delata y ademas explica por que pega tan fuerte: no se corta nunca.',
    L: 5.8, alto: 0.55, y0: 0.97, perfil: 'banera',
    opts: { pared: 0.72, frente: 0.3 },
    rodaje: oru(0.34, -2.96, 2.96, 5, 2, 26),
    torreta: null,
    tubos: [{ x: 0.4, largo: 2.0, r: 0.24, ang: 35, mantelete: 0.44, freno: 'ancho' }],
    bultos: [[-2.0, 2.24, 0.8, 0.22]],
    extras: [{ tipo: 'perfil', pts: [[-2.7, 1.05], [-3.62, 0.66], [-3.5, 0.24], [-2.7, 1.62]], r: 0.12 }],
  },
  {
    id: 'mortero', nombre: 'MORTERO ATP', anio: 1943, clase: 'Mortero autopropulsado',
    vida: 80, dano: 42, avance: '0,9x', piezas: 14,
    teatros: 'Todos',
    nota: 'Tubo casi vertical: su trayectoria pasa por encima de los muros bajos y de los taludes de arena que levanta Sotavento. Es el unico que ignora un encierro.',
    L: 4.8, alto: 1.0, y0: 0.82, perfil: 'caja',
    opts: { incl: 0.2 },
    rodaje: oru(0.29, -2.46, 2.46, 4, 2, 22),
    torreta: null,
    tubos: [{ x: 0.2, largo: 1.7, r: 0.2, ang: 70 }],
    bultos: [[-1.9, 1.82, 0.75, 0.24], [0.7, 1.82, 0.55, 0.2]],
    extras: [{ tipo: 'caja', x: -0.55, y: 1.78, w: 1.55, h: 0.62, r: 0.14 }],
  },
  {
    id: 'lanzallamas', nombre: 'LANZALLAMAS', anio: 1943, clase: 'Carro lanzallamas',
    vida: 95, dano: 34, avance: '1,0x', piezas: 15,
    teatros: 'Berlin · Aquisgran · Dresde',
    nota: 'Chasis de la MEDIA sin tocar: la familia se nota mas si comparten rodaje. Dos depositos con aros detras y la manguera que los une a la boquilla acampanada.',
    L: 5.6, alto: 0.95, y0: 0.7, perfil: 'panza',
    rodaje: oru(0.32, -2.86, 2.86, 6, 0, 30),
    torreta: { tipo: 'redonda', cx: -0.5, base: 2.11, r: 0.9, alto: 0.52 },
    tubos: [{ x: 0.35, largo: 1.3, r: 0.2, mantelete: 0.38, freno: 'boquilla' }],
    bultos: [],
    extras: [
      { tipo: 'caja', x: -2.5, y: 1.65, w: 0.62, h: 0.85, r: 0.3 },
      { tipo: 'caja', x: -1.78, y: 1.65, w: 0.62, h: 0.85, r: 0.3 },
      { tipo: 'caja', x: -1.9, y: 2.35, w: 1.6, h: 0.2, r: 0.1 },
    ],
  },
  {
    id: 'antiaereo', nombre: 'ANTIAEREO', anio: 1943, clase: 'Antiaereo autopropulsado',
    vida: 75, dano: 12, avance: '1,1x', piezas: 18,
    teatros: 'Todos',
    nota: 'Cuatro tubos que comparten un solo pivote; los otros tres son decorado. Separados 0,22 u entre ejes o a 0,55x de zoom se leen como uno gordo.',
    L: 5.2, alto: 0.45, y0: 0.88, perfil: 'banera',
    opts: { pared: 0.55, frente: 0.24 },
    rodaje: oru(0.31, -2.66, 2.66, 5, 2, 26),
    torreta: { tipo: 'plataforma', cx: 0.15, base: 1.88, r: 0.85, alto: 0.32 },
    tubos: [
      { x: 0.15, largo: 2.0, r: 0.08, ang: 60, mantelete: 0.24 },
      { x: 0.37, largo: 2.0, r: 0.08, ang: 60 },
      { x: -0.13, largo: 1.85, r: 0.08, ang: 60 },
      { x: 0.62, largo: 1.85, r: 0.08, ang: 60 },
    ],
    bultos: [[-2.1, 1.88, 0.7, 0.24]],
    extras: [{ tipo: 'caja', x: -1.1, y: 1.88, w: 0.8, h: 0.36, r: 0.12 }],
  },
  {
    id: 'cohetes', nombre: 'COHETES', anio: 1943, clase: 'Lanzacohetes',
    vida: 65, dano: 11, avance: '1,2x', piezas: 15,
    teatros: 'Todos',
    nota: 'Sin tubo: el proyectil sale del rail inferior del bastidor. Ocho railes se modelan como UNA rejilla de ocho huecos, no como ocho cilindros: se lee igual y cuesta una pieza.',
    L: 5.4, alto: 1.2, y0: 0.8, perfil: 'cabina',
    opts: { caja: 0.42 },
    rodaje: { tipo: 'ruedas', r: 0.62, x0: -2.8, x1: 2.8, ruedas: 4 },
    torreta: null,
    tubos: [{ x: -0.5, largo: 1.9, r: 0.38, ang: 45 }],
    bultos: [[-2.5, 1.95, 0.5, 0.18]],
    extras: [{ tipo: 'caja', x: -1.0, y: 1.7, w: 1.1, h: 0.62, r: 0.12 }],
  },
  {
    id: 'semioruga', nombre: 'SEMIORUGA', anio: 1942, clase: 'Transporte semioruga',
    vida: 60, dano: 14, avance: '1,8x', piezas: 18,
    teatros: 'Todos',
    nota: 'El rodaje mixto es la silueta mas reconocible del catalogo. El mayor deposito de avance del juego: es el vehiculo de reposicionarse, no el de pegar.',
    L: 5.6, alto: 1.15, y0: 0.78, perfil: 'cabina',
    opts: { caja: 0.3 },
    rodaje: { tipo: 'mixto', r: 0.42, x0: -2.9, x1: 2.9, ruedas: 3 },
    torreta: null,
    tubos: [{ x: 0.35, largo: 1.1, r: 0.07 }],
    bultos: [[-2.4, 1.86, 0.5, 0.18]],
    extras: [
      { tipo: 'caja', x: -0.1, y: 1.5, w: 0.8, h: 0.9, r: 0.14 },
      { tipo: 'caja', x: 0.34, y: 2.0, w: 0.16, h: 0.7, r: 0.06 },
    ],
  },
  {
    id: 'ruedas', nombre: 'RUEDAS', anio: 1941, clase: 'Coche blindado',
    vida: 70, dano: 30, avance: '1,6x', piezas: 15,
    teatros: 'Varsovia 39 · Rotterdam · Arnhem',
    nota: 'Se mueve, no pega. La rueda de repuesto del flanco es la unica pieza asimetrica grande del catalogo, y es lo que hace que el vehiculo se lea vivo.',
    L: 4.6, alto: 1.15, y0: 0.72, perfil: 'coche',
    rodaje: { tipo: 'ruedas', r: 0.62, x0: -2.42, x1: 2.42, ruedas: 4 },
    torreta: { tipo: 'conica', cx: -0.15, base: 1.87, r: 0.7, alto: 0.62 },
    tubos: [{ x: 0.5, largo: 1.9, r: 0.11, mantelete: 0.26 }],
    bultos: [[-1.85, 1.87, 0.5, 0.18]],
    extras: [{ tipo: 'disco', x: -1.5, y: 1.42, r: 0.44 }],
  },
  {
    id: 'tanqueta', nombre: 'TANQUETA LIGERA', anio: 1941, clase: 'Carro ligero',
    vida: 55, dano: 22, avance: '1,7x', piezas: 12,
    teatros: 'Todos',
    nota: 'El mas pequeno y el minimo de piezas, y no por elegir: a 3,8 u de largo, catorce piezas se solapan y ninguna llega al minimo de nivel B.',
    L: 3.8, alto: 1.2, y0: 0.74, perfil: 'cuna',
    opts: { techo: 0.44 },
    rodaje: oru(0.26, -1.96, 1.96, 4, 1, 22),
    torreta: { tipo: 'cuadrada', cx: -0.35, base: 1.94, r: 0.55, alto: 0.62 },
    tubos: [{ x: 0.15, largo: 1.8, r: 0.09, mantelete: 0.22 }],
    bultos: [[-1.5, 1.94, 0.44, 0.16]],
    extras: [{ tipo: 'caja', x: -2.02, y: 1.05, w: 0.26, h: 0.36, r: 0.1 }],
  },
  {
    id: 'rombo', nombre: 'ROMBO', anio: 1916, clase: 'Carro de la Gran Guerra',
    vida: 120, dano: 38, avance: '0,6x', piezas: 14,
    teatros: 'Ypres · Verdun',
    nota: 'La oruga envuelve el casco entero: esa es toda la silueta y no hace falta nada mas. Sin torreta; el tubo sale del patrocinio lateral, nunca del frente.',
    L: 6.4, alto: 2.26, y0: 0.64, perfil: 'rombo',
    rodaje: { tipo: 'envolvente' },
    torreta: null,
    tubos: [{ x: 1.35, largo: 1.6, r: 0.16, mantelete: 0.38 }],
    bultos: [[-1.4, 2.9, 0.9, 0.2], [0.6, 2.9, 0.55, 0.18]],
    extras: [{ tipo: 'caja', x: 0.1, y: 1.72, w: 1.6, h: 0.72, r: 0.18 }],
  },
  {
    id: 'a7v', nombre: 'A7V', anio: 1918, clase: 'Carro de la Gran Guerra',
    vida: 130, dano: 40, avance: '0,5x', piezas: 15,
    teatros: 'Ypres · Verdun',
    nota: 'El mas alto y el mas torpe. El casco vuela por delante y por detras y tapa la oruga casi entera: si se ve el tren de rodaje completo, esta mal modelado.',
    L: 6.0, alto: 2.11, y0: 0.66, perfil: 'caja',
    opts: { incl: 0.05 },
    rodaje: oru(0.3, -2.5, 2.5, 6, 0, 24),
    torreta: { tipo: 'cuadrada', cx: -0.1, base: 2.77, r: 1.25, alto: 0.5 },
    tubos: [{ x: 1.2, largo: 2.2, r: 0.18, mantelete: 0.32 }],
    bultos: [[-2.5, 2.77, 0.7, 0.2], [1.5, 2.77, 0.6, 0.18]],
    extras: [{ tipo: 'caja', x: -3.22, y: 1.9, w: 0.3, h: 0.66, r: 0.12 }],
  },
  {
    id: 'trincheras', nombre: 'TRINCHERAS', anio: 1916, clase: 'Carro de zanja',
    vida: 150, dano: 34, avance: '0,45x', piezas: 14,
    teatros: 'Ypres · Verdun',
    nota: 'El mas largo. Cruza trincheras y muros bajos sin penalizacion: esa es su razon de existir. El faldon cerrado con recortes tapa seis piezas con una sola.',
    L: 7.0, alto: 2.02, y0: 0.64, perfil: 'rombo',
    opts: { estirado: 0.12 },
    rodaje: { tipo: 'envolvente' },
    torreta: null,
    // La cabina de mando alta y el rodillo antizanja delantero son lo unico que
    // lo separa del ROMBO en la prueba en negro. Sin ellos son la misma silueta,
    // y la checklist manda cambiar casco o rodaje, nunca color ni calcomania
    // (docs/CHECKLIST-REVISION.md §3).
    tubos: [{ x: 1.0, largo: 1.8, r: 0.17, mantelete: 0.4 }],
    bultos: [[-2.2, 2.66, 1.5, 0.62], [0.5, 2.66, 0.6, 0.22]],
    extras: [{ tipo: 'disco', x: 3.62, y: 0.66, r: 0.5 }],
  },
];
