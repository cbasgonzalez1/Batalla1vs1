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
// `parada` es la parada del cielo con la que se mezcla cada capa: la 2 y la 3
// son las de cerca del horizonte, que es donde estan estas crestas. Mezclar
// con la parada alta —el cenit— tiraba el horizonte a un tono que no existia
// en ninguna otra parte del cuadro.
const CAPAS = [
  { fraccion: 0.86, escalaX: 0.05, altura: 11, base: 13, mezclaCielo: 0.74, parada: 3 },
  { fraccion: 0.68, escalaX: 0.08, altura: 8, base: 9, mezclaCielo: 0.5, parada: 3 },
  { fraccion: 0.44, escalaX: 0.13, altura: 6, base: 5, mezclaCielo: 0.28, parada: 2 },
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
  // Se parte del color del CUERPO del terreno, no del socavon, y se mezcla con
  // el cielo del horizonte. Partiendo del socavon —que es el tono mas oscuro y
  // mas saturado— las crestas del desierto salian malva: marron oscuro contra
  // azul da violeta, y el horizonte no pegaba con la arena de delante.
  const suelo = new THREE.Color(biome.body);
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

  // ── ruinas y columnas de humo ───────────────────────────────────────────
  //
  // Un horizonte de crestas peladas puede ser cualquier planeta. Lo que dice
  // que hay una guerra al otro lado son dos cosas: siluetas de edificios rotos
  // y humo subiendo. Van en la capa lejana, planas y sin luz, del color de la
  // bruma: son recorte contra el cielo, no volumen.
  const ruinasCapa = CAPAS[0];
  // Mas OSCURO que la cresta que tiene delante, no mas claro. Una silueta
  // recortada contra el cielo se ve por su cara en sombra: mezclada hacia la
  // parada clara del horizonte salia beige y era lo mas luminoso del cuadro,
  // justo lo contrario de lo que hace una ruina a un kilometro.
  const colorRuina = suelo
    .clone()
    .lerp(cielo[ruinasCapa.parada], ruinasCapa.mezclaCielo * 0.55)
    .multiplyScalar(0.62);
  const materialRuina = new THREE.MeshBasicMaterial({ color: colorRuina, fog: false });
  const ruinas = new THREE.Group();
  const alturaLejana = capas[0].alturaDe;

  for (let i = 0; i < 10; i++) {
    const x = (rng() * 2 - 1) * (ANCHO / 2.4);
    // Arrancan bien por DEBAJO de la cresta lejana y solo asoma lo que sobra:
    // el grupo va detras de la capa, asi que la cresta les corta la base. Es lo
    // que los convierte en horizonte en vez de en cajas apoyadas encima.
    const base = alturaLejana(x) - 6;
    const alto = 8 + rng() * 11;
    const ancho = 1.4 + rng() * 3.6;

    const bloque = (bx, balto, bancho) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bancho, balto), materialRuina);
      m.position.set(bx, base + balto / 2, 0);
      m.frustumCulled = false;
      ruinas.add(m);
    };

    // Perfil escalonado sumando bloques, nunca restando cielo: el cielo es un
    // degradado y un rectangulo de color plano encima se nota siempre.
    //
    // Tres alturas distintas y ninguna igual. Un bloque unico con un escalon se
    // lee como un edificio de oficinas; lo que dice "esto lo ha partido algo"
    // es que la linea de arriba no sea nunca recta dos veces seguidas.
    bloque(x, alto, ancho);
    bloque(x + ancho * 0.62, alto * (0.42 + rng() * 0.34), ancho * (0.5 + rng() * 0.4));
    bloque(x - ancho * 0.58, alto * (0.62 + rng() * 0.3), ancho * (0.4 + rng() * 0.4));
    // Alguna chimenea alta y fina: es lo que le da perfil de ciudad rota.
    if (rng() < 0.45) bloque(x - ancho * 0.95, alto * (1.2 + rng() * 0.5), 0.6);
  }

  // Detras de la capa lejana (z -60), no delante.
  ruinas.position.z = -63;
  ruinas.renderOrder = -11;
  grupo.add(ruinas);
  capas.push({ malla: ruinas, fraccion: ruinasCapa.fraccion, alturaDe: alturaLejana });

  // Columnas de humo: se estrechan hacia abajo y se disuelven arriba, que es
  // como sube el humo de verdad. Quietas a proposito — animarlas pediria otro
  // sistema de particulas para algo que esta a un kilometro.
  const humo = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const x = (rng() * 2 - 1) * (ANCHO / 3);
    const alto = 22 + rng() * 26;
    const lienzo = document.createElement('canvas');
    lienzo.width = 8;
    lienzo.height = 128;
    const ctx = lienzo.getContext('2d');
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(40,40,44,0.55)');
    g.addColorStop(0.45, 'rgba(70,70,76,0.28)');
    g.addColorStop(1, 'rgba(120,120,126,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 128);
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;

    const columna = new THREE.Mesh(
      new THREE.PlaneGeometry(4 + rng() * 7, alto),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
    );
    // Arranca por debajo de la cresta: el fuego esta al otro lado y solo se ve
    // subir la columna. Ver el pie del humo lo delataria como un plano.
    columna.position.set(x, alturaLejana(x) + alto / 2 - 5, 0);
    columna.rotation.z = (rng() - 0.5) * 0.24;
    columna.frustumCulled = false;
    humo.add(columna);
  }
  humo.position.z = -62;
  humo.renderOrder = -10;
  grupo.add(humo);
  capas.push({ malla: humo, fraccion: ruinasCapa.fraccion, alturaDe: capas[0].alturaDe });

  return {
    grupo,
    /** Arrastra cada capa con su fraccion del centro de camara. */
    seguir(cx) {
      for (const capa of capas) capa.malla.position.x = cx * capa.fraccion;
    },
  };
}
