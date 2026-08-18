/**
 * Decorado: la biblioteca de piezas y el motor que las coloca.
 *
 * Las tres cosas que estaban mal y que este fichero existe para arreglar:
 *
 * 1. PIEZAS SUPERPUESTAS. Antes cada pieza se plantaba en una x escrita a mano
 *    y nadie comprobaba si ahi ya habia algo. El resultado eran tocones encima
 *    del blindado y alambre cruzando las cajas. Ahora todo pasa por `Reserva`,
 *    que lleva la cuenta de lo ocupado y NIEGA la colocacion si no cabe.
 * 2. OBJETOS FLOTANDO. Toda pieza se asienta muestreando el terreno en SU x, y
 *    las que ocupan un tramo se asientan en el punto mas bajo del tramo para que
 *    no queden en voladizo. Y todas llevan sombra de contacto.
 * 3. DECORADO GENERICO. Un teatro no es una paleta: es un sitio. Cada uno
 *    declara sus familias en `paleta.js` y aqui estan las catorce, de forma que
 *    Normandia sale con setos de bocage y la llanura del Bzura con almiares.
 */

import {
  caminoRedondeado, circulo, caja, camino, grupo, polilinea, siluetaUnica,
} from './primitivas.js';
import { mezcla, tono, claro, oscuro, contorno, MATERIA, TINTE_TEATRO } from './paleta.js';

// ── colocacion ────────────────────────────────────────────────────────────

/**
 * Lleva la cuenta de los tramos de x ocupados. Es lo unico que impide que dos
 * piezas se pisen, y por eso se reservan PRIMERO los blindados y el hito: son
 * intocables, y el decorado se acomoda a ellos y no al reves.
 */
export function crearReserva(x0, x1) {
  const usados = [];
  return {
    ocupar(cx, ancho) {
      usados.push([cx - ancho / 2, cx + ancho / 2]);
      usados.sort((a, b) => a[0] - b[0]);
    },
    /** Los tramos que quedan libres, ya con el margen descontado. */
    libres(margen = 0.5) {
      const out = [];
      let c = x0;
      for (const [a, b] of usados) {
        if (a - margen > c) out.push([c, a - margen]);
        c = Math.max(c, b + margen);
      }
      if (c < x1) out.push([c, x1]);
      return out;
    },
    /**
     * Coloca una pieza de `ancho` en un hueco de verdad.
     *
     * La version anterior probaba a los lados de una x pedida y se rendia a las
     * cinco unidades. Con dos emplazamientos y un hito reservados, casi todo el
     * campo cae fuera de ese alcance y el teatro salia vacio: de cuatro familias
     * se colocaba una. Ahora se calculan los tramos libres y se sortea uno
     * PONDERADO POR TAMANO, que ademas reparte las piezas por el campo en vez de
     * amontonarlas todas en el hueco mayor.
     */
    colocar(ancho, rng, margen = 0.6) {
      const cabe = this.libres(margen).filter(([a, b]) => b - a >= ancho);
      if (!cabe.length) return null;
      const total = cabe.reduce((s, [a, b]) => s + (b - a), 0);
      let u = rng() * total;
      for (const [a, b] of cabe) {
        if (u < b - a) return a + ancho / 2 + rng() * (b - a - ancho);
        u -= b - a;
      }
      return null;
    },
  };
}

// ── utilidades de pieza ───────────────────────────────────────────────────

/** Tinte de teatro: sin el, una viga de madera es la misma en Paris y en Alamein. */
export const tenir = (c, t) => mezcla(c, t.cuerpo, TINTE_TEATRO);

/** Un cuerpo con contorno unico, tres tonos y su sombra de contacto. */
function pieza(formas, base, { y = 0, ancho = 0, grosor = 0.09, dentro = '', ry = 0.13 } = {}) {
  const sombra = ancho
    ? `<ellipse cx="0" cy="${y.toFixed(2)}" rx="${(ancho / 2).toFixed(2)}" ry="${ry}" fill="#000" opacity="0.18" transform="translate(0 0)"/>`
    : '';
  return sombra + siluetaUnica({
    formas, cont: contorno(base), tonoClaro: claro(base), tonoBase: base,
    grosor, luz: [0.09, -0.13], dentro,
  });
}

/** Sombra de contacto en una x y una y cualesquiera. */
const sombraEn = (cx, y, ancho, ry = 0.13) =>
  `<ellipse cx="${cx.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(ancho / 2).toFixed(2)}" ry="${ry}" fill="#000" opacity="0.18"/>`;

/** El punto mas bajo del tramo. Lo que se apoya en dos puntos se apoya en el bajo. */
const bajoDe = (suelo, x0, x1) => {
  let m = Infinity;
  for (let x = x0; x <= x1; x += 0.25) m = Math.min(m, suelo(x));
  return m;
};

/**
 * Borde inferior que SIGUE el terreno, de izquierda a derecha.
 *
 * Una pieza ancha —un seto, un terraplen, una barricada— con la base recta
 * apoya en el punto mas alto y queda en voladizo en el resto: se ve una tabla
 * flotando. Todo lo que ocupe mas de dos unidades se asienta con esto.
 */
const baseTerreno = (suelo, x0, x1, hunde = 0.12) => {
  const pts = [];
  for (let x = x0; x <= x1 + 0.01; x += 0.3) pts.push([x, suelo(Math.min(x, x1)) - hunde]);
  return pts;
};

// ── las catorce familias ──────────────────────────────────────────────────

/**
 * Tocon astillado. Tronco tronchado con la fractura en puntas DESIGUALES, banda
 * de corteza oscura en el flanco derecho y el interior de la rotura en claro:
 * la madera fresca de dentro es lo que dice que se rompio hace poco.
 */
function tocon(cx, suelo, t, rng, e = 1) {
  const c = tenir(MATERIA.madera, t);
  const y = suelo(cx);
  const h = (1.05 + rng() * 0.45) * e, w = 0.34 * e;
  const puntas = [0.0, 0.34, 0.1, 0.26, -0.05].map((k, i) => [cx - w + (2 * w * i) / 4, y + h + k * e]);
  let s = sombraEn(cx, y, w * 3.4);
  s += pieza([
    caminoRedondeado([[cx - w * 0.95, y], [cx + w * 0.95, y], [cx + w * 0.82, y + h * 0.55], ...puntas.reverse()], 0.05),
    // raiz a un lado: la asimetria es lo que lo hace objeto y no icono
    caminoRedondeado([[cx - w, y + 0.06], [cx - w - 0.5 * e, y - 0.02], [cx - w - 0.34 * e, y + 0.24 * e], [cx - w, y + 0.34 * e]], 0.08),
  ], c, {
    dentro:
      camino(caja(cx + w * 0.3, y - 0.2, w * 1.2, h + 1, 0), { fill: oscuro(c) })
      + camino(caja(cx - w, y + h - 0.12 * e, w * 2, 0.6 * e, 0), { fill: tono(c, 0.3) }),
  });
  return s;
}

/** Abeto nevado: tres pisos, tronco corto y capa blanca en cada piso. */
function abeto(cx, suelo, t, rng, nieve = true) {
  const y = suelo(cx);
  const h = 2.4 + rng() * 1.1, w = 0.85 + rng() * 0.25;
  const verde = mezcla('#3f5c33', t.cuerpo, 0.2);
  let s = sombraEn(cx, y, w * 2.2);
  s += pieza([caja(cx - 0.13, y, 0.26, h * 0.3, 0.05)], tenir(MATERIA.madera, t), { grosor: 0.07 });
  const pisos = [];
  for (let i = 0; i < 3; i++) {
    const b = y + h * (0.22 + i * 0.24), a = w * (1 - i * 0.24);
    pisos.push(caminoRedondeado([[cx - a, b], [cx + a, b], [cx, b + h * 0.36]], 0.14));
  }
  let dentro = '';
  if (nieve) {
    for (let i = 0; i < 3; i++) {
      const b = y + h * (0.22 + i * 0.24), a = w * (1 - i * 0.24);
      dentro += camino(caminoRedondeado([[cx - a, b + h * 0.13], [cx + a, b + h * 0.13], [cx, b + h * 0.4]], 0.14), { fill: '#eef4f8' });
    }
  }
  s += pieza(pisos, verde, { dentro });
  return s;
}

/**
 * Seto de bocage: caballon de tierra con la mata encima. No es un arbusto — es
 * un terraplen, y por eso corta el campo. Es la pieza que dice «Normandia».
 */
function seto(cx, suelo, t, rng, largo = 7) {
  const a = cx - largo / 2, b = cx + largo / 2;
  const tierra = mezcla(t.socavon, t.cuerpo, 0.35);
  const verde = mezcla('#4d6b2f', t.cuerpo, 0.22);
  const base = baseTerreno(suelo, a, b);
  let s = sombraEn(cx, bajoDe(suelo, a, b), largo * 1.02, 0.16);
  s += pieza([polilinea([...base,
    [b - 0.45, suelo(b) + 0.9], [a + 0.45, suelo(a) + 0.9]]) + 'Z'], tierra, { grosor: 0.1 });
  const matas = [];
  const n = Math.max(4, Math.round(largo / 1.4));
  for (let i = 0; i < n; i++) {
    const x = a + 0.55 + ((largo - 1.1) * i) / (n - 1);
    matas.push(circulo(x, suelo(x) + 1.2 + rng() * 0.32, 0.66 + rng() * 0.26));
  }
  s += pieza(matas, verde, { grosor: 0.1 });
  return s;
}

/**
 * Alambrada. Piquetes de altura e inclinacion desiguales, alambre que CUELGA
 * entre ellos y puas como trazos perpendiculares. La version anterior dibujaba
 * el alambre discontinuo, y a la vista eran rayas sueltas flotando: lo que se
 * lee como espinoso es el hilo entero con la pua marcada, no el hilo roto.
 */
function alambrada(cx, suelo, t, rng, tramos = 4) {
  const c = tenir(MATERIA.metal, t);
  const paso = 2.0;
  const x0 = cx - (tramos * paso) / 2;
  let s = '', postes = [];
  for (let i = 0; i <= tramos; i++) {
    const x = x0 + i * paso + (rng() - 0.5) * 0.3;
    const y = suelo(x);
    const alto = 1.05 + rng() * 0.45;
    const caido = i === tramos - 1;
    const cima = caido ? [x + alto * 0.75, y + alto * 0.28] : [x, y + alto];
    postes.push({ pie: [x, y], cima });
    s += sombraEn(x, y, 0.55, 0.09);
    s += pieza([caminoRedondeado([
      [x - 0.07, y], [x + 0.07, y], [cima[0] + 0.07, cima[1]], [cima[0] - 0.07, cima[1]],
    ], 0.05)], c, { grosor: 0.06 });
  }
  const hilo = contorno(c);
  for (let i = 1; i < postes.length; i++) {
    const a = postes[i - 1], b = postes[i];
    for (let k = 0; k < 3; k++) {
      const f = 0.94 - k * 0.3;
      const ya = a.pie[1] + (a.cima[1] - a.pie[1]) * f;
      const yb = b.pie[1] + (b.cima[1] - b.pie[1]) * f;
      const mx = (a.cima[0] + b.cima[0]) / 2, my = (ya + yb) / 2 - 0.22;
      s += `<path d="M${a.cima[0].toFixed(2)} ${ya.toFixed(2)}Q${mx.toFixed(2)} ${my.toFixed(2)} ${b.cima[0].toFixed(2)} ${yb.toFixed(2)}" fill="none" stroke="${hilo}" stroke-width="0.055"/>`;
      // puas: trazos cortos perpendiculares, no el hilo roto
      for (let p = 1; p <= 3; p++) {
        const u = p / 4;
        const px = a.cima[0] + (b.cima[0] - a.cima[0]) * u;
        const py = (1 - u) ** 2 * ya + 2 * (1 - u) * u * my + u * u * yb;
        s += `<path d="M${(px - 0.09).toFixed(2)} ${(py - 0.09).toFixed(2)}L${(px + 0.09).toFixed(2)} ${(py + 0.09).toFixed(2)}M${(px - 0.09).toFixed(2)} ${(py + 0.09).toFixed(2)}L${(px + 0.09).toFixed(2)} ${(py - 0.09).toFixed(2)}" stroke="${hilo}" stroke-width="0.05"/>`;
      }
    }
  }
  return s;
}

/**
 * Erizo checo: tres vigas que se cruzan en el centro y apoyan las seis puntas
 * en el suelo. La primera version las dibujaba desde el suelo hacia arriba y
 * salia una estrella plana; un erizo es un volumen, y lo que lo dice es que las
 * vigas se crucen por el medio.
 */
function erizo(cx, suelo, t, rng) {
  const c = tenir(MATERIA.metal, t);
  const y = suelo(cx);
  const L = 1.9, g = 0.15, cy = y + L * 0.42;
  const f = [0.62, 1.62, 2.62].map((a) => {
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2;
    const nx = -Math.sin(a) * g, ny = Math.cos(a) * g;
    return caminoRedondeado([
      [cx - dx + nx, cy - dy + ny], [cx + dx + nx, cy + dy + ny],
      [cx + dx - nx, cy + dy - ny], [cx - dx - nx, cy - dy - ny],
    ], 0.06);
  });
  return sombraEn(cx, y, L * 1.1, 0.11) + pieza(f, c, { grosor: 0.08 });
}

/** Almiar: cono de paja con el palo central. Dice «campo cosechado». */
function almiar(cx, suelo, t, rng) {
  const c = mezcla('#d9b962', t.cuerpo, 0.25);
  const y = suelo(cx);
  const h = 1.9 + rng() * 0.6, w = 1.15 + rng() * 0.3;
  let s = sombraEn(cx, y, w * 2.3, 0.14);
  s += pieza([caminoRedondeado([
    [cx - w, y], [cx + w, y], [cx + w * 0.72, y + h * 0.55], [cx + w * 0.2, y + h], [cx - w * 0.28, y + h * 0.96], [cx - w * 0.78, y + h * 0.5],
  ], 0.3)], c, {
    dentro: [0.25, 0.5, 0.75].map((k) =>
      camino(polilinea([[cx - w, y + h * k], [cx + w, y + h * k]]), { stroke: oscuro(c), 'stroke-width': 0.05, 'stroke-dasharray': '0.4 0.28', fill: 'none' })).join(''),
  });
  // el palo va DESPUES del cono: dibujado antes queda tapado y el almiar pierde
  // lo unico que lo distingue de un monton de tierra
  s += pieza([caja(cx - 0.07, y + h * 0.86, 0.14, 0.62, 0.04)], tenir(MATERIA.madera, t), { grosor: 0.06 });
  return s;
}

/** Poste de telegrafo: dos crucetas con aisladores, inclinado. */
function poste(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  const y = suelo(cx);
  const h = 3.1 + rng() * 0.8;
  const inc = (rng() - 0.5) * 0.9;
  const cima = [cx + inc, y + h];
  const f = [caminoRedondeado([[cx - 0.11, y], [cx + 0.11, y], [cima[0] + 0.1, cima[1]], [cima[0] - 0.1, cima[1]]], 0.06)];
  for (const k of [0.82, 0.94]) {
    const bx = cx + inc * k, by = y + h * k;
    f.push(caminoRedondeado([[bx - 0.62, by], [bx + 0.62, by], [bx + 0.62, by + 0.12], [bx - 0.62, by + 0.12]], 0.05));
  }
  let s = sombraEn(cx, y, 0.8, 0.09) + pieza(f, c, { grosor: 0.07 });
  const m = tenir(MATERIA.metal, t);
  for (const k of [0.82, 0.94]) {
    const bx = cx + inc * k, by = y + h * k;
    for (const d of [-0.46, 0, 0.46]) s += camino(circulo(bx + d, by + 0.2, 0.08, 10), { fill: contorno(m) });
  }
  return s;
}

/** Farola: fuste alto, brazo curvo y la luminaria. Solo en Paris. */
function farola(cx, suelo, t, rng) {
  const c = tenir(MATERIA.metal, t);
  const y = suelo(cx);
  const h = 3.4;
  const f = [
    caminoRedondeado([[cx - 0.24, y], [cx + 0.24, y], [cx + 0.16, y + 0.34], [cx - 0.16, y + 0.34]], 0.06),
    caminoRedondeado([[cx - 0.09, y + 0.3], [cx + 0.09, y + 0.3], [cx + 0.09, y + h], [cx - 0.09, y + h]], 0.05),
    caminoRedondeado([[cx - 0.05, y + h], [cx + 0.62, y + h - 0.1], [cx + 0.62, y + h - 0.34], [cx - 0.05, y + h - 0.34]], 0.14),
    caminoRedondeado([[cx + 0.36, y + h - 0.9], [cx + 0.86, y + h - 0.9], [cx + 0.72, y + h - 0.16], [cx + 0.5, y + h - 0.16]], 0.08),
  ];
  return sombraEn(cx, y, 0.9, 0.09) + pieza(f, c, { grosor: 0.07 });
}

/** Escombro: bloques irregulares con la junta de ladrillo marcada. */
function escombro(cx, suelo, t, rng, ancho = 3.4) {
  const c = mezcla('#a8603f', t.cuerpo, 0.3);
  const y = bajoDe(suelo, cx - ancho / 2, cx + ancho / 2);
  const alto = 0.7 + rng() * 0.5;
  let s = sombraEn(cx, y, ancho * 1.05, 0.14);
  s += pieza([caminoRedondeado([
    [cx - ancho / 2, y], [cx + ancho / 2, y],
    [cx + ancho * 0.28, y + alto * 0.72], [cx + ancho * 0.04, y + alto],
    [cx - ancho * 0.2, y + alto * 0.62], [cx - ancho * 0.38, y + alto * 0.84],
  ], 0.16)], c, { grosor: 0.1 });
  // bloques sueltos al pie, y una barra de hierro asomando
  for (let i = 0; i < 4; i++) {
    const bx = cx - ancho / 2 + rng() * ancho, by = y + rng() * alto * 0.5;
    s += pieza([caja(bx, by, 0.34 + rng() * 0.2, 0.2, 0.05)], oscuro(c), { grosor: 0.07 });
  }
  s += camino(polilinea([[cx + ancho * 0.1, y + alto * 0.9], [cx + ancho * 0.3, y + alto * 1.35]]), {
    stroke: contorno(tenir(MATERIA.metal, t)), 'stroke-width': 0.07, fill: 'none', 'stroke-linecap': 'round',
  });
  return s;
}

/** Barricada de adoquines: hiladas de piedra levantada del propio empedrado. */
function barricada(cx, suelo, t, rng, ancho = 3.6) {
  const c = mezcla('#8d8b86', t.cuerpo, 0.22);
  const y = bajoDe(suelo, cx - ancho / 2, cx + ancho / 2);
  let s = sombraEn(cx, y, ancho * 1.05, 0.14);
  const filas = 4;
  for (let fi = 0; fi < filas; fi++) {
    const w = ancho * (1 - fi * 0.13);
    const n = Math.max(3, Math.round(w / 0.62));
    for (let i = 0; i < n; i++) {
      const bx = cx - w / 2 + (w / n) * (i + 0.5);
      const by = (fi === 0 ? suelo(bx) - 0.06 : y + 0.28) + fi * 0.32;
      s += pieza([caja(bx - w / n / 2 + 0.03, by, w / n - 0.06, 0.3, 0.06)], c, { grosor: 0.065 });
    }
  }
  return s;
}

/** Bidones: cilindro con dos aros. La tapa eliptica es lo que le da volumen. */
function bidones(cx, suelo, t, rng, n = 2) {
  const c = mezcla('#6f7a5e', t.cuerpo, 0.25);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * 0.92;
    const y = suelo(x);
    const h = 1.05, w = 0.38;
    s += sombraEn(x, y, w * 2.4, 0.1);
    s += pieza([caminoRedondeado([[x - w, y], [x + w, y], [x + w, y + h], [x - w, y + h]], 0.16)], c, {
      grosor: 0.075,
      dentro: [0.28, 0.68].map((k) =>
        camino(polilinea([[x - w, y + h * k], [x + w, y + h * k]]), { stroke: contorno(c), 'stroke-width': 0.07, fill: 'none' })).join(''),
    });
  }
  return s;
}

/** Cajas de municion apiladas, con los listones marcados. */
function cajas(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  const y = bajoDe(suelo, cx - 0.9, cx + 0.9);
  let s = sombraEn(cx, y, 2.0, 0.12);
  const lista = (x, yy, w, h) => pieza([caja(x, yy, w, h, 0.07)], c, {
    grosor: 0.075,
    dentro: camino(polilinea([[x, yy + h * 0.5], [x + w, yy + h * 0.5]]), { stroke: contorno(c), 'stroke-width': 0.05, fill: 'none' }),
  });
  s += lista(cx - 0.86, y, 0.9, 0.58);
  s += lista(cx + 0.04, y, 0.82, 0.5);
  s += lista(cx - 0.6, y + 0.58, 0.86, 0.5);
  return s;
}

/** Cerca de listones: dos travesanos y un tramo caido. */
function cerca(cx, suelo, t, rng, tramos = 4) {
  const c = tenir(MATERIA.madera, t);
  const paso = 1.5;
  const x0 = cx - (tramos * paso) / 2;
  let s = '';
  const cimas = [];
  for (let i = 0; i <= tramos; i++) {
    const x = x0 + i * paso;
    const y = suelo(x);
    const h = 1.0 + rng() * 0.2;
    cimas.push([x, y, h]);
    s += sombraEn(x, y, 0.5, 0.08);
    s += pieza([caja(x - 0.08, y, 0.16, h, 0.04)], c, { grosor: 0.06 });
  }
  for (let i = 1; i < cimas.length; i++) {
    const [xa, ya, ha] = cimas[i - 1], [xb, yb, hb] = cimas[i];
    const roto = i === 2;
    for (const k of [0.85, 0.5]) {
      const p0 = [xa, ya + ha * k], p1 = roto ? [(xa + xb) / 2, ya + ha * k - 0.5] : [xb, yb + hb * k];
      s += pieza([caminoRedondeado([[p0[0], p0[1] - 0.06], [p1[0], p1[1] - 0.06], [p1[0], p1[1] + 0.06], [p0[0], p0[1] + 0.06]], 0.03)], c, { grosor: 0.055 });
    }
  }
  return s;
}

/**
 * Via de tren: terraplen de balasto, traviesas y el carril retorcido.
 *
 * De perfil se ve UN carril, no dos: dibujar dos separados 0,13 u da una chapa
 * gris con un contorno mas gordo que la propia pieza. El carril es un trazo.
 */
function via(cx, suelo, t, rng, largo = 6.5) {
  // El balasto es grava PALIDA, mas clara que la tierra. Mezclado hacia el
  // socavon sale casi negro y el terraplen se lee como una zanja.
  const balasto = mezcla(t.cresta, t.socavon, 0.5);
  const acero = tenir(MATERIA.metal, t);
  const madera = mezcla('#5c3f26', t.cuerpo, 0.18);
  const a = cx - largo / 2, b = cx + largo / 2;
  const alto = 0.55;
  const nivel = (x) => suelo(x) + alto;
  let s = sombraEn(cx, bajoDe(suelo, a, b), largo, 0.14);
  s += pieza([polilinea([...baseTerreno(suelo, a, b),
    [b - 0.55, nivel(b)], [a + 0.55, nivel(a)]]) + 'Z'], balasto, { grosor: 0.09 });
  const n = Math.round(largo / 0.8);
  for (let i = 0; i < n; i++) {
    const x = a + 0.75 + ((largo - 1.6) * i) / (n - 1);
    s += pieza([caja(x - 0.21, nivel(x) - 0.08, 0.42, 0.16, 0.03)], madera, { grosor: 0.05 });
  }
  const carril = [];
  for (let x = a + 0.7; x <= b - 1.1; x += 0.3) carril.push([x, nivel(x) + 0.09]);
  s += camino(polilinea(carril), {
    fill: 'none', stroke: contorno(acero), 'stroke-width': 0.12, 'stroke-linecap': 'round',
  });
  // El carril que se levanta va al extremo, no al medio: una via recta y entera
  // no cuenta nada; una doblada cuenta que aqui cayo algo.
  const p0 = [b - 1.1, nivel(b - 1.1) + 0.09];
  s += camino(`M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}Q${(b - 0.3).toFixed(2)} ${(p0[1] + 0.2).toFixed(2)} ${(b - 0.05).toFixed(2)} ${(p0[1] + 0.95).toFixed(2)}`, {
    fill: 'none', stroke: contorno(acero), 'stroke-width': 0.12, 'stroke-linecap': 'round',
  });
  return s;
}

/** Parapeto de sacos. Contra cada canon hay uno siempre (ARTE.md §13). */
export function sacos(cx, suelo, t, rng, ancho = 3.0) {
  const c = tenir(MATERIA.lona, t);
  let s = sombraEn(cx, bajoDe(suelo, cx - ancho / 2, cx + ancho / 2), ancho * 1.05, 0.12);
  for (let fila = 0; fila < 2; fila++) {
    const n = fila === 0 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const sx = cx - ancho / 2 + (ancho / n) * (i + 0.5) + (fila ? ancho / n / 2 : 0);
      // cada saco se asienta en SU x y lleva su contorno: con una Y comun el
      // parapeto queda en voladizo, y sin contorno propio es un churro
      const y = suelo(sx) - 0.05 + fila * 0.3;
      s += pieza([caminoRedondeado([
        [sx - 0.3, y], [sx + 0.3, y], [sx + 0.3, y + 0.34], [sx - 0.3, y + 0.34],
      ], 0.16)], c, { grosor: 0.065 });
    }
  }
  return s;
}

/**
 * El catalogo. `ancho` es lo que reserva en el terreno y `peso` cuantas veces
 * aparece: un teatro con seis setos no es Normandia, es un laberinto.
 */
export const FAMILIAS = {
  seto: { ancho: 5.8, veces: 1, dibujar: (x, s, t, r) => seto(x, s, t, r, 5.4) },
  via: { ancho: 7.0, veces: 1, dibujar: (x, s, t, r) => via(x, s, t, r, 6.5) },
  alambrada: { ancho: 6.6, veces: 1, dibujar: (x, s, t, r) => alambrada(x, s, t, r, 3) },
  cerca: { ancho: 5.0, veces: 1, dibujar: (x, s, t, r) => cerca(x, s, t, r, 3) },
  barricada: { ancho: 3.4, veces: 1, dibujar: (x, s, t, r) => barricada(x, s, t, r, 3.0) },
  escombro: { ancho: 3.2, veces: 2, dibujar: (x, s, t, r) => escombro(x, s, t, r, 2.8) },
  almiar: { ancho: 2.7, veces: 2, dibujar: almiar },
  cajas: { ancho: 2.1, veces: 1, dibujar: cajas },
  bidones: { ancho: 2.1, veces: 1, dibujar: bidones },
  erizo: { ancho: 2.1, veces: 2, dibujar: erizo },
  abeto: { ancho: 1.9, veces: 2, dibujar: (x, s, t, r) => abeto(x, s, t, r, true) },
  tocon: { ancho: 1.4, veces: 2, dibujar: tocon },
  farola: { ancho: 1.2, veces: 1, dibujar: farola },
  poste: { ancho: 1.1, veces: 2, dibujar: poste },
  sacos: { ancho: 3.4, veces: 1, dibujar: (x, s, t, r) => sacos(x, s, t, r, 3.0) },
};
