import * as THREE from 'three';
import { mulberry32, hashSeed } from './core/rng.js';
import { clamp, lerp, DEG, RAD_TO_DEG } from './core/mathx.js';
import { easeInOutCubic, easeOutQuad, easeOutCubic } from './core/easing.js';
import {
  BIOMES,
  LIGHT,
  MATERIALS,
  PROJECTILE_RIM,
  projectileAccent,
  esGranGuerra,
} from './art/direction.js';
import { makeDotTexture, makeSkyTexture, makeGrainTexture } from './art/geometry.js';
import { crearEfectos } from './art/efectos.js';
import { crearFondo } from './art/fondo.js';
import { crearCalidad, NIVELES } from './art/calidad.js';
import { actualizarContorno } from './art/vehiculo/toon.js';
import { crearAtrezo } from './art/atrezo.js';
import { Terrain } from './world/terrain.js';
import { buildCannon } from './world/cannon.js';
import { GameCamera } from './world/gamecamera.js';
import { TrajectoryArc } from './world/trajectory.js';
import { attachDragControl } from './ui/input.js';
import { FIXED_DT, simulate, step, sweepTerrain, launchVelocity } from './game/ballistics.js';
import { crearViento, flechaDe } from './game/viento.js';
import { transporte } from './game/sotavento.js';
import { DIFICULTAD, apuntar as apuntarIA, reaccionar as reaccionarIA } from './game/ia.js';
import { generarTrampas, chocarCon, resolverChoque, minaEn, nivelDe } from './game/trampas.js';
import { AVANCE, mover, repostar, encerrado, fraccion as fraccionDeposito } from './game/avance.js';
import { lecturaDeTiro, acerto } from './game/lectura.js';
import { codificar, decodificar, semillaDeRevancha } from './game/replay.js';
import {
  MAX_HP,
  BLAST,
  REACTION,
  damageAt,
  targetPoint,
  newPlayerState,
  applyDamage,
} from './game/combat.js';
import { Hud } from './ui/hud.js';
import { idiomaDelNavegador, crearTraductor, aplicarTraduccion } from './ui/i18n.js';
import { exponerGanchos } from './ui/inspeccion.js';
import { crearCliente } from './net/cliente.js';
import { crearLobby } from './ui/lobby.js';
import { crearSincronia } from './net/sincronia.js';
import { crearFranja } from './ui/franja.js';
import { crearSonidos } from '../src/audio/sonidos.js';
import {
  crearPartida,
  avanzarTurno,
  posicionesDe,
  participanteActivo,
  ganador as ganadorDe,
} from './game/roster.js';
import { ACCION } from './net/protocolo.js';

// El idioma se resuelve una vez, antes de construir nada: el HUD y la pantalla
// de victoria lo reciben ya decidido.
const idioma = idiomaDelNavegador();
const t = crearTraductor(idioma);
document.documentElement.lang = idioma;
document.title = t('titulo');
aplicarTraduccion(document, t);

// ───────────────────────────────────────────────────────────── configuracion

const params = new URLSearchParams(location.search);

const CONFIG = {
  seed: params.get('seed') || 'alamein-01',
  // El teatro decide paleta Y epoca: en el Somme y en Flandes se combate con
  // rombos de la Gran Guerra, en los demas con blindados de torreta.
  biome: params.get('biome') || 'alamein',

  camera: {
    elevationDeg: 15,
    aimWidth: 30,        // apuntando: solo tu lado del campo
    dragMaxWidth: 68,    // hasta donde abre plano al estirar el arrastre
    flightWidth: 40,     // siguiendo al proyectil
    scoutWidth: 42,      // oteando al rival
    victoryWidth: 26,
  },

  world: {
    width: 140,          // los canones quedan a 88 unidades: el rival no cabe
    columns: 1400,
    // A 15 grados solo se ve depth * sin(15) de superficie superior, y esa
    // franja es lo unico que da volumen al terreno.
    depth: 4.2,
    minHeight: 3.2,
    amplitude: 13,
    // La cara frontal baja muy por debajo del encuadre: al abrir plano con el
    // pellizco se veria el borde inferior del bloque de terreno.
    baseY: -80,
    floorY: -4,
    // Los extremos suben hacia los canones y el centro se hunde: garantiza
    // linea de tiro despejada para los dos. Se fija en buildWorld a cannonX.
    bowlWeight: 0.48,
  },

  cannonX: 44,
  cannonZ: -0.9,
  playZ: 0.25,           // plano de vuelo, por delante del muro frontal

  speed: { min: 14, max: 56 },
  windRange: 3.4,

  // 1 = arco completo hasta el impacto. 0 = solo los tres primeros puntos.
  assistLevel: params.has('assist') ? clamp(parseFloat(params.get('assist')), 0, 1) : 1,

  // ?ia=facil|normal|dificil hace que la maquina lleve el bando B. Sin el
  // parametro no hay IA y el juego se comporta como siempre.
  ia: params.get('ia'),

  // ?trampas=0..1 siembra el campo de minas, deflectores y muros. A 0 no hay
  // ninguna y el juego es el de siempre.
  trampas: params.has('trampas') ? clamp(parseFloat(params.get('trampas')), 0, 1) : 0.5,

  // ?calidad=alta|media|baja|minima clava el nivel de pintado. Sin el, el juego
  // lo ajusta solo mirando lo que tarda cada cuadro.
  calidad: params.get('calidad'),

  craterRadius: 2.6,
  // La pluma dura 1,4 s: lo que tarda la arena en verse caer sin que el turno
  // se haga largo. Se suelta en 12 tandas, no de golpe.
  plumaSteps: 168,
  plumaTandas: 12,       // ~0.45 s mirando el impacto antes de cambiar turno
};

const MIN_PHI = 2 * DEG;
const MAX_PHI = 170 * DEG;

// Hundimiento del crater, ARTE.md seccion 14. Solo dibujo: la fisica ya bajo.
const HUNDIMIENTO_MS = 180;

// ─────────────────────────────────────────────────────────────────── montaje

const stage = document.getElementById('stage');
const biome = BIOMES[CONFIG.biome] ?? BIOMES.alamein;
const accent = projectileAccent(biome);
const granGuerra = esGranGuerra(biome);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LIGHT.exposicion;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSkyTexture(biome.sky);

const cam = new GameCamera({
  elevationDeg: CONFIG.camera.elevationDeg,
  viewWidth: CONFIG.camera.aimWidth,
});

// ── luz ──────────────────────────────────────────────────────────────────
// Key calida a 45 grados en azimut, 48 de elevacion, desde arriba-izquierda.
const keyDir = new THREE.Vector3(-1, 1.35, 0.75).normalize();
const key = new THREE.DirectionalLight(LIGHT.keyColor, LIGHT.keyIntensity);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -34;
key.shadow.camera.right = 34;
key.shadow.camera.top = 40;
key.shadow.camera.bottom = -40;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 260;
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.06;
key.shadow.radius = LIGHT.shadowRadius;
scene.add(key, key.target);

// Con el campo a 120 unidades, un mapa de sombra fijo para todo el mundo
// daria 6 cm por texel. En vez de eso la sombra viaja con la camara y solo
// cubre lo visible, asi que el contacto se mantiene nitido.
function trackShadow() {
  key.target.position.set(cam.cx, cam.cy, 0);
  key.position.copy(keyDir).multiplyScalar(90).add(key.target.position);
}

// Relleno frio desde abajo-derecha, sin sombra: impide el negro muerto.
const fill = new THREE.DirectionalLight(LIGHT.fillColor, LIGHT.fillIntensity);
fill.position.set(30, -8, -18);
scene.add(fill);

// Rebote: cielo frio arriba, color del bioma abajo.
scene.add(new THREE.HemisphereLight(LIGHT.bounceSky, biome.bounceGround, LIGHT.bounceIntensity));

// ── proyectil y arco ─────────────────────────────────────────────────────
const dotTexture = makeDotTexture(accent.css, PROJECTILE_RIM);
// Una sola vez para toda la sesion: la misma baldosa de grano vale para
// cualquier teatro porque solo modula, no colorea.
const granoDelSuelo = makeGrainTexture();

const arc = new TrajectoryArc({ texture: dotTexture, pixelRatio: renderer.getPixelRatio() });
scene.add(arc.points);

const projectile = new THREE.Group();
projectile.visible = false;

// El proyectil es un OBUS, no una bola: cuerpo cilindrico y ojiva. Se orienta
// con la velocidad, que es lo que hace un proyectil estabilizado de verdad y
// ademas deja leer de un vistazo si el tiro sube o baja.
const shellMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: accent.hex,
  emissiveIntensity: 1.9,
  roughness: 0.35,
  metalness: 0.0,
});

const cuerpoGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.5, 12);
cuerpoGeo.rotateZ(-Math.PI / 2);
const shellCore = new THREE.Mesh(cuerpoGeo, shellMat);
shellCore.castShadow = true;
projectile.add(shellCore);

const ojivaGeo = new THREE.ConeGeometry(0.19, 0.34, 12);
ojivaGeo.rotateZ(-Math.PI / 2);
ojivaGeo.translate(0.42, 0, 0);
const ojiva = new THREE.Mesh(ojivaGeo, shellMat);
ojiva.castShadow = true;
projectile.add(ojiva);

// Halo con el anillo oscuro de la direccion de arte: garantiza que el
// proyectil se separe del terreno por VALOR, no solo por tono.
// depthTest activo a proposito: la esfera opaca ya escribio profundidad, asi
// que tapa el centro del halo y solo queda el anillo asomando alrededor.
const halo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: dotTexture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    opacity: 0.85,
  }),
);
halo.scale.setScalar(1.5);
projectile.add(halo);
scene.add(projectile);

// ── efectos ──────────────────────────────────────────────────────────────
// El azar de la decoracion cuelga de su propio hilo con semilla y se
// resiembra en cada partida. No es determinismo de simulacion —el humo no
// decide nada— sino que una repeticion se VEA igual: una repeticion con el
// humo en otro sitio se siente como otra partida distinta.
let azarDecorado = mulberry32(hashSeed(`${CONFIG.seed}:decorado`));
const movimientoReducido =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const efectos = crearEfectos({
  escena: scene,
  rng: () => azarDecorado(),
  acento: accent.hex,
  z: CONFIG.playZ,
  movimientoReducido,
});

/**
 * El cuerpo de cada trampa, con material de la epoca.
 *
 * Se leen por SILUETA antes que por color, y la silueta cambia segun este en
 * el aire o apoyada en el suelo: lo que cuelga en la trayectoria es distinto
 * de lo que estorba en la pista, y el jugador tiene que saber cual es cual sin
 * pensarlo.
 *
 *   mina, en el aire  -> mina de contacto con cuernos
 *   mina, en la pista -> mina terrestre de plato, medio enterrada
 *   deflector         -> placa de blindaje inclinada (nunca va al suelo)
 *   muro, en el aire  -> casamata de hormigon con tronera
 *   muro, en la pista -> erizo checo
 */
function construirTrampa(trampa) {
  const grupo = new THREE.Group();
  grupo.position.set(trampa.x, trampa.y, CONFIG.playZ);

  const material = new THREE.MeshStandardMaterial(
    trampa.tipo === 'mina'
      ? { color: 0x3f4247, roughness: 0.72, metalness: 0, emissive: 0x4a0f0f, emissiveIntensity: 0.7 }
      : trampa.tipo === 'deflector'
        ? { ...MATERIALS.metal, color: 0x9aa4ad, roughness: 0.28 }
        : { ...MATERIALS.hormigon },
  );

  if (trampa.tipo === 'mina' && !trampa.apoyada) {
    // Mina de contacto: esfera con cuernos. Es la unica cosa del campo que se
    // parece a una mina naval, y por eso no hace falta explicarla.
    grupo.add(new THREE.Mesh(new THREE.IcosahedronGeometry(trampa.radio * 0.6, 1), material));
    for (let i = 0; i < 8; i++) {
      const angulo = (i / 8) * Math.PI * 2;
      const cuerno = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.62, 6), material);
      cuerno.position.set(
        Math.cos(angulo) * trampa.radio * 0.72,
        Math.sin(angulo) * trampa.radio * 0.72,
        0,
      );
      cuerno.rotation.z = angulo - Math.PI / 2;
      grupo.add(cuerno);
    }
  } else if (trampa.tipo === 'mina') {
    // Mina terrestre: plato bajo, apenas asomando. Que casi no se vea es el
    // punto — se pisa, no se esquiva de lejos.
    const plato = new THREE.Mesh(
      new THREE.CylinderGeometry(trampa.radio * 0.8, trampa.radio * 0.9, 0.42, 14),
      material,
    );
    grupo.add(plato);
    const placa = new THREE.Mesh(
      new THREE.CylinderGeometry(trampa.radio * 0.45, trampa.radio * 0.45, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x8d3a2a, roughness: 0.8, metalness: 0 }),
    );
    placa.position.y = 0.26;
    grupo.add(placa);
  } else if (trampa.tipo === 'deflector') {
    // Placa de blindaje inclinada. El rebote no es magia: es lo que hace una
    // plancha a 45 grados con un proyectil que llega plano, y cualquiera que
    // haya oido hablar de blindaje inclinado se lo cree sin que se lo cuenten.
    const placa = new THREE.Mesh(
      new THREE.BoxGeometry(trampa.radio * 2.2, 0.3, 1.5),
      material,
    );
    placa.rotation.z = Math.PI / 4;
    grupo.add(placa);
    // Bastidor: dos vigas que la sostienen y le dan volumen contra el cielo.
    for (const lado of [-1, 1]) {
      const viga = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, trampa.radio * 1.5, 0.22),
        new THREE.MeshStandardMaterial({ ...MATERIALS.metal }),
      );
      viga.position.set(lado * trampa.radio * 0.62, -lado * trampa.radio * 0.62, 0);
      grupo.add(viga);
    }
  } else if (!trampa.apoyada) {
    // Casamata: mas ancha que alta y con el techo en talud, que es como se
    // hacian para que el tiro resbalase. Un cubo a secas se leia como una caja
    // flotando en el cielo.
    const cuerpo = new THREE.Mesh(
      new THREE.BoxGeometry(trampa.radio * 2.3, trampa.radio * 1.3, 1.6),
      material,
    );
    grupo.add(cuerpo);
    const techo = new THREE.Mesh(
      new THREE.CylinderGeometry(trampa.radio * 0.95, trampa.radio * 1.15, 0.7, 4),
      material,
    );
    techo.position.y = trampa.radio * 0.95;
    techo.rotation.y = Math.PI / 4;
    grupo.add(techo);
    // Tronera: la ranura negra. Es lo que la distingue de un peñasco.
    const tronera = new THREE.Mesh(
      new THREE.BoxGeometry(trampa.radio * 1.7, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0d0f13, roughness: 1, metalness: 0 }),
    );
    tronera.position.set(0, 0.1, 0.82);
    grupo.add(tronera);
  } else {
    // Erizo checo: tres vigas cruzadas en aspa. Nada dice "aqui no pasa un
    // tanque" tan rapido como esa forma, pero solo si se ven las TRES: con las
    // vigas giradas tambien en Y, dos quedaban de canto y parecian palos
    // sueltos tirados por el suelo.
    const viga = new THREE.BoxGeometry(0.34, trampa.radio * 2.4, 0.34);
    const acero = new THREE.MeshStandardMaterial({ ...MATERIALS.metal });
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
      const barra = new THREE.Mesh(viga, acero);
      barra.rotation.z = a;
      grupo.add(barra);
    }
  }

  for (const hijo of grupo.children) {
    hijo.castShadow = true;
    hijo.receiveShadow = true;
  }
  return { datos: trampa, grupo, material };
}

// ─────────────────────────────────────────────────────────────────── estado

const world = { terrain: null, cannons: [], shields: [], trampas: [] };
let fondo = null;
let atrezo = null;

const state = {
  phase: 'aiming',   // aiming | flying | pluma | victory
  active: 0,
  players: [newPlayerState(), newPlayerState()],
  aim: [
    { phi: 48 * DEG, power: 0.7 },
    { phi: 48 * DEG, power: 0.7 },
  ],
  wind: 0,
  turnRng: null,
  partida: null,
  plantel: [],
  // Por jugador: la x mas corta y la mas larga que ha logrado. Es su horquilla.
  marcas: [],
  // Todos los tiros del combate, para poder repetirlo en otro dispositivo.
  historia: [],
  combate: 1,
  reproduciendo: null,
  shot: null,
  flightSteps: 0,
  impactSteps: Infinity,
  reaction: { open: false, used: false, defender: 1 },
  pluma: null,
  hundimientoMs: 0,
  // Deposito de cada vehiculo y el avance PEDIDO en este turno. El avance es
  // local hasta que se dispara: igual que apuntar, mover es una intencion que
  // no vale nada hasta que sueltas el tiro. Asi el movimiento viaja por el
  // cable como un solo numero junto al disparo.
  combustible: [],
  avance: 0,
  avanceBloqueado: false,
  shots: [0, 0],
  dragging: false,
  scouting: false,
  fired: false,
  previewPoints: null,
  previewCount: 0,
  goal: { x: 0, y: 0, w: CONFIG.camera.aimWidth },
};

const activeCannon = () => world.cannons[state.active];
const bandoDe = (i) => state.plantel[i]?.bando;
const rivalesDe = (i) =>
  state.plantel.map((_, j) => j).filter((j) => bandoDe(j) !== bandoDe(i) && !state.players[j].destroyed);

/**
 * A quien le toca sudar durante el vuelo.
 *
 * En 1 contra 1 es el otro y ya esta. Con tres por bando hay que elegir, y se
 * elige al que tiene el proyectil mas cerca: es el unico que gana algo gastando
 * una carga, y ademas es lo que el jugador espera ver.
 */
function defensorMasExpuesto(impactoX) {
  const candidatos = rivalesDe(state.active);
  if (candidatos.length === 0) return state.active;
  let elegido = candidatos[0];
  let mejor = Infinity;
  for (const i of candidatos) {
    const d = Math.abs(world.cannons[i].group.position.x - impactoX);
    if (d < mejor) {
      mejor = d;
      elegido = i;
    }
  }
  return elegido;
}
const activeAim = () => state.aim[state.active];
// El viento ya no se sortea cada turno: deriva, y por eso se puede pronosticar.
let viento = null;

// ────────────────────────────────────────────────────────── construccion

function buildWorld(seedText) {
  if (world.terrain) {
    scene.remove(world.terrain.group);
    world.terrain.frontGeo.dispose();
    world.terrain.topGeo.dispose();
    world.terrain.material.dispose();
  }
  for (const c of world.cannons) scene.remove(c.group);
  world.cannons.length = 0;
  world.shields.length = 0;

  const rng = mulberry32(hashSeed(seedText));
  azarDecorado = mulberry32(hashSeed(`${seedText}:decorado`));
  efectos.limpiar();

  // El fondo cuelga de su propio hilo de azar: cambiar el relieve del campo no
  // puede cambiar el horizonte, o cada revancha pareceria otro sitio.
  if (fondo) scene.remove(fondo.grupo);
  fondo = crearFondo({ rng: mulberry32(hashSeed(`${seedText}:fondo`)), biome });
  scene.add(fondo.grupo);

  world.terrain = new Terrain({
    rng,
    biome,
    grano: granoDelSuelo,
    ...CONFIG.world,
    bowlHalfWidth: CONFIG.cannonX,
    // Una plataforma plana bajo cada vehiculo, sea cual sea el numero.
    pads: state.plantel.map((p) => ({ x: p.x, halfWidth: 2.6, feather: 3.2 })),
  });
  scene.add(world.terrain.group);
  cam.setBounds(world.terrain.x0, world.terrain.x0 + world.terrain.width);

  // Las trampas salen de la semilla, en su propio hilo de azar: asi los seis
  // moviles siembran el mismo campo sin que el servidor tenga que contarlo.
  for (const malla of world.trampas) scene.remove(malla.grupo);
  world.trampas = [];
  const semilleroTrampas = mulberry32(hashSeed(`${seedText}:trampas`));
  const sembradas = generarTrampas({
    rng: semilleroTrampas,
    complejidad: CONFIG.trampas,
    anchoMundo: CONFIG.world.width,
    separacionCanones: CONFIG.cannonX * 2,
    alturaEn: (x) => world.terrain.heightAt(x),
  });
  for (const trampa of sembradas) {
    const malla = construirTrampa(trampa);
    scene.add(malla.grupo);
    world.trampas.push(malla);
  }

  // Decorado del teatro: sacos, alambrada, tocones y el hito del sitio. Sale
  // de su propio hilo de azar para que cambiar el relieve no mueva la iglesia.
  if (atrezo) scene.remove(atrezo.grupo);
  atrezo = crearAtrezo({
    rng: mulberry32(hashSeed(`${seedText}:atrezo`)),
    biome,
    alturaEn: (x) => world.terrain.heightAt(x),
    anchoMundo: CONFIG.world.width,
    separacionCanones: CONFIG.cannonX * 2,
  });
  scene.add(atrezo.grupo);

  for (const spec of state.plantel) {
    // La epoca la manda el teatro, no el jugador: los dos bandos combaten con
    // el material de la guerra en la que estan.
    const c = buildCannon({ ...spec, granGuerra });
    c.group.position.set(spec.x, world.terrain.heightAt(spec.x), CONFIG.cannonZ);

    // Cupula de escudo, oculta salvo cuando se gasta una carga. Lleva el color
    // del propio vehiculo para que se lea de quien es sin mirar el marcador.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 24, 16),
      new THREE.MeshBasicMaterial({
        color: spec.chassis.color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    dome.position.y = 0.9;
    dome.visible = false;
    c.group.add(dome);
    world.shields.push(dome);

    scene.add(c.group);
    world.cannons.push(c);
  }

  // El PRNG de turnos cuelga del mismo hilo con semilla: nada de Math.random.
  state.turnRng = mulberry32(hashSeed(`${seedText}:turnos`));
  viento = crearViento(state.turnRng);
  state.wind = viento.actual;
}

/**
 * Alineacion local: el 1 contra 1 de siempre, escrito como lo que es — una
 * partida de dos participantes. Asi el juego local y el de red recorren
 * exactamente el mismo camino y no hay dos maquinas de estados que mantener.
 */
const ALINEACION_LOCAL = [
  { id: 'local-a', nombre: 'A', bando: 'a' },
  { id: 'local-b', nombre: 'B', bando: 'b' },
];

/**
 * Coloca a cada participante y le asigna chasis y orientacion.
 *
 * El indice de cada uno sale de roster.js y es el mismo en los seis moviles:
 * primero el bando 'a' y luego el 'b', en el orden congelado de la alineacion.
 */
function crearPlantel(partida) {
  const posiciones = posicionesDe(partida, { separacion: CONFIG.cannonX * 2, margen: 9 });
  const orden = [...partida.participantes].sort(
    (u, v) => (u.bando === v.bando ? u.indice - v.indice : u.bando < v.bando ? -1 : 1)
  );

  return orden.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    bando: p.bando,
    facing: p.bando === 'a' ? +1 : -1,
    chassis: p.bando === 'a' ? MATERIALS.chassisA : MATERIALS.chassisB,
    x: posiciones.get(p.id),
  }));
}

function startMatch(seedText, alineacion = ALINEACION_LOCAL) {
  CONFIG.seed = seedText;
  state.partida = crearPartida({ jugadores: alineacion, semilla: seedText });
  state.plantel = crearPlantel(state.partida);

  buildWorld(seedText);
  state.players = state.plantel.map(() => newPlayerState());
  state.aim = state.plantel.map(() => ({ phi: 48 * DEG, power: 0.7 }));
  state.shots = state.plantel.map(() => 0);
  state.combustible = state.plantel.map(() => AVANCE.deposito);
  state.avance = 0;
  state.avanceBloqueado = false;
  state.marcas = state.plantel.map(() => ({ corta: null, larga: null }));
  state.historia = [];
  state.phase = 'aiming';
  state.active = 0;
  state.shot = null;
  state.reaction = { open: false, used: false, defender: 1 };
  closeReaction();
  hud.hideVictory();
  hud.montarMarcadores(state.plantel, t);
  for (const dome of world.shields) dome.visible = false;
  for (let i = 0; i < state.plantel.length; i++) {
    world.cannons[i].setAim(state.aim[i].phi);
    hud.setHp(i, MAX_HP);
    hud.setCharges(i, REACTION.charges);
  }
  state.goal = aimFraming(0);
  cam.snap(state.goal.x, state.goal.y, state.goal.w);
  refreshPreview();
  updateHud();
}

// ──────────────────────────────────────────────────────────────── encuadres

function aimFraming(i) {
  const c = world.cannons[i];
  return {
    x: c.group.position.x + c.facing * 7,
    y: c.group.position.y + 9,
    w: CONFIG.camera.aimWidth,
  };
}

/**
 * Al estirar el arrastre la camara abre plano para que quepa el arco visible.
 * Es lo que hace que el zoom valga la pena mientras apuntas: cuanta mas
 * potencia cargas, mas campo ves, sin llegar nunca a regalarte al rival.
 */
function dragFraming() {
  const base = aimFraming(state.active);
  const pts = state.previewPoints;
  const n = state.previewCount;
  if (!pts || n < 2) return base;

  const c = world.cannons[state.active];
  let minX = c.group.position.x;
  let maxX = minX;
  let minY = c.group.position.y;
  let maxY = minY;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = clamp((maxX - minX) * 1.25 + 14, CONFIG.camera.aimWidth, CONFIG.camera.dragMaxWidth);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 + 2, w };
}

function scoutFraming() {
  const enemy = world.cannons[rivalesDe(state.active)[0] ?? state.active];
  return {
    x: enemy.group.position.x,
    y: enemy.group.position.y + 8,
    w: CONFIG.camera.scoutWidth,
  };
}

// ───────────────────────────────────────────────────────────────── apuntado

const muzzleTmp = new THREE.Vector3();

function muzzleState() {
  const cannon = activeCannon();
  scene.updateMatrixWorld();
  cannon.muzzleWorld(muzzleTmp);
  const { phi, power } = activeAim();
  const v = launchVelocity(phi, power, cannon.facing, CONFIG.speed.min, CONFIG.speed.max);
  return { x: muzzleTmp.x, y: muzzleTmp.y, vx: v.vx, vy: v.vy };
}

function simBounds() {
  const t = world.terrain;
  return { minX: t.x0 - 6, maxX: t.x0 + t.width + 6, minY: CONFIG.world.baseY };
}

/**
 * Colision de trampas para el ARCO, sobre copias.
 *
 * Se trabaja con copias porque previsualizar no puede gastar una mina: el
 * jugador estaria destruyendo el campo con solo mover el dedo.
 */
function preverTrampas() {
  if (world.trampas.length === 0) return null;
  const copias = world.trampas.filter((m) => m.datos.viva).map((m) => ({ ...m.datos }));

  return (s, px, py) => {
    const golpe = chocarCon(copias, px, py, s.x, s.y);
    if (!golpe) return null;
    const efecto = resolverChoque(golpe.trampa, s);
    if (efecto === 'rebota') return { rebote: true };
    return { fin: { x: golpe.x, y: golpe.y } };
  };
}

/** Donde caeria la arena si el tiro previsto impactase donde dice el arco. */
function depositoPrevisto(prediccion) {
  if (!prediccion?.hit) return null;
  return transporte(prediccion.hit.x, state.wind, prediccion.vy).centro;
}

function refreshPreview() {
  if (state.phase !== 'aiming') {
    arc.hide();
    state.previewPoints = null;
    state.previewCount = 0;
    return;
  }
  const prediccion = simulate(muzzleState(), state.wind, world.terrain, {
    sampleEvery: 6,
    maxPoints: 96,
    bounds: simBounds(),
    alChocar: preverTrampas(),
  });
  state.previewPoints = prediccion.points;
  state.previewCount = arc.update(prediccion.points, CONFIG.assistLevel, CONFIG.playZ);

  // Mientras se arrastra, la franja enseña donde caeria la arena. Es la unica
  // forma de decidir un tiro corto a proposito: el deposito cae fuera de
  // encuadre y sin esto habria que adivinarlo.
  pintarFranja(state.dragging ? depositoPrevisto(prediccion) : null);
}

function applyAim(aimInput) {
  const cannon = activeCannon();
  const slot = activeAim();
  if (aimInput.angle !== null) {
    // Elevacion respecto a la direccion de tiro del vehiculo, mismo signo
    // para los dos jugadores gracias al rotation.y = PI del jugador B.
    const phi = Math.atan2(Math.sin(aimInput.angle), Math.cos(aimInput.angle) * cannon.facing);
    slot.phi = clamp(phi, MIN_PHI, MAX_PHI);
  }
  slot.power = aimInput.power;
  cannon.setAim(slot.phi);
}

// ─────────────────────────────────────────────────────────────────── avance

/**
 * A donde llegaria el vehiculo activo con el avance pedido ahora mismo.
 *
 * Se recalcula SIEMPRE desde la x de inicio de turno, nunca sumando trocitos.
 * Es lo que permite que por el cable viaje un solo numero: los seis moviles
 * llaman a esta misma funcion pura con la misma x y el mismo pedido, y les sale
 * el mismo sitio. Si fuera incremental, un cuadro perdido en un movil cambiaria
 * el resultado y la partida se separaria sin que nadie lo viera.
 */
function resolverAvance(indice = state.active, pedido = state.avance) {
  const t = world.terrain;
  return mover({
    x: state.plantel[indice].x,
    pedido,
    combustible: state.combustible[indice],
    alturaEn: (x) => t.heightAt(x),
    minX: t.x0 + 4,
    maxX: t.x0 + t.width - 4,
  });
}

/** Pide mover el vehiculo activo. `delta` en unidades de mundo, con signo. */
function pedirAvance(delta) {
  if (state.phase !== 'aiming' || state.dragging) return;
  if (sincronia.estado.activa && !sincronia.meToca()) return;

  const antes = resolverAvance();
  state.avance = clamp(state.avance + delta, -60, 60);
  const ahora = resolverAvance();

  // Si el pedido ya no mueve nada, no se deja crecer: si no, el jugador
  // acumularia veinte unidades contra una pared y al girarse saldria disparado.
  if (Math.abs(ahora.recorrido - antes.recorrido) < 1e-9 && Math.sign(delta) === Math.sign(state.avance)) {
    state.avance = antes.recorrido;
  }
  state.avanceBloqueado = ahora.bloqueado;

  colocarActivo(ahora.x);
  refreshPreview();
  updateHud();
}

/** Deja el vehiculo activo en una x, apoyado en el terreno. */
function colocarActivo(x) {
  const g = activeCannon().group;
  g.position.x = x;
  g.position.y = world.terrain.heightAt(x);
  const f = aimFraming(state.active);
  state.goal = f;
}

/**
 * Sella el avance del turno: a partir de aqui es la posicion de verdad.
 *
 * Se llama justo antes de disparar y con el MISMO numero en todos los moviles,
 * asi que la boca del cañon queda en el mismo sitio en todos y la trayectoria
 * sale identica.
 */
function comprometerAvance(pedido) {
  const i = state.active;
  const r = resolverAvance(i, pedido);
  state.plantel[i].x = r.x;
  state.combustible[i] = r.combustible;
  state.avance = 0;
  state.avanceBloqueado = false;
  colocarActivo(r.x);

  // Pisar una mina enterrada mientras te reposicionas. Es lo que hace que las
  // trampas de pista dejen de ser decorado en cuanto uno puede moverse.
  const malla = world.trampas.find(
    (m) => m.datos.viva && m.datos.apoyada && m.datos.tipo === 'mina' && Math.abs(m.datos.x - r.x) <= 2.2,
  );
  if (malla) {
    malla.datos.viva = false;
    malla.grupo.visible = false;
    applyDamage(state.players[i], BLAST.maxDamage * 0.55);
    sonidos.sonar('impacto');
    efectos.impacto({
      x: r.x,
      y: world.terrain.heightAt(r.x),
      radio: CONFIG.craterRadius * 0.7,
      daño: BLAST.maxDamage * 0.55,
    });
    hud.setHp(i, state.players[i].hp);
  }
  return r;
}

// ────────────────────────────────────────────────────────────────── disparo

/**
 * Lo que hace el boton de disparar.
 *
 * En red no dispara: manda el input y espera al eco del servidor, igual que
 * los demas. Un atajo para el que dispara le enseñaria una partida distinta a
 * la de los otros y las desincronias se esconderian en vez de saltar.
 */
function fire() {
  if (sincronia.estado.activa) {
    if (!sincronia.meToca() || state.phase !== 'aiming') return;
    const mio = activeAim();
    // El avance va con el disparo. Como todo lo demas en red, no se aplica
    // aqui: se aplica cuando vuelve del servidor, tambien para el que lo manda.
    sincronia.disparar(mio.phi * RAD_TO_DEG, mio.power, resolverAvance().recorrido);
    return;
  }
  dispararDeVerdad();
}

function dispararDeVerdad(avancePedido = state.avance) {
  // Primero se sella el avance y solo despues se lee la boca: la posicion del
  // vehiculo es parte del disparo, no algo que pase por su cuenta.
  const avanceSellado = comprometerAvance(avancePedido).recorrido;
  const start = muzzleState();
  // El arco de prevision y el proyectil real comparten integrador, asi que
  // esta prediccion es exacta: sirve para abrir la ventana de reaccion en el
  // momento justo, sin margen de seguridad.
  const predicted = simulate(start, state.wind, world.terrain, {
    sampleEvery: 6,
    maxPoints: 96,
    bounds: simBounds(),
  });

  state.shot = { ...start };
  state.flightSteps = 0;
  state.impactSteps = predicted.hit ? predicted.steps : Infinity;
  // El defensor se decide con el impacto PREVISTO, que ya esta calculado: asi
  // la ventana se le abre a quien de verdad le va a caer encima.
  state.reaction = {
    open: false,
    used: false,
    defender: defensorMasExpuesto(predicted.hit ? predicted.hit.x : muzzleState().x),
  };
  state.shots[state.active] += 1;

  // Se apunta el tiro para poder repetir el combate. Es lo unico que hace falta
  // guardar: el terreno y el viento se reconstruyen desde la semilla.
  const apuntado = activeAim();
  state.historia.push({
    anguloDeg: apuntado.phi * RAD_TO_DEG,
    potencia: apuntado.power,
    // Sin esto, una repeticion tiraria desde la posicion inicial y todos los
    // impactos caerian en otro sitio a partir del primer turno en que alguien
    // se movio.
    avance: avanceSellado,
  });

  sonidos.sonar('disparo');

  // La pieza retrocede y escupe: fogonazo, humo y casquillo. Todo esto es
  // reloj de pared y no toca la simulacion — si el movil se atasca y se pierde
  // el fogonazo, el tiro sale exactamente igual.
  const canon = activeCannon();
  canon.retroceder();
  const rapidez = Math.hypot(start.vx, start.vy) || 1;
  efectos.disparo({
    x: start.x,
    y: start.y,
    dx: start.vx / rapidez,
    dy: start.vy / rapidez,
    retroceso: 0.6 + apuntado.power * 0.6,
  });

  projectile.position.set(start.x, start.y, CONFIG.playZ);
  projectile.rotation.z = Math.atan2(start.vy, start.vx);
  projectile.visible = true;
  state.phase = 'flying';
  arc.hide();

  if (!state.fired) {
    state.fired = true;
    hud.hideHint();
  }
}

/**
 * Resuelve el paso del proyectil por una trampa.
 *
 * El rebote es lo que le da sentido a todo esto: el tiro vuelve hacia quien lo
 * hizo, y si le cae encima se come su propia metralla. Aqui no hay que hacer
 * nada especial para eso — el daño ya alcanza a los dos bandos.
 */
function golpearTrampa(s, px, py) {
  if (world.trampas.length === 0) return null;

  const activas = world.trampas.filter((m) => m.datos.viva).map((m) => m.datos);
  const golpe = chocarCon(activas, px, py, s.x, s.y);
  if (!golpe) return null;

  const efecto = resolverChoque(golpe.trampa, s);
  const malla = world.trampas.find((m) => m.datos === golpe.trampa);

  if (efecto === 'detona') {
    sonidos.sonar('impacto');
    if (malla) malla.grupo.visible = false;
  } else if (efecto === 'rebota') {
    sonidos.sonar('escudo');
    projectile.position.set(s.x, s.y, CONFIG.playZ);
    // El arco de prevision dejo de valer en cuanto el tiro cambio de rumbo:
    // seguir enseñandolo seria mentirle al jugador.
    arc.hide();
    state.impactSteps = Infinity;
    closeReaction();
  } else {
    sonidos.sonar('salto');
  }

  return efecto;
}

function onImpact(hit) {
  // La velocidad vertical con la que llega decide cuan lejos se lleva el viento
  // la arena, asi que hay que leerla ANTES de soltar el proyectil.
  const caida = state.shot ? state.shot.vy : 0;

  // El crater no borra masa: la levanta. Lo que sale de aqui cae despues, en la
  // fase 'pluma', a sotavento del impacto.
  sonidos.sonar('impacto');
  // `hundimiento` no cambia el terreno: la fisica ya lo tiene bajado a su
  // altura nueva desde este mismo instante. Lo unico que retrasa es el DIBUJO,
  // 180 ms, para que el crater se vea abrirse en vez de aparecer.
  const { volumen } = world.terrain.carve(hit.x, hit.y, CONFIG.craterRadius, {
    hundimiento: true,
  });
  state.hundimientoMs = 0;
  projectile.visible = false;
  state.shot = null;
  closeReaction();

  // Reasentar los vehiculos: si el crater les quito el suelo se quedarian
  // flotando sobre el hueco. El decorado, igual.
  for (let i = 0; i < state.plantel.length; i++) {
    if (state.players[i].hop) continue;
    const g = world.cannons[i].group;
    g.position.y = world.terrain.heightAt(g.position.x);
  }
  atrezo?.reasentar();

  // La metralla alcanza a los dos: un tiro corto puede volarte a ti mismo.
  let mayorDaño = 0;
  for (let i = 0; i < state.plantel.length; i++) {
    const t = targetPoint(world.cannons[i]);
    const raw = damageAt(hit.x, hit.y, t.x, t.y);
    if (raw > 0) applyDamage(state.players[i], raw);
    if (raw > mayorDaño) mayorDaño = raw;
    state.players[i].shielded = false;
    world.shields[i].visible = false;
  }

  // Onda, escombros, polvo y sacudida. La sacudida va con el daño que acaba de
  // hacer: si un roce sacude igual que un pepinazo, la sacudida deja de contar
  // nada y solo es ruido.
  efectos.impacto({
    x: hit.x,
    y: hit.y,
    radio: CONFIG.craterRadius,
    daño: mayorDaño,
  });

  // Con equipos, la partida no acaba porque caiga uno: acaba cuando un bando
  // entero se queda sin nadie.
  sincronizarEstados();
  const bandoGanador = ganadorDe(state.partida);
  if (bandoGanador !== null) {
    const vencedor = state.plantel.findIndex((p) => p.bando === bandoGanador);
    const vencido = state.plantel.findIndex((p) => p.bando !== bandoGanador);
    return declareVictory(Math.max(0, vencedor), Math.max(0, vencido));
  }

  // La arena viaja: se calcula a donde y se suelta en tandas durante la fase
  // 'pluma', para que se vea caer en vez de aparecer de golpe.
  const { centro, anchura } = transporte(hit.x, state.wind, caida);
  state.pluma = {
    centro,
    anchura,
    restante: volumen,
    porTanda: volumen / CONFIG.plumaTandas,
    paso: 0,
    depositado: 0,
    perdido: 0,
    impacto: hit.x,
  };

  // Que aprende el jugador de este disparo. Se calcula aqui, con el daño ya
  // aplicado, y solo se enseña si NO acerto: si acerto, la vida del rival ya
  // se lo ha contado.
  const rival = world.cannons[defensorMasExpuesto(hit.x)];
  const lectura = lecturaDeTiro({
    xImpacto: hit.x,
    xObjetivo: rival.group.position.x,
    facing: world.cannons[state.active].facing,
    volumen,
    centro,
    anchura,
  });
  if (!acerto(lectura, BLAST.radius)) hud.showLectura(lectura);

  // La horquilla del que ha tirado: su corto mas largo y su largo mas corto son
  // los que encajonan la solucion. Solo se guardan los suyos — enseñar los del
  // rival regalaria informacion que el juego esconde a proposito.
  const mias = state.marcas[state.active];
  if (mias) {
    if (lectura.sentido === 'corto') mias.corta = hit.x;
    else mias.larga = hit.x;
  }

  sonidos.sonar('pluma');
  state.phase = 'pluma';
  // Encuadre entre el crater y donde va a caer la arena: si la camara se queda
  // en el impacto, el jugador no ve lo unico que ha construido este turno.
  const medio = (hit.x + centro) / 2;
  const abarcar = Math.abs(centro - hit.x) + 24;
  state.goal = {
    x: medio,
    y: hit.y + 6,
    w: clamp(abarcar, CONFIG.camera.aimWidth, CONFIG.camera.dragMaxWidth),
  };
  cam.tweenTo(state.goal.x, state.goal.y, state.goal.w, 320, easeOutCubic);
}

/**
 * Vuelca la vida a la partida de roster.
 *
 * Los estados de combate viven en state.players, indexados como el plantel, y
 * la rotacion vive en roster. Copiar el "destruido" antes de rotar es lo que
 * hace que el turno salte a los que ya han caido.
 */
function sincronizarEstados() {
  for (let i = 0; i < state.plantel.length; i++) {
    const participante = state.partida.participantes.find((p) => p.id === state.plantel[i].id);
    if (participante) participante.estado = state.players[i];
  }
}

function indiceDelActivo() {
  const activo = participanteActivo(state.partida);
  if (!activo) return state.active;
  const i = state.plantel.findIndex((p) => p.id === activo.id);
  return i >= 0 ? i : state.active;
}

function endTurn() {
  projectile.visible = false;
  state.shot = null;

  // El turno lo lleva la partida de roster, en local y en red: una sola
  // rotacion que salta a los destruidos y aguanta bandos desiguales.
  sincronizarEstados();
  avanzarTurno(state.partida);
  state.active = indiceDelActivo();

  if (sincronia.estado.activa) {
    // La huella del estado va cada turno: si dos moviles han calculado
    // distinto, el servidor lo dice ahora y no tres turnos despues.
    red.contrastar(state.partida.ronda, {
      alturas: world.terrain.heights,
      vidas: state.players.map((p) => p.hp),
      turno: state.partida.ronda,
    });
  }
  state.wind = viento.avanzar();
  state.phase = 'aiming';
  // Reposta el que entra, y el avance pedido se olvida: es de un solo turno.
  state.combustible[state.active] = repostar(state.combustible[state.active]);
  state.avance = 0;
  state.avanceBloqueado = false;
  activeCannon().setAim(activeAim().phi);
  // Barrido al canon activo: 700 ms, easeInOutCubic.
  state.goal = aimFraming(state.active);
  cam.tweenTo(state.goal.x, state.goal.y, state.goal.w, 700, easeInOutCubic);
  refreshPreview();
  updateHud();
  turnoDeLaMaquina();
}

function declareVictory(winner, loser) {
  sonidos.sonar('victoria');
  state.phase = 'victory';
  arc.hide();
  const c = world.cannons[loser];
  // El vehiculo destruido se ladea y se hunde: lectura instantanea.
  c.group.rotation.z = (loser === 0 ? -1 : 1) * 22 * DEG;
  c.group.position.y -= 0.35;
  // Los materiales estan compartidos entre piezas; sin el Set el mismo color
  // se multiplicaria varias veces y el vehiculo saldria negro.
  const darkened = new Set();
  c.group.traverse((o) => {
    if (o.isMesh && o.material?.color && !darkened.has(o.material)) {
      darkened.add(o.material);
      o.material.color.multiplyScalar(0.34);
    }
  });
  state.goal = {
    x: c.group.position.x,
    y: c.group.position.y + 5,
    w: CONFIG.camera.victoryWidth,
  };
  cam.tweenTo(state.goal.x, state.goal.y, state.goal.w, 900, easeInOutCubic);
  hud.showVictory(winner, t('resumen', {
    disparos: state.shots[winner],
    vida: Math.ceil(state.players[winner].hp),
  }));
}

// ──────────────────────────────────────────────── reaccion en vuelo (plus)

/** Deja la reaccion apuntada en el tiro que la provoco. */
function anotarReaccion(tipo) {
  const turno = state.historia.at(-1);
  if (turno && !turno.reaccion) turno.reaccion = { tipo, paso: state.flightSteps };
}

/** La maquina decide si gasta carga, con la misma info que tendria una persona. */
function reaccionDeLaMaquina() {
  if (errorIA === null || sincronia.estado.activa) return;
  const defensor = state.reaction.defender;
  if (bandoDe(defensor) !== 'b') return;

  const decision = reaccionarIA({
    distanciaPrevista: Math.abs(predictImpactX() - world.cannons[defensor].group.position.x),
    radioLetal: BLAST.radius,
    cargas: state.players[defensor].charges,
    rng: state.turnRng,
    error: errorIA,
  });

  if (decision === 'salto') aplicarSalto();
  else if (decision === 'escudo') aplicarEscudo();
}

function openReaction() {
  state.reaction.open = true;
  hud.setReactionEnabled(true);
  hud.showReaction(true);
}

function closeReaction() {
  state.reaction.open = false;
  hud.showReaction(false);
}

function canReact() {
  const r = state.reaction;
  return r.open && !r.used && state.players[r.defender].charges > 0;
}

function spendCharge() {
  const p = state.players[state.reaction.defender];
  p.charges -= 1;
  state.reaction.used = true;
  closeReaction();
  hud.setCharges(state.reaction.defender, p.charges);
}

function useShield() {
  if (sincronia.estado.activa) {
    if (canReact()) sincronia.reaccionar(ACCION.escudo, state.flightSteps);
    return;
  }
  aplicarEscudo();
}

function useHop() {
  if (sincronia.estado.activa) {
    if (canReact()) sincronia.reaccionar(ACCION.salto, state.flightSteps);
    return;
  }
  aplicarSalto();
}

function aplicarEscudo() {
  if (!canReact()) return;
  anotarReaccion('escudo');
  sonidos.sonar('escudo');
  const i = state.reaction.defender;
  spendCharge();
  state.players[i].shielded = true;
  world.shields[i].visible = true;
}

function aplicarSalto() {
  if (!canReact()) return;
  anotarReaccion('salto');
  sonidos.sonar('salto');
  // El destino del salto se comprueba mas abajo, cuando ya se sabe donde cae.
  const i = state.reaction.defender;
  const cannon = world.cannons[i];
  const px = cannon.group.position.x;
  // Salta alejandose del punto de caida previsto.
  const impactX = state.shot ? predictImpactX() : px;
  const away = Math.sign(px - impactX) || cannon.facing;
  const limit = world.terrain.width / 2 - 4;
  spendCharge();
  const destino = clamp(px + away * REACTION.hopDistance, -limit, limit);

  // Aterrizar sobre una mina de pista es peor que haberse quedado quieto: es lo
  // que convierte las trampas del suelo en una decision y no en decorado.
  const mina = minaEn(world.trampas.map((m) => m.datos), destino);
  if (mina) {
    mina.viva = false;
    const malla = world.trampas.find((m) => m.datos === mina);
    if (malla) malla.grupo.visible = false;
    sonidos.sonar('impacto');
    world.terrain.carve(mina.x, world.terrain.heightAt(mina.x), CONFIG.craterRadius);
    const centro = targetPoint(cannon);
    applyDamage(state.players[i], damageAt(mina.x, world.terrain.heightAt(mina.x), centro.x, centro.y));
    hud.setHp(i, state.players[i].hp);
  }

  state.players[i].hop = { fromX: px, toX: destino, step: 0 };
}

function predictImpactX() {
  const { points, hit } = simulate(state.shot, state.wind, world.terrain, {
    sampleEvery: 12,
    maxPoints: 8,
    bounds: simBounds(),
  });
  if (hit) return hit.x;
  return points.length ? points[points.length - 1][0] : state.shot.x;
}

function advanceHops() {
  for (let i = 0; i < state.plantel.length; i++) {
    const p = state.players[i];
    if (!p.hop) continue;
    p.hop.step += 1;
    const t = Math.min(1, p.hop.step / REACTION.hopSteps);
    const x = lerp(p.hop.fromX, p.hop.toX, easeOutQuad(t));
    const lift = Math.sin(Math.PI * t) * REACTION.hopLift;
    const g = world.cannons[i].group;
    g.position.x = x;
    g.position.y = world.terrain.heightAt(x) + lift;
    if (t >= 1) {
      p.hop = null;
      g.position.y = world.terrain.heightAt(x);
    }
  }
}

// ─────────────────────────────────────────────────────────────────── control

let pinchStartZoom = 1;

// El audio esta cableado y esperando los MP3 (ver public/audio/LEEME.md). Los
// que falten no suenan y ya: el juego no depende de ellos.
const sonidos = crearSonidos();
// Los navegadores no dejan sonar nada hasta el primer gesto del jugador.
for (const evento of ['pointerdown', 'keydown']) {
  window.addEventListener(evento, () => sonidos.desbloquear(), { once: true });
}

const franja = crearFranja(document.getElementById('franja'));

const COLORES_FRANJA = {
  terreno: '#26303F',
  banda: 'rgba(255,107,44,.16)',
  marca: '#7F8DA0',
  arena: '#FF6B2C',
  activo: '#EEF3F9',
  a: '#FF6B2C',
  b: '#16E0FF',
};

/**
 * Repinta la franja con lo que el jugador puede saber ahora mismo.
 *
 * Las marcas son las DE QUIEN JUEGA: cada uno recuerda su propio corto y su
 * propio largo, que es lo que encajona su solucion. Enseñar las del rival seria
 * regalar informacion que el juego esconde a proposito.
 */
function pintarFranja(deposito = null) {
  if (!world.terrain || state.plantel.length === 0) return;
  franja.pintar({
    terreno: world.terrain,
    plantel: state.plantel,
    activo: state.active,
    marcas: state.marcas[state.active] ?? null,
    deposito,
    colores: COLORES_FRANJA,
  });
}

const hud = new Hud({
  // Un toque mueve 0,45 unidades; manteniendo, unas 8 por segundo.
  onAvance: (signo) => pedirAvance(signo * 0.45),
  onScoutStart() {
    if (state.phase === 'victory') return;
    state.scouting = true;
    state.goal = scoutFraming();
    cam.tweenTo(state.goal.x, state.goal.y, state.goal.w, 420, easeInOutCubic);
  },
  onScoutEnd() {
    if (!state.scouting) return;
    state.scouting = false;
    state.goal = aimFraming(state.active);
    cam.tweenTo(state.goal.x, state.goal.y, state.goal.w, 380, easeOutCubic);
  },
  onShield: useShield,
  onHop: useHop,
  onCompartir: () => enlaceDeRepeticion(),

  onAgain() {
    // Semilla explicita: antes salia del numero de disparos del combate
    // anterior, asi que ni una revancha se podia repetir sin volver a jugar
    // toda la partida previa.
    state.combate += 1;
    startMatch(semillaDeRevancha(CONFIG.seed, state.combate));
  },
}, t);

attachDragControl(stage, {
  onStart() {
    if (state.phase === 'aiming') state.dragging = true;
  },
  onDrag(aimInput) {
    if (state.phase !== 'aiming') return;
    state.dragging = true;
    applyAim(aimInput);
    refreshPreview();
    updateHud();
  },
  onRelease(aimInput) {
    state.dragging = false;
    if (state.phase !== 'aiming') return;
    applyAim(aimInput);
    updateHud();
    if (aimInput.power >= 0.05) fire();
    else refreshPreview();
  },
  onCancel() {
    state.dragging = false;
    if (state.phase === 'aiming') refreshPreview();
  },
  onPinchStart() {
    pinchStartZoom = cam.zoom;
  },
  onPinch(scale) {
    cam.setZoom(pinchStartZoom / scale);
  },
});

stage.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    cam.setZoom(cam.zoom * (e.deltaY > 0 ? 1.12 : 1 / 1.12));
  },
  { passive: false },
);

// ───────────────────────────────────────────────────────── bucle a paso fijo

// Acumulador de paso fijo. La simulacion solo avanza en incrementos de
// FIXED_DT, asi que el resultado de un disparo es identico a 30 o a 144 fps.
let accumulator = 0;
let last = performance.now();

function fixedUpdate() {
  advanceHops();

  if (state.phase === 'flying') {
    const s = state.shot;
    state.flightSteps += 1;

    // Las reacciones llegan selladas con su paso de vuelo y se aplican ahi, ni
    // antes ni despues. Es lo que hace que los seis moviles vean el mismo salto
    // en el mismo instante.
    // Repeticion: la reaccion vuelve a ocurrir en el paso exacto en que ocurrio.
    if (state.reproduciendo && state.flightSteps >= state.reproduciendo.paso) {
      const { tipo } = state.reproduciendo;
      state.reproduciendo = null;
      if (tipo === 'escudo') aplicarEscudo();
      else aplicarSalto();
    }

    for (const entrada of sincronia.consumir(state.flightSteps)) {
      if (entrada.accion === ACCION.escudo) aplicarEscudo();
      else if (entrada.accion === ACCION.salto) aplicarSalto();
    }

    // Ventana de reaccion: se abre a 0.9 s del impacto previsto.
    if (
      !state.reaction.open &&
      !state.reaction.used &&
      state.players[state.reaction.defender].charges > 0 &&
      state.impactSteps - state.flightSteps <= REACTION.windowSteps
    ) {
      openReaction();
      reaccionDeLaMaquina();
    }

    const px = s.x;
    const py = s.y;
    step(s, state.wind, FIXED_DT);

    // Trampas: pueden detonar el tiro donde estan, devolverlo o tragarselo.
    const choque = golpearTrampa(s, px, py);
    if (choque === 'detona') return onImpact({ x: s.x, y: s.y });
    if (choque === 'absorbe') {
      projectile.visible = false;
      state.shot = null;
      closeReaction();
      return endTurn();
    }

    const impact = sweepTerrain(px, py, s.x, s.y, world.terrain);
    if (impact) return onImpact(impact);

    const t = world.terrain;
    if (s.x < t.x0 - 8 || s.x > t.x0 + t.width + 8 || s.y < CONFIG.world.baseY) {
      closeReaction();
      return endTurn();
    }
    projectile.position.set(s.x, s.y, CONFIG.playZ);
    // Un obus estabilizado va siempre de morro: orientarlo con la velocidad
    // deja leer si el tiro sube o baja sin mirar el arco.
    projectile.rotation.z = Math.atan2(s.vy, s.vx);
    efectos.estela(s.x, s.y, FIXED_DT);
    return;
  }

  if (state.phase === 'pluma') {
    avanzarPluma();
  }
}

/**
 * Suelta la arena en tandas iguales a lo largo de la fase.
 *
 * Se trocea por dos razones. Una es que se vea: un monton que aparece de golpe
 * no se lee como arena volando. La otra es que cada tanda es un deposito
 * completo y conservado, asi que si la fase se corta a la mitad —victoria,
 * revancha— lo depositado hasta ahi sigue cuadrando.
 */
function avanzarPluma() {
  const p = state.pluma;
  if (!p) return endTurn();

  const cada = Math.max(1, Math.floor(CONFIG.plumaSteps / CONFIG.plumaTandas));
  p.paso += 1;

  if (p.paso % cada === 0 && p.restante > 0) {
    const tanda = Math.min(p.porTanda, p.restante);
    const caido = world.terrain.depositar(p.centro, p.anchura, tanda);
    p.restante -= tanda;
    p.depositado += caido.depositado;
    p.perdido += caido.perdido;

    // Reasentar: la arena que cae encima de un vehiculo lo levanta con ella.
    for (let i = 0; i < state.plantel.length; i++) {
      if (state.players[i].hop) continue;
      const g = world.cannons[i].group;
      g.position.y = world.terrain.heightAt(g.position.x);
    }
    atrezo?.reasentar();
  }

  if (p.paso >= CONFIG.plumaSteps) {
    // Al terminar de caer, la arena se asienta. Es progresivo: lo que quede
    // empinado se seguira derrumbando en los turnos siguientes, cada vez menos.
    world.terrain.reposar();
    endTurn();
  }
}

function updateCamera(dt) {
  if (state.phase === 'flying' && state.shot) {
    const s = state.shot;
    // Se mira un poco por delante del proyectil para que no vaya pegado al borde.
    cam.followTo(s.x + s.vx * 0.2, s.y + 2, CONFIG.camera.flightWidth, 6);
  } else if (state.dragging && state.phase === 'aiming') {
    const f = dragFraming();
    cam.followTo(f.x, f.y, f.w, 7);
  } else if (!cam.busy) {
    cam.followTo(state.goal.x, state.goal.y, state.goal.w, 5);
  }
  cam.update(dt);
  trackShadow();
  fondo?.seguir(cam.cx);

  // Las particulas se dibujan con gl_PointSize, que va en pixeles. Con camara
  // ortografica el zoom no las escala solo, asi que hay que decirle cuantos
  // pixeles mide una unidad de mundo AHORA — si no, el humo de un plano
  // abierto sale del tamaño del de un primer plano.
  const altoMundo = cam.camera.top - cam.camera.bottom;
  if (altoMundo > 0) efectos.setEscala(renderer.domElement.height / altoMundo);

  // El contorno de los blindados se engorda en PIXELES, no en unidades de
  // mundo: es la unica forma de que el trazo se vea igual a 0,55x y a 2,6x de
  // zoom (docs/ARTE-VEHICULOS.md §3). Va aqui y no en `resize()` porque el zoom
  // cambia cada cuadro y el tamaño de la ventana casi nunca.
  // En pixeles CSS, no de dispositivo: el grosor esta escrito en px de diseño
  // (`ARTE.md` §1.1) y en una pantalla 2x saldria la mitad de gordo.
  actualizarContorno(cam.camera, renderer.domElement.height / renderer.getPixelRatio());
}

function frame(now) {
  requestAnimationFrame(frame);

  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  accumulator += dt;
  let guard = 0;
  while (accumulator >= FIXED_DT && guard++ < 240) {
    fixedUpdate();
    accumulator -= FIXED_DT;
  }

  // Todo lo decorativo va con el reloj de pared, no con el paso fijo. Si el
  // navegador se atasca se pierde humo, nunca simulacion.
  for (const c of world.cannons) c.animar(dt);
  efectos.actualizar(dt);
  cam.setSacudida(efectos.sacudida.x, efectos.sacudida.y);

  if (world.terrain?.hundiendo) {
    state.hundimientoMs += dt * 1000;
    world.terrain.avanzarHundimiento(easeOutCubic(Math.min(1, state.hundimientoMs / HUNDIMIENTO_MS)));
  }

  updateCamera(dt);
  updateLiveHud();
  renderer.render(scene, cam.camera);

  // Lo que se mide es el HUECO entre cuadros, no el tiempo de JavaScript de
  // este. `renderer.render` encola trabajo y vuelve enseguida: cronometrarlo
  // daria dos milisegundos incluso con la GPU ahogada, que es justo el caso
  // que hay que detectar. El hueco si lo recoge.
  calidad.cuadro(dt * 1000);
}

// ───────────────────────────────────────────────────────────────── pantalla

/**
 * Calidad de pintado, ajustada sola.
 *
 * Medido: en un ordenador con GPU vieja y el lienzo a 1800x3200, cada cuadro
 * costaba 50 ms —20 imagenes por segundo— y el reparto era PLANO, asi que no
 * era un tiron sino el coste normal de pintar cinco millones y medio de
 * pixeles con sombra suave. Lo unico que se toca es eso: pixeles y sombra.
 * Nunca la simulacion, para que un movil viejo y uno nuevo jueguen la misma
 * partida aunque uno la vea mas borrosa.
 */
let topeDePixeles = NIVELES[0].pixeles;

const calidad = crearCalidad({
  fijo: CONFIG.calidad,
  aplicar(nivel) {
    topeDePixeles = nivel.pixeles;
    if (nivel.sombras === 0) {
      renderer.shadowMap.enabled = false;
      key.castShadow = false;
    } else {
      renderer.shadowMap.enabled = true;
      key.castShadow = true;
      key.shadow.radius = nivel.radio;
      if (key.shadow.mapSize.x !== nivel.sombras) {
        key.shadow.mapSize.set(nivel.sombras, nivel.sombras);
        // El mapa ya reservado conserva su tamaño: hay que tirarlo para que
        // Three lo reconstruya con el nuevo.
        key.shadow.map?.dispose();
        key.shadow.map = null;
      }
    }
    renderer.shadowMap.needsUpdate = true;
    resize();
  },
});

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;

  renderer.setPixelRatio(Math.min(devicePixelRatio, topeDePixeles));
  renderer.setSize(w, h, false);
  arc.setPixelRatio(renderer.getPixelRatio());
  cam.setAspect(w / h);

  // --u = 1 px del diseno a 1080 de ancho, para que el HUD escale exacto.
  // Con unidad: sin ella calc(var(--u)*N) produce un numero sin unidad y
  // todas las declaraciones que lo usan como longitud se descartan.
  stage.style.setProperty('--u', `${w / 1080}px`);
}

new ResizeObserver(resize).observe(stage);

// ────────────────────────────────────────────────────────────────────── hud

function updateHud() {
  const { phi, power } = activeAim();
  pintarDeposito();
  hud.setShot(state.active === 0 ? 'A' : 'B', Math.round(phi * RAD_TO_DEG), Math.round(power * 100));
  hud.setWind(state.wind, viento ? viento.pronostico : null);
  for (let i = 0; i < state.plantel.length; i++) {
    hud.setHp(i, state.players[i].hp);
    hud.setCharges(i, state.players[i].charges);
  }
}

/**
 * Deposito del vehiculo activo, y el aviso de encerrado.
 *
 * El aviso existe porque sin el, apretar el boton y que no pase nada se lee
 * como que el juego esta roto. Que sea el rival quien te ha construido una
 * pared de arena delante es informacion, no un fallo.
 */
function pintarDeposito() {
  if (!world.terrain || !state.plantel.length) return;
  const i = state.active;
  const t = world.terrain;

  // Se pinta lo PREVISTO, no lo sellado. El deposito solo se descuenta de
  // verdad al disparar —mover es una intencion, igual que apuntar—, pero una
  // barra que no baja mientras aprietas el boton no informa de nada: el
  // jugador tiene que ver lo que le va a costar antes de comprometerse.
  const previsto = resolverAvance(i);
  const sinPaso =
    state.phase === 'aiming' &&
    encerrado({
      // Y desde donde va a QUEDAR, no desde donde queria llegar: si el pedido
      // se recorto por falta de deposito, mirar la x pedida daba avisos de
      // "sin paso" en mitad de un campo abierto.
      x: previsto.x,
      combustible: previsto.combustible,
      alturaEn: (x) => t.heightAt(x),
      minX: t.x0 + 4,
      maxX: t.x0 + t.width - 4,
    });
  // El aviso es solo para estar ENCERRADO de verdad. Encenderlo tambien cuando
  // el ultimo empujon choco contra una cuesta lo dejaba puesto en mitad del
  // campo abierto —bastaba con que hubiera un talud a la derecha— y un aviso
  // que sale siempre deja de ser un aviso.
  hud.setAvance(fraccionDeposito(previsto.combustible), sinPaso);
}

/** Lo que cambia cada cuadro: vida tras un impacto y reloj de reaccion. */
function updateLiveHud() {
  for (let i = 0; i < state.plantel.length; i++) hud.setHp(i, state.players[i].hp);
  hud.marcarTurno(state.active, state.players.map((p) => p.destroyed));
  pintarFranja();
  if (state.reaction.open) {
    const left = Math.max(0, state.impactSteps - state.flightSteps);
    hud.setReactionTimer(left / REACTION.windowSteps, left / 120);
  }
}

// ────────────────────────────────────────────────────────────────── arranque

resize();

const repeticion = decodificar(params.get('replay'));
if (repeticion) {
  CONFIG.seed = repeticion.semilla;
  startMatch(repeticion.semilla);
  reproducir(repeticion.turnos);
} else {
  startMatch(CONFIG.seed);
}
requestAnimationFrame(frame);

// Ganchos para validar sin tocar codigo: window.GAME en la consola.
// Contrato del bucle de test: render_game_to_text() para leer la partida sin
// mirar la pantalla, advanceTime(ms) para avanzarla sin depender del reloj.
exponerGanchos({
  pasoEnSegundos: FIXED_DT,
  avanzarPaso: fixedUpdate,
  dibujar() {
    updateCamera(0);
    updateLiveHud();
    renderer.render(scene, cam.camera);
  },
  leerEstado() {
    const aim = state.aim[state.active];
    const bajoElCanon = world.cannons[state.active].group.position.x;
    return {
      fase: state.phase,
      activo: state.active,
      ronda: Math.floor((state.shots[0] + state.shots[1]) / 2) + 1,
      anguloGrados: aim.phi * RAD_TO_DEG,
      potencia: aim.power,
      viento: state.wind,
      proyectil: state.shot ? { ...state.shot } : null,
      alturaTerreno: world.terrain.heightAt(state.shot ? state.shot.x : bajoElCanon),
      pasosDeVuelo: state.flightSteps,
      pasosAlImpacto: state.impactSteps,
      reaccionAbierta: state.reaction.open,
      defensor: state.reaction.defender,
      ganador:
        state.phase === 'victory'
          ? state.plantel.findIndex((_, i) => !state.players[i].destroyed)
          : null,
      jugadores: state.players.map((p, i) => ({
        vida: p.hp,
        cargas: p.charges,
        disparos: state.shots[i],
        destruido: p.destroyed,
      })),
    };
  },
});

// ────────────────────────────────────────────────────────────────── repetir
//
// ?replay=<codigo> vuelve a jugar un combate guardado. La simulacion es
// determinista, asi que con la semilla y los tiros basta: el terreno, el viento
// y cada crater salen solos.

/** El combate que se esta jugando, listo para pegar en un mensaje. */
function enlaceDeRepeticion() {
  const codigo = codificar({ semilla: CONFIG.seed, turnos: state.historia });
  const url = new URL(location.href);
  url.searchParams.delete('seed');
  url.searchParams.set('replay', codigo);
  return url.toString();
}

/** Reproduce los tiros uno tras otro, esperando a que cada uno termine. */
function reproducir(turnos) {
  let indice = 0;

  const siguiente = () => {
    if (indice >= turnos.length) return;
    if (state.phase !== 'aiming') {
      setTimeout(siguiente, 120);
      return;
    }

    const turno = turnos[indice++];
    const slot = activeAim();
    slot.phi = clamp(turno.anguloDeg * DEG, MIN_PHI, MAX_PHI);
    slot.power = clamp(turno.potencia, 0, 1);
    activeCannon().setAim(slot.phi);
    refreshPreview();

    // La reaccion del original se vuelve a aplicar en su mismo paso de vuelo.
    if (turno.reaccion) {
      state.reproduciendo = { ...turno.reaccion };
    }

    dispararDeVerdad(turno.avance ?? 0);
    setTimeout(siguiente, 200);
  };

  setTimeout(siguiente, 600);
}

// ───────────────────────────────────────────────────────────────────── ia
//
// La maquina juega el bando B cuando se pide por URL. Toda su aleatoriedad sale
// del turnRng sembrado, asi que una partida contra la IA es tan reproducible
// como una entre personas.

const errorIA = DIFICULTAD[CONFIG.ia] ?? (CONFIG.ia ? DIFICULTAD.normal : null);
const leTocaALaMaquina = () =>
  errorIA !== null && !sincronia.estado.activa && bandoDe(state.active) === 'b';

/** Piensa y dispara. Se llama al empezar su turno, con un respiro para que se vea. */
function turnoDeLaMaquina() {
  if (!leTocaALaMaquina() || state.phase !== 'aiming') return;

  const canon = activeCannon();
  const rival = world.cannons[rivalesDe(state.active)[0] ?? 0];
  const tiro = apuntarIA({
    origen: muzzleState(),
    objetivo: rival.group.position.x,
    viento: state.wind,
    terreno: world.terrain,
    velocidad: CONFIG.speed,
    rng: state.turnRng,
    error: errorIA,
  });

  const slot = activeAim();
  slot.phi = clamp(tiro.anguloDeg * DEG, MIN_PHI, MAX_PHI);
  slot.power = clamp(tiro.potencia, 0, 1);
  canon.setAim(slot.phi);
  refreshPreview();
  updateHud();

  // Un respiro antes de tirar: sin el, la maquina dispara en el mismo cuadro en
  // que le toca y el jugador no llega a ver de donde vino el tiro.
  setTimeout(() => {
    if (leTocaALaMaquina() && state.phase === 'aiming') dispararDeVerdad();
  }, 700);
}

// ─────────────────────────────────────────────────────────── jugar en linea
//
// Se entra con ?online (sala nueva) o ?sala=CODE (a una concreta). Sin esos
// parametros el juego arranca en local exactamente como antes: la red no puede
// estropear la partida de quien no la pide.
/**
 * A donde conectarse.
 *
 * En produccion el servidor sirve tambien el juego, asi que la sala esta en el
 * mismo origen: eso da wss automatico detras de HTTPS y ni un dominio que
 * configurar. En desarrollo el juego lo sirve Vite en su propio puerto y el
 * servidor vive aparte, de ahi la excepcion.
 */
function urlDelServidor() {
  const forzado = params.get('servidor');
  if (forzado) return forzado;
  if (location.port === '5173') return `ws://${location.hostname}:8787`;
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
}

const servidor = urlDelServidor();
const red = crearCliente({ url: servidor });

const sincronia = crearSincronia({ cliente: red });

// El disparo que llega del servidor —el propio incluido— es el que se ejecuta.
sincronia.alDisparo(({ anguloDeg, potencia, avance }) => {
  const slot = activeAim();
  slot.phi = clamp(anguloDeg * DEG, MIN_PHI, MAX_PHI);
  slot.power = clamp(potencia, 0, 1);
  activeCannon().setAim(slot.phi);
  refreshPreview();
  dispararDeVerdad(avance ?? 0);
});

const lobby = crearLobby({
  cliente: red,
  t,
  alEmpezar(m) {
    startMatch(m.semilla, m.alineacion);
    // La partida que monta startMatch es la misma alineacion, asi que la
    // sincronia y la escena comparten rotacion sin tener que casarlas.
    sincronia.empezar(state.partida, red.estado.yo);
    state.active = indiceDelActivo();
    updateHud();
  },
});

if (params.has('online') || params.has('sala')) {
  lobby.mostrar(params.get('sala'));
}

window.GAME = {
  config: CONFIG,
  sonidos,
  /** Enlace para repetir este combate en otro dispositivo. */
  enlaceDeRepeticion,
  red,
  lobby,
  sincronia,
  state,
  world,
  cam,
  hud,
  scene,
  efectos,
  biome,
  calidad,
  renderer,
  setAssist(v) {
    CONFIG.assistLevel = clamp(v, 0, 1);
    refreshPreview();
  },
  reseed(seedText) {
    startMatch(String(seedText));
  },
  /**
   * Avanza N pasos fijos de simulacion sin depender del render. Existe porque
   * la simulacion es determinista y por tanto reproducible fuera del bucle de
   * dibujo: permite probar balistica, dano y reaccion sin cronometros.
   */
  stepSim(n = 1) {
    for (let i = 0; i < n; i++) fixedUpdate();
    return { fase: state.phase, pasos: state.flightSteps };
  },
  /** Pide avanzar el vehiculo activo, en unidades de mundo con signo. */
  avanzar(delta) {
    pedirAvance(delta);
    return { pedido: state.avance, x: activeCannon().group.position.x, ...resolverAvance() };
  },
  /** Deposito de cada vehiculo, para las verificaciones. */
  get combustible() {
    return [...state.combustible];
  },
  /** Apunta el canon activo por codigo, para pruebas reproducibles. */
  aim(phiDeg, power) {
    const slot = activeAim();
    slot.phi = clamp(phiDeg * DEG, MIN_PHI, MAX_PHI);
    slot.power = clamp(power, 0, 1);
    activeCannon().setAim(slot.phi);
    refreshPreview();
    updateHud();
  },
  fire,
};
