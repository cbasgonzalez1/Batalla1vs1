import { MATERIA, claro, oscuro, contorno, tono } from '../vehiculo/paleta.js';

/**
 * Los colores del decorado urbano, y de donde sale cada uno.
 *
 * Regla unica y no negociable (`docs/ESCENARIOS.md` §2): el color base de toda
 * pieza se mezcla 0,35 hacia el `cuerpo` del terreno del teatro. Una viga de
 * madera igual en Ypres y en Dresde no pertenece a ninguno de los dos, y con
 * dieciseis ciudades el decorado sin tinte las convierte en una sola repintada
 * dieciseis veces.
 *
 * Lo que NO se tine es la `fabrica`: de que estan hechas las casas de esa ciudad
 * es lo que la distingue de la de al lado, y ese color ya viene del teatro
 * (`direction.js`). El muro y el escombro salen de ahi, no de esta tabla.
 */

/** Tinte de teatro obligatorio. `docs/ESCENARIOS.md` §2. */
export const TINTE = 0.35;

const canal = (c, i) => (c >> (16 - i * 8)) & 0xff;

/** Mezcla lineal en RGB. Solo para tintar y para perspectiva aerea. */
export function mezcla(a, b, t) {
  const v = (i) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * t);
  return (v(0) << 16) | (v(1) << 8) | v(2);
}

/**
 * Los crudos: el color de la materia ANTES del teatro.
 *
 * Salen de la plancha aprobada (`diseno/decorado.js`) y no se tocan aqui: si un
 * color hay que cambiarlo, se cambia en la plancha y se copia, porque la plancha
 * es lo que se aprueba y el juego lo que la obedece.
 */
const CRUDO = {
  ladrillo: 0xa8603f,   // el escombro, en las dieciseis
  chatarra: 0x6a6258,   // el coche quemado
  vagon: 0x8a6a4a,      // el tranvia volcado
  corteza: 0x5a4632,    // el arbol de calle quemado
  adoquin: 0x8d8b86,    // la barricada levantada del empedrado
  bidon: 0x6f7a5e,
  traviesa: 0x5c3f26,
};

/**
 * La paleta de un teatro. Se calcula una vez por partida y viaja con el
 * constructor de cada pieza.
 *
 * @param {object} biome  uno de los dieciseis de `direction.js`
 */
export function tonosDe(biome) {
  const cuerpo = biome.body;
  const tenir = (c, k = TINTE) => mezcla(c, cuerpo, k);
  return {
    cuerpo,
    // La fabrica se tine MENOS (0,22): es el rasgo que separa Varsovia de Caen,
    // y a 0,35 las dieciseis se acercan demasiado entre si.
    fabrica: mezcla(biome.fabrica, cuerpo, 0.22),
    escombro: mezcla(CRUDO.ladrillo, cuerpo, 0.3),
    metal: tenir(MATERIA.acero),
    madera: tenir(MATERIA.madera),
    lona: tenir(MATERIA.lona),
    chatarra: mezcla(CRUDO.chatarra, cuerpo, 0.2),
    vagon: mezcla(CRUDO.vagon, cuerpo, 0.18),
    corteza: mezcla(CRUDO.corteza, cuerpo, 0.22),
    adoquin: mezcla(CRUDO.adoquin, cuerpo, 0.22),
    bidon: mezcla(CRUDO.bidon, cuerpo, 0.25),
    traviesa: mezcla(CRUDO.traviesa, cuerpo, 0.18),
    // El balasto es terreno removido, no una materia nueva: sale de mezclar la
    // cresta con el socavon del propio teatro.
    balasto: mezcla(biome.crest, biome.deep, 0.5),
    caucho: MATERIA.caucho,
    llanta: MATERIA.llanta,
    // Un hueco es un AGUJERO, y es el unico sitio donde este juego permite un
    // negro plano (`docs/ESCENARIOS.md` §3.8).
    hueco: tono(cuerpo, -0.82),
  };
}

export { claro, oscuro, contorno };
