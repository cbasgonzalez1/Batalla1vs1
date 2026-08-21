import { MAX_POR_BANDO, BANDOS } from '../src/game/roster.js';
import { PIDE, DICE, codigoDeSala, mensaje, validar } from '../src/net/protocolo.js';

/**
 * Las salas, sin nada de red.
 *
 * Aqui no se simula: no hay balistica, no hay daño, no hay terreno. Lo unico
 * que se decide es quien esta en cada sala, en que bando, y con que semilla
 * empieza la partida — coordinar, no calcular. A partir del "empezar", el
 * servidor solo reenvia bytes.
 *
 * Esta separado del transporte a proposito: asi toda la logica de salas se
 * prueba sin abrir un socket, que es donde estan de verdad los errores.
 */

export const MAX_JUGADORES = MAX_POR_BANDO * 2;

export function crearSalas({ rng, semillaDe }) {
  /** @type {Map<string, object>} */
  const salas = new Map();

  const publica = (sala) => ({
    codigo: sala.codigo,
    empezada: sala.empezada,
    jugadores: [...sala.jugadores.values()].map((j) => ({
      id: j.id,
      nombre: j.nombre,
      bando: j.bando,
      listo: j.listo,
      // El del bando que juega AHORA. Cambiar de lado cambia el camuflaje sin
      // mandar nada mas: el cliente manda los dos suyos al entrar y aqui se
      // elige el que toca.
      camuflaje: j.camuflajes?.[j.bando] ?? null,
    })),
  });

  const huecoEn = (sala, bando) =>
    [...sala.jugadores.values()].filter((j) => j.bando === bando).length < MAX_POR_BANDO;

  /** Al primero que entra le toca 'a'; luego se reparte al lado mas vacio. */
  function bandoLibre(sala) {
    const cuenta = { a: 0, b: 0 };
    for (const j of sala.jugadores.values()) cuenta[j.bando]++;
    if (cuenta.a <= cuenta.b && huecoEn(sala, 'a')) return 'a';
    if (huecoEn(sala, 'b')) return 'b';
    return null;
  }

  return {
    get numeroDeSalas() {
      return salas.size;
    },

    crear() {
      let codigo;
      do {
        codigo = codigoDeSala(rng);
      } while (salas.has(codigo));

      const sala = {
        codigo,
        jugadores: new Map(),
        empezada: false,
        semilla: null,
        anfitrion: null,
      };
      salas.set(codigo, sala);
      return sala;
    },

    obtener: (codigo) => salas.get(codigo) ?? null,

    /**
     * Mete a alguien en la sala. Devuelve el jugador creado o el motivo del no.
     */
    unir(codigo, { id, nombre, camuflajes }) {
      const sala = salas.get(codigo);
      if (!sala) return { ok: false, motivo: 'esa sala no existe' };
      if (sala.empezada) return { ok: false, motivo: 'la partida ya ha empezado' };
      if (sala.jugadores.size >= MAX_JUGADORES) return { ok: false, motivo: 'la sala esta llena' };

      const bando = bandoLibre(sala);
      if (!bando) return { ok: false, motivo: 'no queda hueco en ningun bando' };

      const jugador = {
        id,
        nombre: nombre.trim().slice(0, 16),
        bando,
        listo: false,
        // Los DOS: se guardan los dos y se usa el del bando actual, para que
        // cambiar de lado no necesite otro mensaje. Es decoracion pura y no
        // entra en la simulacion (`docs/PLATAFORMA.md` §0.2).
        camuflajes: {
          a: camuflajes?.a ?? null,
          b: camuflajes?.b ?? null,
        },
      };
      sala.jugadores.set(id, jugador);
      if (!sala.anfitrion) sala.anfitrion = id;

      return { ok: true, sala, jugador };
    },

    /** Cambiar de lado, si al otro le queda sitio. */
    cambiarBando(codigo, id, bando) {
      const sala = salas.get(codigo);
      if (!sala || sala.empezada) return { ok: false, motivo: 'no se puede cambiar ahora' };
      const jugador = sala.jugadores.get(id);
      if (!jugador) return { ok: false, motivo: 'no estas en la sala' };
      if (!BANDOS.includes(bando)) return { ok: false, motivo: 'ese bando no existe' };
      if (jugador.bando !== bando && !huecoEn(sala, bando)) {
        return { ok: false, motivo: 'ese bando esta lleno' };
      }

      jugador.bando = bando;
      jugador.listo = false; // cambiar de lado deshace el "listo": hay que confirmarlo
      return { ok: true, sala };
    },

    marcarListo(codigo, id, listo = true) {
      const sala = salas.get(codigo);
      if (!sala || sala.empezada) return { ok: false, motivo: 'no se puede ahora' };
      const jugador = sala.jugadores.get(id);
      if (!jugador) return { ok: false, motivo: 'no estas en la sala' };
      jugador.listo = listo;
      return { ok: true, sala };
    },

    /**
     * ¿Puede empezar? Hace falta alguien en los dos bandos y que todos esten
     * listos. Un 1 contra 3 es legal: en familia no siempre sois pares.
     */
    puedeEmpezar(codigo) {
      const sala = salas.get(codigo);
      if (!sala || sala.empezada || sala.jugadores.size < 2) return false;
      const jugadores = [...sala.jugadores.values()];
      if (!jugadores.every((j) => j.listo)) return false;
      return BANDOS.every((b) => jugadores.some((j) => j.bando === b));
    },

    /**
     * Arranca. La semilla se decide UNA vez y se manda a todos: es lo unico que
     * necesitan para generar el mismo terreno y el mismo viento sin volver a
     * hablar entre ellos.
     */
    empezar(codigo) {
      const sala = salas.get(codigo);
      if (!sala) return { ok: false, motivo: 'esa sala no existe' };

      sala.empezada = true;
      sala.semilla = semillaDe(sala);

      // El orden se congela aqui. roster.js reparte los turnos a partir de esta
      // lista, asi que tiene que ser la misma en los seis moviles.
      const alineacion = [...sala.jugadores.values()].map((j) => ({
        id: j.id,
        nombre: j.nombre,
        bando: j.bando,
        camuflaje: j.camuflajes?.[j.bando] ?? null,
      }));

      return { ok: true, sala, semilla: sala.semilla, alineacion };
    },

    /**
     * Alguien se va. Si era el ultimo, la sala desaparece: no se guardan
     * partidas, no hay nada que persistir.
     */
    salir(codigo, id) {
      const sala = salas.get(codigo);
      if (!sala) return { ok: false };
      const jugador = sala.jugadores.get(id);
      sala.jugadores.delete(id);

      if (sala.jugadores.size === 0) {
        salas.delete(codigo);
        return { ok: true, jugador, salaVacia: true };
      }

      if (sala.anfitrion === id) sala.anfitrion = [...sala.jugadores.keys()][0];
      return { ok: true, jugador, sala, salaVacia: false };
    },

    estado: (codigo) => {
      const sala = salas.get(codigo);
      return sala ? publica(sala) : null;
    },
  };
}

/**
 * Traduce un mensaje del cliente en las acciones que hay que hacer.
 *
 * Devuelve a quien hay que mandar que, sin tocar ningun socket: el transporte
 * decide como se entrega. Asi esta funcion —que es donde vive toda la logica
 * del protocolo— se prueba entera sin red.
 */
export function atender(salas, sesion, bruto) {
  const comprobado = validar(bruto);
  if (!comprobado.ok) {
    return [{ para: 'uno', mensaje: mensaje(DICE.error, { motivo: comprobado.motivo }) }];
  }

  const responder = (m) => [{ para: 'uno', mensaje: m }];
  const difundir = (codigo, m) => ({ para: 'sala', codigo, mensaje: m });

  switch (bruto.tipo) {
    case PIDE.unir: {
      const r = salas.unir(bruto.sala, {
        id: sesion.id,
        nombre: bruto.nombre,
        camuflajes: bruto.camuflajes,
      });
      if (!r.ok) return responder(mensaje(DICE.error, { motivo: r.motivo }));

      sesion.sala = bruto.sala;
      sesion.bando = r.jugador.bando;
      return [difundir(bruto.sala, mensaje(DICE.sala, salas.estado(bruto.sala)))];
    }

    case PIDE.bando: {
      const r = salas.cambiarBando(sesion.sala, sesion.id, bruto.bando);
      if (!r.ok) return responder(mensaje(DICE.error, { motivo: r.motivo }));
      sesion.bando = bruto.bando;
      return [difundir(sesion.sala, mensaje(DICE.sala, salas.estado(sesion.sala)))];
    }

    case PIDE.listo: {
      const r = salas.marcarListo(sesion.sala, sesion.id, bruto.listo !== false);
      if (!r.ok) return responder(mensaje(DICE.error, { motivo: r.motivo }));

      const salidas = [difundir(sesion.sala, mensaje(DICE.sala, salas.estado(sesion.sala)))];
      if (salas.puedeEmpezar(sesion.sala)) {
        const arranque = salas.empezar(sesion.sala);
        salidas.push(
          difundir(
            sesion.sala,
            mensaje(DICE.empezar, {
              semilla: arranque.semilla,
              alineacion: arranque.alineacion,
            })
          )
        );
      }
      return salidas;
    }

    case PIDE.input: {
      // El servidor no mira que hace el input: lo reenvia sellado con quien lo
      // manda. Quien decide si es legal es la simulacion de cada movil, que
      // conoce las reglas; aqui solo se sabe de sobres, no de cartas.
      if (!sesion.sala) return responder(mensaje(DICE.error, { motivo: 'no estas en una sala' }));
      return [
        difundir(
          sesion.sala,
          mensaje(DICE.input, {
            de: sesion.id,
            paso: bruto.paso,
            accion: bruto.accion,
            anguloDeg: bruto.anguloDeg,
            potencia: bruto.potencia,
            avance: bruto.avance,
          })
        ),
      ];
    }

    case PIDE.checksum: {
      if (!sesion.sala) return [];
      const sala = salas.obtener(sesion.sala);
      if (!sala) return [];

      sala.huellas ??= new Map();
      const porTurno = sala.huellas.get(bruto.turno) ?? new Map();
      porTurno.set(sesion.id, bruto.huella);
      sala.huellas.set(bruto.turno, porTurno);

      const valores = new Set(porTurno.values());
      if (valores.size > 1 && porTurno.size === sala.jugadores.size) {
        // Dos moviles han calculado cosas distintas. No se puede arreglar desde
        // aqui —el servidor no sabe cual tiene razon porque no simula— pero
        // callarselo seria peor: la partida seguiria separandose en silencio.
        return [
          difundir(
            sesion.sala,
            mensaje(DICE.desincronia, {
              turno: bruto.turno,
              huellas: [...porTurno].map(([id, h]) => ({ id, huella: h })),
            })
          ),
        ];
      }
      return [];
    }

    default:
      return responder(mensaje(DICE.error, { motivo: `no se que es "${bruto.tipo}"` }));
  }
}
