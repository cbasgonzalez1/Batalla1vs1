import * as THREE from 'three';
import { makeSoftTexture, makeFlashTexture } from './geometry.js';
import { easeOutExpo, easeOutQuad } from '../core/easing.js';

/**
 * Todo lo que se ve pero no se simula: fogonazo, humo, trazadora, casquillo,
 * onda expansiva, escombros y la sacudida de camara.
 *
 * Tres reglas que mandan sobre el resto:
 *
 * 1. NADA de esto toca la simulacion. Se anima con el reloj de pared, no con
 *    el paso fijo, y si el navegador se atasca y salta cuadros el combate sale
 *    identico. Es lo que permite que un movil viejo y uno nuevo jueguen la
 *    misma partida aunque no vean la misma cantidad de humo.
 *
 * 2. El azar sale de un PRNG con semilla. No por determinismo de simulacion
 *    —esto es decorado— sino para que una repeticion se VEA igual y no solo
 *    de el mismo resultado. Una repeticion con el humo en otro sitio se siente
 *    como otra partida.
 *
 * 3. Todo esta preasignado. Ni un `new` por cuadro: en un movil el recolector
 *    de basura es lo que convierte 60 fps en un tiron cada dos segundos, y el
 *    encargo era que fuera tan fluido como los juegos de referencia.
 *
 * Coste en llamadas de dibujo: 2 nubes de particulas + onda + escombros +
 * casquillo = 5. Las particulas van todas en dos `Points`, uno aditivo (fuego,
 * trazadora, chispa) y otro normal (humo, polvo), en vez de un sprite por
 * particula, que serian doscientas llamadas.
 */

// Movimiento, ARTE.md seccion 14. Milisegundos.
export const TIEMPOS = {
  fogonazo: 70,
  humoBoca: 900,
  estela: 220,
  ondaExpansiva: 380,
  escombros: 700,
  sacudida: 260,
  casquillo: 900,
};

// Sacudida de pantalla: de un roce a un impacto directo. Proporcional al daño,
// no fija — si un rasguño sacude igual que un pepinazo, la sacudida deja de
// contar nada y pasa a ser ruido.
export const SACUDIDA = { minima: 0.15, maxima: 0.6, hercios: 22 };

const CAPACIDAD = 320;      // particulas por nube
const ESCOMBROS = 18;       // fragmentos del maximo impacto

const VERTEX = `
  attribute float aTam;
  attribute float aAlfa;
  attribute vec3 aColor;
  uniform float uEscala;
  varying float vAlfa;
  varying vec3 vColor;
  void main() {
    vAlfa = aAlfa;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aTam * uEscala;
  }
`;

const FRAGMENT = `
  uniform sampler2D uMapa;
  varying float vAlfa;
  varying vec3 vColor;
  void main() {
    float a = texture2D(uMapa, gl_PointCoord).a * vAlfa;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/**
 * Nube de particulas de una sola llamada de dibujo.
 *
 * Las particulas viven en anillo: cuando se acaban se reutiliza la mas vieja.
 * Preferible a no emitir — un impacto sin polvo se lee como un fallo del
 * juego, y una particula robada a otro efecto no la ve nadie.
 */
class Nube {
  constructor({ textura, aditiva, capacidad = CAPACIDAD }) {
    this.n = capacidad;
    this.pos = new Float32Array(capacidad * 3);
    this.tam = new Float32Array(capacidad);
    this.alfa = new Float32Array(capacidad);
    this.color = new Float32Array(capacidad * 3);

    // Estado que no viaja a la GPU.
    this.vx = new Float32Array(capacidad);
    this.vy = new Float32Array(capacidad);
    this.vida = new Float32Array(capacidad);     // segundos restantes
    this.total = new Float32Array(capacidad);    // segundos de vida total
    this.tam0 = new Float32Array(capacidad);
    this.tam1 = new Float32Array(capacidad);
    this.gravedad = new Float32Array(capacidad);
    this.rozamiento = new Float32Array(capacidad);
    this.siguiente = 0;
    this.vivas = 0;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aTam', new THREE.BufferAttribute(this.tam, 1));
    this.geo.setAttribute('aAlfa', new THREE.BufferAttribute(this.alfa, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.geo.setDrawRange(0, capacidad);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMapa: { value: textura },
        uEscala: { value: 36 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: aditiva ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.puntos = new THREE.Points(this.geo, this.material);
    this.puntos.frustumCulled = false;
    this.puntos.renderOrder = aditiva ? 12 : 11;
  }

  emitir({ x, y, z, vx, vy, vida, tam0, tam1, color, gravedad = 0, rozamiento = 0 }) {
    const i = this.siguiente;
    this.siguiente = (i + 1) % this.n;

    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vida[i] = vida;
    this.total[i] = vida;
    this.tam0[i] = tam0;
    this.tam1[i] = tam1;
    this.gravedad[i] = gravedad;
    this.rozamiento[i] = rozamiento;
    this.color[i * 3] = color.r;
    this.color[i * 3 + 1] = color.g;
    this.color[i * 3 + 2] = color.b;
    this.tam[i] = tam0;
    this.alfa[i] = 1;
  }

  actualizar(dt) {
    let vivas = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) {
        if (this.alfa[i] !== 0) this.alfa[i] = 0;
        continue;
      }
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) {
        this.vida[i] = 0;
        this.alfa[i] = 0;
        continue;
      }
      vivas++;

      const k = 1 - this.vida[i] / this.total[i]; // 0 recien nacida, 1 al morir
      const freno = Math.exp(-this.rozamiento[i] * dt);
      this.vx[i] *= freno;
      this.vy[i] = this.vy[i] * freno + this.gravedad[i] * dt;
      this.pos[i * 3] += this.vx[i] * dt;
      this.pos[i * 3 + 1] += this.vy[i] * dt;

      this.tam[i] = this.tam0[i] + (this.tam1[i] - this.tam0[i]) * easeOutQuad(k);
      this.alfa[i] = 1 - easeOutQuad(k);
    }
    this.vivas = vivas;

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aTam.needsUpdate = true;
    this.geo.attributes.aAlfa.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }

  apagar() {
    this.vida.fill(0);
    this.alfa.fill(0);
    this.geo.attributes.aAlfa.needsUpdate = true;
  }
}

export function crearEfectos({ escena, rng, acento, z = 0.25, movimientoReducido = false }) {
  const suave = makeSoftTexture(0.05);
  const dura = makeSoftTexture(0.45);
  const flashTex = makeFlashTexture();

  const fuego = new Nube({ textura: dura, aditiva: true });
  const humo = new Nube({ textura: suave, aditiva: false });
  escena.add(fuego.puntos, humo.puntos);

  const colorAcento = new THREE.Color(acento);
  const colorHumo = new THREE.Color(0xb9b3a6);
  const colorPolvo = new THREE.Color(0xcfc4ad);
  const colorBrasa = new THREE.Color(0xffb15a);

  // --- fogonazo: un solo sprite, aditivo -----------------------------------
  const fogonazo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: flashTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }),
  );
  fogonazo.visible = false;
  fogonazo.renderOrder = 13;
  escena.add(fogonazo);
  let fogonazoMs = 0;
  let fogonazoTam = 3;

  // --- onda expansiva: un anillo que crece ---------------------------------
  const anillo = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  anillo.visible = false;
  anillo.renderOrder = 12;
  escena.add(anillo);
  let ondaMs = 0;
  let ondaRadio = 6;

  // --- escombros: una sola malla instanciada -------------------------------
  const trozo = new THREE.IcosahedronGeometry(0.16, 0);
  const escombros = new THREE.InstancedMesh(
    trozo,
    new THREE.MeshStandardMaterial({ color: 0x8a8172, roughness: 0.95, metalness: 0 }),
    ESCOMBROS,
  );
  escombros.castShadow = true;
  escombros.frustumCulled = false;
  escombros.count = ESCOMBROS;
  escena.add(escombros);
  const trozos = Array.from({ length: ESCOMBROS }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, giro: 0, dgiro: 0, escala: 1, vida: 0, total: 1,
  }));
  const matriz = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const ejeGiro = new THREE.Vector3(0, 0, 1);
  const sitio = new THREE.Vector3();
  const escala = new THREE.Vector3();

  // --- casquillo: sale por la culata y rueda -------------------------------
  const casquilloGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.42, 8);
  const casquillo = new THREE.Mesh(
    casquilloGeo,
    new THREE.MeshStandardMaterial({ color: 0xc99a3f, roughness: 0.42, metalness: 0 }),
  );
  casquillo.castShadow = true;
  casquillo.visible = false;
  escena.add(casquillo);
  const vaina = { x: 0, y: 0, vx: 0, vy: 0, giro: 0, vida: 0, suelo: 0 };

  // --- sacudida ------------------------------------------------------------
  let sacudidaMs = 0;
  let sacudidaAmp = 0;
  let sacudidaFase = 0;
  const desplazamiento = { x: 0, y: 0 };

  // --- estela de la trazadora ---------------------------------------------
  // Se emite cada pocos pasos y no en todos: a 120 Hz de simulacion un punto
  // por paso serian 264 particulas en el vuelo mas corto y la estela saldria
  // como una linea solida.
  let desdeUltimaEstela = 0;

  const azar = (a, b) => a + rng() * (b - a);

  return {
    /** Se llama al resize y al zoom: convierte tamaños de mundo a pixeles. */
    setEscala(pixelesPorUnidad) {
      fuego.material.uniforms.uEscala.value = pixelesPorUnidad;
      humo.material.uniforms.uEscala.value = pixelesPorUnidad;
    },

    /**
     * El disparo. `dx, dy` es la direccion de la boca, ya normalizada.
     */
    disparo({ x, y, dx, dy, retroceso = 1 }) {
      fogonazo.position.set(x + dx * 0.4, y + dy * 0.4, z);
      fogonazoTam = 3.1 * retroceso;
      fogonazo.scale.set(fogonazoTam, fogonazoTam, 1);
      fogonazo.material.rotation = Math.atan2(dy, dx);
      fogonazo.material.opacity = 1;
      fogonazo.visible = true;
      fogonazoMs = 0;

      // Chispas por delante de la boca, en un cono estrecho.
      for (let i = 0; i < 10; i++) {
        const abre = azar(-0.28, 0.28);
        const ex = dx * Math.cos(abre) - dy * Math.sin(abre);
        const ey = dx * Math.sin(abre) + dy * Math.cos(abre);
        const v = azar(9, 24);
        fuego.emitir({
          x: x + ex * 0.5, y: y + ey * 0.5, z,
          vx: ex * v, vy: ey * v,
          vida: azar(0.09, 0.2),
          tam0: azar(0.28, 0.52), tam1: 0.04,
          color: colorBrasa,
          gravedad: -6, rozamiento: 5.5,
        });
      }

      // Humo de boca: sale disparado hacia delante y se queda flotando. Nueve
      // décimas de segundo, que es lo que tarda en dejar de tapar la mira.
      for (let i = 0; i < 12; i++) {
        const abre = azar(-0.5, 0.5);
        const ex = dx * Math.cos(abre) - dy * Math.sin(abre);
        const ey = dx * Math.sin(abre) + dy * Math.cos(abre);
        const v = azar(3.5, 11);
        humo.emitir({
          x: x + ex * 0.6, y: y + ey * 0.6, z: z - 0.05,
          vx: ex * v, vy: ey * v + azar(0.4, 1.8),
          vida: azar(0.55, TIEMPOS.humoBoca / 1000),
          tam0: azar(0.5, 0.9), tam1: azar(1.8, 2.2),
          color: colorHumo,
          gravedad: 1.1, rozamiento: 3.2,
        });
      }

      // El casquillo. Sale por el lado contrario al tiro y hacia arriba.
      vaina.x = x - dx * 1.6;
      vaina.y = y - dy * 1.6 + 0.3;
      vaina.vx = -dx * azar(2.5, 4.5);
      vaina.vy = azar(5.5, 8);
      vaina.giro = 0;
      vaina.vida = TIEMPOS.casquillo / 1000;
      vaina.suelo = y - 1.6;
      casquillo.visible = true;
    },

    /** Un punto de trazadora detras del proyectil. */
    estela(x, y, dt) {
      desdeUltimaEstela += dt;
      if (desdeUltimaEstela < 0.012) return;
      desdeUltimaEstela = 0;
      fuego.emitir({
        x, y, z: z - 0.02,
        vx: 0, vy: 0,
        vida: TIEMPOS.estela / 1000,
        tam0: 0.42, tam1: 0.08,
        color: colorAcento,
        gravedad: 0, rozamiento: 0,
      });
    },

    /**
     * El impacto. `daño` en puntos de vida decide cuanto sacude la pantalla.
     */
    impacto({ x, y, radio, daño = 0, escombros: cuantos = ESCOMBROS }) {
      // Onda: crece a tres veces el crater y se apaga. Casi todo el
      // crecimiento va en el primer tercio, asi se lee como presion y no como
      // una pompa que se hincha.
      anillo.position.set(x, y, z + 0.05);
      anillo.visible = true;
      anillo.material.opacity = 0.9;
      ondaRadio = radio * 3;
      ondaMs = 0;

      // Bola de fuego.
      for (let i = 0; i < 14; i++) {
        const a = azar(0, Math.PI * 2);
        const v = azar(4, 16);
        fuego.emitir({
          x, y, z,
          vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v * 0.8 + 3,
          vida: azar(0.12, 0.3),
          tam0: azar(0.6, 1.4), tam1: 0.1,
          color: colorBrasa,
          gravedad: -4, rozamiento: 4.5,
        });
      }

      // Polvo: mas lento y mas grande, es lo que da la escala del crater.
      for (let i = 0; i < 20; i++) {
        const a = azar(0, Math.PI);
        const v = azar(2.5, 12);
        humo.emitir({
          x: x + azar(-radio, radio) * 0.4, y, z: z - 0.05,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v + azar(1, 4),
          vida: azar(0.6, 1.3),
          tam0: azar(0.7, 1.3), tam1: azar(2.4, 3.6),
          color: colorPolvo,
          gravedad: -1.6, rozamiento: 2.4,
        });
      }

      // Escombros: fragmentos con caida propia. Terminan a los 0,7 s, antes de
      // que empiece a caer la arena, para no competir con la pluma.
      const cuantosDe = Math.max(12, Math.min(ESCOMBROS, Math.round(cuantos)));
      for (let i = 0; i < cuantosDe; i++) {
        const t = trozos[i];
        const a = azar(0.25, Math.PI - 0.25);
        const v = azar(7, 17);
        t.x = x + azar(-0.6, 0.6);
        t.y = y + azar(0, 0.5);
        t.vx = Math.cos(a) * v;
        t.vy = Math.sin(a) * v;
        t.giro = azar(0, Math.PI * 2);
        t.dgiro = azar(-11, 11);
        t.escala = azar(0.55, 1.5);
        t.total = azar(0.45, TIEMPOS.escombros / 1000);
        t.vida = t.total;
      }

      // Sacudida proporcional al daño. Un roce y un impacto directo no pueden
      // sentirse igual, o la sacudida deja de contar nada.
      if (!movimientoReducido) {
        const fuerza = Math.min(1, daño / 46);
        sacudidaAmp = SACUDIDA.minima + (SACUDIDA.maxima - SACUDIDA.minima) * fuerza;
        sacudidaMs = 0;
        sacudidaFase = azar(0, Math.PI * 2);
      }
    },

    /** Desplazamiento de camara de este cuadro. Se lee despues de actualizar. */
    get sacudida() {
      return desplazamiento;
    },

    /** @param {number} dt segundos de reloj de pared */
    actualizar(dt) {
      fuego.actualizar(dt);
      humo.actualizar(dt);

      // fogonazo
      if (fogonazo.visible) {
        fogonazoMs += dt * 1000;
        const k = Math.min(1, fogonazoMs / TIEMPOS.fogonazo);
        const e = easeOutExpo(k);
        fogonazo.material.opacity = 1 - e;
        const s = fogonazoTam * (0.55 + 0.65 * e);
        fogonazo.scale.set(s, s, 1);
        if (k >= 1) fogonazo.visible = false;
      }

      // onda expansiva
      if (anillo.visible) {
        ondaMs += dt * 1000;
        const k = Math.min(1, ondaMs / TIEMPOS.ondaExpansiva);
        const e = easeOutExpo(k);
        const r = 0.4 + ondaRadio * e;
        anillo.scale.set(r, r, 1);
        anillo.material.opacity = 0.9 * (1 - k) * (1 - k);
        if (k >= 1) anillo.visible = false;
      }

      // escombros
      let algunTrozo = false;
      for (let i = 0; i < ESCOMBROS; i++) {
        const t = trozos[i];
        if (t.vida <= 0) {
          escala.set(0, 0, 0);
          matriz.compose(sitio.set(0, -9999, 0), quat.identity(), escala);
          escombros.setMatrixAt(i, matriz);
          continue;
        }
        algunTrozo = true;
        t.vida -= dt;
        t.vy -= 26 * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.giro += t.dgiro * dt;
        const k = 1 - Math.max(0, t.vida) / t.total;
        const s = t.escala * (1 - easeOutQuad(k));
        quat.setFromAxisAngle(ejeGiro, t.giro);
        matriz.compose(sitio.set(t.x, t.y, z), quat, escala.set(s, s, s));
        escombros.setMatrixAt(i, matriz);
      }
      escombros.instanceMatrix.needsUpdate = true;
      escombros.visible = algunTrozo;

      // casquillo
      if (vaina.vida > 0) {
        vaina.vida -= dt;
        vaina.vy -= 24 * dt;
        vaina.x += vaina.vx * dt;
        vaina.y += vaina.vy * dt;
        vaina.giro += 13 * dt;
        if (vaina.y < vaina.suelo) {
          vaina.y = vaina.suelo;
          vaina.vy = -vaina.vy * 0.32;
          vaina.vx *= 0.55;
        }
        casquillo.position.set(vaina.x, vaina.y, z - 0.1);
        casquillo.rotation.z = vaina.giro;
        casquillo.visible = true;
      } else if (casquillo.visible) {
        casquillo.visible = false;
      }

      // sacudida: oscila y se apaga
      if (sacudidaAmp > 0) {
        sacudidaMs += dt * 1000;
        const k = Math.min(1, sacudidaMs / TIEMPOS.sacudida);
        const caida = 1 - easeOutExpo(k);
        const w = sacudidaFase + (sacudidaMs / 1000) * SACUDIDA.hercios * Math.PI * 2;
        desplazamiento.x = Math.sin(w) * sacudidaAmp * caida;
        desplazamiento.y = Math.cos(w * 1.37) * sacudidaAmp * caida * 0.7;
        if (k >= 1) {
          sacudidaAmp = 0;
          desplazamiento.x = 0;
          desplazamiento.y = 0;
        }
      }
    },

    /** Se llama al empezar partida: no arrastrar humo de la anterior. */
    limpiar() {
      fuego.apagar();
      humo.apagar();
      fogonazo.visible = false;
      anillo.visible = false;
      casquillo.visible = false;
      vaina.vida = 0;
      for (const t of trozos) t.vida = 0;
      sacudidaAmp = 0;
      desplazamiento.x = 0;
      desplazamiento.y = 0;
    },

    /** Para las pruebas: cuantas particulas hay vivas ahora mismo. */
    get vivas() {
      return fuego.vivas + humo.vivas;
    },
  };
}
