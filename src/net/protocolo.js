/**
 * Que viaja por el cable.
 *
 * Viaja el INPUT, nunca el estado: angulo, potencia, reaccion. Nadie manda la
 * posicion del proyectil ni la altura del terreno, porque los seis moviles la
 * calculan igual a partir de la semilla. Un turno completo cabe en unos 60
 * bytes, y eso hace que la partida aguante una conexion mala.
 *
 * El servidor solo reparte estos mensajes. No los interpreta, no simula, y no
 * puede: aqui no hay nada que calcular.
 *
 * Modulo puro y compartido por cliente y servidor, asi que no importa nada del
 * juego ni del DOM.
 */

export const VERSION = 1;

/** Cliente -> servidor. */
export const PIDE = {
  unir: 'unir',        // entrar en una sala con un codigo
  bando: 'bando',      // elegir lado
  listo: 'listo',      // preparado para empezar
  input: 'input',      // una accion de juego
  checksum: 'checksum',// como me ha quedado la partida tras el turno
};

/** Servidor -> cliente. */
export const DICE = {
  sala: 'sala',          // estado de la sala: quien esta y en que bando
  empezar: 'empezar',    // semilla y alineacion definitiva
  input: 'input',        // el input de alguien, reenviado tal cual
  desincronia: 'desincronia', // dos moviles no calcularon lo mismo
  salio: 'salio',
  error: 'error',
};

/** Acciones de juego que un jugador puede mandar. */
export const ACCION = {
  disparo: 'disparo',   // { anguloDeg, potencia, avance }
  escudo: 'escudo',
  salto: 'salto',
};

/**
 * Pasos que se agenda un input hacia el futuro antes de aplicarlo.
 *
 * El disparo no lo necesita: abre el turno y nadie esta simulando. La reaccion
 * si, porque ocurre con el proyectil en el aire y los demas moviles ya han
 * avanzado pasos cuando llega el mensaje. Agendarla 30 pasos por delante
 * (250 ms) le da margen al viaje de ida y vuelta sin que el defensor note
 * retardo: la ventana entera dura 108 pasos.
 */
export const RETARDO_PASOS = 30;

const CODIGO_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
export const LARGO_CODIGO = 4;

/**
 * Codigo de sala legible en voz alta. Se generan con el rng que se le pase, asi
 * que el servidor decide de donde sale el azar y los tests pueden fijarlo.
 */
export function codigoDeSala(rng) {
  let salida = '';
  for (let i = 0; i < LARGO_CODIGO; i++) {
    salida += CODIGO_ALFABETO[Math.floor(rng() * CODIGO_ALFABETO.length)];
  }
  return salida;
}

export const codigoValido = (codigo) =>
  typeof codigo === 'string' &&
  codigo.length === LARGO_CODIGO &&
  [...codigo].every((c) => CODIGO_ALFABETO.includes(c));

/** Normaliza lo que teclea el jugador: minusculas y espacios sobran. */
export const normalizarCodigo = (texto) =>
  typeof texto === 'string' ? texto.trim().toUpperCase().replace(/\s+/g, '') : '';

export const mensaje = (tipo, datos = {}) => ({ v: VERSION, tipo, ...datos });

/**
 * Comprueba que lo que llega del cable es lo que dice ser.
 *
 * Todo mensaje entra por aqui antes de tocar nada. Un cliente manipulado no
 * puede colar un angulo de 400 grados ni una potencia de 50: no le serviria de
 * nada —cada movil simula por su cuenta y el resultado no cuadraria— pero si
 * podria tirar la partida de los demas, y eso hay que impedirlo.
 */
export function validar(bruto) {
  if (!bruto || typeof bruto !== 'object') return { ok: false, motivo: 'no es un objeto' };
  if (bruto.v !== VERSION) return { ok: false, motivo: `version ${bruto.v} distinta de ${VERSION}` };
  if (typeof bruto.tipo !== 'string') return { ok: false, motivo: 'sin tipo' };

  if (bruto.tipo === PIDE.unir) {
    if (!codigoValido(bruto.sala)) return { ok: false, motivo: 'codigo de sala invalido' };
    if (typeof bruto.nombre !== 'string' || !bruto.nombre.trim()) {
      return { ok: false, motivo: 'sin nombre' };
    }
    if (bruto.nombre.length > 16) return { ok: false, motivo: 'nombre demasiado largo' };
  }

  if (bruto.tipo === PIDE.bando && bruto.bando !== 'a' && bruto.bando !== 'b') {
    return { ok: false, motivo: 'bando invalido' };
  }

  if (bruto.tipo === PIDE.input) {
    const paso = bruto.paso;
    if (!Number.isInteger(paso) || paso < 0) return { ok: false, motivo: 'paso invalido' };
    if (!Object.values(ACCION).includes(bruto.accion)) {
      return { ok: false, motivo: 'accion desconocida' };
    }
    if (bruto.accion === ACCION.disparo) {
      const { anguloDeg, potencia, avance } = bruto;
      if (!Number.isFinite(anguloDeg) || anguloDeg < 0 || anguloDeg > 180) {
        return { ok: false, motivo: 'angulo fuera de rango' };
      }
      if (!Number.isFinite(potencia) || potencia < 0 || potencia > 1) {
        return { ok: false, motivo: 'potencia fuera de rango' };
      }
      // El avance viaja con el disparo y no como mensaje aparte: es lo que el
      // jugador ha decidido durante SU turno, y no hay nadie simulando
      // mientras. Un mensaje por cada paso de oruga seria cable para nada.
      // El limite es generoso a proposito —lo que de verdad recorta es el
      // deposito, y eso lo recalcula cada movil con la misma funcion pura—;
      // esto solo cierra la puerta a un numero absurdo.
      if (avance !== undefined && (!Number.isFinite(avance) || Math.abs(avance) > 200)) {
        return { ok: false, motivo: 'avance fuera de rango' };
      }
    }
  }

  return { ok: true };
}

/**
 * Huella del estado tras un turno, para cazar desincronias.
 *
 * Si dos moviles calculan distinto, esto lo dice en el turno siguiente en vez
 * de dejar que la partida se vaya separando en silencio hasta que uno ve morir
 * a alguien que en el otro sigue vivo.
 *
 * El heightmap se muestrea en vez de leerlo entero: 1400 columnas por turno y
 * por jugador es mucho cable para lo que aporta, y una divergencia real nunca
 * afecta a una sola columna.
 */
export function huella({ alturas, vidas, turno }, muestras = 64) {
  let h = 2166136261 >>> 0;

  const mezclar = (valor) => {
    // Redondeo a milesimas antes de mezclar: dos maquinas pueden diferir en el
    // ultimo bit de un double sin que eso sea una divergencia de verdad.
    const entero = Math.round(valor * 1000) | 0;
    h ^= entero & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= (entero >> 8) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= (entero >> 16) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  };

  mezclar(turno);
  for (const v of vidas) mezclar(v);

  const salto = Math.max(1, Math.floor(alturas.length / muestras));
  for (let i = 0; i < alturas.length; i += salto) mezclar(alturas[i]);

  return h >>> 0;
}
