/**
 * Genera las planchas de diseno en HTML. No necesita servidor ni navegador:
 * `node diseno/planchas.mjs`.
 *
 * Las planchas comparten paleta, proporciones y tecnica de contorno con el
 * juego a proposito. Si una plancha y el juego se ven distintos, el roto esta en
 * el juego — que es justo lo que paso con los siete blindados anteriores.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lienzo, grupo, camino, polilinea } from './primitivas.js';
import { BANDOS, TEATROS, claro, oscuro, contorno, camuflaje, CAUCHO } from './paleta.js';
import { FICHAS, construir, Y_PIVOTE } from './vehiculos.js';
import { escena, repartoDe } from './escenas.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const salida = join(aqui, 'planchas');
mkdirSync(salida, { recursive: true });

// ── encuadre unico ────────────────────────────────────────────────────────
// Los quince al MISMO zoom. Es la unica forma de que la fila de comparacion
// compare algo: un vehiculo aprobado por separado y suspendido aqui esta
// suspendido (docs/CHECKLIST-REVISION.md §3).

const VENTANA = { w: 10.6, h: 5.4, suelo: 0.55 };
const PX = 62;

function tarjeta(ficha, base, { negro = false, guia = false } = {}) {
  const ancho = VENTANA.w * PX, alto = VENTANA.h * PX;
  let extra = '';
  if (guia) {
    const y = alto - VENTANA.suelo * PX - Y_PIVOTE * PX;
    extra = `<line x1="0" y1="${y.toFixed(1)}" x2="${ancho}" y2="${y.toFixed(1)}" stroke="#d94f2b" stroke-width="1.5" stroke-dasharray="7 6"/>`;
  }
  return lienzo({
    ancho, alto, escala: PX, ox: ancho / 2, suelo: alto - VENTANA.suelo * PX,
    contenido: construir(ficha, { base, negro }),
    extra,
  });
}

// ── planchas ──────────────────────────────────────────────────────────────

const filaFichas = (base, opciones = {}) => FICHAS.map((f) => `
  <figure class="v">
    ${tarjeta(f, typeof base === 'function' ? base(f) : base, opciones)}
    <figcaption><b>${f.nombre}</b><span>${f.anio} · ${f.clase}</span></figcaption>
  </figure>`).join('');

const fichaLarga = (f) => `
  <article class="ficha">
    <div class="ficha-arte">${tarjeta(f, BANDOS.A.base, { guia: true })}</div>
    <div class="ficha-txt">
      <h3>${f.nombre} <em>${f.anio}</em></h3>
      <p class="clase">${f.clase} · ${f.teatros}</p>
      <p>${f.nota}</p>
      <dl>
        <div><dt>Vida</dt><dd>${f.vida}</dd></div>
        <div><dt>Dano</dt><dd>${f.dano}</dd></div>
        <div><dt>Avance</dt><dd>${f.avance}</dd></div>
        <div><dt>Piezas</dt><dd>${f.piezas}</dd></div>
        <div><dt>Casco</dt><dd>${f.L} u</dd></div>
        <div><dt>Pivote</dt><dd>${Y_PIVOTE} u</dd></div>
      </dl>
    </div>
  </article>`;

function planchaEscena(clave) {
  const t = TEATROS[clave];
  const r = repartoDe(clave);
  const { svg } = escena(clave, { bandoA: BANDOS.A.base, bandoB: BANDOS.B.base, fichaA: r.a, fichaB: r.b });
  const esc = 1600 / 38;
  return `
  <section class="teatro">
    <header>
      <h3>${t.nombre} <em>${t.pais} · ${t.epoca}</em></h3>
      <p>${t.nota}</p>
      <ul class="chips">
        <li><i style="background:${t.cresta}"></i>cresta</li>
        <li><i style="background:${t.cuerpo}"></i>cuerpo</li>
        <li><i style="background:${t.socavon}"></i>socavon</li>
        <li class="txt">?biome=${clave}</li>
        <li class="txt">${r.a.nombre} vs ${r.b.nombre}</li>
        <li class="txt">${t.props.join(' · ')}</li>
      </ul>
    </header>
    ${lienzo({ ancho: 1600, alto: 700, escala: esc, ox: 800, suelo: 700 - 3.4 * esc, contenido: svg })}
  </section>`;
}

const muestra = (nombre, hex) => `<li><i style="background:${hex}"></i><b>${nombre}</b><code>${hex}</code></li>`;

const html = `<title>Parque Movil del Frente</title>
<style>
:root{
  --tinta:#20241a; --tinta-2:#4b5340; --papel:#eceadf; --papel-2:#f6f4ec;
  --linea:#cdc9b6; --oliva:#7d8b4e; --acento:#c2582f; --acero:#5c7d92;
}
:root:not([data-theme="light"]){ }
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --tinta:#e6e6db; --tinta-2:#9aa08c; --papel:#171912; --papel-2:#1f2219;
    --linea:#333828; --oliva:#96a560; --acento:#e0703f; --acero:#7fa0b6;
  }
}
:root[data-theme="dark"]{
  --tinta:#e6e6db; --tinta-2:#9aa08c; --papel:#171912; --papel-2:#1f2219;
  --linea:#333828; --oliva:#96a560; --acento:#e0703f; --acero:#7fa0b6;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--papel); color:var(--tinta);
  font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  font-size:17px; line-height:1.6;
}
.envoltorio{max-width:1240px;margin:0 auto;padding:0 24px 96px}
h1,h2,h3,.eyebrow,dt,figcaption b,.chips{
  font-family:"Jost","Futura","Trebuchet MS",system-ui,sans-serif;
}
.eyebrow{
  font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--tinta-2);
  margin:0 0 10px; font-weight:600;
}
header.cabecera{padding:72px 0 26px;border-bottom:3px solid var(--tinta)}
h1{font-size:clamp(38px,6vw,70px);line-height:1.02;margin:0 0 14px;letter-spacing:-.02em;text-wrap:balance}
h1 em{font-style:normal;color:var(--acento)}
.entradilla{font-size:20px;max-width:62ch;color:var(--tinta-2);margin:0}
section{margin:64px 0 0}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 6px;color:var(--acento);font-weight:700}
h2 + p.sub{margin:0 0 26px;font-size:26px;max-width:60ch;line-height:1.25;text-wrap:balance}
p.nota{max-width:70ch;color:var(--tinta-2)}
hr{border:0;border-top:1px solid var(--linea);margin:54px 0}

.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:20px}
.v{margin:0;background:var(--papel-2);border:1px solid var(--linea);border-radius:14px;overflow:hidden}
.v svg{display:block}
.v.negro svg{background:#e8e6da}
figcaption{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  padding:9px 14px 12px;border-top:1px solid var(--linea);font-size:13px}
figcaption b{letter-spacing:.09em;font-size:12.5px}
figcaption span{color:var(--tinta-2);font-size:12px;font-family:ui-sans-serif,system-ui,sans-serif}

.ficha{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:26px;align-items:center;
  padding:22px 0;border-bottom:1px solid var(--linea)}
.ficha-arte{background:var(--papel-2);border:1px solid var(--linea);border-radius:14px;overflow:hidden}
.ficha h3{margin:0;font-size:24px;letter-spacing:.03em}
.ficha h3 em{font-style:normal;color:var(--acento);font-size:16px;margin-left:8px}
.ficha .clase{margin:2px 0 10px;font-size:13px;color:var(--tinta-2);
  font-family:ui-sans-serif,system-ui,sans-serif}
.ficha p{margin:0 0 12px}
dl{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:0}
dl div{border-top:2px solid var(--tinta);padding-top:5px}
dt{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--tinta-2)}
dd{margin:0;font-size:19px;font-variant-numeric:tabular-nums}

.teatro{margin:34px 0 0;border:1px solid var(--linea);border-radius:16px;overflow:hidden;background:var(--papel-2)}
.teatro header{padding:18px 20px 14px}
.teatro h3{margin:0;font-size:22px}
.teatro h3 em{font-style:normal;color:var(--acento);font-size:15px;margin-left:8px}
.teatro p{margin:4px 0 10px;color:var(--tinta-2);max-width:76ch}
.teatro svg{display:block;width:100%}
.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0;font-size:11.5px}
.chips li{display:flex;align-items:center;gap:6px;border:1px solid var(--linea);
  border-radius:999px;padding:3px 10px;letter-spacing:.08em;text-transform:uppercase}
.chips i{width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.3)}
.chips .txt{font-family:ui-monospace,monospace;text-transform:none;letter-spacing:0}

.paleta{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;list-style:none;padding:0;margin:0}
.paleta li{display:flex;align-items:center;gap:11px;border:1px solid var(--linea);
  border-radius:11px;padding:9px 12px;background:var(--papel-2)}
.paleta i{width:34px;height:34px;border-radius:8px;border:1px solid rgba(0,0,0,.25);flex:0 0 auto}
.paleta b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.paleta code{font-size:12px;color:var(--tinta-2)}

.reglas{list-style:none;padding:0;margin:0;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0 30px}
.reglas li{border-top:2px solid var(--tinta);padding:12px 0 16px}
.reglas b{display:block;font-family:"Jost","Trebuchet MS",sans-serif;font-size:13px;
  letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
.reglas span{color:var(--tinta-2);font-size:15px}

.antes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.antes div{border-left:3px solid var(--acento);padding:2px 0 2px 15px}
.antes h4{margin:0 0 4px;font-family:"Jost",sans-serif;font-size:12px;letter-spacing:.14em;
  text-transform:uppercase}
.antes p{margin:0;color:var(--tinta-2);font-size:15px}
.tabla{width:100%;border-collapse:collapse;font-size:14px}
.tabla th,.tabla td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--linea)}
.tabla th{font-family:"Jost",sans-serif;font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--tinta-2)}
.tabla td:first-child{font-family:ui-monospace,monospace}
.scroll{overflow-x:auto}
footer{margin:80px 0 0;padding-top:22px;border-top:3px solid var(--tinta);color:var(--tinta-2);font-size:14px}
@media (max-width:760px){ .ficha{grid-template-columns:1fr} dl{grid-template-columns:repeat(3,1fr)} }
</style>

<div class="envoltorio">

<header class="cabecera">
  <p class="eyebrow">Artilleria 1v1 · plancha de aprobacion</p>
  <h1>Parque movil<br>del <em>frente</em></h1>
  <p class="entradilla">Quince blindados y seis teatros, dibujados con la tecnica que
  manda <code>docs/ARTE-VEHICULOS.md</code> §12: un cuerpo, un contorno. Mismo zoom,
  misma paleta, mismo grosor de trazo. Lo que apruebes aqui es lo que se modela.</p>
</header>

<section>
  <h2>Por que estaban mal</h2>
  <p class="sub">El fallo no fue de ejecucion. Fue de guia.</p>
  <div class="antes">
    <div><h4>Lo que decia</h4><p>«3 a 6 formas por objeto», «fuera todo detalle por
    debajo de 8 px», «2 bandas de tono en sprite». Cumpliendolo al pie de la letra
    salen siete cajas con un tubo: correctas y sin caracter.</p></div>
    <div><h4>Lo que dice ahora</h4><p>Detalle jerarquizado en tres niveles: silueta
    (4–6 piezas), forma (6–10) y superficie (calcomanias, sin coste de malla). Tope
    de 12 a 18 piezas y 8 llamadas de dibujo por vehiculo.</p></div>
    <div><h4>Lo que se ha borrado</h4><p><code>ARTE.md</code> §5 y §8 quedan derogadas
    y remiten a los documentos nuevos. El contorno pasa de −0,55 a −0,65, que es lo
    que sale de MEDIR la imagen de referencia, no de estimarla.</p></div>
  </div>
</section>

<hr>

<section>
  <h2>Paleta, medida</h2>
  <p class="sub">Ningun hex esta puesto a ojo: todos salen de muestrear la referencia.</p>
  <ul class="paleta">
    ${muestra('base oliva', BANDOS.A.base)}
    ${muestra('banda clara', claro(BANDOS.A.base))}
    ${muestra('camuflaje', camuflaje(BANDOS.A.base))}
    ${muestra('banda oscura', oscuro(BANDOS.A.base))}
    ${muestra('contorno', contorno(BANDOS.A.base))}
    ${muestra('base acero', BANDOS.B.base)}
    ${muestra('contorno acero', contorno(BANDOS.B.base))}
    ${muestra('cinta de oruga', CAUCHO.banda)}
    ${muestra('llanta', CAUCHO.llanta)}
    ${muestra('contorno caucho', CAUCHO.contorno)}
  </ul>
  <p class="nota" style="margin-top:18px">Lo que se escribe en el codigo es el
  <b>factor</b> de <code>tono()</code> —+0,18 / −0,13 / −0,24 / −0,65— nunca el hex.
  Asi cambiar el color de un bando no obliga a recalcular cinco derivados a mano, y
  anadir un tercer bando es una linea.</p>
</section>

<hr>

<section>
  <h2>Las seis reglas</h2>
  <p class="sub">No se negocian, y aplican igual al vehiculo y al decorado.</p>
  <ul class="reglas">
    <li><b>Contorno</b><span>Base oscurecida un 65 %, nunca negro ni gris. Grosor
    constante en pantalla a cualquier zoom.</span></li>
    <li><b>Tres tonos</b><span>Base, banda clara y banda oscura, recortadas contra la
    silueta. Nunca un objeto de un color plano.</span></li>
    <li><b>Luz fija</b><span>Arriba-izquierda en toda la escena. La banda clara
    arriba, la oscura abajo-derecha, sin excepciones.</span></li>
    <li><b>Sombra de contacto</b><span>Elipse bajo todo lo apoyado. Sin ella el objeto
    flota, y flotar es el defecto que menos se diagnostica.</span></li>
    <li><b>Esquinas redondeadas</b><span>Cero esquinas vivas, ni en el casco ni en una
    caja de municion.</span></li>
    <li><b>Cero degradados</b><span>Ni blur, ni glow, ni filtros. El sombreado es
    color plano superpuesto.</span></li>
  </ul>
</section>

<hr>

<section>
  <h2>Fila de comparacion · bando Oliva</h2>
  <p class="sub">Los quince al mismo zoom. La prueba no es mirar uno: es esta.</p>
  <div class="rejilla">${filaFichas(BANDOS.A.base)}</div>
</section>

<section>
  <h2>Fila de comparacion · bandos alternos</h2>
  <p class="sub">Ningun vehiculo puede salir con el contorno del bando contrario.</p>
  <div class="rejilla">${filaFichas((f) => (FICHAS.indexOf(f) % 2 ? BANDOS.B.base : BANDOS.A.base))}</div>
</section>

<section>
  <h2>La prueba en negro</h2>
  <p class="sub">Si dos se confunden aqui, uno cambia de casco o de rodaje. Nunca de color.</p>
  <div class="rejilla">${FICHAS.map((f) => `
    <figure class="v negro">${tarjeta(f, BANDOS.A.base, { negro: true })}
    <figcaption><b>${f.nombre}</b><span>${f.piezas} piezas</span></figcaption></figure>`).join('')}</div>
</section>

<hr>

<section>
  <h2>El invariante</h2>
  <p class="sub">El pivote de elevacion de las quince, a ${Y_PIVOTE} u del suelo. La linea naranja lo demuestra.</p>
  <p class="nota">No es una decision de dibujo disfrazada: de ese eje sale el punto de
  salida del proyectil, y la boca se calcula como <code>pivote + R(elevacion)·[largo]</code>
  con el largo que declara la ficha. Mover el pivote no produce un error visual, produce
  partidas que divergen sin explicacion.<br><br>
  La version anterior de la regla fijaba <b>la boca</b> «a la misma Y en toda elevacion».
  Eso es imposible —un tubo que gira describe un arco, no una horizontal— y obligaba a
  enterrar la cuna del mortero por debajo de la oruga para cuadrarlo. Fijar el pivote
  cumple lo que de verdad hacia falta y ademas deja que el mortero se vea como un
  mortero. Aqui el pivote es una constante del modulo y <b>no sale de la ficha</b>: una
  ficha no puede romperlo ni queriendo.</p>
  <div class="fichas">${FICHAS.map(fichaLarga).join('')}</div>
</section>

<hr>

<section>
  <h2>Los seis teatros</h2>
  <p class="sub">Nueve sitios de verdad, uno por partida. La epoca la manda el teatro, no el jugador.</p>
  <p class="nota">Un teatro no es una paleta, es un <b>sitio</b>: lo que lo dice no es
  el color del cielo, es que en Normandia hay setos de bocage sobre caballon y en la
  llanura del Bzura hay almiares y postes de telegrafo. Cada uno declara sus familias
  de decorado y no usa las de los demas.</p>
  <p class="nota">Cinco planos: cielo de cuatro bandas, tres crestas de fondo mezcladas
  hacia el horizonte, suelo de <b>cuatro</b> franjas de color plano siguiendo el
  relieve, decorado tenido un 35 % hacia la tierra del teatro, y primer plano en
  silueta. Todo colocado con el <code>rng</code> de la semilla y pasando por un motor
  que <b>niega</b> la colocacion si el hueco esta ocupado: por eso ya no hay piezas
  encima de los blindados.</p>
  ${Object.keys(TEATROS).map(planchaEscena).join('')}
</section>

<hr>

<section>
  <h2>Contradicciones resueltas</h2>
  <p class="sub">Lo que se ha borrado de las indicaciones originales, y por que.</p>
  <div class="scroll"><table class="tabla">
    <tr><th>Donde</th><th>Decia</th><th>Dice</th><th>Motivo</th></tr>
    <tr><td>ARTE.md §5</td><td>3 a 6 formas por objeto; fuera detalle bajo 6 px</td>
      <td>Derogada; remite a ARTE-VEHICULOS §1</td><td>Era la causa directa de las cajas con tubo</td></tr>
    <tr><td>ARTE.md §8</td><td>Vehiculo como sprite: 2 bandas, minimo 8 px</td>
      <td>Derogada; el vehiculo es malla, no imagen</td><td>El minimo se mide en unidades de mundo</td></tr>
    <tr><td>ARTE.md §1 y §2</td><td>contorno = base oscurecida 55 %</td>
      <td>65 %</td><td>Medido: #7D8B4E → #2B3419 es −0,645</td></tr>
    <tr><td>ARTE-VEHICULOS §6</td><td>bandos #8FA33C y #7E9BB8</td>
      <td>#7D8B4E y #5C7D92</td><td>Chocaban con el ejemplar aprobado de §12</td></tr>
    <tr><td>ARTE-VEHICULOS §12.5</td><td>fuera remaches y manchas de camuflaje</td>
      <td>Fuera solo lo que tenga contorno propio</td><td>La referencia lleva las dos cosas</td></tr>
    <tr><td>CATALOGO §1</td><td>rodadura de 1,3 u en la MEDIA</td>
      <td>0,13 L de diametro</td><td>1,3 u sobre 5,6 u solapa las cinco ruedas</td></tr>
    <tr><td>README.md</td><td>?biome=dunas|placa|salar|caldera…</td>
      <td>somme|flandes|alamein|rzhev|stalingrado|ardenas</td><td>Eran los biomas de la version lunar</td></tr>
    <tr><td>README.md</td><td>«Sin el motion spec todavia»</td>
      <td>ARTE.md §14 lo especifica y esta implementado</td><td>La nota era falsa desde que se escribio §14</td></tr>
    <tr><td>ARTE.md §9 · VEHICULOS §8</td><td>la BOCA a la misma Y en toda elevacion</td>
      <td>el PIVOTE de elevacion a la misma Y</td><td>Un tubo que gira describe un arco: lo otro no se puede cumplir</td></tr>
    <tr><td>ARTE.md §11</td><td>seis teatros con el mismo decorado</td>
      <td>nueve sitios de verdad, cada uno con sus familias</td><td>Un teatro no es una paleta; con el mismo decorado los seis eran uno repintado</td></tr>
    <tr><td>ARTE.md §12</td><td>diez franjas de suelo con el brillo alternando</td>
      <td>cuatro, y contraste bajo entre las de abajo</td><td>Diez bandas onduladas convierten media pantalla en un mapa topografico</td></tr>
    <tr><td>ESCENARIOS §2</td><td>«toda pieza se asienta en el terreno»</td>
      <td>+ nada se solapa, nada flota, de mayor a menor</td><td>La regla estaba escrita pero no habia nada que la hiciera cumplir</td></tr>
  </table></div>
</section>

<footer>
  <p>Generado por <code>node diseno/planchas.mjs</code> · sin degradados, sin filtros,
  sin una sola llamada a <code>Math.random()</code>. Aprobar aqui, modelar despues.</p>
</footer>

</div>`;

writeFileSync(join(salida, 'parque-movil.html'), html);
console.log(`plancha escrita: ${join(salida, 'parque-movil.html')} (${(html.length / 1024).toFixed(0)} kB)`);
