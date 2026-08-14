import { chromium } from 'playwright';

/**
 * Dos navegadores jugando la misma partida.
 *
 * Lo que se comprueba es lo unico que importa del online: que tras varios
 * turnos los dos moviles tengan EL MISMO terreno y las MISMAS vidas, habiendo
 * disparado cada uno desde su pantalla.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch();
const errores = [];

async function abrir(nombre) {
  const ctx = await nav.newContext({ locale: 'es-ES' });
  const pg = await ctx.newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(`[${nombre}] ${m.text()}`));
  pg.on('pageerror', (e) => errores.push(`[${nombre}] ${e}`));
  await pg.goto(`${URL}/?online`, { waitUntil: 'networkidle' });
  return pg;
}

const estado = (pg) =>
  pg.evaluate(() => {
    const G = window.GAME;
    let masa = 0;
    const t = G.world.terrain;
    for (const h of t.heights) masa += (h - t.floorY) * t.dx;
    return {
      activo: G.state.active,
      fase: G.state.phase,
      vidas: G.state.players.map((p) => Math.round(p.hp * 1000) / 1000),
      masa: Math.round(masa * 1000) / 1000,
      // Muestreo del perfil: si dos moviles divergen, aqui se ve.
      perfil: Array.from({ length: 24 }, (_, i) =>
        Math.round(t.heights[Math.floor((i * t.cols) / 24)] * 1000) / 1000
      ),
      meToca: G.sincronia.meToca(),
      ronda: G.sincronia.estado.partida?.ronda ?? null,
      tardios: G.sincronia.tardios.length,
    };
  });

const ana = await abrir('Ana');
await ana.fill('#s-nombre', 'Ana');
await ana.click('#s-crear');
await esperar(700);
const codigo = await ana.textContent('#s-codigo');

const bea = await abrir('Bea');
await bea.fill('#s-nombre', 'Bea');
await bea.fill('#s-codigo-input', codigo);
await bea.click('#s-unir');
await esperar(800);

await ana.click('#s-listo');
await bea.click('#s-listo');
await esperar(1200);

console.log(`sala ${codigo}, partida en marcha\n`);

// Cuatro turnos: dispara siempre quien tiene el turno, desde SU pantalla.
for (let turno = 0; turno < 4; turno++) {
  const eA = await estado(ana);
  const quien = eA.meToca ? ana : bea;
  const nombre = eA.meToca ? 'Ana' : 'Bea';

  await quien.evaluate(
    ([angulo, potencia]) => {
      window.GAME.aim(angulo, potencia);
      window.GAME.fire();
    },
    [38 + turno * 4, 0.66 + turno * 0.04]
  );

  // Se deja correr el vuelo y la pluma en los dos.
  for (const pg of [ana, bea]) await pg.evaluate(() => window.advanceTime(6000));
  await esperar(500);

  const a = await estado(ana);
  const b = await estado(bea);
  const iguales = JSON.stringify(a.perfil) === JSON.stringify(b.perfil) && a.masa === b.masa;
  console.log(
    `turno ${turno + 1}: dispara ${nombre}  ->  vidas A[${a.vidas}] B[${b.vidas}]  masa ${a.masa}/${b.masa}  ${iguales ? 'IGUAL' : 'DISTINTO'}`
  );
}

const finA = await estado(ana);
const finB = await estado(bea);

console.log(`\nronda:   ${finA.ronda} / ${finB.ronda}`);
console.log(`vidas:   ${JSON.stringify(finA.vidas)} / ${JSON.stringify(finB.vidas)}`);
console.log(`masa:    ${finA.masa} / ${finB.masa}`);
console.log(`perfil identico: ${JSON.stringify(finA.perfil) === JSON.stringify(finB.perfil)}`);
console.log(`reacciones tardias: ${finA.tardios + finB.tardios}`);
console.log(`errores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos =
  (JSON.stringify(finA.perfil) !== JSON.stringify(finB.perfil) ? 1 : 0) +
  (JSON.stringify(finA.vidas) !== JSON.stringify(finB.vidas) ? 1 : 0) +
  (finA.masa !== finB.masa ? 1 : 0) +
  (finA.ronda !== finB.ronda ? 1 : 0) +
  (errores.length ? 1 : 0);

console.log(fallos === 0 ? '\nLOS DOS JUEGAN LA MISMA PARTIDA' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
