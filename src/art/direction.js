/**
 * Direccion de arte, tal cual la plancha de lookdev.
 * Todo valor de color, luz o material sale de aqui. Nada de literales sueltos
 * repartidos por la escena.
 */

// --- Luz (plancha 01, seccion 01) --------------------------------------
export const LIGHT = {
  keyColor: 0xffe3a8,        // key calida 5200 K
  keyIntensity: 2.35,
  keyAzimuthDeg: -45,        // desde la izquierda
  keyElevationDeg: 48,
  fillColor: 0x6e8fb8,       // relleno frio
  fillIntensity: 0.34,
  bounceSky: 0x8fb4d8,       // hemisferica: cielo frio
  bounceIntensity: 0.42,     // el suelo lo pone el bioma
  shadowOpacityHint: 0.3,
  shadowRadius: 5,
};

// --- Materiales (plancha 01, seccion 02) --------------------------------
// metalness 0 en todo, como pide el brief. El "metal" se lee por rugosidad.
export const MATERIALS = {
  chassisA: { color: 0xf2622f, roughness: 0.62, metalness: 0.0 }, // M01 plastico mate
  chassisB: { color: 0x17b6e0, roughness: 0.62, metalness: 0.0 }, // M02 plastico mate
  gloss:    { color: 0x54718c, roughness: 0.16, metalness: 0.0 }, // M03 plastico brillo
  metal:    { color: 0x8e8a7c, roughness: 0.34, metalness: 0.0 }, // M04 metal pintado
  rubber:   { color: 0x343a42, roughness: 0.9,  metalness: 0.0 }, // M05 goma mate
};

// Bisel de referencia a 1080 px de ancho: 10-12 px. A 30 unidades de mundo
// visibles, 1 unidad = 36 px, asi que el bisel vive en ~0.30 unidades.
export const BEVEL = 0.3;

// --- Acentos (plancha 02, seccion 05) -----------------------------------
export const ACCENT = {
  magma:  { hex: 0xff6b2c, css: '#FF6B2C' },
  plasma: { hex: 0x16e0ff, css: '#16E0FF' },
};

// Anillo oscuro obligatorio del proyectil: separa por valor aunque falle el tono.
export const PROJECTILE_RIM = '#0A0D14';

// --- Biomas (plancha 02, seccion 04) ------------------------------------
// `projectile` sale de la regla cruzada: el bioma calido dispara plasma,
// los frios y verdes disparan magma. El otro acento se queda en el HUD.
export const BIOMES = {
  dunas: {
    id: 'dunas',
    name: 'Dunas de Kerch',
    crest: 0xf2c97d,
    body: 0xd9974a,
    deep: 0x8a5326,
    bounceGround: 0xc08a4a,
    projectile: 'plasma',
    ui: 'magma',
    sky: ['#241c2e', '#4d3448', '#9c5c4e', '#e39a63'],
  },
  placa: {
    id: 'placa',
    name: 'Placa Vostok',
    crest: 0xdceef7,
    body: 0x9fc6de,
    deep: 0x4e7793,
    bounceGround: 0x9ec4dc,
    projectile: 'magma',
    ui: 'plasma',
    sky: ['#101a2a', '#22405c', '#4c7d9e', '#9fc9dd'],
  },
  salar: {
    id: 'salar',
    name: 'Salar de Aral',
    // El mundo mas claro: costra de sal casi blanca. Obliga a que el proyectil
    // sea magma, porque el plasma se perderia sobre tanto valor alto.
    crest: 0xeef2f3,
    body: 0xc3ced6,
    deep: 0x7d8b98,
    bounceGround: 0xc9d2d8,
    projectile: 'magma',
    ui: 'plasma',
    sky: ['#1b2338', '#3a4a6b', '#8390a8', '#cfc2c4'],
  },
  caldera: {
    id: 'caldera',
    name: 'Caldera Ignea',
    // Basalto apagado bajo un cielo de noche volcanica. El proyectil va en
    // plasma para que no se confunda con el rescoldo del horizonte.
    crest: 0x6b6a72,
    body: 0x40404a,
    deep: 0x22222a,
    bounceGround: 0x4a3a38,
    projectile: 'plasma',
    ui: 'magma',
    sky: ['#0d0a0e', '#241419', '#48222a', '#8a4030'],
  },
  tranquilidad: {
    id: 'tranquilidad',
    name: 'Mar de la Tranquilidad',
    // Sin atmosfera: el cielo no degrada a claro por abajo, se queda negro. Es
    // el unico bioma donde la silueta del terreno se lee contra la nada.
    crest: 0x9aa3ad,
    body: 0x69727e,
    deep: 0x39404a,
    bounceGround: 0x6e7783,
    projectile: 'magma',
    ui: 'plasma',
    sky: ['#04050a', '#080c14', '#0f151f', '#1b2431'],
  },
  selva: {
    id: 'selva',
    name: 'Selva de Ceniza',
    crest: 0x7fb04a,
    body: 0x4e7a34,
    deep: 0x2e4327,
    bounceGround: 0x5c8a3c,
    projectile: 'magma',
    ui: 'plasma',
    sky: ['#141a1c', '#26383a', '#4a6355', '#8aa276'],
  },
};

/** Color del proyectil del bioma activo, segun la regla cruzada. */
export function projectileAccent(biome) {
  return ACCENT[biome.projectile];
}

/** Color del HUD del bioma activo. */
export function uiAccent(biome) {
  return ACCENT[biome.ui];
}
