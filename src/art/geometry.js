import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp } from '../core/mathx.js';

/**
 * Caja con bisel real. La direccion de arte prohibe aristas vivas: toda pieza
 * lleva bisel para que la key lo capte y se lea el volumen.
 *
 * Proyecta cada vertice de una BoxGeometry subdividida sobre la superficie
 * offset del cuboide interior, que es exactamente un cuboide redondeado.
 */
export function roundedBoxGeometry(w, h, d, radius = 0.25, segments = 5) {
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  let geo = new THREE.BoxGeometry(w, h, d, segments, segments, segments);

  // Soldar los vertices de las costuras para que las normales salgan suaves
  // en las esquinas redondeadas en vez de facetadas.
  geo = mergeVertices(geo, 1e-5);

  const pos = geo.attributes.position;
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const hd = d / 2 - r;
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    inner.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
    v.sub(inner);
    const len = v.length();
    if (len > 1e-6) v.multiplyScalar(r / len);
    v.add(inner);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Textura de punto para la trayectoria y el proyectil: nucleo blanco, cuerpo
 * de acento y anillo oscuro. El anillo es lo que garantiza que el punto se
 * separe del terreno por valor, no solo por tono.
 */
export function makeDotTexture(accentCss, rimCss = '#0A0D14') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,1)');
  g.addColorStop(0.34, hexToRgba(accentCss, 1));
  g.addColorStop(0.52, hexToRgba(accentCss, 1));
  g.addColorStop(0.6, hexToRgba(rimCss, 0.92));
  g.addColorStop(0.72, hexToRgba(rimCss, 0.55));
  g.addColorStop(1.0, hexToRgba(rimCss, 0));

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Mancha blanda con caida cuadratica: humo, polvo, chispa y trazadora salen
 * todos de aqui. Es blanca a proposito — el color lo pone cada particula, asi
 * que una sola textura sirve para los dos sistemas y no hay que subir mas.
 */
export function makeSoftTexture(dureza = 0.0) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(clamp(dureza, 0, 0.9), 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  return texturaDe(canvas);
}

/**
 * Fogonazo de boca: nucleo hirviendo y seis chorros.
 *
 * Los chorros no son adorno. Un canon con freno de boca escupe de lado, y esa
 * estrella asimetrica es lo que distingue el disparo de una simple luz que se
 * enciende. Dura 70 ms, asi que la forma tiene que llegar en cuatro cuadros.
 */
export function makeFlashTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  ctx.translate(c, c);
  ctx.globalCompositeOperation = 'lighter';

  // Chorros: mas largos a los lados que arriba y abajo, como el freno de boca.
  const rayos = [
    [0, 1.0], [Math.PI, 1.0],
    [Math.PI / 2, 0.52], [-Math.PI / 2, 0.52],
    [Math.PI / 4, 0.72], [-Math.PI / 4, 0.72],
    [(3 * Math.PI) / 4, 0.72], [(-3 * Math.PI) / 4, 0.72],
  ];
  for (const [ang, largo] of rayos) {
    ctx.save();
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, c * largo, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(255,236,190,0.45)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -c * 0.09);
    ctx.lineTo(c * largo, 0);
    ctx.lineTo(0, c * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Nucleo: blanco al rojo, mas pequeño que los chorros.
  const nucleo = ctx.createRadialGradient(0, 0, 0, 0, 0, c * 0.42);
  nucleo.addColorStop(0, 'rgba(255,255,255,1)');
  nucleo.addColorStop(0.4, 'rgba(255,230,160,0.9)');
  nucleo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = nucleo;
  ctx.beginPath();
  ctx.arc(0, 0, c * 0.42, 0, Math.PI * 2);
  ctx.fill();

  return texturaDe(canvas);
}

/**
 * Grano de tierra: una textura casi blanca que multiplica al color del vertice.
 *
 * Hace falta porque cada estrato del terreno es un color perfectamente plano y
 * eso se lee como plastico moldeado, no como tierra. El primer intento fue
 * moteado POR VERTICE, y salio peor: la cara frontal solo tiene 18 filas, asi
 * que el ruido se interpolaba en regueros verticales de medio metro y parecia
 * un fallo de video. A nivel de pixel, con la textura repetida en coordenadas
 * de mundo, el grano se queda del tamaño que tiene que estar y no se estira
 * cuando el terreno se deforma.
 *
 * Va en espacio lineal y centrada muy arriba (0.88 a 1.0): es un multiplicador,
 * no un color. Una textura gris media apagaria el terreno entero.
 *
 * El azar es un LCG fijo y no `Math.random`: la textura tiene que salir
 * identica en los seis moviles y en cada recarga. No cambia el resultado de
 * ninguna partida —es decorado—, pero una repeticion con otro grano no es la
 * misma repeticion.
 */
export function makeGrainTexture() {
  let semilla = 0x2f6e2b1;
  const azar = () => {
    semilla = (semilla * 1664525 + 1013904223) >>> 0;
    return semilla / 4294967296;
  };

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  // Dos escalas: manchas anchas de humedad y el picoteo fino de la arena.
  const manchas = new Float32Array(size * size);
  const lado = 16;
  const gruesa = new Float32Array(lado * lado);
  for (let i = 0; i < gruesa.length; i++) gruesa[i] = azar();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * lado;
      const fy = (y / size) * lado;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const en = (a, b) => gruesa[(b % lado) * lado + (a % lado)];
      const s = (t) => t * t * (3 - 2 * t);
      const a = en(x0, y0) + (en(x0 + 1, y0) - en(x0, y0)) * s(tx);
      const b = en(x0, y0 + 1) + (en(x0 + 1, y0 + 1) - en(x0, y0 + 1)) * s(tx);
      manchas[y * size + x] = a + (b - a) * s(ty);
    }
  }

  for (let i = 0; i < size * size; i++) {
    const v = 0.72 * manchas[i] + 0.28 * azar();
    const c = Math.round(224 + v * 31); // 224..255
    img.data[i * 4] = c;
    img.data[i * 4 + 1] = c;
    img.data[i * 4 + 2] = c;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

function texturaDe(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/** Fondo: degradado vertical del bioma como textura de escena. */
export function makeSkyTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  const n = stops.length - 1;
  stops.forEach((s, i) => g.addColorStop(i / n, s));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
