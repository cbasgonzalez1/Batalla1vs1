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
