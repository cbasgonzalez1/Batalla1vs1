import { chromium } from 'playwright';

/**
 * Cuanto tarda un cuadro, en el momento mas caro que tiene el juego.
 *
 * El encargo era que fuera tan fluido como los dos juegos de referencia, y eso
 * no se comprueba mirando el codigo. El momento caro no es el vuelo: es la
 * pluma, cuando cada tanda de arena reconstruye un trozo de malla, y el turno
 * del alud, que da hasta 288 pasadas de reposo de golpe.
 *
 * Se mide el reparto de tiempos de cuadro, no la media: una media de 14 ms con
 * un tiron de 90 se siente peor que 16 ms constantes. Lo que se mira es el
 * percentil 95 y el peor cuadro.
 *
 * Aviso honesto: el numero absoluto sale de este ordenador, no del movil de
 * nadie. Sirve para comparar contra si mismo —antes y despues de un cambio— y
 * para cazar tirones, que es lo que de verdad se nota.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const PRESUPUESTO = 16.7;   // 60 cuadros por segundo
const TOLERANCIA = 33.4;    // dos cuadros perdidos: eso ya es un tiron visible

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
// Y aun con GL, un Chromium sin escritorio NO sirve para medir ritmo de
// cuadro: deja de programarlos en cuanto la pagina no tiene nada urgente y
// aparecen tirones de 700 y 2200 ms que no son del juego —son del navegador—.
// Con ventana de verdad desaparecen. Por eso esto pide pantalla: `SIN_VENTANA=1`
// lo fuerza a headless, pero entonces el peor cuadro no significa nada.
const NAVEGADOR = {
  headless: process.env.SIN_VENTANA === '1',
  args: ['--use-gl=angle', '--use-angle=gl-egl'],
};

const nav = await chromium.launch(NAVEGADOR);
const ctx = await nav.newContext({ viewport: { width: 900, height: 1600 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
const errores = [];
pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
pg.on('pageerror', (e) => errores.push(String(e)));

await pg.goto(`${URL}/?seed=fluidez&biome=stalingrado&trampas=1`, { waitUntil: 'networkidle' });
await pg.waitForFunction(() => window.GAME?.world?.terrain, null, { timeout: 10000 });
await pg.waitForTimeout(600);

/** Graba los tiempos entre cuadros mientras corre `accion`. */
async function medir(nombre, accion, ms) {
  // La grabacion, la accion y la espera van en una SOLA llamada a la pagina.
  //
  // Repartirlas —arrancar, disparar, y esperar desde fuera con
  // `waitForTimeout`— metia tirones de dos segundos que no son del juego: con
  // el proceso de control esperando y la pagina sin nada pendiente, Chromium
  // sin escritorio deja de programar cuadros y luego el acumulador de paso fijo
  // recupera 240 pasos de golpe. Medido: dos cuadros seguidos de 700 ms en el
  // vuelo, y ninguno cuando la espera vive dentro de la pagina.
  const tiempos = await pg.evaluate(
    async ([fuenteAccion, duracion]) => {
      const tiemposCuadro = [];
      let ultimo = performance.now();
      let vivo = true;
      const paso = (ahora) => {
        tiemposCuadro.push(ahora - ultimo);
        ultimo = ahora;
        if (vivo) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);

      if (fuenteAccion) new Function(`return (${fuenteAccion})`)()();
      await new Promise((listo) => setTimeout(listo, duracion));
      vivo = false;
      return tiemposCuadro.slice(1); // el primero mide desde antes de empezar
    },
    [accion ? accion.toString() : null, ms],
  );

  tiempos.sort((a, b) => a - b);
  const p = (q) => tiempos[Math.min(tiempos.length - 1, Math.floor(tiempos.length * q))] ?? 0;
  const pasados = tiempos.filter((t) => t > TOLERANCIA).length;

  console.log(
    `  ${nombre.padEnd(22)} p50 ${p(0.5).toFixed(1).padStart(5)} ms   ` +
      `p95 ${p(0.95).toFixed(1).padStart(5)} ms   ` +
      `peor ${tiempos[tiempos.length - 1].toFixed(1).padStart(5)} ms   ` +
      `tirones ${pasados}/${tiempos.length}`,
  );
  const nivel = await pg.evaluate(() => window.GAME.calidad.nivel.nombre);
  console.log(`  ${' '.repeat(22)} calidad al terminar: ${nivel}`);
  return { p50: p(0.5), p95: p(0.95), peor: tiempos[tiempos.length - 1], pasados, n: tiempos.length };
}

console.log(`tiempos de cuadro (presupuesto ${PRESUPUESTO} ms, tiron a partir de ${TOLERANCIA} ms):`);

// Primero se deja que la calidad automatica encuentre su sitio. Medir durante
// el descenso mezcla dos cosas —lo que cuesta el cuadro y lo que costaba antes
// de bajar— y el numero no dice nada.
await medir('(ajustando calidad)', null, 3000);

const reposo = await medir('apuntando', null, 1500);

// El turno entero: disparo, vuelo, impacto con todos los efectos y la pluma
// con sus doce tandas de arena y el alud del final.
const turno = await medir(
  'turno completo',
  () => {
    window.GAME.aim(46, 0.82);
    window.GAME.fire();
  },
  4200,
);

// Y el peor caso de todos: seis impactos seguidos sin dejar respirar.
const tormenta = await medir(
  'seis impactos seguidos',
  () => {
    const G = window.GAME;
    let n = 0;
    const otra = () => {
      if (n++ >= 6) return;
      const x = -30 + n * 10;
      G.efectos.impacto({ x, y: G.world.terrain.heightAt(x), radio: 2.6, daño: 40 });
      setTimeout(otra, 140);
    };
    otra();
  },
  1600,
);

const estado = await pg.evaluate(() => ({
  vivas: window.GAME.efectos.vivas,
  calidad: window.GAME.calidad.nivel.nombre,
  pixeles: window.GAME.renderer.getPixelRatio(),
  lienzo: [window.GAME.renderer.domElement.width, window.GAME.renderer.domElement.height],
}));
console.log(
  `\ncalidad final: ${estado.calidad}  (densidad ${estado.pixeles}, lienzo ${estado.lienzo.join('x')})`,
);
console.log(`particulas vivas en el pico: ${estado.vivas}`);
console.log(`errores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

// El criterio: el percentil 95 dentro de dos cuadros y ni un tiron largo. No
// se exige que la media baje de 16,7 — en un navegador sin escritorio eso
// depende del anfitrion, no del juego.
const fallos = [];
if (turno.p95 > TOLERANCIA) fallos.push(`el turno pasa de ${TOLERANCIA} ms en el p95`);
if (tormenta.p95 > TOLERANCIA) fallos.push(`seis impactos pasan de ${TOLERANCIA} ms en el p95`);
if (turno.peor > 120) fallos.push(`tiron de ${turno.peor.toFixed(0)} ms en el turno`);
if (errores.length) fallos.push('errores de consola');

console.log(
  fallos.length === 0
    ? `\nVA FLUIDO (reposo p50 ${reposo.p50.toFixed(1)} ms)`
    : `\n${fallos.length} FALLOS: ${fallos.join(', ')}`,
);
process.exit(fallos.length === 0 ? 0 : 1);
