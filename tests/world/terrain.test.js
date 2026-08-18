import { describe, it, expect } from 'vitest';
import { Terrain } from '../../src/world/terrain.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

/**
 * Automatiza lo que el README verificaba a mano en el navegador: misma semilla,
 * 0 columnas de diferencia sobre 384; semilla distinta, todas cambian.
 */

const BIOMA = { crest: '#c8b48a', body: '#a08a5e', deep: '#6b5638' };
const COLUMNAS = 384;

function construir(semilla) {
  return new Terrain({
    rng: mulberry32(hashSeed(semilla)),
    biome: BIOMA,
    width: 140,
    columns: COLUMNAS,
    depth: 18,
    minHeight: 6,
    amplitude: 14,
    bowlHalfWidth: 44,
  });
}

function columnasDistintas(a, b) {
  let n = 0;
  for (let i = 0; i < a.heights.length; i++) {
    if (a.heights[i] !== b.heights[i]) n++;
  }
  return n;
}

describe('generacion del terreno', () => {
  it('la misma semilla da un heightmap identico', () => {
    expect(columnasDistintas(construir('vostok'), construir('vostok'))).toBe(0);
  });

  it('una semilla distinta cambia practicamente todas las columnas', () => {
    const distintas = columnasDistintas(construir('vostok'), construir('kalisto'));
    expect(distintas).toBeGreaterThan(COLUMNAS * 0.95);
  });

  it('el heightmap tiene una altura por columna', () => {
    const t = construir('vostok');
    expect(t.heights.length).toBe(COLUMNAS);
    expect(t.heights.every(Number.isFinite)).toBe(true);
  });

  it('heightAt interpola dentro del ancho declarado', () => {
    const t = construir('vostok');
    const centro = t.heightAt(0);
    expect(Number.isFinite(centro)).toBe(true);
    expect(t.heightAt(t.x0)).toBeCloseTo(t.heights[0], 4);
  });
});

describe('destruccion', () => {
  /** Excava en el suelo: el crater se centra a la altura del propio terreno. */
  function excavar(t, x, r) {
    t.carve(x, t.heightAt(x), r);
  }

  it('el crater rebaja dentro del radio y LEVANTA el labio fuera', () => {
    // Un crater sin labio es una hondonada natural: hunde, y ya. Lo que da la
    // lectura de impacto es el anillo levantado (`docs/ESCENARIOS.md` §3.4).
    const t = construir('vostok');
    const antes = Float64Array.from(t.heights);
    excavar(t, 0, 2.6);
    let levantado = 0;
    for (let i = 0; i < antes.length; i++) {
      const d = Math.abs(t.x0 + i * t.dx);
      if (d < 2.6) expect(t.heights[i]).toBeLessThanOrEqual(antes[i] + 1e-6);
      if (t.heights[i] > antes[i] + 1e-6) {
        levantado++;
        expect(d).toBeGreaterThanOrEqual(2.6);
        expect(d).toBeLessThanOrEqual(2.6 * 1.75 + t.dx);
      }
    }
    expect(levantado).toBeGreaterThan(0);
  });

  it('el labio sale de lo excavado: nunca se inventa tierra', () => {
    // La masa que sube al borde se descuenta de la que vuela a sotavento, o la
    // conservacion de Sotavento seria mentira.
    const t = construir('vostok');
    const antes = Float64Array.from(t.heights);
    const { volumen } = t.carve(0, t.heightAt(0), 2.6);
    let subido = 0;
    let bajado = 0;
    for (let i = 0; i < antes.length; i++) {
      const d = t.heights[i] - antes[i];
      if (d > 0) subido += d * t.dx;
      else bajado -= d * t.dx;
    }
    expect(subido).toBeGreaterThan(0);
    expect(subido).toBeLessThan(bajado);
    // Y lo que se devuelve para sotavento es exactamente el resto.
    expect(volumen).toBeCloseTo(bajado - subido, 8);
  });

  it('el crater no toca las columnas fuera del labio', () => {
    const t = construir('vostok');
    const antes = Float32Array.from(t.heights);
    excavar(t, 0, 2.6);
    const lejos = Math.floor((30 - t.x0) / t.dx);
    expect(t.heights[lejos]).toBeCloseTo(antes[lejos], 6);
  });

  it('nunca excava por debajo del suelo duro', () => {
    const t = construir('vostok');
    for (let i = 0; i < 40; i++) excavar(t, 0, 6);
    for (const h of t.heights) expect(h).toBeGreaterThanOrEqual(t.floorY - 1e-6);
  });

  it('excavar es determinista: mismos crateres, mismo resultado', () => {
    const a = construir('vostok');
    const b = construir('vostok');
    for (const x of [-20, 0, 13.5]) {
      excavar(a, x, 2.6);
      excavar(b, x, 2.6);
    }
    expect(columnasDistintas(a, b)).toBe(0);
  });
});

describe('hundimiento del crater', () => {
  /**
   * El crater se dibuja bajando en 180 ms, pero la fisica no espera a que la
   * animacion termine. Si esperase, un proyectil disparado justo despues del
   * impacto anterior chocaria contra un suelo a medio caer y dos moviles con
   * distinta tasa de cuadros veirian trayectorias distintas. Todo lo que hace
   * `hundimiento` es retrasar el DIBUJO.
   */
  it('las alturas de la fisica bajan al instante', () => {
    const t = construir('hundir');
    const antes = t.heightAt(0);
    t.carve(0, antes, 3, { hundimiento: true });
    expect(t.heightAt(0)).toBeLessThan(antes);
  });

  it('la malla arranca dibujando el terreno de antes', () => {
    const t = construir('hundir');
    const i = Math.round((0 - t.x0) / t.dx);
    const antes = t.heights[i];
    t.carve(0, t.heightAt(0), 3, { hundimiento: true });
    // La fisica ya bajo; el dibujo sigue arriba, que es la diferencia.
    expect(t.heights[i]).toBeLessThan(antes);
    expect(t._visual(i)).toBeCloseTo(antes, 9);
  });

  it('al terminar la animacion, dibujo y fisica coinciden', () => {
    const t = construir('hundir');
    t.carve(0, t.heightAt(0), 3, { hundimiento: true });
    expect(t.avanzarHundimiento(0.5)).toBe(true);
    expect(t.avanzarHundimiento(1)).toBe(false);
    for (let i = 0; i < t.cols; i++) expect(t._visual(i)).toBe(t.heights[i]);
    expect(t.hundiendo).toBeNull();
  });

  it('un crater nuevo cancela el hundimiento del anterior', () => {
    // Si no, quedarian dos animaciones sumandose y el terreno dibujado se
    // separaria del de verdad mas y mas.
    const t = construir('hundir');
    t.carve(-10, t.heightAt(-10), 3, { hundimiento: true });
    t.avanzarHundimiento(0.3);
    t.carve(20, t.heightAt(20), 3, { hundimiento: true });
    const i = Math.round((-10 - t.x0) / t.dx);
    expect(t._visual(i)).toBe(t.heights[i]);
  });

  it('sin pedirlo, carve no deja nada pendiente de dibujar', () => {
    const t = construir('hundir');
    t.carve(0, t.heightAt(0), 3);
    expect(t.hundiendo).toBeNull();
    expect(t.avanzarHundimiento(0.5)).toBe(false);
  });

  it('el volumen levantado es el mismo se anime o no', () => {
    // Sotavento lleva la cuenta de la masa: si el hundimiento tocara el
    // volumen devuelto, la arena que cae dejaria de cuadrar.
    const a = construir('masa');
    const b = construir('masa');
    const conAnimacion = a.carve(5, a.heightAt(5), 3, { hundimiento: true }).volumen;
    const sinAnimacion = b.carve(5, b.heightAt(5), 3).volumen;
    expect(conAnimacion).toBe(sinAnimacion);
  });
});
