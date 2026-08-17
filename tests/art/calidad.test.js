import { describe, it, expect } from 'vitest';
import { crearCalidad, NIVELES, AJUSTES } from '../../src/art/calidad.js';

/**
 * Lo que se prueba aqui no es que baje la calidad: es que no OSCILE.
 *
 * Un ajuste automatico mal puesto es peor que ninguno — la pantalla cambiando
 * de nitidez cada segundo se nota mucho mas que jugar siempre un poco borroso.
 */

function banco({ fijo = null } = {}) {
  const aplicados = [];
  const c = crearCalidad({ fijo, aplicar: (n) => aplicados.push(n.nombre) });
  return {
    calidad: c,
    aplicados,
    /** Le da `n` cuadros seguidos de `ms`. */
    correr(ms, n) {
      for (let i = 0; i < n; i++) c.cuadro(ms);
      return c.nivel.nombre;
    },
  };
}

const LENTO = AJUSTES.bajarMs + 10;
const RAPIDO = AJUSTES.subirMs - 3;
const CALENTAR = AJUSTES.calentamiento + 1;

describe('arranque', () => {
  it('empieza en la mejor calidad', () => {
    expect(banco().calidad.nivel.nombre).toBe('alta');
  });

  it('aplica el nivel de entrada, no espera al primer cuadro', () => {
    expect(banco().aplicados).toEqual(['alta']);
  });

  it('no juzga los primeros cuadros', () => {
    // Ahi se compilan shaders y se suben texturas: medir eso dejaria a todo el
    // mundo en calidad minima antes de ver el primer disparo.
    const b = banco();
    expect(b.correr(200, AJUSTES.calentamiento)).toBe('alta');
  });
});

describe('bajar', () => {
  it('baja un escalon tras una racha de cuadros lentos', () => {
    const b = banco();
    b.correr(16, CALENTAR);
    expect(b.correr(LENTO, AJUSTES.cuadrosParaBajar)).toBe('media');
  });

  it('un cuadro lento suelto no cambia nada', () => {
    const b = banco();
    b.correr(16, CALENTAR);
    b.calidad.cuadro(LENTO);
    b.correr(16, 50);
    expect(b.calidad.nivel.nombre).toBe('alta');
  });

  it('si sigue sin caber, sigue bajando', () => {
    const b = banco();
    b.correr(16, CALENTAR);
    expect(b.correr(LENTO, AJUSTES.cuadrosParaBajar)).toBe('media');
    expect(b.correr(LENTO, AJUSTES.cuadrosParaBajar)).toBe('baja');
  });

  it('no baja mas alla del ultimo nivel', () => {
    const b = banco();
    b.correr(16, CALENTAR);
    expect(b.correr(LENTO, AJUSTES.cuadrosParaBajar * 20)).toBe(NIVELES.at(-1).nombre);
  });

  it('el nivel minimo apaga las sombras', () => {
    expect(NIVELES.at(-1).sombras).toBe(0);
  });
});

describe('subir', () => {
  it('cuesta diez veces mas que bajar', () => {
    expect(AJUSTES.cuadrosParaSubir).toBeGreaterThanOrEqual(AJUSTES.cuadrosParaBajar * 10);
  });

  it('sube si sobra margen de verdad', () => {
    const b = banco();
    b.correr(16, CALENTAR);
    b.correr(LENTO, AJUSTES.cuadrosParaBajar);
    expect(b.correr(RAPIDO, AJUSTES.cuadrosParaSubir)).toBe('alta');
  });

  it('no sube por cuadros que solo caben justos', () => {
    // Entre los dos umbrales hay zona muerta: 16 ms cabe, pero no sobra tanto
    // como para arriesgarse a volver a subir.
    const b = banco();
    b.correr(16, CALENTAR);
    b.correr(LENTO, AJUSTES.cuadrosParaBajar);
    expect(b.correr(16, AJUSTES.cuadrosParaSubir * 2)).toBe('media');
  });

  it('deja de subir despues de unas cuantas veces', () => {
    // Un juego que va justo se pasaria la partida subiendo y bajando.
    const b = banco();
    b.correr(16, CALENTAR);
    for (let i = 0; i <= AJUSTES.subidasMaximas + 2; i++) {
      b.correr(LENTO, AJUSTES.cuadrosParaBajar);
      b.correr(RAPIDO, AJUSTES.cuadrosParaSubir);
    }
    // Se cuentan solo las SUBIDAS: cada vez que el nivel aplicado es mejor
    // que el anterior.
    const orden = NIVELES.map((n) => n.nombre);
    let subidas = 0;
    for (let i = 1; i < b.aplicados.length; i++) {
      if (orden.indexOf(b.aplicados[i]) < orden.indexOf(b.aplicados[i - 1])) subidas++;
    }
    expect(subidas).toBe(AJUSTES.subidasMaximas);
  });
});

describe('cuadros que no cuentan', () => {
  it('un paron largo no es coste de dibujo', () => {
    // Cambiar de aplicacion en el movil deja un cuadro de dos segundos. Si eso
    // contara, volver al juego lo encontrarias en calidad minima.
    const b = banco();
    b.correr(16, CALENTAR);
    expect(b.correr(AJUSTES.ignorarMs + 500, AJUSTES.cuadrosParaBajar * 3)).toBe('alta');
  });

  it('un valor sin sentido no rompe nada', () => {
    const b = banco();
    b.correr(16, CALENTAR);
    b.calidad.cuadro(NaN);
    b.calidad.cuadro(Infinity);
    expect(b.calidad.nivel.nombre).toBe('alta');
  });
});

describe('nivel clavado a mano', () => {
  it('arranca en el que se le pide', () => {
    expect(banco({ fijo: 'baja' }).calidad.nivel.nombre).toBe('baja');
  });

  it('y no lo cambia por muy lento que vaya', () => {
    const b = banco({ fijo: 'baja' });
    expect(b.correr(500, 5000)).toBe('baja');
    expect(b.aplicados).toEqual(['baja']);
  });

  it('un nombre que no existe cae en la mejor calidad', () => {
    expect(banco({ fijo: 'ultra' }).calidad.nivel.nombre).toBe('alta');
  });

  it('se sabe si esta en automatico', () => {
    expect(banco().calidad.automatico).toBe(true);
    expect(banco({ fijo: 'media' }).calidad.automatico).toBe(false);
  });
});

describe('los niveles estan ordenados', () => {
  it('cada uno pinta menos pixeles que el anterior', () => {
    for (let i = 1; i < NIVELES.length; i++) {
      expect(NIVELES[i].pixeles).toBeLessThan(NIVELES[i - 1].pixeles);
    }
  });

  it('y la sombra nunca sube al bajar de nivel', () => {
    for (let i = 1; i < NIVELES.length; i++) {
      expect(NIVELES[i].sombras).toBeLessThanOrEqual(NIVELES[i - 1].sombras);
    }
  });
});
