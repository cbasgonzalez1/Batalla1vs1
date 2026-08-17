import { describe, it, expect, vi } from 'vitest';
import { PISTAS, crearSonidos } from '../../src/audio/sonidos.js';

/** Audio falso: registra lo que se le pide sin tocar el navegador. */
function audioFalso(src) {
  return {
    src,
    volume: 1,
    loop: false,
    preload: '',
    currentTime: 0,
    reproducciones: 0,
    pausas: 0,
    play() {
      this.reproducciones++;
      return Promise.resolve();
    },
    pause() {
      this.pausas++;
    },
    addEventListener() {},
  };
}

function montar(opciones = {}) {
  const creados = [];
  const sonidos = crearSonidos({
    crearAudio: (src) => {
      const a = audioFalso(src);
      creados.push(a);
      return a;
    },
    ...opciones,
  });
  return { sonidos, creados };
}

describe('preparacion', () => {
  it('prepara una pista por sonido declarado', () => {
    const { creados } = montar();
    for (const fichero of Object.values(PISTAS)) {
      expect(creados.some((a) => a.src.endsWith(fichero))).toBe(true);
    }
  });

  it('los efectos tienen varias voces para no cortarse entre si', () => {
    const { creados } = montar();
    const disparos = creados.filter((a) => a.src.endsWith('disparo.mp3'));
    expect(disparos.length).toBeGreaterThan(1);
  });

  it('el viento es el unico en bucle', () => {
    const { creados } = montar();
    const enBucle = creados.filter((a) => a.loop);
    expect(enBucle).toHaveLength(1);
    expect(enBucle[0].src).toContain('viento.mp3');
  });

  it('se puede cambiar la carpeta', () => {
    const { creados } = montar({ carpeta: '/otros/' });
    expect(creados[0].src.startsWith('/otros/')).toBe(true);
  });
});

describe('el navegador manda: nada suena antes del primer gesto', () => {
  it('sonar no hace nada mientras no se desbloquee', () => {
    const { sonidos, creados } = montar();
    expect(sonidos.sonar('disparo')).toBe(false);
    expect(creados.every((a) => a.reproducciones === 0)).toBe(true);
  });

  it('tras desbloquear, suena', () => {
    const { sonidos } = montar();
    sonidos.desbloquear();
    expect(sonidos.sonar('disparo')).toBe(true);
  });

  it('el viento arranca al desbloquear, no antes', () => {
    const { sonidos, creados } = montar();
    const viento = creados.find((a) => a.src.endsWith('viento.mp3'));
    expect(viento.reproducciones).toBe(0);
    sonidos.desbloquear();
    expect(viento.reproducciones).toBe(1);
  });

  it('desbloquear dos veces no arranca el viento dos veces', () => {
    const { sonidos, creados } = montar();
    sonidos.desbloquear();
    sonidos.desbloquear();
    const viento = creados.find((a) => a.src.endsWith('viento.mp3'));
    expect(viento.reproducciones).toBe(1);
  });
});

describe('reproduccion', () => {
  it('rota entre las voces para que dos disparos seguidos no se corten', () => {
    const { sonidos, creados } = montar();
    sonidos.desbloquear();
    const disparos = creados.filter((a) => a.src.endsWith('disparo.mp3'));

    sonidos.sonar('disparo');
    sonidos.sonar('disparo');
    expect(disparos[0].reproducciones).toBe(1);
    expect(disparos[1].reproducciones).toBe(1);
  });

  it('rebobina antes de sonar', () => {
    const { sonidos, creados } = montar();
    sonidos.desbloquear();
    const pista = creados.find((a) => a.src.endsWith('impacto.mp3'));
    pista.currentTime = 5;
    sonidos.sonar('impacto');
    expect(pista.currentTime).toBe(0);
  });

  it('un sonido que no existe no rompe nada', () => {
    const { sonidos } = montar();
    sonidos.desbloquear();
    expect(sonidos.sonar('trompeta')).toBe(false);
  });

  it('si el fichero falta, play falla y el juego sigue', () => {
    // Es el caso normal hasta que existan los MP3: no puede haber errores en
    // consola ni huecos en la partida.
    const { sonidos } = montar({
      crearAudio: (src) => ({
        ...audioFalso(src),
        play: () => Promise.reject(new Error('404')),
      }),
    });
    sonidos.desbloquear();
    expect(() => sonidos.sonar('disparo')).not.toThrow();
  });
});

describe('silencio', () => {
  it('silenciado no suena nada y para el viento', () => {
    const { sonidos, creados } = montar();
    sonidos.desbloquear();
    sonidos.silenciar(true);

    expect(sonidos.sonar('disparo')).toBe(false);
    expect(creados.find((a) => a.src.endsWith('viento.mp3')).pausas).toBe(1);
  });

  it('al quitar el silencio vuelve el viento', () => {
    const { sonidos, creados } = montar();
    sonidos.desbloquear();
    sonidos.silenciar(true);
    sonidos.silenciar(false);
    expect(creados.find((a) => a.src.endsWith('viento.mp3')).reproducciones).toBe(2);
  });

  it('se puede arrancar ya silenciado', () => {
    const { sonidos } = montar({ activo: false });
    sonidos.desbloquear();
    expect(sonidos.sonar('disparo')).toBe(false);
  });
});
