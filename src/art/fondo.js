import * as THREE from 'three';
import { makeNoise1D, fbm1D } from '../core/noise.js';

/**
 * Crestas de fondo con perspectiva aerea.
 *
 * El cielo vacio era la mitad de la pantalla. Los dos juegos de referencia
 * llenan ese hueco igual: capas de silueta cada vez mas claras y mas planas
 * hacia el horizonte. Aqui hace ademas dos trabajos que en un juego de
 * artilleria valen mas que el adorno:
 *
 *  - Dan ESCALA. Sin nada detras, un campo de 140 unidades y uno de 40 se ven
 *    igual, y el jugador no tiene con que medir la distancia al rival.
 *  - Dan PARALAJE. La camara barre 88 unidades entre turno y turno; si el
 *    fondo no se mueve mas despacio, el barrido no se lee como desplazamiento.
 *
 * Con camara ortografica la profundidad no produce paralaje sola —no hay
 * division por w—, asi que cada capa se arrastra a mano con una fraccion del
 * centro de camara. Es la unica forma de tener paralaje en ortografica y sale
 * gratis: una asignacion por capa y por cuadro.
 *
 * Las siluetas son planas y sin luz a proposito: son fondo, y una cresta lejana
 * con relieve compite con el terreno de juego, que es lo unico que hay que
 * mirar.
 */

// Cuanto se mueve cada capa respecto a la camara. 0 = clavada al mundo (se
// desplaza entera con el encuadre), 1 = pegada a la camara y por tanto quieta
// en pantalla. La mas lejana casi no se mueve.
//
// Las alturas estan atadas al relieve del campo (cresta entre 5 y 15 unidades):
// una cresta de fondo a 30 unidades no se lee como lejania, se lee como un muro
// gris, y en un primer plano tapa media pantalla. Estas asoman justo por encima
// del terreno, que es donde se mira.
const CAPAS = [
  { fraccion: 0.86, escalaX: 0.05, altura: 11, base: 13, mezclaCielo: 0.82, parada: 1 },
  { fraccion: 0.68, escalaX: 0.08, altura: 8, base: 9, mezclaCielo: 0.62, parada: 1 },
  { fraccion: 0.44, escalaX: 0.13, altura: 6, base: 5, mezclaCielo: 0.38, parada: 2 },
];

// Los postes van en la capa intermedia: en la cercana quedarian por debajo de
// la cresta del campo y no se verian nunca.
const CAPA_POSTES = 1;

const ANCHO = 460;   // muy por encima del mundo: no puede acabarse al barrer
const COLUMNAS = 150;
const POSTES = 22;   // troncos partidos y postes de telegrafo de la capa cercana

/**
 * @param {object} opciones
 * @param {() => number} opciones.rng  con semilla: el fondo de una partida es
 *   el mismo en los seis moviles y en la repeticion.
 */
export function crearFondo({ rng, biome }) {
  const grupo = new THREE.Group();
  grupo.name = 'fondo';

  const cielo = biome.sky.map((css) => new THREE.Color(css));
  const suelo = new THREE.Color(biome.deep);
  const capas = [];

  for (const [indice, capa] of CAPAS.entries()) {
    const ruido = makeNoise1D(rng);
    const desplace = rng() * 900;
    // Se guarda la funcion de altura de la capa: los postes tienen que
    // plantarse en SU cresta. Al principio se les calculo con un ruido nuevo y
    // quedaban flotando en el aire a media pantalla.
    const alturaDe = (x) =>
      capa.base + capa.altura * fbm1D(ruido, x * capa.escalaX + desplace, { octaves: 3, gain: 0.5 });

    const puntos = new Float32Array(COLUMNAS * 2 * 3);
    const indices = [];
    const x0 = -ANCHO / 2;
    const dx = ANCHO / (COLUMNAS - 1);

    for (let i = 0; i < COLUMNAS; i++) {
      const x = x0 + i * dx;
      const h = alturaDe(x);
      puntos[i * 6 + 0] = x;
      puntos[i * 6 + 1] = h;
      puntos[i * 6 + 2] = 0;
      puntos[i * 6 + 3] = x;
      puntos[i * 6 + 4] = -120; // muy por debajo del encuadre
      puntos[i * 6 + 5] = 0;

      if (i < COLUMNAS - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(puntos, 3));
    geo.setIndex(indices);

    // Perspectiva aerea: la capa lejana casi es el color del cielo a su altura.
    const color = suelo.clone().lerp(cielo[capa.parada], capa.mezclaCielo);
    const malla = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: true }),
    );
    malla.position.z = -60 + indice * 12;
    malla.renderOrder = -10 + indice;
    malla.frustumCulled = false;
    grupo.add(malla);
    capas.push({ malla, fraccion: capa.fraccion, alturaDe });
  }

  // Postes y troncos partidos en la capa cercana. Es lo que fecha el sitio: un
  // horizonte de crestas peladas puede ser cualquier planeta, y una fila de
  // postes de telegrafo rotos solo puede ser un frente.
  const cercana = CAPAS[CAPA_POSTES];
  const colorPoste = suelo.clone().lerp(cielo[cercana.parada], cercana.mezclaCielo * 0.72);
  const poste = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.11, 0.16, 1, 5),
    new THREE.MeshBasicMaterial({ color: colorPoste, fog: false }),
    POSTES,
  );
  poste.frustumCulled = false;

  const alturaCercana = capas[CAPA_POSTES].alturaDe;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 0, 1);
  const p = new THREE.Vector3();
  const e = new THREE.Vector3();
  for (let i = 0; i < POSTES; i++) {
    const x = -ANCHO / 2 + (i + rng() * 0.7) * (ANCHO / POSTES);
    const alto = 1.8 + rng() * 2.6;
    // Torcidos: un poste recto parece decorado de menu, uno inclinado parece
    // que le ha pasado algo por encima.
    q.setFromAxisAngle(eje, (rng() - 0.5) * 0.5);
    p.set(x, alturaCercana(x) + alto / 2 - 0.6, 0);
    e.set(1, alto, 1);
    m.compose(p, q, e);
    poste.setMatrixAt(i, m);
  }
  poste.instanceMatrix.needsUpdate = true;
  poste.position.z = -60 + CAPA_POSTES * 12 + 1;
  poste.renderOrder = -10 + CAPA_POSTES + 1;
  grupo.add(poste);
  capas.push({ malla: poste, fraccion: cercana.fraccion });

  return {
    grupo,
    /** Arrastra cada capa con su fraccion del centro de camara. */
    seguir(cx) {
      for (const capa of capas) capa.malla.position.x = cx * capa.fraccion;
    },
  };
}
