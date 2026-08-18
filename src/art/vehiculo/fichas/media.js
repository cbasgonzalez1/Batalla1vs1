/**
 * MEDIA, 1942. Carro medio.
 *
 * Es la VARA DE MEDIR del catalogo: el vehiculo de la imagen de referencia
 * aprobada, y el primero que se modela. Los otros catorce se hacen copiando esta
 * silueta y cambiando solo lo que su ficha mande (docs/CATALOGO-VEHICULOS.md §3).
 *
 * Solo numeros. Una ficha NO importa Three: asi el catalogo se prueba sin escena
 * y `tests/arquitectura.test.js` lo vigila en rojo.
 * Unidades de plancha, con el suelo en y = 0 y el vehiculo mirando a +X.
 */
export const media = {
  id: 'media',
  nombre: 'MEDIA',
  anio: 1942,
  clase: 'Carro medio',

  // Casco: panza redondeada con la meseta central. 0,95 de cuerpo mas 0,46 de
  // alza; el frontal cae a 55 grados, que es LA lectura de un blindado del 42.
  L: 5.6,
  alto: 0.95,
  y0: 0.7,
  perfil: 'panza',
  opts: { m0: -0.22, m1: 0.16, alza: 0.46 },

  // Sin rodillos de retorno: la cinta apoya en la rodadura. Es su marca, y lo
  // que la separa de un PESADO a primera vista.
  rodaje: { tipo: 'oruga', r: 0.32, x0: -2.86, x1: 2.86, ruedas: 6, rodillos: 0, eslabones: 30 },

  torreta: { tipo: 'redonda', cx: -0.5, base: 2.11, r: 1.0, alto: 0.62 },
  // Cupula desplazada a la derecha: la asimetria que hace que se lea viva.
  cupula: { x: 0.3, w: 0.42, h: 0.22 },

  tubo: { x: 0.45, largo: 3.0, r: 0.13, mantelete: 0.4, freno: 'ninguno' },

  // Nivel B: lo que crece del borde superior. Cofre de techo y caja de morro.
  bultos: [[1.15, 1.65, 0.85, 0.2], [-2.2, 1.65, 0.55, 0.17]],
  // La asimetria grande: el escape, a un lado y solo a uno.
  extras: [{ tipo: 'caja', x: -2.98, y: 1.05, w: 0.3, h: 0.38 }],

  // `ARTE.md` §14: el tubo se hunde 0,35 u casi de golpe. En unidades de juego.
  retroceso: 0.35,
  piezas: 13,
};
