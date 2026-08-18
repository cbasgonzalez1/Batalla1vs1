/**
 * Paleta de las planchas de diseno.
 *
 * Los hex de aqui son los MEDIDOS sobre la imagen de referencia aprobada, no
 * estimados: casco #7D8B4E, contorno #2B3419, oruga #4A4A42. Lo que se escribe
 * en el codigo del juego es el FACTOR de `tono()`, nunca el hex — asi cambiar
 * el color de un bando no obliga a recalcular a mano cinco derivados.
 *
 * Fuente de verdad: ARTE.md §2 y docs/ARTE-VEHICULOS.md §12.
 */

// ── conversion de color ───────────────────────────────────────────────────

function hexARgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbAHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbAHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslARgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [canal(h + 1 / 3) * 255, canal(h) * 255, canal(h - 1 / 3) * 255];
}

/**
 * Aclara (f > 0) u oscurece (f < 0) en HSL, nunca en RGB: en RGB oscurecer un
 * verde oliva lo manda al marron y los quince vehiculos dejarian de ser familia.
 */
export function tono(base, f) {
  const [r, g, b] = hexARgb(base);
  const [h, s, l] = rgbAHsl(r, g, b);
  const l2 = f >= 0 ? l + f * (1 - l) : l * (1 + f);
  return rgbAHex(...hslARgb(h, s, Math.max(0, Math.min(1, l2))));
}

/** Mezcla lineal en RGB. Solo para perspectiva aerea, donde SI es lo correcto. */
export function mezcla(a, b, t) {
  const A = hexARgb(a), B = hexARgb(b);
  return rgbAHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export const claro = (c) => tono(c, 0.18);
export const camuflaje = (c) => tono(c, -0.13);
export const oscuro = (c) => tono(c, -0.24);
export const contorno = (c) => tono(c, -0.65);

// ── bandos ────────────────────────────────────────────────────────────────

/**
 * Un solo color base por bando. Todo lo demas se calcula, asi que un bando no
 * puede salir con el contorno del otro y anadir un tercero es una linea.
 * Prohibido distinguir bandos con banda, estrella, cruz o bandera.
 */
export const BANDOS = {
  A: { base: '#7d8b4e', nombre: 'Oliva' },
  B: { base: '#5c7d92', nombre: 'Acero' },
};

// ── materia, que no se tine del bando ─────────────────────────────────────

/**
 * Oruga, neumatico y buje mantienen su color en los dos bandos. Es lo que evita
 * que el vehiculo se lea como una figura recortada de un solo color.
 */
export const CAUCHO = {
  banda: '#292a24',   // la cinta de oruga, medida entre dos ruedas
  base: '#4a4a42',    // flanco del neumatico
  llanta: '#5e5e54',
  buje: '#4a4a42',
  contorno: '#1e2118',
};

export const MATERIA = {
  madera: '#b07f43',
  metal: '#6a7a82',
  lona: '#8a7a52',
  hormigon: '#9d9a90',
  acento: '#d94f2b',
};

// ── mamposteria ───────────────────────────────────────────────────────────

/**
 * De que esta hecha la ciudad. Es lo que mas la distingue de la de al lado:
 * Varsovia es ladrillo, Caen es piedra caliza y Dresde es arenisca ennegrecida.
 * De aqui salen el color del hito, el del perfil de ruinas del fondo y el del
 * escombro, y por eso las tres cosas pertenecen al mismo sitio.
 */
export const FABRICA = {
  ladrillo: '#9e5540',
  ladrilloOscuro: '#7d4436',
  piedra: '#b3aa98',
  creta: '#d8d2bd',
  hormigon: '#9a9a94',
  granito: '#8d8f92',
  estuco: '#c39a63',
  arenisca: '#bd8a5c',
  quemada: '#6b625c',
};

// ── teatros ───────────────────────────────────────────────────────────────

/**
 * Dieciseis teatros, y todos son una CIUDAD DESTRUIDA de verdad.
 *
 * El campo abierto con colinas se ha ido: la guerra que cuenta este juego se
 * peleo en calles, y una ciudad arrasada da lo que el campo no daba — un fondo
 * con silueta (el perfil de ruinas), obstaculos con forma reconocible y una
 * excusa fisica para que el suelo sea cascote y no cesped.
 *
 * Todos son de dia y todos son claros. El color de un frente lo pone la fabrica
 * de sus casas, no la falta de luz: Stalingrado y Dresde son los unicos con el
 * cielo ardiendo, porque ahi el fuego ES el sitio.
 */
export const TEATROS = {
  ypres: {
    nombre: 'Ypres', pais: 'Belgica', epoca: 1915, proyectil: 'trazadora',
    cielo: ['#7d8f94', '#9fb0b2', '#bfcbc6', '#d5dbcb'],
    cresta: '#9d9578', cuerpo: '#7a7358', socavon: '#4f4a38',
    fabrica: 'ladrillo', hito: 'lonja', agua: true,
    props: ['escombro', 'muro', 'viga', 'alambrada', 'cajas'],
    nota: 'La Lonja de los Panos en pie a medias sobre el barro. La primera ciudad que se borro del mapa a canonazos.',
  },
  verdun: {
    nombre: 'Verdun', pais: 'Francia', epoca: 1916, proyectil: 'trazadora',
    cielo: ['#8ea6bb', '#b3c5d1', '#d0dbdc', '#e5e6d8'],
    cresta: '#dcd6c2', cuerpo: '#b6ae97', socavon: '#7d766a',
    fabrica: 'hormigon', hito: 'fuerte', agua: true,
    props: ['escombro', 'alambrada', 'viga', 'sacos', 'cajas'],
    nota: 'Creta y hormigon. De los nueve pueblos del sector no quedo ni el trazado de las calles.',
  },
  varsovia39: {
    nombre: 'Varsovia', pais: 'Polonia', epoca: 1939, proyectil: 'trazadora',
    cielo: ['#5f92bb', '#8fb5cf', '#bdd2dc', '#e0d9bd'],
    cresta: '#c9a877', cuerpo: '#a2814f', socavon: '#6d5636',
    fabrica: 'ladrillo', hito: 'manzana',
    props: ['escombro', 'tranvia', 'farola', 'muro', 'arbol'],
    nota: 'Septiembre del 39. La manzana de viviendas destripada y el tranvia volcado en mitad de la calzada.',
  },
  rotterdam: {
    nombre: 'Rotterdam', pais: 'Paises Bajos', epoca: 1940, proyectil: 'fosforo',
    cielo: ['#6e8391', '#93a7ae', '#b9c8c6', '#cdd6c8'],
    cresta: '#9a8f80', cuerpo: '#776d60', socavon: '#4b453c',
    fabrica: 'ladrilloOscuro', hito: 'manzana', agua: true,
    props: ['escombro', 'viga', 'coche', 'farola', 'muro'],
    nota: 'El centro entero ardio en un par de horas. Ladrillo oscuro, cielo bajo y el suelo siempre mojado.',
  },
  coventry: {
    nombre: 'Coventry', pais: 'Reino Unido', epoca: 1940, proyectil: 'fosforo',
    cielo: ['#8c8479', '#ab9f8f', '#c8bda8', '#ddd0b4'],
    cresta: '#b9ac93', cuerpo: '#94886f', socavon: '#615948',
    fabrica: 'arenisca', hito: 'catedral',
    props: ['escombro', 'muro', 'viga', 'coche', 'cajas'],
    nota: 'De la catedral quedo el campanario y el perimetro. Es el hito mas alto de los dieciseis.',
  },
  stalingrado: {
    nombre: 'Stalingrado', pais: 'URSS', epoca: 1942, proyectil: 'fosforo',
    cielo: ['#8a6f5e', '#b8917a', '#d7b48f', '#e8cba0'],
    cresta: '#b9b0a6', cuerpo: '#8a8078', socavon: '#5d554f',
    fabrica: 'hormigon', hito: 'fabrica',
    props: ['escombro', 'via', 'viga', 'bidones', 'sacos'],
    nota: 'La fabrica y el silo. El unico teatro con el cielo ardiendo desde el primer turno.',
  },
  jarkov: {
    nombre: 'Jarkov', pais: 'URSS', epoca: 1943, proyectil: 'trazadora',
    cielo: ['#8496a8', '#adbdc7', '#cdd8dc', '#e7ecec'],
    cresta: '#dfe4e4', cuerpo: '#a8aca9', socavon: '#6d6f6b',
    fabrica: 'estuco', hito: 'estacion', nieve: true,
    props: ['escombro', 'tranvia', 'viga', 'muro', 'sacos'],
    nota: 'Nieve sucia sobre el escombro. La estacion cambio de mano cuatro veces en seis meses.',
  },
  cassino: {
    nombre: 'Montecassino', pais: 'Italia', epoca: 1944, proyectil: 'fosforo',
    cielo: ['#4f86b4', '#87b0cc', '#bfd2d8', '#e8ddbe'],
    cresta: '#e7e0cb', cuerpo: '#c0b69c', socavon: '#83795f',
    fabrica: 'creta', hito: 'abadia',
    props: ['escombro', 'muro', 'viga', 'alambrada', 'cajas'],
    nota: 'Piedra caliza machacada hasta el polvo. La abadia es un bloque largo con el campanario en una esquina y la terraza arcada al pie: masa horizontal, no un templo con columnas.',
  },
  caen: {
    nombre: 'Caen', pais: 'Francia', epoca: 1944, proyectil: 'trazadora',
    cielo: ['#7fa4c2', '#a9c6d8', '#c9dde1', '#e2e3d2'],
    cresta: '#ded5bd', cuerpo: '#b8ad92', socavon: '#7c7360',
    fabrica: 'piedra', hito: 'iglesia',
    props: ['escombro', 'coche', 'farola', 'muro', 'arbol'],
    nota: 'Piedra de Caen, la misma con la que se construyo media Inglaterra, hecha grava en una noche.',
  },
  saintlo: {
    nombre: 'Saint-Lo', pais: 'Francia', epoca: 1944, proyectil: 'trazadora',
    cielo: ['#8b9aa4', '#adbbbf', '#cbd5d0', '#dfe2d4'],
    cresta: '#d4cdb9', cuerpo: '#ab a2 8c'.replace(/ /g, ''), socavon: '#736b58',
    fabrica: 'piedra', hito: 'manzana',
    props: ['escombro', 'viga', 'muro', 'coche', 'cajas'],
    nota: 'La llamaron «la capital de las ruinas». No quedo una sola manzana con las cuatro paredes.',
  },
  varsovia44: {
    nombre: 'Varsovia, el Levantamiento', pais: 'Polonia', epoca: 1944, proyectil: 'fosforo',
    cielo: ['#7b8288', '#9ea5a6', '#c0c4bd', '#d6d6c6'],
    cresta: '#b5a58c', cuerpo: '#8d7f68', socavon: '#5c5342',
    fabrica: 'ladrillo', hito: 'manzana',
    props: ['barricada', 'escombro', 'tranvia', 'muro', 'farola'],
    nota: 'Barricadas de adoquin levantado en cada bocacalle. Es el teatro con mas obstaculos apoyados.',
  },
  arnhem: {
    nombre: 'Arnhem', pais: 'Paises Bajos', epoca: 1944, proyectil: 'trazadora',
    cielo: ['#7396b5', '#a2bccd', '#c6d6d6', '#e0dcc0'],
    cresta: '#c6ac82', cuerpo: '#9c8459', socavon: '#68583b',
    fabrica: 'ladrillo', hito: 'puente',
    props: ['escombro', 'coche', 'arbol', 'muro', 'sacos'],
    nota: 'El puente al fondo y las villas de ladrillo alrededor. Otono: los arboles de calle todavia tienen algo de copa.',
  },
  aquisgran: {
    nombre: 'Aquisgran', pais: 'Alemania', epoca: 1944, proyectil: 'fosforo',
    cielo: ['#77848c', '#9aa6a9', '#bcc5c0', '#d1d5c8'],
    cresta: '#adaba3', cuerpo: '#868580', socavon: '#585751',
    fabrica: 'granito', hito: 'catedral',
    props: ['escombro', 'erizo', 'viga', 'muro', 'sacos'],
    nota: 'La primera ciudad alemana que cayo. Granito gris y erizos soldados en cada cruce.',
  },
  budapest: {
    nombre: 'Budapest', pais: 'Hungria', epoca: 1945, proyectil: 'trazadora',
    cielo: ['#7e93a8', '#a6bac6', '#c8d6d3', '#e6ddc2'],
    cresta: '#d3bb8e', cuerpo: '#a89065', socavon: '#6f5f42',
    fabrica: 'estuco', hito: 'manzana',
    props: ['escombro', 'tranvia', 'farola', 'muro', 'coche'],
    nota: 'Estuco ocre y balcones de hierro colgando. El asedio duro cincuenta dias dentro de la ciudad.',
  },
  dresde: {
    nombre: 'Dresde', pais: 'Alemania', epoca: 1945, proyectil: 'fosforo',
    cielo: ['#8a7365', '#ab9180', '#c7ae94', '#ddc5a2'],
    cresta: '#9d9086', cuerpo: '#75695f', socavon: '#453e38',
    fabrica: 'quemada', hito: 'catedral',
    props: ['escombro', 'viga', 'muro', 'arbol', 'coche'],
    nota: 'Arenisca ennegrecida por la tormenta de fuego. El teatro mas oscuro de los dieciseis, y a proposito.',
  },
  berlin: {
    nombre: 'Berlin', pais: 'Alemania', epoca: 1945, proyectil: 'trazadora',
    cielo: ['#84868a', '#a5a6a4', '#c3c2b8', '#d8d3c0'],
    cresta: '#b0a493', cuerpo: '#877c6c', socavon: '#565044',
    fabrica: 'ladrillo', hito: 'manzana',
    props: ['escombro', 'erizo', 'barricada', 'viga', 'muro'],
    nota: 'El ultimo. Manzanas destripadas, erizos en las avenidas y escombro hasta la altura del primer piso.',
  },
};

/** Los que llevan manto de nieve. Es tratamiento de terreno, no piezas. */
export const NEVADOS = new Set(['jarkov']);

/** Tinte de teatro obligatorio del decorado: 0,35 hacia el cuerpo del terreno. */
export const TINTE_TEATRO = 0.35;
