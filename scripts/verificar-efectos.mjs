import { chromium } from 'playwright';

/**
 * Los efectos, en el juego de verdad.
 *
 * Tres cosas que no se pueden comprobar leyendo el codigo:
 *
 *  1. Que el tubo retrocede y VUELVE. Un retroceso que no vuelve deja el canon
 *     torcido para el resto del combate y nadie lo nota hasta la tercera
 *     partida.
 *  2. Que la sacudida es proporcional al daño. Si un roce sacude igual que un
 *     impacto directo, la sacudida no cuenta nada.
 *  3. Que la decoracion sale del PRNG con semilla. Es lo que hace que una
 *     repeticion se vea igual y no solo dé el mismo resultado.
 *
 * Y una que si se puede leer pero conviene medir: que nada de esto toca la
 * simulacion.
 */

const URL = process.env.URL ?? 'http://localhost:5173';

// Un Chromium sin escritorio y sin GL pinta por software y limita rAF a 6
// cuadros por segundo. Con eso no se puede medir ni un efecto ni la fluidez:
// el primer cuadro despues del impacto llega con 250 ms encima y la sacudida
// ya se ha apagado sola. Esto no es un truco para que salgan mejor los
// numeros; es la diferencia entre medir el juego y medir el limitador.
//
// OJO con `--disable-frame-rate-limit`: parece lo que uno quiere y es
// exactamente lo contrario. Medido, con esa bandera la pagina entera se
// estrangula —dos muestras de `setTimeout` en medio segundo, el tubo del canon
// congelado a media carrera— porque sin freno el compositor deja de programar
// trabajo. Sin ella: 56 muestras en el mismo medio segundo. No la pongas.
const NAVEGADOR = {
  args: ['--use-gl=angle', '--use-angle=gl-egl', '--disable-gpu-vsync'],
};

const nav = await chromium.launch(NAVEGADOR);
const errores = [];
const fallos = [];

async function abrir(direccion, opciones = {}) {
  const ctx = await nav.newContext({ locale: 'es-ES', viewport: { width: 900, height: 1600 }, ...opciones });
  const pg = await ctx.newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pg.on('pageerror', (e) => errores.push(String(e)));
  await pg.goto(direccion, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => window.GAME?.world?.terrain, null, { timeout: 20000 });
  await pg.waitForTimeout(300);
  return pg;
}

const comprobar = (nombre, bien, detalle = '') => {
  console.log(`  ${bien ? 'ok  ' : 'MAL '} ${nombre}${detalle ? `  ${detalle}` : ''}`);
  if (!bien) fallos.push(nombre);
};

/**
 * Muestreo con reloj propio y bomba de cuadros.
 *
 * Dos cosas medidas a base de que salieran mal:
 *
 *  - Un Chromium sin escritorio solo produce un cuadro si algo lo pide. Sin la
 *    BOMBA —un rAF vacio que no hace nada— el bucle del juego se para en seco
 *    despues del disparo y el tubo se queda hundido a media carrera para
 *    siempre. No es un fallo del juego: en un movil de verdad la pantalla
 *    refresca sola.
 *  - Muestrear con rAF tampoco vale: el bucle de medida y el del juego se
 *    reparten los pocos cuadros que hay y en 900 ms llegan cuatro pasos de
 *    simulacion. Por eso el reloj de muestreo va con `setTimeout`, aparte.
 */
const MUESTREADOR = `
  async function muestrear(cadaMs, duranteMs, leer) {
    let bombeando = true;
    const bomba = () => { if (bombeando) requestAnimationFrame(bomba); };
    requestAnimationFrame(bomba);

    const salida = [];
    await new Promise((listo) => {
      const t0 = performance.now();
      const tic = () => {
        salida.push(leer());
        if (performance.now() - t0 >= duranteMs) { bombeando = false; return listo(); }
        setTimeout(tic, cadaMs);
      };
      tic();
    });
    return salida;
  }
`;

// ── retroceso ──────────────────────────────────────────────────────────────
console.log('retroceso del tubo:');
{
  const pg = await abrir(`${URL}/?seed=efectos&biome=alamein&trampas=0`);
  // Toda la espera va DENTRO de la pagina. Esperar desde fuera con
  // `waitForTimeout` daba el tubo congelado a media carrera: sin nada que
  // hacer, el navegador deja de dar cuadros y el retroceso se queda a medias.
  // El codigo estaba bien; el que medía mal era esto.
  const t = await pg.evaluate(async (fuente) => {
    eval(fuente);
    const canon = window.GAME.world.cannons[0];
    window.GAME.aim(46, 0.8);
    window.GAME.fire();
    const xs = await muestrear(6, 700, () => canon.tubo.position.x);
    return { min: Math.min(...xs), max: Math.max(...xs), reposo: canon.tubo.position.x };
  }, MUESTREADOR);
  comprobar('se hunde hacia atras', t.min < -0.2, `min ${t.min.toFixed(3)}`);
  // easeOutBack se pasa un 10% del recorrido en su pico: sobre 0,35 unidades
  // son 0,035, que al encuadre de apuntado es algo mas de un pixel. Se ve, y
  // es lo que hace que el tubo no frene en seco sino que se asiente.
  comprobar('el tubo se pasa al volver', t.max > 0.02, `max ${t.max.toFixed(4)} u`);
  comprobar('acaba en su sitio', Math.abs(t.reposo) < 1e-9, `reposo ${t.reposo}`);
  await pg.close();
}

// ── sacudida proporcional al daño ──────────────────────────────────────────
console.log('\nsacudida segun el daño:');
{
  const pg = await abrir(`${URL}/?seed=efectos&biome=alamein&trampas=0`);

  /** Sacude a mano con un daño dado y devuelve la amplitud maxima medida. */
  const sacudidaCon = (daño) =>
    pg.evaluate(async ([d, fuente]) => {
      eval(fuente);
      const G = window.GAME;
      G.efectos.impacto({ x: 0, y: G.world.terrain.heightAt(0), radio: 2.6, daño: d });
      const picos = await muestrear(5, 320, () =>
        Math.max(Math.abs(G.cam.shakeX), Math.abs(G.cam.shakeY)),
      );
      return Math.max(...picos);
    }, [daño, MUESTREADOR]);

  const roce = await sacudidaCon(3);
  const directo = await sacudidaCon(46);
  comprobar('un roce sacude poco', roce > 0 && roce < 0.3, `${roce.toFixed(3)} u`);
  comprobar('un impacto directo sacude mucho', directo > roce * 2, `${directo.toFixed(3)} u`);
  comprobar('se apaga sola', (await pg.evaluate(() => Math.abs(window.GAME.cam.shakeX))) < 1e-6);
  await pg.close();
}

// ── prefers-reduced-motion ─────────────────────────────────────────────────
console.log('\nmovimiento reducido:');
{
  const pg = await abrir(`${URL}/?seed=efectos&biome=alamein&trampas=0`, {
    reducedMotion: 'reduce',
  });
  const max = await pg.evaluate(async (fuente) => {
    eval(fuente);
    const G = window.GAME;
    G.efectos.impacto({ x: 0, y: G.world.terrain.heightAt(0), radio: 2.6, daño: 46 });
    const picos = await muestrear(5, 300, () =>
      Math.max(Math.abs(G.cam.shakeX), Math.abs(G.cam.shakeY)),
    );
    return Math.max(...picos);
  }, MUESTREADOR);
  comprobar('con reduced-motion no sacude', max === 0, `${max}`);
  comprobar(
    'pero el resto de efectos sigue',
    (await pg.evaluate(() => window.GAME.efectos.vivas)) > 0,
  );
  await pg.close();
}

// ── la decoracion sale de la semilla ───────────────────────────────────────
console.log('\nmisma semilla, misma decoracion:');
{
  const huella = async () => {
    const pg = await abrir(`${URL}/?seed=repetible&biome=alamein&trampas=0`);
    const h = await pg.evaluate(() => {
      const G = window.GAME;
      G.aim(46, 0.8);
      G.fire();
      // El humo se emite en el disparo, antes de que corra ningun cuadro: se
      // puede leer sin depender de la velocidad de la maquina.
      const puntos = [];
      G.scene.traverse((o) => {
        if (o.isPoints && o.material.uniforms) {
          const p = o.geometry.attributes.position.array;
          for (let i = 0; i < 30; i++) puntos.push(p[i].toFixed(6));
        }
      });
      return puntos.join(',');
    });
    await pg.close();
    return h;
  };
  const a = await huella();
  const b = await huella();
  comprobar('el humo cae en el mismo sitio', a === b && a.length > 20);
}

// ── nada de esto toca la simulacion ────────────────────────────────────────
console.log('\nla decoracion no toca la simulacion:');
{
  const jugar = async (movimientoReducido) => {
    const pg = await abrir(`${URL}/?seed=puro&biome=alamein&trampas=0.6`, {
      reducedMotion: movimientoReducido ? 'reduce' : 'no-preference',
    });
    const texto = await pg.evaluate(() => {
      const G = window.GAME;
      G.aim(44, 0.78);
      G.fire();
      for (let i = 0; i < 1200 && G.state.phase === 'flying'; i++) window.advanceTime(1000 / 120);
      return window.render_game_to_text();
    });
    await pg.close();
    return texto;
  };
  const con = await jugar(false);
  const sin = await jugar(true);
  comprobar('apagar la sacudida no cambia el combate', con === sin);
}

console.log(`\nerrores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);
await nav.close();

const total = fallos.length + (errores.length ? 1 : 0);
console.log(total === 0 ? '\nLOS EFECTOS ESTAN VIVOS' : `\n${total} FALLOS: ${fallos.join(', ')}`);
process.exit(total === 0 ? 0 : 1);
