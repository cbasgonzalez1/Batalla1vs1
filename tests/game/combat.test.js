import { describe, it, expect } from 'vitest';
import {
  MAX_HP,
  BLAST,
  REACTION,
  damageAt,
  newPlayerState,
  applyDamage,
} from '../../src/game/combat.js';

/**
 * Los numeros de balance van LITERALES, no leidos de las constantes que
 * describen. Un test que compara BLAST.maxDamage contra BLAST.maxDamage pasa
 * siempre y no protege nada: si alguien retoca el balance sin querer, estos
 * fallan y obligan a decidirlo a conciencia.
 */
const BALANCE = {
  danoDirecto: 46,
  radio: 5.2,
  factorEscudo: 0.28,
  cargas: 3,
  vidaMaxima: 100,
};

describe('constantes de balance', () => {
  it('no han cambiado sin querer', () => {
    expect(BLAST.maxDamage).toBe(BALANCE.danoDirecto);
    expect(BLAST.radius).toBe(BALANCE.radio);
    expect(REACTION.shieldFactor).toBe(BALANCE.factorEscudo);
    expect(REACTION.charges).toBe(BALANCE.cargas);
    expect(MAX_HP).toBe(BALANCE.vidaMaxima);
  });
});

describe('damageAt', () => {
  it('el impacto directo hace el dano maximo', () => {
    expect(damageAt(0, 0, 0, 0)).toBeCloseTo(BALANCE.danoDirecto, 6);
  });

  it('no hace dano en el borde del radio ni fuera', () => {
    expect(damageAt(0, 0, BLAST.radius, 0)).toBe(0);
    expect(damageAt(0, 0, BLAST.radius + 10, 0)).toBe(0);
  });

  it('decae de forma monotona con la distancia', () => {
    let anterior = Infinity;
    for (let d = 0; d < BLAST.radius; d += 0.25) {
      const actual = damageAt(0, 0, d, 0);
      expect(actual).toBeLessThan(anterior);
      anterior = actual;
    }
  });

  it('mide distancia real, no solo horizontal', () => {
    // Mismo radio en diagonal que en linea recta.
    const diagonal = damageAt(0, 0, 3 * Math.SQRT1_2, 3 * Math.SQRT1_2);
    expect(diagonal).toBeCloseTo(damageAt(0, 0, 3, 0), 6);
  });

  it('un tiro corto puede alcanzar al que dispara', () => {
    // La regla que hace peligroso quedarse corto: el dano no distingue bandos.
    expect(damageAt(-44, 2, -44, 3)).toBeGreaterThan(0);
  });
});

describe('applyDamage', () => {
  it('el escudo multiplica por el factor exacto', () => {
    const sinEscudo = newPlayerState();
    const conEscudo = newPlayerState();
    conEscudo.shielded = true;

    const bruto = 40;
    const aplicadoSin = applyDamage(sinEscudo, bruto);
    const aplicadoCon = applyDamage(conEscudo, bruto);

    expect(aplicadoSin).toBeCloseTo(bruto, 6);
    expect(aplicadoCon).toBeCloseTo(40 * BALANCE.factorEscudo, 6); // 11,2
  });

  it('marca destruido al llegar a cero y no baja de ahi', () => {
    const p = newPlayerState();
    applyDamage(p, MAX_HP * 3);
    expect(p.hp).toBe(0);
    expect(p.destroyed).toBe(true);
  });

  it('tres impactos directos matan, dos no', () => {
    // Es el ritmo declarado del combate; si alguien toca BLAST.maxDamage
    // sin querer, este test lo caza.
    const p = newPlayerState();
    applyDamage(p, BLAST.maxDamage);
    applyDamage(p, BLAST.maxDamage);
    expect(p.destroyed).toBe(false);
    applyDamage(p, BLAST.maxDamage);
    expect(p.destroyed).toBe(true);
  });

  it('arranca con vida llena y las cargas de reaccion completas', () => {
    const p = newPlayerState();
    expect(p.hp).toBe(MAX_HP);
    expect(p.charges).toBe(REACTION.charges);
    expect(p.destroyed).toBe(false);
  });
});
