import { chromium } from 'playwright';

/**
 * Se juega un combate, se copia el enlace y se reproduce en otra pestaña.
 *
 * Lo que se exige es lo unico que hace util un replay: que el terreno, las
 * vidas y los crateres queden EXACTAMENTE igual. Si divergieran, el enlace
 * contaria una partida parecida en vez de la que paso.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch();
const errores = [];

async function abrir(direccion, etiqueta) {
  const pg = await (await nav.newContext({ locale: 'es-ES' })).newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(`[${etiqueta}] ${m.text()}`));
  pg.on('pageerror', (e) => errores.push(`[${etiqueta}] ${e}`));
  await pg.goto(direccion, { waitUntil: 'networkidle' });
  return pg;
}

const huella = (pg) =>
  pg.evaluate(() => {
    const G = window.GAME;
    const t = G.world.terrain;
    let masa = 0;
    for (const h of t.heights) masa += (h - t.floorY) * t.dx;
    return {
      vidas: G.state.players.map((p) => Math.round(p.hp * 1000) / 1000),
      masa: Math.round(masa * 1000) / 1000,
      perfil: Array.from({ length: 32 }, (_, i) =>
        Math.round(t.heights[Math.floor((i * t.cols) / 32)] * 1000) / 1000
      ),
      disparos: [...G.state.shots],
      historia: G.state.historia.length,
    };
  });

// ── se juega un combate a mano ─────────────────────────────────────────────
const original = await abrir(`${URL}/?seed=recuerdo`, 'original');
await esperar(400);

const TIROS = [
  [44, 0.72],
  [38, 0.66],
  [52, 0.8],
  [30, 0.61],
];

for (const [angulo, potencia] of TIROS) {
  await original.evaluate(
    ([a, p]) => {
      window.GAME.aim(a, p);
      window.GAME.fire();
    },
    [angulo, potencia]
  );
  await original.evaluate(() => window.advanceTime(8000));
  await esperar(120);
}

const antes = await huella(original);
const enlace = await original.evaluate(() => window.GAME.enlaceDeRepeticion());
console.log(`combate jugado: ${antes.disparos.join(' / ')} disparos, ${antes.historia} turnos guardados`);
console.log(`enlace: ${enlace.length} caracteres`);
console.log(`  ${enlace.slice(0, 110)}${enlace.length > 110 ? '…' : ''}`);

// ── se reproduce en otra pestaña ───────────────────────────────────────────
const copia = await abrir(enlace, 'copia');
// La reproduccion va tiro a tiro y espera a que cada uno acabe.
for (let i = 0; i < 40; i++) {
  await copia.evaluate(() => window.advanceTime(1000));
  await esperar(120);
  const h = await huella(copia);
  if (h.disparos[0] + h.disparos[1] >= TIROS.length) break;
}
await esperar(600);
await copia.evaluate(() => window.advanceTime(9000));
await esperar(300);

const despues = await huella(copia);

console.log(`\noriginal: ${antes.disparos.join('/')} disparos  masa ${antes.masa}  vidas ${antes.vidas.join('/')}`);
console.log(`copia:    ${despues.disparos.join('/')} disparos  masa ${despues.masa}  vidas ${despues.vidas.join('/')}`);
console.log(`perfil identico: ${JSON.stringify(antes.perfil) === JSON.stringify(despues.perfil)}`);
console.log(`errores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos =
  (antes.historia !== TIROS.length ? 1 : 0) +
  (JSON.stringify(antes.perfil) !== JSON.stringify(despues.perfil) ? 1 : 0) +
  (antes.masa !== despues.masa ? 1 : 0) +
  (JSON.stringify(antes.vidas) !== JSON.stringify(despues.vidas) ? 1 : 0) +
  (errores.length ? 1 : 0);

console.log(fallos === 0 ? '\nEL REPLAY REPRODUCE EL COMBATE' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
