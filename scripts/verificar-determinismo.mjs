import { chromium } from 'playwright';

/**
 * Determinismo de extremo a extremo, en un navegador de verdad.
 *
 * Los tests de vitest prueban la balistica aislada. Esto prueba lo que de
 * verdad importa para el online: dos pestanas con la misma semilla, conducidas
 * con los mismos inputs, tienen que producir el MISMO texto paso a paso. Si
 * esto falla, el lockstep no puede funcionar por muy bien que este la red.
 */

const URL = process.env.URL ?? 'http://localhost:5173/';
const SEMILLA = 'vostok';

/** Conduce una partida a ciegas y devuelve el rastro de estados. */
async function jugar(navegador) {
  const contexto = await navegador.newContext({ locale: 'es-ES' });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pagina.on('pageerror', (e) => errores.push(String(e)));

  await pagina.goto(`${URL}?seed=${SEMILLA}`, { waitUntil: 'networkidle' });

  const rastro = await pagina.evaluate(() => {
    const pasos = [];
    pasos.push(['inicio', window.render_game_to_text()]);

    window.GAME.aim(45, 0.8);
    pasos.push(['apuntado', window.render_game_to_text()]);

    window.GAME.fire();
    window.advanceTime(500);
    pasos.push(['medio vuelo', window.render_game_to_text()]);

    window.advanceTime(4000);
    pasos.push(['tras impacto', window.render_game_to_text()]);

    return pasos;
  });

  await contexto.close();
  return { rastro, errores };
}

const navegador = await chromium.launch();
const primera = await jugar(navegador);
const segunda = await jugar(navegador);
await navegador.close();

let fallos = 0;

for (const [etapa, texto] of primera.rastro) {
  console.log(`\n--- ${etapa} ---\n${texto}`);
}

console.log('\n========================================');

for (let i = 0; i < primera.rastro.length; i++) {
  const [etapa, a] = primera.rastro[i];
  const b = segunda.rastro[i][1];
  const igual = a === b;
  if (!igual) fallos++;
  console.log(`${igual ? 'OK ' : 'MAL'}  "${etapa}" reproducible`);
}

// El proyectil tiene que haber volado de verdad, no quedarse quieto: si
// advanceTime no avanzara nada, los cuatro estados serian identicos y las
// comparaciones de arriba pasarian igualmente.
const enVuelo = primera.rastro[2][1].includes('proyectil: x=');
const impacto = !primera.rastro[3][1].includes('fase: flying');
if (!enVuelo) { fallos++; console.log('MAL  advanceTime no puso el proyectil en vuelo'); }
else console.log('OK   advanceTime avanzo la simulacion de verdad');
if (!impacto) { fallos++; console.log('MAL  el vuelo no termino tras 4 s simulados'); }
else console.log('OK   el vuelo termino dentro del tiempo simulado');

const errores = [...primera.errores, ...segunda.errores];
if (errores.length) { fallos++; console.log(`MAL  errores de consola: ${errores.join(' ; ')}`); }
else console.log('OK   consola limpia');

console.log(fallos === 0 ? '\nTODO CORRECTO' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
