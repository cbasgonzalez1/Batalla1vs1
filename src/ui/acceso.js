/**
 * La pantalla de entrada: crear cuenta o entrar.
 *
 * Ocupa toda la pantalla, como la sala, porque mientras no hay sesion no hay
 * nada que mirar detras.
 *
 * ── CUANDO APARECE, Y CUANDO NO ─────────────────────────────────────────
 * Solo si el servidor TIENE cuentas. Un servidor sin `DATABASE_URL` —el de
 * `pnpm dev` y el de las seis verificaciones de navegador— contesta que no las
 * tiene y esta pantalla no llega a montarse: el juego arranca directo, como
 * siempre. No es una puerta de atras al login; es que el bucle de pruebas no
 * puede depender de levantar un Postgres (`docs/PLATAFORMA.md` §0.3).
 *
 * Solo pinta y recoge pulsaciones. Quien habla con el servidor es
 * `src/net/cuenta.js`, y quien decide si una contrasena vale es el servidor:
 * aqui no se duplica ninguna regla, para que no haya dos versiones de la verdad.
 */

/** Lo minimo que se comprueba antes de molestar al servidor. */
export function revisarFormulario({ modo, correo, clave, nombre }, t) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(correo ?? '').trim())) return t('correoMal');
  if (String(clave ?? '').length < 8) return t('claveCorta');
  if (modo === 'registro' && String(nombre ?? '').trim().length < 2) return t('nombreMal');
  return null;
}

/**
 * Traduce el error del servidor a algo que se pueda leer.
 *
 * El servidor contesta en su idioma y con su vocabulario; la pantalla habla el
 * del movil. Lo que no se reconoce se enseña tal cual, que es mejor que un
 * «error inesperado» que no dice nada.
 */
export function mensajeDeError(error, t) {
  if (error === 'sinRed') return t('sinRed');
  if (error === 'ese correo ya tiene cuenta') return t('correoOcupado');
  if (error === 'correo o contrasena incorrectos') return t('accesoMal');
  if (String(error).startsWith('demasiados intentos')) return t('demasiadosIntentos');
  return error || t('sinRed');
}

export function crearAcceso({ cuenta, t, alEntrar, documento = document }) {
  const $ = (id) => documento.getElementById(id);
  const el = {
    panel: $('acceso'),
    nombre: $('ac-nombre'),
    filaNombre: $('ac-fila-nombre'),
    correo: $('ac-correo'),
    clave: $('ac-clave'),
    enviar: $('ac-enviar'),
    cambiar: $('ac-cambiar'),
    aviso: $('ac-aviso'),
    titulo: $('ac-titulo'),
  };
  if (!el.panel) return null;

  let modo = 'entrar';
  let enviando = false;

  const avisar = (texto, mal = true) => {
    el.aviso.textContent = texto ?? '';
    el.aviso.classList.toggle('mal', Boolean(texto) && mal);
  };

  function pintar() {
    const registro = modo === 'registro';
    el.titulo.textContent = t(registro ? 'crearCuenta' : 'entrarTitulo');
    el.filaNombre.hidden = !registro;
    el.enviar.textContent = t(registro ? 'crearCuenta' : 'entrar');
    el.cambiar.textContent = t(registro ? 'yaTengoCuenta' : 'noTengoCuenta');
    avisar(null);
  }

  async function enviar() {
    if (enviando) return;
    const datos = {
      modo,
      correo: el.correo.value.trim(),
      clave: el.clave.value,
      nombre: el.nombre.value.trim(),
    };
    const mal = revisarFormulario(datos, t);
    if (mal) return avisar(mal);

    enviando = true;
    el.enviar.disabled = true;
    avisar(t('enviando'), false);

    const r = modo === 'registro' ? await cuenta.registro(datos) : await cuenta.entrar(datos);

    enviando = false;
    el.enviar.disabled = false;
    if (!r.ok) return avisar(mensajeDeError(r.error, t));

    // La contrasena no se queda en el DOM ni un cuadro de mas.
    el.clave.value = '';
    await cuenta.recuperar();
    api.ocultar();
    alEntrar?.();
  }

  el.enviar.addEventListener('click', enviar);
  el.cambiar.addEventListener('click', () => {
    modo = modo === 'registro' ? 'entrar' : 'registro';
    pintar();
  });
  for (const campo of [el.correo, el.clave, el.nombre]) {
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enviar();
    });
  }

  const api = {
    mostrar() {
      pintar();
      if (cuenta.estado.nombre) el.nombre.value = cuenta.estado.nombre;
      el.panel.classList.add('on');
      // El foco al primer campo vacio: en un movil eso es abrir el teclado
      // donde toca en vez de obligar a un toque mas.
      (el.correo.value ? el.clave : el.correo).focus();
    },
    ocultar() {
      el.panel.classList.remove('on');
    },
    get visible() {
      return el.panel.classList.contains('on');
    },
  };
  return api;
}
