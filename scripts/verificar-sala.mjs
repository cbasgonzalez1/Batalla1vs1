import { WebSocket } from 'ws';
import { VERSION, PIDE, DICE, ACCION, mensaje, huella } from '../src/net/protocolo.js';
import { crearPartida, participanteActivo, avanzarTurno } from '../src/game/roster.js';
import { crearCola } from '../src/game/cola.js';
import { mulberry32, hashSeed } from '../src/core/rng.js';
import { crearViento } from '../src/game/viento.js';

/**
 * Seis clientes de verdad contra el servidor de verdad.
 *
 * Lo que se prueba no es que el socket conecte: es que los seis moviles
 * terminen con la MISMA partida habiendo recibido los mensajes en distinto
 * orden y con retardos distintos. Si esto falla, el lockstep no sirve y hay que
 * saberlo antes de escribir una sola linea de interfaz.
 */

const URL_BASE = process.env.SERVIDOR ?? 'http://localhost:8787';
const WS = URL_BASE.replace(/^http/, 'ws');
const JUGADORES = 6;
const TURNOS = 12;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cliente minimo: mantiene su propia simulacion a partir de los inputs. */
function crearCliente(indice) {
  const socket = new WebSocket(WS);
  const cliente = {
    indice,
    nombre: `jugador${indice}`,
    id: null,
    socket,
    partida: null,
    cola: crearCola(),
    viento: null,
    // Sustituto del heightmap: no hace falta terreno de verdad para comprobar
    // que los inputs llegan y se aplican igual en todos.
    alturas: new Float64Array(64),
    aplicados: [],
    desincronias: [],
    listo: false,
  };

  socket.on('message', (bruto) => {
    const m = JSON.parse(bruto);

    if (m.tipo === DICE.empezar) {
      cliente.partida = crearPartida({
        jugadores: m.alineacion.map((j) => ({ id: j.id, nombre: j.nombre, bando: j.bando })),
        semilla: m.semilla,
      });
      cliente.viento = crearViento(mulberry32(hashSeed(`${m.semilla}:turnos`)));
      cliente.listo = true;
    }

    if (m.tipo === DICE.input) {
      cliente.cola.programar(m.paso, m);
    }

    if (m.tipo === DICE.desincronia) {
      cliente.desincronias.push(m);
    }
  });

  return cliente;
}

/** Aplica un input igual en todos: la "simulacion" del test. */
function aplicar(cliente, input) {
  // Con SABOTEAR=1 el ultimo cliente calcula distinto a proposito: sirve para
  // comprobar que el detector de desincronias salta de verdad. Un detector que
  // nunca avisa da una falsa sensacion de seguridad.
  const saboteado = process.env.SABOTEAR === '1' && cliente.indice === JUGADORES - 1;
  const semilla = hashSeed(`${input.de}:${input.paso}:${input.anguloDeg}:${input.potencia}${saboteado ? ':mal' : ''}`);
  const rng = mulberry32(semilla);
  // Toca unas cuantas columnas de forma determinista, como haria un crater.
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(rng() * cliente.alturas.length);
    cliente.alturas[i] += input.anguloDeg / 100 + input.potencia;
  }
  cliente.aplicados.push(`${input.paso}:${input.de}:${input.accion}`);
}

const codigo = await fetch(`${URL_BASE}/sala`, { method: 'POST' })
  .then((r) => r.json())
  .then((r) => r.codigo);

console.log(`sala ${codigo}`);

const clientes = Array.from({ length: JUGADORES }, (_, i) => crearCliente(i));
await Promise.all(
  clientes.map((c) => new Promise((r) => c.socket.on('open', r)))
);

for (const c of clientes) {
  c.socket.send(JSON.stringify(mensaje(PIDE.unir, { sala: codigo, nombre: c.nombre })));
  // Entradas escalonadas, como seis personas que abren el enlace cuando pueden.
  await esperar(30);
}
await esperar(200);

for (const c of clientes) c.socket.send(JSON.stringify(mensaje(PIDE.listo)));
await esperar(400);

const arrancaron = clientes.filter((c) => c.listo).length;
console.log(`arrancaron: ${arrancaron} de ${JUGADORES}`);

// Cada turno: el jugador al que le toca manda su disparo; todos lo aplican en
// el paso sellado. Los retardos son distintos a proposito.
let paso = 100;
for (let turno = 0; turno < TURNOS; turno++) {
  const referencia = clientes[0].partida;
  const activo = participanteActivo(referencia);
  const emisor = clientes.find((c) => c.partida && participanteActivo(c.partida).id === activo.id);

  paso += 200;
  emisor.socket.send(
    JSON.stringify(
      mensaje(PIDE.input, {
        paso,
        accion: ACCION.disparo,
        anguloDeg: 20 + turno * 3,
        potencia: 0.4 + (turno % 5) * 0.1,
      })
    )
  );

  await esperar(60);

  // Todos avanzan hasta ese paso consumiendo lo que tengan agendado.
  for (const c of clientes) {
    for (let p = paso - 200; p <= paso; p++) {
      for (const input of c.cola.consumir(p)) aplicar(c, input);
    }
    avanzarTurno(c.partida);
  }
}

await esperar(200);

// Cada uno manda su huella; el servidor avisa si no coinciden.
for (const c of clientes) {
  c.socket.send(
    JSON.stringify(
      mensaje(PIDE.checksum, {
        turno: TURNOS,
        huella: huella({ alturas: c.alturas, vidas: [100, 100], turno: TURNOS }),
      })
    )
  );
}
await esperar(400);

const huellas = clientes.map((c) => huella({ alturas: c.alturas, vidas: [100, 100], turno: TURNOS }));
const distintas = new Set(huellas).size;
const secuencias = new Set(clientes.map((c) => c.aplicados.join('|'))).size;
const avisos = clientes.reduce((n, c) => n + c.desincronias.length, 0);
const tardios = clientes.reduce((n, c) => n + c.cola.tardios.length, 0);

console.log(`inputs aplicados por cliente: ${clientes.map((c) => c.aplicados.length).join(', ')}`);
console.log(`secuencias distintas:  ${secuencias}  (1 = todos aplicaron lo mismo en el mismo orden)`);
console.log(`huellas distintas:     ${distintas}  (1 = todos calcularon lo mismo)`);
console.log(`inputs que llegaron tarde: ${tardios}`);
console.log(`avisos de desincronia del servidor: ${avisos}`);

for (const c of clientes) c.socket.close();

const fallos =
  (arrancaron !== JUGADORES ? 1 : 0) +
  (secuencias !== 1 ? 1 : 0) +
  (distintas !== 1 ? 1 : 0) +
  (tardios > 0 ? 1 : 0) +
  (avisos > 0 ? 1 : 0);

console.log(fallos === 0 ? '\nLOS SEIS TIENEN LA MISMA PARTIDA' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
