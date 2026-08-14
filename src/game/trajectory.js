import * as THREE from 'three';
import { clamp } from '../core/mathx.js';

const MAX_POINTS = 96;
const MIN_POINTS = 3; // assistLevel = 0 deja solo los tres primeros

/**
 * Arco de trayectoria punteado.
 *
 * `assistLevel` recorta cuanto futuro se muestra, no la precision: los puntos
 * que se ven son siempre los reales. A 1 se ve el arco entero hasta el
 * impacto; a 0 solo los tres primeros puntos, que bastan para leer el angulo
 * de salida pero no regalan el punto de caida.
 */
export class TrajectoryArc {
  constructor({ texture, pixelRatio = 1 }) {
    const positions = new Float32Array(MAX_POINTS * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.PointsMaterial({
      map: texture,
      size: 11 * pixelRatio,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      alphaTest: 0.02,
      opacity: 0.95,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.points.visible = false;
    this.basePixelSize = 11;
  }

  setPixelRatio(pr) {
    this.material.size = this.basePixelSize * pr;
  }

  /**
   * @param {number[][]} pts pares [x, y] en coordenadas de mundo
   * @returns {number} puntos realmente dibujados, que es lo que la camara usa
   *   para encuadrar: nunca se encuadra mas arco del que el jugador ve.
   */
  update(pts, assistLevel, z) {
    if (!pts.length) {
      this.points.visible = false;
      return 0;
    }
    const assist = clamp(assistLevel, 0, 1);
    const span = Math.max(0, pts.length - MIN_POINTS);
    const count = Math.min(MAX_POINTS, MIN_POINTS + Math.round(assist * span));
    const n = Math.min(count, pts.length);

    const arr = this.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) {
      arr[i * 3 + 0] = pts[i][0];
      arr[i * 3 + 1] = pts[i][1];
      arr[i * 3 + 2] = z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
    this.points.visible = n > 0;
    return n;
  }

  hide() {
    this.points.visible = false;
  }
}
