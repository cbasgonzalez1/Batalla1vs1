import { BANDOS } from './paleta.js';

/**
 * El catalogo de camuflajes. Un camuflaje es UN NUMERO.
 *
 * Todo el vehiculo —contorno, bandas de sombra, manchas, tizne del deterioro— se
 * calcula de su color base con `tono()` (`docs/ARTE-VEHICULOS.md` §6), asi que
 * anadir un camuflaje es anadir una fila aqui. No hay texturas, no hay mallas
 * nuevas y no cuesta ni una llamada de dibujo mas: el material de relleno es uno
 * solo para los quince y el color va por vertice.
 *
 * ── LA BANDA, Y NO ES NEGOCIABLE ────────────────────────────────────────
 * El bando se distingue POR EL COLOR DEL CASCO y por nada mas: `ARTE-VEHICULOS`
 * §6 prohibe banda de reconocimiento, estrella, cruz y bandera. Un camuflaje que
 * acerque el bando A al B rompe la lectura de la partida, y eso no se arregla
 * con una etiqueta en el HUD ni con un aviso en la tienda.
 *
 * Por eso cada bando tiene una banda de tono, saturacion y valor de la que un
 * camuflaje NO PUEDE SALIR, por mucho que se pague. Las dos estan separadas por
 * 70 grados de tono a cada lado, que es lo que sostiene la lectura a 0,55x de
 * zoom. Lo vigila `tests/art/camuflajes.test.js`.
 *
 * Un camuflaje que quiera salirse —un invierno blanco, un desierto muy claro— es
 * OTRA decision: hay que probar que los dos bandos se siguen distinguiendo con
 * los dos puestos en el mismo campo y pasar `docs/CHECKLIST-REVISION.md` §3.
 *
 * ── PRECIO ──────────────────────────────────────────────────────────────
 * `centimos: 0` es de serie: se desbloquea solo al crear la cuenta. El resto
 * esta en la tienda con su precio puesto, y hasta que el pago exista no se puede
 * comprar ninguno — el catalogo esta listo antes que la caja a proposito, para
 * poder ensenar la tienda y ver si gustan (`docs/PLATAFORMA.md` §2).
 *
 * Modulo puro: numeros y nada mas. No importa Three ni toca el DOM.
 */

/**
 * De donde a donde puede ir un camuflaje de cada bando, en HSL.
 *
 * Salen de los dos ejemplares aprobados, medidos: A oliva `#7D8B4E` es
 * H74 S28 L43 y B acero `#5C7D92` es H203 S23 L47. La banda se abre alrededor
 * de cada uno lo justo para que quepan variantes reconocibles del mismo bando.
 */
export const BANDAS = {
  a: { tono: [45, 105], saturacion: [12, 45], luz: [34, 54] },
  b: { tono: [175, 235], saturacion: [12, 45], luz: [34, 54] },
};

/**
 * El catalogo. El orden es el de la tienda.
 *
 * Los dos primeros son los colores APROBADOS de `paleta.js`, copiados de la
 * referencia y no recalculados: si algun dia cambia el ejemplar, cambia ahi y
 * aqui se sigue leyendo de `BANDOS`.
 */
export const CAMUFLAJES = [
  { id: 'a-oliva', bando: 'a', nombre: 'Oliva', base: BANDOS.a.base, centimos: 0 },
  { id: 'a-caqui', bando: 'a', nombre: 'Caqui del desierto', base: 0xa1964f, centimos: 199 },
  { id: 'a-bosque', bando: 'a', nombre: 'Verde bosque', base: 0x577543, centimos: 199 },
  { id: 'a-liquen', bando: 'a', nombre: 'Liquen', base: 0x869966, centimos: 299 },

  { id: 'b-acero', bando: 'b', nombre: 'Acero', base: BANDOS.b.base, centimos: 0 },
  { id: 'b-invierno', bando: 'b', nombre: 'Gris invierno', base: 0x738d96, centimos: 199 },
  { id: 'b-abisal', bando: 'b', nombre: 'Azul abisal', base: 0x3f5478, centimos: 199 },
  { id: 'b-pizarra', bando: 'b', nombre: 'Pizarra', base: 0x5b8486, centimos: 299 },
];

/** Los que se regalan al crear la cuenta: uno por bando, y son los aprobados. */
export const DE_SERIE = CAMUFLAJES.filter((c) => c.centimos === 0).map((c) => c.id);

const porId = new Map(CAMUFLAJES.map((c) => [c.id, c]));

/**
 * El color base de un camuflaje, o el del bando si no existe.
 *
 * Nunca falla: un cliente viejo que reciba un camuflaje que no conoce pinta el
 * base de su bando y sigue jugando. Un cosmetico no puede impedir una partida.
 */
export function colorDe(id, bando = 'a') {
  return porId.get(id)?.base ?? BANDOS[bando]?.base ?? BANDOS.a.base;
}

/** El catalogo de un bando, en orden de tienda. */
export const deBando = (bando) => CAMUFLAJES.filter((c) => c.bando === bando);

/** Un camuflaje por id, o null. */
export const camuflaje = (id) => porId.get(id) ?? null;

// ── la banda, en codigo ───────────────────────────────────────────────────

/** HSL de un entero 0xRRGGBB, con el tono en grados y el resto en por ciento. */
export function aHsl(color) {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { tono: 0, saturacion: 0, luz: l * 100 };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const tono = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / d + 2) / 6
      : ((r - g) / d + 4) / 6;
  return { tono: tono * 360, saturacion: s * 100, luz: l * 100 };
}

const dentro = (v, [min, max]) => v >= min - 1e-9 && v <= max + 1e-9;

/**
 * Si un color puede venderse para un bando.
 *
 * Se comprueba al arrancar el servidor, antes de sembrar el catalogo: un
 * camuflaje fuera de banda no llega nunca a la tienda.
 */
export function enBanda(color, bando) {
  const banda = BANDAS[bando];
  if (!banda) return false;
  const { tono, saturacion, luz } = aHsl(color);
  return dentro(tono, banda.tono)
    && dentro(saturacion, banda.saturacion)
    && dentro(luz, banda.luz);
}
