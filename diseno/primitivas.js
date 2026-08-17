/**
 * Primitivas SVG de las planchas.
 *
 * Se dibuja en coordenadas de mundo con la Y HACIA ARRIBA, igual que el juego, y
 * el volteo se hace una sola vez en el envoltorio (`lienzo`). Autorar la mitad en
 * coordenadas de pantalla y la otra mitad en coordenadas de mundo ya rompio una
 * plancha entera; con un solo volteo eso no puede volver a pasar.
 *
 * Cero arcos: todo circulo o capsula sale muestreado como poligono. Los flags de
 * barrido de `A` se invierten al voltear la Y y no hay forma de comprobarlos sin
 * mirar el resultado.
 */

const n = (v) => (Math.round(v * 1000) / 1000).toString();

export const P = (x, y) => [x, y];

// ── caminos ───────────────────────────────────────────────────────────────

/** Poligono con las esquinas redondeadas. ARTE.md §1.5: cero esquinas vivas. */
export function caminoRedondeado(pts, r = 0.12) {
  const N = pts.length;
  let d = '';
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1;
    const l2 = Math.hypot(v2[0], v2[1]) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + (v1[0] / l1) * rr, p1[1] + (v1[1] / l1) * rr];
    const b = [p1[0] + (v2[0] / l2) * rr, p1[1] + (v2[1] / l2) * rr];
    d += `${i === 0 ? 'M' : 'L'}${n(a[0])} ${n(a[1])}Q${n(p1[0])} ${n(p1[1])} ${n(b[0])} ${n(b[1])}`;
  }
  return d + 'Z';
}

/** Poligono abierto, sin cerrar. Para el perfil del terreno y de las crestas. */
export function polilinea(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('');
}

/** Circulo muestreado. `lados` alto porque a 0,55x un heptagono canta. */
export function circulo(cx, cy, r, lados = 28) {
  const pts = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return polilinea(pts) + 'Z';
}

/** Rectangulo de esquinas redondeadas, como camino. */
export function caja(x, y, w, h, r = 0.1) {
  return caminoRedondeado([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
}

/**
 * Capsula de la oruga: recorrido cerrado alrededor del tren de rodaje, con el
 * ramal superior COLGANDO. Una recta tensa arriba se lee como juguete y es el
 * fallo mas repetido del tren de rodaje (docs/ARTE-VEHICULOS.md §4).
 */
export function capsulaOruga(x0, x1, r, comba = 0.14) {
  const cy = r;
  const ci = x0 + r, cd = x1 - r;
  const pts = [];
  const lados = 16;
  // ramal inferior, de izquierda a derecha
  pts.push([ci, cy - r], [cd, cy - r]);
  // tapa derecha
  for (let i = 1; i < lados; i++) {
    const a = -Math.PI / 2 + (i / lados) * Math.PI;
    pts.push([cd + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  // ramal superior, de derecha a izquierda, con comba
  const pasos = 12;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = cd + (ci - cd) * t;
    const caida = Math.sin(t * Math.PI) * comba;
    pts.push([x, cy + r - caida]);
  }
  // tapa izquierda
  for (let i = 1; i < lados; i++) {
    const a = Math.PI / 2 + (i / lados) * Math.PI;
    pts.push([ci + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return polilinea(pts) + 'Z';
}

// ── elementos ─────────────────────────────────────────────────────────────

const atributos = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? n(v) : v}"`)
    .join(' ');

export const camino = (d, o = {}) => `<path d="${d}" ${atributos(o)}/>`;
export const grupo = (contenido, o = {}) => `<g ${atributos(o)}>${contenido}</g>`;

/**
 * ARTE.md §1.4. Sin elipse de contacto el objeto flota, y flotar es el defecto
 * que mas se nota y menos se diagnostica.
 */
export function sombraContacto(cx, ancho, ry = 0.18, color = '#000') {
  return `<ellipse cx="${n(cx)}" cy="0" rx="${n(ancho / 2)}" ry="${n(ry)}" fill="${color}" opacity="0.20"/>`;
}

/**
 * Fila de remaches. Un remache de 0,12 u no existe a ningun zoom; lo que existe
 * es la FILA, un trazo discontinuo que de lejos se lee como linea y de cerca
 * como remaches. Nivel C de docs/ARTE-VEHICULOS.md §1.
 */
export function filaRemaches(x0, x1, y, color, grosor = 0.055) {
  return `<path d="M${n(x0)} ${n(y)}L${n(x1)} ${n(y)}" stroke="${color}" stroke-width="${n(grosor)}" stroke-linecap="round" stroke-dasharray="${n(grosor * 0.9)} ${n(grosor * 3.1)}" fill="none"/>`;
}

/**
 * Rueda de rodadura: llanta, aro oscuro modelado, buje y cuatro tornillos.
 * Sin buje una rueda es un circulo y se lee como un agujero en la oruga.
 * No lleva shell de contorno: su contorno es geometria, y con seis vehiculos en
 * pantalla un shell por rueda serian cuarenta llamadas de dibujo por nada.
 */
export function rueda(cx, cy, r, c, tornillos = 4) {
  let s = '';
  s += camino(circulo(cx, cy, r), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.88), { fill: c.llanta });
  s += camino(circulo(cx, cy, r * 0.62), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.5), { fill: c.buje });
  for (let i = 0; i < tornillos; i++) {
    const a = (i / tornillos) * Math.PI * 2 + Math.PI / 4;
    s += camino(circulo(cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34, r * 0.1, 10), { fill: c.llanta });
  }
  s += camino(circulo(cx, cy, r * 0.2, 12), { fill: c.llanta });
  return s;
}

/** Neumatico: flanco grueso de caucho y buje metalico de radios. */
export function neumatico(cx, cy, r, c) {
  let s = '';
  s += camino(circulo(cx, cy, r), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.91), { fill: c.base });
  s += camino(circulo(cx, cy, r * 0.55), { fill: c.contorno });
  s += camino(circulo(cx, cy, r * 0.46), { fill: c.llanta });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    s += camino(circulo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, r * 0.1, 10), { fill: c.buje });
  }
  // dibujo de banda: trazo discontinuo, nunca tacos modelados
  s += `<path d="${circulo(cx, cy, r * 0.95)}" fill="none" stroke="${c.buje}" stroke-width="${n(r * 0.1)}" stroke-dasharray="${n(r * 0.22)} ${n(r * 0.3)}"/>`;
  return s;
}

// ── un cuerpo, un contorno ────────────────────────────────────────────────

let contador = 0;

/**
 * Pinta una lista de formas como UNA silueta continua.
 *
 * Dos pasadas: primero todas con trazo grueso del color de contorno, despues
 * las mismas rellenas encima. Los bordes interiores quedan tapados y solo
 * sobrevive el perimetro — un circulo pegado a un rectangulo pegado a un tubo
 * se lee como un tanque y no como cuatro figuras juntas.
 *
 * Es la unica tecnica posible aqui: `filter` y las mascaras de desenfoque estan
 * prohibidas por ARTE.md §1.6, y un contorno por pieza reintroduce las costuras.
 * La misma tecnica sirve para vehiculos y para decorado, que es lo que hace que
 * tengan el mismo acabado (docs/ESCENARIOS.md §1).
 */
export function siluetaUnica({ formas, cont, tonoClaro, tonoBase, grosor = 0.13, luz = [0.1, -0.15], dentro = '' }) {
  const id = `s${contador++}`;
  const todas = formas.map((d) => camino(d, {})).join('');
  let s = grupo(todas, {
    fill: cont, stroke: cont, 'stroke-width': grosor * 2,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  });
  let relleno = grupo(todas, { fill: tonoClaro });
  relleno += grupo(todas, { fill: tonoBase, transform: `translate(${n(luz[0])} ${n(luz[1])})` });
  relleno += dentro;
  s += `<clipPath id="${id}">${formas.map((d) => `<path d="${d}"/>`).join('')}</clipPath>`;
  s += grupo(relleno, { 'clip-path': `url(#${id})` });
  return s;
}

// ── lienzo ────────────────────────────────────────────────────────────────

/**
 * Envuelve contenido autorado en Y-arriba y lo voltea una sola vez.
 * `suelo` es la Y de pantalla donde cae el y=0 del mundo.
 */
export function lienzo({ ancho, alto, escala, ox, suelo, fondo, contenido, extra = '' }) {
  return `<svg viewBox="0 0 ${n(ancho)} ${n(alto)}" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
${fondo ?? ''}
<g transform="translate(${n(ox)} ${n(suelo)}) scale(${n(escala)} ${n(-escala)})">${contenido}</g>
${extra}
</svg>`;
}
