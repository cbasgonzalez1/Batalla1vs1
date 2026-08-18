import { describe, it, expect } from 'vitest';
import { crearReserva, llano, cola } from '../../src/art/decorado/colocar.js';
import { FAMILIAS } from '../../src/art/decorado/piezas.js';
import { ANCHO_HITO } from '../../src/art/decorado/hitos.js';
import { tonosDe, mezcla, TINTE } from '../../src/art/decorado/paleta.js';
import { BIOMES } from '../../src/art/direction.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

/**
 * Las tres reglas de colocacion de `docs/ESCENARIOS.md` §0, ejecutables.
 *
 * Las tres estaban rotas y producian un campo «mal disenado» por mucho que cada
 * pieza suelta estuviera bien resuelta. Escritas solo en un .md se vuelven a
 * romper sin que nadie lo note.
 */

describe('nada se solapa (§0.1)', () => {
  it('un tramo ocupado deja de estar libre', () => {
    const r = crearReserva(-50, 50);
    r.ocupar(0, 10);
    expect(r.libres(0)).toEqual([[-50, -5], [5, 50]]);
  });

  it('una pieza que no cabe NO se coloca', () => {
    const r = crearReserva(-10, 10);
    r.ocupar(0, 19.4);
    expect(r.colocar(6, () => 0.5)).toBe(null);
  });

  it('cien piezas colocadas por el registro no se pisan ni una vez', () => {
    const rng = mulberry32(hashSeed('campo'));
    const r = crearReserva(-70, 70);
    const puestas = [];
    for (let i = 0; i < 100; i++) {
      const ancho = 1.2 + (i % 5);
      const x = r.colocar(ancho, rng, 0.45);
      if (x === null) continue;
      r.ocupar(x, ancho);
      for (const p of puestas) {
        expect(Math.abs(p.x - x)).toBeGreaterThanOrEqual((p.ancho + ancho) / 2 - 1e-9);
      }
      puestas.push({ x, ancho });
    }
    expect(puestas.length).toBeGreaterThan(15);
  });

  it('reparte por huecos reales y no se amontona en el mayor', () => {
    // Probar a los lados de una x pedida y rendirse a las cinco unidades deja el
    // campo vacio: con dos emplazamientos y un hito reservados, casi todo lo
    // sorteado cae dentro de algo ocupado.
    const rng = mulberry32(hashSeed('huecos'));
    const r = crearReserva(-70, 70);
    r.ocupar(-44, 7);
    r.ocupar(44, 7);
    r.ocupar(20, 11);
    let colocadas = 0;
    for (let i = 0; i < 20; i++) {
      const x = r.colocar(3, rng, 0.45);
      if (x === null) break;
      r.ocupar(x, 3);
      colocadas++;
    }
    expect(colocadas).toBeGreaterThan(12);
  });
});

describe('lo ancho busca terreno llano (§0.2 bis)', () => {
  it('elige el tramo de menor desnivel bajo la huella', () => {
    // Vaguada honda en x = 0 y meseta a la derecha.
    const suelo = (x) => (Math.abs(x) < 4 ? Math.abs(x) - 4 : 0);
    const x = llano(suelo, -6, 12, 5);
    let alto = -Infinity;
    let bajo = Infinity;
    for (let u = x - 2.5; u <= x + 2.5; u += 0.25) {
      alto = Math.max(alto, suelo(u));
      bajo = Math.min(bajo, suelo(u));
    }
    expect(alto - bajo).toBeLessThan(0.6);
  });

  it('una pieza ancha no cae a caballo de la vaguada', () => {
    const suelo = (x) => (Math.abs(x) < 4 ? Math.abs(x) - 4 : 0);
    const r = crearReserva(-20, 20);
    const x = r.colocar(6, () => 0.5, 0.45, suelo);
    expect(Math.abs(x)).toBeGreaterThan(2);
  });
});

describe('se coloca de mayor a menor (§0.3)', () => {
  it('la cola sale ordenada por ancho descendente', () => {
    const q = cola(['cajas', 'tranvia', 'muro'], FAMILIAS, 1);
    for (let i = 1; i < q.length; i++) {
      expect(q[i].ancho).toBeLessThanOrEqual(q[i - 1].ancho);
    }
    expect(q[0].id).toBe('tranvia');
  });

  it('respeta las veces de cada familia', () => {
    const q = cola(['muro'], FAMILIAS, 1);
    expect(q.length).toBe(FAMILIAS.muro.veces);
  });

  it('la densidad reparte la misma densidad de la plancha por un campo mayor', () => {
    // La plancha encuadra 38 unidades y el campo tiene 140: sin esto quedan
    // nueve piezas perdidas en todo el mapa.
    expect(cola(['muro'], FAMILIAS, 3).length).toBe(FAMILIAS.muro.veces * 3);
  });

  it('una familia que el teatro no declara no aparece', () => {
    expect(cola(['tranvia'], FAMILIAS, 1).some((f) => f.id === 'erizo')).toBe(false);
  });

  it('un id que no existe se ignora en vez de reventar', () => {
    expect(cola(['inventada'], FAMILIAS, 1)).toEqual([]);
  });
});

describe('el catalogo de familias', () => {
  it('es el de la tabla de ESCENARIOS §3, con sus anchos', () => {
    expect(FAMILIAS.tranvia.ancho).toBe(5.0);
    expect(FAMILIAS.via.ancho).toBe(7.0);
    expect(FAMILIAS.alambrada.ancho).toBe(6.6);
    expect(FAMILIAS.escombro.ancho).toBe(3.2);
    expect(FAMILIAS.muro.ancho).toBe(2.6);
    expect(FAMILIAS.poste.ancho).toBe(1.2);
  });

  it.each(Object.entries(FAMILIAS))('%s declara ancho, veces y constructor', (_, f) => {
    expect(f.ancho).toBeGreaterThan(0);
    expect(f.veces).toBeGreaterThan(0);
    expect(typeof f.construir).toBe('function');
  });
});

describe('los dieciseis teatros declaran su decorado', () => {
  it.each(Object.entries(BIOMES))('%s trae props y todas existen', (_, b) => {
    expect(Array.isArray(b.props)).toBe(true);
    expect(b.props.length).toBeGreaterThan(0);
    // `sacos` va aparte —es automatico, uno delante de cada canon— asi que es el
    // unico id de la tabla que no esta en el catalogo de familias colocables.
    for (const id of b.props) {
      expect(id === 'sacos' || Boolean(FAMILIAS[id])).toBe(true);
    }
  });

  it.each(Object.entries(BIOMES))('%s lleva escombro, que va en las dieciseis', (_, b) => {
    expect(b.props).toContain('escombro');
  });

  it.each(Object.entries(BIOMES))('%s tiene un hito con ancho reservado', (_, b) => {
    expect(ANCHO_HITO[b.hito]).toBeGreaterThan(0);
  });

  it('los nueve hitos, y ninguno mas', () => {
    expect(Object.keys(ANCHO_HITO).length).toBe(9);
  });
});

describe('el tinte de teatro (§2)', () => {
  it('es 0,35 hacia el cuerpo del terreno', () => {
    expect(TINTE).toBe(0.35);
  });

  it('la misma materia sale distinta en dos ciudades', () => {
    // Una viga de madera igual en Ypres y en Dresde no pertenece a ninguno.
    const a = tonosDe(BIOMES.ypres);
    const b = tonosDe(BIOMES.dresde);
    expect(a.madera).not.toBe(b.madera);
    expect(a.metal).not.toBe(b.metal);
  });

  it('la fabrica se tine menos que la materia', () => {
    // Es el rasgo que separa Varsovia de Caen: a 0,35 las dieciseis se acercan.
    const t = tonosDe(BIOMES.varsovia39);
    expect(t.fabrica).toBe(mezcla(BIOMES.varsovia39.fabrica, BIOMES.varsovia39.body, 0.22));
  });

  it('mezcla al cero y al uno devuelve los extremos', () => {
    expect(mezcla(0x102030, 0xa0b0c0, 0)).toBe(0x102030);
    expect(mezcla(0x102030, 0xa0b0c0, 1)).toBe(0xa0b0c0);
  });
});
