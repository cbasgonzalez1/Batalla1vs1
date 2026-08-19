import {
  cifrarClave, claveCorrecta, huellaDe, normalizarCorreo, nuevaSesion, validarRegistro,
} from './auth.js';

/**
 * La API de cuentas, tienda y progreso. Sin HTTP.
 *
 * Recibe un metodo, una ruta y un cuerpo, y devuelve `{ estado, cuerpo }`.
 * `server/index.js` solo traduce eso a una respuesta — el mismo reparto que hay
 * entre `salas.js` e `index.js`, y por el mismo motivo: aqui es donde estan los
 * errores que importan y asi se prueban sin abrir un puerto.
 *
 * Nada de esto toca una partida en curso. Se escribe cuando alguien se registra,
 * cuando elige un camuflaje y cuando un combate TERMINA.
 */

/** Intentos de contrasena fallidos antes de cerrar el grifo, y cuanto dura. */
const INTENTOS = 8;
const CASTIGO_MS = 10 * 60 * 1000;

const ok = (cuerpo) => ({ estado: 200, cuerpo });
const no = (estado, motivo) => ({ estado, cuerpo: { error: motivo } });

/** Lo que se le manda al cliente de un jugador. Nunca la clave, nunca el correo
 *  de otro. */
const publico = (j) => ({
  id: j.id,
  nombre: j.nombre,
  correo: j.correo,
  camuflajes: { a: j.camuflaje_a, b: j.camuflaje_b },
});

/**
 * @param {object} opciones
 * @param {object} opciones.repo  `db/repositorio.js`
 * @param {string[]} opciones.deSerie  camuflajes que se regalan al registrarse
 * @param {() => number} [opciones.ahora]  inyectable para probar el castigo
 */
export function crearApi({ repo, deSerie = [], ahora = () => Date.now() }) {
  /** Intentos fallidos por correo. En memoria: si el proceso cae, se perdona. */
  const fallos = new Map();

  const castigado = (correo) => {
    const f = fallos.get(correo);
    if (!f) return false;
    if (ahora() - f.desde > CASTIGO_MS) {
      fallos.delete(correo);
      return false;
    }
    return f.veces >= INTENTOS;
  };

  const apuntarFallo = (correo) => {
    const f = fallos.get(correo);
    if (!f || ahora() - f.desde > CASTIGO_MS) fallos.set(correo, { veces: 1, desde: ahora() });
    else f.veces += 1;
  };

  /** Quien pide, si trae una sesion viva. `null` si no. */
  const quien = async (token) => (token ? repo.jugadorDeSesion(huellaDe(token)) : null);

  return {
    /**
     * @param {string} metodo
     * @param {string} ruta  sin query
     * @param {object} entrada  { cuerpo, token, dispositivo }
     */
    async atender(metodo, ruta, { cuerpo = {}, token = null, dispositivo = null } = {}) {
      // ── registro ────────────────────────────────────────────────────
      if (metodo === 'POST' && ruta === '/api/registro') {
        const motivo = validarRegistro(cuerpo);
        if (motivo) return no(400, motivo);

        const correo = normalizarCorreo(cuerpo.correo);
        if (await repo.porCorreo(correo)) return no(409, 'ese correo ya tiene cuenta');

        const jugador = await repo.crearJugador({
          correo,
          clave: await cifrarClave(cuerpo.clave),
          nombre: String(cuerpo.nombre).trim(),
          deSerie,
        });
        const sesion = nuevaSesion();
        await repo.abrirSesion({ ...sesion, jugadorId: jugador.id, dispositivo });
        return ok({ token: sesion.token, jugador: publico({ ...jugador, correo }) });
      }

      // ── entrar ──────────────────────────────────────────────────────
      if (metodo === 'POST' && ruta === '/api/sesion') {
        const correo = normalizarCorreo(cuerpo.correo);
        if (castigado(correo)) return no(429, 'demasiados intentos; prueba en un rato');

        const jugador = await repo.porCorreo(correo);
        // Mismo mensaje para «no existe» y «clave mala»: distinguirlos regala una
        // lista de correos registrados a quien pruebe uno por uno.
        const vale = jugador && await claveCorrecta(String(cuerpo.clave ?? ''), jugador.clave);
        if (!vale) {
          apuntarFallo(correo);
          return no(401, 'correo o contrasena incorrectos');
        }
        fallos.delete(correo);

        const sesion = nuevaSesion();
        await repo.abrirSesion({ ...sesion, jugadorId: jugador.id, dispositivo });
        await repo.verVisto(jugador.id);
        return ok({ token: sesion.token, jugador: publico(jugador) });
      }

      // ── salir ───────────────────────────────────────────────────────
      if (metodo === 'DELETE' && ruta === '/api/sesion') {
        if (token) await repo.cerrarSesion(huellaDe(token));
        return ok({ fuera: true });
      }

      // ── quien soy: cuenta, desbloqueos y progreso de una tacada ──────
      if (metodo === 'GET' && ruta === '/api/yo') {
        const jugador = await quien(token);
        if (!jugador) return no(401, 'hace falta iniciar sesion');
        const [desbloqueos, progreso] = await Promise.all([
          repo.desbloqueosDe(jugador.id),
          repo.progresoDe(jugador.id),
        ]);
        return ok({
          jugador: publico(jugador),
          desbloqueos: desbloqueos.map((d) => d.camuflaje_id),
          progreso: progreso ?? null,
        });
      }

      // ── tienda ──────────────────────────────────────────────────────
      // Se puede mirar sin cuenta: ensenar los camuflajes es justo lo que dira
      // si merece la pena implementar el pago (`docs/PLATAFORMA.md` §2).
      if (metodo === 'GET' && ruta === '/api/tienda') {
        const jugador = await quien(token);
        const catalogo = await repo.catalogo();
        const mios = jugador
          ? new Set((await repo.desbloqueosDe(jugador.id)).map((d) => d.camuflaje_id))
          : new Set();
        return ok({
          // `comprable: false` en todos, y a proposito: el catalogo existe antes
          // que la caja. Cuando llegue el pago, esto pasa a mirar la tienda.
          camuflajes: catalogo.map((c) => ({ ...c, tengo: mios.has(c.id), comprable: false })),
          pagoActivo: false,
        });
      }

      // ── elegir camuflaje ────────────────────────────────────────────
      if (metodo === 'PUT' && ruta === '/api/camuflaje') {
        const jugador = await quien(token);
        if (!jugador) return no(401, 'hace falta iniciar sesion');
        const bando = cuerpo.bando === 'b' ? 'b' : 'a';
        const elegido = await repo.elegirCamuflaje(jugador.id, bando, String(cuerpo.id ?? ''));
        if (!elegido) return no(403, 'ese camuflaje no es tuyo, o no es de ese bando');
        return ok({ camuflajes: { a: elegido.camuflaje_a, b: elegido.camuflaje_b } });
      }

      // ── guardar un combate terminado ────────────────────────────────
      if (metodo === 'POST' && ruta === '/api/partida') {
        if (!cuerpo?.semilla) return no(400, 'una partida sin semilla no se puede repetir');
        const jugador = await quien(token);
        // Los participantes con cuenta se identifican POR LA SESION del que
        // guarda, nunca por un id que venga en el cuerpo: si no, cualquiera
        // suma partidas ganadas a la cuenta de otro.
        const participantes = (cuerpo.participantes ?? []).map((p) => ({
          ...p,
          jugadorId: p.yo && jugador ? jugador.id : null,
        }));
        const { id } = await repo.guardarPartida({ ...cuerpo, participantes });
        return ok({ id });
      }

      // ── historial ───────────────────────────────────────────────────
      if (metodo === 'GET' && ruta === '/api/historial') {
        const jugador = await quien(token);
        if (!jugador) return no(401, 'hace falta iniciar sesion');
        return ok({ partidas: await repo.historialDe(jugador.id, cuerpo.limite ?? 20) });
      }

      return no(404, 'esa ruta no existe');
    },
  };
}
