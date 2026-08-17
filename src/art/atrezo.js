import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Lo que hace que el campo sea un SITIO y no un perfil de ruido.
 *
 * Sacos terreros, alambrada, tocones astillados, bidones, cajas de municion —
 * y un hito grande por teatro: la torre de una iglesia rota en el Somme, la
 * chimenea de la fabrica en Stalingrado, la isba en el frente del Este. Sin
 * esto el juego se ve limpio y vacio: la paleta puede ser perfecta, pero un
 * cerro pelado no cuenta que hay una guerra.
 *
 * Es decorado puro. No estorba al proyectil, no colisiona y no entra en la
 * simulacion; sale del `rng` con semilla, asi que los seis moviles ven el
 * mismo campo sin mandar nada por el cable.
 *
 * COSTE: cada pieza acaba en UNA malla con color por vertice, no en un grupo
 * de cajas con su material cada una. Veinte piezas de cinco cajas serian cien
 * llamadas de dibujo y ahi se va el presupuesto de cuadro entero; asi son
 * veinte, y todas comparten material.
 */

const CAJA = new THREE.BoxGeometry(1, 1, 1);
const CILINDRO = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CONO = new THREE.ConeGeometry(0.5, 1, 9);

const material = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });

/** Añade una pieza ya transformada y con su color cocido en los vertices. */
function trozo(lista, base, color, { x = 0, y = 0, z = 0, rz = 0, ry = 0, sx = 1, sy = 1, sz = 1 }) {
  const g = base.clone();
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    ),
  );
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color.r;
    c[i * 3 + 1] = color.g;
    c[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  lista.push(g);
}

// ─────────────────────────────────────────────────────────── piezas sueltas

/** Parapeto de sacos terreros. Lo que dice "aqui hay alguien atrincherado". */
function sacos(lista, tonos, rng, largo = 5) {
  const filas = 3;
  for (let f = 0; f < filas; f++) {
    const n = largo - f;
    for (let i = 0; i < n; i++) {
      // Cada saco se tuerce un poco: una hilera perfecta parece un muro de
      // ladrillo, y un saco terrero nunca queda recto.
      trozo(lista, CAJA, f % 2 ? tonos.saco : tonos.sacoOscuro, {
        x: (i - (n - 1) / 2) * 0.62 + (rng() - 0.5) * 0.1,
        y: 0.19 + f * 0.32,
        rz: (rng() - 0.5) * 0.22,
        sx: 0.58,
        sy: 0.3,
        sz: 0.46,
      });
    }
  }
}

/** Piquetes de alambrada con dos vueltas de alambre. */
function alambrada(lista, tonos, rng, postes = 4) {
  for (let i = 0; i < postes; i++) {
    const x = (i - (postes - 1) / 2) * 1.5;
    trozo(lista, CILINDRO, tonos.metal, {
      x,
      y: 0.55,
      rz: (rng() - 0.5) * 0.3,
      sx: 0.1,
      sy: 1.1,
      sz: 0.1,
    });
  }
  for (const altura of [0.5, 0.9]) {
    trozo(lista, CAJA, tonos.metal, {
      y: altura,
      rz: (rng() - 0.5) * 0.08,
      sx: (postes - 1) * 1.5,
      sy: 0.05,
      sz: 0.05,
    });
  }
}

/** Tocon astillado: lo que queda de un arbol despues de un bombardeo. */
function tocon(lista, tonos, rng, alto = 2.4) {
  trozo(lista, CILINDRO, tonos.madera, { y: alto / 2, sx: 0.42, sy: alto, sz: 0.42 });
  // Astillas: es lo que lo separa de un poste. Un tronco cortado limpio no
  // cuenta nada; uno reventado cuenta lo que ha pasado aqui.
  for (let i = 0; i < 3; i++) {
    trozo(lista, CONO, tonos.maderaClara, {
      x: (rng() - 0.5) * 0.4,
      y: alto + 0.3 + rng() * 0.35,
      z: (rng() - 0.5) * 0.4,
      rz: (rng() - 0.5) * 0.7,
      sx: 0.16,
      sy: 0.6 + rng() * 0.5,
      sz: 0.16,
    });
  }
}

/** Abeto cargado de nieve. */
function abeto(lista, tonos, rng, alto = 3.4) {
  trozo(lista, CILINDRO, tonos.madera, { y: 0.45, sx: 0.22, sy: 0.9, sz: 0.22 });
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    trozo(lista, CONO, tonos.follaje, {
      y: 0.9 + t * alto * 0.62 + alto * 0.22,
      sx: 1.5 - t * 0.55,
      sy: alto * 0.5,
      sz: 1.5 - t * 0.55,
    });
  }
  if (tonos.nieve) {
    trozo(lista, CONO, tonos.nieve, {
      y: 0.9 + alto * 0.84,
      sx: 0.62,
      sy: alto * 0.22,
      sz: 0.62,
    });
  }
  void rng;
}

/** Bidon de combustible tumbado o de pie. */
function bidon(lista, tonos, rng) {
  const tumbado = rng() < 0.5;
  trozo(lista, CILINDRO, tonos.metalPintado, {
    y: tumbado ? 0.36 : 0.55,
    rz: tumbado ? Math.PI / 2 : 0,
    sx: 0.7,
    sy: 1.1,
    sz: 0.7,
  });
}

/** Cajas de municion apiladas. */
function cajas(lista, tonos, rng) {
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    trozo(lista, CAJA, i % 2 ? tonos.madera : tonos.maderaClara, {
      x: (rng() - 0.5) * 0.5,
      y: 0.22 + i * 0.42,
      rz: (rng() - 0.5) * 0.18,
      sx: 0.9,
      sy: 0.4,
      sz: 0.62,
    });
  }
}

// ─────────────────────────────────────────────────────────────────── hitos

/** Torre de iglesia partida por la mitad. El hito del Somme. */
function torre(lista, tonos, rng) {
  trozo(lista, CAJA, tonos.piedra, { y: 3.2, sx: 2.1, sy: 6.4, sz: 2.1 });
  // Rota en diagonal arriba: una torre entera parece un edificio; una rota
  // parece que ha pasado la artilleria por aqui.
  trozo(lista, CAJA, tonos.piedraClara, { x: -0.5, y: 6.9, rz: 0.34, sx: 1.5, sy: 1.4, sz: 2.05 });
  for (const y of [2.4, 4.6]) {
    trozo(lista, CAJA, tonos.hueco, { x: 0, y, z: 1.02, sx: 0.55, sy: 1.2, sz: 0.14 });
  }
  void rng;
}

/** Chimenea de fabrica. El hito de Stalingrado. */
function chimenea(lista, tonos, rng) {
  trozo(lista, CILINDRO, tonos.piedra, { y: 4.4, sx: 1.5, sy: 8.8, sz: 1.5 });
  trozo(lista, CILINDRO, tonos.piedraClara, { y: 8.9, rz: 0.16, sx: 1.6, sy: 0.9, sz: 1.6 });
  void rng;
}

/** Casa baja con el tejado hundido. Sirve de adobe o de isba. */
function casa(lista, tonos, rng) {
  trozo(lista, CAJA, tonos.piedra, { y: 1.1, sx: 4.2, sy: 2.2, sz: 2.6 });
  trozo(lista, CAJA, tonos.madera, { x: -0.6, y: 2.5, rz: -0.22, sx: 3.4, sy: 0.36, sz: 2.8 });
  if (tonos.nieve) {
    trozo(lista, CAJA, tonos.nieve, { x: -0.6, y: 2.76, rz: -0.22, sx: 3.5, sy: 0.18, sz: 2.9 });
  }
  trozo(lista, CAJA, tonos.hueco, { x: 1.1, y: 0.85, z: 1.32, sx: 0.7, sy: 1.1, sz: 0.12 });
  void rng;
}

// ──────────────────────────────────────────────────────────────── teatros

const REPERTORIO = {
  somme: { sueltas: [sacos, alambrada, tocon, cajas], hito: torre },
  flandes: { sueltas: [sacos, alambrada, tocon, tocon, bidon], hito: tocon },
  alamein: { sueltas: [sacos, cajas, bidon, alambrada], hito: casa },
  rzhev: { sueltas: [sacos, abeto, cajas, abeto], hito: casa },
  stalingrado: { sueltas: [cajas, bidon, alambrada, sacos], hito: chimenea },
  ardenas: { sueltas: [abeto, abeto, sacos, cajas], hito: casa },
};

/**
 * Los tonos del atrezo salen del propio teatro.
 *
 * Un saco terrero beige sobre la nieve del Volga canta como un pegote. Aqui
 * cada material se tiñe hacia el color del terreno del teatro, asi que el
 * decorado pertenece al sitio en vez de estar puesto encima.
 */
function tonosDe(biome) {
  const cuerpo = new THREE.Color(biome.body);
  const cresta = new THREE.Color(biome.crest);
  const hondo = new THREE.Color(biome.deep);
  const frio = biome.id === 'rzhev' || biome.id === 'ardenas';

  const mezcla = (base, hacia, k) => new THREE.Color(base).lerp(new THREE.Color(hacia), k);

  return {
    saco: mezcla(0xb8a878, cuerpo, 0.45),
    sacoOscuro: mezcla(0x8d7f56, cuerpo, 0.45),
    madera: mezcla(0x6b4f33, hondo, 0.35),
    maderaClara: mezcla(0x9c7749, cuerpo, 0.3),
    metal: mezcla(0x55585e, hondo, 0.3),
    metalPintado: mezcla(0x6e7548, cuerpo, 0.25),
    piedra: mezcla(0xa9a297, cuerpo, 0.4),
    piedraClara: mezcla(0xcfc8bb, cresta, 0.4),
    follaje: mezcla(0x3d5c39, hondo, 0.3),
    hueco: new THREE.Color(0x121418),
    nieve: frio ? cresta.clone() : null,
  };
}

/**
 * @param {object} opciones
 * @param {() => number} opciones.rng  con semilla
 * @param {(x:number) => number} opciones.alturaEn  altura del terreno
 */
export function crearAtrezo({ rng, biome, alturaEn, anchoMundo = 140, separacionCanones = 88 }) {
  const repertorio = REPERTORIO[biome.id] ?? REPERTORIO.somme;
  const tonos = tonosDe(biome);
  const compartido = material();

  const grupo = new THREE.Group();
  grupo.name = 'atrezo';
  const piezas = [];

  const plantar = (constructor, x, escala = 1) => {
    const lista = [];
    constructor(lista, tonos, rng);
    if (!lista.length) return;
    const geo = mergeGeometries(lista, false);
    for (const g of lista) g.dispose();
    if (!geo) return;

    const malla = new THREE.Mesh(geo, compartido);
    malla.scale.setScalar(escala);
    malla.castShadow = true;
    malla.receiveShadow = true;
    // Detras del plano de vuelo: el proyectil pasa por delante de todo esto.
    malla.position.set(x, alturaEn(x), -1.1 - rng() * 1.6);
    grupo.add(malla);
    piezas.push({ malla, x });
  };

  // Un parapeto de sacos pegado a cada cañon: el puesto tiene que verse
  // preparado, no como un tanque aparcado en mitad del campo.
  const medio = separacionCanones / 2;
  plantar(sacos, -medio - 3.4, 1);
  plantar(sacos, medio + 3.4, 1);

  // Y el resto repartido por el campo, sin amontonarse.
  const limite = anchoMundo / 2 - 8;
  const ocupadas = [-medio - 3.4, medio + 3.4];
  for (let i = 0; i < 11; i++) {
    let x = 0;
    let libre = false;
    for (let intento = 0; intento < 12 && !libre; intento++) {
      x = (rng() * 2 - 1) * limite;
      libre = ocupadas.every((o) => Math.abs(o - x) > 7);
    }
    if (!libre) continue;
    ocupadas.push(x);
    const cual = repertorio.sueltas[Math.floor(rng() * repertorio.sueltas.length)];
    plantar(cual, x, 0.85 + rng() * 0.45);
  }

  // El hito: uno solo, grande, en la mitad del campo que toque. Es lo que le
  // pone nombre al sitio.
  const ladoDelHito = rng() < 0.5 ? -1 : 1;
  plantar(repertorio.hito, ladoDelHito * (14 + rng() * 16), 1);

  return {
    grupo,
    /**
     * Vuelve a apoyar el decorado sobre el terreno.
     *
     * Hace falta porque el terreno se mueve: un crater al lado de una alambrada
     * la dejaria flotando, y la arena que cae encima la enterraria a medias.
     */
    reasentar() {
      for (const p of piezas) p.malla.position.y = alturaEn(p.x);
    },
  };
}
