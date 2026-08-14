import { describe, it, expect } from 'vitest';
import { Terrain } from '../../src/world/terrain.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

/**
 * La regla central de Sotavento: un canonazo no destruye terreno, lo traslada.
 *
 * Si la masa no se conserva, la mecanica entera es mentira: el campo se
 * vaciaria o se llenaria solo, y el jugador no podria razonar sobre lo que
 * construye. Por eso esto se mide con precision, no a ojo.
 */

const BIOMA = { crest: '#c8b48a', body: '#a08a5e', deep: '#6b5638' };

function construir(semilla = 'vostok') {
  return new Terrain({
    rng: mulberry32(hashSeed(semilla)),
    biome: BIOMA,
    width: 140,
    columns: 384,
    depth: 18,
    minHeight: 6,
    amplitude: 14,
    bowlHalfWidth: 44,
  });
}

const masaTotal = (t) => {
  let suma = 0;
  for (const h of t.heights) suma += (h - t.floorY) * t.dx;
  return suma;
};

describe('carve mide lo que se lleva', () => {
  it('devuelve volumen positivo al excavar terreno', () => {
    const t = construir();
    const { volumen } = t.carve(0, t.heightAt(0), 2.6);
    expect(volumen).toBeGreaterThan(0);
  });

  it('el volumen coincide con la masa que falta, al milesimo', () => {
    const t = construir();
    const antes = masaTotal(t);
    const { volumen } = t.carve(-13.5, t.heightAt(-13.5), 2.6);
    expect(antes - masaTotal(t)).toBeCloseTo(volumen, 9);
  });

  it('no se lleva nada si el crater cae muy por encima del suelo', () => {
    const t = construir();
    const { volumen } = t.carve(0, t.heightAt(0) + 50, 2.6);
    expect(volumen).toBe(0);
  });

  it('la roca madre limita lo que se puede excavar', () => {
    // Cavando muchas veces en el mismo punto se llega a floorY y deja de salir
    // arena: el pozo no es infinito.
    const t = construir();
    const volumenes = [];
    for (let i = 0; i < 12; i++) {
      volumenes.push(t.carve(0, t.heightAt(0), 2.6).volumen);
    }
    expect(volumenes.at(-1)).toBeLessThan(volumenes[0]);
    expect(volumenes.at(-1)).toBeCloseTo(0, 6);
    for (const h of t.heights) expect(h).toBeGreaterThanOrEqual(t.floorY - 1e-9);
  });
});

describe('depositar suelta exactamente lo que recibe', () => {
  it('deposita el volumen pedido cuando la campana cabe entera', () => {
    const t = construir();
    const antes = masaTotal(t);
    const { depositado, perdido } = t.depositar(0, 2.4, 10.62);

    expect(depositado).toBeCloseTo(10.62, 9);
    expect(perdido).toBeCloseTo(0, 9);
    expect(masaTotal(t) - antes).toBeCloseTo(10.62, 9);
  });

  it('la campana esta centrada donde se le dice', () => {
    const t = construir();
    const antes = Float32Array.from(t.heights);
    t.depositar(20, 2.4, 10.62);

    const subida = (x) => t.heightAt(x) - (() => {
      const f = (x - t.x0) / t.dx;
      const i = Math.floor(f);
      return antes[i] + (antes[i + 1] - antes[i]) * (f - i);
    })();

    expect(subida(20)).toBeGreaterThan(subida(23));
    expect(subida(20)).toBeGreaterThan(subida(17));
  });

  it('el pico se acerca al que dice la formula de la gaussiana', () => {
    // V / (sigma * raiz(2*pi)): con V = 10,62 y sigma = 2,4 son 1,765 u.
    // La campana se reparte en columnas de 0,365 u, asi que la suma discreta no
    // es la integral continua: queda un 0,3 % por debajo. Es discretizacion, no
    // perdida de masa — el volumen depositado si cuadra al milesimo.
    const t = construir();
    const antes = t.heightAt(0);
    t.depositar(0, 2.4, 10.62);

    const teorico = 10.62 / (2.4 * Math.sqrt(2 * Math.PI));
    const medido = t.heightAt(0) - antes;
    expect(medido).toBeGreaterThan(teorico * 0.99);
    expect(medido).toBeLessThanOrEqual(teorico);
  });

  it('una sigma mayor reparte mas plano sin cambiar la masa', () => {
    const estrecho = construir();
    const ancho = construir();
    const base = estrecho.heightAt(0);

    estrecho.depositar(0, 2.4, 10.62);
    ancho.depositar(0, 4.0, 10.62);

    expect(estrecho.heightAt(0) - base).toBeGreaterThan(ancho.heightAt(0) - base);
    expect(masaTotal(estrecho)).toBeCloseTo(masaTotal(ancho), 6);
  });

  it('lo que el viento se lleva fuera del mundo se pierde de verdad', () => {
    const t = construir();
    const borde = t.x0 + t.width;
    const antes = masaTotal(t);
    const { depositado, perdido } = t.depositar(borde, 2.4, 10.62);

    // Justo en el borde se pierde la mitad de la campana.
    expect(perdido).toBeGreaterThan(0);
    expect(depositado + perdido).toBeCloseTo(10.62, 9);
    expect(masaTotal(t) - antes).toBeCloseTo(depositado, 9);
    expect(depositado).toBeLessThan(10.62);
  });

  it('ignora volumenes y anchuras absurdos en vez de romper el terreno', () => {
    const t = construir();
    const antes = masaTotal(t);
    for (const caso of [[0, 2.4, 0], [0, 2.4, -5], [0, 0, 10], [0, -1, 10], [0, 2.4, NaN]]) {
      t.depositar(...caso);
    }
    expect(masaTotal(t)).toBeCloseTo(antes, 9);
    expect([...t.heights].every(Number.isFinite)).toBe(true);
  });
});

describe('el ciclo completo: excavar y soltar a sotavento', () => {
  it('la masa del mundo no cambia si la arena cae dentro', () => {
    const t = construir();
    const antes = masaTotal(t);

    const { volumen } = t.carve(0, t.heightAt(0), 2.6);
    const { perdido } = t.depositar(18, 2.4, volumen);

    expect(perdido).toBeCloseTo(0, 9);
    expect(masaTotal(t)).toBeCloseTo(antes, 6);
  });

  it('aguanta un combate entero sin que la masa se escape', () => {
    // El criterio de la fase 1: 16 disparos, la masa cuadra al milesimo.
    const t = construir('kalisto');
    const rng = mulberry32(hashSeed('disparos'));
    let inicial = masaTotal(t);
    let perdidoTotal = 0;

    for (let i = 0; i < 16; i++) {
      const x = (rng() * 2 - 1) * 60;
      const { volumen } = t.carve(x, t.heightAt(x), 2.6);
      const destino = x + (rng() * 2 - 1) * 25;
      perdidoTotal += t.depositar(destino, 2.4 + rng() * 1.6, volumen).perdido;
    }

    expect(Math.abs(masaTotal(t) - (inicial - perdidoTotal))).toBeLessThan(1e-3);
  });

  it('sigue siendo determinista: misma secuencia, mismo terreno', () => {
    const jugar = () => {
      const t = construir();
      const rng = mulberry32(hashSeed('igual'));
      for (let i = 0; i < 8; i++) {
        const x = (rng() * 2 - 1) * 50;
        const { volumen } = t.carve(x, t.heightAt(x), 2.6);
        t.depositar(x + 15, 2.6, volumen);
      }
      return Array.from(t.heights);
    };
    expect(jugar()).toEqual(jugar());
  });

  it('el campo NO se aplana: es el criterio de parada de la fase 1', () => {
    // Si mover arena homogeneiza el terreno, la mecanica se come a si misma y
    // hay que abandonarla. Se mide la desviacion tipica del perfil.
    const desviacion = (alturas) => {
      const media = alturas.reduce((a, b) => a + b, 0) / alturas.length;
      return Math.sqrt(alturas.reduce((a, h) => a + (h - media) ** 2, 0) / alturas.length);
    };

    const t = construir('vostok');
    const antes = desviacion(Array.from(t.heights));
    const rng = mulberry32(hashSeed('16 disparos'));

    for (let i = 0; i < 16; i++) {
      const x = (rng() * 2 - 1) * 60;
      const { volumen } = t.carve(x, t.heightAt(x), 2.6);
      t.depositar(x + (rng() * 2 - 1) * 25, 2.4 + rng() * 1.6, volumen);
    }

    expect(desviacion(Array.from(t.heights))).toBeGreaterThanOrEqual(antes * 0.95);
  });
});
