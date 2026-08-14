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
} from './art/direction.js';
import { makeDotTexture, makeSkyTexture } from './art/geometry.js';
import { Terrain } from './world/terrain.js';
import { buildCannon } from './world/cannon.js';
import { GameCamera } from './world/gamecamera.js';
import { TrajectoryArc } from './world/trajectory.js';
import { attachDragControl } from './ui/input.js';
import { FIXED_DT, simulate, step, sweepTerrain, launchVelocity } from './game/ballistics.js';
import {
  MAX_HP,
  REACTION,
  damageAt,
  targetPoint,
  newPlayerState,
  applyDamage,
} from './game/combat.js';
import { Hud } from './ui/hud.js';
import { idiomaDelNavegador, crearTraductor, aplicarTraduccion } from './ui/i18n.js';
import { exponerGanchos } from './ui/inspeccion.js';

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
  seed: params.get('seed') || 'kerch-01',
  biome: params.get('biome') || 'dunas',

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

  craterRadius: 2.6,
  settleSteps: 54,       // ~0.45 s mirando el impacto antes de cambiar turno
};

const MIN_PHI = 2 * DEG;
const MAX_PHI = 170 * DEG;

// ─────────────────────────────────────────────────────────────────── montaje

const stage = document.getElementById('stage');
const biome = BIOMES[CONFIG.biome] ?? BIOMES.dunas;
const accent = projectileAccent(biome);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
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

const arc = new TrajectoryArc({ texture: dotTexture, pixelRatio: renderer.getPixelRatio() });
scene.add(arc.points);

const projectile = new THREE.Group();
projectile.visible = false;

const shellCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.34, 20, 14),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: accent.hex,
    emissiveIntensity: 1.9,
    roughness: 0.35,
    metalness: 0.0,
  }),
);
shellCore.castShadow = true;
projectile.add(shellCore);

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

// ─────────────────────────────────────────────────────────────────── estado

const world = { terrain: null, cannons: [], shields: [] };

const state = {
  phase: 'aiming',   // aiming | flying | settling | victory
  active: 0,
  players: [newPlayerState(), newPlayerState()],
  aim: [
    { phi: 48 * DEG, power: 0.7 },
    { phi: 48 * DEG, power: 0.7 },
  ],
  wind: 0,
  turnRng: null,
  shot: null,
  flightSteps: 0,
  impactSteps: Infinity,
  reaction: { open: false, used: false, defender: 1 },
  settle: 0,
  shots: [0, 0],
  dragging: false,
  scouting: false,
  fired: false,
  previewPoints: null,
  previewCount: 0,
  goal: { x: 0, y: 0, w: CONFIG.camera.aimWidth },
};

const activeCannon = () => world.cannons[state.active];
const activeAim = () => state.aim[state.active];
const nextWind = () => (state.turnRng() * 2 - 1) * CONFIG.windRange;

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

  world.terrain = new Terrain({
    rng,
    biome,
    ...CONFIG.world,
    bowlHalfWidth: CONFIG.cannonX,
    pads: [
      { x: -CONFIG.cannonX, halfWidth: 2.6, feather: 3.2 },
      { x: +CONFIG.cannonX, halfWidth: 2.6, feather: 3.2 },
    ],
  });
  scene.add(world.terrain.group);
  cam.setBounds(world.terrain.x0, world.terrain.x0 + world.terrain.width);

  const specs = [
    { chassis: MATERIALS.chassisA, facing: +1, x: -CONFIG.cannonX },
    { chassis: MATERIALS.chassisB, facing: -1, x: +CONFIG.cannonX },
  ];
  for (const spec of specs) {
    const c = buildCannon(spec);
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
  state.wind = nextWind();
}

function startMatch(seedText) {
  CONFIG.seed = seedText;
  buildWorld(seedText);
  state.players = [newPlayerState(), newPlayerState()];
  state.phase = 'aiming';
  state.active = 0;
  state.shot = null;
  state.shots = [0, 0];
  state.reaction = { open: false, used: false, defender: 1 };
  closeReaction();
  hud.hideVictory();
  for (const dome of world.shields) dome.visible = false;
  for (let i = 0; i < 2; i++) {
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
  const enemy = world.cannons[1 - state.active];
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

function refreshPreview() {
  if (state.phase !== 'aiming') {
    arc.hide();
    state.previewPoints = null;
    state.previewCount = 0;
    return;
  }
  const { points } = simulate(muzzleState(), state.wind, world.terrain, {
    sampleEvery: 6,
    maxPoints: 96,
    bounds: simBounds(),
  });
  state.previewPoints = points;
  state.previewCount = arc.update(points, CONFIG.assistLevel, CONFIG.playZ);
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

// ────────────────────────────────────────────────────────────────── disparo

function fire() {
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
  state.reaction = { open: false, used: false, defender: 1 - state.active };
  state.shots[state.active] += 1;

  projectile.position.set(start.x, start.y, CONFIG.playZ);
  projectile.visible = true;
  state.phase = 'flying';
  arc.hide();

  if (!state.fired) {
    state.fired = true;
    hud.hideHint();
  }
}

function onImpact(hit) {
  // Fase 1: el crater se resta de golpe. La deformacion animada en ~200 ms
  // entra con el resto del motion spec.
  world.terrain.carve(hit.x, hit.y, CONFIG.craterRadius);
  projectile.visible = false;
  state.shot = null;
  closeReaction();

  // Reasentar los vehiculos: si el crater les quito el suelo se quedarian
  // flotando sobre el hueco.
  for (let i = 0; i < 2; i++) {
    if (state.players[i].hop) continue;
    const g = world.cannons[i].group;
    g.position.y = world.terrain.heightAt(g.position.x);
  }

  // La metralla alcanza a los dos: un tiro corto puede volarte a ti mismo.
  for (let i = 0; i < 2; i++) {
    const t = targetPoint(world.cannons[i]);
    const raw = damageAt(hit.x, hit.y, t.x, t.y);
    if (raw > 0) applyDamage(state.players[i], raw);
    state.players[i].shielded = false;
    world.shields[i].visible = false;
  }

  const dead = state.players.findIndex((p) => p.destroyed);
  if (dead >= 0) return declareVictory(1 - dead, dead);

  state.phase = 'settling';
  state.settle = CONFIG.settleSteps;
  state.goal = { x: hit.x, y: hit.y + 6, w: CONFIG.camera.aimWidth };
}

function endTurn() {
  projectile.visible = false;
  state.shot = null;
  state.active = 1 - state.active;
  state.wind = nextWind();
  state.phase = 'aiming';
  activeCannon().setAim(activeAim().phi);
  // Barrido al canon activo: 700 ms, easeInOutCubic.
  state.goal = aimFraming(state.active);
  cam.tweenTo(state.goal.x, state.goal.y, state.goal.w, 700, easeInOutCubic);
  refreshPreview();
  updateHud();
}

function declareVictory(winner, loser) {
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
  if (!canReact()) return;
  const i = state.reaction.defender;
  spendCharge();
  state.players[i].shielded = true;
  world.shields[i].visible = true;
}

function useHop() {
  if (!canReact()) return;
  const i = state.reaction.defender;
  const cannon = world.cannons[i];
  const px = cannon.group.position.x;
  // Salta alejandose del punto de caida previsto.
  const impactX = state.shot ? predictImpactX() : px;
  const away = Math.sign(px - impactX) || cannon.facing;
  const limit = world.terrain.width / 2 - 4;
  spendCharge();
  state.players[i].hop = {
    fromX: px,
    toX: clamp(px + away * REACTION.hopDistance, -limit, limit),
    step: 0,
  };
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
  for (let i = 0; i < 2; i++) {
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

const hud = new Hud({
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
  onAgain() {
    startMatch(`${CONFIG.seed}+${state.shots[0] + state.shots[1]}`);
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

    // Ventana de reaccion: se abre a 0.9 s del impacto previsto.
    if (
      !state.reaction.open &&
      !state.reaction.used &&
      state.players[state.reaction.defender].charges > 0 &&
      state.impactSteps - state.flightSteps <= REACTION.windowSteps
    ) {
      openReaction();
    }

    const px = s.x;
    const py = s.y;
    step(s, state.wind, FIXED_DT);
    shellCore.rotation.z -= 0.14; // giro sobre su eje

    const impact = sweepTerrain(px, py, s.x, s.y, world.terrain);
    if (impact) return onImpact(impact);

    const t = world.terrain;
    if (s.x < t.x0 - 8 || s.x > t.x0 + t.width + 8 || s.y < CONFIG.world.baseY) {
      closeReaction();
      return endTurn();
    }
    projectile.position.set(s.x, s.y, CONFIG.playZ);
    return;
  }

  if (state.phase === 'settling') {
    state.settle -= 1;
    if (state.settle <= 0) endTurn();
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

  updateCamera(dt);
  updateLiveHud();
  renderer.render(scene, cam.camera);
}

// ───────────────────────────────────────────────────────────────── pantalla

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;

  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  hud.setShot(state.active === 0 ? 'A' : 'B', Math.round(phi * RAD_TO_DEG), Math.round(power * 100));
  hud.setWind(state.wind);
  for (let i = 0; i < 2; i++) {
    hud.setHp(i, state.players[i].hp);
    hud.setCharges(i, state.players[i].charges);
  }
}

/** Lo que cambia cada cuadro: vida tras un impacto y reloj de reaccion. */
function updateLiveHud() {
  for (let i = 0; i < 2; i++) hud.setHp(i, state.players[i].hp);
  if (state.reaction.open) {
    const left = Math.max(0, state.impactSteps - state.flightSteps);
    hud.setReactionTimer(left / REACTION.windowSteps, left / 120);
  }
}

// ────────────────────────────────────────────────────────────────── arranque

resize();
startMatch(CONFIG.seed);
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
      ganador: state.phase === 'victory' ? (state.players[0].destroyed ? 1 : 0) : null,
      jugadores: state.players.map((p, i) => ({
        vida: p.hp,
        cargas: p.charges,
        disparos: state.shots[i],
        destruido: p.destroyed,
      })),
    };
  },
});

window.GAME = {
  config: CONFIG,
  state,
  world,
  cam,
  hud,
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
