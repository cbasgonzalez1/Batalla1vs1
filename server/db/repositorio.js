import { randomUUID } from 'node:crypto';

/**
 * Todas las consultas del juego, en un sitio.
 *
 * Recibe `consultar` y `transaccion` en vez del pozo de Postgres, y por eso se
 * prueba entero con una funcion falsa que devuelve filas — igual que
 * `server/salas.js` se prueba sin abrir un socket. Es la misma idea: separar lo
 * que se puede equivocar de lo que solo transporta.
 *
 * Nada de aqui sabe nada de HTTP ni de WebSocket, y nada de aqui entra en una
 * partida en curso: se escribe cuando alguien se registra, cuando elige un
 * camuflaje y cuando un combate TERMINA.
 */

/**
 * @param {object} opciones
 * @param {(sql: string, valores?: unknown[]) => Promise<object[]>} opciones.consultar
 * @param {(trabajo: Function) => Promise<unknown>} opciones.transaccion
 */
export function crearRepositorio({ consultar, transaccion }) {
  const uno = async (sql, valores) => (await consultar(sql, valores))[0] ?? null;

  return {
    // ── catalogo ────────────────────────────────────────────────────────

    /**
     * Vuelca el catalogo de `src/art/vehiculo/camuflajes.js` en la tabla.
     *
     * Se hace en cada arranque y machaca lo que hubiera: la fuente de verdad es
     * el modulo de arte, no la base de datos. Un color que solo viviera aqui
     * dejaria de ser una decision y pasaria a ser un accidente — que es
     * exactamente lo que `AGENTS.md` prohibe para cualquier numero de arte.
     *
     * `activo = false` para lo que ya no este en el modulo: retirarlo de la
     * tienda no puede borrar la fila, porque hay desbloqueos apuntando a ella.
     */
    async sembrarCatalogo(camuflajes) {
      const ids = camuflajes.map((c) => c.id);
      await consultar('UPDATE camuflaje SET activo = false WHERE NOT (id = ANY($1))', [ids]);
      for (const [orden, c] of camuflajes.entries()) {
        await consultar(
          `INSERT INTO camuflaje (id, bando, nombre, base, centimos, activo, orden)
           VALUES ($1, $2, $3, $4, $5, true, $6)
           ON CONFLICT (id) DO UPDATE SET
             bando = EXCLUDED.bando, nombre = EXCLUDED.nombre, base = EXCLUDED.base,
             centimos = EXCLUDED.centimos, activo = true, orden = EXCLUDED.orden`,
          [c.id, c.bando, c.nombre, c.base, c.centimos, orden],
        );
      }
    },

    catalogo: () =>
      consultar(
        `SELECT id, bando, nombre, base, centimos FROM camuflaje
         WHERE activo ORDER BY orden`,
      ),

    // ── cuenta ──────────────────────────────────────────────────────────

    porCorreo: (correo) =>
      uno('SELECT * FROM jugador WHERE correo = $1', [correo]),

    porId: (id) =>
      uno('SELECT id, correo, nombre, camuflaje_a, camuflaje_b, idioma FROM jugador WHERE id = $1', [id]),

    /**
     * Crea la cuenta, le regala los camuflajes de serie y le abre el progreso.
     *
     * En una transaccion: una cuenta sin sus camuflajes de serie es una cuenta
     * que arranca sin poder pintar el tanque.
     */
    async crearJugador({ correo, clave, nombre, deSerie = [] }) {
      return transaccion(async (c) => {
        const id = randomUUID();
        const [jugador] = await c(
          `INSERT INTO jugador (id, correo, clave, nombre, camuflaje_a, camuflaje_b)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, correo, nombre, camuflaje_a, camuflaje_b`,
          [
            id, correo, clave, nombre,
            deSerie.find((x) => x.startsWith('a-')) ?? null,
            deSerie.find((x) => x.startsWith('b-')) ?? null,
          ],
        );
        for (const camuflaje of deSerie) {
          await c(
            `INSERT INTO desbloqueo (jugador_id, camuflaje_id, origen) VALUES ($1, $2, 'serie')
             ON CONFLICT DO NOTHING`,
            [id, camuflaje],
          );
        }
        await c('INSERT INTO progreso (jugador_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
        return jugador;
      });
    },

    // ── sesion ──────────────────────────────────────────────────────────

    abrirSesion: ({ id, jugadorId, huella, caduca, dispositivo }) =>
      consultar(
        `INSERT INTO sesion (id, jugador_id, huella, caduca, dispositivo)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, jugadorId, huella, caduca, dispositivo ?? null],
      ),

    /**
     * El jugador de un token, si la sesion sigue viva.
     *
     * La caducidad se comprueba en SQL y no en JS a proposito: asi no hay dos
     * relojes que puedan discrepar, y el que manda es el de la base de datos.
     */
    jugadorDeSesion: (huella) =>
      uno(
        `SELECT j.id, j.correo, j.nombre, j.camuflaje_a, j.camuflaje_b, j.idioma
         FROM sesion s JOIN jugador j ON j.id = s.jugador_id
         WHERE s.huella = $1 AND s.caduca > now()`,
        [huella],
      ),

    cerrarSesion: (huella) => consultar('DELETE FROM sesion WHERE huella = $1', [huella]),

    cerrarTodas: (jugadorId) => consultar('DELETE FROM sesion WHERE jugador_id = $1', [jugadorId]),

    /** Se llama al arrancar. Las sesiones caducadas no se limpian solas. */
    barrerSesiones: () => consultar('DELETE FROM sesion WHERE caduca <= now()'),

    verVisto: (id) => consultar('UPDATE jugador SET visto = now() WHERE id = $1', [id]),

    // ── tienda ──────────────────────────────────────────────────────────

    desbloqueosDe: (jugadorId) =>
      consultar('SELECT camuflaje_id, origen FROM desbloqueo WHERE jugador_id = $1', [jugadorId]),

    /**
     * Elige el camuflaje de un bando. Solo si lo tiene desbloqueado.
     *
     * La comprobacion va DENTRO del UPDATE, con un EXISTS: hacerla en JS y
     * escribir despues deja una carrera por la que dos peticiones a la vez
     * pueden colar un camuflaje que se acaba de retirar.
     */
    async elegirCamuflaje(jugadorId, bando, camuflajeId) {
      const columna = bando === 'b' ? 'camuflaje_b' : 'camuflaje_a';
      const filas = await consultar(
        `UPDATE jugador SET ${columna} = $2
         WHERE id = $1 AND EXISTS (
           SELECT 1 FROM desbloqueo d
           JOIN camuflaje c ON c.id = d.camuflaje_id
           WHERE d.jugador_id = $1 AND d.camuflaje_id = $2 AND c.bando = $3
         )
         RETURNING camuflaje_a, camuflaje_b`,
        [jugadorId, camuflajeId, bando === 'b' ? 'b' : 'a'],
      );
      return filas[0] ?? null;
    },

    /**
     * Apunta una compra y desbloquea, en una sola transaccion.
     *
     * Todavia no se usa: el pago es una funcion posterior (`PLATAFORMA.md` §5.2).
     * Esta escrito ya porque el orden importa — desbloquear sin dejar constancia
     * de por que es lo que hace imposible atender una reclamacion.
     *
     * El recibo es unico por tienda, asi que reenviar el mismo no desbloquea dos
     * veces ni cobra dos veces: el conflicto lo resuelve la base de datos.
     */
    async canjearCompra({ jugadorId, camuflajeId, tienda, recibo, centimos, moneda = 'EUR' }) {
      return transaccion(async (c) => {
        const [compra] = await c(
          `INSERT INTO compra (id, jugador_id, camuflaje_id, tienda, recibo, estado, centimos, moneda, validada)
           VALUES ($1, $2, $3, $4, $5, 'validada', $6, $7, now())
           ON CONFLICT (tienda, recibo) DO NOTHING
           RETURNING id`,
          [randomUUID(), jugadorId, camuflajeId, tienda, recibo, centimos, moneda],
        );
        if (!compra) return { ok: false, motivo: 'ese recibo ya se canjeo' };
        await c(
          `INSERT INTO desbloqueo (jugador_id, camuflaje_id, origen, compra_id)
           VALUES ($1, $2, 'compra', $3) ON CONFLICT DO NOTHING`,
          [jugadorId, camuflajeId, compra.id],
        );
        return { ok: true, compra: compra.id };
      });
    },

    // ── partidas ────────────────────────────────────────────────────────

    /**
     * Guarda un combate TERMINADO, entero.
     *
     * «Entero» es literal y sale gratis: como la simulacion es determinista,
     * `repeticion` —semilla y lista de tiros, el mismo formato del enlace que ya
     * se comparte— reconstruye el combate golpe a golpe. No hay que guardar el
     * terreno, ni las vidas turno a turno, ni donde cayo cada proyectil.
     *
     * Y el progreso se suma AQUI, en la misma transaccion: sumarlo despues deja
     * partidas guardadas que no cuentan para nadie en cuanto algo falle en medio.
     */
    async guardarPartida(p) {
      return transaccion(async (c) => {
        const id = p.id ?? randomUUID();
        await c(
          `INSERT INTO partida (id, codigo_sala, semilla, teatro, suelo, repeticion, turnos, ganador, empezada, terminada)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()), now())
           ON CONFLICT (id) DO NOTHING`,
          [
            id, p.codigoSala ?? null, p.semilla, p.teatro ?? null, p.suelo ?? null,
            p.repeticion ?? null, p.turnos ?? 0, p.ganador ?? null, p.empezada ?? null,
          ],
        );

        for (const [puesto, quien] of (p.participantes ?? []).entries()) {
          await c(
            `INSERT INTO participacion
               (partida_id, puesto, jugador_id, bando, nombre, camuflaje_id, vida_final, disparos, aciertos, dano)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT DO NOTHING`,
            [
              id, puesto, quien.jugadorId ?? null, quien.bando, quien.nombre,
              quien.camuflajeId ?? null, quien.vidaFinal ?? 0, quien.disparos ?? 0,
              quien.aciertos ?? 0, quien.dano ?? 0,
            ],
          );

          if (!quien.jugadorId) continue;
          await c(
            `INSERT INTO progreso (jugador_id, partidas, ganadas, disparos, aciertos, dano, mejor_impacto)
             VALUES ($1, 1, $2, $3, $4, $5, $6)
             ON CONFLICT (jugador_id) DO UPDATE SET
               partidas = progreso.partidas + 1,
               ganadas = progreso.ganadas + $2,
               disparos = progreso.disparos + $3,
               aciertos = progreso.aciertos + $4,
               dano = progreso.dano + $5,
               mejor_impacto = GREATEST(progreso.mejor_impacto, $6),
               actualizado = now()`,
            [
              quien.jugadorId, quien.bando === p.ganador ? 1 : 0,
              quien.disparos ?? 0, quien.aciertos ?? 0, quien.dano ?? 0,
              quien.mejorImpacto ?? 0,
            ],
          );
        }
        return { id };
      });
    },

    progresoDe: (jugadorId) =>
      uno('SELECT * FROM progreso WHERE jugador_id = $1', [jugadorId]),

    /** Las ultimas partidas de alguien, con su enlace de repeticion. */
    historialDe: (jugadorId, limite = 20) =>
      consultar(
        `SELECT p.id, p.teatro, p.suelo, p.turnos, p.ganador, p.repeticion, p.terminada,
                v.bando, v.vida_final, v.disparos, v.aciertos, v.dano
         FROM participacion v JOIN partida p ON p.id = v.partida_id
         WHERE v.jugador_id = $1
         ORDER BY p.terminada DESC
         LIMIT $2`,
        [jugadorId, Math.min(100, Math.max(1, limite))],
      ),

    /**
     * Recalcula el progreso desde cero sumando el historial.
     *
     * `progreso` es una CACHE, y esta es la prueba: si alguna vez hay que
     * auditar partidas antes de contarlas —lo que obligaria una clasificacion
     * competitiva, `docs/PLATAFORMA.md` §4.4— se cambian los criterios aqui y se
     * recompone, sin migrar nada.
     */
    recomponerProgreso: (jugadorId) =>
      consultar(
        `INSERT INTO progreso (jugador_id, partidas, ganadas, disparos, aciertos, dano, mejor_impacto, actualizado)
         SELECT v.jugador_id,
                count(*),
                count(*) FILTER (WHERE v.bando = p.ganador),
                COALESCE(sum(v.disparos), 0),
                COALESCE(sum(v.aciertos), 0),
                COALESCE(sum(v.dano), 0),
                COALESCE(max(v.dano), 0),
                now()
         FROM participacion v JOIN partida p ON p.id = v.partida_id
         WHERE v.jugador_id = $1
         GROUP BY v.jugador_id
         ON CONFLICT (jugador_id) DO UPDATE SET
           partidas = EXCLUDED.partidas, ganadas = EXCLUDED.ganadas,
           disparos = EXCLUDED.disparos, aciertos = EXCLUDED.aciertos,
           dano = EXCLUDED.dano, mejor_impacto = EXCLUDED.mejor_impacto,
           actualizado = now()`,
        [jugadorId],
      ),
  };
}
