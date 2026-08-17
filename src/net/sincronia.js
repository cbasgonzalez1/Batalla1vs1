import { crearCola } from '../game/cola.js';
import { participanteActivo, delBando, BANDOS } from '../game/roster.js';
import { ACCION, DICE, RETARDO_PASOS } from './protocolo.js';

/**
 * Ata la partida en red a la simulacion local.
 *
 * EL PASO ES RELATIVO AL VUELO, NO GLOBAL. Es la decision que sostiene todo
 * esto y merece explicarse: un contador global no sirve porque entre turno y
 * turno hay tiempo muerto —el que tarda cada uno en apuntar— y si alguien se
 * queda treinta segundos pensando, su contador se va 3600 pasos por delante del
 * de los demas.
 *
 * En cambio, los pasos DE VUELO son deterministas: empiezan en cero cuando se
 * aplica el disparo y avanzan al mismo ritmo en todos. Asi el defensor que
 * pulsa escudo en su paso 250 puede agendarlo al 280, y los demas lo aplican en
 * SU paso 280 aunque el disparo les llegara 50 ms mas tarde. Lo que tiene que
 * caber en el margen no es la diferencia de relojes, sino el retardo de la red.
 *
 * El disparo, por su parte, no lleva paso: es lo que ABRE el turno, asi que
 * cada uno lo aplica en cuanto le llega y ahi pone su contador a cero.
 */

/**
 * Que vehiculo de la escena le toca a cada participante.
 *
 * El bando 'a' ocupa los primeros indices y el 'b' los siguientes, en el orden
 * congelado de la alineacion. Tiene que dar lo mismo en los seis moviles, y por
 * eso sale de la lista y no de quien llego antes a cada pantalla.
 */
export function indicesDe(partida) {
  const indices = new Map();
  let siguiente = 0;
  for (const bando of BANDOS) {
    for (const participante of delBando(partida, bando)) {
      indices.set(participante.id, siguiente++);
    }
  }
  return indices;
}

export function crearSincronia({ cliente, retardo = RETARDO_PASOS }) {
  const cola = crearCola();

  const estado = {
    activa: false,
    yo: null,
    partida: null,
    indices: new Map(),
    // Lo que se ha enviado y aun no ha vuelto del servidor. Sirve para no
    // disparar dos veces si el jugador insiste con el dedo.
    esperandoEco: false,
  };

  const manejadores = { disparo: null, reaccion: null };

  cliente.on(DICE.input, (m) => {
    if (!estado.activa) return;

    if (m.accion === ACCION.disparo) {
      // Abre turno: se aplica al llegar y el contador de vuelo vuelve a cero.
      estado.esperandoEco = false;
      manejadores.disparo?.({
        de: m.de,
        anguloDeg: m.anguloDeg,
        potencia: m.potencia,
        avance: m.avance ?? 0,
      });
      return;
    }

    // Reaccion: espera a su paso de vuelo.
    cola.programar(m.paso, m);
  });

  return {
    estado,
    cola,

    /** Arranca el modo en red con la alineacion que reparte el servidor. */
    empezar(partida, yo) {
      estado.activa = true;
      estado.partida = partida;
      estado.yo = yo;
      estado.indices = indicesDe(partida);
      estado.esperandoEco = false;
      cola.limpiar();
    },

    parar() {
      estado.activa = false;
      cola.limpiar();
    },

    /** Indice de vehiculo del participante al que le toca. */
    indiceActivo() {
      if (!estado.partida) return 0;
      const activo = participanteActivo(estado.partida);
      return activo ? estado.indices.get(activo.id) ?? 0 : 0;
    },

    /** ¿Es mi turno? En local siempre lo es, que es como jugaba hasta ahora. */
    meToca() {
      if (!estado.activa) return true;
      const activo = participanteActivo(estado.partida);
      return Boolean(activo) && activo.id === estado.yo;
    },

    /**
     * Manda el disparo. NO se aplica aqui: se aplica cuando vuelve del
     * servidor, igual que a los demas. Asi el que dispara ve exactamente lo
     * mismo que ven los otros, y una desincronia se nota enseguida en vez de
     * esconderse detras de un caso especial.
     */
    disparar(anguloDeg, potencia, avance = 0) {
      if (!estado.activa) return false;
      if (estado.esperandoEco) return false;
      estado.esperandoEco = true;
      return cliente.disparar(0, anguloDeg, potencia, avance);
    },

    /** Manda una reaccion agendada con margen para el viaje. */
    reaccionar(accion, pasosDeVuelo) {
      if (!estado.activa) return false;
      return cliente.reaccionar(pasosDeVuelo + retardo, accion);
    },

    /** Lo que toca aplicar en este paso de vuelo. */
    consumir(pasosDeVuelo) {
      return estado.activa ? cola.consumir(pasosDeVuelo) : [];
    },

    alDisparo(fn) {
      manejadores.disparo = fn;
    },

    alReaccionar(fn) {
      manejadores.reaccion = fn;
    },

    /** Reacciones que llegaron despues de su paso: la partida puede divergir. */
    get tardios() {
      return cola.tardios;
    },
  };
}
