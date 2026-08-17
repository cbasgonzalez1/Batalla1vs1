import { describe, it, expect, beforeEach, vi } from 'vitest';
import { crearSincronia, indicesDe } from '../../src/net/sincronia.js';
import { crearPartida, avanzarTurno } from '../../src/game/roster.js';
import { ACCION, DICE, RETARDO_PASOS, VERSION } from '../../src/net/protocolo.js';

/** Cliente falso: registra lo enviado y deja inyectar lo que llega. */
function clienteFalso() {
  const oyentes = new Map();
  return {
    enviados: [],
    on(tipo, fn) {
      if (!oyentes.has(tipo)) oyentes.set(tipo, []);
      oyentes.get(tipo).push(fn);
    },
    recibir(m) {
      for (const fn of oyentes.get(m.tipo) ?? []) fn(m);
    },
    disparar(paso, anguloDeg, potencia, avance = 0) {
      this.enviados.push({ tipo: 'disparo', paso, anguloDeg, potencia, avance });
      return true;
    },
    reaccionar(paso, accion) {
      this.enviados.push({ tipo: 'reaccion', paso, accion });
      return true;
    },
  };
}

const partidaDe = (jugadores) => crearPartida({ jugadores, semilla: 'x' });

let cliente;
let sincronia;

beforeEach(() => {
  cliente = clienteFalso();
  sincronia = crearSincronia({ cliente });
});

describe('reparto de vehiculos', () => {
  it('el bando a ocupa los primeros indices y el b los siguientes', () => {
    const partida = partidaDe([
      { id: 'a1', bando: 'a' },
      { id: 'b1', bando: 'b' },
      { id: 'a2', bando: 'a' },
      { id: 'b2', bando: 'b' },
    ]);
    const indices = indicesDe(partida);
    expect(indices.get('a1')).toBe(0);
    expect(indices.get('a2')).toBe(1);
    expect(indices.get('b1')).toBe(2);
    expect(indices.get('b2')).toBe(3);
  });

  it('sale de la alineacion, no de quien llego antes a cada pantalla', () => {
    const jugadores = [{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }];
    expect([...indicesDe(partidaDe(jugadores))]).toEqual([...indicesDe(partidaDe(jugadores))]);
  });
});

describe('de quien es el turno', () => {
  it('en local siempre me toca: es como jugaba hasta ahora', () => {
    expect(sincronia.meToca()).toBe(true);
  });

  it('en red solo cuando el activo soy yo', () => {
    const partida = partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]);
    sincronia.empezar(partida, 'b1');
    expect(sincronia.meToca()).toBe(false);

    avanzarTurno(partida);
    expect(sincronia.meToca()).toBe(true);
  });

  it('el indice activo sigue la rotacion', () => {
    const partida = partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]);
    sincronia.empezar(partida, 'a1');
    expect(sincronia.indiceActivo()).toBe(0);
    avanzarTurno(partida);
    expect(sincronia.indiceActivo()).toBe(1);
  });
});

describe('el disparo', () => {
  beforeEach(() => {
    sincronia.empezar(partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]), 'a1');
  });

  it('sale por el cable y NO se aplica en el sitio', () => {
    // El que dispara ve lo mismo que los demas: espera al eco del servidor. Un
    // caso especial para el emisor escondería las desincronias en vez de
    // enseñarlas.
    const aplicar = vi.fn();
    sincronia.alDisparo(aplicar);

    sincronia.disparar(45, 0.8);
    expect(cliente.enviados[0]).toMatchObject({ tipo: 'disparo', anguloDeg: 45, potencia: 0.8 });
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('se aplica cuando vuelve del servidor', () => {
    const aplicar = vi.fn();
    sincronia.alDisparo(aplicar);

    sincronia.disparar(45, 0.8);
    cliente.recibir({ v: VERSION, tipo: DICE.input, de: 'a1', accion: ACCION.disparo, anguloDeg: 45, potencia: 0.8 });

    expect(aplicar).toHaveBeenCalledWith({ de: 'a1', anguloDeg: 45, potencia: 0.8, avance: 0 });
  });

  it('el dedo insistente no dispara dos veces', () => {
    sincronia.disparar(45, 0.8);
    sincronia.disparar(45, 0.8);
    expect(cliente.enviados).toHaveLength(1);
  });

  it('vuelve a admitir disparo tras el eco', () => {
    sincronia.disparar(45, 0.8);
    cliente.recibir({ v: VERSION, tipo: DICE.input, de: 'a1', accion: ACCION.disparo, anguloDeg: 45, potencia: 0.8 });
    expect(sincronia.disparar(30, 0.5)).toBe(true);
  });

  it('el disparo no lleva paso: es lo que abre el turno', () => {
    sincronia.disparar(45, 0.8);
    expect(cliente.enviados[0].paso).toBe(0);
  });
});

describe('la reaccion', () => {
  beforeEach(() => {
    sincronia.empezar(partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]), 'b1');
  });

  it('se agenda con margen por delante del paso actual', () => {
    sincronia.reaccionar(ACCION.escudo, 250);
    expect(cliente.enviados[0]).toMatchObject({
      tipo: 'reaccion',
      accion: ACCION.escudo,
      paso: 250 + RETARDO_PASOS,
    });
  });

  it('espera a su paso de vuelo para aplicarse', () => {
    cliente.recibir({ v: VERSION, tipo: DICE.input, de: 'b1', accion: ACCION.escudo, paso: 280 });

    expect(sincronia.consumir(279)).toEqual([]);
    expect(sincronia.consumir(280)).toHaveLength(1);
  });

  it('dos moviles desfasados la aplican en el MISMO paso de vuelo', () => {
    // Es el punto de todo el diseño: el paso va contra los pasos de vuelo, que
    // son deterministas, y no contra un reloj que cada movil lleva por su lado.
    const otro = crearSincronia({ cliente: clienteFalso() });
    otro.empezar(partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]), 'a1');

    const mensaje = { v: VERSION, tipo: DICE.input, de: 'b1', accion: ACCION.escudo, paso: 280 };
    cliente.recibir(mensaje);

    const recorrer = (s) => {
      const aplicados = [];
      for (let paso = 0; paso <= 400; paso++) {
        for (const m of s.consumir(paso)) aplicados.push(paso);
      }
      return aplicados;
    };

    expect(recorrer(sincronia)).toEqual([280]);
  });

  it('lo que llega tarde no se aplica, pero queda apuntado', () => {
    sincronia.consumir(300);
    cliente.recibir({ v: VERSION, tipo: DICE.input, de: 'b1', accion: ACCION.escudo, paso: 280 });

    expect(sincronia.consumir(280)).toEqual([]);
    expect(sincronia.tardios).toHaveLength(1);
  });
});

describe('modo local', () => {
  it('sin red no se manda nada y no se agenda nada', () => {
    expect(sincronia.disparar(45, 0.8)).toBe(false);
    expect(sincronia.consumir(10)).toEqual([]);
    expect(cliente.enviados).toHaveLength(0);
  });

  it('parar devuelve al modo local', () => {
    sincronia.empezar(partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]), 'b1');
    expect(sincronia.meToca()).toBe(false);
    sincronia.parar();
    expect(sincronia.meToca()).toBe(true);
  });
});

describe('el avance viaja con el disparo', () => {
  /**
   * El movimiento no es un mensaje aparte: es un numero mas del disparo.
   * Mandarlo suelto —o peor, uno por cada paso de oruga— seria cable para nada
   * y ademas abriria la puerta a que llegue en otro orden.
   */
  beforeEach(() => {
    sincronia.empezar(partidaDe([{ id: 'a1', bando: 'a' }, { id: 'b1', bando: 'b' }]), 'a1');
  });

  it('se manda junto al angulo y la potencia', () => {
    sincronia.disparar(45, 0.8, -6.25);
    expect(cliente.enviados[0]).toMatchObject({ anguloDeg: 45, potencia: 0.8, avance: -6.25 });
  });

  it('llega al que lo aplica', () => {
    const aplicar = vi.fn();
    sincronia.alDisparo(aplicar);
    sincronia.disparar(45, 0.8, 3.5);
    cliente.recibir({
      v: VERSION, tipo: DICE.input, de: 'a1',
      accion: ACCION.disparo, anguloDeg: 45, potencia: 0.8, avance: 3.5,
    });
    expect(aplicar).toHaveBeenCalledWith({ de: 'a1', anguloDeg: 45, potencia: 0.8, avance: 3.5 });
  });

  it('un disparo viejo sin avance se lee como cero', () => {
    const aplicar = vi.fn();
    sincronia.alDisparo(aplicar);
    cliente.recibir({
      v: VERSION, tipo: DICE.input, de: 'a1',
      accion: ACCION.disparo, anguloDeg: 45, potencia: 0.8,
    });
    expect(aplicar).toHaveBeenCalledWith({ de: 'a1', anguloDeg: 45, potencia: 0.8, avance: 0 });
  });
});
