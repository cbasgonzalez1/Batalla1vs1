import { describe, it, expect } from 'vitest';
import { VERNIER, aplicarVernier, unidadesPorPixel } from '../../src/ui/vernier.js';

const punto = (x, y = 0) => ({ x, y });

describe('sin muesca no hay vernier', () => {
  it('el primer tiro del combate va con ganancia normal', () => {
    const r = aplicarVernier(punto(100, 40), null);
    expect(r).toMatchObject({ x: 100, y: 40, afinando: false });
  });
});

describe('cerca del tiro anterior el dedo pesa menos', () => {
  const muesca = punto(100, 0);

  it('avanza la cuarta parte dentro del radio', () => {
    const r = aplicarVernier(punto(120, 0), muesca);
    expect(r.x).toBeCloseTo(100 + 20 / VERNIER.division, 6);
    expect(r.afinando).toBe(true);
  });

  it('sobre la muesca exacta no se mueve', () => {
    const r = aplicarVernier(punto(100, 0), muesca);
    expect(r.x).toBeCloseTo(100, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });

  it('afina en las dos direcciones', () => {
    expect(aplicarVernier(punto(80, 0), muesca).x).toBeCloseTo(95, 6);
    expect(aplicarVernier(punto(100, 20), muesca).y).toBeCloseTo(5, 6);
  });

  it('afina tambien en diagonal, no solo en los ejes', () => {
    const r = aplicarVernier(punto(100 + 12, 12), muesca);
    expect(r.x).toBeCloseTo(103, 6);
    expect(r.y).toBeCloseTo(3, 6);
    expect(r.afinando).toBe(true);
  });
});

describe('fuera del radio manda la ganancia normal', () => {
  const muesca = punto(100, 0);

  it('deja de afinar pasado el radio', () => {
    expect(aplicarVernier(punto(100 + VERNIER.radio + 10, 0), muesca).afinando).toBe(false);
  });

  it('no hay salto al cruzar el borde', () => {
    // Es lo que haria insufrible el vernier: el tiro pegando un brinco justo
    // cuando el jugador esta afinando. Se comprueba que la funcion es continua.
    const dentro = aplicarVernier(punto(100 + VERNIER.radio - 0.01, 0), muesca);
    const fuera = aplicarVernier(punto(100 + VERNIER.radio + 0.01, 0), muesca);
    expect(Math.abs(fuera.x - dentro.x)).toBeLessThan(0.05);
  });

  it('es monotona: mas dedo siempre es mas arrastre', () => {
    let anterior = -Infinity;
    for (let d = 0; d <= 200; d += 0.5) {
      const x = aplicarVernier(punto(100 + d, 0), muesca).x;
      expect(x).toBeGreaterThanOrEqual(anterior);
      anterior = x;
    }
  });

  it('lejos de la muesca la ganancia vuelve a ser practicamente uno', () => {
    const a = aplicarVernier(punto(400, 0), muesca).x;
    const b = aplicarVernier(punto(500, 0), muesca).x;
    expect(b - a).toBeCloseTo(100, 6);
  });
});

describe('el numero que justifica todo esto', () => {
  it('sin vernier, corregir 1,5 unidades cae bajo el temblor del pulgar', () => {
    // 106 px utiles en un movil de 844 px, y el alcance util a 88 u de
    // separacion ronda las 113 unidades.
    const porPixel = unidadesPorPixel(113, 106);
    expect(porPixel).toBeGreaterThan(1);
    expect(1.5 / porPixel).toBeLessThan(3); // menos que el jitter tipico
  });

  it('con vernier la misma correccion es alcanzable', () => {
    const porPixel = unidadesPorPixel(113, 106) / VERNIER.division;
    expect(1.5 / porPixel).toBeGreaterThan(5); // por encima del jitter
  });
});
