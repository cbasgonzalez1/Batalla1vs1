import * as THREE from 'three';
import { contornoRedondeado, contornoLlano, extruir, pintar } from '../vehiculo/primitivas.js';
import { oscuro, contorno } from '../vehiculo/paleta.js';

/**
 * Las catorce familias de decorado urbano, en malla.
 *
 * Son las mismas que aprueban las planchas (`diseno/decorado.js`) y con los
 * mismos numeros: si una plancha y el juego se ven distintos, el roto esta en el
 * juego. Lo que cambia es el medio — alli un camino SVG, aqui un perfil
 * extruido en Z — y no la forma.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * LA REGLA, Y ES UNA SOLA
 *
 * Ninguna pieza tiene base plana. El borde INFERIOR de todo lo que se apoya se
 * construye con el perfil del terreno (`apoyada`), no con una recta.
 *
 * Con base recta la pieza toca el suelo en un punto y flota en el resto, y como
 * el decorado se pinta DESPUES del terreno el hueco no lo tapa nada. Hundirla un
 * poco tampoco vale: en una cuesta la esquina de abajo se entierra y la de
 * arriba sigue en el aire. Aplica a un tranvia igual que a un bidon.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Coste: TODAS las piezas del campo acaban fundidas en dos geometrias —cuerpos
 * y calcomanias— y en tres llamadas de dibujo contando el shell de contorno.
 * Catorce piezas de seis cajas serian ochenta y cuatro llamadas, y ahi se va el
 * presupuesto de cuadro entero.
 */

/** Muestreo del perfil del terreno bajo una pieza. */
const PASO = 0.3;

/** Grosor en Z de una pieza. De perfil no se ve; da volumen a 15 grados. */
const FONDO = 1.5;

// ── el suelo manda ────────────────────────────────────────────────────────

/** Puntos del terreno de x0 a x1, hundidos `h`. De izquierda a derecha. */
function perfilBase(suelo, x0, x1, h = 0.22) {
  const p = [];
  for (let x = x0; x < x1; x += PASO) p.push([x, suelo(x) - h]);
  p.push([x1, suelo(x1) - h]);
  return p;
}

/**
 * Silueta cerrada cuya base ES el terreno y cuyo techo son los puntos dados, de
 * izquierda a derecha. Asi se dibuja TODO lo que se apoya en el suelo.
 */
function apoyada(suelo, x0, x1, techo, h = 0.22) {
  return contornoLlano([...perfilBase(suelo, x0, x1, h), ...techo.slice().reverse()]);
}

/** El punto mas alto del tramo: la referencia de un techo que ha de ser plano. */
export function altoDe(suelo, x0, x1) {
  let m = -Infinity;
  for (let x = x0; x <= x1; x += 0.25) m = Math.max(m, suelo(x));
  return m;
}

// ── utilidades de forma ───────────────────────────────────────────────────

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Barra gruesa entre dos puntos. Es la viga, el piquete y el erizo. */
function barra(p, q, g) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * g;
  const ny = (dx / l) * g;
  return [
    [p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny],
    [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny],
  ];
}

function circulo(x, y, r) {
  const s = new THREE.Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

/** Cuelga un cuerpo: lleva contorno propio y entra en la silueta de la pieza. */
function poner(ctx, shape, color, { ancho = FONDO, z = 0, aclarar = true } = {}) {
  const g = extruir(shape, ancho);
  if (z) g.translate(0, 0, z);
  ctx.cuerpos.push(pintar(g, color, aclarar));
}

/**
 * Cuelga una calcomania: ventana, junta, listón.
 *
 * Va en OTRA geometria y no lleva contorno propio (`ARTE.md` §1, «un cuerpo, un
 * contorno»). Metida con los cuerpos, el shell le dibujaria un cerco alrededor y
 * cada ventana se leeria como una pieza pegada encima.
 */
function calco(ctx, shape, color, { z = FONDO / 2 + 0.03 } = {}) {
  const g = extruir(shape, 0.06, 0.015);
  g.translate(0, 0, z);
  ctx.detalles.push(pintar(g, color, false));
}

/** Linea fina pintada sobre la cara: junta de sillar, aro de bidon, listón. */
function raya(ctx, p, q, color, g = 0.05) {
  calco(ctx, contornoLlano(barra(p, q, g)), color);
}

// ── el monton de piedras ──────────────────────────────────────────────────

/**
 * Pila de piedras irregulares. La usan el escombro suelto y el pie del muro.
 *
 * Son BLOQUES, no una mancha. Un poligono unico de tres vertices no se entiende:
 * puede ser una roca, una rampa o una sombra. Lo que se lee como cascote es ver
 * las piedras sueltas, cada una con su contorno, amontonadas —tocandose— de
 * mayor abajo a menor arriba, sobre un vertido fino que las ata al suelo.
 */
export function monton(ctx, cx, ancho, color, n = 8) {
  const { suelo, rng } = ctx;
  const a = cx - ancho * 0.5;
  const b = cx + ancho * 0.5;
  const bajo = oscuro(color);

  // El vertido va BAJO y estrecho: extendido a todo el ancho y con joroba se lee
  // como un barrizal y no como el pie de un monton.
  poner(ctx, apoyada(suelo, a, b, [
    [a, suelo(a) + 0.06],
    [cx - ancho * 0.18, suelo(cx - ancho * 0.18) + 0.24],
    [cx + ancho * 0.16, suelo(cx + ancho * 0.16) + 0.2],
    [b, suelo(b) + 0.05],
  ]), bajo, { ancho: FONDO * 1.15 });

  const alto = 0.32 + ancho * 0.2;
  const piedras = [];
  for (let i = 0; i < n; i++) {
    const nivel = i / (n - 1);
    const w = Math.max(0.36, (0.7 - nivel * 0.26) * (0.85 + rng() * 0.4));
    const x = cx + (rng() - 0.5) * ancho * (0.72 - nivel * 0.5);
    piedras.push({
      x,
      y: suelo(x) - 0.05 + nivel * alto + rng() * 0.06,
      w,
      h: w * (0.62 + rng() * 0.24),
      giro: (rng() - 0.5) * 0.55,
      z: (rng() - 0.5) * FONDO * 0.5,
      nivel,
    });
  }
  // De abajo arriba: una piedra grande encima de una pequena no es un monton.
  piedras.sort((p, q) => p.y - q.y);
  for (const p of piedras) {
    const cs = Math.cos(p.giro);
    const sn = Math.sin(p.giro);
    const q = [
      [-p.w / 2, 0], [p.w / 2, -0.04], [p.w / 2 - 0.05, p.h], [-p.w / 2 + 0.07, p.h - 0.03],
    ].map(([dx, dy]) => [p.x + dx * cs - dy * sn, p.y + dx * sn + dy * cs]);
    poner(ctx, contornoRedondeado(q, 0.07), p.nivel > 0.6 ? bajo : color, {
      ancho: FONDO * 0.8,
      z: p.z,
    });
  }
}

// ── las familias ──────────────────────────────────────────────────────────

/**
 * Escombro de ladrillo: la unica familia que llevan las dieciseis ciudades.
 * Pila de bloques con una barra de hierro asomando.
 */
function escombro(ctx, cx, ancho = 3.0) {
  monton(ctx, cx, ancho, ctx.T.escombro, 8);
  const { suelo } = ctx;
  poner(ctx, contornoLlano(barra(
    [cx - ancho * 0.15, suelo(cx) + 0.6],
    [cx - ancho * 0.02, suelo(cx) + 1.32],
    0.055,
  )), ctx.T.metal, { ancho: 0.16 });
}

/**
 * Muro suelto: el trozo de fachada que queda en pie cuando cae el resto.
 *
 * Es la pieza mas util de una ciudad —vertical, alta y con un hueco— y la que
 * mas se parece a un muro-trampa, asi que NUNCA va sola y recta: va girada y
 * acompanada de su escombro (`docs/TRAMPAS.md` §4).
 */
function muro(ctx, cx) {
  const { suelo, rng, T } = ctx;
  const c = T.fabrica;
  const w = 1.5 + rng() * 0.6;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const h = 2.2 + rng() * 1.4;
  const inc = (rng() - 0.5) * 0.5;

  // Remate roto: dientes desiguales. Un canto recto es una tapia nueva.
  const dientes = [];
  for (let i = 0; i <= 4; i++) {
    dientes.push([
      a + inc * 0.6 + (w * i) / 4,
      y + h + (i % 2 ? 0.3 : -0.22) * (0.6 + rng() * 0.8),
    ]);
  }
  poner(ctx, apoyada(suelo, a, b, dientes, 0.25), c, { ancho: FONDO * 1.1 });

  // El hueco de la ventana, negro de verdad: es un agujero.
  calco(ctx, contornoRedondeado(
    rect(cx + inc * 0.4 - w * 0.16, y + h * 0.42, w * 0.32, h * 0.3), 0.07,
  ), T.hueco, { z: FONDO * 0.55 + 0.03 });
  for (const k of [0.3, 0.6]) {
    raya(ctx, [a, y + h * k], [b, y + h * k], contorno(c), 0.03);
  }

  monton(ctx, cx + w * 0.72, 1.5, c, 5);
}

/**
 * Viga retorcida: perfil doblado con un extremo clavado en el suelo. Recta seria
 * una barra; lo que cuenta que aqui exploto algo es el doblez.
 */
function viga(ctx, cx) {
  const { suelo, rng, T } = ctx;
  const y = altoDe(suelo, cx - 1.2, cx + 1.2);
  const alto = 2.0 + rng() * 0.9;
  const g = 0.16;
  const p0 = [cx - 1.0, y - 0.15];
  const p1 = [cx - 0.1, y + alto * 0.62];
  const p2 = [cx + 1.15, y + alto];
  poner(ctx, contornoRedondeado(barra(p0, p1, g), 0.05), T.metal, { ancho: 0.5 });
  poner(ctx, contornoRedondeado(barra(p1, p2, g), 0.05), T.metal, { ancho: 0.5 });
  poner(ctx, contornoRedondeado(rect(p2[0] - 0.24, p2[1] - 0.1, 0.48, 0.2), 0.04), T.metal, {
    ancho: 0.5,
  });
}

/**
 * Coche quemado: carroceria baja, sin cristales y con las llantas peladas. Va
 * SIN neumatico —ardio— y eso es lo que lo separa de un coche aparcado.
 */
function coche(ctx, cx) {
  const { suelo, T } = ctx;
  const w = 2.3;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);

  poner(ctx, apoyada(suelo, a, b, [
    [a, y + 0.62], [a + 0.3, y + 0.66], [cx - 0.5, y + 1.28], [cx + 0.42, y + 1.3],
    [b - 0.24, y + 0.7], [b, y + 0.62],
  ], 0.2), T.chatarra, { ancho: FONDO * 0.95 });

  // Habitaculo sin cristales: el hueco es lo que dice quemado.
  calco(ctx, contornoRedondeado(rect(cx - 0.42, y + 0.78, 0.8, 0.44), 0.08), T.hueco, {
    z: FONDO * 0.475 + 0.03,
  });
  for (const dx of [-0.66, 0.7]) {
    poner(ctx, circulo(cx + dx, y + 0.3, 0.3), T.llanta, {
      ancho: FONDO * 0.7,
      z: FONDO * 0.2,
    });
    calco(ctx, circulo(cx + dx, y + 0.3, 0.13), T.hueco, { z: FONDO * 0.35 + 0.05 });
  }
}

/**
 * Tranvia volcado. Es el obstaculo mas largo del catalogo y la silueta que mas
 * dice «ciudad»: caja de viajeros tumbada, ventanas como huecos negros seguidos
 * y el bogie con las ruedas al aire — que es lo que dice VOLCADO y no aparcado.
 */
function tranvia(ctx, cx) {
  const { suelo, T } = ctx;
  const w = 4.6;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const h = 1.5;

  poner(ctx, apoyada(suelo, a, b, [
    [a, y + 0.32], [a + 0.2, y + h * 0.9], [b - 0.55, y + h], [b, y + h * 0.55],
  ], 0.22), T.vagon, { ancho: FONDO * 1.2 });

  for (let i = 0; i < 4; i++) {
    calco(ctx, contornoRedondeado(rect(a + 0.55 + i * 0.92, y + 0.62, 0.6, 0.5), 0.07), T.hueco, {
      z: FONDO * 0.6 + 0.03,
    });
  }

  // El bogie con las ruedas al aire: sin el, es un vagon aparcado de lado.
  const bx = cx + w * 0.18;
  poner(ctx, contornoRedondeado(rect(bx - 0.62, y + h, 1.24, 0.26), 0.06), oscuro(T.vagon), {
    ancho: FONDO * 0.7,
  });
  for (const dx of [-0.38, 0.38]) {
    poner(ctx, circulo(bx + dx, y + h + 0.4, 0.23), T.llanta, {
      ancho: FONDO * 0.5,
      z: FONDO * 0.25,
    });
  }
}

/** Alambrada: piquetes desiguales, uno caido, y el alambre colgando. */
function alambrada(ctx, cx, tramos = 3) {
  const { suelo, rng, T } = ctx;
  const paso = 2.0;
  const x0 = cx - (tramos * paso) / 2;
  const postes = [];

  for (let i = 0; i <= tramos; i++) {
    const x = x0 + i * paso + (rng() - 0.5) * 0.3;
    const y = suelo(x);
    const alto = 1.05 + rng() * 0.45;
    // El ultimo va tumbado. Cuatro piquetes verticales iguales se leen como una
    // valla de jardin; uno caido cuenta que aqui paso algo.
    const caido = i === tramos;
    const cima = caido ? [x + alto * 0.75, y + alto * 0.28] : [x, y + alto];
    postes.push({ pie: [x, y], cima });
    poner(ctx, contornoRedondeado(barra([x, y - 0.25], cima, 0.07), 0.05), T.metal, {
      ancho: 0.22,
    });
  }

  const hilo = contorno(T.metal);
  for (let i = 1; i < postes.length; i++) {
    const p = postes[i - 1];
    const q = postes[i];
    for (let k = 0; k < 3; k++) {
      const f = 0.94 - k * 0.3;
      const ya = p.pie[1] + (p.cima[1] - p.pie[1]) * f;
      const yb = q.pie[1] + (q.cima[1] - q.pie[1]) * f;
      const mx = (p.cima[0] + q.cima[0]) / 2;
      const my = (ya + yb) / 2 - 0.22;
      // El alambre CUELGA. Tenso es un cable de la luz; la comba es lo que lo
      // hace alambrada. Se muestrea la parabola en cuatro tramos rectos: a este
      // zoom la curva no se distingue y cuestan cuatro cajas en vez de un tubo.
      let ant = [p.cima[0], ya];
      for (let s = 1; s <= 4; s++) {
        const u = s / 4;
        const px = p.cima[0] + (q.cima[0] - p.cima[0]) * u;
        const py = (1 - u) ** 2 * ya + 2 * (1 - u) * u * my + u * u * yb;
        poner(ctx, contornoLlano(barra(ant, [px, py], 0.035)), hilo, { ancho: 0.1, aclarar: false });
        ant = [px, py];
      }
    }
  }
}

/**
 * Erizo checo. Tres vigas que se cruzan, y las dos inclinadas APOYAN sus cuatro
 * extremos en el suelo: cruzadas a media altura sale un asterisco flotando.
 */
function erizo(ctx, cx) {
  const { suelo, T } = ctx;
  const L = 2.0;
  const g = 0.17;
  const a = cx - L * 0.42;
  const b = cx + L * 0.42;
  const y = altoDe(suelo, a, b);
  const cy = y + Math.sin(0.96) * (L / 2);   // los extremos bajos, en el suelo
  for (const ang of [0.96, Math.PI / 2, Math.PI - 0.96]) {   // 55°, 90°, 125°
    const dx = (Math.cos(ang) * L) / 2;
    const dy = (Math.sin(ang) * L) / 2;
    poner(ctx, contornoRedondeado(
      barra([cx - dx, cy - dy], [cx + dx, cy + dy], g), 0.07,
    ), T.metal, { ancho: 0.42 });
  }
  // Pletina de union: es lo que lo convierte en un objeto soldado.
  poner(ctx, circulo(cx, cy, 0.26), T.metal, { ancho: 0.5, z: 0.1 });
}

/** Poste de telegrafo: dos crucetas con aisladores, inclinado. */
function poste(ctx, cx) {
  const { suelo, rng, T } = ctx;
  const y = altoDe(suelo, cx - 0.12, cx + 0.12);
  const h = 3.0 + rng() * 0.8;
  const inc = (rng() - 0.5) * 0.8;
  const cima = [cx + inc, y + h];
  // El fuste arranca hundido en SU x. Cerrandolo con el perfil de todo el vano
  // que abarca la inclinacion sale una falda triangular al pie, como si el poste
  // tuviera un contrafuerte.
  poner(ctx, contornoRedondeado(barra([cx, suelo(cx) - 0.3], cima, 0.11), 0.06), T.madera, {
    ancho: 0.32,
  });
  for (const k of [0.8, 0.93]) {
    const bx = cx + inc * k;
    const by = y + h * k;
    poner(ctx, contornoRedondeado(rect(bx - 0.6, by, 1.2, 0.12), 0.05), T.madera, { ancho: 0.28 });
    for (const d of [-0.45, 0, 0.45]) {
      calco(ctx, circulo(bx + d, by + 0.18, 0.08), contorno(T.metal), { z: 0.2 });
    }
  }
}

/** Farola: fuste, brazo curvo y luminaria. */
function farola(ctx, cx) {
  const { suelo, T } = ctx;
  const y = altoDe(suelo, cx - 0.25, cx + 0.25);
  const h = 3.3;
  poner(ctx, apoyada(suelo, cx - 0.24, cx + 0.24, [
    [cx - 0.24, y + 0.34], [cx + 0.24, y + 0.34],
  ]), T.metal, { ancho: 0.5 });
  poner(ctx, contornoRedondeado(rect(cx - 0.09, y + 0.28, 0.18, h - 0.28), 0.05), T.metal, {
    ancho: 0.3,
  });
  poner(ctx, contornoRedondeado([
    [cx - 0.05, y + h], [cx + 0.6, y + h - 0.1],
    [cx + 0.6, y + h - 0.34], [cx - 0.05, y + h - 0.34],
  ], 0.14), T.metal, { ancho: 0.28 });
  poner(ctx, contornoRedondeado([
    [cx + 0.34, y + h - 0.88], [cx + 0.84, y + h - 0.88],
    [cx + 0.7, y + h - 0.16], [cx + 0.48, y + h - 0.16],
  ], 0.08), T.metal, { ancho: 0.34 });
}

/**
 * Arbol de calle quemado. Tronco con dos o tres munones de rama y nada de copa.
 * En una ciudad arrasada es lo unico organico que queda en pie, y por eso dice
 * «esto era una calle» mejor que ningun escombro.
 */
function arbol(ctx, cx) {
  const { suelo, rng, T } = ctx;
  const w = 0.2;
  const a = cx - w;
  const b = cx + w;
  const y = altoDe(suelo, a, b);
  const h = 2.2 + rng() * 1.1;
  poner(ctx, apoyada(suelo, a, b, [[a, y + h], [b, y + h * 0.94]], 0.2), T.corteza, {
    ancho: 0.52,
  });
  // Munones: uno a cada altura y de distinto largo. Simetricos parecen una cruz.
  for (const [k, dx, dy] of [[0.52, 1.05, 0.5], [0.68, -0.9, 0.36], [0.86, 0.66, 0.28]]) {
    poner(ctx, contornoRedondeado([
      [cx - 0.09, y + h * k], [cx + dx, y + h * k + dy],
      [cx + dx * 0.92, y + h * k + dy - 0.16], [cx + 0.09, y + h * k - 0.16],
    ], 0.06), T.corteza, { ancho: 0.4 });
  }
  // Banda oscura del flanco: sin ella el tronco es un cilindro plano.
  calco(ctx, contornoLlano(rect(cx + 0.02, y - 0.4, 0.11, h + 0.4)), oscuro(T.corteza), {
    z: 0.28,
  });
}

/** Barricada de adoquines levantados del propio empedrado. */
function barricada(ctx, cx, ancho = 3.0) {
  const { suelo, T } = ctx;
  for (let fi = 0; fi < 4; fi++) {
    const w = ancho * (1 - fi * 0.15);
    const n = Math.max(3, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const bx = cx - w / 2 + (w / n) * (i + 0.5);
      // Cada hilada sube desde EL SUELO DE SU X: con una cota comun la barricada
      // queda escalonada en el aire sobre terreno en cuesta.
      const by = suelo(bx) - 0.06 + fi * 0.3;
      poner(ctx, contornoRedondeado(rect(bx - w / n / 2 + 0.03, by, w / n - 0.06, 0.3), 0.06),
        T.adoquin, { ancho: FONDO * 0.9, z: (fi % 2 ? 0.12 : -0.12) });
    }
  }
}

/** Bidones de combustible: cilindro con dos aros. */
function bidones(ctx, cx, n = 2) {
  const { suelo, T } = ctx;
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * 0.92;
    const w = 0.36;
    const a = x - w;
    const b = x + w;
    const y = altoDe(suelo, a, b);
    const h = 1.02;
    poner(ctx, apoyada(suelo, a, b, [[a, y + h], [b, y + h]]), T.bidon, { ancho: 0.72 });
    for (const k of [0.28, 0.68]) {
      raya(ctx, [a, y + h * k], [b, y + h * k], contorno(T.bidon), 0.05);
    }
  }
}

/** Cajas de municion apiladas, con los listones marcados. */
function cajas(ctx, cx) {
  const { suelo, T } = ctx;
  const una = (x0, x1, y, h, z) => {
    poner(ctx, contornoRedondeado(rect(x0, y, x1 - x0, h), 0.07), T.madera, {
      ancho: FONDO * 0.7,
      z,
    });
    raya(ctx, [x0, y + h * 0.5], [x1, y + h * 0.5], contorno(T.madera), 0.035);
  };
  const y0 = altoDe(suelo, cx - 0.88, cx + 0.02) - 0.14;
  const y1 = altoDe(suelo, cx + 0.04, cx + 0.86) - 0.14;
  una(cx - 0.88, cx + 0.02, y0, 0.58, 0);
  una(cx + 0.04, cx + 0.86, y1, 0.5, -0.14);
  una(cx - 0.6, cx + 0.26, y0 + 0.58, 0.5, 0.12);
}

/**
 * Via de tren: terraplen de balasto, traviesas y el carril retorcido.
 *
 * Una via recta y entera no cuenta nada. El carril que se levanta y se dobla en
 * un extremo es lo que dice que aqui cayo algo (`docs/ESCENARIOS.md` §3.7).
 */
function via(ctx, cx, largo = 6.5) {
  const { suelo, T } = ctx;
  const a = cx - largo / 2;
  const b = cx + largo / 2;
  const alto = 0.55;
  const nivel = (x) => suelo(x) + alto;

  poner(ctx, apoyada(suelo, a, b, perfilBase(suelo, a, b, -alto)), T.balasto, {
    ancho: FONDO * 1.4,
  });
  const n = Math.round(largo / 0.8);
  for (let i = 0; i < n; i++) {
    const x = a + 0.75 + ((largo - 1.6) * i) / (n - 1);
    poner(ctx, contornoRedondeado(rect(x - 0.21, nivel(x) - 0.08, 0.42, 0.16), 0.03), T.traviesa, {
      ancho: FONDO * 1.5,
    });
  }
  // Carril: cinta continua muestreada sobre el perfil.
  let ant = [a + 0.7, nivel(a + 0.7) + 0.09];
  for (let x = a + 1.0; x <= b - 1.1; x += 0.6) {
    const p = [x, nivel(x) + 0.09];
    poner(ctx, contornoLlano(barra(ant, p, 0.06)), T.metal, { ancho: 0.14, z: 0.42 });
    ant = p;
  }
  // Y el tramo retorcido: se levanta 0,9 u en tres tramos.
  for (const [dx, dy] of [[0.35, 0.18], [0.4, 0.42], [0.3, 0.35]]) {
    const p = [ant[0] + dx, ant[1] + dy];
    poner(ctx, contornoLlano(barra(ant, p, 0.06)), T.metal, { ancho: 0.14, z: 0.42 });
    ant = p;
  }
}

/**
 * Parapeto de sacos terreros. Va uno delante de cada canon, siempre.
 *
 * Es un MURO, y por eso se apila con el remate A NIVEL: donde el suelo baja se
 * ponen mas hiladas, no se baja el muro. Colocando cada saco a la cota de su x
 * salia una sarta de cuentas subiendo la cuesta en diagonal que no se entendia
 * como nada. Las hiladas van trabadas —cada una desplazada media pieza— porque
 * eso es lo que hace que se lea como aparejo y no como una rejilla.
 */
export function sacos(ctx, cx, ancho = 3.0) {
  const { suelo, T } = ctx;
  const a = cx - ancho / 2;
  const b = cx + ancho / 2;
  const bw = 0.54;
  const bh = 0.29;
  const n = Math.max(4, Math.round(ancho / bw));
  const paso = ancho / n;
  const nivel = altoDe(suelo, a, b) + 0.68;

  for (let i = 0; i < n; i++) {
    const x = a + paso * (i + 0.5);
    // El remate cae un saco en los dos extremos: con el canto vivo parece tapia.
    const tope = nivel - (i === 0 || i === n - 1 ? bh : 0);
    const pie = suelo(x) - 0.1;
    const filas = Math.max(1, Math.round((tope - pie) / bh));
    for (let f = 0; f < filas; f++) {
      const y = pie + f * bh;
      const dx = f % 2 ? paso * 0.26 : 0;
      poner(ctx, contornoRedondeado(rect(x - bw / 2 + dx, y, bw, bh + 0.05), 0.13), T.lona, {
        ancho: FONDO * 0.8,
        z: f % 2 ? 0.1 : -0.1,
      });
    }
  }
}

/**
 * El catalogo. `ancho` es lo que la pieza RESERVA en el terreno y `veces`
 * cuantas aparece por cada 38 unidades de campo — que es lo que encuadra la
 * plancha. Un teatro con seis tranvias no es Varsovia, es un deposito.
 *
 * La tabla es la de `docs/ESCENARIOS.md` §3 y no se toca sin cambiarla alli.
 */
export const FAMILIAS = {
  tranvia: { ancho: 5.0, veces: 1, construir: tranvia },
  via: { ancho: 7.0, veces: 1, construir: (c, x) => via(c, x, 6.5) },
  alambrada: { ancho: 6.6, veces: 1, construir: (c, x) => alambrada(c, x, 3) },
  barricada: { ancho: 3.4, veces: 2, construir: (c, x) => barricada(c, x, 3.0) },
  escombro: { ancho: 3.2, veces: 3, construir: (c, x) => escombro(c, x, 3.0) },
  coche: { ancho: 2.7, veces: 1, construir: coche },
  viga: { ancho: 2.6, veces: 2, construir: viga },
  muro: { ancho: 2.6, veces: 2, construir: muro },
  erizo: { ancho: 2.2, veces: 2, construir: erizo },
  cajas: { ancho: 2.2, veces: 1, construir: cajas },
  bidones: { ancho: 2.2, veces: 1, construir: (c, x) => bidones(c, x, 2) },
  arbol: { ancho: 1.6, veces: 2, construir: arbol },
  farola: { ancho: 1.3, veces: 2, construir: farola },
  poste: { ancho: 1.2, veces: 2, construir: poste },
};

export { apoyada, perfilBase, poner, calco, rect, barra, circulo, FONDO };
