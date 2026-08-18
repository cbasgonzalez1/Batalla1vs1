import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PERFILES, VIA, casco as cascoGeo, bulto, torreta as torretaGeo, mantelete,
  tubo as tuboGeo, rueda as ruedaGeo, cinta, eslabon, caminoCinta,
  sombraContacto, pintar, faldon as faldonGeo, fusionar,
} from './primitivas.js';
import { materialRelleno, materialContorno } from './toon.js';
import { MATERIA, oscuro } from './paleta.js';

/**
 * Lo unico que compone. Coge una ficha del catalogo y devuelve el rig.
 *
 * ── EL INVARIANTE ───────────────────────────────────────────────────────
 * `Y_PIVOTE` es el eje de elevacion y vale lo mismo en los quince. Es una
 * constante de ESTE modulo y no sale de la ficha: asi una ficha no puede
 * romperlo ni queriendo, que es lo unico que de verdad protege la sincronia de
 * red (docs/ARTE-VEHICULOS.md §8).
 *
 * ── LA ESCALA ───────────────────────────────────────────────────────────
 * Las planchas estan en unidades donde la MEDIA mide 5,6 de largo y el pivote
 * cae a 2,32 de alto. El juego tiene el pivote a 1,45 desde que existe, y
 * moverlo cambiaria el encuadre, el arco de apuntado y la altura de salida del
 * proyectil de golpe. `ESCALA` es exactamente la razon entre los dos, asi que
 * el vehiculo entra con las proporciones aprobadas y el pivote NO se mueve.
 * Si algun dia hay que agrandar el parque movil, es este numero y ninguno mas.
 */
export const Y_PIVOTE = 2.32;
export const PIVOTE_JUEGO = 1.45;
export const ESCALA = PIVOTE_JUEGO / Y_PIVOTE;

/**
 * Z de la cinta y de la rueda. La rueda va MAS CERCA de la camara que la banda:
 * con las dos en el mismo plano la banda las tapa y el tren de rodaje se ve como
 * una mancha negra. En la plancha las ruedas se pintan encima de la cinta, y
 * esto es lo mismo dicho en 3D.
 */
const Z_CINTA = VIA * 0.3;
const Z_RUEDA = VIA * 0.42;

/**
 * Anclas en unidades de JUEGO. `world/cannon.js` y la balistica leen esto.
 *
 * La x se hereda del rig que ya existia: el casco se coloca para que su raiz de
 * tubo caiga aqui, en vez de mover el pivote y arrastrar con el el encuadre, el
 * arco de apuntado y la epoca de 1916, que todavia usa el modelo viejo.
 */
export const PIVOTE = Object.freeze({ x: -0.1, y: PIVOTE_JUEGO });

/**
 * Pinta una pieza ANTES de fusionarla, para que un bloque pueda llevar mas de un
 * color: el casco es oliva y la cinta es caucho, y los dos van en la misma
 * geometria porque no se mueven el uno respecto al otro.
 */
const pintarPiezas = (geo, color, aclarar = true) => pintar(fusionar([geo]), color, aclarar);

/** Funde piezas que ya traen su color por vertice. */
const fusionarPintadas = (piezas) => mergeGeometries(piezas, false);

/** Cuelga una malla con sus dos pasadas: relleno y shell de contorno. */
function bloque(grupo, geo, grosorPx) {
  if (!geo) return null;
  const relleno = new THREE.Mesh(geo, materialRelleno());
  relleno.castShadow = true;
  relleno.receiveShadow = true;
  const shell = new THREE.Mesh(geo, materialContorno(grosorPx));
  // El shell no proyecta sombra: proyectaria la silueta engordada y el vehiculo
  // se veria con un halo en el suelo.
  grupo.add(shell, relleno);
  return relleno;
}

/** Reparte n puntos a lo largo de una polilinea cerrada, con su tangente. */
function repartir(pts, n) {
  const largos = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    largos.push(d);
    total += d;
  }
  const salida = [];
  let objetivo = 0, acumulado = 0, seg = 0;
  for (let k = 0; k < n; k++) {
    objetivo = (total * k) / n;
    while (acumulado + largos[seg] < objetivo && seg < largos.length - 1) {
      acumulado += largos[seg];
      seg++;
    }
    const a = pts[seg], b = pts[(seg + 1) % pts.length];
    const t = largos[seg] ? (objetivo - acumulado) / largos[seg] : 0;
    salida.push({
      x: a[0] + (b[0] - a[0]) * t,
      y: a[1] + (b[1] - a[1]) * t,
      ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
    });
  }
  return { puntos: salida, paso: total / n };
}

/**
 * @param {object} ficha  una de `fichas/`
 * @param {number} base   color del bando, 0xRRGGBB
 * @returns {{casco: THREE.Group, arma: THREE.Group, tubo: THREE.Group, retroceso: number}}
 */
export function ensamblar(ficha, base) {
  const f = ficha;
  const casco = new THREE.Group();
  casco.name = `casco:${f.id}`;

  // ── tren de rodaje ──────────────────────────────────────────────────────
  const r = f.rodaje.r;
  const R = f.rodaje.rodillos > 0 ? r * 1.42 : r + 0.03;
  const yRueda = f.rodaje.rodillos > 0 ? r + 0.05 : R;
  const comba = f.rodaje.rodillos > 0 ? 0.16 : 0.07;

  // Ruedas y eslabones van en `InstancedMesh`: una llamada de dibujo cada uno
  // aunque haya doce ruedas y sesenta tejas (docs/ARTE-VEHICULOS.md §7).
  const rm = Math.min(r * 1.12, R - 0.02);
  const xi = f.rodaje.x0 + 0.1 + rm, xf = f.rodaje.x1 - 0.1 - rm;
  const paso = f.rodaje.ruedas > 1 ? (xf - xi) / (f.rodaje.ruedas - 1) : 0;
  const partes = ruedaGeo(r);
  const geoRueda = fusionarPintadas([
    pintarPiezas(partes.llanta, MATERIA.llanta),
    pintarPiezas(partes.aro, MATERIA.cinta, false),
    pintarPiezas(partes.buje, MATERIA.buje),
    pintarPiezas(partes.pernos, MATERIA.llanta),
  ]);
  const ruedas = new THREE.InstancedMesh(geoRueda, materialRelleno(), f.rodaje.ruedas * 2);
  ruedas.castShadow = true;
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < f.rodaje.ruedas; i++) {
    const extremo = i === 0 || i === f.rodaje.ruedas - 1;
    const s = extremo ? rm / r : 1;
    for (const z of [1, -1]) {
      m.compose(
        new THREE.Vector3(xi + paso * i, yRueda, z * Z_RUEDA),
        new THREE.Quaternion(),
        new THREE.Vector3(s, s, 1),
      );
      ruedas.setMatrixAt(k++, m);
    }
  }
  casco.add(ruedas);

  const { puntos, paso: pasoEslabon } = repartir(
    caminoCinta(f.rodaje.x0, f.rodaje.x1, R, comba), f.rodaje.eslabones,
  );
  const tejas = new THREE.InstancedMesh(
    pintar(eslabon(pasoEslabon), MATERIA.buje), materialRelleno(), f.rodaje.eslabones * 2,
  );
  let j = 0;
  for (const p of puntos) {
    for (const z of [1, -1]) {
      m.makeRotationZ(p.ang);
      m.setPosition(p.x, p.y, z * Z_CINTA);
      tejas.setMatrixAt(j++, m);
    }
  }
  casco.add(tejas);

  // ── casco: perfil + bultos + extras + las dos cintas, todo FUSIONADO ─────
  // Las cintas entran en el mismo bloque que el casco: no se mueven respecto a
  // el y comparten material, asi que separarlas costaba dos llamadas de dibujo
  // y un shell por banda a cambio de nada. Su color va por vertice.
  // La costura: el borde superior de la banda oscura. Topada a 0,62 porque en
  // un casco alto una banda al 50 % parte el vehiculo en dos colores y deja de
  // leerse como sombra.
  const costura = f.y0 + Math.min(f.alto * 0.42, 0.62);
  const piezas = [
    pintarPiezas(cascoGeo(PERFILES[f.perfil](f.L, f.alto, f.y0, f.opts)), base),
    pintarPiezas(faldonGeo(f.L, f.y0, costura), oscuro(base), false),
  ];
  for (const [x, y, w, h] of f.bultos ?? []) piezas.push(pintarPiezas(bulto(x, y, w, h), base));
  for (const e of f.extras ?? []) {
    if (e.tipo === 'caja') piezas.push(pintarPiezas(bulto(e.x, e.y, e.w, e.h, VIA * 0.5), base));
  }
  for (const z of [1, -1]) {
    const banda = cinta(f.rodaje.x0, f.rodaje.x1, R, { comba });
    banda.translate(0, 0, z * Z_CINTA);
    piezas.push(pintarPiezas(banda, MATERIA.cinta, false));
  }
  bloque(casco, fusionarPintadas(piezas), 3);

  // ── arma: torreta + cupula + mantelete + tubo ────────────────────────────
  // Todo cuelga del pivote, y por eso se expresa RELATIVO a el: la torreta gira
  // con el tubo porque en un carro giran juntos.
  const arma = new THREE.Group();
  arma.name = 'arma';
  const px = f.tubo.x, py = Y_PIVOTE;

  const conjunto = [];
  if (f.torreta) {
    conjunto.push(torretaGeo(f.torreta));
    if (f.cupula) {
      conjunto.push(bulto(
        f.torreta.cx + f.cupula.x, f.torreta.base + f.torreta.alto - 0.05,
        f.cupula.w, f.cupula.h, VIA * 0.34,
      ));
    }
  }
  if (f.tubo.mantelete) conjunto.push(mantelete(px, py, f.tubo.mantelete));
  // El ARMA no se escala como grupo: dentro de ella cuelga el ancla `boca`, que
  // esta en unidades de juego y la lee la balistica. Escalando el grupo, la boca
  // se escalaria otra vez y el proyectil saldria de un sitio que no es. Se
  // escala la geometria y ya.
  const fijo = fusionar(conjunto);
  fijo.translate(-px, -py, 0);
  fijo.scale(ESCALA, ESCALA, ESCALA);
  bloque(arma, pintar(fijo, base), 3);

  // El tubo va aparte para que el retroceso lo deslice solo.
  const tubo = new THREE.Group();
  tubo.name = 'tubo';
  arma.add(tubo);
  const canon = tuboGeo(f.tubo.largo, f.tubo.r, f.tubo.freno);
  canon.scale(ESCALA, ESCALA, ESCALA);
  // Del color del BANDO, no de acero: el tubo es parte de la silueta unica del
  // cuerpo (§12.1), y en acero se lee como una pieza pegada encima.
  bloque(tubo, pintar(canon, base), 3);

  // ── sombra de contacto ──────────────────────────────────────────────────
  const sombra = new THREE.Mesh(
    sombraContacto(f.L * 0.92),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  sombra.position.y = 0.02;
  sombra.renderOrder = -1;
  casco.add(sombra);

  // La escala se aplica una sola vez, al final y al grupo entero.
  casco.scale.setScalar(ESCALA);
  // Y el casco se corre para que su raiz de tubo caiga sobre el pivote del rig.
  // El arma no: sus piezas ya se expresaron relativas al pivote.
  casco.position.x = PIVOTE.x - f.tubo.x * ESCALA;

  return {
    casco,
    arma,
    tubo,
    retroceso: f.retroceso,
    // El ancla `boca`: el extremo del tubo, en unidades de juego y relativo al
    // pivote. La balistica lee SOLO esto; nunca calcula de la geometria.
    boca: { x: f.tubo.largo * ESCALA, y: 0 },
    pivote: { ...PIVOTE },
  };
}
