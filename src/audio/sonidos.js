/**
 * Sonido del juego.
 *
 * Todo el sistema esta montado y a la espera de los MP3: ver
 * `public/audio/LEEME.md` para los nombres. Un fichero que falta simplemente no
 * suena — ni error en consola, ni hueco en el juego. Eso es a proposito: el
 * juego tiene que ser jugable mientras el audio no exista, y quien componga los
 * sonidos tiene que poder soltarlos de uno en uno y probarlos sin tocar codigo.
 *
 * No usa WebAudio ni grafos: `Audio` basta para media docena de efectos cortos
 * y arranca sin pedir permisos. Lo unico que si hace falta es esperar al primer
 * gesto del jugador, porque los navegadores no dejan sonar nada antes.
 */

export const PISTAS = {
  disparo: 'disparo.mp3',
  impacto: 'impacto.mp3',
  pluma: 'pluma.mp3',
  escudo: 'escudo.mp3',
  salto: 'salto.mp3',
  victoria: 'victoria.mp3',
  viento: 'viento.mp3',
};

/** Cuantas copias de cada efecto se preparan, para que suene solapado. */
const VOCES = 3;

export const VOLUMEN = {
  disparo: 0.8,
  impacto: 0.9,
  pluma: 0.5,
  escudo: 0.7,
  salto: 0.7,
  victoria: 0.8,
  viento: 0.25,
};

/**
 * @param {object} opciones
 * @param {string} [opciones.carpeta]
 * @param {(src:string)=>HTMLAudioElement} [opciones.crearAudio] inyectable para pruebas
 */
export function crearSonidos({
  carpeta = '/audio/',
  crearAudio = (src) => new Audio(src),
  activo = true,
} = {}) {
  /** @type {Map<string, {voces: HTMLAudioElement[], siguiente: number}>} */
  const bancos = new Map();
  let desbloqueado = false;
  let silencio = !activo;
  let viento = null;

  for (const [nombre, fichero] of Object.entries(PISTAS)) {
    const voces = [];
    const cuantas = nombre === 'viento' ? 1 : VOCES;
    for (let i = 0; i < cuantas; i++) {
      const pista = crearAudio(`${carpeta}${fichero}`);
      pista.preload = 'auto';
      pista.volume = VOLUMEN[nombre] ?? 0.7;
      // Un fichero que no esta no es un fallo: el juego suena a menos, y ya.
      pista.addEventListener?.('error', () => {}, { once: true });
      voces.push(pista);
    }
    bancos.set(nombre, { voces, siguiente: 0 });
    if (nombre === 'viento') {
      viento = voces[0];
      viento.loop = true;
    }
  }

  /**
   * Rota entre las copias para que dos disparos seguidos no se corten.
   * Reproducir es siempre seguro: si el fichero no cargo, play() rechaza y no
   * pasa nada mas.
   */
  function sonar(nombre) {
    if (silencio || !desbloqueado) return false;
    const banco = bancos.get(nombre);
    if (!banco) return false;

    const pista = banco.voces[banco.siguiente];
    banco.siguiente = (banco.siguiente + 1) % banco.voces.length;
    try {
      pista.currentTime = 0;
      pista.play?.()?.catch?.(() => {});
      return true;
    } catch {
      return false;
    }
  }

  return {
    get desbloqueado() {
      return desbloqueado;
    },

    get silenciado() {
      return silencio;
    },

    /**
     * Los navegadores no dejan sonar nada hasta que el usuario toca la
     * pantalla. Se llama desde el primer gesto, y solo entonces empieza el
     * viento de fondo.
     */
    desbloquear() {
      if (desbloqueado) return;
      desbloqueado = true;
      if (!silencio) viento?.play?.()?.catch?.(() => {});
    },

    sonar,

    silenciar(valor = true) {
      silencio = valor;
      if (valor) {
        viento?.pause?.();
      } else if (desbloqueado) {
        viento?.play?.()?.catch?.(() => {});
      }
    },

    /** Para el HUD: cuantas pistas hay de verdad detras de los nombres. */
    get pistas() {
      return Object.keys(PISTAS);
    },
  };
}
