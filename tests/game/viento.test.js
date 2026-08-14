import { describe, it, expect } from 'vitest';
import { VIENTO, siguienteViento, crearViento, flechaDe } from '../../src/game/viento.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

const sembrado = (semilla = 'vostok') => mulberry32(hashSeed(semilla));

/** Recorre `n` turnos y devuelve la serie de vientos. */
function serie(semilla, n) {
  const v = crearViento(sembrado(semilla));
  const salida = [v.actual];
  for (let i = 1; i < n; i++) salida.push(v.avanzar());
  return salida;
}

describe('siguienteViento', () => {
  it('nunca se sale del limite', () => {
    const rng = sembrado();
    let w = 0;
    for (let i = 0; i < 5000; i++) {
      w = siguienteViento(w, rng);
      expect(Math.abs(w)).toBeLessThanOrEqual(VIENTO.limite);
    }
  });

  it('conserva memoria del viento anterior', () => {
    // Con una tirada neutra (0,5 -> empuje 0) queda exactamente la inercia.
    expect(siguienteViento(2, () => 0.5)).toBeCloseTo(2 * VIENTO.inercia, 10);
  });

  it('la inercia calibrada no se toca sin querer', () => {
    // Numero literal a proposito: es una decision de ritmo medida sobre 6000
    // turnos, no una constante cualquiera.
    expect(VIENTO.inercia).toBe(0.9);
  });

  it('revierte hacia la calma si no hay sacudidas', () => {
    // Los turnos que hacen falta salen de la propia inercia, para que el test
    // siga midiendo la propiedad y no el valor que tenia el dia que se escribio.
    const turnos = Math.ceil(Math.log(0.01) / Math.log(VIENTO.inercia));
    let w = VIENTO.limite;
    for (let i = 0; i < turnos; i++) w = siguienteViento(w, () => 0.5);
    expect(Math.abs(w)).toBeLessThan(VIENTO.limite * 0.01);
  });

  it('es determinista con la misma semilla', () => {
    expect(serie('vostok', 40)).toEqual(serie('vostok', 40));
  });

  it('semillas distintas dan vientos distintos', () => {
    expect(serie('vostok', 40)).not.toEqual(serie('kalisto', 40));
  });
});

describe('deriva: el viento deja de ser ruido', () => {
  it('turnos seguidos se parecen mas que turnos lejanos', () => {
    // Es la propiedad que hace planeable la campaña de arena. Si fallara, el
    // viento volveria a ser un dado y Sotavento perderia su reloj.
    const s = serie('campaña', 400);
    let vecinos = 0;
    let lejanos = 0;
    for (let i = 0; i < s.length - 8; i++) {
      vecinos += Math.abs(s[i + 1] - s[i]);
      lejanos += Math.abs(s[i + 8] - s[i]);
    }
    expect(vecinos / lejanos).toBeLessThan(0.75);
  });

  it('cambia de signo cada pocos turnos, no cada turno', () => {
    const s = serie('giros', 300);
    let giros = 0;
    for (let i = 1; i < s.length; i++) {
      if (Math.sign(s[i]) !== Math.sign(s[i - 1])) giros++;
    }
    // Un viento independiente giraria ~150 veces en 300 turnos. Con la inercia
    // calibrada gira cada 5,5, que es el ritmo que hace planeable la campaña:
    // ni tan seguido que no de tiempo, ni tan lento que la partida se congele.
    expect(giros).toBeGreaterThan(35);
    expect(giros).toBeLessThan(70);
  });

  it('usa todo el rango, no se queda encerrado en la calma', () => {
    const s = serie('rango', 500);
    expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(VIENTO.limite * 0.6);
  });
});

describe('pronostico', () => {
  it('el pronostico de hoy es el viento de mañana, exactamente', () => {
    const v = crearViento(sembrado());
    for (let i = 0; i < 50; i++) {
      const anunciado = v.pronostico;
      expect(v.avanzar()).toBe(anunciado);
    }
  });

  it('no gasta tiradas de mas: mirarlo no cambia la partida', () => {
    // Si consultar el pronostico consumiera azar, dos moviles que lo miran
    // distinto numero de veces se desincronizarian.
    const conMirones = crearViento(sembrado());
    const sinMirones = crearViento(sembrado());

    const a = [];
    const b = [];
    for (let i = 0; i < 30; i++) {
      conMirones.pronostico;
      conMirones.pronostico;
      conMirones.actual;
      a.push(conMirones.avanzar());
      b.push(sinMirones.avanzar());
    }
    expect(a).toEqual(b);
  });

  it('arranca con viento y pronostico ya resueltos', () => {
    const v = crearViento(sembrado());
    expect(Number.isFinite(v.actual)).toBe(true);
    expect(Number.isFinite(v.pronostico)).toBe(true);
  });
});

describe('flechaDe', () => {
  it('señala el sentido y marca la calma', () => {
    expect(flechaDe(2)).toBe('→');
    expect(flechaDe(-2)).toBe('←');
    expect(flechaDe(0)).toBe('·');
    expect(flechaDe(0.01)).toBe('·');
  });
});
