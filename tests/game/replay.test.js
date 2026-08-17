import { describe, it, expect } from 'vitest';
import { codificar, decodificar, semillaDeRevancha, longitudDe } from '../../src/game/replay.js';

const turno = (anguloDeg, potencia, reaccion) => ({ anguloDeg, potencia, ...(reaccion ? { reaccion } : {}) });

describe('ida y vuelta', () => {
  it('una partida vuelve igual que salio', () => {
    const partida = {
      semilla: 'vostok',
      turnos: [turno(45, 0.8), turno(32.5, 0.615), turno(66.5, 0.94)],
    };
    expect(decodificar(codificar(partida))).toEqual(partida);
  });

  it('conserva las reacciones con su paso', () => {
    const partida = {
      semilla: 'duelo',
      turnos: [turno(45, 0.8, { tipo: 'escudo', paso: 280 }), turno(30, 0.5, { tipo: 'salto', paso: 412 })],
    };
    expect(decodificar(codificar(partida))).toEqual(partida);
  });

  it('aguanta semillas con caracteres raros', () => {
    const partida = { semilla: 'la de ayer #3 ñ', turnos: [turno(45, 0.8)] };
    expect(decodificar(codificar(partida)).semilla).toBe('la de ayer #3 ñ');
  });

  it('una partida sin tiros tambien vale', () => {
    expect(decodificar(codificar({ semilla: 'x', turnos: [] }))).toEqual({ semilla: 'x', turnos: [] });
  });

  it('conserva la precision con la que el juego usa los numeros', () => {
    // Decima de grado y milesima de potencia: mas fino que eso no lo distingue
    // ni el pulgar ni la simulacion.
    const partida = { semilla: 's', turnos: [turno(48.3, 0.717)] };
    const vuelta = decodificar(codificar(partida)).turnos[0];
    expect(vuelta.anguloDeg).toBeCloseTo(48.3, 6);
    expect(vuelta.potencia).toBeCloseTo(0.717, 6);
  });
});

describe('cabe en una URL', () => {
  it('un combate de 16 turnos ocupa poco', () => {
    const partida = {
      semilla: 'kerch-01',
      turnos: Array.from({ length: 16 }, (_, i) => turno(30 + i * 2, 0.5 + i * 0.02)),
    };
    expect(longitudDe(partida)).toBeLessThan(200);
  });

  it('incluso con reaccion en cada turno', () => {
    const partida = {
      semilla: 'kerch-01',
      turnos: Array.from({ length: 16 }, (_, i) =>
        turno(30 + i, 0.6, { tipo: i % 2 ? 'escudo' : 'salto', paso: 200 + i * 7 })
      ),
    };
    expect(longitudDe(partida)).toBeLessThan(300);
  });
});

describe('un enlace roto no rompe el juego', () => {
  it('devuelve null en vez de lanzar', () => {
    for (const basura of [null, undefined, 42, '', 'sin separador', 'x~', '~turnos', 'a~zz', 'a~1']) {
      expect(() => decodificar(basura)).not.toThrow();
    }
  });

  it('rechaza lo que no es un replay', () => {
    expect(decodificar('hola')).toBeNull();
    expect(decodificar(null)).toBeNull();
    expect(decodificar('~sinsemilla')).toBeNull();
  });

  it('rechaza turnos incompletos', () => {
    expect(decodificar('s~1')).toBeNull();
  });

  it('rechaza valores imposibles en vez de colarlos en la simulacion', () => {
    // Un angulo de 400 grados o una potencia de 50 no vienen de este juego.
    const anguloEnorme = `s~${(9999).toString(36)}-${(800).toString(36)}`;
    const potenciaEnorme = `s~${(450).toString(36)}-${(50000).toString(36)}`;
    expect(decodificar(anguloEnorme)).toBeNull();
    expect(decodificar(potenciaEnorme)).toBeNull();
  });

  it('rechaza una reaccion inventada', () => {
    expect(decodificar('s~cf-mm-X5')).toBeNull();
  });
});

describe('semilla de revancha', () => {
  it('es explicita y se puede escribir a mano', () => {
    expect(semillaDeRevancha('vostok', 2)).toBe('vostok#2');
    expect(semillaDeRevancha('vostok', 5)).toBe('vostok#5');
  });

  it('no se encadena sobre si misma', () => {
    // Antes la revancha derivaba de los disparos del combate anterior, asi que
    // no habia forma de volver a ella sin repetir la partida entera.
    expect(semillaDeRevancha('vostok#2', 3)).toBe('vostok#3');
    expect(semillaDeRevancha('vostok#7', 8)).toBe('vostok#8');
  });

  it('la primera revancha es la 2, no la 1', () => {
    expect(semillaDeRevancha('x', 0)).toBe('x#2');
    expect(semillaDeRevancha('x', 1)).toBe('x#2');
  });

  it('es determinista', () => {
    expect(semillaDeRevancha('a', 4)).toBe(semillaDeRevancha('a', 4));
  });
});
