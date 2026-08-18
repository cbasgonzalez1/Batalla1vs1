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

// ── teatros ───────────────────────────────────────────────────────────────

/**
 * Nueve teatros, y todos son un sitio de verdad.
 *
 * La version anterior tenia seis nombres genericos y el mismo decorado en todos:
 * unos tocones y una alambrada daba igual donde estuvieras. Un teatro no es una
 * paleta, es un SITIO — y lo que lo dice no es el color del cielo, es que en
 * Normandia hay setos de bocage y erizos de playa y en Varsovia hay almiares y
 * postes de telegrafo.
 *
 * Todos son de dia y todos son claros. La primera version los pinto de noche y
 * el juego entero se veia triste: el color de un frente lo pone la tierra, no la
 * falta de luz. Stalingrado es el unico con el cielo ardiendo, porque ahi el
 * fuego ES el sitio.
 */
export const TEATROS = {
  somme: {
    agua: true,
    nombre: 'El Somme', pais: 'Francia', epoca: 1916, proyectil: 'trazadora',
    cielo: ['#8fb0c8', '#b6cedd', '#d2e1e7', '#e7ebe0'],
    cresta: '#f0ead9', cuerpo: '#cdc0a2', socavon: '#94876c',
    hito: 'iglesia',
    props: ['alambrada', 'cajas', 'poste'],
    nota: 'Creta pisoteada y craterizada. La torre de la iglesia rota es lo unico que queda en pie sobre la loma.',
  },
  passchendaele: {
    agua: true,
    nombre: 'Passchendaele', pais: 'Belgica', epoca: 1917, proyectil: 'fosforo',
    cielo: ['#7e96a6', '#a3b8c4', '#c3d2d6', '#d9ddce'],
    cresta: '#9aa05c', cuerpo: '#6e7440', socavon: '#474b2a',
    hito: 'bosque',
    props: ['tocon', 'alambrada', 'cajas', 'bidones'],
    nota: 'Barro y bosque astillado. Del hayedo solo quedan los tocones: el gigante del centro es el ultimo arbol que hubo.',
  },
  bzura: {
    nombre: 'Llanura del Bzura', pais: 'Polonia', epoca: 1939, proyectil: 'trazadora',
    cielo: ['#6e9fc4', '#9cc0d8', '#c6d9e2', '#e6e6cd'],
    cresta: '#e3ce94', cuerpo: '#bfa35f', socavon: '#87703c',
    hito: 'granero',
    props: ['almiar', 'cerca', 'poste', 'cajas'],
    nota: 'Rastrojo de septiembre. Campo abierto de verdad: almiares, una cerca de listones y el granero de madera al fondo.',
  },
  alamein: {
    nombre: 'El Alamein', pais: 'Egipto', epoca: 1942, proyectil: 'fosforo',
    cielo: ['#4f89b4', '#8cb6d0', '#c3d6dc', '#f0e2c4'],
    cresta: '#fbe1a0', cuerpo: '#e8a94e', socavon: '#b87438',
    hito: 'adobe',
    props: ['bidones', 'alambrada', 'cajas', 'erizo'],
    nota: 'Arena batida por el viento: es donde mas se nota Sotavento. La casa de adobe es la unica sombra en kilometros.',
  },
  stalingrado: {
    nombre: 'Stalingrado', pais: 'URSS', epoca: 1942, proyectil: 'fosforo',
    cielo: ['#8a6f5e', '#b8917a', '#d7b48f', '#e8cba0'],
    cresta: '#b9b0a6', cuerpo: '#8a8078', socavon: '#5d554f',
    hito: 'fabrica',
    props: ['escombro', 'via', 'bidones'],
    nota: 'La chimenea de la fabrica y la via retorcida a sus pies. El unico teatro con el cielo ardiendo.',
  },
  normandia: {
    agua: true,
    nombre: 'Normandia', pais: 'Francia', epoca: 1944, proyectil: 'trazadora',
    cielo: ['#7fa9c6', '#b1d2e1', '#c9e1eb', '#e0eadf'],
    cresta: '#b7c96f', cuerpo: '#84a048', socavon: '#556a31',
    hito: 'granja',
    props: ['seto', 'erizo', 'poste', 'cajas'],
    nota: 'Bocage: setos sobre caballon de tierra que cortan el campo en parcelas. Son la cobertura y son el problema.',
  },
  paris: {
    nombre: 'Paris', pais: 'Francia', epoca: 1944, proyectil: 'fosforo',
    cielo: ['#8aa6bc', '#b3c6d4', '#d2dce0', '#eae6d9'],
    cresta: '#e2dac6', cuerpo: '#bcb097', socavon: '#82785f',
    hito: 'haussmann',
    props: ['barricada', 'farola', 'escombro'],
    nota: 'Piedra de Paris y barricada de adoquines levantados. El unico teatro urbano de verdad.',
  },
  ardenas: {
    nombre: 'Las Ardenas', pais: 'Belgica y Alemania', epoca: 1944, proyectil: 'trazadora',
    cielo: ['#7b98ad', '#a6bfd0', '#cbdce6', '#e8eff4'],
    cresta: '#edf3f7', cuerpo: '#afc3d0', socavon: '#6e8496',
    hito: 'casa',
    props: ['abeto', 'tocon', 'cajas'],
    nota: 'Abetal bajo la nieve. La nieve es una capa encima, no un repinte: los estratos de debajo no cambian.',
  },
  seelow: {
    agua: true,
    nombre: 'Alturas de Seelow', pais: 'Alemania', epoca: 1945, proyectil: 'trazadora',
    cielo: ['#8496a0', '#aebdc0', '#cbd3cb', '#dddcc9'],
    cresta: '#c2b69c', cuerpo: '#93866b', socavon: '#63593f',
    hito: 'ladrillo',
    props: ['escombro', 'erizo', 'poste', 'bidones'],
    nota: 'Barro de abril y ladrillo aleman destripado. El ultimo teatro y el mas cerrado de los nueve.',
  },
};

/** Los que llevan manto de nieve. Es tratamiento de terreno, no piezas. */
export const NEVADOS = new Set(['ardenas']);

/** Tinte de teatro obligatorio del decorado: 0,35 hacia el cuerpo del terreno. */
export const TINTE_TEATRO = 0.35;
