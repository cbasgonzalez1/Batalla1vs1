import { describe, it, expect } from 'vitest';
import { AVANCE, mover, repostar, encerrado, fraccion } from '../../src/game/avance.js';

/**
 * Lo que de verdad hay que vigilar aqui es la IDEMPOTENCIA.
 *
 * El movimiento viaja por el cable como un solo numero —cuanto se ha pedido
 * avanzar— y cada movil lo recalcula por su cuenta. Si `mover` no diera lo
 * mismo llamandola una vez con 4 que dos veces con 2, dos jugadores acabarian
 * con el tanque en sitios distintos y la partida se separaria en silencio.
 */

const LLANO = () => 10;
const CUESTA = (x) => 10 + x * 0.5;   // 27 grados: se sube, con gasto
const MURO = (x) => (x < 5 ? 10 : 10 + (x - 5) * 4); // 76 grados: no se sube
const MUNDO = { minX: -70, maxX: 70 };

const enLlano = (pedido, combustible = AVANCE.deposito) =>
  mover({ x: 0, pedido, combustible, alturaEn: LLANO, ...MUNDO });

describe('moverse en llano', () => {
  it('avanza lo que se le pide si hay deposito', () => {
    expect(enLlano(4).x).toBeCloseTo(4, 6);
  });

  it('hacia atras tambien', () => {
    expect(enLlano(-4).x).toBeCloseTo(-4, 6);
  });

  it('gasta segun la distancia', () => {
    const r = enLlano(4);
    expect(AVANCE.deposito - r.combustible).toBeCloseTo(4 * AVANCE.costeLlano, 6);
  });

  it('un deposito lleno da unas doce unidades de paseo', () => {
    // Numeros literales a proposito: comparar contra las propias constantes
    // haria que el test siguiera pasando aunque el equilibrio cambiara entero.
    const r = mover({ x: 0, pedido: 99, combustible: 100, alturaEn: LLANO, ...MUNDO });
    expect(r.x).toBeGreaterThan(12);
    expect(r.x).toBeLessThan(13);
  });

  it('sin deposito no se mueve', () => {
    expect(enLlano(5, 0).x).toBe(0);
  });

  it('se para cuando se acaba, no sigue de gorra', () => {
    const r = enLlano(50, 24);
    expect(r.combustible).toBeLessThan(AVANCE.costeLlano * AVANCE.paso);
    expect(r.x).toBeGreaterThan(0);
    expect(r.x).toBeLessThan(4);
  });

  it('pedir cero no hace nada', () => {
    const r = enLlano(0);
    expect(r.x).toBe(0);
    expect(r.combustible).toBe(AVANCE.deposito);
  });
});

describe('idempotencia: es lo que viaja por el cable', () => {
  it('una llamada con 6 da lo mismo que la misma llamada repetida', () => {
    const a = enLlano(6);
    const b = enLlano(6);
    expect(a).toEqual(b);
  });

  it('el resultado depende solo de la x de partida y del pedido', () => {
    const desde = (x) => mover({ x, pedido: 3, combustible: 80, alturaEn: CUESTA, ...MUNDO });
    expect(desde(2)).toEqual(desde(2));
    expect(desde(2)).not.toEqual(desde(9));
  });
});

describe('el terreno cobra', () => {
  it('subir cuesta gasta mas que ir en llano', () => {
    const llano = mover({ x: 0, pedido: 4, combustible: 100, alturaEn: LLANO, ...MUNDO });
    const cuesta = mover({ x: 0, pedido: 4, combustible: 100, alturaEn: CUESTA, ...MUNDO });
    expect(cuesta.combustible).toBeLessThan(llano.combustible);
  });

  it('bajar no cobra el extra de la cuesta', () => {
    const bajando = mover({ x: 0, pedido: -4, combustible: 100, alturaEn: CUESTA, ...MUNDO });
    const llano = mover({ x: 0, pedido: -4, combustible: 100, alturaEn: LLANO, ...MUNDO });
    expect(bajando.combustible).toBeCloseTo(llano.combustible, 6);
  });

  it('una pared no se sube por mucho deposito que haya', () => {
    const r = mover({ x: 0, pedido: 20, combustible: 100, alturaEn: MURO, ...MUNDO });
    expect(r.bloqueado).toBe(true);
    expect(r.x).toBeLessThan(5.3);
    expect(r.combustible).toBeGreaterThan(50);
  });

  it('pero se puede ir por el otro lado', () => {
    const r = mover({ x: 0, pedido: -6, combustible: 100, alturaEn: MURO, ...MUNDO });
    expect(r.bloqueado).toBe(false);
    expect(r.x).toBeCloseTo(-6, 6);
  });
});

describe('los bordes del mundo', () => {
  it('no se sale por la derecha', () => {
    const r = mover({ x: 68, pedido: 20, combustible: 100, alturaEn: LLANO, ...MUNDO });
    expect(r.x).toBeLessThanOrEqual(70);
  });

  it('ni por la izquierda', () => {
    const r = mover({ x: -68, pedido: -20, combustible: 100, alturaEn: LLANO, ...MUNDO });
    expect(r.x).toBeGreaterThanOrEqual(-70);
  });

  it('y no gasta deposito empujando contra el borde', () => {
    const r = mover({ x: 70, pedido: 10, combustible: 100, alturaEn: LLANO, ...MUNDO });
    expect(r.combustible).toBe(100);
  });
});

describe('repostar', () => {
  it('repone por turno sin pasarse del deposito', () => {
    expect(repostar(0)).toBe(AVANCE.recarga);
    expect(repostar(AVANCE.deposito)).toBe(AVANCE.deposito);
    expect(repostar(AVANCE.deposito - 5)).toBe(AVANCE.deposito);
  });

  it('la recarga no llena el deposito de golpe', () => {
    // Si repostara entero cada turno, moverse dejaria de ser una decision.
    expect(AVANCE.recarga).toBeLessThan(AVANCE.deposito / 2);
  });
});

describe('encerrado', () => {
  it('en campo abierto no lo esta', () => {
    expect(encerrado({ x: 0, combustible: 100, alturaEn: LLANO, ...MUNDO })).toBe(false);
  });

  it('entre dos paredes si', () => {
    // Es lo que puede construir el rival amontonando arena a los dos lados.
    const pozo = (x) => 10 + Math.abs(x) * 4;
    expect(encerrado({ x: 0, combustible: 100, alturaEn: pozo, ...MUNDO })).toBe(true);
  });

  it('sin deposito, tambien', () => {
    expect(encerrado({ x: 0, combustible: 0, alturaEn: LLANO, ...MUNDO })).toBe(true);
  });

  it('con una pared a un lado y salida al otro, no', () => {
    expect(encerrado({ x: 0, combustible: 100, alturaEn: MURO, ...MUNDO })).toBe(false);
  });
});

describe('fraccion para la barra', () => {
  it('va de 0 a 1', () => {
    expect(fraccion(0)).toBe(0);
    expect(fraccion(AVANCE.deposito)).toBe(1);
    expect(fraccion(AVANCE.deposito / 2)).toBeCloseTo(0.5, 6);
  });

  it('no se sale de rango', () => {
    expect(fraccion(-50)).toBe(0);
    expect(fraccion(9999)).toBe(1);
  });
});
