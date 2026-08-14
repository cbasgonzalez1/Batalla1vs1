/**
 * Ganchos de inspeccion para el bucle de test: `render_game_to_text()` y
 * `advanceTime(ms)`.
 *
 * Un agente que conduce el juego con Playwright no puede mirar la pantalla: lee
 * texto. Y no puede esperar a que pasen los segundos, porque entonces el
 * resultado dependeria de lo rapida que sea la maquina. Estos dos ganchos
 * resuelven las dos cosas apoyandose en lo que el juego ya era: determinista y
 * a paso fijo.
 *
 * `describirPartida` es pura y se prueba sin navegador; solo `exponerGanchos`
 * toca `window`.
 */

const n = (valor, decimales = 2) =>
  Number.isFinite(valor) ? valor.toFixed(decimales) : '—';

const BANDOS = ['A', 'B'];

/**
 * Estado de la partida como texto plano y estable.
 *
 * Formato `clave: valor`, una por linea, con los decimales fijados: dos
 * ejecuciones de la misma semilla producen exactamente el mismo texto, asi que
 * comparar dos volcados es una forma barata de detectar que el determinismo se
 * ha roto.
 */
export function describirPartida(d) {
  const lineas = [
    `fase: ${d.fase}`,
    `turno: ${BANDOS[d.activo] ?? d.activo}`,
    `ronda: ${d.ronda ?? 1}`,
    `angulo: ${n(d.anguloGrados, 1)}°`,
    `potencia: ${n(d.potencia * 100, 0)}%`,
    `viento: ${n(d.viento, 2)}`,
  ];

  if (d.proyectil) {
    lineas.push(
      `proyectil: x=${n(d.proyectil.x)} y=${n(d.proyectil.y)}`,
      `velocidad: vx=${n(d.proyectil.vx)} vy=${n(d.proyectil.vy)}`,
      `terreno bajo el proyectil: ${n(d.alturaTerreno)}`,
      `pasos de vuelo: ${d.pasosDeVuelo}`,
      `pasos al impacto: ${Number.isFinite(d.pasosAlImpacto) ? d.pasosAlImpacto : 'sin impacto previsto'}`
    );
  } else {
    lineas.push('proyectil: ninguno en vuelo', `terreno bajo el canon: ${n(d.alturaTerreno)}`);
  }

  if (d.reaccionAbierta) {
    lineas.push(`reaccion: abierta para ${BANDOS[d.defensor] ?? d.defensor}`);
  }

  for (let i = 0; i < d.jugadores.length; i++) {
    const j = d.jugadores[i];
    const estado = j.destruido ? 'destruido' : `${n(j.vida, 0)} de vida`;
    lineas.push(`${BANDOS[i] ?? i}: ${estado}, ${j.cargas} cargas, ${j.disparos} disparos`);
  }

  if (d.ganador != null) lineas.push(`ganador: ${BANDOS[d.ganador] ?? d.ganador}`);

  return lineas.join('\n');
}

/**
 * Cuantos pasos fijos caben en `ms`. Se redondea para que 1000 ms den 120 pasos
 * exactos y no 119 por un error de coma flotante.
 */
export function pasosPara(ms, pasoEnSegundos) {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 1000 / pasoEnSegundos);
}

/**
 * Publica los ganchos en `window`. Recibe closures en vez de el estado del
 * juego para no obligar a main.js a exponer sus interioridades.
 */
export function exponerGanchos({ leerEstado, avanzarPaso, dibujar, pasoEnSegundos }, ventana = globalThis) {
  ventana.render_game_to_text = () => describirPartida(leerEstado());

  ventana.advanceTime = (ms) => {
    const pasos = pasosPara(ms, pasoEnSegundos);
    for (let i = 0; i < pasos; i++) avanzarPaso();
    // Un solo dibujado al final: el bucle de test quiere el estado tras avanzar,
    // no la animacion intermedia.
    dibujar?.();
    return pasos;
  };

  return ventana;
}
