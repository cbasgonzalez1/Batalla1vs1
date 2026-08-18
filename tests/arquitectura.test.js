import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * La frontera de capas que declara AGENTS.md, ejecutable.
 *
 * Una regla escrita en un fichero de texto se incumple en silencio: `game/` ya
 * importaba Three y `ui/` vivia dentro de `game/` sin que nadie lo notara.
 * Escrita aqui, el incumplimiento sale en rojo.
 *
 * Direccion permitida:  core  <-  game  <-  world / art / ui  <-  main.js
 */

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

function ficherosDe(dir) {
  let salida = [];
  for (const entrada of readdirSync(join(SRC, dir), { withFileTypes: true })) {
    const ruta = join(SRC, dir, entrada.name);
    if (entrada.isDirectory()) salida = salida.concat(ficherosDe(join(dir, entrada.name)));
    else if (entrada.name.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}

const leer = (f) => ({ ruta: relative(SRC, f), texto: readFileSync(f, 'utf8') });

const importaThree = (t) => /from\s+['"]three['"]/.test(t);
const tocaDom = (t) => /\b(document|window)\s*\.|addEventListener\s*\(/.test(t);

describe('el nucleo se mantiene puro', () => {
  const nucleo = ficherosDe('core').map(leer);

  it('hay ficheros en core que comprobar', () => {
    expect(nucleo.length).toBeGreaterThan(0);
  });

  it.each(nucleo)('core/$ruta no importa Three', ({ texto }) => {
    expect(importaThree(texto)).toBe(false);
  });

  it.each(nucleo)('core/$ruta no toca el DOM', ({ texto }) => {
    expect(tocaDom(texto)).toBe(false);
  });

  it.each(nucleo)('core/$ruta no depende de ninguna otra capa', ({ texto }) => {
    // core es la capa de dentro: solo puede mirarse a si misma.
    const importaFuera = /from\s+['"]\.\.\//.test(texto);
    expect(importaFuera).toBe(false);
  });
});

describe('la simulacion no conoce la presentacion', () => {
  const simulacion = ficherosDe('game').map(leer);

  it('hay ficheros en game que comprobar', () => {
    expect(simulacion.length).toBeGreaterThan(0);
  });

  it.each(simulacion)('game/$ruta no importa Three', ({ texto }) => {
    expect(importaThree(texto)).toBe(false);
  });

  it.each(simulacion)('game/$ruta no toca el DOM', ({ texto }) => {
    expect(tocaDom(texto)).toBe(false);
  });

  it.each(simulacion)('game/$ruta no importa de world, art ni ui', ({ texto }) => {
    expect(/from\s+['"]\.\.\/(world|art|ui)\//.test(texto)).toBe(false);
  });
});

describe('una ficha de catalogo es un objeto de numeros', () => {
  const fichas = ficherosDe(join('art', 'vehiculo', 'fichas')).map(leer);

  it('hay fichas que comprobar', () => {
    expect(fichas.length).toBeGreaterThan(0);
  });

  // Si una ficha importa Three deja de poder probarse sin escena, y en cuanto
  // pueda modelar geometria a pelo los quince dejan de ser familia: la forma
  // sale de `primitivas.js` o no sale (docs/ARTE-VEHICULOS.md §2).
  it.each(fichas)('$ruta no importa Three', ({ texto }) => {
    expect(importaThree(texto)).toBe(false);
  });

  it.each(fichas)('$ruta no importa nada, punto', ({ texto }) => {
    expect(/^\s*import\s/m.test(texto)).toBe(false);
  });
});

describe('determinismo', () => {
  const simulables = [...ficherosDe('core'), ...ficherosDe('game')].map(leer);

  it.each(simulables)('$ruta no usa Math.random', ({ texto }) => {
    // Toda la aleatoriedad entra por el PRNG sembrado que se inyecta.
    const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(/Math\.random\s*\(/.test(codigo)).toBe(false);
  });

  it.each(simulables)('$ruta no lee el reloj', ({ texto }) => {
    const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(/Date\.now\s*\(|performance\.now\s*\(|new Date\s*\(/.test(codigo)).toBe(false);
  });
});
