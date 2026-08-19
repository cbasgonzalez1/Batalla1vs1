import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Cuentas: contrasenas, tokens y validacion. Sin base de datos y sin red.
 *
 * Esta separado de `db/` por el mismo motivo por el que `salas.js` esta separado
 * de `index.js`: aqui es donde estan los errores que importan, y asi se prueban
 * sin levantar nada.
 *
 * ── DOS COSAS QUE NO SE GUARDAN ─────────────────────────────────────────
 *
 * 1. LA CONTRASENA. Se guarda `sal$derivada` de scrypt, con una sal distinta por
 *    jugador. Scrypt y no sha256 con vueltas: esta hecho para ser caro en
 *    memoria, que es lo unico que frena a quien se lleve una copia de la tabla.
 *    Y va en el `crypto` de Node — sin dependencias, que aqui cada una es una
 *    superficie mas que auditar.
 *
 * 2. EL TOKEN DE SESION. Se guarda su sha256. El token viaja al movil una vez y
 *    no vuelve a existir en el servidor: una copia de la tabla `sesion` no abre
 *    ni una sesion. Aqui sha256 a pelo SI vale y scrypt no: un token son 32
 *    bytes de azar, no una palabra que alguien pueda adivinar.
 */

const derivar = promisify(scrypt);

/** Coste de scrypt. 16384 es el minimo recomendado y tarda ~50 ms aqui. */
const COSTE = { N: 16384, r: 8, p: 1 };
const LARGO_CLAVE = 64;

/** Cuanto dura una sesion. Un mes: es un juego, no un banco. */
export const DIAS_DE_SESION = 30;

/** Lo minimo que se acepta. No hay reglas de mayusculas y simbolos a proposito:
 *  obligan a `Contrasena1!` y no a una contrasena buena. Manda el largo. */
export const MINIMO_CLAVE = 8;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normaliza un correo: minusculas y sin espacios alrededor. */
export const normalizarCorreo = (correo) => String(correo ?? '').trim().toLowerCase();

/**
 * Comprueba lo que llega de fuera antes de tocar la base de datos.
 *
 * @returns {string|null} el motivo del no, o null si vale
 */
export function validarRegistro({ correo, clave, nombre }) {
  const c = normalizarCorreo(correo);
  if (!CORREO.test(c)) return 'ese correo no vale';
  if (c.length > 254) return 'ese correo es demasiado largo';
  if (typeof clave !== 'string' || clave.length < MINIMO_CLAVE) {
    return `la contrasena necesita al menos ${MINIMO_CLAVE} caracteres`;
  }
  // Tope alto pero tope: scrypt sobre un megabyte de contrasena es una forma
  // barata de tumbar el servidor.
  if (clave.length > 200) return 'esa contrasena es demasiado larga';
  const n = String(nombre ?? '').trim();
  if (n.length < 2 || n.length > 24) return 'el nombre va de 2 a 24 caracteres';
  return null;
}

/** `sal$derivada`, las dos en hexadecimal. */
export async function cifrarClave(clave) {
  const sal = randomBytes(16);
  const derivada = await derivar(clave, sal, LARGO_CLAVE, COSTE);
  return `${sal.toString('hex')}$${derivada.toString('hex')}`;
}

/**
 * Si una contrasena corresponde a lo guardado.
 *
 * `timingSafeEqual` y no `===`: comparar dos hashes byte a byte con corte al
 * primer fallo filtra por el reloj cuantos bytes acerto el que prueba.
 */
export async function claveCorrecta(clave, guardado) {
  if (typeof guardado !== 'string' || !guardado.includes('$')) return false;
  const [salHex, derivadaHex] = guardado.split('$');
  let esperada;
  try {
    esperada = Buffer.from(derivadaHex, 'hex');
  } catch {
    return false;
  }
  if (esperada.length !== LARGO_CLAVE) return false;
  const calculada = await derivar(clave, Buffer.from(salHex, 'hex'), LARGO_CLAVE, COSTE);
  return timingSafeEqual(calculada, esperada);
}

/**
 * Un token de sesion nuevo: lo que se le manda al movil y lo que se guarda.
 *
 * Devuelve los dos por separado a proposito, para que quien llame no pueda
 * confundirse y guardar el token entero.
 */
export function nuevaSesion({ dias = DIAS_DE_SESION } = {}) {
  const token = randomBytes(32).toString('base64url');
  return {
    id: randomUUID(),
    token,
    huella: huellaDe(token),
    caduca: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
  };
}

/** El sha256 de un token. Es lo unico que llega a la base de datos. */
export const huellaDe = (token) => createHash('sha256').update(String(token)).digest('hex');

/**
 * Saca el token de la cabecera `Authorization: Bearer ...`.
 *
 * En cabecera y no en cookie: el juego se empaqueta para Android e iOS con un
 * WebView, y ahi las cookies de tercera parte son un campo de minas.
 */
export function tokenDe(cabeceras = {}) {
  const bruto = cabeceras.authorization ?? cabeceras.Authorization ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(String(bruto));
  return m ? m[1] : null;
}
