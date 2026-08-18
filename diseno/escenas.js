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
import { TEATROS, NEVADOS, FABRICA, mezcla, tono, claro, oscuro, contorno, MATERIA } from './paleta.js';
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

const MAT = (t) => mezcla(FABRICA[t.fabrica], t.cuerpo, 0.18);
const MAT2 = (t) => oscuro(MAT(t));

/** Arcada rota: la fila de arcos de una nave o de un puente. */
function arcada(cx, suelo, n, w, alto, c) {
  const f = [];
  for (let i = 0; i < n; i++) {
    const x = cx - (n * w) / 2 + w * i;
    f.push(apoyado(suelo, x, x + w * 0.36, [[x, suelo(x) + alto], [x + w * 0.36, suelo(x) + alto]], 0.3));
  }
  const a = cx - (n * w) / 2, b = cx + (n * w) / 2;
  f.push(caminoRedondeado([[a, altoDe(suelo, a, b) + alto], [b, altoDe(suelo, a, b) + alto],
    [b, altoDe(suelo, a, b) + alto + 0.42], [a, altoDe(suelo, a, b) + alto + 0.42]], 0.08));
  return objeto(f, c, 0.11);
}

/**
 * El hito del teatro: la ruina grande que rompe el horizonte y ocupa entre el
 * 25 % y el 40 % del ancho. Los nueve salen del mismo constructor de edificios
 * y por eso las dieciseis ciudades parecen del mismo mundo.
 */
function hito(t, cx, suelo, rng, k = 1) {
  const c = MAT(t), c2 = MAT2(t);
  const P = { cx, suelo, rng, material: c };
  const ed = (o) => edificio({ ...P, ...o });
  switch (t.hito) {
    case 'fabrica': return chimenea(cx, suelo, t, rng);

    case 'catedral':   // torre alta + nave con arcada + escombro al pie
      return ed({ cx: cx - 2.6 * k, w: 3.0 * k, h: 9.4 * k, tejado: 'roto', plantas: 4, columnas: 1 })
        + ed({ cx: cx + 2.4 * k, w: 6.2 * k, h: 4.6 * k, tejado: 'roto', plantas: 2, columnas: 4 })
        + arcada(cx + 2.4 * k, suelo, 4, 1.4 * k, 3.0 * k, c2)
        + escombroPie(cx + 6.2 * k, suelo, 1.6, c);

    case 'lonja':      // cuerpo largo con torre central, tipo Lonja de los Panos
      return ed({ cx: cx + 1.4 * k, w: 7.4 * k, h: 3.6 * k, tejado: 'roto', plantas: 2, columnas: 5 })
        + ed({ cx: cx - 2.2 * k, w: 2.4 * k, h: 7.4 * k, tejado: 'roto', plantas: 3, columnas: 1 })
        + escombroPie(cx + 5.6 * k, suelo, 1.5, c);

    case 'abadia':     // bloque largo con portico de columnas
      return ed({ cx, w: 8.2 * k, h: 4.4 * k, tejado: 'roto', plantas: 2, columnas: 6 })
        + arcada(cx, suelo, 6, 1.3 * k, 2.6 * k, c2)
        + escombroPie(cx - 5.4 * k, suelo, 1.6, c);

    case 'estacion':   // cuerpo bajo + marquesina rota
      return ed({ cx: cx - 1.6 * k, w: 5.6 * k, h: 3.4 * k, tejado: 'plano', plantas: 2, columnas: 4 })
        + arcada(cx + 3.0 * k, suelo, 4, 1.5 * k, 3.4 * k, c2)
        + escombroPie(cx + 6.0 * k, suelo, 1.4, c);

    case 'fuerte':     // hormigon bajo y ancho, paredes en talud
      return ed({ cx, w: 7.6 * k, h: 2.4 * k, tejado: 'plano', plantas: 1, columnas: 4 })
        + ed({ cx: cx + 1.8 * k, w: 2.0 * k, h: 3.4 * k, tejado: 'plano', plantas: 1, columnas: 1 })
        + escombroPie(cx - 4.6 * k, suelo, 1.7, c);

    case 'puente':     // dos pilas y el tablero partido
      return ed({ cx: cx - 3.0 * k, w: 1.8 * k, h: 4.2 * k, tejado: 'plano', plantas: 1, columnas: 1 })
        + ed({ cx: cx + 3.0 * k, w: 1.8 * k, h: 4.2 * k, tejado: 'plano', plantas: 1, columnas: 1 })
        + objeto([
          caminoRedondeado([[cx - 4.4 * k, altoDe(suelo, cx - 4, cx + 4) + 3.4 * k],
            [cx - 0.6 * k, altoDe(suelo, cx - 4, cx + 4) + 3.4 * k],
            [cx - 1.1 * k, altoDe(suelo, cx - 4, cx + 4) + 2.7 * k],
            [cx - 4.4 * k, altoDe(suelo, cx - 4, cx + 4) + 2.8 * k]], 0.1),
          caminoRedondeado([[cx + 0.9 * k, altoDe(suelo, cx - 4, cx + 4) + 2.6 * k],
            [cx + 4.4 * k, altoDe(suelo, cx - 4, cx + 4) + 3.4 * k],
            [cx + 4.4 * k, altoDe(suelo, cx - 4, cx + 4) + 2.8 * k],
            [cx + 1.1 * k, altoDe(suelo, cx - 4, cx + 4) + 2.0 * k]], 0.1),
        ], c2, 0.11)
        + escombroPie(cx, suelo, 1.8, c);

    case 'iglesia':
      return ed({ cx, w: 2.8 * k, h: 8.0 * k, tejado: 'roto', plantas: 3, columnas: 1 })
        + escombroPie(cx + 2.2 * k, suelo, 1.5, c);

    default:           // manzana: bloque de viviendas destripado y un ala baja
      return ed({ cx, w: 6.8 * k, h: 8.2 * k, tejado: 'roto', plantas: 4, columnas: 4 })
        + ed({ cx: cx + 5.0 * k, w: 3.4 * k, h: 4.4 * k, tejado: 'roto', plantas: 2, columnas: 2 })
        + escombroPie(cx - 4.4 * k, suelo, 1.7, c);
  }
}

/** Ancho que reserva el hito, para que el decorado no se le meta debajo. */
const ANCHO_HITO = {
  fabrica: 11.5, catedral: 13.0, lonja: 12.0, abadia: 10.5, estacion: 12.0,
  fuerte: 9.5, puente: 10.5, iglesia: 5.6, manzana: 11.0,
};

// ── crestas de fondo ──────────────────────────────────────────────────────

/**
 * El fondo de una ciudad arrasada es un PERFIL DE RUINAS, no unas colinas.
 *
 * Tres capas de manzanas con el remate roto, cada una mas mezclada con el cielo
 * y arrancando mas arriba que la de delante, de forma que la lejana asoma por
 * encima de las otras dos. Es lo que da profundidad sin paralaje —la camara es
 * ortografica— y lo que hace que el sitio se lea como una ciudad antes de mirar
 * una sola pieza del suelo.
 *
 * Se mezcla hacia la parada de cielo del HORIZONTE, nunca hacia el cenit:
 * mezclando con el cenit los tejados salen malva. Medido.
 */
const CAPAS = [
  { base: 3.0, min: 5.5, max: 9.5, k: 0.72, ancho: [2.6, 5.5] },
  { base: 2.0, min: 4.5, max: 8.0, k: 0.52, ancho: [2.2, 4.6] },
  { base: 1.0, min: 3.5, max: 6.5, k: 0.30, ancho: [1.8, 3.8] },
];

function ruinasDeFondo(t, x0, x1, rng) {
  let s = '';
  const fab = FABRICA[t.fabrica];
  CAPAS.forEach((c, i) => {
    const col = mezcla(fab, t.cielo[i === 0 ? 3 : 2], c.k);
    // Se listan las manzanas primero y se dibujan despues: asi las ventanas de
    // la capa cercana pueden ir en rejilla DENTRO de su edificio. Sembradas al
    // azar sobre la silueta se leen como suciedad, no como ventanas.
    const bloques = [];
    let x = x0;
    while (x < x1) {
      const aguja = rng() < 0.08;
      const w = aguja ? 0.9 + rng() * 0.4 : c.ancho[0] + rng() * (c.ancho[1] - c.ancho[0]);
      const h = c.base + (aguja ? c.max + 2.2 + rng() * 1.4 : c.min + rng() * (c.max - c.min));
      bloques.push({ x, w, h, aguja });
      x += w;
    }
    const pts = [[x0, -9]];
    for (const bl of bloques) {
      // Remate roto de UNA muesca. Con tres dientes de medio metro cada manzana
      // se lee como una montana y el fondo deja de parecer una ciudad.
      const m = 0.28 + rng() * 0.34;
      const p = 0.35 + rng() * 0.3;
      pts.push([bl.x, bl.h], [bl.x + bl.w * p, bl.h],
        [bl.x + bl.w * p, bl.h - m], [bl.x + bl.w * (p + 0.22), bl.h - m],
        [bl.x + bl.w * (p + 0.22), bl.h - 0.06], [bl.x + bl.w, bl.h - 0.06],
        [bl.x + bl.w, c.base]);
    }
    pts.push([x1, -9]);
    s += camino(polilinea(pts) + 'Z', { fill: col });   // el fondo NO lleva contorno

    if (i === 2) {
      const hu = tono(col, -0.14);
      for (const bl of bloques) {
        if (bl.aguja) continue;
        const cols = Math.max(1, Math.round(bl.w / 0.8));
        const filas = Math.max(1, Math.floor((bl.h - c.base - 0.9) / 0.95));
        for (let f = 0; f < filas; f++) {
          for (let k = 0; k < cols; k++) {
            if (rng() < 0.22) continue;
            s += camino(caja(bl.x + (bl.w * (k + 0.5)) / cols - 0.14, c.base + 0.7 + f * 0.95, 0.28, 0.46, 0.05), { fill: hu });
          }
        }
      }
    }
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
  s += ruinasDeFondo(t, X0, X1, mulberry32(semilla(`${clave}:fondo`)));

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
  // Cascote en el borde inferior, no matojos de hierba: esto es una calle.
  const rf = mulberry32(semilla(`${clave}:frente`));
  for (let i = 0; i < 26; i++) {
    const x = X0 + rf() * (X1 - X0);
    const w = 0.3 + rf() * 0.5, h = 0.22 + rf() * 0.3;
    const b = -3.0 + Math.sin(x * 0.42 + 2.0) * 0.42;
    s += camino(polilinea([[x, b], [x + w * 0.3, b + h], [x + w, b + h * 0.5], [x + w * 1.1, b]]) + 'Z', { fill: frenteCol });
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
  if (t.epoca < 1918) return { a: f('rombo'), b: f('a7v') };
  if (t.epoca < 1941) return { a: f('tanqueta'), b: f('ruedas') };
  if (t.epoca < 1944) return { a: f('media'), b: f('cazacarros') };
  if (['berlin', 'aquisgran', 'dresde'].includes(clave)) return { a: f('pesado'), b: f('asalto') };
  if (['varsovia44', 'budapest'].includes(clave)) return { a: f('semioruga'), b: f('lanzallamas') };
  if (clave === 'cassino') return { a: f('mortero'), b: f('obus') };
  if (clave === 'arnhem') return { a: f('ruedas'), b: f('media') };
  return { a: f('media'), b: f('pesado') };
}

export const X_ESCENA = { X0, X1 };
