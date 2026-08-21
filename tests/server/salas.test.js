import { describe, it, expect, beforeEach } from 'vitest';
import { crearSalas, atender, MAX_JUGADORES } from '../../server/salas.js';
import { VERSION, PIDE, DICE, ACCION } from '../../src/net/protocolo.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

let salas;

beforeEach(() => {
  salas = crearSalas({
    rng: mulberry32(hashSeed('salas')),
    semillaDe: (sala) => `partida-${sala.codigo}`,
  });
});

const sesionDe = (id) => ({ id, sala: null, bando: null });

function unir(sala, id, nombre = id) {
  const sesion = sesionDe(id);
  const salidas = atender(salas, sesion, { v: VERSION, tipo: PIDE.unir, sala, nombre });
  return { sesion, salidas };
}

describe('entrar en una sala', () => {
  it('el primero que entra cae en el bando a', () => {
    const { codigo } = salas.crear();
    const r = salas.unir(codigo, { id: 'u1', nombre: 'Ana' });
    expect(r.ok).toBe(true);
    expect(r.jugador.bando).toBe('a');
  });

  it('los siguientes se reparten al lado mas vacio', () => {
    const { codigo } = salas.crear();
    const bandos = ['u1', 'u2', 'u3', 'u4'].map(
      (id) => salas.unir(codigo, { id, nombre: id }).jugador.bando
    );
    expect(bandos).toEqual(['a', 'b', 'a', 'b']);
  });

  it('caben seis y el septimo se queda fuera', () => {
    const { codigo } = salas.crear();
    for (let i = 0; i < MAX_JUGADORES; i++) {
      expect(salas.unir(codigo, { id: `u${i}`, nombre: `u${i}` }).ok).toBe(true);
    }
    const sobra = salas.unir(codigo, { id: 'tarde', nombre: 'tarde' });
    expect(sobra.ok).toBe(false);
    expect(sobra.motivo).toMatch(/llena/);
  });

  it('no se entra a una sala que no existe', () => {
    expect(salas.unir('ZZZZ', { id: 'u1', nombre: 'Ana' }).ok).toBe(false);
  });

  it('no se entra a una partida ya empezada', () => {
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'a' });
    salas.unir(codigo, { id: 'u2', nombre: 'b' });
    salas.marcarListo(codigo, 'u1');
    salas.marcarListo(codigo, 'u2');
    salas.empezar(codigo);

    expect(salas.unir(codigo, { id: 'u3', nombre: 'c' }).ok).toBe(false);
  });

  it('los codigos no se repiten', () => {
    const vistos = new Set();
    for (let i = 0; i < 200; i++) vistos.add(salas.crear().codigo);
    expect(vistos.size).toBe(200);
  });
});

describe('elegir bando', () => {
  it('se puede cambiar de lado si hay hueco', () => {
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'Ana' });
    expect(salas.cambiarBando(codigo, 'u1', 'b').ok).toBe(true);
    expect(salas.estado(codigo).jugadores[0].bando).toBe('b');
  });

  it('no se puede cambiar a un bando lleno', () => {
    const { codigo } = salas.crear();
    for (const id of ['u1', 'u2', 'u3', 'u4', 'u5']) salas.unir(codigo, { id, nombre: id });
    // a tiene 3 (u1, u3, u5). u2 esta en b y no cabe en a.
    expect(salas.cambiarBando(codigo, 'u2', 'a').ok).toBe(false);
  });

  it('cambiar de lado deshace el listo', () => {
    // Si no, alguien podria colarse al bando contrario con la partida a punto
    // de arrancar y nadie lo confirmaria.
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'Ana' });
    salas.marcarListo(codigo, 'u1');
    salas.cambiarBando(codigo, 'u1', 'b');
    expect(salas.estado(codigo).jugadores[0].listo).toBe(false);
  });
});

describe('empezar', () => {
  const preparar = (ids) => {
    const { codigo } = salas.crear();
    for (const id of ids) salas.unir(codigo, { id, nombre: id });
    for (const id of ids) salas.marcarListo(codigo, id);
    return codigo;
  };

  it('no empieza con un solo jugador', () => {
    const codigo = preparar(['u1']);
    expect(salas.puedeEmpezar(codigo)).toBe(false);
  });

  it('no empieza si falta alguien por confirmar', () => {
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'a' });
    salas.unir(codigo, { id: 'u2', nombre: 'b' });
    salas.marcarListo(codigo, 'u1');
    expect(salas.puedeEmpezar(codigo)).toBe(false);
  });

  it('no empieza si un bando esta vacio', () => {
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'a' });
    salas.unir(codigo, { id: 'u2', nombre: 'b' });
    salas.cambiarBando(codigo, 'u2', 'a');
    salas.marcarListo(codigo, 'u1');
    salas.marcarListo(codigo, 'u2');
    expect(salas.puedeEmpezar(codigo)).toBe(false);
  });

  it('un 1 contra 3 es legal: en familia no siempre sois pares', () => {
    const { codigo } = salas.crear();
    for (const id of ['u1', 'u2', 'u3', 'u4']) salas.unir(codigo, { id, nombre: id });
    salas.cambiarBando(codigo, 'u2', 'a');   // a: u1,u2,u3   b: u4
    for (const id of ['u1', 'u2', 'u3', 'u4']) salas.marcarListo(codigo, id);
    expect(salas.puedeEmpezar(codigo)).toBe(true);
  });

  it('reparte una semilla y congela la alineacion', () => {
    const codigo = preparar(['u1', 'u2']);
    const r = salas.empezar(codigo);
    expect(r.ok).toBe(true);
    expect(r.semilla).toBe(`partida-${codigo}`);
    expect(r.alineacion.map((j) => j.id)).toEqual(['u1', 'u2']);
  });
});

describe('salir', () => {
  it('la sala desaparece cuando se va el ultimo', () => {
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'Ana' });
    expect(salas.numeroDeSalas).toBe(1);
    salas.salir(codigo, 'u1');
    expect(salas.numeroDeSalas).toBe(0);
  });

  it('si se va el anfitrion, lo hereda otro', () => {
    const { codigo } = salas.crear();
    salas.unir(codigo, { id: 'u1', nombre: 'a' });
    salas.unir(codigo, { id: 'u2', nombre: 'b' });
    const r = salas.salir(codigo, 'u1');
    expect(r.sala.anfitrion).toBe('u2');
  });
});

describe('atender: del mensaje a las acciones', () => {
  it('unirse difunde el estado de la sala a todos', () => {
    const { codigo } = salas.crear();
    const { salidas } = unir(codigo, 'u1', 'Ana');
    expect(salidas[0].para).toBe('sala');
    expect(salidas[0].mensaje.tipo).toBe(DICE.sala);
    expect(salidas[0].mensaje.jugadores).toHaveLength(1);
  });

  it('un mensaje invalido se contesta solo a quien lo mando', () => {
    const salidas = atender(salas, sesionDe('u1'), { v: VERSION, tipo: PIDE.unir, sala: 'nope' });
    expect(salidas[0].para).toBe('uno');
    expect(salidas[0].mensaje.tipo).toBe(DICE.error);
  });

  it('cuando el ultimo dice listo, sale el empezar con la semilla', () => {
    const { codigo } = salas.crear();
    const a = unir(codigo, 'u1', 'Ana').sesion;
    const b = unir(codigo, 'u2', 'Bea').sesion;

    atender(salas, a, { v: VERSION, tipo: PIDE.listo });
    const salidas = atender(salas, b, { v: VERSION, tipo: PIDE.listo });

    const empezar = salidas.find((s) => s.mensaje.tipo === DICE.empezar);
    expect(empezar).toBeTruthy();
    expect(empezar.mensaje.semilla).toBe(`partida-${codigo}`);
    expect(empezar.mensaje.alineacion).toHaveLength(2);
  });

  it('el input se reenvia sellado con quien lo manda, sin interpretarlo', () => {
    const { codigo } = salas.crear();
    const a = unir(codigo, 'u1', 'Ana').sesion;

    const salidas = atender(salas, a, {
      v: VERSION,
      tipo: PIDE.input,
      paso: 12,
      accion: ACCION.disparo,
      anguloDeg: 45,
      potencia: 0.8,
    });

    expect(salidas[0].para).toBe('sala');
    expect(salidas[0].mensaje).toMatchObject({
      tipo: DICE.input,
      de: 'u1',
      paso: 12,
      accion: ACCION.disparo,
      anguloDeg: 45,
      potencia: 0.8,
    });
  });

  it('un input con angulo imposible se rechaza antes de reenviarse', () => {
    const { codigo } = salas.crear();
    const a = unir(codigo, 'u1', 'Ana').sesion;
    const salidas = atender(salas, a, {
      v: VERSION, tipo: PIDE.input, paso: 12, accion: ACCION.disparo, anguloDeg: 999, potencia: 0.8,
    });
    expect(salidas[0].mensaje.tipo).toBe(DICE.error);
  });
});

describe('desincronia', () => {
  it('calla mientras las huellas coincidan', () => {
    const { codigo } = salas.crear();
    const a = unir(codigo, 'u1', 'Ana').sesion;
    const b = unir(codigo, 'u2', 'Bea').sesion;

    atender(salas, a, { v: VERSION, tipo: PIDE.checksum, turno: 1, huella: 123 });
    const salidas = atender(salas, b, { v: VERSION, tipo: PIDE.checksum, turno: 1, huella: 123 });
    expect(salidas).toEqual([]);
  });

  it('avisa a todos cuando dos moviles calculan distinto', () => {
    const { codigo } = salas.crear();
    const a = unir(codigo, 'u1', 'Ana').sesion;
    const b = unir(codigo, 'u2', 'Bea').sesion;

    atender(salas, a, { v: VERSION, tipo: PIDE.checksum, turno: 1, huella: 123 });
    const salidas = atender(salas, b, { v: VERSION, tipo: PIDE.checksum, turno: 1, huella: 999 });

    expect(salidas[0].mensaje.tipo).toBe(DICE.desincronia);
    expect(salidas[0].mensaje.turno).toBe(1);
    expect(salidas[0].mensaje.huellas).toHaveLength(2);
  });

  it('no avisa hasta que han hablado todos', () => {
    const { codigo } = salas.crear();
    const a = unir(codigo, 'u1', 'Ana').sesion;
    unir(codigo, 'u2', 'Bea');
    unir(codigo, 'u3', 'Cris');

    const salidas = atender(salas, a, { v: VERSION, tipo: PIDE.checksum, turno: 1, huella: 1 });
    expect(salidas).toEqual([]);
  });
});

describe('el camuflaje viaja con el jugador', () => {
  /**
   * Es decoracion y no toca la simulacion, pero tiene que llegar: sin esto, en
   * una partida en red el tanque de enfrente sale con el color de serie y lo
   * comprado no se ve donde importa, que es en el campo.
   */
  const conCamuflajes = () => {
    const salas = crearSalas({ rng: () => 0.5, semillaDe: () => 'semilla' });
    const sala = salas.crear();
    salas.unir(sala.codigo, {
      id: 'uno', nombre: 'Ana', camuflajes: { a: 'a-bosque', b: 'b-abisal' },
    });
    salas.unir(sala.codigo, { id: 'dos', nombre: 'Bea' });
    return { salas, codigo: sala.codigo };
  };

  it('el estado publico enseña el del bando que juega', () => {
    const { salas, codigo } = conCamuflajes();
    const [ana] = salas.estado(codigo).jugadores;
    expect(ana.bando).toBe('a');
    expect(ana.camuflaje).toBe('a-bosque');
  });

  it('cambiar de bando cambia el camuflaje sin mandar nada mas', () => {
    // Se guardan los DOS al entrar justo para esto.
    const { salas, codigo } = conCamuflajes();
    salas.cambiarBando(codigo, 'uno', 'b');
    const ana = salas.estado(codigo).jugadores.find((j) => j.id === 'uno');
    expect(ana.camuflaje).toBe('b-abisal');
  });

  it('quien no manda camuflaje sale a null, y eso vale', () => {
    const { salas, codigo } = conCamuflajes();
    const bea = salas.estado(codigo).jugadores.find((j) => j.id === 'dos');
    expect(bea.camuflaje).toBe(null);
  });

  it('la alineacion lo lleva, que es lo que monta el vehiculo', () => {
    const { salas, codigo } = conCamuflajes();
    salas.marcarListo(codigo, 'uno');
    salas.marcarListo(codigo, 'dos');
    const { alineacion } = salas.empezar(codigo);
    expect(alineacion.find((j) => j.id === 'uno').camuflaje).toBe('a-bosque');
    expect(alineacion.find((j) => j.id === 'dos').camuflaje).toBe(null);
  });
});
