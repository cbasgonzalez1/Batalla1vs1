import { clamp } from '../core/mathx.js';

/**
 * Reglas de combate: vida, dano por proximidad y cargas de reaccion.
 *
 * Todo el modulo es puro y sin estado: recibe datos y devuelve numeros. Asi la
 * simulacion sigue siendo determinista y las reglas se pueden probar sin
 * montar la escena.
 */

export const MAX_HP = 100;

export const BLAST = {
  radius: 5.2,      // unidades de mundo
  maxDamage: 46,    // directo -> 3 golpes matan; buen impacto -> 4
  // El proyectil revienta contra el suelo, casi nunca contra el chasis, asi
  // que un tiro "bueno" cae a ~2 unidades del centro del vehiculo. Con una
  // caida muy pronunciada esos tiros no dolian y el combate se eternizaba.
  falloff: 1.15,
};

export const REACTION = {
  charges: 3,          // por jugador y combate
  windowSteps: 108,    // 0.9 s a 120 Hz, se abre antes del impacto
  shieldFactor: 0.28,  // multiplicador de dano con escudo
  hopDistance: 3.6,    // unidades que salta el vehiculo
  hopSteps: 34,        // ~0.28 s de salto
  hopLift: 1.8,        // altura del arco del salto
};

/** Dano de una explosion sobre un objetivo, con caida por distancia. */
export function damageAt(impactX, impactY, targetX, targetY) {
  const d = Math.hypot(impactX - targetX, impactY - targetY);
  if (d >= BLAST.radius) return 0;
  const t = 1 - d / BLAST.radius;
  return BLAST.maxDamage * Math.pow(t, BLAST.falloff);
}

/** Centro de masa del vehiculo, que es lo que recibe el dano. */
export function targetPoint(cannon) {
  return { x: cannon.group.position.x, y: cannon.group.position.y + 1.0 };
}

export function newPlayerState() {
  return {
    hp: MAX_HP,
    charges: REACTION.charges,
    shielded: false,   // activo solo para el impacto en curso
    destroyed: false,
    hop: null,         // { fromX, toX, step, steps }
  };
}

export function applyDamage(player, raw) {
  const dmg = player.shielded ? raw * REACTION.shieldFactor : raw;
  player.hp = clamp(player.hp - dmg, 0, MAX_HP);
  if (player.hp <= 0) player.destroyed = true;
  return dmg;
}
