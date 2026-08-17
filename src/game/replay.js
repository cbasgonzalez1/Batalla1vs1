/**
 * Un combate entero en una URL.
 *
 * Se puede porque la simulacion es determinista: no hace falta guardar el
 * terreno, ni las vidas, ni donde cayo cada proyectil. Con la semilla y la
 * lista de tiros, cualquier movil reconstruye la partida golpe a golpe.
 *
 * Sirve para tres cosas que hoy no se pueden hacer: repetir un combate en otro
 * dispositivo, enseñarle a alguien la jugada que le salio bien, y reproducir un
 * fallo exacto en vez de describirlo.
 *
 * Formato, pensado para sobrevivir a que alguien lo pegue en un WhatsApp:
 *
 *   semilla~turno.turno.turno
 *   turno = ANGULO-POTENCIA[-Mavance][-Rpaso]
 *
 * Los numeros van en base 36 y en enteros (angulo x10, potencia x1000), que es
 * la precision con la que el juego los usa. Un turno ocupa 5 o 6 caracteres.
 *
 * Modulo puro.
 */

export const SEPARADOR_SEMILLA = '~';
export const SEPARADOR_TURNO = '.';
export const SEPARADOR_CAMPO = '-';

const REACCIONES = { escudo: 'E', salto: 'S' };
const REACCION_INVERSA = { E: 'escudo', S: 'salto' };

// El avance lleva signo y base 36 no lo admite, asi que se guarda desplazado.
// El campo solo aparece si el jugador se movio: un combate sin moverse ocupa
// exactamente lo mismo que antes de que existiera el avance.
const AVANCE_SESGO = 1000;
const AVANCE_MAX = 900;   // 90 unidades de mundo, muy por encima de lo posible
const marcaAvance = (avance) => `M${aBase36(Math.round(avance * 10) + AVANCE_SESGO)}`;

const aBase36 = (n) => Math.max(0, Math.round(n)).toString(36);
const deBase36 = (t) => {
  const n = parseInt(t, 36);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {object} partida
 * @param {string} partida.semilla
 * @param {Array<{anguloDeg:number, potencia:number, reaccion?:{tipo:string, paso:number}}>} partida.turnos
 */
export function codificar({ semilla, turnos = [] }) {
  const cuerpo = turnos
    .map((t) => {
      const campos = [aBase36(t.anguloDeg * 10), aBase36(t.potencia * 1000)];
      if (Number.isFinite(t.avance) && Math.abs(t.avance) >= 0.05) {
        campos.push(marcaAvance(t.avance));
      }
      if (t.reaccion && REACCIONES[t.reaccion.tipo]) {
        campos.push(REACCIONES[t.reaccion.tipo] + aBase36(t.reaccion.paso));
      }
      return campos.join(SEPARADOR_CAMPO);
    })
    .join(SEPARADOR_TURNO);

  return `${encodeURIComponent(semilla)}${SEPARADOR_SEMILLA}${cuerpo}`;
}

/**
 * Devuelve la partida, o null si el texto no es un replay.
 *
 * Nunca lanza: esto llega de una URL que alguien ha podido cortar por la mitad
 * al copiarla, y un enlace roto tiene que dejar el juego en su partida normal,
 * no en una pantalla de error.
 */
export function decodificar(texto) {
  if (typeof texto !== 'string' || !texto.includes(SEPARADOR_SEMILLA)) return null;

  const corte = texto.indexOf(SEPARADOR_SEMILLA);
  const semilla = decodeURIComponent(texto.slice(0, corte));
  const cuerpo = texto.slice(corte + 1);
  if (!semilla) return null;

  if (cuerpo === '') return { semilla, turnos: [] };

  const turnos = [];
  for (const trozo of cuerpo.split(SEPARADOR_TURNO)) {
    const campos = trozo.split(SEPARADOR_CAMPO);
    if (campos.length < 2) return null;

    const angulo = deBase36(campos[0]);
    const potencia = deBase36(campos[1]);
    if (angulo === null || potencia === null) return null;

    const turno = { anguloDeg: angulo / 10, potencia: potencia / 1000 };
    if (turno.anguloDeg > 180 || turno.potencia > 1) return null;

    // Los campos extra van etiquetados por su letra, no por su posicion: asi
    // un turno con avance y sin reaccion —o al reves— se lee igual, y un
    // enlace de antes de que existiera el avance sigue valiendo.
    for (const campo of campos.slice(2)) {
      if (!campo) continue;
      if (campo[0] === 'M') {
        const bruto = deBase36(campo.slice(1));
        if (bruto === null) return null;
        const avance = (bruto - AVANCE_SESGO) / 10;
        if (Math.abs(avance) > AVANCE_MAX / 10) return null;
        turno.avance = avance;
      } else if (REACCION_INVERSA[campo[0]]) {
        const paso = deBase36(campo.slice(1));
        if (paso === null) return null;
        turno.reaccion = { tipo: REACCION_INVERSA[campo[0]], paso };
      } else {
        return null;
      }
    }

    turnos.push(turno);
  }

  return { semilla, turnos };
}

/**
 * Semilla de la revancha.
 *
 * Antes salia de `${semilla}+${disparos}`, o sea que dependia de como hubiera
 * ido el combate anterior: ni una revancha era reproducible sin repetir la
 * partida entera. Ahora es la semilla original con un numero de combate detras,
 * asi que se puede escribir a mano y volver a ella.
 */
export const semillaDeRevancha = (semilla, combate) => {
  const base = String(semilla).split('#')[0];
  return `${base}#${Math.max(2, Math.floor(combate))}`;
};

/** Cuantos caracteres ocupa: un combate normal tiene que caber en una URL. */
export const longitudDe = (partida) => codificar(partida).length;
