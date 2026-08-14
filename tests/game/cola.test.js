import { describe, it, expect } from 'vitest';
import { crearCola } from '../../src/game/cola.js';

describe('la cola aplica cada input en su paso', () => {
  it('un input agendado solo sale en el paso que lleva escrito', () => {
    const cola = crearCola();
    cola.programar(250, { accion: 'escudo' });

    expect(cola.consumir(249)).toEqual([]);
    expect(cola.consumir(250)).toEqual([{ accion: 'escudo' }]);
    expect(cola.consumir(251)).toEqual([]);
  });

  it('el mismo paso puede llevar varios inputs, en orden de llegada', () => {
    const cola = crearCola();
    cola.programar(10, { accion: 'escudo', de: 'a1' });
    cola.programar(10, { accion: 'salto', de: 'b2' });

    expect(cola.consumir(10)).toEqual([
      { accion: 'escudo', de: 'a1' },
      { accion: 'salto', de: 'b2' },
    ]);
  });

  it('consumir vacia el paso: no se aplica dos veces', () => {
    const cola = crearCola();
    cola.programar(10, { accion: 'escudo' });
    expect(cola.consumir(10)).toHaveLength(1);
    expect(cola.consumir(10)).toEqual([]);
  });

  it('los pasos no consumidos siguen esperando', () => {
    const cola = crearCola();
    cola.programar(300, { accion: 'salto' });
    cola.consumir(10);
    cola.consumir(11);
    expect(cola.pendientes).toBe(1);
    expect(cola.consumir(300)).toHaveLength(1);
  });
});

describe('lo que llega tarde no se cuela', () => {
  it('un input para un paso ya consumido NO se aplica', () => {
    // Aplicarlo daria un resultado distinto al de quien lo consumio a tiempo:
    // es justo la divergencia que la cola existe para evitar.
    const cola = crearCola();
    cola.consumir(100);
    expect(cola.programar(90, { accion: 'escudo' })).toBe(false);
    expect(cola.consumir(90)).toEqual([]);
  });

  it('tampoco en el paso que se acaba de consumir', () => {
    const cola = crearCola();
    cola.consumir(100);
    expect(cola.programar(100, { accion: 'escudo' })).toBe(false);
  });

  it('se apunta como tardio para poder avisar en vez de romper en silencio', () => {
    const cola = crearCola();
    cola.consumir(100);
    cola.programar(90, { accion: 'escudo' });

    expect(cola.tardios).toHaveLength(1);
    expect(cola.tardios[0]).toMatchObject({ paso: 90, consumidoHasta: 100 });
  });

  it('la frontera no retrocede aunque se consuman pasos hacia atras', () => {
    const cola = crearCola();
    cola.consumir(100);
    cola.consumir(50);
    expect(cola.programar(80, { accion: 'salto' })).toBe(false);
  });

  it('rechaza pasos que no son pasos', () => {
    const cola = crearCola();
    expect(cola.programar(-1, {})).toBe(false);
    expect(cola.programar(1.5, {})).toBe(false);
    expect(cola.programar('diez', {})).toBe(false);
  });
});

describe('dos moviles con los mismos inputs hacen lo mismo', () => {
  it('el orden de llegada no cambia el orden de aplicacion', () => {
    // El de la izquierda recibe el disparo antes que la reaccion y el de la
    // derecha al reves, que es lo normal con latencias distintas. Como cada
    // input lleva su paso, los dos aplican lo mismo en el mismo momento.
    const izquierda = crearCola();
    const derecha = crearCola();

    izquierda.programar(10, { accion: 'disparo' });
    izquierda.programar(250, { accion: 'escudo' });

    derecha.programar(250, { accion: 'escudo' });
    derecha.programar(10, { accion: 'disparo' });

    const recorrer = (cola) => {
      const salida = [];
      for (let paso = 0; paso <= 300; paso++) {
        for (const input of cola.consumir(paso)) salida.push([paso, input.accion]);
      }
      return salida;
    };

    // Cada recorrido consume su cola, asi que se guardan antes de comparar.
    const aplicadoIzquierda = recorrer(izquierda);
    const aplicadoDerecha = recorrer(derecha);

    expect(aplicadoIzquierda).toEqual(aplicadoDerecha);
    expect(aplicadoIzquierda).toEqual([[10, 'disparo'], [250, 'escudo']]);
  });
});

describe('limpiar', () => {
  it('deja la cola como recien creada', () => {
    const cola = crearCola();
    cola.programar(10, {});
    cola.consumir(5);
    cola.limpiar();

    expect(cola.pendientes).toBe(0);
    expect(cola.tardios).toEqual([]);
    expect(cola.programar(1, { accion: 'disparo' })).toBe(true);
  });
});
