import * as THREE from 'three';

/**
 * Sombreado de bandas y contorno. Las dos mitades de «cartoon vectorial en 3D».
 *
 * ── BANDAS ──────────────────────────────────────────────────────────────
 * `ARTE.md` §1.6 prohibe degradados. En 3D eso es `MeshToonMaterial` con un
 * `gradientMap` de TRES paradas, y **una sola rampa para todo el juego**: si
 * aparece un segundo material toon, dos vehiculos dejan de ser familia sin que
 * nadie lo note (docs/CHECKLIST-REVISION.md §1).
 *
 * Las paradas no son 0 / 128 / 255. `MeshToonMaterial` MULTIPLICA el color por
 * la rampa, asi que con 0 la banda oscura saldria negra. Los valores de abajo
 * son las razones medidas entre los tres tonos de la referencia tomando la
 * banda clara como 1:
 *
 *      oscuro/claro = 0,56      base/claro = 0,80      claro/claro = 1,00

 * Un pelo mas abiertas que las razones medidas (0,62 y 0,83): en la plancha la
 * separacion la reparten tambien el contorno y la banda oscura pintada a mano,
 * y en 3D las bandas tienen que sostenerla solas.
 *
 * y por eso el color por vertice guarda `claro(base)`, no `base`.
 *
 * ── CONTORNO ────────────────────────────────────────────────────────────
 * Shell de casco invertido, no postprocesado: `OutlinePass` cuesta una pasada
 * de pantalla entera y el presupuesto son 16,7 ms.
 *
 * El desplazamiento va en el vertex shader, a lo largo de la normal en espacio
 * de VISTA y medido en PIXELES. Escalando el objeto, el contorno engorda al
 * hacer zoom; asi es constante en pantalla, que es la unica forma de que los
 * quince se vean con el mismo trazo a 0,55x y a 2,6x.
 */

let rampa = null;

/** La unica rampa del juego. Tres paradas, `NearestFilter`, 3x1 px. */
export function gradienteToon() {
  if (rampa) return rampa;
  rampa = new THREE.DataTexture(new Uint8Array([142, 205, 255]), 3, 1, THREE.RedFormat);
  rampa.minFilter = THREE.NearestFilter;
  rampa.magFilter = THREE.NearestFilter;
  rampa.generateMipmaps = false;
  rampa.needsUpdate = true;
  return rampa;
}

let relleno = null;

/**
 * El unico material de relleno. Color por vertice, plano y sin mapas.
 * `flatShading` porque el bisel de una arista se MODELA; no se interpola.
 */
export function materialRelleno() {
  if (relleno) return relleno;
  // Sin `flatShading`: `MeshToonMaterial` no lo admite, y no hace falta — el
  // corte entre bandas ya lo da la rampa de tres paradas con `NearestFilter`.
  // El bisel de una arista se MODELA (`primitivas.BISEL`); no se interpola.
  relleno = new THREE.MeshToonMaterial({
    color: 0xffffff,
    vertexColors: true,
    gradientMap: gradienteToon(),
  });
  return relleno;
}

const contornos = [];

/**
 * Material del shell. Lee el color del contorno de un atributo propio, asi que
 * la misma geometria sirve para el relleno y para el contorno sin duplicarla.
 *
 * @param {number} grosorPx 3 en nivel A, 2 en nivel B. Nada por debajo de 2:
 *   a 1 px el contorno parpadea con el antialias y el vehiculo se ve sucio en
 *   movimiento.
 */
export function materialContorno(grosorPx = 3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uGrosorPx: { value: grosorPx },
      uUnidadesPorPixel: { value: 0.01 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 contorno;
      uniform float uGrosorPx;
      uniform float uUnidadesPorPixel;
      varying vec3 vColor;
      void main() {
        vColor = contorno;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        p.xyz += n * uGrosorPx * uUnidadesPorPixel;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, 1.0); }`,
  });
  contornos.push(mat);
  return mat;
}

/**
 * Cuantas unidades de mundo mide un pixel. Con camara ortografica es constante
 * en todo el cuadro, asi que basta un escalar y se puede calcular sin proyectar.
 *
 * Hay que llamarlo al redimensionar y al cambiar el zoom; si no, el contorno
 * mantiene el grosor de la ventana anterior.
 */
export function actualizarContorno(camara, alturaPx) {
  if (!alturaPx) return;
  const u = (camara.top - camara.bottom) / alturaPx / (camara.zoom || 1);
  for (const m of contornos) m.uniforms.uUnidadesPorPixel.value = u;
}

/** Solo para los tests: cuantos materiales toon se han creado. */
export const _materialesToon = () => (relleno ? 1 : 0);
