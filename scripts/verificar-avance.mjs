import { chromium } from 'playwright';

/**
 * Avanzar el blindado, en el juego de verdad.
 *
 * Lo que se busca no es que el tanque se mueva —eso ya lo dice el test puro—
 * sino las tres cosas que solo pasan con el juego montado:
 *
 *  1. Que la boca del cañon se vaya con el vehiculo, o sea que el disparo salga
 *     del sitio nuevo. Si el avance moviera la malla pero no el origen del
 *     tiro, el jugador veria su tanque en un sitio y sus obuses saliendo de
 *     otro.
 *  2. Que el deposito se gaste y se reponga por turnos.
 *  3. Que un muro de arena encierre de verdad. Es la razon de ser de todo esto:
 *     con Sotavento, amontonar arena delante del rival deja de ser relieve y
 *     pasa a ser una carcel.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const NAVEGADOR = { args: ['--use-gl=angle', '--use-angle=gl-egl'] };

const nav = await chromium.launch(NAVEGADOR);
const errores = [];
const fallos = [];

const comprobar = (nombre, bien, detalle = '') => {
  console.log(`  ${bien ? 'ok  ' : 'MAL '} ${nombre}${detalle ? `  ${detalle}` : ''}`);
  if (!bien) fallos.push(nombre);
};

async function abrir(direccion) {
  const pg = await (await nav.newContext({ locale: 'es-ES', viewport: { width: 900, height: 1600 } })).newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pg.on('pageerror', (e) => errores.push(String(e)));
  await pg.goto(direccion, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => window.GAME?.world?.terrain, null, { timeout: 20000 });
  await pg.waitForTimeout(300);
  return pg;
}

// ── el vehiculo se mueve y el tiro sale de donde esta ───────────────────────
console.log('avanzar mueve el vehiculo Y la boca:');
{
  const pg = await abrir(`${URL}/?seed=avance&biome=alamein&trampas=0`);
  const r = await pg.evaluate(() => {
    const G = window.GAME;
    const antes = {
      x: G.world.cannons[0].group.position.x,
      deposito: G.combustible[0],
    };
    for (let i = 0; i < 14; i++) G.avanzar(0.45);
    const pedido = G.state.avance;
    const xPrevisto = G.world.cannons[0].group.position.x;

    G.aim(50, 0.8);
    G.fire();
    const salida = { x: G.state.shot.x, y: G.state.shot.y };
    return { antes, pedido, xPrevisto, salida, xFinal: G.state.plantel[0].x, deposito: G.combustible[0] };
  });

  comprobar('el vehiculo se ha desplazado', Math.abs(r.xFinal - r.antes.x) > 3,
    `${r.antes.x.toFixed(2)} -> ${r.xFinal.toFixed(2)}`);
  comprobar('la vista previa coincide con lo que se sella',
    Math.abs(r.xPrevisto - r.xFinal) < 1e-6);
  comprobar('el obus sale de la posicion nueva',
    Math.abs(r.salida.x - r.xFinal) < 3.2, `boca en ${r.salida.x.toFixed(2)}`);
  comprobar('ha gastado deposito', r.deposito < r.antes.deposito,
    `${r.antes.deposito.toFixed(0)} -> ${r.deposito.toFixed(0)}`);
  await pg.close();
}

// ── el deposito se repone por turnos, no de golpe ──────────────────────────
console.log('\nel deposito:');
{
  const pg = await abrir(`${URL}/?seed=avance&biome=alamein&trampas=0`);
  const r = await pg.evaluate(() => {
    const G = window.GAME;
    // Pedir mucho mas avance del que da el deposito. OJO: hasta que no se
    // dispara no se gasta nada — mover es una intencion, igual que apuntar —,
    // asi que el deposito hay que leerlo DESPUES del tiro. La primera version
    // de este guion lo leia antes y cantaba un fallo que no existia.
    for (let i = 0; i < 40; i++) G.avanzar(0.45);
    G.aim(50, 0.8);
    G.fire();
    const gastado = G.combustible[0];
    for (let i = 0; i < 2000 && G.state.phase !== 'aiming'; i++) window.advanceTime(1000 / 120);
    // Turno del rival: dispararlo tambien para volver al jugador 0.
    G.aim(50, 0.8);
    G.fire();
    for (let i = 0; i < 2000 && G.state.phase !== 'aiming'; i++) window.advanceTime(1000 / 120);
    return { gastado, repuesto: G.combustible[0], activo: G.state.active };
  });
  comprobar('se agota si se abusa', r.gastado < 20, `${r.gastado.toFixed(0)} de 100`);
  comprobar('vuelve el turno al jugador 0', r.activo === 0);
  comprobar('repone algo al volver el turno', r.repuesto > r.gastado,
    `${r.gastado.toFixed(0)} -> ${r.repuesto.toFixed(0)}`);
  comprobar('pero no llena el deposito', r.repuesto < 100, `${r.repuesto.toFixed(0)} de 100`);
  await pg.close();
}

// ── un muro de arena encierra ──────────────────────────────────────────────
console.log('\narena amontonada = carcel:');
{
  const pg = await abrir(`${URL}/?seed=avance&biome=alamein&trampas=0`);
  const r = await pg.evaluate(() => {
    const G = window.GAME;
    const t = G.world.terrain;
    const x0 = G.state.plantel[0].x;

    const puedeMoverse = () => {
      const antes = G.state.avance;
      for (let i = 0; i < 30; i++) G.avanzar(0.45);
      const conseguido = Math.abs(G.state.avance - antes) > 0.4;
      G.state.avance = 0;
      return conseguido;
    };
    const libre = puedeMoverse();

    // Dos taludes altos a los lados, como los que deja Sotavento tras varios
    // impactos seguidos en el mismo sitio.
    for (const lado of [-1, 1]) t.depositar(x0 + lado * 5, 1.5, 190);
    t.reposar();
    const preso = !puedeMoverse();

    return { libre, preso, alturaMuro: t.heightAt(x0 + 5) - t.heightAt(x0) };
  });
  comprobar('en campo abierto se mueve', r.libre);
  comprobar('entre dos taludes ya no', r.preso, `muro de ${r.alturaMuro.toFixed(1)} u`);
  await pg.close();
}

console.log(`\nerrores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);
await nav.close();

const total = fallos.length + (errores.length ? 1 : 0);
console.log(total === 0 ? '\nEL BLINDADO SE MUEVE' : `\n${total} FALLOS: ${fallos.join(', ')}`);
process.exit(total === 0 ? 0 : 1);
