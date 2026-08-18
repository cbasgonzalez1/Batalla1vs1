/**
 * Donde va cada pieza. Es el modulo que arregla el campo «mal disenado».
 *
 * Cada pieza declara el ancho que ocupa en el terreno y pasa por un registro de
 * tramos que NIEGA la colocacion si no cabe. No es una comodidad: sin el, dos
 * piezas se encaballan y el campo entero se ve mal por muy bien resuelta que
 * este cada una por separado (`docs/ESCENARIOS.md` §0.1).
 *
 * Tres reglas, y las tres estaban rotas antes de existir esto:
 *
 *  0.1 Nada se solapa. Se reservan PRIMERO los emplazamientos, sus parapetos y
 *      el hito —son intocables— y el decorado se acomoda a ellos.
 *  0.2 bis Lo ancho busca terreno llano: un edificio a caballo de una vaguada
 *      tiene que bajar y subir su base y se lee como un cimiento en V.
 *  0.3 Se coloca de mayor a menor. El tranvia de 5 u tiene un solo sitio
 *      posible y las cajas de 2,2 tienen diez: al reves, las pequenas ocupan el
 *      unico vano ancho y la pieza que DEFINE el teatro se queda fuera.
 *
 * Puro a proposito: ni Three ni DOM, para que se pruebe sin escena.
 */

/**
 * @param {number} x0  borde izquierdo del campo
 * @param {number} x1  borde derecho
 */
export function crearReserva(x0, x1) {
  const usados = [];
  return {
    ocupar(cx, ancho) {
      usados.push([cx - ancho / 2, cx + ancho / 2]);
      usados.sort((a, b) => a[0] - b[0]);
    },

    /** Los tramos que quedan libres, de izquierda a derecha. */
    libres(margen = 0.5) {
      const out = [];
      let c = x0;
      for (const [a, b] of usados) {
        if (a - margen > c) out.push([c, a - margen]);
        c = Math.max(c, b + margen);
      }
      if (c < x1) out.push([c, x1]);
      return out;
    },

    /**
     * Coloca en un hueco de verdad, sorteando uno ponderado por su tamano.
     *
     * Probar a los lados de una x pedida y rendirse a las cinco unidades —que es
     * lo que hacia la primera version— deja el campo vacio: con dos
     * emplazamientos y un hito reservados, casi todo lo sorteado cae dentro de
     * algo ocupado.
     *
     * @param {number} ancho    lo que la pieza ocupa en el terreno
     * @param {() => number} rng
     * @param {(x:number) => number} [suelo]  si se pasa, lo ancho busca lo llano
     * @returns {number|null} la x del centro, o null si no cabe en ningun hueco
     */
    colocar(ancho, rng, margen = 0.45, suelo = null) {
      const cabe = this.libres(margen).filter(([a, b]) => b - a >= ancho);
      if (!cabe.length) return null;
      const total = cabe.reduce((s, [a, b]) => s + (b - a), 0);
      let u = rng() * total;
      let tramo = cabe[cabe.length - 1];
      for (const [a, b] of cabe) {
        if (u < b - a) { tramo = [a, b]; break; }
        u -= b - a;
      }
      const [a, b] = tramo;
      const libre = b - a - ancho;
      if (!suelo || ancho < 2.5 || libre < 0.5) return a + ancho / 2 + rng() * libre;
      return llano(suelo, a + ancho / 2, libre, ancho);
    },
  };
}

/**
 * De varias posiciones candidatas dentro del hueco, la de menor desnivel bajo la
 * huella. Es lo unico que impide que una pieza ancha caiga a caballo de una
 * vaguada (`docs/ESCENARIOS.md` §0.2 bis).
 */
export function llano(suelo, desde, recorrido, ancho, pasos = 8) {
  let mejor = desde;
  let coste = Infinity;
  for (let i = 0; i <= pasos; i++) {
    const c = desde + (recorrido * i) / pasos;
    let alto = -Infinity;
    let bajo = Infinity;
    for (let x = c - ancho / 2; x <= c + ancho / 2; x += 0.3) {
      const y = suelo(x);
      if (y > alto) alto = y;
      if (y < bajo) bajo = y;
    }
    if (alto - bajo < coste) { coste = alto - bajo; mejor = c; }
  }
  return mejor;
}

/**
 * La cola de piezas de un teatro, ya ordenada de mayor a menor.
 *
 * `densidad` reparte la misma densidad de la plancha por un campo mucho mas
 * ancho: la plancha encuadra 38 unidades y el juego tiene 140, asi que las
 * `veces` de la tabla se multiplican en vez de dejar un campo vacio con nueve
 * piezas perdidas.
 */
export function cola(props, catalogo, densidad = 1) {
  const salida = [];
  for (const id of props) {
    const fam = catalogo[id];
    if (!fam) continue;
    const cuantas = Math.max(1, Math.round(fam.veces * densidad));
    for (let i = 0; i < cuantas; i++) salida.push({ id, ...fam });
  }
  return salida.sort((a, b) => b.ancho - a.ancho);
}
