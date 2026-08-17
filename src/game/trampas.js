import { clamp } from '../core/mathx.js';

/**
 * Lo que hay flotando en medio del campo.
 *
 * Tres cosas que le pueden pasar a un proyectil en pleno vuelo, y las tres
 * castigan al que dispara mal en vez de al que defiende:
 *
 *  - MINA: detona donde esta. El crater y la metralla salen ahi, no donde tu
 *    querias, asi que un tiro que roza una mina a media pista no llega nunca.
 *  - DEFLECTOR: invierte el sentido horizontal. El proyectil VUELVE, y si te
 *    cae encima te lo comes tu. Es la trampa que de verdad duele.
 *  - MURO: absorbe el tiro. No hace daño, pero te quedas sin turno.
 *
 * Se generan con el `rng` sembrado, asi que salen iguales en los seis moviles
 * sin mandar nada por el cable: la semilla ya viaja.
 *
 * Modulo puro: ni Three, ni DOM, ni azar sin semilla.
 */

export const TIPOS = ['mina', 'deflector', 'muro'];

export const TRAMPA = {
  // Radio de colision de cada tipo, en unidades de mundo.
  radio: { mina: 1.5, deflector: 2.2, muro: 1.9 },
  // Cuanto conserva el proyectil al rebotar, MEDIDO. Con 0,82 el tiro devuelto
  // se pasaba de largo por encima del propio cañon y salia del mapa: volvia,
  // pero no castigaba a nadie. Con 0,60 cae a 2,7 unidades de media del que
  // disparo, o sea dentro del radio de explosion. Un deflector tiene que doler.
  rebote: 0.6,
  // El deflector empuja un poco hacia arriba: sin esto, un rebote a media
  // altura se estrella a los dos metros y no llega a castigar a nadie.
  empujeVertical: 0.35,
  // Nadie aparece a menos de esto de un cañon.
  margenSeguro: 14,
  // Trampas EN EL AIRE: ni tan bajas que las barra un tiro rasante sin querer,
  // ni tan altas que solo estorben a los globos.
  alturaMinima: 4,
  alturaMaxima: 26,
  // Trampas EN LA PISTA: apoyadas en el suelo. Estorban el tiro tenso, que es
  // el que menos dispersion tiene, y castigan al que salta encima.
  alturaApoyada: 0.7,
  // Cuantas van al suelo. Mitad y mitad: las de arriba cortan las parabolas y
  // las de abajo cierran el tiro raso, que si no seria siempre la jugada segura.
  proporcionApoyadas: 0.5,
};

/**
 * Cuantas trampas y de que tipo, segun la complejidad (0 a 1).
 *
 * A 0 no hay ninguna: el juego de siempre. A 1 hay seis y la mitad son
 * deflectores, que es el caos maximo que aguanta un campo de 140 unidades sin
 * que apuntar deje de tener sentido.
 */
export function cuantasTrampas(complejidad) {
  return Math.round(clamp(complejidad, 0, 1) * 6);
}

/**
 * Reparte las trampas por el campo.
 *
 * Se colocan en la franja central y separadas entre si: amontonadas dejarian
 * pasillos imposibles a un lado y el campo libre al otro.
 */
export function generarTrampas({ rng, complejidad = 0.5, anchoMundo = 140, separacionCanones = 88, alturaEn }) {
  const cuantas = cuantasTrampas(complejidad);
  if (cuantas === 0) return [];

  const limite = anchoMundo / 2;
  const bordeUtil = separacionCanones / 2 - TRAMPA.margenSeguro;
  const trampas = [];

  for (let intento = 0; intento < cuantas * 12 && trampas.length < cuantas; intento++) {
    const x = (rng() * 2 - 1) * bordeUtil;
    if (Math.abs(x) > limite) continue;

    // Separadas al menos 9 unidades: si no, dos deflectores pegados hacen un
    // rincon del que el proyectil no sale.
    if (trampas.some((t) => Math.abs(t.x - x) < 9)) continue;

    const suelo = alturaEn ? alturaEn(x) : 0;
    const apoyada = rng() < TRAMPA.proporcionApoyadas;

    // A mas complejidad, mas deflectores: son los que cambian la partida.
    const dado = rng();
    let tipo = dado < 0.25 + complejidad * 0.25 ? 'deflector' : dado < 0.72 ? 'mina' : 'muro';
    // Un deflector tumbado en el suelo devolveria el tiro contra el propio
    // suelo. Ahi abajo tiene mas sentido una mina o un muro.
    if (apoyada && tipo === 'deflector') tipo = dado < 0.5 ? 'mina' : 'muro';

    const radio = TRAMPA.radio[tipo];
    const y = apoyada
      ? suelo + radio * TRAMPA.alturaApoyada
      : suelo + TRAMPA.alturaMinima + rng() * (TRAMPA.alturaMaxima - TRAMPA.alturaMinima);

    trampas.push({
      id: `t${trampas.length}`,
      tipo,
      x,
      y,
      radio,
      apoyada,
      viva: true,
    });
  }

  return trampas;
}

/**
 * ¿Choca el tramo de vuelo con alguna trampa?
 *
 * Barre el segmento igual que hace el terreno: a potencia alta el proyectil
 * recorre mas de una trampa por paso y podria atravesarla sin tocarla.
 */
export function chocarCon(trampas, x0, y0, x1, y1, subpasos = 4) {
  for (let k = 1; k <= subpasos; k++) {
    const t = k / subpasos;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;

    for (const trampa of trampas) {
      if (!trampa.viva) continue;
      const dx = x - trampa.x;
      const dy = y - trampa.y;
      if (dx * dx + dy * dy <= trampa.radio * trampa.radio) {
        return { trampa, x, y };
      }
    }
  }
  return null;
}

/**
 * Que le pasa al proyectil al tocar una trampa. Muta `s` si hay rebote.
 *
 * @returns {'detona'|'rebota'|'absorbe'}
 */
export function resolverChoque(trampa, s, ajustes = TRAMPA) {
  if (trampa.tipo === 'mina') {
    trampa.viva = false;
    return 'detona';
  }

  if (trampa.tipo === 'muro') {
    return 'absorbe';
  }

  // Deflector: da la vuelta al sentido horizontal y le mete algo de vertical
  // para que el tiro devuelto tenga recorrido.
  s.vx = -s.vx * ajustes.rebote;
  s.vy = Math.abs(s.vy) * ajustes.rebote + Math.abs(s.vx) * ajustes.empujeVertical;

  // Y se saca del radio de un empujon. Sin esto el proyectil rebota otra vez en
  // el paso siguiente —sigue dentro del circulo— y a la segunda inversion sale
  // disparado hacia delante, que es justo lo contrario de lo que hace un
  // deflector.
  if (trampa.x !== undefined && trampa.radio) {
    const rapidez = Math.hypot(s.vx, s.vy) || 1;
    const salida = trampa.radio + 0.35;
    s.x = trampa.x + (s.vx / rapidez) * salida;
    s.y = trampa.y + (s.vy / rapidez) * salida;
  }

  return 'rebota';
}

/**
 * ¿Hay una mina donde este vehiculo va a aterrizar?
 *
 * Es lo que hace que las trampas de pista estorben de verdad: saltar para
 * esquivar un obus y caer sobre una mina es peor que haberse quedado quieto.
 */
export function minaEn(trampas, x, alcance = 2.2) {
  return (
    trampas.find(
      (t) => t.viva && t.apoyada && t.tipo === 'mina' && Math.abs(t.x - x) <= alcance,
    ) ?? null
  );
}

/** Nombre legible del nivel de complejidad, para la interfaz. */
export function nivelDe(complejidad) {
  const c = clamp(complejidad, 0, 1);
  if (c === 0) return 'despejado';
  if (c <= 0.34) return 'suelto';
  if (c <= 0.67) return 'sembrado';
  return 'minado';
}
