/**
 * Trampas y modificadores de tiro.
 *
 * Son los objetos que CAMBIAN el disparo: unos en el suelo, donde cae el
 * proyectil, y otros en el aire, donde lo atraviesa. Sustituyen a las dos piezas
 * alternativas —canon de campana y mortero de sitio—, que resolvian un problema
 * que el juego no tenia: lo que le falta a un duelo de artilleria por turnos no
 * es otra silueta de canon, es que el turno tenga decisiones que no sean solo
 * angulo y potencia.
 *
 * ────────────────────────────────────────────────────────────────────────
 * EL LENGUAJE VISUAL, QUE ES LO QUE HACE QUE EL SISTEMA SEA JUSTO
 *
 * El campo esta lleno de decorado que NO hace nada. Si una mina se parece a un
 * bidon, el jugador aprende que el juego le engana y deja de leer el campo. Por
 * eso todo lo que afecta al disparo lleva las tres marcas de docs/TRAMPAS.md §0
 * —contorno de 4 px, sin tinte de teatro y un color de acento— y ademas:
 *
 *   NARANJA `#d94f2b` = te afecta a ti o al rival en DANO.
 *   CIAN    `#4fd8ff` = DEFENSA: escudo, humo, cobertura.
 *   Lo que va en el AIRE cuelga siempre de algo —cable, paracaidas, globo—.
 *   Lo que va en el SUELO lleva reborde de tierra removida.
 *
 * Ningun decorado usa nunca esos dos colores. Basta un bidon naranja para
 * romperlo entero.
 * ────────────────────────────────────────────────────────────────────────
 */

import {
  caminoRedondeado, circulo, caja, camino, polilinea, siluetaUnica, grupo,
} from './primitivas.js';
import { claro, oscuro, contorno, mezcla } from './paleta.js';

/** Los dos acentos. Salen de `src/art/direction.js`, no se inventan aqui. */
export const ACENTO = { dano: '#d94f2b', defensa: '#4fd8ff' };
const METAL = '#6a7a82';
const GROSOR = 0.11;   // 4 px: mas gordo que cualquier decorado, a proposito

function cuerpo(formas, base, dentro = '', grosor = GROSOR) {
  return siluetaUnica({
    formas, cont: contorno(base), tonoClaro: claro(base), tonoBase: base,
    grosor, luz: [0.1, -0.14], dentro,
  });
}

/** Reborde de tierra removida: dice que la pieza esta ENTERRADA, no apoyada. */
function reborde(cx, ancho) {
  return camino(caminoRedondeado([
    [cx - ancho / 2, 0], [cx - ancho * 0.3, 0.16], [cx + ancho * 0.28, 0.13],
    [cx + ancho / 2, 0], [cx + ancho * 0.42, -0.1], [cx - ancho * 0.44, -0.1],
  ], 0.1), { fill: '#7a6a52', stroke: '#3d3527', 'stroke-width': 0.07 });
}

/** Cable del que cuelga lo que va en el aire. Sube fuera del encuadre. */
function cable(x, desde) {
  return camino(polilinea([[x, desde], [x + 0.12, desde + 3.2]]), {
    stroke: '#2a2f33', 'stroke-width': 0.06, fill: 'none',
  });
}

/** Paracaidas: casquete, ocho cuerdas y la carga colgando. */
function paracaidas(x, y, r, base) {
  let s = '';
  for (let i = 0; i < 7; i++) {
    const u = -1 + (2 * i) / 6;
    s += camino(polilinea([[x + u * r * 0.92, y + r * 0.55], [x, y - 0.1]]), {
      stroke: '#2a2f33', 'stroke-width': 0.05, fill: 'none',
    });
  }
  s += cuerpo([caminoRedondeado([
    [x - r, y + r * 0.6], [x - r * 0.72, y + r * 1.28], [x, y + r * 1.42],
    [x + r * 0.72, y + r * 1.28], [x + r, y + r * 0.6],
  ], r * 0.5)], base, [0.32, 0.66].map((k) =>
    camino(polilinea([[x - r + r * 2 * k * 0.1, y + r * (0.6 + k * 0.7)], [x - r + r * 2 * k, y + r * 1.4]]), {
      stroke: contorno(base), 'stroke-width': 0.05, fill: 'none',
    })).join(''));
  return s;
}

// ── los nueve ─────────────────────────────────────────────────────────────

/** Carga hueca: cono invertido colgado. La punta abajo dice «perfora». */
function cargaHueca(x, y) {
  const A = ACENTO.dano;
  let s = paracaidas(x, y + 1.5, 0.7, METAL);
  s += cuerpo([
    caminoRedondeado([[x - 0.34, y + 1.5], [x + 0.34, y + 1.5], [x + 0.26, y + 0.62], [x - 0.26, y + 0.62]], 0.08),
    caminoRedondeado([[x - 0.26, y + 0.66], [x + 0.26, y + 0.66], [x, y - 0.02]], 0.06),
  ], A, camino(polilinea([[x - 0.34, y + 1.1], [x + 0.34, y + 1.1]]), {
    stroke: contorno(A), 'stroke-width': 0.06, fill: 'none',
  }));
  return s;
}

/** Bomba de racimo: bidon con tres submuniciones asomando por la panza abierta. */
function racimo(x, y) {
  const A = ACENTO.dano;
  let s = cable(x, y + 1.6);
  s += cuerpo([caminoRedondeado([
    [x - 0.42, y + 0.5], [x + 0.42, y + 0.5], [x + 0.42, y + 1.6], [x - 0.42, y + 1.6],
  ], 0.3)], A, [0.85, 1.25].map((k) =>
    camino(polilinea([[x - 0.42, y + k], [x + 0.42, y + k]]), { stroke: contorno(A), 'stroke-width': 0.07, fill: 'none' })).join(''));
  for (const d of [-0.3, 0, 0.3]) {
    s += cuerpo([caminoRedondeado([
      [x + d - 0.11, y + 0.52], [x + d + 0.11, y + 0.52], [x + d + 0.09, y + 0.06], [x + d - 0.09, y + 0.06],
    ], 0.07)], METAL, '', 0.08);
  }
  return s;
}

/** Espoleta de proximidad: anillo con la antena en cruz. No lleva carga. */
function proximidad(x, y) {
  const A = ACENTO.dano;
  let s = cable(x, y + 1.5);
  s += cuerpo([
    caminoRedondeado([[x - 0.5, y + 0.62], [x + 0.5, y + 0.62], [x + 0.5, y + 1.5], [x - 0.5, y + 1.5]], 0.42),
  ], METAL);
  s += cuerpo([circulo(x, y + 1.06, 0.28, 18)], A);
  for (const [dx, dy] of [[-0.86, 0.34], [0.86, 0.34], [-0.7, -0.5], [0.7, -0.5]]) {
    s += camino(polilinea([[x + dx * 0.3, y + 1.06 + dy * 0.3], [x + dx, y + 1.06 + dy]]), {
      stroke: contorno(A), 'stroke-width': 0.07, fill: 'none', 'stroke-linecap': 'round',
    });
  }
  return s;
}

/** Bote de fosforo: defensivo. Cortina de humo, no dano. */
function fosforo(x, y) {
  const D = ACENTO.defensa;
  let s = cable(x, y + 1.55);
  s += cuerpo([caminoRedondeado([
    [x - 0.3, y + 0.35], [x + 0.3, y + 0.35], [x + 0.3, y + 1.55], [x - 0.3, y + 1.55],
  ], 0.22)], D, [0.7, 1.15].map((k) =>
    camino(polilinea([[x - 0.3, y + k], [x + 0.3, y + k]]), { stroke: contorno(D), 'stroke-width': 0.06, fill: 'none' })).join(''));
  // el humo que promete: tres bultos sin contorno, del propio acento aclarado
  for (const [dx, dy, r] of [[-0.55, 0.5, 0.34], [0.5, 0.78, 0.28], [-0.16, 1.0, 0.24]]) {
    s += camino(circulo(x + dx, y + dy, r), { fill: claro(D), opacity: 0.5 });
  }
  return s;
}

/** Globo de barrera: el castigo del arco alto. Si lo tocas, pierdes el tiro. */
function globo(x, y) {
  const A = ACENTO.dano;
  let s = camino(polilinea([[x + 0.1, y + 0.4], [x - 0.1, y - 1.4]]), {
    stroke: '#2a2f33', 'stroke-width': 0.06, fill: 'none',
  });
  s += cuerpo([
    caminoRedondeado([[x - 0.95, y + 1.5], [x + 0.72, y + 1.62], [x + 1.05, y + 1.1],
      [x + 0.72, y + 0.58], [x - 0.95, y + 0.7]], 0.55),
    caminoRedondeado([[x + 0.92, y + 1.42], [x + 1.34, y + 1.62], [x + 1.34, y + 0.62], [x + 0.92, y + 0.82]], 0.12),
  ], METAL, camino(polilinea([[x - 0.9, y + 1.1], [x + 0.95, y + 1.1]]), {
    stroke: contorno(METAL), 'stroke-width': 0.06, fill: 'none',
  }));
  s += camino(circulo(x - 0.42, y + 1.12, 0.2), { fill: A });
  return s;
}

/** Mina de fosforo: disco enterrado con el pulsador en cruz. */
function mina(x) {
  const A = ACENTO.dano;
  let s = reborde(x, 2.3);
  s += cuerpo([
    caminoRedondeado([[x - 0.78, 0.04], [x + 0.78, 0.04], [x + 0.7, 0.5], [x - 0.7, 0.5]], 0.18),
    caminoRedondeado([[x - 0.38, 0.46], [x + 0.38, 0.46], [x + 0.38, 0.66], [x - 0.38, 0.66]], 0.12),
  ], METAL, camino(polilinea([[x - 0.75, 0.26], [x + 0.75, 0.26]]), {
    stroke: contorno(METAL), 'stroke-width': 0.06, fill: 'none',
  }));
  s += cuerpo([
    caja(x - 0.3, 0.64, 0.6, 0.16, 0.06), caja(x - 0.09, 0.56, 0.18, 0.33, 0.06),
  ], A, '', 0.09);
  // asa plegada a un lado: la asimetria que la hace objeto y no icono
  s += cuerpo([caminoRedondeado([[x + 0.64, 0.14], [x + 1.06, 0.24], [x + 1.04, 0.38], [x + 0.64, 0.3]], 0.06)], METAL, '', 0.08);
  return s;
}

/** Deposito de combustible: bidones con el rotulo. Deja fuego en el terreno. */
function combustible(x) {
  const A = ACENTO.dano;
  let s = reborde(x, 2.2);
  for (const [dx, h] of [[-0.42, 1.05], [0.44, 0.9]]) {
    s += cuerpo([caminoRedondeado([
      [x + dx - 0.34, 0.02], [x + dx + 0.34, 0.02], [x + dx + 0.34, h], [x + dx - 0.34, h],
    ], 0.16)], A, [0.3, 0.7].map((k) =>
      camino(polilinea([[x + dx - 0.34, h * k], [x + dx + 0.34, h * k]]), {
        stroke: contorno(A), 'stroke-width': 0.07, fill: 'none',
      })).join(''));
  }
  return s;
}

/** Placa de blindaje: defensiva. Se recoge cayendo cerca. */
function blindaje(x) {
  const D = ACENTO.defensa;
  let s = reborde(x, 1.9);
  s += cuerpo([
    caminoRedondeado([[x - 0.62, 0.02], [x + 0.62, 0.02], [x + 0.5, 1.28], [x - 0.5, 1.28]], 0.14),
  ], D, camino(polilinea([[x - 0.56, 0.65], [x + 0.56, 0.65]]), {
    stroke: contorno(D), 'stroke-width': 0.07, fill: 'none',
  }) + camino(caminoRedondeado([[x - 0.3, 0.28], [x + 0.3, 0.28], [x + 0.24, 1.0], [x - 0.24, 1.0]], 0.12), {
    fill: claro(D),
  }));
  // puntal trasero: sin el, la placa se lee tumbada
  s += cuerpo([caminoRedondeado([[x + 0.42, 0.06], [x + 0.98, 0.02], [x + 1.0, 0.18], [x + 0.46, 0.3]], 0.07)], METAL, '', 0.09);
  return s;
}

/** Nido de municion: recarga. Cajas con la cinta de acento. */
function municion(x) {
  const A = ACENTO.dano;
  let s = reborde(x, 2.1);
  const c = '#6f6a4e';
  s += cuerpo([caja(x - 0.82, 0.02, 0.86, 0.54, 0.07)], c, '', 0.09);
  s += cuerpo([caja(x + 0.02, 0.02, 0.78, 0.46, 0.07)], c, '', 0.09);
  s += cuerpo([caja(x - 0.54, 0.56, 0.82, 0.5, 0.07)], c, '', 0.09);
  for (const [bx, by, bw] of [[-0.82, 0.24, 0.86], [-0.54, 0.78, 0.82]]) {
    s += camino(caja(x + bx, by, bw, 0.1, 0.03), { fill: A });
  }
  return s;
}

// ── el catalogo ───────────────────────────────────────────────────────────

export const MODIFICADORES = [
  {
    id: 'carga', nombre: 'Carga hueca', donde: 'aire', clase: 'dano', dibujar: cargaHueca,
    efecto: 'x1,8 de dano en el impacto',
    como: 'El proyectil la atraviesa y se lleva la carga pegada. Es el modificador mas simple y el que ensena el sistema: pasas por ella y pegas mas.',
    riesgo: 'Cuelga en la parte alta del arco, donde tira el que va perdiendo. Si sale siempre en el mismo sitio, deja de ser una decision.',
  },
  {
    id: 'racimo', nombre: 'Bomba de racimo', donde: 'aire', clase: 'dano', dibujar: racimo,
    efecto: 'El disparo se parte en tres',
    como: 'Los tres siguen trayectorias con dispersion SEMBRADA, no aleatoria: los seis moviles tienen que ver los mismos tres impactos.',
    riesgo: 'Tres proyectiles reparten dano en area y castigan al que no se ha movido. Contra un blanco atrincherado puede ser peor que el disparo entero.',
  },
  {
    id: 'proximidad', nombre: 'Espoleta de proximidad', donde: 'aire', clase: 'dano', dibujar: proximidad,
    efecto: 'Revienta en el aire sobre el blanco',
    como: 'Deja de necesitar tocar el suelo: estalla al pasar sobre el rival. Ignora el parapeto de sacos y el labio de la trinchera.',
    riesgo: 'Es la respuesta al atrincherado, y por eso hay que vigilarla: si aparece cada dos turnos, cavar deja de servir para nada.',
  },
  {
    id: 'fosforo', nombre: 'Bote de fosforo', donde: 'aire', clase: 'defensa', dibujar: fosforo,
    efecto: 'Cortina de humo en tu mitad',
    como: 'El unico del aire que no hace dano. El rival dispara a ciegas el turno siguiente: se le oculta el arco de puntería, no el blindado.',
    riesgo: 'Ocultar informacion al rival es lo mas facil de hacer injusto. Un turno, y que se vea claramente de quien es el humo.',
  },
  {
    id: 'globo', nombre: 'Globo de barrera', donde: 'aire', clase: 'dano', dibujar: globo,
    efecto: 'Si lo tocas, pierdes el tiro',
    como: 'No es un premio: es el castigo del arco alto. Obliga a elegir entre la trayectoria comoda y la que esquiva.',
    riesgo: 'Perder el turno entero es duro. Tiene que verse desde el plano de otear y no aparecer nunca detras del hito.',
  },
  {
    id: 'mina', nombre: 'Mina de fosforo', donde: 'suelo', clase: 'dano', dibujar: mina,
    efecto: 'Crater y dano al doble',
    como: 'Cae tu disparo encima o cerca y detona con el. Es la trampa que convierte un tiro corto en un buen tiro.',
    riesgo: 'Se ve, y eso es a proposito: esquivarla es la decision, encontrarla no es el juego.',
  },
  {
    id: 'combustible', nombre: 'Deposito de combustible', donde: 'suelo', clase: 'dano', dibujar: combustible,
    efecto: 'Fuego en el terreno, dos turnos',
    como: 'El fuego dana a quien acabe el turno dentro. Es el unico modificador que sigue actuando cuando ya te has movido.',
    riesgo: 'Un area negada dos turnos en un campo de 38 u es mucho campo. O dura menos, o el area es pequena.',
  },
  {
    id: 'blindaje', nombre: 'Placa de blindaje', donde: 'suelo', clase: 'defensa', dibujar: blindaje,
    efecto: 'Escudo: absorbe el proximo impacto',
    como: 'No se dispara: se RECOGE avanzando hasta ella. Es lo que engancha el sistema con la mecanica de avanzar, que hoy solo sirve para colocarse.',
    riesgo: 'Un escudo que absorbe entero un impacto puede alargar la partida sin aportar. Empezar por absorber la mitad y medir.',
  },
  {
    id: 'municion', nombre: 'Nido de municion', donde: 'suelo', clase: 'dano', dibujar: municion,
    efecto: 'Un disparo extra este turno',
    como: 'Tambien se recoge avanzando. Dos disparos seguidos es la jugada mas fuerte del juego, y por eso solo hay uno por partida.',
    riesgo: 'Encadenado con la carga hueca son dos tiros al doble. Hay que probar si eso es emocionante o si decide la partida sola.',
  },
];
