/**
 * Plancha de decision: tres composiciones de campo y tres piezas.
 *
 * No es un catalogo, es una eleccion. Las tres escenas van en el MISMO teatro
 * —Flandes, el de la imagen de referencia— para que lo unico que cambie sea la
 * composicion; y las tres piezas van al mismo zoom y con la misma linea de
 * pivote. Comparar dos cosas que cambian en dos ejes a la vez no es comparar.
 *
 *   node diseno/propuestas.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lienzo } from './primitivas.js';
import { BANDOS, TEATROS } from './paleta.js';
import { FICHAS, Y_PIVOTE } from './vehiculos.js';
import { escena } from './escenas.js';
import { PIEZAS } from './canones.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const salida = join(aqui, 'planchas');
mkdirSync(salida, { recursive: true });

const ficha = (id) => FICHAS.find((f) => f.id === id);

// ── las tres composiciones ────────────────────────────────────────────────

const CAMPOS = [
  {
    id: 'abierto',
    nombre: 'Campo abierto',
    lema: 'Ves la parabola entera',
    teatro: 'flandes',
    reparto: ['media', 'cazacarros'],
    tiro: 'Todo el arco visible',
    cobertura: 'Ninguna: estas al descubierto',
    avance: 'Muy util — hay loma que ganar',
    tesis: 'Horizonte bajo, mucho cielo y el hito lejos. Es la composicion que mejor ensena la trayectoria, y por eso es la que se entiende sola en el primer turno de alguien que abre el enlace y se pone a jugar.',
    contra: 'Sin nada entre los dos, la partida se decide en dos turnos de ajuste y el resto es repetir el mismo tiro. Es la que mas depende de que el viento y Sotavento hagan su trabajo.',
    encaja: 'El Alamein, el Somme, Frente del Este',
  },
  {
    id: 'zanja',
    nombre: 'Zanja enfrentada',
    lema: 'El tiro raso deja de servir',
    teatro: 'flandes',
    reparto: ['tanqueta', 'ruedas'],
    tiro: 'Hay que pasar por encima del labio propio',
    cobertura: 'Alta: estas metido en el suelo',
    avance: 'Caro — salir de la zanja cuesta cuesta arriba',
    tesis: 'Las dos piezas estan DENTRO del terreno, no encima: la trinchera es un corte en el mapa de alturas con las paredes entibadas y el labio levantado con la tierra excavada. Cambia la partida entera, porque el tiro plano se estrella contra tu propio parapeto.',
    contra: 'Es la mas cara de las tres: entibado, parapeto alto y un corte real en el heightmap que Sotavento tiene que respetar al mover arena. Y el jugador ve menos campo.',
    encaja: 'Flandes y el Somme, y solo con piezas cortas: un rombo de 6,4 u se apoya en los dos labios y tapa la trinchera entera',
  },
  {
    id: 'ruina',
    nombre: 'Cresta con hito',
    lema: 'Obliga a elegir lado',
    teatro: 'flandes',
    reparto: ['pesado', 'asalto'],
    tiro: 'Por encima de la loma o rodeando',
    cobertura: 'Media: la loma tapa el tiro raso',
    avance: 'Decisivo — quien corona la loma domina',
    tesis: 'Una loma central con el hito del teatro plantado en la cresta —torre rota en el Somme, chimenea en Stalingrado, tocon gigante en Flandes— ocupando el tope del 25–40 % del ancho. El decorado no colisiona —eso son las trampas— pero la loma si es terreno, y por eso avanzar hacia ella es la jugada.',
    contra: 'Con la loma en medio, la mitad de las trayectorias acaban contra tierra y el jugador puede leerlo como que el juego le engana. Hay que ensenar la altura de la cresta en el arco de apuntado.',
    encaja: 'Stalingrado y las Ardenas, donde el hito ya es una masa vertical',
  },
];

const ESC = 1600 / 38;

function lienzoEscena(svg) {
  return lienzo({ ancho: 1600, alto: 700, escala: ESC, ox: 800, suelo: 700 - 3.4 * ESC, contenido: svg });
}

function planchaCampo(c) {
  const [a, b] = c.reparto;
  const { svg } = escena(c.teatro, {
    bandoA: BANDOS.A.base, bandoB: BANDOS.B.base,
    fichaA: ficha(a), fichaB: ficha(b), composicion: c.id,
  });
  return `
  <article class="op">
    <div class="op-cab">
      <p class="marca">Campo</p>
      <h3>${c.nombre}</h3>
      <p class="lema">${c.lema}</p>
    </div>
    <div class="op-arte">${lienzoEscena(svg)}</div>
    <div class="op-txt">
      <p class="tesis">${c.tesis}</p>
      <p class="contra"><b>Lo que cuesta.</b> ${c.contra}</p>
      <dl>
        <div><dt>Trayectoria</dt><dd>${c.tiro}</dd></div>
        <div><dt>Cobertura</dt><dd>${c.cobertura}</dd></div>
        <div><dt>Avanzar</dt><dd>${c.avance}</dd></div>
        <div><dt>Encaja en</dt><dd>${c.encaja}</dd></div>
      </dl>
    </div>
  </article>`;
}

// ── las tres piezas ───────────────────────────────────────────────────────

const VENTANA = { w: 10.6, h: 5.7, suelo: 0.55 };
const PX = 74;

function tarjetaPieza(p, base, negro) {
  const ancho = VENTANA.w * PX, alto = VENTANA.h * PX;
  const y = alto - VENTANA.suelo * PX - Y_PIVOTE * PX;
  return lienzo({
    ancho, alto, escala: PX, ox: ancho / 2, suelo: alto - VENTANA.suelo * PX,
    contenido: p.dibujar(base, negro),
    extra: negro ? '' : `<line x1="0" y1="${y.toFixed(1)}" x2="${ancho}" y2="${y.toFixed(1)}" stroke="#d94f2b" stroke-width="1.6" stroke-dasharray="8 7"/>`,
  });
}

function planchaPieza(p) {
  return `
  <article class="op">
    <div class="op-cab">
      <p class="marca">Pieza</p>
      <h3>${p.nombre}</h3>
      <p class="lema">${p.lema}</p>
    </div>
    <div class="op-arte doble">
      <div>${tarjetaPieza(p, BANDOS.A.base, false)}</div>
      <div class="negro">${tarjetaPieza(p, BANDOS.A.base, true)}</div>
    </div>
    <div class="op-txt">
      <p class="tesis">${p.tesis}</p>
      <p class="contra"><b>Lo que cuesta.</b> ${p.cuesta}</p>
      <p class="contra"><b>El riesgo.</b> ${p.riesgo}</p>
      <dl>
        <div><dt>Trayectoria</dt><dd>${p.tiro}</dd></div>
        <div><dt>Avanzar</dt><dd>${p.avance}</dd></div>
        <div><dt>Aguante</dt><dd>${p.aguante}</dd></div>
        <div><dt>Epoca</dt><dd>${p.epoca}</dd></div>
      </dl>
    </div>
  </article>`;
}

const html = `<title>Tres Campos, Tres Piezas</title>
<style>
:root{
  --tinta:#20241a; --tinta-2:#4b5340; --papel:#eceadf; --papel-2:#f6f4ec;
  --linea:#cdc9b6; --acento:#c2582f;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --tinta:#e6e6db; --tinta-2:#9aa08c; --papel:#171912; --papel-2:#1f2219;
    --linea:#333828; --acento:#e0703f;
  }
}
:root[data-theme="dark"]{
  --tinta:#e6e6db; --tinta-2:#9aa08c; --papel:#171912; --papel-2:#1f2219;
  --linea:#333828; --acento:#e0703f;
}
*{box-sizing:border-box}
body{margin:0;background:var(--papel);color:var(--tinta);
  font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  font-size:17px;line-height:1.6}
.env{max-width:1180px;margin:0 auto;padding:0 22px 96px}
h1,h2,h3,.marca,dt,.lema{font-family:"Jost","Futura","Trebuchet MS",system-ui,sans-serif}
header.cab{padding:70px 0 24px;border-bottom:3px solid var(--tinta)}
.ojo{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--tinta-2);
  margin:0 0 10px;font-weight:600;font-family:"Jost",sans-serif}
h1{font-size:clamp(36px,6vw,66px);line-height:1.03;margin:0 0 14px;letter-spacing:-.02em;text-wrap:balance}
h1 em{font-style:normal;color:var(--acento)}
.entra{font-size:20px;max-width:64ch;color:var(--tinta-2);margin:0}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;margin:64px 0 4px;
  color:var(--acento);font-weight:700;font-family:"Jost",sans-serif}
h2+p.sub{margin:0 0 8px;font-size:25px;max-width:62ch;line-height:1.26;text-wrap:balance}
p.nota{max-width:72ch;color:var(--tinta-2);margin:0 0 8px}

.op{border-top:2px solid var(--tinta);padding:22px 0 34px;margin:26px 0 0}
.op-cab{display:flex;align-items:baseline;flex-wrap:wrap;gap:0 14px;margin-bottom:14px}
.marca{margin:0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--papel-2);background:var(--acento);padding:3px 9px;border-radius:3px}
.op h3{margin:0;font-size:29px;letter-spacing:-.01em}
.lema{margin:0;color:var(--tinta-2);font-size:15px;letter-spacing:.04em}
.op-arte{border:1px solid var(--linea);border-radius:14px;overflow:hidden;background:var(--papel-2)}
.op-arte svg{display:block;width:100%}
.op-arte.doble{display:grid;grid-template-columns:1.55fr 1fr;gap:0;border-radius:14px}
.op-arte.doble>div+div{border-left:1px solid var(--linea)}
.op-arte.doble .negro{background:#e8e6da}
.op-txt{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:26px;margin-top:18px}
.tesis{margin:0;font-size:18.5px}
.contra{margin:0 0 10px;color:var(--tinta-2);font-size:15.5px}
.contra b{color:var(--tinta)}
dl{margin:0;display:grid;gap:9px}
dl div{border-top:1px solid var(--linea);padding-top:5px;display:grid;
  grid-template-columns:88px 1fr;gap:10px;align-items:baseline}
dt{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--tinta-2)}
dd{margin:0;font-size:15px}

.cierre{border-top:3px solid var(--tinta);margin-top:70px;padding-top:22px}
.cierre ul{margin:10px 0 0;padding-left:20px;color:var(--tinta-2)}
.cierre li{margin-bottom:7px}
.cierre b{color:var(--tinta)}
footer{margin:46px 0 0;color:var(--tinta-2);font-size:14px}
@media (max-width:820px){
  .op-txt{grid-template-columns:1fr}
  .op-arte.doble{grid-template-columns:1fr}
  .op-arte.doble>div+div{border-left:0;border-top:1px solid var(--linea)}
}
</style>

<div class="env">

<header class="cab">
  <p class="ojo">Artilleria 1v1 · plancha de decision</p>
  <h1>Tres campos,<br>tres <em>piezas</em></h1>
  <p class="entra">Seis propuestas para elegir tres: una composicion de campo y una
  pieza principal. Las tres escenas van en el mismo teatro y las tres piezas al mismo
  zoom, para que lo unico que cambie sea lo que se decide.</p>
</header>

<h2>Los tres campos</h2>
<p class="sub">Mismo teatro —Flandes, el de la imagen de referencia— y mismo reparto de planos. Lo unico que cambia es como esta cortado el suelo.</p>
<p class="nota">Los tres cumplen los cinco planos de <code>ARTE.md</code> §3 y colocan
todo con el <code>rng</code> de la semilla. La diferencia no es de adorno: es donde
esta el terreno respecto a la pieza, y eso cambia que tiros son posibles.</p>
${CAMPOS.map(planchaCampo).join('')}

<h2>Las tres piezas</h2>
<p class="sub">Lo que el jugador conduce. A la derecha, la misma pieza en negro: si no se reconoce ahi, no se reconoce a 0,55x de zoom.</p>
<p class="nota">La linea naranja es el pivote de elevacion, a ${Y_PIVOTE} u del suelo en
las tres. De ahi sale el punto de salida del proyectil y no se toca — es lo unico que
las tres propuestas tienen prohibido cambiar (<code>ARTE.md</code> §9).</p>
${PIEZAS.map(planchaPieza).join('')}

<section class="cierre">
  <h2 style="margin-top:0">Lo que hace falta decidir</h2>
  <p class="sub">Cuatro respuestas y se puede empezar a modelar.</p>
  <ul>
    <li><b>Un campo o los tres.</b> Se pueden sortear por partida como los teatros,
    pero entonces la zanja y el campo abierto tienen que estar equilibrados entre si,
    y no lo estan: en zanja el tiro plano no sirve.</li>
    <li><b>Una pieza o las tres.</b> Si van las tres, el obus de sitio hay que
    reglarlo aparte porque no avanza, y <code>avance.js</code> asume que todos avanzan.</li>
    <li><b>Que pasa con los quince del catalogo.</b> Si gana la pieza de campana,
    catorce de los quince hay que rehacerlos: no comparten ni tren de rodaje.</li>
    <li><b>Si el campo condiciona la epoca.</b> La zanja pide rombos de 1916 y la
    ruina pide blindados de 1943. Hoy la epoca la manda el teatro; podria mandarla
    el campo.</li>
  </ul>
</section>

<footer>
  <p>Generado por <code>node diseno/propuestas.mjs</code>. Sin degradados, sin filtros
  y sin una sola llamada a <code>Math.random()</code>.</p>
</footer>

</div>`;

writeFileSync(join(salida, 'propuestas.html'), html);
console.log(`plancha escrita: ${join(salida, 'propuestas.html')} (${(html.length / 1024).toFixed(0)} kB)`);
