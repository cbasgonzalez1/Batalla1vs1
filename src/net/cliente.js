import { PIDE, DICE, mensaje, normalizarCodigo, huella } from './protocolo.js';

/**
 * El lado del navegador: habla con el servidor y avisa de lo que pasa.
 *
 * No sabe nada del juego ni del DOM. Recibe la factoria del socket por
 * parametro, asi que se prueba entero sin abrir una conexion y sin levantar el
 * servidor — que es donde se esconden los errores de protocolo.
 */

export function crearCliente({
  url,
  crearSocket = (u) => new WebSocket(u),
  urlHttp = url.replace(/^ws/, 'http'),
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const oyentes = new Map();
  let socket = null;

  const estado = {
    conectado: false,
    sala: null,
    yo: null,       // el id lo asigna el servidor; llega con el primer 'sala'
    nombre: null,
    jugadores: [],
    empezada: false,
    semilla: null,
    alineacion: null,
  };

  const emitir = (tipo, datos) => {
    for (const fn of oyentes.get(tipo) ?? []) fn(datos);
  };

  const enviar = (m) => {
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(m));
    return true;
  };

  function recibir(bruto) {
    let m;
    try {
      m = JSON.parse(bruto);
    } catch {
      emitir(DICE.error, { motivo: 'el servidor mando algo que no es JSON' });
      return;
    }

    switch (m.tipo) {
      case DICE.sala:
        estado.sala = m.codigo;
        estado.jugadores = m.jugadores ?? [];
        estado.empezada = Boolean(m.empezada);
        // El servidor no dice "tu eres este", asi que se identifica por el
        // nombre con el que se entro. Es suficiente: la sala es de seis y los
        // nombres los teclean personas que estan hablando entre ellas.
        if (!estado.yo && estado.nombre) {
          const mio = estado.jugadores.find((j) => j.nombre === estado.nombre);
          if (mio) estado.yo = mio.id;
        }
        break;

      case DICE.empezar:
        estado.empezada = true;
        estado.semilla = m.semilla;
        estado.alineacion = m.alineacion;
        break;

      default:
        break;
    }

    emitir(m.tipo, m);
  }

  return {
    estado,

    on(tipo, fn) {
      if (!oyentes.has(tipo)) oyentes.set(tipo, []);
      oyentes.get(tipo).push(fn);
      return () => {
        const lista = oyentes.get(tipo);
        const i = lista.indexOf(fn);
        if (i >= 0) lista.splice(i, 1);
      };
    },

    conectar() {
      return new Promise((resolver, rechazar) => {
        socket = crearSocket(url);

        socket.onopen = () => {
          estado.conectado = true;
          emitir('conectado', {});
          resolver();
        };
        socket.onmessage = (evento) => recibir(evento.data);
        socket.onerror = () => {
          if (!estado.conectado) rechazar(new Error('no se pudo conectar'));
        };
        socket.onclose = () => {
          estado.conectado = false;
          emitir('cerrado', {});
        };
      });
    },

    /** Pide una sala nueva al servidor y devuelve su codigo. */
    async crearSala() {
      const respuesta = await fetchImpl(`${urlHttp}/sala`, { method: 'POST' });
      if (!respuesta.ok) throw new Error('el servidor no dio sala');
      const { codigo } = await respuesta.json();
      return codigo;
    },

    /**
     * Entra en una sala. `camuflajes` son los DOS elegidos en la tienda.
     *
     * Van los dos y no solo el del bando propio para que cambiar de lado dentro
     * de la sala no necesite otro mensaje: el servidor se queda con el que toca.
     * Es decoracion — no entra en la simulacion ni en la huella de estado.
     */
    unir(codigo, nombre, camuflajes = null) {
      estado.nombre = nombre;
      return enviar(mensaje(PIDE.unir, {
        sala: normalizarCodigo(codigo),
        nombre,
        ...(camuflajes ? { camuflajes } : {}),
      }));
    },

    elegirBando: (bando) => enviar(mensaje(PIDE.bando, { bando })),

    listo: (valor = true) => enviar(mensaje(PIDE.listo, { listo: valor })),

    disparar: (paso, anguloDeg, potencia, avance = 0) =>
      enviar(mensaje(PIDE.input, { paso, accion: 'disparo', anguloDeg, potencia, avance })),

    reaccionar: (paso, accion) => enviar(mensaje(PIDE.input, { paso, accion })),

    /** Huella del estado tras el turno, para que el servidor cace divergencias. */
    contrastar: (turno, datos) =>
      enviar(mensaje(PIDE.checksum, { turno, huella: huella(datos) })),

    cerrar() {
      socket?.close();
      socket = null;
    },
  };
}
