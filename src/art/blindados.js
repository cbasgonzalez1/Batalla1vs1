import * as THREE from 'three';
import { roundedBoxGeometry } from './geometry.js';
import { MATERIALS, BEVEL } from './direction.js';

/**
 * Los dos blindados del juego, uno por epoca.
 *
 * Se distinguen por SILUETA, no por detalle: el rombo de la Gran Guerra lleva
 * la oruga por encima del casco y no tiene torreta; el de la Segunda es un
 * casco bajo con torreta giratoria y tubo largo. A 4 cm de alto en un movil
 * eso es lo unico que llega, y llega antes que cualquier remache.
 *
 * ────────────────────────────────────────────────────────────────────────
 * REGLA QUE NO SE TOCA
 *
 * Los dos modelos cuelgan el pivote de elevacion en `PIVOTE` y la boca en
 * `BOCA`, exactamente en el mismo sitio local. El arte NO puede mover la boca:
 * de ahi sale la velocidad inicial del proyectil, y dos jugadores en teatros
 * distintos —el teatro va en la URL de cada uno, no por el cable— simularian
 * trayectorias distintas y la partida se desincronizaria sin que nadie
 * entendiera por que. Hay un test que lo vigila.
 * ────────────────────────────────────────────────────────────────────────
 */

/** Pivote de elevacion, local al grupo del vehiculo. */
export const PIVOTE = Object.freeze({ x: -0.1, y: 1.45 });

/** Boca del arma, local al pivote. De aqui sale el proyectil. */
export const BOCA = Object.freeze({ x: 2.25, y: 0.06 });

/**
 * @param {object} opciones
 * @param {object} opciones.chassis  material de casco del bando. Es lo unico
 *   que distingue un bando de otro: no hay banda de reconocimiento.
 * @param {boolean} opciones.granGuerra
 * @returns {{casco: THREE.Group, arma: THREE.Group}} el arma va sin colocar:
 *   quien la monte la cuelga del pivote.
 */
export function construirBlindado({ chassis, granGuerra }) {
  const mats = crearMateriales(chassis);
  return granGuerra ? rombo(mats) : torreta(mats);
}

function crearMateriales(chassis) {
  return {
    casco: new THREE.MeshStandardMaterial({ ...chassis }),
    oruga: new THREE.MeshStandardMaterial({ ...MATERIALS.rubber }),
    acero: new THREE.MeshStandardMaterial({ ...MATERIALS.metal }),
    optica: new THREE.MeshStandardMaterial({ ...MATERIALS.gloss }),
    lona: new THREE.MeshStandardMaterial({ ...MATERIALS.lona }),
  };
}

/** Cuelga una malla de un grupo con sombras ya puestas. */
function pieza(grupo, geo, mat, x, y, z, rot = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.z = rot;
  m.castShadow = true;
  m.receiveShadow = true;
  grupo.add(m);
  return m;
}

// ───────────────────────────────────────── Segunda Guerra: casco y torreta

function torreta(mats) {
  const casco = new THREE.Group();

  // Orugas con ruedas de rodadura a la vista. Las ruedas son lo que separa
  // "tanque" de "caja con ruedas": son cinco cilindros y se leen enseguida.
  for (const z of [0.68, -0.68]) {
    pieza(casco, roundedBoxGeometry(2.9, 0.62, 0.42, 0.24, 4), mats.oruga, 0, 0.31, z);
  }
  const rueda = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 12);
  rueda.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const x = -1.1 + i * 0.55;
    for (const z of [0.9, -0.9]) pieza(casco, rueda, mats.acero, x, 0.31, z);
  }
  // Rueda motriz mas grande delante: rompe la repeticion y marca el frente.
  const motriz = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  motriz.rotateX(Math.PI / 2);
  for (const z of [0.9, -0.9]) pieza(casco, motriz, mats.acero, 1.35, 0.34, z);

  // Casco. El 60% de la silueta.
  pieza(casco, roundedBoxGeometry(2.45, 0.78, 1.55, BEVEL, 5), mats.casco, -0.05, 0.95, 0);

  // Glacis inclinado: la placa frontal a 40 grados. Es LA lectura de un
  // blindado de la Segunda —el blindaje inclinado se invento entonces— y
  // ademas le da al frente un plano que recoge la key de lleno.
  pieza(
    casco,
    roundedBoxGeometry(0.95, 0.62, 1.5, 0.14, 4),
    mats.casco,
    1.32,
    0.9,
    0,
    -40 * (Math.PI / 180),
  );

  // Guardabarros: una lamina fina sobre la oruga, que corta la silueta.
  for (const z of [0.9, -0.9]) {
    pieza(casco, roundedBoxGeometry(2.6, 0.1, 0.34, 0.05, 3), mats.casco, -0.05, 0.66, z);
  }

  // Impedimenta: una caja de lona atada atras. Un tanque limpio parece un
  // juguete sin usar; con el petate encima parece que viene de algun sitio.
  pieza(casco, roundedBoxGeometry(0.6, 0.36, 0.9, 0.12, 4), mats.lona, -1.15, 1.45, 0);

  // --- arma: torreta + tubo, todo colgando del pivote de elevacion
  const arma = new THREE.Group();

  const cupula = new THREE.Mesh(roundedBoxGeometry(1.15, 0.6, 1.1, 0.24, 5), mats.casco);
  cupula.castShadow = true;
  cupula.receiveShadow = true;
  arma.add(cupula);

  // Escotilla del comandante: el detalle que da escala al conjunto.
  const escotilla = new THREE.CylinderGeometry(0.24, 0.26, 0.16, 14);
  pieza(arma, escotilla, mats.casco, -0.2, 0.36, 0);

  // Periscopio (M03 brillo): unico specular puntual de todo el vehiculo.
  pieza(arma, roundedBoxGeometry(0.22, 0.16, 0.4, 0.06, 3), mats.optica, 0.22, 0.42, 0);

  // Mantelete: el bloque donde entra el tubo. Es contra esto contra lo que
  // retrocede el canon, asi que tiene que verse antes de que retroceda.
  const mantelete = new THREE.CylinderGeometry(0.3, 0.3, 0.42, 16);
  mantelete.rotateZ(-Math.PI / 2);
  pieza(arma, mantelete, mats.acero, 0.68, 0.06, 0);

  // Tubo largo. Va aparte del resto para que el retroceso lo deslice solo.
  const tubo = new THREE.Group();
  tubo.name = 'tubo';
  arma.add(tubo);

  const canonGeo = new THREE.CylinderGeometry(0.15, 0.18, 1.5, 18);
  canonGeo.rotateZ(-Math.PI / 2);
  pieza(tubo, canonGeo, mats.acero, 1.42, 0.06, 0);

  // Freno de boca de dos bocas: la firma visual del calibre largo.
  pieza(tubo, roundedBoxGeometry(0.34, 0.34, 0.5, 0.08, 3), mats.acero, 2.12, 0.06, 0);

  return { casco, arma, tubo, retroceso: 0.35 };
}

// ───────────────────────────────────── Gran Guerra: rombo con oruga arriba

/**
 * El perfil de rombo del Mark IV.
 *
 * La oruga sube por delante en una curva enorme porque asi es como cruzaba una
 * trinchera de tres metros. Es el unico vehiculo de la historia con esa
 * silueta y por eso basta el contorno para saber en que guerra estas.
 */
function perfilRombo() {
  // Trazado a rectas, no a curvas. Con bezier el contorno salia redondeado y
  // se leia como una pastilla; el rombo del Mark IV es una figura ANGULOSA con
  // el morro alto y afilado y la cola caida. Esa asimetria es toda la lectura.
  const s = new THREE.Shape();
  s.moveTo(2.28, 1.32);   // punta del morro, alta y adelantada
  s.lineTo(1.72, 2.06);   // sube recto hasta el techo
  s.lineTo(-0.5, 2.16);   // techo, con caida hacia atras
  s.lineTo(-1.72, 1.72);
  s.lineTo(-2.16, 0.9);   // cola, mas baja que el morro
  s.lineTo(-1.9, 0.16);
  s.lineTo(-1.15, 0.0);
  s.lineTo(1.2, 0.0);
  s.lineTo(2.08, 0.5);
  s.closePath();
  return s;
}

/**
 * El borde interior de la banda de oruga: el mismo contorno metido 0,24.
 *
 * La banda tiene que ser ESTRECHA. Con la primera version, metida medio metro,
 * la cadena se comia la plancha entera y el vehiculo se leia como un neumatico
 * negro con un parche verde dentro.
 */
function huecoRombo() {
  const h = new THREE.Path();
  h.moveTo(2.02, 1.3);
  h.lineTo(1.55, 1.84);
  h.lineTo(-0.48, 1.92);
  h.lineTo(-1.52, 1.54);
  h.lineTo(-1.9, 0.92);
  h.lineTo(-1.68, 0.34);
  h.lineTo(-1.05, 0.22);
  h.lineTo(1.12, 0.22);
  h.lineTo(1.85, 0.6);
  h.closePath();
  return h;
}

function rombo(mats) {
  const casco = new THREE.Group();

  // El costado ES el rombo: en un Mark IV la plancha lateral tiene esa forma y
  // la cadena corre por su borde. Dibujarlo como un aro hueco —que fue el
  // primer intento— lo convertia en un donut y se perdia la lectura.
  const placaGeo = new THREE.ExtrudeGeometry(perfilRombo(), {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 1,
  });

  // La cadena: el mismo contorno menos el mismo contorno encogido. Va por
  // fuera de la plancha y sobresale, que es como se ve de verdad.
  const orlaRombo = perfilRombo();
  orlaRombo.holes.push(huecoRombo());
  const cadenaGeo = new THREE.ExtrudeGeometry(orlaRombo, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 1,
  });

  for (const lado of [1, -1]) {
    pieza(casco, placaGeo, mats.casco, 0, 0, lado > 0 ? 0.72 : -0.96);
    pieza(casco, cadenaGeo, mats.oruga, 0, 0, lado > 0 ? 0.96 : -1.26);
  }

  // Cuerpo entre las dos planchas: cierra el volumen y da la sombra propia.
  pieza(casco, roundedBoxGeometry(3.2, 1.7, 1.4, BEVEL, 5), mats.casco, -0.05, 1.05, 0);

  // Cabina del conductor, asomando por el techo. Pequeña a proposito: en un
  // vehiculo cuya lectura entera es el contorno, cualquier bulto claro encima
  // compite con el rombo y lo estropea.
  pieza(casco, roundedBoxGeometry(0.8, 0.42, 0.9, 0.1, 4), mats.casco, 0.42, 2.3, 0);
  pieza(casco, roundedBoxGeometry(0.14, 0.2, 0.46, 0.04, 3), mats.optica, 0.8, 2.32, 0);

  // Silenciador tumbado en el techo: la tuberia gorda que llevaban encima.
  const escape = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 10);
  escape.rotateZ(Math.PI / 2);
  pieza(casco, escape, mats.acero, -0.85, 2.28, 0);

  // --- arma: la barbeta lateral. No hay torreta; el canon iba en un saliente
  // que SOBRESALIA del bastidor de oruga, y por eso se ve entero desde este
  // lado. Va en acero y no en el color del casco para que no compita con el
  // contorno, que es lo unico que hay que leer aqui.
  const arma = new THREE.Group();
  const zBarbeta = 1.42;

  const barbeta = new THREE.Mesh(roundedBoxGeometry(0.95, 0.72, 0.56, 0.16, 4), mats.acero);
  barbeta.position.set(0.05, -0.22, zBarbeta);
  barbeta.castShadow = true;
  barbeta.receiveShadow = true;
  arma.add(barbeta);

  const escudo = new THREE.CylinderGeometry(0.3, 0.3, 0.26, 12);
  escudo.rotateZ(-Math.PI / 2);
  pieza(arma, escudo, mats.acero, 0.6, 0.06, zBarbeta);

  // Tubo corto y gordo: el 6 libras de la Gran Guerra era una pieza naval de
  // via corta, nada que ver con el canon largo de 1942. Se nota en la silueta.
  const tuboArma = new THREE.Group();
  tuboArma.name = 'tubo';
  arma.add(tuboArma);

  const canonGeo = new THREE.CylinderGeometry(0.17, 0.21, 1.35, 16);
  canonGeo.rotateZ(-Math.PI / 2);
  pieza(tuboArma, canonGeo, mats.acero, 1.48, 0.06, zBarbeta);
  const bocacha = new THREE.CylinderGeometry(0.25, 0.21, 0.24, 16);
  bocacha.rotateZ(-Math.PI / 2);
  pieza(tuboArma, bocacha, mats.acero, 2.16, 0.06, zBarbeta);

  // Retroceso mas corto: pieza mas pequeña, freno hidraulico mas basto.
  return { casco, arma, tubo: tuboArma, retroceso: 0.26 };
}
