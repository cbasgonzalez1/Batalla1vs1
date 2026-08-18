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
import { crearReserva, FAMILIAS, sacos, tenir, apoyado, perfilBase, altoDe, bajoDe, monton } from './decorado.js';

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
    // Relieve suave. Con vaguadas de 1,5 u cada cuatro unidades, cualquier pieza
    // ancha tiene que salvar un desnivel mayor que ella misma y su base se lee
    // como un cimiento en V. El campo ondula, no dienta.
    let y = 3.0
      + Math.sin(x * 0.15 + 1.1) * 0.85
      + Math.sin(x * 0.39 + 4.0) * 0.26
      + Math.sin(x * 0.91 + 2.2) * 0.08;

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
        y += -0.8 * Math.cos(k * Math.PI * 0.5) ** 2 * (1 - k) + Math.sin(k * Math.PI) * 0.3;
      }
    }
    pts.push([x, y]);
  }
  pts.craters = craters;
  return pts;
}

/**
 * De varias posiciones candidatas, la que tiene el terreno mas llano bajo la
 * pieza. Es lo unico que evita que un edificio de siete unidades caiga a caballo
 * de una vaguada.
 */
function llano(suelo, limite, ancho, rng) {
  let mejor = limite, coste = Infinity;
  for (let i = 0; i <= 12; i++) {
    const c = limite * (0.28 + 0.72 * (i / 12));
    let alto = -Infinity, bajo = Infinity;
    for (let x = c - ancho / 2; x <= c + ancho / 2; x += 0.3) {
      const y = suelo(x);
      if (y > alto) alto = y;
      if (y < bajo) bajo = y;
    }
    if (alto - bajo < coste) { coste = alto - bajo; mejor = c; }
  }
  return mejor;
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
 *
 * El muro se cierra por abajo CON EL PERFIL DEL TERRENO. Una fachada con la base
 * recta apoya en una esquina y flota por la otra en cuanto hay cuesta, y el
 * decorado se pinta despues del suelo, asi que el hueco no lo tapa nada.
 */
function edificio({ cx, suelo, w, h, tejado, plantas, columnas, material, rng }) {
  const c = material;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const f = [];
  const roto = tejado === 'roto';
  const cuerpoAlto = roto ? h : h * 0.82;
  // el techo, plano, se mide desde el punto MAS ALTO del terreno que pisa
  const suelto = altoDe(suelo, x0, x1);
  const yc = suelto + cuerpoAlto;

  f.push(apoyado(suelo, x0, x1,
    roto ? astillado(x0, x1, yc, 5, 0.5, rng) : [[x0, yc], [x1, yc]], 0.3));

  if (tejado === 'dos aguas') {
    f.push(caminoRedondeado([
      [x0 - 0.3, yc], [x1 + 0.3, yc],
      [cx + w * 0.06, yc + h * 0.5], [cx - w * 0.1, yc + h * 0.5],
    ], 0.14));
  } else if (tejado === 'mansarda') {
    f.push(caminoRedondeado([
      [x0 - 0.24, yc], [x1 + 0.24, yc],
      [x1 - w * 0.16, yc + h * 0.28], [x0 + w * 0.16, yc + h * 0.28],
    ], 0.14));
  } else if (tejado === 'plano') {
    f.push(caminoRedondeado([[x0 - 0.16, yc], [x1 + 0.16, yc], [x1 + 0.16, yc + 0.26], [x0 - 0.16, yc + 0.26]], 0.06));
  }

  // Huecos MAS ALTOS QUE ANCHOS y una puerta en la planta baja.
  //
  // TODO se replantea desde la misma cota, `suelto`. La puerta se colocaba antes
  // a la altura del terreno EN SU X, asi que en cuanto el suelo tenia pendiente
  // se movia respecto a las ventanas y la fachada dejaba de ser una rejilla: se
  // veia una ventana bailando segun el escenario. Una fachada es rigida; lo que
  // varia es cuanto la tapa el suelo, no donde estan sus huecos.
  let dentro = '';
  const hueco = contorno(c);
  const mw = (w / (columnas + 1)) * 0.44;
  const paso = (cuerpoAlto - 0.8) / plantas;
  const mh = Math.min(1.0, paso * 0.62);
  for (let p = 0; p < plantas; p++) {
    for (let k = 1; k <= columnas; k++) {
      if (p === 0 && k === 1) continue;          // el hueco de la puerta
      if (rng() < 0.13) continue;                // uno tapiado o derrumbado
      const hx = x0 + (w * k) / (columnas + 1) - mw / 2;
      dentro += camino(caja(hx, suelto + 0.55 + paso * p, mw, mh, 0.07), { fill: hueco });
    }
  }
  // La puerta arranca en la cota de fachada y BAJA por debajo de ella: lo que la
  // recorta es el terreno, que se dibuja delante.
  const pw = Math.min(1.05, w * 0.15);
  const px = x0 + w / (columnas + 1) - pw / 2;
  dentro += camino(caja(px, suelto - 1.2, pw, 1.2 + Math.min(1.5, paso * 0.9), 0.16), { fill: hueco });
  dentro += camino(caja(x1 - w * 0.12, suelto - 2, w * 0.2, h * 2 + 2, 0), { fill: oscuro(c) });
  for (let i = 1; i < 4; i++) {
    dentro += camino(polilinea([[x0, suelto + (cuerpoAlto * i) / 4], [x1, suelto + (cuerpoAlto * i) / 4]]), {
      stroke: contorno(c), 'stroke-width': 0.05, fill: 'none', opacity: 0.45,
    });
  }
  return objeto(f, c, 0.12, dentro);
}

/**
 * Montón de escombro al pie. Un muro sin escombro parece a medio construir.
 *
 * Son BLOQUES, no una mancha. El polígono único con tres vértices que salía
 * antes no se entendía: podía ser una roca, una rampa o una sombra. Lo que se
 * lee como cascote es ver las piedras sueltas, cada una con su contorno, de
 * mayor abajo a menor arriba (docs/ESCENARIOS.md §3.3).
 */
function escombroPie(cx, suelo, w, c) {
  return monton(cx, suelo, w * 1.6, c, mulberry32(semilla(`escombro:${cx.toFixed(1)}:${w}`)), 8);
}

/** Tocon gigante: el hito de Passchendaele. Mismo modulo, con copa muerta. */
function toconGigante(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  const h = 5.4, w = 0.95, a = cx - w, b = cx + w;
  const y = altoDe(suelo, a, b);
  const techo = [0.0, 1.15, 0.35, 0.85, -0.1].map((k, i) => [a + (2 * w * i) / 4, y + h + k]);
  let s = objeto([
    apoyado(suelo, a, b, techo, 0.3),
    apoyado(suelo, a - 1.5, a, [[a - 1.5, suelo(a - 1.5) + 0.5], [a, y + 1.05]]),
    caminoRedondeado([[cx + w * 0.7, y + h * 0.62], [cx + w * 2.6, y + h * 0.86], [cx + w * 2.65, y + h * 0.72], [cx + w * 0.75, y + h * 0.44]], 0.1),
    caminoRedondeado([[cx - w * 0.7, y + h * 0.44], [cx - w * 2.1, y + h * 0.2], [cx - w * 2.05, y + h * 0.05], [cx - w * 0.75, y + h * 0.26]], 0.1),
  ], c, 0.12,
  camino(caja(cx + w * 0.25, y - 1.5, w * 1.3, h + 3, 0), { fill: oscuro(c) })
  + camino(caja(a, y + h - 0.3, w * 2, 1.6, 0), { fill: tono(c, 0.3) }));
  s += escombroPie(cx + 2.6, suelo, 1.1, c);
  return s;
}

/** Chimenea de fabrica: la unica vertical pura del juego. */
function chimenea(cx, suelo, t, rng) {
  const c = mezcla('#a8603f', t.cuerpo, 0.28);
  const h = 7.2, a = cx - 0.95, b = cx + 0.95;
  const y = altoDe(suelo, a, b);
  let s = edificio({
    cx: cx - 4.4, suelo, w: 6.2, h: 3.0, tejado: 'roto', plantas: 2, columnas: 4,
    material: mezcla('#9d9a90', t.cuerpo, 0.3), rng,
  });
  s += objeto([
    apoyado(suelo, a, b, [[a, y + h * 0.9], [b, y + h * 0.9]], 0.3),
    caminoRedondeado([[cx - 0.66, y + h * 0.88], [cx + 0.66, y + h * 0.88],
      ...astillado(cx - 0.6, cx + 0.6, y + h, 3, 0.3, rng).reverse()], 0.08),
  ], c, 0.12,
  [0.25, 0.45, 0.65].map((k) => camino(polilinea([[a, y + h * k], [b, y + h * k]]), {
    stroke: contorno(c), 'stroke-width': 0.06, fill: 'none', opacity: 0.5,
  })).join(''));
  s += escombroPie(cx - 1.6, suelo, 1.3, c);
  return s;
}

const PIEDRA = (t) => mezcla('#b8b0a0', t.cuerpo, 0.3);
const LADRILLO = (t) => mezcla('#a8603f', t.cuerpo, 0.3);
const MADERA = (t) => tenir(MATERIA.madera, t);
const ADOBE = (t) => mezcla('#d8b481', t.cuerpo, 0.3);

/** El hito del teatro. Ocupa el 25-40 % del ancho y rompe el horizonte. */
function hito(t, cx, suelo, rng, k = 1) {
  const P = { cx, suelo, rng };
  switch (t.hito) {
    case 'bosque': return toconGigante(cx, suelo, t, rng);
    case 'fabrica': return chimenea(cx, suelo, t, rng);
    case 'iglesia':
      return edificio({ ...P, w: 2.6 * k, h: 7.6 * k, tejado: 'roto', plantas: 3, columnas: 1, material: PIEDRA(t) })
        + escombroPie(cx + 2.0 * k, suelo, 1.4, PIEDRA(t));
    case 'granero':
      return edificio({ ...P, w: 6.6 * k, h: 3.2 * k, tejado: 'dos aguas', plantas: 2, columnas: 3, material: MADERA(t) })
        + escombroPie(cx - 4.0 * k, suelo, 1.2, MADERA(t));
    case 'adobe':
      return edificio({ ...P, w: 5.6 * k, h: 2.7 * k, tejado: 'plano', plantas: 2, columnas: 3, material: ADOBE(t) })
        + escombroPie(cx + 3.4 * k, suelo, 1.3, ADOBE(t));
    case 'granja':
      return edificio({ ...P, w: 6.2 * k, h: 3.4 * k, tejado: 'dos aguas', plantas: 2, columnas: 4, material: PIEDRA(t) })
        + escombroPie(cx - 3.9 * k, suelo, 1.2, PIEDRA(t));
    case 'haussmann':
      return edificio({ ...P, w: 6.8 * k, h: 8.6 * k, tejado: 'mansarda', plantas: 4, columnas: 4, material: PIEDRA(t) })
        + escombroPie(cx + 4.2 * k, suelo, 1.5, PIEDRA(t));
    case 'casa':
      return edificio({ ...P, w: 5.2 * k, h: 3.1 * k, tejado: 'dos aguas', plantas: 2, columnas: 3, material: PIEDRA(t) })
        + escombroPie(cx + 3.3 * k, suelo, 1.1, PIEDRA(t));
    default:
      return edificio({ ...P, w: 6.4 * k, h: 6.2 * k, tejado: 'roto', plantas: 3, columnas: 4, material: LADRILLO(t) })
        + escombroPie(cx - 4.1 * k, suelo, 1.5, LADRILLO(t));
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
/**
 * Tres capas mezcladas hacia la parada de cielo del HORIZONTE, nunca hacia el
 * cenit: mezclando con el cenit el horizonte del desierto sale malva. Medido.
 *
 * Y arrancan MUY POR ENCIMA de la cota del campo. Con la cresta cercana a 5,2 u
 * y el terreno jugable a 3–5 u las dos se entrelazan, y como la cresta va mas
 * clara que el suelo se lee como si fuera la hierba de delante: el resultado es
 * que todo lo plantado en el terreno parece hundido en una loma que en realidad
 * esta detras. Era el defecto que hacia que las casas «flotaran».
 */
const CAPAS = [
  { base: 12.4, alt: 5.5, k: 0.80 },
  { base: 9.2, alt: 4.0, k: 0.64 },
  { base: 6.6, alt: 3.0, k: 0.46 },
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
  // Se reserva la HUELLA del blindado y la de su parapeto, en este orden y
  // ANTES que el hito: el parapeto va donde va —delante del canon— y no puede
  // ceder el sitio, asi que si el hito no lo tiene reservado acaba encima.
  const lp = composicion === 'zanja' ? 5.1 : 3.2;
  const anchoFoso = composicion === 'zanja' ? 11.6 : 7.0;
  reserva.ocupar(XA, anchoFoso);
  reserva.ocupar(XB, anchoFoso);
  reserva.ocupar(XA + lp, 3.6);
  reserva.ocupar(XB - lp, 3.6);

  // El hito va DESCENTRADO. Centrado parte el campo en dos huecos estrechos y no
  // cabe nada grande en ninguno; a un lado deja un vano ancho.
  const lado = rng() < 0.5 ? -1 : 1;
  const anchoHito = (ANCHO_HITO[t.hito] ?? 9) * (composicion === 'ruina' ? 1.15 : 1);
  // Un edificio se planta donde el suelo es LLANO, no donde toque. Sobre una
  // vaguada su base tiene que bajar y subir y se lee como un cimiento en V.
  const limite = Math.min(X1 - 1.2 - anchoHito / 2, Math.abs(XA) - anchoFoso / 2 - anchoHito / 2 - 0.8);
  const xh = composicion === 'ruina' ? 0.6 : lado * llano(suelo, limite, anchoHito, rng);
  const kh = composicion === 'ruina' ? 1.15 : 1;
  reserva.ocupar(xh, anchoHito);
  s += hito(t, xh, suelo, mulberry32(semilla(`${clave}:hito`)), kh);

  // 6. decorado: solo las familias que este teatro declara. Un teatro no es una
  // paleta, es un sitio, y lo que lo dice son sus piezas. Se colocan de mayor a
  // menor porque el seto de 6 u tiene un solo sitio posible y las cajas de 2 u
  // tienen diez: al reves, las pequenas ocupan el unico vano ancho.
  const rd = mulberry32(semilla(`${clave}:props`));
  const cola = t.props
    .map((id) => FAMILIAS[id]).filter(Boolean)
    .flatMap((f) => Array.from({ length: f.veces }, () => f))
    .sort((a, b) => b.ancho - a.ancho);
  for (const fam of cola) {
    const x = reserva.colocar(fam.ancho, rd, 0.45, suelo);
    if (x === null) continue;           // no cabe: no se mete a la fuerza
    reserva.ocupar(x, fam.ancho);
    s += fam.dibujar(x, suelo, t, rd);
  }

  // 7. las dos piezas. Se asientan en la MEDIA de la huella y se GIRAN con la
  // pendiente: un blindado horizontal sobre una cuesta apoya una oruga y deja la
  // otra en el aire, que es el mismo defecto que el de las casas.
  const colocar = (x, ficha, base, voltear) => {
    const largo = piezaA ? 5.6 : ficha.L;
    const d = largo * 0.42;
    const ya = suelo(x - d), yb = suelo(x + d);
    const ang = (Math.atan2(yb - ya, 2 * d) * 180) / Math.PI;
    const y = Math.min((ya + yb) / 2, suelo(x)) - 0.05;
    const arte = piezaA ? (voltear ? piezaB : piezaA)(base, false) : construir(ficha, { base });
    return grupo(arte, {
      transform: `translate(${x} ${y.toFixed(2)}) rotate(${ang.toFixed(1)})${voltear ? ' scale(-1 1)' : ''}`,
    });
  };
  if (composicion === 'zanja') {
    s += entibado(XA, suelo, t, mulberry32(semilla(`${clave}:e1`)));
    s += entibado(XB, suelo, t, mulberry32(semilla(`${clave}:e2`)));
  }
  s += colocar(XA, fichaA, bandoA, false);
  s += colocar(XB, fichaB, bandoB, true);
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

  // `__DEPURA_SUELO` superpone el perfil real en magenta. Es lo que descubrio
  // que las piezas SI se apoyaban y que lo que enganaba era la cresta de fondo.
  if (globalThis.__DEPURA_SUELO) s += camino(polilinea(perfil), { fill: 'none', stroke: '#ff00ff', 'stroke-width': 0.07 });
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
    const alto = 1.5 + rng() * 0.4;
    s += objeto([apoyado(suelo, x, x + w * 0.86,
      [[x, suelo(x) + alto], [x + w * 0.86, suelo(x) + alto]], 0.12)], c, 0.06);
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
