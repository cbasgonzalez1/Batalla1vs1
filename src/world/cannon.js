import * as THREE from 'three';
import { construirBlindado } from '../art/blindados.js';
import { ensamblar, PIVOTE } from '../art/vehiculo/ensamblar.js';
import { fichaDe } from '../art/vehiculo/catalogo.js';
import { easeOutExpo, easeOutBack } from '../core/easing.js';

/** El rombo todavia declara su propia boca; desaparece al remodelarlo. */
const BOCA_1916 = { x: 1.875, y: 0 };

/**
 * El blindado del jugador, con su rig.
 *
 * Jerarquia: group (apoyado en el terreno)
 *              -> casco, orugas
 *              -> arma (rota en Z = elevacion sobre su direccion de tiro)
 *                   -> tubo (se desliza al retroceder), muzzle (boca)
 *
 * El jugador B se orienta con rotation.y = PI. Como esa rotacion mapea el
 * +X local al -X del mundo y voltea Z, una rotacion local en Z sigue
 * significando "elevar", con el mismo signo para los dos jugadores.
 *
 * La forma la pone `art/blindados.js` segun la epoca del teatro. Aqui solo
 * esta el rig, que es identico para las dos: es lo que garantiza que cambiar
 * de teatro no cambie ni un milimetro la balistica.
 */

// Movimiento, ARTE.md seccion 14: el tubo se hunde casi de golpe y vuelve
// despacio pasandose un pelo. El retroceso corto es lo que da PESO al disparo;
// si se ve viajar hacia atras parece un muelle, no una pieza de artilleria.
const RETROCESO_MS = 90;
const VUELTA_MS = 260;

/**
 * Media huella del tren de rodaje, en unidades de juego. El casco de la MEDIA
 * mide 5,6 de plancha y entra a 0,625, o sea 3,5: 1,7 es lo que apoya.
 */
const MEDIA_HUELLA = 1.7;

/**
 * Tope de inclinacion. Un blindado a 20 grados sobre el labio de un crater se
 * lee como un juguete volcado, no como un carro subiendo una cuesta.
 */
const INCLINACION_MAXIMA = (14 * Math.PI) / 180;

export function buildCannon({ chassis, facing, bando, granGuerra = false, ficha = 'media' }) {
  const group = new THREE.Group();
  group.name = facing > 0 ? 'cannonA' : 'cannonB';
  if (facing < 0) group.rotation.y = Math.PI;

  // El de 1942 ya sale del catalogo nuevo; el rombo de 1916 sigue con el modelo
  // viejo hasta que le toque (orden de `docs/CATALOGO-VEHICULOS.md` §3).
  const { casco, arma, tubo, retroceso, boca, deterioro } = granGuerra
    ? { ...construirBlindado({ chassis, bando: bando ?? 'a', granGuerra }), boca: BOCA_1916 }
    : ensamblar(fichaDe(ficha), chassis.color ?? chassis);
  group.add(casco);

  arma.position.set(PIVOTE.x, PIVOTE.y, 0);
  group.add(arma);

  // Marcador de la boca: de aqui sale el proyectil y arranca el arco. Va
  // colgado del TUBO, no del arma, para que el fogonazo retroceda con la pieza
  // — pero su posicion en reposo es la misma en las dos epocas.
  const muzzle = new THREE.Object3D();
  // La z solo la mira el fogonazo: la balistica usa x/y y el proyectil vuela en
  // su plano fijo. Por eso la barbeta lateral del rombo puede estar sacada
  // hacia el espectador sin tocar la simulacion.
  muzzle.position.set(boca.x, boca.y, granGuerra ? 1.42 : 0);
  tubo.add(muzzle);

  // Estado del retroceso. Se anima con tiempo real, no con el paso fijo: es
  // decoracion y no puede tocar la simulacion.
  let fase = 'reposo';
  let ms = 0;

  return {
    group,
    turret: arma,
    arma,
    tubo,
    muzzle,
    facing,
    granGuerra,

    /**
     * Enseña el castigo. `vida` de 0 a 1.
     *
     * Devuelve si a este le toca humear, que es lo unico que el bucle necesita
     * saber: el resto —tizne y cicatrices— se resuelve dentro y sin tocar el
     * material, que es unico para los quince. El rombo de 1916 todavia sale del
     * modelo viejo y no lo tiene; contesta que no y ya.
     */
    dañar(vida) {
      return deterioro ? deterioro.aplicar(vida) : false;
    },

    /**
     * Apoya el blindado en el terreno de su x, Y LO GIRA CON LA PENDIENTE.
     *
     * Un blindado horizontal sobre una cuesta apoya una oruga y deja la otra en
     * el aire — es el mismo defecto que el de las casas flotando, y se corrige
     * igual: midiendo el terreno bajo los DOS extremos de la huella
     * (`docs/ESCENARIOS.md` §0.2 ter).
     *
     * La altura es la MENOR entre la media de los dos extremos y la del centro:
     * sobre una loma, la media deja el vientre en el aire.
     *
     * Gira el rig entero —casco y arma— y no solo el casco: con el casco girado
     * y la torreta a nivel, el anillo se despega en cuanto hay dos grados de
     * cuesta. La boca se mueve con el, y eso es correcto: el invariante de
     * `ARTE-VEHICULOS.md` §8 es que los QUINCE tengan la boca a la misma Y en
     * reposo, no que la boca no dependa del terreno — la Y ya cambiaba al
     * apoyarse en una cota distinta.
     *
     * @param {(x:number) => number} alturaEn
     * @param {number} [lift] lo que el salto de reaccion levanta al vehiculo
     */
    asentar(alturaEn, lift = 0) {
      const x = group.position.x;
      const ya = alturaEn(x - MEDIA_HUELLA);
      const yb = alturaEn(x + MEDIA_HUELLA);
      group.position.y = Math.min((ya + yb) / 2, alturaEn(x)) + lift;
      const ang = Math.atan2(yb - ya, 2 * MEDIA_HUELLA);
      // El bando B lleva el rig girado media vuelta en Y, y esa rotacion voltea
      // Z: sin el `facing`, los dos se inclinarian en sentidos contrarios sobre
      // la misma cuesta.
      group.rotation.z = facing * Math.max(-INCLINACION_MAXIMA, Math.min(INCLINACION_MAXIMA, ang));
    },

    /** phi = elevacion en radianes sobre la direccion de tiro del vehiculo. */
    setAim(phi) {
      arma.rotation.z = phi;
    },

    /** Posicion mundial de la boca. Requiere matrices actualizadas. */
    muzzleWorld(target) {
      return muzzle.getWorldPosition(target);
    },

    /** Arranca el retroceso. Lo llama el disparo, una vez. */
    retroceder() {
      fase = 'hunde';
      ms = 0;
    },

    /** @param {number} dt segundos de reloj de pared */
    animar(dt) {
      if (fase === 'reposo') return;
      ms += dt * 1000;

      if (fase === 'hunde') {
        const t = Math.min(1, ms / RETROCESO_MS);
        tubo.position.x = -retroceso * easeOutExpo(t);
        if (t >= 1) {
          fase = 'vuelve';
          ms = 0;
        }
        return;
      }

      // easeOutBack se pasa de 1, asi que el tubo asoma un pelo por delante de
      // su sitio antes de asentarse. Es el rebote del freno hidraulico.
      const t = Math.min(1, ms / VUELTA_MS);
      tubo.position.x = -retroceso * (1 - easeOutBack(t));
      if (t >= 1) {
        fase = 'reposo';
        ms = 0;
        tubo.position.x = 0;
      }
    },
  };
}
