import { describe, it, expect, vi } from 'vitest';
import { describirPartida, pasosPara, exponerGanchos } from '../../src/ui/inspeccion.js';
import { FIXED_DT } from '../../src/game/ballistics.js';

const base = {
  fase: 'aiming',
  activo: 0,
  ronda: 1,
  anguloGrados: 48,
  potencia: 0.7,
  viento: -1.25,
  proyectil: null,
  alturaTerreno: 6.5,
  pasosDeVuelo: 0,
  pasosAlImpacto: Infinity,
  reaccionAbierta: false,
  defensor: 1,
  ganador: null,
  jugadores: [
    { vida: 100, cargas: 3, disparos: 0, destruido: false },
    { vida: 100, cargas: 3, disparos: 0, destruido: false },
  ],
};

describe('describirPartida', () => {
  it('incluye todo lo que exige el contrato del bucle de test', () => {
    const texto = describirPartida({
      ...base,
      fase: 'flying',
      proyectil: { x: -12.5, y: 30.25, vx: 22.5, vy: -4.75 },
      pasosDeVuelo: 60,
      pasosAlImpacto: 108,
    });

    expect(texto).toContain('angulo: 48.0°');
    expect(texto).toContain('potencia: 70%');
    expect(texto).toContain('viento: -1.25');
    expect(texto).toContain('proyectil: x=-12.50 y=30.25');
    expect(texto).toContain('velocidad: vx=22.50 vy=-4.75');
    expect(texto).toContain('terreno bajo el proyectil: 6.50');
    expect(texto).toContain('turno: A');
  });

  it('dice que no hay proyectil en vez de inventarse ceros', () => {
    const texto = describirPartida(base);
    expect(texto).toContain('proyectil: ninguno en vuelo');
    expect(texto).not.toContain('velocidad:');
  });

  it('es estable: los mismos datos dan exactamente el mismo texto', () => {
    expect(describirPartida(base)).toBe(describirPartida({ ...base }));
  });

  it('nombra los bandos como A y B', () => {
    expect(describirPartida({ ...base, activo: 1 })).toContain('turno: B');
  });

  it('avisa de la ventana de reaccion y de quien defiende', () => {
    const texto = describirPartida({ ...base, reaccionAbierta: true, defensor: 1 });
    expect(texto).toContain('reaccion: abierta para B');
  });

  it('marca al destruido en vez de decir 0 de vida', () => {
    const texto = describirPartida({
      ...base,
      jugadores: [base.jugadores[0], { vida: 0, cargas: 1, disparos: 4, destruido: true }],
    });
    expect(texto).toContain('B: destruido');
  });

  it('no dice quien gana mientras la partida sigue', () => {
    expect(describirPartida(base)).not.toContain('ganador');
    expect(describirPartida({ ...base, ganador: 0 })).toContain('ganador: A');
  });

  it('escribe un guion donde el numero no existe, en vez de NaN', () => {
    const texto = describirPartida({ ...base, viento: NaN, alturaTerreno: undefined });
    expect(texto).toContain('viento: —');
    expect(texto).not.toContain('NaN');
  });

  it('sin impacto previsto lo dice con palabras', () => {
    const texto = describirPartida({
      ...base,
      proyectil: { x: 0, y: 0, vx: 0, vy: 0 },
      pasosAlImpacto: Infinity,
    });
    expect(texto).toContain('pasos al impacto: sin impacto previsto');
  });
});

describe('pasosPara', () => {
  it('un segundo son 120 pasos exactos', () => {
    expect(pasosPara(1000, FIXED_DT)).toBe(120);
  });

  it('redondea sin dejarse pasos por el camino', () => {
    expect(pasosPara(900, FIXED_DT)).toBe(108); // la ventana de reaccion
    expect(pasosPara(16.667, FIXED_DT)).toBe(2);
  });

  it('no avanza con entradas absurdas', () => {
    expect(pasosPara(0, FIXED_DT)).toBe(0);
    expect(pasosPara(-500, FIXED_DT)).toBe(0);
    expect(pasosPara(NaN, FIXED_DT)).toBe(0);
  });
});

describe('exponerGanchos', () => {
  it('publica los dos ganchos con el nombre que exige el contrato', () => {
    const ventana = {};
    exponerGanchos(
      { leerEstado: () => base, avanzarPaso: () => {}, dibujar: () => {}, pasoEnSegundos: FIXED_DT },
      ventana
    );
    expect(typeof ventana.render_game_to_text).toBe('function');
    expect(typeof ventana.advanceTime).toBe('function');
  });

  it('advanceTime avanza pasos fijos, no tiempo real', () => {
    const avanzarPaso = vi.fn();
    const dibujar = vi.fn();
    const ventana = {};
    exponerGanchos(
      { leerEstado: () => base, avanzarPaso, dibujar, pasoEnSegundos: FIXED_DT },
      ventana
    );

    const pasos = ventana.advanceTime(900);

    expect(pasos).toBe(108);
    expect(avanzarPaso).toHaveBeenCalledTimes(108);
    // Un solo dibujado al final: al bucle de test le interesa el estado
    // resultante, no los cuadros intermedios.
    expect(dibujar).toHaveBeenCalledTimes(1);
  });

  it('render_game_to_text lee el estado en el momento de llamarlo', () => {
    let fase = 'aiming';
    const ventana = {};
    exponerGanchos(
      {
        leerEstado: () => ({ ...base, fase }),
        avanzarPaso: () => {},
        dibujar: () => {},
        pasoEnSegundos: FIXED_DT,
      },
      ventana
    );

    expect(ventana.render_game_to_text()).toContain('fase: aiming');
    fase = 'flying';
    expect(ventana.render_game_to_text()).toContain('fase: flying');
  });
});
