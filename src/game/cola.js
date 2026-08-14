/**
 * Inputs sellados con el paso en que se aplican.
 *
 * Esta es la pieza que hace posible el lockstep. Hoy los botones de reaccion
 * llegan por eventos del DOM en un instante cualquiera: si el defensor pulsa
 * escudo, su movil lo aplica en el paso 250 y el del atacante en el 262, y a
 * partir de ahi las dos partidas son distintas sin que nadie se entere.
 *
 * Con la cola, un input no se aplica cuando llega: se aplica en EL PASO que
 * lleva escrito. Todos los moviles ejecutan la misma accion en el mismo paso, y
 * el resultado tiene que ser identico porque la simulacion es determinista.
 *
 * Modulo puro: ni red, ni DOM, ni reloj.
 */

export function crearCola() {
  /** @type {Map<number, object[]>} */
  const porPaso = new Map();
  let ultimoConsumido = -1;
  const tardios = [];

  return {
    /**
     * Agenda un input para un paso concreto.
     *
     * Si el paso ya se consumio, NO se aplica: hacerlo daria un resultado
     * distinto al de quien lo consumio a tiempo, que es exactamente la
     * divergencia que la cola existe para evitar. Se apunta como tardio para
     * poder avisar en vez de romper en silencio.
     */
    programar(paso, input) {
      if (!Number.isInteger(paso) || paso < 0) return false;
      if (paso <= ultimoConsumido) {
        tardios.push({ paso, input, consumidoHasta: ultimoConsumido });
        return false;
      }
      if (!porPaso.has(paso)) porPaso.set(paso, []);
      porPaso.get(paso).push(input);
      return true;
    },

    /**
     * Inputs de ese paso, en el orden en que se programaron. Consumir avanza la
     * frontera: a partir de aqui ese paso ya no admite nada.
     */
    consumir(paso) {
      ultimoConsumido = Math.max(ultimoConsumido, paso);
      const lista = porPaso.get(paso);
      if (!lista) return [];
      porPaso.delete(paso);
      return lista;
    },

    /** Lo que llego tarde, para poder avisar de que la partida puede divergir. */
    get tardios() {
      return tardios.slice();
    },

    /** Inputs agendados que aun no han llegado a su paso. */
    get pendientes() {
      let n = 0;
      for (const lista of porPaso.values()) n += lista.length;
      return n;
    },

    limpiar() {
      porPaso.clear();
      tardios.length = 0;
      ultimoConsumido = -1;
    },
  };
}
