import { chromium } from 'playwright';

/**
 * Una partida entera contra la maquina, en el navegador.
 *
 * Los tests dicen que la IA calcula bien; esto dice que juega: que le toca, que
 * apunta, que dispara sola y que la partida avanza hasta que alguien cae.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const DIFICULTAD = process.env.IA ?? 'normal';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch();
const ctx = await nav.newContext({ locale: 'es-ES' });
const pg = await ctx.newPage();
const errores = [];
pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
pg.on('pageerror', (e) => errores.push(String(e)));

await pg.goto(`${URL}/?seed=duelo&ia=${DIFICULTAD}`, { waitUntil: 'networkidle' });
await esperar(500);

const leer = () =>
  pg.evaluate(() => ({
    fase: window.GAME.state.phase,
    activo: window.GAME.state.active,
    vidas: window.GAME.state.players.map((p) => Math.round(p.hp * 10) / 10),
    disparos: [...window.GAME.state.shots],
    cargas: window.GAME.state.players.map((p) => p.charges),
  }));

console.log(`dificultad: ${DIFICULTAD}\n`);

let tiraLaMaquina = 0;
for (let ronda = 0; ronda < 8; ronda++) {
  const antes = await leer();
  if (antes.fase === 'victory') break;

  if (antes.activo === 0) {
    // Tira la persona: se apunta a mano.
    await pg.evaluate(
      ([a, p]) => {
        window.GAME.aim(a, p);
        window.GAME.fire();
      },
      [42 + ronda * 3, 0.7]
    );
  } else {
    // Tira la maquina: solo hay que dejarla pensar.
    tiraLaMaquina++;
    await esperar(900);
  }

  for (let i = 0; i < 10; i++) {
    await pg.evaluate(() => window.advanceTime(1000));
    await esperar(60);
    if ((await leer()).fase === 'aiming' || (await leer()).fase === 'victory') break;
  }

  const ahora = await leer();
  console.log(
    `ronda ${ronda + 1}: tira ${antes.activo === 0 ? 'persona' : 'MAQUINA'}  ` +
      `vidas ${ahora.vidas.join(' / ')}  disparos ${ahora.disparos.join(' / ')}  cargas ${ahora.cargas.join(' / ')}`
  );
  await esperar(200);
}

const fin = await leer();
console.log(`\nturnos que jugo la maquina: ${tiraLaMaquina}`);
console.log(`disparos: persona ${fin.disparos[0]}, maquina ${fin.disparos[1]}`);
console.log(`vidas finales: ${fin.vidas.join(' / ')}`);
console.log(`errores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos =
  (tiraLaMaquina === 0 ? 1 : 0) +
  (fin.disparos[1] === 0 ? 1 : 0) +
  (fin.vidas[0] === 100 && fin.vidas[1] === 100 ? 1 : 0) +
  (errores.length ? 1 : 0);

console.log(fallos === 0 ? '\nLA MAQUINA JUEGA' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
