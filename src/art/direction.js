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
 * teatro trae la epoca que le toca. La identidad de bando la lleva el color
 * del casco y nada mas — hubo una banda de reconocimiento saturada cruzando el
 * vehiculo y se quito porque a esta escala se leia como una pegatina puesta
 * encima. Los dos caquis estan apartados en tono y en valor para poder
 * sostenerlo solos.
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
  // M01/M02: la masa del vehiculo, y lo UNICO que distingue un bando del otro.
  //
  // Hubo una banda de reconocimiento saturada cruzando el casco y se quito: a
  // esta escala se leia como una pegatina puesta encima, no como pintura. Sin
  // ella, la separacion la tienen que dar los dos colores solos, asi que estan
  // apartados en tono Y en valor — caqui calido y claro contra gris azulado
  // frio y oscuro. Los dos siguen siendo colores de campaña de verdad; lo que
  // se ha hecho es coger los dos extremos del rango en vez de dos vecinos.
  chassisA: { color: 0x838b3a, roughness: 0.66, metalness: 0.0 }, // caqui aliado
  chassisB: { color: 0x47616f, roughness: 0.66, metalness: 0.0 }, // gris de campaña
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
/**
 * Los dieciseis teatros, y todos son una CIUDAD DESTRUIDA de verdad.
 *
 * El campo abierto con colinas se fue: la guerra que cuenta este juego se peleo
 * en calles, y una ciudad arrasada da lo que el campo no daba — un fondo con
 * silueta (el perfil de ruinas), obstaculos con forma reconocible y una excusa
 * fisica para que el suelo sea cascote.
 *
 * Un teatro no es una paleta: es un SITIO. Lo que dice donde estas es de que
 * esta hecha la ciudad (`fabrica`) y que quedo en pie (`hito`), no el color del
 * cielo. Tabla completa y motivos en `ARTE.md` §11.
 *
 * Todos son de dia y todos son claros. El color de un frente lo pone la fabrica
 * de sus casas, no la falta de luz: Stalingrado y Dresde son los unicos con el
 * cielo ardiendo, porque ahi el fuego ES el sitio.
 *
 * `props` son las familias de decorado que ESTE teatro declara, y ninguna mas.
 * Con el mismo decorado en los dieciseis serian uno repintado dieciseis veces:
 * lo que queda en pie en Berlin y en Coventry es lo mismo —muro suelto, viga
 * retorcida, escombro, coche quemado— y lo que cambia es la fabrica con la que
 * esta hecho. La tabla completa esta en `docs/ESCENARIOS.md` §3 y las piezas en
 * `src/art/decorado/piezas.js`.
 */
export const BIOMES = {
  ypres: {
    id: 'ypres',
    name: 'Ypres',
    pais: 'Belgica',
    year: 1915,
    era: GRAN_GUERRA,
    // La Lonja de los Panos en pie a medias sobre el barro. La primera ciudad que se borro del mapa a canonazos.
    fabrica: 0x9e5540,
    hito: 'lonja',
    props: ['escombro', 'muro', 'viga', 'alambrada', 'cajas'],
    crest: 0x9d9578,
    body: 0x7a7358,
    deep: 0x4f4a38,
    bounceGround: 0x888165,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#7d8f94', '#9fb0b2', '#bfcbc6', '#d5dbcb'],
  },
  verdun: {
    id: 'verdun',
    name: 'Verdun',
    pais: 'Francia',
    year: 1916,
    era: GRAN_GUERRA,
    // Creta y hormigon. De los nueve pueblos del sector no quedo ni el trazado de las calles.
    fabrica: 0x9a9a94,
    hito: 'fuerte',
    props: ['escombro', 'alambrada', 'viga', 'sacos', 'cajas'],
    crest: 0xdcd6c2,
    body: 0xb6ae97,
    deep: 0x7d766a,
    bounceGround: 0xc5bea8,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#8ea6bb', '#b3c5d1', '#d0dbdc', '#e5e6d8'],
  },
  varsovia39: {
    id: 'varsovia39',
    name: 'Varsovia',
    pais: 'Polonia',
    year: 1939,
    era: SEGUNDA,
    // Septiembre del 39. La manzana de viviendas destripada y el tranvia volcado en mitad de la calzada.
    fabrica: 0x9e5540,
    hito: 'manzana',
    props: ['escombro', 'tranvia', 'farola', 'muro', 'arbol'],
    crest: 0xc9a877,
    body: 0xa2814f,
    deep: 0x6d5636,
    bounceGround: 0xb2915f,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#5f92bb', '#8fb5cf', '#bdd2dc', '#e0d9bd'],
  },
  rotterdam: {
    id: 'rotterdam',
    name: 'Rotterdam',
    pais: 'Paises Bajos',
    year: 1940,
    era: SEGUNDA,
    // El centro entero ardio en un par de horas. Ladrillo oscuro, cielo bajo y el suelo siempre mojado.
    fabrica: 0x7d4436,
    hito: 'manzana',
    props: ['escombro', 'viga', 'coche', 'farola', 'muro'],
    crest: 0x9a8f80,
    body: 0x776d60,
    deep: 0x4b453c,
    bounceGround: 0x857b6d,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#6e8391', '#93a7ae', '#b9c8c6', '#cdd6c8'],
  },
  coventry: {
    id: 'coventry',
    name: 'Coventry',
    pais: 'Reino Unido',
    year: 1940,
    era: SEGUNDA,
    // De la catedral quedo el campanario y el perimetro. Es el hito mas alto de los dieciseis.
    fabrica: 0xbd8a5c,
    hito: 'catedral',
    props: ['escombro', 'muro', 'viga', 'coche', 'cajas'],
    crest: 0xb9ac93,
    body: 0x94886f,
    deep: 0x615948,
    bounceGround: 0xa3967d,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#8c8479', '#ab9f8f', '#c8bda8', '#ddd0b4'],
  },
  stalingrado: {
    id: 'stalingrado',
    name: 'Stalingrado',
    pais: 'URSS',
    year: 1942,
    era: SEGUNDA,
    // La fabrica y el silo. El unico teatro con el cielo ardiendo desde el primer turno.
    fabrica: 0x9a9a94,
    hito: 'fabrica',
    props: ['escombro', 'via', 'viga', 'bidones', 'sacos'],
    crest: 0xb9b0a6,
    body: 0x8a8078,
    deep: 0x5d554f,
    bounceGround: 0x9d938a,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#8a6f5e', '#b8917a', '#d7b48f', '#e8cba0'],
  },
  jarkov: {
    id: 'jarkov',
    name: 'Jarkov',
    pais: 'URSS',
    year: 1943,
    era: SEGUNDA,
    // Nieve sucia sobre el escombro. La estacion cambio de mano cuatro veces en seis meses.
    fabrica: 0xc39a63,
    hito: 'estacion',
    props: ['escombro', 'tranvia', 'viga', 'muro', 'sacos'],
    crest: 0xdfe4e4,
    body: 0xa8aca9,
    deep: 0x6d6f6b,
    bounceGround: 0xbec2c1,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#8496a8', '#adbdc7', '#cdd8dc', '#e7ecec'],
  },
  cassino: {
    id: 'cassino',
    name: 'Montecassino',
    pais: 'Italia',
    year: 1944,
    era: SEGUNDA,
    // Piedra caliza machacada hasta el polvo. La abadia es un bloque largo con el campanario en una esquina y la terraza arcada al pie: masa horizontal, no un templo con columnas.
    fabrica: 0xd8d2bd,
    hito: 'abadia',
    props: ['escombro', 'muro', 'viga', 'alambrada', 'cajas'],
    crest: 0xe7e0cb,
    body: 0xc0b69c,
    deep: 0x83795f,
    bounceGround: 0xd0c7af,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#4f86b4', '#87b0cc', '#bfd2d8', '#e8ddbe'],
  },
  caen: {
    id: 'caen',
    name: 'Caen',
    pais: 'Francia',
    year: 1944,
    era: SEGUNDA,
    // Piedra de Caen, la misma con la que se construyo media Inglaterra, hecha grava en una noche.
    fabrica: 0xb3aa98,
    hito: 'iglesia',
    props: ['escombro', 'coche', 'farola', 'muro', 'arbol'],
    crest: 0xded5bd,
    body: 0xb8ad92,
    deep: 0x7c7360,
    bounceGround: 0xc7bda3,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#7fa4c2', '#a9c6d8', '#c9dde1', '#e2e3d2'],
  },
  saintlo: {
    id: 'saintlo',
    name: 'Saint-Lo',
    pais: 'Francia',
    year: 1944,
    era: SEGUNDA,
    // La llamaron «la capital de las ruinas». No quedo una sola manzana con las cuatro paredes.
    fabrica: 0xb3aa98,
    hito: 'manzana',
    props: ['escombro', 'viga', 'muro', 'coche', 'cajas'],
    crest: 0xd4cdb9,
    body: 0xaba28c,
    deep: 0x736b58,
    bounceGround: 0xbbb39e,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#8b9aa4', '#adbbbf', '#cbd5d0', '#dfe2d4'],
  },
  varsovia44: {
    id: 'varsovia44',
    name: 'Varsovia, el Levantamiento',
    pais: 'Polonia',
    year: 1944,
    era: SEGUNDA,
    // Barricadas de adoquin levantado en cada bocacalle. Es el teatro con mas obstaculos apoyados.
    fabrica: 0x9e5540,
    hito: 'manzana',
    props: ['barricada', 'escombro', 'tranvia', 'muro', 'farola'],
    crest: 0xb5a58c,
    body: 0x8d7f68,
    deep: 0x5c5342,
    bounceGround: 0x9d8e76,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#7b8288', '#9ea5a6', '#c0c4bd', '#d6d6c6'],
  },
  arnhem: {
    id: 'arnhem',
    name: 'Arnhem',
    pais: 'Paises Bajos',
    year: 1944,
    era: SEGUNDA,
    // El puente al fondo y las villas de ladrillo alrededor. Otono: los arboles de calle todavia tienen algo de copa.
    fabrica: 0x9e5540,
    hito: 'puente',
    props: ['escombro', 'coche', 'arbol', 'muro', 'sacos'],
    crest: 0xc6ac82,
    body: 0x9c8459,
    deep: 0x68583b,
    bounceGround: 0xad9469,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#7396b5', '#a2bccd', '#c6d6d6', '#e0dcc0'],
  },
  aquisgran: {
    id: 'aquisgran',
    name: 'Aquisgran',
    pais: 'Alemania',
    year: 1944,
    era: SEGUNDA,
    // La primera ciudad alemana que cayo. Granito gris y erizos soldados en cada cruce.
    fabrica: 0x8d8f92,
    hito: 'catedral',
    props: ['escombro', 'erizo', 'viga', 'muro', 'sacos'],
    crest: 0xadaba3,
    body: 0x868580,
    deep: 0x585751,
    bounceGround: 0x96948e,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#77848c', '#9aa6a9', '#bcc5c0', '#d1d5c8'],
  },
  budapest: {
    id: 'budapest',
    name: 'Budapest',
    pais: 'Hungria',
    year: 1945,
    era: SEGUNDA,
    // Estuco ocre y balcones de hierro colgando. El asedio duro cincuenta dias dentro de la ciudad.
    fabrica: 0xc39a63,
    hito: 'manzana',
    props: ['escombro', 'tranvia', 'farola', 'muro', 'coche'],
    crest: 0xd3bb8e,
    body: 0xa89065,
    deep: 0x6f5f42,
    bounceGround: 0xb9a175,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#7e93a8', '#a6bac6', '#c8d6d3', '#e6ddc2'],
  },
  dresde: {
    id: 'dresde',
    name: 'Dresde',
    pais: 'Alemania',
    year: 1945,
    era: SEGUNDA,
    // Arenisca ennegrecida por la tormenta de fuego. El teatro mas oscuro de los dieciseis, y a proposito.
    fabrica: 0x6b625c,
    hito: 'catedral',
    props: ['escombro', 'viga', 'muro', 'arbol', 'coche'],
    crest: 0x9d9086,
    body: 0x75695f,
    deep: 0x453e38,
    bounceGround: 0x85796f,
    projectile: 'fosforo',
    ui: 'trazadora',
    sky: ['#8a7365', '#ab9180', '#c7ae94', '#ddc5a2'],
  },
  berlin: {
    id: 'berlin',
    name: 'Berlin',
    pais: 'Alemania',
    year: 1945,
    era: SEGUNDA,
    // El ultimo. Manzanas destripadas, erizos en las avenidas y escombro hasta la altura del primer piso.
    fabrica: 0x9e5540,
    hito: 'manzana',
    props: ['escombro', 'erizo', 'barricada', 'viga', 'muro'],
    crest: 0xb0a493,
    body: 0x877c6c,
    deep: 0x565044,
    bounceGround: 0x978c7c,
    projectile: 'trazadora',
    ui: 'fosforo',
    sky: ['#84868a', '#a5a6a4', '#c3c2b8', '#d8d3c0'],
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
