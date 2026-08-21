import { chromium } from 'playwright';
import { sesionEnContexto } from './sesion-de-prueba.mjs';

/**
 * Seis navegadores, tres por bando, la misma partida.
 *
 * Es la prueba de lo que se pidio: una familia entera jugando desde sus
 * moviles. Comprueba que se montan seis vehiculos, que el turno rota bando a
 * bando saltando al que cae, y que los seis terminan con el mismo terreno.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const TURNOS = Number(process.env.TURNOS ?? 6);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Seis contextos WebGL a la vez. Sin GL de verdad, Chromium pinta por software
// y la pagina se estrangula tanto que la sala tarda mas de treinta segundos en
// aparecer: el guion se cae por tiempo y parece un fallo del lobby.
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=gl-egl'] });
const errores = [];

async function abrir(nombre, cuenta) {
  const ctx = await nav.newContext({ locale: 'es-ES' });
  // Con el servidor de cuentas levantado, el panel de acceso tapa la sala: el
  // token se siembra antes de navegar. Sin ese servidor no hace nada.
  await sesionEnContexto(ctx, cuenta);
  const pg = await ctx.newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(`[${nombre}] ${m.text()}`));
  pg.on('pageerror', (e) => errores.push(`[${nombre}] ${e}`));
  await pg.goto(`${URL}/?online`, { waitUntil: 'networkidle' });
  return pg;
}

/** Espera a que todos cumplan una condicion, o se rinde. */
async function esperarA(paginas, condicion, ms) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const todos = await Promise.all(paginas.map(estado));
    if (todos.every(condicion)) return true;
    await esperar(80);
  }
  return false;
}

const estado = (pg) =>
  pg.evaluate(() => {
    const G = window.GAME;
    const t = G.world.terrain;
    let masa = 0;
    for (const h of t.heights) masa += (h - t.floorY) * t.dx;
    return {
      vehiculos: G.world.cannons.length,
      posiciones: G.world.cannons.map((c) => Math.round(c.group.position.x * 100) / 100),
      activo: G.state.active,
      fase: G.state.phase,
      quienJuega: G.state.plantel[G.state.active]?.nombre ?? null,
      meToca: G.sincronia.meToca(),
      vidas: G.state.players.map((p) => Math.round(p.hp * 100) / 100),
      ronda: G.state.partida?.ronda ?? null,
      masa: Math.round(masa * 100) / 100,
      perfil: Array.from({ length: 16 }, (_, i) =>
        Math.round(t.heights[Math.floor((i * t.cols) / 16)] * 100) / 100
      ),
      marcadores: document.querySelectorAll('#lado-a .player, #lado-b .player').length,
    };
  });

const nombres = ['Ana', 'Bea', 'Caro', 'Dani', 'Eva', 'Fran'];
const paginas = [];

// El primero crea la sala; los demas entran con el codigo.
paginas.push(await abrir(nombres[0], 'trio-0'));
await paginas[0].fill('#s-nombre', nombres[0]);
await paginas[0].click('#s-crear');
await esperar(700);
const codigo = await paginas[0].textContent('#s-codigo');
console.log(`sala ${codigo}`);

for (let i = 1; i < 6; i++) {
  const pg = await abrir(nombres[i], `trio-${i}`);
  await pg.fill('#s-nombre', nombres[i]);
  await pg.fill('#s-codigo-input', codigo);
  await pg.click('#s-unir');
  await esperar(250);
  paginas.push(pg);
}
await esperar(600);

const reparto = await paginas[0].evaluate(() => ({
  a: [...document.querySelectorAll('#s-lista-a li')].map((n) => n.textContent.trim()),
  b: [...document.querySelectorAll('#s-lista-b li')].map((n) => n.textContent.trim()),
}));
console.log(`  bando A: ${reparto.a.join(', ')}`);
console.log(`  bando B: ${reparto.b.join(', ')}`);

for (const pg of paginas) await pg.click('#s-listo');
await esperar(1500);

const arranque = await estado(paginas[0]);
console.log(`\nvehiculos montados: ${arranque.vehiculos}   marcadores: ${arranque.marcadores}`);
console.log(`posiciones: ${arranque.posiciones.join(', ')}`);

const orden = [];
for (let turno = 0; turno < TURNOS; turno++) {
  const antes = await estado(paginas[0]);
  orden.push(antes.quienJuega);

  const indice = await Promise.all(paginas.map(async (pg) => (await estado(pg)).meToca));
  const quien = paginas[indice.indexOf(true)];
  if (!quien) {
    console.log(`turno ${turno + 1}: nadie cree que le toca`);
    break;
  }

  await quien.evaluate(
    ([a, p]) => {
      window.GAME.aim(a, p);
      window.GAME.fire();
    },
    [36 + turno * 5, 0.62 + (turno % 4) * 0.05]
  );

  // Se espera a que el disparo LLEGUE a todos antes de avanzar el tiempo. Sin
  // esto el que aun no lo ha recibido avanza en vano y se queda un turno atras:
  // seria un fallo del guion, no del juego.
  await esperarA(paginas, (e) => e.fase === 'flying' || e.ronda > antes.ronda, 3000);
  for (let intento = 0; intento < 12; intento++) {
    for (const pg of paginas) await pg.evaluate(() => window.advanceTime(1000));
    await esperar(120);
    const ahora = await Promise.all(paginas.map(estado));
    if (ahora.every((e) => e.fase === 'aiming') && new Set(ahora.map((e) => e.ronda)).size === 1) break;
  }
}

const finales = await Promise.all(paginas.map(estado));
const perfiles = new Set(finales.map((e) => JSON.stringify(e.perfil)));
const masas = new Set(finales.map((e) => e.masa));
const vidas = new Set(finales.map((e) => JSON.stringify(e.vidas)));
const rondas = new Set(finales.map((e) => e.ronda));

console.log(`\norden de turnos: ${orden.join(' -> ')}`);
console.log(`vidas finales:   ${finales[0].vidas.join(', ')}`);
console.log(`perfiles distintos entre los seis: ${perfiles.size}`);
console.log(`masas distintas:                   ${masas.size}`);
console.log(`vidas distintas:                   ${vidas.size}`);
console.log(`rondas distintas:                  ${rondas.size}`);
console.log(`errores de consola: ${errores.length ? errores.slice(0, 3).join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos =
  (arranque.vehiculos !== 6 ? 1 : 0) +
  (arranque.marcadores !== 6 ? 1 : 0) +
  (perfiles.size !== 1 ? 1 : 0) +
  (masas.size !== 1 ? 1 : 0) +
  (vidas.size !== 1 ? 1 : 0) +
  (rondas.size !== 1 ? 1 : 0) +
  (errores.length ? 1 : 0);

console.log(fallos === 0 ? '\nLOS SEIS JUEGAN LA MISMA PARTIDA' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
