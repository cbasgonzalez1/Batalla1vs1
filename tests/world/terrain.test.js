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

  it('el crater rebaja el terreno y no lo levanta', () => {
    const t = construir('vostok');
    const antes = Float32Array.from(t.heights);
    excavar(t, 0, 2.6);
    for (let i = 0; i < antes.length; i++) {
      expect(t.heights[i]).toBeLessThanOrEqual(antes[i] + 1e-6);
    }
  });

  it('el crater no toca las columnas fuera de su radio', () => {
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
