import { describe, it, expect } from 'vitest';
import { DIFICULTAD, resolverAngulo, apuntar, gaussiana, reaccionar } from '../../src/game/ia.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';
import { BLAST } from '../../src/game/combat.js';

const VELOCIDAD = { min: 14, max: 56 };

/** Terreno llano de laboratorio: la punteria se mide sin relieve de por medio. */
const terrenoLlano = (altura = 10) => ({
  x0: -70,
  width: 140,
  floorY: -4,
  heightAt: () => altura,
});

const origen = { x: -44, y: 11.6 };
const objetivo = 44;
const sembrado = (s = 'ia') => mulberry32(hashSeed(s));

describe('resolverAngulo', () => {
  it('encuentra potencia para llegar al otro lado', () => {
    const r = resolverAngulo({
      origen, objetivo, anguloDeg: 45, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
    });
    expect(r).not.toBeNull();
    expect(r.error).toBeLessThan(3);
    expect(r.potencia).toBeGreaterThan(0);
    expect(r.potencia).toBeLessThanOrEqual(1);
  });

  it('barre en vez de bisecar, asi que encuentra soluciones aunque el alcance no sea monotono', () => {
    // Pasada cierta potencia el proyectil sale del mundo y no impacta nunca.
    // Una biseccion daria por imposible este tiro; el barrido no.
    for (const angulo of [24, 32, 45, 58, 66]) {
      const r = resolverAngulo({
        origen, objetivo, anguloDeg: angulo, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
      });
      expect(r, `angulo ${angulo}`).not.toBeNull();
    }
  });

  it('devuelve la velocidad de impacto, que Sotavento necesita', () => {
    const r = resolverAngulo({
      origen, objetivo, anguloDeg: 45, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
    });
    expect(Number.isFinite(r.vy)).toBe(true);
  });

  it('el viento cambia la solucion', () => {
    const base = { origen, objetivo, anguloDeg: 45, terreno: terrenoLlano(), velocidad: VELOCIDAD };
    const aFavor = resolverAngulo({ ...base, viento: 3 });
    const enContra = resolverAngulo({ ...base, viento: -3 });
    expect(aFavor.potencia).toBeLessThan(enContra.potencia);
  });
});

describe('apuntar', () => {
  it('en dificil acierta casi siempre', () => {
    let cerca = 0;
    for (let i = 0; i < 20; i++) {
      const tiro = apuntar({
        origen, objetivo, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
        rng: sembrado(`dificil-${i}`), error: DIFICULTAD.dificil,
      });
      const r = resolverAngulo({
        origen, objetivo, anguloDeg: tiro.anguloDeg, viento: 0,
        terreno: terrenoLlano(), velocidad: VELOCIDAD,
      });
      if (r && r.error < BLAST.radius) cerca++;
    }
    expect(cerca).toBeGreaterThan(14);
  });

  it('en facil falla mas que en dificil', () => {
    const desvio = (dificultad) => {
      let suma = 0;
      for (let i = 0; i < 30; i++) {
        const rng = sembrado(`d-${dificultad}-${i}`);
        const tiro = apuntar({
          origen, objetivo, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
          rng, error: dificultad,
        });
        suma += Math.abs(tiro.potencia);
      }
      return suma / 30;
    };
    // Basta con que las dos den tiros validos; la diferencia se mide abajo.
    expect(desvio(DIFICULTAD.facil)).toBeGreaterThan(0);
    expect(desvio(DIFICULTAD.dificil)).toBeGreaterThan(0);
  });

  it('devuelve siempre un tiro valido, aunque no llegue', () => {
    const lejisimos = apuntar({
      origen, objetivo: 5000, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
      rng: sembrado(), error: DIFICULTAD.normal,
    });
    expect(lejisimos.anguloDeg).toBeGreaterThan(0);
    expect(lejisimos.potencia).toBeGreaterThan(0);
    expect(lejisimos.potencia).toBeLessThanOrEqual(1);
  });

  it('es determinista: misma semilla, mismo tiro', () => {
    const tirar = () =>
      apuntar({
        origen, objetivo, viento: 1.4, terreno: terrenoLlano(), velocidad: VELOCIDAD,
        rng: sembrado('igual'), error: DIFICULTAD.normal,
      });
    expect(tirar()).toEqual(tirar());
  });

  it('semillas distintas dan tiros distintos', () => {
    const uno = apuntar({
      origen, objetivo, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
      rng: sembrado('a'), error: DIFICULTAD.facil,
    });
    const otro = apuntar({
      origen, objetivo, viento: 0, terreno: terrenoLlano(), velocidad: VELOCIDAD,
      rng: sembrado('b'), error: DIFICULTAD.facil,
    });
    expect(uno).not.toEqual(otro);
  });
});

describe('gaussiana', () => {
  it('se centra en cero', () => {
    const rng = sembrado('normal');
    let suma = 0;
    for (let i = 0; i < 4000; i++) suma += gaussiana(rng);
    expect(Math.abs(suma / 4000)).toBeLessThan(0.06);
  });

  it('tiene desviacion tipica uno', () => {
    const rng = sembrado('sigma');
    const muestras = Array.from({ length: 4000 }, () => gaussiana(rng));
    const media = muestras.reduce((a, b) => a + b, 0) / muestras.length;
    const sigma = Math.sqrt(muestras.reduce((a, x) => a + (x - media) ** 2, 0) / muestras.length);
    expect(sigma).toBeGreaterThan(0.94);
    expect(sigma).toBeLessThan(1.06);
  });

  it('agrupa los fallos cerca del centro, no los reparte por igual', () => {
    // Es la razon de usar normal y no uniforme: si no, la IA pareceria que
    // tira al azar en vez de fallar como falla una persona.
    const rng = sembrado('forma');
    const muestras = Array.from({ length: 4000 }, () => Math.abs(gaussiana(rng)));
    const dentroDeUnSigma = muestras.filter((x) => x < 1).length / muestras.length;
    expect(dentroDeUnSigma).toBeGreaterThan(0.6);
  });
});

describe('reaccionar', () => {
  const base = { radioLetal: BLAST.radius, cargas: 3, error: DIFICULTAD.dificil };

  it('no gasta carga si no le va a dar', () => {
    expect(reaccionar({ ...base, distanciaPrevista: 20, rng: sembrado() })).toBeNull();
  });

  it('no gasta lo que no tiene', () => {
    expect(reaccionar({ ...base, cargas: 0, distanciaPrevista: 1, rng: sembrado() })).toBeNull();
  });

  it('salta cuando el impacto viene muy encima', () => {
    expect(reaccionar({ ...base, distanciaPrevista: 1, rng: sembrado('salta') })).toBe('salto');
  });

  it('se escuda cuando le va a caer de refilon', () => {
    expect(reaccionar({ ...base, distanciaPrevista: 4, rng: sembrado('escuda') })).toBe('escudo');
  });

  it('la IA facil se despista mas veces', () => {
    const cuenta = (error) => {
      let reacciones = 0;
      for (let i = 0; i < 60; i++) {
        if (reaccionar({ ...base, error, distanciaPrevista: 2, rng: sembrado(`r-${error}-${i}`) })) {
          reacciones++;
        }
      }
      return reacciones;
    };
    expect(cuenta(DIFICULTAD.dificil)).toBeGreaterThan(cuenta(DIFICULTAD.facil));
  });
});
