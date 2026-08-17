import { describe, it, expect } from 'vitest';
import { FRANJA, aPixel, muestrearPerfil, rangoDe } from '../../src/ui/franja.js';
import { BLAST } from '../../src/game/combat.js';

const terrenoFalso = (fn = () => 10) => ({
  x0: -70,
  width: 140,
  heightAt: fn,
});

describe('proyeccion a la franja', () => {
  it('el borde izquierdo cae en 0 y el derecho en el ancho', () => {
    const t = terrenoFalso();
    expect(aPixel(t.x0, t, 300)).toBeCloseTo(0, 6);
    expect(aPixel(t.x0 + t.width, t, 300)).toBeCloseTo(300, 6);
  });

  it('el centro del mundo cae en el centro de la franja', () => {
    expect(aPixel(0, terrenoFalso(), 300)).toBeCloseTo(150, 6);
  });

  it('los dos cañones quedan simetricos', () => {
    const t = terrenoFalso();
    expect(aPixel(-44, t, 300) + aPixel(44, t, 300)).toBeCloseTo(300, 6);
  });
});

describe('el muestreo es basto a proposito', () => {
  it('la resolucion es mayor que medio radio de explosion', () => {
    // Es la regla que impide que la franja se convierta en una mira: si el
    // muestreo fuera fino, el jugador podria resolver el tiro leyendo la barra
    // en vez de tirando.
    expect(FRANJA.muestraCada).toBeGreaterThan(BLAST.radius / 2);
  });

  it('cubre el campo entero', () => {
    const muestras = muestrearPerfil(terrenoFalso());
    expect(muestras[0][0]).toBeCloseTo(-70, 6);
    expect(muestras.at(-1)[0]).toBeGreaterThanOrEqual(69);
    expect(muestras.length).toBeLessThan(40);
  });

  it('lee la altura real del terreno', () => {
    const muestras = muestrearPerfil(terrenoFalso((x) => x));
    for (const [x, h] of muestras) expect(h).toBeCloseTo(x, 6);
  });

  it('un crater estrecho puede pasar entre dos muestras', () => {
    // Consecuencia asumida de la resolucion basta, y conviene dejarla escrita:
    // la franja cuenta la forma del campo, no el detalle. Segun donde caiga, el
    // mismo crater se ve o no se ve — que es justo lo que impide usarla de mira.
    const hoyoEn = (centro) =>
      muestrearPerfil(terrenoFalso((x) => (Math.abs(x - centro) < 1.2 ? 0 : 10)))
        .map(([, h]) => h)
        .some((h) => h === 0);

    expect(hoyoEn(0)).toBe(false);  // cae entre las muestras de -2 y 2
    expect(hoyoEn(2)).toBe(true);   // cae justo sobre una
  });
});

describe('escala del relieve', () => {
  it('devuelve el minimo y el maximo del perfil', () => {
    const r = rangoDe([[0, 4], [1, 9], [2, -2]]);
    expect(r.min).toBe(-2);
    expect(r.max).toBe(9);
  });

  it('un campo plano no divide por cero', () => {
    const r = rangoDe([[0, 7], [1, 7], [2, 7]]);
    expect(r.max).toBeGreaterThan(r.min);
  });

  it('aguanta un muestreo vacio', () => {
    const r = rangoDe([]);
    expect(Number.isFinite(r.min)).toBe(true);
    expect(r.max).toBeGreaterThan(r.min);
  });
});
