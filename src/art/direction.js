/**
 * Direccion de arte, tal cual la plancha de lookdev.
 * Todo valor de color, luz o material sale de aqui. Nada de literales sueltos
 * repartidos por la escena.
 *
 * TEMA: duelo de artilleria de la Primera y la Segunda Guerra Mundial, contado
 * con la simpleza de un juguete de escritorio. Volumenes chatos, biseles
 * gordos, cero reflejo especular y silueta por encima del detalle: lo que se
 * lee en un movil a un palmo de la cara es la FORMA, no los remaches.
 *
 * Realismo hasta donde ayuda: las paletas salen de frentes reales y cada
 * teatro trae la epoca que le toca. Y se para donde estorba: dos blindados
 * historicos de verdad serian dos manchas verde-gris indistinguibles en
 * pantalla, asi que la identidad de bando la lleva una banda de reconocimiento
 * saturada. Los ejercitos de verdad tambien pintaban bandas para no dispararse
 * entre ellos; aqui es lo mismo, un poco mas chillon.
 */

// --- Luz (plancha 01, seccion 01) --------------------------------------
// El relleno y el rebote suben mucho respecto al primer montaje (0,34 y 0,42).
// Con aquello, todo lo que no daba la key caia a un gris sucio y el juego se
// veia sombrio y sin sitio. Los dos juegos de referencia no tienen ni una sola
// zona apagada: la sombra ahi es MAS FRIA, no mas oscura. Eso es lo que hacen
// estos numeros.
export const LIGHT = {
  keyColor: 0xffe9bd,        // key calida 5200 K
  keyIntensity: 2.4,
  keyAzimuthDeg: -45,        // desde la izquierda
  keyElevationDeg: 48,
  fillColor: 0x86a8cc,       // relleno frio
  fillIntensity: 0.5,
  bounceSky: 0xa8c8e6,       // hemisferica: cielo frio
  bounceIntensity: 0.85,     // el suelo lo pone el teatro
  exposicion: 1.06,          // un pelo por encima de 1: el mediotono sube
  shadowOpacityHint: 0.3,
  shadowRadius: 5,
};

// --- Materiales (plancha 01, seccion 02) --------------------------------
// metalness 0 en todo, como pide el brief. El "metal" se lee por rugosidad.
// Un blindado de verdad esta pintado con mate antirreflejo: la falta de
// especular no es una renuncia tecnica, es lo que hacian.
export const MATERIALS = {
  // M01/M02: la masa del vehiculo. Caqui contra gris de campaña, los dos
  // desaturados a proposito para que la banda de reconocimiento cante.
  chassisA: { color: 0x79803c, roughness: 0.66, metalness: 0.0 }, // caqui aliado
  chassisB: { color: 0x55666f, roughness: 0.66, metalness: 0.0 }, // gris de campaña
  // M03: optica. Uso escaso, solo para un specular puntual en el periscopio.
  gloss:    { color: 0x54718c, roughness: 0.16, metalness: 0.0 },
  // M04: acero pintado del tubo y los herrajes.
  metal:    { color: 0x8e8a7c, roughness: 0.34, metalness: 0.0 },
  // M05: oruga. Ancla el valor oscuro en la base y separa el casco del suelo.
  rubber:   { color: 0x2e3238, roughness: 0.9,  metalness: 0.0 },
  // M06: lona, sacos terreros y cajas. Lo que rompe la silueta de metal.
  lona:     { color: 0xb0a173, roughness: 0.94, metalness: 0.0 },
  // M07: hormigon de bunker y dientes de dragon.
  hormigon: { color: 0x9d9a90, roughness: 0.92, metalness: 0.0 },
};

// Banda de reconocimiento. NO es historicamente exacta en el tono; es lo que
// hace que a 4 cm de alto en pantalla sepas de quien es el tanque antes de
// leer el HUD. Todo lo demas del vehiculo puede ser fiel; esto no.
export const BANDA = {
  a: { color: 0xe4572e, roughness: 0.55, metalness: 0.0 },
  b: { color: 0x2fb8d9, roughness: 0.55, metalness: 0.0 },
};

// Bisel de referencia a 1080 px de ancho: 10-12 px. A 30 unidades de mundo
// visibles, 1 unidad = 36 px, asi que el bisel vive en ~0.30 unidades.
export const BEVEL = 0.3;

// --- Acentos (plancha 02, seccion 05) -----------------------------------
// Los dos colores de trazadora que se usaban de verdad: la aliada ardia en
// ambar y la alemana en blanco-azul. Que ademas sean complementarios entre si
// es la casualidad que hace que este juego funcione.
export const ACCENT = {
  trazadora: { hex: 0xff7a1a, css: '#FF7A1A' },  // trazadora ambar
  fosforo:   { hex: 0x4fd8ff, css: '#4FD8FF' },  // trazadora blanco-azul
};

// Anillo oscuro obligatorio del proyectil: separa por valor aunque falle el tono.
export const PROJECTILE_RIM = '#0A0D14';

// --- Epocas -------------------------------------------------------------
// El teatro decide con que se combate. No es decoracion: cambia la silueta del
// vehiculo entero, que es lo primero que ve el jugador al cargar la partida.
export const GRAN_GUERRA = 1916;
export const SEGUNDA = 1942;

// --- Teatros (plancha 02, seccion 04) -----------------------------------
// `projectile` sale de la regla cruzada: el teatro calido dispara la trazadora
// fria y al reves. El acento que sobra se queda en el HUD.
export const BIOMES = {
  somme: {
    id: 'somme',
    name: 'El Somme',
    year: 1916,
    era: GRAN_GUERRA,
    // Creta removida bajo cielo cerrado. Es el campo mas claro que hay: la
    // tiza del Somme salia blanca de las trincheras y se veia desde el aire.
    crest: 0xf3efe0,
    body: 0xcfc6ac,
    deep: 0x9c9078,
    bounceGround: 0xd6ccb2,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#7c93b4', '#9db4ce', '#c4d3e0', '#e8edf0'],
  },
  flandes: {
    id: 'flandes',
    name: 'Flandes',
    year: 1917,
    era: GRAN_GUERRA,
    // Barro y niebla de cloro. El verde amarillento no es un capricho de
    // paleta: es el color con el que se describia el gas en los partes.
    crest: 0xc2ce72,
    body: 0x8c9b47,
    deep: 0x5f6b34,
    bounceGround: 0x93a24c,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#5e7a46', '#88a055', '#bcc66b', '#e4e39a'],
  },
  alamein: {
    id: 'alamein',
    name: 'El Alamein',
    year: 1942,
    era: SEGUNDA,
    // Desierto occidental al amanecer, que es cuando se atacaba: el sol bajo
    // por detras te dejaba en silueta y te delataba.
    crest: 0xfbe1a0,
    body: 0xe8a94e,
    deep: 0xb87438,
    bounceGround: 0xe0a755,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#2e7fb8', '#5fa9d6', '#9fcde6', '#f2dfae'],
  },
  rzhev: {
    id: 'rzhev',
    name: 'Frente del Este',
    year: 1942,
    era: SEGUNDA,
    // Nieve batida sobre el Volga. Campo frio y claro: la trazadora ambar es
    // lo unico calido en pantalla y por eso no se pierde nunca.
    crest: 0xfbfdff,
    body: 0xc6dcee,
    deep: 0x8aa8c4,
    bounceGround: 0xc2d8ea,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#3c6fa8', '#6e9bc8', '#a8c6e0', '#dce9f2'],
  },
  stalingrado: {
    id: 'stalingrado',
    name: 'Stalingrado',
    year: 1942,
    era: SEGUNDA,
    // Escombro de hormigon bajo una ciudad ardiendo. El campo mas oscuro del
    // juego: el proyectil va en blanco-azul para que no se confunda con el
    // rescoldo del horizonte.
    crest: 0xb9b0a6,
    body: 0x8a8078,
    deep: 0x5d554f,
    bounceGround: 0x8b7a6a,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#5a2418', '#963a1e', '#d9722c', '#f5b45c'],
  },
  ardenas: {
    id: 'ardenas',
    name: 'Las Ardenas',
    year: 1944,
    era: SEGUNDA,
    // Diciembre, de noche y con niebla. El cielo no aclara por abajo: es el
    // unico teatro donde la silueta del terreno se lee contra la nada, que es
    // justo lo que hizo posible la ofensiva.
    crest: 0xe4eef4,
    body: 0xa8bccb,
    deep: 0x6e8496,
    bounceGround: 0xa2b6c6,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#2a3e5c', '#4e6b8e', '#84a3be', '#c6d6e0'],
  },
};

/** Color del proyectil del teatro activo, segun la regla cruzada. */
export function projectileAccent(biome) {
  return ACCENT[biome.projectile];
}

/** Color del HUD del teatro activo. */
export function uiAccent(biome) {
  return ACCENT[biome.ui];
}

/** ¿Este teatro combate con blindados de la Gran Guerra? */
export function esGranGuerra(biome) {
  return biome.era === GRAN_GUERRA;
}
