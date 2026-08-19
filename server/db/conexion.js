import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * La conexion a Postgres, y el arranque del esquema.
 *
 * ── SIN BASE DE DATOS, EL JUEGO SIGUE ───────────────────────────────────
 * Si no hay `DATABASE_URL`, esto devuelve `null` y el servidor arranca igual:
 * salas, partidas y todo lo que ya funcionaba. Lo unico que se apaga son las
 * cuentas, la tienda y el progreso.
 *
 * No es comodidad: `pnpm dev` y las seis verificaciones de navegador
 * (`verificar:sala`, `verificar:red`, `verificar:3v3`...) tienen que poder
 * correr sin levantar un Postgres, o dejan de correrse. Un bucle de pruebas que
 * pide infraestructura es un bucle de pruebas que nadie ejecuta.
 */

const { Pool } = pg;

const ESQUEMA = fileURLToPath(new URL('./esquema.sql', import.meta.url));

/**
 * @returns {import('pg').Pool|null} null si no hay base de datos configurada
 */
export function crearPozo(url = process.env.DATABASE_URL) {
  if (!url) return null;
  return new Pool({
    connectionString: url,
    // Diez conexiones por proceso. El trafico de este juego es un puñado de
    // consultas por partida —entrar, guardar el combate, sumar el progreso— y
    // no un panel de control: con mas, lo unico que crece es la cuenta de RAM
    // de Postgres.
    max: Number(process.env.DB_MAX_CONEXIONES ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // En Dokploy la base va en la misma red interna y no hay TLS por medio; con
    // un proveedor gestionado hay que ponerlo a mano en la propia URL.
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
}

/**
 * Aplica el esquema. Es idempotente: se puede llamar en cada arranque.
 *
 * Va en una transaccion para que dos instancias arrancando a la vez no dejen el
 * esquema a medias — la segunda espera, ve las tablas ya creadas y no hace nada.
 */
export async function migrar(pozo) {
  const sql = await readFile(ESQUEMA, 'utf8');
  const cliente = await pozo.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(sql);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Envuelve el pozo en la unica funcion que el resto del servidor necesita.
 *
 * Los repositorios reciben ESTO y no el pozo: asi se prueban con una funcion
 * falsa que devuelve filas, sin Postgres delante (`tests/server/db.test.js`).
 */
export const consultarCon = (pozo) => async (texto, valores = []) => {
  const { rows } = await pozo.query(texto, valores);
  return rows;
};

/**
 * Corre varias consultas como una sola transaccion.
 *
 * Hace falta en dos sitios y en los dos por el mismo motivo: guardar una partida
 * son varias filas —la partida, cada participacion y el progreso de cada uno— y
 * media partida guardada es peor que ninguna.
 */
export const transaccionCon = (pozo) => async (trabajo) => {
  const cliente = await pozo.connect();
  const consultar = async (texto, valores = []) => (await cliente.query(texto, valores)).rows;
  try {
    await cliente.query('BEGIN');
    const salida = await trabajo(consultar);
    await cliente.query('COMMIT');
    return salida;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
};
