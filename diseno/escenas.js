/**
 * Los seis teatros, dibujados en los cinco planos de ARTE.md §3.
 *
 * Todo lo que se coloca sale de un `rng` SEMBRADO. No es purismo: dos moviles
 * con el mismo codigo de sala tienen que ver el mismo campo, y el servidor no
 * manda nada de esto. Una escena con `Math.random()` es una escena distinta en
 * cada telefono (docs/ESCENARIOS.md §2).
 */

import {
  caminoRedondeado, circulo, caja, camino, grupo, polilinea,
  sombraContacto, siluetaUnica,
} from './primitivas.js';
import { TEATROS, mezcla, tono, claro, oscuro, contorno, MATERIA, TINTE_TEATRO } from './paleta.js';
import { construir, FICHAS } from './vehiculos.js';

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
 * Estratos de ARTE.md §12. El brillo ALTERNA de una franja a la siguiente: con
 * un degradado monotono el subsuelo vuelve a ser una mancha por muchos estratos
 * que tenga; alternando, cada linea entre franjas se ve.
 */
const ESTRATOS = [
  [0.55, 'cresta', 1.16], [1.7, 0.1, 1.04], [3.2, 0.28, 0.93], [5.4, 0.2, 1.09],
  [8.4, 0.52, 0.9], [12.5, 0.36, 1.06], [18.0, 0.7, 0.88], [26.0, 0.5, 1.04],
];

const brillo = (c, b) => tono(c, b - 1);

function colorEstrato(t, e) {
  const base = e[1] === 'cresta' ? t.cresta : mezcla(t.cuerpo, t.socavon, e[1]);
  return brillo(base, e[2]);
}

/**
 * Perfil del campo: dos plataformas de tiro, un valle y unos crateres viejos.
 * Devuelve tambien donde cayeron, porque el agua del crater tiene que ir EN el
 * crater: una elipse de agua sobre terreno llano se lee como un papel tirado.
 */
function perfilTerreno(t, rng, x0, x1, comp = 'abierto') {
  const pts = [];
  const craters = comp === 'zanja'
    ? [-4.5 + rng() * 2, 1 + rng() * 3, 6.5 + rng() * 2]
    : [-6 + rng() * 3, 2 + rng() * 4, 9 + rng() * 3];
  for (let x = x0; x <= x1 + 0.01; x += 0.25) {
    let y = 3.4
      + Math.sin(x * 0.19 + 1.1) * 1.5
      + Math.sin(x * 0.47 + 4.0) * 0.55
      + Math.sin(x * 1.03 + 2.2) * 0.16;

    if (comp === 'ruina') {
      // Loma central: los dos emplazamientos quedan en laderas opuestas y el
      // hito se planta en la cresta. La loma no colisiona con el proyectil —el
      // decorado nunca lo hace— pero obliga a mirar por encima de algo.
      y += Math.max(0, Math.cos((x / 8.5) * Math.PI * 0.5)) ** 2 * 2.0;
      y -= Math.max(0, 1 - Math.abs(x - 13.4) / 5) * 0.5;
      y -= Math.max(0, 1 - Math.abs(x + 13.4) / 5) * 0.5;
    }

    if (comp === 'zanja') {
      y = 3.0 + Math.sin(x * 0.21 + 0.6) * 0.75 + Math.sin(x * 0.9 + 2.2) * 0.2;
      // Trinchera de verdad: se BAJA el mapa de alturas en un tramo con paredes
      // de mucha pendiente y se levanta el labio con la tierra excavada. Una
      // caja encima del suelo no es una trinchera, es una valla
      // (docs/ESCENARIOS.md §3.1).
      // El foso tiene que ser MAS ANCHO que la pieza que va dentro. Con 5 u de
      // ancho y un casco de 6,4 el blindado se apoya en los dos labios, tapa las
      // paredes y la trinchera desaparece: se ve un tanque en terreno llano.
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
      if (d < 3.2) y += (3.2 - d) * 0.12 * (1 - d / 3.2);
    }
    // crateres viejos: hunden Y LEVANTAN un labio. Sin labio no se leen como
    // impacto, se leen como ondulacion (docs/ESCENARIOS.md §3.4).
    for (const cx of craters) {
      const d = Math.abs(x - cx);
      if (d < 3.4) {
        const k = d / 3.4;
        y += -1.15 * Math.cos(k * Math.PI * 0.5) ** 2 * (1 - k) + Math.sin(k * Math.PI) * 0.42;
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

// ── decorado ──────────────────────────────────────────────────────────────

/** Tinte de teatro: sin el, una viga de madera en el Somme y en Alamein es la misma. */
const tenir = (c, t) => mezcla(c, t.cuerpo, TINTE_TEATRO);

function objeto(formas, base, grosor = 0.1, dentro = '') {
  return siluetaUnica({
    formas, cont: contorno(base), tonoClaro: claro(base), tonoBase: base,
    grosor, luz: [0.11, -0.16], dentro,
  });
}

/** Parapeto de sacos. Contra cada canon hay uno siempre (ARTE.md §13). */
function parapeto(x, y, t, rng, ancho = 3.2) {
  const c = tenir(MATERIA.lona, t);
  let s = '';
  for (let fila = 0; fila < 2; fila++) {
    const n = fila === 0 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const sx = x - ancho / 2 + (ancho / n) * (i + 0.5) + (fila ? ancho / n / 2 : 0);
      const sy = y + fila * 0.3;
      // cada saco con contorno propio: sin el, el parapeto es un churro
      s += objeto([caminoRedondeado([[sx - 0.3, sy], [sx + 0.3, sy], [sx + 0.3, sy + 0.34], [sx - 0.3, sy + 0.34]], 0.16)], c, 0.07);
    }
  }
  return s;
}

/** Alambrada: piquetes desiguales y alambre que CUELGA. Recto parece una valla. */
function alambrada(x0, n, t, rng, suelo) {
  const c = tenir(MATERIA.metal, t);
  let s = '', prev = null;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 2.2 + rng() * 0.4;
    // Cada piquete se asienta en SU x. Con una Y fija para todos, la alambrada
    // flota en cuanto el terreno tiene relieve, que es siempre.
    const y = suelo(x);
    const h = y + 1.1 + rng() * 0.5;
    const cai = i % 3 === 2;
    const top = cai ? [x + 0.7, y + (h - y) * 0.4] : [x, h];
    s += objeto([caminoRedondeado([[x - 0.08, y], [x + 0.08, y], [top[0] + 0.08, top[1]], [top[0] - 0.08, top[1]]], 0.06)], c, 0.06);
    if (prev) {
      for (let k = 0; k < 3; k++) {
        const b0 = suelo(prev[0]), b1 = suelo(top[0]);
        const y0 = b0 + (prev[1] - b0) * (0.92 - k * 0.26);
        const y1 = b1 + (top[1] - b1) * (0.92 - k * 0.26);
        const mx = (prev[0] + top[0]) / 2, my = (y0 + y1) / 2 - 0.16;
        s += `<path d="M${prev[0].toFixed(2)} ${y0.toFixed(2)}Q${mx.toFixed(2)} ${my.toFixed(2)} ${top[0].toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${contorno(c)}" stroke-width="0.05" stroke-dasharray="0.28 0.12"/>`;
      }
    }
    prev = top;
  }
  return s;
}

/** Tocon astillado. Tronco tronchado, nunca un arbol: aqui no queda ninguno. */
function tocon(x, y, escala, t, rng) {
  const c = tenir(MATERIA.madera, t);
  // El tocon gigante se ensancha en vez de estirarse: a 3,5x de alto y el mismo
  // grosor sale un monolito de piedra, no un tronco tronchado.
  const gordo = escala > 2 ? 1.35 : 1;
  const h = 1.6 * escala * (escala > 2 ? 0.9 : 1), w = 0.42 * escala * gordo;
  // La fractura son PUNTAS desiguales, no un dentado regular: el corte de un
  // tronco tronchado nunca es simetrico, y con las cinco puntas iguales el
  // tocon se lee como un poste de valla (docs/ESCENARIOS.md §3.6).
  const alturas = [0.0, 0.62, 0.18, 0.46, -0.06];
  const puntas = [];
  for (let i = 0; i <= 4; i++) {
    puntas.push([x - w + (2 * w * i) / 4, y + h + alturas[i] * escala]);
  }
  const perfil = [[x - w * 0.9, y], [x + w * 0.9, y], [x + w, y + h * 0.6], ...puntas.reverse()];
  let s = objeto([caminoRedondeado(perfil, 0.05)], c, 0.09);
  // raiz expuesta a un lado: la asimetria es lo que lo hace objeto y no icono
  s += objeto([caminoRedondeado([[x - w, y + 0.1], [x - w - 0.6 * escala, y - 0.05], [x - w - 0.4 * escala, y + 0.3], [x - w, y + 0.4]], 0.1)], c, 0.07);
  if (escala > 2) {
    // Dos ramas muertas, una a cada altura y de distinta longitud. Simetricas
    // se leerian como un icono (docs/ESCENARIOS.md §3.6).
    s += objeto([caminoRedondeado([[x + w * 0.7, y + h * 0.62], [x + w * 2.3, y + h * 0.92], [x + w * 2.35, y + h * 0.76], [x + w * 0.75, y + h * 0.44]], 0.1)], c, 0.08);
    s += objeto([caminoRedondeado([[x - w * 0.7, y + h * 0.44], [x - w * 1.85, y + h * 0.2], [x - w * 1.8, y + h * 0.06], [x - w * 0.75, y + h * 0.26]], 0.1)], c, 0.08);
  }
  return s;
}

/**
 * Crater con agua. Los craters viejos —los de generacion— la llevan; los
 * frescos del combate no. Que se distingan es informacion de juego: te dice
 * donde ya has tirado (docs/ESCENARIOS.md §3.4).
 */
function charco(x, y, r, t) {
  // Mas OSCURO que el terreno, no mas claro. Mezclado hacia el cielo alto el
  // charco sale palido y en un teatro nevado se convierte en una losa blanca
  // flotando; hacia el socavon se lee como agua embalsada en el hoyo.
  let s = camino(caminoRedondeado([[x - r, y], [x + r, y], [x + r * 0.88, y + 0.34], [x - r * 0.88, y + 0.34]], 0.3), {
    fill: mezcla(t.socavon, t.cielo[0], 0.3),
  });
  s += camino(caminoRedondeado([[x - r * 0.9, y + 0.09], [x + r * 0.9, y + 0.09], [x + r * 0.76, y + 0.26], [x - r * 0.76, y + 0.26]], 0.2), {
    fill: 'none', stroke: mezcla(t.socavon, '#000', 0.35), 'stroke-width': 0.05,
  });
  return s;
}

/** Bidones y cajas de municion. Nunca en `acento`: el naranja es de las trampas. */
function cajas(x, y, t, rng) {
  const c = tenir(MATERIA.madera, t);
  let s = objeto([caja(x, y, 0.9, 0.62, 0.1)], c, 0.08);
  s += objeto([caja(x + 0.25, y + 0.62, 0.75, 0.5, 0.1)], c, 0.08);
  return s;
}

/**
 * Entibado de la trinchera: tablones verticales de ANCHURA DESIGUAL contra la
 * pared. Iguales se leen como una valla de jardin, que es el fallo clasico de
 * esta pieza.
 */
function entibado(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  let s = '';
  let x = cx - 3.5;
  while (x < cx + 3.5) {
    const w = 0.28 + rng() * 0.24;
    const y = suelo(x + w / 2);
    s += objeto([caja(x, y, w * 0.86, 1.5 + rng() * 0.4, 0.04)], c, 0.06);
    x += w;
  }
  // viga transversal y poste de esquina, que es lo que la sujeta
  s += objeto([caja(cx - 3.6, suelo(cx) + 1.52, 7.2, 0.2, 0.06)], oscuro(c), 0.07);
  return s;
}

// ── hitos ─────────────────────────────────────────────────────────────────

/** Borde superior astillado: zigzag de dientes, nunca una recta ni un arco. */
function astillado(x0, x1, y, dientes, amp) {
  const pts = [];
  for (let i = 0; i <= dientes; i++) {
    pts.push([x0 + ((x1 - x0) * i) / dientes, y + (i % 2 ? amp : -amp * 0.5)]);
  }
  return pts;
}

function hito(t, x, suelo, k = 1) {
  const piedra = tenir(t.hito === 'isba' ? MATERIA.madera : MATERIA.hormigon, t);
  const y = suelo;
  let s = '';
  const escombro = (cx, w) => objeto([caminoRedondeado([[cx - w, y], [cx + w, y], [cx + w * 0.4, y + 0.55], [cx - w * 0.6, y + 0.42]], 0.16)], oscuro(piedra), 0.09);

  if (t.hito === 'tocon') {
    // Flandes: el tocon gigante es el mismo modulo a escala 3,5x
    s += tocon(x, y, 3.5 * k, t, mulberry32(7));
    s += escombro(x + 2.4, 1.1);
    return s;
  }

  const alto = (t.hito === 'chimenea' ? 7.4 : t.hito === 'torre' ? 6.6 : 3.4) * k;
  const ancho = (t.hito === 'chimenea' ? 0.9 : t.hito === 'torre' ? 1.7 : 3.0) * k;

  // muro principal, con el remate astillado
  const remate = astillado(x - ancho, x + ancho, y + alto, 5, 0.42);
  s += objeto([caminoRedondeado([[x - ancho, y], [x + ancho, y], ...remate.reverse()], 0.14)], piedra, 0.11);
  // hueco de ventana: una sola cara oscura al fondo. Dentro no se ve y cuesta.
  s += camino(caja(x - ancho * 0.4, y + alto * 0.45, ancho * 0.8, alto * 0.26, 0.14), { fill: contorno(piedra) });
  if (alto > 5) s += camino(caja(x - ancho * 0.4, y + alto * 0.72, ancho * 0.8, alto * 0.16, 0.14), { fill: contorno(piedra) });
  // segundo muro mas bajo y girado: una ruina nunca es un muro solo y recto
  const bajo = astillado(x + ancho * 0.9, x + ancho * 2.4, y + alto * 0.42, 4, 0.3);
  s += objeto([caminoRedondeado([[x + ancho * 0.9, y], [x + ancho * 2.4, y], ...bajo.reverse()], 0.14)], oscuro(piedra), 0.1);
  // viga de techo caida en diagonal
  s += objeto([caminoRedondeado([[x - ancho * 1.5, y + 0.06], [x - ancho * 0.5, y + alto * 0.42], [x - ancho * 0.25, y + alto * 0.35], [x - ancho * 1.35, y - 0.12]], 0.08)], tenir(MATERIA.madera, t), 0.08);
  s += escombro(x - ancho * 1.4, 1.3);
  s += escombro(x + ancho * 1.9, 1.0);
  return s;
}

// ── crestas de fondo ──────────────────────────────────────────────────────

/**
 * Tres capas mezcladas hacia la parada de cielo del HORIZONTE, nunca hacia el
 * cenit: mezclando con el cenit el horizonte del desierto sale malva. Medido.
 */
const CAPAS = [
  { base: 10.5, alt: 6.0, k: 0.74, f: 0.86 },
  { base: 7.6, alt: 4.4, k: 0.5, f: 0.68 },
  { base: 5.2, alt: 3.2, k: 0.28, f: 0.44 },
];

function crestas(t, x0, x1) {
  let s = '';
  CAPAS.forEach((c, i) => {
    const col = mezcla(t.cuerpo, t.cielo[i === 0 ? 3 : 2], c.k);
    const pts = [[x0, -6]];
    for (let x = x0; x <= x1 + 0.01; x += 0.6) {
      pts.push([x, c.base + Math.sin(x * (0.13 + i * 0.05) + i * 2.1) * c.alt * 0.28 + Math.sin(x * 0.31 + i) * c.alt * 0.1]);
    }
    pts.push([x1, -6]);
    // el fondo lejano NO lleva contorno (ARTE.md §1.1)
    s += camino(polilinea(pts) + 'Z', { fill: col });
  });
  return s;
}

// ── escena completa ───────────────────────────────────────────────────────

// 38 u de ancho: es el encuadre real de partida. Con 46 los blindados salian
// del tamano de una chincheta y la plancha no ensenaba lo que se va a ver.
const X0 = -19, X1 = 19;

export function escena(clave, { bandoA, bandoB, fichaA, fichaB, composicion = 'abierto', piezaA, piezaB }) {
  const t = TEATROS[clave];
  const rng = mulberry32(semilla(`${clave}:${composicion}`));
  const perfil = perfilTerreno(t, mulberry32(semilla(`${clave}:suelo`)), X0, X1, composicion);
  let s = '';

  // 1. cielo — cuatro bandas planas, mas claro cerca del horizonte
  const paradas = [[-6, 3.5], [3.5, 8], [8, 13], [13, 22]];
  t.cielo.slice().reverse().forEach((c, i) => {
    const [a, b] = paradas[i];
    s += camino(caja(X0, a, X1 - X0, b - a, 0), { fill: c });
  });
  // nubes: bultos redondos, sin contorno, del tono mas claro del cielo
  for (let i = 0; i < 4; i++) {
    const cx = X0 + 4 + rng() * (X1 - X0 - 8), cy = 11.4 + rng() * 3.4, r = 0.9 + rng() * 0.7;
    s += camino(circulo(cx, cy, r) + circulo(cx + r, cy - r * 0.3, r * 0.75) + circulo(cx - r, cy - r * 0.35, r * 0.6), {
      fill: tono(t.cielo[3], 0.35),
    });
  }

  // 2. fondo lejano
  s += crestas(t, X0, X1);

  // 3. suelo por estratos, siguiendo el relieve.
  // El orden va de la COSTRA hacia abajo: cada franja se dibuja como el perfil
  // hundido su profundidad y tapa a la anterior de ahi para abajo. Al reves
  // —de lo hondo a lo somero— la ultima lo tapa todo y el suelo sale de un
  // color, que es exactamente lo que pasaba y lo que hace que un terreno con
  // diez estratos se vea como una mancha.
  for (let i = 0; i < ESTRATOS.length; i++) {
    const d = i === 0 ? 0 : ESTRATOS[i - 1][0];
    const banda = [[X0, -8], ...perfil.map(([x, y]) => [x, y - d]), [X1, -8]];
    s += camino(polilinea(banda) + 'Z', { fill: colorEstrato(t, ESTRATOS[i]) });
  }
  s += camino(polilinea(perfil), { fill: 'none', stroke: mezcla(t.socavon, '#000', 0.3), 'stroke-width': 0.1 });

  // 4. hito y decorado
  const suelo = (x) => alturaEn(perfil, x);
  // En la composicion de ruina el hito manda: va en la cresta, centrado, y
  // ocupa el tope del 25-40 % del ancho que permite ARTE.md §3.
  const xh = composicion === 'ruina' ? 0.6 : -3 + rng() * 5;
  // 1,15 y no mas: sobre la loma el hito ya arranca 2 u mas arriba, y a 1,5 se
  // sale por el borde superior del encuadre. El tope del 25-40 % del ancho de
  // ARTE.md §3 se mide en ancho, pero el que se pasa siempre es el alto.
  s += hito(t, xh, suelo(xh), composicion === 'ruina' ? 1.15 : 1);

  s += alambrada(-8.4, 4, t, mulberry32(semilla(`${clave}:alambre`)), suelo);
  // Agrupados de dos o tres, nunca repartidos: tocones a espaciado regular
  // parecen un huerto y no un bosque astillado (docs/ESCENARIOS.md §3.6).
  for (const x of [-17.8, -17.0, -10.4, 4.9, 5.6, 9.8, 17.2, 18.0]) {
    if (rng() > 0.28) s += tocon(x, suelo(x), 0.8 + rng() * 0.6, t, rng);
  }
  s += cajas(7.0, suelo(7.0), t, rng);
  s += cajas(-6.4, suelo(-6.4), t, rng);
  for (const cx of perfil.craters) {
    // El fondo del hoyo, no la superficie en su x: el labio levantado hace que
    // suelo(cx) caiga por encima del agua y el charco quede como una losa
    // apoyada en una cuesta.
    let fondo = Infinity;
    for (let d = -1.6; d <= 1.6; d += 0.25) fondo = Math.min(fondo, suelo(cx + d));
    s += charco(cx, fondo + 0.02, 1.5, t);
  }

  // 5. las dos piezas, cada una con su parapeto de sacos
  if (composicion === 'zanja') {
    s += entibado(-13.4, suelo, t, mulberry32(semilla(`${clave}:entibado`)));
    s += entibado(13.4, suelo, t, mulberry32(semilla(`${clave}:entibado2`)));
  }
  const colocar = (x, ficha, base, voltear) => {
    const y = suelo(x);
    const arte = piezaA ? (voltear ? piezaB : piezaA)(base, false) : construir(ficha, { base });
    return grupo(arte, {
      transform: `translate(${x} ${y.toFixed(2)})${voltear ? ' scale(-1 1)' : ''}`,
    });
  };
  s += colocar(-13.4, fichaA, bandoA, false);
  s += colocar(13.4, fichaB, bandoB, true);
  // El parapeto va DELANTE del canon, no detras: puesto detras lo tapa la
  // propia pieza y el jugador nunca lo ve (ARTE.md §13). En la zanja va en el
  // labio, que es justo donde lo pone quien cava una trinchera.
  const lp = composicion === 'zanja' ? 5.1 : 2.8;
  s += parapeto(-13.4 + lp, suelo(-13.4 + lp) - 0.12, t, rng, composicion === 'zanja' ? 2.6 : 3.2);
  s += parapeto(13.4 - lp, suelo(13.4 - lp) - 0.12, t, rng, composicion === 'zanja' ? 2.6 : 3.2);

  // 6. primer plano: silueta oscura casi plana. Se tine hacia el socavon del
  // teatro, no hacia el negro: un primer plano gris o pardo neutro es el mismo
  // en los seis y rompe la paleta que acaba de montar el suelo.
  const oscuroFrente = mezcla(t.socavon, '#241d10', 0.5);
  const frente = [];
  for (let x = X0; x <= X1 + 0.01; x += 0.5) {
    frente.push([x, -3.0 + Math.sin(x * 0.42 + 2.0) * 0.42 + Math.sin(x * 1.3) * 0.16]);
  }
  for (let i = 0; i < 30; i++) {
    const x = X0 + rng() * (X1 - X0);
    const h = 0.4 + rng() * 0.55;
    const b = -3.0 + Math.sin(x * 0.42 + 2.0) * 0.42;
    s += camino(polilinea([[x, b], [x + 0.11, b + h], [x + 0.28, b]]) + 'Z', { fill: oscuroFrente });
  }
  s += camino(polilinea([[X0, -8], ...frente, [X1, -8]]) + 'Z', { fill: oscuroFrente });

  return { svg: s, teatro: t };
}

/** Reparto por defecto de cada teatro: la epoca la manda el teatro, no el jugador. */
export function repartoDe(clave) {
  const t = TEATROS[clave];
  const f = (id) => FICHAS.find((x) => x.id === id);
  if (t.epoca < 1930) return { a: f('rombo'), b: f('a7v') };
  if (clave === 'alamein') return { a: f('media'), b: f('ruedas') };
  if (clave === 'stalingrado') return { a: f('asalto'), b: f('cazacarros') };
  if (clave === 'ardenas') return { a: f('pesado'), b: f('media') };
  return { a: f('media'), b: f('cazacarros') };
}

export const X_ESCENA = { X0, X1 };
