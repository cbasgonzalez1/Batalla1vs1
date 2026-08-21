import { describe, it, expect } from 'vitest';
import {
  VERSION,
  PIDE,
  ACCION,
  LARGO_CODIGO,
  RETARDO_PASOS,
  codigoDeSala,
  codigoValido,
  normalizarCodigo,
  mensaje,
  validar,
  huella,
} from '../../src/net/protocolo.js';
import { mulberry32, hashSeed } from '../../src/core/rng.js';

describe('codigos de sala', () => {
  it('salen del rng que se le pase, asi que son reproducibles', () => {
    expect(codigoDeSala(mulberry32(hashSeed('sala')))).toBe(codigoDeSala(mulberry32(hashSeed('sala'))));
  });

  it('tienen el largo declarado y son validos', () => {
    const rng = mulberry32(hashSeed('muchas'));
    for (let i = 0; i < 500; i++) {
      const c = codigoDeSala(rng);
      expect(c).toHaveLength(LARGO_CODIGO);
      expect(codigoValido(c)).toBe(true);
    }
  });

  it('no usan caracteres que se confunden al dictarlos', () => {
    // Sin I, O, 0 ni 1: estos codigos se dicen en voz alta en un sofa.
    const rng = mulberry32(hashSeed('confusos'));
    for (let i = 0; i < 500; i++) {
      expect(codigoDeSala(rng)).not.toMatch(/[IO01]/);
    }
  });

  it('el que teclea el jugador se normaliza', () => {
    expect(normalizarCodigo(' abcd ')).toBe('ABCD');
    expect(normalizarCodigo('a b c d')).toBe('ABCD');
    expect(normalizarCodigo(null)).toBe('');
  });

  it('rechaza codigos que no lo son', () => {
    expect(codigoValido('ABC')).toBe(false);
    expect(codigoValido('ABCDE')).toBe(false);
    expect(codigoValido('ABC0')).toBe(false);
    expect(codigoValido('abcd')).toBe(false);
    expect(codigoValido(null)).toBe(false);
  });
});

describe('validar lo que llega del cable', () => {
  const unir = { v: VERSION, tipo: PIDE.unir, sala: 'ABCD', nombre: 'Ana' };

  it('acepta un mensaje bien formado', () => {
    expect(validar(unir).ok).toBe(true);
  });

  it('rechaza basura', () => {
    expect(validar(null).ok).toBe(false);
    expect(validar('hola').ok).toBe(false);
    expect(validar({}).ok).toBe(false);
  });

  it('rechaza otra version del protocolo', () => {
    expect(validar({ ...unir, v: 99 }).ok).toBe(false);
  });

  it('rechaza nombres vacios o kilometricos', () => {
    expect(validar({ ...unir, nombre: '  ' }).ok).toBe(false);
    expect(validar({ ...unir, nombre: 'x'.repeat(17) }).ok).toBe(false);
  });

  it('rechaza bandos que no existen', () => {
    expect(validar({ v: VERSION, tipo: PIDE.bando, bando: 'c' }).ok).toBe(false);
    expect(validar({ v: VERSION, tipo: PIDE.bando, bando: 'a' }).ok).toBe(true);
  });

  describe('inputs', () => {
    const disparo = {
      v: VERSION,
      tipo: PIDE.input,
      paso: 10,
      accion: ACCION.disparo,
      anguloDeg: 45,
      potencia: 0.8,
    };

    it('acepta un disparo normal', () => {
      expect(validar(disparo).ok).toBe(true);
    });

    it('rechaza angulos y potencias fuera de rango', () => {
      // Un cliente manipulado no ganaria nada —cada movil simula por su cuenta—
      // pero si podria tirar la partida de los demas.
      expect(validar({ ...disparo, anguloDeg: 400 }).ok).toBe(false);
      expect(validar({ ...disparo, anguloDeg: -1 }).ok).toBe(false);
      expect(validar({ ...disparo, potencia: 50 }).ok).toBe(false);
      expect(validar({ ...disparo, potencia: -0.1 }).ok).toBe(false);
      expect(validar({ ...disparo, potencia: NaN }).ok).toBe(false);
    });

    it('rechaza pasos que no son pasos', () => {
      expect(validar({ ...disparo, paso: -1 }).ok).toBe(false);
      expect(validar({ ...disparo, paso: 1.5 }).ok).toBe(false);
      expect(validar({ ...disparo, paso: 'diez' }).ok).toBe(false);
    });

    it('rechaza acciones inventadas', () => {
      expect(validar({ ...disparo, accion: 'teletransporte' }).ok).toBe(false);
    });

    it('acepta las reacciones sin exigirles angulo', () => {
      const base = { v: VERSION, tipo: PIDE.input, paso: 250 };
      expect(validar({ ...base, accion: ACCION.escudo }).ok).toBe(true);
      expect(validar({ ...base, accion: ACCION.salto }).ok).toBe(true);
    });
  });

  it('mensaje() sella la version', () => {
    expect(mensaje(PIDE.listo)).toEqual({ v: VERSION, tipo: PIDE.listo });
  });
});

describe('retardo de entrada', () => {
  it('cabe de sobra dentro de la ventana de reaccion', () => {
    // La ventana dura 108 pasos (0,9 s). Si el retardo se acercara a eso, el
    // defensor no tendria tiempo material de reaccionar.
    expect(RETARDO_PASOS).toBeLessThan(108 / 2);
    expect(RETARDO_PASOS).toBeGreaterThan(10);
  });
});

describe('huella del estado', () => {
  const base = { alturas: Float64Array.from({ length: 1400 }, (_, i) => i * 0.01), vidas: [100, 100], turno: 1 };

  it('el mismo estado da la misma huella', () => {
    expect(huella(base)).toBe(huella({ ...base }));
  });

  it('cambiar una vida cambia la huella', () => {
    expect(huella({ ...base, vidas: [100, 54] })).not.toBe(huella(base));
  });

  it('cambiar el turno cambia la huella', () => {
    expect(huella({ ...base, turno: 2 })).not.toBe(huella(base));
  });

  it('un crater cambia la huella', () => {
    const tocado = Float64Array.from(base.alturas);
    for (let i = 400; i < 460; i++) tocado[i] -= 2.6;
    expect(huella({ ...base, alturas: tocado })).not.toBe(huella(base));
  });

  it('no se altera por el ultimo bit de un double', () => {
    // Dos maquinas pueden diferir ahi sin que la partida haya divergido de
    // verdad; si la huella saltara por eso, avisaria de desincronias falsas.
    const casiIgual = Float64Array.from(base.alturas, (h) => h + 1e-9);
    expect(huella({ ...base, alturas: casiIgual })).toBe(huella(base));
  });

  it('es un entero sin signo de 32 bits', () => {
    const h = huella(base);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('los camuflajes que llegan al entrar en una sala', () => {
  const unir = (camuflajes) => validar({
    v: VERSION, tipo: PIDE.unir, sala: 'ABCD', nombre: 'Ana', camuflajes,
  });

  it('sin camuflajes vale: se juega sin cuenta', () => {
    expect(unir(undefined).ok).toBe(true);
    expect(unir(null).ok).toBe(true);
  });

  it('con los dos vale', () => {
    expect(unir({ a: 'a-bosque', b: 'b-abisal' }).ok).toBe(true);
  });

  it('con uno solo tambien: puede que solo tenga ese', () => {
    expect(unir({ a: 'a-bosque' }).ok).toBe(true);
    expect(unir({ a: null, b: 'b-abisal' }).ok).toBe(true);
  });

  it.each([
    ['un numero', { a: 7 }],
    ['con mayusculas', { a: 'A-Bosque' }],
    ['con espacios', { a: 'a bosque' }],
    ['vacio', { a: '' }],
    ['larguisimo', { a: 'a'.repeat(41) }],
    ['no es objeto', 'a-bosque'],
  ])('rechaza %s', (_, camuflajes) => {
    expect(unir(camuflajes).ok).toBe(false);
  });

  it('no comprueba que exista, solo la forma', () => {
    // El catalogo vive en el arte y puede crecer sin que el servidor se entere.
    // Un identificador que ningun movil reconozca se pinta con el color del
    // bando y la partida sigue: un cosmetico no puede impedir jugar.
    expect(unir({ a: 'a-inventado-que-no-existe' }).ok).toBe(true);
  });
});
