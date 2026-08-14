import { clamp } from '../core/mathx.js';

/**
 * El viento deja de sortearse cada turno y pasa a derivar.
 *
 * Con un viento independiente turno a turno, la unica jugada racional es
 * ignorarlo y esperar a que toque uno flojo: es ruido. Con deriva, el viento de
 * este turno predice el del siguiente, y como el PRNG va sembrado se puede
 * ADELANTAR y enseñarlo. Eso convierte el viento en un reloj: "me quedan tres
 * turnos de poder empujar arena hacia el antes de que gire".
 *
 * Modulo puro. La unica entrada de azar es el `rng` sembrado que se le pasa.
 */

export const VIENTO = {
  limite: 3.4,      // el maximo de siempre, en unidades de aceleracion lateral
  // Medido, no elegido a ojo: con 0,82 el viento cambia de signo cada 4,4
  // turnos y no da tiempo a montar una campaña de arena; con 0,94 se estanca
  // seis turnos y medio en el mismo sentido. 0,90 da un giro cada 5,5 turnos y
  // un |viento| medio de 1,38 sobre 3,4, que usa el rango sin vivir en calma.
  inercia: 0.9,
  sacudida: 1.5,    // amplitud del empujon aleatorio de cada turno
};

/**
 * Siguiente viento a partir del actual: revierte a la media y se sacude.
 *
 * `w' = clamp(inercia*w + (rng()*2-1)*sacudida, -limite, limite)`
 *
 * Con inercia 0,82 el viento conserva memoria de unos cinco turnos, que es
 * bastante para planear una campaña de arena y poco para que la partida se
 * congele en un viento fijo.
 */
export function siguienteViento(actual, rng, ajustes = VIENTO) {
  const { limite, inercia, sacudida } = ajustes;
  const empuje = (rng() * 2 - 1) * sacudida;
  return clamp(inercia * actual + empuje, -limite, limite);
}

/**
 * Lleva la cuenta del viento de este turno y del que viene.
 *
 * El pronostico no es magia ni un modelo: es literalmente el proximo valor, ya
 * calculado. Se consume una tirada del PRNG por adelantado y se guarda, asi que
 * la secuencia sembrada no se altera — cada tirada se usa una vez y en el mismo
 * orden. Eso importa para el lockstep: los seis moviles ven el mismo pronostico
 * sin hablar entre ellos.
 */
export function crearViento(rng, ajustes = VIENTO) {
  let actual = siguienteViento(0, rng, ajustes);
  let pronostico = siguienteViento(actual, rng, ajustes);

  return {
    get actual() {
      return actual;
    },
    get pronostico() {
      return pronostico;
    },
    /** Cierra el turno: el pronostico se cumple y se calcula el siguiente. */
    avanzar() {
      actual = pronostico;
      pronostico = siguienteViento(actual, rng, ajustes);
      return actual;
    },
  };
}

/** Hacia donde sopla, para el HUD. */
export const flechaDe = (viento) => (viento > 0.05 ? '→' : viento < -0.05 ? '←' : '·');
