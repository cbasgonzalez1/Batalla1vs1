/**
 * El lado del navegador de las cuentas: registro, sesion, tienda y progreso.
 *
 * Recibe `traer` y `almacen` en vez de usar `fetch` y `localStorage` a pelo, y
 * por eso se prueba entero sin navegador — igual que `salas.js` se prueba sin
 * socket. Es la misma idea de siempre: separar lo que puede equivocarse de lo
 * que solo transporta.
 *
 * ── NUNCA LANZA ─────────────────────────────────────────────────────────
 * Todo devuelve `{ ok, ... }` o `{ ok: false, error }`. Un servidor caido, un
 * movil sin cobertura o un token caducado tienen que dejar una pantalla con un
 * mensaje, no una excepcion sin recoger que deje el juego en negro. Es la misma
 * regla que `decodificar()` en el replay: lo que llega de fuera puede venir roto.
 *
 * ── EL TOKEN VIVE AQUI Y EN NINGUN SITIO MAS ────────────────────────────
 * Se guarda en `localStorage` para no pedir la contrasena en cada arranque, y se
 * borra en cuanto el servidor contesta 401: un token caducado que se queda
 * guardado convierte cada arranque en un error.
 */

const LLAVE = 'artilleria.token';

/** Lo que se guarda del jugador entre arranques, para no parpadear al abrir. */
const LLAVE_NOMBRE = 'artilleria.nombre';

export function crearCuenta({
  base = '',
  traer = (...a) => fetch(...a),
  almacen = globalThis.localStorage ?? null,
} = {}) {
  const leer = (k) => { try { return almacen?.getItem(k) ?? null; } catch { return null; } };
  const escribir = (k, v) => {
    try {
      if (v === null) almacen?.removeItem(k);
      else almacen?.setItem(k, v);
    } catch { /* modo incognito: se juega igual, sin recordar la sesion */ }
  };

  let token = leer(LLAVE);

  const estado = {
    jugador: null,
    desbloqueos: [],
    progreso: null,
    /** El nombre recordado, para saludar antes de que conteste el servidor. */
    nombre: leer(LLAVE_NOMBRE),
  };

  async function pedir(metodo, ruta, cuerpo) {
    let respuesta;
    try {
      respuesta = await traer(`${base}${ruta}`, {
        method: metodo,
        headers: {
          ...(cuerpo ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
      });
    } catch {
      return { ok: false, error: 'sinRed' };
    }

    let datos = {};
    try {
      datos = await respuesta.json();
    } catch { /* un 500 puede no traer JSON */ }

    if (respuesta.status === 401 && token) {
      // El token ya no vale. Se tira aqui y no en la pantalla: si no, cada
      // arranque empieza con un error que el jugador no puede arreglar.
      token = null;
      escribir(LLAVE, null);
      estado.jugador = null;
    }
    if (!respuesta.ok) return { ok: false, estado: respuesta.status, error: datos.error ?? 'fallo' };
    return { ok: true, ...datos };
  }

  const guardarSesion = (r) => {
    if (!r.ok) return r;
    token = r.token;
    escribir(LLAVE, token);
    escribir(LLAVE_NOMBRE, r.jugador?.nombre ?? null);
    estado.jugador = r.jugador ?? null;
    estado.nombre = r.jugador?.nombre ?? estado.nombre;
    return r;
  };

  return {
    estado,

    get hayToken() { return Boolean(token); },
    get dentro() { return Boolean(estado.jugador); },

    registro: async ({ correo, clave, nombre }) =>
      guardarSesion(await pedir('POST', '/api/registro', { correo, clave, nombre })),

    entrar: async ({ correo, clave }) =>
      guardarSesion(await pedir('POST', '/api/sesion', { correo, clave })),

    async salir() {
      await pedir('DELETE', '/api/sesion');
      token = null;
      escribir(LLAVE, null);
      estado.jugador = null;
      estado.desbloqueos = [];
      estado.progreso = null;
      return { ok: true };
    },

    /**
     * Recupera la sesion guardada. Se llama al arrancar.
     *
     * Sin token no pregunta: ahorra una peticion en el arranque de quien no ha
     * entrado nunca, que es justo cuando la pantalla tiene que aparecer rapido.
     */
    async recuperar() {
      if (!token) return { ok: false, error: 'sinSesion' };
      const r = await pedir('GET', '/api/yo');
      if (!r.ok) return r;
      estado.jugador = r.jugador;
      estado.desbloqueos = r.desbloqueos ?? [];
      estado.progreso = r.progreso ?? null;
      estado.nombre = r.jugador?.nombre ?? estado.nombre;
      escribir(LLAVE_NOMBRE, estado.nombre);
      return r;
    },

    tienda: () => pedir('GET', '/api/tienda'),

    async elegirCamuflaje(bando, id) {
      const r = await pedir('PUT', '/api/camuflaje', { bando, id });
      if (r.ok && estado.jugador) estado.jugador.camuflajes = r.camuflajes;
      return r;
    },

    /**
     * Guarda un combate terminado.
     *
     * Se llama al declarar victoria y NO se espera: si falla, se pierde una
     * estadistica y el jugador ni se entera. Lo que no puede pasar es que la
     * pantalla de victoria se quede esperando a la red.
     */
    guardarPartida: (partida) => pedir('POST', '/api/partida', partida),

    historial: () => pedir('GET', '/api/historial'),
  };
}
