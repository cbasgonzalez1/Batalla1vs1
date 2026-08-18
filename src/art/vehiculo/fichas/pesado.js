/**
 * PESADO, 1943.
 *
 * Valida la torreta grande y cuadrada, y el freno de boca de dos camaras. El
 * solape de las siete ruedas es caro de leer y es justo lo que hay que
 * exagerar: dos filas visibles, no una fila apretada.
 */
export const pesado = {
  id: 'pesado',
  nombre: 'PESADO',
  anio: 1943,
  clase: 'Carro pesado',

  L: 6.2,
  alto: 1.32,
  y0: 0.76,
  perfil: 'caja',
  opts: { incl: 0.11 },

  rodaje: { tipo: 'oruga', r: 0.35, x0: -3.16, x1: 3.16, ruedas: 7, rodillos: 0, eslabones: 30 },

  // Retrasada: es lo que deja sitio al tubo mas largo con freno del catalogo.
  torreta: { tipo: 'cuadrada', cx: -0.55, base: 2.08, r: 0.95, alto: 0.7 },
  cupula: { x: -0.5, w: 0.42, h: 0.2 },

  tubo: { x: 0.3, largo: 3.6, r: 0.16, mantelete: 0.44, freno: 'dos' },

  bultos: [[1.15, 2.08, 1.05, 0.24], [-2.7, 2.08, 0.66, 0.2]],
  extras: [{ tipo: 'caja', x: -3.32, y: 1.1, w: 0.34, h: 0.5 }],

  retroceso: 0.38,
  piezas: 17,
};
