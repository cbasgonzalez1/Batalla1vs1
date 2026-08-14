import { describe, it, expect, beforeEach } from 'vitest';
import { crearCliente } from '../../src/net/cliente.js';
import { VERSION, PIDE, DICE } from '../../src/net/protocolo.js';

/** Socket falso: guarda lo enviado y deja inyectar lo que llega. */
function socketFalso() {
  const falso = {
    readyState: 0,
    enviados: [],
    cerrado: false,
    send(texto) {
      falso.enviados.push(JSON.parse(texto));
    },
    close() {
      falso.cerrado = true;
      falso.onclose?.();
    },
    abrir() {
      falso.readyState = 1;
      falso.onopen?.();
    },
    recibir(objeto) {
      falso.onmessage?.({ data: JSON.stringify(objeto) });
    },
  };
  return falso;
}

let socket;
let cliente;

beforeEach(async () => {
  socket = socketFalso();
  cliente = crearCliente({ url: 'ws://prueba', crearSocket: () => socket });
  const conectando = cliente.conectar();
  socket.abrir();
  await conectando;
});

describe('conexion', () => {
  it('resuelve al abrirse y marca el estado', () => {
    expect(cliente.estado.conectado).toBe(true);
  });

  it('avisa cuando se cae', () => {
    let caido = false;
    cliente.on('cerrado', () => (caido = true));
    socket.close();
    expect(caido).toBe(true);
    expect(cliente.estado.conectado).toBe(false);
  });

  it('no manda nada si el socket no esta abierto', () => {
    socket.readyState = 3;
    expect(cliente.listo()).toBe(false);
  });
});

describe('entrar en la sala', () => {
  it('manda el codigo normalizado', () => {
    cliente.unir(' abcd ', 'Ana');
    expect(socket.enviados[0]).toEqual({
      v: VERSION,
      tipo: PIDE.unir,
      sala: 'ABCD',
      nombre: 'Ana',
    });
  });

  it('se reconoce a si mismo en la lista de la sala', () => {
    cliente.unir('ABCD', 'Ana');
    socket.recibir({
      v: VERSION,
      tipo: DICE.sala,
      codigo: 'ABCD',
      jugadores: [
        { id: 'x1', nombre: 'Bea', bando: 'a', listo: false },
        { id: 'x2', nombre: 'Ana', bando: 'b', listo: false },
      ],
    });

    expect(cliente.estado.yo).toBe('x2');
    expect(cliente.estado.jugadores).toHaveLength(2);
  });

  it('no se confunde si aun no ha dicho su nombre', () => {
    socket.recibir({
      v: VERSION,
      tipo: DICE.sala,
      codigo: 'ABCD',
      jugadores: [{ id: 'x1', nombre: 'Bea', bando: 'a', listo: false }],
    });
    expect(cliente.estado.yo).toBeNull();
  });

  it('guarda semilla y alineacion al empezar', () => {
    socket.recibir({
      v: VERSION,
      tipo: DICE.empezar,
      semilla: 'ABCD-xyz',
      alineacion: [{ id: 'x1', nombre: 'Ana', bando: 'a' }],
    });

    expect(cliente.estado.empezada).toBe(true);
    expect(cliente.estado.semilla).toBe('ABCD-xyz');
    expect(cliente.estado.alineacion).toHaveLength(1);
  });
});

describe('avisos', () => {
  it('reparte cada mensaje a quien lo escucha', () => {
    const recibidos = [];
    cliente.on(DICE.sala, (m) => recibidos.push(m.codigo));
    socket.recibir({ v: VERSION, tipo: DICE.sala, codigo: 'ABCD', jugadores: [] });
    expect(recibidos).toEqual(['ABCD']);
  });

  it('se puede dejar de escuchar', () => {
    let veces = 0;
    const quitar = cliente.on(DICE.sala, () => veces++);
    socket.recibir({ v: VERSION, tipo: DICE.sala, codigo: 'A', jugadores: [] });
    quitar();
    socket.recibir({ v: VERSION, tipo: DICE.sala, codigo: 'B', jugadores: [] });
    expect(veces).toBe(1);
  });

  it('un mensaje ilegible no rompe el cliente', () => {
    const errores = [];
    cliente.on(DICE.error, (m) => errores.push(m.motivo));
    socket.onmessage({ data: 'esto no es json' });
    expect(errores).toHaveLength(1);
    expect(cliente.estado.conectado).toBe(true);
  });

  it('deja pasar la desincronia para que la interfaz avise', () => {
    const avisos = [];
    cliente.on(DICE.desincronia, (m) => avisos.push(m.turno));
    socket.recibir({ v: VERSION, tipo: DICE.desincronia, turno: 4, huellas: [] });
    expect(avisos).toEqual([4]);
  });
});

describe('acciones de juego', () => {
  it('el disparo viaja como input sellado con su paso', () => {
    cliente.disparar(240, 45, 0.8);
    expect(socket.enviados[0]).toMatchObject({
      tipo: PIDE.input,
      paso: 240,
      accion: 'disparo',
      anguloDeg: 45,
      potencia: 0.8,
    });
  });

  it('la reaccion no lleva angulo ni potencia', () => {
    cliente.reaccionar(300, 'escudo');
    expect(socket.enviados[0]).toMatchObject({ tipo: PIDE.input, paso: 300, accion: 'escudo' });
    expect(socket.enviados[0].anguloDeg).toBeUndefined();
  });

  it('la huella se calcula aqui: por el cable van 4 bytes, no el terreno', () => {
    cliente.contrastar(3, { alturas: new Float64Array(1400), vidas: [100, 100], turno: 3 });
    const enviado = socket.enviados[0];
    expect(enviado.tipo).toBe(PIDE.checksum);
    expect(typeof enviado.huella).toBe('number');
    expect(JSON.stringify(enviado).length).toBeLessThan(120);
  });
});

describe('crear sala', () => {
  it('pide una sala por HTTP y devuelve el codigo', async () => {
    const conFetch = crearCliente({
      url: 'ws://prueba',
      crearSocket: () => socketFalso(),
      urlHttp: 'http://prueba',
      fetchImpl: async () => ({ ok: true, json: async () => ({ codigo: 'WXYZ' }) }),
    });
    expect(await conFetch.crearSala()).toBe('WXYZ');
  });

  it('avisa si el servidor no da sala', async () => {
    const conFetch = crearCliente({
      url: 'ws://prueba',
      crearSocket: () => socketFalso(),
      fetchImpl: async () => ({ ok: false }),
    });
    await expect(conFetch.crearSala()).rejects.toThrow(/no dio sala/);
  });
});
