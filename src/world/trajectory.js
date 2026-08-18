import * as THREE from 'three';
import { clamp } from '../core/mathx.js';

const MAX_POINTS = 96;
const MIN_POINTS = 3; // assistLevel = 0 deja solo los tres primeros

/**
 * Arco de trayectoria.
 *
 * `assistLevel` recorta cuanto futuro se muestra, no la precision: los puntos
 * que se ven son siempre los reales. A 1 se ve el arco entero hasta el impacto;
 * a 0 solo los tres primeros, que bastan para leer el angulo de salida pero no
 * regalan el punto de caida.
 *
 * ── POR QUE NO SON BOLAS ────────────────────────────────────────────────
 * Eran discos redondos, todos del mismo tamaño y del mismo color: una sarta de
 * cuentas naranjas cruzando la pantalla que no decia NADA aparte de por donde
 * pasa. Un arco de tiro tiene que contar tres cosas mas, y las cuenta la forma:
 *
 *  - Hacia donde va cada tramo. Los trazos van GIRADOS con la tangente, asi que
 *    el arco se lee como una trayectoria y no como un collar.
 *  - Cuanta certeza queda. Menguan a lo largo del vuelo, de 23 px a 12: el
 *    principio del tiro es lo que controlas y el final lo que estimas.
 *  - Donde cae. Cada seis trazos va uno GRUESO, que da la cadencia con la que se
 *    mide a ojo la distancia que falta, y el ultimo lleva la cruz de caida.
 *
 * Todo eso en UNA llamada de dibujo: los trazos son `Points` y la forma la pone
 * el fragmento, rotando `gl_PointCoord`. Con una malla por trazo serian noventa
 * y seis llamadas por cuadro mientras el dedo arrastra.
 */

const VS = /* glsl */ `
  attribute float aAngulo;
  attribute float aTope;
  attribute float aHueco;
  attribute float aPeso;
  uniform float uPixelRatio;
  uniform float uPxPorUnidad;
  varying float vAngulo;
  varying float vPeso;
  void main() {
    vAngulo = aAngulo;
    vPeso = aPeso;
    // El largo lo decide EL HUECO hasta el trazo siguiente, medido en pixeles
    // de AHORA. Va aqui y no en update() porque el zoom cambia cada cuadro y el
    // arco solo se recalcula cuando el dedo se mueve: con el largo cocido en el
    // atributo, abrir plano dejaba los trazos del tamano del encuadre anterior y
    // se solapaban en un tubo continuo.
    float largo = min(aTope, max(3.5, aHueco * uPxPorUnidad * 0.8));
    gl_PointSize = largo * (1.0 + 0.22 * aPeso) * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FS = /* glsl */ `
  precision mediump float;
  uniform vec3 uAcento;
  uniform vec3 uRim;
  varying float vAngulo;
  varying float vPeso;

  void main() {
    // gl_PointCoord tiene la y hacia abajo: se voltea antes de girar, o el arco
    // saldria reflejado y los trazos apuntarian en contra del vuelo.
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    p.y = -p.y;
    float c = cos(-vAngulo), s = sin(-vAngulo);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

    // Capsula tumbada sobre el eje de vuelo, tres veces mas larga que ancha. A
    // dos por uno se lee como una pastilla y volvemos a las bolas de antes.
    // El trazo grueso de cada seis es mas ANCHO, no mas largo: alargandolo,
    // seis seguidos se funden en una linea continua y se pierde la cadencia.
    float w = mix(0.14, 0.20, vPeso);
    float d = length(vec2(max(abs(p.x) - 0.62, 0.0), p.y));

    float nucleo = 1.0 - smoothstep(w * 0.30, w * 0.70, d);
    float cuerpo = 1.0 - smoothstep(w * 0.80, w, d);
    float borde  = 1.0 - smoothstep(w + 0.055, w + 0.11, d);
    if (borde <= 0.001) discard;

    // Anillo oscuro obligatorio (ARTE.md §2): el arco se separa del terreno por
    // VALOR y no solo por tono, asi que se lee igual sobre cielo y sobre barro.
    vec3 color = mix(uRim, uAcento, cuerpo);
    color = mix(color, vec3(1.0), nucleo * 0.5);
    gl_FragColor = vec4(color, borde);
  }`;

export class TrajectoryArc {
  constructor({ acento = 0xff7a1a, rim = 0x0a0d14, pixelRatio = 1 }) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    geo.setAttribute('aAngulo', new THREE.BufferAttribute(new Float32Array(MAX_POINTS), 1));
    geo.setAttribute('aTope', new THREE.BufferAttribute(new Float32Array(MAX_POINTS), 1));
    geo.setAttribute('aHueco', new THREE.BufferAttribute(new Float32Array(MAX_POINTS), 1));
    geo.setAttribute('aPeso', new THREE.BufferAttribute(new Float32Array(MAX_POINTS), 1));
    geo.setDrawRange(0, 0);
    this.geometry = geo;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uPxPorUnidad: { value: 40 },
        uAcento: { value: new THREE.Color(acento) },
        uRim: { value: new THREE.Color(rim) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.visible = false;

    // La cruz de caida. Solo aparece cuando el arco llega hasta el impacto, o
    // seria una chuleta: con la ayuda recortada el punto de caida NO se regala.
    this.caida = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: acento, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false,
      }),
    );
    this.caida.renderOrder = 10;
    this.caida.visible = false;
    this.points.add(this.caida);
  }

  setPixelRatio(pr) {
    this.material.uniforms.uPixelRatio.value = pr;
  }

  /**
   * Cuantos pixeles mide una unidad de mundo AHORA.
   *
   * Sin esto el trazo mide lo mismo en pantalla a cualquier zoom, y como la
   * separacion entre puntos SI se encoge al abrir plano, al ver el campo entero
   * los noventa y seis trazos se solapan y vuelve a salir el tubo continuo que
   * esto venia a quitar. El trazo se recorta a poco mas de medio hueco.
   */
  setEscala(pxPorUnidad) {
    this.material.uniforms.uPxPorUnidad.value = pxPorUnidad;
  }

  /**
   * @param {number[][]} pts pares [x, y] en coordenadas de mundo
   * @returns {number} trazos realmente dibujados, que es lo que la camara usa
   *   para encuadrar: nunca se encuadra mas arco del que el jugador ve.
   */
  update(pts, assistLevel, z) {
    if (!pts.length) {
      this.points.visible = false;
      this.caida.visible = false;
      return 0;
    }
    const assist = clamp(assistLevel, 0, 1);
    const span = Math.max(0, pts.length - MIN_POINTS);
    const count = Math.min(MAX_POINTS, MIN_POINTS + Math.round(assist * span));
    const n = Math.min(count, pts.length);

    const pos = this.geometry.attributes.position.array;
    const ang = this.geometry.attributes.aAngulo.array;
    const tope = this.geometry.attributes.aTope.array;
    const hueco = this.geometry.attributes.aHueco.array;
    const peso = this.geometry.attributes.aPeso.array;

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      pos[i * 3 + 0] = p[0];
      pos[i * 3 + 1] = p[1];
      pos[i * 3 + 2] = z;

      // La tangente sale del vecino que exista: en el primero y el ultimo no hay
      // dos, y con un cero el trazo saldria plano y contando otra direccion.
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      ang[i] = Math.atan2(b[1] - a[1], b[0] - a[0]);

      const t = n > 1 ? i / (n - 1) : 0;
      // El tope mengua a lo largo del vuelo; el hueco hasta el trazo siguiente
      // va en unidades de mundo y lo pasa a pixeles el vertex shader, que es el
      // unico que sabe el zoom de este cuadro.
      tope[i] = 23 - 11 * t;
      hueco[i] = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.5;
      peso[i] = i % 6 === 0 ? 1 : 0;
    }

    for (const nombre of ['position', 'aAngulo', 'aTope', 'aHueco', 'aPeso']) {
      this.geometry.attributes[nombre].needsUpdate = true;
    }
    this.geometry.setDrawRange(0, n);
    this.points.visible = n > 0;

    // Entero significa entero: si la ayuda recorta aunque sea un punto, no hay
    // cruz. El ultimo punto de un arco recortado no es donde cae el tiro.
    const completo = n === pts.length && assist >= 1;
    this.caida.visible = completo;
    if (completo) {
      const fin = pts[pts.length - 1];
      this.caida.position.set(fin[0], fin[1], z + 0.01);
    }
    return n;
  }

  hide() {
    this.points.visible = false;
    this.caida.visible = false;
  }
}
