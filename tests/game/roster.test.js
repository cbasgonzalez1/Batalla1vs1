import { describe, it, expect } from 'vitest';
import {
  MAX_POR_BANDO,
  crearPartida,
  participanteActivo,
  avanzarTurno,
  ganador,
  vivosDe,
  posicionesDe,
} from '../../src/game/roster.js';

const equipo = (bando, n) =>
  Array.from({ length: n }, (_, i) => ({ id: `${bando}${i + 1}`, bando }));

const partidaDe = (nA, nB) =>
  crearPartida({ jugadores: [...equipo('a', nA), ...equipo('b', nB)], semilla: 'vostok' });

/** Juega `n` turnos y devuelve el id de quien jugo cada uno. */
function secuencia(partida, n) {
  const orden = [];
  for (let i = 0; i < n; i++) {
    orden.push(participanteActivo(partida).id);
    avanzarTurno(partida);
  }
  return orden;
}

describe('formacion de la partida', () => {
  it('acepta desde 1v1 hasta el maximo por bando', () => {
    expect(() => partidaDe(1, 1)).not.toThrow();
    expect(() => partidaDe(MAX_POR_BANDO, MAX_POR_BANDO)).not.toThrow();
  });

  it('acepta bandos desiguales', () => {
    const p = partidaDe(2, 3);
    expect(vivosDe(p, 'a')).toHaveLength(2);
    expect(vivosDe(p, 'b')).toHaveLength(3);
  });

  it('rechaza pasar del maximo', () => {
    expect(() => partidaDe(MAX_POR_BANDO + 1, 1)).toThrow(/pasa de/);
  });

  it('rechaza un bando vacio', () => {
    expect(() => crearPartida({ jugadores: equipo('a', 2), semilla: 'x' })).toThrow(/no tiene jugadores/);
  });

  it('rechaza un bando que no existe', () => {
    expect(() =>
      crearPartida({ jugadores: [{ id: 'x', bando: 'c' }], semilla: 'x' })
    ).toThrow(/Bando desconocido/);
  });

  it('cada participante arranca con su propia vida y cargas', () => {
    const p = partidaDe(2, 2);
    p.participantes[0].estado.hp = 10;
    expect(p.participantes[1].estado.hp).toBe(100);
  });
});

describe('rotacion de turnos', () => {
  it('en 1v1 alterna sin mas', () => {
    expect(secuencia(partidaDe(1, 1), 4)).toEqual(['a1', 'b1', 'a1', 'b1']);
  });

  it('en 3v3 alterna bando y rota dentro de cada bando', () => {
    expect(secuencia(partidaDe(3, 3), 8)).toEqual([
      'a1', 'b1',
      'a2', 'b2',
      'a3', 'b3',
      'a1', 'b1',
    ]);
  });

  it('con bandos desiguales cada bando sigue disparando la mitad de los turnos', () => {
    const orden = secuencia(partidaDe(2, 3), 12);
    const deA = orden.filter((id) => id.startsWith('a')).length;
    expect(deA).toBe(6);
    // El bando corto rota mas rapido: cada uno de los dos dispara el triple
    // de veces que si hubiera round-robin global.
    expect(orden.slice(0, 6)).toEqual(['a1', 'b1', 'a2', 'b2', 'a1', 'b3']);
  });

  it('salta a los destruidos sin bloquear la rotacion', () => {
    const p = partidaDe(3, 1);
    p.participantes.find((x) => x.id === 'a2').estado.destroyed = true;
    expect(secuencia(p, 6)).toEqual(['a1', 'b1', 'a3', 'b1', 'a1', 'b1']);
  });

  it('la ronda avanza cuando el turno vuelve al primer bando', () => {
    const p = partidaDe(2, 2);
    expect(p.ronda).toBe(1);
    avanzarTurno(p); // juega a
    avanzarTurno(p); // juega b -> vuelve a 'a'
    expect(p.ronda).toBe(2);
  });
});

describe('final de partida', () => {
  it('sigue viva mientras quede alguien en los dos bandos', () => {
    const p = partidaDe(3, 3);
    p.participantes.filter((x) => x.bando === 'a').slice(0, 2).forEach((x) => (x.estado.destroyed = true));
    expect(ganador(p)).toBeNull();
  });

  it('gana el bando que conserva a alguien', () => {
    const p = partidaDe(2, 2);
    p.participantes.filter((x) => x.bando === 'b').forEach((x) => (x.estado.destroyed = true));
    expect(ganador(p)).toBe('a');
  });

  it('es empate si caen los dos bandos a la vez', () => {
    // Posible de verdad: un tiro corto mata al que dispara y al ultimo rival
    // en la misma explosion.
    const p = partidaDe(1, 1);
    p.participantes.forEach((x) => (x.estado.destroyed = true));
    expect(ganador(p)).toBe('empate');
  });

  it('avanzarTurno no hace nada una vez hay ganador', () => {
    const p = partidaDe(1, 1);
    p.participantes.find((x) => x.bando === 'b').estado.destroyed = true;
    const antes = { ...p.siguiente, bandoActivo: p.bandoActivo, ronda: p.ronda };
    avanzarTurno(p);
    expect(p.bandoActivo).toBe(antes.bandoActivo);
    expect(p.ronda).toBe(antes.ronda);
  });
});

describe('colocacion en el campo', () => {
  it('cada bando ocupa su mitad', () => {
    const p = partidaDe(3, 3);
    const pos = posicionesDe(p, { separacion: 88 });
    for (const participante of p.participantes) {
      const x = pos.get(participante.id);
      if (participante.bando === 'a') expect(x).toBeLessThan(0);
      else expect(x).toBeGreaterThan(0);
    }
  });

  it('no se solapan dos vehiculos', () => {
    const p = partidaDe(3, 3);
    const xs = [...posicionesDe(p, { separacion: 88 }).values()].sort((u, v) => u - v);
    for (let i = 1; i < xs.length; i++) {
      expect(Math.abs(xs[i] - xs[i - 1])).toBeGreaterThan(1);
    }
  });

  it('es determinista: la misma partida coloca igual', () => {
    const a = [...posicionesDe(partidaDe(2, 3), { separacion: 88 }).entries()];
    const b = [...posicionesDe(partidaDe(2, 3), { separacion: 88 }).entries()];
    expect(a).toEqual(b);
  });

  it('el primero de cada bando se queda en el borde', () => {
    const pos = posicionesDe(partidaDe(3, 3), { separacion: 88 });
    expect(pos.get('a1')).toBeCloseTo(-44, 6);
    expect(pos.get('b1')).toBeCloseTo(44, 6);
  });
});

describe('el camuflaje llega al participante', () => {
  it('se conserva tal cual, sin tocarlo', () => {
    // El roster no opina de decoracion: la reparte y ya. Si algun dia la
    // simulacion leyera esto, dos moviles con catalogos distintos calcularian
    // cosas distintas — que es justo lo que `PLATAFORMA.md` §0.2 prohibe.
    const partida = crearPartida({
      jugadores: [
        { id: 'a1', nombre: 'Ana', bando: 'a', camuflaje: 'a-bosque' },
        { id: 'b1', nombre: 'Bea', bando: 'b' },
      ],
      semilla: 'x',
    });
    expect(partida.participantes.find((p) => p.id === 'a1').camuflaje).toBe('a-bosque');
    expect(partida.participantes.find((p) => p.id === 'b1').camuflaje).toBe(null);
  });
});
