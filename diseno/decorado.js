/**
 * Decorado: la biblioteca de piezas y el motor que las coloca.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA REGLA, Y ES UNA SOLA
 *
 * Ninguna pieza tiene base plana. El borde INFERIOR de todo lo que se apoya en
 * el suelo se construye con el perfil del terreno (`apoyado`), no con una recta.
 *
 * Con base plana una pieza toca el suelo en un punto y flota en el resto, y en
 * cuanto el terreno tiene relieve —o sea siempre— se ve una casa levitando o una
 * roca colgada de una esquina. Hundirla un poco no lo arregla: en una cuesta la
 * esquina de abajo se entierra y la de arriba sigue en el aire. Y como el
 * decorado se pinta DESPUES del terreno, el hueco no lo tapa nada.
 *
 * El coste es cero: `apoyado` recibe el techo de la pieza y cierra el camino con
 * el perfil. Cualquier pieza nueva se dibuja asi o esta mal.
 * ────────────────────────────────────────────────────────────────────────
 */

import {
  caminoRedondeado, circulo, caja, camino, grupo, polilinea, siluetaUnica,
} from './primitivas.js';
import { mezcla, tono, claro, oscuro, contorno, MATERIA, TINTE_TEATRO } from './paleta.js';

// ── el suelo manda ────────────────────────────────────────────────────────

/** Puntos del terreno de x0 a x1, hundidos `h`. De izquierda a derecha. */
export function perfilBase(suelo, x0, x1, h = 0.22, paso = 0.25) {
  const p = [];
  for (let x = x0; x < x1; x += paso) p.push([x, suelo(x) - h]);
  p.push([x1, suelo(x1) - h]);
  return p;
}

/**
 * Camino cerrado cuya base es el terreno y cuyo techo son los puntos dados, de
 * izquierda a derecha. Es como se dibuja TODO lo que se apoya en el suelo.
 */
export function apoyado(suelo, x0, x1, techo, h = 0.22) {
  return polilinea([...perfilBase(suelo, x0, x1, h), ...techo.slice().reverse()]) + 'Z';
}

/** El punto mas alto del tramo: la referencia de un techo que tiene que ser plano. */
export const altoDe = (suelo, x0, x1) => {
  let m = -Infinity;
  for (let x = x0; x <= x1; x += 0.25) m = Math.max(m, suelo(x));
  return m;
};

/** El punto mas bajo: donde se asienta lo que no puede quedar en voladizo. */
export const bajoDe = (suelo, x0, x1) => {
  let m = Infinity;
  for (let x = x0; x <= x1; x += 0.25) m = Math.min(m, suelo(x));
  return m;
};

// ── colocacion ────────────────────────────────────────────────────────────

/**
 * Lleva la cuenta de los tramos de x ocupados. Es lo unico que impide que dos
 * piezas se pisen, y por eso se reservan PRIMERO los blindados, sus parapetos y
 * el hito: son intocables, y el decorado se acomoda a ellos y no al reves.
 */
export function crearReserva(x0, x1) {
  const usados = [];
  return {
    ocupar(cx, ancho) {
      usados.push([cx - ancho / 2, cx + ancho / 2]);
      usados.sort((a, b) => a[0] - b[0]);
    },
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
     * Coloca en un hueco de verdad, sorteando uno ponderado por su tamano: asi
     * las piezas se reparten por el campo en vez de amontonarse en el mayor.
     */
    colocar(ancho, rng, margen = 0.45, suelo = null) {
      const cabe = this.libres(margen).filter(([a, b]) => b - a >= ancho);
      if (!cabe.length) return null;
      const total = cabe.reduce((s, [a, b]) => s + (b - a), 0);
      let u = rng() * total, tramo = cabe[cabe.length - 1];
      for (const [a, b] of cabe) {
        if (u < b - a) { tramo = [a, b]; break; }
        u -= b - a;
      }
      const [a, b] = tramo;
      const libre = b - a - ancho;
      if (!suelo || ancho < 2.5 || libre < 0.5) return a + ancho / 2 + rng() * libre;
      // Una pieza ancha busca el trozo LLANO del hueco. Plantada a caballo de
      // una vaguada, su base tiene que bajar y subir y se lee como un cimiento
      // en V — que es lo que hacia que las casas parecieran flotar.
      let mejor = a + ancho / 2, coste = Infinity;
      for (let i = 0; i <= 8; i++) {
        const c = a + ancho / 2 + (libre * i) / 8;
        let alto = -Infinity, bajo = Infinity;
        for (let x = c - ancho / 2; x <= c + ancho / 2; x += 0.3) {
          const y = suelo(x);
          if (y > alto) alto = y;
          if (y < bajo) bajo = y;
        }
        if (alto - bajo < coste) { coste = alto - bajo; mejor = c; }
      }
      return mejor;
    },
  };
}

// ── utilidades de pieza ───────────────────────────────────────────────────

/** Tinte de teatro: sin el, una viga de madera es la misma en Paris y en Alamein. */
export const tenir = (c, t) => mezcla(c, t.cuerpo, TINTE_TEATRO);

/** Un cuerpo con contorno unico y tres tonos. */
function pieza(formas, base, { grosor = 0.09, dentro = '' } = {}) {
  return siluetaUnica({
    formas, cont: contorno(base), tonoClaro: claro(base), tonoBase: base,
    grosor, luz: [0.09, -0.13], dentro,
  });
}

/**
 * Sombra de contacto que SIGUE el terreno: una banda fina pegada al perfil, no
 * una elipse. Sobre relieve la elipse se despega por un lado y delata justo lo
 * que venia a disimular (ARTE.md §1.4).
 */
function sombraApoyada(suelo, x0, x1, alto = 0.16) {
  return camino(apoyado(suelo, x0, x1, perfilBase(suelo, x0, x1, -alto), 0.06), {
    fill: '#000', opacity: 0.16,
  });
}

// ── las familias ──────────────────────────────────────────────────────────

/**
 * Tocon astillado. Fractura en puntas desiguales, corteza oscura en el flanco
 * derecho y el interior de la rotura en claro: la madera fresca de dentro es lo
 * que dice que se rompio hace poco.
 */
function tocon(cx, suelo, t, rng, e = 1) {
  const c = tenir(MATERIA.madera, t);
  const w = 0.34 * e, a = cx - w, b = cx + w;
  const y = altoDe(suelo, a, b);
  const h = (1.05 + rng() * 0.45) * e;
  const techo = [0.0, 0.34, 0.1, 0.26, -0.05].map((k, i) => [a + (2 * w * i) / 4, y + h + k * e]);
  let s = sombraApoyada(suelo, a - 0.5 * e, b + 0.3 * e, 0.13);
  s += pieza([
    apoyado(suelo, a, b, techo),
    // raiz expuesta a un lado: la asimetria es lo que lo hace objeto y no icono
    apoyado(suelo, a - 0.5 * e, a, [[a - 0.5 * e, y + 0.2 * e], [a, y + 0.42 * e]]),
  ], c, {
    dentro:
      camino(caja(cx + w * 0.3, y - 0.6, w * 1.2, h + 1.2, 0), { fill: oscuro(c) })
      + camino(caja(a, y + h - 0.12 * e, w * 2, 0.6 * e, 0), { fill: tono(c, 0.3) }),
  });
  return s;
}

/** Abeto nevado: tres pisos y tronco corto. Solo en las Ardenas. */
function abeto(cx, suelo, t, rng) {
  const w = 0.82 + rng() * 0.25, a = cx - w, b = cx + w;
  const y = altoDe(suelo, a, b);
  const h = 2.3 + rng() * 1.0;
  const verde = mezcla('#3f5c33', t.cuerpo, 0.2);
  let s = sombraApoyada(suelo, a, b, 0.14);
  s += pieza([apoyado(suelo, cx - 0.13, cx + 0.13, [[cx - 0.13, y + h * 0.32], [cx + 0.13, y + h * 0.32]])],
    tenir(MATERIA.madera, t), { grosor: 0.07 });
  const pisos = [], nieves = [];
  for (let i = 0; i < 3; i++) {
    const bs = y + h * (0.22 + i * 0.24), an = w * (1 - i * 0.24);
    pisos.push(caminoRedondeado([[cx - an, bs], [cx + an, bs], [cx, bs + h * 0.36]], 0.14));
    nieves.push(caminoRedondeado([[cx - an, bs + h * 0.13], [cx + an, bs + h * 0.13], [cx, bs + h * 0.4]], 0.14));
  }
  s += pieza(pisos, verde, { dentro: nieves.map((n) => camino(n, { fill: '#eef4f8' })).join('') });
  return s;
}

/**
 * Seto de bocage: caballon de tierra con la mata encima. No es un arbusto, es
 * un terraplen, y por eso corta el campo. Es la pieza que dice «Normandia».
 *
 * El caballon lleva base Y TECHO siguiendo el terreno. Con el techo recto entre
 * dos puntos, sobre una loma el techo cae por debajo del suelo en el medio, el
 * poligono se cruza consigo mismo y sale una cuna flotando con las matas encima:
 * era lo que se veia.
 */
function seto(cx, suelo, t, rng, largo = 5.4) {
  const a = cx - largo / 2, b = cx + largo / 2;
  const tierra = mezcla(t.socavon, t.cuerpo, 0.35);
  const verde = mezcla('#4d6b2f', t.cuerpo, 0.22);
  let s = sombraApoyada(suelo, a - 0.2, b + 0.2, 0.16);
  s += pieza([apoyado(suelo, a, b, perfilBase(suelo, a, b, -0.85))], tierra, { grosor: 0.1 });
  const matas = [];
  const n = Math.max(4, Math.round(largo / 1.35));
  for (let i = 0; i < n; i++) {
    const x = a + 0.5 + ((largo - 1.0) * i) / (n - 1);
    matas.push(circulo(x, suelo(x) + 1.15 + rng() * 0.3, 0.64 + rng() * 0.24));
  }
  s += pieza(matas, verde, { grosor: 0.1 });
  return s;
}

/** Alambrada: piquetes desiguales, alambre que cuelga y puas en aspa. */
function alambrada(cx, suelo, t, rng, tramos = 3) {
  const c = tenir(MATERIA.metal, t);
  const paso = 2.0;
  const x0 = cx - (tramos * paso) / 2;
  let s = '';
  const postes = [];
  for (let i = 0; i <= tramos; i++) {
    const x = x0 + i * paso + (rng() - 0.5) * 0.3;
    const y = suelo(x);
    const alto = 1.05 + rng() * 0.45;
    const caido = i === tramos;
    const cima = caido ? [x + alto * 0.75, y + alto * 0.28] : [x, y + alto];
    postes.push({ pie: [x, y], cima });
    s += sombraApoyada(suelo, x - 0.3, x + 0.3, 0.1);
    s += pieza([caminoRedondeado([
      [x - 0.07, y - 0.25], [x + 0.07, y - 0.25],
      [cima[0] + 0.07, cima[1]], [cima[0] - 0.07, cima[1]],
    ], 0.05)], c, { grosor: 0.06 });
  }
  const hilo = contorno(c);
  for (let i = 1; i < postes.length; i++) {
    const p = postes[i - 1], q = postes[i];
    for (let k = 0; k < 3; k++) {
      const f = 0.94 - k * 0.3;
      const ya = p.pie[1] + (p.cima[1] - p.pie[1]) * f;
      const yb = q.pie[1] + (q.cima[1] - q.pie[1]) * f;
      const mx = (p.cima[0] + q.cima[0]) / 2, my = (ya + yb) / 2 - 0.22;
      s += `<path d="M${p.cima[0].toFixed(2)} ${ya.toFixed(2)}Q${mx.toFixed(2)} ${my.toFixed(2)} ${q.cima[0].toFixed(2)} ${yb.toFixed(2)}" fill="none" stroke="${hilo}" stroke-width="0.055"/>`;
      for (let u = 0.25; u < 0.9; u += 0.25) {
        const px = p.cima[0] + (q.cima[0] - p.cima[0]) * u;
        const py = (1 - u) ** 2 * ya + 2 * (1 - u) * u * my + u * u * yb;
        s += `<path d="M${(px - 0.09).toFixed(2)} ${(py - 0.09).toFixed(2)}L${(px + 0.09).toFixed(2)} ${(py + 0.09).toFixed(2)}M${(px - 0.09).toFixed(2)} ${(py + 0.09).toFixed(2)}L${(px + 0.09).toFixed(2)} ${(py - 0.09).toFixed(2)}" stroke="${hilo}" stroke-width="0.05"/>`;
      }
    }
  }
  return s;
}

/**
 * Erizo checo. Tres vigas gruesas que se cruzan, y las dos inclinadas APOYAN
 * sus cuatro extremos en el suelo. La version anterior las cruzaba a media
 * altura con angulos que no llegaban abajo: salia un asterisco flotando.
 */
function erizo(cx, suelo, t, rng) {
  const c = tenir(MATERIA.metal, t);
  const L = 2.0, g = 0.17;
  const a = cx - L * 0.42, b = cx + L * 0.42;
  const y = altoDe(suelo, a, b);
  const angs = [0.96, Math.PI / 2, Math.PI - 0.96];   // 55°, 90°, 125°
  const cy = y + Math.sin(0.96) * (L / 2);            // los extremos bajos, en el suelo
  const f = angs.map((ang) => {
    const dx = Math.cos(ang) * L / 2, dy = Math.sin(ang) * L / 2;
    const nx = -Math.sin(ang) * g, ny = Math.cos(ang) * g;
    return caminoRedondeado([
      [cx - dx + nx, cy - dy + ny], [cx + dx + nx, cy + dy + ny],
      [cx + dx - nx, cy + dy - ny], [cx - dx - nx, cy - dy - ny],
    ], 0.07);
  });
  // pletina de union en el centro: es lo que lo hace un objeto soldado
  f.push(circulo(cx, cy, 0.26, 12));
  return sombraApoyada(suelo, a - 0.15, b + 0.15, 0.12) + pieza(f, c, { grosor: 0.085 });
}

/**
 * Almiar: montón de paja con el palo. Dice «campo cosechado» y es la pieza de
 * la llanura del Bzura. La cumbrera va DESCENTRADA: simétrica se lee como un
 * sobre y no como algo amontonado a horca.
 */
function almiar(cx, suelo, t, rng) {
  const c = mezcla('#d9b962', t.cuerpo, 0.25);
  const w = 1.15 + rng() * 0.25, a = cx - w, b = cx + w;
  const h = 1.9 + rng() * 0.5;
  const cumbre = 0.44 + rng() * 0.12;
  const techo = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, x = a + (b - a) * u;
    const k = u < cumbre ? u / cumbre : (1 - u) / (1 - cumbre);
    techo.push([x, suelo(x) + h * Math.sin(Math.min(1, k) * Math.PI * 0.5) ** 0.72]);
  }
  let s = sombraApoyada(suelo, a - 0.25, b + 0.25, 0.15);
  s += pieza([apoyado(suelo, a, b, techo)], c, {
    dentro: [0.28, 0.55, 0.8].map((k) =>
      camino(polilinea([[a, suelo(a) + h * k], [b, suelo(b) + h * k]]), {
        stroke: oscuro(c), 'stroke-width': 0.05, 'stroke-dasharray': '0.42 0.3', fill: 'none',
      })).join(''),
  });
  const px = a + (b - a) * cumbre;
  s += pieza([caja(px - 0.07, suelo(px) + h * 0.94, 0.14, 0.55, 0.04)], tenir(MATERIA.madera, t), { grosor: 0.06 });
  return s;
}

/** Poste de telegrafo: dos crucetas con aisladores, inclinado. */
function poste(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  const y = altoDe(suelo, cx - 0.12, cx + 0.12);
  const h = 3.0 + rng() * 0.8;
  const inc = (rng() - 0.5) * 0.8;
  const cima = [cx + inc, y + h];
  // El fuste arranca hundido en SU x. Cerrandolo con el perfil de todo el vano
  // que abarca la inclinacion sale una falda triangular al pie, como si el poste
  // tuviera un contrafuerte.
  const f = [caminoRedondeado([
    [cx - 0.11, suelo(cx) - 0.3], [cx + 0.11, suelo(cx) - 0.3],
    [cima[0] + 0.1, cima[1]], [cima[0] - 0.1, cima[1]],
  ], 0.06)];
  for (const k of [0.8, 0.93]) {
    const bx = cx + inc * k, by = y + h * k;
    f.push(caminoRedondeado([[bx - 0.6, by], [bx + 0.6, by], [bx + 0.6, by + 0.12], [bx - 0.6, by + 0.12]], 0.05));
  }
  let s = sombraApoyada(suelo, cx - 0.4, cx + 0.4, 0.1) + pieza(f, c, { grosor: 0.07 });
  const m = contorno(tenir(MATERIA.metal, t));
  for (const k of [0.8, 0.93]) {
    const bx = cx + inc * k, by = y + h * k;
    for (const d of [-0.45, 0, 0.45]) s += camino(circulo(bx + d, by + 0.2, 0.08, 10), { fill: m });
  }
  return s;
}

/** Farola: fuste, brazo curvo y luminaria. Solo en Paris. */
function farola(cx, suelo, t) {
  const c = tenir(MATERIA.metal, t);
  const y = altoDe(suelo, cx - 0.25, cx + 0.25);
  const h = 3.3;
  const f = [
    apoyado(suelo, cx - 0.24, cx + 0.24, [[cx - 0.24, y + 0.34], [cx + 0.24, y + 0.34]]),
    caminoRedondeado([[cx - 0.09, y + 0.28], [cx + 0.09, y + 0.28], [cx + 0.09, y + h], [cx - 0.09, y + h]], 0.05),
    caminoRedondeado([[cx - 0.05, y + h], [cx + 0.6, y + h - 0.1], [cx + 0.6, y + h - 0.34], [cx - 0.05, y + h - 0.34]], 0.14),
    caminoRedondeado([[cx + 0.34, y + h - 0.88], [cx + 0.84, y + h - 0.88], [cx + 0.7, y + h - 0.16], [cx + 0.48, y + h - 0.16]], 0.08),
  ];
  return sombraApoyada(suelo, cx - 0.4, cx + 0.4, 0.1) + pieza(f, c, { grosor: 0.07 });
}

/** Escombro: monton con la junta de ladrillo y una barra de hierro asomando. */
function escombro(cx, suelo, t, rng, ancho = 2.8) {
  const c = mezcla('#a8603f', t.cuerpo, 0.3);
  const a = cx - ancho / 2, b = cx + ancho / 2;
  const alto = 0.72 + rng() * 0.45;
  let s = sombraApoyada(suelo, a - 0.2, b + 0.2, 0.14);
  s += pieza([apoyado(suelo, a, b, [
    [a, suelo(a) + alto * 0.28], [cx - ancho * 0.2, suelo(cx - ancho * 0.2) + alto],
    [cx + ancho * 0.08, suelo(cx + ancho * 0.08) + alto * 0.66],
    [cx + ancho * 0.3, suelo(cx + ancho * 0.3) + alto * 0.9], [b, suelo(b) + alto * 0.24],
  ])], c, { grosor: 0.1 });
  for (let i = 0; i < 3; i++) {
    const bx = a + 0.3 + rng() * (ancho - 0.6), w = 0.3 + rng() * 0.18;
    s += pieza([apoyado(suelo, bx - w / 2, bx + w / 2,
      [[bx - w / 2, suelo(bx) + 0.24], [bx + w / 2, suelo(bx) + 0.24]], 0.1)], oscuro(c), { grosor: 0.07 });
  }
  s += camino(polilinea([[cx - ancho * 0.15, suelo(cx) + alto * 0.85], [cx - ancho * 0.02, suelo(cx) + alto * 1.4]]), {
    stroke: contorno(tenir(MATERIA.metal, t)), 'stroke-width': 0.07, fill: 'none', 'stroke-linecap': 'round',
  });
  return s;
}

/** Barricada de adoquines levantados del propio empedrado. */
function barricada(cx, suelo, t, rng, ancho = 3.0) {
  const c = mezcla('#8d8b86', t.cuerpo, 0.22);
  const a = cx - ancho / 2, b = cx + ancho / 2;
  let s = sombraApoyada(suelo, a - 0.2, b + 0.2, 0.14);
  for (let fi = 0; fi < 4; fi++) {
    const w = ancho * (1 - fi * 0.15);
    const n = Math.max(3, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const bx = cx - w / 2 + (w / n) * (i + 0.5);
      // cada hilada sube desde EL SUELO DE SU X: con una cota comun la
      // barricada queda escalonada en el aire sobre terreno en cuesta
      const by = suelo(bx) - 0.06 + fi * 0.3;
      s += pieza([caja(bx - w / n / 2 + 0.03, by, w / n - 0.06, 0.3, 0.06)], c, { grosor: 0.065 });
    }
  }
  return s;
}

/** Bidones: cilindro con dos aros. */
function bidones(cx, suelo, t, rng, n = 2) {
  const c = mezcla('#6f7a5e', t.cuerpo, 0.25);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * 0.92;
    const w = 0.36, a = x - w, b = x + w;
    const y = altoDe(suelo, a, b), h = 1.02;
    s += sombraApoyada(suelo, a - 0.1, b + 0.1, 0.11);
    s += pieza([apoyado(suelo, a, b, [[a, y + h], [b, y + h]])], c, {
      grosor: 0.075,
      dentro: [0.28, 0.68].map((k) =>
        camino(polilinea([[a, y + h * k], [b, y + h * k]]), { stroke: contorno(c), 'stroke-width': 0.07, fill: 'none' })).join(''),
    });
  }
  return s;
}

/** Cajas de municion apiladas, con los listones marcados. */
function cajas(cx, suelo, t, rng) {
  const c = tenir(MATERIA.madera, t);
  let s = sombraApoyada(suelo, cx - 1.0, cx + 1.0, 0.12);
  const una = (x0, x1, y, h) => pieza([caminoRedondeado([
    [x0, y], [x1, y], [x1, y + h], [x0, y + h],
  ], 0.07)], c, {
    grosor: 0.075,
    dentro: camino(polilinea([[x0, y + h * 0.5], [x1, y + h * 0.5]]), {
      stroke: contorno(c), 'stroke-width': 0.05, fill: 'none',
    }),
  });
  const y0 = altoDe(suelo, cx - 0.88, cx + 0.02) - 0.14;
  const y1 = altoDe(suelo, cx + 0.04, cx + 0.86) - 0.14;
  s += una(cx - 0.88, cx + 0.02, y0, 0.58);
  s += una(cx + 0.04, cx + 0.86, y1, 0.5);
  s += una(cx - 0.6, cx + 0.26, y0 + 0.58, 0.5);
  return s;
}

/** Cerca de listones: dos travesanos y un tramo caido. */
function cerca(cx, suelo, t, rng, tramos = 3) {
  const c = tenir(MATERIA.madera, t);
  const paso = 1.5, x0 = cx - (tramos * paso) / 2;
  let s = '';
  const cimas = [];
  for (let i = 0; i <= tramos; i++) {
    const x = x0 + i * paso;
    const y = suelo(x), h = 1.0 + rng() * 0.2;
    cimas.push([x, y, h]);
    s += sombraApoyada(suelo, x - 0.25, x + 0.25, 0.09);
    s += pieza([caja(x - 0.08, y - 0.25, 0.16, h + 0.25, 0.04)], c, { grosor: 0.06 });
  }
  for (let i = 1; i < cimas.length; i++) {
    const [xa, ya, ha] = cimas[i - 1], [xb, yb, hb] = cimas[i];
    const roto = i === 2;
    for (const k of [0.85, 0.5]) {
      const p0 = [xa, ya + ha * k];
      const p1 = roto ? [(xa + xb) / 2, ya + ha * k - 0.55] : [xb, yb + hb * k];
      s += pieza([caminoRedondeado([[p0[0], p0[1] - 0.06], [p1[0], p1[1] - 0.06], [p1[0], p1[1] + 0.06], [p0[0], p0[1] + 0.06]], 0.03)], c, { grosor: 0.055 });
    }
  }
  return s;
}

/** Via de tren: terraplen de balasto, traviesas y el carril retorcido. */
function via(cx, suelo, t, rng, largo = 6.5) {
  const balasto = mezcla(t.cresta, t.socavon, 0.5);
  const acero = tenir(MATERIA.metal, t);
  const madera = mezcla('#5c3f26', t.cuerpo, 0.18);
  const a = cx - largo / 2, b = cx + largo / 2;
  const alto = 0.55;
  const nivel = (x) => suelo(x) + alto;
  let s = sombraApoyada(suelo, a - 0.2, b + 0.2, 0.14);
  s += pieza([apoyado(suelo, a, b, perfilBase(suelo, a, b, -alto))], balasto, { grosor: 0.09 });
  const n = Math.round(largo / 0.8);
  for (let i = 0; i < n; i++) {
    const x = a + 0.75 + ((largo - 1.6) * i) / (n - 1);
    s += pieza([caja(x - 0.21, nivel(x) - 0.08, 0.42, 0.16, 0.03)], madera, { grosor: 0.05 });
  }
  const carril = [];
  for (let x = a + 0.7; x <= b - 1.1; x += 0.3) carril.push([x, nivel(x) + 0.09]);
  s += camino(polilinea(carril), { fill: 'none', stroke: contorno(acero), 'stroke-width': 0.12, 'stroke-linecap': 'round' });
  const p0 = [b - 1.1, nivel(b - 1.1) + 0.09];
  s += camino(`M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}Q${(b - 0.3).toFixed(2)} ${(p0[1] + 0.2).toFixed(2)} ${(b - 0.05).toFixed(2)} ${(p0[1] + 0.95).toFixed(2)}`,
    { fill: 'none', stroke: contorno(acero), 'stroke-width': 0.12, 'stroke-linecap': 'round' });
  return s;
}

/** Parapeto de sacos. Contra cada canon hay uno siempre (ARTE.md §13). */
export function sacos(cx, suelo, t, rng, ancho = 3.0) {
  const c = tenir(MATERIA.lona, t);
  const a = cx - ancho / 2, b = cx + ancho / 2;
  let s = sombraApoyada(suelo, a - 0.1, b + 0.1, 0.12);
  for (let fila = 0; fila < 2; fila++) {
    const n = fila === 0 ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const sx = a + (ancho / n) * (i + 0.5) + (fila ? ancho / n / 2 : 0);
      // cada saco se asienta en SU x: con una cota comun el parapeto queda en
      // voladizo, y sin contorno propio se lee como un churro
      const y = suelo(sx) - 0.06 + fila * 0.3;
      s += pieza([caminoRedondeado([
        [sx - 0.3, y], [sx + 0.3, y], [sx + 0.3, y + 0.34], [sx - 0.3, y + 0.34],
      ], 0.16)], c, { grosor: 0.065 });
    }
  }
  return s;
}

/**
 * El catalogo. `ancho` es lo que reserva en el terreno y `veces` cuantas
 * aparece: un teatro con seis setos no es Normandia, es un laberinto.
 */
export const FAMILIAS = {
  seto: { ancho: 5.8, veces: 1, dibujar: (x, s, t, r) => seto(x, s, t, r, 5.4) },
  via: { ancho: 7.0, veces: 1, dibujar: (x, s, t, r) => via(x, s, t, r, 6.5) },
  alambrada: { ancho: 6.6, veces: 1, dibujar: (x, s, t, r) => alambrada(x, s, t, r, 3) },
  cerca: { ancho: 5.0, veces: 1, dibujar: (x, s, t, r) => cerca(x, s, t, r, 3) },
  barricada: { ancho: 3.4, veces: 1, dibujar: barricada },
  escombro: { ancho: 3.2, veces: 2, dibujar: escombro },
  almiar: { ancho: 2.7, veces: 2, dibujar: almiar },
  cajas: { ancho: 2.2, veces: 1, dibujar: cajas },
  bidones: { ancho: 2.2, veces: 1, dibujar: bidones },
  erizo: { ancho: 2.2, veces: 2, dibujar: erizo },
  abeto: { ancho: 2.0, veces: 2, dibujar: abeto },
  tocon: { ancho: 1.5, veces: 2, dibujar: tocon },
  farola: { ancho: 1.3, veces: 1, dibujar: farola },
  poste: { ancho: 1.2, veces: 2, dibujar: poste },
};
