import { describe, it, expect } from 'vitest';
import { Terrain, COMPOSICIONES } from '../../src/world/terrain.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';
import { AVANCE, mover, encerrado } from '../../src/game/avance.js';

/**
 * Las tres composiciones de calle son OTROS SUELOS, no otra decoracion, y por
 * eso se prueban aqui y no mirando una captura: lo que las define es una
 * propiedad del heightmap —hondura del foso, altura del monton— y una propiedad
 * de juego —que se pueda salir—.
 *
 * `docs/ESCENARIOS.md` §3 ter.
 */

const BIOMA = { crest: '#c8b48a', body: '#a08a5e', deep: '#6b5638' };
const CANON = 44;
const PADS = [-CANON, CANON].map((x) => ({ x, halfWidth: 2.6, feather: 3.2 }));
const MONTON_MEDIO = 15;

const construir = (semilla, composicion) =>
  new Terrain({
    rng: mulberry32(hashSeed(semilla)),
    biome: BIOMA,
    width: 140,
    columns: 700,
    depth: 4.2,
    minHeight: 3.2,
    amplitude: 13,
    bowlHalfWidth: CANON,
    pads: PADS,
    composicion,
  });

/**
 * Lo que un deposito lleno da de si desde `x` hacia `signo`.
 *
 * Se mide con `mover()` y no con la pendiente cruda a proposito: el terreno
 * generado tiene laderas naturales de hasta 72 grados —muy por encima de lo que
 * sube una oruga— asi que medir la pendiente maxima del tramo mide el ruido, no
 * la composicion. Lo que importa es lo que el jugador puede hacer.
 */
const alcance = (t, x, signo) => Math.abs(mover({
  x,
  pedido: signo * 20,
  combustible: AVANCE.deposito,
  alturaEn: (u) => t.heightAt(u),
  minX: -70,
  maxX: 70,
}).recorrido);

const atrapado = (t, x) => encerrado({
  x,
  combustible: AVANCE.deposito,
  alturaEn: (u) => t.heightAt(u),
  minX: -70,
  maxX: 70,
});

describe('las tres composiciones de calle', () => {
  it('son tres y ninguna mas', () => {
    expect(COMPOSICIONES).toEqual(['avenida', 'zanja', 'monton']);
  });

  it('una composicion desconocida cae en avenida y no revienta', () => {
    expect(construir('x', 'catedral').composicion).toBe('avenida');
  });

  it.each(COMPOSICIONES)('%s es determinista con la misma semilla', (comp) => {
    const a = construir('vostok', comp);
    const b = construir('vostok', comp);
    for (let i = 0; i < a.cols; i++) expect(a.heights[i]).toBe(b.heights[i]);
  });

  describe('zanja en la calzada', () => {
    it('mete al blindado en un hoyo, y el labio tapa el tiro tenso', () => {
      for (const semilla of ['a', 'b', 'c', 'd']) {
        const t = construir(semilla, 'zanja');
        const fondo = t.heightAt(-CANON);
        // El labio esta por encima del fondo lo bastante como para que un tiro
        // raso se estrelle contra el, que es de lo que va esta composicion.
        const labio = Math.max(t.heightAt(-CANON + 7.5), t.heightAt(-CANON - 7.5));
        expect(labio - fondo).toBeGreaterThan(1.5);
      }
    });

    it('el foso es MAS ANCHO que la pieza que va dentro', () => {
      // Con un foso justo, el blindado se apoya en los dos labios, tapa las
      // paredes y la trinchera desaparece.
      const t = construir('a', 'zanja');
      const fondo = t.heightAt(-CANON);
      for (const d of [-2.6, 0, 2.6]) {
        expect(Math.abs(t.heightAt(-CANON + d) - fondo)).toBeLessThan(0.2);
      }
    });

    it('se sale de la zanja, y sale caro', () => {
      for (const semilla of ['a', 'b', 'c', 'd']) {
        const foso = construir(semilla, 'zanja');
        const calle = construir(semilla, 'avenida');
        // Se sale: un blindado tapiado en su propio hoyo desde el turno uno no
        // seria una composicion, seria un fallo.
        expect(atrapado(foso, -CANON)).toBe(false);
        // Y se sale DE VERDAD: con dos depositos se corona el labio. Es la
        // diferencia entre «caro» y «una jaula», y el primer labio que se probo
        // era una jaula — 0,95 de alto en 0,9 unidades, pendiente 1,05.
        expect(alcance(foso, -CANON, 1)).toBeGreaterThan(3);
        // Y cuesta: con el mismo deposito se llega menos lejos que en avenida,
        // que es lo que `docs/ESCENARIOS.md` §3 ter pide de esta composicion.
        expect(alcance(foso, -CANON, 1)).toBeLessThan(alcance(calle, -CANON, 1));
      }
    });
  });

  describe('monton central', () => {
    it('corona el campo: siempre por encima de los dos emplazamientos', () => {
      for (const semilla of ['a', 'b', 'c', 'd', 'e']) {
        const t = construir(semilla, 'monton');
        const cima = Math.max(t.heightAt(-1), t.heightAt(0), t.heightAt(1));
        expect(cima).toBeGreaterThan(t.heightAt(-CANON) + 3);
        expect(cima).toBeGreaterThan(t.heightAt(CANON) + 3);
      }
    });

    it('se corona: el monton no anade ni una pendiente que la oruga no suba', () => {
      // Quien lo corona domina, y por eso tiene que poderse coronar: una loma
      // que la oruga no sube deja de ser una decision y pasa a ser una pared.
      //
      // Se mide SIN ruido —amplitud cero, solo el cuenco— porque el relieve
      // generado trae laderas naturales de hasta 72 grados y medir la pendiente
      // total mide el ruido, no la composicion. El cuenco es ademas el peor caso
      // del monton: hunde el centro justo donde el monton se levanta.
      const pelado = new Terrain({
        rng: mulberry32(hashSeed('pelado')),
        biome: BIOMA,
        width: 140,
        columns: 700,
        depth: 4.2,
        minHeight: 3.2,
        amplitude: 0,
        bowlHalfWidth: CANON,
        bowlWeight: 1,
        pads: PADS,
        composicion: 'monton',
      });
      let peor = 0;
      for (let x = -MONTON_MEDIO; x <= MONTON_MEDIO; x += 0.25) {
        peor = Math.max(peor, Math.abs(pelado.slopeAt(x)));
      }
      expect(peor).toBeLessThan(AVANCE.pendienteMaxima);
    });
  });

  it('avenida no toca el emplazamiento: la meseta sigue plana', () => {
    const t = construir('a', 'avenida');
    const y = t.heightAt(CANON);
    for (const d of [-2, 0, 2]) {
      expect(Math.abs(t.heightAt(CANON + d) - y)).toBeLessThan(0.15);
    }
  });
});

describe('los estratos cuelgan del lecho', () => {
  const t = construir('vostok', 'avenida');

  it('el lecho es mucho mas liso que la superficie', () => {
    // Es lo que hace que las bandas hondas dejen de calcar el perfil, que era
    // lo que convertia la mitad inferior del cuadro en una tarta de capas.
    const rugosidad = (leer) => {
      let s = 0;
      for (let i = 1; i < t.cols; i++) s += Math.abs(leer(i) - leer(i - 1));
      return s;
    };
    expect(rugosidad((i) => t.lecho[i])).toBeLessThan(rugosidad((i) => t.heights[i]) / 5);
  });

  it('ninguna fila de la cara frontal se sube por encima de la de arriba', () => {
    // Sin el tope, en una vaguada honda el lecho queda por encima del suelo, las
    // capas se cruzan y la malla sale del reves.
    const pos = t.frontGeo.attributes.position.array;
    const filas = pos.length / 3 / t.cols;
    for (let i = 0; i < t.cols; i++) {
      for (let j = 1; j < filas; j++) {
        const arriba = pos[(i * filas + j - 1) * 3 + 1];
        const abajo = pos[(i * filas + j) * 3 + 1];
        expect(abajo).toBeLessThanOrEqual(arriba + 1e-9);
      }
    }
  });

  it('un crater CORTA los estratos en vez de arrastrarlos', () => {
    // `ARTE.md` §12 promete que se ve cuanto ha excavado un crater porque se ve
    // cuantas capas ha atravesado. Con las bandas calcando la superficie eso era
    // falso: la costra bajaba con el hoyo. Lo que lo hace verdad es que el lecho
    // NO se toca al excavar.
    const antes = Float64Array.from(t.lecho);
    t.carve(0, t.heightAt(0), 3, { rehacerMalla: false });
    expect(Array.from(t.lecho)).toEqual(Array.from(antes));
  });
});
