/**
 * Vernier: corregir el tiro anterior con la precision que el pulgar no tiene.
 *
 * El problema, medido: el arrastre util son unos 106 px en un movil de 844 px
 * de alto, y como la potencia interpola el CUADRADO de la velocidad, 1 px vale
 * ~1,07 unidades de alcance. Corregir 1,5 unidades pide mover el dedo 1,4 px,
 * por debajo del temblor de un pulgar sobre cristal (±3 a 5 px). Sin esto, la
 * horquilla fina de Sotavento es inalcanzable y toda la mecanica se queda en
 * "tira otra vez a ver".
 *
 * La solucion NO es un enganche a valores redondos: eso borraria de golpe 8
 * unidades de resolucion. Es un vernier — cerca del tiro anterior el dedo pesa
 * cuatro veces menos, y fuera manda la ganancia normal. Sin modos, sin boton,
 * sin que el jugador tenga que saber que existe.
 *
 * Modulo puro: recibe numeros y devuelve numeros.
 */

export const VERNIER = {
  radio: 40,     // px alrededor de la muesca donde afina
  division: 4,   // cuanto se divide la ganancia dentro del radio
};

/**
 * Ajusta el vector de arrastre para que cerca del anterior avance mas despacio.
 *
 * @param {{x:number,y:number}} arrastre  vector actual, en px
 * @param {{x:number,y:number}|null} muesca  el arrastre del tiro anterior
 * @returns {{x:number,y:number,afinando:boolean}}
 */
export function aplicarVernier(arrastre, muesca, ajustes = VERNIER) {
  if (!muesca) return { ...arrastre, afinando: false };

  const dx = arrastre.x - muesca.x;
  const dy = arrastre.y - muesca.y;
  const distancia = Math.hypot(dx, dy);

  if (distancia >= ajustes.radio) {
    // Fuera del radio: ganancia normal, pero descontando lo que se comprimio
    // dentro. Sin este descuento habria un salto al cruzar el borde y el tiro
    // daria un brinco justo cuando el jugador esta afinando.
    const comprimido = ajustes.radio - ajustes.radio / ajustes.division;
    const factor = (distancia - comprimido) / distancia;
    return {
      x: muesca.x + dx * factor,
      y: muesca.y + dy * factor,
      afinando: false,
    };
  }

  return {
    x: muesca.x + dx / ajustes.division,
    y: muesca.y + dy / ajustes.division,
    afinando: true,
  };
}

/**
 * Unidades de alcance por pixel de pulgar, para poder afirmar que la correccion
 * fina esta por encima del temblor en vez de suponerlo.
 */
export const unidadesPorPixel = (alcanceUtil, pixelesUtiles) => alcanceUtil / pixelesUtiles;
