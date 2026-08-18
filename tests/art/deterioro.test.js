import { describe, it, expect } from 'vitest';
import { ensamblar } from '../../src/art/vehiculo/ensamblar.js';
import { HUMO_DESDE } from '../../src/art/vehiculo/deterioro.js';
import { CATALOGO } from '../../src/art/vehiculo/catalogo.js';
import { BANDOS } from '../../src/art/vehiculo/paleta.js';
import { media } from '../../src/art/vehiculo/fichas/media.js';

/**
 * El daño tiene que verse EN EL CAMPO, no solo en la barra del marcador.
 *
 * Antes un blindado con 4 puntos de vida se veia igual que uno recien salido de
 * fabrica: un impacto directo sonaba, sacudia la pantalla y no dejaba marca.
 */

const montar = () => ensamblar(media, BANDOS.a.base);

/**
 * El color por vertice del BLOQUE del casco, copiado.
 *
 * Se busca el mayor y no el primero: en el casco cuelgan tambien las ruedas y
 * los eslabones instanciados, que traen su propio color y no se tiznan.
 */
const colorDe = (v) => {
  let geo = null;
  v.casco.traverse((o) => {
    if (o.isInstancedMesh || !o.isMesh || !o.geometry.attributes.color) return;
    if (!geo || o.geometry.attributes.color.count > geo.attributes.color.count) geo = o.geometry;
  });
  return Float32Array.from(geo.attributes.color.array);
};

describe('deterioro del blindado', () => {
  it('entero no tiene ni una marca', () => {
    const v = montar();
    const fabrica = colorDe(v);
    v.deterioro.aplicar(1);
    expect(Array.from(colorDe(v))).toEqual(Array.from(fabrica));
  });

  it('tocado se tizna y descubre cicatrices', () => {
    const v = montar();
    const fabrica = colorDe(v);
    v.deterioro.aplicar(0.1);
    const tocado = colorDe(v);
    let distintos = 0;
    for (let i = 0; i < fabrica.length; i++) if (fabrica[i] !== tocado[i]) distintos++;
    expect(distintos).toBeGreaterThan(0);
  });

  it('el tizne crece con el daño', () => {
    const claro = montar();
    const oscuro = montar();
    claro.deterioro.aplicar(0.7);
    oscuro.deterioro.aplicar(0.1);
    const suma = (c) => c.reduce((a, b) => a + b, 0);
    expect(suma(colorDe(oscuro))).toBeLessThan(suma(colorDe(claro)));
  });

  it('recuperar vida devuelve el color de fabrica, sin acumular', () => {
    // Mezclando sobre lo ya mezclado, un vehiculo que se cura no vuelve a su
    // color: acaba negro a base de cuadros.
    const v = montar();
    const fabrica = colorDe(v);
    for (const vida of [0.6, 0.2, 0.05, 0.4, 1]) v.deterioro.aplicar(vida);
    const final = colorDe(v);
    for (let i = 0; i < fabrica.length; i++) expect(final[i]).toBeCloseTo(fabrica[i], 5);
  });

  it('humea por debajo del umbral, y nunca estando entero ni muerto', () => {
    const v = montar();
    expect(v.deterioro.aplicar(1)).toBe(false);
    expect(v.deterioro.aplicar(HUMO_DESDE + 0.01)).toBe(false);
    expect(v.deterioro.aplicar(HUMO_DESDE - 0.01)).toBe(true);
    // Muerto no humea: lo que humea es una maquina que todavia anda.
    expect(v.deterioro.aplicar(0)).toBe(false);
  });

  it('no cuesta ni una llamada de dibujo: las cicatrices van en el casco', () => {
    // Colgarlas de una malla aparte con `drawRange` sube el vehiculo de nueve
    // llamadas a diez y se lleva por delante el presupuesto de §7.
    const v = montar();
    let mallas = 0;
    v.casco.traverse((o) => o.isMesh && mallas++);
    v.arma.traverse((o) => o.isMesh && mallas++);
    expect(mallas).toBeLessThanOrEqual(9);
  });

  it.each(Object.entries(CATALOGO))('%s lo trae y responde a los quince', (_, ficha) => {
    const v = ensamblar(ficha, BANDOS.b.base);
    expect(v.deterioro).toBeTruthy();
    const fabrica = colorDe(v);
    v.deterioro.aplicar(0.05);
    const tocado = colorDe(v);
    let distintos = 0;
    for (let i = 0; i < fabrica.length; i++) if (fabrica[i] !== tocado[i]) distintos++;
    expect(distintos).toBeGreaterThan(0);
  });
});
