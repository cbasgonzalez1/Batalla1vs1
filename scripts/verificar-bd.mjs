import { randomUUID } from 'node:crypto';
import { crearPozo, migrar, consultarCon, transaccionCon } from '../server/db/conexion.js';
import { crearRepositorio } from '../server/db/repositorio.js';
import { crearApi } from '../server/cuentas.js';
import { huellaDe } from '../server/auth.js';
import { CAMUFLAJES, DE_SERIE, enBanda } from '../src/art/vehiculo/camuflajes.js';
import { codificar, decodificar } from '../src/game/replay.js';

/**
 * La base de datos, contra un Postgres de verdad.
 *
 * Los tests de vitest prueban la logica con un repositorio de mentira: quien
 * puede hacer que y con que respuesta. Esto prueba lo otro — que el SQL es SQL
 * valido, que las restricciones muerden y que el progreso cuadra — y eso no se
 * puede fingir.
 *
 * Se limpia solo: crea sus jugadores con un correo irrepetible y los borra al
 * terminar, asi que se puede ejecutar contra la base de desarrollo sin dejar
 * basura.
 *
 *   docker run -d --name artilleria-pg -e POSTGRES_PASSWORD=artilleria \
 *     -e POSTGRES_USER=artilleria -e POSTGRES_DB=artilleria \
 *     -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://artilleria:artilleria@127.0.0.1:55432/artilleria pnpm verificar:bd
 */

const URL_BD = process.env.DATABASE_URL;
if (!URL_BD) {
  console.error('hace falta DATABASE_URL. Ejemplo:');
  console.error('  DATABASE_URL=postgres://artilleria:artilleria@127.0.0.1:55432/artilleria pnpm verificar:bd');
  process.exit(2);
}

const fallos = [];
const marca = randomUUID().slice(0, 8);
const correo = `prueba-${marca}@artilleria.test`;

function comprobar(que, condicion, detalle = '') {
  const bien = Boolean(condicion);
  console.log(`  ${bien ? 'OK  ' : 'MAL '} ${que}${detalle ? `  ${detalle}` : ''}`);
  if (!bien) fallos.push(que);
}

const pozo = crearPozo(URL_BD);
const consultar = consultarCon(pozo);
const repo = crearRepositorio({ consultar, transaccion: transaccionCon(pozo) });

try {
  // ── esquema y catalogo ──────────────────────────────────────────────
  console.log('\nesquema');
  await migrar(pozo);
  await migrar(pozo);
  comprobar('el esquema se aplica dos veces sin quejarse', true);

  const tablas = await consultar(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  const esperadas = ['camuflaje', 'compra', 'desbloqueo', 'jugador', 'partida', 'participacion', 'progreso', 'sesion'];
  comprobar('estan las ocho tablas', esperadas.every((t) => tablas.some((f) => f.table_name === t)),
    tablas.map((t) => t.table_name).join(' '));

  console.log('\ncatalogo');
  comprobar('ningun camuflaje se sale de la banda de su bando',
    CAMUFLAJES.every((c) => enBanda(c.base, c.bando)));
  await repo.sembrarCatalogo(CAMUFLAJES);
  await repo.sembrarCatalogo(CAMUFLAJES);
  const catalogo = await repo.catalogo();
  comprobar('sembrar dos veces no duplica', catalogo.length === CAMUFLAJES.length,
    `${catalogo.length} filas`);
  comprobar('el color se guarda como el numero que es',
    catalogo.find((c) => c.id === 'a-oliva').base === CAMUFLAJES[0].base);

  // ── cuenta ──────────────────────────────────────────────────────────
  console.log('\ncuenta');
  const api = crearApi({ repo, deSerie: DE_SERIE });
  const alta = await api.atender('POST', '/api/registro', {
    cuerpo: { correo, clave: 'doceletrasbuenas', nombre: 'Prueba' },
  });
  comprobar('registro', alta.estado === 200, alta.cuerpo.error ?? '');
  const token = alta.cuerpo.token;
  const jugadorId = alta.cuerpo.jugador.id;

  const [fila] = await consultar('SELECT clave FROM jugador WHERE id = $1', [jugadorId]);
  comprobar('la contrasena NO esta en la base de datos', !fila.clave.includes('doceletrasbuenas'));
  const [sesion] = await consultar('SELECT huella FROM sesion WHERE jugador_id = $1', [jugadorId]);
  comprobar('el token tampoco: solo su huella', sesion.huella === huellaDe(token) && sesion.huella !== token);

  const repetido = await api.atender('POST', '/api/registro', {
    cuerpo: { correo: correo.toUpperCase(), clave: 'doceletrasbuenas', nombre: 'Otro' },
  });
  comprobar('el mismo correo no entra dos veces', repetido.estado === 409);

  const yo = await api.atender('GET', '/api/yo', { token });
  comprobar('la sesion vale', yo.estado === 200);
  comprobar('trae los dos camuflajes de serie', yo.cuerpo.desbloqueos.length === DE_SERIE.length,
    yo.cuerpo.desbloqueos.join(' '));

  // ── tienda ──────────────────────────────────────────────────────────
  console.log('\ntienda');
  const ajeno = await api.atender('PUT', '/api/camuflaje', {
    token, cuerpo: { bando: 'a', id: 'a-bosque' },
  });
  comprobar('no se puede elegir uno que no tienes', ajeno.estado === 403);

  const compra = await repo.canjearCompra({
    jugadorId, camuflajeId: 'a-bosque', tienda: 'regalo',
    recibo: `recibo-${marca}`, centimos: 199,
  });
  comprobar('canjear desbloquea', compra.ok === true);
  const otraVez = await repo.canjearCompra({
    jugadorId, camuflajeId: 'a-bosque', tienda: 'regalo',
    recibo: `recibo-${marca}`, centimos: 199,
  });
  comprobar('el mismo recibo no se canjea dos veces', otraVez.ok === false, otraVez.motivo ?? '');

  const elegido = await api.atender('PUT', '/api/camuflaje', {
    token, cuerpo: { bando: 'a', id: 'a-bosque' },
  });
  comprobar('ahora si se puede elegir', elegido.estado === 200 && elegido.cuerpo.camuflajes.a === 'a-bosque');

  const cruzado = await api.atender('PUT', '/api/camuflaje', {
    token, cuerpo: { bando: 'b', id: 'a-bosque' },
  });
  comprobar('un camuflaje del bando A no vale para el B', cruzado.estado === 403);

  // ── la partida entera, en una cadena ────────────────────────────────
  console.log('\npartida');
  const combate = {
    semilla: `vostok-${marca}`,
    turnos: [
      { anguloDeg: 45, potencia: 0.7 },
      { anguloDeg: 38.5, potencia: 0.62, avance: -2.5 },
      { anguloDeg: 51, potencia: 0.88, reaccion: { tipo: 'escudo', paso: 108 } },
    ],
  };
  const repeticion = codificar(combate);
  const guardada = await api.atender('POST', '/api/partida', {
    token,
    cuerpo: {
      semilla: combate.semilla, teatro: 'berlin', suelo: 'zanja', repeticion,
      turnos: combate.turnos.length, ganador: 'a',
      participantes: [
        { yo: true, bando: 'a', nombre: 'Prueba', vidaFinal: 62, disparos: 3, aciertos: 2, dano: 91, mejorImpacto: 46 },
        { bando: 'b', nombre: 'Invitado', vidaFinal: 0, disparos: 2, aciertos: 1, dano: 38 },
      ],
    },
  });
  comprobar('se guarda', guardada.estado === 200, guardada.cuerpo.error ?? '');

  const [leida] = await consultar('SELECT repeticion FROM partida WHERE id = $1', [guardada.cuerpo.id]);
  const vuelta = decodificar(leida.repeticion);
  comprobar('la repeticion guardada reconstruye la partida ENTERA',
    vuelta.semilla === combate.semilla
      && vuelta.turnos.length === combate.turnos.length
      && vuelta.turnos[2].reaccion?.tipo === 'escudo'
      && vuelta.turnos[1].avance === -2.5,
    `${leida.repeticion.length} bytes para ${combate.turnos.length} turnos`);

  const invitados = await consultar(
    'SELECT jugador_id FROM participacion WHERE partida_id = $1 ORDER BY puesto', [guardada.cuerpo.id]);
  comprobar('el invitado se guarda sin cuenta', invitados[1].jugador_id === null);

  // ── progreso ────────────────────────────────────────────────────────
  console.log('\nprogreso');
  const p1 = await repo.progresoDe(jugadorId);
  comprobar('suma la partida', p1.partidas === 1 && p1.ganadas === 1, `dano ${p1.dano}`);
  comprobar('suma el daño y el mejor impacto', Number(p1.dano) === 91 && p1.mejor_impacto === 46);

  await repo.guardarPartida({
    semilla: `otra-${marca}`, ganador: 'b', turnos: 4,
    participantes: [{ jugadorId, bando: 'a', nombre: 'Prueba', disparos: 4, aciertos: 1, dano: 20 }],
  });
  const p2 = await repo.progresoDe(jugadorId);
  comprobar('la segunda partida suma y la derrota no cuenta como victoria',
    p2.partidas === 2 && p2.ganadas === 1);

  // El progreso es una CACHE: recomponerlo desde el historial tiene que dar lo
  // mismo. Si algun dia hay que auditar partidas antes de contarlas, se cambian
  // los criterios y se recompone, sin migrar nada.
  await consultar('UPDATE progreso SET partidas = 999, dano = 0 WHERE jugador_id = $1', [jugadorId]);
  await repo.recomponerProgreso(jugadorId);
  const p3 = await repo.progresoDe(jugadorId);
  comprobar('recomponer desde el historial devuelve lo mismo',
    p3.partidas === p2.partidas && p3.ganadas === p2.ganadas && String(p3.dano) === String(p2.dano),
    `${p3.partidas} partidas, ${p3.ganadas} ganadas, ${p3.dano} de daño`);

  const historial = await api.atender('GET', '/api/historial', { token });
  comprobar('el historial trae las dos con su repeticion',
    historial.cuerpo.partidas.length === 2 && historial.cuerpo.partidas.some((x) => x.repeticion));

  // ── borrar la cuenta se lo lleva todo menos la partida ───────────────
  console.log('\nintegridad');
  await consultar('DELETE FROM jugador WHERE id = $1', [jugadorId]);
  const [{ count: sesionesVivas }] = await consultar(
    'SELECT count(*)::int FROM sesion WHERE jugador_id = $1', [jugadorId]);
  comprobar('borrar la cuenta cierra sus sesiones', sesionesVivas === 0);
  const quedan = await consultar(
    'SELECT jugador_id FROM participacion WHERE partida_id = $1', [guardada.cuerpo.id]);
  comprobar('la partida sobrevive, sin dueño', quedan.length === 2 && quedan.every((q) => q.jugador_id === null));
} catch (error) {
  console.error('\nreventó:', error.message);
  fallos.push(error.message);
} finally {
  // Lo que este guion haya creado se va, pase lo que pase.
  await consultar('DELETE FROM jugador WHERE correo LIKE $1', ['prueba-%@artilleria.test'])
    .catch(() => {});
  await consultar('DELETE FROM partida WHERE semilla LIKE $1', [`%${marca}%`]).catch(() => {});
  await pozo.end();
}

console.log(fallos.length ? `\n${fallos.length} COMPROBACIONES FALLIDAS` : '\nLA BASE DE DATOS CUADRA');
process.exit(fallos.length ? 1 : 0);
