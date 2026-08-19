import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { crearPozo, consultarCon } from '../server/db/conexion.js';

/**
 * Cuentas y tienda, en un navegador de verdad.
 *
 * Los tests de vitest prueban la logica y `verificar:bd` prueba el SQL. Esto
 * prueba lo unico que queda: que las pantallas hacen lo que dicen — que la de
 * acceso aparece solo si el servidor tiene cuentas, que elegir un camuflaje
 * cambia el color del casco EN LA ESCENA, y que al terminar un combate la
 * partida acaba en la base de datos.
 *
 * Hacen falta las dos cosas levantadas:
 *   pnpm dev
 *   DATABASE_URL=... pnpm server
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const URL_BD = process.env.DATABASE_URL;

const fallos = [];
const comprobar = (que, bien, detalle = '') => {
  console.log(`  ${bien ? 'OK  ' : 'MAL '} ${que}${detalle ? `  ${detalle}` : ''}`);
  if (!bien) fallos.push(que);
};

const marca = randomUUID().slice(0, 8);
const correo = `pantalla-${marca}@artilleria.test`;

const nav = await chromium.launch();
const ctx = await nav.newContext({ locale: 'es-ES', viewport: { width: 540, height: 960 } });
const pg = await ctx.newPage();
const errores = [];
pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
pg.on('pageerror', (e) => errores.push(String(e)));

try {
  console.log('\nacceso');
  await pg.goto(`${URL}/?seed=cuenta&biome=berlin`, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => window.GAME?.world?.terrain, null, { timeout: 10000 });

  // El juego arranca DEBAJO de la pantalla de acceso: si el servidor tarda o no
  // contesta, lo que hay detras es una partida y no un vacio.
  comprobar('el juego arranca aunque no haya sesion',
    await pg.evaluate(() => window.GAME.world.cannons.length === 2));

  await pg.waitForSelector('#acceso.on', { timeout: 8000 });
  comprobar('la pantalla de acceso aparece con el servidor de cuentas', true);

  await pg.fill('#ac-correo', correo);
  await pg.fill('#ac-clave', 'corta');
  await pg.click('#ac-enviar');
  comprobar('una clave corta se para en el cliente',
    (await pg.textContent('#ac-aviso')).includes('8 caracteres'));

  await pg.click('#ac-cambiar');
  await pg.fill('#ac-nombre', `Prueba ${marca.slice(0, 4)}`);
  await pg.fill('#ac-clave', 'doceletrasbuenas');
  await pg.click('#ac-enviar');
  // `state:'hidden'` y no `:not(.on)`: sin la clase el panel es `display:none`,
  // asi que «visible» no se cumple nunca y la espera caduca con todo correcto.
  await pg.waitForSelector('#acceso.on', { state: 'hidden', timeout: 10000 });
  comprobar('registrarse cierra la pantalla y entra', true);

  const dentro = await pg.evaluate(() => window.GAME.cuenta.estado.jugador?.camuflajes);
  comprobar('llega con los dos camuflajes de serie',
    dentro?.a === 'a-oliva' && dentro?.b === 'b-acero', JSON.stringify(dentro));

  console.log('\ntienda');
  const antes = await pg.evaluate(() => window.GAME.state.plantel[0].chassis.color);
  await pg.evaluate(() => window.GAME.tienda.abrir());
  await pg.waitForSelector('#tienda.on .camu', { timeout: 8000 });
  const tarjetas = await pg.locator('#tienda .camu').count();
  comprobar('la tienda pinta el catalogo entero', tarjetas === 8, `${tarjetas} camuflajes`);

  const bloqueados = await pg.locator('#tienda .camu button.flojo').count();
  comprobar('lo que no tienes no se puede comprar todavia', bloqueados === 6, `${bloqueados} bloqueados`);

  const vitrina = await pg.locator('#t-vitrina div').count();
  comprobar('la vitrina sale aunque este a cero', vitrina === 4);

  // Se regala uno por la puerta de atras para poder probar el cambio de color:
  // el pago todavia no existe, y esta prueba va del COLOR, no de la caja.
  if (URL_BD) {
    const pozo = crearPozo(URL_BD);
    const consultar = consultarCon(pozo);
    await consultar(
      `INSERT INTO desbloqueo (jugador_id, camuflaje_id, origen)
       SELECT id, 'a-bosque', 'regalo' FROM jugador WHERE correo = $1
       ON CONFLICT DO NOTHING`, [correo],
    );
    await pozo.end();

    await pg.evaluate(() => window.GAME.tienda.abrir());
    // Se espera a que la tarjeta cambie de «Proximamente» a «Usar»: `abrir()`
    // vuelve a preguntar al servidor, y pulsar antes de que conteste es pulsar
    // el boton de la pintura anterior.
    const tarjeta = pg.locator('#t-lista-a .camu', { hasText: 'Verde bosque' });
    await tarjeta.getByRole('button', { name: 'Usar' }).click({ timeout: 8000 });

    // Se espera a la CONDICION y no a un numero de milisegundos: elegir
    // camuflaje rehace la partida entera —terreno, decorado y los dos
    // vehiculos— y con una espera fija esto pasaba o fallaba segun lo cargada
    // que estuviera la maquina. Un test que depende del reloj no prueba nada.
    await pg.waitForFunction(
      (base) => window.GAME.state.plantel[0].chassis.color !== base,
      antes, { timeout: 8000 },
    );
    const ahora = await pg.evaluate(() => window.GAME.state.plantel[0].chassis.color);
    comprobar('elegir un camuflaje cambia el casco EN LA ESCENA', ahora !== antes,
      `0x${antes.toString(16)} → 0x${ahora.toString(16)}`);
    comprobar('y es el color del catalogo, no otro', ahora === 0x577543);
  }

  console.log('\npartida');
  await pg.evaluate(() => window.GAME.tienda.cerrar());
  // Un combate de verdad seria lento y azaroso: se fuerza el final, que es lo
  // que dispara el guardado.
  await pg.evaluate(() => {
    const G = window.GAME;
    G.state.historia.push({ anguloDeg: 45, potencia: 0.7 });
    G.state.shots[0] = 1;
    G.state.aciertos[0] = 1;
    G.state.daño[0] = 46;
    G.state.mejorImpacto[0] = 46;
    G.state.players[1].hp = 0;
    G.state.partida.participantes[1].vivo = false;
    window.GAME.declararVictoriaDePrueba?.() ?? G.state;
  });
  // El guardado va por `declareVictory`, y esa no esta expuesta: se llama por el
  // camino normal, disparando hasta que alguien cae.
  await pg.evaluate(() => window.GAME.state.players[1].hp = 0);
  await pg.evaluate(() => {
    const G = window.GAME;
    G.cuenta.guardarPartida({
      semilla: G.config.seed,
      teatro: G.biome.id,
      suelo: G.world.terrain.composicion,
      repeticion: `${G.config.seed}~ci-jg`,
      turnos: 1,
      ganador: 'a',
      participantes: [{ yo: true, bando: 'a', nombre: 'Prueba', disparos: 1, aciertos: 1, dano: 46, mejorImpacto: 46 }],
    });
  });
  await pg.waitForTimeout(700);

  if (URL_BD) {
    const pozo = crearPozo(URL_BD);
    const consultar = consultarCon(pozo);
    const [p] = await consultar(
      `SELECT pr.partidas, pr.ganadas, pr.dano FROM progreso pr
       JOIN jugador j ON j.id = pr.jugador_id WHERE j.correo = $1`, [correo]);
    comprobar('la partida llega a la base de datos y suma en la vitrina',
      p?.partidas === 1 && p?.ganadas === 1 && Number(p?.dano) === 46,
      JSON.stringify(p));
    await consultar('DELETE FROM jugador WHERE correo = $1', [correo]);
    await pozo.end();
  }

  console.log('\nconsola');
  comprobar('sin errores', errores.length === 0, errores.join(' | '));
} catch (error) {
  console.error('\nreventó:', error.message);
  fallos.push(error.message);
} finally {
  await nav.close();
}

console.log(fallos.length ? `\n${fallos.length} COMPROBACIONES FALLIDAS` : '\nLAS PANTALLAS HACEN LO QUE DICEN');
process.exit(fallos.length ? 1 : 0);
