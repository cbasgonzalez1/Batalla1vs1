/**
 * Calidad adaptativa: el juego baja el pintado hasta que el cuadro cabe.
 *
 * Medido en este ordenador (GPU vieja, lienzo de 1800x3200): 50 ms por cuadro,
 * o sea 20 imagenes por segundo. Y el reparto era plano — 50, 50, 50 — asi que
 * no era un tiron puntual: cada cuadro costaba tres veces el presupuesto. El
 * trabajo NO estaba en la simulacion, que va a paso fijo y ni se entera, sino
 * en pintar cinco millones y medio de pixeles con sombras suaves.
 *
 * De ahi que lo que se toca sea justo eso: cuantos pixeles se pintan y como de
 * cara es la sombra. No se quitan efectos, no se quitan trampas y no se toca
 * la fisica: una partida en red entre un movil bueno y uno viejo tiene que dar
 * el MISMO resultado aunque uno la vea mas borrosa. Bajar calidad es lo unico
 * que se puede hacer sin romper eso.
 *
 * La logica esta aqui, sin Three ni DOM, para poder probarla sin navegador: lo
 * que decide es cuando bajar y cuando subir, y eso es donde se esconden las
 * oscilaciones.
 */

/**
 * De mejor a peor. `pixeles` es el tope de densidad de pantalla; `sombras` el
 * lado del mapa de sombra en texeles, 0 = sin sombras.
 */
export const NIVELES = [
  { nombre: 'alta', pixeles: 2, sombras: 2048, radio: 5 },
  { nombre: 'media', pixeles: 1.5, sombras: 1024, radio: 4 },
  { nombre: 'baja', pixeles: 1.15, sombras: 1024, radio: 3 },
  { nombre: 'minima', pixeles: 1, sombras: 0, radio: 0 },
];

export const AJUSTES = {
  // Presupuesto de cuadro. 16,7 ms son 60 imagenes por segundo; se deja un
  // margen porque un cuadro que clava el presupuesto justo pierde el siguiente.
  bajarMs: 21,
  // Para volver a subir hay que ir MUY holgado. Si el umbral de subida estuviera
  // pegado al de bajada, el juego subiria, se pasaria de presupuesto, bajaria, y
  // el jugador veria la pantalla cambiar de nitidez cada segundo.
  subirMs: 11,
  // Cuadros seguidos por encima del presupuesto antes de bajar. Medio segundo:
  // suficiente para no reaccionar a un cuadro suelto, poco para que una partida
  // entera se juegue a trompicones.
  cuadrosParaBajar: 30,
  // Y diez veces mas para subir. Bajar es urgente; subir no lo es.
  cuadrosParaSubir: 300,
  // Los primeros cuadros son compilacion de shaders y subida de texturas. Medir
  // ahi haria que todo el mundo empezara en calidad minima.
  calentamiento: 45,
  // Un cuadro de mas de esto no es coste de dibujo: es que el movil se ha ido a
  // otra aplicacion o el navegador ha dejado de programar cuadros. No cuenta.
  ignorarMs: 200,
  // Cuantas veces se permite subir. Sin tope, un juego al borde del presupuesto
  // se pasa la partida subiendo y bajando.
  subidasMaximas: 2,
};

/**
 * @param {object} opciones
 * @param {(nivel: object) => void} opciones.aplicar  lo que toca el renderer
 * @param {string} [opciones.fijo]  nombre de nivel para clavarlo y no medir
 */
export function crearCalidad({ aplicar, fijo = null, ajustes = AJUSTES, niveles = NIVELES }) {
  let indice = 0;
  let lentos = 0;
  let rapidos = 0;
  let vistos = 0;
  let subidas = 0;
  const automatico = !fijo;

  if (fijo) {
    const i = niveles.findIndex((n) => n.nombre === fijo);
    if (i >= 0) indice = i;
  }
  aplicar(niveles[indice]);

  return {
    get nivel() {
      return niveles[indice];
    },
    get automatico() {
      return automatico;
    },

    /**
     * Un cuadro mas. Devuelve true si la calidad ha cambiado.
     * @param {number} ms lo que ha tardado el cuadro
     */
    cuadro(ms) {
      if (!automatico) return false;
      if (!Number.isFinite(ms) || ms > ajustes.ignorarMs) return false;
      if (++vistos <= ajustes.calentamiento) return false;

      if (ms > ajustes.bajarMs) {
        // Un cuadro que pasa del DOBLE del presupuesto no necesita media
        // segunda de confirmacion: a 20 imagenes por segundo el jugador ya lo
        // esta sufriendo. Cuenta por tres y la bajada llega en un tercio del
        // tiempo. Medido: bajar de golpe los tres escalones pasaba de cuatro
        // segundos y medio a algo mas de uno.
        lentos += ms > ajustes.bajarMs * 2 ? 3 : 1;
        rapidos = 0;
      } else if (ms < ajustes.subirMs) {
        rapidos++;
        lentos = 0;
      } else {
        // Zona muerta entre los dos umbrales: ni una cosa ni la otra. No se
        // reinician los contadores, porque una racha de cuadros justos seguida
        // de uno bueno sigue siendo una racha de cuadros justos.
        return false;
      }

      if (lentos >= ajustes.cuadrosParaBajar && indice < niveles.length - 1) {
        indice++;
        lentos = 0;
        rapidos = 0;
        aplicar(niveles[indice]);
        return true;
      }

      if (
        rapidos >= ajustes.cuadrosParaSubir &&
        indice > 0 &&
        subidas < ajustes.subidasMaximas
      ) {
        indice--;
        subidas++;
        lentos = 0;
        rapidos = 0;
        aplicar(niveles[indice]);
        return true;
      }

      return false;
    },
  };
}
