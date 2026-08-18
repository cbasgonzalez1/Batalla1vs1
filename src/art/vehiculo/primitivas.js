import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundedBoxGeometry } from '../geometry.js';
import { claro, oscuro, contorno } from './paleta.js';

/**
 * Las piezas con las que se construye un vehiculo, y NADA MAS.
 *
 * Una ficha de `fichas/` no modela geometria a pelo: si una forma no encaja
 * aqui, se anade la primitiva, no la forma (docs/ARTE-VEHICULOS.md §2). Es lo
 * que hace que los quince parezcan del mismo juego sin que nadie lo vigile.
 *
 * Convenio: el vehiculo mira a +X, el suelo es y = 0 y el ancho de via va en Z.
 * Todo en unidades de PLANCHA; la escala a unidades de juego la aplica
 * `ensamblar.js` una sola vez, al grupo entero.
 *
 * Todas devuelven `BufferGeometry` ya colocada, con el color de relleno y el de
 * contorno metidos por vertice. Asi `ensamblar` puede FUSIONAR todo un bloque en
 * una sola geometria y gastar una llamada de dibujo en vez de veinte (§7).
 */

/** Ancho de via. 2,4 u en los quince: de perfil no se ve y variarlo descuadra
 *  la sombra de contacto (CATALOGO §1). */
export const VIA = 2.4;

/** Bisel de arista. Cero esquinas vivas, `ARTE.md` §1.5. */
export const BISEL = 0.045;

const nC = new THREE.Color();

/**
 * Marca una geometria con su color. El relleno guarda `claro(base)` porque la
 * rampa toon MULTIPLICA y toma la banda clara como 1 (ver `toon.js`).
 */
export function pintar(geo, base, aclarar = true) {
  const n = geo.attributes.position.count;
  const relleno = new Float32Array(n * 3);
  const borde = new Float32Array(n * 3);
  // `setHex` ya pasa de sRGB al espacio de trabajo. Llamando ademas a
  // `convertSRGBToLinear()` se convierte DOS VECES y el vehiculo entero sale
  // apagado y sucio — que es exactamente como se veia.
  // La rampa toma la banda clara como 1, asi que lo que se guarda es
  // `claro(base)`. Una pieza que YA es un tono —el faldon del sobrepatin, la
  // cinta— se guarda tal cual: aclararla otra vez la devolveria al color del
  // casco y la banda oscura desapareceria.
  nC.setHex(aclarar ? claro(base) : base);
  const [r1, g1, b1] = [nC.r, nC.g, nC.b];
  nC.setHex(contorno(base));
  const [r2, g2, b2] = [nC.r, nC.g, nC.b];
  for (let i = 0; i < n; i++) {
    relleno[i * 3] = r1; relleno[i * 3 + 1] = g1; relleno[i * 3 + 2] = b1;
    borde[i * 3] = r2; borde[i * 3 + 1] = g2; borde[i * 3 + 2] = b2;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(relleno, 3));
  geo.setAttribute('contorno', new THREE.BufferAttribute(borde, 3));
  return geo;
}


/**
 * Pinta con DOS tonos partiendo por una altura: claro arriba, oscuro debajo.
 *
 * Es la banda oscura de barcaza, y es obligatoria: sin ella el casco parece
 * flotar sobre las ruedas (docs/ARTE-VEHICULOS.md §4.6). El borde superior cae
 * exactamente en la costura, no cerca — desfasados se ven dos lineas paralelas
 * y el casco parece mal montado (§12, «tres tonos, recortados»).
 */
export function pintarPorAltura(geo, base, costura) {
  pintar(geo, base);
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  nC.setHex(oscuro(base));
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) <= costura) col.setXYZ(i, nC.r, nC.g, nC.b);
  }
  col.needsUpdate = true;
  return geo;
}
/**
 * Fusiona un bloque en una geometria. Un bloque = una llamada de dibujo.
 *
 * Se pasa todo a no indexado antes: `ExtrudeGeometry` sale sin indice y
 * `CylinderGeometry` con el, y `mergeGeometries` exige que TODAS coincidan o
 * devuelve null sin decir por que.
 */
export function fusionar(piezas) {
  const limpias = piezas.filter(Boolean).map((g) => {
    const sinIndice = g.index ? g.toNonIndexed() : g;
    // el uv de la extrusion estorba: si una pieza lo trae y otra no, tampoco funde
    for (const attr of Object.keys(sinIndice.attributes)) {
      if (attr !== 'position' && attr !== 'normal') sinIndice.deleteAttribute(attr);
    }
    return sinIndice;
  });
  return limpias.length === 1 ? limpias[0] : mergeGeometries(limpias, false);
}

// ── perfiles de casco ─────────────────────────────────────────────────────
// El vehiculo mira a la DERECHA: ahi va el glacis y de ahi sale el tubo. Con el
// morro a la izquierda se lee marcha atras aunque cada pieza este bien.

export const PERFILES = {
  /** Panza redondeada con meseta central. Es el perfil de la referencia. */
  panza(L, h, y0, { m0 = -0.22, m1 = 0.16, alza = 0.46 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.02, y0 + h * 0.62], [x0 + L * 0.08, y0 + h],
      [m0 * L - L * 0.08, y0 + h], [m0 * L, y0 + h + alza],
      [m1 * L, y0 + h + alza], [m1 * L + L * 0.07, y0 + h],
      [x1 - L * 0.1, y0 + h], [x1, y0 + h * 0.5], [x1, y0 + 0.08],
    ];
  },
  /** Caja de flancos rectos, frontal poco inclinado a la derecha. */
  caja(L, h, y0, { incl = 0.11 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.08], [x0 + L * 0.02, y0 + h], [x1 - L * incl, y0 + h],
      [x1, y0 + h * 0.42], [x1, y0 + 0.08],
    ];
  },
  /** Cuna: una sola superficie inclinada del techo al morro. La mas baja. */
  cuna(L, h, y0, { techo = 0.36 } = {}) {
    const x0 = -L / 2, x1 = L / 2;
    return [
      [x0, y0 + 0.06], [x0 + L * 0.02, y0 + h], [x1 - L * techo, y0 + h],
      [x1 - L * 0.02, y0 + h * 0.26], [x1, y0 + 0.06],
    ];
  },
};

/** Poligono cerrado con las esquinas redondeadas, como `THREE.Shape`. */
export function contornoRedondeado(pts, r = 0.12) {
  const s = new THREE.Shape();
  const N = pts.length;
  const punto = (i) => pts[(i + N) % N];
  for (let i = 0; i < N; i++) {
    const p0 = punto(i - 1), p1 = punto(i), p2 = punto(i + 1);
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1) || 1, l2 = Math.hypot(...v2) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + (v1[0] / l1) * rr, p1[1] + (v1[1] / l1) * rr];
    const b = [p1[0] + (v2[0] / l2) * rr, p1[1] + (v2[1] / l2) * rr];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

/** Poligono cerrado sin redondear, para caminos que ya vienen muestreados. */
export function contornoLlano(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Extruye un perfil en Z, centrado, con bisel. Es como se hace todo casco. */
export function extruir(shape, ancho = VIA, bisel = BISEL) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: ancho - bisel * 2,
    bevelEnabled: true,
    bevelThickness: bisel,
    bevelSize: bisel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(ancho - bisel * 2) / 2);
  return geo;
}

// ── piezas ────────────────────────────────────────────────────────────────

/** Casco: la extrusion del perfil. El 60 % de la silueta. */
export const casco = (pts, { ancho = VIA, r = 0.07 } = {}) =>
  extruir(contornoRedondeado(pts, r), ancho);

/**
 * Bulto del techo: escotilla, cofre o cupula. Crece del borde superior y
 * comparte contorno con el casco, nunca se pega encima (§12.1).
 */
export function bulto(x, y, w, h, ancho = VIA * 0.8) {
  const geo = roundedBoxGeometry(w, h, ancho, Math.min(0.09, h / 2.2), 3);
  geo.translate(x + w / 2, y + h / 2, 0);
  return geo;
}

/**
 * Faldon del sobrepatin: la banda oscura entre el casco y el tren de rodaje.
 *
 * Va como PIEZA y no como color por vertice. El color por vertice interpola
 * entre anillos de la extrusion, asi que pintando el casco por altura sale un
 * degradado — y `ARTE.md` §1.6 prohibe los degradados. Modelada, el borde es
 * duro y cae exactamente en la costura.
 *
 * Sobresale un pelo en Z para que su canto se vea contra el flanco del casco.
 */
export function faldon(L, y0, costura, ancho = VIA + 0.04) {
  const geo = roundedBoxGeometry(L, costura - y0 + 0.1, ancho, 0.05, 3);
  geo.translate(0, y0 + (costura - y0 + 0.1) / 2 - 0.1, 0);
  return geo;
}

/** Torreta. `redonda` es una capsula de perfil; `cuadrada`, una caja biselada. */
export function torreta({ tipo, cx, base, r, alto }, ancho = VIA * 0.78) {
  const pts = tipo === 'conica'
    ? [[cx - r, base], [cx + r, base], [cx + r * 0.66, base + alto], [cx - r * 0.66, base + alto]]
    : [[cx - r, base], [cx + r, base], [cx + r * 0.94, base + alto], [cx - r * 0.94, base + alto]];
  const redondeo = tipo === 'redonda' ? alto * 0.22 : 0.11;
  return extruir(contornoRedondeado(pts, redondeo), ancho);
}

/**
 * Mantelete: la union torreta-tubo. NUNCA ausente — un tubo saliendo de una
 * ranura limpia es la marca de un modelo sin acabar (§9).
 */
export function mantelete(x, y, r, ancho = VIA * 0.5) {
  const geo = new THREE.CylinderGeometry(r, r, ancho, 18);
  geo.rotateX(Math.PI / 2);
  geo.translate(x, y, 0);
  return geo;
}

/**
 * Tubo. El freno de boca es un ENGROSAMIENTO de la punta, no una pieza pegada:
 * con contorno propio se lee como un carrete encajado en un palo (§12.2).
 * Devuelve tambien el largo, que es de donde sale el ancla `boca`.
 */
export function tubo(largo, r, freno = 'ninguno') {
  const piezas = [];
  const lf = freno === 'ninguno' ? 0 : Math.min(0.5, largo * 0.16);
  const cana = new THREE.CylinderGeometry(r, r * 1.06, largo - lf, 16);
  cana.rotateZ(-Math.PI / 2);
  cana.translate((largo - lf) / 2, 0, 0);
  piezas.push(cana);
  if (lf) {
    const rf = freno === 'boquilla' ? r * 1.9 : r * 1.8;
    const boca = new THREE.CylinderGeometry(rf, freno === 'boquilla' ? r * 1.3 : rf, lf, 16);
    boca.rotateZ(-Math.PI / 2);
    boca.translate(largo - lf / 2, 0, 0);
    piezas.push(boca);
  }
  return fusionar(piezas);
}

/**
 * Rueda de rodadura: llanta, aro oscuro modelado, buje y tornillos.
 *
 * Sin buje una rueda es un circulo y se lee como un agujero en la oruga. No
 * lleva shell: su contorno es geometria, porque con seis vehiculos en pantalla
 * un shell por rueda serian cuarenta llamadas de dibujo por nada (§3).
 */
export function rueda(r, { tornillos = 4, ancho = 0.3 } = {}) {
  const disco = (radio, prof, z) => {
    const g = new THREE.CylinderGeometry(radio, radio, prof, 20);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, z);
    return g;
  };
  const pernos = [];
  for (let i = 0; i < tornillos; i++) {
    const a = (i / tornillos) * Math.PI * 2 + Math.PI / 4;
    const t = new THREE.CylinderGeometry(r * 0.11, r * 0.11, ancho * 0.4, 8);
    t.rotateX(Math.PI / 2);
    t.translate(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, ancho * 0.62);
    pernos.push(t);
  }
  // Las piezas van POR SEPARADO porque cada una lleva su color: sin el aro
  // oscuro y el buje, una rueda es un circulo plano y se lee como un agujero en
  // la oruga (docs/ARTE-VEHICULOS.md §4.2).
  return {
    llanta: disco(r, ancho, 0),
    aro: disco(r * 0.66, ancho * 0.75, ancho * 0.22),
    buje: disco(r * 0.5, ancho * 0.7, ancho * 0.34),
    pernos: fusionar(pernos),
  };
}

/** El recorrido cerrado de la cinta, con el ramal de arriba COLGANDO. */
export function caminoCinta(x0, x1, R, comba = 0.07) {
  const cy = R, ci = x0 + R, cd = x1 - R, pts = [];
  pts.push([ci, cy - R], [cd, cy - R]);
  for (let i = 1; i < 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * Math.PI;
    pts.push([cd + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([cd + (ci - cd) * t, cy + R - Math.sin(t * Math.PI) * comba]);
  }
  for (let i = 1; i < 14; i++) {
    const a = Math.PI / 2 + (i / 14) * Math.PI;
    pts.push([ci + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  return pts;
}

/**
 * Cinta de oruga: la banda cerrada. Se extruye con un hueco dentro, asi que el
 * canto oscuro y el hueco por donde se ven las ruedas salen de la misma pieza.
 * Una recta tensa arriba se lee como juguete: la comba va en el camino.
 */
export function cinta(x0, x1, R, { comba = 0.07, ancho = VIA * 0.28 } = {}) {
  // Capsula MACIZA, no un aro. Con la cinta hueca las ruedas tienen que caber
  // por el agujero, y como el hueco mide siempre menos que la rueda acaban
  // tapadas: en la plancha la banda es una mancha oscura y las ruedas van
  // ENCIMA, un poco mas cerca de la camara.
  //
  // Sin redondear las esquinas: el camino ya viene muestreado, y pasarlo por
  // `contornoRedondeado` mete una curva por punto y la cinta salta de dos mil
  // vertices a setenta mil.
  return extruir(contornoLlano(caminoCinta(x0, x1, R, comba)), ancho, 0.03);
}

/** Eslabon: la teja que se repite sobre el camino. Va en `InstancedMesh`. */
export const eslabon = (paso, ancho = VIA * 0.36) =>
  roundedBoxGeometry(paso * 0.72, 0.1, ancho, 0.03, 2);

/** Sombra de contacto. Sin ella el vehiculo flota, `ARTE.md` §1.4. */
export function sombraContacto(ancho, ry = 0.18) {
  const geo = new THREE.CircleGeometry(1, 24);
  geo.scale(ancho / 2, ry, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
