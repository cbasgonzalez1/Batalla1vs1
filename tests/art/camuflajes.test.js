import { describe, it, expect } from 'vitest';
import {
  CAMUFLAJES, BANDAS, DE_SERIE, aHsl, enBanda, colorDe, camuflaje, deBando,
} from '../../src/art/vehiculo/camuflajes.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BANDOS } from '../../src/art/vehiculo/paleta.js';

/**
 * La banda de color de cada bando, ejecutable.
 *
 * El bando se distingue POR EL COLOR DEL CASCO y por nada mas
 * (`docs/ARTE-VEHICULOS.md` §6). Un camuflaje premium que acerque el A al B
 * rompe la lectura de la partida, y eso no se arregla con una etiqueta en el
 * HUD. Escrito solo en un .md, esto se incumple el dia que alguien quiera vender
 * un blanco invierno.
 */

describe('el catalogo de camuflajes', () => {
  it.each(CAMUFLAJES)('$id cae dentro de la banda de su bando', (c) => {
    expect(enBanda(c.base, c.bando)).toBe(true);
  });

  it('las dos bandas no se tocan', () => {
    // Setenta grados de separacion a cada lado: es lo que sostiene la lectura a
    // 0,55x de zoom.
    expect(BANDAS.b.tono[0] - BANDAS.a.tono[1]).toBeGreaterThanOrEqual(70);
  });

  it('un color del otro bando NO pasa la banda', () => {
    expect(enBanda(BANDOS.b.base, 'a')).toBe(false);
    expect(enBanda(BANDOS.a.base, 'b')).toBe(false);
  });

  it('un blanco invierno no se cuela por las bravas', () => {
    // El caso que provoco escribir la banda: es bonito y rompe el juego.
    expect(enBanda(0xf0f4f6, 'b')).toBe(false);
  });

  it('los ids no se repiten', () => {
    const ids = CAMUFLAJES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hay exactamente uno de serie por bando, y son los aprobados', () => {
    expect(DE_SERIE).toEqual(['a-oliva', 'b-acero']);
    expect(camuflaje('a-oliva').base).toBe(BANDOS.a.base);
    expect(camuflaje('b-acero').base).toBe(BANDOS.b.base);
  });

  it('todo lo que no es de serie tiene precio', () => {
    for (const c of CAMUFLAJES) {
      if (DE_SERIE.includes(c.id)) expect(c.centimos).toBe(0);
      else expect(c.centimos).toBeGreaterThan(0);
    }
  });

  it('cada bando tiene catalogo propio', () => {
    expect(deBando('a').every((c) => c.bando === 'a')).toBe(true);
    expect(deBando('a').length).toBeGreaterThan(1);
    expect(deBando('b').length).toBeGreaterThan(1);
  });
});

describe('colorDe nunca falla', () => {
  it('devuelve el color del camuflaje', () => {
    expect(colorDe('a-bosque')).toBe(camuflaje('a-bosque').base);
  });

  it('un camuflaje desconocido cae en el color del bando', () => {
    // Un cliente viejo que reciba un camuflaje que no conoce pinta el base de su
    // bando y sigue jugando: un cosmetico no puede impedir una partida.
    expect(colorDe('a-inventado', 'b')).toBe(BANDOS.b.base);
    expect(colorDe(undefined, 'a')).toBe(BANDOS.a.base);
    expect(colorDe(null, 'zzz')).toBe(BANDOS.a.base);
  });
});

describe('aHsl', () => {
  it('mide el ejemplar aprobado del bando A', () => {
    const { tono, saturacion, luz } = aHsl(0x7d8b4e);
    expect(Math.round(tono)).toBe(74);
    expect(Math.round(saturacion)).toBe(28);
    expect(Math.round(luz)).toBe(43);
  });

  it('un gris no tiene tono ni saturacion', () => {
    expect(aHsl(0x808080)).toEqual({ tono: 0, saturacion: 0, luz: expect.closeTo(50.2, 1) });
  });
});


describe('el catalogo lo lee tambien el servidor', () => {
  const leer = (f) =>
    readFileSync(fileURLToPath(new URL(`../../src/art/vehiculo/${f}`, import.meta.url)), 'utf8');

  it('camuflajes.js solo importa paleta.js', () => {
    // El Dockerfile de produccion copia EXACTAMENTE estos dos ficheros de
    // `src/art` porque el servidor siembra la tienda con ellos. Si este modulo
    // empieza a importar otra cosa —Three, una primitiva—, la imagen de
    // produccion revienta al arrancar y no lo ve nadie hasta el despliegue.
    const importa = [...leer('camuflajes.js').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(importa).toEqual(['./paleta.js']);
  });

  it('paleta.js no importa nada', () => {
    expect(/^\s*import\s/m.test(leer('paleta.js'))).toBe(false);
  });
});
