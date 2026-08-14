import { describe, it, expect } from 'vitest';
import { CERCA, lecturaDeTiro, acerto } from '../../src/game/lectura.js';
import { BLAST } from '../../src/game/combat.js';

const tiro = (extra) => lecturaDeTiro({ xImpacto: 0, xObjetivo: 44, facing: 1, ...extra });

describe('corto o largo', () => {
  it('quedarse antes del rival es corto', () => {
    const r = tiro({ xImpacto: 24 });
    expect(r.sentido).toBe('corto');
    expect(r.distancia).toBeCloseTo(20, 6);
  });

  it('pasarse es largo', () => {
    const r = tiro({ xImpacto: 50 });
    expect(r.sentido).toBe('largo');
    expect(r.distancia).toBeCloseTo(6, 6);
  });

  it('el que dispara hacia la izquierda lee lo mismo que el que dispara a la derecha', () => {
    // Sin esto, "corto" significaria cosas opuestas segun el bando y el jugador
    // de la derecha tendria que invertirlo mentalmente cada turno.
    const derecha = lecturaDeTiro({ xImpacto: 30, xObjetivo: 44, facing: 1 });
    const izquierda = lecturaDeTiro({ xImpacto: -30, xObjetivo: -44, facing: -1 });
    expect(izquierda.sentido).toBe(derecha.sentido);
    expect(izquierda.distancia).toBeCloseTo(derecha.distancia, 6);
  });

  it('la distancia nunca es negativa', () => {
    for (const x of [-100, 0, 44, 200]) {
      expect(tiro({ xImpacto: x }).distancia).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('que construyo el disparo', () => {
  it('sin arena no hay segunda lectura', () => {
    expect(tiro({ xImpacto: 20 }).arena).toBeNull();
  });

  it('informa del pico y de a que distancia del rival cayo', () => {
    const r = tiro({ xImpacto: 20, volumen: 10.62, centro: 30, anchura: 2.4 });
    expect(r.arena.pico).toBeCloseTo(1.77, 2);
    expect(r.arena.distancia).toBeCloseTo(14, 6);
  });

  it('avisa cuando la arena le ha caido encima al rival', () => {
    const encima = tiro({ xImpacto: 30, volumen: 10.62, centro: 41, anchura: 2.4 });
    const lejos = tiro({ xImpacto: 10, volumen: 10.62, centro: 20, anchura: 2.4 });
    expect(encima.arena.encima).toBe(true);
    expect(lejos.arena.encima).toBe(false);
  });

  it('el umbral de "encima" es el declarado', () => {
    expect(tiro({ xImpacto: 0, volumen: 10, centro: 44 - CERCA, anchura: 2.4 }).arena.encima).toBe(true);
    expect(tiro({ xImpacto: 0, volumen: 10, centro: 44 - CERCA - 0.1, anchura: 2.4 }).arena.encima).toBe(false);
  });

  it('un fallo enorme puede seguir siendo un buen turno', () => {
    // Fallas por 19 u y aun asi le has levantado el suelo: es exactamente el
    // caso que este mensaje existe para enseñar.
    const r = tiro({ xImpacto: 25, volumen: 10.62, centro: 43, anchura: 2.4 });
    expect(r.distancia).toBeCloseTo(19, 6);
    expect(r.arena.encima).toBe(true);
    expect(r.arena.pico).toBeGreaterThan(1.5);
  });
});

describe('acerto', () => {
  it('dentro del radio de explosion no hace falta lectura de fallo', () => {
    expect(acerto(tiro({ xImpacto: 41 }), BLAST.radius)).toBe(true);
    expect(acerto(tiro({ xImpacto: 30 }), BLAST.radius)).toBe(false);
  });
});
