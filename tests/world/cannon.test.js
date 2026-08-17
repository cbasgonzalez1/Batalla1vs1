import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildCannon } from '../../src/world/cannon.js';
import { PIVOTE, BOCA } from '../../src/art/blindados.js';
import { MATERIALS } from '../../src/art/direction.js';

/**
 * El arte no puede mover la boca del cañon.
 *
 * De la boca sale la velocidad inicial del proyectil. El teatro —y con el la
 * epoca del blindado— va en la URL de cada jugador, no por el cable: si el
 * rombo de 1916 tuviera la boca un centimetro mas alta que el blindado de
 * 1942, dos amigos en teatros distintos simularian trayectorias distintas y la
 * partida se desincronizaria sin que ninguno entendiera por que.
 *
 * Este fichero es el unico sitio donde esa regla se puede romper en rojo.
 */

const posicionDeLaBoca = (granGuerra, phi) => {
  const canon = buildCannon({
    chassis: MATERIALS.chassisA,
    facing: 1,
    bando: 'a',
    granGuerra,
  });
  canon.setAim(phi);
  canon.group.updateMatrixWorld(true);
  return canon.muzzleWorld(new THREE.Vector3());
};

describe('la boca esta en el mismo sitio en las dos epocas', () => {
  it.each([0, 0.3, 0.8, 1.2, 2.6])('a %s radianes de elevacion', (phi) => {
    const rombo = posicionDeLaBoca(true, phi);
    const torreta = posicionDeLaBoca(false, phi);
    expect(rombo.x).toBeCloseTo(torreta.x, 10);
    expect(rombo.y).toBeCloseTo(torreta.y, 10);
  });

  it('la z SI puede diferir: solo la mira el fogonazo', () => {
    // La barbeta del rombo sobresale del bastidor de oruga hacia el
    // espectador. La balistica usa x/y, asi que eso es libre.
    expect(posicionDeLaBoca(true, 0.5).z).not.toBeCloseTo(posicionDeLaBoca(false, 0.5).z, 3);
  });

  it('los anclajes estan donde dice el modulo de arte', () => {
    const canon = buildCannon({ chassis: MATERIALS.chassisA, facing: 1, bando: 'a' });
    expect(canon.arma.position.x).toBe(PIVOTE.x);
    expect(canon.arma.position.y).toBe(PIVOTE.y);
    expect(canon.muzzle.position.x).toBe(BOCA.x);
    expect(canon.muzzle.position.y).toBe(BOCA.y);
  });
});

describe('elevar apunta igual para los dos bandos', () => {
  it('subir phi sube la boca, mire el vehiculo a donde mire', () => {
    for (const facing of [1, -1]) {
      const canon = buildCannon({ chassis: MATERIALS.chassisA, facing, bando: 'a' });
      const alturaCon = (phi) => {
        canon.setAim(phi);
        canon.group.updateMatrixWorld(true);
        return canon.muzzleWorld(new THREE.Vector3()).y;
      };
      expect(alturaCon(1.0)).toBeGreaterThan(alturaCon(0.2));
    }
  });

  it('el bando B dispara hacia el otro lado', () => {
    const a = buildCannon({ chassis: MATERIALS.chassisA, facing: 1, bando: 'a' });
    const b = buildCannon({ chassis: MATERIALS.chassisB, facing: -1, bando: 'b' });
    a.setAim(0.4);
    b.setAim(0.4);
    a.group.updateMatrixWorld(true);
    b.group.updateMatrixWorld(true);
    expect(a.muzzleWorld(new THREE.Vector3()).x).toBeGreaterThan(0);
    expect(b.muzzleWorld(new THREE.Vector3()).x).toBeLessThan(0);
  });
});

describe('retroceso del tubo', () => {
  const nuevo = (granGuerra) =>
    buildCannon({ chassis: MATERIALS.chassisA, facing: 1, bando: 'a', granGuerra });

  it('en reposo el tubo esta en su sitio', () => {
    expect(nuevo(false).tubo.position.x).toBe(0);
  });

  it('al disparar se hunde hacia atras', () => {
    const canon = nuevo(false);
    canon.retroceder();
    canon.animar(0.05); // 50 ms de los 90 del hundimiento
    expect(canon.tubo.position.x).toBeLessThan(-0.1);
  });

  it('vuelve a su sitio y se queda quieto', () => {
    const canon = nuevo(false);
    canon.retroceder();
    // 90 ms de hundimiento + 260 de vuelta, con margen.
    for (let i = 0; i < 60; i++) canon.animar(1 / 60);
    expect(canon.tubo.position.x).toBe(0);
  });

  it('la pieza corta de 1916 retrocede menos que el canon largo de 1942', () => {
    const hundir = (granGuerra) => {
      const canon = nuevo(granGuerra);
      canon.retroceder();
      canon.animar(0.09);
      return Math.abs(canon.tubo.position.x);
    };
    expect(hundir(true)).toBeLessThan(hundir(false));
  });

  it('sin disparar, animar no mueve nada', () => {
    const canon = nuevo(false);
    canon.animar(0.5);
    expect(canon.tubo.position.x).toBe(0);
  });
});
