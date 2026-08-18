import * as THREE from 'three';
import { mancha, pintar, VIA } from './primitivas.js';
import { tono, claro } from './paleta.js';

/**
 * Que un blindado se vea TOCADO.
 *
 * Hasta ahora un vehiculo con 4 puntos de vida se veia exactamente igual que
 * uno recien salido de fabrica: el unico sitio donde el daño existia era la
 * barra del marcador. Eso rompe lo primero que se le pide a un juego de tiro por
 * turnos —que se lea el estado de la partida MIRANDO EL CAMPO— y ademas hace que
 * un impacto directo se sienta gratis: suena, sacude y no deja marca.
 *
 * Tres cosas, y NINGUNA cuesta una llamada de dibujo mas:
 *
 *  1. TIZNE. El color por vertice del casco, la torreta y el tubo se mezcla
 *     hacia el hollin segun la vida perdida. Se toca el atributo `color` de la
 *     geometria de ESE vehiculo, no el material, que es unico y compartido por
 *     los quince: teñir el material tiznaria a los dos bandos a la vez.
 *  2. CICATRICES. Cinco impactos que van DENTRO de la geometria del casco desde
 *     el primer cuadro, pintados del color del casco — o sea, invisibles. Se
 *     «descubren» repintando sus vertices, no anadiendo malla.
 *
 *     Colgarlas de una malla aparte con `drawRange` es lo primero que se probo y
 *     es lo que hay que NO hacer: sube el vehiculo de nueve llamadas de dibujo a
 *     diez y se lleva por delante el presupuesto de `docs/ARTE-VEHICULOS.md` §7,
 *     que son ocho. Ademas `fusionar()` borra todo atributo que no sea posicion
 *     y normal, asi que la malla suelta salia SIN color y las cinco marcas se
 *     pintaban de negro puro: lunares, no chapa castigada.
 *  3. HUMO. Por debajo del 45 % sale una columna lenta del motor. Lo pone
 *     `art/efectos.js`, que ya tiene el sistema de particulas.
 */

/** Hollin. Ni negro puro ni gris neutro: un quemado calido y sucio. */
const HOLLIN = 0x2b2823;

/** Cuanto tizne como mucho, con la vida a cero. Al 100 % no se lee el bando. */
const TIZNE_MAXIMO = 0.5;

/** Cinco impactos. Con mas, un vehiculo tocado se lee como pintado a topos. */
const CICATRICES = 5;

/** Por debajo de esto humea. Es la mitad justa menos un pelo: se ve venir. */
export const HUMO_DESDE = 0.45;

const c0 = new THREE.Color();
const cHollin = new THREE.Color(HOLLIN);

/**
 * Donde recibe.
 *
 * Salen de la silueta de LA FICHA y no de una tabla suelta, para que un PESADO
 * de siete unidades no lleve las cinco marcas apiñadas en el morro. Y van todas
 * dentro del CASCO —entre la panza y la meseta— porque las cicatrices viven en
 * la geometria del casco: puesta a la altura de la torreta, una marca queda
 * flotando fuera de la silueta.
 *
 * Repartidas y nunca en fila: alineadas se leen como una decoracion.
 */
function sitiosDe(f) {
  const techo = f.y0 + f.alto + (f.opts?.alza ?? 0);
  const cintura = f.y0 + f.alto * 0.5;
  return [
    [f.L * 0.2, cintura + 0.2, f.L * 0.06],
    [-f.L * 0.28, cintura - 0.06, f.L * 0.05],
    [f.L * 0.02, techo - 0.14, f.L * 0.045],
    [f.L * 0.38, cintura - 0.02, f.L * 0.042],
    [-f.L * 0.1, f.y0 + 0.14, f.L * 0.055],
  ].slice(0, CICATRICES);
}

/**
 * Las cicatrices, para que `ensamblar` las funda CON el casco.
 *
 * Salen pintadas del color del casco (invisibles) y traen aparte el color que
 * tendran al descubrirse.
 *
 * @returns {{piezas: THREE.BufferGeometry[], revelado: Float32Array, porCicatriz: number}}
 */
export function cicatricesDe(ficha, base) {
  // El tiznon va en el tono OSCURO del propio casco, no en negro: en negro las
  // cinco marcas se leen como lunares pegados encima; en la pintura quemada del
  // mismo color, como chapa castigada — que es lo que son. El boquete si es
  // hollin, porque un boquete es un agujero.
  const quemado = tono(base, -0.5);
  const invisible = claro(base);

  const piezas = [];
  const colores = [];
  for (const [x, y, r] of sitiosDe(ficha)) {
    // Dos discos por impacto: el tiznon ancho y el boquete. Uno solo se lee como
    // una pegatina redonda; los dos, como algo que ha entrado.
    const fuera = mancha(x, y, r, r * 0.74, VIA);
    const dentro = mancha(x, y, r * 0.42, r * 0.3, VIA + 0.01);
    for (const [g, color] of [[fuera, quemado], [dentro, HOLLIN]]) {
      pintar(g, color, false);
      colores.push(Float32Array.from(g.attributes.color.array));
      // Y ahora se repinta del color del casco: en un vehiculo entero no se ve
      // ni una marca, que es como tiene que salir de fabrica.
      pintar(g, invisible, false);
      piezas.push(g);
    }
  }

  let largo = 0;
  for (const c of colores) largo += c.length;
  const revelado = new Float32Array(largo);
  let k = 0;
  for (const c of colores) {
    revelado.set(c, k);
    k += c.length;
  }

  return { piezas, revelado, porCicatriz: revelado.length / CICATRICES };
}

/**
 * @param {object} opciones
 * @param {THREE.BufferGeometry[]} opciones.geometrias  las que se tiznan; la
 *   PRIMERA tiene que ser la del casco, con las cicatrices al final
 * @param {Float32Array} opciones.revelado  el color de las cicatrices, descubiertas
 */
export function crearDeterioro({ geometrias, revelado, porCicatriz }) {
  // El color de fabrica, guardado antes de tocar nada: el tizne se calcula
  // SIEMPRE desde el original. Mezclando sobre lo ya mezclado, un vehiculo que
  // recupera vida no vuelve a su color y acaba negro a base de cuadros.
  const originales = geometrias.map((g) => Float32Array.from(g.attributes.color.array));
  const casco = geometrias[0].attributes.color;
  const desde = casco.array.length - revelado.length;

  let ultimo = -1;

  return {
    /**
     * @param {number} vida  de 0 a 1
     * @returns {boolean} si a este le toca humear
     */
    aplicar(vida) {
      const k = Math.min(1, Math.max(0, 1 - vida));
      // El daño llega a saltos —un impacto son decenas de puntos— asi que
      // repintar veinte mil vertices en cada cuadro seria tirar el presupuesto:
      // solo se toca cuando el tramo cambia de verdad.
      const paso = Math.round(k * 20);
      if (paso !== ultimo) {
        ultimo = paso;
        const t = (paso / 20) * TIZNE_MAXIMO;
        geometrias.forEach((g, i) => {
          const dest = g.attributes.color.array;
          const orig = originales[i];
          for (let v = 0; v < dest.length; v += 3) {
            c0.setRGB(orig[v], orig[v + 1], orig[v + 2]).lerp(cHollin, t);
            dest[v] = c0.r;
            dest[v + 1] = c0.g;
            dest[v + 2] = c0.b;
          }
          g.attributes.color.needsUpdate = true;
        });
        // Y encima del tizne, las cicatrices descubiertas: una por cada quinto
        // de vida perdida. Van despues a proposito — una marca tiznada dos veces
        // deja de ser una marca.
        const cuantas = Math.round(k * CICATRICES);
        for (let v = 0; v < cuantas * porCicatriz; v++) {
          casco.array[desde + v] = revelado[v];
        }
      }
      return vida > 0 && vida < HUMO_DESDE;
    },
  };
}
