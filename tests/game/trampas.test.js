import { describe, it, expect } from 'vitest';
import {
  TIPOS,
  TRAMPA,
  cuantasTrampas,
  generarTrampas,
  chocarCon,
  resolverChoque,
  minaEn,
  nivelDe,
} from '../../src/game/trampas.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';
import { simulate, launchVelocity } from '../../src/game/ballistics.js';

const sembrado = (s = 'trampas') => mulberry32(hashSeed(s));
const generar = (complejidad, semilla = 'campo') =>
  generarTrampas({ rng: sembrado(semilla), complejidad, alturaEn: () => 8 });

describe('cuantas salen', () => {
  it('sin complejidad, el campo queda despejado', () => {
    expect(cuantasTrampas(0)).toBe(0);
    expect(generar(0)).toEqual([]);
  });

  it('a tope hay seis', () => {
    expect(cuantasTrampas(1)).toBe(6);
  });

  it('mas complejidad, mas trampas', () => {
    expect(cuantasTrampas(0.5)).toBeGreaterThan(cuantasTrampas(0.2));
  });

  it('aguanta valores fuera de rango', () => {
    expect(cuantasTrampas(-3)).toBe(0);
    expect(cuantasTrampas(99)).toBe(6);
  });
});

describe('donde salen', () => {
  it('nunca encima de un cañon', () => {
    for (let i = 0; i < 30; i++) {
      for (const t of generar(1, `s${i}`)) {
        expect(Math.abs(Math.abs(t.x) - 44)).toBeGreaterThan(TRAMPA.margenSeguro - 0.01);
      }
    }
  });

  it('separadas entre si, sin rincones imposibles', () => {
    for (let i = 0; i < 30; i++) {
      const trampas = generar(1, `sep${i}`);
      for (let a = 0; a < trampas.length; a++) {
        for (let b = a + 1; b < trampas.length; b++) {
          expect(Math.abs(trampas[a].x - trampas[b].x)).toBeGreaterThanOrEqual(9);
        }
      }
    }
  });

  it('las de aire vuelan a una altura util', () => {
    for (const t of generar(1, 'altura').filter((t) => !t.apoyada)) {
      expect(t.y).toBeGreaterThanOrEqual(8 + TRAMPA.alturaMinima);
      expect(t.y).toBeLessThanOrEqual(8 + TRAMPA.alturaMaxima);
    }
  });

  it('las de pista se apoyan en el suelo', () => {
    for (const t of generar(1, 'altura').filter((t) => t.apoyada)) {
      expect(t.y).toBeGreaterThan(8);
      expect(t.y).toBeLessThan(8 + TRAMPA.alturaMinima);
    }
  });

  it('salen de los dos tipos, no todas arriba ni todas abajo', () => {
    let arriba = 0;
    let abajo = 0;
    for (let i = 0; i < 40; i++) {
      for (const t of generar(1, `mezcla${i}`)) {
        if (t.apoyada) abajo++; else arriba++;
      }
    }
    expect(arriba).toBeGreaterThan(20);
    expect(abajo).toBeGreaterThan(20);
  });

  it('no hay deflectores tumbados en el suelo', () => {
    // Devolverian el tiro contra el propio suelo, que no es lo que hace un
    // deflector. Abajo tiene mas sentido una mina o un muro.
    for (let i = 0; i < 40; i++) {
      for (const t of generar(1, `sueloD${i}`)) {
        if (t.apoyada) expect(t.tipo).not.toBe('deflector');
      }
    }
  });

  it('siguen el relieve: mas altas donde el terreno sube', () => {
    const enCuesta = generarTrampas({
      rng: sembrado('cuesta'),
      complejidad: 1,
      alturaEn: (x) => 5 + x * 0.2,
    });
    for (const t of enCuesta) expect(t.y).toBeGreaterThan(5 + t.x * 0.2);
  });

  it('solo hay tipos conocidos', () => {
    for (const t of generar(1, 'tipos')) expect(TIPOS).toContain(t.tipo);
  });
});

describe('determinismo', () => {
  it('la misma semilla siembra el mismo campo', () => {
    expect(generar(0.8, 'igual')).toEqual(generar(0.8, 'igual'));
  });

  it('semillas distintas siembran campos distintos', () => {
    expect(generar(0.8, 'uno')).not.toEqual(generar(0.8, 'otro'));
  });

  it('no hace falta mandarlas por el cable: salen de la semilla', () => {
    // Es lo que permite que los seis moviles vean las mismas trampas sin que el
    // servidor tenga que contarlas.
    const movilA = generar(1, 'partida-42');
    const movilB = generar(1, 'partida-42');
    expect(movilA.map((t) => `${t.tipo}@${t.x.toFixed(6)},${t.y.toFixed(6)}`))
      .toEqual(movilB.map((t) => `${t.tipo}@${t.x.toFixed(6)},${t.y.toFixed(6)}`));
  });
});

describe('choques', () => {
  const mina = { id: 'm', tipo: 'mina', x: 0, y: 10, radio: 1.5, viva: true };

  it('detecta el paso por encima', () => {
    expect(chocarCon([mina], -5, 10, 5, 10)).not.toBeNull();
  });

  it('no se inventa choques donde no los hay', () => {
    expect(chocarCon([mina], -5, 30, 5, 30)).toBeNull();
  });

  it('no atraviesa una trampa aunque el paso sea largo', () => {
    // A potencia alta el proyectil recorre varias unidades por paso: sin barrer
    // el segmento, pasaria de largo sin tocarla.
    expect(chocarCon([mina], -20, 10, 20, 10, 32)).not.toBeNull();
  });

  it('las trampas gastadas dejan de estorbar', () => {
    expect(chocarCon([{ ...mina, viva: false }], -5, 10, 5, 10)).toBeNull();
  });
});

describe('que hace cada trampa', () => {
  it('la mina detona y se gasta', () => {
    const mina = { tipo: 'mina', viva: true };
    const s = { x: 0, y: 10, vx: 30, vy: 5 };
    expect(resolverChoque(mina, s)).toBe('detona');
    expect(mina.viva).toBe(false);
  });

  it('el muro absorbe el tiro y sigue en pie', () => {
    const muro = { tipo: 'muro', viva: true };
    expect(resolverChoque(muro, { x: 0, y: 0, vx: 10, vy: 0 })).toBe('absorbe');
    expect(muro.viva).toBe(true);
  });

  it('el deflector devuelve el proyectil hacia quien lo tiro', () => {
    // Es la trampa que de verdad castiga: el tiro vuelve y puede caerte encima.
    const s = { x: 0, y: 12, vx: 34, vy: -6 };
    expect(resolverChoque({ tipo: 'deflector', viva: true }, s)).toBe('rebota');
    expect(s.vx).toBeLessThan(0);
  });

  it('el rebote no devuelve toda la fuerza', () => {
    // Medido: con 0,82 el tiro devuelto se pasaba por encima del propio cañon y
    // salia del mapa. Con 0,60 cae a 2,7 unidades de media del que disparo.
    const s = { x: 0, y: 12, vx: 40, vy: 0 };
    resolverChoque({ tipo: 'deflector', viva: true }, s);
    expect(Math.abs(s.vx)).toBeLessThan(40);
    expect(Math.abs(s.vx)).toBeGreaterThan(40 * 0.4);
    expect(TRAMPA.rebote).toBe(0.6);
  });

  it('el deflector empuja hacia arriba para que el rebote tenga recorrido', () => {
    // Sin esto un rebote a media altura se estrella a los dos metros y no
    // castiga a nadie.
    const s = { x: 0, y: 12, vx: 34, vy: -20 };
    resolverChoque({ tipo: 'deflector', viva: true }, s);
    expect(s.vy).toBeGreaterThan(0);
  });

  it('el deflector no se gasta: sigue ahi todo el combate', () => {
    const deflector = { tipo: 'deflector', viva: true };
    resolverChoque(deflector, { x: 0, y: 0, vx: 10, vy: 0 });
    expect(deflector.viva).toBe(true);
  });
});

describe('un tiro que rebota vuelve de verdad', () => {
  it('acaba cayendo del lado del que disparo', () => {
    // La prueba completa: se dispara de izquierda a derecha contra un deflector
    // y el proyectil termina a la izquierda de donde reboto.
    const terreno = { x0: -70, width: 140, floorY: -4, heightAt: () => 0 };
    const v = launchVelocity((42 * Math.PI) / 180, 0.85, 1, 14, 56);
    const salida = { x: -44, y: 6, ...v };

    // El deflector se coloca SOBRE la trayectoria real, no a ojo: puesto a
    // mano, el tiro le pasaba diez unidades por encima y el test medía otra
    // cosa.
    const libre = simulate({ ...salida }, 0, terreno, { maxSteps: 1400, sampleEvery: 1, maxPoints: 900 });
    const enMedio = libre.points[Math.floor(libre.points.length / 2)];
    const deflector = { id: 'd', tipo: 'deflector', x: enMedio[0], y: enMedio[1], radio: 2.2, viva: true };

    const r = simulate({ ...salida }, 0, terreno, {
      maxSteps: 1400,
      alChocar: (s, px, py) => {
        const golpe = chocarCon([deflector], px, py, s.x, s.y);
        if (!golpe) return null;
        return resolverChoque(golpe.trampa, s) === 'rebota' ? { rebote: true } : { fin: golpe };
      },
    });

    expect(r.hit).not.toBeNull();
    expect(r.hit.x).toBeLessThan(deflector.x);
  });
});

describe('minas de pista', () => {
  const campo = [
    { id: 'a', tipo: 'mina', x: 10, y: 6, radio: 1.5, apoyada: true, viva: true },
    { id: 'b', tipo: 'mina', x: 40, y: 20, radio: 1.5, apoyada: false, viva: true },
    { id: 'c', tipo: 'muro', x: 12, y: 6, radio: 1.9, apoyada: true, viva: true },
  ];

  it('avisa de la mina donde va a caer el que salta', () => {
    // Saltar para esquivar un obus y aterrizar sobre una mina tiene que ser
    // peor que haberse quedado quieto.
    expect(minaEn(campo, 10)?.id).toBe('a');
    expect(minaEn(campo, 11.5)?.id).toBe('a');
  });

  it('no confunde con las que estan en el aire', () => {
    expect(minaEn(campo, 40)).toBeNull();
  });

  it('no confunde con los muros', () => {
    expect(minaEn(campo, 12, 0.5)).toBeNull();
  });

  it('deja aterrizar donde no hay nada', () => {
    expect(minaEn(campo, -30)).toBeNull();
  });

  it('las gastadas ya no estorban', () => {
    expect(minaEn([{ ...campo[0], viva: false }], 10)).toBeNull();
  });
});

describe('nivelDe', () => {
  it('pone nombre a la complejidad', () => {
    expect(nivelDe(0)).toBe('despejado');
    expect(nivelDe(0.3)).toBe('suelto');
    expect(nivelDe(0.5)).toBe('sembrado');
    expect(nivelDe(1)).toBe('minado');
  });
});

describe('modificadores: la carga hueca', () => {
  const carga = () => ({ id: 'c', tipo: 'carga', x: 0, y: 10, radio: 1.3, viva: true, apoyada: false });

  it('no toca la velocidad: el proyectil la atraviesa', () => {
    const s = { x: 0, y: 10, vx: 24, vy: -3 };
    resolverChoque(carga(), s);
    expect(s.vx).toBe(24);
    expect(s.vy).toBe(-3);
  });

  it('deja el multiplicador pegado al proyectil', () => {
    const s = { x: 0, y: 10, vx: 24, vy: -3 };
    expect(resolverChoque(carga(), s)).toBe('multiplica');
    expect(s.multiplicador).toBeCloseTo(TRAMPA.multiplicadorCarga, 10);
  });

  it('se gasta: no multiplica dos veces', () => {
    const t = carga();
    const s = { x: 0, y: 10, vx: 24, vy: -3 };
    resolverChoque(t, s);
    expect(t.viva).toBe(false);
  });

  it('encadenada con una mina multiplica las dos', () => {
    const s = { x: 0, y: 10, vx: 24, vy: -3 };
    resolverChoque(carga(), s);
    resolverChoque({ tipo: 'mina', viva: true }, s);
    expect(s.multiplicador).toBeCloseTo(TRAMPA.multiplicadorCarga * TRAMPA.multiplicadorMina, 10);
  });

  it('nunca se genera apoyada en el suelo: es un modificador, no un bidon', () => {
    for (let semilla = 1; semilla < 40; semilla++) {
      const trampas = generarTrampas({
        rng: mulberry32(semilla), complejidad: 1, alturaEn: () => 0,
      });
      for (const t of trampas) {
        if (t.tipo === 'carga') expect(t.apoyada).toBe(false);
      }
    }
  });
});
