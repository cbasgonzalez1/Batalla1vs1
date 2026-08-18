/**
 * Los teatros, en los cinco planos de ARTE.md §3.
 *
 * Todo lo que se coloca sale de un `rng` SEMBRADO. No es purismo: dos moviles
 * con el mismo codigo de sala tienen que ver el mismo campo, y el servidor no
 * manda nada de esto. Una escena con `Math.random()` es una escena distinta en
 * cada telefono (docs/ESCENARIOS.md §2).
 */

import {
  caminoRedondeado, circulo, caja, camino, grupo, polilinea, siluetaUnica,
} from './primitivas.js';
import { TEATROS, NEVADOS, mezcla, tono, claro, oscuro, contorno, MATERIA } from './paleta.js';
import { construir, FICHAS } from './vehiculos.js';
import { crearReserva, FAMILIAS, sacos, tenir } from './decorado.js';

// ── azar sembrado ─────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semilla = (txt) => {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// ── terreno ───────────────────────────────────────────────────────────────

/**
 * Estratos del suelo. CUATRO, no diez.
 *
 * ARTE.md §12 los subio a diez con el brillo alternando, y fue una
 * sobrecorreccion: arreglaba el degradado a negro pero convertia la cara
 * frontal del terreno en un mapa topografico de franjas onduladas que compiten
 * con todo lo que se planta encima. Lo que hacia falta era color plano con
 * borde duro; lo que no hacia falta era CONTAR las capas.
 *
 * Cuatro franjas, contraste bajo entre las tres de abajo y la costra clara
 * arriba para que la linea del suelo se lea. La costra manda; lo demas es masa.
 */
const ESTRATOS = [
  [0.42, 'cresta', 1.0],
  [2.6, 0.18, 0.98],
  [6.5, 0.44, 0.93],
];
const HONDO = [0.64, 0.9];

const brillo = (c, b) => tono(c, b - 1);
const colorEstrato = (t, e) =>
  brillo(e[1] === 'cresta' ? t.cresta : mezcla(t.cuerpo, t.socavon, e[1]), e[2]);

/**
 * Perfil del campo. Dos plataformas de tiro, un valle y crateres viejos con el
 * LABIO levantado: sin labio un crater no se lee como impacto, se lee como
 * ondulacion (docs/ESCENARIOS.md §3.4).
 */
function perfilTerreno(rng, x0, x1, comp = 'abierto') {
  const pts = [];
  const craters = comp === 'zanja'
    ? [-4.5 + rng() * 2, 1 + rng() * 3, 6.5 + rng() * 2]
    : [-6 + rng() * 3, 2 + rng() * 4, 9 + rng() * 3];
  for (let x = x0; x <= x1 + 0.01; x += 0.25) {
    let y = 3.2
      + Math.sin(x * 0.17 + 1.1) * 1.25
      + Math.sin(x * 0.43 + 4.0) * 0.42
      + Math.sin(x * 0.97 + 2.2) * 0.12;

    if (comp === 'ruina') {
      y += Math.max(0, Math.cos((x / 8.5) * Math.PI * 0.5)) ** 2 * 2.0;
      y -= Math.max(0, 1 - Math.abs(x - 13.4) / 5) * 0.5;
      y -= Math.max(0, 1 - Math.abs(x + 13.4) / 5) * 0.5;
    }

    if (comp === 'zanja') {
      y = 3.0 + Math.sin(x * 0.21 + 0.6) * 0.7 + Math.sin(x * 0.9 + 2.2) * 0.18;
      // El foso tiene que ser MAS ANCHO que la pieza que va dentro: con 5 u de
      // ancho y un casco de 6,4 el blindado se apoya en los dos labios, tapa las
      // paredes y la trinchera desaparece.
      for (const px of [-13.4, 13.4]) {
        const d = Math.abs(x - px);
        if (d < 2.8) y -= 1.7;
        else if (d < 4.4) y -= 1.7 * (0.5 + 0.5 * Math.cos(((d - 2.8) / 1.6) * Math.PI));
        else if (d < 5.8) y += 0.95 * Math.sin(((5.8 - d) / 1.4) * Math.PI);
      }
    }

    // plataformas de tiro: el canon no se apoya en una cuesta
    if (comp !== 'zanja') for (const px of [-13.4, 13.4]) {
      const d = Math.abs(x - px);
      if (d < 3.4) y += (3.4 - d) * 0.1 * (1 - d / 3.4);
    }
    for (const cx of craters) {
      const d = Math.abs(x - cx);
      if (d < 3.4) {
        const k = d / 3.4;
        y += -1.05 * Math.cos(k * Math.PI * 0.5) ** 2 * (1 - k) + Math.sin(k * Math.PI) * 0.38;
      }
    }
    pts.push([x, y]);
  }
  pts.craters = craters;
  return pts;
}

const alturaEn = (perfil, x) => {
  const i = Math.max(0, Math.min(perfil.length - 1, Math.round((x - perfil[0][0]) / 0.25)));
  return perfil[i][1];
};

// ── hitos ─────────────────────────────────────────────────────────────────

function objeto(formas, base, grosor = 0.11, dentro = '') {
  return siluetaUnica({
    formas, cont: contorno(base), tonoClaro: claro(base), tonoBase: base,
    grosor, luz: [0.12, -0.17], dentro,
  });
}

/** Borde superior astillado: dientes desiguales, nunca una recta ni un arco. */
function astillado(x0, x1, y, n, amp, rng) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    pts.push([x0 + ((x1 - x0) * i) / n, y + (i % 2 ? amp : -amp * 0.45) * (0.6 + rng() * 0.8)]);
  }
  return pts;
}

/**
 * Constructor unico de edificios. Los ocho hitos con edificio salen de aqui y
 * por eso parecen del mismo mundo: cambia el tejado, el material, el numero de
 * plantas y donde esta roto, nunca la forma de construirlo.
 */
function edificio({ cx, y, w, h, tejado, plantas, columnas, material, rng, t }) {
  const c = material;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const f = [];
  const roto = tejado === 'roto';
  const cuerpoAlto = roto ? h : h * 0.82;
  // El cuerpo arranca 0,8 u POR DEBAJO del suelo. Con la base a ras y el
  // terreno en cuesta, el edificio apoya en una esquina y flota por la otra:
  // era el defecto mas visible del decorado anterior.
  const yb = y - 0.8;

  if (roto) {
    f.push(caminoRedondeado([[x0, yb], [x1, yb], ...astillado(x0, x1, y + cuerpoAlto, 5, 0.5, rng).reverse()], 0.12));
  } else {
    f.push(caminoRedondeado([[x0, yb], [x1, yb], [x1, y + cuerpoAlto], [x0, y + cuerpoAlto]], 0.12));
  }

  if (tejado === 'dos aguas') {
    f.push(caminoRedondeado([
      [x0 - 0.3, y + cuerpoAlto], [x1 + 0.3, y + cuerpoAlto],
      [cx + w * 0.06, y + h * 1.34], [cx - w * 0.1, y + h * 1.34],
    ], 0.14));
  } else if (tejado === 'mansarda') {
    f.push(caminoRedondeado([
      [x0 - 0.24, y + cuerpoAlto], [x1 + 0.24, y + cuerpoAlto],
      [x1 - w * 0.16, y + h * 1.12], [x0 + w * 0.16, y + h * 1.12],
    ], 0.14));
  } else if (tejado === 'plano') {
    f.push(caminoRedondeado([[x0 - 0.16, y + cuerpoAlto], [x1 + 0.16, y + cuerpoAlto],
      [x1 + 0.16, y + cuerpoAlto + 0.26], [x0 - 0.16, y + cuerpoAlto + 0.26]], 0.06));
  }

  // huecos: una sola cara oscura al fondo. Dentro no se ve y cuesta.
  // Huecos MAS ALTOS QUE ANCHOS y una puerta en la planta baja. Con ventanas
  // cuadradas repartidas en rejilla el edificio se lee como una hoja de calculo,
  // que es lo que salia antes.
  let dentro = '';
  const hueco = contorno(c);
  const mw = (w / (columnas + 1)) * 0.46;
  const paso = (cuerpoAlto - 0.8) / plantas;
  for (let p = 0; p < plantas; p++) {
    for (let k = 1; k <= columnas; k++) {
      if (rng() < 0.14) continue;       // un hueco tapiado o derrumbado
      const hx = x0 + (w * k) / (columnas + 1) - mw / 2;
      const hy = y + 0.5 + paso * p;
      dentro += camino(caja(hx, hy, mw, Math.min(1.0, paso * 0.66), 0.07), { fill: hueco });
    }
  }
  const pw = Math.min(1.1, w * 0.16);
  dentro += camino(caminoRedondeado([
    [cx - w * 0.3 - pw / 2, y], [cx - w * 0.3 + pw / 2, y],
    [cx - w * 0.3 + pw / 2, y + Math.min(1.5, paso * 0.95)], [cx - w * 0.3 - pw / 2, y + Math.min(1.5, paso * 0.95)],
  ], 0.16), { fill: hueco });
  // esquina expuesta y junta de hilada: lo que dice que es fabrica y no un bloque
  dentro += camino(caja(x1 - w * 0.12, yb - 0.2, w * 0.2, h * 2 + 1, 0), { fill: oscuro(c) });
  for (let i = 1; i < 4; i++) {
    dentro += camino(polilinea([[x0, y + (cuerpoAlto * i) / 4], [x1, y + (cuerpoAlto * i) / 4]]), {
      stroke: contorno(c), 'stroke-width': 0.05, fill: 'none', opacity: 0.45,
    });
  }
  return objeto(f, c, 0.12, dentro);
}

/** Monton de escombro al pie. Un muro sin escombro parece a medio construir. */
function escombroPie(cx, y, w, c) {
  return objeto([caminoRedondeado([
    [cx - w, y - 0.5], [cx + w, y - 0.5], [cx + w * 0.35, y + 0.52], [cx - w * 0.55, y + 0.4],
  ], 0.16)], oscuro(c), 0.1);
}

/** Tocon gigante: el hito de Passchendaele. Mismo modulo, con copa muerta. */
function toconGigante(cx, y, t, rng) {
  const c = tenir(MATERIA.madera, t);
  const h = 5.4, w = 0.95;
  const puntas = [0.0, 1.15, 0.35, 0.85, -0.1].map((k, i) => [cx - w + (2 * w * i) / 4, y + h + k]);
  let s = objeto([
    caminoRedondeado([[cx - w * 0.95, y - 0.5], [cx + w * 0.95, y - 0.5], [cx + w * 0.85, y + h * 0.55], ...puntas.reverse()], 0.08),
    caminoRedondeado([[cx - w, y + 0.15], [cx - w - 1.5, y - 0.05], [cx - w - 1.05, y + 0.8], [cx - w, y + 1.05]], 0.14),
    caminoRedondeado([[cx + w * 0.7, y + h * 0.62], [cx + w * 2.6, y + h * 0.86], [cx + w * 2.65, y + h * 0.72], [cx + w * 0.75, y + h * 0.44]], 0.1),
    caminoRedondeado([[cx - w * 0.7, y + h * 0.44], [cx - w * 2.1, y + h * 0.2], [cx - w * 2.05, y + h * 0.05], [cx - w * 0.75, y + h * 0.26]], 0.1),
  ], c, 0.12,
  camino(caja(cx + w * 0.25, y - 0.2, w * 1.3, h + 2, 0), { fill: oscuro(c) })
  + camino(caja(cx - w, y + h - 0.3, w * 2, 1.6, 0), { fill: tono(c, 0.3) }));
  s += escombroPie(cx + 2.6, y, 1.1, c);
  return s;
}

/** Chimenea de fabrica: la unica vertical pura del juego. */
function chimenea(cx, y, t, rng) {
  const c = mezcla('#a8603f', t.cuerpo, 0.28);
  const h = 7.2;
  let s = edificio({ cx: cx - 4.4, y, w: 6.2, h: 3.0, tejado: 'roto', plantas: 2, columnas: 4, material: mezcla('#9d9a90', t.cuerpo, 0.3), rng, t });
  s += objeto([caminoRedondeado([
    [cx - 0.95, y - 0.7], [cx + 0.95, y - 0.7], [cx + 0.5, y + h * 0.9], [cx - 0.5, y + h * 0.9],
  ], 0.1), caminoRedondeado([
    [cx - 0.66, y + h * 0.88], [cx + 0.66, y + h * 0.88],
    ...astillado(cx - 0.6, cx + 0.6, y + h, 3, 0.3, rng).reverse(),
  ], 0.08)], c, 0.12,
  [0.25, 0.45, 0.65].map((k) => camino(polilinea([[cx - 0.95, y + h * k], [cx + 0.95, y + h * k]]), {
    stroke: contorno(c), 'stroke-width': 0.06, fill: 'none', opacity: 0.5,
  })).join(''));
  s += escombroPie(cx - 1.6, y, 1.3, c);
  return s;
}

const PIEDRA = (t) => mezcla('#b8b0a0', t.cuerpo, 0.3);
const LADRILLO = (t) => mezcla('#a8603f', t.cuerpo, 0.3);
const MADERA = (t) => tenir(MATERIA.madera, t);
const ADOBE = (t) => mezcla('#d8b481', t.cuerpo, 0.3);

/** El hito del teatro. Ocupa el 25–40 % del ancho y rompe el horizonte. */
function hito(t, cx, y, rng, k = 1) {
  const P = { cx, y, rng, t };
  switch (t.hito) {
    case 'bosque': return toconGigante(cx, y, t, rng);
    case 'fabrica': return chimenea(cx, y, t, rng);
    case 'iglesia':
      return edificio({ ...P, w: 2.6 * k, h: 7.6 * k, tejado: 'roto', plantas: 3, columnas: 1, material: PIEDRA(t) })
        + escombroPie(cx + 2.0 * k, y, 1.4, PIEDRA(t));
    case 'granero':
      return edificio({ ...P, w: 6.6 * k, h: 3.2 * k, tejado: 'dos aguas', plantas: 2, columnas: 3, material: MADERA(t) })
        + escombroPie(cx - 4.0 * k, y, 1.2, MADERA(t));
    case 'adobe':
      return edificio({ ...P, w: 5.6 * k, h: 2.7 * k, tejado: 'plano', plantas: 2, columnas: 3, material: ADOBE(t) })
        + escombroPie(cx + 3.4 * k, y, 1.3, ADOBE(t));
    case 'granja':
      return edificio({ ...P, w: 6.2 * k, h: 3.4 * k, tejado: 'dos aguas', plantas: 2, columnas: 4, material: PIEDRA(t) })
        + escombroPie(cx - 3.9 * k, y, 1.2, PIEDRA(t));
    case 'haussmann':
      return edificio({ ...P, w: 6.8 * k, h: 8.6 * k, tejado: 'mansarda', plantas: 4, columnas: 4, material: PIEDRA(t) })
        + escombroPie(cx + 4.2 * k, y, 1.5, PIEDRA(t));
    case 'casa':
      return edificio({ ...P, w: 5.2 * k, h: 3.1 * k, tejado: 'dos aguas', plantas: 2, columnas: 3, material: PIEDRA(t) })
        + escombroPie(cx + 3.3 * k, y, 1.1, PIEDRA(t));
    default:
      return edificio({ ...P, w: 6.4 * k, h: 6.2 * k, tejado: 'roto', plantas: 3, columnas: 4, material: LADRILLO(t) })
        + escombroPie(cx - 4.1 * k, y, 1.5, LADRILLO(t));
  }
}

/** Ancho que reserva el hito, para que el decorado no se le meta debajo. */
const ANCHO_HITO = {
  bosque: 6.4, fabrica: 11.5, iglesia: 5.2, granero: 8.2, adobe: 7.6,
  granja: 7.8, haussmann: 9.4, casa: 6.8, ladrillo: 8.6,
};

// ── crestas de fondo ──────────────────────────────────────────────────────

/**
 * Tres capas mezcladas hacia la parada de cielo del HORIZONTE, nunca hacia el
 * cenit: mezclando con el cenit el horizonte del desierto sale malva. Medido.
 */
const CAPAS = [
  { base: 10.5, alt: 6.0, k: 0.74 },
  { base: 7.6, alt: 4.4, k: 0.5 },
  { base: 5.2, alt: 3.2, k: 0.28 },
];

function crestas(t, x0, x1) {
  let s = '';
  CAPAS.forEach((c, i) => {
    const col = mezcla(t.cuerpo, t.cielo[i === 0 ? 3 : 2], c.k);
    const pts = [[x0, -8]];
    for (let x = x0; x <= x1 + 0.01; x += 0.6) {
      pts.push([x, c.base + Math.sin(x * (0.13 + i * 0.05) + i * 2.1) * c.alt * 0.28 + Math.sin(x * 0.31 + i) * c.alt * 0.1]);
    }
    pts.push([x1, -8]);
    s += camino(polilinea(pts) + 'Z', { fill: col });  // el fondo lejano NO lleva contorno
  });
  return s;
}

// ── escena completa ───────────────────────────────────────────────────────

// 38 u de ancho: es el encuadre real de partida.
const X0 = -19, X1 = 19;
const XA = -13.4, XB = 13.4;

export function escena(clave, { bandoA, bandoB, fichaA, fichaB, composicion = 'abierto', piezaA, piezaB }) {
  const t = TEATROS[clave];
  const rng = mulberry32(semilla(`${clave}:${composicion}`));
  const perfil = perfilTerreno(mulberry32(semilla(`${clave}:suelo`)), X0, X1, composicion);
  const suelo = (x) => alturaEn(perfil, x);
  const nieve = NEVADOS.has(clave);
  let s = '';

  // 1. cielo — cuatro bandas planas, mas claro cerca del horizonte
  const paradas = [[-8, 3.5], [3.5, 8], [8, 12.5], [12.5, 22]];
  t.cielo.slice().reverse().forEach((c, i) => {
    const [a, b] = paradas[i];
    s += camino(caja(X0, a, X1 - X0, b - a, 0), { fill: c });
  });
  for (let i = 0; i < 4; i++) {
    const cx = X0 + 4 + rng() * (X1 - X0 - 8), cy = 10.8 + rng() * 3.2, r = 0.9 + rng() * 0.7;
    s += camino(circulo(cx, cy, r) + circulo(cx + r, cy - r * 0.3, r * 0.75) + circulo(cx - r, cy - r * 0.35, r * 0.6), {
      fill: tono(t.cielo[3], 0.35),
    });
  }

  // 2. fondo lejano
  s += crestas(t, X0, X1);

  // 3. suelo: cuatro franjas de color plano siguiendo el relieve, y ya.
  // Se pinta de la costra hacia abajo: cada franja es el perfil hundido su
  // profundidad y tapa a la anterior de ahi para abajo.
  const franjas = [...ESTRATOS.map((e, i) => [i === 0 ? 0 : ESTRATOS[i - 1][0], colorEstrato(t, e)]),
    [ESTRATOS[ESTRATOS.length - 1][0], brillo(mezcla(t.cuerpo, t.socavon, HONDO[0]), HONDO[1])]];
  for (const [d, col] of franjas) {
    s += camino(polilinea([[X0, -9], ...perfil.map(([x, y]) => [x, y - d]), [X1, -9]]) + 'Z', { fill: col });
  }
  s += camino(polilinea(perfil), { fill: 'none', stroke: mezcla(t.socavon, '#000', 0.35), 'stroke-width': 0.1 });

  // 4. agua en el fondo de los crateres viejos. Los frescos del combate no la
  // llevan, y que se distingan es informacion: te dice donde ya has tirado.
  if (t.agua) for (const cx of perfil.craters) {
    let fondo = Infinity;
    for (let d = -1.6; d <= 1.6; d += 0.25) fondo = Math.min(fondo, suelo(cx + d));
    // Solo si el hoyo es un hoyo de verdad. Sin esta comprobacion el agua se
    // dibuja tambien en terreno llano y se ve una losa gris apoyada en nada.
    if (Math.max(suelo(cx - 2.6), suelo(cx + 2.6)) - fondo < 0.7) continue;
    const r = 1.45;
    s += camino(caminoRedondeado([[cx - r, fondo + 0.02], [cx + r, fondo + 0.02],
      [cx + r * 0.86, fondo + 0.3], [cx - r * 0.86, fondo + 0.3]], 0.26), {
      fill: mezcla(t.socavon, t.cielo[0], 0.28),
    });
  }

  // 5. reservar lo intocable ANTES de colocar nada: los dos emplazamientos y el
  // hito. El decorado se acomoda a ellos, nunca al reves.
  // Se reserva la HUELLA del blindado, no el hueco donde cabria entero con el
  // tubo: una caja de municion a medio metro del faldon se lee como que esta
  // ahi a proposito, y reservando ocho unidades por vehiculo no cabia nada en
  // todo el campo.
  const reserva = crearReserva(X0 + 0.6, X1 - 0.6);
  reserva.ocupar(XA, 7.0);
  reserva.ocupar(XB, 7.0);
  // El hito va DESCENTRADO. Centrado parte el campo en dos huecos estrechos y
  // no cabe nada grande en ninguno; a un lado deja un vano ancho donde si entra
  // un seto de bocage o un tramo de via.
  const lado = rng() < 0.5 ? -1 : 1;
  const xh = composicion === 'ruina' ? 0.6 : lado * (4.2 + rng() * 3.2);
  const kh = composicion === 'ruina' ? 1.15 : 1;
  reserva.ocupar(xh, (ANCHO_HITO[t.hito] ?? 9) * kh);
  s += hito(t, xh, suelo(xh), mulberry32(semilla(`${clave}:hito`)), kh);

  // 6. decorado: solo las familias que este teatro declara. Un teatro no es una
  // paleta, es un sitio, y lo que lo dice son sus piezas. Se colocan de mayor a
  // menor porque el seto de 7 u tiene un solo sitio posible y las cajas de 2 u
  // tienen diez: al reves, las pequenas ocupan el unico vano ancho y la pieza
  // que define el teatro se queda fuera.
  const rd = mulberry32(semilla(`${clave}:props`));
  const cola = t.props
    .map((id) => FAMILIAS[id]).filter(Boolean)
    .flatMap((f) => Array.from({ length: f.veces }, () => f))
    .sort((a, b) => b.ancho - a.ancho);
  for (const fam of cola) {
    const x = reserva.colocar(fam.ancho, rd, 0.45);
    if (x === null) continue;           // no cabe: no se mete a la fuerza
    reserva.ocupar(x, fam.ancho);
    s += fam.dibujar(x, suelo, t, rd);
  }

  // 7. las dos piezas, y su parapeto de sacos delante
  const colocar = (x, ficha, base, voltear) => {
    const arte = piezaA ? (voltear ? piezaB : piezaA)(base, false) : construir(ficha, { base });
    return grupo(arte, { transform: `translate(${x} ${suelo(x).toFixed(2)})${voltear ? ' scale(-1 1)' : ''}` });
  };
  if (composicion === 'zanja') {
    s += entibado(XA, suelo, t, mulberry32(semilla(`${clave}:e1`)));
    s += entibado(XB, suelo, t, mulberry32(semilla(`${clave}:e2`)));
  }
  s += colocar(XA, fichaA, bandoA, false);
  s += colocar(XB, fichaB, bandoB, true);
  // Delante del canon, no detras: detras lo tapa la propia pieza y no se ve.
  const lp = composicion === 'zanja' ? 5.1 : 3.2;
  s += sacos(XA + lp, suelo, t, rng, composicion === 'zanja' ? 2.6 : 3.0);
  s += sacos(XB - lp, suelo, t, rng, composicion === 'zanja' ? 2.6 : 3.0);

  // 8. primer plano: silueta oscura casi plana, tenida hacia el socavon del
  // teatro. Un primer plano gris o pardo neutro es el mismo en los nueve.
  const frenteCol = mezcla(t.socavon, '#241d10', 0.5);
  const frente = [];
  for (let x = X0; x <= X1 + 0.01; x += 0.5) {
    frente.push([x, -3.0 + Math.sin(x * 0.42 + 2.0) * 0.42 + Math.sin(x * 1.3) * 0.16]);
  }
  const rf = mulberry32(semilla(`${clave}:frente`));
  for (let i = 0; i < 30; i++) {
    const x = X0 + rf() * (X1 - X0);
    const h = 0.4 + rf() * 0.55;
    const b = -3.0 + Math.sin(x * 0.42 + 2.0) * 0.42;
    s += camino(polilinea([[x, b], [x + 0.11, b + h], [x + 0.28, b]]) + 'Z', { fill: frenteCol });
  }
  s += camino(polilinea([[X0, -9], ...frente, [X1, -9]]) + 'Z', { fill: frenteCol });

  return { svg: s, teatro: t, nieve };
}

/**
 * Entibado de la trinchera: tablones de ANCHURA DESIGUAL contra la pared.
 * Iguales se leen como una valla de jardin, que es el fallo clasico de la pieza.
 */
function entibado(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  let s = '', x = cx - 3.5;
  while (x < cx + 3.5) {
    const w = 0.28 + rng() * 0.24;
    s += objeto([caja(x, suelo(x + w / 2), w * 0.86, 1.5 + rng() * 0.4, 0.04)], c, 0.06);
    x += w;
  }
  s += objeto([caja(cx - 3.6, suelo(cx) + 1.52, 7.2, 0.2, 0.06)], oscuro(c), 0.07);
  return s;
}

/** Reparto por defecto de cada teatro: la epoca la manda el teatro, no el jugador. */
export function repartoDe(clave) {
  const t = TEATROS[clave];
  const f = (id) => FICHAS.find((x) => x.id === id);
  if (t.epoca < 1930) return { a: f('rombo'), b: f('a7v') };
  if (t.epoca < 1941) return { a: f('tanqueta'), b: f('ruedas') };
  if (clave === 'alamein') return { a: f('media'), b: f('ruedas') };
  if (clave === 'stalingrado') return { a: f('asalto'), b: f('cazacarros') };
  if (clave === 'paris') return { a: f('semioruga'), b: f('media') };
  if (clave === 'seelow') return { a: f('pesado'), b: f('asalto') };
  if (clave === 'ardenas') return { a: f('pesado'), b: f('media') };
  return { a: f('media'), b: f('cazacarros') };
}

export const X_ESCENA = { X0, X1 };
