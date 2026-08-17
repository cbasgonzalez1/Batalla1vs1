import { describe, it, expect } from 'vitest';
import { Terrain } from '../../src/world/terrain.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

/**
 * Aludes: la arena que queda mas empinada que su angulo de reposo se derrumba.
 *
 * Hace falta desde que los depositos se apilan. Y como mueve masa, lo primero
 * que hay que exigirle es que no la cree ni la destruya.
 */

const BIOMA = { crest: '#c8b48a', body: '#a08a5e', deep: '#6b5638' };
const TANGENTE_34 = Math.tan((34 * Math.PI) / 180);

/** Terreno de laboratorio: llano, para medir la fisica del alud sin relieve. */
function construirPlano() {
  return new Terrain({
    rng: mulberry32(hashSeed('llano')),
    biome: BIOMA,
    width: 140,
    columns: 384,
    depth: 18,
    minHeight: 10,
    amplitude: 0,
    bowlHalfWidth: 0,
  });
}

function construir(semilla = 'vostok') {
  return new Terrain({
    rng: mulberry32(hashSeed(semilla)),
    biome: BIOMA,
    width: 140,
    columns: 384,
    depth: 18,
    minHeight: 6,
    amplitude: 14,
    bowlHalfWidth: 44,
  });
}

const masaTotal = (t) => {
  let s = 0;
  for (const h of t.heights) s += (h - t.floorY) * t.dx;
  return s;
};

const pendienteMaxima = (t) => {
  let peor = 0;
  for (let i = 1; i < t.cols; i++) {
    peor = Math.max(peor, Math.abs(t.heights[i] - t.heights[i - 1]) / t.dx);
  }
  return peor;
};

describe('la masa se conserva', () => {
  it('un alud no crea ni destruye arena', () => {
    const t = construir();
    t.depositar(0, 0.6, 40);           // monton absurdamente empinado
    const antes = masaTotal(t);
    t.reposar();
    expect(masaTotal(t)).toBeCloseTo(antes, 6);
  });

  it('tampoco tras varios aludes seguidos', () => {
    const t = construir();
    const antes = masaTotal(t);
    for (const x of [-20, 0, 18]) {
      t.depositar(x, 0.8, 25);
      t.reposar();
    }
    expect(masaTotal(t)).toBeCloseTo(antes + 75, 5);
  });
});

describe('el talud queda dentro del angulo de reposo', () => {
  it('una pila empinada se derrumba y baja su pendiente', () => {
    // En llano, donde la pendiente del terreno no enmascara la del monton.
    const t = construirPlano();
    t.depositar(0, 0.5, 45);
    const antes = pendienteMaxima(t);
    expect(antes).toBeGreaterThan(TANGENTE_34);

    t.reposar();
    expect(pendienteMaxima(t)).toBeLessThan(antes);
  });

  it('el monton se ensancha al caer', () => {
    const t = construir();
    const alturaAntes = t.heightAt(0);
    t.depositar(0, 0.5, 45);
    const pico = t.heightAt(0);
    t.reposar();
    expect(t.heightAt(0)).toBeLessThan(pico);
    expect(t.heightAt(0)).toBeGreaterThan(alturaAntes);
  });

  it('el alud es progresivo: cada turno mueve menos que el anterior', () => {
    // La relajacion es difusiva y la cola no acaba nunca, asi que en vez de
    // forzar la convergencia de golpe —mil pasadas y un tiron de 100 ms— el
    // monton se sigue asentando en los turnos siguientes.
    const t = construir();
    t.depositar(0, 0.5, 45);

    const movidos = [];
    for (let turno = 0; turno < 5; turno++) {
      movidos.push(t.reposar(0, t.cols - 1, { rehacerMalla: false }).movido);
    }
    for (let i = 1; i < movidos.length; i++) {
      expect(movidos[i]).toBeLessThanOrEqual(movidos[i - 1]);
    }
    expect(movidos.at(-1)).toBeLessThan(movidos[0]);
  });
});

describe('lo que ya esta asentado no se toca', () => {
  it('un deposito normal de Sotavento aguanta solo', () => {
    // Una campana de pico 1,77 y sigma 2,4 tiene pendiente maxima 0,447, por
    // debajo de 0,675: no hace falta alud. Si esto fallara, cada tiro moveria
    // el terreno dos veces y el jugador no podria predecir nada.
    const t = construir();
    t.depositar(0, 2.4, 10.62);
    const antes = Array.from(t.heights);
    const r = t.reposar();
    expect(r.movido).toBeCloseTo(0, 9);
    expect(Array.from(t.heights)).toEqual(antes);
  });

  it('la arena se queda en la ladera en vez de resbalar al valle', () => {
    // Decision de jugabilidad: el reposo mide el perfil de la ARENA, no el del
    // terreno. Con arena de verdad, un deposito en una ladera de 72 grados se
    // vaciaria valle abajo y levantar el suelo del rival seria imposible.
    const t = construir();
    const x = 12;
    t.depositar(x, 2.4, 10.62);
    const subidaAntes = t.heightAt(x);
    t.reposar();
    expect(t.heightAt(x)).toBeCloseTo(subidaAntes, 6);
  });

  it('tres depositos apilados SI se derrumban', () => {
    // Tres capas en el mismo sitio llegan a pico 5,30 y ya no aguantan.
    const t = construir();
    for (let i = 0; i < 3; i++) t.depositar(0, 2.4, 10.62);
    const r = t.reposar();
    expect(r.movido).toBeGreaterThan(0);
  });

  it('el terreno recien generado no se desmorona solo', () => {
    const t = construir('kalisto');
    const r = t.reposar();
    expect(r.movido).toBeCloseTo(0, 6);
  });
});

describe('sin sesgo hacia un lado', () => {
  it('un monton simetrico cae igual por los dos lados', () => {
    // El barrido alterna sentido justo para esto: recorrer siempre de
    // izquierda a derecha empujaria la arena en esa direccion. Se mide en
    // llano, que es donde la simetria se puede exigir.
    const t = construirPlano();
    const base = Array.from(t.heights);
    // Justo sobre una columna: centrado entre dos, el propio muestreo ya
    // introduce asimetria y no se estaria midiendo el barrido.
    const centro = Math.round((0 - t.x0) / t.dx);
    const x = t.x0 + centro * t.dx;
    t.depositar(x, 0.6, 40);
    t.reposar();
    let izquierda = 0;
    let derecha = 0;
    for (let d = 1; d < 90; d++) {
      izquierda += t.heights[centro - d] - base[centro - d];
      derecha += t.heights[centro + d] - base[centro + d];
    }
    const total = izquierda + derecha;
    expect(Math.abs(izquierda - derecha) / total).toBeLessThan(0.03);
  });
});

describe('determinismo', () => {
  it('los mismos aludes dan el mismo terreno', () => {
    const jugar = () => {
      const t = construir();
      for (const x of [-15, 3, 22]) {
        t.depositar(x, 0.7, 30);
        t.reposar();
      }
      return Array.from(t.heights);
    };
    expect(jugar()).toEqual(jugar());
  });
});
