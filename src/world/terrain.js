import * as THREE from 'three';
import { makeNoise1D, fbm1D } from '../core/noise.js';
import { lerp, smoothstep } from '../core/mathx.js';

/**
 * Terreno destructible.
 *
 * El estado autoritativo es un heightmap 1D (`heights`). La malla 3D es solo
 * su representacion: se extruye el perfil a lo largo de Z y se reconstruye
 * cuando el heightmap cambia. La fisica lee `heights`, nunca la malla.
 *
 * Convencion de profundidad: la cara frontal vive en z = 0 y el volumen se
 * extruye hacia ATRAS, hasta z = -depth. Asi el proyectil puede volar en
 * z = +0.25, siempre por delante del muro frontal, sin que un cerro se lo
 * coma visualmente y sin desalinearse del canon (a camara ortografica de 15
 * grados, 0.25 de z son 3 px de desplazamiento en pantalla).
 *
 * La malla son dos superficies con el mismo material:
 *  - `frontGeo`: cara frontal (normal +Z), la que ocupa casi toda la pantalla.
 *    Se colorea por profundidad bajo la superficie -> cuerpo / socavon.
 *  - `topGeo`:   superficie superior barrida (normal perpendicular a la
 *    pendiente), que a 15 grados de camara da el volumen -> cresta.
 */

const ROWS = 18;           // filas verticales de la cara frontal
const ROW_BIAS = 2.1;      // concentra filas cerca de la superficie
const BAND_DEPTH = 1.5;    // grosor de la banda "cuerpo" en unidades de mundo
const AO_WINDOW = 26;      // columnas a cada lado para la oclusion de horizonte
const AO_STRENGTH = 0.62;
const AO_FADE_DEPTH = 4.5; // la AO se disuelve a esta profundidad en la cara
const CONTRAST = 5.5;      // expansion de contraste del fBm, ver _generate()
const SINK = 0.42;         // cuanto se oscurece el fondo de la cara frontal
const SINK_DEPTH = 14;     // profundidad a la que el oscurecimiento satura

export class Terrain {
  constructor({
    rng,
    biome,
    width,
    columns,
    depth,
    minHeight,
    amplitude,
    baseY = -14,
    floorY = -4,
    bowlHalfWidth = 0,
    bowlWeight = 0.48,
    pads = [],
  }) {
    this.width = width;
    this.cols = columns;
    this.x0 = -width / 2;
    this.dx = width / (columns - 1);
    this.depth = depth;
    this.zFront = 0;
    this.zBack = -depth;
    this.baseY = baseY;   // hasta donde baja la cara frontal (fuera de cuadro)
    this.floorY = floorY; // lo mas hondo que puede excavar un crater
    this.biome = biome;

    // Float64 y no Float32: con Sotavento el heightmap deja de ser un perfil
    // que se dibuja y pasa a ser un libro de contabilidad. La masa total ronda
    // las 2400 u², y en simple precision (7 digitos) cada suma arrastra ~2e-4
    // de error; en un combate de 16 impactos eso se acerca al milesimo que la
    // conservacion tiene que respetar. La AO se queda en simple porque solo
    // pinta. Sigue siendo determinista entre maquinas: IEEE 754 es IEEE 754.
    this.heights = new Float64Array(columns);
    this.ao = new Float32Array(columns);

    this._generate(rng, minHeight, amplitude, pads, bowlHalfWidth, bowlWeight);

    this.crest = new THREE.Color(biome.crest);
    this.body = new THREE.Color(biome.body);
    this.deep = new THREE.Color(biome.deep);

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
    });

    this._buildGeometries();
    this.rebuild(0, this.cols - 1);

    this.group = new THREE.Group();
    this.group.name = 'terrain';

    this.frontMesh = new THREE.Mesh(this.frontGeo, this.material);
    this.frontMesh.receiveShadow = true;

    this.topMesh = new THREE.Mesh(this.topGeo, this.material);
    this.topMesh.receiveShadow = true;

    this.group.add(this.frontMesh, this.topMesh);
  }

  // ---------------------------------------------------------------- perfil

  _generate(rng, minHeight, amplitude, pads, bowlHalfWidth, bowlWeight) {
    const noise = makeNoise1D(rng);
    // Envolvente de cuenco: alto en los extremos, valle en el centro. Sin
    // ella el ruido puro planta muros pegados a los canones y un tiro a
    // maxima potencia se estrella a 5 unidades de la boca. Ademas es la forma
    // clasica de arena de artilleria: los dos tiran cuesta abajo.
    const bowlK = bowlHalfWidth > 0 ? Math.PI / bowlHalfWidth : 0;
    const w = bowlHalfWidth > 0 ? bowlWeight : 0;
    // Desplazamientos con semilla para que dos partidas no compartan relieve.
    const o1 = rng() * 500;
    const o2 = rng() * 500;
    const o3 = rng() * 500;

    for (let i = 0; i < this.cols; i++) {
      const x = this.x0 + i * this.dx;
      const macro = fbm1D(noise, x * 0.055 + o1, { octaves: 4, gain: 0.55 });
      const meso = fbm1D(noise, x * 0.16 + o2, { octaves: 3, gain: 0.5 });
      const micro = fbm1D(noise, x * 0.52 + o3, { octaves: 2, gain: 0.45 });
      const raw = macro * 0.66 + meso * 0.26 + micro * 0.08;
      // El fBm de ruido de valor es una media de octavas, asi que regresa a
      // 0.5 y se queda en una banda estrecha: sin expandir el contraste el
      // terreno solo usaba el 41% de la amplitud pedida y salia casi llano.
      // La saturacion es tanh y no un recorte duro: recortar dejaba mesetas
      // planas en los extremos y el bioma de dunas pide perfil redondeado.
      const shaped = 0.5 + 0.5 * Math.tanh((raw - 0.5) * CONTRAST);
      const bowl = bowlK > 0 ? (1 - Math.cos(x * bowlK)) / 2 : 0;
      this.heights[i] = minHeight + (shaped * (1 - w) + bowl * w) * amplitude;
    }

    for (const pad of pads) this._flattenPad(pad.x, pad.halfWidth, pad.feather);
  }

  /** Aplana una meseta bajo cada canon para que apoyen bien. */
  _flattenPad(cx, halfWidth, feather) {
    const target = this.heightAt(cx);
    const reach = halfWidth + feather;
    const i0 = Math.max(0, Math.floor((cx - reach - this.x0) / this.dx));
    const i1 = Math.min(this.cols - 1, Math.ceil((cx + reach - this.x0) / this.dx));
    for (let i = i0; i <= i1; i++) {
      const d = Math.abs(this.x0 + i * this.dx - cx);
      const t = 1 - smoothstep(halfWidth, reach, d);
      this.heights[i] = lerp(this.heights[i], target, t);
    }
  }

  // ------------------------------------------------------------ consultas

  /** Altura del terreno en una x del mundo, interpolada entre columnas. */
  heightAt(x) {
    const f = (x - this.x0) / this.dx;
    if (f <= 0) return this.heights[0];
    if (f >= this.cols - 1) return this.heights[this.cols - 1];
    const i = Math.floor(f);
    return lerp(this.heights[i], this.heights[i + 1], f - i);
  }

  /** Pendiente (dy/dx) en una x del mundo. */
  slopeAt(x) {
    return (this.heightAt(x + this.dx) - this.heightAt(x - this.dx)) / (2 * this.dx);
  }

  // ---------------------------------------------------------- destruccion

  /**
   * Resta un semicirculo de radio `r` centrado en el impacto: cada columna
   * baja hasta la parte inferior del circulo. Devuelve el rango tocado, que
   * la fase de animacion necesitara para interpolar el hundimiento.
   */
  carve(cx, cy, r, { rehacerMalla = true } = {}) {
    const i0 = Math.max(0, Math.floor((cx - r - this.x0) / this.dx));
    const i1 = Math.min(this.cols - 1, Math.ceil((cx + r - this.x0) / this.dx));

    // La masa que sale del crater no se destruye: la recoge quien llame para
    // volver a soltarla a sotavento. Se mide lo que REALMENTE se quita, que no
    // es el semidisco entero: donde el crater toca `floorY` hay roca madre, y
    // donde el suelo ya estaba por debajo no se quita nada.
    let volumen = 0;

    for (let i = i0; i <= i1; i++) {
      const dx = this.x0 + i * this.dx - cx;
      const k = r * r - dx * dx;
      if (k <= 0) continue;
      const bottom = cy - Math.sqrt(k);
      if (this.heights[i] > bottom) {
        const antes = this.heights[i];
        this.heights[i] = Math.max(this.floorY, bottom);
        volumen += (antes - this.heights[i]) * this.dx;
      }
    }

    // La AO mira a los vecinos, asi que hay que refrescar mas ancho que el crater.
    if (rehacerMalla) this.rebuild(i0 - AO_WINDOW, i1 + AO_WINDOW);
    return { i0, i1, volumen };
  }

  /**
   * Suelta `volumen` de arena en una campana centrada en `xc`.
   *
   * Los pesos se normalizan sobre la campana COMPLETA, incluidas las columnas
   * que caen fuera del mundo: esa parte se pierde de verdad, y se devuelve
   * aparte para que quien llame pueda comprobar que la masa cuadra. Normalizar
   * solo sobre lo que cabe habria metido de vuelta al campo la arena que el
   * viento se llevo fuera, y la conservacion seria mentira.
   */
  depositar(xc, sigma, volumen, { rehacerMalla = true } = {}) {
    const vacio = { i0: 0, i1: -1, depositado: 0, perdido: 0 };
    if (!(volumen > 0) || !(sigma > 0)) return vacio;

    // Mas alla de cuatro sigmas queda menos de un 0,007 % de la campana.
    const alcance = 4 * sigma;
    const desde = Math.floor((xc - alcance - this.x0) / this.dx);
    const hasta = Math.ceil((xc + alcance - this.x0) / this.dx);

    let suma = 0;
    for (let i = desde; i <= hasta; i++) {
      const d = this.x0 + i * this.dx - xc;
      suma += Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    if (suma <= 0) return vacio;

    const escala = volumen / (suma * this.dx);
    const i0 = Math.max(0, desde);
    const i1 = Math.min(this.cols - 1, hasta);

    let depositado = 0;
    for (let i = i0; i <= i1; i++) {
      const d = this.x0 + i * this.dx - xc;
      const altura = escala * Math.exp(-(d * d) / (2 * sigma * sigma));
      this.heights[i] += altura;
      depositado += altura * this.dx;
    }

    if (rehacerMalla && i1 >= i0) this.rebuild(i0 - AO_WINDOW, i1 + AO_WINDOW);
    return { i0, i1, depositado, perdido: volumen - depositado };
  }

  // ------------------------------------------------------------- geometria

  _buildGeometries() {
    const cols = this.cols;

    // --- cara frontal: rejilla cols x ROWS en z = 0
    const fCount = cols * ROWS;
    const fPos = new Float32Array(fCount * 3);
    const fNor = new Float32Array(fCount * 3);
    const fCol = new Float32Array(fCount * 3);
    for (let i = 0; i < fCount; i++) fNor[i * 3 + 2] = 1;

    const fIdx = [];
    for (let i = 0; i < cols - 1; i++) {
      for (let j = 0; j < ROWS - 1; j++) {
        const a = i * ROWS + j;
        const b = (i + 1) * ROWS + j;
        const c = (i + 1) * ROWS + j + 1;
        const d = i * ROWS + j + 1;
        fIdx.push(a, d, b, b, d, c); // caras mirando a +Z
      }
    }
    this.frontGeo = new THREE.BufferGeometry();
    this.frontGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    this.frontGeo.setAttribute('normal', new THREE.BufferAttribute(fNor, 3));
    this.frontGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
    this.frontGeo.setIndex(fIdx);

    // --- superficie superior: 2 vertices por columna (z = 0 y z = -depth)
    const tCount = cols * 2;
    this.topGeo = new THREE.BufferGeometry();
    this.topGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tCount * 3), 3));
    this.topGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tCount * 3), 3));
    this.topGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tCount * 3), 3));
    const tIdx = [];
    for (let i = 0; i < cols - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      tIdx.push(a, c, b, b, c, d); // normales hacia +Y
    }
    this.topGeo.setIndex(tIdx);
  }

  /** Oclusion de horizonte barata: cuanto cielo tapan los vecinos. */
  _computeAO(i) {
    const h = this.heights;
    const hi = h[i];
    let maxSlope = 0;
    for (let k = 1; k <= AO_WINDOW; k++) {
      const d = k * this.dx;
      const sl = (h[Math.max(0, i - k)] - hi) / d;
      const sr = (h[Math.min(this.cols - 1, i + k)] - hi) / d;
      if (sl > maxSlope) maxSlope = sl;
      if (sr > maxSlope) maxSlope = sr;
    }
    return 1 - AO_STRENGTH * (Math.atan(maxSlope) / (Math.PI / 2));
  }

  /** Reescribe posiciones, normales y colores de un rango de columnas. */
  rebuild(from, to) {
    const i0 = Math.max(0, from);
    const i1 = Math.min(this.cols - 1, to);

    for (let i = i0; i <= i1; i++) this.ao[i] = this._computeAO(i);

    const fPos = this.frontGeo.attributes.position.array;
    const fCol = this.frontGeo.attributes.color.array;
    const tPos = this.topGeo.attributes.position.array;
    const tNor = this.topGeo.attributes.normal.array;
    const tCol = this.topGeo.attributes.color.array;
    const tmp = new THREE.Color();

    for (let i = i0; i <= i1; i++) {
      const x = this.x0 + i * this.dx;
      const h = this.heights[i];
      const ao = this.ao[i];
      const span = h - this.baseY;

      // --- cara frontal
      for (let j = 0; j < ROWS; j++) {
        const t = j / (ROWS - 1);
        const depth = span * Math.pow(t, ROW_BIAS); // 0 en superficie, span en la base
        const k = (i * ROWS + j) * 3;
        fPos[k + 0] = x;
        fPos[k + 1] = h - depth;
        fPos[k + 2] = this.zFront;

        // estrato: cuerpo cerca de la superficie, socavon abajo
        const band = smoothstep(BAND_DEPTH * 0.55, BAND_DEPTH * 1.25, depth);
        tmp.copy(this.body).lerp(this.deep, band);

        // la AO solo muerde cerca de la superficie; el fondo ya es oscuro
        const aoMix = lerp(1, ao, 1 - smoothstep(0, AO_FADE_DEPTH, depth));
        // ...y el fondo se hunde en valor para que retroceda y la banda de
        // accion (cresta + primeros metros) se lea contra el.
        const sink = 1 - SINK * smoothstep(BAND_DEPTH, SINK_DEPTH, depth);
        const shade = aoMix * sink;
        fCol[k + 0] = tmp.r * shade;
        fCol[k + 1] = tmp.g * shade;
        fCol[k + 2] = tmp.b * shade;
      }

      // --- superficie superior
      const hl = this.heights[Math.max(0, i - 1)];
      const hr = this.heights[Math.min(this.cols - 1, i + 1)];
      const dhdx = (hr - hl) / (2 * this.dx);
      const nlen = Math.hypot(dhdx, 1);
      const nx = -dhdx / nlen;
      const ny = 1 / nlen;

      const kf = i * 2 * 3;
      const kb = (i * 2 + 1) * 3;
      tPos[kf + 0] = x; tPos[kf + 1] = h; tPos[kf + 2] = this.zFront;
      tPos[kb + 0] = x; tPos[kb + 1] = h; tPos[kb + 2] = this.zBack;
      tNor[kf + 0] = nx; tNor[kf + 1] = ny; tNor[kf + 2] = 0;
      tNor[kb + 0] = nx; tNor[kb + 1] = ny; tNor[kb + 2] = 0;

      // La cresta se apaga en pendiente fuerte: la arena no se queda en la pared.
      const steep = smoothstep(0.55, 1.5, Math.abs(dhdx));
      tmp.copy(this.crest).lerp(this.body, steep);
      const r = tmp.r * ao;
      const g = tmp.g * ao;
      const b = tmp.b * ao;
      tCol[kf + 0] = r; tCol[kf + 1] = g; tCol[kf + 2] = b;
      // el borde trasero cae un poco: insinua el grosor sin una cara extra
      tCol[kb + 0] = r * 0.8; tCol[kb + 1] = g * 0.8; tCol[kb + 2] = b * 0.8;
    }

    this.frontGeo.attributes.position.needsUpdate = true;
    this.frontGeo.attributes.color.needsUpdate = true;
    this.topGeo.attributes.position.needsUpdate = true;
    this.topGeo.attributes.normal.needsUpdate = true;
    this.topGeo.attributes.color.needsUpdate = true;

    this.frontGeo.computeBoundingSphere();
    this.topGeo.computeBoundingSphere();
  }
}
