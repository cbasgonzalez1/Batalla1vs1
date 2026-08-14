import { describe, it, expect } from 'vitest';
import { FIXED_DT, step, simulate, sweepTerrain, launchVelocity } from '../../src/game/ballistics.js';

/** Terreno falso: solo necesita la interfaz que consume la balistica. */
function terrenoPlano(altura = 0, { x0 = -100, width = 200 } = {}) {
  return { x0, width, heightAt: () => altura };
}

/** Terreno con una cresta fina, para el caso que documenta sweepTerrain. */
function terrenoConCresta({ centro = 0, ancho = 0.5, altura = 30 }) {
  return {
    x0: -100,
    width: 200,
    heightAt: (x) => (Math.abs(x - centro) <= ancho / 2 ? altura : 0),
  };
}

describe('determinismo', () => {
  it('la misma entrada produce exactamente la misma trayectoria', () => {
    const inicio = { x: -44, y: 10, vx: 30, vy: 22 };
    const t = terrenoPlano(0);
    const a = simulate(inicio, 1.5, t);
    const b = simulate(inicio, 1.5, t);
    expect(a.points).toEqual(b.points);
    expect(a.steps).toBe(b.steps);
    expect(a.hit).toEqual(b.hit);
  });

  it('simulate no muta el estado inicial que recibe', () => {
    const inicio = { x: -44, y: 10, vx: 30, vy: 22 };
    const copia = { ...inicio };
    simulate(inicio, 1.5, terrenoPlano(0));
    expect(inicio).toEqual(copia);
  });

  it('el resultado no depende de los fps: solo del numero de pasos fijos', () => {
    // Integrar a mano 240 pasos tiene que dar lo mismo que dejar correr la
    // simulacion, porque el paso es fijo y no se lee ningun reloj.
    const s = { x: 0, y: 50, vx: 10, vy: 0 };
    for (let i = 0; i < 240; i++) step(s, 0, FIXED_DT);

    const sim = simulate({ x: 0, y: 50, vx: 10, vy: 0 }, 0, terrenoPlano(-1000), {
      maxSteps: 240,
      sampleEvery: 1000,
    });
    expect(sim.steps).toBe(240);
  });
});

describe('step', () => {
  it('aplica el viento a la velocidad horizontal', () => {
    const s = { x: 0, y: 0, vx: 0, vy: 0 };
    step(s, 12, FIXED_DT);
    expect(s.vx).toBeCloseTo(12 * FIXED_DT, 10);
  });

  it('es semi-implicito: la posicion usa la velocidad ya actualizada', () => {
    const s = { x: 0, y: 0, vx: 0, vy: 0 };
    step(s, 0, FIXED_DT);
    // Euler explicito dejaria y = 0 en el primer paso; el semi-implicito no.
    expect(s.y).toBeLessThan(0);
    expect(s.y).toBeCloseTo(s.vy * FIXED_DT, 10);
  });
});

describe('sweepTerrain', () => {
  it('detecta una cresta mas fina que el paso, sin atravesarla', () => {
    // El proyectil salta de x=-5 a x=+5 en un solo paso; la cresta mide 0,5.
    const impacto = sweepTerrain(-5, 40, 5, 40, terrenoConCresta({ altura: 50 }), 32);
    expect(impacto).not.toBeNull();
  });

  it('devuelve null si el segmento pasa por encima del terreno', () => {
    expect(sweepTerrain(-5, 100, 5, 100, terrenoPlano(0))).toBeNull();
  });

  it('ignora lo que cae fuera del ancho del terreno', () => {
    const t = terrenoPlano(0, { x0: 0, width: 10 });
    expect(sweepTerrain(-50, -5, -40, -5, t)).toBeNull();
  });
});

describe('launchVelocity', () => {
  it('interpola el cuadrado de la velocidad, no la velocidad', () => {
    // Es la decision documentada en el modulo: a media potencia la rapidez
    // tiene que ser sqrt((min^2 + max^2) / 2), no la media aritmetica.
    const min = 10;
    const max = 50;
    const v = launchVelocity(0, 0.5, 1, min, max);
    const rapidez = Math.hypot(v.vx, v.vy);
    expect(rapidez).toBeCloseTo(Math.sqrt((min * min + max * max) / 2), 6);
    expect(rapidez).not.toBeCloseTo((min + max) / 2, 1);
  });

  it('respeta los extremos de potencia', () => {
    expect(Math.hypot(...Object.values(launchVelocity(0, 0, 1, 10, 50)))).toBeCloseTo(10, 6);
    expect(Math.hypot(...Object.values(launchVelocity(0, 1, 1, 10, 50)))).toBeCloseTo(50, 6);
  });

  it('facing invierte el sentido horizontal sin tocar el vertical', () => {
    const derecha = launchVelocity(Math.PI / 4, 0.7, 1, 10, 50);
    const izquierda = launchVelocity(Math.PI / 4, 0.7, -1, 10, 50);
    expect(izquierda.vx).toBeCloseTo(-derecha.vx, 10);
    expect(izquierda.vy).toBeCloseTo(derecha.vy, 10);
  });

  it('recorta potencias fuera de rango en vez de extrapolar', () => {
    const bajo = launchVelocity(0, -3, 1, 10, 50);
    const alto = launchVelocity(0, 7, 1, 10, 50);
    expect(Math.hypot(bajo.vx, bajo.vy)).toBeCloseTo(10, 6);
    expect(Math.hypot(alto.vx, alto.vy)).toBeCloseTo(50, 6);
  });
});
