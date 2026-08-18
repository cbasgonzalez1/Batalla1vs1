import { describe, it, expect } from 'vitest';
import { tono, claro, camuflaje, oscuro, contorno, BANDOS } from '../../src/art/vehiculo/paleta.js';
import { materialRelleno, gradienteToon, materialContorno, actualizarContorno } from '../../src/art/vehiculo/toon.js';
import { ensamblar, ESCALA, PIVOTE, Y_PIVOTE } from '../../src/art/vehiculo/ensamblar.js';
import { media } from '../../src/art/vehiculo/fichas/media.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0').toUpperCase()}`;

/**
 * Los valores de la paleta, escritos LITERALES.
 *
 * Salen de muestrear la imagen de referencia aprobada. Escritos aqui, cambiar
 * un factor «para que se vea mejor» sale en rojo en vez de colarse
 * (docs/CHECKLIST-REVISION.md §1).
 */
describe('la paleta reproduce la referencia medida', () => {
  const base = BANDOS.a.base;

  it('el bando oliva es el casco medido', () => {
    expect(hex(base)).toBe('#7D8B4E');
  });

  // Entre parentesis, el hex muestreado en la referencia. `tono()` no lo clava
  // al byte porque trabaja en HSL con un factor, que es lo que hace que anadir
  // un bando sea una linea; la diferencia es de uno a tres puntos por canal y a
  // ojo no existe. Lo que se congela aqui es lo que produce el FACTOR.
  it.each([
    ['banda clara      (medido #96A560)', claro, '#99A965'],
    ['mancha camuflaje (medido #6B7A41)', camuflaje, '#6D7944'],
    ['banda oscura     (medido #5E6A38)', oscuro, '#5F6A3B'],
    ['contorno         (medido #2B3419)', contorno, '#2C311B'],
  ])('%s', (_, fn, esperado) => {
    expect(hex(fn(base))).toBe(esperado);
  });

  it('oscurece en HSL, no en RGB: el tono no se va al marron', () => {
    // En RGB, oscurecer un oliva lo manda al marron y los quince dejarian de
    // ser familia. Comprobado por el canal verde, que tiene que seguir mandando.
    const c = oscuro(base);
    const [r, g, b] = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('un tercer bando es una linea: todo se calcula del base', () => {
    expect(contorno(BANDOS.b.base)).not.toBe(contorno(BANDOS.a.base));
  });
});

describe('sombreado de bandas', () => {
  it('la rampa es de tres paradas y sin interpolar', () => {
    const g = gradienteToon();
    expect(g.image.width).toBe(3);
    expect(g.magFilter).toBe(1003); // THREE.NearestFilter
  });

  it('la rampa no empieza en cero: la banda oscura no puede salir negra', () => {
    // `MeshToonMaterial` MULTIPLICA por la rampa. Con 0 en la primera parada,
    // el tercio en sombra de todos los vehiculos seria negro puro.
    expect(gradienteToon().image.data[0]).toBeGreaterThan(120);
  });

  it('hay UN solo material de relleno en todo el juego', () => {
    expect(materialRelleno()).toBe(materialRelleno());
  });

  it('el contorno se mide en pixeles, no en unidades de mundo', () => {
    const mat = materialContorno(3);
    const camara = { top: 10, bottom: -10, zoom: 1 };
    actualizarContorno(camara, 1000);
    const fino = mat.uniforms.uUnidadesPorPixel.value;
    // Al acercarse (mas zoom) un pixel vale MENOS mundo, asi que el shell se
    // engorda menos: es lo que mantiene el trazo constante en pantalla.
    actualizarContorno({ ...camara, zoom: 2 }, 1000);
    expect(mat.uniforms.uUnidadesPorPixel.value).toBeLessThan(fino);
  });
});

describe('la MEDIA, montada', () => {
  const v = ensamblar(media, BANDOS.a.base);

  const mallas = (g) => {
    let n = 0;
    g.traverse((o) => o.isMesh && n++);
    return n;
  };

  it('cabe en el presupuesto de llamadas de dibujo', () => {
    // Nueve y no ocho: el tubo va en su propio bloque porque retrocede solo
    // (`ARTE.md` §14) y no puede fundirse con la torreta.
    expect(mallas(v.casco) + mallas(v.arma)).toBeLessThanOrEqual(9);
  });

  it('las ruedas y los eslabones van instanciados', () => {
    const instanciados = [];
    v.casco.traverse((o) => o.isInstancedMesh && instanciados.push(o.count));
    expect(instanciados.length).toBe(2);
    expect(instanciados[0]).toBe(media.rodaje.ruedas * 2);
    expect(instanciados[1]).toBe(media.rodaje.eslabones * 2);
  });

  it('la escala mantiene el pivote donde el juego lo tenia', () => {
    expect(Y_PIVOTE * ESCALA).toBeCloseTo(PIVOTE.y, 10);
  });

  it('lleva su sombra de contacto', () => {
    let sombra = false;
    v.casco.traverse((o) => {
      if (o.isMesh && o.material.transparent) sombra = true;
    });
    expect(sombra).toBe(true);
  });

  it('cada bloque lleva su color de contorno por vertice', () => {
    let conContorno = 0, total = 0;
    for (const g of [v.casco, v.arma]) {
      g.traverse((o) => {
        if (!o.isMesh || o.material.transparent) return;
        total++;
        if (o.geometry.attributes.contorno) conContorno++;
      });
    }
    expect(conContorno).toBe(total);
  });
});
