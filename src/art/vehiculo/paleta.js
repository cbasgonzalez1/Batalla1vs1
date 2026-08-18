/**
 * Paleta de vehiculos. Puro: no importa Three y no toca el DOM.
 *
 * Lo que se escribe aqui es el FACTOR de `tono()`, nunca el hex. Asi cambiar el
 * color de un bando no obliga a recalcular cinco derivados a mano, y anadir un
 * tercer bando es una linea.
 *
 * Los cuatro factores salen de MEDIR la imagen de referencia aprobada, no de
 * estimarla: casco #7D8B4E, banda clara #96A560, mancha #6B7A41, banda oscura
 * #5E6A38 y contorno #2B3419 (docs/ARTE-VEHICULOS.md §12).
 */

const hexARgb = (hex) => {
  const h = typeof hex === 'number' ? hex.toString(16).padStart(6, '0') : hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const rgbANumero = (r, g, b) => {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
};

function rgbAHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / d + 2) / 6
      : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslARgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [canal(h + 1 / 3) * 255, canal(h) * 255, canal(h - 1 / 3) * 255];
}

/**
 * Aclara (f > 0) u oscurece (f < 0) en HSL, nunca en RGB: en RGB oscurecer un
 * verde oliva lo manda al marron y los quince vehiculos dejarian de ser familia.
 * Devuelve un entero 0xRRGGBB, que es lo que come Three.
 */
export function tono(base, f) {
  const [r, g, b] = hexARgb(base);
  const [h, s, l] = rgbAHsl(r, g, b);
  const l2 = f >= 0 ? l + f * (1 - l) : l * (1 + f);
  return rgbANumero(...hslARgb(h, s, Math.max(0, Math.min(1, l2))));
}

export const claro = (c) => tono(c, 0.18);
export const camuflaje = (c) => tono(c, -0.13);
export const oscuro = (c) => tono(c, -0.24);
export const contorno = (c) => tono(c, -0.65);

/**
 * Un solo color base por bando. Contorno, bandas y camuflaje se calculan de el,
 * asi que un bando no puede salir con el contorno del otro.
 * Prohibido distinguir bandos con banda de reconocimiento, estrella o bandera:
 * el color basta y es legible a 0,55x de zoom.
 */
export const BANDOS = {
  a: { base: 0x7d8b4e, nombre: 'oliva' },
  b: { base: 0x5c7d92, nombre: 'acero' },
};

/**
 * Materia que NO se tine del bando. Es lo que evita que el vehiculo se lea como
 * una figura recortada de un solo color.
 */
export const MATERIA = {
  cinta: 0x292a24,     // la banda de oruga
  llanta: 0x5e5e54,
  buje: 0x4a4a42,
  caucho: 0x4a4a42,
  acero: 0x6a7a82,     // tubo, herrajes
  lona: 0x8a7a52,
  madera: 0xb07f43,
};
