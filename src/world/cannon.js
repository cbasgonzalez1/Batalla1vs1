import * as THREE from 'three';
import { roundedBoxGeometry } from '../art/geometry.js';
import { MATERIALS, BEVEL } from '../art/direction.js';

/**
 * Vehiculo-canon del jugador.
 *
 * Jerarquia: group (apoyado en el terreno)
 *              -> chasis, orugas
 *              -> turret (rota en Z = elevacion sobre su direccion de tiro)
 *                   -> tubo, muzzle (marcador de la boca)
 *
 * El jugador B se orienta con rotation.y = PI. Como esa rotacion mapea el
 * +X local al -X del mundo y voltea Z, una rotacion local en Z sigue
 * significando "elevar", con el mismo signo para los dos jugadores.
 */
export function buildCannon({ chassis, facing }) {
  const group = new THREE.Group();
  group.name = facing > 0 ? 'cannonA' : 'cannonB';
  if (facing < 0) group.rotation.y = Math.PI;

  const matChassis = new THREE.MeshStandardMaterial({ ...chassis });
  const matRubber = new THREE.MeshStandardMaterial({ ...MATERIALS.rubber });
  const matMetal = new THREE.MeshStandardMaterial({ ...MATERIALS.metal });
  const matGloss = new THREE.MeshStandardMaterial({ ...MATERIALS.gloss });

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // orugas (M05 goma mate) - anclan el valor oscuro en la base
  const tread = roundedBoxGeometry(2.7, 0.56, 0.44, 0.22, 4);
  add(tread, matRubber, 0, 0.28, 0.62);
  add(tread, matRubber, 0, 0.28, -0.62);

  // chasis (M01/M02 plastico mate) - el 70% de la silueta
  add(roundedBoxGeometry(2.35, 0.9, 1.6, BEVEL, 5), matChassis, 0, 0.92, 0);

  // faldon inferior, un poco mas oscuro por contacto
  add(roundedBoxGeometry(2.5, 0.3, 1.35, 0.14, 4), matRubber, 0, 0.52, 0);

  // torreta
  const turret = new THREE.Group();
  turret.position.set(-0.1, 1.45, 0);
  group.add(turret);

  const turretBase = new THREE.Mesh(roundedBoxGeometry(1.05, 0.62, 1.05, 0.26, 5), matChassis);
  turretBase.castShadow = true;
  turretBase.receiveShadow = true;
  turret.add(turretBase);

  // visor (M03 plastico brillo) - uso escaso, solo para un specular puntual
  const visor = new THREE.Mesh(roundedBoxGeometry(0.34, 0.26, 0.66, 0.11, 4), matGloss);
  visor.position.set(0.42, 0.1, 0);
  visor.castShadow = true;
  turret.add(visor);

  // tubo (M04 metal pintado)
  const barrelGeo = new THREE.CylinderGeometry(0.19, 0.23, 1.95, 22, 1, false);
  barrelGeo.rotateZ(-Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, matMetal);
  barrel.position.set(1.05, 0.06, 0);
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  turret.add(barrel);

  // boca ensanchada
  const mouthGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.26, 22, 1, false);
  mouthGeo.rotateZ(-Math.PI / 2);
  const mouth = new THREE.Mesh(mouthGeo, matMetal);
  mouth.position.set(2.0, 0.06, 0);
  mouth.castShadow = true;
  turret.add(mouth);

  // marcador de la boca: de aqui sale el proyectil y arranca el arco
  const muzzle = new THREE.Object3D();
  muzzle.position.set(2.25, 0.06, 0);
  turret.add(muzzle);

  return {
    group,
    turret,
    muzzle,
    facing,
    /** phi = elevacion en radianes sobre la direccion de tiro del vehiculo. */
    setAim(phi) {
      turret.rotation.z = phi;
    },
    /** Posicion mundial de la boca. Requiere matrices actualizadas. */
    muzzleWorld(target) {
      return muzzle.getWorldPosition(target);
    },
  };
}
