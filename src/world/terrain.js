import * as THREE from 'three';
import { makeNoise1D, fbm1D } from '../core/noise.js';
import { lerp, smoothstep } from '../core/mathx.js';

/**
 * Terreno destructible.
 *
 * El estado autoritativo es un heightmap 1D (`heights`). La malla 3D es solo
 * su representacion: se extruye el perfil a lo largo de Z y se reconstruye
 * cuando el heightmap cambia. La fisica lee `heights`, nunca la malla.
 *
 * Convencion de profundidad: la cara frontal vive en z = 0 y el volumen se
 * extruye hacia ATRAS, hasta z = -depth. Asi el proyectil puede volar en
 * z = +0.25, siempre por delante del muro frontal, sin que un cerro se lo
 * coma visualmente y sin desalinearse del canon (a camara ortografica de 15
 * grados, 0.25 de z son 3 px de desplazamiento en pantalla).
 *
 * La malla son dos superficies con el mismo material:
 *  - `frontGeo`: cara frontal (normal +Z), la que ocupa casi toda la pantalla.
 *    Se colorea por profundidad bajo la superficie -> cuerpo / socavon.
 *  - `topGeo`:   superficie superior barrida (normal perpendicular a la
 *    pendiente), que a 15 grados de camara da el volumen -> cresta.
 */

const AO_WINDOW = 26;      // columnas a cada lado para la oclusion de horizonte
const CONTRAST = 5.5;      // expansion de contraste del fBm, ver _generate()

// --- Como se pinta la cara frontal ------------------------------------------
//
// La cara frontal es la MITAD DE LA PANTALLA. Estaba resuelta como un
// degradado que se hundia hasta casi el negro, y el resultado era que el juego
// entero se veia sombrio: por muy alegre que fuera el cielo, debajo habia una
// masa oscura sin forma ocupando el cuadro.
//
// Ahora se pinta por ESTRATOS: tres franjas de color plano con el borde
// marcado, como el suelo de un juego de plataformas. Es mas barato de leer y
// mucho mas alegre, y ademas da escala — se ve cuanto ha excavado un crater
// porque se ve cuantas capas ha atravesado.
const COSTRA = 0.42;       // grosor de la costra clara justo bajo la cresta

/**
 * El suelo, por estratos. CUATRO, no once.
 *
 * La version anterior tenia once franjas «con el borde duro» — y el borde duro
 * no existia: las dieciocho filas de la cara frontal llevan color POR VERTICE, y
 * el color por vertice INTERPOLA. Lo que se veia era un degradado naranja de
 * media pantalla, que es justo lo que las franjas venian a arreglar.
 *
 * Ahora las filas van clavadas en los bordes de banda y DOBLADAS: dos filas a la
 * misma profundidad con colores distintos dan un corte limpio. Y son cuatro
 * porque once bandas onduladas siguiendo el relieve convierten la mitad inferior
 * del cuadro en un mapa topografico que compite con todo lo que se planta
 * encima (ARTE.md §12).
 */
const ESTRATOS = [
  { hasta: COSTRA, mezcla: 0.0, brillo: 1.0 },   // costra: la cresta del teatro
  { hasta: 2.6, mezcla: 0.18, brillo: 0.98 },
  { hasta: 6.5, mezcla: 0.44, brillo: 0.93 },
  // Las tres de abajo no estan en la plancha, y hacen falta: la plancha encuadra
  // nueve unidades de tierra y el juego ensena cuarenta y cinco al abrir plano.
  // Con las cuatro de la plancha, el tercio inferior del cuadro se quedaba en un
  // naranja plano del tamaño de media pantalla. Bajan en valor de golpe para que
  // el fondo RETROCEDA, que es lo que hacia el hundimiento por profundidad antes
  // de quitarlo — pero por bandas y no por degradado.
  { hasta: 14, mezcla: 0.62, brillo: 0.88 },
  { hasta: 26, mezcla: 0.78, brillo: 0.8 },
  { hasta: Infinity, mezcla: 0.9, brillo: 0.72 },
];

/**
 * Cuanto se APLANA cada estrato: 0 calca la superficie, 1 es horizontal.
 *
 * Es la correccion que hace que la mitad inferior del cuadro deje de verse
 * falsa, y no era la paleta. Con TODAS las bandas calcando el perfil, el suelo
 * se lee como una tarta de capas: seis lineas paralelas ondulando a la vez,
 * que es una forma que no existe en ningun sitio. Un estrato de verdad es casi
 * horizontal y lo que varia es CUANTO terreno tiene encima.
 *
 * Y no es solo mirarlo: `ARTE.md` §12 dice desde el principio que el suelo por
 * estratos «da escala — se ve cuanto ha excavado un crater porque se ve cuantas
 * capas ha atravesado», y con las bandas calcando la superficie eso era FALSO.
 * La costra se movia con el crater y el hoyo salia del mismo color que el borde.
 * Con las bandas hondas ancladas al lecho, un crater CORTA los estratos y
 * ensena por donde va.
 *
 * La curva es suave y sin saltos porque depende solo de la profundidad: las dos
 * filas que comparten borde de banda tienen que caer exactamente a la misma y,
 * o el corte duro entre colores se convierte en un degradado.
 */
const aplanado = (prof) => 1 - 1 / (1 + prof / 4.5);

/** Separacion minima entre dos filas que NO comparten profundidad. */
const SEPARACION_FILA = 0.02;

/**
 * Ventana del lecho, en columnas a cada lado. A 0,1 u por columna son 12
 * unidades: mas corto y el lecho copia cada loma —volvemos a la tarta—; mas
 * largo y sale una recta, que tampoco es un estrato.
 */
const LECHO_VENTANA = 120;

/**
 * Profundidad de cada fila de la cara frontal, y a que banda pertenece.
 *
 * Los bordes van repetidos: la fila 1 y la 2 estan las dos a 0,42 pero una es
 * costra y la otra es la banda de debajo, y por eso entre ellas no hay
 * interpolacion que valga. Las tres ultimas solo estiran la banda honda hasta
 * la base; como comparten color, ahi interpolar da igual.
 */
const FILAS = [
  [0, 0], [COSTRA, 0],
  [COSTRA, 1], [2.6, 1],
  [2.6, 2], [6.5, 2],
  [6.5, 3], [14, 3],
  [14, 4], [26, 4],
  [26, 5], [Infinity, 5],
];
const ROWS = FILAS.length;

const AO_STRENGTH = 0.34;  // era 0.62: ensuciaba de gris toda la ladera
const AO_FADE_DEPTH = 3.2; // la AO se disuelve a esta profundidad en la cara

// Angulo de reposo de la arena: por encima de esta pendiente, el monton se
// derrumba. 34 grados es lo tipico de arena seca.
//
// Se compara contra el perfil de la ARENA SUELTA, no contra el del terreno.
// Es una simplificacion deliberada: arena de verdad sobre una ladera de 72
// grados resbalaria hasta el fondo, y medido aqui eso vaciaba cada deposito
// valle abajo — con lo que levantar el suelo del rival, que es el corazon de
// Sotavento, se volvia imposible. Asi la arena se queda donde cae y solo se
// derrumba si la apilas de mas, que es la regla que el jugador puede aprender.
const REPOSO_TANGENTE = Math.tan((34 * Math.PI) / 180);
// Tope de pasadas por si un perfil raro no converge: mas vale un talud algo
// empinado que un bucle que se come el cuadro.
const REPOSO_MAX_PASADAS = 288;
// La relajacion es difusiva: el movimiento decae geometricamente (9,5 -> 2,05
// -> 0,49 -> 0,12 u² por tanda de 288 pasadas) y la cola no termina nunca.
//
// Por eso el alud es PROGRESIVO: cada turno se dan hasta 288 pasadas y el
// monton se sigue asentando en los turnos siguientes, cada vez menos. Cuesta
// unos 20 ms por turno; forzar la convergencia en una sola llamada pedia mas
// de mil pasadas y un tiron de 100 ms. Y ver la arena asentarse poco a poco se
// parece mas a la arena de verdad que verla saltar a su posicion final.
//
// El umbral corta la cola cuando el movimiento ya es invisible: una milesima
// de unidad sobre un terreno de 14 de amplitud.
const REPOSO_UMBRAL = 1e-3;

/**
 * Las tres composiciones de calle, y son OTROS SUELOS, no otra decoracion.
 *
 * Lo que cambia entre ellas es COMO ESTA CORTADO EL SUELO, nada mas: mismo
 * teatro, mismas piezas y misma semilla. Y cada una cambia la partida entera
 * (`docs/ESCENARIOS.md` §3 ter):
 *
 *  - AVENIDA. La calle despejada entre dos manzanas. Todo el arco a la vista,
 *    cero cobertura, y avanzar da mucho. Es la que se entiende sola en el primer
 *    turno y la que mas necesita las trampas para no decidirse en dos ajustes.
 *  - ZANJA EN LA CALZADA. Los dos emplazamientos estan DENTRO del terreno, con
 *    el labio levantado con el cascote excavado. El tiro tenso se estrella
 *    contra tu propio parapeto y salir cuesta arriba se paga en deposito. El
 *    foso es MAS ANCHO que la pieza a proposito: con un foso justo, el blindado
 *    se apoya en los dos labios y la trinchera desaparece.
 *  - MONTON CENTRAL. Cascote amontonado en medio, con el hito encima. El
 *    decorado no colisiona —eso son las trampas— pero el monton SI ES TERRENO,
 *    y por eso avanzar hacia el es la jugada: quien lo corona domina.
 *
 * El monton pide bajar el peso del cuenco: el cuenco hunde el centro y es
 * exactamente donde va el monton, asi que con los dos a plena fuerza se anulan y
 * queda una avenida con una loma.
 */
export const COMPOSICIONES = ['avenida', 'zanja', 'monton'];

const ZANJA = {
  llano: 3.4,    // suelo del foso, plano bajo el blindado
  pared: 6.6,    // hasta donde sube la pared: 2 u en 3,2 da 0,63 de pendiente,
  hondo: 2.0,    // por debajo de los 0,9 que la oruga ya no sube
  // El labio se derrama LARGO hacia fuera: 0,95 de alto en 0,9 unidades daba una
  // cara exterior de pendiente 1,05, o sea un escalon que la oruga no sube. El
  // blindado podia moverse dentro del foso y no salir de el jamas, que no es
  // «caro» — es una jaula. Derramado hasta 10,5 la cara exterior baja a 0,35.
  labio: 10.5,
  alto: 0.95,    // el cascote excavado, amontonado fuera
};

const MONTON = {
  medio: 15,     // medio ancho del monton
  // Cuanto CORONA el monton por encima del emplazamiento mas alto. No es una
  // altura absoluta a proposito: sumar 5 unidades al relieve que salga del ruido
  // deja el monton por debajo de los dos canones la mitad de las veces, y
  // entonces no es un monton central, es una loma. Medido asi, siempre es lo
  // mas alto del campo y coronarlo siempre es la jugada.
  corona: 4.5,
  bowl: 0.45,    // lo que queda del cuenco cuando hay monton
};

/**
 * El labio del crater. Sin el, un crater es una hondonada natural: hunde y ya.
 *
 * `docs/ESCENARIOS.md` §3.4 pide 0,25 u de alto. Se reparte hasta 1,75 radios y
 * NUNCA pasa de un quinto de lo excavado: con un crater a ras de la roca madre
 * apenas se saca tierra, y el labio no puede inventarsela — la masa que sube al
 * borde se descuenta de la que vuela a sotavento.
 */
const LABIO_ALTO = 0.25;
const LABIO_ALCANCE = 1.75;
const LABIO_FRACCION = 0.2;

// Unidades de mundo que ocupa una repeticion del grano. A 6, con el encuadre
// de apuntado, cada baldosa mide algo mas de un quinto de pantalla: se ve como
// textura y no como un patron que se repite.
const GRANO_ESCALA = 6;


export class Terrain {
  constructor({
    rng,
    biome,
    width,
    columns,
    depth,
    minHeight,
    amplitude,
    baseY = -14,
    floorY = -4,
    bowlHalfWidth = 0,
    bowlWeight = 0.48,
    pads = [],
    grano = null,
    composicion = 'avenida',
  }) {
    this.width = width;
    this.cols = columns;
    this.x0 = -width / 2;
    this.dx = width / (columns - 1);
    this.depth = depth;
    this.zFront = 0;
    this.zBack = -depth;
    this.baseY = baseY;   // hasta donde baja la cara frontal (fuera de cuadro)
    this.floorY = floorY; // lo mas hondo que puede excavar un crater
    this.biome = biome;
    this.composicion = COMPOSICIONES.includes(composicion) ? composicion : 'avenida';

    // Float64 y no Float32: con Sotavento el heightmap deja de ser un perfil
    // que se dibuja y pasa a ser un libro de contabilidad. La masa total ronda
    // las 2400 u², y en simple precision (7 digitos) cada suma arrastra ~2e-4
    // de error; en un combate de 16 impactos eso se acerca al milesimo que la
    // conservacion tiene que respetar. La AO se queda en simple porque solo
    // pinta. Sigue siendo determinista entre maquinas: IEEE 754 es IEEE 754.
    this.heights = new Float64Array(columns);
    // Cuanta arena SUELTA hay encima de cada columna. El terreno generado tiene
    // laderas de hasta 72 grados y esta asentado; solo lo que ha levantado un
    // cañonazo puede derrumbarse. Sin esta distincion, un alud a 34 grados
    // aplanaria el campo entero en la primera pasada.
    this.suelta = new Float64Array(columns);
    this.ao = new Float32Array(columns);

    // Hundimiento del crater: la fisica baja el terreno de golpe —tiene que
    // ser instantanea o el proyectil siguiente veria un suelo a medio caer—
    // pero la malla lo dibuja bajando en 180 ms. `lift` es lo que la malla
    // suma por encima de la altura de verdad, y solo la malla lo mira.
    this.lift = new Float64Array(columns);
    this.lift0 = new Float64Array(columns);
    this.hundiendo = null;

    // El lecho: el perfil del terreno suavizado a lo bruto, y la cota de la que
    // cuelgan los estratos hondos. Se calcula UNA vez, al generar, y NO se
    // actualiza nunca — ni con un crater ni con un deposito. Ese es justo el
    // punto: la roca de debajo no se mueve porque encima caiga un obus, y por
    // eso un crater corta las capas en vez de arrastrarlas consigo.
    this.lecho = new Float64Array(columns);

    this._generate(rng, minHeight, amplitude, pads, bowlHalfWidth, bowlWeight);
    this._asentarLecho();

    this.crest = new THREE.Color(biome.crest);
    this.body = new THREE.Color(biome.body);
    this.deep = new THREE.Color(biome.deep);

    // El grano multiplica al color de vertice: sin el, cada estrato es un
    // plano perfecto y el suelo se lee como plastico moldeado. Viene DE FUERA
    // y no se fabrica aqui: hacerlo dentro metia un `document.createElement` en
    // la capa del mundo y con eso el terreno dejaba de poder probarse sin
    // navegador, que es media red de seguridad de este fichero.
    this.grano = grano;
    // ── LA CARA FRONTAL NO SE ILUMINA ────────────────────────────────────
    //
    // Su normal apunta a la camara, y la key entra desde arriba-izquierda a 48
    // grados: el producto escalar es casi cero, asi que la cara frontal solo
    // recibia relleno y hemisferica. Con paletas claras —el desierto— colaba;
    // con las de una ciudad, mitad de la pantalla se iba a un barro casi negro
    // (medido: el cuerpo #877C6C de Berlin salia por pantalla a #362A0E).
    //
    // Sin luz, el color que se ve ES el de la paleta por su banda, que es
    // exactamente lo que especifica la plancha: franjas de color plano. Y de
    // paso el suelo deja de depender del angulo de una luz que no lo toca.
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    // La superficie de arriba SI se ilumina: es la que coge la key y la que
    // da la forma de la cresta. Es la unica cara del terreno con relieve.
    this.materialSuperficie = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: null,
      roughness: 0.94,
      metalness: 0.0,
    });

    this._buildGeometries();
    this.rebuild(0, this.cols - 1);

    this.group = new THREE.Group();
    this.group.name = 'terrain';

    this.frontMesh = new THREE.Mesh(this.frontGeo, this.material);
    this.frontMesh.receiveShadow = true;

    this.topMesh = new THREE.Mesh(this.topGeo, this.materialSuperficie);
    this.topMesh.receiveShadow = true;

    this.group.add(this.frontMesh, this.topMesh);
  }

  // ---------------------------------------------------------------- perfil

  _generate(rng, minHeight, amplitude, pads, bowlHalfWidth, bowlWeight) {
    const noise = makeNoise1D(rng);
    // Envolvente de cuenco: alto en los extremos, valle en el centro. Sin
    // ella el ruido puro planta muros pegados a los canones y un tiro a
    // maxima potencia se estrella a 5 unidades de la boca. Ademas es la forma
    // clasica de arena de artilleria: los dos tiran cuesta abajo.
    const bowlK = bowlHalfWidth > 0 ? Math.PI / bowlHalfWidth : 0;
    const peso = this.composicion === 'monton' ? bowlWeight * MONTON.bowl : bowlWeight;
    const w = bowlHalfWidth > 0 ? peso : 0;
    // Desplazamientos con semilla para que dos partidas no compartan relieve.
    const o1 = rng() * 500;
    const o2 = rng() * 500;
    const o3 = rng() * 500;

    for (let i = 0; i < this.cols; i++) {
      const x = this.x0 + i * this.dx;
      const macro = fbm1D(noise, x * 0.055 + o1, { octaves: 4, gain: 0.55 });
      const meso = fbm1D(noise, x * 0.16 + o2, { octaves: 3, gain: 0.5 });
      const micro = fbm1D(noise, x * 0.52 + o3, { octaves: 2, gain: 0.45 });
      const raw = macro * 0.66 + meso * 0.26 + micro * 0.08;
      // El fBm de ruido de valor es una media de octavas, asi que regresa a
      // 0.5 y se queda en una banda estrecha: sin expandir el contraste el
      // terreno solo usaba el 41% de la amplitud pedida y salia casi llano.
      // La saturacion es tanh y no un recorte duro: recortar dejaba mesetas
      // planas en los extremos y el bioma de dunas pide perfil redondeado.
      const shaped = 0.5 + 0.5 * Math.tanh((raw - 0.5) * CONTRAST);
      const bowl = bowlK > 0 ? (1 - Math.cos(x * bowlK)) / 2 : 0;
      this.heights[i] = minHeight + (shaped * (1 - w) + bowl * w) * amplitude;
    }

    // El campo no es virgen: aqui ya se ha combatido.
    this._cicatrices(rng, pads);

    for (const pad of pads) this._flattenPad(pad.x, pad.halfWidth, pad.feather);

    // La composicion va LA ULTIMA, despues de aplanar los emplazamientos: el
    // foso baja una meseta que ya es plana y sigue siendolo, y el labio no se
    // lo come el difuminado del `pad`. Al reves, aplanar despues rellenaria
    // media zanja y no quedaria trinchera ninguna.
    this._componer(pads);
  }

  /**
   * Corta el suelo segun la composicion. Es lo unico que las separa.
   */
  _componer(pads) {
    if (this.composicion === 'zanja') {
      for (const pad of pads) {
        // Primero se nivela LA CALLE entera, no solo la meseta del blindado.
        // Sin esto el foso es un delta sobre el relieve de siempre: donde el
        // terreno ya caia hacia el centro, el labio de ese lado sale POR DEBAJO
        // del fondo del foso y no cubre nada. Una zanja en la calzada es un
        // corte en algo llano; sobre una ladera es una cuneta.
        this._flattenPad(pad.x, ZANJA.labio, 4.0);
        const i0 = Math.max(0, Math.floor((pad.x - ZANJA.labio - this.x0) / this.dx));
        const i1 = Math.min(this.cols - 1, Math.ceil((pad.x + ZANJA.labio - this.x0) / this.dx));
        for (let i = i0; i <= i1; i++) {
          const d = Math.abs(this.x0 + i * this.dx - pad.x);
          if (d < ZANJA.llano) {
            this.heights[i] -= ZANJA.hondo;
          } else if (d < ZANJA.pared) {
            const t = (d - ZANJA.llano) / (ZANJA.pared - ZANJA.llano);
            this.heights[i] -= ZANJA.hondo * (0.5 + 0.5 * Math.cos(t * Math.PI));
          } else if (d < ZANJA.labio) {
            const t = (ZANJA.labio - d) / (ZANJA.labio - ZANJA.pared);
            this.heights[i] += ZANJA.alto * Math.sin(t * Math.PI);
          }
        }
      }
      return;
    }

    if (this.composicion === 'monton') {
      let emplazamiento = -Infinity;
      for (const pad of pads) emplazamiento = Math.max(emplazamiento, this.heightAt(pad.x));
      if (emplazamiento === -Infinity) emplazamiento = this.heightAt(0);
      // Y con tope. La pendiente maxima de un coseno al cuadrado de este ancho
      // es `alto * pi / (2 * medio)` = alto * 0,105, asi que por encima de 8,6
      // el monton pasa de los 0,9 que sube una oruga y deja de ser una decision
      // para ser una pared. Ocho deja margen.
      const alto = Math.min(8, Math.max(1.5, emplazamiento + MONTON.corona - this.heightAt(0)));
      for (let i = 0; i < this.cols; i++) {
        const x = this.x0 + i * this.dx;
        const t = Math.abs(x) / MONTON.medio;
        if (t >= 1) continue;
        // Coseno al cuadrado: sube sin canto y con la pendiente maxima en la
        // ladera, no en la cima. Una campana de Gauss deja la cima demasiado
        // aguda y el monton se lee como un pico, no como escombro apilado. Y la
        // pendiente maxima sale 0,47: se sube, caro, que es lo que se pide.
        this.heights[i] += alto * Math.cos((t * Math.PI) / 2) ** 2;
      }
    }
  }

  /**
   * El lecho: media movil ancha del perfil recien generado.
   *
   * Suma acumulada, asi que cuesta una pasada por columna por ancha que sea la
   * ventana. Es lo que sostiene los estratos hondos, y por eso se calcula
   * DESPUES de las cicatrices y de las plataformas: el lecho tiene que ser el
   * del campo que se juega, no el del ruido de antes de tocarlo.
   */
  _asentarLecho() {
    const suma = new Float64Array(this.cols + 1);
    for (let i = 0; i < this.cols; i++) suma[i + 1] = suma[i] + this.heights[i];
    for (let i = 0; i < this.cols; i++) {
      const a = Math.max(0, i - LECHO_VENTANA);
      const b = Math.min(this.cols - 1, i + LECHO_VENTANA);
      this.lecho[i] = (suma[b + 1] - suma[a]) / (b - a + 1);
    }
  }

  /**
   * Craterizado y parapetos de partida.
   *
   * Sin esto el perfil es fBm puro y sale un campo de dunas: bonito y de
   * ninguna guerra. Lo que convierte un relieve en tierra de nadie es la
   * MARCA — hoyos de obus con su borde levantado, y taludes de tierra apilada
   * a mano donde alguien se ha atrincherado.
   *
   * Va en el heightmap de partida, no encima: asi la contabilidad de masa de
   * Sotavento arranca ya con esto dentro y un crater viejo se comporta igual
   * que uno nuevo — se puede rellenar con arena, y eso es jugable.
   */
  _cicatrices(rng, pads) {
    // Despejado alrededor de cada cañon. No es estetico: un parapeto a doce
    // metros de la boca tapa el tiro tenso y el combate nace sin solucion.
    //
    // Todo lo de aqui esta MEDIDO con `verificar:sotavento`, 200 combates de 16
    // disparos. El primer craterizado subio los combates que Sotavento vuelve
    // imposibles de 3 de 200 a 7, por encima de la tolerancia del 2 %. Curiosear
    // cual era el culpable dio la sorpresa: no eran los parapetos —quitarlos lo
    // dejaba en 6— sino los hoyos, por su labio. Con hoyos mas pequeños y menos
    // hondos baja a 2 de 200, mejor que el terreno liso del que se partia.
    const DESPEJE = 26;
    const seguro = (x) => pads.some((p) => Math.abs(p.x - x) < DESPEJE);

    // --- hoyos de obus. El borde levantado es lo que los hace legibles: un
    // hoyo sin labio parece una hondonada natural.
    const cuantos = 7 + Math.floor(rng() * 6);
    for (let n = 0; n < cuantos; n++) {
      const cx = (rng() * 2 - 1) * (this.width / 2 - 6);
      if (seguro(cx)) continue;
      const r = 1.8 + rng() * 3.2;
      const hondura = r * (0.24 + rng() * 0.2);
      const labio = hondura * 0.22;

      const i0 = Math.max(0, Math.floor((cx - r * 1.8 - this.x0) / this.dx));
      const i1 = Math.min(this.cols - 1, Math.ceil((cx + r * 1.8 - this.x0) / this.dx));
      for (let i = i0; i <= i1; i++) {
        const d = Math.abs(this.x0 + i * this.dx - cx);
        if (d < r) {
          // Cuenco: coseno alzado, que baja suave y no deja escalon.
          this.heights[i] -= hondura * (1 + Math.cos((d / r) * Math.PI)) * 0.5;
        } else if (d < r * 1.8) {
          // Labio: la tierra que salio del hoyo, amontonada alrededor.
          const t = (d - r) / (r * 0.8);
          this.heights[i] += labio * Math.sin((1 - t) * Math.PI) * 0.8;
        }
      }
    }

    // --- parapetos: taludes rectos de tierra apilada. Un talud con la cara
    // plana no lo hace la erosion; lo hace una pala. Es lo que dice que aqui
    // hubo alguien cavando.
    const parapetos = 2 + Math.floor(rng() * 3);
    for (let n = 0; n < parapetos; n++) {
      const cx = (rng() * 2 - 1) * (this.width / 2 - 14);
      if (seguro(cx)) continue;
      const largo = 4 + rng() * 7;
      const alto = 0.8 + rng() * 1.0;
      const i0 = Math.max(0, Math.floor((cx - largo - this.x0) / this.dx));
      const i1 = Math.min(this.cols - 1, Math.ceil((cx + largo - this.x0) / this.dx));
      for (let i = i0; i <= i1; i++) {
        const t = Math.abs(this.x0 + i * this.dx - cx) / largo;
        // Meseta con las faldas en rampa: plano arriba, corte claro a los lados.
        this.heights[i] += alto * (1 - smoothstep(0.55, 1, t));
      }
    }
  }

  /** Aplana una meseta bajo cada canon para que apoyen bien. */
  _flattenPad(cx, halfWidth, feather) {
    const target = this.heightAt(cx);
    const reach = halfWidth + feather;
    const i0 = Math.max(0, Math.floor((cx - reach - this.x0) / this.dx));
    const i1 = Math.min(this.cols - 1, Math.ceil((cx + reach - this.x0) / this.dx));
    for (let i = i0; i <= i1; i++) {
      const d = Math.abs(this.x0 + i * this.dx - cx);
      const t = 1 - smoothstep(halfWidth, reach, d);
      this.heights[i] = lerp(this.heights[i], target, t);
    }
  }

  // ------------------------------------------------------------ consultas

  /** Altura del terreno en una x del mundo, interpolada entre columnas. */
  heightAt(x) {
    const f = (x - this.x0) / this.dx;
    if (f <= 0) return this.heights[0];
    if (f >= this.cols - 1) return this.heights[this.cols - 1];
    const i = Math.floor(f);
    return lerp(this.heights[i], this.heights[i + 1], f - i);
  }

  /** Pendiente (dy/dx) en una x del mundo. */
  slopeAt(x) {
    return (this.heightAt(x + this.dx) - this.heightAt(x - this.dx)) / (2 * this.dx);
  }

  // ---------------------------------------------------------- destruccion

  /**
   * Resta un semicirculo de radio `r` centrado en el impacto: cada columna
   * baja hasta la parte inferior del circulo. Devuelve el rango tocado, que
   * la fase de animacion necesitara para interpolar el hundimiento.
   */
  carve(cx, cy, r, { rehacerMalla = true, hundimiento = false } = {}) {
    const i0 = Math.max(0, Math.floor((cx - r - this.x0) / this.dx));
    const i1 = Math.min(this.cols - 1, Math.ceil((cx + r - this.x0) / this.dx));

    if (hundimiento) {
      // Un crater cancela el hundimiento del anterior: si el turno pasado
      // quedo a medio bajar, se asienta ya. Nunca hay dos a la vez.
      this.lift.fill(0);
      this.lift0.fill(0);
    }

    // La masa que sale del crater no se destruye: la recoge quien llame para
    // volver a soltarla a sotavento. Se mide lo que REALMENTE se quita, que no
    // es el semidisco entero: donde el crater toca `floorY` hay roca madre, y
    // donde el suelo ya estaba por debajo no se quita nada.
    let volumen = 0;

    for (let i = i0; i <= i1; i++) {
      const dx = this.x0 + i * this.dx - cx;
      const k = r * r - dx * dx;
      if (k <= 0) continue;
      const bottom = cy - Math.sqrt(k);
      if (this.heights[i] > bottom) {
        const antes = this.heights[i];
        // El borde del crater se FUNDE con el terreno, no lo corta.
        //
        // Restar el semicirculo entero deja un escalon vertical en cuanto el
        // suelo esta en cuesta: en el borde, el fondo del circulo vale la cota
        // del impacto y el terreno de al lado sigue dos unidades mas arriba. Lo
        // que se veia era un pozo de paredes rectas, y con los estratos anclados
        // al lecho —que dejan ver el corte— se leia como un tajo cuadrado.
        //
        // Se quita lo mismo en el centro y nada en el borde, asi que el crater
        // se apoya en el terreno cualquiera que sea su pendiente.
        const borde = 1 - smoothstep(0.55, 1, Math.abs(dx) / r);
        const objetivo = Math.max(this.floorY, lerp(antes, bottom, borde));
        this.heights[i] = objetivo;
        const quitado = antes - this.heights[i];
        volumen += quitado * this.dx;
        // Lo que se lleva el crater incluye la arena suelta que hubiera ahi.
        this.suelta[i] = Math.max(0, this.suelta[i] - quitado);
        if (hundimiento) {
          this.lift0[i] = quitado;
          this.lift[i] = quitado;
        }
      }
    }

    // ── el labio ────────────────────────────────────────────────────────
    //
    // Un crater sin labio es una hondonada natural: hunde, y ya. Lo que da la
    // lectura de IMPACTO es el anillo levantado alrededor (`ESCENARIOS.md` §3.4).
    //
    // La masa sale de la que se excavo y se descuenta del volumen que se
    // devuelve, asi que Sotavento sigue conservandose exactamente: lo que no
    // vuela a sotavento es porque se ha quedado en el borde del hoyo.
    const jl0 = Math.max(0, Math.floor((cx - r * LABIO_ALCANCE - this.x0) / this.dx));
    const jl1 = Math.min(this.cols - 1, Math.ceil((cx + r * LABIO_ALCANCE - this.x0) / this.dx));
    const forma = [];
    let masaLabio = 0;
    for (let i = jl0; i <= jl1; i++) {
      const d = Math.abs(this.x0 + i * this.dx - cx);
      if (d < r || d > r * LABIO_ALCANCE) { forma.push(0); continue; }
      // Coseno: maximo pegado al borde del hoyo y cero al final. La eyeccion se
      // amontona en el labio, no a media distancia.
      const t = (d - r) / (r * (LABIO_ALCANCE - 1));
      const alto = LABIO_ALTO * Math.cos((t * Math.PI) / 2);
      forma.push(alto);
      masaLabio += alto * this.dx;
    }
    // Y nunca mas de lo que se ha sacado: con un crater a ras de la roca madre
    // apenas se excava nada y el labio no puede inventarse tierra.
    const escala = masaLabio > 0 ? Math.min(1, (volumen * LABIO_FRACCION) / masaLabio) : 0;
    if (escala > 0) {
      for (let i = jl0; i <= jl1; i++) {
        const alto = forma[i - jl0] * escala;
        if (alto <= 0) continue;
        this.heights[i] += alto;
        // Es tierra removida: se apila suelta y se derrumba como tal.
        this.suelta[i] += alto;
        volumen -= alto * this.dx;
      }
    }

    if (hundimiento) this.hundiendo = { i0, i1 };

    // La AO mira a los vecinos, asi que hay que refrescar mas ancho que el
    // crater; y el labio se sale del crater, asi que se refresca desde el.
    if (rehacerMalla) this.rebuild(jl0 - AO_WINDOW, jl1 + AO_WINDOW);
    return { i0, i1, volumen };
  }

  /**
   * Baja la malla hacia la altura que la fisica ya tiene.
   *
   * @param {number} k 0 = como estaba antes del impacto, 1 = asentado del todo
   * @returns {boolean} si queda hundimiento por animar
   */
  avanzarHundimiento(k) {
    const h = this.hundiendo;
    if (!h) return false;

    const resto = 1 - Math.min(1, Math.max(0, k));
    for (let i = h.i0; i <= h.i1; i++) this.lift[i] = this.lift0[i] * resto;
    this.rebuild(h.i0 - AO_WINDOW, h.i1 + AO_WINDOW);

    if (resto <= 0) {
      this.hundiendo = null;
      return false;
    }
    return true;
  }

  /**
   * Suelta `volumen` de arena en una campana centrada en `xc`.
   *
   * Los pesos se normalizan sobre la campana COMPLETA, incluidas las columnas
   * que caen fuera del mundo: esa parte se pierde de verdad, y se devuelve
   * aparte para que quien llame pueda comprobar que la masa cuadra. Normalizar
   * solo sobre lo que cabe habria metido de vuelta al campo la arena que el
   * viento se llevo fuera, y la conservacion seria mentira.
   */
  depositar(xc, sigma, volumen, { rehacerMalla = true } = {}) {
    const vacio = { i0: 0, i1: -1, depositado: 0, perdido: 0 };
    if (!(volumen > 0) || !(sigma > 0)) return vacio;

    // Mas alla de cuatro sigmas queda menos de un 0,007 % de la campana.
    const alcance = 4 * sigma;
    const desde = Math.floor((xc - alcance - this.x0) / this.dx);
    const hasta = Math.ceil((xc + alcance - this.x0) / this.dx);

    let suma = 0;
    for (let i = desde; i <= hasta; i++) {
      const d = this.x0 + i * this.dx - xc;
      suma += Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    if (suma <= 0) return vacio;

    const escala = volumen / (suma * this.dx);
    const i0 = Math.max(0, desde);
    const i1 = Math.min(this.cols - 1, hasta);

    let depositado = 0;
    for (let i = i0; i <= i1; i++) {
      const d = this.x0 + i * this.dx - xc;
      const altura = escala * Math.exp(-(d * d) / (2 * sigma * sigma));
      this.heights[i] += altura;
      this.suelta[i] += altura;
      depositado += altura * this.dx;
    }

    if (rehacerMalla && i1 >= i0) this.rebuild(i0 - AO_WINDOW, i1 + AO_WINDOW);
    return { i0, i1, depositado, perdido: volumen - depositado };
  }

  /**
   * Deja caer la arena que este mas empinada que su angulo de reposo.
   *
   * Hace falta desde que los depositos se apilan: una campana suelta de pico
   * 1,77 y sigma 2,4 tiene pendiente maxima 0,447 y aguanta sola, pero tres
   * capas en el mismo sitio llegan a 5,30 y se derrumban.
   *
   * La transferencia es COMPLETA, no la mitad. Con media transferencia la
   * relajacion se vuelve difusiva y necesita miles de pasadas para asentar un
   * talud: el terreno se quedaria congelado a media caida.
   *
   * El barrido alterna sentido en cada pasada. Recorrer siempre de izquierda a
   * derecha empuja la arena en esa direccion y un campo simetrico acabaria
   * torcido.
   *
   * @returns {{pasadas:number, movido:number, estable:boolean}}
   */
  reposar(desde = 0, hasta = this.cols - 1, { rehacerMalla = true } = {}) {
    const i0 = Math.max(1, desde);
    const i1 = Math.min(this.cols - 2, hasta);
    const maxima = REPOSO_TANGENTE * this.dx;

    let pasadas = 0;
    let movido = 0;
    let estable = false;

    for (; pasadas < REPOSO_MAX_PASADAS; pasadas++) {
      let enEstaPasada = 0;
      const alReves = pasadas % 2 === 1;
      const inicio = alReves ? i1 : i0;
      const fin = alReves ? i0 : i1;
      const salto = alReves ? -1 : 1;

      for (let i = inicio; alReves ? i >= fin : i <= fin; i += salto) {
        for (const vecino of [i - 1, i + 1]) {
          if (vecino < 0 || vecino >= this.cols) continue;
          const exceso = this.suelta[i] - this.suelta[vecino] - maxima;
          if (exceso <= 0) continue;

          // Solo se derrumba lo que esta suelto: la ladera original aguanta por
          // empinada que sea, y la arena de encima se sostiene sobre ella.
          const mitad = Math.min(exceso / 2, this.suelta[i]);
          if (mitad <= 1e-12) continue;

          // Lo que baja uno lo sube el otro: la masa se conserva exactamente.
          this.heights[i] -= mitad;
          this.heights[vecino] += mitad;
          this.suelta[i] -= mitad;
          this.suelta[vecino] += mitad;
          movido += mitad * this.dx;
          enEstaPasada += mitad;
        }
      }

      if (enEstaPasada < REPOSO_UMBRAL) {
        estable = true;
        break;
      }
    }

    if (rehacerMalla && movido > 0) this.rebuild(i0 - AO_WINDOW, i1 + AO_WINDOW);
    return { pasadas, movido, estable };
  }

  // ------------------------------------------------------------- geometria

  _buildGeometries() {
    const cols = this.cols;

    // --- cara frontal: rejilla cols x ROWS en z = 0
    const fCount = cols * ROWS;
    const fPos = new Float32Array(fCount * 3);
    const fNor = new Float32Array(fCount * 3);
    const fCol = new Float32Array(fCount * 3);
    for (let i = 0; i < fCount; i++) fNor[i * 3 + 2] = 1;

    // Coordenadas de textura proyectadas en MUNDO, no en la malla: asi el
    // grano no se estira cuando un crater deforma el perfil, y dos columnas
    // vecinas nunca comparten el mismo trozo de textura.
    const fUv = new Float32Array(fCount * 2);

    const fIdx = [];
    for (let i = 0; i < cols - 1; i++) {
      for (let j = 0; j < ROWS - 1; j++) {
        const a = i * ROWS + j;
        const b = (i + 1) * ROWS + j;
        const c = (i + 1) * ROWS + j + 1;
        const d = i * ROWS + j + 1;
        fIdx.push(a, d, b, b, d, c); // caras mirando a +Z
      }
    }
    this.frontGeo = new THREE.BufferGeometry();
    this.frontGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    this.frontGeo.setAttribute('normal', new THREE.BufferAttribute(fNor, 3));
    this.frontGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
    this.frontGeo.setAttribute('uv', new THREE.BufferAttribute(fUv, 2));
    this.frontGeo.setIndex(fIdx);

    // --- superficie superior: 2 vertices por columna (z = 0 y z = -depth)
    const tCount = cols * 2;
    this.topGeo = new THREE.BufferGeometry();
    this.topGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tCount * 3), 3));
    this.topGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tCount * 3), 3));
    this.topGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tCount * 3), 3));
    this.topGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tCount * 2), 2));
    const tIdx = [];
    for (let i = 0; i < cols - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      tIdx.push(a, c, b, b, c, d); // normales hacia +Y
    }
    this.topGeo.setIndex(tIdx);
  }

  /**
   * Altura que DIBUJA la malla: la de la fisica mas el hundimiento pendiente.
   * Fuera de una animacion de crater `lift` es cero y las dos coinciden.
   * Nadie de `game/` puede llamar a esto.
   */
  _visual(i) {
    return this.heights[i] + this.lift[i];
  }

  /** Oclusion de horizonte barata: cuanto cielo tapan los vecinos. */
  _computeAO(i) {
    const hi = this._visual(i);
    let maxSlope = 0;
    for (let k = 1; k <= AO_WINDOW; k++) {
      const d = k * this.dx;
      const sl = (this._visual(Math.max(0, i - k)) - hi) / d;
      const sr = (this._visual(Math.min(this.cols - 1, i + k)) - hi) / d;
      if (sl > maxSlope) maxSlope = sl;
      if (sr > maxSlope) maxSlope = sr;
    }
    return 1 - AO_STRENGTH * (Math.atan(maxSlope) / (Math.PI / 2));
  }

  /** Reescribe posiciones, normales y colores de un rango de columnas. */
  rebuild(from, to) {
    const i0 = Math.max(0, from);
    const i1 = Math.min(this.cols - 1, to);

    for (let i = i0; i <= i1; i++) this.ao[i] = this._computeAO(i);

    const fPos = this.frontGeo.attributes.position.array;
    const fCol = this.frontGeo.attributes.color.array;
    const fUv = this.frontGeo.attributes.uv.array;
    const tPos = this.topGeo.attributes.position.array;
    const tNor = this.topGeo.attributes.normal.array;
    const tCol = this.topGeo.attributes.color.array;
    const tUv = this.topGeo.attributes.uv.array;
    const tmp = new THREE.Color();

    for (let i = i0; i <= i1; i++) {
      const x = this.x0 + i * this.dx;
      const h = this._visual(i);
      const ao = this.ao[i];
      const span = h - this.baseY;

      // --- cara frontal
      //
      // La costra cuelga de la SUPERFICIE y las bandas hondas del LECHO. En
      // medio, la curva de `aplanado`. Es lo que convierte seis lineas
      // paralelas ondulando a la vez en un corte de terreno.
      const lecho = this.lecho[i];
      let anterior = Infinity;
      let profAnterior = -1;
      for (let j = 0; j < ROWS; j++) {
        const [prof, banda] = FILAS[j];
        // La ultima fila y cualquiera mas honda que la columna se pegan a la
        // base: las filas sobrantes salen degeneradas y no se ven.
        const depth = Math.min(prof, span);
        const a = aplanado(depth);
        let y = h - depth + a * (lecho - h);
        // Dos filas que comparten profundidad son un BORDE de banda y tienen que
        // caer exactamente a la misma y: separadas, el corte duro entre dos
        // colores se convierte en el degradado que las bandas venian a quitar.
        // Y ninguna fila puede subirse por encima de la anterior: en una vaguada
        // honda el lecho esta por encima del suelo y sin este tope las capas se
        // cruzarian y la malla saldria del reves.
        if (prof === profAnterior) y = anterior;
        else y = Math.min(y, anterior - SEPARACION_FILA);
        anterior = y;
        profAnterior = prof;

        const k = (i * ROWS + j) * 3;
        fPos[k + 0] = x;
        fPos[k + 1] = y;
        fPos[k + 2] = this.zFront;
        fUv[(i * ROWS + j) * 2 + 0] = x / GRANO_ESCALA;
        fUv[(i * ROWS + j) * 2 + 1] = y / GRANO_ESCALA;

        const capa = ESTRATOS[banda];
        // La costra sale de la cresta; el resto, del cuerpo al hondo.
        if (capa.mezcla === 0) tmp.copy(this.crest);
        else tmp.copy(this.body).lerp(this.deep, capa.mezcla);

        // La AO solo muerde cerca de la superficie. El hundimiento por
        // profundidad se ha quitado: era un degradado, y con cuatro bandas el
        // color de la mas honda ya hace que el fondo retroceda.
        const aoMix = lerp(1, ao, 1 - smoothstep(0, AO_FADE_DEPTH, depth));
        const shade = aoMix * capa.brillo;
        fCol[k + 0] = Math.min(1, tmp.r * shade);
        fCol[k + 1] = Math.min(1, tmp.g * shade);
        fCol[k + 2] = Math.min(1, tmp.b * shade);
      }

      // --- superficie superior
      const hl = this._visual(Math.max(0, i - 1));
      const hr = this._visual(Math.min(this.cols - 1, i + 1));
      const dhdx = (hr - hl) / (2 * this.dx);
      // La normal se endereza hacia arriba antes de usarla.
      //
      // Con la normal real, una ladera que cae a la derecha apunta al lado
      // contrario de la key —que entra desde arriba-izquierda a 48°— y la franja
      // de superficie se iba a NEGRO: en pantalla salia una raya oscura pegada
      // al perfil que se leia como un agujero, no como la cresta del suelo. Con
      // la normal a medio camino de la vertical la franja sigue dando forma
      // (una cuesta se distingue de un llano) pero no se apaga nunca.
      const ENDEREZADO = 0.6;
      const px = -dhdx * (1 - ENDEREZADO);
      const nlen = Math.hypot(px, 1);
      const nx = px / nlen;
      const ny = 1 / nlen;

      const kf = i * 2 * 3;
      const kb = (i * 2 + 1) * 3;
      tPos[kf + 0] = x; tPos[kf + 1] = h; tPos[kf + 2] = this.zFront;
      tPos[kb + 0] = x; tPos[kb + 1] = h; tPos[kb + 2] = this.zBack;
      tNor[kf + 0] = nx; tNor[kf + 1] = ny; tNor[kf + 2] = 0;
      tNor[kb + 0] = nx; tNor[kb + 1] = ny; tNor[kb + 2] = 0;
      const ku = i * 2 * 2;
      tUv[ku + 0] = x / GRANO_ESCALA; tUv[ku + 1] = 0;
      tUv[ku + 2] = x / GRANO_ESCALA; tUv[ku + 3] = this.depth / GRANO_ESCALA;

      // La cresta se apaga en pendiente fuerte: la arena no se queda en la pared.
      const steep = smoothstep(0.55, 1.5, Math.abs(dhdx));
      tmp.copy(this.crest).lerp(this.body, steep);
      const r = tmp.r * ao;
      const g = tmp.g * ao;
      const b = tmp.b * ao;
      tCol[kf + 0] = r; tCol[kf + 1] = g; tCol[kf + 2] = b;
      // el borde trasero cae un poco: insinua el grosor sin una cara extra
      tCol[kb + 0] = r * 0.8; tCol[kb + 1] = g * 0.8; tCol[kb + 2] = b * 0.8;
    }

    this.frontGeo.attributes.position.needsUpdate = true;
    this.frontGeo.attributes.color.needsUpdate = true;
    this.frontGeo.attributes.uv.needsUpdate = true;
    this.topGeo.attributes.uv.needsUpdate = true;
    this.topGeo.attributes.position.needsUpdate = true;
    this.topGeo.attributes.normal.needsUpdate = true;
    this.topGeo.attributes.color.needsUpdate = true;

    this.frontGeo.computeBoundingSphere();
    this.topGeo.computeBoundingSphere();
  }
}
