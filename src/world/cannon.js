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

export function buildCannon({ chassis, facing, bando, granGuerra = false, ficha = 'media' }) {
  const group = new THREE.Group();
  group.name = facing > 0 ? 'cannonA' : 'cannonB';
  if (facing < 0) group.rotation.y = Math.PI;

  // El de 1942 ya sale del catalogo nuevo; el rombo de 1916 sigue con el modelo
  // viejo hasta que le toque (orden de `docs/CATALOGO-VEHICULOS.md` §3).
  const { casco, arma, tubo, retroceso, boca } = granGuerra
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
