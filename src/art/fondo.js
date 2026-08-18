import * as THREE from 'three';

/**
 * El perfil de ruinas del fondo.
 *
 * El cielo vacio era la mitad de la pantalla. Antes lo llenaban tres crestas de
 * colina, y una ciudad arrasada no tiene colinas detras: tiene MAS CIUDAD. Tres
 * capas de manzanas con el remate roto, cada una mas mezclada con el cielo, que
 * ademas hacen dos trabajos que en un juego de artilleria valen mas que el
 * adorno:
 *
 *  - Dan ESCALA. Sin nada detras, un campo de 140 unidades y uno de 40 se ven
 *    igual, y el jugador no tiene con que medir la distancia al rival.
 *  - Dan PARALAJE. La camara barre 88 unidades entre turno y turno; si el fondo
 *    no se mueve mas despacio, el barrido no se lee como desplazamiento.
 *
 * Con camara ortografica la profundidad no produce paralaje sola —no hay
 * division por w—, asi que cada capa se arrastra a mano con una fraccion del
 * centro de camara. Es la unica forma de tener paralaje en ortografica y sale
 * gratis: una asignacion por capa y por cuadro.
 *
 * Las siluetas son planas y sin luz a proposito: son fondo, y una manzana lejana
 * con relieve compite con el terreno de juego, que es lo unico que hay que
 * mirar.
 */

// `base` es donde arranca la manzana y `min`/`max` su altura. Las tres arrancan
// MUY por encima de la cota del campo: con la cercana a 5 y el terreno entre 3 y
// 5 se entrelazaban, y como el fondo va mas claro que el suelo se leia como la
// hierba de delante. Todo lo plantado en el terreno parecia flotar.
//
// `parada` es la parada del cielo con la que se mezcla cada capa: la 2 y la 3
// son las de cerca del horizonte. Mezclar con el cenit tiraba los tejados a un
// malva que no existe en ninguna otra parte del cuadro.
const CAPAS = [
  { fraccion: 0.86, base: 9, min: 7, max: 13, ancho: [5, 11], mezclaCielo: 0.74, parada: 3 },
  { fraccion: 0.68, base: 6, min: 6, max: 10.5, ancho: [4.5, 9], mezclaCielo: 0.52, parada: 3 },
  { fraccion: 0.44, base: 3.5, min: 4.5, max: 8.5, ancho: [3.5, 7.5], mezclaCielo: 0.3, parada: 2 },
];

// Los postes van en la capa intermedia: en la cercana quedarian por debajo de
// la cresta del campo y no se verian nunca.
const CAPA_POSTES = 1;

const ANCHO = 460;   // muy por encima del mundo: no puede acabarse al barrer
const POSTES = 18;   // chimeneas y torres sueltas de la capa intermedia
const VENTANAS = 220;

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
  // El fondo sale de la FABRICA de la ciudad —ladrillo, piedra, arenisca— y no
  // del color del suelo: es de lo que estan hechas las casas, y es lo que hace
  // que Varsovia y Caen no se parezcan aunque el cascote de delante sea igual.
  const fabrica = new THREE.Color(biome.fabrica ?? biome.body);
  const capas = [];

  for (const [indice, capa] of CAPAS.entries()) {
    // Se listan las manzanas y despues se teje la tira. El remate roto es UNA
    // muesca por manzana: con tres dientes de medio metro cada bloque se lee
    // como una montaña y el fondo deja de parecer una ciudad.
    const puntos = [];
    let x = -ANCHO / 2;
    while (x < ANCHO / 2) {
      const aguja = rng() < 0.07;
      const w = aguja ? 1.6 + rng() * 0.8 : capa.ancho[0] + rng() * (capa.ancho[1] - capa.ancho[0]);
      const h = capa.base + (aguja ? capa.max + 4 + rng() * 3 : capa.min + rng() * (capa.max - capa.min));
      const m = 0.5 + rng() * 0.9;
      const p = 0.35 + rng() * 0.3;
      puntos.push(
        [x, h], [x + w * p, h],
        [x + w * p, h - m], [x + w * (p + 0.22), h - m],
        [x + w * (p + 0.22), h - 0.12], [x + w, h - 0.12],
        [x + w, capa.base],
      );
      x += w;
      puntos.push([x, capa.base]);
    }

    const cols = puntos.length;
    const vert = new Float32Array(cols * 2 * 3);
    const indices = [];
    for (let i = 0; i < cols; i++) {
      vert[i * 6 + 0] = puntos[i][0];
      vert[i * 6 + 1] = puntos[i][1];
      vert[i * 6 + 2] = 0;
      vert[i * 6 + 3] = puntos[i][0];
      vert[i * 6 + 4] = -120; // muy por debajo del encuadre
      vert[i * 6 + 5] = 0;
      if (i < cols - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }

    // Altura de la capa en una x: los remates sueltos se plantan en SU manzana.
    const alturaDe = (px) => {
      let mejor = capa.base;
      for (let i = 0; i < cols - 1; i++) {
        if (puntos[i][0] <= px && px <= puntos[i + 1][0]) mejor = Math.max(mejor, puntos[i][1]);
      }
      return mejor;
    };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vert, 3));
    geo.setIndex(indices);

    // Perspectiva aerea: la capa lejana casi es el color del cielo a su altura.
    const color = fabrica.clone().lerp(cielo[capa.parada], capa.mezclaCielo);
    const malla = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: true }),
    );
    malla.position.z = -60 + indice * 12;
    malla.renderOrder = -10 + indice;
    malla.frustumCulled = false;
    grupo.add(malla);
    capas.push({ malla, fraccion: capa.fraccion, alturaDe });

    // Huecos de ventana solo en la capa cercana: en las dos de atras no se
    // verian, y sembrados sobre la silueta se leen como suciedad. Van en
    // rejilla, dentro de la manzana.
    if (indice === CAPAS.length - 1) {
      const hueco = color.clone().multiplyScalar(0.86);
      const rejilla = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(0.42, 0.7),
        new THREE.MeshBasicMaterial({ color: hueco, fog: false }),
        VENTANAS,
      );
      rejilla.frustumCulled = false;
      const mm = new THREE.Matrix4();
      for (let i = 0; i < VENTANAS; i++) {
        const vx = -ANCHO / 2 + rng() * ANCHO;
        const techo = alturaDe(vx);
        const vy = capa.base + 0.9 + rng() * Math.max(0.5, techo - capa.base - 1.8);
        mm.makeTranslation(vx, vy, 0.1);
        rejilla.setMatrixAt(i, mm);
      }
      rejilla.position.z = malla.position.z;
      rejilla.renderOrder = malla.renderOrder + 0.5;
      grupo.add(rejilla);
      capas.push({ malla: rejilla, fraccion: capa.fraccion, alturaDe });
    }
  }

  // Postes y troncos partidos en la capa cercana. Es lo que fecha el sitio: un
  // horizonte de crestas peladas puede ser cualquier planeta, y una fila de
  // postes de telegrafo rotos solo puede ser un frente.
  const cercana = CAPAS[CAPA_POSTES];
  const colorPoste = fabrica.clone().lerp(cielo[cercana.parada], cercana.mezclaCielo * 0.72);
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

  // ── columnas de humo ────────────────────────────────────────────────────
  //
  // El grupo de ruinas sueltas que habia aqui se ha ido: las tres capas de
  // manzanas YA son la ruina, y superpuestas se veian como una mancha oscura
  // compitiendo con el perfil. Lo que si hace falta es el humo, que es lo unico
  // que dice que la ciudad sigue ardiendo.
  const ruinasCapa = CAPAS[0];
  const alturaLejana = capas[0].alturaDe;

  // Columnas de humo: se estrechan hacia abajo y se disuelven arriba, que es
  // como sube el humo de verdad. Quietas a proposito — animarlas pediria otro
  // sistema de particulas para algo que esta a un kilometro.
  const humo = new THREE.Group();
  // Dos, y estrechas. Con cuatro columnas de once unidades de ancho el humo se
  // leia como una cuña gris pegada al cielo, no como humo.
  for (let i = 0; i < 2; i++) {
    const x = (rng() * 2 - 1) * (ANCHO / 3);
    const alto = 26 + rng() * 22;
    const lienzo = document.createElement('canvas');
    lienzo.width = 8;
    lienzo.height = 128;
    const ctx = lienzo.getContext('2d');
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(40,40,44,0.4)');
    g.addColorStop(0.45, 'rgba(70,70,76,0.18)');
    g.addColorStop(1, 'rgba(120,120,126,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 128);
    const tex = new THREE.CanvasTexture(lienzo);
    tex.colorSpace = THREE.SRGBColorSpace;

    const columna = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2 + rng() * 2.4, alto),
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
