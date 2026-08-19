import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { crearSalas, atender } from './salas.js';
import { DICE, mensaje, normalizarCodigo } from '../src/net/protocolo.js';
import { crearPozo, migrar, consultarCon, transaccionCon } from './db/conexion.js';
import { crearRepositorio } from './db/repositorio.js';
import { crearApi } from './cuentas.js';
import { tokenDe } from './auth.js';
import { CAMUFLAJES, DE_SERIE, enBanda } from '../src/art/vehiculo/camuflajes.js';

/**
 * El servidor. Reparte mensajes y no simula nada.
 *
 * Todo lo que sabe de partidas esta en salas.js y se prueba sin red; aqui solo
 * queda el transporte: aceptar sockets, meterlos en salas y reenviar bytes.
 *
 * Aqui SI se usa Math.random y el reloj, y no rompe nada: el determinismo que
 * importa es el de la simulacion, que vive en el navegador. El servidor no
 * calcula balistica, ni daño, ni terreno — solo elige codigos de sala y semilla
 * inicial, y esas dos cosas se reparten a todos antes de empezar.
 */

const PUERTO = Number(process.env.PUERTO ?? 8787);

/** Lo que el cuerpo de una peticion puede pesar. Un registro son 200 bytes. */
const CUERPO_MAXIMO = 64 * 1024;

// El juego se sirve desde aqui mismo cuando existe dist/. Un solo origen
// significa un solo dominio que configurar, WebSocket sin CORS y wss
// automatico detras de HTTPS: en un despliegue eso es la diferencia entre
// funcionar y pasarse la tarde con la configuracion del proxy.
const RAIZ = fileURLToPath(new URL('../dist/', import.meta.url));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

async function servirEstatico(peticion, respuesta) {
  const pedido = decodeURIComponent((peticion.url ?? '/').split('?')[0]);
  // normalize() antes de unir: sin esto un ../../etc/passwd saldria del dist.
  const relativo = normalize(pedido === '/' ? 'index.html' : pedido.replace(/^\/+/, ''));
  if (relativo.startsWith('..')) {
    respuesta.writeHead(403);
    respuesta.end();
    return true;
  }

  const ruta = join(RAIZ, relativo);
  try {
    const info = await stat(ruta);
    if (!info.isFile()) return false;
    const cuerpo = await readFile(ruta);
    respuesta.writeHead(200, {
      'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream',
      // El index no se cachea: es el que trae las rutas de los bundles nuevos.
      'cache-control': relativo === 'index.html' ? 'no-cache' : 'public, max-age=604800',
    });
    respuesta.end(cuerpo);
    return true;
  } catch {
    return false;
  }
}

const salas = crearSalas({
  rng: Math.random,
  semillaDe: (sala) => `${sala.codigo}-${Date.now().toString(36)}`,
});

/**
 * La base de datos, si la hay.
 *
 * Sin `DATABASE_URL` esto se queda en null y el servidor arranca igual: salas,
 * partidas y todo lo que ya funcionaba. Lo unico que se apaga son las cuentas,
 * la tienda y el progreso — y eso es deliberado, porque `pnpm dev` y las seis
 * verificaciones de navegador tienen que poder correr sin levantar un Postgres.
 */
const pozo = crearPozo();
let api = null;

async function arrancarBaseDeDatos() {
  if (!pozo) {
    console.log('  (sin DATABASE_URL: salas si, cuentas no)');
    return;
  }
  // Un camuflaje fuera de la banda de su bando no llega NUNCA a la tienda: el
  // bando se lee por el color del casco y por nada mas (ARTE-VEHICULOS §6).
  const fuera = CAMUFLAJES.filter((c) => !enBanda(c.base, c.bando));
  if (fuera.length) {
    throw new Error(`camuflajes fuera de banda: ${fuera.map((c) => c.id).join(', ')}`);
  }

  await migrar(pozo);
  const repo = crearRepositorio({
    consultar: consultarCon(pozo),
    transaccion: transaccionCon(pozo),
  });
  await repo.sembrarCatalogo(CAMUFLAJES);
  await repo.barrerSesiones();
  api = crearApi({ repo, deSerie: DE_SERIE });
  console.log(`  base de datos lista, ${CAMUFLAJES.length} camuflajes en catalogo`);
}

/** Lee el cuerpo de una peticion, con tope. */
function leerCuerpo(peticion) {
  return new Promise((resolver, rechazar) => {
    let bruto = '';
    peticion.on('data', (trozo) => {
      bruto += trozo;
      if (bruto.length > CUERPO_MAXIMO) {
        rechazar(new Error('cuerpo demasiado grande'));
        peticion.destroy();
      }
    });
    peticion.on('end', () => {
      if (!bruto) return resolver({});
      try {
        resolver(JSON.parse(bruto));
      } catch {
        rechazar(new Error('eso no es JSON'));
      }
    });
    peticion.on('error', rechazar);
  });
}

async function atenderApi(peticion, respuesta, ruta) {
  const responder = (estado, cuerpo) => {
    respuesta.writeHead(estado, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    respuesta.end(JSON.stringify(cuerpo));
  };

  if (!api) return responder(503, { error: 'este servidor no tiene cuentas configuradas' });

  let cuerpo = {};
  try {
    if (peticion.method !== 'GET') cuerpo = await leerCuerpo(peticion);
  } catch (error) {
    return responder(400, { error: error.message });
  }

  try {
    const salida = await api.atender(peticion.method, ruta, {
      cuerpo,
      token: tokenDe(peticion.headers),
      dispositivo: String(peticion.headers['user-agent'] ?? '').slice(0, 120),
    });
    return responder(salida.estado, salida.cuerpo);
  } catch (error) {
    // Un fallo de la base de datos no puede tumbar el servidor de salas: hay
    // partidas en curso que no dependen de ella para nada.
    console.error('fallo en la API de cuentas:', error);
    return responder(500, { error: 'el servidor no pudo con eso' });
  }
}

/** @type {Map<string, {socket: import('ws').WebSocket, sesion: object}>} */
const conexiones = new Map();

const enviar = (socket, m) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(m));
};

function difundir(codigo, m) {
  for (const { socket, sesion } of conexiones.values()) {
    if (sesion.sala === codigo) enviar(socket, m);
  }
}

function entregar(salidas, socket) {
  for (const salida of salidas) {
    if (salida.para === 'uno') enviar(socket, salida.mensaje);
    else if (salida.para === 'sala') difundir(salida.codigo, salida.mensaje);
  }
}

const http = createServer(async (peticion, respuesta) => {
  // Crear sala por HTTP: el que invita no necesita tener el juego abierto para
  // conseguir un codigo que dictar por telefono.
  if (peticion.method === 'POST' && peticion.url === '/sala') {
    const sala = salas.crear();
    respuesta.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    respuesta.end(JSON.stringify({ codigo: sala.codigo }));
    return;
  }

  if (peticion.method === 'OPTIONS') {
    respuesta.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    });
    respuesta.end();
    return;
  }

  const ruta = (peticion.url ?? '/').split('?')[0];
  if (ruta.startsWith('/api/')) {
    await atenderApi(peticion, respuesta, ruta);
    return;
  }

  if (peticion.url === '/salud') {
    respuesta.writeHead(200, { 'content-type': 'application/json' });
    respuesta.end(JSON.stringify({
      ok: true,
      salas: salas.numeroDeSalas,
      conexiones: conexiones.size,
      cuentas: Boolean(api),
    }));
    return;
  }

  if (peticion.method === 'GET' && (await servirEstatico(peticion, respuesta))) return;

  respuesta.writeHead(404);
  respuesta.end();
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (socket) => {
  const sesion = { id: randomUUID(), sala: null, bando: null };
  conexiones.set(sesion.id, { socket, sesion });

  socket.on('message', (bruto) => {
    let entrada;
    try {
      entrada = JSON.parse(bruto);
    } catch {
      enviar(socket, mensaje(DICE.error, { motivo: 'eso no es JSON' }));
      return;
    }

    if (typeof entrada?.sala === 'string') entrada.sala = normalizarCodigo(entrada.sala);

    try {
      entregar(atender(salas, sesion, entrada), socket);
    } catch (error) {
      // Un fallo atendiendo a uno no puede tumbar la sala de los demas.
      console.error('fallo atendiendo un mensaje:', error);
      enviar(socket, mensaje(DICE.error, { motivo: 'el servidor no pudo con eso' }));
    }
  });

  const despedir = () => {
    conexiones.delete(sesion.id);
    if (!sesion.sala) return;

    const codigo = sesion.sala;
    const r = salas.salir(codigo, sesion.id);
    if (!r.ok || r.salaVacia) return;

    difundir(codigo, mensaje(DICE.salio, { id: sesion.id, nombre: r.jugador?.nombre }));
    difundir(codigo, mensaje(DICE.sala, salas.estado(codigo)));
  };

  socket.on('close', despedir);
  socket.on('error', despedir);
});

http.listen(PUERTO, '0.0.0.0', async () => {
  try {
    await arrancarBaseDeDatos();
  } catch (error) {
    // Se avisa y se sigue. Un fallo de la base de datos deja el juego sin
    // cuentas, no sin juego: las salas no la necesitan para nada.
    console.error('la base de datos no arranco:', error.message);
  }

  let hayJuego = false;
  try {
    hayJuego = (await stat(join(RAIZ, 'index.html'))).isFile();
  } catch {
    hayJuego = false;
  }

  console.log(`sala de batalla escuchando en http://localhost:${PUERTO}`);
  console.log(`  POST /sala   crea una sala y devuelve su codigo`);
  console.log(`  GET  /salud  estado del servidor`);
  if (api) console.log('  /api/...     registro, sesion, tienda, partidas, historial');
  console.log(
    hayJuego
      ? '  GET  /          el juego, servido desde dist/'
      : '  (sin dist/: solo salas. `pnpm build` para servir tambien el juego)'
  );
});
