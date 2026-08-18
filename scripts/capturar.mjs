import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/**
 * Fotos de las dieciseis ciudades, de las tres composiciones de calle, del
 * deterioro de un blindado y una secuencia del disparo cuadro a cuadro.
 *
 * Es la unica forma honesta de revisar arte: leer los hex del fichero no dice
 * si la trazadora se ve contra el terreno, y una direccion de arte que solo
 * existe en el ARTE.md no existe.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const SALIDA = process.env.SALIDA ?? '/tmp/capturas';
const TEATROS = [
  'ypres', 'verdun', 'varsovia39', 'rotterdam', 'coventry', 'stalingrado',
  'jarkov', 'cassino', 'caen', 'saintlo', 'varsovia44', 'arnhem',
  'aquisgran', 'budapest', 'dresde', 'berlin',
];
const SUELOS = ['avenida', 'zanja', 'monton'];

mkdirSync(SALIDA, { recursive: true });

const nav = await chromium.launch();
const ctx = await nav.newContext({
  locale: 'es-ES',
  viewport: { width: 900, height: 1600 },
  deviceScaleFactor: 2,
});
const errores = [];

async function abrir(url) {
  const pg = await ctx.newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(`${url} :: ${m.text()}`));
  pg.on('pageerror', (e) => errores.push(`${url} :: ${e}`));
  await pg.goto(url, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => window.GAME?.world?.terrain, null, { timeout: 8000 });
  await pg.waitForTimeout(500);
  return pg;
}

// ── un teatro por foto, con el campo abierto para ver los dos blindados ────
for (const teatro of TEATROS) {
  const pg = await abrir(`${URL}/?seed=frente&biome=${teatro}&trampas=0.7`);
  await pg.evaluate(() => {
    const G = window.GAME;
    // El bucle reencuadra cada cuadro hacia `state.goal`: sin moverlo, un
    // `snap` dura un cuadro y la foto sale con el encuadre de siempre.
    G.state.goal = { x: 0, y: G.world.terrain.heightAt(0) + 12, w: 104 };
    G.cam.snap(G.state.goal.x, G.state.goal.y, G.state.goal.w);
  });
  await pg.waitForTimeout(350);
  await pg.screenshot({ path: `${SALIDA}/${teatro}.png` });
  console.log(`${teatro} listo`);
  await pg.close();
}

// ── las tres composiciones de calle, en el mismo teatro y la misma semilla ─
// Lo que cambia entre ellas es COMO ESTA CORTADO EL SUELO, y por eso se
// fotografian con todo lo demas igual: con teatros distintos no se compara nada.
for (const suelo of SUELOS) {
  const pg = await abrir(`${URL}/?seed=frente&biome=caen&trampas=0&suelo=${suelo}`);
  await pg.evaluate(() => {
    const G = window.GAME;
    G.state.goal = { x: 0, y: G.world.terrain.heightAt(0) + 12, w: 104 };
    G.cam.snap(G.state.goal.x, G.state.goal.y, G.state.goal.w);
  });
  await pg.waitForTimeout(320);
  await pg.screenshot({ path: `${SALIDA}/suelo-${suelo}.png` });
  // Y el emplazamiento de cerca: la zanja solo se entiende desde dentro.
  await pg.evaluate(() => {
    const G = window.GAME;
    const x = G.world.cannons[0].group.position.x;
    G.state.goal = { x, y: G.world.terrain.heightAt(x) + 3, w: 26 };
    G.cam.snap(G.state.goal.x, G.state.goal.y, G.state.goal.w);
  });
  await pg.waitForTimeout(320);
  await pg.screenshot({ path: `${SALIDA}/suelo-${suelo}-cerca.png` });
  await pg.close();
  console.log(`suelo ${suelo} listo`);
}

// ── el deterioro, de entero a casi muerto ─────────────────────────────────
// El daño tiene que verse EN EL CAMPO (docs/ARTE-VEHICULOS.md §13), y eso no se
// comprueba leyendo el modulo: se comprueba mirando los cuatro juntos.
{
  const pg = await abrir(`${URL}/?seed=frente&biome=caen&trampas=0&suelo=avenida`);
  for (const vida of [100, 60, 28, 6]) {
    await pg.evaluate((vida) => {
      const G = window.GAME;
      G.state.players[0].hp = vida;
      const x = G.world.cannons[0].group.position.x;
      G.state.goal = { x, y: G.world.terrain.heightAt(x) + 1.6, w: 13 };
      G.cam.snap(G.state.goal.x, G.state.goal.y, G.state.goal.w);
    }, vida);
    // El humo tarda en formar columna: sin esperar, el de 6 se ve como el de 60.
    await pg.waitForTimeout(900);
    await pg.screenshot({ path: `${SALIDA}/dano-${vida}.png` });
  }
  await pg.close();
  console.log('deterioro listo');
}

// ── primer plano de las dos epocas ────────────────────────────────────────
for (const [teatro, epoca] of [['ypres', '1916'], ['berlin', '1942']]) {
  const cerca = await abrir(`${URL}/?seed=frente&biome=${teatro}&trampas=0`);
  await cerca.evaluate(() => {
    const G = window.GAME;
    G.aim(38, 0.7);
    G.state.goal = { x: -42, y: G.world.terrain.heightAt(-42) + 2, w: 14 };
    G.cam.snap(G.state.goal.x, G.state.goal.y, G.state.goal.w);
  });
  await cerca.waitForTimeout(320);
  await cerca.screenshot({ path: `${SALIDA}/blindado-${epoca}.png` });
  await cerca.close();
  console.log(`blindado ${epoca} listo`);
}

// ── el disparo, cuadro a cuadro ───────────────────────────────────────────
const pg = await abrir(`${URL}/?seed=frente&biome=berlin&trampas=0&suelo=avenida`);
await pg.evaluate(() => {
  const G = window.GAME;
  G.aim(46, 0.82);
  G.state.goal = { x: -40, y: G.world.terrain.heightAt(-40) + 4, w: 26 };
  G.cam.snap(G.state.goal.x, G.state.goal.y, G.state.goal.w);
  // La camara persigue al proyectil y se lleva la boca fuera de cuadro en dos
  // cuadros. Para fotografiar el fogonazo hay que clavarla.
  G.cam.followTo = () => {};
  G.cam.tweenTo = () => {};
});
await pg.waitForTimeout(250);
await pg.screenshot({ path: `${SALIDA}/disparo-0-antes.png` });

await pg.evaluate(() => window.GAME.fire());
for (const ms of [40, 80, 280]) {
  await pg.waitForTimeout(ms === 40 ? 40 : ms - 40);
  await pg.screenshot({ path: `${SALIDA}/disparo-${ms}ms.png` });
}

// ── el impacto ────────────────────────────────────────────────────────────
// Con `advanceTime` no vale: los efectos van con el reloj de pared a proposito,
// asi que avanzar la simulacion a mano se salta el fogonazo, el humo y la
// sacudida enteros. Hay que dejar pasar el tiempo de verdad.
await pg.waitForFunction(() => window.GAME.state.phase !== 'flying', null, { timeout: 15000 });
await pg.screenshot({ path: `${SALIDA}/impacto-1.png` });
await pg.waitForTimeout(220);
await pg.screenshot({ path: `${SALIDA}/impacto-2.png` });

console.log(`\nerrores de consola: ${errores.length ? errores.join('\n  ') : 'ninguno'}`);
await nav.close();
process.exit(errores.length ? 1 : 0);
