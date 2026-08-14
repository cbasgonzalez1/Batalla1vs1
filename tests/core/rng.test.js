import { describe, it, expect } from 'vitest';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

/**
 * El PRNG es el cimiento del determinismo: si mulberry32 dejara de ser
 * reproducible, todo lo demas (terreno, viento, balistica) se romperia en
 * silencio y solo se notaria jugando.
 */

describe('mulberry32', () => {
  it('la misma semilla produce la misma secuencia', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 200 }, () => a());
    const seqB = Array.from({ length: 200 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('semillas distintas divergen desde el primer valor', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('devuelve siempre el rango [0, 1)', () => {
    const next = mulberry32(hashSeed('rango'));
    for (let i = 0; i < 5000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('es estable entre llamadas', () => {
    expect(hashSeed('vostok')).toBe(hashSeed('vostok'));
  });

  it('separa semillas legibles distintas', () => {
    expect(hashSeed('vostok')).not.toBe(hashSeed('vostol'));
  });

  it('devuelve un entero sin signo de 32 bits', () => {
    const h = hashSeed('cualquier cosa');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
