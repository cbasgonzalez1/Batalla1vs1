import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pintar } from './vehiculo/primitivas.js';
import { materialContorno } from './vehiculo/toon.js';

/**
 * El proyectil en vuelo, y su trazadora.
 *
 * ── POR QUE NO ES UNA BOLA ──────────────────────────────────────────────
 * Ya era un obus —cilindro mas ojiva— pero encima llevaba un halo de 1,5 u
 * sobre un cuerpo de 0,5: a la escala de juego el halo tapaba la pieza entera y
 * lo unico que se veia era la mancha redonda de la textura. Una bola naranja.
 *
 * Ahora la pieza manda y el halo acompaña:
 *
 *  - CUERPO de cuatro partes, no dos: culote, cinturon, cuerpo y ojiva. El
 *    cinturon es el detalle que lo hace legible — sin una banda que corte el
 *    tubo, un cilindro con punta se lee como una gota.
 *  - CONTORNO propio, con el mismo shell de los blindados y no una tecnica
 *    aparte. Es lo que separa el proyectil del terreno por VALOR y no solo por
 *    tono (`ARTE.md` §2), y lo que lo hace visible contra el cielo claro.
 *  - Sin luz. `MeshBasicMaterial`: un proyectil incandescente no se sombrea, y
 *    ademas asi se ve igual de bien en el lado de sombra del campo.
 *  - TRAZADORA de cinta, no de puntos. Los puntos de la estela ya daban el
 *    resplandor; lo que faltaba era el trazo continuo que dice a que velocidad
 *    va y por donde ha venido. Se afila hacia la cola y se apaga con ella.
 *
 * Coste: dos llamadas de dibujo para la pieza (relleno y contorno), una para la
 * cinta y el sprite del halo.
 */

/** Cuantas posiciones guarda la cinta. A 60 Hz son 220 ms, como la estela. */
const MUESTRAS = 14;

/** Media anchura de la cinta pegada al culote. Se afila a cero en la cola. */
const ANCHO_CINTA = 0.17;

/**
 * @param {object} opciones
 * @param {number} opciones.acento  color de la trazadora del teatro
 * @param {number} opciones.rim     el anillo oscuro obligatorio
 * @param {THREE.Texture} opciones.halo textura del punto, para el resplandor
 */
export function crearProyectil({ acento, rim, halo: textura }) {
  const grupo = new THREE.Group();
  grupo.visible = false;

  // ── el cuerpo ───────────────────────────────────────────────────────────
  // Mira a +X, como todo en este juego. El grupo se gira con la velocidad.
  const piezas = [];

  const cuerpo = new THREE.CylinderGeometry(0.185, 0.185, 0.46, 14);
  cuerpo.rotateZ(-Math.PI / 2);
  cuerpo.translate(0.02, 0, 0);
  piezas.push(pintar(cuerpo.toNonIndexed(), acento, false));

  // Cinturon de forzamiento: el corte que impide que se lea como una gota.
  const cinturon = new THREE.CylinderGeometry(0.215, 0.215, 0.1, 14);
  cinturon.rotateZ(-Math.PI / 2);
  cinturon.translate(-0.14, 0, 0);
  piezas.push(pintar(cinturon.toNonIndexed(), rim, false));

  // Culote plano: una ojiva en los dos extremos no es un proyectil, es un huso.
  const culote = new THREE.CylinderGeometry(0.16, 0.185, 0.08, 14);
  culote.rotateZ(-Math.PI / 2);
  culote.translate(-0.27, 0, 0);
  piezas.push(pintar(culote.toNonIndexed(), 0xffffff, false));

  const ojiva = new THREE.ConeGeometry(0.185, 0.36, 14);
  ojiva.rotateZ(-Math.PI / 2);
  ojiva.translate(0.43, 0, 0);
  piezas.push(pintar(ojiva.toNonIndexed(), 0xffffff, false));

  const geo = mergeGeometries(piezas, false);
  const relleno = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  relleno.renderOrder = 11;
  // 2 px de contorno: es un objeto pequeño y en movimiento, y a 3 el trazo se
  // come la ojiva entera en el encuadre de vuelo.
  const contorno = new THREE.Mesh(geo, materialContorno(2));
  contorno.renderOrder = 10;
  grupo.add(contorno, relleno);

  // Resplandor: pequeño y DETRAS del cuerpo. Grande, es la bola de antes.
  const resplandor = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textura,
    color: acento,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: false,
  }));
  resplandor.scale.setScalar(0.95);
  resplandor.renderOrder = 9;
  grupo.add(resplandor);

  // ── la cinta de trazadora ───────────────────────────────────────────────
  // Vive fuera del grupo: sus vertices estan en coordenadas de MUNDO, porque la
  // cola tiene que quedarse donde estuvo el proyectil y no seguirlo.
  const vertices = new Float32Array(MUESTRAS * 2 * 3);
  const colores = new Float32Array(MUESTRAS * 2 * 4);
  const indices = [];
  for (let i = 0; i < MUESTRAS - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const cintaGeo = new THREE.BufferGeometry();
  cintaGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  cintaGeo.setAttribute('color', new THREE.BufferAttribute(colores, 4));
  cintaGeo.setIndex(indices);
  cintaGeo.setDrawRange(0, 0);

  const cinta = new THREE.Mesh(cintaGeo, new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  cinta.frustumCulled = false;
  cinta.renderOrder = 8;
  cinta.visible = false;

  const acentoC = new THREE.Color(acento);
  const rastro = [];

  const rehacerCinta = () => {
    const n = rastro.length;
    if (n < 2) {
      cintaGeo.setDrawRange(0, 0);
      cinta.visible = false;
      return;
    }
    for (let i = 0; i < n; i++) {
      // rastro[0] es la cabeza. La cinta se afila y se apaga hacia la cola.
      const t = i / (n - 1);
      const p = rastro[i];
      const a = rastro[Math.max(0, i - 1)];
      const b = rastro[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0];
      let dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      const w = ANCHO_CINTA * (1 - t) ** 0.8;
      const k = i * 2 * 3;
      vertices[k + 0] = p[0] - dy * w;
      vertices[k + 1] = p[1] + dx * w;
      vertices[k + 2] = p[2];
      vertices[k + 3] = p[0] + dy * w;
      vertices[k + 4] = p[1] - dx * w;
      vertices[k + 5] = p[2];

      // Solo la CABEZA va blanca, y muy poco: con la mitad de la cinta blanca,
      // sobre un cielo claro la trazadora se lee como un rayajo gris y no como
      // algo ardiendo. El resto es el acento del teatro, a plena saturacion.
      const blanco = (1 - t) ** 5;
      const r = acentoC.r + (1 - acentoC.r) * blanco;
      const g = acentoC.g + (1 - acentoC.g) * blanco;
      const bb = acentoC.b + (1 - acentoC.b) * blanco;
      const alfa = (1 - t) ** 0.85 * 0.95;
      const c = i * 2 * 4;
      colores[c + 0] = r; colores[c + 1] = g; colores[c + 2] = bb; colores[c + 3] = alfa;
      colores[c + 4] = r; colores[c + 5] = g; colores[c + 6] = bb; colores[c + 7] = alfa;
    }
    cintaGeo.attributes.position.needsUpdate = true;
    cintaGeo.attributes.color.needsUpdate = true;
    cintaGeo.setDrawRange(0, (n - 1) * 6);
    cinta.visible = true;
  };

  return {
    grupo,
    cinta,

    /** La posicion, mirando a donde va. `vx, vy` puede ser cualquier escala. */
    mover(x, y, z, vx, vy) {
      grupo.position.set(x, y, z);
      grupo.rotation.z = Math.atan2(vy, vx);
      rastro.unshift([x, y, z]);
      if (rastro.length > MUESTRAS) rastro.length = MUESTRAS;
      rehacerCinta();
    },

    /** Empieza un vuelo. Sin esto, la cinta arranca desde el impacto anterior. */
    lanzar(x, y, z, vx, vy) {
      rastro.length = 0;
      grupo.visible = true;
      this.mover(x, y, z, vx, vy);
    },

    /** Lo guarda todo: el proyectil ha impactado o la partida ha terminado. */
    guardar() {
      grupo.visible = false;
      cinta.visible = false;
      rastro.length = 0;
      cintaGeo.setDrawRange(0, 0);
    },

    get visible() {
      return grupo.visible;
    },
  };
}
