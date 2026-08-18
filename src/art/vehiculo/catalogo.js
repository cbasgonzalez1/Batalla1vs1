import { media } from './fichas/media.js';
import { cazacarros } from './fichas/cazacarros.js';
import { pesado } from './fichas/pesado.js';

/**
 * El catalogo. Vive FUERA de `fichas/` a proposito: ahi dentro no se importa
 * nada, y eso lo vigila `tests/arquitectura.test.js`.
 *
 * Orden de modelado de `docs/CATALOGO-VEHICULOS.md` §3: primero MEDIA, y solo
 * con ella aprobada, CAZACARROS y PESADO — que validan casco sin torreta y
 * torreta grande. Nunca dos a medias a la vez.
 */
export const CATALOGO = { media, cazacarros, pesado };

export const fichaDe = (id) => CATALOGO[id] ?? CATALOGO.media;
