import { describe, it, expect } from 'vitest';
import { TRANSPORTE, alzadoDe, transporte, picoDe } from '../../src/game/sotavento.js';
import { VIENTO } from '../../src/game/viento.js';

describe('alzadoDe', () => {
  it('un obus que cae a plomo da alzado pleno', () => {
    expect(alzadoDe(-60)).toBe(1);
    expect(alzadoDe(-TRANSPORTE.alzadoPleno)).toBe(1);
  });

  it('un tiro raso da el alzado minimo', () => {
    expect(alzadoDe(-2)).toBe(TRANSPORTE.alzadoMinimo);
    expect(alzadoDe(0)).toBe(TRANSPORTE.alzadoMinimo);
  });

  it('no distingue si sube o baja, solo cuanto', () => {
    expect(alzadoDe(30)).toBe(alzadoDe(-30));
  });

  it('aguanta que no le pasen nada', () => {
    expect(alzadoDe(undefined)).toBe(TRANSPORTE.alzadoMinimo);
  });
});

describe('a donde va la arena', () => {
  it('con viento a la derecha, la arena cae a la derecha', () => {
    expect(transporte(0, 2, -30).centro).toBeGreaterThan(0);
  });

  it('con viento a la izquierda, a la izquierda', () => {
    expect(transporte(0, -2, -30).centro).toBeLessThan(0);
  });

  it('en calma la arena vuelve al propio crater', () => {
    // Y esto es una regla de juego, no un detalle: cavar sin viento no sirve
    // de nada, asi que el viento pasa de ruido a recurso.
    expect(transporte(12, 0, -40).centro).toBeCloseTo(12, 10);
  });

  it('el tiro en globo la lleva mas lejos que el tiro tenso', () => {
    const tenso = transporte(0, VIENTO.limite, -22.3).centro;
    const globo = transporte(0, VIENTO.limite, -51.1).centro;
    expect(globo).toBeGreaterThan(tenso);
  });

  it('lleva la arena a las distancias que dice el diseño', () => {
    // Numeros literales: son las dos soluciones reales a 88 u de separacion.
    // Tenso (23,5°, |vy| 22,3) y globo (66,5°, |vy| 51,1), con viento pleno.
    expect(transporte(0, VIENTO.limite, -22.3).centro).toBeCloseTo(17.8, 1);
    expect(transporte(0, VIENTO.limite, -51.1).centro).toBeCloseTo(30.0, 1);
  });

  it('es simetrico respecto al signo del viento', () => {
    const derecha = transporte(5, 2.1, -30).centro - 5;
    const izquierda = transporte(5, -2.1, -30).centro - 5;
    expect(izquierda).toBeCloseTo(-derecha, 10);
  });

  it('un viento imposible no dispara el acarreo fuera de escala', () => {
    const pleno = transporte(0, VIENTO.limite, -40).centro;
    expect(transporte(0, 99, -40).centro).toBeCloseTo(pleno, 10);
  });
});

describe('cuan ancha cae', () => {
  it('la anchura depende del viento y NO del alzado', () => {
    // Es la correccion que salvo la mecanica: si la anchura creciera con el
    // alzado, con viento flojo la campana colapsaria en una aguja.
    const tenso = transporte(0, 1.7, -22.3).anchura;
    const globo = transporte(0, 1.7, -51.1).anchura;
    expect(globo).toBeCloseTo(tenso, 10);
  });

  it('nunca colapsa: hay una anchura minima', () => {
    expect(transporte(0, 0, -50).anchura).toBe(TRANSPORTE.anchuraBase);
    for (const v of [-3.4, -1, 0, 1, 3.4]) {
      expect(transporte(0, v, -50).anchura).toBeGreaterThanOrEqual(TRANSPORTE.anchuraBase);
    }
  });

  it('mas viento reparte mas ancho', () => {
    expect(transporte(0, 3.4, -30).anchura).toBeGreaterThan(transporte(0, 0.5, -30).anchura);
  });

  it('los dos extremos son los del diseño: 2,4 en calma y 4,0 a tope', () => {
    expect(transporte(0, 0, -30).anchura).toBeCloseTo(2.4, 6);
    expect(transporte(0, VIENTO.limite, -30).anchura).toBeCloseTo(4.0, 6);
  });
});

describe('picoDe', () => {
  it('el monton mas estrecho es mas alto con la misma arena', () => {
    expect(picoDe(10.62, 2.4)).toBeGreaterThan(picoDe(10.62, 4.0));
  });

  it('da las alturas que sostienen la mecanica', () => {
    // 1,77 u con la campana estrecha y 1,06 con la ancha: por encima del
    // umbral de 1,5 u que desplaza un tiro tenso casi un radio de explosion.
    expect(picoDe(10.62, 2.4)).toBeCloseTo(1.77, 2);
    expect(picoDe(10.62, 4.0)).toBeCloseTo(1.06, 2);
  });

  it('sin arena no hay monton', () => {
    expect(picoDe(0, 2.4)).toBe(0);
  });
});
