import { newPlayerState } from './combat.js';

/**
 * Quien juega, en que bando y en que orden.
 *
 * Modulo puro y sin estado externo: recibe datos y devuelve datos. No sabe que
 * existe Three, ni el DOM, ni la red. Eso es lo que permite que el servidor y
 * los seis moviles ejecuten exactamente la misma rotacion de turnos sin
 * ponerse de acuerdo en nada mas que la lista inicial.
 */

export const MAX_POR_BANDO = 3;
export const BANDOS = ['a', 'b'];

/**
 * El turno ALTERNA bando y rota dentro de cada bando.
 *
 * Con bandos desiguales (2 contra 3) la alternativa era una ronda global
 * A1 B1 A2 B2 A3 B3, que da al bando numeroso el 60 % de los disparos ademas
 * de mas vida total: doble ventaja. Alternando bando, cada lado dispara la
 * mitad de los turnos pase lo que pase; el bando corto concentra fuego y el
 * largo aguanta mas castigo. Es el reparto que deja jugar 2 contra 3 sin que
 * nadie sienta que empieza perdiendo.
 */
export function crearPartida({ jugadores, semilla }) {
  const porBando = { a: [], b: [] };

  for (const j of jugadores) {
    if (!BANDOS.includes(j.bando)) {
      throw new Error(`Bando desconocido: ${j.bando}`);
    }
    porBando[j.bando].push(j);
  }

  for (const bando of BANDOS) {
    if (porBando[bando].length === 0) {
      throw new Error(`El bando ${bando} no tiene jugadores`);
    }
    if (porBando[bando].length > MAX_POR_BANDO) {
      throw new Error(`El bando ${bando} pasa de ${MAX_POR_BANDO} jugadores`);
    }
  }

  const participantes = [];
  for (const bando of BANDOS) {
    porBando[bando].forEach((j, indice) => {
      participantes.push({
        id: j.id,
        nombre: j.nombre ?? j.id,
        bando,
        indice,                  // posicion dentro de su bando, de fuera a dentro
        estado: newPlayerState(),
      });
    });
  }

  return {
    semilla,
    participantes,
    bandoActivo: 'a',
    // Cual toca dentro de cada bando. Se recuerda por separado para que la
    // rotacion no se reinicie cada vez que cambia el turno de lado.
    siguiente: { a: 0, b: 0 },
    ronda: 1,
  };
}

export const delBando = (partida, bando) => partida.participantes.filter((p) => p.bando === bando);

export const vivosDe = (partida, bando) => delBando(partida, bando).filter((p) => !p.estado.destroyed);

export function participanteActivo(partida) {
  const vivos = vivosDe(partida, partida.bandoActivo);
  if (vivos.length === 0) return null;
  return vivos[partida.siguiente[partida.bandoActivo] % vivos.length];
}

export const otroBando = (bando) => (bando === 'a' ? 'b' : 'a');

/**
 * Bando ganador, o null si la partida sigue. Devuelve 'empate' si los dos
 * bandos caen a la vez: un tiro corto puede matar al que dispara y llevarse
 * por delante al ultimo rival en la misma explosion.
 */
export function ganador(partida) {
  const aVivo = vivosDe(partida, 'a').length > 0;
  const bVivo = vivosDe(partida, 'b').length > 0;
  if (aVivo && bVivo) return null;
  if (aVivo) return 'a';
  if (bVivo) return 'b';
  return 'empate';
}

/**
 * Cierra el turno y pasa al siguiente. Muta la partida en sitio y la devuelve.
 * Salta a los destruidos: quien esta fuera no bloquea la rotacion.
 */
export function avanzarTurno(partida) {
  if (ganador(partida) !== null) return partida;

  const bandoQueJugo = partida.bandoActivo;
  const vivosQueJugaron = vivosDe(partida, bandoQueJugo).length;
  if (vivosQueJugaron > 0) {
    partida.siguiente[bandoQueJugo] = (partida.siguiente[bandoQueJugo] + 1) % vivosQueJugaron;
  }

  const rival = otroBando(bandoQueJugo);
  partida.bandoActivo = vivosDe(partida, rival).length > 0 ? rival : bandoQueJugo;
  if (partida.bandoActivo === 'a') partida.ronda += 1;

  return partida;
}

/**
 * Reparte los vehiculos a lo ancho de su mitad del campo.
 *
 * El bando 'a' ocupa la mitad izquierda y el 'b' la derecha, siempre en el
 * mismo orden, para que la posicion salga de la lista de jugadores y no del
 * azar: dos moviles con la misma partida colocan los vehiculos igual.
 */
export function posicionesDe(partida, { separacion, margen = 9 }) {
  const salida = new Map();

  for (const bando of BANDOS) {
    const equipo = delBando(partida, bando);
    const signo = bando === 'a' ? -1 : 1;
    const borde = (separacion / 2) * signo;

    equipo.forEach((p, i) => {
      // El primero de cada bando se queda en el borde y los demas entran hacia
      // el centro: nadie aparece detras de otro y la linea de tiro del que
      // esta mas adentro no la tapa un companero.
      salida.set(p.id, borde - signo * i * margen);
    });
  }

  return salida;
}
