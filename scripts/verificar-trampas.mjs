import { chromium } from 'playwright';

/**
 * Las trampas, en el juego de verdad.
 *
 * Lo que se busca no es que existan: es el momento en que un deflector devuelve
 * el tiro y el que disparo se come su propia metralla. Si eso no pasa, la
 * trampa es decorado.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch();
const errores = [];

async function abrir(direccion) {
  const pg = await (await nav.newContext({ locale: 'es-ES' })).newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pg.on('pageerror', (e) => errores.push(String(e)));
  await pg.goto(direccion, { waitUntil: 'networkidle' });
  await esperar(350);
  return pg;
}

// ── se siembran segun la complejidad ───────────────────────────────────────
console.log('trampas segun complejidad:');
for (const nivel of [0, 0.34, 0.67, 1]) {
  const pg = await abrir(`${URL}/?seed=campo&trampas=${nivel}`);
  const info = await pg.evaluate(() => ({
    cuantas: window.GAME.world.trampas.length,
    tipos: window.GAME.world.trampas.map((t) => t.datos.tipo),
    xs: window.GAME.world.trampas.map((t) => Math.round(t.datos.x)),
  }));
  console.log(`  ${String(nivel).padEnd(5)} -> ${info.cuantas} trampas  ${info.tipos.join(', ') || '(ninguna)'}`);
  if (nivel === 1) console.log(`          posiciones x: ${info.xs.join(', ')}`);
  await pg.close();
}

// ── la misma semilla siembra el mismo campo ────────────────────────────────
const uno = await abrir(`${URL}/?seed=repetible&trampas=1`);
const dos = await abrir(`${URL}/?seed=repetible&trampas=1`);
const huella = (pg) =>
  pg.evaluate(() =>
    window.GAME.world.trampas.map((t) => `${t.datos.tipo}@${t.datos.x.toFixed(3)},${t.datos.y.toFixed(3)}`).join('|')
  );
const iguales = (await huella(uno)) === (await huella(dos));
console.log(`\nmisma semilla, mismo campo: ${iguales}`);
await uno.close();
await dos.close();

// ── el deflector devuelve el tiro y hace autodaño ──────────────────────────
const pg = await abrir(`${URL}/?seed=rebote&trampas=0`);

const resultado = await pg.evaluate(() => {
  const G = window.GAME;

  /** Tira una vez con un deflector puesto sobre la propia trayectoria. */
  function tirarContraDeflector(anguloDeg, potencia) {
    G.reseed('rebote');
    G.world.trampas.length = 0;

    // Trayectoria libre, para saber por donde pasa el tiro.
    G.aim(anguloDeg, potencia);
    G.fire();
    const camino = [];
    for (let i = 0; i < 600 && G.state.phase === 'flying'; i++) {
      camino.push([G.state.shot.x, G.state.shot.y]);
      window.advanceTime(1000 / 120);
    }
    window.advanceTime(9000);
    if (camino.length < 20) return null;

    const medio = camino[Math.floor(camino.length * 0.45)];

    // Ahora el mismo tiro, con un deflector justo ahi.
    G.reseed('rebote');
    G.world.trampas.length = 0;
    G.world.trampas.push({
      datos: { id: 'x', tipo: 'deflector', x: medio[0], y: medio[1], radio: 2.4, viva: true },
      grupo: { visible: true },
      material: {},
    });

    const tirador = G.state.active;
    const vidaAntes = G.state.players[tirador].hp;
    G.aim(anguloDeg, potencia);
    G.fire();

    let maxX = -Infinity;
    let volvioHasta = Infinity;
    for (let i = 0; i < 1200 && G.state.phase === 'flying'; i++) {
      maxX = Math.max(maxX, G.state.shot.x);
      if (G.state.shot.x < maxX) volvioHasta = Math.min(volvioHasta, G.state.shot.x);
      window.advanceTime(1000 / 120);
    }
    window.advanceTime(9000);

    return {
      anguloDeg,
      potencia,
      deflectorEn: medio,
      llegoHasta: maxX,
      volvioHasta,
      perdio: Math.round((vidaAntes - G.state.players[tirador].hp) * 10) / 10,
    };
  }

  const tiros = [];
  for (const [a, p] of [[42, 0.86], [38, 0.7], [52, 0.78], [30, 0.62], [60, 0.9], [46, 0.66]]) {
    const r = tirarContraDeflector(a, p);
    if (r) tiros.push(r);
  }
  return tiros;
});

console.log('\nrebotes contra un deflector puesto sobre la trayectoria:');
for (const t of resultado) {
  console.log(
    `  ${String(t.anguloDeg).padStart(2)}deg p=${t.potencia}  avanza a ${t.llegoHasta.toFixed(1)}  ` +
      `vuelve a ${Number.isFinite(t.volvioHasta) ? t.volvioHasta.toFixed(1) : '—'}  ` +
      `autodaño ${t.perdio}`
  );
}

const volvieron = resultado.filter((t) => Number.isFinite(t.volvioHasta) && t.volvioHasta < t.llegoHasta - 5).length;
const castigaron = resultado.filter((t) => t.perdio > 0).length;
console.log(`\nvolvieron: ${volvieron} de ${resultado.length}   con autodaño: ${castigaron} de ${resultado.length}`);
console.log(`errores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos = (iguales ? 0 : 1) + (volvieron === 0 ? 1 : 0) + (castigaron === 0 ? 1 : 0) + (errores.length ? 1 : 0);
console.log(fallos === 0 ? '\nLAS TRAMPAS MUERDEN' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
