/**
 * La franja: las 140 unidades del campo comprimidas en una tira de 44 px.
 *
 * Existe porque el juego esconde al rival a proposito — los cañones estan a 88
 * unidades y en pantalla caben 30. Eso da tension, pero deja al jugador sin
 * forma de razonar sobre lo que construye: con Sotavento importa DONDE cae la
 * arena, y la arena cae fuera de encuadre.
 *
 * La resolucion es basta a proposito: una muestra cada 4 unidades, mas del
 * doble del radio de explosion. Da topologia — donde hay loma y donde hay
 * hondonada — pero no da la solucion de tiro. Si la franja permitiera apuntar,
 * el juego se convertiria en leer una barra en vez de en tirar.
 */

export const FRANJA = {
  muestraCada: 4,   // unidades de mundo por muestra del perfil
  alto: 44,         // px
  margen: 6,        // px libres arriba y abajo para que el perfil respire
};

/** Proyecta una x del mundo a pixeles de la franja. Pura. */
export const aPixel = (x, terreno, ancho) => ((x - terreno.x0) / terreno.width) * ancho;

/**
 * Muestrea el perfil del terreno a resolucion gruesa.
 *
 * Devuelve pares [x, altura] en coordenadas de mundo: el dibujo decide luego
 * como escalarlos, y asi el muestreo se puede probar sin canvas.
 */
export function muestrearPerfil(terreno, cada = FRANJA.muestraCada) {
  const muestras = [];
  for (let x = terreno.x0; x <= terreno.x0 + terreno.width; x += cada) {
    muestras.push([x, terreno.heightAt(x)]);
  }
  return muestras;
}

/** Rango de alturas del muestreo, para escalar el dibujo al relieve real. */
export function rangoDe(muestras) {
  let min = Infinity;
  let max = -Infinity;
  for (const [, h] of muestras) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  // Un campo plano dividiria por cero al normalizar.
  return max - min < 1e-6 ? { min, max: min + 1 } : { min, max };
}

export function crearFranja(lienzo) {
  const ctx = lienzo.getContext('2d');
  let anchoCss = 0;

  function ajustarTamano() {
    const caja = lienzo.getBoundingClientRect();
    const escala = Math.min(devicePixelRatio || 1, 2);
    anchoCss = caja.width;
    lienzo.width = Math.max(1, Math.round(caja.width * escala));
    lienzo.height = Math.round(FRANJA.alto * escala);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
  }

  /**
   * @param {object} vista
   * @param {object} vista.terreno
   * @param {Array}  vista.plantel      posiciones y bando de cada vehiculo
   * @param {number} vista.activo       indice del que juega
   * @param {object} vista.marcas       { corta, larga } en x de mundo, o null
   * @param {number|null} vista.deposito x donde caera la arena, durante el arrastre
   * @param {object} vista.colores
   */
  function pintar(vista) {
    if (!lienzo.isConnected) return;
    if (lienzo.width === 0 || anchoCss === 0) ajustarTamano();

    const { terreno, plantel, activo, marcas, deposito, colores } = vista;
    const ancho = anchoCss;
    const alto = FRANJA.alto;
    const px = (x) => aPixel(x, terreno, ancho);

    ctx.clearRect(0, 0, ancho, alto);

    // Perfil
    const muestras = muestrearPerfil(terreno);
    const { min, max } = rangoDe(muestras);
    const util = alto - FRANJA.margen * 2;
    const aY = (h) => alto - FRANJA.margen - ((h - min) / (max - min)) * util;

    ctx.beginPath();
    ctx.moveTo(0, alto);
    for (const [x, h] of muestras) ctx.lineTo(px(x), aY(h));
    ctx.lineTo(ancho, alto);
    ctx.closePath();
    ctx.fillStyle = colores.terreno;
    ctx.fill();

    // La banda entre la marca corta y la larga: el hueco donde esta la solucion.
    if (marcas?.corta != null && marcas?.larga != null) {
      const a = px(Math.min(marcas.corta, marcas.larga));
      const b = px(Math.max(marcas.corta, marcas.larga));
      ctx.fillStyle = colores.banda;
      ctx.fillRect(a, 0, Math.max(1, b - a), alto);
    }

    const marcar = (x, color, grosor = 2) => {
      ctx.fillStyle = color;
      ctx.fillRect(px(x) - grosor / 2, 0, grosor, alto);
    };

    if (marcas?.corta != null) marcar(marcas.corta, colores.marca);
    if (marcas?.larga != null) marcar(marcas.larga, colores.marca);

    // Donde va a caer la arena, mientras se arrastra.
    if (deposito != null) marcar(deposito, colores.arena, 3);

    // Los vehiculos, encima de todo.
    plantel.forEach((quien, i) => {
      const x = px(quien.x);
      const y = aY(terreno.heightAt(quien.x)) - 3;
      ctx.fillStyle = i === activo ? colores.activo : colores[quien.bando];
      ctx.beginPath();
      ctx.arc(x, Math.max(4, y), i === activo ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return { pintar, ajustarTamano };
}
