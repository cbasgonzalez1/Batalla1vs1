import { describe, it, expect, beforeEach } from 'vitest';
import { crearApi } from '../../server/cuentas.js';
import { cifrarClave, huellaDe } from '../../server/auth.js';

/**
 * La API de cuentas, con un repositorio de mentira.
 *
 * Igual que `salas.js` se prueba sin abrir un socket, esto se prueba sin abrir
 * un Postgres: lo que puede fallar es la logica —quien puede hacer que, y con
 * que respuesta— y eso no necesita una base de datos delante.
 */

function repoFalso() {
  const jugadores = new Map();
  const sesiones = new Map();
  const desbloqueos = new Map();
  const partidas = [];

  return {
    jugadores, sesiones, partidas, desbloqueos,

    porCorreo: async (correo) => jugadores.get(correo) ?? null,
    porId: async (id) => [...jugadores.values()].find((j) => j.id === id) ?? null,

    crearJugador: async ({ correo, clave, nombre, deSerie }) => {
      const j = {
        id: `id-${jugadores.size + 1}`,
        correo, clave, nombre,
        camuflaje_a: deSerie.find((x) => x.startsWith('a-')) ?? null,
        camuflaje_b: deSerie.find((x) => x.startsWith('b-')) ?? null,
      };
      jugadores.set(correo, j);
      desbloqueos.set(j.id, deSerie.map((id) => ({ camuflaje_id: id, origen: 'serie' })));
      return j;
    },

    abrirSesion: async ({ huella, jugadorId }) => sesiones.set(huella, jugadorId),
    jugadorDeSesion: async (huella) => {
      const id = sesiones.get(huella);
      return id ? [...jugadores.values()].find((j) => j.id === id) ?? null : null;
    },
    cerrarSesion: async (huella) => sesiones.delete(huella),
    verVisto: async () => {},

    catalogo: async () => [
      { id: 'a-oliva', bando: 'a', nombre: 'Oliva', base: 0x7d8b4e, centimos: 0 },
      { id: 'a-bosque', bando: 'a', nombre: 'Bosque', base: 0x577543, centimos: 199 },
    ],
    desbloqueosDe: async (id) => desbloqueos.get(id) ?? [],
    elegirCamuflaje: async (id, bando, camuflajeId) => {
      const tiene = (desbloqueos.get(id) ?? []).some((d) => d.camuflaje_id === camuflajeId);
      if (!tiene || !camuflajeId.startsWith(`${bando}-`)) return null;
      const j = [...jugadores.values()].find((x) => x.id === id);
      j[bando === 'b' ? 'camuflaje_b' : 'camuflaje_a'] = camuflajeId;
      return { camuflaje_a: j.camuflaje_a, camuflaje_b: j.camuflaje_b };
    },

    progresoDe: async () => ({ partidas: 3, ganadas: 2 }),
    guardarPartida: async (p) => {
      partidas.push(p);
      return { id: `partida-${partidas.length}` };
    },
    historialDe: async () => [{ id: 'partida-1', repeticion: 'vostok~2b-rs' }],
  };
}

const DE_SERIE = ['a-oliva', 'b-acero'];
const REGISTRO = { correo: 'Ana@Correo.com', clave: 'doceletras', nombre: 'Ana' };

describe('registro y sesion', () => {
  let repo; let api;
  beforeEach(() => {
    repo = repoFalso();
    api = crearApi({ repo, deSerie: DE_SERIE });
  });

  it('registrarse devuelve token y regala los camuflajes de serie', async () => {
    const r = await api.atender('POST', '/api/registro', { cuerpo: REGISTRO });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.token).toBeTruthy();
    expect(r.cuerpo.jugador.camuflajes).toEqual({ a: 'a-oliva', b: 'b-acero' });
    // El correo se guarda normalizado: si no, la misma persona se registra dos
    // veces cambiando una mayuscula.
    expect(repo.jugadores.has('ana@correo.com')).toBe(true);
  });

  it('la respuesta no lleva la contrasena por ningun lado', async () => {
    const r = await api.atender('POST', '/api/registro', { cuerpo: REGISTRO });
    expect(JSON.stringify(r.cuerpo)).not.toContain('doceletras');
    expect(r.cuerpo.jugador.clave).toBeUndefined();
  });

  it('el mismo correo no se registra dos veces', async () => {
    await api.atender('POST', '/api/registro', { cuerpo: REGISTRO });
    const r = await api.atender('POST', '/api/registro', {
      cuerpo: { ...REGISTRO, correo: 'ANA@CORREO.COM' },
    });
    expect(r.estado).toBe(409);
  });

  it('un registro invalido no llega a la base de datos', async () => {
    const r = await api.atender('POST', '/api/registro', { cuerpo: { correo: 'no', clave: 'x' } });
    expect(r.estado).toBe(400);
    expect(repo.jugadores.size).toBe(0);
  });

  it('entrar con la clave buena abre sesion', async () => {
    repo.jugadores.set('ana@correo.com', {
      id: 'id-1', correo: 'ana@correo.com', nombre: 'Ana',
      clave: await cifrarClave('doceletras'), camuflaje_a: 'a-oliva', camuflaje_b: 'b-acero',
    });
    const r = await api.atender('POST', '/api/sesion', {
      cuerpo: { correo: 'ana@correo.com', clave: 'doceletras' },
    });
    expect(r.estado).toBe(200);
    expect(repo.sesiones.get(huellaDe(r.cuerpo.token))).toBe('id-1');
  });

  it('el mismo mensaje si no existe la cuenta y si la clave es mala', async () => {
    repo.jugadores.set('ana@correo.com', {
      id: 'id-1', correo: 'ana@correo.com', nombre: 'Ana', clave: await cifrarClave('doceletras'),
    });
    // Distinguirlos regala una lista de correos registrados a quien pruebe uno
    // por uno.
    const mala = await api.atender('POST', '/api/sesion', {
      cuerpo: { correo: 'ana@correo.com', clave: 'otracosa' },
    });
    const nadie = await api.atender('POST', '/api/sesion', {
      cuerpo: { correo: 'nadie@correo.com', clave: 'otracosa' },
    });
    expect(mala.estado).toBe(401);
    expect(nadie.estado).toBe(401);
    expect(mala.cuerpo.error).toBe(nadie.cuerpo.error);
  });

  it('cierra el grifo tras ocho intentos, y lo abre al rato', async () => {
    let reloj = 0;
    const conReloj = crearApi({ repo, deSerie: DE_SERIE, ahora: () => reloj });
    const intento = () => conReloj.atender('POST', '/api/sesion', {
      cuerpo: { correo: 'ana@correo.com', clave: 'mala' },
    });
    for (let i = 0; i < 8; i++) expect((await intento()).estado).toBe(401);
    expect((await intento()).estado).toBe(429);
    reloj += 11 * 60 * 1000;
    expect((await intento()).estado).toBe(401);
  });

  it('salir borra la sesion', async () => {
    const { cuerpo } = (await api.atender('POST', '/api/registro', { cuerpo: REGISTRO }));
    await api.atender('DELETE', '/api/sesion', { token: cuerpo.token });
    expect(repo.sesiones.size).toBe(0);
  });
});

describe('lo que pide sesion, la pide', () => {
  let api;
  beforeEach(() => { api = crearApi({ repo: repoFalso(), deSerie: DE_SERIE }); });

  it.each([
    ['GET', '/api/yo'],
    ['PUT', '/api/camuflaje'],
    ['GET', '/api/historial'],
  ])('%s %s sin token responde 401', async (metodo, ruta) => {
    expect((await api.atender(metodo, ruta, {})).estado).toBe(401);
  });

  it('un token inventado no vale', async () => {
    expect((await api.atender('GET', '/api/yo', { token: 'inventado' })).estado).toBe(401);
  });

  it('una ruta que no existe es 404', async () => {
    expect((await api.atender('GET', '/api/naranjas', {})).estado).toBe(404);
  });
});

describe('tienda', () => {
  let repo; let api; let token;
  beforeEach(async () => {
    repo = repoFalso();
    api = crearApi({ repo, deSerie: DE_SERIE });
    token = (await api.atender('POST', '/api/registro', { cuerpo: REGISTRO })).cuerpo.token;
  });

  it('se puede mirar sin cuenta', async () => {
    // Ensenar los camuflajes es justo lo que dira si merece la pena implementar
    // el pago.
    const r = await api.atender('GET', '/api/tienda', {});
    expect(r.estado).toBe(200);
    expect(r.cuerpo.camuflajes.every((c) => c.tengo === false)).toBe(true);
  });

  it('con cuenta marca lo que ya tienes', async () => {
    const r = await api.atender('GET', '/api/tienda', { token });
    expect(r.cuerpo.camuflajes.find((c) => c.id === 'a-oliva').tengo).toBe(true);
    expect(r.cuerpo.camuflajes.find((c) => c.id === 'a-bosque').tengo).toBe(false);
  });

  it('nada es comprable todavia, y lo dice', async () => {
    const r = await api.atender('GET', '/api/tienda', { token });
    expect(r.cuerpo.pagoActivo).toBe(false);
    expect(r.cuerpo.camuflajes.every((c) => c.comprable === false)).toBe(true);
  });

  it('elegir un camuflaje que tienes vale', async () => {
    const r = await api.atender('PUT', '/api/camuflaje', { token, cuerpo: { bando: 'a', id: 'a-oliva' } });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.camuflajes.a).toBe('a-oliva');
  });

  it('elegir uno que NO tienes es 403', async () => {
    const r = await api.atender('PUT', '/api/camuflaje', { token, cuerpo: { bando: 'a', id: 'a-bosque' } });
    expect(r.estado).toBe(403);
  });

  it('un camuflaje del otro bando es 403', async () => {
    const r = await api.atender('PUT', '/api/camuflaje', { token, cuerpo: { bando: 'b', id: 'a-oliva' } });
    expect(r.estado).toBe(403);
  });
});

describe('guardar una partida', () => {
  let repo; let api; let token;
  beforeEach(async () => {
    repo = repoFalso();
    api = crearApi({ repo, deSerie: DE_SERIE });
    token = (await api.atender('POST', '/api/registro', { cuerpo: REGISTRO })).cuerpo.token;
  });

  it('guarda la repeticion, que ES la partida entera', async () => {
    const r = await api.atender('POST', '/api/partida', {
      token,
      cuerpo: {
        semilla: 'vostok', teatro: 'berlin', suelo: 'zanja', repeticion: 'vostok~2b-rs.31-p0',
        ganador: 'a', turnos: 2,
        participantes: [{ yo: true, bando: 'a', nombre: 'Ana', disparos: 2, aciertos: 1, dano: 46 }],
      },
    });
    expect(r.estado).toBe(200);
    expect(repo.partidas[0].repeticion).toBe('vostok~2b-rs.31-p0');
  });

  it('sin semilla no se guarda: seria irrepetible', async () => {
    const r = await api.atender('POST', '/api/partida', { token, cuerpo: { ganador: 'a' } });
    expect(r.estado).toBe(400);
    expect(repo.partidas.length).toBe(0);
  });

  it('el jugador sale de LA SESION, nunca del cuerpo', async () => {
    // Si no, cualquiera suma partidas ganadas a la cuenta de otro.
    await api.atender('POST', '/api/partida', {
      token,
      cuerpo: {
        semilla: 'vostok',
        participantes: [
          { yo: true, jugadorId: 'id-9999', bando: 'a', nombre: 'Ana' },
          { bando: 'b', nombre: 'Invitado' },
        ],
      },
    });
    expect(repo.partidas[0].participantes[0].jugadorId).toBe('id-1');
    expect(repo.partidas[0].participantes[1].jugadorId).toBe(null);
  });

  it('una partida sin cuenta se guarda igual, sin sumarle a nadie', async () => {
    const r = await api.atender('POST', '/api/partida', {
      cuerpo: { semilla: 'vostok', participantes: [{ yo: true, bando: 'a', nombre: 'Invitado' }] },
    });
    expect(r.estado).toBe(200);
    expect(repo.partidas[0].participantes[0].jugadorId).toBe(null);
  });
});
