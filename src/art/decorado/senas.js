import * as THREE from 'three';
import { contornoRedondeado, contornoLlano } from '../vehiculo/primitivas.js';
import { oscuro, contorno } from '../vehiculo/paleta.js';
import { apoyada, altoDe, poner, calco, monton, rect, barra, circulo, FONDO } from './piezas.js';

/**
 * La seña de cada ciudad. UNA pieza, y no se repite en ninguna otra.
 *
 * Los nueve hitos hacen que las dieciseis parezcan del mismo mundo; la seña es
 * lo que impide que parezcan la misma. Seis ciudades llevan el hito «manzana» y
 * tres la «catedral»: sin algo propio, Varsovia, Rotterdam, Saint-Lo, Budapest y
 * Berlin son literalmente el mismo campo con otra paleta.
 *
 * Cada una sale de algo que estuvo alli de verdad y que se lee EN SILUETA a la
 * escala del juego: la grua del puerto de Rotterdam, el silo de Stalingrado, los
 * dientes de dragon de Aquisgran, la boca de alcantarilla por la que se movio el
 * Levantamiento de Varsovia. Nada de carteles con nombres — el sitio se cuenta
 * con formas, no con letreros.
 *
 * Cero figuras humanas, aqui tambien (`AGENTS.md`): son maquinas, obra civil y
 * escombro.
 */

/** Arco monumental de una sola bovedad. La Puerta de Menin de Ypres. */
function arco(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const w = 5.2;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const alto = 4.6;
  const forma = apoyada(suelo, a, b, [[a, y + alto], [b, y + alto]], 0.3);
  const hueco = new THREE.Path();
  hueco.moveTo(cx - 1.15, y + 0.1);
  hueco.lineTo(cx - 1.15, y + 2.1);
  hueco.quadraticCurveTo(cx, y + 4.0, cx + 1.15, y + 2.1);
  hueco.lineTo(cx + 1.15, y + 0.1);
  hueco.closePath();
  forma.holes.push(hueco);
  poner(ctx, forma, c, { ancho: FONDO * 1.6 });
  // Atico rematado a plomo: es lo que lo separa de un portalon cualquiera.
  poner(ctx, contornoRedondeado(rect(a - 0.25, y + alto, w + 0.5, 0.75), 0.06), oscuro(c), {
    ancho: FONDO * 1.7,
  });
  monton(ctx, b + 1.1, 1.8, c, 5);
}

/** Cupula acorazada de fuerte, achatada y con la tapa desplazada. Verdun. */
function cupulaAcorazada(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.metal;
  const y = altoDe(suelo, cx - 1.6, cx + 1.6);
  poner(ctx, apoyada(suelo, cx - 1.6, cx + 1.6, [
    [cx - 1.6, y + 0.5], [cx - 1.1, y + 1.15], [cx, y + 1.4], [cx + 1.1, y + 1.15],
    [cx + 1.6, y + 0.5],
  ], 0.25), c, { ancho: FONDO * 1.8 });
  // Tapa corrida: la cupula giraba, y verla fuera de sitio dice que reventó.
  poner(ctx, contornoRedondeado([
    [cx + 0.5, y + 1.32], [cx + 1.7, y + 1.05], [cx + 1.62, y + 0.72], [cx + 0.5, y + 0.98],
  ], 0.08), oscuro(c), { ancho: FONDO * 1.3, z: FONDO * 0.3 });
  calco(ctx, contornoRedondeado(rect(cx - 0.75, y + 0.62, 1.5, 0.26), 0.06), T.hueco, {
    z: FONDO * 0.9 + 0.03,
  });
}

/** Columna conmemorativa partida por la mitad. Varsovia, septiembre del 39. */
function columna(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const y = altoDe(suelo, cx - 0.8, cx + 0.8);
  poner(ctx, apoyada(suelo, cx - 0.8, cx + 0.8, [
    [cx - 0.8, y + 0.55], [cx + 0.8, y + 0.55],
  ], 0.25), oscuro(c), { ancho: FONDO * 1.3 });
  poner(ctx, contornoRedondeado(rect(cx - 0.3, y + 0.5, 0.6, 4.0), 0.05), c, { ancho: 0.7 });
  for (const k of [1.2, 2.4, 3.4]) {
    calco(ctx, contornoLlano(barra([cx - 0.3, y + k], [cx + 0.3, y + k], 0.035)), contorno(c));
  }
  // El fuste roto en diagonal y el trozo caido al pie: entera seria un obelisco.
  poner(ctx, contornoLlano([
    [cx - 0.3, y + 4.5], [cx + 0.3, y + 4.5], [cx + 0.34, y + 4.9], [cx - 0.26, y + 5.15],
  ]), c, { ancho: 0.7 });
  poner(ctx, contornoRedondeado([
    [cx + 1.0, y + 0.55], [cx + 2.5, y + 0.72], [cx + 2.5, y + 1.22], [cx + 1.0, y + 1.05],
  ], 0.08), c, { ancho: 0.7, z: FONDO * 0.3 });
}

/** Grua de portico volcada, con el brazo clavado. El puerto de Rotterdam. */
function grua(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.metal;
  const y = altoDe(suelo, cx - 1.2, cx + 1.2);
  // Bastidor en A: dos patas que se juntan arriba. Una sola es un poste.
  for (const s of [-1, 1]) {
    poner(ctx, contornoRedondeado(
      barra([cx + s * 1.15, y - 0.2], [cx + s * 0.18, y + 3.2], 0.13), 0.05,
    ), c, { ancho: 0.44 });
  }
  poner(ctx, contornoRedondeado(barra([cx - 0.9, y + 1.5], [cx + 0.9, y + 1.5], 0.1), 0.04), c, {
    ancho: 0.4,
  });
  // La pluma, caida y clavada en el suelo. Es la silueta que dice PUERTO.
  poner(ctx, contornoRedondeado(barra([cx + 0.1, y + 3.3], [cx + 3.6, y + 0.3], 0.16), 0.05), c, {
    ancho: 0.5, z: FONDO * 0.25,
  });
  poner(ctx, circulo(cx + 0.1, y + 3.3, 0.3), oscuro(c), { ancho: 0.6, z: FONDO * 0.3 });
  monton(ctx, cx + 3.7, 1.6, T.escombro, 5);
}

/** Campanario esbelto con la esfera del reloj. Coventry. */
function campanario(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const w = 1.9;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const alto = 7.4;
  poner(ctx, apoyada(suelo, a, b, [
    [a, y + alto], [a + w * 0.5, y + alto + 1.5], [b, y + alto],
  ], 0.3), c, { ancho: FONDO * 1.4 });
  // Esfera de reloj: dos agujas y el aro. No es iconografia, es una maquina.
  calco(ctx, circulo(cx, y + alto * 0.72, 0.42), oscuro(c), { z: FONDO * 0.7 + 0.03 });
  calco(ctx, circulo(cx, y + alto * 0.72, 0.3), T.fabrica, { z: FONDO * 0.7 + 0.05 });
  calco(ctx, contornoLlano(barra(
    [cx, y + alto * 0.72], [cx + 0.02, y + alto * 0.72 + 0.24], 0.035,
  )), T.hueco, { z: FONDO * 0.7 + 0.07 });
  calco(ctx, contornoLlano(barra(
    [cx, y + alto * 0.72], [cx + 0.19, y + alto * 0.72 - 0.1], 0.035,
  )), T.hueco, { z: FONDO * 0.7 + 0.07 });
  for (const k of [0.34, 0.5]) {
    calco(ctx, contornoRedondeado(rect(cx - 0.22, y + alto * k, 0.44, 0.8), 0.2), T.hueco, {
      z: FONDO * 0.7 + 0.03,
    });
  }
}

/** Silo de grano: cilindros pegados con la coronacion continua. Stalingrado. */
function silo(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const y = altoDe(suelo, cx - 2.4, cx + 2.4);
  const alto = 5.4;
  for (const [dx, k] of [[-1.5, 1], [0, 1.06], [1.5, 0.94]]) {
    poner(ctx, apoyada(suelo, cx + dx - 0.75, cx + dx + 0.75, [
      [cx + dx - 0.75, y + alto * k], [cx + dx + 0.75, y + alto * k],
    ], 0.3), dx === 0 ? c : oscuro(c), { ancho: FONDO * (1.5 - Math.abs(dx) * 0.1) });
  }
  // Cornisa corrida: es lo que ata los tres cilindros en un solo edificio.
  poner(ctx, contornoRedondeado(rect(cx - 2.5, y + alto * 1.06, 5.0, 0.4), 0.06), oscuro(c), {
    ancho: FONDO * 1.6,
  });
  // Y el boquete: un silo entero no cuenta que aqui se peleo casa por casa.
  calco(ctx, contornoRedondeado([
    [cx - 0.6, y + 1.4], [cx + 0.7, y + 1.1], [cx + 0.9, y + 3.0], [cx - 0.4, y + 3.3],
  ], 0.15), T.hueco, { z: FONDO * 0.75 + 0.03 });
}

/** Deposito de agua sobre cuatro patas. La estacion de Jarkov. */
function torreDeAgua(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.metal;
  const y = altoDe(suelo, cx - 1.5, cx + 1.5);
  const alto = 3.4;
  for (const s of [-1, 1]) {
    poner(ctx, contornoRedondeado(
      barra([cx + s * 1.35, y - 0.2], [cx + s * 0.85, y + alto], 0.11), 0.04,
    ), c, { ancho: 0.4 });
  }
  poner(ctx, contornoRedondeado(barra([cx - 1.15, y + 1.6], [cx + 1.15, y + 1.6], 0.08), 0.03), c, {
    ancho: 0.36,
  });
  poner(ctx, contornoRedondeado([
    [cx - 1.15, y + alto], [cx + 1.15, y + alto],
    [cx + 0.95, y + alto + 1.6], [cx - 0.95, y + alto + 1.6],
  ], 0.22), oscuro(c), { ancho: FONDO * 1.2 });
  poner(ctx, contornoRedondeado(rect(cx - 1.0, y + alto + 1.55, 2.0, 0.3), 0.08), c, {
    ancho: FONDO * 1.25,
  });
}

/** Muro de contencion en terrazas, el que sube al monte. Montecassino. */
function terrazas(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const y = altoDe(suelo, cx - 3.2, cx + 3.2);
  for (let i = 0; i < 3; i++) {
    const a = cx - 3.2 + i * 1.05;
    const b = cx + 3.2;
    poner(ctx, apoyada(suelo, a, b, [[a, y + 0.7 + i * 0.85], [b, y + 0.7 + i * 0.85]], 0.28), c, {
      ancho: FONDO * (1.5 - i * 0.25),
      z: -i * 0.35,
    });
    // Sillares marcados: sin la junta, tres bandas de color son una escalera.
    for (let x = a + 0.5; x < b - 0.3; x += 1.1) {
      calco(ctx, contornoLlano(barra(
        [x, y + 0.7 + i * 0.85 - 0.62], [x, y + 0.7 + i * 0.85], 0.035,
      )), contorno(c), { z: FONDO * 0.7 - i * 0.35 + 0.03 });
    }
  }
  monton(ctx, cx - 3.4, 1.8, c, 5);
}

/** Lienzo de muralla almenada. El castillo de Caen. */
function muralla(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const w = 6.0;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const alto = 3.0;
  // Almenas: el diente REGULAR es lo que la separa de un muro roto cualquiera.
  const remate = [];
  for (let i = 0; i <= 8; i++) {
    remate.push([a + (w * i) / 8, y + alto + (i % 2 ? 0.55 : 0)]);
    if (i < 8) remate.push([a + (w * (i + 1)) / 8, y + alto + (i % 2 ? 0.55 : 0)]);
  }
  poner(ctx, apoyada(suelo, a, b, remate, 0.3), c, { ancho: FONDO * 1.5 });
  // Y un tramo caido: entera seria un decorado de feria.
  calco(ctx, contornoRedondeado([
    [b - 1.9, y + alto + 0.5], [b - 0.5, y + alto - 0.1],
    [b - 0.4, y + 1.1], [b - 2.0, y + 1.5],
  ], 0.12), oscuro(c), { z: FONDO * 0.75 + 0.03 });
  // Saetera: un hueco alto y estrechisimo. Es la firma de una muralla.
  calco(ctx, contornoRedondeado(rect(a + 1.4, y + 1.2, 0.22, 1.1), 0.08), T.hueco, {
    z: FONDO * 0.75 + 0.03,
  });
  monton(ctx, b + 0.8, 1.7, c, 5);
}

/** Mojon de carretera con la chapa doblada. «La capital de las ruinas». */
function mojon(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const y = altoDe(suelo, cx - 0.35, cx + 0.35);
  poner(ctx, apoyada(suelo, cx - 0.32, cx + 0.32, [
    [cx - 0.32, y + 0.9], [cx - 0.2, y + 1.15], [cx + 0.2, y + 1.15], [cx + 0.32, y + 0.9],
  ], 0.22), c, { ancho: 0.6 });
  calco(ctx, contornoRedondeado(rect(cx - 0.26, y + 0.72, 0.52, 0.34), 0.06), oscuro(c), {
    z: 0.34,
  });
  // El poste con la chapa doblada. Sin letras: el sitio se cuenta con formas.
  const m = T.metal;
  poner(ctx, contornoRedondeado(barra([cx + 0.9, y - 0.2], [cx + 1.05, y + 2.3], 0.08), 0.03), m, {
    ancho: 0.3,
  });
  poner(ctx, contornoRedondeado([
    [cx + 1.0, y + 2.3], [cx + 2.1, y + 2.05], [cx + 2.2, y + 1.5], [cx + 1.05, y + 1.72],
  ], 0.07), m, { ancho: 0.26, z: 0.2 });
}

/** Boca de alcantarilla abierta. Por ahi se movio el Levantamiento de Varsovia. */
function alcantarilla(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.adoquin;
  const y = altoDe(suelo, cx - 1.3, cx + 1.3);
  // Brocal: un anillo bajo de adoquin. Es lo unico que asoma del suelo.
  poner(ctx, apoyada(suelo, cx - 1.15, cx + 1.15, [
    [cx - 1.15, y + 0.38], [cx - 0.62, y + 0.42], [cx + 0.62, y + 0.42], [cx + 1.15, y + 0.38],
  ], 0.2), c, { ancho: FONDO * 1.1 });
  // El agujero, negro de verdad: es un agujero.
  calco(ctx, contornoRedondeado(rect(cx - 0.6, y + 0.06, 1.2, 0.34), 0.14), T.hueco, {
    z: FONDO * 0.55 + 0.03,
  });
  // La tapa, apoyada de canto contra el brocal.
  poner(ctx, circulo(cx + 1.5, y + 0.55, 0.55), T.metal, { ancho: 0.22, z: FONDO * 0.4 });
  calco(ctx, circulo(cx + 1.5, y + 0.55, 0.3), contorno(T.metal), { z: FONDO * 0.4 + 0.15 });
}

/** Planeador estrellado: el ala rota clavada en el suelo. Arnhem. */
function planeador(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.metal;
  const y = altoDe(suelo, cx - 2.2, cx + 2.2);
  // Fuselaje partido, con la cola levantada.
  poner(ctx, apoyada(suelo, cx - 2.0, cx + 1.2, [
    [cx - 2.0, y + 0.5], [cx - 1.2, y + 0.95], [cx + 0.4, y + 0.9], [cx + 1.2, y + 0.55],
  ], 0.22), c, { ancho: FONDO * 0.9 });
  poner(ctx, contornoRedondeado([
    [cx + 0.9, y + 0.6], [cx + 2.3, y + 1.9], [cx + 2.05, y + 2.15], [cx + 0.8, y + 0.95],
  ], 0.08), oscuro(c), { ancho: FONDO * 0.6, z: FONDO * 0.2 });
  // El ala, clavada de canto: tumbada no se ve, y de canto es la silueta.
  poner(ctx, contornoRedondeado(
    barra([cx - 1.4, y + 0.3], [cx - 0.2, y + 2.6], 0.16), 0.06,
  ), c, { ancho: 0.5, z: FONDO * 0.35 });
  calco(ctx, contornoRedondeado(rect(cx - 1.1, y + 0.62, 0.34, 0.3), 0.08), T.hueco, {
    z: FONDO * 0.45 + 0.03,
  });
}

/** Dientes de dragon: la linea Sigfrido en cada cruce. Aquisgran. */
function dientesDeDragon(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.metal;
  // Cuatro filas escalonadas y de altura creciente. Una sola fila es un bordillo.
  for (let i = 0; i < 5; i++) {
    const x = cx - 2.2 + i * 1.1;
    const alto = 0.55 + (i % 2 ? 0.3 : 0.12) + i * 0.09;
    poner(ctx, apoyada(suelo, x - 0.42, x + 0.42, [
      [x - 0.42, altoDe(suelo, x - 0.42, x + 0.42) + alto * 0.55],
      [x, altoDe(suelo, x - 0.42, x + 0.42) + alto],
      [x + 0.42, altoDe(suelo, x - 0.42, x + 0.42) + alto * 0.55],
    ], 0.22), i % 2 ? oscuro(c) : c, { ancho: FONDO * 0.9, z: (i % 2 ? 0.35 : -0.35) });
  }
}

/** Balcon de hierro colgando de un paño de muro. Budapest. */
function balcon(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const w = 2.4;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const alto = 4.2;
  poner(ctx, apoyada(suelo, a, b, [
    [a, y + alto], [a + w * 0.4, y + alto - 0.5], [b, y + alto - 0.15],
  ], 0.3), c, { ancho: FONDO * 1.2 });
  calco(ctx, contornoRedondeado(rect(cx - 0.45, y + 2.5, 0.9, 1.2), 0.1), T.hueco, {
    z: FONDO * 0.6 + 0.03,
  });
  // La losa del balcon, descolgada de un lado, y la baranda torcida.
  const m = T.metal;
  poner(ctx, contornoLlano([
    [cx - 0.85, y + 2.45], [cx + 1.35, y + 2.15], [cx + 1.3, y + 1.9], [cx - 0.85, y + 2.2],
  ]), oscuro(c), { ancho: FONDO * 0.8, z: FONDO * 0.5 });
  for (let i = 0; i < 5; i++) {
    const x = cx - 0.75 + i * 0.5;
    poner(ctx, contornoLlano(barra([x, y + 2.35], [x + 0.12, y + 3.0], 0.05)), m, {
      ancho: 0.14, z: FONDO * 0.62,
    });
  }
  poner(ctx, contornoLlano(barra([cx - 0.8, y + 3.0], [cx + 1.4, y + 2.75], 0.06)), m, {
    ancho: 0.14, z: FONDO * 0.62,
  });
}

/** Cupula caida: los nervios de la boveda amontonados. Dresde. */
function cupulaCaida(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const y = altoDe(suelo, cx - 2.6, cx + 2.6);
  monton(ctx, cx, 4.6, c, 10);
  // Los nervios: cuatro arcos rotos asomando de la pila, abiertos como gajos.
  // Es lo que la separa de un monton de escombro grande.
  for (const [dx, ang, largo] of [
    [-1.7, 1.15, 2.4], [-0.5, 1.45, 2.9], [0.8, 1.25, 2.6], [1.9, 0.95, 2.0],
  ]) {
    const x0 = cx + dx;
    const y0 = suelo(x0) + 0.2;
    poner(ctx, contornoRedondeado(barra(
      [x0, y0], [x0 + Math.cos(ang) * largo * 0.5, y0 + Math.sin(ang) * largo], 0.13,
    ), 0.05), oscuro(c), { ancho: 0.42, z: dx * 0.2 });
  }
}

/** Columnata con el entablamento partido. La puerta de Berlin. */
function columnata(ctx, cx) {
  const { suelo, T } = ctx;
  const c = T.fabrica;
  const w = 5.4;
  const a = cx - w / 2;
  const b = cx + w / 2;
  const y = altoDe(suelo, a, b);
  const alto = 4.4;
  // Basamento corrido: sin el, cinco columnas sueltas son cinco postes.
  poner(ctx, apoyada(suelo, a, b, [[a, y + 0.45], [b, y + 0.45]], 0.28), oscuro(c), {
    ancho: FONDO * 1.5,
  });
  for (let i = 0; i < 5; i++) {
    const x = a + 0.6 + (i * (w - 1.2)) / 4;
    const rota = i === 3;
    const h = rota ? alto * 0.62 : alto;
    poner(ctx, contornoRedondeado([
      [x - 0.28, y + 0.4], [x + 0.28, y + 0.4],
      [x + 0.24, y + h], [x - 0.24, y + h + (rota ? 0.25 : 0)],
    ], 0.05), c, { ancho: 0.62 });
    for (const k of [0.35, 0.6, 0.82]) {
      if (k * alto > h) continue;
      calco(ctx, contornoLlano(barra(
        [x - 0.24, y + alto * k], [x + 0.24, y + alto * k], 0.03,
      )), contorno(c), { z: 0.34 });
    }
  }
  // Entablamento partido justo encima de la columna rota.
  poner(ctx, contornoLlano([
    [a, y + alto], [cx + 0.3, y + alto + 0.1], [cx + 0.2, y + alto + 0.85], [a, y + alto + 0.8],
  ]), c, { ancho: FONDO * 1.3 });
  poner(ctx, contornoLlano([
    [cx + 1.0, y + alto - 0.15], [b, y + alto], [b, y + alto + 0.8], [cx + 0.95, y + alto + 0.6],
  ]), c, { ancho: FONDO * 1.3 });
  monton(ctx, cx + 0.6, 1.9, c, 6);
}

/**
 * El catalogo. `ancho` es lo que la seña reserva en el terreno.
 *
 * Una por ciudad y ninguna compartida: si dos ciudades compartieran seña,
 * volveriamos al problema que esto viene a arreglar.
 */
export const SENAS = {
  puertaArco: { ancho: 6.4, construir: arco },
  cupulaAcorazada: { ancho: 4.2, construir: cupulaAcorazada },
  columna: { ancho: 4.0, construir: columna },
  grua: { ancho: 6.0, construir: grua },
  campanario: { ancho: 3.2, construir: campanario },
  silo: { ancho: 5.8, construir: silo },
  torreDeAgua: { ancho: 3.6, construir: torreDeAgua },
  terrazas: { ancho: 7.2, construir: terrazas },
  muralla: { ancho: 7.4, construir: muralla },
  mojon: { ancho: 3.2, construir: mojon },
  alcantarilla: { ancho: 3.6, construir: alcantarilla },
  planeador: { ancho: 5.2, construir: planeador },
  dientes: { ancho: 5.6, construir: dientesDeDragon },
  balcon: { ancho: 3.4, construir: balcon },
  cupulaCaida: { ancho: 5.4, construir: cupulaCaida },
  columnata: { ancho: 6.2, construir: columnata },
};
