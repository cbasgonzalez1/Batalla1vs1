import { describe, it, expect } from 'vitest';
import {
  IDIOMAS,
  IDIOMA_POR_DEFECTO,
  elegirIdioma,
  idiomaDelNavegador,
  crearTraductor,
} from '../../src/ui/i18n.js';

describe('elegirIdioma', () => {
  it('espanol cuando el dispositivo esta en espanol', () => {
    expect(elegirIdioma(['es'])).toBe('es');
    expect(elegirIdioma(['es-ES'])).toBe('es');
    expect(elegirIdioma(['es-MX', 'en-US'])).toBe('es');
  });

  it('ingles cuando el dispositivo esta en cualquier otra cosa', () => {
    expect(elegirIdioma(['en-GB'])).toBe('en');
    expect(elegirIdioma(['fr-FR'])).toBe('en');
    expect(elegirIdioma(['de', 'it'])).toBe('en');
    expect(elegirIdioma(['ja-JP'])).toBe('en');
  });

  it('un movil en catalan o gallego se queda en espanol, no en ingles', () => {
    // Declaran ['ca-ES', 'es-ES']: para esa familia el espanol es mejor
    // eleccion que el ingles, aunque el primer idioma no sea ninguno de los dos.
    expect(elegirIdioma(['ca-ES', 'es-ES'])).toBe('es');
    expect(elegirIdioma(['gl-ES', 'es-ES', 'en'])).toBe('es');
    expect(elegirIdioma(['eu', 'es'])).toBe('es');
  });

  it('respeta el orden de preferencia entre los dos idiomas', () => {
    expect(elegirIdioma(['ca', 'en-US', 'es-ES'])).toBe('en');
    expect(elegirIdioma(['ca', 'es-ES', 'en-US'])).toBe('es');
  });

  it('no se cree las mayusculas ni los espacios', () => {
    expect(elegirIdioma([' ES-es '])).toBe('es');
    expect(elegirIdioma(['ES_MX'])).toBe('es');
  });

  it('aguanta entradas rotas sin lanzar', () => {
    expect(elegirIdioma([])).toBe(IDIOMA_POR_DEFECTO);
    expect(elegirIdioma([null, undefined, 42])).toBe(IDIOMA_POR_DEFECTO);
    expect(elegirIdioma('es-ES')).toBe('es');
    expect(elegirIdioma(undefined)).toBe(IDIOMA_POR_DEFECTO);
  });
});

describe('idiomaDelNavegador', () => {
  it('prefiere la lista completa sobre el idioma suelto', () => {
    expect(idiomaDelNavegador({ languages: ['es-ES', 'en'], language: 'en-US' })).toBe('es');
  });

  it('cae a language si languages viene vacio', () => {
    expect(idiomaDelNavegador({ languages: [], language: 'es-AR' })).toBe('es');
  });

  it('devuelve el idioma por defecto si no hay navegador', () => {
    expect(idiomaDelNavegador(null)).toBe(IDIOMA_POR_DEFECTO);
  });
});

describe('traductor', () => {
  it('traduce a los dos idiomas', () => {
    expect(crearTraductor('es')('escudo')).toBe('Escudo');
    expect(crearTraductor('en')('escudo')).toBe('Shield');
  });

  it('sustituye los valores de la plantilla', () => {
    expect(crearTraductor('es')('gana', { bando: 'A' })).toBe('Gana A');
    expect(crearTraductor('en')('gana', { bando: 'A' })).toBe('A wins');
  });

  it('rellena el resumen de victoria en los dos idiomas', () => {
    expect(crearTraductor('es')('resumen', { disparos: 7, vida: 42 })).toBe('7 disparos · 42 de vida');
    expect(crearTraductor('en')('resumen', { disparos: 7, vida: 42 })).toBe('7 shots · 42 HP left');
  });

  it('deja el hueco intacto si falta un valor, en vez de escribir undefined', () => {
    expect(crearTraductor('es')('gana', {})).toBe('Gana {bando}');
  });

  it('devuelve la clave si no existe, en vez de romper la pantalla', () => {
    expect(crearTraductor('es')('clave-que-no-existe')).toBe('clave-que-no-existe');
  });

  it('un idioma desconocido cae al de por defecto', () => {
    expect(crearTraductor('fr')('escudo')).toBe('Shield');
  });

  it('las dos tablas tienen exactamente las mismas claves', () => {
    // Si alguien anade un texto y se olvida de traducirlo, salta aqui y no en
    // el movil de un ingles a mitad de partida.
    const claves = IDIOMAS.map((idioma) => {
      const t = crearTraductor(idioma);
      return { idioma, t };
    });
    const esperadas = [
      'titulo', 'viento', 'turno', 'angulo', 'potencia', 'otear', 'otearAria',
      'reaccion', 'reaccionAria', 'escudo', 'salto', 'objetivoDestruido',
      'gana', 'revancha', 'pista', 'resumen', 'empate',
    ];
    for (const { idioma, t } of claves) {
      for (const clave of esperadas) {
        expect(t(clave), `falta "${clave}" en ${idioma}`).not.toBe(clave);
      }
    }
  });
});
