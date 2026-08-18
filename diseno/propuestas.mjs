/**
 * Plancha de decision: trampas y modificadores de tiro.
 *
 * Sustituye a la de «tres campos, tres piezas». Las dos piezas alternativas
 * —canon de campana y mortero de sitio— resolvian un problema que el juego no
 * tiene: lo que le falta a un duelo de artilleria por turnos no es otra silueta
 * de canon, es que el turno tenga decisiones que no sean solo angulo y potencia.
 *
 *   node diseno/propuestas.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lienzo, camino, polilinea, caminoRedondeado } from './primitivas.js';
import { BANDOS, TEATROS } from './paleta.js';
import { FICHAS } from './vehiculos.js';
import { escena } from './escenas.js';
import { MODIFICADORES, ACENTO } from './modificadores.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const salida = join(aqui, 'planchas');
mkdirSync(salida, { recursive: true });

const ficha = (id) => FICHAS.find((f) => f.id === id);

// ── las tres composiciones de calle ───────────────────────────────────────

const CAMPOS = [
  {
    id: 'abierto', nombre: 'Avenida', lema: 'Ves la parabola entera',
    teatro: 'berlin', reparto: ['pesado', 'asalto'],
    tiro: 'Todo el arco visible', cobertura: 'Ninguna: estas al descubierto',
    avance: 'Muy util — hay monton que ganar',
    tesis: 'La calle despejada entre dos manzanas. Es la composicion que mejor ensena la trayectoria, y por eso es la que se entiende sola en el primer turno de alguien que abre el enlace y se pone a jugar.',
    contra: 'Sin nada entre los dos, la partida se decide en dos turnos de ajuste y el resto es repetir el mismo tiro. Es la que mas necesita los modificadores.',
  },
  {
    id: 'zanja', nombre: 'Zanja en la calzada', lema: 'El tiro raso deja de servir',
    teatro: 'varsovia44', reparto: ['tanqueta', 'ruedas'],
    tiro: 'Hay que pasar por encima del labio propio', cobertura: 'Alta: estas metido en el suelo',
    avance: 'Caro — salir de la zanja cuesta cuesta arriba',
    tesis: 'Las dos piezas estan DENTRO del terreno, no encima: un corte real en el mapa de alturas con las paredes entibadas y el labio levantado con el cascote excavado. El tiro plano se estrella contra tu propio parapeto.',
    contra: 'Es la mas cara: entibado, parapeto alto y un corte que Sotavento tiene que respetar al mover escombro. Y el jugador ve menos campo.',
  },
  {
    id: 'ruina', nombre: 'Monton central', lema: 'Obliga a elegir lado',
    teatro: 'cassino', reparto: ['mortero', 'obus'],
    tiro: 'Por encima del monton o rodeando', cobertura: 'Media: el monton tapa el tiro raso',
    avance: 'Decisivo — quien corona el monton domina',
    tesis: 'El escombro amontonado en el centro con la ruina grande plantada encima. El decorado no colisiona —eso son las trampas— pero el monton si es terreno, y por eso avanzar hacia el es la jugada.',
    contra: 'Con el monton en medio, la mitad de las trayectorias acaban contra cascote y el jugador puede leerlo como que el juego le engana. Hay que ensenar su altura en el arco de apuntado.',
  },
];

const ESC = 1600 / 38;
const lienzoEscena = (svg) =>
  lienzo({ ancho: 1600, alto: 700, escala: ESC, ox: 800, suelo: 700 - 3.4 * ESC, contenido: svg });

function planchaCampo(c) {
  const [a, b] = c.reparto;
  const { svg } = escena(c.teatro, {
    bandoA: BANDOS.A.base, bandoB: BANDOS.B.base,
    fichaA: ficha(a), fichaB: ficha(b), composicion: c.id,
  });
  const t = TEATROS[c.teatro];
  return `
  <article class="op">
    <div class="op-cab">
      <p class="marca">Calle</p><h3>${c.nombre}</h3><p class="lema">${c.lema}</p>
      <p class="donde">${t.nombre} · ${t.pais} ${t.epoca}</p>
    </div>
    <div class="op-arte">${lienzoEscena(svg)}</div>
    <div class="op-txt">
      <p class="tesis">${c.tesis}</p>
      <div>
        <p class="contra"><b>Lo que cuesta.</b> ${c.contra}</p>
        <dl>
          <div><dt>Trayectoria</dt><dd>${c.tiro}</dd></div>
          <div><dt>Cobertura</dt><dd>${c.cobertura}</dd></div>
          <div><dt>Avanzar</dt><dd>${c.avance}</dd></div>
        </dl>
      </div>
    </div>
  </article>`;
}

// ── las nueve trampas ─────────────────────────────────────────────────────

const PX = 84;
// Encuadre distinto segun donde vive: lo del aire necesita sitio arriba para el
// paracaidas y lo del suelo se centraria mal en un lienzo alto.
const V = { aire: { w: 3.6, h: 3.6, pie: 0.42 }, suelo: { w: 3.6, h: 2.3, pie: 0.55 } };

function tarjetaMod(m) {
  const v = V[m.donde];
  const ancho = v.w * PX, alto = v.h * PX;
  const sueloPx = alto - v.pie * PX;
  const linea = m.donde === 'aire'
    ? `<line x1="0" y1="${(sueloPx - 1.55 * PX).toFixed(0)}" x2="${ancho}" y2="${(sueloPx - 1.55 * PX).toFixed(0)}" stroke="#8b8f7d" stroke-width="1.2" stroke-dasharray="5 7"/>`
    : `<line x1="0" y1="${sueloPx.toFixed(0)}" x2="${ancho}" y2="${sueloPx.toFixed(0)}" stroke="#8b8f7d" stroke-width="1.6"/>`;
  return lienzo({
    ancho, alto, escala: PX, ox: ancho / 2,
    suelo: m.donde === 'aire' ? sueloPx - 0.55 * PX : sueloPx,
    contenido: m.dibujar(0, 0),
    extra: linea,
  });
}

const planchaMod = (m) => `
  <article class="mod ${m.clase}">
    <div class="mod-arte">${tarjetaMod(m)}</div>
    <div class="mod-txt">
      <p class="chip">${m.donde === 'aire' ? 'En el aire' : 'En el suelo'} · ${m.clase === 'defensa' ? 'Defensa' : 'Dano'}</p>
      <h3>${m.nombre}</h3>
      <p class="efecto">${m.efecto}</p>
      <p>${m.como}</p>
      <p class="contra"><b>El riesgo.</b> ${m.riesgo}</p>
    </div>
  </article>`;

const html = `<title>Trampas del Frente</title>
<style>
:root{
  --tinta:#20241a; --tinta-2:#4b5340; --papel:#eceadf; --papel-2:#f6f4ec;
  --linea:#cdc9b6; --acento:#c2582f; --defensa:#2b7f96;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --tinta:#e6e6db; --tinta-2:#9aa08c; --papel:#171912; --papel-2:#1f2219;
    --linea:#333828; --acento:#e0703f; --defensa:#5fc0d8;
  }
}
:root[data-theme="dark"]{
  --tinta:#e6e6db; --tinta-2:#9aa08c; --papel:#171912; --papel-2:#1f2219;
  --linea:#333828; --acento:#e0703f; --defensa:#5fc0d8;
}
*{box-sizing:border-box}
body{margin:0;background:var(--papel);color:var(--tinta);
  font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-size:17px;line-height:1.6}
.env{max-width:1180px;margin:0 auto;padding:0 22px 96px}
h1,h2,h3,.marca,dt,.lema,.chip,.efecto{font-family:"Jost","Futura","Trebuchet MS",system-ui,sans-serif}
header.cab{padding:70px 0 24px;border-bottom:3px solid var(--tinta)}
.ojo{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--tinta-2);margin:0 0 10px;font-weight:600;font-family:"Jost",sans-serif}
h1{font-size:clamp(36px,6vw,66px);line-height:1.03;margin:0 0 14px;letter-spacing:-.02em;text-wrap:balance}
h1 em{font-style:normal;color:var(--acento)}
.entra{font-size:20px;max-width:64ch;color:var(--tinta-2);margin:0}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;margin:66px 0 4px;color:var(--acento);font-weight:700;font-family:"Jost",sans-serif}
h2+p.sub{margin:0 0 10px;font-size:25px;max-width:62ch;line-height:1.26;text-wrap:balance}
p.nota{max-width:74ch;color:var(--tinta-2);margin:0 0 8px}

.reglas{list-style:none;padding:0;margin:22px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 28px}
.reglas li{border-top:2px solid var(--tinta);padding:12px 0 16px}
.reglas b{display:block;font-family:"Jost",sans-serif;font-size:12px;letter-spacing:.13em;text-transform:uppercase;margin-bottom:5px}
.reglas span{color:var(--tinta-2);font-size:15px}
.reglas i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:7px;vertical-align:-1px;border:1px solid rgba(0,0,0,.35)}

.mods{display:grid;gap:0;margin-top:26px}
.mod{display:grid;grid-template-columns:250px minmax(0,1fr);gap:26px;align-items:center;
  border-top:1px solid var(--linea);padding:18px 0}
.mod:first-child{border-top:2px solid var(--tinta)}
.mod-arte{background:var(--papel-2);border:1px solid var(--linea);border-radius:14px;overflow:hidden;display:flex;align-items:center}
.mod-arte svg{display:block;width:100%}
.mod h3{margin:2px 0 2px;font-size:24px}
.mod p{margin:0 0 8px}
.chip{margin:0;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--tinta-2)}
.efecto{font-size:15px;letter-spacing:.04em;color:var(--acento);font-weight:600}
.mod.defensa .efecto{color:var(--defensa)}
.contra{color:var(--tinta-2);font-size:15.5px}
.contra b{color:var(--tinta)}

.op{border-top:2px solid var(--tinta);padding:20px 0 30px;margin:24px 0 0}
.op-cab{display:flex;align-items:baseline;flex-wrap:wrap;gap:0 14px;margin-bottom:14px}
.marca{margin:0;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--papel-2);background:var(--acento);padding:3px 9px;border-radius:3px}
.op h3{margin:0;font-size:28px;letter-spacing:-.01em}
.lema{margin:0;color:var(--tinta-2);font-size:15px}
.donde{margin:0;font-size:12px;color:var(--tinta-2);font-family:ui-monospace,monospace;flex:1 0 100%}
.op-arte{border:1px solid var(--linea);border-radius:14px;overflow:hidden;background:var(--papel-2)}
.op-arte svg{display:block;width:100%}
.op-txt{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:26px;margin-top:16px}
.tesis{margin:0;font-size:18px}
dl{margin:0;display:grid;gap:8px}
dl div{border-top:1px solid var(--linea);padding-top:5px;display:grid;grid-template-columns:92px 1fr;gap:10px;align-items:baseline}
dt{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--tinta-2)}
dd{margin:0;font-size:15px}

.cierre{border-top:3px solid var(--tinta);margin-top:70px;padding-top:22px}
.cierre ul{margin:10px 0 0;padding-left:20px;color:var(--tinta-2)}
.cierre li{margin-bottom:7px}
.cierre b{color:var(--tinta)}
footer{margin:46px 0 0;color:var(--tinta-2);font-size:14px}
@media (max-width:820px){ .mod{grid-template-columns:1fr} .op-txt{grid-template-columns:1fr} }
</style>

<div class="env">

<header class="cab">
  <p class="ojo">Artilleria 1v1 · plancha de decision</p>
  <h1>Trampas<br>del <em>frente</em></h1>
  <p class="entra">Nueve objetos que cambian el disparo: cuatro en el suelo, donde
  cae el proyectil, y cinco en el aire, donde lo atraviesa. Es lo que hace que el
  turno tenga una decision mas alla de angulo y potencia.</p>
</header>

<h2>El lenguaje visual</h2>
<p class="sub">Y no es decoracion: es lo que hace que el sistema sea justo.</p>
<p class="nota">El campo esta lleno de decorado que <b>no hace nada</b> —escombro,
vigas, coches quemados, tranvias—. Si una mina se parece a un bidon, el jugador
aprende que el juego le engana y deja de leer el campo. Por eso todo lo que
afecta al disparo lleva las mismas marcas, y ningun decorado puede usarlas nunca.</p>
<ul class="reglas">
  <li><b><i style="background:${ACENTO.dano}"></i>Naranja = dano</b><span>Te afecta a ti o al rival en dano. Es el color de «esto te importa».</span></li>
  <li><b><i style="background:${ACENTO.defensa}"></i>Cian = defensa</b><span>Escudo, humo, cobertura. Nada que haga dano lleva cian.</span></li>
  <li><b>Contorno de 4 px</b><span>Mas gordo que cualquier decorado. Se leen como mas importantes, y lo son.</span></li>
  <li><b>Sin tinte de teatro</b><span>El decorado se mezcla 0,35 hacia la tierra del sitio; estos mantienen su color entero.</span></li>
  <li><b>Lo del aire cuelga</b><span>Cable, paracaidas o globo. Nada flota sin explicacion.</span></li>
  <li><b>Lo del suelo va enterrado</b><span>Reborde de tierra removida alrededor. Dice que lo pusieron ahi.</span></li>
</ul>

<h2>Los nueve</h2>
<p class="sub">La linea del dibujo marca donde vive cada uno: continua es el suelo, discontinua es la altura del arco.</p>
<div class="mods">${MODIFICADORES.map(planchaMod).join('')}</div>

<h2>Las tres calles</h2>
<p class="sub">Donde se juega. Mismos cinco planos y misma semilla; lo unico que cambia es como esta cortado el suelo.</p>
<p class="nota">Los dieciseis teatros son ciudades destruidas, asi que el fondo ya no
son colinas: son tres capas de manzanas con el remate roto, cada una mas mezclada
con el cielo. Es lo que da profundidad sin paralaje —la camara es ortografica— y
lo que hace que el sitio se lea como una ciudad antes de mirar el suelo.</p>
${CAMPOS.map(planchaCampo).join('')}

<section class="cierre">
  <h2 style="margin-top:0">Lo que hace falta decidir</h2>
  <p class="sub">Cinco respuestas y esto se puede implementar.</p>
  <ul>
    <li><b>Cuantos por partida.</b> Hoy <code>?trampas=1</code> pone seis. Con nueve tipos
    distintos, seis pueden ser demasiados: si cada turno hay un modificador a mano,
    dejan de ser una decision y pasan a ser el juego.</li>
    <li><b>Si reaparecen.</b> Un modificador gastado, ¿vuelve a salir? Si no vuelve,
    el que llega primero gana; si vuelve siempre, no hay urgencia.</li>
    <li><b>Si se encadenan.</b> Nido de municion + carga hueca son dos tiros al
    doble. Hay que probar si eso es emocionante o si decide la partida sola.</li>
    <li><b>El escudo.</b> Absorber un impacto entero puede alargar la partida sin
    aportar. Empezar por la mitad y medir.</li>
    <li><b>Quien los ve.</b> Todos salen de la semilla, asi que los dos jugadores
    ven los mismos. Lo que hay que decidir es si el HUD dice lo que hace cada uno
    o hay que aprenderselo.</li>
  </ul>
</section>

<footer>
  <p>Generado por <code>node diseno/propuestas.mjs</code>. Sin degradados, sin
  filtros y sin una sola llamada a <code>Math.random()</code>.</p>
</footer>

</div>`;

writeFileSync(join(salida, 'propuestas.html'), html);
console.log(`plancha escrita: ${join(salida, 'propuestas.html')} (${(html.length / 1024).toFixed(0)} kB)`);
