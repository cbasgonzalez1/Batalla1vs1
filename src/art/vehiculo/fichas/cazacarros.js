/**
 * CAZACARROS, 1943.
 *
 * Valida el casco SIN TORRETA y el tren de rodaje con rodillos de retorno. Todo
 * su caracter esta en la proporcion tubo/casco: si el tubo no incomoda al
 * mirarlo, es corto (docs/CATALOGO-VEHICULOS.md §2).
 */
export const cazacarros = {
  id: 'cazacarros',
  nombre: 'CAZACARROS',
  anio: 1943,
  clase: 'Cazacarros',

  // Cuna: una sola superficie inclinada del techo al morro. La silueta mas baja
  // del catalogo, y por eso el casco es alto pero el vehiculo no lo parece.
  L: 5.4,
  alto: 1.55,
  y0: 0.88,
  perfil: 'cuna',
  opts: { techo: 0.36 },

  // Con rodillos la cinta va mas alta que la rodadura y se ve el hueco: es lo
  // que lo separa de la MEDIA a primera vista.
  rodaje: { tipo: 'oruga', r: 0.31, x0: -2.76, x1: 2.76, ruedas: 6, rodillos: 3, eslabones: 28 },

  torreta: null,
  // El mantelete esferico es la unica pieza que rompe la cuna, y por eso es
  // grande: sin el, el tubo sale de una ranura limpia y parece sin acabar.
  tubo: { x: -0.4, largo: 4.2, r: 0.15, mantelete: 0.46, freno: 'ninguno' },

  bultos: [[-1.6, 2.43, 0.9, 0.22]],
  extras: [{ tipo: 'caja', x: -2.94, y: 1.2, w: 0.3, h: 0.44 }],

  retroceso: 0.35,
  piezas: 12,
};
