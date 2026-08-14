import { describe, it, expect } from 'vitest';
import { resumirSala } from '../../src/ui/lobby.js';
import { crearTraductor } from '../../src/ui/i18n.js';

const t = crearTraductor('es');
const jugador = (id, bando, listo = false) => ({ id, nombre: id, bando, listo });

describe('que enseña la sala', () => {
  it('reparte a la gente en su bando', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a'), jugador('u2', 'b'), jugador('u3', 'a')] }, t);
    expect(r.porBando.a).toHaveLength(2);
    expect(r.porBando.b).toHaveLength(1);
  });

  it('con un solo jugador no se puede confirmar', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a')] }, t);
    expect(r.puedePulsarListo).toBe(false);
    expect(r.aviso).toBe(t('faltaRival'));
  });

  it('tampoco si estan todos en el mismo bando', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a'), jugador('u2', 'a')] }, t);
    expect(r.puedePulsarListo).toBe(false);
    expect(r.aviso).toBe(t('faltaRival'));
  });

  it('con los dos bandos ocupados ya se puede', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a'), jugador('u2', 'b')] }, t);
    expect(r.puedePulsarListo).toBe(true);
  });

  it('dice cuantos faltan por confirmar', () => {
    const r = resumirSala(
      { jugadores: [jugador('u1', 'a', true), jugador('u2', 'b'), jugador('u3', 'b')] },
      t
    );
    expect(r.aviso).toBe(t('faltanListos', { cuantos: 2 }));
  });

  it('cuando falta uno solo lo dice en singular', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a', true), jugador('u2', 'b')] }, t);
    expect(r.aviso).toBe('Falta 1 por confirmar');
  });

  it('cuando estan todos listos no queda nada que avisar', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a', true), jugador('u2', 'b', true)] }, t);
    expect(r.aviso).toBe('');
  });

  it('un 1 contra 3 es una sala valida', () => {
    const r = resumirSala(
      {
        jugadores: [
          jugador('u1', 'a', true),
          jugador('u2', 'a', true),
          jugador('u3', 'a', true),
          jugador('u4', 'b', true),
        ],
      },
      t
    );
    expect(r.puedePulsarListo).toBe(true);
    expect(r.aviso).toBe('');
  });
});

describe('quien soy yo', () => {
  it('sabe mi bando y si ya he confirmado', () => {
    const r = resumirSala(
      { jugadores: [jugador('u1', 'a', true), jugador('u2', 'b')], yo: 'u1' },
      t
    );
    expect(r.miBando).toBe('a');
    expect(r.yoListo).toBe(true);
  });

  it('aguanta no saber todavia quien soy', () => {
    const r = resumirSala({ jugadores: [jugador('u1', 'a')] }, t);
    expect(r.miBando).toBeNull();
    expect(r.yoListo).toBe(false);
  });

  it('una sala vacia no rompe nada', () => {
    const r = resumirSala({}, t);
    expect(r.porBando.a).toEqual([]);
    expect(r.puedePulsarListo).toBe(false);
  });
});

describe('el lobby no duplica las reglas del servidor', () => {
  it('solo evita ofrecer el boton cuando empezar es imposible', () => {
    // La decision de arrancar es del servidor. Si aqui se reimplantara la regla
    // completa, habria dos versiones de la verdad y acabarian discrepando.
    const casiListo = resumirSala(
      { jugadores: [jugador('u1', 'a'), jugador('u2', 'b')], yo: 'u1' },
      t
    );
    expect(casiListo.puedePulsarListo).toBe(true);
    expect(casiListo.yoListo).toBe(false);
  });
});
