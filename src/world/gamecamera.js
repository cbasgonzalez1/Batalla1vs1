import * as THREE from 'three';
import { DEG } from '../core/mathx.js';

/**
 * Camara ortografica elevada con encuadre animado.
 *
 * Con los canones a 88 unidades uno de otro ya no cabe todo en pantalla: la
 * camara pasa a ser parte de la jugabilidad. Tres modos:
 *  - `tweenTo`  : barrido con curva y duracion (cambio de turno, otear)
 *  - `followTo` : seguimiento suavizado sin destino fijo (proyectil en vuelo)
 *  - `snap`     : colocacion instantanea (arranque)
 *
 * El ancho de vision (`w`) se anima igual que la posicion, asi que un barrido
 * puede abrir o cerrar plano a la vez que se desplaza.
 */
export class GameCamera {
  constructor({ elevationDeg = 15, viewWidth = 30, designAspect = 1080 / 1920 } = {}) {
    this.elev = elevationDeg * DEG;
    this.designAspect = designAspect;
    this.aspect = designAspect;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 700);
    this.cx = 0;
    this.cy = 0;
    this.w = viewWidth;

    this.tween = null;
    this.follow = null;
    this.zoom = 1; // multiplicador manual (rueda / pellizco)
    this.bounds = null; // { minX, maxX } del mundo
    // Sacudida de impacto. Va aparte de cx/cy a proposito: si se sumara al
    // centro, el seguimiento suavizado perseguiria la sacudida y la camara se
    // quedaria desplazada cuando terminase.
    this.shakeX = 0;
    this.shakeY = 0;
  }

  /** Desplazamiento de este cuadro, en unidades de mundo. Solo dibuja. */
  setSacudida(dx, dy) {
    this.shakeX = dx;
    this.shakeY = dy;
  }

  /** Limites del mundo: impiden encuadrar el vacio de mas alla del terreno. */
  setBounds(minX, maxX) {
    this.bounds = { minX, maxX };
  }

  snap(x, y, w) {
    this.cx = x;
    this.cy = y;
    this.w = w;
    this.tween = null;
    this.follow = null;
    this._apply();
  }

  /** @param {(t:number)=>number} ease */
  tweenTo(x, y, w, durationMs, ease) {
    this.tween = {
      fx: this.cx, fy: this.cy, fw: this.w,
      tx: x, ty: y, tw: w,
      t: 0, d: Math.max(1, durationMs), ease,
    };
    this.follow = null;
  }

  /** Seguimiento exponencial: no termina, se reajusta cada cuadro. */
  followTo(x, y, w, lambda = 7) {
    if (this.follow) {
      this.follow.x = x;
      this.follow.y = y;
      this.follow.w = w;
      this.follow.lambda = lambda;
    } else {
      this.follow = { x, y, w, lambda };
    }
    this.tween = null;
  }

  get busy() {
    return this.tween !== null;
  }

  setAspect(aspect) {
    this.aspect = aspect;
    this._apply();
  }

  setZoom(z) {
    this.zoom = Math.min(2.6, Math.max(0.55, z));
    this._apply();
  }

  /** @param {number} dt segundos */
  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + (dt * 1000) / tw.d);
      const e = tw.ease(tw.t);
      this.cx = tw.fx + (tw.tx - tw.fx) * e;
      this.cy = tw.fy + (tw.ty - tw.fy) * e;
      this.w = tw.fw + (tw.tw - tw.fw) * e;
      if (tw.t >= 1) this.tween = null;
    } else if (this.follow) {
      // Suavizado exponencial independiente de los fps.
      const k = 1 - Math.exp(-this.follow.lambda * dt);
      this.cx += (this.follow.x - this.cx) * k;
      this.cy += (this.follow.y - this.cy) * k;
      this.w += (this.follow.w - this.w) * k;
    }
    this._apply();
  }

  _apply() {
    const w = this.w * this.zoom;
    const designH = w / this.designAspect;

    // Se "cubre" el encuadre de diseno: en pantallas mas anchas se ve mas
    // campo a los lados, nunca menos del previsto.
    let halfW;
    let halfH;
    if (this.aspect > w / designH) {
      halfH = designH / 2;
      halfW = halfH * this.aspect;
    } else {
      halfW = w / 2;
      halfH = halfW / this.aspect;
    }
    // La camara mira 15 grados hacia abajo, asi que su alto de frustum cubre
    // algo menos de mundo en Y. Se compensa para respetar el encuadre pedido.
    halfH /= Math.cos(this.elev);

    // El centro se recorta a los limites del mundo para que el borde del
    // terreno no entre nunca en cuadro. Si el plano es mas ancho que el
    // mundo, se centra y ya.
    let cx = this.cx;
    if (this.bounds) {
      const { minX, maxX } = this.bounds;
      cx = maxX - minX <= halfW * 2
        ? (minX + maxX) / 2
        : Math.min(Math.max(cx, minX + halfW), maxX - halfW);
    }

    // La sacudida se suma AQUI, despues del recorte a los limites del mundo:
    // asi puede asomar un dedo de vacio en el borde durante 260 ms, que es
    // justo lo que hace que un impacto en la esquina se sienta.
    cx += this.shakeX;
    const cy2 = this.cy + this.shakeY;

    const c = this.camera;
    c.left = -halfW;
    c.right = halfW;
    c.top = halfH;
    c.bottom = -halfH;

    const dist = 320; // en ortografica no cambia el tamano, solo el recorte
    c.position.set(cx, cy2 + Math.sin(this.elev) * dist, Math.cos(this.elev) * dist);
    c.up.set(0, 1, 0);
    c.lookAt(cx, cy2, 0);
    c.updateProjectionMatrix();
  }
}
