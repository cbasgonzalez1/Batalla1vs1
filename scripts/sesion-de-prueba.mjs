/**
 * Deja un contexto de navegador con la sesion ya abierta, para que las
 * verificaciones puedan tocar la sala.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────
 * Con el servidor de cuentas levantado, la pantalla de acceso se pinta encima de
 * todo y `verificar:red`, `verificar:3v3` y `verificar:lobby` no pueden pulsar
 * un boton: el panel intercepta los clics. Sin ese servidor no aparece y esto no
 * hace nada.
 *
 * ── POR QUE NO UN `?invitado` QUE SE LA SALTE ───────────────────────────
 * Porque seria una puerta trasera de verdad, y estaria en produccion. Esto entra
 * POR DONDE SE ENTRA: pide un token a la misma API que usa el juego.
 *
 * ── Y POR QUE DESDE NODE Y NO DESDE LA PAGINA ───────────────────────────
 * Porque desde la pagina hay que adivinar si la cuenta ya existe: registrar y
 * caer en un 409, o entrar y caer en un 401. Cualquiera de los dos deja un error
 * en la consola del navegador, y hay verificaciones que fallan justamente porque
 * la consola tiene que salir limpia.
 *
 * Haciendolo aqui, el token se siembra en `localStorage` ANTES de cargar la
 * pagina: el juego arranca ya dentro, que ademas es el camino de alguien que
 * vuelve — el mas comun de todos.
 *
 * La cuenta es FIJA por guion —`verificacion-<quien>@artilleria.test`— para no
 * dejar una cuenta nueva en cada ejecucion.
 */

/** La misma para todas las cuentas de prueba. No protege nada. */
const CLAVE = 'verificacion-2026';

/** Donde vive el token en el navegador. Tiene que ser la de `net/cuenta.js`. */
const LLAVE = 'artilleria.token';

const API = process.env.API ?? 'http://localhost:8787';

/** Pide un token: entra si la cuenta existe, y si no, la crea. */
async function tokenDe(quien) {
  const correo = `verificacion-${quien}@artilleria.test`;
  const pedir = async (ruta, cuerpo) => {
    const r = await fetch(`${API}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: await r.json().catch(() => ({})) };
  };

  const entrada = await pedir('/api/sesion', { correo, clave: CLAVE });
  if (entrada.estado === 200) return entrada.datos.token;
  // 503 = este servidor esta levantado pero no tiene cuentas configuradas.
  if (entrada.estado === 503) return null;

  const alta = await pedir('/api/registro', {
    correo, clave: CLAVE, nombre: `V-${quien}`.slice(0, 24),
  });
  if (alta.estado === 200) return alta.datos.token;
  throw new Error(`no se pudo abrir sesion de prueba (${quien}): ${alta.datos.error ?? alta.estado}`);
}

/**
 * Prepara un contexto para que su primera pagina arranque con sesion.
 *
 * Se llama JUSTO DESPUES de `newContext()` y antes de navegar.
 *
 * @param {import('playwright').BrowserContext} ctx
 * @param {string} quien  identifica la cuenta: 'red-ana', 'trio-0'...
 * @returns {Promise<'sin-cuentas'|'dentro'>}
 */
export async function sesionEnContexto(ctx, quien) {
  let token;
  try {
    token = await tokenDe(quien);
  } catch (error) {
    // Sin servidor de cuentas no hay nada que preparar, y el juego arranca
    // directo: es el caso de `pnpm server` sin DATABASE_URL.
    if (error.cause?.code === 'ECONNREFUSED') return 'sin-cuentas';
    throw error;
  }
  if (!token) return 'sin-cuentas';

  await ctx.addInitScript(
    ([llave, valor]) => {
      try {
        window.localStorage.setItem(llave, valor);
      } catch { /* incognito: se juega igual, sin recordar la sesion */ }
    },
    [LLAVE, token],
  );
  return 'dentro';
}

/**
 * Pone unos camuflajes en la sesion abierta, sin pasar por la tienda.
 *
 * Para probar que el camuflaje VIAJA no hace falta comprarlo: lo que se mira es
 * si llega al otro movil, no como se consiguio.
 */
export async function ponerCamuflajes(pagina, camuflajes) {
  // Primero se espera a que el arranque de cuentas termine. Si no, `recuperar()`
  // llega despues con los camuflajes DE LA CUENTA y machaca estos: es una
  // carrera que se gana o se pierde segun lo rapida que vaya la maquina.
  await pagina.waitForFunction(() => Boolean(window.GAME?.cuentaLista), null, { timeout: 15000 });
  await pagina.evaluate(() => window.GAME.cuentaLista);
  await pagina.evaluate((c) => {
    const cuenta = window.GAME.cuenta;
    cuenta.estado.jugador = { ...(cuenta.estado.jugador ?? {}), camuflajes: c };
  }, camuflajes);
}
