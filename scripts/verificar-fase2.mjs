import { chromium } from 'playwright';

/**
 * La franja y el vernier, en un navegador de verdad.
 *
 * Un test unitario dice que las funciones son correctas; esto dice que la
 * franja tiene pixeles pintados y que el vernier de verdad afina el alcance
 * cuando el dedo se mueve cerca del tiro anterior.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch();
const ctx = await nav.newContext({ locale: 'es-ES', viewport: { width: 420, height: 1200 } });
const pg = await ctx.newPage();
const errores = [];
pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
pg.on('pageerror', (e) => errores.push(String(e)));

await pg.goto(`${URL}/?seed=vostok`, { waitUntil: 'networkidle' });
await esperar(400);

// ── la franja se pinta ──────────────────────────────────────────────────
const franja = await pg.evaluate(() => {
  const c = document.getElementById('franja');
  const ctx = c.getContext('2d');
  const datos = ctx.getImageData(0, 0, c.width, c.height).data;
  let pintados = 0;
  for (let i = 3; i < datos.length; i += 4) if (datos[i] > 0) pintados++;
  return { ancho: c.width, alto: c.height, pintados, total: datos.length / 4 };
});
console.log(`franja: ${franja.ancho}x${franja.alto}px, ${((franja.pintados / franja.total) * 100).toFixed(1)} % de pixeles pintados`);

// ── el vernier afina ────────────────────────────────────────────────────
// Se dispara una vez para dejar muesca, y despues se compara cuanto cambia el
// alcance previsto al mover el dedo la misma distancia cerca y lejos de ella.
const vernier = await pg.evaluate(async () => {
  const G = window.GAME;
  const escenario = document.getElementById('stage');
  const caja = escenario.getBoundingClientRect();
  const cx = caja.left + caja.width / 2;
  const cy = caja.top + caja.height / 2;

  const arrastrar = (dx, dy) => {
    const abajo = new PointerEvent('pointerdown', { pointerId: 1, clientX: cx, clientY: cy, bubbles: true });
    escenario.dispatchEvent(abajo);
    const mover = new PointerEvent('pointermove', { pointerId: 1, clientX: cx + dx, clientY: cy + dy, bubbles: true });
    escenario.dispatchEvent(mover);
    const potencia = G.state.aim[G.state.active].power;
    const arriba = new PointerEvent('pointerup', { pointerId: 1, clientX: cx + dx, clientY: cy + dy, bubbles: true });
    escenario.dispatchEvent(arriba);
    return potencia;
  };

  // Primer disparo: deja la muesca en (-30, 0). Las distancias se eligen para
  // no llegar al tope de potencia: con 1200 px de alto el arrastre util son
  // ~150 px, y midiendo contra el tope todo daria cero.
  arrastrar(-30, 0);
  await new Promise((r) => setTimeout(r, 50));
  window.advanceTime(7000);
  await new Promise((r) => setTimeout(r, 50));

  const medir = (dx, dy) => {
    const escenario = document.getElementById('stage');
    escenario.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: cx, clientY: cy, bubbles: true }));
    escenario.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: cx + dx, clientY: cy + dy, bubbles: true }));
    const p = G.state.aim[G.state.active].power;
    escenario.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 2, clientX: cx + dx, clientY: cy + dy, bubbles: true }));
    return p;
  };

  // Cerca de la muesca: 10 px de diferencia, dentro del radio del vernier.
  const cercaA = medir(-30, 0);
  const cercaB = medir(-40, 0);
  // Lejos: los mismos 10 px, ya fuera del radio.
  const lejosA = medir(-100, 0);
  const lejosB = medir(-110, 0);

  return {
    cambioCerca: Math.abs(cercaB - cercaA),
    cambioLejos: Math.abs(lejosB - lejosA),
  };
});

const razon = vernier.cambioLejos / (vernier.cambioCerca || 1e-9);
console.log(`vernier: 10 px cerca de la muesca cambian la potencia ${vernier.cambioCerca.toFixed(5)}`);
console.log(`         10 px lejos                               ${vernier.cambioLejos.toFixed(5)}`);
console.log(`         relacion: ${razon.toFixed(2)}x  (se espera ~4)`);
console.log(`errores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos =
  (franja.pintados < franja.total * 0.05 ? 1 : 0) +
  (razon < 3 || razon > 5.5 ? 1 : 0) +
  (errores.length ? 1 : 0);

console.log(fallos === 0 ? '\nFRANJA Y VERNIER CORRECTOS' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
