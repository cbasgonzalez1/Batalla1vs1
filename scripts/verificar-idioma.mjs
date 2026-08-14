import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';

const LOCALES = [
  { nombre: 'espanol (es-ES)', locale: 'es-ES', esperado: 'es' },
  { nombre: 'ingles (en-US)', locale: 'en-US', esperado: 'en' },
  { nombre: 'frances (fr-FR)', locale: 'fr-FR', esperado: 'en' },
  { nombre: 'japones (ja-JP)', locale: 'ja-JP', esperado: 'en' },
  { nombre: 'catalan (ca-ES + es-ES)', locale: 'ca-ES', extra: ['ca-ES', 'es-ES'], esperado: 'es' },
];

const navegador = await chromium.launch();
let fallos = 0;

for (const caso of LOCALES) {
  const contexto = await navegador.newContext({ locale: caso.locale });

  if (caso.extra) {
    await contexto.addInitScript((idiomas) => {
      Object.defineProperty(navigator, 'languages', { get: () => idiomas });
    }, caso.extra);
  }

  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pagina.on('pageerror', (e) => errores.push(String(e)));

  await pagina.goto(URL, { waitUntil: 'networkidle' });

  const leido = await pagina.evaluate(() => ({
    lang: document.documentElement.lang,
    titulo: document.title,
    textos: [...document.querySelectorAll('[data-i18n]')].map((n) => n.textContent.trim()),
    aria: [...document.querySelectorAll('[data-i18n-aria]')].map((n) => n.getAttribute('aria-label')),
  }));

  const ok = leido.lang === caso.esperado;
  if (!ok) fallos++;
  if (errores.length) fallos++;

  console.log(`\n${ok ? 'OK ' : 'MAL'}  ${caso.nombre}  ->  lang="${leido.lang}" (esperado "${caso.esperado}")`);
  console.log(`     titulo: ${leido.titulo}`);
  console.log(`     textos: ${leido.textos.join(' | ')}`);
  console.log(`     aria:   ${leido.aria.join(' | ')}`);
  if (errores.length) console.log(`     ERRORES DE CONSOLA: ${errores.join(' ; ')}`);

  await contexto.close();
}

await navegador.close();
console.log(`\n${fallos === 0 ? 'TODO CORRECTO' : `${fallos} FALLOS`}`);
process.exit(fallos === 0 ? 0 : 1);
