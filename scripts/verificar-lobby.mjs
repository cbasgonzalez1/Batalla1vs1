import { chromium } from 'playwright';
import { sesionEnContexto } from './sesion-de-prueba.mjs';

/**
 * Dos navegadores de verdad entrando a la misma sala.
 *
 * Comprueba lo que un test unitario no puede: que el codigo se vea, que la
 * lista se actualice en LOS DOS cuando entra alguien, y que la partida arranque
 * sola cuando los dos confirman.
 */

const URL = process.env.URL ?? 'http://localhost:5173';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await chromium.launch();
const errores = [];

async function abrir(locale, ruta, cuenta) {
  const ctx = await nav.newContext({ locale });
  // Con el servidor de cuentas levantado, el panel de acceso tapa la sala: el
  // token se siembra antes de navegar. Sin ese servidor no hace nada.
  await sesionEnContexto(ctx, cuenta);
  const pg = await ctx.newPage();
  pg.on('console', (m) => m.type() === 'error' && errores.push(`[${locale}] ${m.text()}`));
  pg.on('pageerror', (e) => errores.push(`[${locale}] ${e}`));
  await pg.goto(`${URL}${ruta}`, { waitUntil: 'networkidle' });
  return pg;
}

const leer = (pg) =>
  pg.evaluate(() => ({
    visible: document.getElementById('sala').classList.contains('on'),
    codigo: document.getElementById('s-codigo').textContent,
    a: [...document.querySelectorAll('#s-lista-a li')].map((n) => n.textContent.trim()),
    b: [...document.querySelectorAll('#s-lista-b li')].map((n) => n.textContent.trim()),
    aviso: document.getElementById('s-aviso').textContent,
    listo: document.getElementById('s-listo').textContent,
    listoDesactivado: document.getElementById('s-listo').disabled,
  }));

// Anfitrion: crea la sala.
const uno = await abrir('es-ES', '/?online', 'lobby-uno');
await uno.fill('#s-nombre', 'Ana');
await uno.click('#s-crear');
await esperar(600);

const trasCrear = await leer(uno);
console.log(`sala creada: ${trasCrear.codigo}   visible=${trasCrear.visible}`);
console.log(`  bando A: ${trasCrear.a.join(', ')}`);
console.log(`  aviso:   "${trasCrear.aviso}"   boton listo desactivado=${trasCrear.listoDesactivado}`);

// Invitado: entra con el codigo dictado.
// El invitado abre el enlace con el codigo ya puesto, teclea su nombre y entra.
const dos = await abrir('en-US', '/?online', 'lobby-dos');
await dos.fill('#s-nombre', 'Bea');
await dos.fill('#s-codigo-input', trasCrear.codigo);
await dos.click('#s-unir');
await esperar(900);

const anfitrion = await leer(uno);
const invitado = await leer(dos);
console.log(`\ntras entrar el segundo:`);
console.log(`  anfitrion ve  A:[${anfitrion.a.join(', ')}]  B:[${anfitrion.b.join(', ')}]`);
console.log(`  invitado ve   A:[${invitado.a.join(', ')}]  B:[${invitado.b.join(', ')}]`);
console.log(`  invitado (en): codigo=${invitado.codigo}  boton="${invitado.listo}"`);

// Los dos confirman: la partida tiene que arrancar sola.
await uno.click('#s-listo');
await esperar(300);
const trasUnListo = await leer(uno);
console.log(`\ntras confirmar uno:  aviso="${trasUnListo.aviso}"  boton="${trasUnListo.listo}"`);

await dos.click('#s-listo');
await esperar(700);

const finUno = await leer(uno);
const finDos = await leer(dos);
console.log(`\ntras confirmar los dos:  sala oculta en anfitrion=${!finUno.visible}  en invitado=${!finDos.visible}`);

console.log(`\nerrores de consola: ${errores.length ? errores.join(' ; ') : 'ninguno'}`);

await nav.close();

const fallos =
  (trasCrear.codigo.length !== 4 ? 1 : 0) +
  (anfitrion.a.filter((x) => x.includes('Ana')).length !== 1 ? 1 : 0) +
  (invitado.a.filter((x) => x.includes('Ana')).length !== 1 ? 1 : 0) +
  (!anfitrion.b.some((x) => x.includes('Bea')) ? 1 : 0) +
  (finUno.visible || finDos.visible ? 1 : 0) +
  (errores.length ? 1 : 0);

console.log(fallos === 0 ? '\nLA SALA FUNCIONA' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
