import * as THREE from 'three';
import { contornoRedondeado, contornoLlano } from '../vehiculo/primitivas.js';
import { oscuro, contorno } from '../vehiculo/paleta.js';
import { apoyada, altoDe, poner, calco, monton, rect, barra, FONDO } from './piezas.js';

/**
 * Los nueve hitos, y todos salen del MISMO constructor de edificios.
 *
 * Cambia el remate (plano, roto, dos aguas, dientes de sierra), el material, el
 * numero de plantas y donde esta roto — nunca la forma de construirlo. Por eso
 * las dieciseis ciudades parecen del mismo mundo sin parecerse entre si
 * (`docs/ESCENARIOS.md` §3 bis).
 *
 * Mas dos casos especiales que no son un edificio: la chimenea de fabrica y el
 * puente partido.
 */

/** Lo que cada hito RESERVA en el terreno. Nadie mas se coloca ahi dentro. */
export const ANCHO_HITO = {
  manzana: 11.0,
  catedral: 13.0,
  lonja: 12.0,
  abadia: 10.5,
  estacion: 12.0,
  fuerte: 9.5,
  puente: 10.5,
  iglesia: 5.6,
  fabrica: 11.5,
};

// ── el constructor ────────────────────────────────────────────────────────

/**
 * El remate es lo que distingue dos edificios hechos de lo mismo. Cuatro, y con
 * eso salen los nueve hitos.
 */
function remateDe(clase, x0, x1, y, rng) {
  const w = x1 - x0;
  if (clase === 'plano') {
    // Petril: un tejado plano a canto vivo se lee como una caja cortada.
    return [[x0, y], [x0, y + 0.22], [x1, y + 0.22], [x1, y]];
  }
  if (clase === 'dosaguas') {
    return [[x0, y], [x0 + w * 0.5, y + w * 0.17], [x1, y]];
  }
  if (clase === 'sierra') {
    // Nave de dientes de sierra: el tejado de una fabrica y de nada mas.
    const pts = [[x0, y]];
    const n = Math.max(3, Math.round(w / 2.2));
    for (let i = 0; i < n; i++) {
      const a = x0 + (w * i) / n;
      const b = x0 + (w * (i + 1)) / n;
      pts.push([a, y + 0.9], [b, y + 0.12]);
    }
    return pts;
  }
  // Roto: es el remate por defecto porque estas son ciudades arrasadas. Se hunde
  // hacia un lado —simetrico parece una almena— y los dientes son desiguales.
  const pts = [];
  const n = 6;
  const caida = rng() < 0.5 ? 1 : -1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const hundido = (caida > 0 ? t : 1 - t) ** 2 * w * 0.16;
    pts.push([x0 + w * t, y - hundido + (i % 2 ? 0.34 : -0.26) * (0.5 + rng() * 0.9)]);
  }
  return pts;
}

/**
 * Un cuerpo de edificio: silueta apoyada en el terreno, remate y rejilla de
 * huecos.
 *
 * LA REJILLA ES RIGIDA. Todos los huecos —ventanas y puerta— se replantean desde
 * la MISMA cota, la del punto mas alto de la huella. La version anterior ponia la
 * puerta a la altura del terreno en su x, asi que en cuanto habia pendiente se
 * movia respecto a las ventanas y se veia una ventana bailando segun el
 * escenario. Lo que varia con el terreno es CUANTO TAPA EL SUELO la fachada,
 * nunca donde estan sus huecos: un hueco que cae bajo el suelo simplemente no se
 * dibuja (`docs/ESCENARIOS.md` §3).
 */
function cuerpo(ctx, x0, x1, alto, color, {
  remate = 'roto', plantas = 0, puerta = false, z = 0, fondo = FONDO * 1.7,
} = {}) {
  const { suelo, rng, T } = ctx;
  const y = altoDe(suelo, x0, x1);
  poner(ctx, apoyada(suelo, x0, x1, remateDe(remate, x0, x1, y + alto, rng), 0.3), color, {
    ancho: fondo,
    z,
  });

  if (plantas > 0) {
    const cols = Math.max(2, Math.round((x1 - x0) / 1.7));
    const paso = (x1 - x0) / cols;
    const w = paso * 0.42;
    const h = Math.min(0.9, (alto / plantas) * 0.44);
    for (let f = 0; f < plantas; f++) {
      const yv = y + 0.55 + (alto / plantas) * f;
      for (let i = 0; i < cols; i++) {
        const xv = x0 + paso * (i + 0.5) - w / 2;
        // Bajo el suelo no hay ventana: la tapa el terreno, no se dibuja.
        if (yv < suelo(xv + w / 2) - 0.1) continue;
        // Un edificio roto tiene ventanas rotas. Las de arriba se comen el
        // antepecho y se leen como boquete, que es de lo que va esto.
        const rota = remate === 'roto' && f === plantas - 1 && rng() < 0.5;
        calco(ctx, contornoRedondeado(rect(xv, yv, w, rota ? h * 1.5 : h), 0.06), T.hueco, {
          z: z + fondo / 2 + 0.03,
        });
      }
    }
  }

  if (puerta) {
    const xp = x0 + (x1 - x0) * 0.5 - 0.34;
    calco(ctx, contornoRedondeado(rect(xp, y - 0.3, 0.68, 1.5), 0.1), T.hueco, {
      z: z + fondo / 2 + 0.03,
    });
  }
  return y;
}

/**
 * Arcada: un MURO con los arcos abiertos en el, no una fila de pilares.
 *
 * Un pilar aislado y un poste de telegrafo son la misma silueta de perfil; un
 * arco se lee por el HUECO, y por eso los arcos son agujeros de verdad en la
 * extrusion y no manchas oscuras pintadas encima. Uno va cegado: es lo que
 * separa una ruina de una obra recien hecha.
 *
 * Se dibuja LA ULTIMA, por delante del cuerpo y mas baja: detras de un bloque
 * mas alto un muro sencillamente no se ve.
 */
function arcada(ctx, x0, x1, alto, color, { n = 4, z = FONDO * 1.1 } = {}) {
  const { suelo, rng, T } = ctx;
  const y = altoDe(suelo, x0, x1);
  const forma = apoyada(suelo, x0, x1, [[x0, y + alto], [x1, y + alto]], 0.3);
  const paso = (x1 - x0) / n;
  const w = paso * 0.52;
  const cegado = Math.floor(rng() * n);
  for (let i = 0; i < n; i++) {
    if (i === cegado) continue;
    const cx = x0 + paso * (i + 0.5);
    const pie = y + 0.1;
    const arco = new THREE.Path();
    arco.moveTo(cx - w / 2, pie);
    arco.lineTo(cx - w / 2, pie + alto * 0.42);
    arco.quadraticCurveTo(cx, pie + alto * 0.86, cx + w / 2, pie + alto * 0.42);
    arco.lineTo(cx + w / 2, pie);
    arco.closePath();
    forma.holes.push(arco);
  }
  poner(ctx, forma, color, { ancho: FONDO * 0.9, z });
  // El cegado se tapia: un arco relleno del mismo color no se ve, y uno negro
  // seria otro hueco. Se tapia con cascote, que es lo que se hacia.
  const cx = x0 + paso * (cegado + 0.5);
  calco(ctx, contornoRedondeado(rect(cx - w / 2, y + 0.1, w, alto * 0.55), 0.1), oscuro(color), {
    z: z + FONDO * 0.45 + 0.03,
  });
  void T;
}

/** Chimenea de fabrica: fuste que se estrecha y el remate roto en diagonal. */
function chimenea(ctx, cx, alto, color) {
  const { suelo } = ctx;
  const y = altoDe(suelo, cx - 0.8, cx + 0.8);
  poner(ctx, contornoLlano([
    [cx - 0.78, y - 0.3], [cx + 0.78, y - 0.3],
    [cx + 0.46, y + alto], [cx - 0.5, y + alto * 0.94],
  ]), color, { ancho: FONDO * 1.2 });
  // Aro de coronacion: un tubo liso no se lee como chimenea.
  poner(ctx, contornoRedondeado(rect(cx - 0.62, y + alto * 0.9, 1.16, 0.3), 0.06), oscuro(color), {
    ancho: FONDO * 1.3,
  });
}

/** Torre: el cuerpo mas alto y estrecho, con el remate astillado. */
function torre(ctx, cx, ancho, alto, color, { plantas = 3, z = 0 } = {}) {
  return cuerpo(ctx, cx - ancho / 2, cx + ancho / 2, alto, color, {
    remate: 'roto',
    plantas,
    z,
    fondo: FONDO * 1.5,
  });
}

// ── los nueve ─────────────────────────────────────────────────────────────

/**
 * Cada hito es una COMPOSICION de cuerpos, no un dibujo nuevo. La tabla de
 * `docs/ESCENARIOS.md` §3 bis, ejecutada.
 */
const HITOS = {
  /** Bloque de viviendas destripado + ala baja + escombro. */
  manzana(ctx, cx) {
    const c = ctx.T.fabrica;
    cuerpo(ctx, cx - 3.4, cx + 1.4, 6.4, c, { remate: 'roto', plantas: 4, puerta: true });
    cuerpo(ctx, cx + 1.4, cx + 4.6, 3.2, oscuro(c), { remate: 'plano', plantas: 2, z: -0.5 });
    monton(ctx, cx + 4.4, 2.6, c, 7);
  },

  /** Nave rota + torre de 9,4 + arcada del claustro delante. */
  catedral(ctx, cx) {
    const c = ctx.T.fabrica;
    cuerpo(ctx, cx - 1.2, cx + 4.8, 5.0, c, { remate: 'dosaguas', plantas: 2 });
    torre(ctx, cx - 3.4, 2.8, 9.4, c, { plantas: 3 });
    arcada(ctx, cx + 0.6, cx + 5.4, 2.8, oscuro(c), { n: 4 });
    monton(ctx, cx + 5.6, 2.2, c, 6);
  },

  /** Cuerpo largo de dos plantas con torre central. La Lonja de los Panos. */
  lonja(ctx, cx) {
    const c = ctx.T.fabrica;
    cuerpo(ctx, cx - 5.0, cx + 5.0, 4.2, c, { remate: 'roto', plantas: 2, puerta: true });
    torre(ctx, cx, 2.2, 7.4, c, { plantas: 2 });
  },

  /** Bloque largo de celdas + campanario de esquina + terraza arcada al pie. */
  abadia(ctx, cx) {
    const c = ctx.T.fabrica;
    cuerpo(ctx, cx - 4.2, cx + 3.0, 4.6, c, { remate: 'plano', plantas: 3 });
    torre(ctx, cx + 3.8, 2.0, 6.6, c, { plantas: 2 });
    arcada(ctx, cx - 4.0, cx + 1.2, 2.4, oscuro(c), { n: 4 });
  },

  /** Cuerpo bajo de tejado plano + nave de andenes con los arcos abiertos. */
  estacion(ctx, cx) {
    const c = ctx.T.fabrica;
    cuerpo(ctx, cx - 4.8, cx - 0.4, 3.4, c, { remate: 'plano', plantas: 2, puerta: true });
    cuerpo(ctx, cx - 0.4, cx + 5.0, 5.2, oscuro(c), { remate: 'roto', plantas: 0, z: -0.6 });
    arcada(ctx, cx - 0.2, cx + 4.8, 3.6, c, { n: 3 });
  },

  /** Hormigon bajo y ancho, tejado plano, con un cuerpo de mando encima. */
  fuerte(ctx, cx) {
    const c = ctx.T.metal;
    cuerpo(ctx, cx - 4.0, cx + 4.0, 2.4, c, { remate: 'plano', plantas: 0, fondo: FONDO * 2.2 });
    cuerpo(ctx, cx - 1.2, cx + 1.6, 1.5, oscuro(c), { remate: 'plano', plantas: 0, z: -0.4 });
    // Tronera: hueco negro de verdad, y nunca hay nada asomando por ella.
    const y = altoDe(ctx.suelo, cx - 4.0, cx + 4.0);
    calco(ctx, contornoRedondeado(rect(cx - 2.2, y + 1.0, 4.4, 0.5), 0.08), ctx.T.hueco, {
      z: FONDO * 1.1 + 0.03,
    });
    monton(ctx, cx - 4.2, 2.4, c, 6);
  },

  /** Dos pilas y el tablero partido en dos tramos que no se tocan. */
  puente(ctx, cx) {
    const { suelo, T } = ctx;
    const c = T.fabrica;
    const y = altoDe(suelo, cx - 5, cx + 5);
    const alto = 4.4;
    for (const px of [cx - 3.4, cx + 3.4]) {
      cuerpo(ctx, px - 1.0, px + 1.0, alto, c, { remate: 'plano', plantas: 0 });
    }
    // Los dos tramos NO se tocan: el hueco entre ellos es el puente volado.
    poner(ctx, contornoLlano([
      [cx - 4.8, y + alto], [cx - 0.9, y + alto + 0.35],
      [cx - 1.1, y + alto - 0.3], [cx - 4.8, y + alto - 0.55],
    ]), oscuro(c), { ancho: FONDO * 1.6 });
    poner(ctx, contornoLlano([
      [cx + 0.7, y + alto + 0.2], [cx + 4.8, y + alto],
      [cx + 4.8, y + alto - 0.55], [cx + 0.95, y + alto - 0.35],
    ]), oscuro(c), { ancho: FONDO * 1.6 });
    // Barandilla retorcida colgando del corte: es lo que dice que se cayo.
    poner(ctx, contornoLlano(barra(
      [cx - 1.0, y + alto + 0.3], [cx - 0.2, y + alto - 0.9], 0.07,
    )), T.metal, { ancho: 0.2, z: FONDO * 0.9 });
  },

  /** Torre sola, con el remate astillado. */
  iglesia(ctx, cx) {
    const c = ctx.T.fabrica;
    torre(ctx, cx, 2.6, 8.0, c, { plantas: 3 });
    monton(ctx, cx + 2.2, 2.2, c, 6);
  },

  /** Nave de dientes de sierra + chimenea de 7,2. */
  fabrica(ctx, cx) {
    const c = ctx.T.fabrica;
    cuerpo(ctx, cx - 4.6, cx + 2.2, 4.0, c, { remate: 'sierra', plantas: 2 });
    chimenea(ctx, cx + 4.0, 7.2, oscuro(c));
    monton(ctx, cx + 2.6, 2.2, c, 6);
  },
};

/**
 * Planta el hito del teatro. Es lo unico que le pone NOMBRE al sitio: sin el,
 * dieciseis ciudades con el mismo cascote son la misma ciudad repintada.
 */
export function plantarHito(ctx, id, cx) {
  const construir = HITOS[id] ?? HITOS.manzana;
  construir(ctx, cx);
}

export { contorno };
